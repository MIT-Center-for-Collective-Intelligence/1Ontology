/*
 * Install the Generative AI SDK
 *
 * $ npm install @google/generative-ai
 *
 * See the getting started guide for more information
 * https://ai.google.dev/gemini-api/docs/get-started/node
 */

import { dbCausal } from "@components/lib/firestoreServer/admin";
import {
  Content,
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
} from "@google/generative-ai";
import OpenAI from "openai";

const apiKey = process.env.GEMINI_API_KEY;

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
    return { jsonObject: JSON.parse(jsonString), isJSON: true };
  } catch (error) {
    console.error(error);
    return { jsonObject: {}, isJSON: false };
  }
};

export const askGemini = async (contents: Content[], model: string) => {
  const apiKeys = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5,
    process.env.GEMINI_API_KEY_6,
    process.env.GEMINI_API_KEY_7,
    process.env.GEMINI_API_KEY_8,
    process.env.GEMINI_API_KEY_9,
    process.env.GEMINI_API_KEY_10,
    process.env.GEMINI_API_KEY_11,
    process.env.GEMINI_API_KEY_12,
    process.env.GEMINI_API_KEY_13,
    process.env.GEMINI_API_KEY_14,
    process.env.GEMINI_API_KEY_15,
    process.env.GEMINI_API_KEY_16,
    process.env.GEMINI_API_KEY_17,
    process.env.GEMINI_API_KEY_18,
    process.env.GEMINI_API_KEY_19,
    process.env.GEMINI_API_KEY_20,
    process.env.GEMINI_API_KEY_21,
    process.env.GEMINI_API_KEY_22,
    process.env.GEMINI_API_KEY_23,
    process.env.GEMINI_API_KEY_24,
    process.env.GEMINI_API_KEY_25,
    process.env.GEMINI_API_KEY_26,
    process.env.GEMINI_API_KEY_27,
    process.env.GEMINI_API_KEY_28,
    process.env.GEMINI_API_KEY_29,
    process.env.GEMINI_API_KEY_30,
    process.env.GEMINI_API_KEY_31,
    process.env.GEMINI_API_KEY_32,
    process.env.GEMINI_API_KEY_33,
    process.env.GEMINI_API_KEY_34,
    process.env.GEMINI_API_KEY_35,
    process.env.GEMINI_API_KEY_36,
    process.env.GEMINI_API_KEY_37,
    process.env.GEMINI_API_KEY_38,
    process.env.GEMINI_API_KEY_39,
    process.env.GEMINI_API_KEY_40,
    process.env.GEMINI_API_KEY_41,
    process.env.GEMINI_API_KEY_42,
    process.env.GEMINI_API_KEY,
  ] as string[];

  let response = "";
  let isJSONObject = {
    jsonObject: {},
    isJSON: false,
  };

  for (const apiKey of apiKeys) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const genModel = genAI.getGenerativeModel({ model });

    for (let i = 0; i < 3; i++) {
      try {
        const result = await genModel.generateContent({
          contents,
          generationConfig,
          safetySettings,
        });
        response = result.response.text();

        const newResponseRef = dbCausal.collection("responsesAI").doc();

        newResponseRef.set({
          contents,
          response,
          createdAt: new Date(),
        });
        isJSONObject = isValidJSON(response);

        if (isJSONObject.isJSON) {
          return isJSONObject.jsonObject;
        }

        console.error(
          `Failed to get valid JSON (attempt ${i + 1} with key ${apiKey.slice(0, 8)}...). Retrying...`,
        );
      } catch (error) {
        console.error(`Error with key ${apiKey.slice(0, 8)}...:`, error);
        break;
      }
    }
  }

  throw new Error(
    "All API keys exhausted - failed to get a complete JSON object",
  );
};

export const openai = new OpenAI({
  apiKey: process.env.MIT_CCI_API_KEY,
  organization: process.env.MIT_CCI_API_ORG_ID,
});
