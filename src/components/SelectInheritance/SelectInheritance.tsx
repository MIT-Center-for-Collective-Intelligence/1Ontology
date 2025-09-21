import React, { useEffect, useState } from "react";
import { TextField, MenuItem, Box } from "@mui/material";

import {
  doc,
  collection,
  updateDoc,
  getFirestore,
  writeBatch,
  WriteBatch,
} from "firebase/firestore";
import { NODES } from "@components/lib/firestoreClient/collections";
import { recordLogs } from "@components/lib/utils/helpers";
import { getTitle } from "@components/lib/utils/string.utils";
import { INode, ICollection, ILinkNode } from "@components/types/INode";

const SelectInheritance = ({
  currentVisibleNode,
  property,
  nodes,
  enableEdit,
  onInheritanceChange, // Callback to communicate with Text component
}: {
  currentVisibleNode: INode;
  property: string;
  nodes: { [nodeId: string]: INode };
  enableEdit: boolean;
  onInheritanceChange?: (property: string, newInheritanceRef: string) => any;
}) => {
  // Don't render if inheritanceType is neverInherit
  if (currentVisibleNode.inheritance[property]?.inheritanceType === "neverInherit") {
    return null;
  }

  const db = getFirestore();
  const [generalizations, setGeneralizations] = useState<
    { id: string; title: string }[]
  >([]);

  const inheritanceRef =
    currentVisibleNode.inheritance?.[property]?.ref || "inheritance-overridden";

  useEffect(() => {
    let _generalizations: any = [
      ...currentVisibleNode.generalizations.flatMap(
        (gen: ICollection) => gen.nodes,
      ),
    ].map((node: ILinkNode) => ({
      id: node.id,
      title: getTitle(nodes, node.id),
    }));

    _generalizations = _generalizations.filter((g: any) => {
      return (
        !nodes[g.id]?.inheritance[property]?.ref ||
        nodes[g.id]?.inheritance[property]?.ref !== inheritanceRef
      );
    });
    const index = _generalizations.findIndex(
      (g: any) => g.id === inheritanceRef,
    );
    if (index === -1) {
      const title =
        inheritanceRef === "inheritance-overridden"
          ? "Inheritance Overridden"
          : getTitle(nodes, inheritanceRef);
      _generalizations.push({
        id: inheritanceRef,
        title:
          inheritanceRef === "inheritance-overridden"
            ? "Inheritance Overridden"
            : getTitle(nodes, inheritanceRef),
        fullTitle: title,
      });
    }

    _generalizations.forEach((c: any) => {
      const title = c?.title;
      const truncatedTitle =
        title.length > 25 ? title.slice(0, 22) + "..." : title;
      c.title = truncatedTitle;
    });
    setGeneralizations(_generalizations);
  }, [currentVisibleNode.generalizations, inheritanceRef, nodes]);

  // Map the generalizations to get the title and id

  const updateSpecializationsInheritance = async (
    specializations: ICollection[],
    batch: any,
    property: string,
    ref: string,
    generalizationId: string,
    modifiedInheritanceFor: string,
  ) => {
    let newBatch = batch;
    for (let { nodes: links } of specializations) {
      for (let link of links) {
        const nodeRef = doc(collection(db, NODES), link.id);
        if (
          !nodes[link.id].inheritance.ref ||
          generalizationId === nodes[link.id].inheritance[property].ref ||
          modifiedInheritanceFor === nodes[link.id].inheritance[property].ref
        ) {
          let objectUpdate = {
            [`inheritance.${property}.ref`]: ref,
          };
          if (newBatch._committed) {
            newBatch = writeBatch(db);
          }
          newBatch.update(nodeRef, objectUpdate);
        }

        if (newBatch._mutations.length > 498) {
          await newBatch.commit();
          newBatch = writeBatch(db);
        }

        newBatch = await updateSpecializationsInheritance(
          nodes[link.id].specializations,
          newBatch,
          property,
          ref,
          link.id,
          modifiedInheritanceFor,
        );
      }
    }

    return newBatch;
  };

  const changeInheritance = async (
    event: React.ChangeEvent<HTMLInputElement>,
    property: string,
  ) => {
    try {
      let newGeneralizationId = event.target.value;

      if (newGeneralizationId && newGeneralizationId !== inheritanceRef) {
        const nodeRef = doc(collection(db, NODES), currentVisibleNode?.id);
        const newGeneralization = nodes[newGeneralizationId];
        
        if (newGeneralization?.inheritance?.[property]?.ref) {
          newGeneralizationId = newGeneralization.inheritance[property].ref;
        }

        updateDoc(nodeRef, {
          [`inheritance.${property}.ref`]: newGeneralizationId,
        });

        // Notify parent component (Text) about the inheritance change
        // This will trigger the Yjs awareness message via MarkdownEditor to YjsEditorWrapper
        if (onInheritanceChange) {
          onInheritanceChange(property, newGeneralizationId);
        }

        // Update specializations
        try {
          let batch = writeBatch(db);
          batch = await updateSpecializationsInheritance(
            nodes[currentVisibleNode?.id].specializations,
            batch,
            property,
            newGeneralizationId,
            currentVisibleNode?.id,
            currentVisibleNode?.id,
          );
          await batch.commit();
        } catch (error) {
          console.error("Failed to update specializations:", error);
        }
      }
    } catch (error: any) {
      console.error("Failed to update inheritance:", error);
      recordLogs({
        type: "error",
        error: JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
        at: "saveChangeLog",
      });
    }
  };

  return (
    <Box sx={{ ml: "auto" }}>
      <TextField
        value={inheritanceRef}
        onChange={(e: any) => changeInheritance(e, property)}
        select
        label="Change Inheritance"
        sx={{
          minWidth: "200px",
          display: !enableEdit ? "none" : "flex",
        }}
        InputProps={{
          sx: {
            height: "40px",
            borderRadius: "18px",
            color: inheritanceRef === "inheritance-overridden" ? "gray" : "",
          },
        }}
        InputLabelProps={{
          style: { color: "grey" },
        }}
      >
        <MenuItem
          value=""
          disabled
          sx={{
            backgroundColor: (theme) =>
              theme.palette.mode === "dark" ? "" : "white",
          }}
        >
          Select Inheritance
        </MenuItem>
        {generalizations.map((generalization) => (
          <MenuItem
            key={generalization.id}
            value={generalization.id}
            sx={{
              color:
                generalization.id === "inheritance-overridden" ? "orange" : "",
            }}
          >
            {generalization.title}
          </MenuItem>
        ))}
      </TextField>
    </Box>
  );
};

export default SelectInheritance;
