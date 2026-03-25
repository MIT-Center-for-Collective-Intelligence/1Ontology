/*
 * Install the Generative AI SDK
 *
 * $ npm install @google/generative-ai
 *
 * See the getting started guide for more information
 * https://ai.google.dev/gemini-api/docs/get-started/node
 */

import { dbCausal } from "@components/lib/firestoreServer/admin";
import { delay } from "@components/lib/utils/utils";
import {
  Content,
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
  FunctionDeclaration,
  Part,
} from "@google/generative-ai";
import OpenAI from "openai";
import { ChromaClient, IncludeEnum, OpenAIEmbeddingFunction } from "chromadb";
import { getNodesByIds } from "./copilot";
import { embeddingFunctionDefault, openai } from "./openaiClient";

const key = process.env.MIT_CCI_GEMINI_API_KEY || "";

if (!key) {
  throw new Error("Gemini API key not found");
}

const genAI = new GoogleGenerativeAI(key);
const genModel = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
/**
 * Uploads the given file to Gemini.
 *
 * See https://ai.google.dev/gemini-api/docs/prompting_with_media
 */

const generationConfig = {
  temperature: 0,
  topP: 0.95,
  topK: 64,
  responseMimeType: "application/json",
};

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

const isValidJSON = (jsonString: string) => {
  try {
    const start = jsonString.indexOf("{");
    const end = jsonString.lastIndexOf("}");
    const objectString = jsonString.slice(start, end + 1);

    return { jsonObject: JSON.parse(objectString), isJSON: true };
  } catch (error) {
    console.error(error);
    return { jsonObject: {}, isJSON: false };
  }
};

export const askGemini = async (contents: Content[], model: string) => {
  try {
    await delay(5 * 1000);

    let response = "";
    let isJSONObject = {
      jsonObject: {},
      isJSON: false,
    };

    try {
      const result = await genModel.generateContent({
        contents,
        generationConfig,
        safetySettings,
      });
      response = result.response.text();

      await dbCausal.collection("responsesAI").doc().set({
        contents,
        response,
        createdAt: new Date(),
      });

      isJSONObject = isValidJSON(response);

      if (isJSONObject.isJSON) {
        return isJSONObject.jsonObject;
      }

      console.error(`Invalid JSON from key ${key}. Trying next...`);
    } catch (error) {
      const errorCode =
        (error as any)?.code ||
        (error as any)?.status ||
        (error as any)?.response?.status;

      if (errorCode === 429) {
        console.warn(`Rate limit (429) on key ${key}. Skipping...`);
      } else {
        console.error(`Error with key ${key}:`, error);
      }

      await delay(5000);
    }
  } catch (error: any) {
    console.error("Fatal error in askGemini:", error);
  }
};

const chromaUrl = `${process.env.CHROMA_PROTOCOL}://${process.env.CHROMA_HOST}:${process.env.CHROMA_PORT}`;

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

interface SearchChromaParams {
  query: string;
  skillsFuture?: boolean;
  appName?: string;
  nodeType?: string;
  resultsNum?: number;
  inputProperties?: string[];
}

const chromaClient = new ChromaClient({ path: chromaUrl });

