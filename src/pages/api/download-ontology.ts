import { NextApiRequest, NextApiResponse } from "next";
import { db, admin } from "@components/lib/firestoreServer/admin";
import { NODES } from "@components/lib/firestoreClient/collections";
import fbAuth from "@components/middlewares/fbAuth";
import { INode } from "@components/types/INode";
import { development } from "@components/lib/CONSTANTS";

export const config = {
  api: {
    responseLimit: false,
  },
};

/** Only fields needed to build the download tree — smaller reads from Firestore. */
const NODE_PROJECTION = [
  "title",
  "root",
  "properties.description",
  "inheritance.description",
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

  const buildTree = (
    _nodes: INode[],
    visited = new Set<string>(),
  ): Record<string, TreeExportNode> => {
    const newSpecializationsTree: Record<string, TreeExportNode> = {};

    if (_nodes.length === 0) return newSpecializationsTree;

    for (const node of _nodes) {
      if (!node) continue;

      // Prevent infinite loops / massive blowups on cycles
      if (visited.has(node.id)) continue;

      const currentVisited = new Set(visited).add(node.id);

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
            buildTree(specializations, currentVisited),
          );
          entry.generalizations = generalizationsNames;
        } else {
          const bucketKey = `[${collection.collectionName}]`;
          (entry.specializations as Record<string, unknown>)[bucketKey] = {
            title: bucketKey,
            specializations: buildTree(specializations, currentVisited),
            generalizations: generalizationsNames,
          };
        }
      }
    }

    return newSpecializationsTree;
  };

  return buildTree(mainCategories);
};

async function processExport(jobId: string, appName: string) {
  try {
    console.log(`Starting export job ${jobId} for app ${appName}`);

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
    const payload = JSON.stringify(tree, null, 2);

    // Upload to Firebase Storage
    const bucketName = development
      ? process.env.NEXT_PUBLIC_DEV_STORAGE_BUCKET
      : process.env.NEXT_PUBLIC_STORAGE_BUCKET;

    // Clean bucketName if it contains a URL
    let cleanBucketName = bucketName;
    if (bucketName && bucketName.startsWith("http")) {
      const url = new URL(bucketName);
      cleanBucketName = url.hostname;
    }

    const storage = admin.storage();
    const bucket = storage.bucket(cleanBucketName);

    const storagePath = `ontologyExports/${jobId}.json`;
    const file = bucket.file(storagePath);

    await file.save(payload, {
      contentType: "application/json; charset=utf-8",
      metadata: {
        cacheControl: "no-store, no-cache",
        contentDisposition: `attachment; filename="${appName}-ontology.json"`,
      },
    });

    // Update Firestore status to completed
    await db.collection("ontologyExports").doc(jobId).update({
      status: "completed",
      storagePath,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Export job ${jobId} completed successfully.`);
  } catch (error: any) {
    console.error(`Export job ${jobId} failed:`, error);
    await db
      .collection("ontologyExports")
      .doc(jobId)
      .update({
        status: "error",
        error: error?.message || "Unknown error occurred",
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const payload = req.body.data || req.body;
    const { appName } = payload;

    const user = (req as any).user;

    console.log("appName -->", appName);

    if (!appName || typeof appName !== "string") {
      return res.status(400).json({ error: "appName parameter is required" });
    }

    const jobRef = db.collection("ontologyExports").doc();
    await jobRef.set({
      status: "processing",
      appName,
      userId: user?.uid || "unknown",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    processExport(jobRef.id, appName);

    return res.status(200).json({ status: "processing", jobId: jobRef.id });
  } catch (error: any) {
    console.error("Error in download-ontology API:", error?.message);
    return res.status(500).json({
      error: "Failed to start download job",
      message: error?.message || "Unknown error",
    });
  }
}

export default fbAuth(handler);
