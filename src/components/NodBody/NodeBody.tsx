import React, { useMemo, useRef, useState } from "react";
import { Box, Button, Typography, useTheme } from "@mui/material";
import { ICollection, INode } from " @components/types/INode";
import Text from "../OntologyComponents/Text";
import {
  collection,
  doc,
  getFirestore,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { NODES } from " @components/lib/firestoreClient/collections";
import StructuredProperty from "../StructuredProperty/StructuredProperty";
import { DISPLAY, PROPERTIES_ORDER } from " @components/lib/CONSTANTS";
import {
  recordLogs,
  saveNewChangeLog,
  updateInheritance,
} from " @components/lib/utils/helpers";
import AddPropertyForm from "../AddPropertyForm/AddPropertyForm";
import { useAuth } from "../context/AuthContext";

interface NodeBodyProps {
  currentVisibleNode: INode;
  setCurrentVisibleNode: Function;
  showListToSelect: Function;
  navigateToNode: Function;
  setSnackbarMessage: Function;
  setSelectedProperty: Function;
  nodes: { [id: string]: INode };
  locked: boolean;
  selectedDiffNode: any;
  getTitleNode: any;
  confirmIt: any;
  onGetPropertyValue: any;
  currentImprovement: any;
}

const NodeBody: React.FC<NodeBodyProps> = ({
  currentVisibleNode,
  setCurrentVisibleNode,
  showListToSelect,
  navigateToNode,
  setSnackbarMessage,
  setSelectedProperty,
  nodes,
  locked,
  selectedDiffNode,
  getTitleNode,
  confirmIt,
  onGetPropertyValue,
  currentImprovement,
}) => {
  const theme = useTheme();
  const BUTTON_COLOR = theme.palette.mode === "dark" ? "#373739" : "#dde2ea";
  const db = getFirestore();
  const [openAddProperty, setOpenAddProperty] = useState(false);
  const [{ user }] = useAuth();
  const scrollRef = useRef<any>(null);

  const properties = useMemo(() => {
    if (
      (selectedDiffNode && selectedDiffNode?.changeType === "add property") ||
      selectedDiffNode?.changeType === "add property"
    ) {
      return selectedDiffNode?.fullNode.properties;
    } else {
      return currentVisibleNode.properties;
    }
  }, [currentVisibleNode, selectedDiffNode]);

  const currentNode = useMemo(() => {
    if (
      selectedDiffNode &&
      (selectedDiffNode?.changeType === "add property" ||
        selectedDiffNode?.changeType === "add property")
    ) {
      return selectedDiffNode.fullNode;
    } else {
      return currentVisibleNode;
    }
  }, [currentVisibleNode, selectedDiffNode]);

  const removeProperty = async (property: string) => {
    if (
      await confirmIt(
        <Typography>
          Are sure you want delete the property{" "}
          <strong>{DISPLAY[property] || property}</strong>?
        </Typography>,
        "Delete",
        "Keep"
      )
    ) {
      const nodeRef = doc(collection(db, NODES), currentVisibleNode.id);
      const properties = currentVisibleNode.properties;
      const propertyType = currentVisibleNode.propertyType;
      delete properties[property];
      await updateDoc(nodeRef, { propertyType, properties });
      recordLogs({
        action: "removeProperty",
        node: currentVisibleNode.id,
        property,
      });
    }
  };

  const updateSpecializationsInheritance = async (
    specializations: ICollection[],
    batch: any,
    property: string,
    propertyValue: any,
    ref: string,
    propertyType: string
  ) => {
    try {
      let newBatch = batch;
      for (let { nodes: links } of specializations) {
        for (let link of links) {
          const nodeRef = doc(collection(db, NODES), link.id);
          let objectUpdate = {
            [`inheritance.${property}.inheritanceType`]:
              "inheritUnlessAlreadyOverRidden",
            [`properties.${property}`]: propertyValue,
            [`inheritance.${property}.ref`]: ref,
            [`propertyType.${property}`]: propertyType,
          };

          if (newBatch._committed) {
            newBatch = writeBatch(db);
          }
          updateDoc(nodeRef, objectUpdate);

          if (newBatch._mutations.length > 498) {
            await newBatch.commit();
            newBatch = writeBatch(db);
          }

          newBatch = await updateSpecializationsInheritance(
            nodes[link.id].specializations,
            newBatch,
            property,
            propertyValue,
            ref,
            propertyType
          );
        }
      }

      return newBatch;
    } catch (error) {
      console.error(error);
    }
  };

  const addNewProperty = async (
    newProperty: string,
    newPropertyType: string
  ) => {
    try {
      if (!user) return;
      if (newProperty in currentVisibleNode.properties) {
        await confirmIt(
          `The property ${newProperty} already exist under this node`,
          "Ok",
          ""
        );
        return;
      }
      if (!newProperty.trim() || !newPropertyType.trim()) return;
      const nodeRef = doc(collection(db, NODES), currentVisibleNode.id);
      const properties = currentVisibleNode.properties;
      const previousValue = JSON.parse(
        JSON.stringify(currentVisibleNode.properties)
      );
      const propertyType = currentVisibleNode.propertyType;
      const inheritance = currentVisibleNode.inheritance;

      propertyType[newProperty] = newPropertyType.toLowerCase();

      if (newPropertyType.toLowerCase() === "string") {
        properties[newProperty] = "";
      } else {
        properties[newProperty] = [{ collectionName: "main", nodes: [] }];
      }
      inheritance[newProperty] = {
        ref: null,
        inheritanceType: "inheritUnlessAlreadyOverRidden",
      };
      await updateDoc(nodeRef, {
        properties,
        propertyType,
        inheritance,
      });
      saveNewChangeLog(db, {
        nodeId: currentVisibleNode.id,
        modifiedBy: user?.uname,
        modifiedProperty: null,
        previousValue,
        newValue: properties,
        modifiedAt: new Date(),
        changeType: "add property",
        fullNode: currentVisibleNode,
        changeDetails: { addedProperty: newProperty },
      });

      setOpenAddProperty(false);

      const batch = writeBatch(db);
      await updateSpecializationsInheritance(
        currentVisibleNode.specializations,
        batch,
        newProperty,
        properties[newProperty],
        currentVisibleNode.id,
        newPropertyType.toLowerCase()
      );
      await batch.commit();

      recordLogs({
        action: "add new property",
        node: currentVisibleNode.id,
        newProperty,
        newPropertyType,
      });
    } catch (error: any) {
      setOpenAddProperty(false);
      recordLogs({
        type: "error",
        error: JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
      });
    }
  };

  const orderOfProperties = useMemo(() => {
    const priorityOrder = PROPERTIES_ORDER[currentVisibleNode.nodeType] || [];

    const sortedKeys = Object.keys(properties || {})
      .filter(
        (p) =>
          p !== "parts" &&
          p !== "isPartOf" &&
          p !== "description" &&
          p !== "actor" &&
          p !== "context"
      )
      .sort((a, b) => {
        const indexA = priorityOrder.indexOf(a);
        const indexB = priorityOrder.indexOf(b);

        // Force "References" to be placed at the bottom
        if (a === "References") return 1;
        if (b === "References") return -1;

        if (indexA !== -1 && indexB !== -1) return indexA - indexB;

        if (indexA !== -1) return -1;

        if (indexB !== -1) return 1;

        return 0;
      });

    return sortedKeys;
  }, [currentVisibleNode, properties]);

  return (
    <Box>
      <Box>
        {orderOfProperties.map((property: string, index) => (
          <Box key={property} sx={{ mt: "15px" }}>
            {currentNode.propertyType[property] !== "string" ? (
              <StructuredProperty
                key={property + index}
                confirmIt={confirmIt}
                selectedDiffNode={selectedDiffNode}
                currentVisibleNode={currentNode}
                showListToSelect={showListToSelect}
                setSelectedProperty={setSelectedProperty}
                navigateToNode={navigateToNode}
                setSnackbarMessage={setSnackbarMessage}
                setCurrentVisibleNode={setCurrentVisibleNode}
                property={property}
                nodes={nodes}
                locked={locked}
                onGetPropertyValue={onGetPropertyValue}
                currentImprovement={currentImprovement}
              />
            ) : (
              property !== "description" &&
              currentNode.propertyType[property] === "string" && (
                <Text
                  text={onGetPropertyValue(property)}
                  currentVisibleNode={currentNode}
                  property={property}
                  setCurrentVisibleNode={setCurrentVisibleNode}
                  nodes={nodes}
                  locked={locked}
                  selectedDiffNode={selectedDiffNode}
                  getTitleNode={getTitleNode}
                  confirmIt={confirmIt}
                  currentImprovement={currentImprovement}
                />
              )
            )}
          </Box>
        ))}
      </Box>
      {!locked && openAddProperty && (
        <AddPropertyForm
          addNewProperty={addNewProperty}
          setOpenAddProperty={setOpenAddProperty}
          locked={locked}
          exitingProperties={Object.keys(properties || {})}
        />
      )}
      {!locked && !openAddProperty && !currentImprovement && (
        <Button
          onClick={() => {
            setOpenAddProperty(true);
            if (scrollRef.current) {
              setTimeout(() => {
                scrollRef.current.scrollIntoView({
                  behavior: "smooth",
                  block: "end",
                });
              }, 10);
            }
          }}
          variant="outlined"
          sx={{
            borderRadius: "18px",
            backgroundColor: BUTTON_COLOR,
            mt: "15px",
          }}
        >
          Add New Property
        </Button>
      )}
      <div ref={scrollRef}></div>
    </Box>
  );
};

export default NodeBody;

/* (
  <ul>
    {Object.keys(
      currentVisibleNode.properties[property] || {}
    ).map((category: any) => {
      const children =
        currentVisibleNode.properties[property][category] || [];
      return (
        <Box key={category} id={category}>
          {category !== "main" && (
            <li>
              <Box
                sx={{ display: "flex", alignItems: "center" }}
              >
                <Typography sx={{ fontWeight: "bold" }}>
                  {category}
                </Typography>{" "}
                :
                <Button
                  onClick={() => showList(property, category)}
                  sx={{ ml: "5px" }}
                >
                  {"Select"} {property}
                </Button>
                <Button
                  onClick={() =>
                    handleEditCategory(property, category)
                  }
                  sx={{ ml: "5px" }}
                >
                  Edit
                </Button>
                <Button
                  onClick={() =>
                    deleteCategory(property, category)
                  }
                  sx={{ ml: "5px" }}
                >
                  Delete
                </Button>
              </Box>
            </li>
          )}

          <ul>
            {children.map((child: any) => (
              <li key={child.id}>
                <ChildNode
                  navigateToNode={navigateToNode}
                  recordLogs={recordLogs}
                  setSnackbarMessage={setSnackbarMessage}
                  currentVisibleNode={currentVisibleNode}
                  setCurrentVisibleNode={setCurrentVisibleNode}
                  sx={{ mt: "15px" }}
                  child={child}
                  type={property}
                  category={category}
                  updateInheritance={updateInheritance}
                />
              </li>
            ))}
          </ul>
        </Box>
      );
    })}
  </ul>
)} */
