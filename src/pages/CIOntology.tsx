/* 
## Overview

The `CIOntology` component is a complex React component that serves as the main interface for managing and visualizing ontologies within a collaborative platform. It integrates with Firebase Firestore for data persistence, provides search functionality using Fuse.js, and offers a rich user interface with Material-UI components.

## Features

- **Ontology Management**: Users can create, update, and delete ontology entities.
- **Real-time Updates**: Leveraging Firebase's `onSnapshot` to listen for real-time updates to ontologies.
- **Search Functionality**: Implements search using Fuse.js to quickly find ontology entities.
- **Responsive Design**: Adapts to different screen sizes using `useMediaQuery`.
- **TreeView and DAG Visualization**: Offers two modes of visualizing ontologies - a simplified tree view and a directed acyclic graph (DAG) view.
- **Comments Section**: Allows users to add, edit, and delete comments on ontology entities.
- **Markdown Support**: Includes a Markdown cheatsheet and renders comments as Markdown.

## Dependencies

- `@column-resizer/react`: For resizable layout sections.
- `@mui/material`: Material-UI components for the user interface.
- `firebase/firestore`: Firestore database for storing ontologies and related data.
- `fuse.js`: For fuzzy search capabilities.
- `moment`: For date manipulation and formatting.
- `react`: Core React library.
- `next/router`: For routing in Next.js applications.

## Component Structure

- **Container**: Wraps the entire layout, providing a margin at the top.
- **Section**: Represents a resizable section of the layout.
- **Bar**: A draggable bar for resizing adjacent sections.
- **Tabs**: For switching between different views (Tree View, DAG View, Search, Comments, Markdown Cheatsheet).
- **TreeViewSimplified**: A component for rendering the tree view of ontologies.
- **DAGGraph**: A component for rendering the DAG view of ontologies.
- **Ontology**: A component for displaying and editing a single ontology entity.
- **MarkdownRender**: Renders Markdown content.
- **AppHeaderMemoized**: The application header component.

## Usage

The `CIOntology` component is designed to be used within a Next.js application and requires authentication context provided by `withAuthUser`.

## Code Snippets

### Firestore Data Fetching

```tsx
useEffect(() => {
  const ontologyQuery = query(
    collection(db, "ontology"),
    where("deleted", "==", false)
  );
  const unsubscribeOntology = onSnapshot(ontologyQuery, (snapshot) => {
    // Handle document changes
  });
  return () => unsubscribeOntology();
}, [db]);
```

### Search Functionality

```tsx
const fuse = new Fuse(ontologies, { keys: ["title"] });

const searchWithFuse = (query: string): any => {
  if (!query) {
    return [];
  }
  return fuse
    .search(query)
    .map((result) => result.item)
    .filter((item: any) => !item.deleted);
};
```

### Comment Handling

```tsx
const handleSendComment = async () => {
  // Logic to add a new comment to an ontology
};

const deleteComment = async (commentId: string) => {
  // Logic to delete a comment from an ontology
};

const editComment = async (comment: any) => {
  // Logic to edit an existing comment on an ontology
};
```

## Contributing

Contributions to the `CIOntology` component are welcome. Please ensure you follow the project's coding standards and submit a pull request with a detailed description of your changes. */

