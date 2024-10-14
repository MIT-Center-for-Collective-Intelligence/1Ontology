/* 
This React component named `Ontology` is a complex and feature-rich component that serves as a central part of an application dealing with ontological data. It provides a user interface for viewing and interacting with a hierarchical structure of ontologies, managing comments, and searching through ontology nodes. The component uses Firebase Firestore for data storage and retrieval, Fuse.js for search functionality, and Material-UI for styling and layout. It also includes markdown rendering capabilities and responsive design adjustments for mobile devices.

Here's a breakdown of the key parts of the component:

### Imports and Setup
- The component imports a variety of libraries and components, including Firebase Firestore functions, Material-UI components, Fuse.js for search, and custom components like `TreeViewSimplified`, `DAGGraph`, and `MarkdownRender`.
- It defines the `Ontology` functional component and sets up state variables for managing nodes, search results, comments, UI states, and more.

### Authentication and Routing
- The component checks if the user is authenticated and their email is verified. If not, it redirects to the sign-in page.
- It uses the `useRouter` hook from Next.js to handle routing within the application.

### Firestore Data Subscription
- The component sets up Firestore subscriptions to listen for changes in nodes, user data, and locked node fields, updating the component's state accordingly.

### Ontology Path Management
- Functions like `getPath` and `updateTheUrl` are used to construct and manage the path of the current node being viewed, which is reflected in the URL hash for easy sharing and navigation.

### Ontology Tree and DAG View
- The component provides two different visualizations for the ontology structure: a tree view and a directed acyclic graph (DAG) view. Users can switch between these views using tabs.

### Search Functionality
- The `searchWithFuse` function uses Fuse.js to perform a search on the ontology nodes based on the user's query.

### Comment Management
- The component allows users to add, edit, and delete comments on ontology nodes. It uses functions like `handleSendComment`, `deleteComment`, and `editComment` to manage comment interactions.

### Inheritance Updates
- The `updateInheritance` function recursively updates fields in the ontology hierarchy that are related to inheritance, ensuring that changes in parent nodes are reflected in child nodes.

### UI Components and Layout
- The component uses Material-UI components to create a responsive layout with a header, tabs, search bar, comment section, and markdown cheatsheet.
- It uses the `@column-resizer/react` library to allow users to resize sections of the layout.

### Effects and Callbacks
- The component uses `useEffect` hooks to handle side effects such as data fetching, URL hash changes, and Firestore subscriptions.
- Callback functions like `handleLinkNavigation`, `addNewNode`, and `saveChildNode` handle user interactions with the ontology structure.

### Higher-Order Component (HOC)
- The `withAuthUser` HOC is used to wrap the `Ontology` component, providing authentication checks and redirection logic.

### Return Statement
- The component conditionally renders the main content or a loading indicator based on whether the ontology nodes have been loaded.
- It returns a structured layout with a header, ontology visualizations, and a right panel for search and comments.

### Developer Comments
- Throughout the component, there are places where additional developer comments could be added to explain complex logic, the purpose of specific functions, and the reasoning behind certain design choices.

This component is a key part of the application, providing a rich interface for users to interact with ontological data. It demonstrates the use of React hooks, Firestore, and third-party libraries to create a dynamic and responsive user experience. */

import { Bar, Container, Section } from "@column-resizer/react";

