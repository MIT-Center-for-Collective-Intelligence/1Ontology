/* 
## Overview

The `ChildNode` component is a React component that displays a child node within a larger ontology structure. It provides functionality for navigating to the child node, updating the user's current path within the ontology, and deleting the child node from the ontology.

## Props

The component accepts the following props:

- `child`: An object representing the child node to be displayed.
- `currentVisibleNode`: The currently visible node in the ontology.
- `sx`: An object containing style properties to be applied to the component.
- `type`: A string representing the type of the child node (e.g., "specializations").
- `setCurrentVisibleNode`: A function to update the state of the currently visible node.
- `setSnackbarMessage`: A function to display a message in a snackbar/notification.
- `category`: A string representing the category of the child node.
- `ontologyPath`: An array representing the path of nodes leading to the current node.
- `updateUserDoc`: A function to update the user's document with the new ontology path.
- `recordLogs`: A function to record logs for certain actions.
- `updateInheritance`: A function to update the inheritance of nodes.

## Functions


### removeChildNode

This function removes a child node from the given node's children. It iterates over the types and categories of children and removes the child node if it is found.

### deleteSubOntologyEditable

This asynchronous function is triggered when the user clicks the "Delete" button. It confirms the deletion with the user and, upon confirmation, deletes the child node from the ontology. It handles the deletion of the node from the Firestore database and updates the inheritance if necessary. It also records the deletion action in the logs.

## Rendering

The component renders a `Box` containing a `Link` and a `Button` within a `Tooltip`. The `Link` allows the user to navigate to the child node, and the `Button` provides the option to delete the child node. A `ConfirmDialog` is also included to confirm deletion actions.

## Usage

The `ChildNode` component is used within a larger application that manages an ontology structure. It is likely part of a list or tree view where each node can have child nodes. The component allows users to interact with these child nodes by navigating to them or removing them from the ontology.

## Example

```jsx
<ChildNode
  child={someChildNode}
  currentVisibleNode={currentNode}
  sx={{ margin: '10px' }}
  type="specializations"
  setCurrentVisibleNode={handleSetCurrentVisibleNode}
  setSnackbarMessage={handleSetSnackbarMessage}
  category="SomeCategory"
  ontologyPath={currentPath}
  recordLogs={handleRecordLogs}
  updateInheritance={handleUpdateInheritance}
/>
```

In this example, `ChildNode` is used to display a child node with the given properties and functions to handle various interactions.

## Notes

- The component assumes that the `NODES` collection and the necessary Firestore functions are correctly set up and available.
- The `useConfirmDialog` hook is used to manage confirmation dialogs for deletion actions.
- The component makes use of Material-UI components (`Box`, `Button`, `Link`, `Tooltip`) for styling and interaction.
- Error handling is implemented in the `deleteSubOntologyEditable` function, but it is important to ensure that proper error handling is in place throughout the application.
- The component does not directly mutate the state but uses provided functions to handle state changes, ensuring a unidirectional data flow.
 */
