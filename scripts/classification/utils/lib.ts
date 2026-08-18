import { ChromaClient, IncludeEnum, OpenAIEmbeddingFunction } from "chromadb";
import OpenAI from "openai";
import { db } from "../../admin";

export const delay = async (time: number) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, time);
  });
};

export const removeTrailingTitleId = (title: string) =>
  title.replace(/\s*\([^)]*\)\s*$/, "").trim();

export const removeTrailingONETId = (title: string) => {
  if (title.startsWith("(O*Net)")) {
    const newTitle = title
      .replace("(O*Net)", "")
      .trim()
      .split("-")
      .splice(1)
      .join("-")
      .trim();

    return `(O*Net) ${newTitle}`;
  }
  return title;
};

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

const cosineSimilarity = (vecA: number[], vecB: number[]) => {
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

export const searchThroughChroma = async ({
  query,
  resultsNum,
  appName,
  nodeType,
}: {
  query: string;
  resultsNum: number | null;
  appName: string;
  nodeType?: string;
  oNetTask?: boolean;
}) => {
  let attempt = 0;
  let lastError;
  const MAX_RETRIES = 10;
  const RETRY_DELAY_MS = 3 * 1000;

  while (attempt < MAX_RETRIES) {
    try {
      const chromaUrl = `${process.env.CHROMA_PROTOCOL}://${process.env.CHROMA_HOST}:${process.env.CHROMA_PORT}`;
      const openai = new OpenAI({
        apiKey: process.env.MIT_CCI_API_KEY,
        organization: process.env.MIT_CCI_API_ORG_ID,
      });
      const embeddingFunction = new OpenAIEmbeddingFunction({
        openai_api_key: process.env.MIT_CCI_API_KEY || "",
        openai_model: "text-embedding-3-large",
      });
      const collectionName = appName
        ? `ontology-${sanitizeCollectionName(appName)}`
        : "ontology";
      const client = new ChromaClient({ path: chromaUrl });
      const collection = await client.getOrCreateCollection({
        name: collectionName,
        embeddingFunction,
      });
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-large",
        input: query,
      });
      const queryEmbedding = embeddingResponse.data[0].embedding;
      const whereFilter: Record<string, string> = {};
      if (nodeType) {
        whereFilter.nodeType = nodeType;
      }
      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        include: [IncludeEnum.Embeddings, IncludeEnum.Metadatas],
        nResults: resultsNum || 40,
        where: Object.keys(whereFilter).length > 0 ? whereFilter : undefined,
      });
      const metaDatas: any[] = results.metadatas[0] || [];
      const embeddings: number[][] = ((results.embeddings || [])[0] ||
        []) as number[][];
      const scored = [];
      for (let nodeIdx = 0; nodeIdx < metaDatas.length; nodeIdx++) {
        if (metaDatas[nodeIdx]?.nodeType === "activity") {
          scored.push({
            ...metaDatas[nodeIdx],
            similarity: cosineSimilarity(
              queryEmbedding,
              embeddings[nodeIdx] || [],
            ),
          });
        }
      }
      scored.sort((a, b) => b.similarity - a.similarity);
      return scored.slice(0, resultsNum || 40);
    } catch (error: any) {
      console.log(error, "error");
      lastError = error;
      attempt++;

      console.warn(`Attempt ${attempt} failed: ${error.code || error.message}`);

      if (attempt >= MAX_RETRIES) {
        console.error("All retry attempts failed.");
        throw lastError;
      }

      await delay(RETRY_DELAY_MS * attempt);
    }
  }
};

export const loadAllNodes = async ({
  exclusiveIds,
  nodes_ids,
  synonyms,
  test,
  appName,
  addId,
  tasks_by_jobs,
}: {
  exclusiveIds: Set<string> | null;
  synonyms: boolean;
  test?: boolean;
  nodes_ids?: any;
  appName: string;
  addId?: boolean;
  tasks_by_jobs?: any;
}) => {
  if (test) {
    return { ontology_object: {}, nodesByIds: {} };
  }

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

  // Recursive function to build nested structure
  const buildNestedStructure = (
    nodeId: string,
    exclusiveIds: Set<string> | null,
    visited = new Set<string>(),
  ) => {
    const nodeData: any = nodesByIds[nodeId];
    if (!nodeData) return [];
    let nestedResult: Record<string, any> = {};

    for (let collection of nodeData.specializations || []) {
      const collectionsNodes: Record<string, any> = {};

      for (let { id: childId } of collection.nodes || []) {
        const childNodeData = nodesByIds[childId];

        if (!childNodeData || (exclusiveIds && !exclusiveIds.has(childId)))
          continue;
        /*         if (!hasEligibleChildren(childId, exclusiveIds)) continue; */

        const childNestedStructure = buildNestedStructure(
          childId,
          exclusiveIds,
        );
        const onetId = childNodeData.oNetId;

        let childTitle = childNodeData.title;
        if (collectionsNodes[childTitle]) {
          childTitle = `${childTitle} (${tasks_by_jobs[onetId]})`;
        }
        collectionsNodes[childTitle] = childNestedStructure;
      }
      if (Object.keys(collectionsNodes).length === 0) continue;

      if (collection.collectionName === "main") {
        nestedResult = { ...nestedResult, ...collectionsNodes };
      } else {
        nestedResult[`[${collection.collectionName}]`] = collectionsNodes;
      }
    }

    return nestedResult;
  };

  // Build the final object keyed by top-level node title

  const rootDocId: any = Object.keys(nodesByIds).find(
    (id) => nodesByIds[id].root,
  );

  let ontology_object: any = {};
  for (let nodeId of [rootDocId]) {
    const nodeData = nodesByIds[nodeId];
    if (!nodeData?.title) continue;

    ontology_object[nodeData.title] = buildNestedStructure(
      nodeId,
      exclusiveIds,
    );
  }

  return { ontology_object, nodesByIds };
};
