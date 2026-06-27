import { dbCausal } from "@components/lib/firestoreServer/admin";
import { delay } from "@components/lib/utils/utils";
import { ChromaClient, IncludeEnum, OpenAIEmbeddingFunction } from "chromadb";
import { getNodesByIds } from "./copilot";
import { embeddingFunctionDefault, openai } from "./openaiClient";
import { Content, GoogleGenAI, Type } from "@google/genai";
import { development } from "@components/lib/CONSTANTS";

type OntologyChromaQueryResultRow = {
  title: string;
  description: string;
  generalizations: (string | undefined)[];
  specializations: (string | undefined)[];
  parts: { title: string; optional: string }[];
};

const ai = new GoogleGenAI({ apiKey: process.env.MIT_CCI_GEMINI_API_KEY });

const extractObject = (str: string) => {
  try {
    const start = str.indexOf("{");
    if (start === -1) return null;

    let braceCount = 0;
    for (let i = start; i < str.length; i++) {
      if (str[i] === "{") braceCount++;
      else if (str[i] === "}") braceCount--;

      if (braceCount === 0) {
        const jsonStr = str.slice(start, i + 1);
        try {
          return JSON.parse(jsonStr);
        } catch {
          return null;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
};

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
      let llmResponse: any = await ai.models.generateContent({
        model: model,
        contents,
        config: {
          temperature: 0,
          thinkingConfig: {
            thinkingBudget: 1024,
          },
        },
      });
      response = llmResponse?.candidates?.[0]?.content;

      await dbCausal.collection("responsesAI").doc().set({
        contents,
        response,
        createdAt: new Date(),
      });

      isJSONObject = isValidJSON(response);

      if (isJSONObject.isJSON) {
        return isJSONObject.jsonObject;
      }
    } catch (error) {
      const errorCode =
        (error as any)?.code ||
        (error as any)?.status ||
        (error as any)?.response?.status;

      if (errorCode === 429) {
        console.warn(`Rate limit (429)`);
      } else {
        console.error(`Error with key `);
      }

      await delay(5000);
    }
  } catch (error: any) {
    console.error("Fatal error in askGemini:", error);
  }
};

const chromaUrl = `${process.env.CHROMA_PROTOCOL}://${process.env.CHROMA_HOST}:${process.env.CHROMA_PORT}`;

const sanitizeChromaCollectionName = (title: string) => {
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
  appName?: string;
  nodeType?: string;
  resultsNum?: number;
  inputProperties?: string[];
}

const chromaClient = new ChromaClient({ path: chromaUrl });

export const searchChromaCore = async ({
  query,
  appName,
  nodeType,
  resultsNum,
  inputProperties,
}: SearchChromaParams) => {
  let collectionName = "ontology";
  if (appName) {
    collectionName = development
      ? `ontology-dev-${sanitizeChromaCollectionName(appName)}`
      : `ontology-${sanitizeChromaCollectionName(appName)}`;
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

  const resultsWithIds = metaDatas.map((m) => {
    return { id: m.id, title: m.title };
  });

  if (resultsWithIds.length === 0) return [];

  const lowerQuery = query.toLowerCase().trim();
  resultsWithIds.sort((a, b) => {
    const aTitle = (a.title || "").toLowerCase().trim();
    const bTitle = (b.title || "").toLowerCase().trim();

    const aExact = aTitle === lowerQuery;
    const bExact = bTitle === lowerQuery;

    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;
    return 0;
  });

  return resultsWithIds;
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
const functionDeclaration = {
  name: "QueryOntology",
  description:
    "Semantic search over an ontology index (Chroma). Use this to find facts that exist as ontology nodes. You may issue multiple queries in a single call to cover synonyms, related concepts, or different facets of the user's question. Each query string is searched independently and results are merged.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      queries: {
        type: Type.ARRAY,
        items: {
          type: Type.STRING,
        },
        description:
          'One or more highly optimized phrases for embedding similarity. Each array item is ONE query phrase. Do NOT put multiple queries into a single comma-separated string. Example: ["Assemble","Create","Gather"]',
      },
    },
    required: ["queries"],
  },
};

