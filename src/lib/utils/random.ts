import { INode } from " @components/types/INode";
import { query, collection, where, getDocs } from "firebase/firestore";
import { NODES } from "../firestoreClient/collections";

export const handleDownload = async ({ user, db }: {user: any, db: any}) => {
  // try {
  const nodesCollection = query(
    collection(db, NODES),
    where("deleted", "==", false),
    where("root", "==", "hn9pGQNxmQe9Xod5MuKK")
  );
  const querySnapshot = await getDocs(nodesCollection);
  let i = 0;
  // for (let nodeDoc of querySnapshot.docs) {
  //   const nodeData = { ...nodeDoc.data(), id: nodeDoc.id } as INode;
  //   if (nodeData.specializations) {
  //     for (let category of Object.keys(nodeData.specializations)) {
  //       for (let specialization of nodeData.specializations[category]) {
  //         const specNodeRef = doc(collection(db, NODES), specialization.id);
  //         const specNodeDoc = await getDoc(specNodeRef);
  //         if (!specNodeDoc.exists()) {
  //           console.log("Specialization not found: ", specialization?.id);
  //         } else {
  //           const specNodeData = specNodeDoc.data() as INode;
  //           /*       if (specNodeData.title !== specialization.title) {
  //             console.log(
  //               "Specialization title mismatch: ",
  //               specNodeData.title,
  //               specialization.title
  //             );
  //           } */
  //           if (specNodeData.generalizations) {
  //             let generalizationound = false;
  //             for (let categ of Object.keys(nodeData.generalizations)) {
  //               if (
  //                 specNodeData.generalizations[categ]?.findIndex(
  //                   (generali) => generali.id === nodeData.id
  //                 ) !== -1
  //               ) {
  //                 generalizationound = true;
  //               }
  //             }
  //             if (!generalizationound) {
  //               console.log("Generalization not found: ", {
  //                 specialization: specNodeData.title,
  //                 node: nodeData.title,
  //               });
  //             }
  //           } else {
  //             console.log("Specialization has no generalizations: ", {
  //               specialization: specNodeData.title,
  //               node: nodeData.title,
  //             });
  //           }
  //         }
  //       }
  //     }
  //   }
  //   if (nodeData.generalizations) {
  //     for (let category of Object.keys(nodeData.generalizations)) {
  //       for (let generalization of nodeData.generalizations[category]) {
  //         const genNodeRef = doc(collection(db, NODES), generalization.id);
  //         const genNodeDoc = await getDoc(genNodeRef);
  //         if (!genNodeDoc.exists()) {
  //           console.log("Generalization not found: ", generalization.id);
  //         } else {
  //           const genNodeData = genNodeDoc.data() as INode;
  //           /*         if (genNodeData.title !== generalization.title) {
  //             console.log(
  //               "Generalization title mismatch: ",
  //               genNodeData.title,
  //               generalization.title
  //             );
  //           } */
  //           if (genNodeData.specializations) {
  //             let specializationFound = false;
  //             for (let categ of Object.keys(nodeData.specializations)) {
  //               if (
  //                 genNodeData.specializations[categ]?.findIndex(
  //                   (speciali) => speciali.id === nodeData.id
  //                 ) !== -1
  //               ) {
  //                 specializationFound = true;
  //               }
  //             }
  //             if (!specializationFound) {
  //               console.log("Specialization not found: ", {
  //                 generalization: genNodeData.title,
  //                 node: nodeData.title,
  //               });
  //             }
  //           } else {
  //             console.log("Generalization has no specializations: ", {
  //               generalization: genNodeData.title,
  //               node: nodeData.title,
  //             });
  //           }
  //         }
  //       }
  //     }
  //   }
  //   if (nodeData.properties.parts) {
  //     for (let category of Object.keys(nodeData.properties.parts)) {
  //       for (let part of nodeData.properties.parts[category]) {
  //         const partNodeRef = doc(collection(db, NODES), part.id);
  //         const partNodeDoc = await getDoc(partNodeRef);
  //         if (!partNodeDoc.exists()) {
  //           console.log("Part not found: ", part.title);
  //         } else {
  //           const partNodeData = partNodeDoc.data() as INode;
  //           /*                 if (partNodeData.title !== part.title) {
  //             console.log(
  //               "Part title mismatch: ",
  //               partNodeData.title,
  //               part.title
  //             );
  //           } */
  //           if (partNodeData.properties.isPartOf) {
  //             let isPartOfFound = false;
  //             for (let categ of Object.keys(nodeData.properties.isPartOf)) {
  //               if (
  //                 partNodeData.properties.isPartOf[categ].findIndex(
  //                   (partOf: { id: string }) => partOf.id === nodeData.id
  //                 ) !== -1
  //               ) {
  //                 isPartOfFound = true;
  //               }
  //             }
  //             if (!isPartOfFound) {
  //               console.log("IsPartOf not found: ", {
  //                 part: partNodeData.title,
  //                 node: nodeData.title,
  //               });
  //             }
  //           } else {
  //             console.log("Part has no isPartOf: ", {
  //               part: partNodeData.title,
  //               node: nodeData.title,
  //             });
  //           }
  //         }
  //       }
  //     }
  //   }
  //   if (nodeData.properties.isPartOf) {
  //     for (let category of Object.keys(nodeData.properties.isPartOf)) {
  //       for (let isPartOf of nodeData.properties.isPartOf[category]) {
  //         const isPartOfNodeRef = doc(collection(db, NODES), isPartOf.id);
  //         const isPartOfNodeDoc = await getDoc(isPartOfNodeRef);
  //         if (!isPartOfNodeDoc.exists()) {
  //           console.log("IsPartOf not found: ", isPartOf.title);
  //         } else {
  //           const isPartOfNodeData = isPartOfNodeDoc.data() as INode;
  //           /*                 if (isPartOfNodeData.title !== isPartOf.title) {
  //             console.log(
  //               "IsPartOf title mismatch: ",
  //               isPartOfNodeData.title,
  //               isPartOf.title
  //             );
  //           } */
  //           if (isPartOfNodeData.properties.parts) {
  //             let partFound = false;
  //             for (let categ of Object.keys(nodeData.properties.parts)) {
  //               if (
  //                 isPartOfNodeData.properties.parts[categ].findIndex(
  //                   (part: { id: string }) => part.id === nodeData.id
  //                 ) !== -1
  //               ) {
  //                 partFound = true;
  //               }
  //             }
  //             if (!partFound) {
  //               console.log("Part not found: ", {
  //                 isPartOf: isPartOfNodeData.title,
  //                 node: nodeData.title,
  //               });
  //             }
  //           } else {
  //             console.log("IsPartOf has no parts: ", {
  //               isPartOf: isPartOfNodeData.title,
  //               node: nodeData.title,
  //             });
  //           }
  //         }
  //       }
  //     }
  //   }
  //   console.log("Node: ", i++);
  // }

  const data = querySnapshot.docs.map((doc) =>
    getStructureForJSON({
      ...doc.data(),
    } as INode)
  );

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "nodes-data.json";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // } catch (error) {
  //   console.error("Error downloading JSON: ", error);
  // }
};

const getStructureForJSON = (data: INode) => {
  const getTitles = (property: any) => {
    return Object.values(property)
      .flat()
      .map((prop: any) => prop.title);
  };

  const { properties } = data;
  for (let property in properties) {
    if (typeof properties[property] !== "string") {
      properties[property] = getTitles(properties[property]);
    }
  }
  return {
    title: data.title,
    generalizations: getTitles(data.generalizations),
    specializations: getTitles(data.specializations),
    parts: [],
    isPartOf: [],
    // ...properties,
  };
};