import SettingsEthernetIcon from "@mui/icons-material/SettingsEthernet";
import {
  Box,
  Button,
  CircularProgress,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  Timestamp,
  collection,
  doc,
  getFirestore,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import Fuse from "fuse.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// import markdownContent from "../components/OntologyComponents/Markdown-Here-Cheatsheet.md";
import SneakMessage from " @components/components/OntologyComponents/SneakMessage";
import Node from " @components/components/OntologyComponents/Node";
import TreeViewSimplified from " @components/components/OntologyComponents/TreeViewSimplified";
import {
  ILinkNode,
  ILockedNode,
  INode,
  INodePath,
  INodeTypes,
  MainSpecializations,
  TreeVisual,
} from " @components/types/INode";
import { TabPanel, a11yProps } from " @components/lib/utils/TabPanel";

import useConfirmDialog from " @components/lib/hooks/useConfirmDialog";
import withAuthUser from " @components/components/hoc/withAuthUser";
import { useAuth } from " @components/components/context/AuthContext";
import { useRouter } from "next/router";
import DagGraph from " @components/components/OntologyComponents/DAGGraph";
import { SCROLL_BAR_STYLE } from " @components/lib/CONSTANTS";
import { NODES, USERS } from " @components/lib/firestoreClient/collections";

import { recordLogs, saveNewChangeLog } from " @components/lib/utils/helpers";
import { useHover } from " @components/lib/hooks/useHover";
import { MemoizedToolbarSidebar } from " @components/components/Sidebar/ToolbarSidebar";
import { NodeChange } from " @components/types/INode";

import { getAuth } from "firebase/auth";
import GuidLines from " @components/components/Guidlines/GuidLines";

const Ontology = () => {
  const db = getFirestore();
  const [{ emailVerified, user }] = useAuth();
  const router = useRouter();
  const isMobile = useMediaQuery("(max-width:599px)") && true;
  const [nodes, setNodes] = useState<{ [id: string]: INode }>({});
  const [currentVisibleNode, setCurrentVisibleNode] = useState<INode | null>(
    null
  );
  // const [ontologyPath, setOntologyPath] = useState<INodePath[]>([]);
  const [snackbarMessage, setSnackbarMessage] = useState<string>("");
  const [treeVisualization, setTreeVisualization] = useState<TreeVisual>({});
  const { confirmIt, ConfirmDialog } = useConfirmDialog();
  const [viewValue, setViewValue] = useState<number>(0);
  const fuse = new Fuse(Object.values(nodes), { keys: ["title"] });
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [eachOntologyPath, setEachOntologyPath] = useState<{
    [key: string]: INodePath[];
  }>({});
  const columnResizerRef = useRef<any>();
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  //last interaction date from the user
  const [lastInteractionDate, setLastInteractionDate] = useState<Date>(
    new Date(Date.now())
  );

  const [selectedDiffNode, setSelectedDiffNode] = useState<NodeChange | null>(
    null
  );
  const scrolling = useRef<any>();

  const { ref: toolbarRef, isHovered } = useHover();

  const [activeSidebar, setActiveSidebar] = useState<string | null>(null);

  const handleExpandSidebar = (sidebarType: string) => {
    setActiveSidebar(sidebarType);
  };
  const theme = useTheme();

  const [currentImprovement, setCurrentImprovement] = useState(null);
  const [displayGuidelines, setDisplayGuidelines] = useState(false);

  useEffect(() => {
    // Check if a user is logged in
    if (user) {
      // Check if the user's email is verified
      if (!emailVerified) {
        // If the email is not verified, redirect to the sign-in page
        router.replace("/signin");
      }
    }
  }, [user, emailVerified]);

  useEffect(() => {
    // Function to handle changes in the URL hash
    const handleHashChange = async () => {
      // Check if there is a hash in the URL
      if (window.location.hash) {
        // Call updateUserDoc with the hash split into an array
        const visibleNodeId = window.location.hash.split("#").reverse()[0];
        if (nodes[visibleNodeId]) {
          setCurrentVisibleNode(nodes[visibleNodeId]);
        }
      }
    };

    // Add an event listener to the window for hash changes
    window.addEventListener("hashchange", handleHashChange);

    // Call handleHashChange immediately to handle any initial hash
    handleHashChange();

    // Clean up the event listener when the component is unmounted
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [eachOntologyPath]);

  // Function to perform a search using Fuse.js library
  const searchWithFuse = (query: string, nodeType?: INodeTypes): INode[] => {
    // Return an empty array if the query is empty
    if (!query) {
      return [];
    }

    // Perform search using Fuse.js, filter out deleted items
    return fuse
      .search(query)
      .map((result) => result.item)
      .filter(
        (item: INode) =>
          !item.deleted &&
          !item.category &&
          (!nodeType || nodeType === item.nodeType)
      );
  };

  const handleViewChange = (event: any, newValue: number) => {
    setViewValue(newValue);
    recordLogs({
      action: "view change",
      viewType: newValue === 0 ? "Tree View" : "Dag View",
    });
  };

  useEffect(() => {
    const controller = columnResizerRef.current;

    if (controller) {
      const resizer = controller.getResizer();

      resizer.resizeSection(2, { toSize: 0 });
      controller.applyResizer(resizer);
    }
  }, [user, nodes]);

  useEffect(() => {
    const checkIfDifferentDay = () => {
      const today = new Date();
      if (
        today.getDate() !== lastInteractionDate.getDate() ||
        today.getMonth() !== lastInteractionDate.getMonth() ||
        today.getFullYear() !== lastInteractionDate.getFullYear()
      ) {
        window.location.reload();
      }
    };

    const intervalId = setInterval(checkIfDifferentDay, 1000);

    return () => clearInterval(intervalId);
  }, [lastInteractionDate]);

  /* ------- ------- ------- */

  // This function finds the path of a node in a nested structure of mainNodes and their children.
  const findOntologyPath = useCallback(
    ({
      mainNodes,
      path,
      eachOntologyPath,
    }: {
      mainNodes: INode[];
      path: INodePath[];
      eachOntologyPath: { [nodeId: string]: INodePath[] };
    }): { [nodeId: string]: INodePath[] } | undefined => {
      try {
        // Loop through each main node

        for (let node of mainNodes) {
          if (!node) {
            continue;
          }
          // Update the path for the current node

          eachOntologyPath[node.id] = [
            ...path,
            {
              title: node.title,
              id: !!node.category ? `${node.id}-${node.title.trim()}` : node.id,
              category: !!node.category,
            },
          ];

          // Loop through categories in the specializations of the current node
          node.specializations.forEach((collection, collectionIdx) => {
            const specializationsData: INode[] = [];
            node.specializations[collectionIdx].nodes.forEach((n: ILinkNode) =>
              specializationsData.push(nodes[n.id])
            );

            const subPath = [...path];

            subPath.push({
              title: node.title,
              id: !!node.category ? `${node.id}-${node.title.trim()}` : node.id,
              category: !!node.category,
            });
            if (collection.collectionName !== "main") {
              subPath.push({
                title: collection.collectionName,
                id: `${node.id}-${collection.collectionName.trim()}`,
                category: true,
              });
            }
            // Recursively call the findOntologyPath function for the filtered specializations
            const result = findOntologyPath({
              mainNodes: specializationsData,
              path: [...subPath],
              eachOntologyPath,
            });
            if (result) {
              eachOntologyPath = result;
            }
          });
        }

        // Return the accumulated ontology paths
        return eachOntologyPath;
      } catch (error: any) {
        recordLogs({
          type: "error",
          error: JSON.stringify({
            name: error.name,
            message: error.message,
            stack: error.stack,
          }),
        });
      }
    },
    [nodes]
  );

  useEffect(() => {
    const mainNodes = Object.values(nodes).filter((node: any) => node.category);
    if (mainNodes.length > 0) {
      // Initialize eachOntologyPath with an empty object and find the ontology path
      let eachOntologyPath = findOntologyPath({
        mainNodes,
        path: [],
        eachOntologyPath: {},
      });
      if (eachOntologyPath) {
        setEachOntologyPath(eachOntologyPath);
      }
    }
  }, [nodes]);

  // Function to generate a tree structure of specializations based on main nodes
  const getSpecializationsTree = (_nodes: INode[], path: string[]) => {
    // Object to store the main specializations tree
    let newSpecializationsTree: any = {};
    // Iterate through each main nodes

    for (let node of _nodes) {
      if (!node) {
        continue;
      }
      const nodeTitle = node.title;
      // Create an entry for the current node in the main specializations tree
      newSpecializationsTree[nodeTitle] = {
        id: node.category ? `${node.id}-${nodeTitle.trim()}` : node.id,
        path: [...path, node.id],
        isCategory: !!node.category,
        locked: !!node.locked,
        title: nodeTitle,

        specializations: {},
      };

      // Iterate through each collection in the specializations child-nodes

      for (let collection of node.specializations) {
        // Filter nodes based on the current collection
        const specializations: INode[] = [];
        collection.nodes.forEach((nodeLink: { id: string }) => {
          specializations.push(nodes[nodeLink.id]);
        });

        // Check if the collection is the main collection
        if (collection.collectionName === "main") {
          // If main, update the main specializations entry with recursive call
          newSpecializationsTree[nodeTitle] = {
            id: node.category ? `${node.id}-${nodeTitle.trim()}` : node.id,
            path: [...path, node.id],
            isCategory: !!node.category,
            title: nodeTitle,
            locked: !!node.locked,
            categoriesOrder: node.specializations.map((n) => n.collectionName),
            specializations: {
              ...(newSpecializationsTree[nodeTitle]?.specializations || {}),
              ...getSpecializationsTree(specializations, [...path, node.id]),
            },
          };
        } else {
          // If not main, create a new entry for the collection
          newSpecializationsTree[nodeTitle] = {
            id: node.id,
            path: [...path, node.id],
            title: nodeTitle,
            c: node.category,
            locked: !!node.locked,
            categoriesOrder: node.specializations.map((n) => n.collectionName),
            specializations: {
              ...(newSpecializationsTree[nodeTitle]?.specializations || {}),
              [collection.collectionName]: {
                isCategory: true,
                id: `${node.id}-${collection.collectionName.trim()}`,
                title: collection.collectionName,
                locked: !!node.locked,
                specializations: getSpecializationsTree(specializations, [
                  ...path,
                  node.id,
                ]),
              },
            },
          };
        }
      }
    }

    // Return the main specializations tree
    return newSpecializationsTree;
  };

  useEffect(() => {
    // Create a query for the NODES collection where "deleted" is false
    const nodesQuery = query(
      collection(db, NODES),
      where("deleted", "==", false)
    );

    // Set up a snapshot listener to track changes in the nodes collection
    const unsubscribeNodes = onSnapshot(nodesQuery, (snapshot) => {
      // Get the changes (added, modified, removed) in the snapshot
      const docChanges = snapshot.docChanges();

      // Update the state based on the changes in the nodes collection
      setNodes((nodes: { [id: string]: INode }) => {
        const _nodes = { ...nodes }; // Clone the existing nodes object

        // Loop through each change in the snapshot
        for (let change of docChanges) {
          const changeData: any = change.doc.data();
          const nodeId = change.doc.id;

          if (change.type === "removed" && _nodes[nodeId]) {
            // If the document is removed, delete it from the state
            delete _nodes[nodeId];
          } else {
            // If the document is added or modified, add/update its data in the state
            _nodes[nodeId] = { id: nodeId, ...changeData };
          }
        }

        // Return the updated state
        return _nodes;
      });
    });

    // Unsubscribe from the snapshot listener when the component is unmounted
    return () => unsubscribeNodes();
  }, [db]);

  useEffect(() => {
    // Filter nodes to get only those with a defined category
    const mainCategories = Object.values(nodes).filter(
      (node: INode) => node.category
    );

    // Sort main nodes based on a predefined order
    mainCategories.sort((nodeA: any, nodeB: any) => {
      const order = ["WHAT: Activities", "WHO: Actors", "WHY: Evaluation"];
      const nodeATitle = nodeA.title;
      const nodeBTitle = nodeB.title;
      return order.indexOf(nodeATitle) - order.indexOf(nodeBTitle);
    });
    // Generate a tree structure of specializations from the sorted main nodes
    let treeOfSpecializations = getSpecializationsTree(mainCategories, []);
    // Set the generated tree structure for visualization
    setTreeVisualization(treeOfSpecializations);
  }, [nodes]);

  useEffect(() => {
    if (currentVisibleNode) return;
    if (user?.currentNode && nodes[user.currentNode]) {
      setCurrentVisibleNode(nodes[user.currentNode]);
    } else {
      setCurrentVisibleNode(nodes["hn9pGQNxmQe9Xod5MuKK"]!);
    }
  }, [user?.currentNode, nodes]);

  // Function to update the user document with the current ontology path
  const openedANode = async (currentNode: string) => {
    if (!user) return;
    const userRef = doc(collection(db, USERS), user.uname);
    // Update the user document with the ontology path

    await updateDoc(userRef, { currentNode });

    // Record logs if ontology path is not empty
    if (currentNode) {
      recordLogs({
        action: "Opened a node",
        node: currentNode,
      });
    }
  };

  const updateTheUrl = (path: INodePath[]) => {
    if (!path) {
      return;
    }
    let newHash = "";
    path.forEach((p: any) => (newHash = newHash + `#${p.id.trim()}`));
    window.location.hash = newHash;
  };

  const initializeExpanded = (ontologyPath: INodePath[]) => {
    if (!ontologyPath) {
      return;
    }
    const newExpandedSet: Set<string> = new Set();

    for (let node of ontologyPath) {
      newExpandedSet.add(node.id);
    }
    setExpandedNodes(newExpandedSet);
  };

  useEffect(() => {
    if (!currentVisibleNode?.id || !nodes[currentVisibleNode?.id]) {
      return;
    }

    openedANode(currentVisibleNode.id);
    if (expandedNodes.size === 0) {
      initializeExpanded(eachOntologyPath[currentVisibleNode?.id]);
    }
    // setOntologyPath(eachOntologyPath[currentVisibleNode?.id]);
    updateTheUrl(eachOntologyPath[currentVisibleNode?.id]);
  }, [currentVisibleNode?.id, eachOntologyPath]);

  // Callback function to add a new node to the database
  const addNewNode = useCallback(
    async ({ id, newNode }: { id: string; newNode: any }) => {
      try {
        if (!user?.uname) return;
        // Reference to the new node document
        // setCurrentVisibleNode({
        //   id,
        //   ...newNode,
        // });
        const newNodeRef = doc(collection(db, NODES), id);
        // Set the document with the new node data
        await setDoc(newNodeRef, {
          ...newNode,
          locked: false,
          deleted: false,
          createdAt: new Date(),
        });
        saveNewChangeLog(db, {
          nodeId: newNodeRef.id,
          modifiedBy: user?.uname,
          modifiedProperty: "",
          previousValue: null,
          newValue: null,
          modifiedAt: new Date(),
          changeType: "add node",
          fullNode: newNode,
        });
        // Record logs for the created node
        recordLogs({
          action: "Create a new node",
          nodeId: id,
        });

        // Set the newly created node as editable
      } catch (error) {
        console.error(error);
      }
    },
    [nodes, user?.uname]
  );

  // Define a callback function to handle the opening of the ontology DAGRE view.
  const onOpenNodeDagre = useCallback(
    async (nodeId: string) => {
      // Check if a user is logged in, if not, exit the function.
      if (!user) return;

      // Check if the node with the specified ID exists and is not a main node (no category).
      if (nodes[nodeId] && !nodes[nodeId].category) {
        // Set the currentVisibleNode as the currently selected node.
        setCurrentVisibleNode(nodes[nodeId]);

        // Record logs for the action of opening the DAGRE view for the node.
        recordLogs({
          action: "opened dagre-view",
          itemClicked: nodes[nodeId].id,
        });
      }
    },
    // Dependency array includes ontologies and user, ensuring the function re-renders when these values change.
    [nodes, user]
  );

  // Function to handle opening node tree
  const onOpenNodesTree = useCallback(
    async (nodeId: string) => {
      // Check if user is logged in

      if (!user) return;
      //update the expanded state
      setExpandedNodes((prevExpanded: Set<string>) => {
        const newExpanded = new Set(prevExpanded); // Create a new set to avoid mutating the previous state
        if (newExpanded.has(nodeId)) {
          // newExpanded.delete(nodeId); // Remove the nodeId if it exists
        } else {
          newExpanded.add(nodeId); // Otherwise, add it
        }
        return newExpanded;
      });

      // Check if node exists and has a category
      if (nodes[nodeId] && !nodes[nodeId].category) {
        // Set the currently open node
        setCurrentVisibleNode(nodes[nodeId]);

        // Record logs for the action of clicking the tree-view
        recordLogs({
          action: "clicked tree-view",
          itemClicked: nodes[nodeId].id,
        });
      }
    },
    [nodes, user]
  );

  // Function to retrieve main specializations from tree visualization data
  const getMainSpecializations = (treeVisualization: TreeVisual) => {
    let mainSpecializations: MainSpecializations = {};

    // Loop through categories in tree visualization
    for (let category in treeVisualization) {
      mainSpecializations = {
        ...mainSpecializations,
        ...treeVisualization[category].specializations,
      };
    }

    for (let type in mainSpecializations) {
      mainSpecializations[nodes[mainSpecializations[type].id].nodeType] =
        mainSpecializations[type];
      delete mainSpecializations[type];
    }
    return mainSpecializations;
  };

  const mainSpecializations = useMemo(() => {
    return getMainSpecializations(treeVisualization);
  }, [treeVisualization]);

  // This function is called when a search result node is clicked.
  const openSearchedNode = (node: any) => {
    try {
      // Set the clicked node as the open currentVisibleNode
      setCurrentVisibleNode(node);

      setTimeout(() => {
        const element = document.getElementById("node-" + node?.id);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 800);
      initializeExpanded(eachOntologyPath[node.id]);
      // Record the click action in logs
      recordLogs({
        action: "Search result clicked",
        clicked: node.id,
      });
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (process.env.NODE_ENV === "development") return;
    const handleUserActivity = () => {
      const currentTime = Date.now();
      setLastInteractionDate(new Date(currentTime));

      if (user) {
        const timeSinceLastUpdate =
          lastUpdate !== null ? currentTime - lastUpdate || 0 : 60001;
        if (timeSinceLastUpdate >= 60000) {
          const userDocRef = doc(collection(db, USERS), user.uname);
          updateDoc(userDocRef, {
            lastInteracted: Timestamp.now(),
          });
          setLastUpdate(currentTime);
        }
      }
    };
    handleUserActivity();
    window.addEventListener("click", handleUserActivity);

    return () => {
      window.removeEventListener("click", handleUserActivity);
    };
  }, [user, lastUpdate, db]);

  useEffect(() => {
    const checkIfDifferentDay = () => {
      const today = new Date();
      if (
        today.getDate() !== lastInteractionDate.getDate() ||
        today.getMonth() !== lastInteractionDate.getMonth() ||
        today.getFullYear() !== lastInteractionDate.getFullYear()
      ) {
        window.location.reload();
      }
    };

    const intervalId = setInterval(checkIfDifferentDay, 1000);

    return () => clearInterval(intervalId);
  }, [lastInteractionDate]);

  const navigateToNode = async (nodeId: string) => {
    if (nodes[nodeId]) {
      setCurrentVisibleNode(nodes[nodeId]);
      initializeExpanded(eachOntologyPath[nodeId]);
      setSelectedDiffNode(null);
      setTimeout(() => {
        const element = document.getElementById("node-" + nodeId);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 800);
    }
  };

  const displaySidebar = useCallback(
    (sidebarName: "chat" | "nodeHistory" | "inheritanceSettings") => {
      if (activeSidebar === sidebarName) {
        setActiveSidebar(null);
      } else {
        handleExpandSidebar(sidebarName);
      }
    },
    [activeSidebar]
  );

  if (Object.keys(nodes).length <= 0) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          flexDirection: "column",
        }}
      >
        <CircularProgress />
        {/* <br /> */}
        <Typography sx={{ mt: "5px" }}> Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Container
        style={{
          height: "100vh",
          display: "flex",
          overflow: "hidden",
        }}
        columnResizerRef={columnResizerRef}
      >
        {!isMobile && (
          <Section
            minSize={0}
            defaultSize={600}
            style={{
              display: "flex",
              flexDirection: "column",
              backgroundColor:
                theme.palette.mode === "dark" ? "#303134" : "white",
            }}
          >
            <Tabs
              value={viewValue}
              onChange={handleViewChange}
              sx={{
                width: "100%",
                borderColor: "divider",

                backgroundColor: (theme) =>
                  theme.palette.mode === "dark" ? "#242425" : "#d0d5dd",
                ".MuiTab-root.Mui-selected": {
                  color: "#ff6d00",
                },
              }}
            >
              <Tab
                label="Outline"
                {...a11yProps(0)}
                sx={{ width: "50%", fontSize: "20px" }}
              />
              <Tab
                label="Graph View"
                {...a11yProps(1)}
                sx={{ width: "50%", fontSize: "20px" }}
              />
            </Tabs>

            <Box
              sx={{
                height: "100vh",
                flexGrow: 1,
                overflow: "auto",
                ...SCROLL_BAR_STYLE,
              }}
            >
              <TabPanel
                value={viewValue}
                index={0}
                sx={{
                  mb: "50px",
                }}
              >
                <TreeViewSimplified
                  treeVisualization={treeVisualization}
                  onOpenNodesTree={onOpenNodesTree}
                  expandedNodes={expandedNodes}
                  setExpandedNodes={setExpandedNodes}
                  currentVisibleNode={currentVisibleNode}
                />
              </TabPanel>
              <TabPanel value={viewValue} index={1}>
                <DagGraph
                  treeVisualization={treeVisualization}
                  setExpandedNodes={setExpandedNodes}
                  expandedNodes={expandedNodes}
                  onOpenNodeDagre={onOpenNodeDagre}
                  currentVisibleNode={currentVisibleNode}
                />
              </TabPanel>
            </Box>
          </Section>
        )}

        <Bar
          size={2}
          style={{
            background: "currentColor",
            cursor: "col-resize",
            position: "relative",
          }}
        >
          <SettingsEthernetIcon
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              color: (theme) =>
                theme.palette.mode === "dark"
                  ? theme.palette.common.gray50
                  : theme.palette.common.notebookMainBlack,
            }}
          />
        </Bar>

        <Section minSize={0}>
          <Box
            id="node-section"
            sx={{
              backgroundColor: (theme) =>
                theme.palette.mode === "dark"
                  ? theme.palette.common.notebookMainBlack
                  : theme.palette.common.gray50,
              p: "20px",
              pt: 0,
              overflow: "auto",
              height: "100vh",
              ...SCROLL_BAR_STYLE,
            }}
          >
            <Box ref={scrolling}></Box>
            {displayGuidelines && (
              <Box sx={{ p: 2 }}>
                <GuidLines />
              </Box>
            )}
            {currentVisibleNode && user && !displayGuidelines && (
              <Node
                currentVisibleNode={currentVisibleNode}
                setCurrentVisibleNode={setCurrentVisibleNode}
                setSnackbarMessage={setSnackbarMessage}
                user={user}
                mainSpecializations={mainSpecializations}
                nodes={nodes}
                addNewNode={addNewNode}
                navigateToNode={navigateToNode}
                eachOntologyPath={eachOntologyPath}
                searchWithFuse={searchWithFuse}
                locked={!!currentVisibleNode.locked && !user?.manageLock}
                selectedDiffNode={selectedDiffNode}
                displaySidebar={displaySidebar}
                activeSidebar={activeSidebar}
                currentImprovement={currentImprovement}
              />
            )}
          </Box>
        </Section>

        <MemoizedToolbarSidebar
          // isHovered={toolbarIsHovered}
          toolbarRef={toolbarRef}
          user={user}
          openSearchedNode={openSearchedNode}
          searchWithFuse={searchWithFuse}
          nodes={nodes}
          selectedDiffNode={selectedDiffNode}
          setSelectedDiffNode={setSelectedDiffNode}
          currentVisibleNode={currentVisibleNode}
          setCurrentVisibleNode={setCurrentVisibleNode}
          confirmIt={confirmIt}
          activeSidebar={activeSidebar}
          setActiveSidebar={setActiveSidebar}
          handleExpandSidebar={handleExpandSidebar}
          navigateToNode={navigateToNode}
          treeVisualization={treeVisualization}
          expandedNodes={expandedNodes}
          setExpandedNodes={setExpandedNodes}
          onOpenNodesTree={onOpenNodesTree}
          setDisplayGuidelines={setDisplayGuidelines}
          currentImprovement={currentImprovement}
          setCurrentImprovement={setCurrentImprovement}
        />
      </Container>
      {ConfirmDialog}
      <SneakMessage
        newMessage={snackbarMessage}
        setNewMessage={setSnackbarMessage}
      />
    </Box>
  );
};
export default withAuthUser({
  shouldRedirectToLogin: true,
  shouldRedirectToHomeIfAuthenticated: false,
})(Ontology);
