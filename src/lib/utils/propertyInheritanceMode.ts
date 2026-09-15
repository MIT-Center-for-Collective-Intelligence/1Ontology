import {
  collection,
  doc,
  getFirestore,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { NODES } from "@components/lib/firestoreClient/collections";
import { ICollection, INode } from "@components/types/INode";
import { InheritanceMode } from "@components/components/Common/PartInheritanceModeButton";

/**
 * Persist a property's inheritanceType on the node and propagate to
 * specializations — same rules as the Manage Inheritance sidebar.
 */
export async function setPropertyInheritanceMode(params: {
  nodeId: string;
  property: string;
  mode: InheritanceMode;
  nodes: { [id: string]: INode };
  fetchNode?: (nodeId: string) => Promise<INode | null>;
}): Promise<void> {
  const { nodeId, property, mode, nodes, fetchNode } = params;
  const db = getFirestore();
  const nodeRef = doc(collection(db, NODES), nodeId);

  await updateDoc(nodeRef, {
    [`inheritance.${property}.inheritanceType`]: mode,
  });

  const resolveNode = async (id: string): Promise<INode | null> => {
    if (nodes[id]) return nodes[id];
    if (fetchNode) return fetchNode(id);
    return null;
  };

  const propagate = async (
    specializations: { id: string }[],
    batch: ReturnType<typeof writeBatch>,
    ref: string,
  ): Promise<ReturnType<typeof writeBatch>> => {
    let newBatch = batch;
    for (const specialization of specializations) {
      const specializationData = await resolveNode(specialization.id);
      if (!specializationData) continue;

      const specRef = doc(collection(db, NODES), specialization.id);
      let objectUpdate: Record<string, any> = {
        [`inheritance.${property}.inheritanceType`]: mode,
      };

      if (mode === "neverInherit") {
        const referenceId = specializationData.inheritance?.[property]?.ref;
        objectUpdate = {
          ...objectUpdate,
          [`inheritance.${property}.ref`]: null,
          [`inheritance.${property}.title`]: "",
        };
        if (referenceId) {
          const referenceNode = await resolveNode(referenceId);
          if (referenceNode) {
            objectUpdate[`properties.${property}`] =
              referenceNode.properties[property];
          }
        }
      } else {
        const sourceNode = await resolveNode(ref);
        objectUpdate = {
          ...objectUpdate,
          [`inheritance.${property}.ref`]: ref,
          [`inheritance.${property}.title`]: sourceNode?.title ?? "",
        };
      }

      if ((newBatch as any)._committed) {
        newBatch = writeBatch(db);
      }
      newBatch.update(specRef, objectUpdate);

      if ((newBatch as any)._mutations?.length > 498) {
        await newBatch.commit();
        newBatch = writeBatch(db);
      }

      const childSpecs = (
        specializationData.specializations ?? []
      ).flatMap((c: ICollection) => c.nodes ?? []);
      if (childSpecs.length > 0) {
        newBatch = await propagate(childSpecs, newBatch, ref);
      }
    }
    return newBatch;
  };

  const root = nodes[nodeId];
  if (!root?.specializations) return;

  let batch = writeBatch(db);
  batch = await propagate(
    root.specializations.flatMap((c) => c.nodes ?? []),
    batch,
    nodeId,
  );
  await batch.commit();
}
