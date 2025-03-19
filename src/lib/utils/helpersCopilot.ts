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
const compareProperties = async (
  nodeProps: any,
  proposalProps: any,
  improvement: any,
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
        const missingItems = nodePropertyIds.filter(
          (item: any) => !proposalPropertyIds.includes(item),
        );
        const extraItems = proposalPropertyIds.filter(
          (item: any) => !nodePropertyIds.includes(item),
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
        // `Property "${propertyName}" changed from "${JSON.stringify(
        //   nodeValue
        // )}" to "${JSON.stringify(proposalValue)}"`;
        detailsOfChange.push({
          modifiedProperty: propertyName,
          previousValue: nodeValue,
          newValue: proposalValue,
        });
      }
    } else {
      // `Property "${propertyName}" was removed.`
    }
  });

  // Check for new properties in the proposal that are not in the node
  // Object.keys(proposalProps).forEach((key) => {
  //   if (!nodeProps[key]) {

  //   }
  // });

  return detailsOfChange;
};

export const getNodeIdByTitle = async (title: string) => {
  const docs = await getDocs(
    query(
      collection(db, NODES),
      where("title", "==", title),
      where("deleted", "==", false),
    ),
  );
  if (docs.docs.length > 0) {
    const docData = docs.docs[0].data() as INode;
    return docs.docs[0].id;
  }
  return null;
};

export const getStructureForJSON = (
  data: INode,
  nodes: Record<string, INode>,
) => {
  const getTitlesWithCollections = (propertyValue: ICollection[]) => {
    const propertyWithTitles: { collectionName: string; nodes: string[] }[] =
      [];
    for (let collection of propertyValue) {
      const theNodes = [];
      for (let node of collection.nodes) {
        if (nodes[node.id]) {
          theNodes.push(nodes[node.id].title);
        }
      }
      if (collection.collectionName !== "main" || theNodes.length !== 0) {
        propertyWithTitles.push({
          collectionName: collection.collectionName,
          nodes: theNodes,
        });
      }
    }
    return propertyWithTitles;
  };

  const getTitles = (propertyValue: ICollection[]) => {

    const propertyWithTitles: string[] = [];
    for (let collection of propertyValue) {
      for (let node of collection?.nodes || []) {
        if (nodes[node.id]) {
          propertyWithTitles.push(nodes[node.id].title);
        }
      }
    }
    return propertyWithTitles;
  };

  const properties: any = { ...data.properties };
  const textValue = { ...data.textValue };
  for (let property in properties) {
    if (property in data.inheritance && !!data.inheritance[property].ref) {
      delete properties[property];
    } else if (
      typeof properties[property] !== "string" &&
      data.propertyType[property] !== "string-array"
    ) {
      properties[property] = getTitles(properties[property]);
    }
  }
  if (textValue && Object.keys(textValue).length > 0) {
    properties.comments = textValue;
  }
  if ("References" in properties) {
    delete properties.References;
  }
  return {
    title: data.title,
    nodeType: data.nodeType,
    generalizations: getTitles(data.generalizations),
    specializations: getTitlesWithCollections(data.specializations),
    ...properties,
  };
};

export const getNodesInThreeLevels = (
  nodeData: INode,
  nodes: Record<string, INode>,
  visited: Set<string>,
  deepNumber: number,
  inputProperties: Set<string>,
  level: number = 0,
): any[] => {
  const nodesArray: any[] = [];

  if (level === deepNumber) {
    return nodesArray;
  }
  const specializations = nodeData.specializations.flatMap(
    (c: ICollection) => c.nodes,
  );
  const generalizations = nodeData.generalizations.flatMap(
    (c: ICollection) => c.nodes,
  );
  const items = [];
  if (inputProperties.has("specializations")) {
    items.push(...specializations);
  }
  if (inputProperties.has("generalizations")) {
    items.push(...generalizations);
  }

  for (let property in nodeData.properties) {
    if (
      Array.isArray(nodeData.properties[property]) &&
      nodeData.propertyType[property] !== "string-array" &&
      inputProperties.has(property)
    ) {
      const propertyNodes = (
        nodeData.properties[property] as ICollection[]
      ).flatMap((c: ICollection) => c.nodes);
      items.push(...propertyNodes);
    }
  }
  for (let item of items) {
    const itemData = nodes[item.id];
    if (itemData && !visited.has(itemData.title) && !itemData?.deleted) {
      const nodeD = getStructureForJSON(itemData, nodes);
      nodesArray.push(nodeD);
      visited.add(itemData.title);
      const p = getNodesInThreeLevels(
        itemData,
        nodes,
        visited,
        deepNumber,
        inputProperties,
        level + 1,
      );
      if (Array.isArray(p)) {
        nodesArray.push(...p);
      }
    }
  }

  return nodesArray;
};
