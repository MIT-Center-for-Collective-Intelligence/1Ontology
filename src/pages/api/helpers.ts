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
    const apiKeys = [
      process.env.MIT_CCI_GEMINI_API_KEY,
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
      process.env.GEMINI_API_KEY_43,
      process.env.GEMINI_API_KEY_44,
      process.env.GEMINI_API_KEY_45,
      process.env.GEMINI_API_KEY_46,
      process.env.GEMINI_API_KEY_47,
      process.env.GEMINI_API_KEY_48,
      process.env.GEMINI_API_KEY_49,
      process.env.GEMINI_API_KEY_50,
      process.env.GEMINI_API_KEY_51,
      process.env.GEMINI_API_KEY_52,
      process.env.GEMINI_API_KEY_53,
      process.env.GEMINI_API_KEY_54,
      process.env.GEMINI_API_KEY_55,
      process.env.GEMINI_API_KEY_56,
      process.env.GEMINI_API_KEY_57,
      process.env.GEMINI_API_KEY_58,
      process.env.GEMINI_API_KEY_59,
      process.env.GEMINI_API_KEY_60,
      process.env.GEMINI_API_KEY_61,
      process.env.GEMINI_API_KEY_62,
      process.env.GEMINI_API_KEY_63,
      process.env.GEMINI_API_KEY_64,
    ] as string[];

    const shuffledKeys = [...apiKeys].sort(() => Math.random() - 0.5);

    let response = "";
    let isJSONObject = {
      jsonObject: {},
      isJSON: false,
    };

    for (const apiKey of shuffledKeys) {
      const genAI = new GoogleGenerativeAI(apiKey);
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

        console.error(`Invalid JSON from key ${apiKey}. Trying next...`);
      } catch (error) {
        const errorCode =
          (error as any)?.code ||
          (error as any)?.status ||
          (error as any)?.response?.status;

        if (errorCode === 429) {
          console.warn(`Rate limit (429) on key ${apiKey}. Skipping...`);
        } else {
          console.error(`Error with key ${apiKey}:`, error);
        }

        await delay(5000);
      }
    }

    throw new Error(
      "All API keys exhausted - failed to get a complete JSON object",
    );
  } catch (error: any) {
    console.error("Fatal error in askGemini:", error);
  }
};
