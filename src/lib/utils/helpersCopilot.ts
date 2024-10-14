import { ICollection, INode } from " @components/types/INode";
import {
  collection,
  getDocs,
  getFirestore,
  query,
  where,
} from "firebase/firestore";
import { NODES } from "../firestoreClient/collections";
const db = getFirestore();
type IComparePropertiesReturn = {
  modifiedProperty: string;
  previousValue: any;
  newValue: any;
};
export const compareProperties = async (
  nodeProps: any,
  proposalProps: any,
  improvement: any
): Promise<IComparePropertiesReturn[]> => {
  const detailsOfChange: IComparePropertiesReturn[] = [];
  Object.keys(nodeProps).forEach(async (propertyName) => {
    if (proposalProps[propertyName] !== undefined) {
      const nodeValue = nodeProps[propertyName];
      const proposalValue = proposalProps[propertyName];

      // Compare based on type
      if (Array.isArray(nodeValue) && Array.isArray(proposalValue)) {
        let changedProperty = false;
        const nodePropertyIds = (nodeProps[propertyName] as ICollection[])
          .flatMap((spec) => spec.nodes)
          .map((n) => n.id);
        const proposalPropertyIds: string[] = [];
        for (let collection of improvement[propertyName]) {
          const newNodes = [];
          for (let nodeTitle of collection.nodes) {
            const id = await getNodeIdByTitle(nodeTitle);
            if (id) {
              newNodes.push({
                id,
              });
              proposalPropertyIds.push(id);
            }
          }
          collection.nodes = newNodes;
        }

        // Compare arrays
        const missingItems = proposalPropertyIds.filter(
          (item: any) => !nodePropertyIds.includes(item)
        );
        const extraItems = nodePropertyIds.filter(
          (item: any) => !proposalPropertyIds.includes(item)
        );

        if (missingItems.length > 0) {
          changedProperty = true;
        }
        if (extraItems.length > 0) {
          changedProperty = true;
        }
        if (changedProperty) {
          detailsOfChange.push({
            modifiedProperty: propertyName,
            previousValue: nodeProps[propertyName],
            newValue: improvement[propertyName],
          });
          changedProperty = false;
        }
      } else if (
        typeof nodeValue !== "object" &&
        JSON.stringify(nodeValue) !== JSON.stringify(proposalValue)
      ) {
        console.log(
          `Property "${propertyName}" changed from "${JSON.stringify(
            nodeValue
          )}" to "${JSON.stringify(proposalValue)}"`
        );
        detailsOfChange.push({
          modifiedProperty: propertyName,
          previousValue: nodeValue,
          newValue: proposalValue,
        });
      }
    } else {
      console.log(`Property "${propertyName}" was removed.`);
    }
  });

  // Check for new properties in the proposal that are not in the node
  // Object.keys(proposalProps).forEach((key) => {
  //   if (!nodeProps[key]) {
  //     console.log(
  //       `New property "${key}" added: "${JSON.stringify(proposalProps[key])}"`
  //     );
  //   }
  // });

  return detailsOfChange;
};

export const getNodeIdByTitle = async (title: string) => {
  const docs = await getDocs(
    query(
      collection(db, NODES),
      where("title", "==", title),
      where("deleted", "==", false)
    )
  );
  if (docs.docs.length > 0) {
    const docData = docs.docs[0].data() as INode;
    return docs.docs[0].id;
  }
  return null;
};
