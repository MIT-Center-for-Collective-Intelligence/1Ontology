import { NextApiRequest, NextApiResponse } from "next";
import { OpenAI } from "openai";
import { askGemini, openai } from "./helpers";
import { Content } from "@google/generative-ai";

import {
  COPILOT_PROMPTS,
  GUIDELINES,
  LOGS,
  NODES,
} from " @components/lib/firestoreClient/collections";
import { db } from " @components/lib/firestoreServer/admin";
import {
  getNodesInThreeLevels,
  getStructureForJSON,
} from " @components/lib/utils/helpersCopilot";
import { INode } from " @components/types/INode";
import fbAuth from " @components/middlewares/fbAuth";
import { extractJSON, getDoerCreate } from " @components/lib/utils/helpers";
import {
  copilotNewNode,
  getCopilotPrompt,
  Improvement,
  MODELS_OPTIONS,
  PROPOSALS_SCHEMA,
} from " @components/lib/utils/copilotPrompts";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { ChatModel } from "openai/resources/chat/chat";
import { PROPERTIES_TO_IMPROVE } from " @components/lib/CONSTANTS";

const GEMINI_MODELS = [
  "gemini-2.0-flash-exp",
  "gemini-2.0-flash-thinking-exp",
  "gemini-exp-1206",
];

type GeminiModels =
  | "gemini-2.0-flash-exp"
  | "gemini-2.0-flash-thinking-exp"
  | "gemini-exp-1206";

export const recordLogs = async (
  logs: { [key: string]: any },
  uname: string,
) => {
  try {
    if (uname === "ouhrac") return;
    const logRef = db.collection(LOGS).doc();
    const doerCreate = getDoerCreate(uname || "");
    await logRef.set({
      type: "info",
      ...logs,
      createdAt: new Date(),
      doer: uname,
      doerCreate,
    });
  } catch (error) {
    console.error(error);
  }
};

const saveLogs = (
  uname: string,
  type: "info" | "error",
  logs: { [key: string]: any },
) => {
  try {
    const logRef = db.collection(LOGS).doc();
    logRef.set({
      type,
      ...logs,
      createdAt: new Date(),
      doer: uname,
      doerCreate: getDoerCreate(uname),
    });
  } catch (error) {
    console.error(error);
  }
};