import { NODES } from " @components/lib/firestoreClient/collections";
import useConfirmDialog from " @components/lib/hooks/useConfirmDialog";
import {
  recordLogs,
  saveNewChangeLog,
  unlinkPropertyOf,
  updateInheritance,
  updatePartsAndPartsOf,
  updatePropertyOf,
  updateInheritanceWhenUnlinkAGeneralization,
} from " @components/lib/utils/helpers";
import { INode, INodePath, ILinkNode } from " @components/types/INode";
import {
  Box,
  Button,
  IconButton,
  Link,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import DoneIcon from "@mui/icons-material/Done";
import CloseIcon from "@mui/icons-material/Close";
import { useEffect, useRef, useState } from "react";
import { getTitleDeleted } from " @components/lib/utils/string.utils";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import { UNCLASSIFIED } from " @components/lib/CONSTANTS";

type ILinkNodeProps = {
  link: ILinkNode;
  currentVisibleNode: INode;
  sx?: { [key: string]: any };
  property: string;
  setCurrentVisibleNode: (currentVisibleNode: any) => void;
  setSnackbarMessage: (message: any) => void;
  navigateToNode: (nodeID: string) => void;
  title: string;
  nodes: { [nodeId: string]: INode };
  unlinkVisible: boolean;
  linkLocked: any;
  locked: boolean;
  user: any;
  reviewId: string;
  setReviewId: Function;
  linkIndex: number;
  collectionIndex: number;
  selectedDiffNode: any;
};

const LinkNode = ({
  link,
  sx,
  property,
  currentVisibleNode,
  navigateToNode,
  title,
  nodes,
  linkIndex: linkIndex,
  unlinkVisible,
  linkLocked,
  locked,
  user,
  reviewId,
  setReviewId,
  collectionIndex,
  selectedDiffNode,
}: ILinkNodeProps) => {
  const db = getFirestore();
  const theme = useTheme();
  const [editorContent, setEditorContent] = useState(title);
  const textFieldRef = useRef<HTMLInputElement>(null);
  const BUTTON_COLOR = theme.palette.mode === "dark" ? "#373739" : "#dde2ea";

  const [regionalTitle, setRegionalTitle] = useState(title);

  // useEffect to handle async call to getTitle
  useEffect(() => {
    const fetchTitle = async () => {
      const title = await getTitleDeleted(nodes, link.id, true, db);
      setRegionalTitle(title);
    };
    if (!title) {
      fetchTitle();
    }
  }, [link.id, nodes, title]);

  const { confirmIt, ConfirmDialog } = useConfirmDialog();
  const handleNavigateToNode = () => {
    navigateToNode(link.id);
  };
  useEffect(() => {
    setEditorContent(title);
  }, [title]);

  const handleChanges = (e: any) => {
    setEditorContent(e.target.value);
  };

  const saveNodeTitle = () => {
    try {
      const nodeRef = doc(collection(db, NODES), link.id);
      updateDoc(nodeRef, { title: editorContent });
      if (setReviewId) setReviewId("");
    } catch (e: any) {
      console.error(e.message);
    }
  };

  const cancelEditingNode = () => {
    try {
      const currentNode = nodes[link.id];
      /*       const generalization = Object.values(
        currentNode.generalizations
      ).flat()[0] as { id: string }; */

      for (let genCollection of currentNode.generalizations) {
        for (let generalizationLink of genCollection.nodes) {
          const generalizationNode = nodes[generalizationLink.id];
          for (
            let specCollectionIndex = 0;
            specCollectionIndex < generalizationNode.specializations.length;
            specCollectionIndex++
          ) {
            generalizationNode.specializations[specCollectionIndex].nodes =
              generalizationNode.specializations[
                specCollectionIndex
              ].nodes.filter((l: ILinkNode) => l.id !== link.id);
          }

          const generalizationRef = doc(
            collection(db, NODES),
            generalizationLink.id
          );
          updateDoc(generalizationRef, {
            specializations: generalizationNode.specializations,
          });

          const nodeRef = doc(collection(db, NODES), link.id);
          updateDoc(nodeRef, { title: editorContent, deleted: true });
        }
      }

      saveNewChangeLog(db, {
        nodeId: link.id,
        modifiedBy: user?.uname,
        modifiedProperty: null,
        previousValue: null,
        newValue: null,
        modifiedAt: new Date(),
        changeType: "delete node",
        fullNode: currentNode,
      });

      if (setReviewId) setReviewId("");
    } catch (e: any) {
      console.error(e.message);
    }
  };

  const unlinkNodeRelation = async () => {
    try {
      if (
        await confirmIt(
          `Are you sure you want remove this item the list?`,
          `Remove`,
          "Keep"
        )
      ) {
        const nodeDoc = await getDoc(
          doc(collection(db, NODES), currentVisibleNode.id)
        );
        if (nodeDoc.exists()) {
          const nodeData = nodeDoc.data() as INode;

          const nodeId = nodeData.inheritance[property]?.ref || null;
          if (nodeId) {
            const inheritedNode = nodes[nodeId as string];
            nodeData.properties[property] = JSON.parse(
              JSON.stringify(inheritedNode.properties[property])
            );
          }
          const previousValue = JSON.parse(
            JSON.stringify(nodeData.properties[property])
          );
          if (
            linkIndex !== -1 &&
            Array.isArray(nodeData.properties[property])
          ) {
            nodeData.properties[property][collectionIndex].nodes.splice(
              linkIndex,
              1
            );
          }

          const shouldBeRemovedFromParent = !(
            Object.values(nodeData.properties[property]) as { id: string }[]
          )
            .flat()
            .some((c: { id: string }) => c.id === link.id);

          // const childDoc = await getDoc(doc(collection(db, NODES), child.id));
          // const childData = childDoc.data() as INode;
          if (shouldBeRemovedFromParent) {
            unlinkPropertyOf(db, property, currentVisibleNode.id, link.id);
          }

          await updateDoc(nodeDoc.ref, {
            [`properties.${property}`]: nodeData.properties[property],
          });
          if (property !== "isPartOf" || nodeData.inheritance[property]) {
            const reference = nodeData.inheritance[property].ref;
            let updateObject: any = {
              [`inheritance.${property}.ref`]: null,
            };
            if (
              reference &&
              nodes[reference].textValue &&
              nodes[reference].textValue.hasOwnProperty(property) &&
              Array.isArray(nodeData.properties[property])
            ) {
              const links = nodeData.properties[property].flatMap(
                (c) => c.nodes
              );
              if (property === "isPartOf") {
                updatePartsAndPartsOf(
                  links,
                  { id: currentVisibleNode.id },
                  "isPartOf",
                  db,
                  nodes
                );
              } else {
                updatePropertyOf(
                  links,
                  { id: currentVisibleNode.id },
                  property,
                  nodes,
                  db
                );
              }
              updateObject = {
                ...updateObject,
                [`textValue.${property}`]: nodes[reference].textValue[property],
              };
            }
            await updateDoc(nodeDoc.ref, updateObject);

            updateInheritance({
              nodeId: nodeDoc.id,
              updatedProperties: [property],
              db,
            });
          }
          saveNewChangeLog(db, {
            nodeId: currentVisibleNode.id,
            modifiedBy: user?.uname,
            modifiedProperty: property,
            previousValue,
            newValue: nodeData.properties[property],
            modifiedAt: new Date(),
            changeType: "remove element",
            fullNode: currentVisibleNode,
          });
          recordLogs({
            action: "unlinked a node",
            property,
            unlinked: link.id,
            node: nodeDoc.id,
          });
        }
      }
    } catch (error) {
      console.error(error);
      await confirmIt(
        `There is an issue with unlinking the node, please try again.`,
        `Ok`,
        ""
      );
    }
  };

  const removeNodeLink = async (
    type: "specializations" | "generalizations",
    removeNodeId: string,
    removeIdFrom: string
  ) => {
    const specOrGenDoc = await getDoc(doc(collection(db, NODES), removeIdFrom));
    let removeFrom: "specializations" | "generalizations" = "specializations";

    if (type === "specializations") {
      removeFrom = "generalizations";
    }
    if (specOrGenDoc.exists()) {
      const specOrGenData = specOrGenDoc.data() as INode;
      for (let collection of specOrGenData[removeFrom]) {
        collection.nodes = collection.nodes.filter(
          (c: { id: string }) => c.id !== removeNodeId
        );
      }

      await updateDoc(specOrGenDoc.ref, {
        [`${removeFrom}`]: specOrGenData[removeFrom],
      });
    }
  };

  const unlinkSpecializationOrGeneralization = async () => {
    try {
      if (
        await confirmIt(
          <Box>
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                mb: "14px",
              }}
            >
              <LinkOffIcon />
            </Box>
            <Typography sx={{ fontWeight: "bold" }}>
              Are you sure you want unlink this node?
            </Typography>
            {!unlinkVisible && (
              <Typography sx={{ mt: "15px" }}>
                {`There's no other generalization linked to this node. Are you
                sure you want to unlink it and move it as a specialization under
              ${UNCLASSIFIED[nodes[link.id].nodeType]}`}
                ?
              </Typography>
            )}
          </Box>,
          "Unlink",
          "Keep"
        )
      ) {
        const nodeDoc = await getDoc(
          doc(collection(db, NODES), currentVisibleNode.id)
        );
        if (nodeDoc.exists()) {
          const nodeData = nodeDoc.data() as INode;
          const previousValue = JSON.parse(
            JSON.stringify(
              nodeData[property as "specializations" | "generalizations"]
            )
          );
          if (linkIndex !== -1) {
            nodeData[property as "specializations" | "generalizations"][
              collectionIndex
            ].nodes.splice(linkIndex, 1);
          }
          //check if this link is includes in other collections of the node or not
          //to be able to remove it
          const shouldBeRemovedFromParent = !nodeData[
            property as "specializations" | "generalizations"
          ].some((c: { nodes: ILinkNode[] }) =>
            c.nodes.includes({ id: link.id })
          );
          if (shouldBeRemovedFromParent) {
            await removeNodeLink(
              property as "specializations" | "generalizations",
              currentVisibleNode.id,
              link.id
            );
          }
          if (!unlinkVisible && shouldBeRemovedFromParent) {
            const nodeType = nodes[link.id].nodeType;
            const unclassifiedNodeDocs = await getDocs(
              query(
                collection(db, NODES),
                where("unclassified", "==", true),
                where("nodeType", "==", nodeType)
              )
            );
            if (unclassifiedNodeDocs.docs.length > 0) {
              const unclassifiedNodeDoc = unclassifiedNodeDocs.docs[0];
              if (property === "specializations") {
                const nodeRef = doc(collection(db, NODES), link.id);
                const generalizations = nodes[link.id].generalizations;

                const mCollectionIdx = generalizations.findIndex(
                  (c) => c.collectionName === "main"
                );
                if (mCollectionIdx !== -1) {
                  generalizations[mCollectionIdx].nodes = generalizations[
                    mCollectionIdx
                  ].nodes.filter((g) => g.id !== nodeDoc.id);

                  generalizations[0].nodes.push({ id: unclassifiedNodeDoc.id });
                  updateDoc(nodeRef, {
                    generalizations,
                  });
                }

                const specializations =
                  nodes[unclassifiedNodeDoc.id].specializations;

                const mainCollectionIdx = specializations.findIndex(
                  (c) => c.collectionName === "main"
                );
                if (mainCollectionIdx !== -1) {
                  specializations[mainCollectionIdx].nodes.push({
                    id: link.id,
                  });
                  updateDoc(unclassifiedNodeDoc.ref, {
                    specializations,
                  });
                }
              }

              if (property === "generalizations") {
                const generalizations = nodeData.generalizations;
                generalizations[0].nodes.push({ id: unclassifiedNodeDoc.id });

                const specializations =
                  nodes[unclassifiedNodeDoc.id].specializations;

                const mainCollectionIdx = specializations.findIndex(
                  (c) => c.collectionName === "main"
                );
                specializations[mainCollectionIdx].nodes.push({
                  id: nodeDoc.id,
                });
                updateDoc(unclassifiedNodeDoc.ref, {
                  specializations,
                });
              }
            }
          }
          await updateDoc(nodeDoc.ref, nodeData);
          saveNewChangeLog(db, {
            nodeId: currentVisibleNode.id,
            modifiedBy: user?.uname,
            modifiedProperty: property,
            previousValue,
            newValue:
              nodeData[property as "specializations" | "generalizations"],
            modifiedAt: new Date(),
            changeType: "remove element",
            fullNode: currentVisibleNode,
          });
          if (property === "generalizations") {
            updateInheritanceWhenUnlinkAGeneralization(
              db,
              link.id,
              nodeData,
              nodes
            );
          }
          if (property === "specializations") {
            updateInheritanceWhenUnlinkAGeneralization(
              db,
              nodeDoc.id,
              nodes[link.id],
              nodes
            );
          }
        }
      }
    } catch (error: any) {
      console.error(error);
      recordLogs({
        type: "error",
        error: JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
        at: "updateInheritance",
      });
    }
  };

  const handleUnlinkNode = () => {
    if (property === "specializations" || property === "generalizations") {
      unlinkSpecializationOrGeneralization();
    } else {
      unlinkNodeRelation();
    }
  };
  const getLinkColor = (changeType: "added" | "removed") => {
    return changeType === "added"
      ? "green"
      : changeType === "removed"
      ? "red"
      : theme.palette.mode === "dark"
      ? theme.palette.common.gray50
      : theme.palette.common.notebookMainBlack;
  };
  useEffect(() => {
    if (reviewId === link.id && textFieldRef.current) {
      textFieldRef.current.focus();
      textFieldRef.current.select();
    }
  }, [reviewId]);
  return (
    <Box sx={{ ...sx }}>
      {reviewId !== link.id ? (
        <Box style={{ display: "flex", alignItems: "center" }}>
          <Link
            underline="hover"
            onClick={handleNavigateToNode}
            sx={{
              cursor: "pointer",
              color: getLinkColor(link.change),
              textDecoration:
                link.change === "removed" ? "line-through" : "none",
            }}
          >
            {" "}
            {title || regionalTitle}
          </Link>
          {link.changeType === "sort" && (
            <SwapHorizIcon
              sx={{ color: getLinkColor(link.change), pl: "5px" }}
            />
          )}
          {!locked &&
            !linkLocked &&
            !currentVisibleNode.unclassified &&
            !selectedDiffNode && (
              <Button
                sx={{
                  ml: "8px",
                  borderRadius: "18px",
                  backgroundColor: BUTTON_COLOR,
                }}
                variant="outlined"
                onClick={handleUnlinkNode}
              >
                Unlink
              </Button>
            )}
        </Box>
      ) : (
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <TextField
            inputRef={textFieldRef}
            value={editorContent}
            onChange={handleChanges}
            sx={{ width: "300px" }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                saveNodeTitle();
              }
            }}
            InputProps={{
              inputProps: {
                style: {
                  padding: 10,
                },
              },
            }}
          />
          <Tooltip title="Save">
            <IconButton onClick={saveNodeTitle} sx={{ ml: "5px" }}>
              <DoneIcon sx={{ color: "green" }} />
            </IconButton>
          </Tooltip>
          {/*     <Tooltip title="Remove">
            <IconButton onClick={cancelEditingNode} sx={{ ml: "5px" }}>
              <CloseIcon sx={{ color: "red" }} />
            </IconButton>
          </Tooltip> */}
        </Box>
      )}
      {ConfirmDialog}
    </Box>
  );
};

export default LinkNode;
