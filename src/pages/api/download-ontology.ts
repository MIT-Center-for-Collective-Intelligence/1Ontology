import { NextApiRequest, NextApiResponse } from "next";
import { db } from "@components/lib/firestoreServer/admin";
import { NODES } from "@components/lib/firestoreClient/collections";
import fbAuth from "@components/middlewares/fbAuth";
import { INode } from "@components/types/INode";

const buildOntologyTree = (nodes: { [nodeId: string]: INode }) => {
  const spreadNodes = Object.values(nodes);
  const mainCategories = spreadNodes.filter(
    (node: INode) =>
      node.category || (typeof node.root === "boolean" && !!node.root)
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
    visited: Set<string> = new Set()
  ): any => {
    let newSpecializationsTree: any = {};

    if (_nodes.length === 0) return {};

    for (let node of _nodes) {
      if (!node) {
        continue;
      }
      visited.add(node.id);
      const nodeTitle = node.title.trim();

      const inheritancePartRef = node.inheritance?.["parts"]?.ref;
      let partsCollections = node.properties?.parts;
      if (inheritancePartRef && nodes[inheritancePartRef]?.properties?.["parts"]) {
        partsCollections = nodes[inheritancePartRef].properties["parts"];
      }
      const parts: string[] = Array.isArray(partsCollections)
        ? partsCollections
            .flatMap((c) => c.nodes || [])
            .filter((c) => !!nodes[c.id])
            .map((c) => nodes[c.id].title.trim())
        : [];

      const inheritanceDescriptionRef = node.inheritance?.["description"]?.ref;
      const description = inheritanceDescriptionRef
        ? nodes[inheritanceDescriptionRef]?.properties?.["description"] || ""
        : node.properties?.["description"] || "";

      newSpecializationsTree[nodeTitle] = {
        title: nodeTitle,
        description,
        parts,
        specializations: {},
        generalizations: {},
      };

      for (let collection of node.specializations || []) {
        const specializations: INode[] = [];
        (collection.nodes || []).forEach((nodeLink: { id: string }) => {
          if (nodes[nodeLink.id]) {
            specializations.push(nodes[nodeLink.id]);
          }
        });
        const generalizationsNames = (node.generalizations?.[0]?.nodes || [])
          .filter((c) => !!nodes[c.id])
          .map((c: { id: string }) => nodes[c.id].title.trim());

        if (collection.collectionName === "main") {
          newSpecializationsTree[nodeTitle].specializations = {
            ...(newSpecializationsTree[nodeTitle]?.specializations || {}),
            ...buildTree(specializations, [...path, node.id], visited),
          };
          newSpecializationsTree[nodeTitle].generalizations =
            generalizationsNames;
        } else {
          newSpecializationsTree[nodeTitle].specializations[
            `[${collection.collectionName}]`
          ] = {
            title: `[${collection.collectionName}]`,
            specializations: buildTree(
              specializations,
              [...path, node.id],
              visited
            ),
            generalizations: generalizationsNames,
          };
        }
      }
    }

    return newSpecializationsTree;
  };

  return buildTree(mainCategories, []);
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { appName } = req.query;

    if (!appName || typeof appName !== "string") {
      return res.status(400).json({ error: "appName parameter is required" });
    }

    const nodesSnapshot = await db
      .collection(NODES)
      .where("deleted", "==", false)
      .where("appName", "==", appName)
      .get();

    const nodes: { [nodeId: string]: INode } = {};
    nodesSnapshot.forEach((doc) => {
      nodes[doc.id] = { id: doc.id, ...doc.data() } as INode;
    });

    const tree = buildOntologyTree(nodes);

    return res.status(200).json({ tree });
  } catch (error: any) {
    console.error("Error in download-ontology API:", error?.message);
    return res.status(500).json({
      error: "Failed to generate download",
      message: error?.message || "Unknown error"
    });
  }
}

export default fbAuth(handler);
