import { db } from "@components/lib/firestoreServer/admin";
import { ICollection, INode } from "@components/types/INode";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextApiRequest, NextApiResponse } from "next";
import { delay } from "@components/lib/utils/utils";
import { ChromaClient, OpenAIEmbeddingFunction } from "chromadb";
import fbAuth from "@components/middlewares/fbAuth";
import { development } from "@components/lib/CONSTANTS";
import Cors from "cors";

const EMBEDDING_MODEL = "gemini-embedding-exp-03-07";

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
  const { nodeId, updatedShortIds, deleteNode } = req.body;
  await runMiddleware(req, res, cors);
  if (development) {
    res.status(200).json({});
  }
  const nodeDoc = await db.collection("nodes").doc(nodeId).get();

  const client = new ChromaClient({ path: url });

  const nodeData = nodeDoc.data() as INode;
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

  if (updatedShortIds) {
    const descriptionRef = nodeData.inheritance?.description?.ref;
    const rawDescription = nodeData.properties?.description || "";

    const pageContent = `${nodeData.title}\n${!descriptionRef ? `Description:\n${rawDescription.trim()}` : ""}`;

    await collection.upsert({
      documents: [pageContent.toLowerCase()],
      ids: [nodeId],
      metadatas: [
        {
          title: nodeData.title,
          id: nodeData.id,
        },
      ],
    });
  }
  if (!!deleteNode && nodeData.id) {
    await collection.delete({ ids: [nodeData.id] });
    await collection.delete({ ids: [`${nodeData.id}-properties`] });
  }

  const propertyOf: { [propertyName: string]: ICollection[] } =
    nodeData.propertyOf || {};

  const nodesDocs =
    nodeData.skillsFuture && nodeData.appName
      ? await db
          .collection("nodes")
          .where("deleted", "==", false)
          .where("appName", "==", nodeData.appName)
          .get()
      : await db
          .collection("nodes")
          .where("deleted", "==", false)
          .where("skillsFuture", "==", false)
          .get();

  const nodesByIds: Record<string, any> = {};
  nodesDocs.docs.forEach((n) => {
    const nodeData = n.data();
    if (!nodeData.category) {
      nodesByIds[n.id] = nodeData;
    }
  });
  const updateDocuments = [];
  const updateDocumentsIds: string[] = [];
  const nodeStructure = getFullNodeStructure(nodeData, nodesByIds);
  if (!deleteNode) {
    updateDocumentsIds.push(`${nodeData.id}-properties`);
    updateDocuments.push(nodeStructure);
  }

  for (let property of [
    ...Object.keys(propertyOf),
    "specializations",
    "generalizations",
  ]) {
    let propertyValue = propertyOf[property];
    if (property === "specializations" || property === "generalizations") {
      propertyValue = nodeData[property];
    }

    for (let { id } of propertyValue.flatMap((c) => c.nodes)) {
      const nodeStructure = getFullNodeStructure(nodesByIds[id], nodesByIds);
      updateDocuments.push(nodeStructure);
      if (!updateDocumentsIds.includes(`${id}-properties`)) {
        updateDocumentsIds.push(`${id}-properties`);
      }
    }
  }
  const docsChunks = createChunks(updateDocuments);
  const idsChunks = createChunks(updateDocumentsIds);

  for (let i = 0; i < idsChunks.length; i++) {
    try {
      const chunkIdsLong = idsChunks[i];
      const chunkDocs = docsChunks[i];
      const fullDocuments = chunkDocs.map((doc) => doc.content.toLowerCase());

      const metadatas = chunkDocs.map((d) => {
        return {
          title: d.title,
          id: d.id,
          nodeType: d.nodeType,
        };
      });

      await collection.upsert({
        documents: fullDocuments,
        ids: chunkIdsLong,
        metadatas,
      });
    } catch (error) {
      console.error("Error embedding batch:", error);
    }
  }
  return res.status(200).json({});
}

export default handler;
