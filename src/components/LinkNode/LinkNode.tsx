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
import { NODES } from "@components/lib/firestoreClient/collections";
import useConfirmDialog from "@components/lib/hooks/useConfirmDialog";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import {
  recordLogs,
  saveNewChangeLog,
  unlinkPropertyOf,
  updateInheritance,
  updatePartsAndPartsOf,
  updatePropertyOf,
  updateInheritanceWhenUnlinkAGeneralization,
} from "@components/lib/utils/helpers";
import { breakInheritanceAndCopyParts } from "@components/lib/utils/partsHelper";
import {
  INode,
  INodePath,
  ILinkNode,
  ICollection,
} from "@components/types/INode";
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  keyframes,
  Link,
  ListItem,
  ListItemIcon,
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

import CloseIcon from "@mui/icons-material/Close";
import { useCallback, useEffect, useRef, useState } from "react";
import { getTitleDeleted } from "@components/lib/utils/string.utils";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import { UNCLASSIFIED } from "@components/lib/CONSTANTS";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import LinkEditor from "./LinkEditor";
import { Post } from "@components/lib/utils/Post";
import { LoadingButton } from "@mui/lab";

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
type ILinkNodeProps = {
  provided: any;
  link: ILinkNode;
  currentVisibleNode: INode;
  sx?: { [key: string]: any };
  property: string;
  setCurrentVisibleNode: (currentVisibleNode: any) => void;
  setSnackbarMessage: (message: any) => void;
  navigateToNode: (nodeID: string) => void;
  title: string;
  nodes: { [nodeId: string]: INode };
  linkLocked: any;
  locked: boolean;
  user: any;
  linkIndex: number;
  collectionIndex: number;
  selectedDiffNode: any;
  replaceWith: any;
  saveNewAndSwapIt: any;
  setClonedNodesQueue: any;
  clonedNodesQueue?: any;
  unlinkElement?: any;
  selectedProperty: string;
  glowIds: Set<string>;
  skillsFuture: boolean;
  currentImprovement: any;
  partsInheritance: {
    [nodeId: string]: { inheritedFrom: string; partInheritance: string };
  };
  loadingIds: any;
  saveNewSpecialization: any;
  enableEdit: boolean;
};

