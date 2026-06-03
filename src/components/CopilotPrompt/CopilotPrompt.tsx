import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  TextField,
  Typography,
  Button,
  Alert,
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
import {
  DISPLAY,
  PROPERTIES_TO_IMPROVE,
  SCROLL_BAR_STYLE,
} from "@components/lib/CONSTANTS";
import {
  getResponseStructure,
  getImprovementsStructurePrompt,
  getNewNodesPrompt,
  getDeleteNodesPrompt,
  getNotesPrompt,
  buildCopilotLLMPrompt,
  SystemPromptObjectiveDefinition,
} from "@components/lib/utils/copilotPrompts";
import GuidLines from "../Guidelines/GuideLines";
import MarkdownRender from "../Markdown/MarkdownRender";

interface EditableSchemaProps {
  setGenerateNewNodes: React.Dispatch<React.SetStateAction<boolean>>;
  generateNewNodes: boolean;
  proposeDeleteNode: boolean;
  setProposeDeleteNodes: React.Dispatch<React.SetStateAction<boolean>>;
  nodeType: string;
  improveProperties: Set<string>;
  setImproveProperties: React.Dispatch<React.SetStateAction<Set<string>>>;
  inputProperties: Set<string>;
  setInputProperties: React.Dispatch<React.SetStateAction<Set<string>>>;
  aiAssistantContext: any;
  nodeTitle: string;
  explorationDepth: number;
  handleNumberChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  userInstructions: string;
  handleInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  setSystemPromptObjectiveDefinition?: React.Dispatch<
    React.SetStateAction<SystemPromptObjectiveDefinition | null>
  >;
}

