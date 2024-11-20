import { ICollection, INode } from " @components/types/INode";
import { Improvement } from "./copilotPrompts";
import { recordLogs } from "./helpers";

export const compareProperty = (
  change: any,
  nodeData: INode,
  property: string,
  nodesByTitle: { [nodeTitle: string]: INode }
) => {
  try {
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
    let addedNonExistentElements = [];
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
        } else {
          addedNonExistentElements.push(nodeTitle);
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
    return {
      changedProperty,
      removedLinks,
      addedLinks,
      collectionsModified,
      addedNonExistentElements,
    };
  } catch (error) {
    console.error("error at compareProperty", error);
  }
};
export const filterProposals = async (
  improvements: any[],
  nodesByTitle: { [nodeTitle: string]: INode }
): Promise<Improvement[]> => {
  try {
    const improvementsCopy = JSON.parse(JSON.stringify(improvements));
    const filteredImprovements = [];
    for (let improvement of improvementsCopy) {
      const nodeData = nodesByTitle[improvement?.title];
      if (improvement?.title && nodeData) {
        const changes = [];
        for (let _change of improvement.changes) {
          const change = JSON.parse(JSON.stringify(_change));
          const property = Object.keys(change).filter(
            (k) => k !== "reasoning"
          )[0];

          if (
            typeof nodeData.properties[property] === "string" ||
            typeof change[property] === "string"
          ) {
            const newValue = change[property];
            const previousValue =
              property === "title"
                ? nodeData.title
                : nodeData.properties[property];
            if (newValue !== previousValue) {
              changes.push(change);
            }
          } else {
            if (property !== "specializations") {
              change[property] = [
                { collectionName: "main", nodes: change[property] },
              ];
            } else {
              const mainCollectionIdx = change[property].findIndex(
                (c: any) => c.collectionName === "main"
              );
              if (mainCollectionIdx === -1) {
                change[property].push({
                  collectionName: "main",
                  nodes: [],
                });
              }
            }
            const response: any = compareProperty(
              change,
              nodeData,
              property,
              nodesByTitle
            );
            const { changedProperty } = response;

            if (changedProperty) {
              changes.push(_change);
            }
          }
        }
        if (changes.length > 0) {
          improvement.changes = changes;
          filteredImprovements.push(improvement);
        }
      }
    }

    return filteredImprovements;
  } catch (error: any) {
    console.error("Error comparing proposals:", error);
    recordLogs({
      type: "error",
      error: JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack,
      }),
      at: "filterProposals",
    });
    return [];
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
            } else {
              const mainCollectionIdx = change[property].findIndex(
                (c: any) => c.collectionName === "main"
              );
              if (mainCollectionIdx === -1) {
                change[property].push({
                  collectionName: "main",
                  nodes: [],
                });
              }
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

export const compareImprovement = (
  improvement: any,
  nodesByTitle: { [nodeTitle: string]: INode }
) => {
  const _improvement = JSON.parse(JSON.stringify(improvement));
  const nodeData = nodesByTitle[improvement.title];

  if (nodeData) {
    const detailsOfChange = [];
    const modifiedProperties: any = {};
    for (let change of _improvement.changes) {
      const property = Object.keys(change).filter((k) => k !== "reasoning")[0];
      if (!property) {
        continue;
      }
      if (!!_improvement?.implemented) {
        modifiedProperties[property] = { reasoning: change.reasoning };
        continue;
      }
      if (
        typeof nodeData.properties[property] === "string" ||
        property === "title"
      ) {
        modifiedProperties[property] = { reasoning: change.reasoning };
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
        } else {
          const mainCollectionIdx = change[property].findIndex(
            (c: any) => c.collectionName === "main"
          );
          if (mainCollectionIdx === -1) {
            change[property].push({
              collectionName: "main",
              nodes: [],
            });
          }
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
          addedNonExistentElements,
        } = response;

        const isParentOrChild =
          property === "specializations" || property === "generalizations";
        const previousValue = isParentOrChild
          ? nodeData[property as "specializations" | "generalizations"]
          : nodeData.properties[property];

        modifiedProperties[property] = {
          reasoning: change.reasoning,
          addedNonExistentElements,
        };
        if (changedProperty) {
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
    _improvement.detailsOfChange = detailsOfChange;
    _improvement.nodeId = nodeData.id;
    _improvement.modifiedProperties = modifiedProperties;
  }
  return _improvement;
};