const LinkNode = ({
  provided,
  link,
  sx,
  property,
  currentVisibleNode,
  navigateToNode,
  title,
  nodes,
  linkIndex: linkIndex,
  linkLocked,
  locked,
  user,
  collectionIndex,
  selectedDiffNode,
  replaceWith,
  saveNewAndSwapIt,
  setClonedNodesQueue,
  clonedNodesQueue = {},
  unlinkElement,
  selectedProperty,
  glowIds,
  skillsFuture,
  currentImprovement,
  partsInheritance,
  loadingIds,
  saveNewSpecialization,
  enableEdit,
}: ILinkNodeProps) => {
  const db = getFirestore();
  const theme = useTheme();
  const [swapIt, setSwapIt] = useState(false);
  const [addNew, setAddNew] = useState(false);
  const [newPart, setNewPart] = useState("");

  const BUTTON_COLOR = theme.palette.mode === "dark" ? "#373739" : "#dde2ea";

  const [regionalTitle, setRegionalTitle] = useState(title);

  // useEffect to handle async call to getTitle
  /*   useEffect(() => {
    const fetchTitle = async () => {
      const title = await getTitleDeleted(nodes, link.id, true, db);
      setRegionalTitle(title);
    };
    if (!title) {
      fetchTitle();
    }
  }, [link.id, nodes, title]); */

  const { confirmIt, ConfirmDialog } = useConfirmDialog();
  const handleNavigateToNode = useCallback(() => {
    navigateToNode(link.id);
  }, [navigateToNode, link.id]);

  const unlinkNodeRelation = async (
    currentNodeId: string,
    linkId: string,
    fromModel: boolean = false,
  ) => {
    try {
      if (
        fromModel ||
        (await confirmIt(
          `Are you sure you want remove this item the list?`,
          `Remove`,
          "Keep",
        ))
      ) {
        const nodeDoc = await getDoc(doc(collection(db, NODES), currentNodeId));
        if (nodeDoc.exists()) {
          const nodeData = nodeDoc.data() as any;

          // Handle for parts - break inheritance
          if (property === "parts" && nodeData.inheritance[property]?.ref) {
            await breakInheritanceAndCopyParts(currentNodeId, linkId, nodes, user);
            const updatedNodeDoc = await getDoc(doc(collection(db, NODES), currentNodeId));
            if (updatedNodeDoc.exists()) {
              Object.assign(nodeData, updatedNodeDoc.data());
            }
          } else if (nodeData.inheritance[property]?.ref) {
            // Existing logic for non-parts properties
            const nodeId = nodeData.inheritance[property].ref;
            const inheritedNode = nodes[nodeId as string];
            nodeData.properties[property] = JSON.parse(
              JSON.stringify(inheritedNode.properties[property]),
            );
          }
          const previousValue = JSON.parse(
            JSON.stringify(nodeData.properties[property]),
          );

          let removedFromInheritanceParts = false;

          if (property === "parts") {
            if (nodeData.inheritanceParts && nodeData.inheritanceParts[linkId]) {
              // Remove from inheritanceParts (broken inheritance scenario)
              delete nodeData.inheritanceParts[linkId];
              removedFromInheritanceParts = true;
            } else if (
              linkIndex !== -1 &&
              Array.isArray(nodeData.properties[property]) &&
              nodeData.propertyType[property] !== "string" &&
              nodeData.propertyType[property] !== "string-array"
            ) {
              // Remove from direct parts (intact inheritance scenario)
              nodeData.properties[property][collectionIndex].nodes.splice(
                linkIndex,
                1,
              );
            }
          } else if (
            linkIndex !== -1 &&
            Array.isArray(nodeData.properties[property]) &&
            nodeData.propertyType[property] !== "string" &&
            nodeData.propertyType[property] !== "string-array"
          ) {
            // Remove from other properties (generalizations, specializations, etc.)
            nodeData.properties[property][collectionIndex].nodes.splice(
              linkIndex,
              1,
            );
          }

          let shouldBeRemovedFromParent = false;

          if (property === "parts" && removedFromInheritanceParts) {
            // For inheritanceParts removal, always remove from parent since it's not in direct properties
            shouldBeRemovedFromParent = true;
          } else {
            // Existing logic for other properties
            shouldBeRemovedFromParent = !(
              Object.values(nodeData.properties[property]) as { id: string }[]
            )
              .flat()
              .some((c: { id: string }) => c.id === linkId);
          }

          // const childDoc = await getDoc(doc(collection(db, NODES), child.id));
          // const childData = childDoc.data() as INode;
          if (shouldBeRemovedFromParent) {
            unlinkPropertyOf(db, property, currentVisibleNode?.id, linkId);
          }

          let propertyUpdateObject: any = {};

          // Update based on where the item was removed from
          if (property === "parts" && removedFromInheritanceParts) {
            // Update inheritanceParts for broken inheritance
            propertyUpdateObject.inheritanceParts = nodeData.inheritanceParts;
          } else {
            // Update direct properties for intact inheritance or other properties
            propertyUpdateObject[`properties.${property}`] = nodeData.properties[property];
          }

          await updateDoc(nodeDoc.ref, propertyUpdateObject);
          
          if (property !== "isPartOf" || nodeData.inheritance[property]) {
            const reference = nodeData.inheritance[property].ref;
            let updateObject: any = {
              [`inheritance.${property}.ref`]: null,
            };
            if (
              reference &&
              nodes[reference].textValue &&
              nodes[reference].textValue.hasOwnProperty(property) &&
              Array.isArray(nodeData.properties[property]) &&
              nodeData.propertyType[property] !== "string" &&
              nodeData.propertyType[property] !== "string-array"
            ) {
              const links = nodeData.properties[property].flatMap(
                (c) => c.nodes,
              );
              if (property === "isPartOf") {
                updatePartsAndPartsOf(
                  links,
                  { id: currentVisibleNode?.id },
                  "isPartOf",
                  db,
                  nodes,
                );
              } else {
                updatePropertyOf(
                  links,
                  { id: currentVisibleNode?.id },
                  property,
                  nodes,
                  db,
                );
              }
              updateObject = {
                ...updateObject,
                [`textValue.${property}`]: nodes[reference].textValue[property],
              };
            }
            await updateDoc(nodeDoc.ref, updateObject);

            await updateInheritance({
              nodeId: nodeDoc.id,
              updatedProperties: [property],
              db,
            });
          }
          await Post("/triggerChroma", {
            nodeId: currentNodeId,
            updateAll: false,
          });
          saveNewChangeLog(db, {
            nodeId: currentVisibleNode?.id,
            modifiedBy: user?.uname,
            modifiedProperty: property,
            previousValue,
            newValue: nodeData.properties[property],
            modifiedAt: new Date(),
            changeType: "remove element",
            fullNode: currentVisibleNode,
            skillsFuture,
          });
          recordLogs({
            action: "unlinked a node",
            property,
            unlinked: linkId,
            node: nodeDoc.id,
          });
        }
      }
    } catch (error) {
      console.error(error);
      await confirmIt(
        `There is an issue with unlinking the node, please try again.`,
        `Ok`,
        "",
      );
    }
  };

  const removeNodeLink = async (
    type: "specializations" | "generalizations",
    removeNodeId: string,
    removeIdFrom: string,
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
          (c: { id: string }) => c.id !== removeNodeId,
        );
      }

      await updateDoc(specOrGenDoc.ref, {
        [`${removeFrom}`]: specOrGenData[removeFrom],
      });
    }
  };

  const unlinkSpecializationOrGeneralization = async (
    currentNodeId: string,
    linkId: string,
    fromModel: boolean = false,
  ) => {
    try {
      const nodeD =
        property === "generalizations" ? nodes[currentNodeId] : nodes[linkId];
      const linksLength = nodeD.generalizations.flatMap((c) => c.nodes).length;
      if (
        fromModel ||
        (await confirmIt(
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
            {linksLength <= 1 ? (
              <Typography sx={{ mt: "15px" }}>
                {`There's no other generalization linked to this node. Are you
                sure you want to unlink it and move it as a specialization under
              ${UNCLASSIFIED[nodes[linkId].nodeType]}`}
                ?
              </Typography>
            ) : (
              ""
            )}
          </Box>,
          "Unlink",
          "Keep",
        ))
      ) {
        const nodeDoc = await getDoc(
          doc(collection(db, NODES), currentVisibleNode?.id),
        );
        if (nodeDoc.exists()) {
          const nodeData = nodeDoc.data() as INode;
          const previousValue = JSON.parse(
            JSON.stringify(
              nodeData[property as "specializations" | "generalizations"],
            ),
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
          ].some((c: { nodes: ILinkNode[] }) => {
            const cIndex = c.nodes.findIndex((p) => p.id === linkId);
            return cIndex !== -1;
          });
          await updateDoc(nodeDoc.ref, nodeData);
          if (shouldBeRemovedFromParent) {
            await removeNodeLink(
              property as "specializations" | "generalizations",
              currentVisibleNode?.id,
              linkId,
            );
          }
          if (
            shouldBeRemovedFromParent &&
            nodes[linkId] &&
            !nodes[linkId].nodeType
          ) {
            const nodeType = nodes[linkId].nodeType;
            const unclassifiedNodeDocs = await getDocs(
              query(
                collection(db, NODES),
                where("unclassified", "==", true),
                where("nodeType", "==", nodeType),
              ),
            );

            if (unclassifiedNodeDocs.docs.length > 0 && previousValue) {
              const unclassifiedNodeDoc = unclassifiedNodeDocs.docs[0];
              if (property === "specializations") {
                const nodeRef = doc(collection(db, NODES), linkId);
                const generalizations = nodes[linkId].generalizations;
                const generalizationsLength = generalizations.flatMap(
                  (c) => c.nodes,
                ).length;

                let mCollectionIdx = generalizations.findIndex(
                  (c) => c.collectionName === "main",
                );
                if (mCollectionIdx === -1) {
                  generalizations.unshift({
                    collectionName: "main",
                    nodes: [],
                  });
                  mCollectionIdx = 0;
                }
                if (mCollectionIdx !== -1) {
                  generalizations[mCollectionIdx].nodes = generalizations[
                    mCollectionIdx
                  ].nodes.filter((g) => g.id !== nodeDoc.id);
                  if (generalizationsLength === 1) {
                    generalizations[0].nodes.push({
                      id: unclassifiedNodeDoc.id,
                    });
                  }

                  updateDoc(nodeRef, {
                    generalizations,
                  });
                }
                if (generalizationsLength === 1) {
                  const specializations =
                    nodes[unclassifiedNodeDoc.id].specializations;

                  const mainCollectionIdx = specializations.findIndex(
                    (c) => c.collectionName === "main",
                  );
                  if (mainCollectionIdx !== -1) {
                    specializations[mainCollectionIdx].nodes.push({
                      id: linkId,
                    });
                    updateDoc(unclassifiedNodeDoc.ref, {
                      specializations,
                    });
                  }
                }
              }

              if (property === "generalizations") {
                const nodesLength = previousValue.flatMap(
                  (c: ICollection) => c.nodes,
                ).length;

                const generalizations = nodeData.generalizations;
                if (nodesLength === 1) {
                  generalizations[0].nodes.push({ id: unclassifiedNodeDoc.id });

                  const specializations =
                    nodes[unclassifiedNodeDoc.id].specializations;

                  const mainCollectionIdx = specializations.findIndex(
                    (c) => c.collectionName === "main",
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
          }

          saveNewChangeLog(db, {
            nodeId: currentVisibleNode?.id,
            modifiedBy: user?.uname,
            modifiedProperty: property,
            previousValue,
            newValue:
              nodeData[property as "specializations" | "generalizations"],
            modifiedAt: new Date(),
            changeType: "remove element",
            fullNode: currentVisibleNode,
            skillsFuture,
          });
          if (property === "generalizations") {
            updateInheritanceWhenUnlinkAGeneralization(
              db,
              linkId,
              nodeData,
              nodes,
            );
          }
          if (property === "specializations") {
            updateInheritanceWhenUnlinkAGeneralization(
              db,
              nodeDoc.id,
              nodes[linkId],
              nodes,
            );
          }
        }
        await Post("/triggerChroma", {
          nodeId: currentNodeId,
          updateAll: false,
        });
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
    if (selectedProperty === property) {
      unlinkElement(link.id, collectionIndex);
    }
    const fromModel = selectedProperty === property;
    if (property === "specializations" || property === "generalizations") {
      unlinkSpecializationOrGeneralization(
        currentVisibleNode.id,
        link.id,
        fromModel,
      );
    } else {
      unlinkNodeRelation(currentVisibleNode.id, link.id, fromModel);
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

  const getSpecializations = (nodeId: string) => {
    return nodes[nodeId].specializations
      .flatMap((s) => s.nodes)
      .filter((n) => !!nodes[n.id]?.title);
  };

  return (
    <Box
      id={`${link.id}-${property}`}
      sx={{
        backgroundColor: !!swapIt
          ? (theme) => (theme.palette.mode === "dark" ? "#5f5e5d" : "#d9dfe6")
          : "",
        borderRadius: "25px",
        p: !!swapIt ? 1 : "",
        my: swapIt ? "5px" : "",
        animation: glowIds.has(`${link.id}-${property}`)
          ? `${glowGreen} 1.5s ease-in-out infinite`
          : "",
      }}
    >
      <ListItem
        ref={provided.innerRef}
        {...provided.draggableProps}
        {...provided.dragHandleProps}
        sx={{
          my: 1,
          p: 0.3,
          px: 1,
          display: "flex",
          borderRadius: "25px",

          ":hover": {
            backgroundColor: clonedNodesQueue.hasOwnProperty(link.id)
              ? ""
              : (theme) =>
                theme.palette.mode === "dark" ? "#5f5e5d" : "#d9dfe6",
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: 0 }}>
          <DragIndicatorIcon
            sx={{
              color:
                link.change === "added"
                  ? "green"
                  : link.change === "removed"
                    ? "red"
                    : "",
            }}
          />
        </ListItemIcon>
        {clonedNodesQueue.hasOwnProperty(link.id) ? (
          <LinkEditor
            reviewId={link.id}
            title={clonedNodesQueue[link.id]?.title || ""}
            checkDuplicateTitle={() => {}}
            setClonedNodesQueue={setClonedNodesQueue}
          />
        ) : (
          <Tooltip
            title={
              partsInheritance[link.id] ? (
                <span
                  style={{ display: "flex", gap: "4px", whiteSpace: "nowrap" }}
                >
                  {partsInheritance[link.id]?.inheritedFrom && (
                    <>
                      Inherited from{" "}
                      <strong style={{ fontSize: "12px" }}>
                        {'"'}
                        {partsInheritance[link.id].inheritedFrom}
                        {'"'},
                      </strong>
                    </>
                  )}
                  {partsInheritance[link.id]?.partInheritance && (
                    <>
                      Part{" "}
                      <strong style={{ fontSize: "12px", color: "orange" }}>
                        {partsInheritance[link.id].partInheritance}
                      </strong>
                    </>
                  )}
                </span>
              ) : (
                ""
              )
            }
            PopperProps={{
              modifiers: [
                {
                  name: "offset",
                  options: {
                    offset: [0, 8],
                  },
                },
              ],
              sx: {
                maxWidth: "none",
              },
            }}
            componentsProps={{
              tooltip: {
                sx: {
                  maxWidth: "none",
                  whiteSpace: "nowrap",
                  padding: 1,
                },
              },
            }}
            placement="top"
          >
            <Box sx={{ display: "flex", alignItems: "center" }}>
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
                {/* link.title || */ title || regionalTitle}{" "}
                {link.optional && (
                  <span
                    style={{ color: "gray", marginLeft: "2px" }}
                  >{`(optional)`}</span>
                )}
              </Link>

              {partsInheritance[link.id] && (
                <Box
                  style={{
                    width: "14px",
                    height: "14px",
                    borderRadius: "50%",
                    background: `${
                      partsInheritance[link.id]
                        ? partsInheritance[link.id].partInheritance
                          ? "orange"
                          : "green"
                        : ""
                    }`,
                    marginLeft: "8px",
                    boxShadow: "0 0 3px rgba(0, 0, 0, 0.3) inset",
                  }}
                ></Box>
              )}
            </Box>
          </Tooltip>
        )}

        <Box sx={{ display: "flex", alignItems: "center", ml: "auto" }}>
          {link.changeType === "sort" && (
            <SwapHorizIcon
              sx={{ color: getLinkColor(link.change), pl: "5px" }}
            />
          )}
          {((!locked &&
            !linkLocked &&
            !selectedDiffNode &&
            (!currentVisibleNode.unclassified ||
              property !== "generalizations") &&
            property !== "isPartOf") ||
            (clonedNodesQueue.hasOwnProperty(link.id) &&
              property !== "generalizations")) && (
              <>
                {loadingIds.has(link.id) ? (
                  <LoadingButton
                    loading
                    loadingIndicator={<CircularProgress size={20} />}
                    sx={{
                      borderRadius: "16px",
                      padding: "3px",
                      fontSize: "0.8rem",
                      minWidth: "40px",
                    }}
                    disabled
                  />
                ) : (
                  <Box sx={{ display: "flex" }}>
                    {clonedNodesQueue.hasOwnProperty(link.id) && (
                      <Tooltip title="Save">
                        <IconButton
                          sx={{
                            ml: "18px",
                            borderRadius: "18px",
                            fontSize: "12px",
                            p: 0.2,
                          }}
                          onClick={() => {
                            saveNewSpecialization(link.id);
                          }}
                        >
                          <CheckIcon sx={{ color: "green" }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip
                      title={
                        clonedNodesQueue.hasOwnProperty(link.id)
                          ? "Cancel"
                          : "Unlink"
                      }
                    >
                      <IconButton
                        sx={{
                          ml: "18px",
                          borderRadius: "18px",
                          fontSize: "12px",
                          p: 0.2,
                          display: !enableEdit ? "none" : "block",
                        }}
                        onClick={handleUnlinkNode}
                      >
                        {clonedNodesQueue.hasOwnProperty(link.id) ? (
                          <CloseIcon sx={{ color: "red" }} />
                        ) : (
                          <LinkOffIcon
                            sx={{ color: enableEdit ? "orange" : "gray" }}
                          />
                        )}
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
              </>
            )}

          {property === "parts" &&
            !currentImprovement &&
            !selectedDiffNode &&
            !clonedNodesQueue.hasOwnProperty(link.id) &&
            !loadingIds.has(link.id) &&
            enableEdit && (
              <Tooltip title={swapIt ? "Close" : "Specialize"}>
                <IconButton
                  sx={{
                    p: 0.2,
                    ml: 2,
                    backgroundColor: swapIt ? "orange" : "",
                  }}
                  onClick={() => {
                    setSwapIt((prev) => !prev);
                  }}
                >
                  {swapIt ? <CloseIcon /> : <SwapHorizIcon />}
                </IconButton>
              </Tooltip>
            )}
        </Box>

        {ConfirmDialog}
      </ListItem>
      {swapIt && property === "parts" && !selectedDiffNode && (
        <Box>
          {getSpecializations(link.id).map((n) => (
            <Tooltip key={n.id} title="Replace with" placement="left">
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  px: 1,
                  pl: 0,
                  borderRadius: "25px",
                  cursor: "pointer",
                  ":hover": {
                    backgroundColor: (theme) =>
                      theme.palette.mode === "dark" ? "#858381" : "#bec4cc",
                  },
                }}
                onClick={() => {
                  replaceWith(n.id, link.id);
                }}
              >
                <IconButton sx={{ p: 0.2, m: "6px" }}>
                  <SwapHorizIcon />
                </IconButton>

                <Typography>{nodes[n.id]?.title}</Typography>
              </Box>
            </Tooltip>
          ))}{" "}
          {addNew && (
            <Tooltip
              title="Save and replace with"
              placement="top"
              sx={{ mt: "15px", alignItems: "center" }}
            >
              <IconButton
                onClick={() => {
                  setAddNew(false);
                  saveNewAndSwapIt(newPart, link.id);
                }}
                sx={{ p: 0.3, m: "6px", bgcolor: "green" }}
                disabled={!newPart.trim()}
              >
                <SwapHorizIcon
                  sx={{ color: !!newPart.trim() ? "white" : "" }}
                />
              </IconButton>
            </Tooltip>
          )}
          {addNew && (
            <Tooltip title="Cancel" placement="top">
              <IconButton
                onClick={() => {
                  setAddNew(false);
                  setNewPart("");
                }}
                sx={{ p: 0.3, m: "6px", bgcolor: "red" }}
              >
                <CloseIcon sx={{ color: "white" }} />
              </IconButton>
            </Tooltip>
          )}
          {addNew && (
            <TextField
              value={newPart}
              onChange={(e: any) => {
                setNewPart(e.target.value);
              }}
              sx={{ width: "80%", m: "6px" }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  // saveNodeTitle();
                }
              }}
              placeholder="Node title..."
              fullWidth
              InputProps={{
                inputProps: {
                  style: {
                    padding: 10,
                  },
                },
              }}
            />
          )}
          {!addNew && (
            <Button
              sx={{
                display: "flex",
                // backgroundColor: "orange",
                borderRadius: "25px",
                p: 0.3,
                mt: 2,
                cursor: "pointer",
                width: "100%",
                ":hover": {
                  backgroundColor: "orange",
                },
                alignItems: "center",
              }}
              onClick={() => {
                setAddNew(true);
              }}
              variant="outlined"
            >
              <AddIcon />
              <Typography>New Specialization</Typography>
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
};

export default LinkNode;
