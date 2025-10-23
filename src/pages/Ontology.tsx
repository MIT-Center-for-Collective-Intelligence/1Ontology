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
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import MenuIcon from "@mui/icons-material/Menu";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  IconButton,
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
  getDocs,
  getFirestore,
  limit,
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
  ONTOLOGY_APPS,
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
import { useNodeSnapshot } from "@components/lib/utils/nodeFetcher";
import { TreeApi } from "react-arborist";
import { capitalizeFirstLetter } from "@components/lib/utils/string.utils";
import ROUTES from "@components/lib/utils/routes";
import { getAuth } from "firebase/auth";
import FullPageLogoLoading from "@components/components/layouts/FullPageLogoLoading";
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

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const { node: fetchedNode, loading: nodeLoading } =
    useNodeSnapshot(selectedNodeId);
  const [currentVisibleNode, setCurrentVisibleNode] = useState<INode | null>(
    null,
  );

  // Sync fetched node to currentVisibleNode
  useEffect(() => {
    if (fetchedNode) {
      setCurrentVisibleNode(fetchedNode);
    }
  }, [fetchedNode]);

  // const [ontologyPath, setOntologyPath] = useState<INodePath[]>([]);
  const [snackbarMessage, setSnackbarMessage] = useState<string>("");
  const { confirmIt, ConfirmDialog } = useConfirmDialog();
  const [viewValue, setViewValue] = useState<number>(0);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
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
  const [rootNode, setRootNode] = useState<string | null>(null);
  const treeRef = useRef<TreeApi<TreeData>>(null);

  const firstLoad = useRef(true);

  // Mobile state
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileTreeOpen, setMobileTreeOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Auto-focus search input on mobile search open
  useEffect(() => {
    if (mobileSearchOpen && isMobile) {
      // Small delay to ensure the component is rendered
      setTimeout(() => {
        const searchInput = document.querySelector(
          'input[placeholder="Search..."]',
        ) as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }, 100);
    }
  }, [mobileSearchOpen, isMobile]);

  const signOut = async () => {
    router.push(ROUTES.signIn);
    getAuth().signOut();
  };

  const handleCloseAddLinksModel = () => {
    setCurrentVisibleNode((prev: any) => {
      const _prev = { ...prev };
      if (_prev && selectedProperty) {
        if (
          selectedProperty === "specializations" ||
          selectedProperty === "generalizations"
        ) {
          _prev[selectedProperty] = _prev[selectedProperty].map(
            (collection: ICollection) => {
              collection.nodes = collection.nodes.filter(
                (n: { id: string }) => !clonedNodesQueue[n.id],
              );
              return collection;
            },
          );
        } else {
          _prev.properties[selectedProperty] = _prev.properties[
            selectedProperty
          ].map((collection: ICollection) => {
            collection.nodes = collection.nodes.filter(
              (n: { id: string }) => !clonedNodesQueue[n.id],
            );
            return collection;
          });
        }
      }

      return _prev;
    });

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
  }, []);

  // Function to update last searches
  // Note: Validation removed as part of nodes object deprecation
  // Note: Invalid nodes will fail when clicked via useNodeSnapshot
  const updateLastSearches = (searchedNode: any) => {
    setLastSearches((prevSearches) => {
      // If searchedNode is null, return current searches unchanged
      if (!searchedNode) {
        return prevSearches;
      }

      // Remove duplicates and add new search to the front
      const filteredSearches = prevSearches.filter(
        (s) => s.id !== searchedNode.id,
      );
      const updatedSearches = [searchedNode, ...filteredSearches];

      const limitedSearches = updatedSearches.slice(0, 20);

      // Update localStorage with the new list of searches
      localStorage.setItem(
        `lastSearches_${user?.userId}`,
        JSON.stringify(limitedSearches),
      );
      return limitedSearches;
    });
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

  useEffect(() => {
    if (firstLoad.current) {
      const nodeFromHash = window.location.hash.split("#").reverse()[0];

      let initialNodeId: string;
      if (nodeFromHash) {
        initialNodeId = nodeFromHash;
      } else if (user?.currentNode) {
        initialNodeId = user.currentNode;
      } else {
        initialNodeId = rootNode || "hn9pGQNxmQe9Xod5MuKK";
      }

      // Trigger fetch for initial node
      setSelectedNodeId(initialNodeId);
      firstLoad.current = false;
    }
  }, [user?.currentNode, rootNode, setSelectedNodeId]);

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

  useEffect(() => {
    if (!currentVisibleNode?.id) {
      return;
    }

    openedANode(currentVisibleNode?.id);

    updateTheUrl([
      { id: currentVisibleNode?.id, title: currentVisibleNode.title },
    ]);
  }, [currentVisibleNode?.id]);

  // COMMENTED OUT AS PART OF OF DEPRECATING NODES OBJECT
  // Define a callback function to handle the opening of the ontology DAGRE view.
  // const onOpenNodeDagre = useCallback(
  //   async (nodeId: string) => {
  //     // Check if a user is logged in, if not, exit the function.
  //     if (!user) return;

  //     // Check if the node with the specified ID exists and is not a main node (no category).
  //     if (nodes[nodeId] && !nodes[nodeId].category) {
  //       // Set the currentVisibleNode as the currently selected node.
  //       setCurrentVisibleNode(nodes[nodeId]);

  //       // Record logs for the action of opening the DAGRE view for the node.
  //       recordLogs({
  //         action: "opened dagre-view",
  //         itemClicked: nodes[nodeId].id,
  //       });
  //     }
  //   },
  //   // Dependency array includes ontologies and user, ensuring the function re-renders when these values change.
  //   [nodes, user],
  // );

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

      // Trigger node fetch - this updates currentVisibleNode via useNodeSnapshot + useEffect
      // The useNodeSnapshot hook fetches the node from Firestore
      // The useEffect (lines 190-194) syncs fetchedNode to currentVisibleNode
      setSelectedNodeId(nodeId);

      // Record logs for the action of clicking the tree-view
      recordLogs({
        action: "clicked tree-view",
        itemClicked: nodeId,
      });
    },
    [user, setSelectedNodeId],
  );

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

      // Use the single node-fetch approach instead of nodes object
      // setSelectedNodeId triggers useNodeSnapshot hook which fetches from Firestore
      // The fetched node is auto-synced to currentVisibleNode via useEffect (lines 190-194)
      setSelectedNodeId(nodeId);

      // Note: intializeExpanded is commented out due to changes in draggableTree behavior
      // initializeExpanded(eachOntologyPath[nodeId]);

      setSelectedDiffNode(null);
      setScrollTrigger((prev) => !prev);
    },
    [
      selectedProperty,
      addedElements,
      removedElements,
      currentImprovement,
      setSelectedNodeId,
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

  // Handle escape key for mobile overlays
  // useEffect(() => {
  //   const handleEscape = (e: KeyboardEvent) => {
  //     if (e.key === "Escape") {
  //       if (mobileSearchOpen) {
  //         setMobileSearchOpen(false);
  //       }
  //       if (mobileTreeOpen) {
  //         setMobileTreeOpen(false);
  //       }
  //     }
  //   };

  //   if (isMobile) {
  //     window.addEventListener("keydown", handleEscape);
  //     return () => window.removeEventListener("keydown", handleEscape);
  //   }
  // }, [isMobile, mobileSearchOpen, mobileTreeOpen]);

  const displaySidebar = useCallback(
    (sidebarName: "chat" | "nodeHistory" | "inheritanceSettings") => {
      if (activeSidebar === sidebarName) {
        setActiveSidebar(null);
        // Close mobile sidebar when deactivating
        if (isMobile) {
          setMobileSidebarOpen(false);
        }
      } else {
        setSelectedChatTab(0);
        handleExpandSidebar(sidebarName);
        // Open mobile sidebar when activating on mobile
        if (isMobile) {
          setMobileSidebarOpen(true);
        }
      }
    },
    [activeSidebar, isMobile],
  );

  const compareTitles = (title1: string, title2: string): boolean => {
    const tokens1 = tokenize(title1);
    const tokens2 = tokenize(title2);

    return (
      tokens1.every((token) => tokens2.includes(token)) ||
      tokens2.every((token) => tokens1.includes(token))
    );
  };

  // COMMENTED OUT AS PART OF DEPRECATING NODES OBJECT
  // Note: This is required for parts property in displaying their inheritance
  // useEffect(() => {
  //   if (!currentVisibleNode) return;

  //   const _inheritanceDetails: any = {};

  //   const _currentVisibleNode = { ...currentVisibleNode };

  //   let parts = _currentVisibleNode?.properties.parts || [];
  //   const inheritanceRef = _currentVisibleNode.inheritance["parts"]?.ref;
  //   if (inheritanceRef && nodes[inheritanceRef]) {
  //     parts = nodes[inheritanceRef].properties["parts"];
  //   }

  //   const generalizations = (
  //     _currentVisibleNode?.generalizations || []
  //   ).flatMap((c) => c.nodes);
  //   const checkGeneralizations = (
  //     partId: string,
  //   ): { genId: string; partOf: string | null }[] | null => {
  //     let inheritanceDetails: { genId: string; partOf: string | null }[] = [];

  //     for (let generalization of generalizations) {
  //       if (!nodes[generalization.id]) {
  //         continue;
  //       }
  //       const refPartsId = nodes[generalization.id].inheritance["parts"].ref;
  //       let generalizationParts = nodes[generalization.id]?.properties.parts;
  //       if (refPartsId && nodes[refPartsId]) {
  //         generalizationParts = nodes[refPartsId]?.properties.parts;
  //       }

  //       const partIdex = generalizationParts[0].nodes.findIndex(
  //         (c) => c.id === partId,
  //       );

  //       let partOfIdx: any = -1;

  //       if (partIdex === -1) {
  //         for (let { id } of generalizationParts[0].nodes) {
  //           const specializationPart = (
  //             nodes[id]?.specializations || []
  //           ).flatMap((c) => c.nodes);
  //           partOfIdx = specializationPart.findIndex((c) => c.id === partId);
  //           if (partOfIdx !== -1) {
  //             inheritanceDetails.push({
  //               genId: generalization.id,
  //               partOf: id,
  //             });
  //           }
  //         }
  //       }
  //       if (partIdex === -1) {
  //         const ontologyPathForPart = eachOntologyPath[partId] ?? [];

  //         const exacts = generalizationParts[0].nodes.filter((n) => {
  //           const findIndex = ontologyPathForPart.findIndex(
  //             (d) => d.id === n.id,
  //           );
  //           return findIndex !== -1;
  //         });
  //         if (exacts.length > 0) {
  //           inheritanceDetails.push({
  //             genId: generalization.id,
  //             partOf: exacts[0].id,
  //           });
  //         }
  //       }

  //       if (partIdex !== -1) {
  //         inheritanceDetails.push({
  //           genId: generalization.id,
  //           partOf: generalizationParts[0].nodes[partIdex].id,
  //         });
  //       }
  //     }
  //     if (inheritanceDetails.length > 0) {
  //       return inheritanceDetails;
  //     }
  //     return null;
  //   };

  //   if (parts) {
  //     for (let node of parts[0].nodes) {
  //       if (nodes[node.id]) {
  //         _inheritanceDetails[node.id] = checkGeneralizations(node.id);
  //       }
  //     }
  //   }
  //   setPartsInheritance(_inheritanceDetails);
  // }, [currentVisibleNode, nodes]);

  if (nodeLoading) {
    return <FullPageLogoLoading />;
  }

  return (
    <>
      <Head>
        <title>
          {currentVisibleNode ? currentVisibleNode.title : "1ontology"}
        </title>
      </Head>

      {/* Mobile Header */}
      {isMobile && (
        <Box
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            backgroundColor:
              theme.palette.mode === "dark" ? "#303134" : "white",
            borderBottom: "1px solid",
            borderColor:
              theme.palette.mode === "dark"
                ? "rgba(255, 255, 255, 0.08)"
                : "rgba(0, 0, 0, 0.08)",
            display: "flex",
            alignItems: "center",
            padding: "8px 16px",
            gap: 1,
          }}
        >
          <IconButton
            onClick={() => setMobileTreeOpen(!mobileTreeOpen)}
            sx={{
              color: mobileTreeOpen
                ? theme.palette.primary.main
                : theme.palette.text.secondary,
            }}
          >
            <AccountTreeIcon />
          </IconButton>

          <Box
            onClick={() => setMobileSearchOpen(true)}
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              backgroundColor: theme.palette.action.hover,
              borderRadius: "20px",
              padding: "8px 16px",
              cursor: "pointer",
              "&:hover": {
                backgroundColor: theme.palette.action.selected,
              },
            }}
          >
            <SearchIcon sx={{ color: theme.palette.text.secondary, mr: 1 }} />
            <Typography
              variant="body2"
              sx={{
                color: theme.palette.text.secondary,
                flex: 1,
              }}
            >
              Search ontology...
            </Typography>
          </Box>

          <IconButton
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            sx={{
              color: mobileSidebarOpen
                ? theme.palette.primary.main
                : theme.palette.text.secondary,
            }}
          >
            <MenuIcon />
          </IconButton>
        </Box>
      )}

      {/* Mobile Search Overlay */}
      {isMobile && mobileSearchOpen && (
        <Box
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1100,
            backgroundColor: theme.palette.background.default,
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              padding: "8px 16px",
              borderBottom: "1px solid",
              borderColor:
                theme.palette.mode === "dark"
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(0, 0, 0, 0.08)",
              gap: 1,
            }}
          >
            <IconButton
              onClick={() => setMobileSearchOpen(false)}
              sx={{ color: theme.palette.text.primary }}
            >
              <CloseIcon />
            </IconButton>
            <Typography variant="h6" sx={{ flex: 1 }}>
              Search
            </Typography>
          </Box>

          <Box
            sx={{
              height: "calc(100vh - 64px)",
              overflow: "auto",
              ...SCROLL_BAR_STYLE,
            }}
          >
            <SearchSideBar
              openSearchedNode={(node: INode, searched: boolean = true) => {
                openSearchedNode(node, searched);
                setMobileSearchOpen(false);
              }}
              lastSearches={lastSearches}
              updateLastSearches={updateLastSearches}
              skillsFuture={skillsFuture}
              skillsFutureApp={appName}
            />
          </Box>
        </Box>
      )}

      {/* Mobile Tree Panel */}
      {isMobile && (
        <Box
          sx={{
            position: "fixed",
            top: "56px", // Below mobile header
            left: 0,
            right: 0,
            height: mobileTreeOpen ? "50vh" : "0",
            backgroundColor:
              theme.palette.mode === "dark" ? "#303134" : "white",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            zIndex: 999,
            transition: "height 0.3s ease-in-out",
            borderBottom: mobileTreeOpen ? "1px solid" : "none",
            borderColor:
              theme.palette.mode === "dark"
                ? "rgba(255, 255, 255, 0.08)"
                : "rgba(0, 0, 0, 0.08)",
          }}
        >
          {skillsFuture && (
            <Box
              sx={{
                m: "10px",
                mt: "20px",
                flexShrink: 0,
                opacity: mobileTreeOpen ? 1 : 0,
                transition: "opacity 0.3s ease-in-out",
              }}
            >
              <FormControl
                variant="outlined"
                sx={{ borderRadius: "20px" }}
                fullWidth
              >
                <InputLabel id="mobile-property-type-label">
                  Which Ontology
                </InputLabel>
                <Select
                  labelId="mobile-property-type-label"
                  value={appName}
                  onChange={(event) => {
                    const app = event.target.value.replaceAll(" ", "_");
                    router.replace(`/${app}`);
                  }}
                  label="Property Type"
                  sx={{ borderRadius: "20px" }}
                >
                  {ONTOLOGY_APPS.map(({ id, name }) => (
                    <MenuItem key={id} value={id}>
                      {name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          )}
          <Box
            sx={{
              flex: 1,
              overflow: "auto",
              paddingTop: skillsFuture ? "0" : "16px", // Add top padding only if no ontology selector
              opacity: mobileTreeOpen ? 1 : 0,
              transition: "opacity 0.3s ease-in-out",
              ...SCROLL_BAR_STYLE,
            }}
          >
            <DraggableTree
              treeViewData={treeViewData}
              setSnackbarMessage={setSnackbarMessage}
              treeRef={treeRef}
              currentVisibleNode={currentVisibleNode}
              onOpenNodesTree={(nodeId: string) => {
                onOpenNodesTree(nodeId);
                // Don't close tree on node selection to allow parallel browsing
              }}
              skillsFuture={skillsFuture}
              specializationNumsUnder={specializationNumsUnder}
              skillsFutureApp={appName}
            />
          </Box>
        </Box>
      )}

      {/* Mobile Sidebar Panel */}
      {isMobile && (
        <Box
          sx={{
            position: "fixed",
            top: 0,
            right: mobileSidebarOpen
              ? 0
              : activeSidebar
                ? { xs: "-90%", sm: "-450px" }
                : "-70px",
            width: activeSidebar ? { xs: "90%", sm: "450px" } : "70px",
            height: "100vh",
            backgroundColor: "transparent",
            zIndex: 1200,
            transition: "right 0.3s ease-in-out, width 0.3s ease-in-out",
            borderTopLeftRadius: "8px",
            borderBottomLeftRadius: "8px",
            overflow: "visible",
          }}
        >
          <MemoizedToolbarSidebar
            toolbarRef={toolbarRef}
            user={user}
            openSearchedNode={openSearchedNode}
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
            skillsFutureApp={appName}
          />
        </Box>
      )}

      {/* Mobile Sidebar Backdrop */}
      {isMobile && mobileSidebarOpen && (
        <Box
          onClick={() => setMobileSidebarOpen(false)}
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.3)",
            zIndex: 1100,
          }}
        />
      )}

      <Box>
        <Container
          style={{
            height: "100vh",
            display: "flex",
            overflow: "hidden",
            backgroundColor:
              theme.palette.mode === "dark" ? "#1b1a1a" : "#f8f9fa",
            paddingTop: isMobile
              ? mobileTreeOpen
                ? "calc(56px + 50vh)"
                : "56px"
              : "0",
            transition: isMobile ? "padding-top 0.3s ease-in-out" : "none",
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
              <Box
                sx={{
                  height: "100vh",
                  marginTop: "166px",
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
                      skillsFuture={skillsFuture}
                      specializationNumsUnder={specializationNumsUnder}
                      skillsFutureApp={appName}
                    />
                  </Box>
                </TabPanel>
                <TabPanel value={viewValue} index={1}>
                  <GraphView
                    setExpandedNodes={setExpandedNodes}
                    expandedNodes={expandedNodes}
                    // onOpenNodeDagre={onOpenNodeDagre}
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
                  backgroundColor: (theme) =>
                    theme.palette.mode === "dark" ? "#191c21" : "#eaecf0",
                }}
              >
                {" "}
                {skillsFuture && (
                  <Box sx={{ m: "10px", mb: "0px", p: 0 }}>
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
                          const app = event.target.value.replaceAll(" ", "_");
                          router.replace(`/${app}`);
                        }}
                        label="Ontology Type"
                        sx={{
                          borderRadius: "20px",
                          "& .MuiSelect-select": {
                            padding: "10px 14px",
                          },
                        }}
                        MenuProps={{
                          PaperProps: {
                            sx: {
                              backgroundColor: (theme) =>
                                theme.palette.mode === "dark" ? "#1a1a1a" : "",
                              borderLeftBottomRadius: "20px",
                              borderRightBottomRadius: "20px",
                              px: 1.5,
                              border: "1.5px solid gray",
                              borderRadius: "25px",
                            },
                          },
                        }}
                      >
                        {ONTOLOGY_APPS.map(({ id, name }) => (
                          <MenuItem
                            key={id}
                            value={id}
                            sx={{
                              borderRadius: "25px",
                              mt: "3px",
                              border: "1px solid gray",
                              background:
                                "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))",
                              fontSize: "15px",
                              fontWeight: appName === id ? "bold" : "400",
                              color:
                                appName === id
                                  ? (theme) =>
                                      theme.palette.mode === "light"
                                        ? "#FF6600"
                                        : "orange"
                                  : "",
                            }}
                          >
                            {name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                )}
                <SearchSideBar
                  openSearchedNode={openSearchedNode}
                  lastSearches={lastSearches}
                  updateLastSearches={updateLastSearches}
                  skillsFuture={skillsFuture}
                  skillsFutureApp={appName}
                />{" "}
                <Divider sx={{ borderBottomWidth: 1.5, borderColor: "gray" }} />
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
                    sx={{ width: "50%", fontSize: "19px" }}
                  />
                  <Tab
                    label="Graph View"
                    {...a11yProps(1)}
                    sx={{ width: "50%", fontSize: "19px" }}
                  />
                </Tabs>
              </Box>
            </Section>
          )}

          {!isMobile && (
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
          )}

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
                height: isMobile
                  ? mobileTreeOpen
                    ? "calc(100vh - 56px - 50vh)" // Account for header + tree
                    : "calc(100vh - 56px)" // Just header
                  : "100vh",
                transition: isMobile ? "height 0.3s ease-in-out" : "none",
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
                  nodes={nodes}
                  navigateToNode={navigateToNode}
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

          {!isMobile && (
            <MemoizedToolbarSidebar
              // isHovered={toolbarIsHovered}
              toolbarRef={toolbarRef}
              user={user}
              openSearchedNode={openSearchedNode}
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
          )}
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
