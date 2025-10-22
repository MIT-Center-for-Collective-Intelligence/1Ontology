import { NextApiRequest, NextApiResponse } from "next";
import { ChromaClient, IncludeEnum, OpenAIEmbeddingFunction } from "chromadb";
import fbAuth from "@components/middlewares/fbAuth";
import { db } from "@components/lib/firestoreServer/admin";
import { getDoerCreate } from "@components/lib/utils/helpers";
import { LOGS } from "@components/lib/firestoreClient/collections";
import { openai } from "./helpers";
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

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { query, skillsFuture, appName, user, nodeType, resultsNum } =
      req.body.data;
    const { uname } = user?.userData;

    /*     await runMiddleware(req, res, cors); */

    let collectionName = "";
    if (appName) {
      collectionName = `ontology-${sanitizeCollectionName(appName)}`;
    } else if (skillsFuture) {
      collectionName = "ontology-skills";
    } else {
      collectionName = "ontology";
    }
    const client = new ChromaClient({ path: url });

    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-large", // must match the stored embeddings
      input: query.toLowerCase(),
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;
    const collection = await client.getOrCreateCollection({
      name: collectionName,
      embeddingFunction,
    });
    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      include: [IncludeEnum.Embeddings, IncludeEnum.Metadatas],
      nResults: resultsNum || 40,
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
      if (metaDatas[nodeIdx]?.nodeType === "activity") {
        const similarity = cosineSimilarity(
          queryEmbedding,
          (embeddings || [])[nodeIdx],
        );

        topResults.push({
          ...metaDatas[nodeIdx],
          similarity,
        });
      }
    }

    topResults.sort((a, b) => b.similarity - a.similarity);

    const logData = {
      at: "searchChroma",
      query,
      results: topResults,
      appName,
    };
    const logRef = db.collection(LOGS).doc();
    const doerCreate = getDoerCreate(uname || "");
    await logRef.set({
      type: "info",
      ...logData,
      createdAt: new Date(),
      doer: uname,
      doerCreate,
    });
    return res.status(200).json({ results: topResults });
  } catch (error) {
    console.error(error);
    return res.status(500).json({});
  }
}

export default fbAuth(handler);