export const searchChromaCore = async ({
  query,
  skillsFuture,
  appName,
  nodeType,
  resultsNum,
  inputProperties,
}: SearchChromaParams) => {
  let collectionName = "ontology";
  if (appName) {
    collectionName = `ontology-${sanitizeCollectionName(appName)}`;
  } else if (skillsFuture) {
    collectionName = "ontology-skills";
  }

  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: query.toLowerCase(),
  });
  const queryEmbedding = embeddingResponse.data[0].embedding;

  const collection = await chromaClient.getOrCreateCollection({
    name: collectionName,
    embeddingFunction: embeddingFunctionDefault,
  });

  const results = await collection.query({
    queryEmbeddings: [queryEmbedding],
    include: [IncludeEnum.Metadatas, IncludeEnum.Distances],
    nResults: resultsNum || 20,
    ...(nodeType ? { where: { nodeType } } : {}),
  });

  const metaDatas: any[] = results.metadatas[0] || [];

  const nodeIds = metaDatas.map((m) => m.id).filter(Boolean);

  if (nodeIds.length === 0) return [];

  const { nodes_ids, nodes_titles } = await getNodesByIds(new Set(nodeIds));

  const formattedResults = nodeIds
    .map((id) => {
      const node = nodes_ids[id];
      if (!node) return null;

      const inputPropsSet = inputProperties ? new Set(inputProperties) : null;
      const res: any = { id, title: node.title || "Untitled" };

      if (!inputPropsSet || inputPropsSet.has("description")) {
        res.description = node.description || "";
      }
      if (!inputPropsSet || inputPropsSet.has("specializations")) {
        res.specializations = (node.specializations || []).flatMap((col: any) =>
          (col.nodes || []).map((n: any) => n.title),
        );
      }
      if (!inputPropsSet || inputPropsSet.has("generalizations")) {
        res.generalizations = (node.generalizations?.[0]?.nodes || []).flatMap(
          (col: any) => (col.nodes || []).map((n: any) => n.title),
        );
      }
      if (!inputPropsSet || inputPropsSet.has("parts")) {
        res.parts = (node.parts || []).flatMap((col: any) =>
          (col.nodes || []).map((n: any) => n.title),
        );
      }
      if (!inputPropsSet || inputPropsSet.has("isPartOf")) {
        res.isPartOf = (node.isPartOf || []).flatMap((col: any) =>
          (col.nodes || []).map((n: any) => n.title),
        );
      }

      return res;
    })
    .filter(Boolean);

  return formattedResults.sort((a: any, b) =>
    a.title.toLowerCase() === query.toLowerCase() ? -1 : 1,
  );
};

// Helper function for Exponential Backoff
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function generateWithBackoff(
  genModel: any,
  request: any,
  maxRetries = 3,
) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await genModel.generateContent(request);
    } catch (error: any) {
      const status = error?.status || error?.response?.status;
      if (status === 429 && i < maxRetries - 1) {
        // Exponential backoff: 1s, 2s, 4s + random jitter
        const waitTime = Math.pow(2, i) * 1000 + Math.random() * 500;
        console.warn(
          `[Rate Limit] 429 received. Retrying in ${Math.round(waitTime)}ms...`,
        );
        await sleep(waitTime);
      } else {
        throw error;
      }
    }
  }
}

export const askGeminiWithFunctionCalling = async ({
  contents,
  model,
  appName,
  inputProperties,
  maxIterations = 5,
}: {
  contents: Content[];
  model: string;
  appName?: string;
  inputProperties?: string[];
  maxIterations?: number;
}): Promise<any> => {
  const genModel = genAI.getGenerativeModel({ model });

  const searchChromaFunction: any = {
    name: "searchChroma",
    description: "Searches the Chroma vector database for ontology nodes...",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        nodeType: { type: "string" },
        resultsNum: { type: "number" },
      },
      required: ["query"],
    },
  };

  const tools = [{ functionDeclarations: [searchChromaFunction] }];
  const generationConfig = { temperature: 0, topP: 0.95, topK: 64 };

  let conversationHistory: Content[] = [...contents];
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;

    const result = await generateWithBackoff(genModel, {
      contents: conversationHistory,
      tools,
      generationConfig,
    });

    const candidate = result.response.candidates?.[0];
    if (!candidate) throw new Error("No candidates in response");

    conversationHistory.push(candidate.content);

    const messageParts = candidate.content.parts;
    const functionCalls = messageParts.filter((p: any) => p.functionCall);

    if (functionCalls.length > 0) {
      const functionResponses: any[] = [];

      for (const part of functionCalls) {
        const fc = part.functionCall;
        if (fc.name === "searchChroma") {
          const args = fc.args as any;
          console.log(`[Function Call] searchChroma with:`, args);

          const searchResults = await searchChromaCore({
            query: args.query,
            appName,
            nodeType: args.nodeType,
            resultsNum: args.resultsNum || 100,
            inputProperties,
          });

          functionResponses.push({
            functionResponse: {
              name: fc.name,
              response: {
                results: searchResults,
                count: searchResults.length,
              },
            },
          });
        }
      }

      // 4. Push all function results back to the model for the next iteration
      conversationHistory.push({
        role: "user",
        parts: functionResponses,
      });

      continue;
    }

    const text = result.response.text();
    const jsonResult = isValidJSON(text);

    const finalOutput = jsonResult.isJSON ? jsonResult.jsonObject : { text };
    /* 
    await dbCausal.collection("responsesAI").doc().set({
      contents: conversationHistory,
      response: text,
      createdAt: new Date(),
    }); */

    return finalOutput;
  }

  throw new Error("Max iterations reached without final response");
};
