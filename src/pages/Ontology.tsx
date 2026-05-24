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
  ListSubheader,
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
  documentId,
  getDocs,
  getFirestore,
  limit,
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
import SneakMessage from "@components/components/OntologyComponents/SneakMessage";
import Node from "@components/components/OntologyComponents/Node";
import NavigationError from "@components/components/OntologyComponents/NavigationError";
import TreeViewSimplified from "@components/components/OntologyComponents/TreeViewSimplified";
import {
  ICollection,
  ILinkNode,
  ILockedNode,
  INode,
  INodePath,
  INodeTypes,
  InheritedPartsDetail,
  MainSpecializations,
  TreeData,
  TreeViewNode,
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
import { userHasOntologyEditAccess } from "@components/lib/utils/helpers";
import {
  NODES,
  USERS,
  UNREAD_COMMENTS,
} from "@components/lib/firestoreClient/collections";
import { getDatabase, onValue, ref } from "firebase/database";

import { recordLogs } from "@components/lib/utils/helpers";
import { useHover } from "@components/lib/hooks/useHover";
import { useInheritedPartsDetails } from "@components/lib/hooks/useInheritedPartsDetails";
import { MemoizedToolbarSidebar } from "@components/components/Sidebar/ToolbarSidebar";
import { NodeChange } from "@components/types/INode";
import GuidLines from "@components/components/Guidelines/GuideLines";
import SearchSideBar from "@components/components/SearchSideBar/SearchSideBar";
import DraggableTree from "@components/components/OntologyComponents/DraggableTree";
import { TreeApi } from "react-arborist";
import { capitalizeFirstLetter } from "@components/lib/utils/string.utils";
import ROUTES from "@components/lib/utils/routes";
import { getAuth } from "firebase/auth";
import FullPageLogoLoading from "@components/components/layouts/FullPageLogoLoading";

import {
  filterTreeForTargetNode,
  expandEllipsisNode,
} from "@components/lib/utils/treeFiltering";
import {
  batchGetNodesByIds,
  buildPathTreeWithSiblings,
  collectSpecializationChildIds,
  mergePreservedSubtrees,
  nodeHasNonEmptySpecializations,
  replaceSpineWithOneLevel,
  replaceWithOneLevel,
  resolvePathIds,
} from "@components/lib/utils/loadOutlineFromPathIds";
import {
  AddContext,
  TreeOutlineSkeleton,
  chunkArray,
  extractRelatedNodeIds,
  fetchRootNode,
  fetchSingleNode,
} from "@components/lib/utils/ontology.helpers";

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
  }
  return tokens;
};

