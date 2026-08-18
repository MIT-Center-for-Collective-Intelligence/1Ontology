import { GoogleGenAI } from "@google/genai";
import { delay } from "./lib";

export const MODEL_REQUEST_MAX_ATTEMPTS = 3;
export const MODEL_REQUEST_RETRY_DELAY_MS = 5_000;

export type UsedTokens = {
  input: number;
  output: number;
  thinking: number;
  total: number;
  cost?: any;
};

export type ResponseCost = {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: "USD";
};

export const PROMPT_TOKEN_TIER_THRESHOLD = 200_000;

// Standard Tier Rates

// Context Caching Rates

export interface GeminiUsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  thoughtsTokenCount?: number;
  cachedContentTokenCount?: number;
  totalTokenCount: number;
}

export interface CostResponse {
  usedTokens: {
    input: number;
    cashed: number; // Intentional string mapping matching user request schema
    output: number;
    thinking: number;
    total: number;
  };
  cost: {
    input: number;
    output: number;
    total: number;
  };
}

export type SupportedGeminiModel =
  | "gemini-3.5-flash"
  | "gemini-3.1-pro-preview";

// 1. Define flat rates for models without tiered pricing
const MODEL_PRICING: Record<
  string,
  { input: number; cached: number; output: number }
> = {
  "gemini-3.5-flash": { input: 1.5, cached: 0.15, output: 9.0 },
};

// 2. Dynamic helper to resolve context-dependent rates
const getModelPricing = (model: string, totalPromptTokens: number) => {
  if (model === "gemini-3.1-pro-preview") {
    return totalPromptTokens > 200_000
      ? { input: 4.0, cached: 0.4, output: 18.0 } // Long context (>200K)
      : { input: 2.0, cached: 0.2, output: 12.0 }; // Short context (<=200K)
  }
  return MODEL_PRICING[model] || MODEL_PRICING["gemini-3.5-flash"];
};

// 3. Main Cost Calculator
export const getCostForGeminiResponse = (
  model: SupportedGeminiModel,
  metadata: GeminiUsageMetadata,
): CostResponse => {
  // Isolate Token Blocks
  const cashedTokens = metadata.cachedContentTokenCount || 0;
  const freshInputTokens = metadata.promptTokenCount - cashedTokens;
  const thinkingTokens = metadata.thoughtsTokenCount || 0;
  const totalOutputTokens = metadata.candidatesTokenCount + thinkingTokens;

  const rates = getModelPricing(model, metadata.promptTokenCount);

  const inputCost =
    (freshInputTokens / 1_000_000) * rates.input +
    (cashedTokens / 1_000_000) * rates.cached;

  const outputCost = (totalOutputTokens / 1_000_000) * rates.output;

  return {
    usedTokens: {
      input: freshInputTokens,
      cashed: cashedTokens,
      output: metadata.candidatesTokenCount,
      thinking: thinkingTokens,
      total: metadata.totalTokenCount,
    },
    cost: {
      input: inputCost,
      output: outputCost,
      total: inputCost + outputCost,
    },
  };
};
const ai = new GoogleGenAI({ apiKey: process.env.MIT_CCI_GEMINI_API_KEY });

export const generateContentWithRetry = async (request: {
  model: string;
  contents: any;
  config: any;
}) => {
  for (let attempt = 1; attempt <= MODEL_REQUEST_MAX_ATTEMPTS; attempt++) {
    try {
      return await ai.models.generateContent(request);
    } catch (error) {
      if (attempt >= MODEL_REQUEST_MAX_ATTEMPTS) {
        throw error;
      }

      console.warn(
        `generateContent failed on attempt ${attempt}/${MODEL_REQUEST_MAX_ATTEMPTS}. Retrying in ${MODEL_REQUEST_RETRY_DELAY_MS / 1000} seconds...`,
        error,
      );
      await delay(MODEL_REQUEST_RETRY_DELAY_MS);
    }
  }

  throw new Error("generateContentWithRetry exhausted all attempts");
};

const toNonNegativeNumber = (value: unknown): number => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : 0;
};

export const sendGeminiRequest = async (request: {
  model: SupportedGeminiModel;
  contents: any;
  config: any;
}) => {
  console.log("call gemini");
  const startTime = Date.now();
  const response: any = await generateContentWithRetry(request);

  const endTime = Date.now();
  const executionTimeMs = endTime - startTime;
  const text = response.candidates[0].content.parts[0].text;
  const responseObject = extractObject(text);
  const summaryCost = getCostForGeminiResponse(
    request.model,
    response?.usageMetadata as any,
  );

  return {
    responseObject,
    cost: summaryCost.cost,
    usedTokens: summaryCost.usedTokens,
    executionTime: executionTimeMs,
  };
};

export const extractObject = (str: any) => {
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
      } catch (e) {
        console.log("couldn't extract object");
        console.error(e);
        return null;
      }
    }
  }
  console.log("couldn't extract object");
  return null;
};
