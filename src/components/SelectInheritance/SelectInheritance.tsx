import React, { useEffect, useState } from "react";
import { TextField, MenuItem, Box } from "@mui/material";

import {
  doc,
  collection,
  updateDoc,
  getFirestore,
  writeBatch,
  getDoc,
} from "firebase/firestore";
import { NODES } from "@components/lib/firestoreClient/collections";
import { recordLogs } from "@components/lib/utils/helpers";
import { getTitle } from "@components/lib/utils/string.utils";
import { INode, ICollection, ILinkNode } from "@components/types/INode";

const SelectInheritance = ({
  currentVisibleNode,
  property,
  enableEdit,
}: {
  currentVisibleNode: INode;
  property: string;
  enableEdit: boolean;
}) => {
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
      title: node.title || getTitle(node.id),
    }));

    // Note: Without nodes object, we can't filter based on inheritance refs
    // This filtering has been removed - all generalizations are shown

    const index = _generalizations.findIndex(
      (g: any) => g.id === inheritanceRef,
    );
    if (index === -1) {
      const title =
        inheritanceRef === "inheritance-overridden"
          ? "Inheritance Overridden"
          : getTitle(inheritanceRef);
      _generalizations.push({
        id: inheritanceRef,
        title:
          inheritanceRef === "inheritance-overridden"
            ? "Inheritance Overridden"
            : getTitle(inheritanceRef),
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
  }, [currentVisibleNode.generalizations, inheritanceRef]);

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
        // Fetch the node from Firestore to check its inheritance
        const linkNodeDoc = await getDoc(doc(collection(db, NODES), link.id));
        if (!linkNodeDoc.exists()) continue;

        const linkNodeData = linkNodeDoc.data() as INode;
        const nodeRef = doc(collection(db, NODES), link.id);

        if (
          !linkNodeData.inheritance[property]?.ref ||
          generalizationId === linkNodeData.inheritance[property]?.ref ||
          modifiedInheritanceFor === linkNodeData.inheritance[property]?.ref
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

        if (linkNodeData.specializations) {
          newBatch = await updateSpecializationsInheritance(
            linkNodeData.specializations,
            newBatch,
            property,
            ref,
            link.id,
            modifiedInheritanceFor,
          );
        }
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

        // Fetch the new generalization node from Firestore to check its inheritance
        const newGenDoc = await getDoc(
          doc(collection(db, NODES), newGeneralizationId)
        );
        if (newGenDoc.exists()) {
          const newGeneralization = newGenDoc.data() as INode;
          if (newGeneralization.inheritance[property]?.ref) {
            newGeneralizationId = newGeneralization.inheritance[property].ref;
          }
        }

        updateDoc(nodeRef, {
          [`inheritance.${property}.ref`]: newGeneralizationId,
        })
          .then(async () => {
            let batch = writeBatch(db);
            batch = await updateSpecializationsInheritance(
              currentVisibleNode.specializations,
              batch,
              property,
              newGeneralizationId,
              currentVisibleNode?.id,
              currentVisibleNode?.id,
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
  // Don't render if inheritanceType is neverInherit
  if (
    currentVisibleNode.inheritance[property]?.inheritanceType === "neverInherit"
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
