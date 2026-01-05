import { db } from "@components/lib/firestoreServer/admin";
import { ICollection, INode } from "@components/types/INode";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextApiRequest, NextApiResponse } from "next";
import { delay } from "@components/lib/utils/utils";
import { ChromaClient, Embedding, OpenAIEmbeddingFunction } from "chromadb";
import fbAuth from "@components/middlewares/fbAuth";
import { development } from "@components/lib/CONSTANTS";
import Cors from "cors";
import { openai } from "./helpers";

const url = `${process.env.CHROMA_PROTOCOL}://${process.env.CHROMA_HOST}:${process.env.CHROMA_PORT}`;

const getFullNodeStructure = (
  nodeData: INode,
  nodesByIds: { [nodeId: string]: INode },
) => {
  const extractTitles = (key: "specializations" | "generalizations") =>
    nodeData[key]
      ?.flatMap((c: ICollection) => c.nodes || [])
      ?.map(({ id }: { id: string }) => nodesByIds[id]?.title) || [];

  const extractPropTitles = (key: string) => {
    const inheritedProperty = !!nodeData.inheritance[key]?.ref;
    if (inheritedProperty) {
      return [];
    }
    return (
      nodeData.properties[key]
        ?.flatMap((c: ICollection) => c.nodes || [])
        ?.map(({ id }: { id: string }) => nodesByIds[id]?.title) || []
    );
  };

  const formatSection = (label: string, items: string[]) =>
    items.length ? `${label}:\n${items.join("\n")}` : "";

  const specializationText = formatSection(
    "Specializations",
    extractTitles("specializations"),
  );
  const generalizationsText = formatSection(
    "Generalizations",
    extractTitles("generalizations"),
  );
  const partsText = formatSection("Parts", extractPropTitles("parts"));
  const isPartOfText = formatSection(
    "Is Part Of",
    extractPropTitles("isPartOf"),
  );
  const descriptionRef = nodeData.inheritance?.description?.ref;
  const rawDescription = nodeData.properties?.description || "";
  const fullDescription = [
    !descriptionRef && !!rawDescription.trim()
      ? `Description:\n${rawDescription.trim()}`
      : "",
    specializationText || "",
    generalizationsText || "",
    partsText || "",
    isPartOfText || "",
  ]
    .filter((c) => !!c)
    .join("\n\n");
  return {
    id: nodeData.id,
    title: nodeData.title,
    content: `${fullDescription}`,
    nodeType: nodeData.nodeType,
  };
};
const createChunks = (elements: any[], chunkSize = 10): any[][] => {
  const chunks = [];
  for (let i = 0; i < elements.length; i += chunkSize) {
    chunks.push(elements.slice(i, i + chunkSize));
  }
  return chunks;
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
async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { nodeId, update, deleted } = req.body;
    await runMiddleware(req, res, cors);
    if (development) {
      res.status(200).json({});
    }
    console.log(nodeId, "nodeId");

    const nodeDoc = await db.collection("nodes").doc(nodeId).get();

    const client = new ChromaClient({ path: url });

    const nodeData = nodeDoc.data() as INode;
    if (!nodeData) {
      throw new Error("empty");
    }
    let collectionName = "";
    if (nodeData.appName) {
      collectionName = `ontology-${sanitizeCollectionName(nodeData.appName)}`;
    } else if (nodeData.skillsFuture) {
      collectionName = "ontology-skills";
    } else {
      collectionName = "ontology";
    }

    let collection = await client.getOrCreateCollection({
      name: collectionName,
      embeddingFunction: embeddingFunction,
    });

    if (update) {
      const descriptionRef = nodeData.inheritance?.description?.ref;
      const rawDescription = nodeData.properties?.description || "";
      const pageContent = `${nodeData.title}\n${!descriptionRef ? `Description:\n${rawDescription.trim()}` : ""}`;

      const embeddingsResponse = await openai.embeddings.create({
        model: "text-embedding-3-large",
        input: pageContent,
      });
      if (embeddingsResponse.data.length > 0) {
        const _embedding = embeddingsResponse.data[0].embedding;

        await collection.upsert({
          documents: [pageContent.toLowerCase()],
          ids: [nodeId],
          metadatas: [
            {
              title: nodeData.title,
              id: nodeData.id,
              nodeType: nodeData.nodeType,
            },
          ],
          embeddings: [_embedding],
        });
      }
    } else if (deleted && nodeData.id) {
      await collection.delete({ ids: [nodeData.id] });
    }
    return res.status(200).json({});
  } catch (error) {
    console.error(error);
    return res.status(500).json({});
  }
}

export default handler;
