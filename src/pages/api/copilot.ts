import { NextApiRequest, NextApiResponse } from "next";
import { OpenAI } from "openai";
import { askGemini } from "./helpers";
import { Content } from "@google/generative-ai";
import { PROPOSALS_SCHEMA } from " @components/lib/CONSTANTS";
import {
  GUIDELINES,
  NODES,
} from " @components/lib/firestoreClient/collections";
import { db } from " @components/lib/firestoreServer/admin";
import {
  getNodesInThreeLevels,
  getStructureForJSON,
} from " @components/lib/utils/helpersCopilot";
import { INode } from " @components/types/INode";

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
const sendLLMRequest = async ({ messages, model }: any) => {
  if (messages.length <= 0) {
    throw new Error("Prompt is required");
  }
  if (model === "Gemini 1.5 PRO") {
    const contents: Content[] = [];
    for (let message of messages) {
      contents.push({
        role: "user",
        parts: [
          {
            text: message.content,
          },
        ],
      });
    }
    const response = await askGemini(contents);

    return response;
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
  return isJSONObject.jsonObject;
};

const proposerAgent = async (
  userMessage: string,
  model: string,
  nodesArray: any[],
  proposalsJSON: any = {},
  evaluation: string = ""
) => {
  try {
    const guidelinesSnapshot = await db.collection(GUIDELINES).get();

    const guidelines = guidelinesSnapshot.docs
      .map((doc) => doc.data())
      .sort((a, b) => a.index - b.index);

    let prompt = `
Objective:
'''
Carefully improving and expanding the knowledge graph.
'''

User Message:
'''
${userMessage}
'''

The knowledge Graph:
'''
${JSON.stringify(nodesArray, null, 2)}
'''

${PROPOSALS_SCHEMA}

Guidelines:
'''
${JSON.stringify(guidelines, null, 2)}
'''
`;
    if (
      evaluation === "reject" &&
      (proposalsJSON?.improvements?.length > 0 ||
        proposalsJSON?.new_nodes?.length > 0 ||
        proposalsJSON?.guidelines?.length > 0)
    ) {
      prompt +=
        "\nYou previously generated the following proposal, but some of them got rejected with the reasoning detailed below:\n" +
        JSON.stringify(proposalsJSON, null, 2) +
        "\n\nPlease generate a new JSON object by improving upon your previous proposal.";
    }
    prompt +=
      "\n\nPlease take your time and carefully respond a well-structured JSON object.\n" +
      "For every helpful proposal, we will pay you $100 and for every unhelpful one, you'll lose $100.";

    // proposalsJSON = await callOpenAIChat([], prompt);
    // proposalsJSON = await askGemini([], prompt);
    console.log(prompt);

    const response: any = await sendLLMRequest({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model,
    });

    return response;
  } catch (error: any) {
    console.error(error);
    // recordLogs({
    //   type: "error",
    //   error: JSON.stringify({
    //     name: error.name,
    //     message: error.message,
    //     stack: error.stack,
    //   }),
    //   at: "recordLogs",
    // });
  }
};

const getNodes = async (): Promise<Record<string, INode>> => {
  const noneDeletedNodes = await db
    .collection(NODES)
    .where("deleted", "==", false)
    .get();
  const nodes: Record<string, INode> = {};
  noneDeletedNodes.docs.forEach((doc) => {
    const data = doc.data() as INode;
    nodes[doc.id] = data;
  });
  return nodes;
};

export const generateProposals = async (
  userMessage: string,
  model: string,
  deepNumber: number,
  nodeId: string,
  proposalsJSON: any = {},
  evaluation: string = ""
): Promise<any> => {
  const nodesArray: any = [];
  const nodes = await getNodes();
  if (!nodes[nodeId]) {
    throw new Error("Node doesn't exist");
  }
  const currentNode = nodes[nodeId];

  const currentNodeD = getStructureForJSON(currentNode, nodes);
  nodesArray.push(currentNodeD);
  const _nodesArray = getNodesInThreeLevels(
    currentNode,
    nodes,
    new Set(),
    deepNumber === 0 ? 7 : deepNumber
  );
  nodesArray.push(..._nodesArray);
  console.log("nodesArray", nodesArray);

  if (nodesArray.length === 0) {
    // "No related nodes found!"
  } else {
    // "Related Nodes:"
    if (evaluation) {
      return await proposerAgent(
        userMessage,
        model,
        nodesArray,
        proposalsJSON,
        evaluation
      );
    } else {
      return await proposerAgent(userMessage, model, nodesArray);
    }
  }
};

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    const { userMessage, model, deepNumber, nodeId } = req.body;
    console.log(" userMessage, model, deepNumber, nodeId", {
      userMessage,
      model,
      deepNumber,
      nodeId,
    });

    const response = await generateProposals(
      userMessage,
      model,
      deepNumber,
      nodeId
    );

    console.log("Response: ", JSON.stringify(response, null, 2));
    return res.status(200).send(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export default handler;