const sendLLMRequest = async ({
  prompt,
  model = process.env.MODEL as ChatModel | GeminiModels,
  uname,
}: {
  prompt: string;
  model: ChatModel | GeminiModels;
  uname: string;
}) => {
  try {
    if (!prompt.trim() || !model.trim()) {
      throw new Error("Prompt and model are required");
    }
    if (GEMINI_MODELS.includes(model)) {
      const contents: Content[] = [];

      contents.push({
        role: "user",
        parts: [
          {
            text: prompt,
          },
        ],
      });

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
        const messages: Array<ChatCompletionMessageParam> = [
          {
            role: "user",
            content: prompt,
          },
        ];

        const completion = await openai.chat.completions.create({
          messages,
          model,
          temperature,
        });

        const response = completion.choices[0].message.content;

        isJSONObject = extractJSON(response || "");
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
    if (!isJSONObject.isJSON) {
      throw new Error("Failed to get a complete JSON object");
    }
    return isJSONObject.jsonObject;
  } catch (error: any) {
    saveLogs(uname, "info", {
      type: "error",
      error: JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack,
      }),
      at: "sendLLMRequest",
    });
  }
};
let guidelines: any = null;
const proposerAgent = async (
  userMessage: string,
  model: ChatModel | GeminiModels,
  nodesArray: any[],
  uname: string,
  SYSTEM_PROMPT: string,
  proposalsJSON: any = {},
  evaluation: string = "",
) => {
  try {
    if (!guidelines) {
      const guidelinesSnapshot = await db.collection(GUIDELINES).get();
      guidelines = guidelinesSnapshot.docs
        .map((doc) => doc.data())
        .sort((a, b) => a.index - b.index);
    }

    let prompt = `
${SYSTEM_PROMPT}
Guidelines:
'''
${JSON.stringify(guidelines, null, 2)}
'''

Ontology Data:
'''
${JSON.stringify(nodesArray, null, 2)}
'''

User Message:
'''
${userMessage}
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
    prompt +=
      "Please only generate no more than 10 improvements and 10 new nodes";

    // proposalsJSON = await callOpenAIChat([], prompt);
    // proposalsJSON = await askGemini([], prompt);

    const response: {
      improvements: Improvement[];
      new_nodes: copilotNewNode[];
    } = await sendLLMRequest({
      prompt,
      model,
      uname,
    });

    return response;
  } catch (error: any) {
    console.error(error);
    recordLogs(
      {
        type: "error",
        error: JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
        at: "proposerAgent",
      },
      uname,
    );
  }
};

export const getNodes = async (): Promise<Record<string, INode>> => {
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
  model: ChatModel | GeminiModels,
  deepNumber: number,
  nodeId: string,
  uname: string,
  SYSTEM_PROMPT: string,
  inputProperties: Set<string>,
  proposalsJSON: any = {},
  evaluation: string = "",
): Promise<any> => {
  const nodesArray: any = [];
  const nodes = await getNodes();
  if (!nodes[nodeId]) {
    throw new Error("Node doesn't exist");
  }
  const currentNode = nodes[nodeId];
  /*   if (currentNode.nodeType !== "activity") {
    throw new Error("Node type not supported yet!");
  } */
  const currentNodeD = getStructureForJSON(currentNode, nodes);
  nodesArray.push(currentNodeD);
  const _nodesArray = getNodesInThreeLevels(
    currentNode,
    nodes,
    new Set(),
    deepNumber === 0 ? 7 : deepNumber,
    inputProperties,
  );
  nodesArray.push(..._nodesArray);
  if (
    nodesArray &&
    inputProperties.size !==
      PROPERTIES_TO_IMPROVE[currentNode.nodeType].length +
        PROPERTIES_TO_IMPROVE["allTypes"].length
  ) {
    for (let node of nodesArray) {
      for (let property in node) {
        if (!inputProperties.has(property) && property !== "nodeType") {
          delete node[property];
        }
      }
    }
  }
  if (nodesArray.length === 0) {
    // "No related nodes found!"
  } else {
    // "Related Nodes:"
    if (evaluation) {
      return await proposerAgent(
        userMessage,
        model,
        nodesArray,
        uname,
        SYSTEM_PROMPT,
        proposalsJSON,
        evaluation,
      );
    } else {
      return await proposerAgent(
        userMessage,
        model,
        nodesArray,
        uname,
        SYSTEM_PROMPT,
      );
    }
  }
};
// const RESPONSE = {
//   message:
//     "After carefully analyzing the ontology, I have identified several improvements to better organize the specializations and parts of the nodes, as well as a few new nodes that can enhance the clarity and structure of the ontology.",
//   improvements: [
//     {
//       title: "NodeA",
//       nodeType: "activity",
//       change: {
//         modified_property: "generalizations",
//         new_value: {
//           nodes_to_add: ["Node6"],
//           nodes_to_delete: ["Gate Arrival"],
//           final_array: ["Node6"],
//         },
//         reasoning:
//           "The activity 'Define key performance indicators (KPIs)' is an integral part of 'Measure organizational performance' and should be classified under it instead of 'Unclassified'.",
//       },
//     },
//   ],
//   new_nodes: [],
// };

const getPrompt = async (
  uname: string,
  generateNewNodes: boolean,
  improveProperties: string[],
  proposeDeleteNode: boolean,
) => {
  let promptDoc = await db.collection("copilotPrompts").doc(uname).get();
  if (!promptDoc.exists) {
    promptDoc = await db.collection("copilotPrompts").doc("1man").get();
  }
  let prompt = "";
  if (promptDoc.exists) {
    const promptData = promptDoc.data() as {
      systemPrompt: {
        id: string;
        value?: string;
        editablePart?: string;
        endClose?: string;
        newNode?: boolean;
        improvement?: boolean;
      }[];
    };

    let objective = promptData.systemPrompt[0].editablePart as string;
    let definition = promptData.systemPrompt[1].editablePart as string;
    prompt = getCopilotPrompt({
      improvement: improveProperties.length > 0,
      newNodes: generateNewNodes,
      improveProperties: new Set(improveProperties),
      editedPart: { objective, definition },
      proposeDeleteNode,
    });
    return prompt;
  } else {
    throw new Error("System prompt missing!");
  }
};

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  const {
    userMessage,
    model,
    deepNumber,
    nodeId,
    user,
    generateNewNodes,
    improveProperties,
    proposeDeleteNode,
    inputProperties,
  } = req.body.data;

  const { uname } = user?.userData;
  try {
    const logDoc = await db
      .collection("logs")
      .doc("LJXgQ3lh7YBvzjWQYdh6")
      .get();

    const logData: any = logDoc.data();
    if (!logData.deleted) {
      return res.status(200).send(logData.response);
    }

    const model_index = MODELS_OPTIONS.findIndex(
      (option) => option.id === model,
    );
    if (!user?.userData || model_index === -1) {
      throw new Error("Access forbidden");
    }

    const SYSTEM_PROMPT = await getPrompt(
      uname,
      generateNewNodes,
      improveProperties,
      proposeDeleteNode,
    );

    const response = await generateProposals(
      userMessage,
      model,
      deepNumber,
      nodeId,
      uname,
      SYSTEM_PROMPT,
      new Set(inputProperties),
    );
    saveLogs(uname, "info", {
      response,
      nodeId,
      model,
      userMessage,
      deepNumber,
      at: "copilot",
    });
    const improvements: Improvement[] = [];
    for (let improvement of response?.improvements || []) {
      for (let change of improvement.changes) {
        improvements.push({
          ...improvement,
          change,
          changes: [],
        });
      }
    }
    if (!response.new_nodes) {
      response.new_nodes = [];
    }
    if (!response.delete_nodes) response.delete_nodes = [];

    return res.status(200).send(response);
  } catch (error: any) {
    console.error("error", error);
    recordLogs(
      {
        type: "error",
        error: JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
        at: "copilot",
      },
      uname,
    );
    return res.status(500).json({ error: error.message });
  }
}

export default fbAuth(handler);
