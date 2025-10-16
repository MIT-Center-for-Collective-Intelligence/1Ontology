import { NextApiRequest, NextApiResponse } from "next";
import { ChromaClient, OpenAIEmbeddingFunction } from "chromadb";
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
      input: query,
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;
    const collection = await client.getOrCreateCollection({
      name: collectionName,
      embeddingFunction,
    });
    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
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
    const distances: any = results.distances ? results.distances[0] : [];
    const exactMatches = [];
    const otherMatches = [];

    const uniqueResults = new Set();
    for (let resultIdx = 0; resultIdx < metaDatas.length; resultIdx++) {
      const result = metaDatas[resultIdx];
      const replacedId = result.id.replace("-properties", "");
      if (!uniqueResults.has(replacedId)) {
        uniqueResults.add(result.id);

        if (
          result.title &&
          result.title.trim().toLowerCase() === query.trim().toLowerCase()
        ) {
          exactMatches.push({ ...result, distance: distances[resultIdx] || 0 });
        } else {
          otherMatches.push({ ...result, distance: distances[resultIdx] || 0 });
        }
      }
    }

    const resultsAlt = [...exactMatches, ...otherMatches];
    const logData = {
      at: "searchChroma",
      query,
      results: resultsAlt,
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
    return res.status(200).json({ results: resultsAlt });
  } catch (error) {
    console.error(error);
    return res.status(500).json({});
  }
}

export default fbAuth(handler);
