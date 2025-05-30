import { NextApiRequest, NextApiResponse } from "next";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChromaClient, OpenAIEmbeddingFunction } from "chromadb";
import fbAuth from "@components/middlewares/fbAuth";
import OpenAI from "openai";

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

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { query, skillsFuture, appName } = req.body;

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
    const results = await collection.query({
      queryTexts: query,
      nResults: 40,
    });

    const metaDatas: any = results.metadatas[0];
    const resultsAlt = [];
    const uniqueResults = new Set();
    for (let result of metaDatas) {
      const replacedId = result.id.replace("-properties", "");
      if (!uniqueResults.has(replacedId)) {
        uniqueResults.add(result.id);
        resultsAlt.push(result);
      }
    }

    return res.status(200).json({ results: resultsAlt });
  } catch (error) {
    console.error(error);
  }
}

export default fbAuth(handler, true);
