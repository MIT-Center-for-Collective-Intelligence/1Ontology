/*
 * Install the Generative AI SDK
 *
 * $ npm install @google/generative-ai
 *
 * See the getting started guide for more information
 * https://ai.google.dev/gemini-api/docs/get-started/node
 */

export const openai = new OpenAI({
  apiKey: process.env.MIT_CCI_API_KEY,
  organization: process.env.MIT_CCI_API_ORG_ID,
});

import { dbCausal } from "@components/lib/firestoreServer/admin";
import { delay } from "@components/lib/utils/utils";
import {
  Content,
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
} from "@google/generative-ai";
import OpenAI from "openai";

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
    const key = process.env.MIT_CCI_GEMINI_API_KEY || "";

    const genAI = new GoogleGenerativeAI(key);
    const genModel = genAI.getGenerativeModel({ model });

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
