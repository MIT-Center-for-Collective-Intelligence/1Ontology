import { ICollection, INode } from " @components/types/INode";

export const compareProperty = (
  change: any,
  nodeData: INode,
  property: string,
  nodesByTitle: { [nodeTitle: string]: INode }
) => {
  try {
    debugger;
    let changedProperty = false;
    const isParentOrChild =
      property === "specializations" || property === "generalizations";
    const propertyValue = isParentOrChild
      ? nodeData[property as "specializations" | "generalizations"]
      : nodeData.properties[property];
    if (!Array.isArray(propertyValue)) return;

    const nodePropertyIds = propertyValue
      .flatMap((spec) => spec.nodes)
      .map((n) => n.id);

    const existingCollectionNames = propertyValue.map(
      (c: ICollection) => c.collectionName
    );

    const proposalPropertyIds: string[] = [];
    for (let collection of change[property]) {
      const newNodes = [];
      for (let nodeTitle of collection.nodes) {
        const id = nodesByTitle[nodeTitle]?.id;
        if (id) {
          newNodes.push({
            id,
          });
          proposalPropertyIds.push(id);
        }
      }
      collection.nodes = newNodes;
    }

    const addedLinks = proposalPropertyIds.filter(
      (id: string) => !nodePropertyIds.includes(id)
    );
    const removedLinks = nodePropertyIds.filter(
      (id: string) => !proposalPropertyIds.includes(id)
    );
    if (removedLinks.length > 0) {
      changedProperty = true;
    }
    if (addedLinks.length > 0) {
      changedProperty = true;
    }

    const proposedCollectionNames = change[property].map(
      (c: ICollection) => c.collectionName
    );

    const removedCollections = existingCollectionNames.filter(
      (name: string) => !proposedCollectionNames.includes(name)
    );

    const addedCollections = proposedCollectionNames.filter(
      (name: string) => !existingCollectionNames.includes(name)
    );
    let collectionsModified = false;
    if (removedCollections.length > 0) {
      changedProperty = true;
      collectionsModified = true;
    }

    if (addedCollections.length > 0) {
      changedProperty = true;
      collectionsModified = true;
    }
    const collectionMainIdx = change[property].findIndex(
      (c: ICollection) => c.collectionName === "main"
    );
    if (collectionMainIdx === -1) {
      change[property].push({
        collectionName: "main",
        nodes: [],
      });
    }
    return { changedProperty, removedLinks, addedLinks, collectionsModified };
  } catch (error) {
    console.error("error at compareProperty", error);
  }
};

export const compareProposals = async (
  improvements: any[],
  nodesByTitle: { [nodeTitle: string]: INode }
) => {
  try {
    const improvementsCopy = JSON.parse(JSON.stringify(improvements));

    for (let improvement of improvementsCopy) {
      const nodeData = nodesByTitle[improvement.title];
      if (nodeData) {
        const detailsOfChange = [];
        const modifiedProperties: any = {};
        for (let change of improvement.changes) {
          const property = Object.keys(change).filter(
            (k) => k !== "reasoning"
          )[0];

          if (
            typeof nodeData.properties[property] === "string" ||
            property === "title"
          ) {
            modifiedProperties[property] = change.reasoning;
            detailsOfChange.push({
              modifiedProperty: property,
              previousValue:
                property === "title"
                  ? nodeData.title
                  : nodeData.properties[property],
              newValue: change[property],
            });
          } else {
            if (property !== "specializations") {
              change[property] = [
                { collectionName: "main", nodes: change[property] },
              ];
            }
            const response: any = compareProperty(
              change,
              nodeData,
              property,
              nodesByTitle
            );
            const {
              changedProperty,
              removedLinks,
              addedLinks,
              collectionsModified,
            } = response;

            const isParentOrChild =
              property === "specializations" || property === "generalizations";
            const previousValue = isParentOrChild
              ? nodeData[property as "specializations" | "generalizations"]
              : nodeData.properties[property];

            if (changedProperty) {
              modifiedProperties[property] = change.reasoning;
              detailsOfChange.push({
                modifiedProperty: property,
                previousValue,
                newValue: change[property],
                collectionsModified,
                structuredProperty: true,
                removedLinks: removedLinks,
                addedLinks: addedLinks,
              });
            }
          }
        }
        improvement.detailsOfChange = detailsOfChange;
        improvement.nodeId = nodeData.id;
        improvement.modifiedProperties = modifiedProperties;
      }
    }

    return improvementsCopy;
  } catch (error) {
    console.error("Error comparing proposals:", error);
  }
};