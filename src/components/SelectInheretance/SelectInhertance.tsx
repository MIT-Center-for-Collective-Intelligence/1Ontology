import React from "react";
import { TextField, MenuItem, Box } from "@mui/material";

import {
  doc,
  collection,
  updateDoc,
  getFirestore,
  writeBatch,
  WriteBatch,
} from "firebase/firestore";
import { NODES } from " @components/lib/firestoreClient/collections";
import { recordLogs, updateInheritance } from " @components/lib/utils/helpers";
import { getTitle } from " @components/lib/utils/string.utils";
import { INode, ICollection, ILinkNode } from " @components/types/INode";

const SelectInheritance = ({
  currentVisibleNode,
  property,
  nodes,
}: {
  currentVisibleNode: INode;
  property: string;
  nodes: { [nodeId: string]: INode };
}) => {
  const inheritanceRef = currentVisibleNode.inheritance?.[property]?.ref || "";

  // Map the generalizations to get the title and id
  const generalizations = currentVisibleNode.generalizations
    .flatMap((gen: ICollection) => gen.nodes)
    .map((node: ILinkNode) => ({
      id: node.id,
      title: getTitle(nodes, node.id),
    }));

  const db = getFirestore();

  const updateSpecializationsInheritance = async (
    specializations: ICollection[],
    batch: any,
    property: string,
    ref: string,
    generalizationId: string,
    modifiedInheritanceFor: string
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
          modifiedInheritanceFor
        );
      }
    }

    return newBatch;
  };
  const changeInheritance = (
    event: React.ChangeEvent<HTMLInputElement>,
    property: string
  ) => {
    try {
      const newGeneralizationId = event.target.value;

      if (newGeneralizationId && newGeneralizationId !== inheritanceRef) {
        const nodeRef = doc(collection(db, NODES), currentVisibleNode.id);
        updateDoc(nodeRef, {
          [`inheritance.${property}.ref`]: newGeneralizationId,
        })
          .then(async () => {
            let batch = writeBatch(db);
            batch = await updateSpecializationsInheritance(
              nodes[currentVisibleNode.id].specializations,
              batch,
              property,
              newGeneralizationId,
              currentVisibleNode.id,
              currentVisibleNode.id
            );
            await batch.commit();
          })
          .catch((error) => {
            console.error("Failed to update inheritance:", error);
          });
      }
    } catch (error: any) {
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

  if (
    !inheritanceRef ||
    generalizations.length <= 1 ||
    !generalizations.some((gen) => gen.id === inheritanceRef)
  ) {
    return null;
  }

  return (
    <Box sx={{ ml: "auto" }}>
      <TextField
        value={inheritanceRef}
        onChange={(e: any) => changeInheritance(e, property)}
        select
        label="Change Inheritance"
        sx={{ minWidth: "200px" }}
        InputProps={{
          sx: {
            height: "40px",
            borderRadius: "18px",
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
          <MenuItem key={generalization.id} value={generalization.id}>
            {generalization.title}
          </MenuItem>
        ))}
      </TextField>
    </Box>
  );
};

export default SelectInheritance;