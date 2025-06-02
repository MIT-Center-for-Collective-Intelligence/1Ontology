import useConfirmDialog from "@components/lib/hooks/useConfirmDialog";
import useThemeChange from "@components/lib/hooks/useThemeChange";
import { a11yProps, TabPanel } from "@components/lib/utils/TabPanel";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";
import WbSunnyIcon from "@mui/icons-material/WbSunny";
import BedtimeIcon from "@mui/icons-material/Bedtime";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import SettingsEthernetIcon from "@mui/icons-material/SettingsEthernet";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";

import {
  Box,
  IconButton,
  Typography,
  Tooltip,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Tabs,
  Tab,
  useTheme,
  LinearProgress,
  Collapse,
} from "@mui/material";
import AutoFixNormalIcon from "@mui/icons-material/AutoFixNormal";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import PromptDialogComponent from "@components/components/Consultant/PromptDialogComponent";
import { Post } from "@components/lib/utils/Post";
import NodeEditor from "@components/components/Consultant/NodeEditor";
import ReinforcementLoopsDisplay from "@components/components/Consultant/ReinforcementLoopsDisplay";
import ConsultantChat from "@components/components/Consultant/ConsultantChat";
import CollabTree from "@components/components/Consultant/CollabTree";
import LinkEditor from "@components/components/Consultant/LinkEditor";
import AddNodeTypeModal from "@components/components/Consultant/AddNodeTypeModal";
import GraphRenderer from "@components/components/Consultant/GraphRenderer";
import { useAuth } from "@components/components/context/AuthContext";
import withAuthUser from "@components/components/hoc/withAuthUser";
import {
  DIAGRAMS,
  GROUPS,
  LINKS,
  NODES,
} from "@components/lib/firestoreClient/collections";
import mitLogoDarkLong from "../../public/MIT-Logo-Dark.png";
import { Bar, Container, Section } from "@column-resizer/react";

const LINKS_TYPES: any = {
  "known positive": { text: "Known Positive Effect", color: "#4caf50" },
  "hypothetical positive": {
    text: "Hypothetical Positive Effect",
    color: "#1BBAE4",
  },
  "known negative": { text: "Known Negative Effect", color: "#A91BE4" },
  "hypothetical negative": {
    text: "Hypothetical Negative Effect",
    color: "#E4451B",
  },
};

const NODE_TYPES = "nodeTypes";

const processChanges = (
  prev: any,
  changes: any,
  object = false,
  collection = null,
) => {
  const _prev = object ? { ...prev } : [...prev];

  changes.forEach((change: any) => {
    const index = object
      ? -1
      : _prev.findIndex((group: any) => group.id === change.doc.id);
    if (change.type === "added" || change.type === "modified") {
      if (object) {
        _prev[change.doc.id] = { ...change.doc.data(), id: change.doc.id };
      } else if (index === -1) {
        _prev.push({ ...change.doc.data(), id: change.doc.id });
      } else {
        _prev[index] = { ...change.doc.data(), id: change.doc.id };
      }
    } else if (change.type === "removed") {
      if (object) {
        delete _prev[change.doc.id];
      } else if (index !== -1) {
        _prev.splice(index, 1);
      }
    }
  });
  return _prev;
};

const getColor = (nodeType: string, nodeTypes: any, factor: number) => {
  const color = nodeTypes[nodeType.toLowerCase()]?.color || "";
  return changeAlphaColor(color, factor);
};

const changeAlphaColor = (color: string, factor: number) => {
  let hex = color.replace("#", "");
  if (hex.length === 3)
    hex = hex
      .split("")
      .map((x) => x + x)
      .join("");
  if (hex.length === 6)
    return `rgba(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(
      hex.slice(4, 6),
      16,
    )}, ${factor})`;
  if (hex.length === 8)
    return `rgba(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(
      hex.slice(4, 6),
      16,
    )}, ${(parseInt(hex.slice(6, 8), 16) / 255) * factor})`;
  return hex;
};

