import { INode } from "@components/types/INode";
import { query, collection, where, getDocs } from "firebase/firestore";
import { NODES } from "../firestoreClient/collections";

export const handleDownload = async ({ nodes }: { nodes: any }) => {
  try {
    const spreadNodes: any = Object.values(nodes);
    const mainCategories = spreadNodes.filter(
      (node: INode) =>
        node.category || (typeof node.root === "boolean" && !!node.root),
    );

    mainCategories.sort((nodeA: any, nodeB: any) => {
      const order = [
        "WHAT: Activities and Objects",
        "WHO: Actors",
        "WHY: Evaluation",
        "Where: Context",
        "ONet",
      ];
      const nodeATitle = nodeA.title;
      const nodeBTitle = nodeB.title;
      return order.indexOf(nodeATitle) - order.indexOf(nodeBTitle);
    });

    const buildTree = (
      _nodes: INode[],
      path: string[],
      visited: Set<string> = new Set(),
    ) => {
      let newSpecializationsTree: any = {};

      if (_nodes.length === 0) return {};

      for (let node of _nodes) {
        if (!node || visited.has(node.id)) {
          continue;
        }
        visited.add(node.id);
        const nodeTitle = node.title.trim();

        const inheritancePartRef = node.inheritance["parts"].ref;
        let parts = node.properties.parts;
        if (inheritancePartRef && nodes[inheritancePartRef]) {
          parts = nodes[inheritancePartRef].properties["parts"];
        }
        parts = Array.isArray(parts)
          ? parts.flatMap((c) => c.nodes).map((c) => nodes[c.id].title.trim())
          : [];

        newSpecializationsTree[nodeTitle] = {
          title: nodeTitle,
          description: node.properties["description"],
          parts,
          specializations: {},
          generalizations: {},
        };

        for (let collection of node.specializations) {
          const specializations: INode[] = [];
          collection.nodes.forEach((nodeLink: { id: string }) => {
            specializations.push(nodes[nodeLink.id]);
          });
          const generalizationsNames = node.generalizations[0].nodes.map((c) =>
            nodes[c.id].title.trim(),
          );
          if (collection.collectionName === "main") {
            newSpecializationsTree[nodeTitle].specializations = {
              ...(newSpecializationsTree[nodeTitle]?.specializations || {}),
              ...buildTree(specializations, [...path, node.id], visited),
            };
            newSpecializationsTree[nodeTitle].generalizations =
              generalizationsNames;
          } else {
            newSpecializationsTree[nodeTitle].specializations[
              collection.collectionName
            ] = {
              title: `[${collection.collectionName}]`,
              specializations: buildTree(
                specializations,
                [...path, node.id],
                visited,
              ),
              generalizations: generalizationsNames,
            };
          }
        }
      }

      return newSpecializationsTree;
    };

    let treeOfSpecializations = buildTree(mainCategories, []);

    const blob = new Blob([JSON.stringify(treeOfSpecializations, null, 2)], {
      type: "application/json",
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "nodes-data.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Error downloading JSON: ", error);
  }
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
