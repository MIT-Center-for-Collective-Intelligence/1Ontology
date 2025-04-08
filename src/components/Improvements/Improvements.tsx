import React, { useCallback, useState } from "react";
import { Button, CircularProgress, Box, Typography } from "@mui/material";
import ImprovementsSlider from "./ImprovementsSlider";
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import ReplayIcon from "@mui/icons-material/Replay";
import { NODES } from " @components/lib/firestoreClient/collections";
import { ICollection, INode } from " @components/types/INode";

import {
  checkIfCanDeleteANode,
  clearNotifications,
  generateInheritance,
  recordLogs,
  removeIsPartOf,
  saveNewChangeLog,
  unlinkPropertyOf,
  updateInheritance,
  updateLinks,
  updateLinksForInheritance,
  updateLinksForInheritanceSpecializations,
  updatePartsAndPartsOf,
  updatePropertyOf,
  updateSpecializations,
} from " @components/lib/utils/helpers";
import { useAuth } from "../context/AuthContext";
import { generateUniqueTitle } from " @components/lib/utils/string.utils";
import { development } from " @components/lib/CONSTANTS";
type ImprovementsProps = {
  currentImprovement: any;
  setCurrentImprovement: any;
  currentVisibleNode: any;
  setCurrentVisibleNode: any;
  nodes: Record<string, INode>;
  onNavigateToNode: any;
  isLoadingCopilot: boolean;
  improvements: any;
  setImprovements: any;
  handleImproveClick: any;
  copilotMessage: string;
  compareThisImprovement: any;
  confirmIt: any;
  currentIndex: number;
  setCurrentIndex: any;
  displayDiff: any;
};
const Improvements = ({
  currentImprovement,
  setCurrentImprovement,
  currentVisibleNode,
  setCurrentVisibleNode,
  nodes,
  onNavigateToNode,
  isLoadingCopilot,
  improvements,
  setImprovements,
  handleImproveClick,
  copilotMessage,
  compareThisImprovement,
  confirmIt,
  currentIndex,
  setCurrentIndex,
  displayDiff,
}: ImprovementsProps) => {
  const db = getFirestore();
  const [{ user }] = useAuth();

  const handleSaveLinkChanges = useCallback(
    async (
      property: string,
      newValue: ICollection[],
      addedLinks: string[],
      removedLinks: string[],
    ) => {
      try {
        if (!user?.uname) return;
        const newLinks = newValue?.flatMap((c) => c.nodes);
        // Close the modal or perform any other necessary actions
        // Get the node document from the database
        const nodeDoc = await getDoc(
          doc(collection(db, NODES), currentVisibleNode?.id),
        );

        // If the node document does not exist, return early
        if (!nodeDoc.exists()) return;

        // Extract existing node data from the document
        const nodeData = nodeDoc.data() as INode;

        // Handle specializations or generalizations

        for (let link of removedLinks) {
          await unlinkPropertyOf(db, property, currentVisibleNode?.id, link);
        }

        // Update links for specializations/generalizations
        if (property === "specializations" || property === "generalizations") {
          updateLinks(
            newLinks,
            { id: currentVisibleNode?.id },
            property === "specializations"
              ? "generalizations"
              : "specializations",
            nodes,
            db,
          );
        }

        // Update parts/isPartOf links
        if (property === "parts" || property === "isPartOf") {
          updatePartsAndPartsOf(
            newLinks,
            { id: currentVisibleNode?.id },
            property === "parts" ? "isPartOf" : "parts",
            db,
            nodes,
          );
        }

        // Reset inheritance for the comments under the property if applicable
        if (
          nodeData.inheritance &&
          !["specializations", "generalizations", "parts", "isPartOf"].includes(
            property,
          )
        ) {
          if (nodeData.inheritance[property]) {
            const reference = nodeData.inheritance[property].ref;
            if (
              reference &&
              nodes[reference].textValue &&
              nodes[reference].textValue.hasOwnProperty(property)
            ) {
              if (!nodeData.textValue) {
                nodeData.textValue = {
                  [property]: nodes[reference].textValue[property],
                };
              } else {
                nodeData.textValue[property] =
                  nodes[reference].textValue[property];
              }
            }
            nodeData.inheritance[property].ref = null;
          }
        }

        // Update other properties if applicable
        if (
          !["specializations", "generalizations", "parts", "isPartOf"].includes(
            property,
          )
        ) {
          updatePropertyOf(
            newLinks,
            { id: currentVisibleNode?.id },
            property,
            nodes,
            db,
          );
        }
        if (property === "specializations" || property === "generalizations") {
          nodeData[property] = newValue;
        } else {
          nodeData.properties[property] = newValue;
        }
        // Update the node document in the database
        await updateDoc(nodeDoc.ref, nodeData);

        const _addedLinks: { id: string }[] = [];
        addedLinks.forEach((id) => {
          _addedLinks.push({ id });
        });
        const _removedLinks: { id: string }[] = [];
        removedLinks.forEach((id) => {
          _removedLinks.push({ id });
        });
        //the user modified generalizations
        if (property === "generalizations") {
          await updateLinksForInheritance(
            db,
            currentVisibleNode?.id,
            _addedLinks,
            _removedLinks,
            currentVisibleNode,
            newLinks,
            nodes,
          );
        }
        if (property === "specializations") {
          await updateLinksForInheritanceSpecializations(
            db,
            currentVisibleNode?.id,
            _addedLinks,
            _removedLinks,
            currentVisibleNode,
            newLinks,
            nodes,
          );
        }
        // Update inheritance for non-specialization/generalization properties
        if (
          !["specializations", "generalizations", "isPartOf"].includes(property)
        ) {
          updateInheritance({
            nodeId: currentVisibleNode?.id,
            updatedProperties: [property],
            db,
          });
        }
      } catch (error: any) {
        // Handle any errors that occur during the process
        console.error(error);
        recordLogs({
          type: "error",
          error: JSON.stringify({
            name: error.name,
            message: error.message,
            stack: error.stack,
          }),
          at: "handleSaveLinkChanges",
        });
      }
    },
    [currentVisibleNode?.id, currentVisibleNode.title, db, nodes, user],
  );

  const updateStringProperty = async (
    nodeId: string,
    property: string,
    newValue: string,
  ) => {
    try {
      const nodeRef = doc(collection(db, NODES), nodeId);
      const nodeData = nodes[nodeId];
      if (property === "title") {
        await updateDoc(nodeRef, {
          [`${property}`]: newValue,
        });
      } else {
        await updateDoc(nodeRef, {
          [`properties.${property}`]: newValue,
          [`inheritance.${property}.ref`]: null,
        });
      }
      try {
        const serverURL = development
          ? process.env.NEXT_PUBLIC_DEV_WS_SERVER
          : process.env.NEXT_PUBLIC_WS_SERVER;

        const response = await fetch(
          `http://${serverURL}/update/${nodeId}-${property}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              newValue,
            }),
          },
        );

        if (response.ok) {
          await response.json();
        } else {
          await response.json();
        }
      } catch (error) {
        console.error(error);
      }

      if (nodeData.inheritance && !!nodeData.inheritance[property]?.ref) {
        await updateInheritance({
          nodeId: nodeId,
          updatedProperties: [property],
          db,
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
        at: "recordLogs",
      });
    }
  };

  const addNewNode = useCallback(
    async ({
      id,
      newNode,
      reasoning,
    }: {
      id: string;
      newNode: any;
      reasoning: string;
    }) => {
      try {
        if (!user?.uname) return;
        // Reference to the new node document
        setCurrentVisibleNode({
          id,
          ...newNode,
        });
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
          reasoning,
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
    [nodes, user?.uname],
  );

  // Function to add a new specialization to a node
  const addNewSpecialization = useCallback(
    async (
      collectionName: string = "main",
      newNode: INode,
      reasoning: string,
    ) => {
      try {
        if (!user?.uname) return;
        // handleCloseAddLinksModel();
        if (!collectionName) {
          collectionName = "main";
        }
        const parentId = newNode.generalizations[0]?.nodes[0]?.id;
        if (!parentId) {
          return;
        }
        // Get a reference to the parent node document
        const nodeParentRef = doc(collection(db, NODES), parentId);

        // Retrieve the parent node data
        const nodeParentData = nodes[parentId];
        const previousParentValue = JSON.parse(
          JSON.stringify(nodeParentData.specializations),
        );

        // Create a new node document reference
        const newNodeRef = doc(collection(db, NODES), newNode.id);

        // Remove the `locked` property if it exists
        if ("locked" in newNode) {
          delete newNode.locked;
        }

        // Update the parent node's specializations
        updateSpecializations(nodeParentData, newNodeRef.id, collectionName);

        if (newNode.properties["parts"][0].nodes.length > 0) {
          for (let { id: partId } of newNode.properties["parts"][0].nodes) {
            const partRef = doc(collection(db, NODES), partId);
            const partDoc = await getDoc(partRef);
            const partData = partDoc.data() as INode;
            const isPartOfNodes = partData.properties["isPartOf"][0].nodes;
            const index = isPartOfNodes.findIndex((n) => n.id === partId);
            if (index === -1) {
              isPartOfNodes.push({
                id: partId,
              });
              updateDoc(partRef, {
                "properties.isPartOf": [
                  {
                    collectionName: "main",
                    nodes: isPartOfNodes,
                  },
                ],
              });
            }
          }
        }

        if (newNode.properties["isPartOf"][0].nodes.length > 0) {
          for (let { id: partId } of newNode.properties["isPartOf"][0].nodes) {
            const partRef = doc(collection(db, NODES), partId);
            const partDoc = await getDoc(partRef);
            const partData = partDoc.data() as INode;
            const partsNodes = partData.properties["parts"][0].nodes;
            const index = partsNodes.findIndex((n) => n.id === partId);
            if (index === -1) {
              partsNodes.push({
                id: partId,
              });
              updateDoc(partRef, {
                "properties.parts": [
                  {
                    collectionName: "main",
                    nodes: partsNodes,
                  },
                ],
              });
            }
          }
        }
        // Add the new node to the database
        await addNewNode({ id: newNodeRef.id, newNode, reasoning });

        // Update the parent node document
        await updateDoc(nodeParentRef, {
          ...nodeParentData,
          specializations: nodeParentData.specializations,
        });

        // Save the change log
        saveNewChangeLog(db, {
          nodeId: parentId,
          modifiedBy: user?.uname,
          modifiedProperty: "specializations",
          previousValue: previousParentValue,
          newValue: nodeParentData.specializations,
          modifiedAt: new Date(),
          changeType: "add element",
          fullNode: nodeParentData,
        });
      } catch (error) {
        confirmIt("Sorry there was an Error please try again!", "Ok", "");
        console.error(error);
      }
    },
    [
      addNewNode,
      confirmIt,
      currentVisibleNode?.id,
      currentVisibleNode.root,
      currentVisibleNode.title,
      db,
    ],
  );

  const updateStringArray = async ({
    newValue,
    added,
    removed,
    property,
  }: {
    newValue: string[];
    added: string[];
    removed: string[];
    property: string;
  }) => {
    try {
      const previousValue: string[] = currentVisibleNode.properties[
        property
      ] as string[];

      const nodeRef = doc(collection(db, NODES), currentVisibleNode?.id);

      await updateDoc(nodeRef, {
        [`properties.${property}`]: newValue,
        [`inheritance.${property}.ref`]: null,
      });
      if (!!currentVisibleNode.inheritance[property]?.ref) {
        await updateInheritance({
          nodeId: currentVisibleNode?.id,
          updatedProperties: [property],
          db,
        });
      }
      let changeMessage: "add element" | "remove element" | "modify elements" =
        "add element";

      if (added.length === 1) {
        changeMessage = "add element";
      }
      if (removed.length === 1) {
        changeMessage = "remove element";
      }
      if (added.length > 1 || removed.length > 1) {
        changeMessage = "modify elements";
      }
      return {
        changeMessage,
        changeDetails: {
          addedElements: added,
          removedElements: removed,
        },
      };
    } catch (error) {
      console.error(error);
    }
  };
  //  function to handle the deletion of a Node
  const deleteNode = useCallback(
    async (nodeId: string) => {
      try {
        const nodeValue = nodes[nodeId];
        // Confirm deletion with the user using a custom confirmation dialog

        if (!user?.uname) return;

        const specializations = nodeValue.specializations.flatMap(
          (n) => n.nodes,
        );

        if (specializations.length > 0) {
          if (checkIfCanDeleteANode(nodes, specializations)) {
            await confirmIt(
              "To delete a node, you need to first delete its specializations or move them under a different generalization.",
              "Ok",
              "",
            );
            return;
          }
        }
        if (
          await confirmIt(
            `Are you sure you want to delete this Node?`,
            "Delete Node",
            "Keep Node",
          )
        ) {
          const currentNode: INode = JSON.parse(JSON.stringify(nodeValue));
          // Retrieve the document reference of the node to be deleted
          for (let collection of nodeValue.generalizations) {
            if (collection.nodes.length > 0) {
              setCurrentVisibleNode(nodes[collection.nodes[0].id]);
              break;
            }
          }

          const nodeRef = doc(collection(db, NODES), currentNode.id);
          // call removeIsPartOf function to remove the node link from all the nodes where it's linked
          await removeIsPartOf(db, currentNode as INode, user?.uname);
          // Update the user document by removing the deleted node's ID
          await updateDoc(nodeRef, { deleted: true, deletedAt: new Date() });

          saveNewChangeLog(db, {
            nodeId: currentNode.id,
            modifiedBy: user?.uname,
            modifiedProperty: null,
            previousValue: null,
            newValue: null,
            modifiedAt: new Date(),
            changeType: "delete node",
            fullNode: currentNode,
          });
          // Record a log entry for the deletion action
          clearNotifications(nodeRef.id);
          recordLogs({
            action: "Deleted Node",
            node: nodeValue.id,
          });
        }
      } catch (error: any) {
        // Log any errors that occur during the execution of the function
        console.error(error);
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
    [user?.uname, nodes],
  );
  const onAcceptChange = async (change: any) => {
    try {
      if (!!change?.deleteNode) {
        await deleteNode(change.nodeId);
        return;
      }
      if (!!change?.newNode) {
        await addNewSpecialization("main", change.node, change.reasoning);
        return;
      }

      const reasoning = change.change.reasoning;

      let changeType: any = null;
      let detailsChange = null;
      if (
        change.modifiedProperty === "specializations" ||
        (change.modiPropertyType !== "string" &&
          change.modiPropertyType !== "string-array")
      ) {
        changeType = "modify elements";

        const addedLinks = [];
        const removedLinks = [];
        for (let collection of change.detailsOfChange.comparison) {
          for (let node of collection.nodes) {
            if (node.change === "added") {
              addedLinks.push(node.id);
            }
            if (node.change === "removed") {
              removedLinks.push(node.id);
            }
          }
        }

        await handleSaveLinkChanges(
          change.modifiedProperty,
          change.detailsOfChange.newValue,
          addedLinks,
          removedLinks,
        );
      } else if (change.modiPropertyType === "string") {
        changeType = "change text";
        await updateStringProperty(
          change.nodeId,
          change.modifiedProperty,
          change.detailsOfChange.newValue,
        );
      } else if (change.modiPropertyType === "string-array") {
        const { changeMessage, changeDetails } = (await updateStringArray({
          newValue: change.detailsOfChange.final_array,
          added: change.detailsOfChange.addedElements,
          removed: change.detailsOfChange.removedElements,
          property: change.modifiedProperty,
        })) as any;
        changeType = changeMessage;
        detailsChange = changeDetails;
      }
      if (user?.uname && changeType) {
        const changeLog: any = {
          nodeId: currentVisibleNode?.id,
          modifiedBy: user?.uname,
          modifiedProperty: change.modifiedProperty,
          previousValue: change.detailsOfChange.previousValue,
          newValue: change.detailsOfChange.newValue,
          modifiedAt: new Date(),
          changeType,
          fullNode: currentVisibleNode,
          reasoning: reasoning || "",
        };
        if (detailsChange) {
          changeLog.detailsChange = detailsChange;
        }
        saveNewChangeLog(db, changeLog);
        return changeLog;
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Box textAlign="center" sx={{ width: "450px", mt: "27px" }}>
      {isLoadingCopilot ? (
        <Box display="flex" flexDirection="column" alignItems="center">
          <CircularProgress />
          <Typography variant="body1" marginTop={2}>
            Loading...
          </Typography>
        </Box>
      ) : improvements.length > 0 ? (
        <Box
          sx={{
            overflow: "auto",
            height: "90vh",
            "&::-webkit-scrollbar": {
              display: "none",
            },
          }}
        >
          <Box sx={{ p: 3 }}>
            <Typography
              sx={{ textAlign: "left", fontWeight: "bold", fontSize: "22px" }}
            >
              AI Assistant Message:
            </Typography>
            <Typography sx={{ textAlign: "left" }}>{copilotMessage}</Typography>
          </Box>
          <ImprovementsSlider
            proposals={improvements}
            setCurrentImprovement={setCurrentImprovement}
            currentImprovement={currentImprovement}
            handleAcceptChange={onAcceptChange}
            setImprovements={setImprovements}
            setCurrentVisibleNode={setCurrentVisibleNode}
            onNavigateToNode={onNavigateToNode}
            compareThisImprovement={compareThisImprovement}
            currentIndex={currentIndex}
            setCurrentIndex={setCurrentIndex}
          />
          <Button
            variant="contained"
            onClick={handleImproveClick}
            sx={{ mt: "24px" }}
            className="re-analyze"
          >
            <ReplayIcon sx={{ pr: "5px" }} />
            Re-Analyze
          </Button>
        </Box>
      ) : (
        <Button variant="contained" onClick={handleImproveClick}>
          Analyze the Sub-Ontology Centered Around This Node
        </Button>
      )}
    </Box>
  );
};

export default Improvements;