export const getNodesByIdsObject = async (nodeIds: string[]) => {
  const nodesObject = await getNodesByIds(new Set(nodeIds));

  return nodesObject.nodes_ids;
};

export function chromaHitsToOntologyQueryResults(
  chromaResults: Array<{ id: string; title?: string }> | null | undefined,
  nodesById: Record<string, any>,
): OntologyChromaQueryResultRow[] {
  const queryResults: OntologyChromaQueryResultRow[] = [];
  if (!chromaResults?.length) return queryResults;
  for (const result of chromaResults) {
    if (!result?.id) continue;
    const nodeData = nodesById[result.id];
    if (!nodeData) continue;
    const parentNodes = nodeData.generalizations?.[0]?.nodes ?? [];
    const generalizations = parentNodes.map(
      (c: { id: string }) => nodesById[c.id]?.title,
    );
    const childNodes = (nodeData.specializations ?? []).flatMap(
      (c: { nodes?: { id: string }[] }) => c.nodes ?? [],
    );
    const specializations = childNodes.map(
      (c: { id: string }) => nodesById[c.id]?.title,
    );
    const partsNodes = nodeData.properties?.parts?.[0]?.nodes ?? [];
    const parts = partsNodes.map((n: any) => {
      return {
        title: nodesById[n.id]?.title,
        optional: !!n.optional ? "true" : "false",
      };
    });
    queryResults.push({
      title: result.title ?? nodeData.title,
      description: nodeData.properties?.description,
      generalizations,
      specializations,
      parts: parts,
    });
  }
  return queryResults;
}

/** Loads hit nodes and one hop of generalizations/specializations so parent/child titles resolve. */
export async function buildNodesByIdForChromaResults(
  chromaResults: Array<{ id: string }> | null | undefined,
): Promise<Record<string, any>> {
  if (!chromaResults?.length) return {};
  const seedIds = [
    ...new Set(
      chromaResults.map((r) => r.id).filter((id): id is string => !!id),
    ),
  ];
  const primary = await getNodesByIdsObject(seedIds);
  const neighborIds = new Set<string>();
  for (const node of Object.values(primary) as any[]) {
    for (const n of node?.generalizations?.[0]?.nodes ?? []) {
      if (n?.id) neighborIds.add(n.id);
    }
    for (const coll of node?.specializations ?? []) {
      for (const n of coll?.nodes ?? []) {
        if (n?.id) neighborIds.add(n.id);
      }
    }

    for (const n of node?.properties?.parts?.[0]?.nodes ?? []) {
      if (n?.id) neighborIds.add(n.id);
    }
  }
  for (const id of seedIds) neighborIds.delete(id);
  const missing = [...neighborIds].filter((id) => !primary[id]);
  const secondary = missing.length ? await getNodesByIdsObject(missing) : {};
  return { ...secondary, ...primary };
}

export async function getOntologyQueryResultsFromChroma(
  chromaResults: Array<{ id: string; title?: string }> | null | undefined,
): Promise<OntologyChromaQueryResultRow[]> {
  const nodesById = await buildNodesByIdForChromaResults(chromaResults);
  return chromaHitsToOntologyQueryResults(chromaResults, nodesById);
}

/* const extractObject = (str: string) => {
  const start = str.indexOf("{");
  if (start === -1) return null;

  let braceCount = 0;
  for (let i = start; i < str.length; i++) {
    if (str[i] === "{") braceCount++;
    else if (str[i] === "}") braceCount--;

    if (braceCount === 0) {
      const jsonStr = str.slice(start, i + 1);
      try {
        return JSON.parse(jsonStr);
      } catch (error) {
        return null;
      }
    }
  }

  return null;
}; */

