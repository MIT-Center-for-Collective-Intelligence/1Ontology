import React, { useCallback } from "react";
import { Button, CircularProgress, Box, Typography } from "@mui/material";
import ImprovementsSlider from "./ImprovementsSlider";
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  updateDoc,
} from "firebase/firestore";
import { NODES } from " @components/lib/firestoreClient/collections";
import { ICollection, INode } from " @components/types/INode";

import {
  recordLogs,
  unlinkPropertyOf,
  updateInheritance,
  updateLinks,
  updateLinksForInheritance,
  updateLinksForInheritanceSpecializations,
  updatePartsAndPartsOf,
  updatePropertyOf,
} from " @components/lib/utils/helpers";
import { useAuth } from "../context/AuthContext";
type ImprovementsProps = {
  currentImprovement: any;
  setCurrentImprovement: any;
  currentVisibleNode: any;
  setCurrentVisibleNode: any;
  nodes: Record<string, INode>;
  navigateToNode: any;
  isLoadingCopilot: boolean;
  improvements: any;
  setImprovements: any;
  handleImproveClick: any;
  copilotMessage: string;
};
const Improvements = ({
  currentImprovement,
  setCurrentImprovement,
  currentVisibleNode,
  setCurrentVisibleNode,
  nodes,
  navigateToNode,
  isLoadingCopilot,
  improvements,
  setImprovements,
  handleImproveClick,
  copilotMessage,
}: ImprovementsProps) => {
  const db = getFirestore();
  const [{ user }] = useAuth();

  const onRejectChange = () => {
    /*  onRejectChange*/
  };

  const handleSaveLinkChanges = useCallback(
    async (
      property: string,
      newValue: ICollection[],
      addedLinks: { id: string }[],
      removedLinks: { id: string }[]
    ) => {
      try {
        if (!user?.uname) return;
        const oldLinks = newValue?.flatMap((c) => c.nodes);
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
          await unlinkPropertyOf(db, property, currentVisibleNode.id, link.id);
        }

        // Update links for specializations/generalizations
        if (property === "specializations" || property === "generalizations") {
          updateLinks(
            oldLinks,
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
            oldLinks,
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
            oldLinks,
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

        //the user modified generalizations
        if (property === "generalizations") {
          await updateLinksForInheritance(
            db,
            currentVisibleNode.id,
            addedLinks,
            removedLinks,
            currentVisibleNode,
            oldLinks,
            nodes
          );
        }
        if (property === "specializations") {
          await updateLinksForInheritanceSpecializations(
            db,
            currentVisibleNode.id,
            addedLinks,
            removedLinks,
            currentVisibleNode,
            oldLinks,
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

      await updateDoc(nodeRef, {
        [`properties.${property}`]: newValue,
      });

      const serverURL =
        process.env.NODE_ENV === "development"
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
      if (nodeData.inheritance && nodeData.inheritance[property].ref !== null) {
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

  const onAcceptChange = async (change: any) => {
    try {
      for (let dChange of change.detailsOfChange) {
        if (dChange.structuredProperty) {
          await handleSaveLinkChanges(
            dChange.modifiedProperty,
            dChange.newValue,
            dChange.addedLinks,
            dChange.removedLinks
          );
        } else {
          await updateStringProperty(
            change.nodeId,
            dChange.modifiedProperty,
            dChange.newValue
          );
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
        <Box>
          <Box sx={{ p: 2 }}>
            <Typography sx={{ textAlign: "left", fontWeight: "bold" }}>
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
            handleRejectChange={onRejectChange}
            setCurrentVisibleNode={setCurrentVisibleNode}
            navigateToNode={navigateToNode}
          />
          <Button
            variant="contained"
            onClick={handleImproveClick}
            sx={{ mt: "24px" }}
          >
            Suggest Improvements to the Sub-Ontology Centered Around This Node
          </Button>
        </Box>
      ) : (
        <Button variant="contained" onClick={handleImproveClick}>
          Suggest Improvements to the Sub-Ontology Centered Around This Node
        </Button>
      )}
    </Box>
  );
};

export default Improvements;
