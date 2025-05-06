import { ICollection, ILinkNode, INode } from "@components/types/INode";
import { IChange, Improvement } from "./copilotPrompts";
import { recordLogs } from "./helpers";

export const getChangeComparison = ({
  change,
  nodeData,
  nodesByTitle,
  ontologyNodes,
}: {
  change: Partial<IChange> | any;
  nodeData: INode;
  nodesByTitle: { [title: string]: { id: string } };
  ontologyNodes: { [nodeId: string]: any };
}) => {
  try {
    const modifiedProperty: string = change.modified_property as string;
    const addedNonExistentElements: string[] = [];

    const propertyType = nodeData.propertyType[modifiedProperty];
    if (
      !propertyType &&
      modifiedProperty !== "specializations" &&
      modifiedProperty !== "generalizations" &&
      modifiedProperty !== "parts" &&
      modifiedProperty !== "isPartOf"
    )
      return;

    const result: ICollection[] = [];
    const final_result: ICollection[] = [];
    /*  */
    if (
      modifiedProperty === "specializations" &&
      Array.isArray(change.new_value)
    ) {
      const addedCollections: string[] = [];
      const specializations = nodeData[modifiedProperty as "specializations"];
      const _collections = specializations.flatMap((c) => c.collectionName);

      const nodesToRemove = new Set();
      let modified = false;

      for (let collection of change.new_value) {
        if (!_collections.includes(collection.collectionName)) {
          addedCollections.push(collection.collectionName);
        }
        const collectionIdx = specializations.findIndex(
          (c) => c.collectionName === collection.collectionName,
        );

        const previousState =
          collectionIdx === -1
            ? []
            : specializations[collectionIdx].nodes.map((n) => n.id);

        const nodes = [];
        const final_nodes = [];

        for (let title of collection.changes.final_array) {
          const nodeId = nodesByTitle[title]?.id;
          if (!nodeId) {
            addedNonExistentElements.push(title);
            continue;
          }
          if (!previousState.includes(nodeId)) {
            nodes.push({ id: nodeId, change: "added" });
            modified = true;
          } else {
            nodes.push({ id: nodeId });
          }
          final_nodes.push({ id: nodeId });
        }

        const final_array_ids = collection.changes.final_array.map(
          (c: string) => nodesByTitle[c].id,
        );
        for (let linkId of previousState) {
          if (!final_array_ids.includes(linkId) && !!ontologyNodes[linkId]) {
            nodes.push({ id: linkId, change: "removed" });
            nodesToRemove.add(linkId);
            modified = true;
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

      if (!modified) {
        return;
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
      //new value from the model response
      const newValue = change.new_value as {
        nodes_to_add: string[];
        nodes_to_delete: string[];
        final_array: string[];
      };
      //creating the array of changes
      const nodes = [];
      const final_nodes = [];
      const nodesToRemove: Set<string> = new Set();

      let propertyPreviousValue =
        modifiedProperty === "generalizations"
          ? nodeData[modifiedProperty as "generalizations"]
          : nodeData.properties[modifiedProperty];
      const inheritanceRef = nodeData.inheritance[modifiedProperty]?.ref ?? "";
      if (
        modifiedProperty !== "generalizations" &&
        !!inheritanceRef &&
        ontologyNodes[inheritanceRef]
      ) {
        propertyPreviousValue =
          ontologyNodes[inheritanceRef].properties[modifiedProperty];
      }

      const previousState = propertyPreviousValue
        .flatMap((c: any) => c.nodes)
        .map((n: any) => n.id);

      let modified = false;
      for (let title of newValue.final_array) {
        const nodeId = nodesByTitle[title]?.id;
        if (!nodeId) {
          addedNonExistentElements.push(title);
          continue;
        }
        if (!previousState.includes(nodeId)) {
          modified = true;
          nodes.push({
            id: nodeId,
            change: "added",
            optional: (change.optionalParts || []).includes(title),
          });
        } else {
          nodes.push({
            id: nodeId,
          });
        }
        final_nodes.push({
          id: nodeId,
          optional: (change.optionalParts || []).includes(title),
        });
      }
      const final_array_ids = final_nodes.map((c: { id: string }) => c.id);
      for (let linkId of previousState) {
        if (!final_array_ids.includes(linkId)) {
          modified = true;
          nodes.push({ id: linkId, change: "removed" });
          nodesToRemove.add(linkId);
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
      let ignoreChange = false;
      if (modifiedProperty === "specializations") {
        for (let removedSpecialization of nodesToRemove) {
          const specializationData = ontologyNodes[removedSpecialization];
          if (
            specializationData.generalizations[0].nodes.length === 1 &&
            !!ontologyNodes[specializationData.generalizations[0].nodes[0].id]
              ?.unclassified
          ) {
            ignoreChange = true;
          }
        }
      }
      if (
        ignoreChange ||
        !modified ||
        (final_nodes.length === 0 && modifiedProperty === "generalizations")
      )
        return null;
      return {
        result,
        final_result,
        addedNonExistentElements,
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
  } catch (error: any) {
    console.error(error);
    recordLogs({
      type: "error",
      error: JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack,
      }),
      at: "getChangeComparison",
    });
  }
};

export const compareImprovement = (
  improvement: any,
  nodesByTitle: { [nodeTitle: string]: INode },
  ontologyNodes: { [nodeId: string]: any },
) => {
  try {
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
        ontologyNodes: ontologyNodes || {},
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

      if (!!response) {
        if (propertyType !== "string" && propertyType !== "string-array") {
          _improvement.detailsOfChange = {
            comparison: response.result,
            newValue: response.final_result,
            previousValue: propertyValue,
            addedNonExistentElements: response.addedNonExistentElements,
            addedCollections: response.addedCollections,
          };
        } else if (
          propertyType === "string" ||
          propertyType === "string-array"
        ) {
          _improvement.detailsOfChange = response.changeDetails;
        }
      }
      _improvement.nodeId = nodeData.id;
      _improvement.modifiedProperty = modifiedProperty;
    }
    _improvement.nodeType = nodeData.nodeType;
    return _improvement;
  } catch (error: any) {
    console.error(error);
    recordLogs({
      type: "error",
      error: JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack,
      }),
      at: "getChangeComparison",
    });
  }
};

export const filterProposals = (
  improvements: Improvement[],
  nodesByTitle: { [title: string]: INode },
  ontologyNodes: { [nodeId: string]: any },
) => {
  try {
    const _improvements = [];

    for (let impv of improvements) {
      const change = impv.change;
      const nodeData = nodesByTitle[impv.title];

      if (change && nodeData) {
        const response: any = getChangeComparison({
          change,
          nodeData,
          nodesByTitle,
          ontologyNodes,
        });
        if (!!response) {
          impv.detailsOfChange = response;
          _improvements.push(impv);
        }
      }
    }

    return _improvements;
  } catch (error: any) {
    recordLogs({
      type: "error",
      error: JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack,
      }),
      at: "getChangeComparison",
    });
  }
};
