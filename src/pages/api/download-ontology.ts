import { NextApiRequest, NextApiResponse } from "next";
import { db } from "@components/lib/firestoreServer/admin";
import { NODES } from "@components/lib/firestoreClient/collections";
import fbAuth from "@components/middlewares/fbAuth";
import { INode } from "@components/types/INode";

/** Only fields needed to build the download tree — smaller reads from Firestore. */
const NODE_PROJECTION = [
  "title",
  "category",
  "root",
  "properties",
  "inheritance",
  "specializations",
  "generalizations",
] as const;

type TreeExportNode = {
  title: string;
  description: unknown;
  parts: string[];
  specializations: Record<string, TreeExportNode | Record<string, unknown>>;
  generalizations: string[] | Record<string, unknown>;
};

const buildOntologyTree = (
  nodes: Record<string, INode>,
  titleById: Record<string, string>,
) => {
  const spreadNodes = Object.values(nodes);
  const mainCategories = spreadNodes.filter(
    (node: INode) =>
      node.category || (typeof node.root === "boolean" && !!node.root),
  );

  const buildTree = (_nodes: INode[]): Record<string, TreeExportNode> => {
    const newSpecializationsTree: Record<string, TreeExportNode> = {};

    if (_nodes.length === 0) return newSpecializationsTree;

    for (const node of _nodes) {
      if (!node) continue;

      const nodeTitle = titleById[node.id] ?? node.title.trim();

      const partsCollections = node.properties?.parts;
      let parts: string[] = [];
      if (Array.isArray(partsCollections)) {
        for (const c of partsCollections) {
          const linkNodes = c.nodes;
          if (!linkNodes) continue;
          for (const cLink of linkNodes) {
            if (nodes[cLink.id]) {
              parts.push(titleById[cLink.id] ?? nodes[cLink.id].title.trim());
            }
          }
        }
      }

      const inheritanceDescriptionRef = node.inheritance?.["description"]?.ref;
      const description = inheritanceDescriptionRef
        ? (nodes[inheritanceDescriptionRef]?.properties?.["description"] ?? "")
        : (node.properties?.["description"] ?? "");

      const entry: TreeExportNode = {
        title: nodeTitle,
        description,
        parts,
        specializations: {},
        generalizations: {},
      };
      newSpecializationsTree[nodeTitle] = entry;

      const genNodes = node.generalizations?.[0]?.nodes;
      let generalizationsNames: string[] = [];
      if (genNodes?.length) {
        for (const c of genNodes) {
          if (nodes[c.id]) {
            generalizationsNames.push(
              titleById[c.id] ?? nodes[c.id].title.trim(),
            );
          }
        }
      }

      const specs = node.specializations;
      if (!specs?.length) continue;

      for (const collection of specs) {
        const linkNodes = collection.nodes;
        const specializations: INode[] = [];
        if (linkNodes?.length) {
          for (const nodeLink of linkNodes) {
            const linked = nodes[nodeLink.id];
            if (linked) specializations.push(linked);
          }
        }

        if (collection.collectionName === "main") {
          Object.assign(
            entry.specializations as Record<string, unknown>,
            buildTree(specializations),
          );
          entry.generalizations = generalizationsNames;
        } else {
          const bucketKey = `[${collection.collectionName}]`;
          (entry.specializations as Record<string, unknown>)[bucketKey] = {
            title: bucketKey,
            specializations: buildTree(specializations),
            generalizations: generalizationsNames,
          };
        }
      }
    }

    return newSpecializationsTree;
  };

  return buildTree(mainCategories);
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { appName } = req.body.data;

    if (!appName || typeof appName !== "string") {
      return res.status(400).json({ error: "appName parameter is required" });
    }

    const nodesSnapshot = await db
      .collection(NODES)
      .where("deleted", "==", false)
      .where("appName", "==", appName)
      .select(...NODE_PROJECTION)
      .get();

    const nodes: Record<string, INode> = {};
    const titleById: Record<string, string> = {};

    for (const doc of nodesSnapshot.docs) {
      const id = doc.id;
      const data = doc.data() as Partial<INode>;
      nodes[id] = { id, ...data } as INode;
      const t = data.title;
      titleById[id] = typeof t === "string" ? t.trim() : "";
    }

    const tree = buildOntologyTree(nodes, titleById);

    return res.status(200).json({ tree });
  } catch (error: any) {
    console.error("Error in download-ontology API:", error?.message);
    return res.status(500).json({
      error: "Failed to generate download",
      message: error?.message || "Unknown error",
    });
  }
}

export default fbAuth(handler);
