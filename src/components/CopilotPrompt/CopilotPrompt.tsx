import React, { useEffect, useState } from "react";
import {
  Box,
  TextField,
  Typography,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip,
  Paper,
  Drawer,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  keyframes,
  Checkbox,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import HistoryIcon from "@mui/icons-material/History";
import { useAuth } from "../context/AuthContext";
import {
  COPILOT_PROMPTS,
  PROMPT_LOGS,
} from " @components/lib/firestoreClient/collections";
import { db } from " @components/lib/firestoreServer/admin";
import { PromptChange } from " @components/types/INode";
import {
  query,
  collection,
  where,
  limit,
  onSnapshot,
  getFirestore,
  doc,
  updateDoc,
  setDoc,
  getDoc,
  orderBy,
} from "firebase/firestore";

import InboxIcon from "@mui/icons-material/MoveToInbox";
import MailIcon from "@mui/icons-material/Mail";
import OptimizedAvatar from "../Chat/OptimizedAvatar";
import moment from "moment";
import MarkdownRender from "../Markdown/MarkdownRender";
import { TreeItem, TreeView } from "@mui/lab";
import { capitalizeFirstLetter } from " @components/lib/utils/string.utils";
import { DISPLAY, PROPERTIES_TO_IMPROVE } from " @components/lib/CONSTANTS";
import {
  getCopilotPrompt,
  getDeleteNodesPrompt,
  getImprovementsStructurePrompt,
  getNewNodesPrompt,
  getNotesPrompt,
  getResponseStructure,
} from " @components/lib/utils/copilotPrompts";

import { getNodesInThreeLevels } from " @components/lib/utils/helpersCopilot";
import GuidLines from "../Guidelines/GuideLines";

const glowGreen = keyframes`
  0% {
    box-shadow: 0 0 5px #26C281, 0 0 10px #26C281, 0 0 20px #26C281, 0 0 30px #26C281;
  }
  50% {
    box-shadow: 0 0 10px #26C281, 0 0 20px #26C281, 0 0 30px #26C281, 0 0 40px #26C281;
  }
  100% {
    box-shadow: 0 0 5px #26C281, 0 0 10px #26C281, 0 0 20px #26C281, 0 0 30px #26C281;
  }
`;

interface EditableSchemaProps {
  setGenerateNewNodes: any;
  generateNewNodes: boolean;
  proposeDeleteNode: boolean;
  setProposeDeleteNodes: any;
  nodeType: string;
  selectedProperties: Set<string>;
  setSelectedProperties: any;
  inputProperties: any;
  setInputProperties: any;
  nodes: any;
  nodeTitle: string;
  numberValue: number;
  handleNumberChange: any;
  inputValue: string;
  handleInputChange: any;
}

const CopilotPrompt: React.FC<EditableSchemaProps> = ({
  setGenerateNewNodes,
  generateNewNodes,
  proposeDeleteNode,
  setProposeDeleteNodes,
  nodeType,
  selectedProperties,
  setSelectedProperties,
  inputProperties,
  setInputProperties,
  nodes,
  nodeTitle,
  numberValue,
  handleNumberChange,
  inputValue,
  handleInputChange,
}) => {
  const db = getFirestore();
  const [{ user }] = useAuth();
  const [systemPrompt, setSystemPrompt] = useState<
    {
      id: string;
      type?: string;
      value?: string;
      editablePart?: string;
      endClose?: string;
    }[]
  >([]);
  const [systemPromptCopy, setSystemPromptCopy] = useState<
    {
      id: string;
      type?: string;
      value?: string;
      editablePart?: string;
      endClose?: string;
    }[]
  >([]);

  const [forceUpdate, setForceUpdate] = useState<any>(false);
  const [editedParts, setEditedParts] = useState<
    {
      editedId: string;
      newValue: string;
      previousValue: string;
    }[]
  >([]);

  const [diffChanges, setDiffChanges] = useState<{
    [id: string]: {
      previousValue: string;
      newValue: string;
    };
  } | null>(null);
  const [previousVersion, setPreviousVersion] = useState<
    | {
        id: string;
        value?: string;
        editablePart?: string;
        endClose?: string;
      }[]
    | null
  >(null);
  const [previousVersionId, setPreviousVersionId] = useState<string | null>(
    null,
  );

  const [promptHistory, setPromptHistory] = useState<
    (PromptChange & { id: string })[]
  >([]);
  const [showPromptHistory, setShowPromptHistory] = useState(false);
  const [glowIds, setGlowIds] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);

  const editPrompt = user?.uname === "ouhrac" || user?.uname === "1man";

  useEffect(() => {
    if (!user?.uname) return;

    const promptsQuery = query(
      collection(db, COPILOT_PROMPTS),
      where("editor", "==", user.uname),
      limit(1),
    );
    const unsubscribePrompt = onSnapshot(promptsQuery, (snapshot) => {
      const docChanges = snapshot.docChanges();
      if (docChanges.length > 0) {
        const docChange = docChanges[0].doc.data();
        setSystemPrompt([...docChange.systemPrompt]);
        setSystemPromptCopy(JSON.parse(JSON.stringify(docChange.systemPrompt)));
      }
      // setLoading(false);
    });

    return () => unsubscribePrompt();
  }, [db, user?.uname]);

  useEffect(() => {
    if (!user?.uname) return;

    const promptHistoryQuery = query(
      collection(db, PROMPT_LOGS),
      orderBy("modifiedAt", "desc"),
      limit(100),
    );

    const unsubscribeNodes = onSnapshot(promptHistoryQuery, (snapshot) => {
      const docChanges = snapshot.docChanges();
      setPromptHistory((prev: (PromptChange & { id: string })[]) => {
        const _prev = [...prev];
        for (let change of docChanges) {
          const index = _prev.findIndex((c) => c.id === change.doc.id);
          if (index === -1 && change.type === "added") {
            const changeData = change.doc.data() as PromptChange;
            const id = change.doc.id;
            _prev.push({ ...changeData, id });
          } else if (index !== -1 && change.type === "removed") {
            _prev.splice(index, 1);
          }
        }
        return _prev;
      });
      // setLoading(false);
    });

    return () => unsubscribeNodes();
  }, [db, user?.uname]);

  const saveLogPrompt = (logs: { [id: string]: any }) => {
    try {
      const promptLogRef = doc(collection(db, PROMPT_LOGS));
      setDoc(promptLogRef, {
        ...logs,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleSave = async (e: any) => {
    try {
      e.preventDefault();
      e.stopPropagation();
      if (!user?.uname) return;
      const changeDetails: { [key: string]: any } = {};
      const _systemPrompt = previousVersion || systemPrompt;
      for (let edit of editedParts) {
        const index = _systemPrompt.findIndex((p) => p.id === edit.editedId);
        _systemPrompt[index].editablePart = edit.newValue;
        changeDetails[edit.editedId] = {
          ...edit,
        };
      }
      setEditedParts([]);
      // JSON.parse(schema.replace(/`/g, ""));
      // setError(null);
      const promptRef = doc(collection(db, COPILOT_PROMPTS), user?.uname);
      const promptDoc = await getDoc(promptRef);
      const promptData = promptDoc.data();

      if (promptDoc.exists()) {
        updateDoc(promptRef, {
          systemPrompt: _systemPrompt,
          updatedAt: new Date(),
        });
      } else {
        setDoc(promptRef, {
          systemPrompt,
          editor: user.uname,
          createdAt: new Date(),
        });
      }

      if (!promptData) return;
      saveLogPrompt({
        previousValue: {
          systemPrompt: promptData.systemPrompt,
        },
        newValue: {
          systemPrompt: _systemPrompt,
        },
        changeDetails,
        modifiedAt: new Date(),
        modifiedBy: user?.uname,
        modifiedByDetails: {
          fName: user.fName,
          lName: user.lName,
          imageUrl: user.imageUrl,
        },
      });
      setPreviousVersion(null);
    } catch (e) {
      console.error(e);
    }
  };
  const toggleDrawer = (newOpen: boolean) => () => {
    setShowPromptHistory(newOpen);
  };

  const handleInput = (id: string, event: any) => {
    const newValue = event.target.value;
    if (previousVersion) {
      setPreviousVersion((prev: any) => {
        const _prev = [...prev];

        const idx = prev.findIndex((p: any) => p.id === id);
        _prev[idx].editablePart = newValue;
        return _prev;
      });
    } else {
      setSystemPrompt((prev) => {
        const _prev = [...prev];

        const idx = prev.findIndex((p) => p.id === id);
        _prev[idx].editablePart = newValue;
        return _prev;
      });
    }

    setEditedParts((prev) => {
      const _prev = [...prev];
      const prIdx = _prev.findIndex((p) => p.editedId === id);
      const idx = systemPromptCopy.findIndex((p) => p.id === id);

      if (prIdx !== -1 && idx !== -1) {
        if (systemPromptCopy[idx].editablePart !== newValue) {
          _prev[prIdx].newValue = newValue;
        } else {
          _prev.splice(prIdx, 1);
        }
      } else if (
        idx !== -1 &&
        systemPromptCopy[idx].hasOwnProperty("editablePart") &&
        systemPromptCopy[idx].editablePart !== newValue
      ) {
        _prev.push({
          editedId: id,
          newValue,
          previousValue: systemPromptCopy[idx].editablePart || "",
        });
      }
      return _prev;
    });
    // setForceUpdate((prev: any) => !prev);
    // onEdit(id, newValue);
  };

  const cancelChanges = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    setForceUpdate((prev: any) => !prev);
    setEditedParts([]);
    setSystemPrompt(JSON.parse(JSON.stringify(systemPromptCopy)));
    setPreviousVersion(null);
  };
  const compareToLatest = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    if (diffChanges) {
      setDiffChanges(null);
      return;
    }
    if (!previousVersion) return;
    const _diffChanges: any = {};
    for (let p of systemPrompt) {
      if (!p.hasOwnProperty("editablePart")) {
        continue;
      }
      const previousIdx = previousVersion?.findIndex((_p) => _p.id === p.id);
      if (
        previousIdx !== -1 &&
        previousVersion[previousIdx].editablePart !== p.editablePart
      ) {
        _diffChanges[p.id] = {
          previousValue: p.editablePart,
          newValue: previousVersion[previousIdx].editablePart,
        };
      }
    }

    setDiffChanges(_diffChanges);

    let id = Object.keys(_diffChanges)[0];
    if (!id) {
      id = "no-diff";
    }

    setTimeout(() => {
      const element = document.getElementById(`${id}`);
      if (element) {
        element.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }, 500);

    setGlowIds(new Set(Object.keys(_diffChanges)));
    setTimeout(() => {
      setGlowIds(new Set());
    }, 1000);
    setExpanded(true);
  };
  const rollBack = async (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user?.uname) return;
    const promptRef = doc(collection(db, COPILOT_PROMPTS), user?.uname);
    const promptDoc = await getDoc(promptRef);
    const promptData = promptDoc.data();

    if (promptDoc.exists()) {
      updateDoc(promptRef, {
        systemPrompt: previousVersion,
        updatedAt: new Date(),
      });
    } else {
      setDoc(promptRef, {
        systemPrompt,
        editor: user.uname,
        createdAt: new Date(),
      });
    }
    setDiffChanges(null);
    setPreviousVersion(null);
    if (!promptData) return;
    saveLogPrompt({
      previousValue: {
        systemPrompt: promptData.systemPrompt,
      },
      newValue: {
        systemPrompt: previousVersion,
      },
      changeDetails: {},
      modifiedAt: new Date(),
      modifiedBy: user?.uname,
      modifiedByDetails: {
        fName: user.fName,
        lName: user.lName,
        imageUrl: user.imageUrl,
      },
      rollBack: true,
      rollBackId: previousVersionId || "",
    });
    setEditedParts([]);
  };

  const promptHistoryList = (
    <Box
      sx={{
        width: 400,
      }}
    >
      <List
        sx={{
          gap: "14px",
        }}
      >
        {promptHistory
          .sort((a: any, b: any) => {
            return (
              new Date(b.modifiedAt.toDate()).getTime() -
              new Date(a.modifiedAt.toDate()).getTime()
            );
          })
          .map((log) => (
            <ListItem
              key={log.id}
              disablePadding
              sx={{
                px: "7px",
                py: "5px",
                backgroundColor: log.id === previousVersionId ? "#2c5e2c" : "",
              }}
            >
              <ListItemIcon>
                <OptimizedAvatar
                  imageUrl={log.modifiedByDetails.imageUrl}
                  alt={log.modifiedByDetails.fName}
                  size={40}
                />
              </ListItemIcon>

              <ListItemText
                primary={
                  <Box>
                    <Typography
                      sx={{
                        fontSize: "13px",
                        color: log.id === previousVersionId ? "white" : "",
                      }}
                    >
                      {moment(log.modifiedAt.toDate()).format("M/D/YY, h:mm A")}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: "13px",
                        color: log.id === previousVersionId ? "white" : "",
                      }}
                    >
                      {log.modifiedByDetails.fName}{" "}
                      {log.modifiedByDetails.lName}
                    </Typography>
                  </Box>
                }
              />
              {log.id !== previousVersionId && (
                <Button
                  variant="outlined"
                  sx={{ borderRadius: "25px" }}
                  onClick={() => {
                    setShowPromptHistory(false);
                    // setDiffChanges(log.changeDetails);
                    setPreviousVersion(log.previousValue.systemPrompt);
                    setPreviousVersionId(log.id);
                    setDiffChanges(null);
                  }}
                >
                  {" "}
                  view
                </Button>
              )}
            </ListItem>
          ))}
      </List>
      <Divider />
    </Box>
  );

  return (
    <Box sx={{ mb: 10 }}>
      <Drawer
        open={showPromptHistory}
        sx={{
          zIndex: 5000,
        }}
        onClose={toggleDrawer(false)}
      >
        {promptHistoryList}
      </Drawer>
      {!generateNewNodes &&
        selectedProperties.size <= 0 &&
        !proposeDeleteNode &&
        editPrompt && (
          <Typography sx={{ color: "red", mb: "15px" }}>
            {`Select at least one option: 'Propose New Nodes,' 'Propose Improvement' or "Propose Node Deletion"!`}
          </Typography>
        )}

      {diffChanges !== null && Object.keys(diffChanges).length <= 0 && (
        <Typography
          id="no-diff"
          sx={{
            color: "#7cacf8",
            fontSize: "19px",
            mb: "17px",
          }}
        >
          This version is the same as the latest version!
        </Typography>
      )}
      <Paper elevation={5}>
        <Accordion
          expanded={expanded}
          sx={{ p: 0, m: 0, position: "sticky", top: 0 }}
          TransitionProps={{ timeout: 150 }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              position: "sticky",
              top: 0,
              backgroundColor: (theme) =>
                theme.palette.mode === "dark" ? "#242425" : "#d0d5dd",
              m: 0,
              zIndex: 5,
              flexDirection: "row-reverse",
              // height: "50px",
              // msFlexDirection: "c",
            }}
            onClick={() => {
              setExpanded((prev) => !prev);
            }}
          >
            <Box
              sx={{
                display: "flex",
                gap: "13px",
              }}
            >
              <Typography
                sx={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  pl: "13px",
                }}
              >
                System Prompt
              </Typography>

              <Box
                sx={{
                  ml: "auto",
                  gap: "15px",
                }}
              >
                {editedParts.length > 0 && (
                  <Button
                    variant="outlined"
                    sx={{
                      borderRadius: "25px",
                      fontSize: "13px",
                      height: "30px",
                      ml: "5px",
                    }}
                    onClick={handleSave}
                  >
                    Save
                  </Button>
                )}
                {editedParts.length > 0 && (
                  <Button
                    variant="outlined"
                    sx={{
                      borderRadius: "25px",
                      color: "white",
                      backgroundColor: "red",
                      fontSize: "13px",
                      height: "30px",
                      ml: "5px",
                    }}
                    onClick={cancelChanges}
                  >
                    Discard
                  </Button>
                )}
                {previousVersion && (
                  <Button
                    sx={{
                      borderRadius: "25px",
                      ml: "5px",
                      fontSize: "13px",
                      height: "30px",
                    }}
                    variant="outlined"
                    onClick={(e: any) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDiffChanges(null);
                      setPreviousVersion(null);
                      setPreviousVersionId(null);
                    }}
                  >
                    Close View
                  </Button>
                )}
                {previousVersion && (
                  <Button
                    sx={{
                      borderRadius: "25px",
                      fontSize: "13px",
                      height: "30px",
                      ml: "5px",
                    }}
                    variant="outlined"
                    onClick={rollBack}
                  >
                    Roll back this version
                  </Button>
                )}
                {previousVersion && (
                  <Button
                    sx={{
                      borderRadius: "25px",
                      backgroundColor: diffChanges ? "#7cacf8" : "",
                      fontSize: "13px",
                      color: diffChanges ? "black" : "",
                      height: "30px",
                      mr: "10px",
                      ml: "5px",
                      ":hover": {
                        backgroundColor: "#7cacf8",
                      },
                    }}
                    variant="outlined"
                    onClick={compareToLatest}
                  >
                    {diffChanges ? "Exit Compare View" : "Compare to latest"}
                  </Button>
                )}
                {promptHistory.length > 0 && (
                  <Tooltip title="Previous prompt versions">
                    <IconButton
                      onClick={(e: any) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowPromptHistory(true);
                      }}
                      sx={{ m: 0, ml: "15px" }}
                    >
                      <HistoryIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>{" "}
          </AccordionSummary>
          <AccordionDetails
            sx={{
              backgroundColor: (theme) =>
                theme.palette.mode === "dark" ? "#37373a" : "#e1e1e1",
              marginBottom: "150px",
            }}
          >
            <Box
              sx={{
                width: "100%",
                maxWidth: "100%",
                margin: "0 auto",
                padding: 2,
                boxSizing: "border-box",
              }}
            >
              <Accordion>
                <AccordionSummary>
                  <Typography sx={{ fontSize: "23px" }}>Definitions</Typography>
                  <ExpandMoreIcon sx={{ ml: "12px" }} />
                </AccordionSummary>
                <AccordionDetails>
                  {(previousVersion || systemPrompt).map((p: any) => (
                    <Box
                      key={p.id}
                      id={p.id}
                      sx={{
                        display: "flex",
                        alignItems: "flex-start",
                        mt: 1,
                        flexDirection: { xs: "column", sm: "row" },
                        mb: "25px",
                      }}
                    >
                      {" "}
                      <Typography
                        sx={{
                          flexShrink: 0,
                          fontSize: { xs: "16px", sm: "20px" },
                          lineHeight: "1.5",
                          textAlign: { xs: "center", sm: "left" },
                          width: "100%",
                          animation: glowIds.has(p.id)
                            ? `${glowGreen} 1.5s ease-in-out infinite`
                            : "",
                        }}
                      >
                        {" "}
                        {/*    <Box sx={{ mt: "14px" }}>
                      <MarkdownRender text={p.value || ""} />
                    </Box> */}
                        {diffChanges && diffChanges[p.id] && (
                          <Typography
                            sx={{
                              color: "red",
                              display: "inline",
                              px: "4px",
                              textDecoration: "line-through",
                              fontSize: { xs: "16px", sm: "20px" },
                            }}
                          >
                            {diffChanges[p.id].previousValue}
                          </Typography>
                        )}
                        {diffChanges && diffChanges[p.id] && (
                          <Typography
                            sx={{
                              color: "green",
                              display: "inline",
                              fontSize: { xs: "16px", sm: "20px" },
                            }}
                          >
                            {diffChanges[p.id].newValue}
                          </Typography>
                        )}
                        {p.hasOwnProperty("editablePart") &&
                          (!diffChanges || !diffChanges[p.id]) && (
                            <TextField
                              value={p.editablePart}
                              onChange={(event) => handleInput(p.id, event)}
                              fullWidth
                              // rows={14}
                              label={p.type}
                              multiline
                            />
                            // <Typography
                            //   key={forceUpdate}
                            //   component="span"
                            //   contentEditable={!previousVersionId}
                            //   suppressContentEditableWarning
                            //   sx={{
                            //     display: "inline",
                            //     borderBottom: !previousVersionId
                            //       ? "1.5px dashed #ff6d00"
                            //       : "",
                            //     paddingBottom: "2px",
                            //     cursor: "text",
                            //     px: "4px",
                            //     color: "inherit",
                            //     fontSize: { xs: "16px", sm: "20px" },
                            //   }}
                            //   onInput={(event) => handleInput(p.id, event)}
                            // >
                            //   {p.editablePart}
                            // </Typography>
                          )}
                        {p.endClose}
                      </Typography>
                    </Box>
                  ))}
                </AccordionDetails>
              </Accordion>
              <Accordion defaultExpanded={true}>
                <AccordionSummary>
                  <Typography sx={{ fontSize: "23px" }}>
                    Input Components
                  </Typography>
                  <ExpandMoreIcon sx={{ ml: "12px" }} />
                </AccordionSummary>
                <AccordionDetails sx={{ ml: "20px" }}>
                  {[
                    ...PROPERTIES_TO_IMPROVE.allTypes,
                    ...(PROPERTIES_TO_IMPROVE[nodeType] || []),
                  ].map((property: string) => (
                    <Box key={property} sx={{ display: "flex", mb: "12px" }}>
                      <Checkbox
                        checked={inputProperties.has(property)}
                        sx={{ p: 0 }}
                        onClick={() => {
                          setInputProperties((prev: Set<string>) => {
                            const _prev = new Set(prev);
                            if (_prev.has(property)) {
                              _prev.delete(property);
                            } else {
                              _prev.add(property);
                            }
                            return _prev;
                          });
                        }}
                        disabled={property === "title"}
                      />
                      <Typography sx={{ ml: "5px" }}>
                        {capitalizeFirstLetter(
                          DISPLAY[property] ? DISPLAY[property] : property,
                        )}
                      </Typography>
                    </Box>
                  ))}
                </AccordionDetails>
                <TextField
                  margin="dense"
                  id="number-input"
                  type="number"
                  label={
                    <Box>
                      How far away from this node{" "}
                      <strong style={{ color: "orange" }}>{nodeTitle} </strong>
                      should I explore to propose improvements?
                    </Box>
                  }
                  value={numberValue || ""}
                  onChange={handleNumberChange}
                  inputProps={{ min: 0 }}
                  fullWidth
                  sx={{
                    mt: 3,
                    ml: "18px",
                    mr: "18px",
                    width: "auto",
                    display: "block",
                    textAlign: "center",
                    "& .MuiInputLabel-root": {
                      color: "gray",
                    },
                  }}
                />
                <Accordion
                  sx={{
                    backgroundColor: (theme) =>
                      theme.palette.mode === "dark" ? "#1e1919" : "#d0d5dd",
                    mx: "19px",
                  }}
                  TransitionProps={{ timeout: 150 }}
                >
                  <AccordionSummary>
                    <Typography sx={{ fontSize: "17px" }}>
                      <strong style={{ color: "orange", fontSize: "19px" }}>
                        {nodes.length}
                      </strong>{" "}
                      Nodes:{" "}
                    </Typography>
                    <ExpandMoreIcon sx={{ ml: "12px", mt: "3px" }} />
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography sx={{ whiteSpace: "pre-wrap", mt: "14px" }}>
                      {JSON.stringify(nodes, null, 2)}
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              </Accordion>

              <Accordion TransitionProps={{ timeout: 150 }}>
                <AccordionSummary>
                  <Typography sx={{ fontSize: "23px" }}>
                    Response Structure
                  </Typography>
                  <ExpandMoreIcon sx={{ ml: "12px", mt: "7px" }} />
                </AccordionSummary>
                <AccordionDetails>
                  <Box>
                    <Box
                      sx={{
                        display: "flex",
                        ml: "7px",
                        mb: "10px",
                        p: 1,
                        cursor: "pointer",
                        ":hover": {
                          backgroundColor: "#766a57",
                          borderRadius: "25px",
                        },
                      }}
                      onClick={() => {
                        setGenerateNewNodes((prev: boolean) => !prev);
                      }}
                    >
                      <Checkbox
                        checked={generateNewNodes}
                        sx={{ p: 0, zIndex: 0 }}
                      />
                      <Typography sx={{ ml: "15px" }}>
                        {" "}
                        Propose New Nodes
                      </Typography>
                    </Box>
                    <Accordion
                      sx={{
                        backgroundColor: (theme) =>
                          theme.palette.mode === "dark" ? "#1e1919" : "#d0d5dd",
                      }}
                    >
                      <AccordionSummary>
                        <Checkbox
                          checked={selectedProperties.size > 0}
                          sx={{ p: 0 }}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setSelectedProperties((prev: Set<string>) => {
                              if (prev.size > 0) {
                                return new Set();
                              }
                              return new Set([
                                ...PROPERTIES_TO_IMPROVE.allTypes,
                                ...(PROPERTIES_TO_IMPROVE[nodeType] || []),
                              ]);
                            });
                          }}
                        />
                        <Typography sx={{ ml: "5px" }}>
                          Propose Improvements to Existing Nodes
                        </Typography>
                        <ExpandMoreIcon sx={{ ml: "12px" }} />
                      </AccordionSummary>
                      <AccordionDetails sx={{ ml: "20px" }}>
                        {[
                          ...PROPERTIES_TO_IMPROVE.allTypes,
                          ...(PROPERTIES_TO_IMPROVE[nodeType] || []),
                        ].map((property: string) => (
                          <Box
                            key={property}
                            sx={{ display: "flex", mb: "12px" }}
                          >
                            <Checkbox
                              checked={selectedProperties.has(property)}
                              sx={{ p: 0 }}
                              onClick={() => {
                                setSelectedProperties((prev: Set<string>) => {
                                  const _prev = new Set(prev);
                                  if (_prev.has(property)) {
                                    _prev.delete(property);
                                  } else {
                                    _prev.add(property);
                                  }
                                  return _prev;
                                });
                              }}
                            />
                            <Typography sx={{ ml: "5px" }}>
                              {capitalizeFirstLetter(
                                DISPLAY[property]
                                  ? DISPLAY[property]
                                  : property,
                              )}
                            </Typography>
                          </Box>
                        ))}
                      </AccordionDetails>
                    </Accordion>

                    <Box
                      sx={{
                        display: "flex",
                        ml: "7px",
                        mb: "10px",
                        mt: "5px",
                        p: 1,
                        cursor: "pointer",
                        ":hover": {
                          backgroundColor: "#766a57",
                          borderRadius: "25px",
                        },
                      }}
                      onClick={() => {
                        setProposeDeleteNodes((prev: boolean) => !prev);
                      }}
                    >
                      <Checkbox
                        checked={proposeDeleteNode}
                        sx={{ p: 0, zIndex: 0 }}
                      />
                      <Typography sx={{ ml: "15px" }}>
                        Propose Node Deletion
                      </Typography>
                    </Box>
                  </Box>
                  <Typography sx={{ whiteSpace: "pre-wrap", mt: "14px" }}>
                    {getResponseStructure(
                      selectedProperties.size > 0,
                      proposeDeleteNode,
                    )}
                  </Typography>
                  {selectedProperties.size > 0 && (
                    <Accordion
                      sx={{
                        backgroundColor: (theme) =>
                          theme.palette.mode === "dark" ? "#1e1919" : "#d0d5dd",
                      }}
                    >
                      <AccordionSummary>
                        <Typography sx={{ fontSize: "17px" }}>
                          Improvements
                        </Typography>
                        <ExpandMoreIcon sx={{ ml: "12px" }} />
                      </AccordionSummary>

                      <AccordionDetails>
                        {" "}
                        <Typography sx={{ whiteSpace: "pre-wrap", mt: "14px" }}>
                          {getImprovementsStructurePrompt(
                            selectedProperties.size > 0,
                            selectedProperties,
                          )}
                        </Typography>
                      </AccordionDetails>
                    </Accordion>
                  )}
                  {generateNewNodes && (
                    <Accordion
                      sx={{
                        backgroundColor: (theme) =>
                          theme.palette.mode === "dark" ? "#1e1919" : "#d0d5dd",
                      }}
                    >
                      <AccordionSummary>
                        <Typography sx={{ fontSize: "15px" }}>
                          New Nodes
                        </Typography>
                        <ExpandMoreIcon sx={{ ml: "12px" }} />
                      </AccordionSummary>

                      <AccordionDetails>
                        {" "}
                        <Typography sx={{ whiteSpace: "pre-wrap", mt: "14px" }}>
                          {getNewNodesPrompt(generateNewNodes)}
                        </Typography>
                      </AccordionDetails>
                    </Accordion>
                  )}
                  {proposeDeleteNode && (
                    <Accordion
                      sx={{
                        backgroundColor: (theme) =>
                          theme.palette.mode === "dark" ? "#1e1919" : "#d0d5dd",
                      }}
                    >
                      <AccordionSummary>
                        <Typography sx={{ fontSize: "15px" }}>
                          Delete nodes
                        </Typography>
                        <ExpandMoreIcon sx={{ ml: "12px" }} />
                      </AccordionSummary>

                      <AccordionDetails>
                        {" "}
                        <Typography sx={{ whiteSpace: "pre-wrap", mt: "14px" }}>
                          {getDeleteNodesPrompt(proposeDeleteNode)}
                        </Typography>
                      </AccordionDetails>
                    </Accordion>
                  )}

                  <Accordion
                    sx={{
                      backgroundColor: (theme) =>
                        theme.palette.mode === "dark" ? "#1e1919" : "#d0d5dd",
                    }}
                  >
                    <AccordionSummary>
                      <Typography sx={{ fontSize: "15px" }}>
                        IMPORTANT NOTES
                      </Typography>
                      <ExpandMoreIcon sx={{ ml: "12px" }} />
                    </AccordionSummary>
                    <AccordionDetails>
                      <Typography sx={{ whiteSpace: "pre-wrap", mt: "14px" }}>
                        {getNotesPrompt()}
                      </Typography>
                    </AccordionDetails>
                  </Accordion>
                </AccordionDetails>
              </Accordion>

              <Accordion sx={{ mb: "40px" }}>
                <AccordionSummary>
                  <Typography sx={{ fontSize: "23px" }}>Guidelines</Typography>
                  <ExpandMoreIcon sx={{ ml: "12px", mt: "7px" }} />
                </AccordionSummary>

                <AccordionDetails>
                  {" "}``
                  <GuidLines />
                </AccordionDetails>
              </Accordion>
            </Box>
          </AccordionDetails>
        </Accordion>
        <Accordion
          defaultExpanded={true}
          sx={{
            overflowAnchor: "none",
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              flexDirection: "row-reverse",
              backgroundColor: (theme) =>
                theme.palette.mode === "dark" ? "#242425" : "#d0d5dd",
              fontWeight: "bold",
            }}
          >
            <Typography
              sx={{ pl: "13px", fontSize: "19px", fontWeight: "bold" }}
            >
              User Prompt
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TextField
              autoFocus
              margin="dense"
              id="prompt-input"
              label="Please write your instructions to AI Assistant here:"
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              fullWidth
              multiline
              sx={{
                mx: "auto",
                display: "block",
                textAlign: "center",
                "& .MuiInputLabel-root": {
                  color: "gray",
                },
              }}
            />
          </AccordionDetails>
        </Accordion>
      </Paper>
    </Box>
  );
};

export default CopilotPrompt;
