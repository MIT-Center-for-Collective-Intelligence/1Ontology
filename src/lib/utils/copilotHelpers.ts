import { ICollection, ILinkNode, INode } from " @components/types/INode";
import { IChange, Improvement } from "./copilotPrompts";
import { recordLogs } from "./helpers";

export const getChangeComparison = ({
  change,
  nodeData,
  nodesByTitle,
}: {
  change: Partial<IChange>;
  nodeData: INode;
  nodesByTitle: { [title: string]: { id: string } };
}) => {
  try {
    const modifiedProperty: string = change.modified_property as string;
    const addedNonExistentElements: string[] = [];

    const propertyType = nodeData.propertyType[modifiedProperty];
    const result: ICollection[] = [];
    const final_result: ICollection[] = [];
    /*  */
    if (
      modifiedProperty === "specializations" &&
      Array.isArray(change.new_value)
    ) {
      const addedCollections = [];
      const specializations = nodeData[modifiedProperty as "specializations"];
      const _collections = specializations.flatMap((c) => c.collectionName);
      const nodesToRemove = new Set();
      for (let collection of change.new_value) {
        if (!_collections.includes(collection.collectionName)) {
          addedCollections.push(collection.collectionName);
        }

        const nodes = [];
        const final_nodes = [];
        for (let title of collection.collection_changes.final_array) {
          const nodeId = nodesByTitle[title].id;
          if (!nodeId) {
            addedNonExistentElements.push(title);
            continue;
          }
          if (collection.collection_changes.nodes_to_add.includes(title)) {
            nodes.push({ id: nodeId, change: "added" });
          } else {
            nodes.push({ id: nodeId });
          }
          final_nodes.push({ id: nodeId });
        }
        for (let title of collection.collection_changes.nodes_to_delete) {
          const nodeId = nodesByTitle[title].id;
          if (nodeId) {
            nodes.push({ id: nodeId, change: "removed" });
            nodesToRemove.add(nodeId);
          }
        }

        result.push({
          collectionName: collection.collectionName,
          nodes: nodes,
        });
        final_result.push({
          collectionName: collection.collectionName,
          nodes: final_nodes,
        });
      }
      return {
        result,
        final_result,
        addedNonExistentElements,
        addedCollections,
      };
    }
    /*  */
    if (
      change.modified_property !== "specializations" &&
      propertyType !== "string-array" &&
      propertyType !== "string" &&
      change.new_value
    ) {
      const newValue = change.new_value as {
        nodes_to_add: string[];
        nodes_to_delete: string[];
        final_array: string[];
      };
      const nodes = [];
      const final_nodes = [];
      const nodesToRemove = new Set();
      for (let title of newValue.final_array) {
        const nodeId = nodesByTitle[title].id;
        if (!nodeId) {
          addedNonExistentElements.push(title);
          continue;
        }
        if (newValue.nodes_to_add.includes(title)) {
          nodes.push({ id: nodeId, change: "added" });
        } else {
          nodes.push({ id: nodeId });
        }
        final_nodes.push({
          id: nodeId,
        });
      }
      for (let title of newValue.nodes_to_delete) {
        const nodeId = nodesByTitle[title].id;
        if (nodeId) {
          nodes.push({ id: nodeId, change: "removed" });
          nodesToRemove.add(nodeId);
        }
      }
      result.push({
        collectionName: "main",
        nodes,
      });
      final_result.push({
        collectionName: "main",
        nodes: final_nodes,
      });
      return {
        result,
        final_result,
        addedNonExistentElements: [],
        addedCollections: [],
        nodesToRemove,
      };
    }
    /*  */
    if (
      propertyType === "string-array" &&
      (change.modified_property === "postConditions" ||
        change.modified_property === "preConditions")
    ) {
      const newValue = change.new_value as {
        conditions_to_add: string[];
        conditions_to_delete: string[];
        final_array: string[];
      };

      return {
        changeDetails: {
          addedElements: newValue.conditions_to_add,
          removedElements: newValue.conditions_to_delete,
          newValue: newValue.final_array,
        },
      };
    }
    /*  */
    if (propertyType === "string" || modifiedProperty === "title") {
      const _change = { ...change } as {
        modified_property: string;
        new_value: string;
        reasoning: string;
      };
      const propertyValue =
        modifiedProperty === "title"
          ? nodeData.title
          : nodeData.properties[modifiedProperty];

      if (_change.new_value !== propertyValue) {
        return {
          changeDetails: {
            newValue: _change.new_value,
            previousValue: propertyValue,
          },
        };
      } else {
        return null;
      }
    }

    return null;
  } catch (error) {
    console.error(error);
  }
};

export const compareImprovement = (
  improvement: any,
  nodesByTitle: { [nodeTitle: string]: INode }
) => {
  const _improvement = JSON.parse(JSON.stringify(improvement));
  const nodeData = nodesByTitle[improvement.title];
  if (nodeData) {
    const change = _improvement.change;
    const modifiedProperty = change.modified_property;
    const propertyType = nodeData.propertyType[modifiedProperty];
    const response: any = getChangeComparison({
      change,
      nodeData,
      nodesByTitle,
    });
    let propertyValue: any = null;
    if (
      modifiedProperty === "specializations" ||
      modifiedProperty === "generalizations" ||
      modifiedProperty === "title"
    ) {
      propertyValue =
        nodeData[
          modifiedProperty as "specializations" | "generalizations" | "title"
        ];
    } else {
      propertyValue = nodeData.properties[modifiedProperty];
    }

    console.log("response==>", response);
    if (!!response) {
      if (propertyType !== "string" && propertyType !== "string-array") {
        _improvement.detailsOfChange = {
          comparison: response.result,
          newValue: response.final_result,
          previousValue: propertyValue,
          addedNonExistentElements: response.addedNonExistentElements,
          addedCollections: response.addedCollections,
        };
      } else if (propertyType === "string" || propertyType === "string-array") {
        _improvement.detailsOfChange = response.changeDetails;
      }
    }
    _improvement.nodeId = nodeData.id;
    _improvement.modifiedProperty = modifiedProperty;
    if (modifiedProperty !== "specializations") {
      _improvement.modiPropertyType = propertyType;
    }
  }
  return _improvement;
};

export const filterProposals = (
  improvements: Improvement[],
  nodesByTitle: { [title: string]: INode }
) => {
  const _improvements = [];
  console.log("improvements", improvements);
  for (let impv of improvements) {
    const change = impv.change;
    const nodeData = nodesByTitle[impv.title];
    console.log("nodeData", nodeData, change);
    if (change && nodeData) {
      const response: any = getChangeComparison({
        change,
        nodeData,
        nodesByTitle,
      });
      console.log("response==>", response);
      if (!!response) {
        _improvements.push(impv);
      }
    }
  }
  console.log("_improvements ????", _improvements);

  return _improvements;
};