const Consultant = () => {
  const [{ user }] = useAuth();
  const db = getFirestore("causal-diagram");
  const theme = useTheme();
  const [handleThemeSwitch] = useThemeChange();
  const [newNode, setNewNode] = useState<any>(null);
  const [selectedLink, setSelectedLink] = useState<any>(null);
  const [_openSideBar, setOpenSideBar] = useState(true);
  const [selectedDiagram, setSelectedDiagram] = useState<{
    id: string;
    title: string;
    documentDetailed: string;
    updating?: boolean;
  }>({
    id: "",
    title: "",
    documentDetailed: "",
  });
  const [nodeTypes, setNodeTypes] = useState({});
  const [isModalAddTypeOpen, setIsModalAddTypeOpen] = useState(false);
  const [editNodeType, setEditNodeType] = useState<any>(null);
  const [groups, setGroups] = useState([]);
  const [links, setLinks] = useState<any>([]);
  const [nodes, setNodes] = useState<any>({});
  const [selectedGroups, setSelectedGroups] = useState<any>({});
  const [diagrams, setDiagrams] = useState<any>([]);
  const { ConfirmDialog, confirmIt } = useConfirmDialog();
  const [loadingResponse, setLoadingResponse] = useState<string | null>(null);
  const [tempText, setTempText] = useState("");
  const [generateNewDiagramState, setGenerateNewDiagramState] = useState(false);
  const [tabIndex, setTabIndex] = React.useState(0);
  const [reinforcementLoops, setReinforcementLoops] = useState([]);
  const [selectedLoop, setSelectedLoop] = useState<any>(null);
  const [selectedSolutionId, setSelectedSolutionId] = useState(null);
  const [showLegendDrawer, setShowLegendDrawer] = useState(true);
  const columnResizerRef = useRef<any>();
  const [graphOrientation, setGraphOrientation] = useState<"LR" | "TB">("LR");

  // const svgRef: any = useRef();
  const editor = true;

  const getReinforcementLoops = (links: any) => {
    const graph: any = {};
    const cycles: any = [];

    links.forEach((link: any) => {
      if (!graph[link.source]) graph[link.source] = [];
      graph[link.source].push({ target: link.target, polarity: link.polarity });
    });

    function dfs(node: any, visited: any, stack: any, path: any) {
      if (stack[node]) {
        const cycleIndex = path.indexOf(node);
        if (cycleIndex !== -1) {
          const cycle = path.slice(cycleIndex);
          cycles.push(cycle);
        }
        return;
      }

      if (visited[node]) return;

      visited[node] = true;
      stack[node] = true;
      path.push(node);

      if (graph[node]) {
        graph[node].forEach((neighbor: any) => {
          dfs(neighbor.target, visited, stack, path);
        });
      }

      stack[node] = false;
      path.pop();
    }

    const visited = {};
    const stack = {};
    Object.keys(graph).forEach((node) => {
      dfs(node, visited, stack, []);
    });

    function classifyLoop(cycle: any) {
      let hasPositive = false;
      let hasNegative = false;

      for (let i = 0; i < cycle.length; i++) {
        const source = cycle[i];
        const target = cycle[(i + 1) % cycle.length];
        const link = links.find(
          (l: any) => l.source === source && l.target === target,
        );
        if (link) {
          if (link.polarity === "positive") hasPositive = true;
          if (link.polarity === "negative") hasNegative = true;
        }
      }

      if (hasPositive && hasNegative) return "Balancing Loop";
      if (hasPositive) return "Positive Reinforcing Loop";
      if (hasNegative) return "Negative Reinforcing Loop";
    }

    const result: any = {
      "Positive Reinforcing Loop": [],
      "Negative Reinforcing Loop": [],
      "Balancing Loop": [],
    };

    cycles.forEach((cycle: any) => {
      const loopType: any = classifyLoop(cycle);
      result[loopType].push({ loopNodes: cycle });
    });
    /*     for (let key in result) {
      if (result[key].length <= 0) {
        delete result[key];
      }
    } */
    return result;
  };

  const TAB_STYLE = {
    textTransform: "none",
    fontWeight: 500,
    color: theme.palette.mode === "dark" ? "#ccc" : "#333",
    "&.Mui-selected": {
      color: "#ea7906",
      fontWeight: 600,
    },
    "&:hover": {
      backgroundColor: theme.palette.mode === "dark" ? "#444" : "#eee",
    },
    transition: "background-color 0.3s, color 0.3s",
    borderRadius: "25px",
    mb: 0,
    mt: 1,
  };

  useEffect(() => {
    const diagramsQuery = query(
      collection(db, DIAGRAMS),
      where("deleted", "==", false),
      where("consultant", "==", true),
      where("ignoreCLD", "==", true),
    );

    const unsubscribeDiagrams = onSnapshot(diagramsQuery, (snapshot) => {
      const changes = snapshot.docChanges();
      setDiagrams((prev: any) => processChanges(prev, changes));
    });
    return () => {
      unsubscribeDiagrams();
    };
  }, [db]);

  useEffect(() => {
    if (!db) return;
    const unsubscribe = onSnapshot(collection(db, NODE_TYPES), (snapshot) => {
      const newNodeTypes: any = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        newNodeTypes[data.type.toLowerCase()] = { ...doc.data(), id: doc.id };
      });
      setNodeTypes(newNodeTypes);
    });

    return unsubscribe;
  }, [db]);

  useEffect(() => {
    if (!selectedDiagram?.id && !selectedSolutionId) return;
    setNodes({});
    setGroups([]);
    setLinks([]);
    const diagramId = selectedSolutionId || selectedDiagram?.id;
    const groupsQuery = query(
      collection(db, GROUPS),
      where("diagrams", "array-contains", diagramId),
      where("deleted", "==", false),
    );
    const linksQuery = query(
      collection(db, LINKS),
      where("diagrams", "array-contains", diagramId),
      where("deleted", "==", false),
    );
    const nodesQuery = query(
      collection(db, NODES),
      where("diagrams", "array-contains", diagramId),
      where("deleted", "==", false),
    );

    const unsubscribeGroups = onSnapshot(groupsQuery, (snapshot) => {
      const changes = snapshot.docChanges();
      setGroups((prev) => processChanges(prev, changes));
    });

    const unsubscribeLinks = onSnapshot(linksQuery, (snapshot) => {
      const changes = snapshot.docChanges();
      setLinks((prev: any) =>
        processChanges(prev, changes, false /* , "links" */),
      );
    });

    const unsubscribeNodes = onSnapshot(nodesQuery, (snapshot) => {
      const changes = snapshot.docChanges();
      setNodes((prev: any) => processChanges(prev, changes, true));
    });

    return () => {
      unsubscribeGroups();
      unsubscribeLinks();
      unsubscribeNodes();
    };
  }, [db, selectedDiagram?.id, selectedSolutionId]);

  const handleOpenSidBar = () => {
    setOpenSideBar((old) => !old);
  };

  const ColorBox = (props: any, editor: boolean) => {
    return (
      <Box
        sx={{
          display: "inline-flex",
          justifyContent: "center",
          alignItems: "center",
          bgcolor: props.color,
          color: "white",
          fontSize: 13,
          borderRadius: 2,
          px: 2,
          py: 1,
          ml: 0.9,
          mr: 0.5,
          textAlign: "center",
          height: "40px",
          position: "relative",
          cursor: editor ? "pointer" : "",
        }}
        key={props.text}
        onClick={() => {
          if (!editor) return;
          setEditNodeType({
            color: props.color,
            type: props.text,
            id: props.id,
          });
          setIsModalAddTypeOpen(true);
        }}
      >
        {props.text}
      </Box>
    );
  };
  const CustomTabPanel = (props: any) => {
    const { children, value, index, ...other } = props;

    return (
      <div
        role="tabpanel"
        hidden={value !== index}
        id={`simple-tabpanel-${index}`}
        aria-labelledby={`simple-tab-${index}`}
        {...other}
      >
        {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
      </div>
    );
  };
  const addChild = (child: any) => {
    setNewNode((prev: any) => {
      const _prev = { ...prev };
      if (!_prev.children.includes(child)) {
        _prev.children.push(child);
      }
      return _prev;
    });
  };

  useEffect(() => {
    if (!selectedDiagram?.id) {
      setSelectedDiagram({ ...diagrams[0] });
    } else {
      const diagramIndex = diagrams.findIndex(
        (c: any) => c.id === selectedDiagram?.id,
      );
      if (diagramIndex !== -1) {
        setSelectedDiagram({ ...diagrams[diagramIndex] });
      }
    }
  }, [diagrams]);

  const handleChangeDiagram = (event: any) => {
    const _diagram = diagrams.find(
      (diagram: any) => diagram.title === event.target.value,
    );

    setSelectedDiagram(_diagram || { id: "", title: "" });
    setGroups([]);
    setNodes([]);
    setLinks([]);
  };

  const AddNewNode = () => {
    setSelectedLink(null);
    setNewNode({
      label: "",
      nodeType: "process variable",
      isLeverage: false,
      groups: [],
      diagrams: [],
      children: [],
      new: true,
    });
    setTabIndex(3);
    setOpenSideBar(true);
  };

  const deleteDiagram = useCallback(async () => {
    if (
      !(await confirmIt(
        `Are you sure you want to delete this diagram? ${selectedDiagram.id}`,
        "Delete",
        "Keep",
      ))
    ) {
      return;
    }
    if (selectedDiagram) {
      const diagramRef = doc(db, DIAGRAMS, selectedDiagram.id);
      await updateDoc(diagramRef, {
        deleted: true,
      });

      for (let nodeId in nodes) {
        const nodeRef = doc(db, NODES, nodeId);
        await updateDoc(nodeRef, { deleted: true });
      }
      for (let link of links) {
        const linkRef = doc(db, LINKS, link.id);
        await updateDoc(linkRef, { deleted: true });
      }
      const filterDiagrams = diagrams.filter(
        (c: { id: string }) => c.id !== selectedDiagram.id,
      );
      if (filterDiagrams.length >= 1) {
        setSelectedDiagram(filterDiagrams[0]);
      } else {
        setSelectedDiagram({ id: "", title: "", documentDetailed: "" });
      }
    }
  }, [selectedDiagram?.id, nodes, links, diagrams]);

  const copyDiagram = () => {
    const _nodes: any = Object.values(JSON.parse(JSON.stringify(nodes)));
    const _links = JSON.parse(JSON.stringify(links));
    const _groups = JSON.parse(JSON.stringify(groups));
    for (let node of _nodes) {
      delete node.id;
      delete node.diagrams;
      delete node.deleted;
      delete node.createdAt;
      node.groups = node.groups.map((c: any) => c.label);
    }
    for (let link of _links) {
      link.source = nodes[link.source].label;
      link.target = nodes[link.target].label;
      delete link.id;
      delete link.diagrams;
      delete link.deleted;
    }
    for (let group of _groups) {
      delete group.createdAt;
      delete group.deleted;
      delete group.diagrams;
      delete group.id;
    }
    const responseFromModel = {
      nodes: _nodes,
      links: _links,
      groups: _groups,
    };
    navigator.clipboard
      .writeText(JSON.stringify(responseFromModel, null, 2))
      .then(() => {
        setTempText("Copied!");
      })
      .catch((err) => console.error("Failed to copy:", err));

    setTimeout(() => {
      setTempText("");
    }, 1000);
  };

  const usedTypes = useMemo(() => {
    return new Set(
      Object.values(nodes).map((n: any) => n.nodeType.toLowerCase()),
    );
  }, [nodes]);

  const generateNewDiagram = async ({
    documentDetailed,
    consultingTopic,
    problemStatement,
  }: {
    documentDetailed: any;
    consultingTopic: any;
    problemStatement: any;
  }) => {
    try {
      setLoadingResponse("generate");

      if (!documentDetailed.trim()) {
        setLoadingResponse(null);
        return;
      }

      if (!consultingTopic) {
        setLoadingResponse(null);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const { diagramId } = (await Post("/generateCollabDiagram", {
        documentDetailed,
        newDiagramTitle: consultingTopic,
        consultant: true,
        problemStatement,
      })) as any;
      setSelectedDiagram({
        id: diagramId,
        title: consultingTopic,
        documentDetailed,
      });

      setLoadingResponse(null);
      // reviewDiagram();
    } catch (error) {
      console.error(error);
      await confirmIt("There was an error generating the diagram!", "Ok", "");
    } finally {
      setLoadingResponse(null);
    }
  };

  const handleSave = useCallback(async () => {
    try {
      const _newNode = JSON.parse(JSON.stringify(newNode));
      setNewNode(null);
      setTabIndex(0);
      if (!selectedDiagram?.id) return;
      if (_newNode?.new) {
        const newNodeRef = doc(collection(db, NODES));

        _newNode.groups = _newNode.groups.map((c: any) => {
          return {
            label: c.label,
            id: c.id,
          };
        });

        await setDoc(newNodeRef, {
          label: _newNode.label,
          nodeType: _newNode.nodeType,
          diagrams: [selectedDiagram.id],
          groups: _newNode.groups,
          isLeverage: _newNode.isLeverage,
          id: newNodeRef.id,
          deleted: false,
        });
        for (let child of _newNode.children) {
          const newLinkRef = doc(collection(db, LINKS));
          const newLink = {
            source: newNodeRef.id,
            target: child,
            certainty: "known",
            polarity: "positive",
            diagrams: [selectedDiagram.id],
            detail: "",
          };
          setDoc(newLinkRef, newLink);
        }
      } else if (!!_newNode.previous) {
        const previousChildren = links.filter(
          (c: any) => c.source === _newNode.id,
        );
        for (let previous of previousChildren) {
          if (!_newNode.children.includes(previous.target)) {
            const linkRef = doc(collection(db, LINKS), previous.id);
            updateDoc(linkRef, { deleted: true });
          }
        }
        for (let child of _newNode.children) {
          const indx = previousChildren.findIndex(
            (c: any) => c.target === child,
          );
          if (indx === -1) {
            const newLinkRef = doc(collection(db, LINKS));
            const newLink = {
              id: newLinkRef.id,
              source: _newNode.id,
              target: child,
              certainty: "known",
              polarity: "positive",
              diagrams: [selectedDiagram.id],
              detail: "",
              deleted: false,
            };

            await setDoc(newLinkRef, newLink);
          }
        }
        const newNodeRef = doc(collection(db, NODES), _newNode.id);

        _newNode.groups = _newNode.groups.map((c: any) => {
          return {
            label: c.label,
            id: c.id,
          };
        });
        await updateDoc(newNodeRef, {
          label: _newNode.label,
          nodeType: _newNode.nodeType,
          diagrams: [selectedDiagram.id],
          groups: _newNode.groups,
          id: newNodeRef.id,
          isLeverage: _newNode.isLeverage,
          deleted: false,
        });
      }
    } catch (error) {
      console.error(error);
    }
  }, [db, links, newNode, selectedDiagram?.id]);

  const handleClose = () => {
    setSelectedLink(null);
    setNewNode(null);
    setTabIndex(0);
  };
  const deleteNode = async () => {
    if (!newNode) return;
    if (
      await confirmIt(
        "Are you sure you want to delete this node?",
        "Delete",
        "Keep",
      )
    ) {
      const nodeRef = doc(collection(db, NODES), newNode.id);
      updateDoc(nodeRef, { deleted: true });
      setNewNode(null);
      setTabIndex(0);
    }
  };

  const handleSaveLink = async () => {
    const linkRef = doc(collection(db, LINKS), selectedLink.id);
    updateDoc(linkRef, {
      certainty: selectedLink.certainty,
      detail: selectedLink.detail,
      polarity: selectedLink.polarity,
    });
    setTabIndex(0);
    setSelectedLink(null);
  };

  const deleteLink = async () => {
    if (
      await confirmIt(
        "Are you sure you want to delete the link?",
        "Delete",
        "Keep",
      )
    ) {
      if (selectedLink) {
        const linkRef = doc(collection(db, LINKS), selectedLink.id);
        updateDoc(linkRef, { deleted: true });
        setSelectedLink(null);
        setTabIndex(0);
      }
    }
  };

  const saveNewType = async (
    type: string,
    color: string,
    editedNodeType: { type: string; id: string } | null,
  ) => {
    if (editedNodeType) {
      const nodeTypeRef = doc(db, NODE_TYPES, editedNodeType.id);

      await updateDoc(nodeTypeRef, {
        type,
        color,
      });

      const nodesQuery = query(
        collection(db, NODES),
        where("type", "==", editedNodeType.type),
      );

      const nodesDocsSnapshot = await getDocs(nodesQuery);
      const batch = writeBatch(db);

      nodesDocsSnapshot.forEach((nodeDoc) => {
        batch.update(nodeDoc.ref, { type });
      });

      await batch.commit();
    } else {
      const newTypeRef = doc(collection(db, NODE_TYPES));
      await setDoc(newTypeRef, {
        type,
        color,
        createdAt: new Date(),
      });
    }
  };
  const handleGOrientationSwitch = () => {
    setGraphOrientation((prev) => {
      if (prev === "LR") {
        return "TB";
      }
      return "LR";
    });
  };

  useEffect(() => {
    setReinforcementLoops(getReinforcementLoops(links));
  }, [links]);

  return (
    <Box
      sx={{
        overflow: "hidden",
        height: "100vh",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        "&::-webkit-scrollbar": {
          display: "none",
        },
      }}
    >
      {diagrams.length > 0 && !generateNewDiagramState ? (
        <Container
          columnResizerRef={columnResizerRef}
          style={{ height: "100%" }}
        >
          <Section minSize={0} defaultSize={500}>
            <Box
              sx={{
                display: "flex",
                position: "sticky",
                alignItems: "center", //
                top: 0,
                zIndex: 10,
                p: 1,
                backgroundColor:
                  theme.palette.mode === "dark" ? "#333" : "#cecfd2",
                borderBottom:
                  theme.palette.mode === "dark"
                    ? "1px solid #444"
                    : "1px solid #ddd",
                boxShadow: "0 2px 5px rgba(0, 0, 0, 0.1)",
                borderRadius: "25px",
                mx: "10px",
              }}
            >
              {" "}
              <Box sx={{ mb: 0, mr: "10px", pt: "7px", pl: "7px" }}>
                <img
                  src={mitLogoDarkLong.src}
                  alt="mit logo"
                  width={"auto"}
                  height={"40px"}
                />
              </Box>{" "}
              <Typography
                sx={{
                  alignItems: "center",
                  textAlign: "center",
                  fontSize: "24px",
                }}
              >
                Consultant Chat
              </Typography>
              <Box sx={{ ml: "auto" }}>
                <Tooltip title={"Generate a diagram"} sx={{ mt: "3px" }}>
                  {loadingResponse &&
                  (loadingResponse === "generate" ||
                    loadingResponse === "improve") ? (
                    <Box
                      sx={{
                        width: "35px",
                        height: "35px",
                        border: "1px solid gray",
                        borderRadius: "10px",
                        alignItems: "center",
                        display: "flex",
                        mr: "20px",
                        justifyContent: "center",
                      }}
                    >
                      <CircularProgress size={24} />
                    </Box>
                  ) : (
                    <IconButton
                      onClick={() => {
                        setGenerateNewDiagramState(true);
                      }}
                      sx={{
                        width: "35px",
                        height: "35px",
                        border: "1px solid gray",
                        borderRadius: "10px",
                        mr: "20px",
                      }}
                      disabled={!!loadingResponse}
                    >
                      <AutoFixNormalIcon />
                    </IconButton>
                  )}
                </Tooltip>
                <Tooltip title={"Delete the Case"}>
                  <IconButton
                    sx={{
                      width: "35px",
                      height: "35px",
                      border: "1px solid gray",
                      borderRadius: "10px",
                      mr: "10px",
                    }}
                    onClick={deleteDiagram}
                    disabled={!!loadingResponse}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>

                {diagrams.length > 0 && (
                  <FormControl disabled={!!loadingResponse}>
                    <InputLabel>Project</InputLabel>
                    <Select
                      label="diagram"
                      value={selectedDiagram?.title || ""}
                      onChange={handleChangeDiagram}
                      sx={{
                        width: "200px",
                        border: "1px",
                        borderColor: "white",
                        borderRadius: "25px",
                        p: 0,
                        mr: "20px",
                        "& .MuiSelect-select": {
                          padding: 0,
                          p: "10px",
                        },
                      }}
                    >
                      {[...diagrams].map((diagram) => (
                        <MenuItem
                          key={diagram.id}
                          value={diagram.title}
                          sx={{ display: "center" }}
                        >
                          {diagram.title}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
                <FormControlLabel
                  label={false}
                  control={
                    <Tooltip
                      title={
                        theme.palette.mode === "dark"
                          ? "Turn on the light"
                          : "Turn off the light"
                      }
                    >
                      <Box
                        onClick={handleThemeSwitch}
                        sx={{
                          border: "1px solid gray",
                          borderRadius: "10px",
                          pt: 1,
                          px: 1,
                          pb: 0,
                          ":hover": {
                            backgroundColor: (theme) =>
                              theme.palette.mode === "dark"
                                ? "gray"
                                : "#e0e0e0",
                          },
                        }}
                      >
                        {theme.palette.mode === "dark" ? (
                          <WbSunnyIcon sx={{ color: "white" }} />
                        ) : (
                          <BedtimeIcon sx={{ color: "gray" }} />
                        )}
                      </Box>
                    </Tooltip>
                  }
                />
              </Box>
            </Box>

            <TabPanel value={tabIndex} index={0} sx={{ pl: "15px" }}>
              <ConsultantChat
                diagramId={selectedDiagram.id ?? ""}
                setSelectedSolutionId={setSelectedSolutionId}
                selectedSolutionId={selectedSolutionId ?? ""}
                ignoreCLD={true}
              />
            </TabPanel>
          </Section>
        </Container>
      ) : (
        <Box
          sx={{
            backgroundColor: (theme) =>
              theme.palette.mode === "dark" ? "#272727" : "",
            height: "100vh",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <PromptDialogComponent
            generateNewDiagram={generateNewDiagram}
            confirmation="generate"
            loadingResponse={loadingResponse}
            generateNewDiagramState={generateNewDiagramState}
            setGenerateNewDiagramState={setGenerateNewDiagramState}
            handleThemeSwitch={handleThemeSwitch}
            ignoreCLD={true}
          />
        </Box>
      )}

      <AddNodeTypeModal
        open={isModalAddTypeOpen}
        onClose={() => {
          setIsModalAddTypeOpen(false);
          setEditNodeType(null);
        }}
        onSave={saveNewType}
        editNodeType={editNodeType}
      />

      {ConfirmDialog}
    </Box>
  );
};

export default withAuthUser({
  shouldRedirectToLogin: true,
  shouldRedirectToHomeIfAuthenticated: false,
})(Consultant);

{
  /*        <Tooltip title="Expand Sidebar" placement="right">
                  <IconButton
                    sx={{
                      position: "absolute",
                      top: "50%",
                      left: "0",
                      zIndex: "1000",
                      color: "white",
                      transform: "translateY(-50%)",
                      width: "20px",
                      height: "60px",
                      borderRadius: "0 40px 40px 0",
                      backgroundColor: "#767373",
                      boxShadow: 3,
                      "&:hover": {
                        backgroundColor: "action.hover",
                      },
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                    }}
                    onClick={handleOpenSidBar}
                  >
                    <ArrowForwardIosIcon
                      sx={{ fontSize: "25px", marginLeft: "-4px" }}
                    />
                  </IconButton>
                </Tooltip> */
}

{
  /*     <Tooltip title="Collapse Sidebar" placement="right">
                  <IconButton
                    onClick={() => setOpenSideBar(false)}
                    sx={{
                      position: "absolute",
                      top: "50%",
                      right: "-20px",
                      transform: "translateY(-50%)",
                      backgroundColor:
                        theme.palette.mode === "dark" ? "#333" : "gray",
                      color: "white",
                      boxShadow: 2,
                      width: "45px",
                      height: "60px",
                      clipPath: "polygon(0% 0%, 50% 0%, 50% 100%, 0% 100%)",
                      "&:hover": {
                        backgroundColor:
                          theme.palette.mode === "dark" ? "#555" : "#ddd",
                      },
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      p: 0,
                    }}
                  >
                    <ArrowBackIosIcon
                      sx={{ fontSize: "25px", ml: "-8px" }}
                    />{" "}
                  </IconButton>
                </Tooltip> */
}
