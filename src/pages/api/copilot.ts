import { NextApiRequest, NextApiResponse } from "next";
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.MIT_CCI_API_KEY,
  organization: process.env.MIT_CCI_API_ORG_ID,
});

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    const { messages } = req.body;
    const response = await openai.chat.completions.create({
      messages,
      model: "gpt-4o",
      temperature: 1,
    });

    return res.status(200).send(response);
  } catch (error) {
    console.error(error);
    return res.status(500).send({
      error: true,
    } as any);
  }
}

export default handler;
