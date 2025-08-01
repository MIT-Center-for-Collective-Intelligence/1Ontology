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
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Tab,
  Tabs,
  TextField,
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
import SneakMessage from "@components/components/OntologyComponents/SneakMessage";
import Node from "@components/components/OntologyComponents/Node";
import TreeViewSimplified from "@components/components/OntologyComponents/TreeViewSimplified";
import {
  ICollection,
  ILinkNode,
  ILockedNode,
  INode,
  INodePath,
  INodeTypes,
  MainSpecializations,
  TreeData,
  TreeVisual,
} from "@components/types/INode";
import { TabPanel, a11yProps } from "@components/lib/utils/TabPanel";

import useConfirmDialog from "@components/lib/hooks/useConfirmDialog";
import withAuthUser from "@components/components/hoc/withAuthUser";
import { useAuth } from "@components/components/context/AuthContext";
import { useRouter } from "next/router";
import GraphView from "@components/components/OntologyComponents/GraphView";
import {
  DISPLAY,
  SCROLL_BAR_STYLE,
  SKILLS_FUTURE_APP_NAMES,
} from "@components/lib/CONSTANTS";
import { NODES, USERS } from "@components/lib/firestoreClient/collections";

import { recordLogs } from "@components/lib/utils/helpers";
import { useHover } from "@components/lib/hooks/useHover";
import { MemoizedToolbarSidebar } from "@components/components/Sidebar/ToolbarSidebar";
import { NodeChange } from "@components/types/INode";
import GuidLines from "@components/components/Guidelines/GuideLines";
import SearchSideBar from "@components/components/SearchSideBar/SearchSideBar";
import Head from "next/head";
import DraggableTree from "@components/components/OntologyComponents/DraggableTree";
import { TreeApi } from "react-arborist";
import { capitalizeFirstLetter } from "@components/lib/utils/string.utils";
import ROUTES from "@components/lib/utils/routes";
import { getAuth } from "firebase/auth";
const stem = require("wink-porter2-stemmer");
const tokenizer = require("wink-tokenizer");

const myTokenizer = tokenizer();

export const tokenize = (str: string) => {
  let tokens = [];
  if (str) {
    let tokenized = myTokenizer.tokenize(str);
    for (let w of tokenized) {
      if (w.tag === "word" && w.value.length > 1) {
        tokens.push(stem(w.value));
      }
    }
    // tokens = stopword.removeStopwords(tokens);
  }
  return tokens;
};

const AddContext = (nodes: any, nodesObject: any): INode[] => {
  for (let node of nodes) {
    if (node.nodeType === "context" && Array.isArray(node.properties.context)) {
      const contextId = node.properties.context[0].nodes[0]?.id;
      if (nodesObject[contextId]) {
        node.context = {
          id: contextId,
          title: nodesObject[contextId].title,
        };
      }
    }
  }
  return nodes;
};

