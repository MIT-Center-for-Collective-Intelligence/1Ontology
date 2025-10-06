import { NextApiRequest, NextApiResponse } from "next";
import { ChromaClient, IncludeEnum, OpenAIEmbeddingFunction } from "chromadb";
import Cors from "cors";
import { openai } from "./helpers";
import { db } from "@components/lib/firestoreServer/admin";
import { LOGS } from "@components/lib/firestoreClient/collections";
import { getDoerCreate } from "@components/lib/utils/helpers";

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

const _query = `AI-powered credit score boosting made easy. Dovly is an AI credit engine designed to empower users in their journey towards financial freedom. This tool provides a platform for monitoring, building, and repairing credit profiles. Leveraging AI technology, Dovly handles credit disputes with all three credit bureaus and provides weekly TransUnion credit reports and scores, along with enhanced credit monitoring and ID theft alerts. A core feature is the smart AI credit engine, engineered to optimize results by analyzing a user's unique credit situation and matching them with a personalized action plan. Additionally, it offers credit building offers and personalized tips and guides tailored to a user's financial situation to assist in strengthen their credit profile. Users can enroll online in minutes, with an assurance that enrolling does not negatively impact their credit score. Dovly also includes ID theft insurance and provides regular updates, tips, and recommendations to its users.`;

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const {
      query,
      skillsFuture,
      appName,
      user,
      nodeType,
      resultsNum,
      searchAll,
    } = req.body;

    await runMiddleware(req, res, cors);

    let collectionName = "";
    if (appName) {
      collectionName = `ontology-${sanitizeCollectionName(appName)}`;
    } else if (skillsFuture) {
      collectionName = "ontology-skills";
    } else {
      collectionName = "ontology";
    }

    const client = new ChromaClient({ path: url });

    const collection = await client.getOrCreateCollection({
      name: collectionName,
      embeddingFunction,
    });
    if (searchAll) {
      const allData = await collection.get({
        include: [IncludeEnum.Embeddings, IncludeEnum.Metadatas],
        ...(nodeType
          ? {
              where: {
                nodeType,
              },
            }
          : {}),
      });
      const response = await openai.embeddings.create({
        model: "text-embedding-3-large",
        input: [_query],
      });
      const embeddings = response.data?.map((item) => item.embedding) ?? [];
      const queryEmbedding = embeddings[0];

      const _data = [];
      for (let nodeIdx = 0; nodeIdx < allData.metadatas.length; nodeIdx++) {
        if (allData.metadatas[nodeIdx]?.nodeType === "activity") {
          const similarity = cosineSimilarity(
            queryEmbedding,
            (allData.embeddings || [])[nodeIdx],
          );

          _data.push({
            ...allData.metadatas[nodeIdx],
            similarity,
          });
        }
      }
      _data.sort((a, b) => b.similarity - a.similarity);
      const topResults = _data.slice(0, resultsNum);

      const logRef = db.collection(LOGS).doc();
      const uname = "ai-peer-extension";
      const doerCreate = getDoerCreate(uname || "");
      const logData = {
        at: "searchChroma",
        query,
        results: topResults,
        appName,
      };

      await logRef.set({
        type: "info",
        ...logData,
        createdAt: new Date(),
        doer: uname,
        doerCreate,
      });

      return res.status(200).json({ results: _data });
    }

    const results = await collection.query({
      queryTexts: query,
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
    const distances: any = (results.distances || [])[0];
    const exactMatches = [];
    const otherMatches = [];

    const uniqueResults = new Set();
    for (let result of metaDatas) {
      const replacedId = result.id.replace("-properties", "");
      if (!uniqueResults.has(replacedId)) {
        uniqueResults.add(replacedId);

        if (
          result.title &&
          result.title.trim().toLowerCase() === query.trim().toLowerCase()
        ) {
          exactMatches.push(result);
        } else {
          otherMatches.push(result);
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
    const uname = "ai-peer-extension";
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

export default handler;