export const askGeminiWithFunctionCalling = async ({
  contents: initialContents,
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
  const startTime = Date.now();

  try {
    // Build up contents as we go (starting from the caller-provided conversation)
    const contents: any[] = Array.isArray(initialContents)
      ? [...initialContents]
      : [];

    const usedTokensAcc = { input: 0, output: 0, thinking: 0, total: 0 };
    const accumulateUsage = (response: any) => {
      const m = response?.usageMetadata;
      if (!m) return;
      const input = m.promptTokenCount || 0;
      const output = m.candidatesTokenCount || 0;
      const thinking = m.thoughtsTokenCount || 0;
      const callTotal = m.totalTokenCount ?? input + output + thinking;
      usedTokensAcc.input += input;
      usedTokensAcc.output += output;
      usedTokensAcc.thinking += thinking;
      usedTokensAcc.total += callTotal;
    };

    let llmResponse: any = await ai.models.generateContent({
      model: model,
      contents,
      config: {
        temperature: 0,
        thinkingConfig: {
          thinkingBudget: 1024,
        },
        tools: [{ functionDeclarations: [functionDeclaration] }],
      },
    });
    accumulateUsage(llmResponse);

    // Loop until the model stops calling functions
    while (true) {
      const modelContent = llmResponse?.candidates?.[0]?.content;
      const parts: any[] = modelContent?.parts ?? [];
      const functionCallPart = parts.find((p: any) => p.functionCall);

      // No more function calls — we have the final text response
      if (!functionCallPart) break;

      const functionCall = functionCallPart.functionCall;
      console.log("functionCall:", functionCall?.name, functionCall?.args);

      // Preserve Gemini's model turn exactly so function-call thought signatures
      // remain attached when the tool response is sent back.
      contents.push(modelContent);

      // Execute the function call
      let functionResult: any[] = [];

      if (functionCall?.name === "QueryOntology") {
        const args = functionCall?.args || {};
        const queriesInput = args.queries ?? args.query;
        const normalizeQueryString = (raw: string): string[] => {
          const s = String(raw || "").trim();
          if (!s) return [];
          // Handle models that return a single comma-separated string.
          if (s.includes(",")) {
            const parts = s
              .split(",")
              .map((p) => p.trim())
              .filter(Boolean);
            if (parts.length >= 2) return parts;
          }
          return [s];
        };

        const queries = Array.isArray(queriesInput)
          ? queriesInput.flatMap((q: any) => normalizeQueryString(q))
          : normalizeQueryString(queriesInput);

        let allChromaResults: any[] = [];
        for (const query of queries) {
          const chromaResults = query
            ? await searchChromaCore({
                query,
                appName,
                nodeType: "activity",
                resultsNum: 10,
              })
            : [];
          allChromaResults.push(...(chromaResults || []));
        }

        const queryResults =
          await getOntologyQueryResultsFromChroma(allChromaResults);
        functionResult = [
          {
            functionResponse: {
              name: "QueryOntology",
              response: { results: queryResults ?? [] },
            },
          },
        ];
      } else {
        console.warn("Unknown function call:", functionCall?.name);
        functionResult = [
          {
            functionResponse: {
              name: functionCall?.name,
              response: { results: [] },
            },
          },
        ];
      }

      contents.push({ role: "user", parts: functionResult });

      llmResponse = await ai.models.generateContent({
        model: model,
        contents,
        config: {
          temperature: 0,
          tools: [{ functionDeclarations: [functionDeclaration] }],
        },
      });
      accumulateUsage(llmResponse);
    }

    const text = llmResponse?.text || "";
    const responseObject = extractObject(text);

    return {
      responseObject,
      usedTokens: { ...usedTokensAcc },
      executionTime: Date.now() - startTime,
    };
  } catch (error) {
    console.error("sendRequest failed:", error);
    throw error;
  }
};
