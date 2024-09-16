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
import SearchIcon from "@mui/icons-material/Search";
import SettingsEthernetIcon from "@mui/icons-material/SettingsEthernet";
import {
  Badge,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Link,
  List,
  ListItem,
  Modal,
  Paper,
  Popper,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import {
  DocumentReference,
  Timestamp,
  WriteBatch,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import Fuse from "fuse.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// import markdownContent from "../components/OntologyComponents/Markdown-Here-Cheatsheet.md";
import SneakMessage from " @components/components/OntologyComponents/SneakMessage";
import Node from " @components/components/OntologyComponents/Node";
import TreeViewSimplified from " @components/components/OntologyComponents/TreeViewSimplified";
import {
  ILockedNode,
  INode,
  INodePath,
  INodeTypes,
  MainSpecializations,
  TreeVisual,
} from " @components/types/INode";
import { TabPanel, a11yProps } from " @components/lib/utils/TabPanel";
import MarkdownRender from " @components/components/Markdown/MarkdownRender";
import AppHeaderMemoized from " @components/components/Header/AppHeader";
import { newId } from " @components/lib/utils/newFirestoreId";
import { DESIGN_SYSTEM_COLORS } from " @components/lib/theme/colors";
import useConfirmDialog from " @components/lib/hooks/useConfirmDialog";
import withAuthUser from " @components/components/hoc/withAuthUser";
import { useAuth } from " @components/components/context/AuthContext";
import { useRouter } from "next/router";
import DagGraph from " @components/components/OntologyComponents/DAGGraph";
import { SCROLL_BAR_STYLE } from " @components/lib/CONSTANTS";
import {
  LOCKS,
  LOGS,
  NODES,
  USERS,
} from " @components/lib/firestoreClient/collections";
import {
  getBrowser,
  getOperatingSystem,
} from " @components/lib/firestoreClient/errors.firestore";
import Inheritance from " @components/components/Inheritance/Inheritance";
import useSelectDialog from " @components/lib/hooks/useSelectDialog";
import Chat from " @components/components/Chat/Chat";
import { IChat, INotification } from " @components/types/IChat";
import {
  chatChange,
  getMessagesSnapshot,
} from "../client/firestore/messages.firestore";
import { SearchBox } from " @components/components/SearchBox/SearchBox";
import { getNotificationsSnapshot } from " @components/client/firestore/notifications.firestore";
import { Notification } from " @components/components/Chat/Notification";

const synchronizeStuff = (prev: (any & { id: string })[], change: any) => {
  const docType = change.type;
  const curData = change.data as any & { id: string };

  const prevIdx = prev.findIndex(
    (m: any & { id: string }) => m.id === curData.id
  );
  if (docType === "added" && prevIdx === -1) {
    prev.push(curData);
  }
  if (docType === "modified" && prevIdx !== -1) {
    prev[prevIdx] = curData;
  }

  if (docType === "removed" && prevIdx !== -1) {
    prev.splice(prevIdx, 1);
  }
  prev.sort(
    (a, b) => a.createdAt.toDate().getTime() - b.createdAt.toDate().getTime()
  );
  return prev;
};

const Ontology = () => {
  const db = getFirestore();
  const [{ emailVerified, user }] = useAuth();
  const router = useRouter();
  const isMobile = useMediaQuery("(max-width:599px)") && true;
  const [nodes, setNodes] = useState<{ [id: string]: INode }>({});
  const [currentVisibleNode, setCurrentVisibleNode] = useState<INode | null>(
    null
  );
  const [ontologyPath, setOntologyPath] = useState<INodePath[]>([]);
  const [snackbarMessage, setSnackbarMessage] = useState<string>("");
  const [treeVisualization, setTreeVisualization] = useState<TreeVisual>({});
  const [editNode, setEditNode] = useState<string>("");
  const [newComment, setNewComment] = useState("");
  const [updateComment, setUpdateComment] = useState("");
  const { confirmIt, ConfirmDialog } = useConfirmDialog();
  const { selectIt, selectDialog } = useSelectDialog();
  const [editingComment, setEditingComment] = useState("");
  const [lockedNodeFields, setLockedNodeFields] = useState<ILockedNode>({});
  const [sidebarView, setSidebarView] = useState<number>(1);
  const [selectedChatTab, setSelectedChatTab] = useState<number>(1);
  const [viewValue, setViewValue] = useState<number>(0);
  const [searchValue, setSearchValue] = useState("");
  const fuse = new Fuse(Object.values(nodes), { keys: ["title"] });
  const headerRef = useRef<HTMLHeadElement | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [dagreZoomState, setDagreZoomState] = useState<any>(null);
  const [rightPanelVisible, setRightPanelVisible] = useState<any>(false);
  const [users, setUsers] = useState<
    {
      id: string;
      display: string;
      uname: string;
      fullName: string;
      imageUrl: string;
    }[]
  >([]);
  const [eachOntologyPath, setEachOntologyPath] = useState<{
    [key: string]: any;
  }>({});
  const columnResizerRef = useRef<any>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [nodeMessages, setNodeMessages] = useState<IChat[]>([]);
  const [bugReportMessages, setBugReportMessages] = useState<IChat[]>([]);
  const [featureRequestMessages, setFeatureRequestMessages] = useState<IChat[]>(
    []
  );
  const [helpMessages, setHelpMessages] = useState<IChat[]>([]);
  const [openSelectModel, setOpenSelectModel] = useState(false);
  const [notifications, setNotifications] = useState<INotification[]>([]);

  //last interaction date from the user
  const [lastInteractionDate, setLastInteractionDate] = useState<Date>(
    new Date(Date.now())
  );

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
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  const [openNotificationSection, setOpenNotificationSection] =
    useState<boolean>(false);

  useEffect(() => {
    if (!user) return;
    if (!currentVisibleNode?.id) return;
    setIsLoading(true);
    setNodeMessages([]);
    const onSynchronize = (changes: chatChange[]) => {
      setNodeMessages((prev) => changes.reduce(synchronizeStuff, [...prev]));
      setIsLoading(false);
    };
    const killSnapshot = getMessagesSnapshot(
      db,
      { nodeId: currentVisibleNode?.id, type: "node", lastVisible: null },
      onSynchronize
    );
    return () => killSnapshot();
  }, [db, user, currentVisibleNode?.id]);

  useEffect(() => {
    if (!user) return;
    setBugReportMessages([]);
    setFeatureRequestMessages([]);
    setHelpMessages([]);
    const onSynchronize = (changes: chatChange[]) => {
      setBugReportMessages((prev) =>
        changes.reduce(synchronizeStuff, [...prev])
      );
    };
    const killSnapshot = getMessagesSnapshot(
      db,
      { type: "bug_report", lastVisible: null },
      onSynchronize
    );

    const onFeatureRequestSynchronize = (changes: chatChange[]) => {
      setFeatureRequestMessages((prev) =>
        changes.reduce(synchronizeStuff, [...prev])
      );
    };
    const killFeatureRequestSnapshot = getMessagesSnapshot(
      db,
      { type: "feature_request", lastVisible: null },
      onFeatureRequestSynchronize
    );

    const onHelSynchronize = (changes: chatChange[]) => {
      setHelpMessages((prev) => changes.reduce(synchronizeStuff, [...prev]));
    };
    const killHelpSnapshot = getMessagesSnapshot(
      db,
      { type: "help", lastVisible: null },
      onHelSynchronize
    );

    return () => {
      killSnapshot();
      killFeatureRequestSnapshot();
      killHelpSnapshot();
    };
  }, [db, user]);

  useEffect(() => {
    if (!user) return;
    setNotifications([]);
    const onSynchronize = (changes: chatChange[]) => {
      setNotifications((prev) => changes.reduce(synchronizeStuff, [...prev]));
    };
    const killSnapshot = getNotificationsSnapshot(
      db,
      { uname: user.uname, lastVisible: null },
      onSynchronize
    );
    return () => killSnapshot();
  }, [db, user]);

  useEffect(() => {
    (async () => {
      if (!db) return;
      const usersQuery = query(collection(db, USERS));
      const usersDocs = await getDocs(usersQuery);
      const _users: any = [];
      usersDocs.docs.forEach((userDoc: any) => {
        _users.push({
          id: userDoc.data().uname,
          display: `${userDoc.data().fName} ${userDoc.data().lName}`,
          uname: userDoc.data().uname,
          fullName: `${userDoc.data().fName} ${userDoc.data().lName}`,
          imageUrl: userDoc.data().imageUrl,
        });
      });
      setUsers(_users);
    })();
  }, [db]);

  const recordLogs = async (logs: any) => {
    try {
      if (!user) return;
      const logRef = doc(collection(db, LOGS));

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");

      const doerCreate = `${user?.uname}-${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
      await setDoc(logRef, {
        ...logs,
        createdAt: new Date(),
        doer: user?.uname,
        operatingSystem: getOperatingSystem(),
        browser: getBrowser(),
        doerCreate,
      });
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (!user) return;

    const userQuery = query(
      collection(db, LOGS),
      where("__name__", "==", "00EWFECw1PnBRPy4wZVt")
    );

    const unsubscribeUser = onSnapshot(userQuery, (snapshot) => {
      const docChange = snapshot.docChanges()[0];
      if (docChange.type !== "added") {
        window.location.reload();
      }
    });

    return () => unsubscribeUser();
  }, [db, user, nodes]);

  const updateTheUrl = (path: INodePath[]) => {
    let newHash = "";
    path.forEach((p: any) => (newHash = newHash + `#${p.id.trim()}`));
    window.location.hash = newHash;
  };

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
        updateUserDoc(eachOntologyPath[visibleNodeId]);
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

  useEffect(() => {
    setViewValue(1);
    setTimeout(() => {
      setViewValue(0);
    }, 200);
  }, [user]);

  useEffect(() => {
    if (!searchValue) return;
    // Record logs for the search action
    recordLogs({
      action: "Searched",
      query,
    });
  }, [searchValue]);

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
          !item.deleted && (!nodeType || nodeType === item.nodeType)
      );
  };
  const searchResults = useMemo(() => {
    return searchWithFuse(searchValue);
  }, [searchValue]);

  const handleChange = (event: any, newValue: number) =>
    setSidebarView(newValue);

  const handleChatTabsChange = (event: any, newValue: number) =>
    setSelectedChatTab(newValue);

  const handleViewChange = (event: any, newValue: number) =>
    setViewValue(newValue);

  // This function finds the path of a node in a nested structure of mainNodes and their children.
  const findOntologyPath = useCallback(
    ({
      mainNodes,
      path,
      eachOntologyPath,
    }: {
      mainNodes: INode[];
      path: any;
      eachOntologyPath: any;
    }) => {
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

        // Loop through categories in the children of the current node

        for (let category in node.specializations) {
          // Filter nodes based on their inclusion in the specializations of the current category
          const childrenIds = node.specializations[category].map(
            (n: any) => n.id
          );
          const children = [];

          for (let childId of childrenIds) {
            children.push(nodes[childId]);
          }

          const subPath = [...path];

          subPath.push({
            title: node.title,
            id: !!node.category ? `${node.id}-${node.title.trim()}` : node.id,
            category: !!node.category,
          });
          if (category !== "main") {
            subPath.push({
              title: category,
              id: `${node.id}-${category.trim()}`,
              category: true,
            });
          }
          // Recursively call the findOntologyPath function for the filtered specializations
          eachOntologyPath = findOntologyPath({
            mainNodes: children,
            path: [...subPath],
            eachOntologyPath,
          });
        }
      }

      // Return the accumulated ontology paths
      return eachOntologyPath;
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
      setEachOntologyPath(eachOntologyPath);
    }
  }, [nodes]);
  useEffect(() => {
    const controller = columnResizerRef.current;

    if (controller) {
      const resizer = controller.getResizer();
      resizer.resizeSection(2, { toSize: rightPanelVisible ? 400 : 0 });
      controller.applyResizer(resizer);
    }
  }, [rightPanelVisible, user]);

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
  // Function to generate a tree structure of specializations based on main nodes
  const getSpecializationsTree = (_nodes: INode[], path: any) => {
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
        title: nodeTitle,
        specializations: {},
      };

      // Iterate through each category in the specializations child-nodes
      for (let category in node.specializations) {
        // Filter nodes based on the current category
        const specializations = [];
        const arrayNodes = node?.specializations[category].map(
          (o: any) => o.id
        );
        for (let nId of arrayNodes) {
          specializations.push(nodes[nId]);
        }

        // Check if the category is the main category
        if (category === "main") {
          // If main, update the main specializations entry with recursive call
          newSpecializationsTree[nodeTitle] = {
            id: node.category ? `${node.id}-${nodeTitle.trim()}` : node.id,
            path: [...path, node.id],
            isCategory: !!node.category,
            title: nodeTitle,
            specializations: {
              ...(newSpecializationsTree[nodeTitle]?.specializations || {}),
              ...getSpecializationsTree(specializations, [...path, node.id]),
            },
          };
        } else {
          // If not main, create a new entry for the category
          newSpecializationsTree[nodeTitle] = {
            id: node.id,
            path: [...path, node.id],
            title: nodeTitle,
            c: node.category,
            specializations: {
              ...(newSpecializationsTree[nodeTitle]?.specializations || {}),
              [category]: {
                isCategory: true,
                id: `${node.id}-${category.trim()}`, // Assuming newId and db are defined elsewhere
                title: category,
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
    // Check if user or nodes are not available
    if (!user) return;
    if (!Object.keys(nodes).length) return;

    // Query the database for the user based on userId
    const userQuery = query(
      collection(db, USERS),
      where("userId", "==", user.userId)
    );

    // Set up a snapshot listener for changes in the user data
    const unsubscribeUser = onSnapshot(userQuery, (snapshot) => {
      // Get the first document change from the snapshot
      const docChange = snapshot.docChanges()[0];

      // Get the data from the document change
      const dataChange = docChange.doc.data();

      // Set the ontologyPath in the component state
      setOntologyPath(dataChange?.ontologyPath || []);

      //update the expanded nodes state
      if (docChange.type === "added") {
        initializeExpanded(dataChange?.ontologyPath || []);
        // Get the last ontology in the ontologyPath or an empty string if none
        const lastNode = dataChange?.ontologyPath
          ? [...dataChange?.ontologyPath]?.reverse()[0] || ""
          : "";
        // If the node is found, set it as the open node in the component state
        if (nodes[lastNode.id]) setCurrentVisibleNode(nodes[lastNode.id]);
      }
      // Update the URL based on the ontologyPath
      updateTheUrl(dataChange?.ontologyPath || []);
    });

    // Cleanup function: Unsubscribe from the user data snapshot listener
    return () => unsubscribeUser();
  }, [db, user, nodes]);

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

  const initializeExpanded = (ontologyPath: INodePath[]) => {
    const newExpandedSet: Set<string> = new Set();
    for (let node of ontologyPath) {
      newExpandedSet.add(node.id);
    }
    setExpandedNodes(newExpandedSet);
  };

  // Callback function to handle navigation when a link is clicked
  const handleLinkNavigation = useCallback(
    async (path: { id: string; title: string }, type: string) => {
      try {
        // Check if user is logged in and node is open
        if (!user || !currentVisibleNode) return;
        if (nodes[path.id]) {
          setCurrentVisibleNode(nodes[path.id]);
        }
        // Update ontology path and user document
        let _ontologyPath = [...ontologyPath];
        const pathIdx = _ontologyPath.findIndex((p: any) => p.id === path.id);
        if (pathIdx !== -1) {
          _ontologyPath = _ontologyPath.slice(0, pathIdx + 1);
        } else {
          _ontologyPath.push(path);
        }

        await updateUserDoc([..._ontologyPath]);
      } catch (error) {
        console.error(error);
      }
    },
    [nodes, ontologyPath]
  );

  // Function to update the user document with the current ontology path
  const updateUserDoc = async (ontologyPath: INodePath[]) => {
    if (!user) return;
    const userRef = doc(collection(db, USERS), user.uname);
    // Update the user document with the ontology path
    if (ontologyPath) {
      await updateDoc(userRef, { ontologyPath });

      // Record logs if ontology path is not empty
      if (ontologyPath.length > 0) {
        await recordLogs({
          action: "Opened a page",
          page: ontologyPath[ontologyPath.length - 1],
        });
      }
    }
  };

  // Callback function to add a new node to the database
  const addNewNode = useCallback(
    async ({ id, newNode }: { id: string; newNode: any }) => {
      try {
        // Reference to the new node document
        const newNodeRef = doc(collection(db, NODES), id);
        // Set the document with the new node data
        await setDoc(newNodeRef, {
          ...newNode,
          deleted: false,
          createdAt: new Date(),
        });

        // Record logs for the created node
        await recordLogs({
          action: "Created a field",
          field: newNode.nodeType,
        });

        // Set the newly created node as editable
        setEditNode(id);
      } catch (error) {
        console.error(error);
      }
    },
    [nodes]
  );

  // Define a callback function to handle the opening of the ontology DAGRE view.
  const onOpenNodeDagre = useCallback(
    async (nodeId: string) => {
      // Check if a user is logged in, if not, exit the function.
      if (!user) return;

      // Find the index of the node with the specified ID in the ontologies array.

      // Check if the node with the specified ID exists and is not a main node (no category).
      if (nodes[nodeId] && !nodes[nodeId].category) {
        // Set the currentVisibleNode as the currently selected node.
        setCurrentVisibleNode(nodes[nodeId]);

        // Record logs for the action of opening the DAGRE view for the node.
        await recordLogs({
          action: "opened dagre-view",
          itemClicked: nodes[nodeId].id,
        });

        // Update the user document with the ontology path.
        await updateUserDoc([
          ...(eachOntologyPath[nodeId] || [
            {
              id: nodeId,
              title: nodes[nodeId].title,
              category: !!nodes[nodeId].category,
            },
          ]),
        ]);
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
          newExpanded.delete(nodeId); // Remove the nodeId if it exists
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
        await recordLogs({
          action: "clicked tree-view",
          itemClicked: nodes[nodeId].id,
        });

        // Update user document with the path
        const path = eachOntologyPath[nodeId] || [];
        await updateUserDoc(path);
      }
    },
    [nodes, user, eachOntologyPath]
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

    // Include specializations for "Actor" category
    mainSpecializations = {
      ...mainSpecializations,
      ...(mainSpecializations["actor"]?.specializations || {}),
    };
    for (let type in mainSpecializations) {
      mainSpecializations[type.toLowerCase()] = mainSpecializations[type];
      delete mainSpecializations[type];
    }
    return mainSpecializations;
  };

  // This function is called when a search result node is clicked.
  const openSearchedNode = (node: any) => {
    try {
      // Set the clicked node as the open currentVisibleNode
      setCurrentVisibleNode(node);

      // Record the click action in logs
      recordLogs({
        action: "Search result clicked",
        clicked: node.id,
      });

      // Update the user document with the ontology path
      updateUserDoc([
        ...(eachOntologyPath[node.id] || [
          { title: node.title, id: node.id, category: node.category },
        ]),
      ]);
    } catch (error) {
      console.error(error);
    }
  };
  interface UpdateInheritanceParams {
    nodeId: string;
    updatedProperty: string;
  }
  // Function to handle inheritance
  const updateInheritance = async ({
    nodeId,
    updatedProperty,
  }: UpdateInheritanceParams): Promise<void> => {
    try {
      const batch = writeBatch(db);

      const nodeRef = doc(collection(db, NODES), nodeId);
      updateDoc(nodeRef, {
        [`inheritance.${updatedProperty}.ref`]: null,
      });

      // Recursively update specializations
      await recursivelyUpdateSpecializations({
        nodeId: nodeId,
        updatedProperty,
        batch,
        generalizationId: nodeId,
      });
      // Commit all updates as a batch
      await batch.commit();
    } catch (error) {
      console.log(error);
    }
  };

  // Helper function to recursively update specializations
  const recursivelyUpdateSpecializations = async ({
    nodeId,
    updatedProperty,
    batch,
    nestedCall = false,
    inheritanceType,
    generalizationId,
  }: {
    nodeId: string;
    updatedProperty: string;
    batch: WriteBatch;
    nestedCall?: boolean;
    inheritanceType?:
      | "inheritUnlessAlreadyOverRidden"
      | "inheritAfterReview"
      | "alwaysInherit";
    generalizationId: string;
  }): Promise<void> => {
    // Fetch node data from Firestore
    const nodeRef = doc(collection(db, NODES), nodeId);
    const nodeSnapshot = await getDoc(nodeRef);
    const nodeData = nodeSnapshot.data() as INode;

    if (!nodeData || !nodeData.properties.hasOwnProperty(updatedProperty))
      return;

    // Get the inheritance type for the updated property
    const inheritance = nodeData.inheritance[updatedProperty];
    const canInherit =
      (inheritanceType === "inheritUnlessAlreadyOverRidden" &&
        inheritance.ref) ||
      inheritanceType === "alwaysInherit";

    if (nestedCall && canInherit) {
      await updateProperty(batch, nodeRef, updatedProperty, generalizationId);
    }

    if (inheritance?.inheritanceType === "neverInherit") {
      return;
    }
    let specializations = Object.values(nodeData.specializations).flat() as {
      id: string;
      title: string;
    }[];

    if (inheritance?.inheritanceType === "inheritAfterReview") {
      /*   specializations = (await selectIt(
        <Box sx={{ mb: "15px" }}>
          <Typography>
            Select which of the following specializations should inherit the
            change that you just made to the property{" "}
            <strong>{updatedProperty}</strong>,
          </Typography>
          <Typography>{"After you're done click continue."}</Typography>
        </Box>,
        specializations,
        "Continue",
        ""
      )) as {
        id: string;
        title: string;
      }[]; */
    }
    if (specializations.length <= 0) {
      return;
    }
    for (const specialization of specializations) {
      await recursivelyUpdateSpecializations({
        nodeId: specialization.id,
        updatedProperty,
        batch,
        nestedCall: true,
        inheritanceType: inheritance.inheritanceType,
        generalizationId,
      });
    }
  };

  // Function to update a property in Firestore using a batch commit
  const updateProperty = async (
    batch: any,
    nodeRef: DocumentReference,
    updatedProperty: string,
    inheritanceRef: string
  ) => {
    const updateData = {
      [`inheritance.${updatedProperty}.ref`]: inheritanceRef,
    };
    batch.update(nodeRef, updateData);
    if (batch._mutations.length > 10) {
      await batch.commit();
      batch = writeBatch(db);
    }
  };

  useEffect(() => {
    const handleUserActivity = () => {
      setLastInteractionDate(new Date(Date.now()));
      if (user) {
        const userDocRef = doc(collection(db, USERS), user.uname);
        // updateDoc(userDocRef, {
        //   lastInteracted: Timestamp.now(),
        // });
      }
    };

    window.addEventListener("mousemove", handleUserActivity);
    window.addEventListener("keydown", handleUserActivity);

    return () => {
      window.removeEventListener("mousemove", handleUserActivity);
      window.removeEventListener("keydown", handleUserActivity);
    };
  }, []);

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
    updateUserDoc(eachOntologyPath[nodeId] || []);
    if (nodes[nodeId]) {
      setCurrentVisibleNode(nodes[nodeId]);
    }
  };

  const handleClose = useCallback(() => {
    setOpenSelectModel(false);
  }, [setOpenSelectModel]);

  const sendNode = useCallback(
    async (nodeId: string, title: string) => {
      if (!user) return;
      const messageData = {
        nodeId: "",
        text: title,
        sender: user.uname,
        senderDetail: {
          uname: user.uname,
          fullname: user.fName + " " + user.lName,
          imageUrl: user.imageUrl,
          uid: user.userId,
        },
        imageUrls: [],
        reactions: [],
        edited: false,
        deleted: false,
        totalReplies: 0,
        type: ["node", "technical", "other"][selectedChatTab],
        messageType: "node",
        sharedNodeId: nodeId,
        createdAt: new Date(),
      };
      await addDoc(collection(db, "messages"), messageData);
    },
    [selectedChatTab]
  );

  const openNotification = useCallback(
    (
      notificationId: string,
      messageId: string,
      type: string,
      nodeId?: string
    ) => {
      const notificationRef = doc(db, "notifications", notificationId);
      updateDoc(notificationRef, {
        seen: true,
      });
      recordLogs({
        action: "Opened a notification",
        notificationId,
        page: ontologyPath[ontologyPath.length - 1],
      });
      if (type === "node" && nodeId) {
        setCurrentVisibleNode(nodes[nodeId]);
      }
      setSelectedChatTab(
        ["node", "bug_report", "feature_request", "help"].indexOf(type)
      );
      setOpenNotificationSection(false);
      setAnchor(null);
      setTimeout(
        () => {
          const element = document.getElementById(`message-${messageId}`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            element.style.border = `solid 1px ${DESIGN_SYSTEM_COLORS.orange400}`;
            setTimeout(() => {
              element.style.border = "none";
            }, 1000);
          }
        },
        type === "node" ? 2000 : 1000
      );
    },
    [db, user]
  );

  const handleNotificationPopup = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      setAnchor(anchor ? null : event.currentTarget);
      setOpenNotificationSection(!openNotificationSection);
    },
    [anchor, openNotificationSection]
  );

  const handleSearch = useCallback(() => {
    setSidebarView(0);
    setRightPanelVisible(true);
  }, [setSidebarView, setRightPanelVisible]);

  const handleChat = useCallback(() => {
    setSidebarView(1);
    setRightPanelVisible(true);
  }, [setSidebarView, setRightPanelVisible]);

  return (
    <Box>
      {Object.keys(nodes).length > 0 ? (
        <Container
          style={{
            marginTop: "80px",
            height: "calc(100vh - 80px)",
            display: "flex",
          }}
          columnResizerRef={columnResizerRef}
        >
          {!isMobile && (
            <Section
              minSize={0}
              defaultSize={500}
              style={{
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Box
                sx={{
                  backgroundColor: (theme: any) =>
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
                    label="Tree View"
                    {...a11yProps(0)}
                    sx={{ width: "50%", fontSize: "20px" }}
                  />
                  <Tab
                    label="DAG View"
                    {...a11yProps(1)}
                    sx={{ width: "50%", fontSize: "20px" }}
                  />
                </Tabs>

                <Box
                  sx={{
                    height: "85vh",
                    flexGrow: 1,
                    overflow: "auto",
                    ...SCROLL_BAR_STYLE,
                  }}
                >
                  <TabPanel
                    value={viewValue}
                    index={0}
                    sx={{
                      mt: "5px",
                    }}
                  >
                    <TreeViewSimplified
                      treeVisualization={treeVisualization}
                      onOpenNodesTree={onOpenNodesTree}
                      expandedNodes={expandedNodes}
                      currentVisibleNode={currentVisibleNode}
                    />
                  </TabPanel>
                  <TabPanel value={viewValue} index={1}>
                    <DagGraph
                      treeVisualization={treeVisualization}
                      setExpandedNodes={setExpandedNodes}
                      expandedNodes={expandedNodes}
                      setDagreZoomState={setDagreZoomState}
                      dagreZoomState={dagreZoomState}
                      onOpenNodeDagre={onOpenNodeDagre}
                      currentVisibleNode={currentVisibleNode}
                    />
                  </TabPanel>
                </Box>
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
              sx={{
                backgroundColor: (theme) =>
                  theme.palette.mode === "dark"
                    ? theme.palette.common.notebookMainBlack
                    : theme.palette.common.gray50,
                p: "20px",
                overflow: "auto",
                height: "94vh",
                ...SCROLL_BAR_STYLE,
              }}
            >
              <Breadcrumbs sx={{ ml: "40px", mt: "14px" }}>
                {ontologyPath.map((path) => (
                  <Link
                    underline={path.category ? "none" : "hover"}
                    key={path.id}
                    onClick={() => {
                      if (!path.category) handleLinkNavigation(path, "");
                    }}
                    sx={{
                      cursor: !path.category ? "pointer" : "",
                      ":hover": {
                        cursor: !path.category ? "pointer" : "",
                      },
                      fontSize: path.category ? "15px" : "20px",
                      color: path.category
                        ? "orange"
                        : (theme) =>
                            theme.palette.mode === "dark"
                              ? theme.palette.common.white
                              : theme.palette.common.black,
                    }}
                  >
                    {path.title.split(" ").splice(0, 3).join(" ") +
                      (path.title.split(" ").length > 3 ? "..." : "")}
                  </Link>
                ))}
              </Breadcrumbs>

              {currentVisibleNode && (
                <Node
                  currentVisibleNode={currentVisibleNode}
                  setCurrentVisibleNode={setCurrentVisibleNode}
                  handleLinkNavigation={handleLinkNavigation}
                  setOntologyPath={setOntologyPath}
                  ontologyPath={ontologyPath}
                  setSnackbarMessage={setSnackbarMessage}
                  updateUserDoc={updateUserDoc}
                  user={user}
                  mainSpecializations={getMainSpecializations(
                    treeVisualization
                  )}
                  nodes={nodes}
                  addNewNode={addNewNode}
                  editNode={editNode}
                  setEditNode={setEditNode}
                  lockedNodeFields={lockedNodeFields}
                  recordLogs={recordLogs}
                  updateInheritance={updateInheritance}
                  navigateToNode={navigateToNode}
                  eachOntologyPath={eachOntologyPath}
                  searchWithFuse={searchWithFuse}
                />
              )}
            </Box>
          </Section>

          <Bar
            size={2}
            style={{
              background: "currentColor",
              cursor: "col-resize",
              position: "relative",
              display: rightPanelVisible ? "block" : "none",
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

          {!isMobile && (
            <Section minSize={0} defaultSize={400}>
              <Box sx={{ width: "100%" }}>
                <Box
                  sx={{
                    borderColor: "divider",
                    position: "sticky",
                  }}
                >
                  <Tabs
                    id="right-panel-tabs"
                    value={sidebarView}
                    onChange={handleChange}
                    aria-label="basic tabs example"
                    variant="scrollable"
                    sx={{
                      background: (theme) =>
                        theme.palette.mode === "dark" ? "#242425" : "#d0d5dd",
                      ".MuiTab-root.Mui-selected": {
                        color: "#ff6d00",
                      },
                    }}
                  >
                    <Tab label="Search" {...a11yProps(1)} />
                    <Tab label="Chat" {...a11yProps(0)} />
                    <Tab label="Inheritance" {...a11yProps(2)} />
                    <Tab label="Markdown Cheatsheet" {...a11yProps(3)} />
                  </Tabs>
                </Box>
                <Box
                  sx={{
                    // padding: "10px",
                    height: "89vh",
                    overflow: "auto",
                    pb: "125px",
                    backgroundColor: (theme: any) =>
                      theme.palette.mode === "dark" ? "#303134" : "white",
                    ...SCROLL_BAR_STYLE,
                  }}
                >
                  <TabPanel value={sidebarView} index={0}>
                    <Box sx={{ pl: "10px" }}>
                      <TextField
                        variant="standard"
                        placeholder="Search..."
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        fullWidth
                        InputProps={{
                          startAdornment: (
                            <IconButton
                              sx={{ mr: "5px", cursor: "auto" }}
                              color="primary"
                              edge="end"
                            >
                              <SearchIcon />
                            </IconButton>
                          ),
                        }}
                        autoFocus
                        sx={{
                          p: "8px",
                          mt: "5px",
                        }}
                      />
                      <List>
                        {searchResults.map((node: any) => (
                          <ListItem
                            key={node.id}
                            onClick={() => openSearchedNode(node)}
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              color: "white",
                              cursor: "pointer",
                              borderRadius: "4px",
                              padding: "8px",
                              transition: "background-color 0.3s",
                              // border: "1px solid #ccc",
                              mt: "5px",
                              "&:hover": {
                                backgroundColor: (theme) =>
                                  theme.palette.mode === "dark"
                                    ? DESIGN_SYSTEM_COLORS.notebookG450
                                    : DESIGN_SYSTEM_COLORS.gray200,
                              },
                            }}
                          >
                            <Typography>{node.title}</Typography>
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  </TabPanel>
                  <TabPanel value={sidebarView} index={1}>
                    <Box sx={{}}>
                      <Tabs
                        id="chat-tabs"
                        value={selectedChatTab}
                        onChange={handleChatTabsChange}
                        aria-label="basic tabs example"
                        variant="scrollable"
                        sx={{
                          background: (theme) =>
                            theme.palette.mode === "dark"
                              ? "#000000"
                              : "#c3c3c3",
                          ".MuiTab-root.Mui-selected": {
                            color: "#ff6d00",
                          },
                        }}
                      >
                        <Tab label="This node" {...a11yProps(0)} />
                        <Tab label="Bug Reports" {...a11yProps(1)} />
                        <Tab label="Feature Requests" {...a11yProps(2)} />
                        <Tab label="Help" {...a11yProps(3)} />
                      </Tabs>
                      <Box>
                        <TabPanel value={selectedChatTab} index={0}>
                          {currentVisibleNode?.id && (
                            <Chat
                              user={user}
                              messages={nodeMessages}
                              setMessages={setNodeMessages}
                              type="node"
                              nodeId={currentVisibleNode?.id}
                              users={users}
                              firstLoad={true}
                              isLoading={isLoading}
                              confirmIt={confirmIt}
                              setOpenSelectModel={setOpenSelectModel}
                              recordLogs={recordLogs}
                            />
                          )}
                        </TabPanel>
                        <TabPanel value={selectedChatTab} index={1}>
                          <Chat
                            user={user}
                            messages={bugReportMessages}
                            setMessages={setBugReportMessages}
                            type="bug_report"
                            users={users}
                            firstLoad={true}
                            isLoading={false}
                            confirmIt={confirmIt}
                            setOpenSelectModel={setOpenSelectModel}
                            recordLogs={recordLogs}
                          />
                        </TabPanel>
                        <TabPanel value={selectedChatTab} index={2}>
                          <Chat
                            user={user}
                            messages={featureRequestMessages}
                            setMessages={setFeatureRequestMessages}
                            type="feature_request"
                            users={users}
                            firstLoad={true}
                            isLoading={false}
                            confirmIt={confirmIt}
                            setOpenSelectModel={setOpenSelectModel}
                            recordLogs={recordLogs}
                          />
                        </TabPanel>
                        <TabPanel value={selectedChatTab} index={3}>
                          <Chat
                            user={user}
                            messages={helpMessages}
                            setMessages={setHelpMessages}
                            type="help"
                            users={users}
                            firstLoad={true}
                            isLoading={false}
                            confirmIt={confirmIt}
                            setOpenSelectModel={setOpenSelectModel}
                            recordLogs={recordLogs}
                          />
                        </TabPanel>
                      </Box>
                    </Box>
                  </TabPanel>
                  <TabPanel value={sidebarView} index={2}>
                    {currentVisibleNode && (
                      <Inheritance
                        selectedNode={currentVisibleNode}
                        nodes={nodes}
                      />
                    )}
                  </TabPanel>
                  <TabPanel value={sidebarView} index={3}>
                    <Box
                      sx={{
                        p: "18px",
                        ...SCROLL_BAR_STYLE,
                      }}
                    >
                      {/* <MarkdownRender text={markdownContent} /> */}
                    </Box>
                  </TabPanel>
                </Box>
              </Box>
            </Section>
          )}
          {ConfirmDialog}
          {selectDialog}
          <SneakMessage
            newMessage={snackbarMessage}
            setNewMessage={setSnackbarMessage}
          />
        </Container>
      ) : (
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
      )}
      <Box sx={{ position: "absolute", top: 0, width: "100%" }}>
        <AppHeaderMemoized
          ref={headerRef}
          setRightPanelVisible={setRightPanelVisible}
          rightPanelVisible={rightPanelVisible}
          loading={false}
          confirmIt={confirmIt}
          setSidebarView={setSidebarView}
          handleNotificationPopup={handleNotificationPopup}
          notifications={notifications}
          handleChat={handleChat}
          handleSearch={handleSearch}
        />
      </Box>

      <Popper
        sx={{
          backgroundColor: (theme) =>
            theme.palette.mode === "dark" ? "#3a3b3c" : "#d0d5dd",
          width: "400px",
          p: 2,
          height: "420px",
          overflowY: "auto",
          borderRadius: "10px",
          zIndex: 999,
        }}
        placeholder={""}
        open={openNotificationSection}
        anchorEl={anchor}
        placement="bottom-end"
        onPointerEnterCapture={undefined}
        onPointerLeaveCapture={undefined}
      >
        <Notification
          user={user}
          notifications={notifications}
          openNotification={openNotification}
        />
      </Popper>

      <Modal
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "transparent",
          // backgroundColor: "rgba(0, 0, 0, 0.5)",
        }}
        open={openSelectModel}
        onClose={handleClose}
      >
        <Box
          sx={{
            maxHeight: "80vh",
            overflowY: "auto",
            borderRadius: 2,
            boxShadow: 24,
            ...SCROLL_BAR_STYLE,
          }}
        >
          <Paper sx={{ position: "sticky", top: "0", px: "15px", zIndex: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <SearchBox
                  setSearchValue={setSearchValue}
                  label={"Search ..."}
                />
              </Box>
            </Box>
          </Paper>
          <Paper>
            {searchValue ? (
              <Box>
                {" "}
                {searchResults.map((node: any) => (
                  <ListItem
                    key={node.id}
                    onClick={() => {}}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      color: "white",
                      cursor: "pointer",
                      borderRadius: "4px",
                      padding: "8px",
                      transition: "background-color 0.3s",
                      // border: "1px solid #ccc",
                      mt: "5px",
                      "&:hover": {
                        backgroundColor: (theme) =>
                          theme.palette.mode === "dark"
                            ? DESIGN_SYSTEM_COLORS.notebookG450
                            : DESIGN_SYSTEM_COLORS.gray200,
                      },
                    }}
                  >
                    {" "}
                    <Typography>{node.title}</Typography>
                    <Button variant="outlined">Send</Button>
                  </ListItem>
                ))}
              </Box>
            ) : (
              <TreeViewSimplified
                treeVisualization={treeVisualization}
                expandedNodes={expandedNodes}
                onOpenNodesTree={onOpenNodesTree}
                sendNode={sendNode}
              />
            )}
          </Paper>
        </Box>
      </Modal>
    </Box>
  );
};
export default withAuthUser({
  shouldRedirectToLogin: true,
  shouldRedirectToHomeIfAuthenticated: false,
})(Ontology);