const Ontology = ({
  skillsFuture = false,
  appName,
}: {
  skillsFuture: boolean;
  appName: string;
}) => {
  const db = getFirestore();
  const [{ emailVerified, user }] = useAuth();
  const router = useRouter();
  const isMobile = useMediaQuery("(max-width:599px)");
  const [nodes, setNodes] = useState<{ [id: string]: INode }>({});
  const [currentVisibleNode, setCurrentVisibleNode] = useState<INode | null>(
    null,
  );
  // const [ontologyPath, setOntologyPath] = useState<INodePath[]>([]);
  const [snackbarMessage, setSnackbarMessage] = useState<string>("");
  const [treeVisualization, setTreeVisualization] = useState<TreeVisual>({});
  const { confirmIt, ConfirmDialog } = useConfirmDialog();
  const [viewValue, setViewValue] = useState<number>(0);
  const fuse = new Fuse(AddContext(Object.values(nodes), nodes), {
    keys: ["title", "context.title"],
  });
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [eachOntologyPath, setEachOntologyPath] = useState<{
    [key: string]: INodePath[];
  }>({});
  const columnResizerRef = useRef<any>();
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  //last interaction date from the user
  const [lastInteractionDate, setLastInteractionDate] = useState<Date>(
    new Date(Date.now()),
  );

  const [selectedDiffNode, setSelectedDiffNode] = useState<NodeChange | null>(
    null,
  );
  const scrolling = useRef<any>();

  const { ref: toolbarRef, isHovered } = useHover();

  const [activeSidebar, setActiveSidebar] = useState<string | null>(null);

  const handleExpandSidebar = (sidebarType: string) => {
    setActiveSidebar(sidebarType);
  };
  const theme = useTheme();

  const [currentImprovement, setCurrentImprovement] = useState<any>(null);
  const [displayGuidelines, setDisplayGuidelines] = useState(false);
  const prevHash = useRef<string>();
  const [lastSearches, setLastSearches] = useState<any[]>([]);
  const [selectedChatTab, setSelectedChatTab] = useState<number>(0);
  /*  */
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [checkedItemsCopy, setCheckedItemsCopy] = useState<Set<string>>(
    new Set(),
  );
  const [searchValue, setSearchValue] = useState("");
  const [clonedNodesQueue, setClonedNodesQueue] = useState<{
    [nodeId: string]: { title: string; id: string };
  }>({});
  const [newOnes, setNewOnes] = useState(new Set());
  const [loadingIds, setLoadingIds] = useState(new Set());
  const [selectedProperty, setSelectedProperty] = useState("");
  const [selectedCollection, setSelectedCollection] = useState("");

  const [removedElements, setRemovedElements] = useState<Set<string>>(
    new Set(),
  );
  const [addedElements, setAddedElements] = useState<Set<string>>(new Set());
  const [treeViewData, setTreeViewData] = useState([]);
  const [loadingNodes, setLoadingNodes] = useState(false);
  const [partsInheritance, setPartsInheritance] = useState<any>({});

  const [scrollTrigger, setScrollTrigger] = useState(false);
  const [enableEdit, setEnableEdit] = useState(false);
  const [specializationNumsUnder, setSpecializationNumsUnder] = useState({});
  const [editableProperty, setEditableProperty] = useState<ICollection[]>([]);

  const treeRef = useRef<TreeApi<TreeData>>(null);

  const firstLoad = useRef(true);

  const signOut = async () => {
    router.push(ROUTES.signIn);
    getAuth().signOut();
  };

  const handleCloseAddLinksModel = () => {
    setSelectedProperty("");
    setSelectedCollection("");
    setSearchValue("");
    setAddedElements(new Set());
    setRemovedElements(new Set());
    setCheckedItemsCopy(new Set());
    setNewOnes(new Set());
    setCheckedItems(new Set());
    setClonedNodesQueue({});
    setLoadingIds(new Set());
    setEditableProperty([]);
  };

  useEffect(() => {
    if (user) {
      // Load last searches from localStorage with userId prefix
      const searches = localStorage.getItem(`lastSearches_${user.userId}`);
      if (searches) {
        setLastSearches(JSON.parse(searches));
      }
    }
  }, [user]);

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

        if (visibleNodeId !== prevHash.current) {
          navigateToNode(visibleNodeId);
          prevHash.current = visibleNodeId;
        }

        // Update the previous hash
      }
    };

    if (typeof window !== "undefined") {
      // Call handleHashChange immediately to handle any initial hash
      handleHashChange();

      // Add an event listener to the window for hash changes
      window.addEventListener("hashchange", handleHashChange);
    }

    // Clean up the event listener when the component is unmounted
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [eachOntologyPath]);

  // Function to update last searches
  const updateLastSearches = (searchedNode: any) => {
    setLastSearches((prevSearches) => {
      // If searchedNode is null, only filter valid searches from prevSearches
      if (!searchedNode) {
        const validSearches = prevSearches.filter((node) => {
          const nodeInNodes = nodes[node.id];
          return nodeInNodes && !nodeInNodes.deleted; // Keep only non-deleted nodes
        });

        localStorage.setItem(
          `lastSearches_${user?.userId}`,
          JSON.stringify(validSearches),
        );
        return validSearches;
      }

      // Proceed with the usual update if searchedNode is not null
      const filteredSearches = prevSearches.filter(
        (s) => s.id !== searchedNode.id,
      );
      const updatedSearches = [searchedNode, ...filteredSearches];

      const validSearches = updatedSearches.filter((node) => {
        const nodeInNodes = nodes[node.id];
        return nodeInNodes && !nodeInNodes.deleted; // Keep only non-deleted nodes
      });

      const limitedSearches = validSearches.slice(0, 20);

      // Update localStorage with the new list of searches
      localStorage.setItem(
        `lastSearches_${user?.userId}`,
        JSON.stringify(limitedSearches),
      );
      return limitedSearches;
    });
  };

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
          (!nodeType || nodeType === item.nodeType),
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
  }, []); // Removed dependencies to fix column auto-resizing when node content changes (when editing nodes through yjsEditor)

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
      visited = new Set(),
    }: {
      mainNodes: INode[];
      path: INodePath[];
      eachOntologyPath: { [nodeId: string]: INodePath[] };
      visited?: Set<string>;
    }): { [nodeId: string]: INodePath[] } | undefined => {
      try {
        for (let node of mainNodes) {
          if (!node || visited.has(node.id)) {
            continue;
          }

          visited.add(node.id);

          eachOntologyPath[node.id] = [
            ...path,
            {
              title: node.title,
              id: !!node.category ? `${node.id}-${node.title.trim()}` : node.id,
              category: !!node.category,
            },
          ];

          node.specializations.forEach((collection) => {
            const specializationsData: INode[] = [];

            collection.nodes.forEach((n: ILinkNode) =>
              specializationsData.push(nodes[n.id]),
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
              visited,
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
    [nodes],
  );

  useEffect(() => {
    const mainNodes = Object.values(nodes).filter(
      (node: any) =>
        node.category || (typeof node.root === "boolean" && !!node.root),
    );
    if (mainNodes.length > 0) {
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
  const getSpecializationsTree = (
    _nodes: INode[],
    path: string[],
    visited: Set<string> = new Set(),
  ) => {
    let newSpecializationsTree: any = {};

    if (_nodes.length === 0) return {};

    for (let node of _nodes) {
      if (!node || visited.has(node.id)) {
        continue;
      }
      visited.add(node.id);
      const nodeTitle = node.title;
      const parts = Array.isArray(node.properties.parts)
        ? node.properties.parts.flatMap((c) => c.nodes)
        : [];
      // Create an entry for the current node in the main specializations tree
      newSpecializationsTree[node.id] = {
        id: node.category ? `${node.id}-${nodeTitle.trim()}` : node.id,
        path: [...path, node.id],
        isCategory: !!node.category,
        locked: !!node.locked,
        title: nodeTitle,
        unclassified: !!node.unclassified,
        parts,
        specializations: {},
        generalizations: {},
      };

      // Iterate through each collection in the specializations child-nodes
      for (let collection of node.specializations) {
        // Filter nodes based on the current collection
        const specializations: INode[] = [];
        collection.nodes.forEach((nodeLink: { id: string }) => {
          specializations.push(nodes[nodeLink.id]);
        });

        if (collection.collectionName === "main") {
          newSpecializationsTree[node.id].specializations = {
            ...(newSpecializationsTree[node.id]?.specializations || {}),
            ...getSpecializationsTree(
              specializations,
              [...path, node.id],
              visited,
            ),
          };
          newSpecializationsTree[node.id].generalizations =
            node.generalizations[0].nodes;
        } else {
          newSpecializationsTree[node.id].specializations[
            collection.collectionName
          ] = {
            isCategory: true,
            id: `${node.id}-${collection.collectionName.trim()}`,
            title: collection.collectionName,
            locked: !!node.locked,
            specializations: getSpecializationsTree(
              specializations,
              [...path, node.id],
              visited,
            ),
            generalizations: node.generalizations[0].nodes,
          };
        }
      }
    }

    // Return the main specializations tree
    return newSpecializationsTree;
  };

  useEffect(() => {
    // Create a query for the NODES collection where "deleted" is false
    let nodesQuery = null;

    if (skillsFuture && appName) {
      nodesQuery = query(
        collection(db, NODES),
        where("deleted", "==", false),
        where("appName", "==", appName),
      );
    } else {
      nodesQuery = query(
        collection(db, NODES),
        where("deleted", "==", false),
        where("skillsFuture", "==", false),
      );
    }
    setLoadingNodes(true);
    // Set up a snapshot listener to track changes in the nodes collection
    const unsubscribeNodes = onSnapshot(nodesQuery, (snapshot) => {
      // Get the changes (added, modified, removed) in the snapshot
      const docChanges = snapshot.docChanges();

      // Update the state based on the changes in the nodes collection
      setNodes((prev: any) => {
        const _prev = { ...prev };
        let changed = false;

        for (let change of docChanges) {
          const nodeId = change.doc.id;
          const data = { id: nodeId, ...change.doc.data() };

          if (change.type === "removed") {
            if (nodeId in _prev) {
              delete _prev[nodeId];
              changed = true;
            }
          } else {
            const prevNode = _prev[nodeId];
            const isDifferent =
              JSON.stringify(prevNode) !== JSON.stringify(data);
            if (isDifferent) {
              _prev[nodeId] = data;
              changed = true;
            }
          }
        }

        return _prev;
      });
    });
    setTimeout(() => {
      setLoadingNodes(false);
    }, 4000);
    // Unsubscribe from the snapshot listener when the component is unmounted
    return () => unsubscribeNodes();
  }, [db, appName]);

  useEffect(() => {
    if (currentVisibleNode?.id) {
      setCurrentVisibleNode(nodes[currentVisibleNode?.id]);
    }
  }, [nodes]);

  const getTreeView = ({ mainCategories, visited, path }: any): any => {
    const newNodes = [];

    for (let node of mainCategories) {
      if (!node) continue;

      const currentPath = [...path, node.id];
      const pathNode = currentPath.join("-");

      if (
        path.includes(node.id) ||
        (visited.has(pathNode) && currentPath.length !== 1)
      ) {
        if (
          typeof visited.get(pathNode) !== "boolean" &&
          visited.get(pathNode)
        ) {
          newNodes.push(visited.get(pathNode));
        }
        continue;
      }

      const specializations = node.specializations;
      let childrenInOrder = [];
      
      for (let collection of specializations) {
        const children = [];
        for (let _node of collection.nodes) {
          if (nodes[_node.id]) {
            children.push(nodes[_node.id]);
          }
        }

        visited.set(pathNode, true);
        if (collection.collectionName === "main") {
          const mainChildren = getTreeView({
            mainCategories: children,
            visited,
            path: currentPath,
          });
          for (let child of mainChildren) {
            if (child && "id" in child) {
              childrenInOrder.push({
                ...child,
                isMainItem: true,
                originalCollectionIndex: specializations.indexOf(collection),
              });
            }
          }
        } else {
          const id = [...currentPath, collection.collectionName].join("-");

          const _children = getTreeView({
            mainCategories: children,
            visited,
            path: currentPath,
          });
          const record = {
            id: id,
            nodeId: node.id,
            nodeType: node.nodeType,
            name: collection.collectionName,
            children: _children,
            category: true,
            unclassified: node.unclassified,
            originalCollectionIndex: specializations.indexOf(collection),
          };
          childrenInOrder.push(record);
        }
      }

      childrenInOrder.sort(
        (a, b) =>
          (a.originalCollectionIndex || 0) - (b.originalCollectionIndex || 0),
      );

      const record = {
        id: pathNode,
        nodeId: node.id,
        name: node.title,
        nodeType: node.nodeType,
        children: childrenInOrder,
        category: !!node.category,
        unclassified: node.unclassified,
      };
      visited.set(pathNode, record);
      newNodes.push(record);
    }
    return newNodes;
  };

  useEffect(() => {
    // Filter nodes to get only those with a defined category
    const spreadNodes = Object.values(nodes);
    let mainCategories = spreadNodes.filter(
      (node: INode) =>
        node.category || (typeof node.root === "boolean" && !!node.root),
    );
    if (skillsFuture) {
      mainCategories = mainCategories.sort((a: any, b: any) => {
        const aHasAct = a.title.toLowerCase().includes("act");
        const bHasAct = b.title.toLowerCase().includes("act");
        return Number(bHasAct) - Number(aHasAct);
      });
    }
    // Sort main nodes based on a predefined order
    mainCategories.sort((nodeA: any, nodeB: any) => {
      const order = [
        "WHAT: Activities and Objects",
        "WHO: Actors",
        "WHY: Evaluation",
        "Where: Context",
        "ONet",
      ];
      const nodeATitle = nodeA.title;
      const nodeBTitle = nodeB.title;
      return order.indexOf(nodeATitle) - order.indexOf(nodeBTitle);
    });
    // Generate a tree structure of specializations from the sorted main nodes
    let treeOfSpecializations = getSpecializationsTree(mainCategories, []);
    const specNums: any = {};
    if (
      skillsFuture &&
      (appName === "Full WordNet O*Net Verb Hierarchy - Tom's Version" ||
        appName === "Ontology - Demo Version" ||
        appName === "Ontology - Development Version")
    ) {
      for (let rootNode of mainCategories) {
        const filterMNodes = spreadNodes.filter(
          (c) => c.rootId === rootNode.id,
        );
        specNums[rootNode.id] = filterMNodes.length;
        const start =
          appName === "Full WordNet O*Net Verb Hierarchy - Tom's Version"
            ? "[original task]"
            : "[o*net]";
        specNums[`${rootNode.id}-extra`] = filterMNodes.filter((n) =>
          n.title.toLowerCase().startsWith(start),
        ).length;
      }
      setSpecializationNumsUnder(specNums);
    }

    const _result = getTreeView({
      mainCategories,
      visited: new Map(),
      path: [],
    });

    setTreeViewData(_result);
    // Set the generated tree structure for visualization
    setTreeVisualization(treeOfSpecializations);
  }, [nodes]);

  useEffect(() => {
    // if (currentVisibleNode) return;
    if (firstLoad) {
      const nodeFromHash = window.location.hash.split("#").reverse()[0];
      if (nodeFromHash && nodes[nodeFromHash]) {
        setCurrentVisibleNode(nodes[nodeFromHash]);
      } else if (user?.currentNode && nodes[user.currentNode]) {
        setCurrentVisibleNode(nodes[user.currentNode]);
      } else {
        setCurrentVisibleNode(nodes["hn9pGQNxmQe9Xod5MuKK"]!);
      }
      firstLoad.current = false;
    }
  }, [user?.currentNode]);

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

    const node = nodes[ontologyPath[ontologyPath.length - 1].id];
    const nodeGeneralizations = node.generalizations[0].nodes;

    const generalizationSet: Set<string> = new Set(
      nodeGeneralizations.map((g) => g.id),
    );

    // Initialize the expanded set with the current node's ID
    newExpandedSet.add(node.id);

    const addGeneralizationsToSet = (id: string, expandedSet: any) => {
      if (expandedSet.has(id)) return;

      expandedSet.add(id);

      const currentNode = nodes[id];

      if (!currentNode) return;

      if (
        currentNode &&
        currentNode.generalizations &&
        currentNode.generalizations.length > 0
      ) {
        const generalizations = currentNode.generalizations[0].nodes;

        currentNode.specializations?.forEach((specialization) => {
          if (specialization.collectionName !== "main") {
            specialization.nodes.forEach((spec) => {
              if (
                generalizationSet.has(spec.id) ||
                newExpandedSet.has(spec.id)
              ) {
                addGeneralizationsToSet(
                  `${currentNode.id}-${specialization.collectionName.trim()}`,
                  expandedSet,
                );
              }
            });
          }
        });
        generalizations.forEach((g) =>
          addGeneralizationsToSet(g.id, expandedSet),
        );
      }
    };
    for (let generalization of nodeGeneralizations) {
      addGeneralizationsToSet(generalization.id, newExpandedSet);
    }
    for (let node of ontologyPath) {
      newExpandedSet.add(node.id);
    }
    setExpandedNodes(newExpandedSet);
  };

  useEffect(() => {
    if (!currentVisibleNode?.id || !nodes[currentVisibleNode?.id]) {
      return;
    }

    openedANode(currentVisibleNode?.id);

    // Check if this is a root node - if so, skip initializeExpanded to prevent scrolling
    const isRootNode =
      eachOntologyPath[currentVisibleNode?.id] &&
      eachOntologyPath[currentVisibleNode?.id].length === 1;

    if (expandedNodes.size === 0 && !isRootNode) {
      initializeExpanded(eachOntologyPath[currentVisibleNode?.id]);
    }
    // setOntologyPath(eachOntologyPath[currentVisibleNode?.id]);

    updateTheUrl([
        { id: currentVisibleNode?.id, title: currentVisibleNode.title },
      ]);
  }, [currentVisibleNode?.id, eachOntologyPath]);

  // Callback function to add a new node to the database

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
    [nodes, user],
  );

  // Function to handle opening node tree
  const onOpenNodesTree = useCallback(
    async (nodeId: string) => {
      // Check if user is logged in

      if (!user) return;
      //update the expanded state
      /*    setExpandedNodes((prevExpanded: Set<string>) => {
        const newExpanded = new Set(prevExpanded); // Create a new set to avoid mutating the previous state
        if (newExpanded.has(nodeId)) {
          // newExpanded.delete(nodeId); // Remove the nodeId if it exists
        } else {
          newExpanded.add(nodeId); // Otherwise, add it
        }
        return newExpanded;
      }); */

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
    [nodes, user],
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
      if (nodes[mainSpecializations[type].id]?.nodeType) {
        mainSpecializations[nodes[mainSpecializations[type].id].nodeType] =
          mainSpecializations[type];
      }
      delete mainSpecializations[type];
    }
    return mainSpecializations;
  };

  const mainSpecializations = useMemo(() => {
    return getMainSpecializations(treeVisualization);
  }, [treeVisualization]);

  const navigateToNode = useCallback(
    async (nodeId: string) => {
      // adding timeout to test if truncated issue persists
      if (currentImprovement) {
        return;
      }
      /* if (
        selectedProperty &&
        (addedElements.size > 0 || removedElements.size > 0) &&
        (await confirmIt(
          `Unsaved changes detected in ${capitalizeFirstLetter(
            DISPLAY[selectedProperty]
              ? DISPLAY[selectedProperty]
              : selectedProperty,
          )}. Do you want to discard them?`,
          "Keep Changes",
          "Discard Changes",
        ))
      ) {
        return;
      } */
      handleCloseAddLinksModel();
      if (currentVisibleNode && nodeId === currentVisibleNode.id) {
        const element = document.getElementById(`property-title`);
        if (element) {
          setTimeout(() => {
            element.style.transition = "box-shadow 0.3s ease";
            element.style.boxShadow = "0 0 10px 3px rgba(255, 165, 0, 0.7)";
          }, 500);
          setTimeout(() => {
            element.style.boxShadow = "";
          }, 2000);
        }
      }

      if (nodes[nodeId]) {
        setCurrentVisibleNode(nodes[nodeId]);
        initializeExpanded(eachOntologyPath[nodeId]);
        setSelectedDiffNode(null);
        setScrollTrigger((prev) => !prev);
      }
    },
    [
      selectedProperty,
      addedElements,
      removedElements,
      nodes,
      eachOntologyPath,
      currentImprovement,
    ],
  );

  // This function is called when a search result node is clicked.
  const openSearchedNode = useCallback(
    (node: INode, searched = true) => {
      try {
        // Set the clicked node as the open currentVisibleNode
        // setCurrentVisibleNode(node);

        navigateToNode(node.id);

        setTimeout(() => {
          const elements = document.getElementsByClassName("node-" + node?.id);
          const firstElement = elements.length > 0 ? elements[0] : null;

          if (firstElement) {
            firstElement.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }
        }, 500);
        // initializeExpanded(eachOntologyPath[node.id]);
        // Record the click action in logs
        if (searched) {
          recordLogs({
            action: "Search result clicked",
            clicked: node.id,
          });
        }
      } catch (error) {
        console.error(error);
      }
    },
    [navigateToNode],
  );

  useEffect(() => {
    if (process.env.NODE_ENV === "development") return;
    const handleUserActivity = () => {
      const currentTime = Date.now();
      setLastInteractionDate(new Date(currentTime));

      if (user && user?.uname !== "ouhrac") {
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

  const displaySidebar = useCallback(
    (sidebarName: "chat" | "nodeHistory" | "inheritanceSettings") => {
      if (activeSidebar === sidebarName) {
        setActiveSidebar(null);
      } else {
        setSelectedChatTab(0);
        handleExpandSidebar(sidebarName);
      }
    },
    [activeSidebar],
  );

  const compareTitles = (title1: string, title2: string): boolean => {
    const tokens1 = tokenize(title1);
    const tokens2 = tokenize(title2);

    return (
      tokens1.every((token) => tokens2.includes(token)) ||
      tokens2.every((token) => tokens1.includes(token))
    );
  };

  useEffect(() => {
    if (!currentVisibleNode) return;

    const _inheritanceDetails: any = {};

    const _currentVisibleNode = { ...currentVisibleNode };

    let parts = _currentVisibleNode?.properties.parts || [];
    const inheritanceRef = _currentVisibleNode.inheritance["parts"]?.ref;
    if (inheritanceRef && nodes[inheritanceRef]) {
      parts = nodes[inheritanceRef].properties["parts"];
    }

    const generalizations = (
      _currentVisibleNode?.generalizations || []
    ).flatMap((c) => c.nodes);
    const checkGeneralizations = (
      partId: string,
    ): { genId: string; partOf: string | null }[] | null => {
      let inheritanceDetails: { genId: string; partOf: string | null }[] = [];

      for (let generalization of generalizations) {
        if (!nodes[generalization.id]) {
          continue;
        }
        const refPartsId = nodes[generalization.id].inheritance["parts"].ref;
        let generalizationParts = nodes[generalization.id]?.properties.parts;
        if (refPartsId && nodes[refPartsId]) {
          generalizationParts = nodes[refPartsId]?.properties.parts;
        }

        const partIdex = generalizationParts[0].nodes.findIndex(
          (c) => c.id === partId,
        );

        let partOfIdx: any = -1;

        if (partIdex === -1) {
          for (let { id } of generalizationParts[0].nodes) {
            const specializationPart = (
              nodes[id]?.specializations || []
            ).flatMap((c) => c.nodes);
            partOfIdx = specializationPart.findIndex((c) => c.id === partId);
            if (partOfIdx !== -1) {
              inheritanceDetails.push({
                genId: generalization.id,
                partOf: id,
              });
            }
          }
        }
        if (partIdex === -1) {
          const ontologyPathForPart = eachOntologyPath[partId] ?? [];

          const exacts = generalizationParts[0].nodes.filter((n) => {
            const findIndex = ontologyPathForPart.findIndex(
              (d) => d.id === n.id,
            );
            return findIndex !== -1;
          });
          if (exacts.length > 0) {
            inheritanceDetails.push({
              genId: generalization.id,
              partOf: exacts[0].id,
            });
          }
        }

        if (partIdex !== -1) {
          inheritanceDetails.push({
            genId: generalization.id,
            partOf: generalizationParts[0].nodes[partIdex].id,
          });
        }
      }
      if (inheritanceDetails.length > 0) {
        return inheritanceDetails;
      }
      return null;
    };

    if (parts) {
      for (let node of parts[0].nodes) {
        if (nodes[node.id]) {
          _inheritanceDetails[node.id] = checkGeneralizations(node.id);
        }
      }
    }
    setPartsInheritance(_inheritanceDetails);
  }, [currentVisibleNode, nodes]);

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
        <Box
          component="img"
          src="../loader.gif"
          alt="Loading..."
          sx={{ width: 200, height: 200, borderRadius: "25px" }}
        />
      </Box>
    );
  }

  return (
    <>
      <Head>
        <title>
          {currentVisibleNode ? currentVisibleNode.title : "1ontology"}
        </title>
      </Head>
      <Box>
        <Container
          style={{
            height: "100vh",
            display: "flex",
            overflow: "hidden",
            backgroundColor:
              theme.palette.mode === "dark" ? "#1b1a1a" : "#f8f9fa",
          }}
          columnResizerRef={columnResizerRef}
        >
          {!isMobile && (
            <Section
              minSize={0}
              defaultSize={500}
              style={{
                height: "100vh",
                overflow: "hidden",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                backgroundColor:
                  theme.palette.mode === "dark" ? "#303134" : "white",
                borderTopRightRadius: "25px",
                borderBottomRightRadius: "25px",
                borderStyle: "none solid none none",
              }}
            >
              <Tabs
                value={viewValue}
                onChange={handleViewChange}
                sx={{
                  width: "100%",
                  borderColor: "divider",
                  position: "absolute",
                  top: 76,
                  zIndex: 9,
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
                  marginTop: "156px",
                  flexGrow: 1,
                  overflow: "auto",
                  ...SCROLL_BAR_STYLE,
                  "&::-webkit-scrollbar": {
                    display: "none",
                  },
                }}
              >
                <TabPanel
                  value={viewValue}
                  index={0}
                  sx={{
                    height: "100%",
                    overflowX: "auto",
                    whiteSpace: "nowrap",
                    "&::-webkit-scrollbar": {
                      display: "none",
                    },
                  }}
                >
                  <Box
                    sx={{
                      display: "inline-block",
                      minWidth: "100%",
                    }}
                  >
                    <DraggableTree
                      treeViewData={treeViewData}
                      setSnackbarMessage={setSnackbarMessage}
                      treeRef={treeRef}
                      currentVisibleNode={currentVisibleNode}
                      nodes={nodes}
                      onOpenNodesTree={onOpenNodesTree}
                      eachOntologyPath={eachOntologyPath}
                      skillsFuture={skillsFuture}
                      specializationNumsUnder={specializationNumsUnder}
                      skillsFutureApp={appName}
                    />

                    {/*  <TreeViewSimplified
                      treeVisualization={treeVisualization}
                      onOpenNodesTree={onOpenNodesTree}
                      expandedNodes={expandedNodes}
                      setExpandedNodes={setExpandedNodes}
                      currentVisibleNode={currentVisibleNode}
                    /> */}
                  </Box>
                </TabPanel>
                <TabPanel value={viewValue} index={1}>
                  <GraphView
                    treeVisualization={treeVisualization}
                    setExpandedNodes={setExpandedNodes}
                    expandedNodes={expandedNodes}
                    onOpenNodeDagre={onOpenNodeDagre}
                    currentVisibleNode={currentVisibleNode}
                    // nodes={nodes}
                  />
                </TabPanel>
              </Box>

              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  width: "100%",
                }}
              >
                {" "}
                {skillsFuture && (
                  <Box sx={{ m: "10px" }}>
                    <FormControl
                      variant="outlined"
                      sx={{ borderRadius: "20px" }}
                      fullWidth
                    >
                      <InputLabel id="property-type-label">
                        Which Ontology
                      </InputLabel>
                      <Select
                        labelId="property-type-label"
                        value={appName}
                        onChange={(event) => {
                          setNodes({});
                          const app = event.target.value.replaceAll(" ", "_");
                          router.replace(`/${app}`);
                        }}
                        label="Property Type"
                        sx={{ borderRadius: "20px" }}
                      >
                        {SKILLS_FUTURE_APP_NAMES.map(({ id, name }) => (
                          <MenuItem key={id} value={id}>
                            {name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                )}
                <SearchSideBar
                  openSearchedNode={openSearchedNode}
                  searchWithFuse={searchWithFuse}
                  lastSearches={lastSearches}
                  updateLastSearches={updateLastSearches}
                  skillsFuture={skillsFuture}
                  skillsFutureApp={appName}
                />
              </Box>
            </Section>
          )}

          <Bar
            size={0.1}
            style={{
              background: "transparent",
              cursor: "col-resize",
              position: "relative",
              borderRadius: "4px",
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
                borderRadius: "50%",
                ":hover": {
                  backgroundColor: "orange",
                },
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
                "&::-webkit-scrollbar": {
                  display: "none",
                },
              }}
            >
              <Box ref={scrolling}></Box>
              {displayGuidelines && (
                <GuidLines setDisplayGuidelines={setDisplayGuidelines} />
              )}
              {currentVisibleNode && user && !displayGuidelines && (
                <Node
                  currentVisibleNode={
                    currentImprovement?.node || currentVisibleNode
                  }
                  setCurrentVisibleNode={setCurrentVisibleNode}
                  setSnackbarMessage={setSnackbarMessage}
                  user={user}
                  mainSpecializations={mainSpecializations}
                  nodes={nodes}
                  navigateToNode={navigateToNode}
                  eachOntologyPath={eachOntologyPath}
                  searchWithFuse={searchWithFuse}
                  locked={!!currentVisibleNode.locked && !user?.manageLock}
                  selectedDiffNode={selectedDiffNode}
                  displaySidebar={displaySidebar}
                  activeSidebar={activeSidebar}
                  currentImprovement={currentImprovement}
                  setNodes={setNodes}
                  checkedItems={checkedItems}
                  setCheckedItems={setCheckedItems}
                  checkedItemsCopy={checkedItemsCopy}
                  setCheckedItemsCopy={setCheckedItemsCopy}
                  searchValue={searchValue}
                  setSearchValue={setSearchValue}
                  clonedNodesQueue={clonedNodesQueue}
                  setClonedNodesQueue={setClonedNodesQueue}
                  newOnes={newOnes}
                  setNewOnes={setNewOnes}
                  loadingIds={loadingIds}
                  setLoadingIds={setLoadingIds}
                  selectedProperty={selectedProperty}
                  setSelectedProperty={setSelectedProperty}
                  removedElements={removedElements}
                  setRemovedElements={setRemovedElements}
                  addedElements={addedElements}
                  setAddedElements={setAddedElements}
                  handleCloseAddLinksModel={handleCloseAddLinksModel}
                  setSelectedCollection={setSelectedCollection}
                  selectedCollection={selectedCollection}
                  skillsFuture={skillsFuture}
                  partsInheritance={partsInheritance}
                  enableEdit={enableEdit}
                  setEnableEdit={setEnableEdit}
                  inheritanceDetails={partsInheritance}
                  skillsFutureApp={appName ?? null}
                  editableProperty={editableProperty}
                  setEditableProperty={setEditableProperty}
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
            lastSearches={lastSearches}
            updateLastSearches={updateLastSearches}
            selectedChatTab={selectedChatTab}
            setSelectedChatTab={setSelectedChatTab}
            displayGuidelines={displayGuidelines}
            signOut={signOut}
            skillsFuture={skillsFuture}
            skillsFutureApp={appName ?? null}
          />
        </Container>
        {ConfirmDialog}
        <SneakMessage
          newMessage={snackbarMessage}
          setNewMessage={setSnackbarMessage}
        />
      </Box>
    </>
  );
};
export default Ontology;