const CopilotPrompt: React.FC<EditableSchemaProps> = ({
  setGenerateNewNodes,
  generateNewNodes,
  proposeDeleteNode,
  setProposeDeleteNodes,
  nodeType,
  improveProperties,
  setImproveProperties,
  inputProperties,
  setInputProperties,
  aiAssistantContext,
  nodeTitle,
  explorationDepth,
  handleNumberChange,
  userInstructions,
  handleInputChange,
  setSystemPromptObjectiveDefinition,
}) => {
  const theme = useTheme();
  const db = getFirestore();
  const [{ user }] = useAuth();

  const surfacePaperSx = {
    overflow: "hidden",
    borderRadius: 3,
    bgcolor: alpha(theme.palette.background.paper, 0.88),
    backdropFilter: "blur(10px)",
    boxShadow:
      theme.palette.mode === "dark"
        ? "0 10px 30px rgba(0,0,0,0.45)"
        : "0 10px 30px rgba(0,0,0,0.10)",
  } as const;

  const stickyHeaderSx = {
    position: "sticky" as const,
    top: 0,
    zIndex: 10,
    bgcolor: alpha(theme.palette.background.paper, 0.92),
    backdropFilter: "blur(10px)",
  } as const;

  const promptSectionSx = {
    mb: 2,
    p: 2,
    borderRadius: 2,
    bgcolor: alpha(
      theme.palette.background.paper,
      theme.palette.mode === "dark" ? 0.18 : 0.6,
    ),
    boxShadow:
      theme.palette.mode === "dark"
        ? `0 1px 0 ${alpha(theme.palette.common.white, 0.05)} inset`
        : `0 1px 0 ${alpha(theme.palette.common.black, 0.04)} inset`,
  } as const;

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
  const [expandedSystemPrompt, setExpandedSystemPrompt] = useState(true);

  const improvementsStructurePrompt = useMemo(() => {
    return getImprovementsStructurePrompt(improveProperties);
  }, [improveProperties]);

  const currentObjectiveDefinition: SystemPromptObjectiveDefinition | null =
    useMemo(() => {
      if (!systemPromptCopy?.length) return null;
      return {
        objective: String(systemPromptCopy?.[0]?.editablePart || ""),
        definition: String(systemPromptCopy?.[1]?.editablePart || ""),
      };
    }, [systemPromptCopy]);

  useEffect(() => {
    if (!setSystemPromptObjectiveDefinition) return;
    setSystemPromptObjectiveDefinition(currentObjectiveDefinition);
  }, [currentObjectiveDefinition, setSystemPromptObjectiveDefinition]);

  const editPrompt = user?.uname === "ouhrac" || user?.uname === "1man"; // Consider a more robust role/permission system

  // Fetch System Prompt
  useEffect(() => {
    if (!user?.uname) return;
    const promptsQuery = query(
      collection(db, COPILOT_PROMPTS),
      where("editor", "==", user.uname),
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
      const updated = new Map(prev);
      const idx = systemPromptCopy.findIndex((p) => p.id === id);

      if (idx !== -1) {
        const existing = updated.get(id);
        const currentValue = systemPromptCopy[idx].editablePart;

        if (existing) {
          if (currentValue !== newValue) {
            updated.set(id, { ...existing, newValue });
          } else {
            updated.delete(id);
          }
        } else if (
          systemPromptCopy[idx].hasOwnProperty("editablePart") &&
          currentValue !== newValue
        ) {
          updated.set(id, {
            newValue,
            previousValue: currentValue || "",
          });
        }
      }

      return updated;
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
    <Box sx={{ width: { xs: "86vw", sm: 420 } }}>
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 1,
          p: 2,
          bgcolor: alpha(theme.palette.background.paper, 0.92),
          backdropFilter: "blur(10px)",
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Stack spacing={0.25}>
            <Typography variant="h6">Prompt history</Typography>
            <Typography variant="caption" color="text.secondary">
              Last 50 changes
            </Typography>
          </Stack>
          <Tooltip title="Close">
            <IconButton size="small" onClick={toggleDrawer(false)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
      <Divider />
      <List dense sx={{ p: 1 }}>
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
                slotProps={{
                  primary: {
                    sx: { fontSize: "0.875rem", fontWeight: "medium" },
                  },
                  secondary: {
                    sx: { fontSize: "0.75rem" },
                  },
                }}
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
  const fullPromptPreview = useMemo(() => {
    if (!currentObjectiveDefinition) return "";
    return buildCopilotLLMPrompt({
      editedPart: currentObjectiveDefinition,
      improvement: improveProperties.size > 0,
      newNodes: generateNewNodes,
      proposeDeleteNode,
      improveProperties: [...improveProperties],
      userMessage: userInstructions,
      subOntology: aiAssistantContext,
      nodeTitle,
    });
  }, [
    currentObjectiveDefinition,
    improveProperties,
    generateNewNodes,
    proposeDeleteNode,
    userInstructions,
    aiAssistantContext,
    nodeTitle,
  ]);

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
        improveProperties.size === 0 &&
        !proposeDeleteNode &&
        editPrompt && (
          <Alert
            severity="warning"
            sx={{
              mb: 2,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.warning.main, 0.12),
              border: `1px solid ${alpha(theme.palette.warning.main, 0.18)}`,
            }}
          >
            {`Select at least one generation option: 'Propose New Nodes,' 'Propose Improvements,' or 'Propose Node Deletion'.`}
          </Alert>
        )}

      {diffChanges !== null &&
        Object.keys(diffChanges).length === 0 &&
        previousVersionId && (
          <Alert
            severity="info"
            id="no-diff"
            sx={{
              mb: 2,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.info.main, 0.1),
              border: `1px solid ${alpha(theme.palette.info.main, 0.16)}`,
            }}
          >
            This historical version is identical to the current version.
          </Alert>
        )}

      <Paper elevation={0} sx={{ ...surfacePaperSx, mb: 3 }}>
        <Accordion
          expanded={expandedSystemPrompt}
          onChange={() => setExpandedSystemPrompt((prev) => !prev)}
          sx={{
            "&:before": { display: "none" },
            // border: `1px solid ${theme.palette.divider}`,
            borderRadius: 3,
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              ...stickyHeaderSx,
              flexDirection: "row-reverse",
              alignItems: "center",
              py: 1,
              px: 2.25,
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
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              {editedParts.size > 0 && (
                <Box>
                  <Tooltip title="Save Changes">
                    <Button
                      startIcon={<SaveIcon />}
                      size="small"
                      variant="contained"
                      color="primary"
                      onClick={handleSave}
                      sx={{ borderRadius: 999 }}
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
                      sx={{ mx: "10px" }}
                    >
                      Discard
                    </Button>
                  </Tooltip>
                </Box>
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
                      sx={{ borderRadius: 999 }}
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
                      sx={{ borderRadius: 999 }}
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
                      sx={{ borderRadius: 999 }}
                    >
                      {diffChanges ? "Exit Compare" : "Compare"}
                    </Button>
                  </Tooltip>
                </>
              )}
              {/*       {promptHistory.length > 0 && (
                <Tooltip title="View Prompt History">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPromptHistory(true);
                    }}
                    sx={{
                      borderRadius: 999,
                      border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                      bgcolor: alpha(theme.palette.background.paper, 0.55),
                      "&:hover": {
                        bgcolor: alpha(theme.palette.action.hover, 0.12),
                      },
                    }}
                  >
                    <HistoryIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )} */}
            </Stack>
          </AccordionSummary>
          <AccordionDetails
            sx={{
              bgcolor: alpha(
                theme.palette.background.default,
                theme.palette.mode === "dark" ? 0.35 : 0.5,
              ),
              p: { xs: 1.25, sm: 2 },
            }}
          >
            <Accordion defaultExpanded sx={{ "&:before": { display: "none" } }}>
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
                      ...promptSectionSx,
                      bgcolor:
                        diffChanges && diffChanges[p.id]
                          ? alpha(
                              theme.palette.info.light,
                              theme.palette.mode === "dark" ? 0.14 : 0.18,
                            )
                          : promptSectionSx.bgcolor,
                      border: `1px solid ${alpha(
                        diffChanges && diffChanges[p.id]
                          ? theme.palette.info.main
                          : theme.palette.divider,
                        theme.palette.mode === "dark" ? 0.22 : 0.18,
                      )}`,
                    }}
                  >
                    <Typography component="div" sx={{ lineHeight: 1.6 }}>
                      <MarkdownRender text={p.value || ""} />

                      {p.hasOwnProperty("editablePart") && (
                        <Box sx={{ mt: 1, position: "relative" }}>
                          {diffChanges && diffChanges[p.id] && (
                            <Box
                              sx={{
                                mb: 1,
                                p: 1.25,
                                borderRadius: 2,
                                bgcolor: alpha(
                                  theme.palette.error.light,
                                  theme.palette.mode === "dark" ? 0.14 : 0.22,
                                ),
                                backgroundImage: `linear-gradient(90deg, ${alpha(theme.palette.error.main, theme.palette.mode === "dark" ? 0.16 : 0.12)} 0px, transparent 16px)`,
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
                                p: 1.25,
                                borderRadius: 2,
                                bgcolor: alpha(
                                  theme.palette.success.light,
                                  theme.palette.mode === "dark" ? 0.14 : 0.22,
                                ),
                                backgroundImage: `linear-gradient(90deg, ${alpha(theme.palette.success.main, theme.palette.mode === "dark" ? 0.16 : 0.12)} 0px, transparent 16px)`,
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
                            onChange={(event) => handleInput(p.id, event)}
                            fullWidth
                            label={p.type || "Editable Section"}
                            multiline
                            variant="outlined"
                            size="small"
                            disabled={!!previousVersionId && !diffChanges}
                            InputLabelProps={{ shrink: true }}
                            sx={{
                              bgcolor: "background.paper",
                              borderRadius: 2,
                              "& .MuiOutlinedInput-root": {
                                borderRadius: 2,
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

            <Accordion defaultExpanded sx={{ "&:before": { display: "none" } }}>
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
                              if (inputProperties.has(property)) {
                                setInputProperties((prev: Set<string>) => {
                                  const _prev = new Set(prev);
                                  _prev.delete(property);
                                  return _prev;
                                });
                                setImproveProperties((prev: Set<string>) => {
                                  const _prev = new Set(prev);
                                  _prev.delete(property);
                                  return _prev;
                                });
                              } else {
                                setInputProperties((prev: Set<string>) => {
                                  const _prev = new Set(prev);
                                  _prev.add(property);
                                  return _prev;
                                });
                              }
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
                            sx={{ mb: 1, borderRadius: 999 }}
                          />
                        ))}
                    </Stack>
                  </Box>
                  {/*                   <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: alpha(
                        theme.palette.background.default,
                        theme.palette.mode === "dark" ? 0.35 : 0.45,
                      ),
                      borderColor: alpha(theme.palette.divider, 0.7),
                    }}
                  >
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1.25}
                      alignItems={{ xs: "stretch", sm: "center" }}
                      justifyContent="space-between"
                      sx={{ mb: 1 }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                          label={`${(aiAssistantContext || []).length} nodes`}
                          size="small"
                          color="secondary"
                          sx={{ borderRadius: 999, fontWeight: 700 }}
                        />
                        <Typography variant="body2" sx={{ fontWeight: 650 }}>
                          Context preview
                        </Typography>
                        {nodeTitle && (
                          <Typography variant="caption" color="text.secondary">
                            from <strong>{nodeTitle}</strong>
                          </Typography>
                        )}
                      </Stack>
                      <TextField
                        margin="dense"
                        id="number-input"
                        type="number"
                        label="Exploration depth"
                        value={explorationDepth ?? "0"}
                        onChange={handleNumberChange}
                        slotProps={{ htmlInput: { min: 0, step: 1 } }}
                        size="small"
                        sx={{
                          width: { xs: "100%", sm: 240 },
                          "& .MuiOutlinedInput-root": {
                            borderRadius: 2.5,
                            bgcolor: alpha(
                              theme.palette.background.paper,
                              theme.palette.mode === "dark" ? 0.28 : 0.7,
                            ),
                            backdropFilter: "blur(6px)",
                            transition: theme.transitions.create(
                              [
                                "border-color",
                                "box-shadow",
                                "background-color",
                              ],
                              { duration: theme.transitions.duration.shortest },
                            ),
                            "& fieldset": {
                              borderColor: alpha(theme.palette.divider, 0.7),
                            },
                            "&:hover fieldset": {
                              borderColor: alpha(
                                theme.palette.primary.main,
                                0.55,
                              ),
                            },
                            "&.Mui-focused fieldset": {
                              borderColor: alpha(
                                theme.palette.primary.main,
                                0.9,
                              ),
                            },
                            "&.Mui-focused": {
                              boxShadow: `0 0 0 3px ${alpha(
                                theme.palette.primary.main,
                                theme.palette.mode === "dark" ? 0.25 : 0.18,
                              )}`,
                            },
                          },
                          "& input[type=number]": {
                            MozAppearance: "textfield",
                          },
                          "& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button":
                            {
                              WebkitAppearance: "none",
                              margin: 0,
                            },
                        }}
                      />
                    </Stack>
                    <Box
                      sx={{
                        maxHeight: 220,
                        overflow: "auto",
                        borderRadius: 2,
                        border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                        bgcolor: alpha(theme.palette.background.paper, 0.6),
                        scrollbarWidth: "none",
                        msOverflowStyle: "none",
                        "&::-webkit-scrollbar": {
                          display: "none",
                        },
                      }}
                    >
                      <pre
                        style={{
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          fontSize: "0.75rem",
                          padding: theme.spacing(1.25),
                          margin: 0,
                          ...SCROLL_BAR_STYLE,
                        }}
                      >
                        {JSON.stringify(aiAssistantContext, null, 2)}
                      </pre>
                    </Box>
                  </Paper> */}
                </Stack>
              </AccordionDetails>
            </Accordion>

            <Accordion sx={{ "&:before": { display: "none" } }}>
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
                      display: "grid",
                      gridTemplateColumns: "auto auto 1fr",
                      gridTemplateRows: "auto auto",
                      columnGap: 1,
                      rowGap: 0.25,
                      alignItems: "center",
                      p: 1.25,
                      borderRadius: 2,
                      cursor: "pointer",
                      border: `1px solid ${alpha(
                        theme.palette.divider,
                        theme.palette.mode === "dark" ? 0.25 : 0.2,
                      )}`,
                      bgcolor: alpha(
                        theme.palette.background.paper,
                        theme.palette.mode === "dark" ? 0.18 : 0.5,
                      ),
                      "&:hover": {
                        bgcolor: alpha(theme.palette.action.hover, 0.12),
                      },
                    }}
                    onClick={() => setGenerateNewNodes((prev) => !prev)}
                  >
                    <Checkbox
                      checked={generateNewNodes}
                      size="small"
                      sx={{ p: 0, gridColumn: 1, gridRow: 1 }}
                      readOnly
                    />

                    <Typography
                      sx={{ fontWeight: 650, gridColumn: 3, gridRow: 1 }}
                    >
                      Propose new nodes
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ gridColumn: 3, gridRow: 2 }}
                    >
                      Suggest additional nodes to add under the selected context
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      bgcolor: alpha(
                        theme.palette.background.default,
                        theme.palette.mode === "dark" ? 0.35 : 0.55,
                      ),
                      border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
                      borderRadius: 2,
                      p: 2,
                    }}
                  >
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "auto 1fr auto",
                        gridTemplateRows: "auto auto",
                        columnGap: 1,
                        rowGap: 0.25,
                        alignItems: "center",
                        mb: 1,
                      }}
                    >
                      <Checkbox
                        checked={(() => {
                          const eligible = [
                            ...PROPERTIES_TO_IMPROVE.allTypes,
                            ...(PROPERTIES_TO_IMPROVE[nodeType] || []),
                          ].filter((p) => inputProperties.has(p));
                          return (
                            eligible.length > 0 &&
                            eligible.every((p) => improveProperties.has(p))
                          );
                        })()}
                        indeterminate={(() => {
                          const eligible = [
                            ...PROPERTIES_TO_IMPROVE.allTypes,
                            ...(PROPERTIES_TO_IMPROVE[nodeType] || []),
                          ].filter((p) => inputProperties.has(p));
                          const selectedCount = eligible.filter((p) =>
                            improveProperties.has(p),
                          ).length;
                          return (
                            selectedCount > 0 && selectedCount < eligible.length
                          );
                        })()}
                        size="small"
                        sx={{ p: 0, gridColumn: 1, gridRow: 1 }}
                        onClick={(event) => {
                          event.stopPropagation();
                          setImproveProperties((prev: Set<string>) => {
                            const eligible = [
                              ...PROPERTIES_TO_IMPROVE.allTypes,
                              ...(PROPERTIES_TO_IMPROVE[nodeType] || []),
                            ].filter((p) => inputProperties.has(p));
                            if (
                              eligible.length > 0 &&
                              eligible.every((p) => prev.has(p))
                            ) {
                              return new Set();
                            }
                            return new Set(eligible);
                          });
                        }}
                      />

                      <Typography
                        sx={{ fontWeight: 650, gridColumn: 2, gridRow: 1 }}
                      >
                        Propose improvements
                      </Typography>

                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ gridColumn: 2, gridRow: 2 }}
                      >
                        Choose which properties the assistant should refine
                      </Typography>
                    </Box>

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
                            if (improveProperties.has(property)) {
                              setImproveProperties((prev: Set<string>) => {
                                const _prev = new Set(prev);
                                _prev.delete(property);
                                return _prev;
                              });
                            } else {
                              setInputProperties((prev: Set<string>) => {
                                const _prev = new Set(prev);
                                _prev.add(property);
                                return _prev;
                              });
                              setImproveProperties((prev: Set<string>) => {
                                const _prev = new Set(prev);
                                _prev.add(property);
                                return _prev;
                              });
                            }
                          }}
                          variant={
                            improveProperties.has(property)
                              ? "filled"
                              : "outlined"
                          }
                          color={
                            improveProperties.has(property)
                              ? "primary"
                              : "default"
                          }
                          size="small"
                          clickable
                          sx={{ mb: 1, borderRadius: 999 }}
                        />
                      ))}
                    </Stack>
                  </Box>

                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "auto auto 1fr",
                      gridTemplateRows: "auto auto",
                      columnGap: 1,
                      rowGap: 0.25,
                      alignItems: "center",
                      p: 1.25,
                      borderRadius: 2,
                      cursor: "pointer",
                      border: `1px solid ${alpha(
                        theme.palette.divider,
                        theme.palette.mode === "dark" ? 0.25 : 0.2,
                      )}`,
                      bgcolor: alpha(
                        theme.palette.background.paper,
                        theme.palette.mode === "dark" ? 0.18 : 0.5,
                      ),
                      "&:hover": {
                        bgcolor: alpha(theme.palette.action.hover, 0.12),
                      },
                    }}
                    onClick={() => setProposeDeleteNodes((prev) => !prev)}
                  >
                    <Checkbox
                      checked={proposeDeleteNode}
                      size="small"
                      sx={{ p: 0, gridColumn: 1, gridRow: 1 }}
                      readOnly
                    />

                    <Typography
                      sx={{ fontWeight: 650, gridColumn: 3, gridRow: 1 }}
                    >
                      Propose node deletion
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ gridColumn: 3, gridRow: 2 }}
                    >
                      Flag nodes that look redundant, incorrect, or out of place
                    </Typography>
                  </Box>
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
                      improveProperties.size > 0,
                      proposeDeleteNode,
                    )}
                  </pre>
                  {improveProperties.size > 0 && (
                    <Accordion
                      sx={{
                        "&:before": { display: "none" },
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
                        "&:before": { display: "none" },
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
                        "&:before": { display: "none" },
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
                      "&:before": { display: "none" },
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

                  <Accordion
                    sx={{
                      "&:before": { display: "none" },
                      bgcolor: alpha(theme.palette.background.default, 0.7),
                    }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="caption">
                        Full prompt sent to Copilot
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <pre
                        style={{
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          fontSize: "0.75rem",
                        }}
                      >
                        {fullPromptPreview}
                      </pre>
                    </AccordionDetails>
                  </Accordion>
                </Stack>
              </AccordionDetails>
            </Accordion>

            <Accordion sx={{ "&:before": { display: "none" } }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <RuleIcon sx={{ mr: 1, color: "text.secondary" }} />
                <Typography
                  variant="subtitle1"
                  fontWeight="medium"
                  sx={{ fontWeight: "bold" }}
                >
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

      <Paper elevation={0} sx={surfacePaperSx}>
        <Accordion
          defaultExpanded
          sx={{
            "&:before": { display: "none" },
            // border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              ...stickyHeaderSx,
              flexDirection: "row-reverse",
              py: 1,
              px: 2.25,
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
            sx={{
              p: { xs: 1.5, sm: 2 },
              bgcolor: alpha(
                theme.palette.background.default,
                theme.palette.mode === "dark" ? 0.35 : 0.5,
              ),
            }}
          >
            <TextField
              autoFocus
              margin="dense"
              id="prompt-input"
              label="Enter your instructions for the AI Assistant"
              type="text"
              value={userInstructions}
              onChange={handleInputChange}
              fullWidth
              multiline
              minRows={3}
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              sx={{
                bgcolor: "background.paper",
                borderRadius: 2,
                "& .MuiOutlinedInput-root": { borderRadius: 2 },
              }}
            />
          </AccordionDetails>
        </Accordion>
      </Paper>
    </Box>
  );
};

export default CopilotPrompt;
