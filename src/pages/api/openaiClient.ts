import { OpenAIEmbeddingFunction } from "chromadb";
import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.MIT_CCI_API_KEY,
  organization: process.env.MIT_CCI_API_ORG_ID,
});

export const embeddingFunctionDefault = new OpenAIEmbeddingFunction({
  openai_api_key: process.env.MIT_CCI_API_KEY,
  openai_model: "text-embedding-3-large",
});
