/*
 * Install the Generative AI SDK
 *
 * $ npm install @google/generative-ai
 *
 * See the getting started guide for more information
 * https://ai.google.dev/gemini-api/docs/get-started/node
 */

import {
  Content,
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
} from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

const genAI = new GoogleGenerativeAI(apiKey || "");

/**
 * Uploads the given file to Gemini.
 *
 * See https://ai.google.dev/gemini-api/docs/prompting_with_media
 */

const generationConfig = {
  temperature: 0,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 8192,
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

export const askGemini = async (contents: Content[]) => {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
  let response = "";
  let isJSONObject = {
    jsonObject: {},
    isJSON: false,
  };

  for (let i = 0; i < 4; i++) {
    try {
      const result = await model.generateContent({
        contents,
        generationConfig,
        safetySettings,
      });
      response = result.response.text();
      isJSONObject = isValidJSON(response);
      if (isJSONObject.isJSON) {
        break;
      }
      console.error(
        "Failed to get a complete JSON object. Retrying for the ",
        i + 1,
        " time.",
      );
    } catch (error) {
      console.error("Error in generating content: ", error);
    }
  }
  console.log("isJSONObject.jsonObject", isJSONObject.jsonObject);
  if (!isJSONObject.isJSON) {
    throw new Error("Failed to get a complete JSON object");
  }
  return isJSONObject.jsonObject;
};
