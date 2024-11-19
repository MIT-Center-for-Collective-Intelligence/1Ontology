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
  createNewNode,
  generateInheritance,
  recordLogs,
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
      removedLinks: string[]
    ) => {
      try {
        if (!user?.uname) return;
        const newLinks = newValue?.flatMap((c) => c.nodes);
        // Close the modal or perform any other necessary actions
        // Get the node document from the database
        const nodeDoc = await getDoc(
          doc(collection(db, NODES), currentVisibleNode.id)
        );

        // If the node document does not exist, return early
        if (!nodeDoc.exists()) return;

        // Extract existing node data from the document
        const nodeData = nodeDoc.data() as INode;

        // Handle specializations or generalizations

        for (let link of removedLinks) {
          await unlinkPropertyOf(db, property, currentVisibleNode.id, link);
        }

        // Update links for specializations/generalizations
        if (property === "specializations" || property === "generalizations") {
          updateLinks(
            newLinks,
            { id: currentVisibleNode.id },
            property === "specializations"
              ? "generalizations"
              : "specializations",
            nodes,
            db
          );
        }

        // Update parts/isPartOf links
        if (property === "parts" || property === "isPartOf") {
          updatePartsAndPartsOf(
            newLinks,
            { id: currentVisibleNode.id },
            property === "parts" ? "isPartOf" : "parts",
            db,
            nodes
          );
        }

        // Reset inheritance for the comments under the property if applicable
        if (
          nodeData.inheritance &&
          !["specializations", "generalizations", "parts", "isPartOf"].includes(
            property
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
            property
          )
        ) {
          updatePropertyOf(
            newLinks,
            { id: currentVisibleNode.id },
            property,
            nodes,
            db
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
            currentVisibleNode.id,
            _addedLinks,
            _removedLinks,
            currentVisibleNode,
            newLinks,
            nodes
          );
        }
        if (property === "specializations") {
          await updateLinksForInheritanceSpecializations(
            db,
            currentVisibleNode.id,
            _addedLinks,
            _removedLinks,
            currentVisibleNode,
            newLinks,
            nodes
          );
        }
        // Update inheritance for non-specialization/generalization properties
        if (
          !["specializations", "generalizations", "isPartOf"].includes(property)
        ) {
          updateInheritance({
            nodeId: currentVisibleNode.id,
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
    [currentVisibleNode.id, currentVisibleNode.title, db, nodes, user]
  );

  const updateStringProperty = async (
    nodeId: string,
    property: string,
    newValue: string
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
        }
      );

      if (response.ok) {
        await response.json();
      } else {
        await response.json();
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
    [nodes, user?.uname]
  );

  // Function to add a new specialization to a node
  const addNewSpecialization = useCallback(
    async (
      collectionName: string = "main",
      newNode: INode,
      reasoning: string
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
          JSON.stringify(nodeParentData.specializations)
        );

        // Create a new node document reference
        const newNodeRef = doc(collection(db, NODES), newNode.id);

        // Remove the `locked` property if it exists
        if ("locked" in newNode) {
          delete newNode.locked;
        }

        // Update the parent node's specializations
        updateSpecializations(nodeParentData, newNodeRef.id, collectionName);

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
      currentVisibleNode.id,
      currentVisibleNode.root,
      currentVisibleNode.title,
      db,
    ]
  );
  const onAcceptChange = async (change: any) => {
    try {
      if (change?.newNode) {
        await addNewSpecialization("main", change.node, change.reasoning);
        return;
      }

      for (let dChange of change.detailsOfChange) {
        const reasoning =
          change.modifiedProperties[dChange.modifiedProperty].reasoning;

        let changeType: any = null;

        if (dChange.structuredProperty) {
          changeType = "modify elements";
          await handleSaveLinkChanges(
            dChange.modifiedProperty,
            dChange.newValue,
            dChange.addedLinks,
            dChange.removedLinks
          );
        } else {
          changeType = "change text";
          await updateStringProperty(
            change.nodeId,
            dChange.modifiedProperty,
            dChange.newValue
          );
        }
        if (user?.uname && changeType) {
          const changeLog = {
            nodeId: currentVisibleNode.id,
            modifiedBy: user?.uname,
            modifiedProperty: dChange.modifiedProperty,
            previousValue: dChange.previousValue,
            newValue: dChange.newValue,
            modifiedAt: new Date(),
            changeType,
            fullNode: currentVisibleNode,
            reasoning,
          };
          saveNewChangeLog(db, {
            nodeId: currentVisibleNode.id,
            modifiedBy: user?.uname,
            modifiedProperty: dChange.modifiedProperty,
            previousValue: dChange.previousValue,
            newValue: dChange.newValue,
            modifiedAt: new Date(),
            changeType,
            fullNode: currentVisibleNode,
            reasoning,
          });
          return changeLog;
        }
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
              Copilot Message:
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
