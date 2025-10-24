import { NextApiRequest, NextApiResponse } from "next";
import { ChromaClient, IncludeEnum, OpenAIEmbeddingFunction } from "chromadb";
import Cors from "cors";
import { openai } from "./helpers";
import { db } from "@components/lib/firestoreServer/admin";
import { LOGS } from "@components/lib/firestoreClient/collections";
import { getDoerCreate } from "@components/lib/utils/helpers";
import { ONTOLOGY_APPS } from "@components/lib/CONSTANTS";

const url = `${process.env.CHROMA_PROTOCOL}://${process.env.CHROMA_HOST}:${process.env.CHROMA_PORT}`;

const sanitizeCollectionName = (title: string) => {
  return (
    title
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .replace(/^[-_.]+/, "")
      .replace(/[-_.]+$/, "")
      .slice(0, 512) || "default_collection"
  );
};
const embeddingFunction = new OpenAIEmbeddingFunction({
  openai_api_key: process.env.MIT_CCI_API_KEY,
  openai_model: "text-embedding-3-large",
});
const cors = Cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200,
});

const runMiddleware = (req: any, res: any, fn: any) => {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
};

const cosineSimilarity = (vecA: any[], vecB: any[]) => {
  if (vecA.length !== vecB.length) {
    throw new Error("Embedding vectors must have the same length.");
  }
  const dot = vecA.reduce((acc, val, idx) => acc + val * vecB[idx], 0);
  const normA = Math.sqrt(vecA.reduce((acc, val) => acc + val * val, 0));
  const normB = Math.sqrt(vecB.reduce((acc, val) => acc + val * val, 0));
  if (normA === 0 || normB === 0) {
    throw new Error("Cannot compute similarity for zero-length embeddings.");
  }
  return dot / (normA * normB);
};