import { Bar, Container, Section } from "@column-resizer/react";
import SearchIcon from "@mui/icons-material/Search";
import SendIcon from "@mui/icons-material/Send";
import SettingsEthernetIcon from "@mui/icons-material/SettingsEthernet";
import {
  Avatar,
  Box,
  Button,
  IconButton,
  Link,
  List,
  ListItem,
  Paper,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import {
  Timestamp,
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
} from "firebase/firestore";
import Fuse from "fuse.js";
import moment from "moment";
import { useCallback, useEffect, useRef, useState } from "react";
import markdownContent from "../components/ontology/Markdown-Here-Cheatsheet.md";
import SneakMessage from " @components/components/ontology/SneakMessage";
import Ontology from " @components/components/ontology/Ontology";
import TreeViewSimplified from " @components/components/ontology/TreeViewSimplified";
import {
  ILockedOntology,
  IOntology,
  IOntologyPath,
  ISubOntology,
  MainSpecializations,
  TreeVisual,
} from " @components/types/IOntology";
import { TabPanel, a11yProps } from " @components/lib/utils/TabPanel";
import MarkdownRender from " @components/components/Markdown/MarkdownRender";
import AppHeaderMemoized from " @components/components/Header/AppHeader";
import { newId } from " @components/lib/utils/newFirestoreId";
import { DESIGN_SYSTEM_COLORS } from " @components/lib/theme/colors";
import useConfirmDialog from " @components/lib/hooks/useConfirmDialog";
import withAuthUser from " @components/components/hoc/withAuthUser";
import { useAuth } from " @components/components/context/AuthContext";
import { useRouter } from "next/router";
import DAGGraph from " @components/components/ontology/DAGGraph";
import { formatFirestoreTimestampWithMoment } from " @components/lib/utils/utils";
import { ONTOLOGY_TYPES } from "./CONSTANTS";

const CIOntology = () => {
  const db = getFirestore();
  const [{ emailVerified, user }] = useAuth();
  const router = useRouter();
  const isMobile = useMediaQuery("(max-width:599px)");

  const [ontologies, setOntologies] = useState<IOntology[]>([]);
  const [openOntology, setOpenOntology] = useState<any>(null);
  const [ontologyPath, setOntologyPath] = useState<IOntologyPath[]>([]);
  const [snackbarMessage, setSnackbarMessage] = useState<string>("");
  const [treeVisualisation, setTreeVisualisation] = useState<TreeVisual>({});
  const [editOntology, setEditOntology] = useState<string>("");
  const [newComment, setNewComment] = useState("");
  const [updateComment, setUpdateComment] = useState("");
  const { confirmIt, ConfirmDialog } = useConfirmDialog();
  const [editingComment, setEditingComment] = useState("");
  const [lockedOntology, setLockedOntology] = useState<ILockedOntology>({});
  const [value, setValue] = useState<number>(1);
  const [viewValue, setViewValue] = useState<number>(0);
  const [searchValue, setSearchValue] = useState("");
  const fuse = new Fuse(ontologies, { keys: ["title"] });
  const headerRef = useRef<HTMLHeadElement | null>(null);
  const [expandedOntologies, setExpandedOntologies] = useState<Set<string>>(
    new Set()
  );
  const [dagreZoomState, setDagreZoomState] = useState<any>(null);

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

  /**
   * Constructs a path based on the provided array of ontology IDs.
   * @param newPath - An array of ontology IDs representing the desired path.
   * @returns An array containing objects with 'id' and 'title' properties, representing the ontology path.
   */
  const getPath = (newPath: string[]) => {
    // Initialize an empty array to store the constructed ontology path
    const ontologyPath = [];

    // Iterate through each ontology ID in the provided array
    for (let path of newPath) {
      // Find the index of the ontology with the current ID in the 'ontologies' array
      const ontologyIdx = ontologies.findIndex((onto: any) => onto.id === path);

      // Check if the ontology with the current ID was found
      if (ontologyIdx !== -1) {
        // If found, add an object to the ontologyPath array with 'id' and 'title' properties
        ontologyPath.push({
          id: path,
          title: ontologies[ontologyIdx].title,
          category: ontologies[ontologyIdx].category,
        });
      }
      // If not found, the ontology with the current ID is skipped in the final path
    }

    // Return the constructed ontology path
    return ontologyPath;
  };

  // Function to generate a tree structure of specializations based on main ontologies
  const getSpecializationsTree = ({ mainOntologies, path }: any) => {
    // Object to store the main specializations tree
    let newSpecializationsTree: any = {};

    // Iterate through each main ontology
    for (let ontology of mainOntologies) {
      // Create an entry for the current ontology in the main specializations tree
      newSpecializationsTree[ontology.title] = {
        id: ontology.id,
        path: [...path, ontology.id],
        isCategory: !!ontology.category,
        title: ontology.title,
        specializations: {},
      };

      // Iterate through each category in the Specializations sub-ontologies
      for (let category in ontology?.subOntologies?.Specializations) {
        // Filter ontologies based on the current category
        const specializations =
          ontologies.filter((onto: any) => {
            const arrayOntologies = ontology?.subOntologies?.Specializations[
              category
            ]?.ontologies.map((o: any) => o.id);
            return arrayOntologies.includes(onto.id);
          }) || [];

        // Check if the category is the main category
        if (category === "main") {
          // If main, update the main specializations entry with recursive call
          newSpecializationsTree[ontology.title] = {
            id: ontology.id,
            path: [...path, ontology.id],
            isCategory: !!ontology.category,
            title: ontology.title,
            specializations: {
              ...(newSpecializationsTree[ontology.title]?.specializations ||
                {}),
              ...getSpecializationsTree({
                mainOntologies: specializations,
                path: [...path, ontology.id],
              }),
            },
          };
        } else {
          // If not main, create a new entry for the category
          newSpecializationsTree[ontology.title] = {
            id: ontology.id,
            path: [...path, ontology.id],
            title: ontology.title,
            c: ontology.category,
            specializations: {
              ...(newSpecializationsTree[ontology.title]?.specializations ||
                {}),
              [category]: {
                isCategory: true,
                id: newId(db), // Assuming newId and db are defined elsewhere
                title: category,
                specializations: getSpecializationsTree({
                  mainOntologies: specializations,
                  path: [...path, ontology.id],
                }),
              },
            },
          };
        }
      }
    }

    // Return the main specializations tree
    return newSpecializationsTree;
  };

  const recordLogs = async (logs: any) => {
    try {
      if (!user) return;
      const ontologyLogRef = doc(collection(db, "ontologyLog"));
      await setDoc(ontologyLogRef, {
        ...logs,
        createdAt: new Date(),
        doer: user?.uname,
      });
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    // Filter ontologies to get only those with a defined category
    const mainOntologies = ontologies.filter(
      (ontology: any) => ontology.category
    );

    // Sort main ontologies based on a predefined order
    mainOntologies.sort((a: any, b: any) => {
      const order = [
        "WHAT: Activities",
        "WHO: Actors",
        "HOW: Processes",
        "WHY: Evaluation",
      ];
      return order.indexOf(a.title) - order.indexOf(b.title);
    });

    // Generate a tree structure of specializations from the sorted main ontologies
    let treeOfSpecialisations = getSpecializationsTree({
      mainOntologies,
      path: [],
    });

    // Set the generated tree structure for visualization
    setTreeVisualisation(treeOfSpecialisations);
  }, [ontologies]);

  const updateTheUrl = (path: IOntologyPath[]) => {
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
        updateUserDoc(window.location.hash.split("#"));
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
  }, []);

  useEffect(() => {
    // Check if user or ontologies are not available, then return early
    if (!user) return;
    if (!ontologies.length) return;

    // Query the database for the user based on userId
    const userQuery = query(
      collection(db, "users"),
      where("userId", "==", user.userId)
    );

    // Set up a snapshot listener for changes in the user data
    const unsubscribeUser = onSnapshot(userQuery, (snapshot) => {
      // Get the first document change from the snapshot
      const docChange = snapshot.docChanges()[0];

      // Get the data from the document change
      const dataChange = docChange.doc.data();

      // Set the ontologyPath in the component state
      setOntologyPath(getPath(dataChange?.ontologyPath || []));

      // Update the URL based on the ontologyPath
      updateTheUrl(getPath(dataChange?.ontologyPath || []));

      // Get the last ontology in the ontologyPath or an empty string if none
      const lastOntology = dataChange?.ontologyPath?.reverse()[0] || "";

      // Find the index of the last ontology in the ontologies array
      const ontologyIdx = ontologies.findIndex(
        (ontology: any) => ontology.id === lastOntology
      );

      // If the ontology is found, set it as the open ontology in the component state
      if (ontologies[ontologyIdx]) setOpenOntology(ontologies[ontologyIdx]);
    });

    // Cleanup function: Unsubscribe from the user data snapshot listener
    return () => unsubscribeUser();
  }, [db, user, ontologies]);

  useEffect(() => {
    // Check if a user is logged in
    if (!user) return;

    // Define the ontology query
    const ontologyQuery = query(
      collection(db, "ontologyLock"),
      where("deleted", "==", false)
    );

    // Subscribe to changes in the ontologyLock collection
    const unsubscribeOntology = onSnapshot(ontologyQuery, (snapshot) => {
      // Get the document changes in the snapshot
      const docChanges = snapshot.docChanges();

      // Update the lockedOntology state based on the document changes
      setLockedOntology((lockedOntology: ILockedOntology) => {
        let _lockedOntology = { ...lockedOntology };

        // Iterate through each document change
        for (let change of docChanges) {
          const changeData: any = change.doc.data();

          // Handle removed documents
          if (
            change.type === "removed" &&
            _lockedOntology.hasOwnProperty(changeData.ontology)
          ) {
            delete _lockedOntology[changeData.ontology][changeData.field];
          }
          // Handle added documents
          else if (change.type === "added") {
            _lockedOntology = {
              ..._lockedOntology,
              [changeData.ontology]: {
                ..._lockedOntology[changeData.ontology],
                [changeData.field]: {
                  id: change.doc.id,
                  ...changeData,
                },
              },
            };
          }
        }

        // Return the updated lockedOntology state
        return _lockedOntology;
      });
    });

    // Unsubscribe from the ontologyLock collection when the component is unmounted
    return () => unsubscribeOntology();

    // Dependency array includes user and db, meaning the effect will re-run if user or db changes
  }, [user, db]);

  /* 
 // TO:DO: Load only the data that the user is currently navigating through, 
 to optimize for performance when the database get's larger
 */
  useEffect(() => {
    // Create a query for the "ontology" collection where "deleted" is false
    const ontologyQuery = query(
      collection(db, "ontology"),
      where("deleted", "==", false)
    );

    // Set up a snapshot listener to track changes in the ontology collection
    const unsubscribeOntology = onSnapshot(ontologyQuery, (snapshot) => {
      // Get the changes (added, modified, removed) in the snapshot
      const docChanges = snapshot.docChanges();

      // Update the state based on the changes in the ontology collection
      setOntologies((ontologies: IOntology[]) => {
        const _ontologies = [...ontologies];

        // Loop through each change in the snapshot
        for (let change of docChanges) {
          const changeData: any = change.doc.data();

          // Find the index of the document in the current state
          const previousIdx = _ontologies.findIndex(
            (d) => d.id === change.doc.id
          );

          // Check the type of change and update the state accordingly
          if (change.type === "removed" && previousIdx !== -1) {
            // If the document is removed, remove it from the state
            _ontologies.splice(previousIdx, 1);
          } else if (previousIdx !== -1) {
            // If the document is modified, update its data in the state
            _ontologies[previousIdx] = { id: change.doc.id, ...changeData };
          } else {
            // If the document is added, add it to the state
            _ontologies.push({
              id: change.doc.id,
              ...changeData,
            });
          }
        }

        // Return the updated state
        return _ontologies;
      });
    });

    // Unsubscribe from the snapshot listener when the component is unmounted
    return () => unsubscribeOntology();

    // TO:DO: Load only the data that the user is currently navigating through, optimize for performance
  }, [db]);

  // Function to get the parent ID based on the ontology type
  const getParent = (type: string) => {
    if (type === "Evaluation") {
      return treeVisualisation["WHY: Evaluation"].id;
    } else if (type === "Actor") {
      return treeVisualisation["WHO: Actors"].id;
    } else if (type === "Process") {
      return treeVisualisation["HOW: Processes"].id;
    }
  };

  // Callback function to handle navigation when a link is clicked
  const handleLinkNavigation = useCallback(
    async (path: { id: string; title: string }, type: string) => {
      try {
        // Check if user is logged in and ontology is open
        if (!user || !openOntology) return;

        // Check if the clicked ontology is already in the ontologies list
        if (
          ontologies
            .filter((ontology: any) => ontology.category)
            .map((o: any) => o.title)
            .includes(path.title)
        )
          return;

        // Find index of the clicked ontology in the ontologies array
        const ontologyIndex = ontologies.findIndex(
          (ontology: any) => ontology.id === path.id
        );

        // Update the open ontology or add a new ontology if not in the list
        if (ontologyIndex !== -1) {
          setOpenOntology(ontologies[ontologyIndex]);
        } else {
          const parent = getParent(ONTOLOGY_TYPES[type].ontologyType);
          const parentSet: any = new Set([openOntology.id, parent]);
          const parents = [...parentSet];
          const newOntology = ONTOLOGY_TYPES[type];
          addNewOntology({
            id: path.id,
            newOntology: { parents, ...newOntology },
          });
          setOpenOntology({ id: path.id, ...newOntology, parents });
        }

        // Update ontology path and user document
        let _ontologyPath = [...ontologyPath];
        const pathIdx = _ontologyPath.findIndex((p: any) => p.id === path.id);
        if (pathIdx !== -1) {
          _ontologyPath = _ontologyPath.slice(0, pathIdx + 1);
        } else {
          _ontologyPath.push(path);
        }

        await updateUserDoc([..._ontologyPath.map((onto) => onto.id)]);
      } catch (error) {
        console.error(error);
      }
    },
    [ontologies, ontologyPath]
  );

  // Function to update the user document with the current ontology path
  const updateUserDoc = async (ontologyPath: string[]) => {
    if (!user) return;

    // Query to get the user document
    const userQuery = query(
      collection(db, "users"),
      where("userId", "==", user.userId)
    );
    const userDocs = await getDocs(userQuery);
    const userDoc = userDocs.docs[0];

    // Update the user document with the ontology path
    await updateDoc(userDoc.ref, { ontologyPath });

    // Record logs if ontology path is not empty
    if (ontologyPath.length > 0) {
      await recordLogs({
        action: "Opened a page",
        page: ontologyPath[ontologyPath.length - 1],
      });
    }
  };

  // Callback function to add a new ontology to the database
  const addNewOntology = useCallback(
    async ({ id, newOntology }: { id: string; newOntology: any }) => {
      try {
        // Reference to the new ontology document
        const newOntologyRef = doc(collection(db, "ontology"), id);

        // Set the document with the new ontology data
        await setDoc(newOntologyRef, { ...newOntology, deleted: false });

        // Record logs for the created ontology
        await recordLogs({
          action: "Created a field",
          field: newOntology.ontologyType,
        });

        // Set the newly created ontology as editable
        setEditOntology(id);
      } catch (error) {
        console.error(error);
      }
    },
    [ontologies]
  );

  // This function adds a sub-ontology to a parent ontology in a Firestore database.
  // It takes the type and id of the sub-ontology as parameters.

  const addSubOntologyToParent = async (type: string, id: string) => {
    // Get the ID of the parent ontology based on the provided type.
    const parentId = getParent(type);

    // Check if a parent ID exists.
    if (parentId) {
      // Find the parent ontology in the ontologies array.
      const parent: any = ontologies.find(
        (ontology: any) => ontology.id === parentId
      );

      // Get a reference to the parent ontology in Firestore.
      const ontologyRef = doc(collection(db, "ontology"), parentId);

      // Extract the Specializations array from the parent ontology.
      const specializations = parent.subOntologies.Specializations;

      // Find the index of the sub-ontology in the Specializations array.
      const specializationIdx = parent.subOntologies.Specializations.findIndex(
        (spcial: any) => spcial.id === id
      );

      // If the sub-ontology is not already in the array, add it.
      if (specializationIdx === -1) {
        specializations.push({
          id,
          title: "",
        });
      }

      // Update the Specializations array in the parent ontology.
      parent.subOntologies.Specializations = specializations;

      // Update the parent ontology in Firestore with the modified data.
      await updateDoc(ontologyRef, parent);
    }
  };

  // Function to save a sub-ontology with given parameters
  const saveSubOntology = async (
    subOntology: ISubOntology, // The sub-ontology object to be saved
    type: string, // The type of sub-ontology (e.g., "Specializations" or "Evaluation Dimensions")
    id: string // The ID of the parent ontology to which the sub-ontology belongs
  ) => {
    try {
      // Check if the parent ontology is open; if not, return
      if (!openOntology) return;

      // Reference to the parent ontology document in the database
      const ontologyParentRef = doc(collection(db, "ontology"), id);
      // Retrieve the parent ontology document
      const ontologyParentDoc = await getDoc(ontologyParentRef);
      // Extract data from the parent ontology document
      const ontologyParent: any = ontologyParentDoc.data();
      // If the parent ontology does not exist, return
      if (!ontologyParent) return;

      // Find the index of the sub-ontology within the specified type in the parent ontology
      const idx = ontologyParent.subOntologies[type].findIndex(
        (sub: ISubOntology) => sub.id === subOntology.id
      );

      // If the sub-ontology is not found, add it; otherwise, update its title
      if (idx === -1) {
        ontologyParent.subOntologies[type].push({
          title: subOntology.title,
          id: subOntology.id,
        });
      } else {
        ontologyParent[type][idx].title = subOntology.title;
      }

      // Reference to the new sub-ontology document in the database
      const newOntologyRef = doc(collection(db, "ontology"), subOntology.id);
      // Retrieve the new sub-ontology document
      const newOntologyDoc = await getDoc(newOntologyRef);

      // If the new sub-ontology document exists, update its title
      if (newOntologyDoc.exists()) {
        await updateDoc(newOntologyRef, { title: subOntology.title });
      }

      // Update the parent ontology document with the modified data
      await updateDoc(ontologyParentRef, ontologyParent);

      // Determine the sub-ontology type for navigation purposes
      let subOntologyType = type;
      if (type === "Specializations") {
        subOntologyType = ontologyParent.ontologyType;
      }
      if (type === "Evaluation Dimensions") {
        subOntologyType = "Evaluation";
      }

      // Trigger a navigation function with the sub-ontology details and type
      handleLinkNavigation(
        { id: subOntology.id, title: subOntology.title },
        subOntologyType
      );

      // Add the sub-ontology to its parent in the ontology hierarchy
      await addSubOntologyToParent(subOntologyType, subOntology.id);
    } catch (error) {
      // Log any errors that occur during the execution of the function
      console.error(error);
    }
  };

  // Define a callback function to handle the opening of the ontology DAGRE view.
  const onOpenOntologyDagre = useCallback(
    async (ontologyId: string) => {
      // Check if a user is logged in, if not, exit the function.
      if (!user) return;

      // Find the index of the ontology with the specified ID in the ontologies array.
      const ontologyIdx = ontologies.findIndex(
        (onto: any) => onto.id === ontologyId
      );

      // Filter out main ontologies (ontologies with a category).
      const mainOntologies = ontologies.filter(
        (ontology: any) => ontology.category
      );

      // Initialize an object to store the path of each ontology in the DAGRE view.
      let eachOntologyPath = findOntologyPath({
        mainOntologies,
        path: [],
        eachOntologyPath: {},
      });

      // Check if the ontology with the specified ID exists and is not a main ontology (no category).
      if (ontologyIdx !== -1 && !ontologies[ontologyIdx].category) {
        // Set the opened ontology as the currently selected ontology.
        setOpenOntology(ontologies[ontologyIdx]);

        // Record logs for the action of opening the DAGRE view for the ontology.
        await recordLogs({
          action: "opened dagre-view",
          itemClicked: ontologies[ontologyIdx].id,
        });

        // Update the user document with the ontology path.
        await updateUserDoc([
          ...(eachOntologyPath[ontologyId] || [ontologyId]),
        ]);
      }
    },
    // Dependency array includes ontologies and user, ensuring the function re-renders when these values change.
    [ontologies, user]
  );

  // Function to handle opening ontology tree
  const onOpenOntologyTree = useCallback(
    async (ontologyId: string, path: string[]) => {
      // Check if user is logged in
      if (!user) return;
      //update the expanded state
      setExpandedOntologies((prevExpanded: Set<string>) => {
        prevExpanded.add(ontologyId);
        return prevExpanded;
      });
      // Find the index of the ontology in the ontologies array
      const ontologyIdx = ontologies.findIndex(
        (onto: any) => onto.id === ontologyId
      );

      // Check if ontology exists and has a category
      if (ontologyIdx !== -1 && !ontologies[ontologyIdx].category) {
        // Set the currently open ontology
        setOpenOntology(ontologies[ontologyIdx]);

        // Record logs for the action of clicking the tree-view
        await recordLogs({
          action: "clicked tree-view",
          itemClicked: ontologies[ontologyIdx].id,
        });

        // Update user document with the path
        await updateUserDoc(path);
      }
    },
    [ontologies, user]
  );

  // Function to order comments based on their creation timestamp
  const orderComments = () => {
    return (openOntology?.comments || []).sort((a: any, b: any) => {
      const timestampA: any = a.createdAt.toDate();
      const timestampB: any = b.createdAt.toDate();
      return timestampA - timestampB;
    });
  };

  // Function to retrieve main specializations from tree visualization data
  const getMainSpecialisations = (treeVisualisation: TreeVisual) => {
    let mainSpecializations: MainSpecializations = {};

    // Loop through categories in tree visualization
    for (let category in treeVisualisation) {
      mainSpecializations = {
        ...mainSpecializations,
        ...treeVisualisation[category].specializations,
      };
    }

    // Include specializations for "Actor" category
    mainSpecializations = {
      ...mainSpecializations,
      ...(mainSpecializations["Actor"]?.specializations || {}),
    };

    return mainSpecializations;
  };

  // Function to perform a search using Fuse.js library
  const searchWithFuse = (query: string): any => {
    // Return an empty array if the query is empty
    if (!query) {
      return [];
    }

    // Record logs for the search action
    recordLogs({
      action: "Searched",
      query,
    });

    // Perform search using Fuse.js, filter out deleted items
    return fuse
      .search(query)
      .map((result) => result.item)
      .filter((item: any) => !item.deleted);
  };

  // This function handles the process of sending a new comment to an ontology.
  const handleSendComment = async () => {
    try {
      // Check if user or openOntology is not available, exit the function.
      if (!user || !openOntology) return;

      // Retrieve the document for the current ontology using its ID.
      const ontologyDoc = await getDoc(
        doc(collection(db, "ontology"), openOntology.id)
      );
      // Extract existing ontology data or default to an empty object.
      const ontologyData = ontologyDoc.data();

      // Extract existing comments from the ontology data or initialize as an empty array.
      const comments = ontologyData?.comments || [];

      // Add a new comment to the comments array.
      comments.push({
        id: newId(db),
        content: newComment,
        sender: (user.fName || "") + " " + user.lName,
        senderImage: user.imageUrl,
        senderUname: user.uname,
        createdAt: new Date(),
      });

      // Update the ontology document with the new comments array.
      await updateDoc(ontologyDoc.ref, { comments });

      // Record the comment action in the application logs.
      await recordLogs({
        action: "Commented",
        comment: newComment,
        ontology: ontologyDoc.id,
      });

      // Clear the newComment state after successfully sending the comment.
      setNewComment("");
    } catch (error) {
      // Handle any errors that may occur during the process and log them.
      console.error(error);
    }
  };

  // Function to delete a comment by its ID
  const deleteComment = async (commentId: string) => {
    try {
      // Check if there is an open ontology
      if (!openOntology) return;

      // If the comment being edited matches the comment to delete, reset editing state and return
      if (editingComment === commentId) {
        setEditingComment("");
        setUpdateComment("");
        return;
      }

      // Confirm deletion with the user
      if (
        await confirmIt(
          "Are you sure you want to delete the comment?",
          "Delete Comment",
          "Keep Comment"
        )
      ) {
        // Retrieve the ontology document from the database
        const ontologyDoc = await getDoc(
          doc(collection(db, "ontology"), openOntology.id)
        );
        const ontologyData = ontologyDoc.data();

        // Retrieve and filter out the comment to be deleted
        let comments = ontologyData?.comments || [];
        const removedComment = comments.filter((c: any) => c.id === commentId);
        comments = comments.filter((c: any) => c.id !== commentId);

        // Update the ontology document with the modified comments
        await updateDoc(ontologyDoc.ref, { comments });

        // Record the deletion action in the logs
        await recordLogs({
          action: "Comment Deleted",
          comment: removedComment,
          ontology: openOntology.id,
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Function to edit a comment
  const editComment = async (comment: any) => {
    try {
      // Check if there is an open ontology and the comment matches the editing state
      if (comment.id === editingComment && openOntology) {
        // Retrieve the ontology document from the database
        const ontologyDoc = await getDoc(
          doc(collection(db, "ontology"), openOntology.id)
        );
        const ontologyData = ontologyDoc.data();

        // Retrieve and update the comment content
        let comments = ontologyData?.comments || [];
        const commentIdx = comments.findIndex((c: any) => c.id == comment.id);

        // Record the modification action in the logs
        recordLogs({
          action: "Comment Modified",
          previousValue: comments[commentIdx].content,
          newValue: updateComment,
        });

        // Update the comment content and reset the editing state
        comments[commentIdx].content = updateComment;
        setEditingComment("");
        await updateDoc(ontologyDoc.ref, { comments });

        // Reset additional state variables
        setUpdateComment("");
        setNewComment("");
        return;
      }

      // If not in editing state, set the comment as the one being edited
      setEditingComment(comment.id);
      setUpdateComment(comment.content);
    } catch (error) {
      console.error(error);
    }
  };

  const handleChange = (event: any, newValue: number) => {
    setValue(newValue);
  };

  const handleViewChange = (event: any, newValue: number) => {
    setViewValue(newValue);
  };

  // This function finds the path of an ontology in a nested structure of mainOntologies and their subOntologies.
  const findOntologyPath = useCallback(
    ({ mainOntologies, path, eachOntologyPath }: any) => {
      // Loop through each main ontology
      for (let ontology of mainOntologies) {
        // Update the path for the current ontology
        eachOntologyPath[ontology.id] = [...path, ontology.id];

        // Loop through categories in the subOntologies of the current ontology
        for (let category in ontology?.subOntologies?.Specializations) {
          // Filter ontologies based on their inclusion in the Specializations of the current category
          const specializations =
            ontologies.filter((onto: any) => {
              const arrayOntologies = ontology?.subOntologies?.Specializations[
                category
              ]?.ontologies.map((o: any) => o.id);
              return arrayOntologies.includes(onto.id);
            }) || [];

          // Recursively call the findOntologyPath function for the filtered specializations
          eachOntologyPath = findOntologyPath({
            mainOntologies: specializations,
            path: [...path, ontology.id],
            eachOntologyPath,
          });
        }
      }

      // Return the accumulated ontology paths
      return eachOntologyPath;
    },
    [ontologies]
  );

  // This function is called when a search result ontology is clicked.
  const openSearchOntology = (ontology: any) => {
    try {
      // Set the clicked ontology as the open ontology
      setOpenOntology(ontology);

      // Record the click action in logs
      recordLogs({
        action: "Search result clicked",
        clicked: ontology.id,
      });

      // Filter main ontologies based on the presence of a category
      const mainOntologies = ontologies.filter(
        (ontology: any) => ontology.category
      );

      // Initialize eachOntologyPath with an empty object and find the ontology path
      let eachOntologyPath = findOntologyPath({
        mainOntologies,
        path: [],
        eachOntologyPath: {},
      });

      // Update the user document with the ontology path
      updateUserDoc([...(eachOntologyPath[ontology.id] || [ontology.id])]);
    } catch (error) {
      console.error(error);
    }
  };

  /**
   * Recursively updates the inheritance-related fields in a hierarchy of ontologies.
   *
   * @param updatedOntology - The root ontology that needs to be updated.
   * @param updatedField - The field that is being updated (e.g., "title", "description").
   * @param type - The type of ontology being updated ("subOntologies" or "plainText").
   * @param newValue - The new value for the specified field.
   * @param ancestorTitle - The new title for the ancestor ontology.
   */
  const updateInheritance = ({
    updatedOntology,
    updatedField,
    type,
    newValue,
    ancestorTitle,
  }: {
    updatedOntology: IOntology;
    updatedField: string;
    type: "subOntologies" | "plainText";
    newValue: any;
    ancestorTitle: string;
  }) => {
    // Get the ID of the current ontology and initialize an array to store child ontology IDs.
    const parentId = updatedOntology.id;
    const children: { ontologies: { id: string; title: string }[] }[] =
      Object.values(updatedOntology.subOntologies.Specializations);
    let childOntologies: string[] = [];

    // Get all the children (specializations) in an array of strings.
    for (let child of children) {
      childOntologies = [
        ...childOntologies,
        ...child.ontologies.map((c) => c.id),
      ];
    }

    // Loop through all the children and update the corresponding field.
    for (let ontoId of childOntologies) {
      const ontologyIdx = ontologies.findIndex(
        (o: IOntology) => o.id == ontoId
      );

      // Check if the child ontology exists in the ontologies array.
      if (ontologyIdx !== -1) {
        const currentOntology: IOntology = ontologies[ontologyIdx];
        const ontoRef = doc(collection(db, "ontology"), ontoId);

        // Check if the current ontology has inheritance information.
        if (currentOntology.inheritance) {
          if (updatedField === "title") {
            // Update the ancestor title in the inheritance information.
            for (let inheritanceType in currentOntology.inheritance) {
              const inheritanceFields =
                currentOntology.inheritance[inheritanceType];
              for (let field in inheritanceFields) {
                const inheritance: { ref: string; title: string } =
                  inheritanceFields[field];
                if (inheritance.ref && inheritance.ref == parentId) {
                  inheritance.title = ancestorTitle;
                }
              }
            }
          } else {
            // Update the specified field in the inheritance information.
            const inheritance = currentOntology.inheritance[type][updatedField];
            if (
              inheritance &&
              inheritance?.ref &&
              inheritance.ref == parentId
            ) {
              inheritance.title = ancestorTitle;

              // If the modified field was "description," update the corresponding field in the ontology.
              if (updatedField == "description") {
                currentOntology[updatedField] = newValue;
              } else {
                currentOntology[type][updatedField] = newValue;
              }
            }
          }

          // Update the ontology document in the Firestore database.
          updateDoc(ontoRef, currentOntology);

          // Recursive call to update the children of the current ontology.
          // It is safe to call this even if the current ontology doesn't have children.
          updateInheritance({
            updatedOntology: currentOntology,
            updatedField,
            type,
            newValue,
            ancestorTitle,
          });
        }
      }
    }
  };

  return (
    <>
      <Container style={{ marginTop: "80px" }}>
        {!isMobile && (
          <Section minSize={0} defaultSize={350}>
            <Tabs
              value={viewValue}
              onChange={handleViewChange}
              sx={{ width: "100%", ml: "15px" }}
            >
              <Tab label="Tree View" {...a11yProps(0)} sx={{ width: "50%" }} />
              <Tab label="DAG View" {...a11yProps(1)} sx={{ width: "50%" }} />
            </Tabs>
            <Box sx={{ overflow: "auto", height: "94vh" }}>
              <TabPanel value={viewValue} index={0} sx={{ mt: "5px" }}>
                <TreeViewSimplified
                  treeVisualisation={treeVisualisation}
                  onOpenOntologyTree={onOpenOntologyTree}
                  expandedOntologies={expandedOntologies}
                />
              </TabPanel>
              <TabPanel value={viewValue} index={1}>
                <DAGGraph
                  treeVisualisation={treeVisualisation}
                  setExpandedOntologies={setExpandedOntologies}
                  expandedOntologies={expandedOntologies}
                  setDagreZoomState={setDagreZoomState}
                  dagreZoomState={dagreZoomState}
                  onOpenOntologyDagre={onOpenOntologyDagre}
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
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              color: "white",
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
            }}
          >
            <Breadcrumbs sx={{ ml: "40px" }}>
              {ontologyPath.map((path) => (
                <Link
                  underline={path.category ? "none" : "hover"}
                  key={path.id}
                  onClick={() => handleLinkNavigation(path, "")}
                  sx={{
                    cursor: !path.category ? "pointer" : "",
                    ":hover": {
                      cursor: !path.category ? "pointer" : "",
                    },
                  }}
                >
                  {path.title.split(" ").splice(0, 3).join(" ") +
                    (path.title.split(" ").length > 3 ? "..." : "")}
                </Link>
              ))}
            </Breadcrumbs>

            {openOntology && (
              <Ontology
                openOntology={openOntology}
                setOpenOntology={setOpenOntology}
                handleLinkNavigation={handleLinkNavigation}
                setOntologyPath={setOntologyPath}
                ontologyPath={ontologyPath}
                saveSubOntology={saveSubOntology}
                setSnackbarMessage={setSnackbarMessage}
                updateUserDoc={updateUserDoc}
                user={user}
                mainSpecializations={getMainSpecialisations(treeVisualisation)}
                ontologies={ontologies}
                addNewOntology={addNewOntology}
                ONTOLOGY_TYPES={ONTOLOGY_TYPES}
                editOntology={editOntology}
                setEditOntology={setEditOntology}
                lockedOntology={lockedOntology}
                recordLogs={recordLogs}
                updateInheritance={updateInheritance}
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
          }}
        >
          <SettingsEthernetIcon
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              color: "white",
            }}
          />
        </Bar>

        {!isMobile && (
          <Section minSize={0} defaultSize={400}>
            <Box
              sx={{
                borderBottom: 1,
                borderColor: "divider",
                position: "sticky",
              }}
            >
              <Tabs
                value={value}
                onChange={handleChange}
                aria-label="basic tabs example"
              >
                <Tab label="Search" {...a11yProps(1)} />
                <Tab label="Comments" {...a11yProps(0)} />
                <Tab label="Markdown Cheatsheet" {...a11yProps(2)} />
              </Tabs>
            </Box>
            <Box
              sx={{
                padding: "10px",
                height: "89vh",
                overflow: "auto",
                pb: "125px",
              }}
            >
              <TabPanel value={value} index={0}>
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
                    {searchWithFuse(searchValue).map((ontology: any) => (
                      <ListItem
                        key={ontology.id}
                        onClick={() => openSearchOntology(ontology)}
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
                        <Typography>{ontology.title}</Typography>
                      </ListItem>
                    ))}
                  </List>
                </Box>
              </TabPanel>
              <TabPanel value={value} index={1}>
                <Box sx={{ display: "flex", flexDirection: "column" }}>
                  <Box>
                    {orderComments().map((comment: any) => (
                      <Paper key={comment.id} elevation={3} sx={{ mt: "15px" }}>
                        <Box
                          sx={{
                            // mb: "15px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            p: "18px",
                            pb: "0px",
                          }}
                        >
                          <Box sx={{ display: "flex", alignItems: "center" }}>
                            <Avatar src={comment.senderImage} />
                            <Box
                              sx={{
                                display: "flex",
                                flexDirection: "column",
                                ml: "5px",
                              }}
                            >
                              <Typography sx={{ ml: "4px", fontSize: "14px" }}>
                                {comment.sender}
                              </Typography>
                              <Typography sx={{ ml: "4px", fontSize: "12px" }}>
                                {formatFirestoreTimestampWithMoment(
                                  comment.createdAt
                                )}
                              </Typography>
                            </Box>
                          </Box>

                          {comment.senderUname === user?.uname && (
                            <Box
                              sx={{
                                display: "flex",
                                justifyContent: "flex-end",
                              }}
                            >
                              <Button onClick={() => editComment(comment)}>
                                {comment.id === editingComment
                                  ? "Save"
                                  : "Edit"}
                              </Button>
                              <Button onClick={() => deleteComment(comment.id)}>
                                {" "}
                                {comment.id === editingComment
                                  ? "Cancel"
                                  : "Delete"}
                              </Button>
                            </Box>
                          )}
                        </Box>
                        <Box>
                          {comment.id === editingComment ? (
                            <Box sx={{ pr: "12px", pl: "12px", pb: "18px" }}>
                              <TextField
                                variant="outlined"
                                multiline
                                fullWidth
                                value={updateComment}
                                onChange={(e: any) => {
                                  setUpdateComment(e.target.value);
                                }}
                                autoFocus
                              />
                            </Box>
                          ) : (
                            <Box sx={{ p: "18px" }}>
                              <MarkdownRender text={comment.content} />
                            </Box>
                          )}
                        </Box>
                      </Paper>
                    ))}
                    <Paper elevation={3} sx={{ mt: "15px" }}>
                      <TextField
                        variant="outlined"
                        multiline
                        fullWidth
                        placeholder="Add a Comment..."
                        value={newComment}
                        onChange={(e: any) => {
                          setNewComment(e.target.value);
                        }}
                        InputProps={{
                          endAdornment: (
                            <Tooltip title={"Share"}>
                              <IconButton
                                color="primary"
                                onClick={handleSendComment}
                                edge="end"
                              >
                                <SendIcon />
                              </IconButton>
                            </Tooltip>
                          ),
                        }}
                        autoFocus
                        sx={{
                          p: "8px",
                          mt: "5px",
                        }}
                      />
                    </Paper>
                  </Box>{" "}
                </Box>
              </TabPanel>
              <TabPanel value={value} index={2}>
                <Box
                  sx={{
                    p: "18px",
                    backgroundColor: (theme) =>
                      theme.palette.mode === "dark" ? "" : "gray",
                  }}
                >
                  <MarkdownRender text={markdownContent} />
                </Box>
              </TabPanel>
            </Box>
          </Section>
        )}
        {ConfirmDialog}
        <SneakMessage
          newMessage={snackbarMessage}
          setNewMessage={setSnackbarMessage}
        />
        <Box sx={{ position: "absolute", top: 0, width: "100%" }}>
          <AppHeaderMemoized ref={headerRef} />
        </Box>
      </Container>
    </>
  );
};
export default withAuthUser({
  shouldRedirectToLogin: true,
  shouldRedirectToHomeIfAuthenticated: false,
})(CIOntology);
