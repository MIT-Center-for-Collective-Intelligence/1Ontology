import { NextApiRequest, NextApiResponse } from "next";
import { OpenAI } from "openai";
import { askGemini } from "./helpers";

const openai = new OpenAI({
  apiKey: process.env.MIT_CCI_API_KEY,
  organization: process.env.MIT_CCI_API_ORG_ID,
});

const extractJSON = (text: string) => {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (end === -1 || start === -1) {
      return { jsonObject: {}, isJSON: false };
    }
    const jsonArrayString = text.slice(start, end + 1);
    return { jsonObject: JSON.parse(jsonArrayString), isJSON: true };
  } catch (error) {
    return { jsonObject: {}, isJSON: false };
  }
};

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    const { messages, model } = req.body;

    if (messages.length <= 0) {
      return res.status(400).json({ error: "Prompt is required" });
    }
    if (model === "Gemini 1.5 PRO") {
      const prompt = messages[0].content;
      const response = await askGemini(prompt);
      console.log("response==>", JSON.stringify(response, null, 2));
      return res.status(200).send(response);
    }
    const temperature = model === "gpt-4o" ? 0 : 1;
    let isJSONObject: { jsonObject: any; isJSON: boolean } = {
      jsonObject: {},
      isJSON: false,
    };
    for (let i = 0; i < 4; i++) {
      try {
        const completion = await openai.chat.completions.create({
          messages,
          model: model || process.env.MODEL,
          temperature,
        });

        const response = completion.choices[0].message.content;
        isJSONObject = extractJSON(response || "");
        if (isJSONObject.isJSON) {
          break;
        }
        console.log(
          "Failed to get a complete JSON object. Retrying for the ",
          i + 1,
          " time."
        );
      } catch (error) {
        console.error("Error in generating content: ", error);
      }
    }
    if (!isJSONObject.isJSON) {
      throw new Error("Failed to get a complete JSON object");
    }

    console.log("Response: ", JSON.stringify(isJSONObject.jsonObject, null, 2));
    return res.status(200).send(isJSONObject.jsonObject);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export default handler;