const loadAllNodes = async ({
  exclusiveIds,
  nodes_ids,
  withDescription,
  appName,
}: {
  exclusiveIds: Set<string> | null;
  withDescription: boolean;
  appName: string;
  nodes_ids?: any;
}) => {
  let nodesByIds: Record<string, any> = {};
  if (nodes_ids) {
    nodesByIds = nodes_ids;
  } else {
    // Load all relevant nodes from Firestore
    const nodesDocs = await db
      .collection("nodes")
      .where("appName", "==", appName)
      .where("deleted", "==", false)
      .get();

    for (let nodeDoc of nodesDocs.docs) {
      nodesByIds[nodeDoc.id] = { id: nodeDoc.id, ...nodeDoc.data() };
    }
  }

  // Store nodes in a dictionary for quick lookup

  // Recursive function to build nested structure
  const buildNestedStructure = (
    nodeId: string,
    exclusiveIds: Set<string> | null,
    visited = new Set<string>(),
  ): any => {
    const nodeData = nodesByIds[nodeId];
    if (!nodeData) return [];

    const nestedResult = [];

    for (let collection of nodeData.specializations || []) {
      const collectionsNodes = [];

      for (let { id: childId } of collection.nodes || []) {
        const childNodeData = nodesByIds[childId];
        if (!childNodeData || (exclusiveIds && !exclusiveIds.has(childId)))
          continue;
        collectionsNodes.push({
          title: childNodeData.title,
          ...(withDescription
            ? {
                description: nodeData.properties["description"]
                  .replace(`Synonyms: null`, "")
                  .trim(),
              }
            : {}),
          specializations: buildNestedStructure(childId, exclusiveIds),
        });
      }
      nestedResult.push({
        collectionName:
          collection.collectionName === "main"
            ? "default"
            : collection.collectionName,
        nodes: collectionsNodes,
      });
    }

    return nestedResult;
  };

  // Build the final object keyed by top-level node title

  const nodesDocs = await db
    .collection("nodes")
    .where("appName", "==", appName)
    .where("deleted", "==", false)
    .where("root", "==", true)
    .get();
  const rootDoc = nodesDocs.docs[0];

  let ontology_object: any = {};
  for (let nodeId of [rootDoc.id]) {
    const nodeData = nodesByIds[nodeId];
    if (!nodeData?.title) continue;

    ontology_object = {
      title: nodeData.title,
      ...(withDescription
        ? {
            description: nodeData.properties["description"].trim(),
          }
        : {}),
      specializations: buildNestedStructure(nodeId, exclusiveIds),
    };
  }

  return { ontology_object, nodesByIds };
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await runMiddleware(req, res, cors);
    let { searchQuery, applicationName, nodeType, searchLimit } = req.body;
    console.log({
      searchQuery,
      applicationName,
      nodeType,
      resultsLimit: searchLimit,
    });

    const apps = ONTOLOGY_APPS.map((app) => app.id);
    if ([...apps, "ontology"].indexOf(applicationName) === -1) {
      return res.status(400).json({ error: "Invalid applicationName" });
    }

    let collectionName = "";
    if (applicationName) {
      collectionName = `ontology-${sanitizeCollectionName(applicationName)}`;
    } else if (applicationName === "ontology") {
      collectionName = "ontology";
    }

    const client = new ChromaClient({ path: url });

    const collection = await client.getOrCreateCollection({
      name: collectionName,
      embeddingFunction,
    });

    console.log("searching");
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-large",
      input: searchQuery,
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      include: [IncludeEnum.Embeddings, IncludeEnum.Metadatas],
      nResults: searchLimit || 100,
      ...(nodeType
        ? {
            where: {
              nodeType,
            },
          }
        : {}),
    });

    const metaDatas: any = results.metadatas[0];
    const embeddings: any = (results.embeddings || [])[0];

    const topResults = [];
    for (let nodeIdx = 0; nodeIdx < metaDatas.length; nodeIdx++) {
      const similarity = cosineSimilarity(
        queryEmbedding,
        (embeddings || [])[nodeIdx],
      );
      topResults.push({
        ...metaDatas[nodeIdx],
        similarity,
      });
    }
    topResults.sort((a, b) => b.similarity - a.similarity);

    const nodesIds: any = {};
    const nodesDocs = await db
      .collection("nodes")
      .where("appName", "==", applicationName)
      .where("deleted", "==", false)
      .get();

    for (let nodeDoc of nodesDocs.docs) {
      nodesIds[nodeDoc.id] = nodeDoc.data();
    }

    const logData = {
      at: "searchChroma",
      searchQuery,
      results: JSON.parse(JSON.stringify(topResults)),
      applicationName,
    };

    let required_ids = [];
    if (topResults) {
      required_ids.push(...topResults.map((c: { id: string }) => c.id));
    }

    const loadAllTheAncestors = (nodeIds: string[]): string[] => {
      const ids = [...nodeIds];
      for (let id of nodeIds) {
        const node = nodesIds[id];
        if (node) {
          const generalizations = node.generalizations[0].nodes;
          const generalizationIds = generalizations.map(
            (n: { id: string }) => n.id,
          );
          ids.push(...generalizationIds);
          ids.push(...loadAllTheAncestors(generalizationIds));
        } else {
          throw new Error("Node doesn't exist");
        }
      }
      return ids;
    };
    const all_ancestors = new Set(loadAllTheAncestors(required_ids));
    const { ontology_object } = await loadAllNodes({
      exclusiveIds: all_ancestors,
      nodes_ids: nodesIds,
      appName: applicationName,
      withDescription: true,
    });

    console.log(JSON.stringify(topResults, null, 2), "topResults final");

    const logRef = db.collection(LOGS).doc();
    const uname = "ai-peer-extension";
    const doerCreate = getDoerCreate(uname || "");
    await logRef.set({
      type: "info",
      ...logData,
      createdAt: new Date(),
      doer: uname,
      doerCreate,
    });
    return res
      .status(200)
      .json({ ontology_object: ontology_object, topResults });
  } catch (error) {
    console.error(error);
    return res.status(500).json({});
  }
}

export default handler;
