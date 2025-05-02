import React, { useEffect, useMemo, useState } from "react";
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
  Checkbox,
  Stack,
  Chip,
  useTheme,
  alpha,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import HistoryIcon from "@mui/icons-material/History";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import CloseIcon from "@mui/icons-material/Close";
import SettingsBackupRestoreIcon from "@mui/icons-material/SettingsBackupRestore";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import DifferenceIcon from "@mui/icons-material/Difference";
import NotesIcon from "@mui/icons-material/Notes";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import PlaylistRemoveIcon from "@mui/icons-material/PlaylistRemove";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import InputIcon from "@mui/icons-material/Input";
import ChecklistIcon from "@mui/icons-material/Checklist";
import RuleIcon from "@mui/icons-material/Rule";
import ArticleIcon from "@mui/icons-material/Article";

import { useAuth } from "../context/AuthContext";
import {
  COPILOT_PROMPTS,
  PROMPT_LOGS,
} from "@components/lib/firestoreClient/collections";
import { PromptChange } from "@components/types/INode";
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

import OptimizedAvatar from "../Chat/OptimizedAvatar";
import moment from "moment";
import { capitalizeFirstLetter } from "@components/lib/utils/string.utils";
import { DISPLAY, PROPERTIES_TO_IMPROVE } from "@components/lib/CONSTANTS";
import {
  getResponseStructure,
  getImprovementsStructurePrompt,
  getNewNodesPrompt,
  getDeleteNodesPrompt,
  getNotesPrompt,
} from "@components/lib/utils/copilotPrompts";
import GuidLines from "../Guidelines/GuideLines";

interface EditableSchemaProps {
  setGenerateNewNodes: React.Dispatch<React.SetStateAction<boolean>>;
  generateNewNodes: boolean;
  proposeDeleteNode: boolean;
  setProposeDeleteNodes: React.Dispatch<React.SetStateAction<boolean>>;
  nodeType: string;
  selectedProperties: Set<string>;
  setSelectedProperties: React.Dispatch<React.SetStateAction<Set<string>>>;
  inputProperties: Set<string>;
  setInputProperties: React.Dispatch<React.SetStateAction<Set<string>>>;
  nodes: any[]; // Assuming nodes is an array of something
  nodeTitle: string;
  numberValue: number;
  handleNumberChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  inputValue: string;
  handleInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
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
  const theme = useTheme();
  const db = getFirestore();
  const [{ user }] = useAuth();

  type SystemPromptPart = {
    id: string;
    type?: string;
    value?: string;
    editablePart?: string;
    endClose?: string;
  };

  const [systemPrompt, setSystemPrompt] = useState<SystemPromptPart[]>([]);
  const [systemPromptCopy, setSystemPromptCopy] = useState<SystemPromptPart[]>(
    [],
  );
  const [editedParts, setEditedParts] = useState<
    Map<string, { newValue: string; previousValue: string }>
  >(new Map());
  const [diffChanges, setDiffChanges] = useState<{
    [id: string]: { previousValue: string; newValue: string };
  } | null>(null);
  const [previousVersion, setPreviousVersion] = useState<
    SystemPromptPart[] | null
  >(null);
  const [previousVersionId, setPreviousVersionId] = useState<string | null>(
    null,
  );
  const [promptHistory, setPromptHistory] = useState<
    (PromptChange & { id: string })[]
  >([]);
  const [showPromptHistory, setShowPromptHistory] = useState(false);
  const [expandedSystemPrompt, setExpandedSystemPrompt] = useState(false);

  const improvementsStructurePrompt = useMemo(() => {
    return getImprovementsStructurePrompt(selectedProperties);
  }, [selectedProperties]);

  const editPrompt = user?.uname === "ouhrac" || user?.uname === "1man"; // Consider a more robust role/permission system

  // Fetch System Prompt
  useEffect(() => {
    if (!user?.uname) return;

    const promptsQuery = query(
      collection(db, COPILOT_PROMPTS),
      where("editor", "==", user.uname), // Should this be tied to the user or global?
      limit(1),
    );
    const unsubscribePrompt = onSnapshot(
      promptsQuery,
      (snapshot) => {
        if (!snapshot.empty) {
          const docData = snapshot.docs[0].data();
          const promptData = docData.systemPrompt || [];
          setSystemPrompt([...promptData]);
          setSystemPromptCopy(JSON.parse(JSON.stringify(promptData)));
        }
      },
      (error) => {
        console.error("Error fetching system prompt:", error);
      },
    );

    return () => unsubscribePrompt();
  }, [db, user?.uname]);