const Ontology = ({
  appName,
  onOpenInNavigator,
  onFocusedTitleChange,
}: {
  appName: string;
  onOpenInNavigator?: (nodeId: string) => void;
  // Reported up to the parent component, which owns the <title> tag.
  onFocusedTitleChange?: (title: string | null) => void;
}) => {
  const db = getFirestore();
  const rtdb = getDatabase();
  const [{ emailVerified, user, isAuthInitialized }] = useAuth();
  const router = useRouter();
  const isMobile = useMediaQuery("(max-width:599px)", { noSsr: true });
  const [relatedNodes, setRelatedNodes] = useState<{ [id: string]: INode }>({});
  const [currentVisibleNode, setCurrentVisibleNode] = useState<INode | null>(
    null,
  );
  // const [ontologyPath, setOntologyPath] = useState<INodePath[]>([]);
  const [snackbarMessage, setSnackbarMessage] = useState<string>("");
  const [treeVisualization, setTreeVisualization] = useState<TreeVisual>({});
  const { confirmIt, ConfirmDialog } = useConfirmDialog();
  const [viewValue, setViewValue] = useState<number>(0);
  const fuseRef = useRef<Fuse<INode>>(
    new Fuse([], {
      keys: ["title", "context.title"],
    }),
  );
  const fuseRebuildTimerRef = useRef<number | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [eachNodePath, setEachNodePath] = useState<{
    [key: string]: INodePath[];
  }>({});
  const [multipleOntologyPaths, setMultipleOntologyPaths] = useState<any>({});
  const columnResizerRef = useRef<any>();
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

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
  const [loadingNodes, setLoadingNodes] = useState(false);
  const [isPageReady, setIsPageReady] = useState(false);
  const [partsInheritance, setPartsInheritance] = useState<any>({});
  const [currentNodeTreeData, setCurrentNodeTreeData] = useState<TreeData[]>(
    [],
  );
  const [pathOutlineMessage, setPathOutlineMessage] = useState<string | null>(
    null,
  );
  const [isLoadingOutline, setIsLoadingOutline] = useState<boolean>(true);
  const [sidebarSearchValue, setSidebarSearchValue] = useState("");
  const [isSidebarSearchFocused, setIsSidebarSearchFocused] = useState(false);
  const [isLoadingNodeDetails, setIsLoadingNodeDetails] = useState(false);
  const [navigationError, setNavigationError] = useState<{
    type: "not-found" | "wrong-app";
  } | null>(null);

  const [scrollTrigger, setScrollTrigger] = useState(false);
  const [enableEdit, setEnableEdit] = useState(false);
  const [specializationNumsUnder, setSpecializationNumsUnder] = useState({});
  const [editableProperty, setEditableProperty] = useState<ICollection[]>([]);
  const [rootNode, setRootNode] = useState<string | null>(null);
  const [isExperimentalSearch, setIsExperimentalSearch] = useState(true);
  const treeRef = useRef<TreeApi<TreeData>>(null);
  const [nodesWithComments, setNodesWithComments] = useState<Set<string>>(
    new Set(),
  );
  const ontologyAppsTopGroup = useMemo(
    () => ONTOLOGY_APPS.filter((app) => app.type !== "other"),
    [],
  );
  const ontologyAppsOtherGroup = useMemo(() => {
    const editAccess = !!user?.claims?.editAccess;
    return ONTOLOGY_APPS.filter(
      (app) => app.type === "other" && (editAccess || app.editAccess),
    );
  }, [user]);

  const firstLoad = useRef(true);
  const prevAppNameRef = useRef<string>(appName);
  const isSwitchingAppRef = useRef(false);
  const lastHashSetRef = useRef<string>("");
  const pageOpenTime = useRef(Date.now());

  // Mobile state
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileTreeOpen, setMobileTreeOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Track instant updates to prevent overwriting with stale data
  const [hasInstantUpdate, setHasInstantUpdate] = useState(false);
  const hasInstantUpdateRef = useRef(false);
  const instantUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    hasInstantUpdateRef.current = hasInstantUpdate;
  }, [hasInstantUpdate]);

  // Report the focused node's title up to the parent
  useEffect(() => {
    const title = currentVisibleNode?.title;
    if (title) onFocusedTitleChange?.(title);
  }, [currentVisibleNode?.title, onFocusedTitleChange]);

  // Instant tree update callback for instant UI feedback
  const handleInstantTreeUpdate = useCallback(
    (updateFn: (treeData: TreeData[]) => TreeData[]) => {
      setHasInstantUpdate(true);
      hasInstantUpdateRef.current = true;
      if (instantUpdateTimeoutRef.current) {
        clearTimeout(instantUpdateTimeoutRef.current);
      }
      instantUpdateTimeoutRef.current = setTimeout(() => {
        setHasInstantUpdate(false);
        hasInstantUpdateRef.current = false;
      }, 30000);

      setCurrentNodeTreeData((prevTree) => updateFn(prevTree));
    },
    [currentVisibleNode?.id, currentVisibleNode, db],
  );

  // Clear the instant update guard on navigation so loadPathOutline runs
  // mergeOutlines preserves prior expansion across the reload.
  useEffect(() => {
    if (!hasInstantUpdateRef.current) return;
    setHasInstantUpdate(false);
    hasInstantUpdateRef.current = false;
    if (instantUpdateTimeoutRef.current) {
      clearTimeout(instantUpdateTimeoutRef.current);
      instantUpdateTimeoutRef.current = null;
    }
  }, [currentVisibleNode?.id]);

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
    getAuth().signOut();
    router.push(ROUTES.signIn);
  };

  // Memoized fetchNode helper to fetch nodes not in cache and add to relatedNodes
  const fetchNode = useCallback(
    async (nodeId: string): Promise<INode | null> => {
      // Skip if already in cache
      if (relatedNodes[nodeId]) {
        return relatedNodes[nodeId];
      }
      const node = await fetchSingleNode(db, nodeId);
      if (node) {
        setRelatedNodes((prev) => {
          if (prev[nodeId]) return prev;
          return { ...prev, [nodeId]: node };
        });
      }
      return node;
    },
    [db, relatedNodes],
  );

  const loadPathOutline = useCallback(async () => {
    if (hasInstantUpdateRef.current) {
      return;
    }
    if (!currentVisibleNode?.id || currentVisibleNode.appName !== appName) {
      setCurrentNodeTreeData([]);
      setPathOutlineMessage(null);
      setIsLoadingOutline(false);
      return;
    }
    if ((currentVisibleNode as any)._isMinimal) {
      return;
    }
    setIsLoadingOutline(true);
    const focused = currentVisibleNode;
    /*     if (!focused.pathIds?.length && !focused.primaryParentId) {
      setPathOutlineMessage("No root path found");
    } else {
      setPathOutlineMessage(null);
    } */
    try {
      const { pathIds } = await resolvePathIds(focused, (id) =>
        fetchSingleNode(db, id, appName),
      );
      if (pathIds.length === 0) {
        setCurrentNodeTreeData([]);
        return;
      }
      const byId = await batchGetNodesByIds(db, pathIds, appName);
      if (!byId[focused.id]) {
        byId[focused.id] = focused;
      }

      // Also show siblings for every node on the displayed path:
      // fetch direct children for each path node (still no grandchildren).
      const childIds = pathIds.flatMap((id) => {
        const n = byId[id];
        return n ? collectSpecializationChildIds(n) : [];
      });
      const childrenById = await batchGetNodesByIds(db, childIds, appName);
      const pathTree = buildPathTreeWithSiblings(
        pathIds,
        byId,
        childrenById,
        focused.id,
      );

      // If the ontology has multiple roots, show them all at top level.
      // Only the canonical path root is expanded; other roots are collapsed but expandable.
      const rootsSnap = await getDocs(
        query(
          collection(db, NODES),
          where("root", "==", true),
          where("appName", "==", appName),
          where("deleted", "==", false),
        ),
      );
      const rootNodes: INode[] = rootsSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as INode,
      );
      const pathRootId = pathIds[0];
      const otherRoots = rootNodes
        .filter((r) => r.id !== pathRootId)
        .map((r) => {
          const hasKids = nodeHasNonEmptySpecializations(r);
          return {
            id: r.id,
            nodeId: r.id,
            name: r.title,
            nodeType: r.nodeType,
            ...(r.unclassified && { unclassified: true }),
            children: hasKids ? [] : undefined,
            hasUnresolvedChildren: hasKids,
            outlineLoadChildren: hasKids,
          } as TreeData;
        });

      const tree = [...pathTree, ...otherRoots];
      const filtered = filterTreeForTargetNode(tree, focused.id);
      setCurrentNodeTreeData((prev) => mergePreservedSubtrees(filtered, prev));
    } catch {
      setCurrentNodeTreeData([]);
    } finally {
      setIsLoadingOutline(false);
    }
  }, [appName, currentVisibleNode, db]);

  const handleOutlineNodeOpen = useCallback(
    async (apiNode: { data: TreeData }) => {
      const d = apiNode.data;
      if (!d.outlineSpineOnly && !d.outlineLoadChildren) {
        return;
      }
      const full = await fetchSingleNode(db, d.nodeId, appName);
      if (!full) {
        return;
      }
      const childIds = collectSpecializationChildIds(full);
      const childDocs = await batchGetNodesByIds(db, childIds, appName);
      const merged: Record<string, INode> = { ...childDocs, [full.id]: full };
      setCurrentNodeTreeData((prev) => {
        const next = d.outlineSpineOnly
          ? replaceSpineWithOneLevel(prev, d.id, full, merged)
          : replaceWithOneLevel(prev, d.id, full, merged);
        return currentVisibleNode
          ? filterTreeForTargetNode(next, currentVisibleNode.id)
          : next;
      });
    },
    [appName, currentVisibleNode, db],
  );

  const dynamicUnsubscribeRef = useRef<Map<string, () => void>>(new Map()); // Stores unsubscribe functions for each dynamically added node
  const dynamicNodeMappingRef = useRef<Map<string, Set<string>>>(new Map()); // Used to clean up child node snapshots when navigating away from parent

  // Add nodes to cache with listeners (triggered by dropdown selections in @inheritedPartsViewerEdit)
  const addNodesToCache = useCallback(
    (newNodes: { [id: string]: INode }, parentNodeId?: string) => {
      // Filter out nodes already being snapshotted
      const nodesToAdd: { [id: string]: INode } = {};
      const nodeIdsToSnapshot: string[] = [];
      Object.entries(newNodes).forEach(([id, node]) => {
        if (!dynamicUnsubscribeRef.current.has(id)) {
          nodesToAdd[id] = node;
          nodeIdsToSnapshot.push(id);
        }
      });

      if (Object.keys(nodesToAdd).length === 0) {
        return;
      }

      // Immediately add to relatedNodes state
      setRelatedNodes((prev) => {
        const toAdd: { [id: string]: INode } = {};
        Object.entries(nodesToAdd).forEach(([id, node]) => {
          if (!prev[id]) {
            toAdd[id] = node;
          }
        });
        return Object.keys(toAdd).length > 0 ? { ...prev, ...toAdd } : prev;
      });

      // Set up snapshot listeners for new nodes
      const batches = chunkArray(nodeIdsToSnapshot, 30);

      batches.forEach((batch) => {
        let nodesQuery;
        if (appName) {
          nodesQuery = query(
            collection(db, NODES),
            where(documentId(), "in", batch),
            where("deleted", "==", false),
            where("appName", "==", appName),
          );
        } else {
          nodesQuery = query(
            collection(db, NODES),
            where(documentId(), "in", batch),
            where("deleted", "==", false),
          );
        }

        const unsubscribe = onSnapshot(
          nodesQuery,
          (snapshot) => {
            setRelatedNodes((prev) => {
              const updated = { ...prev };

              snapshot.docChanges().forEach((change) => {
                const nodeId = change.doc.id;

                if (change.type === "removed") {
                  delete updated[nodeId];
                } else {
                  updated[nodeId] = {
                    id: nodeId,
                    ...change.doc.data(),
                  } as INode;
                }
              });
              return updated;
            });
          },
          (error) => {
            console.error(
              "[ADD TO CACHE] Error in cached node snapshot:",
              error,
            );
          },
        );

        // Store unsubscribe function to prevent duplicate listeners for the same nodes
        batch.forEach((nodeId) => {
          if (!dynamicUnsubscribeRef.current.has(nodeId)) {
            dynamicUnsubscribeRef.current.set(nodeId, unsubscribe);
          }
        });
      });

      // Track node relationship for cleanup
      if (parentNodeId) {
        if (!dynamicNodeMappingRef.current.has(parentNodeId)) {
          dynamicNodeMappingRef.current.set(parentNodeId, new Set());
        }
        const childSet = dynamicNodeMappingRef.current.get(parentNodeId)!;
        nodeIdsToSnapshot.forEach((nodeId) => childSet.add(nodeId));
      }
    },
    [db, appName],
  );

  // Cleanup dynamic snapshots when navigating away from a node
  const previousVisibleNodeIdRef = useRef<string | null>(null);

  useEffect(() => {
    const prevNodeId = previousVisibleNodeIdRef.current;
    const currentNodeId = currentVisibleNode?.id || null;

    if (prevNodeId && prevNodeId !== currentNodeId) {
      const childNodes = dynamicNodeMappingRef.current.get(prevNodeId);

      if (childNodes && childNodes.size > 0) {
        childNodes.forEach((nodeId) => {
          const unsubscribe = dynamicUnsubscribeRef.current.get(nodeId);
          if (unsubscribe) {
            unsubscribe();
            dynamicUnsubscribeRef.current.delete(nodeId);
          }
        });

        // Remove the parent-child mapping
        dynamicNodeMappingRef.current.delete(prevNodeId);
      }
    }

    // Update the previous node ID
    previousVisibleNodeIdRef.current = currentNodeId;
  }, [currentVisibleNode?.id]);

  // Cleanup ALL dynamic snapshots on unmount
  useEffect(() => {
    return () => {
      dynamicUnsubscribeRef.current.forEach((unsub) => unsub());
      dynamicUnsubscribeRef.current.clear();
      dynamicNodeMappingRef.current.clear();

      // Cleanup instant update timeout
      if (instantUpdateTimeoutRef.current) {
        clearTimeout(instantUpdateTimeoutRef.current);
      }
    };
  }, []);

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
    if (fuseRebuildTimerRef.current) {
      window.clearTimeout(fuseRebuildTimerRef.current);
    }
    fuseRebuildTimerRef.current = window.setTimeout(() => {
      const values = Object.values(relatedNodes) as INode[];
      if (values.length === 0) {
        fuseRef.current = new Fuse([], {
          keys: ["title", "context.title"],
        });
        return;
      }
      const list = values.map((n) => ({ ...n })) as INode[];
      AddContext(list, relatedNodes);
      fuseRef.current = new Fuse(list, {
        keys: ["title", "context.title"],
      });
    }, 200);

    return () => {
      if (fuseRebuildTimerRef.current) {
        window.clearTimeout(fuseRebuildTimerRef.current);
        fuseRebuildTimerRef.current = null;
      }
    };
  }, [relatedNodes, loadingNodes]);

  // Function to update last searches
  const updateLastSearches = (searchedNode: any) => {
    setLastSearches((prevSearches) => {
      // If searchedNode is null, only filter valid searches from prevSearches
      if (!searchedNode) {
        const validSearches = prevSearches.filter((node) => {
          const nodeInNodes = relatedNodes[node.id];
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
        const nodeInNodes = relatedNodes[node.id];
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
    return fuseRef.current
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
              specializationsData.push(relatedNodes[n.id]),
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
    [relatedNodes],
  );

  // This function returns a map where each nodeId maps to an array of all possible paths to that node
  const findMultipleOntologyPaths = useCallback(
    ({
      mainNodes,
      path,
      multipleOntologyPaths,
      visited = new Set(),
    }: {
      mainNodes: INode[];
      path: INodePath[];
      multipleOntologyPaths: { [nodeId: string]: INodePath[][] };
      visited?: Set<string>;
    }): { [nodeId: string]: INodePath[][] } | undefined => {
      try {
        for (let node of mainNodes) {
          if (!node) continue;

          const pathSignature = `${node.id}-${path.map((p) => p.id).join("-")}`;
          if (visited.has(pathSignature)) continue;
          visited.add(pathSignature);

          const newPath = [
            ...path,
            {
              title: node.title,
              id: !!node.category ? `${node.id}-${node.title.trim()}` : node.id,
              category: !!node.category,
            },
          ];

          if (!multipleOntologyPaths[node.id]) {
            multipleOntologyPaths[node.id] = [newPath];
          } else {
            const newPathIds = newPath.map((p) => p.id).join(":");
            const isDuplicate = multipleOntologyPaths[node.id].some(
              (existingPath) =>
                existingPath.map((p) => p.id).join(":") === newPathIds,
            );

            if (!isDuplicate) {
              multipleOntologyPaths[node.id].push(newPath);
            }
          }

          node.specializations.forEach((collection) => {
            const specializationsData: INode[] = [];
            collection.nodes.forEach((n: ILinkNode) =>
              specializationsData.push(relatedNodes[n.id]),
            );

            const subPath = [...newPath];
            if (collection.collectionName !== "main") {
              subPath.push({
                title: collection.collectionName,
                id: `${node.id}-${collection.collectionName.trim()}`,
                category: true,
              });
            }

            const result = findMultipleOntologyPaths({
              mainNodes: specializationsData,
              path: subPath,
              multipleOntologyPaths,
              visited,
            });

            if (result) {
              multipleOntologyPaths = result;
            }
          });
        }

        return multipleOntologyPaths;
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
    [relatedNodes],
  );

  useEffect(() => {
    // These traversals can be expensive for large graphs; debounce to avoid
    // repeated recomputation while snapshots stream in.
    if (loadingNodes) return;
    const timer = window.setTimeout(() => {
      const mainNodes = Object.values(relatedNodes).filter(
        (node: any) =>
          node.category || (typeof node.root === "boolean" && !!node.root),
      );
      if (mainNodes.length === 0) return;

      const eachOntologyPath = findOntologyPath({
        mainNodes,
        path: [],
        eachOntologyPath: {},
      });
      if (eachOntologyPath) {
        setEachNodePath(eachOntologyPath);
      }

      const multipleOntologyPaths = findMultipleOntologyPaths({
        mainNodes,
        path: [],
        multipleOntologyPaths: {},
      });
      if (multipleOntologyPaths) {
        setMultipleOntologyPaths(multipleOntologyPaths);
      }
    }, 150);

    return () => window.clearTimeout(timer);
  }, [relatedNodes]);

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
          specializations.push(relatedNodes[nodeLink.id]);
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
  // Main snapshot: Extract all directly related nodes from currentVisibleNode
  // This includes the node itself, generalizations, specializations, all properties, and inheritance reference nodes
  useEffect(() => {
    // Only fetch nodes if we have a current visible node
    if (!currentVisibleNode) {
      setRelatedNodes({});
      setLoadingNodes(false);
      return;
    }

    setLoadingNodes(true);

    // Extract all related node IDs from the current visible node
    const relatedIds = extractRelatedNodeIds(currentVisibleNode);

    if (relatedIds.length === 0) {
      setRelatedNodes({});
      setLoadingNodes(false);
      setIsPageReady(true);
      return;
    }

    // Firestore query has a limit of 30 items, so batch if needed
    const batches = chunkArray(relatedIds, 30);
    const unsubscribers: (() => void)[] = [];
    const initializedBatches = new Set<number>();
    const markBatchInitialized = (batchIndex: number) => {
      initializedBatches.add(batchIndex);
      if (initializedBatches.size === batches.length) {
        setLoadingNodes(false);
        setIsPageReady(true);
      }
    };

    // Set up snapshot listeners for each batch
    batches.forEach((batch, batchIndex) => {
      let nodesQuery;

      // Build query based on app configuration
      if (appName) {
        nodesQuery = query(
          collection(db, NODES),
          where(documentId(), "in", batch),
          where("deleted", "==", false),
          where("appName", "==", appName),
        );
      } else {
        nodesQuery = query(
          collection(db, NODES),
          where(documentId(), "in", batch),
          where("deleted", "==", false),
        );
      }

      const unsubscribe = onSnapshot(
        nodesQuery,
        (snapshot) => {
          setRelatedNodes((prev) => {
            const updated = { ...prev };
            let addedCount = 0;
            let modifiedCount = 0;
            let removedCount = 0;

            snapshot.docChanges().forEach((change) => {
              const nodeId = change.doc.id;

              if (change.type === "removed") {
                delete updated[nodeId];
                removedCount++;
              } else {
                updated[nodeId] = { id: nodeId, ...change.doc.data() } as INode;
                if (change.type === "added") addedCount++;
                else modifiedCount++;
              }
            });

            return updated;
          });

          markBatchInitialized(batchIndex);
        },
        (error) => {
          console.error("Error fetching related nodes:", error);
          recordLogs({
            type: "error",
            error: JSON.stringify({
              name: error.name,
              message: error.message,
            }),
          });
          markBatchInitialized(batchIndex);
        },
      );

      unsubscribers.push(unsubscribe);
    });

    // Cleanup: unsubscribe from all listeners
    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [currentVisibleNode?.id, db, appName]);

  useEffect(() => {
    if (!user?.uname) return;
    const unreadRef = ref(rtdb, `/${UNREAD_COMMENTS}/${appName}/${user.uname}`);
    const unsubscribe = onValue(unreadRef, (snapshot) => {
      const data = snapshot.val();
      setNodesWithComments(new Set<string>(data ? Object.keys(data) : []));
    });
    return () => unsubscribe();
  }, [user?.uname, appName]);

  useEffect(() => {
    if (currentVisibleNode?.id) {
      setCurrentVisibleNode((prev) => {
        if (relatedNodes[currentVisibleNode?.id]) {
          return relatedNodes[currentVisibleNode?.id];
        }
        return prev;
      });
    }
  }, [relatedNodes, appName]);

  // NOTE: Avoid subscribing to *all nodes* in the app here (very expensive initial snapshot).
  // Outline already loads on navigation and can be refreshed via more targeted listeners when needed.

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
          if (relatedNodes[_node.id]) {
            children.push(relatedNodes[_node.id]);
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
    const spreadNodes = Object.values(relatedNodes);
    let mainCategories = spreadNodes.filter(
      (node: INode) =>
        node.category || (typeof node.root === "boolean" && !!node.root),
    );
    if (appName) {
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
      appName === "Full WordNet O*Net Verb Hierarchy - Tom's Version" ||
      appName === "Ontology - Demo Version" ||
      appName === "Ontology - Development Version"
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

    // Set the generated tree structure for visualization
    setTreeVisualization(treeOfSpecializations);
  }, [relatedNodes, appName]);

  // Load initial node on mount and when switching apps
  useEffect(() => {
    if (!isAuthInitialized) {
      return;
    }

    const isInitialLoad = firstLoad.current;
    const isAppSwitch =
      !firstLoad.current && prevAppNameRef.current !== appName;

    // Only load on initial mount or app switch
    if (!isInitialLoad && !isAppSwitch) {
      return;
    }

    // Set flag when switching apps
    // To work for user changing app name in url
    if (isAppSwitch) {
      isSwitchingAppRef.current = true;
    }

    const loadNode = async () => {
      // Strip the `/navigate` mode marker so the rest treats `raw` as a node id.
      setIsPageReady(false);
      let node: INode | null = null;
      try {
        const raw = window.location.hash.split("#").reverse()[0] ?? "";
        const isNavigateMode = raw.endsWith("/navigate");
        const hashId = isNavigateMode ? raw.slice(0, -"/navigate".length) : raw;
        const userCurrentNodeId = user?.currentNode?.[appName]?.id;

        if (hashId) {
          node = await fetchSingleNode(db, hashId, appName);
        }

        // If not found, try user's currentNode for this app
        if (!node && userCurrentNodeId) {
          node = await fetchSingleNode(db, userCurrentNodeId, appName);
        }

        // If still not found, fallback to root node for this app
        if (!node) {
          node = await fetchRootNode(db, appName);
        }

        if (node) {
          window.location.hash = isNavigateMode
            ? `${node.id}/navigate`
            : node.id;
          setCurrentVisibleNode(node);
        }
      } finally {
        if (!node) {
          setIsPageReady(true);
        }

        // Update refs
        if (isInitialLoad) {
          firstLoad.current = false;
        }
        if (isAppSwitch) {
          prevAppNameRef.current = appName;
          // Delay clearing the flag to ensure updateTheUrl can check it
          setTimeout(() => {
            isSwitchingAppRef.current = false;
          }, 100);
        }
      }
    };

    loadNode();
  }, [isAuthInitialized, appName, user?.currentNode?.[appName]?.id, db]);

  // Function to update the user document with the current ontology path
  const openedANode = async (nodeId: string, nodeTitle?: string) => {
    if (!user) return;
    const userRef = doc(collection(db, USERS), user.uname);
    await setDoc(
      userRef,
      {
        currentNode: {
          [appName]: {
            id: nodeId,
            title: nodeTitle || "",
          },
        },
      },
      { merge: true },
    );

    // Record logs if ontology path is not empty
    if (nodeId) {
      recordLogs({
        action: "Opened a node",
        node: nodeId,
        user: user.uname,
      });
    }
  };

  const updateTheUrl = (path: INodePath[]) => {
    if (!path) {
      return;
    }
    // Skip hash change handling during app switch
    if (isSwitchingAppRef.current) {
      return;
    }
    let newHash = "";
    path.forEach((p: any) => (newHash = newHash + `#${p.id.trim()}`));

    // Preserve the `/navigate` mode marker if it's currently in the URL.
    // Without this, any platform-side write strips the suffix and flips
    // the mode back to platform on every render.
    if (window.location.hash.endsWith("/navigate")) {
      newHash = `${newHash}/navigate`;
    }

    // Don't update if hash is already correct to prevent duplicate history entries
    if (window.location.hash === newHash) {
      lastHashSetRef.current = newHash;
      return;
    }

    // Track the hash set by this function to prevent handling of users' own hash change
    lastHashSetRef.current = newHash;

    window.location.hash = newHash;
  };
  const initializeExpanded = (ontologyPath: INodePath[]) => {
    if (!ontologyPath) {
      return;
    }
    const newExpandedSet: Set<string> = new Set();

    const node = relatedNodes[ontologyPath[ontologyPath.length - 1].id];
    const nodeGeneralizations = node.generalizations[0].nodes;

    const generalizationSet: Set<string> = new Set(
      nodeGeneralizations.map((g) => g.id),
    );

    // Initialize the expanded set with the current node's ID
    newExpandedSet.add(node.id);

    const addGeneralizationsToSet = (id: string, expandedSet: any) => {
      if (expandedSet.has(id)) return;

      expandedSet.add(id);

      const currentNode = relatedNodes[id];

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
    if (!currentVisibleNode?.id) {
      return;
    }

    // Only save currentNode if it belongs to the current app
    if (currentVisibleNode.appName === appName) {
      openedANode(currentVisibleNode?.id, currentVisibleNode?.title);
    }

    // Check if this is a root node - if so, skip initializeExpanded to prevent scrolling
    const isRootNode =
      currentVisibleNode.category ||
      (typeof currentVisibleNode.root === "boolean" &&
        !!currentVisibleNode.root);
    if (expandedNodes.size === 0 && !isRootNode) {
      initializeExpanded(eachNodePath[currentVisibleNode?.id]);
    }
    // setOntologyPath(eachOntologyPath[currentVisibleNode?.id]);

    updateTheUrl([
      { id: currentVisibleNode?.id, title: currentVisibleNode.title },
    ]);
  }, [currentVisibleNode?.id]);

  // Callback function to add a new node to the database

  // Define a callback function to handle the opening of the ontology DAGRE view.
  const onOpenNodeDagre = useCallback(
    async (nodeId: string, nodeTitle?: string) => {
      // Check if a user is logged in, if not, exit the function.
      if (!user) return;

      // Get the node from cache or fetch it
      let node: INode | null = relatedNodes[nodeId] || null;
      const needsFetch = !node;

      if (!node) {
        // Create minimal node with just id and title for instant highlighting
        node = { id: nodeId, title: nodeTitle || "", appName, _isMinimal: true } as any;
        setIsLoadingNodeDetails(true);
      } else {
        setIsLoadingNodeDetails(false);
      }

      if (node && !node.category) {
        setNavigationError(null); // Clear any error when navigating via graph
        setCurrentVisibleNode(node);

        recordLogs({
          action: "opened dagre-view",
          itemClicked: node.id,
        });
      }

      // If node wasn't in cache, fetch it in background
      if (needsFetch) {
        try {
          const fullNode = await fetchSingleNode(db, nodeId);
          if (fullNode && !fullNode.category) {
            setCurrentVisibleNode(fullNode);
          }
        } finally {
          setIsLoadingNodeDetails(false);
        }
      }
    },
    [relatedNodes, db, user],
  );

  // Function to handle opening node tree
  const onOpenNodesTree = useCallback(
    async (nodeId: string, nodeTitle?: string) => {
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

      // Get the node from cache or fetch it
      let node: INode | null = relatedNodes[nodeId] || null;
      const needsFetch = !node;

      if (!node) {
        // Create minimal node with just id and title for instant highlighting
        node = { id: nodeId, title: nodeTitle || "", appName, _isMinimal: true } as any;
        setIsLoadingNodeDetails(true);
      } else {
        setIsLoadingNodeDetails(false);
      }

      if (node && !node.category) {
        setNavigationError(null); // Clear any error when navigating via tree
        setCurrentVisibleNode(node);

        // Record logs for the action of clicking the tree-view
        recordLogs({
          action: "clicked tree-view",
          itemClicked: node.id,
        });
      }

      // If node wasn't in cache, fetch it in background
      if (needsFetch) {
        try {
          const fullNode = await fetchSingleNode(db, nodeId);
          if (fullNode && !fullNode.category) {
            setCurrentVisibleNode(fullNode);
          }
        } finally {
          setIsLoadingNodeDetails(false);
        }
      }
    },
    [relatedNodes, db, user],
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
      if (relatedNodes[mainSpecializations[type].id]?.nodeType) {
        mainSpecializations[
          relatedNodes[mainSpecializations[type].id].nodeType
        ] = mainSpecializations[type];
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

      // Get the node from cache or fetch it
      let node: INode | null = relatedNodes[nodeId] || null;
      let errorType: "not-found" | "wrong-app" | null = null;

      if (!node) {
        node = await fetchSingleNode(db, nodeId, appName);
        errorType = "not-found"; // set error type
      } else {
        // Validate if cached node belongs to this app
        if (node.appName !== appName) {
          errorType = "wrong-app"; // set error type
          node = null;
        } else {
        }
      }

      if (node) {
        setNavigationError(null);
        setCurrentVisibleNode(node);
        initializeExpanded(eachNodePath[nodeId]);
        setSelectedDiffNode(null);
        setScrollTrigger((prev) => !prev);
      } else {
        // Update lastHashSetRef to keep it in sync with current hash
        lastHashSetRef.current = window.location.hash;
        setNavigationError({
          type: errorType || "not-found",
        });
      }
    },
    [
      selectedProperty,
      addedElements,
      removedElements,
      relatedNodes,
      db,
      eachNodePath,
      currentImprovement,
      appName,
      currentVisibleNode,
    ],
  );

  useEffect(() => {
    const handleHashChange = async () => {
      if (isSwitchingAppRef.current) return;
      if (!appName) return;

      const currentHash = window.location.hash;
      if (!currentHash) return;

      if (currentHash.endsWith("/navigate")) return;

      const visibleNodeId = currentHash.split("#").reverse()[0];

      if (currentHash === lastHashSetRef.current) return;

      if (visibleNodeId === prevHash.current) return;

      prevHash.current = visibleNodeId;
      navigateToNode(visibleNodeId);
    };

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [appName, navigateToNode]);

  // This function is called when a search result node is clicked.
  const openSearchedNode = useCallback(
    (node: INode, searched = true) => {
      try {
        // Clear outline tree filter (react-arborist `searchTerm`); leftover query
        // from the search box would otherwise hide every outline row.
        setSidebarSearchValue("");
        // Set the clicked node as the open currentVisibleNode
        // setCurrentVisibleNode(node);

        navigateToNode(node.id);

        setTimeout(() => {
          const elements: any = document.querySelector(
            `[node-id="${node?.id}"]`,
          );
          if (elements) {
            const firstElement = elements.length > 0 ? elements[0] : elements;
            if (firstElement) {
              firstElement.scrollIntoView({
                behavior: "smooth",
                block: "center",
              });
            }
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
    const MAX_SESSION_HOURS = 8;
    const MAX_SESSION_MS = MAX_SESSION_HOURS * 60 * 60 * 1000;
    const CHECK_INTERVAL_MS = 60000;

    const checkSessionAndDay = () => {
      const now = new Date();
      const elapsedMs = Date.now() - pageOpenTime.current;

      const openDate = new Date(pageOpenTime.current);
      if (
        now.getDate() !== openDate.getDate() ||
        now.getMonth() !== openDate.getMonth() ||
        now.getFullYear() !== openDate.getFullYear()
      ) {
        window.location.reload();
        return;
      }

      if (elapsedMs > MAX_SESSION_MS) {
        const hoursOpen = Math.round(elapsedMs / (1000 * 60 * 60));
        recordLogs({
          type: "warning",
          message: `Long session detected: ${hoursOpen} hours`,
        });
      }
    };

    const intervalId = setInterval(checkSessionAndDay, CHECK_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [setSnackbarMessage]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof performance === "undefined" ||
      !("memory" in performance)
    ) {
      return;
    }

    const MEMORY_WARNING_THRESHOLD_MB = 700;

    const memoryInterval = setInterval(() => {
      const mem = (performance as any).memory;
      if (!mem) return;

      const usedMB = Math.round(mem.usedJSHeapSize / (1024 * 1024));
      const limitMB = Math.round(mem.jsHeapSizeLimit / (1024 * 1024));

      if (usedMB > MEMORY_WARNING_THRESHOLD_MB) {
        const message = `High memory usage detected (${usedMB}MB/${limitMB}MB). This page has likely accumulated state from long use and may crash soon (Aw, Snap! error). Please refresh the page now (Cmd/Ctrl + R) to reset memory.`;

        recordLogs({
          type: "warning",
          message: `High memory usage: ${usedMB}MB`,
          usedMB,
          limitMB,
        });
      }
    }, 30000);

    return () => clearInterval(memoryInterval);
  }, [setSnackbarMessage]);

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

  // Load outline from node.pathIds (batched) or primaryParentId chain; expand loads specializations.
  useEffect(() => {
    if (hasInstantUpdateRef.current) {
      return;
    }
    void loadPathOutline();
  }, [
    currentVisibleNode?.id,
    currentVisibleNode?.pathIds,
    currentVisibleNode?.primaryParentId,
    loadPathOutline,
  ]);

  // Handler for expanding ellipsis nodes
  const handleExpandEllipsis = useCallback((ellipsisNodeId: string) => {
    setCurrentNodeTreeData((prevTree) => {
      const expandedTree = expandEllipsisNode(prevTree, ellipsisNodeId);
      return expandedTree;
    });
  }, []);

  useEffect(() => {
    if (!currentVisibleNode) return;

    const _inheritanceDetails: any = {};

    const _currentVisibleNode = { ...currentVisibleNode };

    let parts = _currentVisibleNode?.properties?.parts || [];

    const generalizations = (
      _currentVisibleNode?.generalizations || []
    ).flatMap((c) => c.nodes);
    const checkGeneralizations = (
      partId: string,
    ): { genId: string; partOf: string | null }[] | null => {
      let inheritanceDetails: { genId: string; partOf: string | null }[] = [];

      for (let generalization of generalizations) {
        if (!relatedNodes[generalization.id]) {
          continue;
        }
        let generalizationParts =
          relatedNodes[generalization.id]?.properties?.parts;

        if (!generalizationParts || !generalizationParts[0]) {
          continue;
        }

        const partIdex = generalizationParts[0].nodes.findIndex(
          (c) => c.id === partId,
        );

        let partOfIdx: any = -1;

        if (partIdex === -1) {
          for (let { id } of generalizationParts[0].nodes) {
            const specializationPart = (
              relatedNodes[id]?.specializations || []
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
          const ontologyPathForPart = eachNodePath[partId] ?? [];

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

    if (parts && parts[0]) {
      for (let node of parts[0].nodes) {
        if (relatedNodes[node.id]) {
          _inheritanceDetails[node.id] = checkGeneralizations(node.id);
        }
      }
    }
    setPartsInheritance(_inheritanceDetails);
  }, [currentVisibleNode, relatedNodes, eachNodePath]);
  if (!isPageReady) {
    return <FullPageLogoLoading />;
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background:
          theme.palette.mode === "dark"
            ? "linear-gradient(150deg, #060608 0%, #14141c 30%, #3a3a48 60%, #101014 100%)"
            : "linear-gradient(150deg, #ffffff 0%, #8fa0b8 40%, #c8d6e8 70%, #eef4fc 100%)",
      }}
    >
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
              searchWithFuse={searchWithFuse}
              lastSearches={lastSearches}
              updateLastSearches={updateLastSearches}
              appName={appName}
              isExperimentalSearch={isExperimentalSearch}
              onSearchChange={(value) => setSidebarSearchValue(value)}
              onFocusChange={setIsSidebarSearchFocused}
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
          {appName && (
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
                  id="mobile-property-type"
                  value={appName}
                  onChange={(event) => {
                    setIsPageReady(false);
                    setRelatedNodes({});
                    isSwitchingAppRef.current = true;
                    const app = event.target.value.replaceAll(" ", "_");
                    router.replace(`/${app}`);
                    setCurrentNodeTreeData([]);
                  }}
                  label="Property Type"
                  sx={{ borderRadius: "20px" }}
                >
                  {ontologyAppsTopGroup.map(({ id, name }) => (
                    <MenuItem key={id} value={id}>
                      {name}
                    </MenuItem>
                  ))}
                  {ontologyAppsOtherGroup.length > 0 && (
                    <ListSubheader disableSticky>
                      Other Ontologies
                    </ListSubheader>
                  )}
                  {ontologyAppsOtherGroup.map(({ id, name }) => (
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
              paddingTop: appName ? "0" : "16px", // Add top padding only if no ontology selector
              opacity: mobileTreeOpen ? 1 : 0,
              transition: "opacity 0.3s ease-in-out",
              ...SCROLL_BAR_STYLE,
            }}
          >
            {mobileTreeOpen && (
              <>
                {pathOutlineMessage && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", px: 1, py: 0.5 }}
                  >
                    {pathOutlineMessage}
                  </Typography>
                )}
                {isLoadingOutline && currentNodeTreeData.length === 0 ? (
                  <TreeOutlineSkeleton />
                ) : (
                  <DraggableTree
                    treeViewData={currentNodeTreeData}
                    setSnackbarMessage={setSnackbarMessage}
                    treeRef={treeRef}
                    currentVisibleNode={currentVisibleNode}
                    nodes={relatedNodes}
                    onOpenNodesTree={(nodeId: string) => {
                      onOpenNodesTree(nodeId);
                      // Don't close tree on node selection to allow parallel browsing
                    }}
                    appName={appName}
                    specializationNumsUnder={specializationNumsUnder}
                    nodesWithComments={nodesWithComments}
                    onOutlineNodeOpen={handleOutlineNodeOpen}
                    searchTerm={
                      isSidebarSearchFocused ? "" : sidebarSearchValue
                    }
                  />
                )}
              </>
            )}
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
            searchWithFuse={searchWithFuse}
            relatedNodes={relatedNodes}
            fetchNode={fetchNode}
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
            appName={appName}
            isExperimentalSearch={isExperimentalSearch}
            setIsExperimentalSearch={setIsExperimentalSearch}
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

      <Container
        style={{
          height: "100vh",
          display: "flex",
          overflow: "hidden",
          backgroundColor: "transparent",
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
                width: "100%",
                backgroundColor: (theme) =>
                  theme.palette.mode === "dark" ? "#191c21" : "#eaecf0",
              }}
            >
              {" "}
              {appName && (
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
                      id="property-type"
                      value={appName}
                      onChange={(event) => {
                        setIsPageReady(false);
                        setRelatedNodes({});
                        isSwitchingAppRef.current = true;
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
                            pb: "15px",
                          },
                        },
                      }}
                    >
                      {ontologyAppsTopGroup.map(({ id, name }) => (
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
                      {ontologyAppsOtherGroup.length > 0 && (
                        <ListSubheader
                          disableSticky
                          sx={{ fontSize: "16px", mt: "12px" }}
                        >
                          Other Ontologies:
                        </ListSubheader>
                      )}
                      {ontologyAppsOtherGroup.map(({ id, name }) => (
                        <MenuItem
                          key={id}
                          value={id}
                          sx={{
                            borderRadius: "25px",
                            mt: "3px",
                            mx: "13px",
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
                searchWithFuse={searchWithFuse}
                lastSearches={lastSearches}
                updateLastSearches={updateLastSearches}
                appName={appName}
                isExperimentalSearch={isExperimentalSearch}
                onSearchChange={(value) => setSidebarSearchValue(value)}
                onFocusChange={setIsSidebarSearchFocused}
              />{" "}
              <Divider sx={{ borderBottomWidth: 1.5, borderColor: "gray" }} />
              <Tabs
                value={viewValue}
                onChange={handleViewChange}
                sx={{
                  width: "100%",
                  minHeight: "50px",
                  height: "50px",
                  p: 0.25,
                  borderRadius: "999px",
                  display: "flex",
                  alignItems: "center",

                  borderColor: (theme) =>
                    theme.palette.mode === "dark"
                      ? "rgba(255, 255, 255, 0.16)"
                      : "rgba(15, 23, 42, 0.12)",
                  "& .MuiTabs-indicator": {
                    display: "none",
                  },
                  "& .MuiTabs-scroller": {
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                  },
                  "& .MuiTabs-flexContainer": {
                    gap: "6px",
                    alignItems: "center",
                    width: "100%",
                  },
                  "& .MuiTab-root": {
                    top: "1px",
                  },
                  px: "8px",
                }}
              >
                <Tab
                  label="Outline"
                  {...a11yProps(0)}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    maxWidth: "none",
                    minHeight: "38px",
                    height: "38px",
                    p: 0,
                    textTransform: "none",
                    fontSize: "15px",
                    fontWeight: 700,
                    lineHeight: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: (theme) =>
                      theme.palette.mode === "dark" ? "#9fb0c6" : "#475569",
                    borderRadius: "999px",
                    border: "2px solid",
                    borderColor: "transparent",
                    backgroundColor: (theme) =>
                      theme.palette.mode === "dark"
                        ? "rgba(148, 163, 184, 0.06)"
                        : "rgba(255, 255, 255, 0.5)",
                    transition: "all 150ms ease",
                    "&:hover": {
                      backgroundColor: (theme) =>
                        theme.palette.mode === "dark"
                          ? "rgba(148, 163, 184, 0.14)"
                          : "rgba(255, 255, 255, 0.8)",
                    },
                    "&.Mui-selected": {
                      color: "#ffffff",
                      borderColor: (theme) =>
                        theme.palette.mode === "dark" ? "#ff9b3d" : "#f97316",
                      background: (theme) =>
                        theme.palette.mode === "dark"
                          ? "linear-gradient(180deg, #ffb15c 0%, #ff8a1f 100%)"
                          : "linear-gradient(180deg, #fb923c 0%, #ea580c 100%)",
                      boxShadow:
                        "0 4px 12px rgba(249, 115, 22, 0.38), inset 0 1px 0 rgba(255,255,255,0.28)",
                    },
                  }}
                />
                <Tab
                  label="Graph View"
                  {...a11yProps(1)}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    maxWidth: "none",
                    minHeight: "38px",
                    height: "38px",
                    p: 0,
                    textTransform: "none",
                    fontSize: "15px",
                    fontWeight: 700,
                    lineHeight: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: (theme) =>
                      theme.palette.mode === "dark" ? "#9fb0c6" : "#475569",
                    borderRadius: "999px",
                    border: "2px solid",
                    borderColor: "transparent",
                    backgroundColor: (theme) =>
                      theme.palette.mode === "dark"
                        ? "rgba(148, 163, 184, 0.06)"
                        : "rgba(255, 255, 255, 0.5)",
                    transition: "all 150ms ease",
                    "&:hover": {
                      backgroundColor: (theme) =>
                        theme.palette.mode === "dark"
                          ? "rgba(148, 163, 184, 0.14)"
                          : "rgba(255, 255, 255, 0.8)",
                    },
                    "&.Mui-selected": {
                      color: "#ffffff",
                      borderColor: (theme) =>
                        theme.palette.mode === "dark" ? "#ff9b3d" : "#f97316",
                      background: (theme) =>
                        theme.palette.mode === "dark"
                          ? "linear-gradient(180deg, #ffb15c 0%, #ff8a1f 100%)"
                          : "linear-gradient(180deg, #fb923c 0%, #ea580c 100%)",
                      boxShadow:
                        "0 4px 12px rgba(249, 115, 22, 0.38), inset 0 1px 0 rgba(255,255,255,0.28)",
                    },
                  }}
                />
              </Tabs>
            </Box>

            <Box
              sx={{
                flexGrow: 1,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
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
                  flex: 1,
                  minHeight: 0,
                  overflowX: "auto",
                  overflowY: "hidden",
                  whiteSpace: "nowrap",
                  "&::-webkit-scrollbar": {
                    display: "none",
                  },
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    minHeight: 0,
                    minWidth: "100%",
                  }}
                >
                  {pathOutlineMessage && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block", px: 1, py: 0.5 }}
                    >
                      {pathOutlineMessage}
                    </Typography>
                  )}
                  {isLoadingOutline && currentNodeTreeData.length === 0 ? (
                    <TreeOutlineSkeleton />
                  ) : (
                    <DraggableTree
                      treeViewData={currentNodeTreeData}
                      setSnackbarMessage={setSnackbarMessage}
                      treeRef={treeRef}
                      currentVisibleNode={currentVisibleNode}
                      nodes={relatedNodes}
                      onOpenNodesTree={onOpenNodesTree}
                      appName={appName}
                      specializationNumsUnder={specializationNumsUnder}
                      onInstantTreeUpdate={handleInstantTreeUpdate}
                      onExpandEllipsis={handleExpandEllipsis}
                      nodesWithComments={nodesWithComments}
                      onOutlineNodeOpen={handleOutlineNodeOpen}
                      searchTerm={
                        isSidebarSearchFocused ? "" : sidebarSearchValue
                      }
                    />
                  )}
                </Box>
              </TabPanel>
              <TabPanel value={viewValue} index={1}>
                <GraphView
                  treeData={currentNodeTreeData}
                  setExpandedNodes={setExpandedNodes}
                  expandedNodes={expandedNodes}
                  onOpenNodeDagre={onOpenNodeDagre}
                  currentVisibleNode={currentVisibleNode}
                />
              </TabPanel>
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
              p: "20px",
              pt: 0,
              overflow: "auto",
              height: isMobile
                ? mobileTreeOpen
                  ? "calc(100vh - 56px - 50vh)"
                  : "calc(100vh - 56px)"
                : "100vh",
              transition: isMobile ? "height 0.3s ease-in-out" : "none",
              "&::-webkit-scrollbar": {
                display: "none",
              },
            }}
          >
            <Box ref={scrolling}></Box>
            {displayGuidelines && (
              <GuidLines
                appName={appName}
                setDisplayGuidelines={setDisplayGuidelines}
              />
            )}
            {navigationError && (
              <NavigationError
                type={navigationError.type}
                onGoBack={() => {
                  setNavigationError(null);
                  window.history.back();
                }}
              />
            )}
            {currentVisibleNode &&
              user &&
              !displayGuidelines &&
              !navigationError && (
                <Node
                  currentVisibleNode={
                    currentImprovement?.node || currentVisibleNode
                  }
                  setCurrentVisibleNode={setCurrentVisibleNode}
                  setSnackbarMessage={setSnackbarMessage}
                  user={user}
                  mainSpecializations={mainSpecializations}
                  relatedNodes={relatedNodes}
                  fetchNode={fetchNode}
                  addNodesToCache={addNodesToCache}
                  navigateToNode={navigateToNode}
                  eachOntologyPath={eachNodePath}
                  searchWithFuse={searchWithFuse}
                  locked={!!currentVisibleNode.locked && !user?.manageLock}
                  isLoadingNodeDetails={isLoadingNodeDetails}
                  selectedDiffNode={selectedDiffNode}
                  displaySidebar={displaySidebar}
                  activeSidebar={activeSidebar}
                  currentImprovement={currentImprovement}
                  setRelatedNodes={setRelatedNodes}
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
                  appName={appName}
                  enableEdit={enableEdit}
                  setEnableEdit={setEnableEdit}
                  editableProperty={editableProperty}
                  setEditableProperty={setEditableProperty}
                  onInstantTreeUpdate={handleInstantTreeUpdate}
                  nodesWithComments={nodesWithComments}
                  onOpenInNavigator={onOpenInNavigator}
                />
              )}
          </Box>
        </Section>

        <MemoizedToolbarSidebar
          // isHovered={toolbarIsHovered}
          searchWithFuse={searchWithFuse}
          toolbarRef={toolbarRef}
          user={user}
          openSearchedNode={openSearchedNode}
          relatedNodes={relatedNodes}
          fetchNode={fetchNode}
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
          appName={appName}
          isExperimentalSearch={isExperimentalSearch}
          setIsExperimentalSearch={setIsExperimentalSearch}
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
export default Ontology;
