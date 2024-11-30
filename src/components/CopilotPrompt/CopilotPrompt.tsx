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
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import HistoryIcon from "@mui/icons-material/History";
import { useAuth } from "../context/AuthContext";
import {
  COPILOT_PROMPTS,
  PROMPT_LOGS,
} from " @components/lib/firestoreClient/collections";
import { db } from " @components/lib/firestoreServer/admin";
import { NodeChange, PromptChange } from " @components/types/INode";
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

interface EditableSchemaProps {}

const prompt: {
  id?: string;
  value?: string;
  editablePart?: string;
  endClose?: string;
}[] = [
  { value: "Response Structure:" },
  {
    value:
      "Please carefully generate a JSON object with the following structure:",
  },
  {
    value: "{",
  },
  {
    value: `"message": "A string message`,
    editablePart:
      "that you would send to the user in response to their message. This could include your analysis, questions, or explanations regarding the requested changes.",
    endClose: `",`,
  },
  {
    value: `"improvements": [], // An array`,
    editablePart: `of improvements to existing nodes.`,
  },
  {
    value: `"new_nodes": [] // An array of new nodes.`,
    editablePart: `Note that you should not propose a new node if a node with the same meaning already exists in the ontology, even if their titles are different.`,
  },
  {
    value: "}",
  },
  {
    value: `For the "improvements" array:`,
  },
  {
    editablePart:
      "Each item should represent an object that proposes an improvement to an existing node. Please structure each object as follows:",
  },
  {
    value: "{",
  },
  {
    value: `"title":"`,
    editablePart: "The current title of the node.",
    endClose: `",`,
  },
  {
    value: `"nodeType":"`,
    editablePart:
      "The type of the node, which could be 'activity', 'actor', 'object', 'evaluationDimension', 'incentive', 'reward', or 'context'.",
    endClose: `",`,
  },
  {
    value: `"changes": [] //`,
    editablePart:
      "An array of objects, each representing a change to a single property of the node that requires modification.",
  },
  {
    editablePart:
      'Each change object should include the necessary fields for the property being changed and a "reasoning" field explaining your reasoning for proposing this change.',
  },
  {
    value: '- For "title" changes:',
  },
  {
    value: "{",
  },
  {
    value: `"modified_property": "title",`,
  },
  {
    value: `"new_value":"`,
    editablePart: `The improved title of the node.`,
    endClose: `",`,
  },
  {
    value: `"reasoning":" `,
    editablePart: `Your reasoning for proposing this change to the title of the node.`,
    endClose: `"`,
  },
  {
    value: "},",
  },
  {
    value: '- For "description" changes:',
  },
  {
    value: "{",
  },
  {
    value: `"modified_property": "description",`,
  },
  {
    value: `"new_value": "`,
    editablePart: "The improved description of the node.",
    endClose: `",`,
  },
  {
    value: `"reasoning": "`,
    editablePart:
      "Your reasoning for proposing this change to the description of the node.",
    endClose: `"`,
  },
  {
    value: "},",
  },
  {
    value: '- For "specializations" changes:',
  },
  {
    value: "{",
  },
  {
    value: `"modified_property": "specializations",`,
  },
  {
    value: `"new_value": [], // An array of objects,`,
    editablePart: "each representing a collection with the following structure",
    endClose: `:`,
  },
  {
    value: "{",
  },
  {
    value: `"collectionName": "`,
    editablePart: "The title of the collection",
    endClose: `",`,
  },
  {
    value: `"collection_changes": {`,
  },
  {
    value: `"nodes_to_add": [An array`,
    editablePart: "of titles (as strings) of nodes to add to this collection.",
    endClose: `],`,
  },
  {
    value: `"nodes_to_delete": [An array`,
    editablePart:
      "of titles (as strings) of nodes to remove from this collection.",
    endClose: `],`,
  },
  {
    value: `"final_array": [An array`,
    editablePart:
      "of titles (as strings) representing the final set of nodes in this collection after additions and deletions.",
    endClose: "]",
  },
  {
    value: "},",
  },
  {
    value: `"reasoning": "`,
    editablePart:
      "Your reasoning for proposing this change to the specializations of the node.",
    endClose: `"`,
  },
  {
    value: "}",
  },
  {
    value: "},",
  },
  {
    value: '- For "generalizations" changes:',
  },
  {
    value: "{",
  },
  {
    value: `"modified_property": "generalizations",`,
  },
  {
    value: `"new_value": {`,
  },
  {
    value: `"nodes_to_add": [An array`,
    editablePart: "of nodes to add to the existing property.",
    endClose: "],",
  },
  {
    value: `"nodes_to_delete": [An array],`,
    editablePart: "of nodes to remove from the existing property.",
    endClose: "]",
  },
  {
    value: `"final_array": [An array`,
    editablePart:
      "representing the final state of the property after additions and deletions.",
    endClose: "]",
  },
  {
    value: "},",
  },
  {
    value: `"reasoning": "`,
    editablePart:
      "Your reasoning for proposing this change to the specializations of the node.",
    endClose: `"`,
  },
  {
    value: "},",
  },
  {
    editablePart: `- For other array property changes (other than "specializations" and "generalizations"), each change object should have the following properties:`,
  },
  {
    value: "{",
  },
  {
    value: `"modified_property": "`,
    editablePart: "[PROPERTY_NAME]",
    endClose: `",`,
  },
  {
    value: `"new_value": {`,
  },
  {
    value: `"nodes_to_add": [An array`,
    editablePart: "of nodes to add to the existing property.",
    endClose: `],`,
  },
  {
    value: `"nodes_to_delete": [An array`,
    editablePart: "of nodes to remove from the existing property.",
    endClose: `],`,
  },
  {
    value: `"final_array": [An array`,
    editablePart:
      "representing the final state of the property after additions and deletions.",
    endClose: `]`,
  },
  {
    value: "},",
  },
  {
    value: `"reasoning": "`,
    editablePart:
      "Your reasoning for proposing this change to the [PROPERTY_NAME] of the node.",
    endClose: `"`,
  },
  {
    value: "},",
  },
  {
    editablePart:
      'If "nodeType" is "activity" and the property you want to change is "postConditions" or "preConditions":',
  },
  {
    value: "{",
  },
  {
    value: `"modifiedProperty":`,
    editablePart: "[postConditions|preConditions]",
    endClose: `",`,
  },
  {
    value: `"new_value": {`,
  },
  {
    value: `"conditions_to_add": [An array `,
    editablePart: "of conditions to add to the existing property.",
    endClose: "],",
  },
  {
    value: `"conditions_to_delete": [An array `,
    editablePart: "of conditions to remove from the existing property.",
    endClose: "],",
  },
  {
    value: `"final_array": [An array`,
    editablePart:
      "representing the final state of the property after additions and deletions.",
    endClose: "]",
  },
  {
    value: "},",
  },
  {
    value: `"reasoning": "`,
    editablePart:
      "Your reasoning for proposing this change to the [postConditions|preConditions] of the node.",
    endClose: `"`,
  },
  {
    value: "},",
  },
  {
    value: `For the "new_nodes" array:`,
  },
  {
    editablePart:
      "Each item should represent an object proposing a new node. Please structure each object as follows:",
  },
  {
    value: "{",
  },
  {
    value: `"title": "`,
    editablePart: "The title of the new node.",
    endClose: `",`,
  },
  {
    value: `"description": "`,
    editablePart: "The description of the node.",
    endClose: `",`,
  },
  {
    value: `"nodeType": "`,
    editablePart:
      "The type of the node, which could be 'activity', 'actor', 'object', 'evaluationDimension', 'incentive', 'reward', or 'context'.",
    endClose: `",`,
  },
  {
    value: `"generalizations": [An array `,
    editablePart:
      "of titles (as strings) of nodes that are generalizations of this node.",
    endClose: `],`,
  },
  {
    value: `"parts": [An array of`,
    editablePart: "titles (as strings) of nodes that are parts of this node.",
    endClose: `],`,
  },
  {
    value: `"isPartOf": [An array of `,
    editablePart: "titles (as strings) of nodes that this node is a part of.",
    endClose: `],`,
  },
  {
    value: "// NodeType-specific fields:",
  },
  {
    value: '// If "nodeType" is "activity":',
  },
  {
    value: `"actor": [An array `,
    editablePart:
      "of titles (as strings) of nodes that are individuals or groups that perform this activity.",
    endClose: `],`,
  },
  {
    value: `"objectsActedOn": [An array `,
    editablePart:
      "of titles (as strings) of nodes that are objects that this activity is performed on.",
    endClose: `],`,
  },
  {
    value: `"evaluationDimension": [An array `,
    editablePart:
      "of titles (as strings) of nodes that are evaluation dimensions of this activity.",
    endClose: `],`,
  },
  {
    value: `"postConditions": [An array of `,
    editablePart:
      "conditions that must be met after this activity is performed.",
    endClose: `],`,
  },
  {
    value: `"preConditions": [An array of `,
    editablePart:
      "conditions that must be met before this activity can be performed.",
    endClose: `],`,
  },
  {
    value: '// If "nodeType" is "actor" or "group":',
  },
  {
    value: `"abilities": [An array of `,
    editablePart: "abilities required of this actor or group.",
    endClose: `],`,
  },
  {
    value: `"typeOfActor": [`,
    editablePart: "An array of types of actors.",
    endClose: `],`,
  },
  {
    value: '// Additional fields for "group":',
  },
  {
    value: `"listOfIndividualsInGroup": [`,
    editablePart: "An array of individuals that make up this group.",
    endClose: `],`,
  },
  {
    value: `"numberOfIndividualsInGroup": [`,
    editablePart: "The number of individuals in the group.",
    endClose: `],`,
  },
  {
    value: '// If "nodeType" is "object":',
  },
  {
    value: `"lifeSpan": [`,
    editablePart: "Details about the lifespan of the object.",
    endClose: `],`,
  },
  {
    value: `"modifiability": [`,
    editablePart: "Details about the modifiability of the object.",
    endClose: `],`,
  },
  {
    value: "}",
  },
  {
    value: "IMPORTANT NOTES:",
  },

  {
    editablePart:
      "- Please do not propose any new node that already exists in the ontology, even if their titles are different. Ensure that each node is unique in meaning.",
  },
  {
    editablePart:
      "- Take as much time as needed to generate as many high-quality improvements and new nodes as possible.",
  },
  {
    editablePart:
      "- Thoroughly analyze the ontology and the user's message to identify all possible improvements and additions.",
  },
  {
    editablePart:
      "- If a 'Main' collection does not exist, please do not create it.",
  },
  {
    editablePart: `- Please note the difference between "specializations" and "parts" properties.`,
  },
  {
    value: "\t\t",
    editablePart: `- "specializations" is an array of specialized nodes that are specific types of this node.`,
  },
  {
    value: "\t\t",
    editablePart: `- "parts" is an array of smaller nodes that are components of this node.`,
  },
];