  useEffect(() => {
    if (!user?.uname) return;

    const promptHistoryQuery = query(
      collection(db, PROMPT_LOGS),
      orderBy("modifiedAt", "desc"),
      limit(50),
    );

    const unsubscribeHistory = onSnapshot(
      promptHistoryQuery,
      (snapshot) => {
        const historyUpdates: (PromptChange & { id: string })[] = [];
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            historyUpdates.push({
              ...(change.doc.data() as PromptChange),
              id: change.doc.id,
            });
          }
        });

        setPromptHistory((prev) =>
          [...historyUpdates, ...prev]
            .sort((a, b) => b.modifiedAt.toMillis() - a.modifiedAt.toMillis()) // Ensure sort order
            .filter(
              (log, index, self) =>
                index === self.findIndex((l) => l.id === log.id),
            )
            .slice(0, 50),
        );
      },
      (error) => {
        console.error("Error fetching prompt history:", error);
      },
    );

    return () => unsubscribeHistory();
  }, [db, user?.uname]);

  const saveLogPrompt = async (logs: { [id: string]: any }) => {
    try {
      const promptLogRef = doc(collection(db, PROMPT_LOGS));
      setDoc(promptLogRef, logs);
    } catch (error) {
      console.error("Error saving prompt log:", error);
      // Add user feedback (e.g., Snackbar)
    }
  };

  const handleSave = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!user?.uname || editedParts.size === 0) return;

    const updatedSystemPrompt = previousVersion
      ? [...previousVersion]
      : [...systemPrompt];
    const changeDetails: { [key: string]: any } = {};

    editedParts.forEach((edit, editedId) => {
      const index = updatedSystemPrompt.findIndex((p) => p.id === editedId);
      if (index !== -1) {
        updatedSystemPrompt[index].editablePart = edit.newValue;
        changeDetails[editedId] = { editedId, ...edit };
      }
    });

    try {
      const promptRef = doc(db, COPILOT_PROMPTS, user.uname);
      const promptDoc = await getDoc(promptRef);

      const updateData = {
        systemPrompt: updatedSystemPrompt,
        updatedAt: new Date(),
      };

      if (promptDoc.exists()) {
        await updateDoc(promptRef, updateData);
      } else {
        await setDoc(promptRef, {
          ...updateData,
          editor: user.uname,
          createdAt: new Date(),
        });
      }

      const previousPromptData = promptDoc.exists()
        ? promptDoc.data()?.systemPrompt
        : [];
      saveLogPrompt({
        previousValue: { systemPrompt: previousPromptData },
        newValue: { systemPrompt: updatedSystemPrompt },
        changeDetails,
        modifiedAt: new Date(),
        modifiedBy: user?.uname,
        modifiedByDetails: {
          fName: user.fName || "",
          lName: user.lName || "",
          imageUrl: user.imageUrl || "",
        },
      });

      setEditedParts(new Map());
      setPreviousVersion(null);
      setPreviousVersionId(null);
      setDiffChanges(null);
    } catch (error) {
      console.error("Error saving system prompt:", error);
    }
  };

  const toggleDrawer =
    (open: boolean) => (event: React.KeyboardEvent | React.MouseEvent) => {
      if (
        event.type === "keydown" &&
        ((event as React.KeyboardEvent).key === "Tab" ||
          (event as React.KeyboardEvent).key === "Shift")
      ) {
        return;
      }
      setShowPromptHistory(open);
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
      const _prev: any = [...prev];
      const prIdx = _prev.findIndex((p: any) => p.editedId === id);
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

  const cancelChanges = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setEditedParts(new Map());
    setSystemPrompt(JSON.parse(JSON.stringify(systemPromptCopy))); // Deep copy reset
    setPreviousVersion(null); // Exit version view if cancelling
    setPreviousVersionId(null);
    setDiffChanges(null);
  };

  const compareToLatest = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (diffChanges) {
      setDiffChanges(null); // Toggle off compare view
      return;
    }
    if (!previousVersion) return;

    const changes: {
      [id: string]: { previousValue: string; newValue: string };
    } = {};
    systemPrompt.forEach((latestPart) => {
      if (latestPart.hasOwnProperty("editablePart")) {
        const previousPart = previousVersion.find(
          (_p) => _p.id === latestPart.id,
        );
        if (
          previousPart &&
          previousPart.editablePart !== latestPart.editablePart
        ) {
          changes[latestPart.id] = {
            previousValue: latestPart.editablePart || "",
            newValue: previousPart.editablePart || "",
          };
        }
      }
    });

    setDiffChanges(changes);
    setExpandedSystemPrompt(true);

    const firstDiffId = Object.keys(changes)[0];
    if (firstDiffId) {
      setTimeout(() => {
        const element = document.getElementById(`prompt-part-${firstDiffId}`);
        element?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  };

  const rollBack = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!user?.uname || !previousVersion || !previousVersionId) return;

    try {
      const promptRef = doc(db, COPILOT_PROMPTS, user.uname);
      const promptDoc = await getDoc(promptRef);
      const currentPromptData = promptDoc.exists()
        ? promptDoc.data()?.systemPrompt
        : [];

      await updateDoc(promptRef, {
        systemPrompt: previousVersion,
        updatedAt: new Date(),
      });

      saveLogPrompt({
        previousValue: { systemPrompt: currentPromptData },
        newValue: { systemPrompt: previousVersion },
        changeDetails: {},
        modifiedAt: new Date(),
        modifiedBy: user?.uname,
        modifiedByDetails: {
          fName: user.fName || "",
          lName: user.lName || "",
          imageUrl: user.imageUrl || "",
        },
        rollBack: true,
        rollBackId: previousVersionId,
      });

      setDiffChanges(null);
      setPreviousVersion(null);
      setPreviousVersionId(null);
      setEditedParts(new Map());
    } catch (error) {
      console.error("Error rolling back system prompt:", error);
    }
  };

  const handleSelectHistoryVersion = (log: PromptChange & { id: string }) => {
    setShowPromptHistory(false);
    setPreviousVersion(log.newValue.systemPrompt);
    setPreviousVersionId(log.id);
    setDiffChanges(null);
    setEditedParts(new Map());
    setExpandedSystemPrompt(true);
  };

  const promptHistoryList = (
    <Box sx={{ width: { xs: "80vw", sm: 400 }, p: 1 }}>
      <Typography variant="h6" sx={{ p: 2 }}>
        Prompt History
      </Typography>
      <Divider />
      <List dense>
        {promptHistory.map((log) => (
          <ListItem
            key={log.id}
            disablePadding
            sx={{
              mb: 1,
              borderRadius: theme.shape.borderRadius,
              bgcolor:
                log.id === previousVersionId
                  ? alpha(theme.palette.primary.light, 0.2)
                  : "transparent",
              "&:hover": {
                bgcolor: alpha(theme.palette.action.hover, 0.1),
              },
            }}
            secondaryAction={
              log.id !== previousVersionId && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleSelectHistoryVersion(log)}
                >
                  View
                </Button>
              )
            }
          >
            <ListItemButton
              onClick={() =>
                log.id !== previousVersionId && handleSelectHistoryVersion(log)
              }
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <OptimizedAvatar
                  imageUrl={log.modifiedByDetails?.imageUrl}
                  alt={log.modifiedByDetails?.fName || "U"}
                  size={32}
                />
              </ListItemIcon>
              <ListItemText
                primary={`${log.modifiedByDetails?.fName || "Unknown"} ${log.modifiedByDetails?.lName || ""}`}
                secondary={moment(log.modifiedAt.toDate()).format(
                  "MMM D, YYYY, h:mm A",
                )}
                primaryTypographyProps={{
                  fontSize: "0.875rem",
                  fontWeight: "medium",
                }}
                secondaryTypographyProps={{ fontSize: "0.75rem" }}
              />
            </ListItemButton>
          </ListItem>
        ))}
        {promptHistory.length === 0 && (
          <ListItem>
            <ListItemText
              primary="No history available."
              sx={{ textAlign: "center", color: "text.secondary" }}
            />
          </ListItem>
        )}
      </List>
    </Box>
  );

  const displayPrompt = previousVersion || systemPrompt;

  return (
    <Box sx={{ mb: 4 }}>
      <Drawer
        anchor="right"
        open={showPromptHistory}
        onClose={toggleDrawer(false)}
        PaperProps={{ sx: { bgcolor: "background.paper" } }}
      >
        {promptHistoryList}
      </Drawer>

      {!generateNewNodes &&
        selectedProperties.size === 0 &&
        !proposeDeleteNode &&
        editPrompt && (
          <Typography
            sx={{
              color: theme.palette.warning.main,
              mb: 2,
              textAlign: "center",
              fontStyle: "italic",
            }}
          >
            {`Select at least one generation option: 'Propose New Nodes,' 'Propose Improvements,' or 'Propose Node Deletion'.`}
          </Typography>
        )}

      {diffChanges !== null &&
        Object.keys(diffChanges).length === 0 &&
        previousVersionId && (
          <Typography
            id="no-diff"
            sx={{
              color: theme.palette.info.main,
              fontSize: "1rem",
              mb: 2,
              textAlign: "center",
            }}
          >
            This historical version is identical to the current version.
          </Typography>
        )}

      <Paper elevation={3} sx={{ overflow: "hidden", mb: 3 }}>
        <Accordion
          expanded={expandedSystemPrompt}
          onChange={() => setExpandedSystemPrompt((prev) => !prev)}
          sx={{
            "&:before": { display: "none" },
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: "25px",
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              position: "sticky",
              top: 0,
              bgcolor: "background.paper",
              borderBottom: `1px solid ${theme.palette.divider}`,
              zIndex: 10,
              flexDirection: "row-reverse",
              alignItems: "center",
              py: 0.5,
              px: 2,
              minHeight: "56px",
              "& .MuiAccordionSummary-content": {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
                mr: 1,
              },
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <ArticleIcon color="primary" />
              <Typography variant="h6" component="div">
                System Prompt
              </Typography>
              {previousVersionId && (
                <Chip label="Viewing History" color="info" size="small" />
              )}
              {editedParts.size > 0 && (
                <Chip label="Unsaved Changes" color="warning" size="small" />
              )}
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              {editedParts.size > 0 && (
                <>
                  <Tooltip title="Save Changes">
                    <Button
                      startIcon={<SaveIcon />}
                      size="small"
                      variant="contained"
                      color="primary"
                      onClick={handleSave}
                    >
                      Save
                    </Button>
                  </Tooltip>
                  <Tooltip title="Discard Changes">
                    <Button
                      startIcon={<CancelIcon />}
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={cancelChanges}
                    >
                      Discard
                    </Button>
                  </Tooltip>
                </>
              )}
              {previousVersion && (
                <>
                  <Tooltip title="Close History View">
                    <Button
                      startIcon={<CloseIcon />}
                      size="small"
                      variant="outlined"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviousVersion(null);
                        setPreviousVersionId(null);
                        setDiffChanges(null);
                      }}
                    >
                      Close View
                    </Button>
                  </Tooltip>
                  <Tooltip title="Rollback to This Version">
                    <Button
                      startIcon={<SettingsBackupRestoreIcon />}
                      size="small"
                      variant="outlined"
                      color="warning"
                      onClick={rollBack}
                    >
                      Rollback
                    </Button>
                  </Tooltip>
                  <Tooltip
                    title={
                      diffChanges ? "Exit Compare View" : "Compare to Latest"
                    }
                  >
                    <Button
                      startIcon={<CompareArrowsIcon />}
                      size="small"
                      variant={diffChanges ? "contained" : "outlined"}
                      color="secondary"
                      onClick={compareToLatest}
                    >
                      {diffChanges ? "Exit Compare" : "Compare"}
                    </Button>
                  </Tooltip>
                </>
              )}
              {promptHistory.length > 0 && (
                <Tooltip title="View Prompt History">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPromptHistory(true);
                    }}
                  >
                    <HistoryIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </AccordionSummary>
          <AccordionDetails
            sx={{
              bgcolor: alpha(theme.palette.background.default, 0.5),
              p: { xs: 1, sm: 2 },
            }}
          >
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <NotesIcon sx={{ mr: 1, color: "text.secondary" }} />
                <Typography variant="subtitle1" fontWeight="medium">
                  Definitions & Instructions
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                {displayPrompt.map((p) => (
                  <Box
                    key={p.id}
                    id={`prompt-part-${p.id}`}
                    sx={{
                      mb: 3,
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor:
                        diffChanges && diffChanges[p.id]
                          ? alpha(theme.palette.info.light, 0.15)
                          : "transparent",
                    }}
                  >
                    <Typography component="div" sx={{ lineHeight: 1.6 }}>
                      {p.value || ""}
                      {p.hasOwnProperty("editablePart") && (
                        <Box sx={{ mt: 1, position: "relative" }}>
                          {diffChanges && diffChanges[p.id] && (
                            <Box
                              sx={{
                                mb: 1,
                                p: 1,
                                bgcolor: alpha(theme.palette.error.light, 0.2),
                                borderRadius: 1,
                                borderLeft: `3px solid ${theme.palette.error.main}`,
                              }}
                            >
                              <Typography
                                variant="caption"
                                display="block"
                                color="text.secondary"
                              >
                                Latest Value:
                              </Typography>
                              <Typography
                                sx={{
                                  textDecoration: "line-through",
                                  opacity: 0.8,
                                }}
                              >
                                {diffChanges[p.id].previousValue}
                              </Typography>
                            </Box>
                          )}
                          {diffChanges && diffChanges[p.id] && (
                            <Box
                              sx={{
                                mb: 1,
                                p: 1,
                                bgcolor: alpha(
                                  theme.palette.success.light,
                                  0.2,
                                ),
                                borderRadius: 1,
                                borderLeft: `3px solid ${theme.palette.success.main}`,
                              }}
                            >
                              <Typography
                                variant="caption"
                                display="block"
                                color="text.secondary"
                              >
                                Selected History Value:
                              </Typography>
                              <Typography
                                sx={{
                                  color: "success.dark",
                                  fontWeight: "medium",
                                }}
                              >
                                {diffChanges[p.id].newValue}
                              </Typography>
                            </Box>
                          )}
                          <TextField
                            value={p.editablePart}
                            onChange={(event) =>
                              handleInput(p.id, event.target.value)
                            }
                            fullWidth
                            label={p.type || "Editable Section"}
                            multiline
                            variant="outlined"
                            size="small"
                            disabled={!!previousVersionId && !diffChanges}
                            InputLabelProps={{ shrink: true }}
                            sx={{
                              bgcolor: "background.paper",
                              "& .MuiOutlinedInput-root": {
                                "&.Mui-disabled": {
                                  bgcolor: alpha(
                                    theme.palette.action.disabledBackground,
                                    0.5,
                                  ),
                                },
                              },
                            }}
                          />
                        </Box>
                      )}
                      {p.endClose || ""}
                    </Typography>
                  </Box>
                ))}
              </AccordionDetails>
            </Accordion>

            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <InputIcon sx={{ mr: 1, color: "text.secondary" }} />
                <Typography variant="subtitle1" fontWeight="medium">
                  Input Configuration
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <Box>
                    <Typography
                      variant="body2"
                      gutterBottom
                      color="text.secondary"
                    >
                      Select Properties to Include in Context:
                    </Typography>
                    <Stack
                      direction="row"
                      flexWrap="wrap"
                      spacing={1}
                      sx={{ pl: 1 }}
                    >
                      {[
                        ...PROPERTIES_TO_IMPROVE.allTypes,
                        ...(PROPERTIES_TO_IMPROVE[nodeType] || []),
                      ]
                        .filter((prop) => prop !== "nodeId")
                        .map((property: string) => (
                          <Chip
                            key={property}
                            label={capitalizeFirstLetter(
                              DISPLAY[property] || property,
                            )}
                            onClick={() => {
                              setInputProperties((prev: Set<string>) => {
                                const _prev = new Set(prev);
                                if (_prev.has(property)) _prev.delete(property);
                                else _prev.add(property);
                                return _prev;
                              });
                            }}
                            variant={
                              inputProperties.has(property)
                                ? "filled"
                                : "outlined"
                            }
                            color={
                              inputProperties.has(property)
                                ? "primary"
                                : "default"
                            }
                            size="small"
                            disabled={property === "title"}
                            clickable
                            sx={{ mb: 1 }}
                          />
                        ))}
                    </Stack>
                  </Box>

                  <TextField
                    margin="dense"
                    id="number-input"
                    type="number"
                    label={
                      <Box component="span">
                        Exploration Depth from node{" "}
                        <Typography component="strong" color="primary">
                          {nodeTitle}
                        </Typography>
                      </Box>
                    }
                    value={numberValue || ""}
                    onChange={handleNumberChange}
                    inputProps={{ min: 0, step: 1 }}
                    fullWidth
                    size="small"
                  />
                  <Accordion
                    sx={{
                      bgcolor: alpha(theme.palette.background.default, 0.7),
                    }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography>
                        <Chip
                          label={nodes.length}
                          size="small"
                          color="secondary"
                          sx={{ mr: 1 }}
                        />
                        Nodes in Context
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails
                      sx={{ maxHeight: 300, overflowY: "auto" }}
                    >
                      <pre
                        style={{
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-all",
                          fontSize: "0.75rem",
                          background: alpha(theme.palette.text.primary, 0.05),
                          padding: theme.spacing(1),
                          borderRadius: theme.shape.borderRadius,
                        }}
                      >
                        {JSON.stringify(nodes, null, 2)}
                      </pre>
                    </AccordionDetails>
                  </Accordion>
                </Stack>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <ChecklistIcon sx={{ mr: 1, color: "text.secondary" }} />
                <Typography variant="subtitle1" fontWeight="medium">
                  Response Configuration
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1.5}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      p: 1,
                      borderRadius: 1,
                      cursor: "pointer",
                      "&:hover": {
                        bgcolor: alpha(theme.palette.action.hover, 0.05),
                      },
                    }}
                    onClick={() => setGenerateNewNodes((prev) => !prev)}
                  >
                    <Checkbox
                      checked={generateNewNodes}
                      size="small"
                      sx={{ p: 0, mr: 1.5 }}
                      readOnly
                    />
                    <AddCircleOutlineIcon
                      sx={{
                        mr: 1,
                        color: generateNewNodes
                          ? "primary.main"
                          : "text.secondary",
                      }}
                    />
                    <Typography>Propose New Nodes</Typography>
                  </Box>

                  <Accordion
                    sx={{
                      bgcolor: alpha(theme.palette.background.default, 0.7),
                      "&:before": { display: "none" },
                    }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Checkbox
                        checked={selectedProperties.size > 0}
                        indeterminate={
                          selectedProperties.size > 0 &&
                          selectedProperties.size <
                            [
                              ...PROPERTIES_TO_IMPROVE.allTypes,
                              ...(PROPERTIES_TO_IMPROVE[nodeType] || []),
                            ].length
                        }
                        size="small"
                        sx={{ p: 0, mr: 1.5 }}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedProperties((prev: Set<string>) => {
                            if (prev.size > 0) return new Set();
                            return new Set([
                              ...PROPERTIES_TO_IMPROVE.allTypes,
                              ...(PROPERTIES_TO_IMPROVE[nodeType] || []),
                            ]);
                          });
                        }}
                      />
                      <AutoFixHighIcon
                        sx={{
                          mr: 1,
                          color:
                            selectedProperties.size > 0
                              ? "primary.main"
                              : "text.secondary",
                        }}
                      />
                      <Typography>
                        Propose Improvements to Existing Nodes
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack
                        direction="row"
                        flexWrap="wrap"
                        spacing={1}
                        sx={{ pl: 1 }}
                      >
                        {[
                          ...PROPERTIES_TO_IMPROVE.allTypes,
                          ...(PROPERTIES_TO_IMPROVE[nodeType] || []),
                        ].map((property: string) => (
                          <Chip
                            key={property}
                            label={capitalizeFirstLetter(
                              DISPLAY[property] || property,
                            )}
                            onClick={() => {
                              setSelectedProperties((prev: Set<string>) => {
                                const _prev = new Set(prev);
                                if (_prev.has(property)) _prev.delete(property);
                                else _prev.add(property);
                                return _prev;
                              });
                            }}
                            variant={
                              selectedProperties.has(property)
                                ? "filled"
                                : "outlined"
                            }
                            color={
                              selectedProperties.has(property)
                                ? "primary"
                                : "default"
                            }
                            size="small"
                            clickable
                            sx={{ mb: 1 }}
                          />
                        ))}
                      </Stack>
                    </AccordionDetails>
                  </Accordion>

                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      p: 1,
                      borderRadius: 1,
                      cursor: "pointer",
                      "&:hover": {
                        bgcolor: alpha(theme.palette.action.hover, 0.05),
                      },
                    }}
                    onClick={() => setProposeDeleteNodes((prev) => !prev)}
                  >
                    <Checkbox
                      checked={proposeDeleteNode}
                      size="small"
                      sx={{ p: 0, mr: 1.5 }}
                      readOnly
                    />
                    <PlaylistRemoveIcon
                      sx={{
                        mr: 1,
                        color: proposeDeleteNode
                          ? "primary.main"
                          : "text.secondary",
                      }}
                    />
                    <Typography>Propose Node Deletion</Typography>
                  </Box>
                  <Divider sx={{ my: 1 }} />
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 1 }}
                  >
                    Response JSON Structure Preview:
                  </Typography>
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                      fontSize: "0.75rem",
                      background: alpha(theme.palette.text.primary, 0.05),
                      padding: theme.spacing(1),
                      borderRadius: theme.shape.borderRadius,
                    }}
                  >
                    {getResponseStructure(
                      selectedProperties.size > 0,
                      proposeDeleteNode,
                    )}
                  </pre>
                  {selectedProperties.size > 0 && (
                    <Accordion
                      sx={{
                        bgcolor: alpha(theme.palette.background.default, 0.7),
                      }}
                    >
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="caption">
                          Improvement Details
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <pre
                          style={{
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                            fontSize: "0.75rem",
                          }}
                        >
                          {improvementsStructurePrompt}
                        </pre>
                      </AccordionDetails>
                    </Accordion>
                  )}
                  {generateNewNodes && (
                    <Accordion
                      sx={{
                        bgcolor: alpha(theme.palette.background.default, 0.7),
                      }}
                    >
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="caption">
                          New Node Details
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <pre
                          style={{
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                            fontSize: "0.75rem",
                          }}
                        >
                          {getNewNodesPrompt(generateNewNodes)}
                        </pre>
                      </AccordionDetails>
                    </Accordion>
                  )}
                  {proposeDeleteNode && (
                    <Accordion
                      sx={{
                        bgcolor: alpha(theme.palette.background.default, 0.7),
                      }}
                    >
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="caption">
                          Node Deletion Details
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <pre
                          style={{
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                            fontSize: "0.75rem",
                          }}
                        >
                          {getDeleteNodesPrompt(proposeDeleteNode)}
                        </pre>
                      </AccordionDetails>
                    </Accordion>
                  )}
                  <Accordion
                    sx={{
                      bgcolor: alpha(theme.palette.background.default, 0.7),
                    }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="caption">Important Notes</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <pre
                        style={{
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-all",
                          fontSize: "0.75rem",
                        }}
                      >
                        {getNotesPrompt()}
                      </pre>
                    </AccordionDetails>
                  </Accordion>
                </Stack>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <RuleIcon sx={{ mr: 1, color: "text.secondary" }} />
                <Typography variant="subtitle1" fontWeight="medium">
                  Guidelines
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <GuidLines />
              </AccordionDetails>
            </Accordion>
          </AccordionDetails>
        </Accordion>
      </Paper>

      <Paper elevation={3} sx={{ overflow: "hidden" }}>
        <Accordion
          defaultExpanded
          sx={{
            "&:before": { display: "none" },
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              bgcolor: "background.paper",
              borderBottom: `1px solid ${theme.palette.divider}`,
              flexDirection: "row-reverse",
              py: 0.5,
              px: 2,
              minHeight: "56px",
              "& .MuiAccordionSummary-content": { mr: 1, alignItems: "center" },
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <InputIcon color="primary" />
              <Typography variant="h6" component="div">
                User Instructions
              </Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails
            sx={{ p: 2, bgcolor: alpha(theme.palette.background.default, 0.5) }}
          >
            <TextField
              autoFocus
              margin="dense"
              id="prompt-input"
              label="Enter your instructions for the AI Assistant"
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              fullWidth
              multiline
              minRows={3}
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              sx={{ bgcolor: "background.paper" }}
            />
          </AccordionDetails>
        </Accordion>
      </Paper>
    </Box>
  );
};

export default CopilotPrompt;
