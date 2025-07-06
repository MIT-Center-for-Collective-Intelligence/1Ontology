import { NextApiRequest, NextApiResponse } from "next";
import { ChromaClient } from "chromadb";
import OpenAI from "openai";
import fbAuth from "@components/middlewares/fbAuth";

const url = `${process.env.CHROMA_PROTOCOL}://${process.env.CHROMA_HOST}:${process.env.CHROMA_PORT}`;

const openai = new OpenAI({
  apiKey: process.env.MIT_CCI_API_KEY,
});

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

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { query, skillsFuture, appName, user } = req.body.data;
    const { uname } = user?.userData;
    console.log(uname, "sent the following query", query, { appName });

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
    });

    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });

    const embeddedQuery = embeddingResponse.data[0].embedding;

    const results = await collection.query({
      queryEmbeddings: [embeddedQuery],
      nResults: 40,
    });

    const metaDatas: any = results.metadatas[0];
    const exactMatches = [];
    const otherMatches = [];

    const uniqueResults = new Set();
    for (const result of metaDatas) {
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
    return res.status(200).json({ results: resultsAlt });
  } catch (error) {
    console.error(error);
    return res.status(500).json({});
  }
}

export default fbAuth(handler);