const CopilotPrompt: React.FC<EditableSchemaProps> = () => {
  const db = getFirestore();
  const [{ user }] = useAuth();
  const [systemPrompt, setSystemPrompt] = useState<
    {
      id: string;
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
    null
  );

  const [promptHistory, setPromptHistory] = useState<
    (PromptChange & { id: string })[]
  >([]);
  const [showPromptHistory, setShowPromptHistory] = useState(false);
  const [glowIds, setGlowIds] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);

  for (let p of prompt) {
    p.id = doc(collection(db, PROMPT_LOGS)).id;
  }

  useEffect(() => {
    if (!user?.uname) return;

    const promptsQuery = query(
      collection(db, COPILOT_PROMPTS),
      where("editor", "==", user.uname),
      limit(1)
    );
    const unsubscribePrompt = onSnapshot(promptsQuery, (snapshot) => {
      const docChanges = snapshot.docChanges();
      if (docChanges.length > 0) {
        const docChange = docChanges[0].doc.data();
        setSystemPrompt([...docChange.systemPrompt]);
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
      limit(100)
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
      for (let edit of editedParts) {
        const index = systemPrompt.findIndex((p) => p.id === edit.editedId);
        systemPrompt[index].editablePart = edit.newValue;
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
          systemPrompt,
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
          systemPrompt,
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
    } catch (e) {
      console.error(e);
    }
  };
  const toggleDrawer = (newOpen: boolean) => () => {
    setShowPromptHistory(newOpen);
  };

  const handleInput = (id: string, event: React.FormEvent<HTMLSpanElement>) => {
    const newValue = (event.target as HTMLSpanElement).innerText;

    setEditedParts((prev) => {
      const _prev = [...prev];
      const prIdx = _prev.findIndex((p) => p.editedId === id);
      const idx = systemPrompt.findIndex((p) => p.id === id);

      if (prIdx !== -1 && idx !== -1) {
        if (systemPrompt[idx].editablePart !== newValue) {
          _prev[prIdx].newValue = newValue;
        } else {
          _prev.splice(prIdx, 1);
        }
      } else if (
        idx !== -1 &&
        systemPrompt[idx].hasOwnProperty("editablePart") &&
        systemPrompt[idx].editablePart !== newValue
      ) {
        _prev.push({
          editedId: id,
          newValue,
          previousValue: systemPrompt[idx].editablePart || "",
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

      <Paper elevation={5}>
        <Accordion
          expanded={expanded}
          sx={{ p: 0, m: 0, position: "sticky", top: 0 }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              fontSize: "19px",
              fontWeight: "bold",
              color: "orange",
              position: "sticky",
              top: 0,
              backgroundColor: (theme) =>
                theme.palette.mode === "dark" ? "#242425" : "#d0d5dd",
              m: 0,
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
                  color: "orange",
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
              {" "}
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
              {(previousVersion || systemPrompt).map((p) => (
                <Box
                  key={p.id}
                  id={p.id}
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    mt: 1,
                    flexDirection: { xs: "column", sm: "row" },
                  }}
                >
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
                    {p.value}
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
                        <Typography
                          key={forceUpdate}
                          component="span"
                          contentEditable={!previousVersionId}
                          suppressContentEditableWarning
                          sx={{
                            display: "inline",
                            borderBottom: !previousVersionId
                              ? "1.5px dashed #ff6d00"
                              : "",
                            paddingBottom: "2px",
                            cursor: "text",
                            px: "4px",
                            color: "inherit",
                            fontSize: { xs: "16px", sm: "20px" },
                          }}
                          onInput={(event) => handleInput(p.id, event)}
                        >
                          {p.editablePart}
                        </Typography>
                      )}
                    {p.endClose}
                  </Typography>
                </Box>
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>
      </Paper>
    </Box>
  );
};

export default CopilotPrompt;
