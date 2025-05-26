import { NextApiRequest, NextApiResponse } from "next";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChromaClient } from "chromadb";
import fbAuth from "@components/middlewares/fbAuth";

const EMBEDDING_MODEL = "gemini-embedding-exp-03-07";
const url = `${process.env.CHROMA_PROTOCOL}://${process.env.CHROMA_HOST}:${process.env.CHROMA_PORT}`;

const getEmbedding = async (text: string): Promise<number[]> => {
  const genAI = new GoogleGenerativeAI(process.env.MIT_CCI_GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: EMBEDDING_MODEL,
  });

  const result = await model.embedContent(text);
  const embedding = result.embedding;
  console.log(embedding);
  return embedding.values;
};

const embedding = {
  embedQuery: getEmbedding,
  embedDocuments: async (docs: string[]) => Promise.all(docs.map(getEmbedding)),
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

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query, skillsFuture, appName } = req.body;
  console.log("query", query, skillsFuture, appName);
  let collectionName = "";
  if (appName) {
    collectionName = `ontology-${sanitizeCollectionName(appName)}`;
  } else if (skillsFuture) {
    collectionName = "ontology-skills";
  } else {
    collectionName = "ontology";
  }
  const client = new ChromaClient({ path: url });
  const queryEmbedded = await getEmbedding(query);

  const collection = await client.getOrCreateCollection({
    name: collectionName,
  });
  const results = await collection.query({
    queryEmbeddings: [queryEmbedded],
    nResults: 20,
  });
  const ids = results.ids[0];
  const titles = results.documents[0];
  const resultsAlt = [];
  const uniqueResults = new Set();
  for (let rIdx = 0; rIdx < ids.length; rIdx++) {
    const replacedId = ids[rIdx].replace("-properties", "");
    if (!uniqueResults.has(replacedId) && titles[rIdx]) {
      uniqueResults.add(replacedId);
      resultsAlt.push({ title: titles[rIdx], id: replacedId });
    }
  }
  console.log("results", JSON.stringify(results, null, 2));
  return res.status(200).json({ results: resultsAlt });
}

export default fbAuth(handler, true);
