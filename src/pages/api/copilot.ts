import { NextApiRequest, NextApiResponse } from "next";
import {
  askGemini,
  searchChromaCore,
  askGeminiWithFunctionCalling,
} from "./helpers";
import { Content } from "@google/generative-ai";

import {
  COPILOT_PROMPTS,
  GUIDELINES,
  LOGS,
  NODES,
} from "@components/lib/firestoreClient/collections";
import { FieldPath } from "firebase-admin/firestore";
import { db } from "@components/lib/firestoreServer/admin";
import {
  getNodesInThreeLevels,
  getStructureForJSON,
} from "@components/lib/utils/helpersCopilot";
import { INode } from "@components/types/INode";
import fbAuth from "@components/middlewares/fbAuth";
import { extractJSON, getDoerCreate } from "@components/lib/utils/helpers";
import {
  copilotNewNode,
  getCopilotPrompt,
  Improvement,
  MODELS_OPTIONS,
} from "@components/lib/utils/copilotPrompts";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { ChatModel } from "openai/resources/chat/chat";
import { PROPERTIES_TO_IMPROVE } from "@components/lib/CONSTANTS";
import {
  getMainPromptAIPeerReviewer,
  getSystemPrompt,
} from "@components/lib/aiAssitantConstants";
import { openai } from "./openaiClient";

const GEMINI_MODELS = [
  "gemini-3.1-pro-preview",
  "gemini-2.0-flash-exp",
  "gemini-2.0-flash-thinking-exp",
  "gemini-exp-1206",
  "gemini-2.5-pro",
];

type GeminiModels =
  | "gemini-3.1-pro-preview"
  | "gemini-2.0-flash-exp"
  | "gemini-2.0-flash-thinking-exp"
  | "gemini-2.5-pro"
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
  appName,
  useFunctionCalling = false,
  inputProperties,
}: {
  prompt: string;
  model: ChatModel | GeminiModels;
  uname: string;
  appName?: string;
  useFunctionCalling?: boolean;
  inputProperties?: string[];
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

      if (useFunctionCalling) {
        const response = await askGeminiWithFunctionCalling({
          contents,
          model,
          appName,
          inputProperties,
        });
        return response;
      }

      const response = await askGemini(contents, model);
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
    console.log("error", error);
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
    const guidelinesSnapshot = await db.collection(GUIDELINES).get();
    const guidelines = guidelinesSnapshot.docs
      .map((doc) => {
        const nodeData = doc.data();
        delete nodeData.id;
        delete nodeData.index;
        return nodeData;
      })
      .sort((a, b) => a.index - b.index);

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

    return { response, prompt };
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

export const getNodes = async (
  skillsFutureApp: string,
): Promise<Record<string, INode>> => {
  const noneDeletedNodes = await (skillsFutureApp
    ? db
        .collection(NODES)
        .where("deleted", "==", false)
        .where("appName", "==", skillsFutureApp)
        .get()
    : db.collection(NODES).where("deleted", "==", false).get());
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
  skillsFutureApp: string,
  proposalsJSON: any = {},
  evaluation: string = "",
): Promise<any> => {
  const nodesArray: any = [];
  const nodes = await getNodes(skillsFutureApp);
  if (!nodes[nodeId]) {
    throw new Error("Node doesn't exist");
  }
  const currentNode = nodes[nodeId];
  /*   if (currentNode.nodeType !== "activity") {
    throw new Error("Node type not supported yet!");
  } */

  for (let nodeId in nodes) {
    nodesArray.push(getStructureForJSON(nodes[nodeId], nodes));
  }
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
      const proposals = await proposerAgent(
        userMessage,
        model,
        nodesArray,
        uname,
        SYSTEM_PROMPT,
        proposalsJSON,
        evaluation,
      );
      return { ...proposals, nodesArray };
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

const _generateProposals = async ({
  subOntology,
  task,
  actors,
  mainPrompt,
  uname,
  appName,
  inputProperties,
}: {
  subOntology: any;
  task: string;
  actors: string[];
  mainPrompt: string;
  uname: string;
  appName?: string;
  inputProperties?: string[];
}) => {
  try {
    let approved = false;
    let taskImprovements = null;
    while (!approved) {
      const response: any = await sendLLMRequest({
        prompt: mainPrompt,
        model: "gemini-2.5-pro",
        uname,
        appName,
        useFunctionCalling: true,
        inputProperties,
      });

      const reviewerPrompt = getMainPromptAIPeerReviewer({
        subOntology,
        task,
        actors,
        response,
      });
      // const reviewerResponse: any = await sendLLMRequest({
      //   prompt: reviewerPrompt,
      //   model: process.env.MODEL as ChatModel,
      //   uname,
      // });
      if (true) {
        approved = true;
        taskImprovements = response;
      }
    }
    return taskImprovements;
  } catch (error) {
    return;
  }
};

/**
 * Parses nodeIds from a string (comma- or space-separated) into an array of trimmed non-empty ids.
 * @param nodeIdsStr - e.g. "id1,id2,id3" or "id1 id2 id3"
 * @returns Array of node id strings
 */
export function parseNodeIdsString(nodeIdsStr: string): string[] {
  if (!nodeIdsStr || typeof nodeIdsStr !== "string") return [];
  return nodeIdsStr
    .split(/[\s,]+/)
    .map((id) => id.trim())
    .filter(Boolean);
}

const FIRESTORE_IN_QUERY_LIMIT = 30;

/**
 * Fetches node data for the given node ids and returns nodes_ids (id -> full node data)
 * and nodes_titles (id -> title).
 * @param nodeIds - Set of node document ids
 * @returns { nodes_ids: Record<string, any>, nodes_titles: Record<string, string> }
 */
export async function getNodesByIds(nodeIds: Set<string>): Promise<{
  nodes_ids: Record<string, any>;
  nodes_titles: Record<string, string>;
}> {
  const nodes_ids: Record<string, any> = {};
  const nodes_titles: Record<string, string> = {};

  if (!nodeIds?.size) return { nodes_ids, nodes_titles };

  const ids = Array.from(nodeIds);

  for (let i = 0; i < ids.length; i += FIRESTORE_IN_QUERY_LIMIT) {
    const chunk = ids.slice(i, i + FIRESTORE_IN_QUERY_LIMIT);
    const snapshot = await db
      .collection(NODES)
      .where(
        FieldPath.documentId(),
        "in",
        chunk.map((id) => db.collection(NODES).doc(id)),
      )
      .get();

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const nodeData = { id: doc.id, ...data };
      nodes_ids[doc.id] = nodeData;
      if (data?.title != null) {
        nodes_titles[doc.id] = String(data.title);
      }
    });
  }

  return { nodes_ids, nodes_titles };
}

const loadAllNodesFlat = async ({
  exclusiveIds,
  nodes_ids,
  nodes_titles,
  appName,
  inputProperties,
}: {
  exclusiveIds: Set<string> | null;
  nodes_ids?: Record<string, any>;
  appName: string;
  nodes_titles?: Record<string, any>;
  inputProperties?: string[];
}) => {
  let nodesByIds: Record<string, any> = nodes_ids ? { ...nodes_ids } : {};
  let currentNodesTitles: Record<string, any> = nodes_titles
    ? { ...nodes_titles }
    : {};

  if (!nodes_ids) {
    const nodesDocs = await db
      .collection("nodes")
      .where("appName", "==", appName)
      .where("deleted", "==", false)
      .get();

    for (let nodeDoc of nodesDocs.docs) {
      nodesByIds[nodeDoc.id] = { id: nodeDoc.id, ...nodeDoc.data() };
      currentNodesTitles[nodeDoc.id] = nodeDoc.data().title;
    }
  }

  const resultNodes: any[] = [];
  const traverseNode = (nodeId: string, visited = new Set<string>()) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = nodesByIds[nodeId];
    if (!node) return;

    if (!exclusiveIds || exclusiveIds.has(nodeId)) {
      const nodeObj: any = { title: node.title };
      const inputPropsSet = inputProperties ? new Set(inputProperties) : null;

      if (!inputPropsSet || inputPropsSet.has("specializations")) {
        nodeObj.specializations = (node.specializations || []).flatMap(
          (col: any) =>
            (col.nodes || []).map((n: any) => currentNodesTitles[n.id] || n.id),
        );
      }
      if (!inputPropsSet || inputPropsSet.has("generalizations")) {
        nodeObj.generalizations = (node.generalizations?.[0]?.nodes || []).map(
          (n: any) => currentNodesTitles[n.id] || n.id,
        );
      }
      if (!inputPropsSet || inputPropsSet.has("parts")) {
        nodeObj.parts = (node.parts || []).map(
          (n: any) => currentNodesTitles[n.id] || n.id,
        );
      }
      if (!inputPropsSet || inputPropsSet.has("isPartOf")) {
        nodeObj.isPartOf = (node.isPartOf || []).map(
          (n: any) => currentNodesTitles[n.id] || n.id,
        );
      }

      resultNodes.push(nodeObj);
    }
  };

  if (exclusiveIds && exclusiveIds.size > 0) {
    for (let nodeId of exclusiveIds) {
      traverseNode(nodeId);
    }
  }
  return resultNodes;
};

const getSubOntology = async ({
  appName,
  task,
  hops,
  inputProperties,
}: {
  appName: string;
  task: string;
  hops: number;
  inputProperties?: string[];
}): Promise<any> => {
  try {
    const searchResults = await searchChromaCore({
      query: task,
      resultsNum: 100,
      appName,
      nodeType: "activity",
      inputProperties,
    });

    let required_ids: string[] = [];
    if (searchResults) {
      required_ids.push(
        ...searchResults.flatMap((c) => (c != null && c.id ? [c.id] : [])),
      );
    }

    const all_related_nodes = new Set(required_ids);
    const { nodes_ids, nodes_titles } = await getNodesByIds(all_related_nodes);
    const ontology_object = await loadAllNodesFlat({
      exclusiveIds: new Set(required_ids),
      nodes_ids,
      nodes_titles,
      appName,
      inputProperties,
    });

    return ontology_object;
  } catch (error) {
    console.error(error);
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
    skillsFutureApp,
  } = req.body.data;

  const { uname } = user?.userData;
  try {
    const model_index = MODELS_OPTIONS.findIndex(
      (option) => option.id === model,
    );
    if (!user?.userData || model_index === -1) {
      throw new Error("Access forbidden");
    }
    const nodeDoc = await db.collection("nodes").doc(nodeId).get();
    const nodeData = nodeDoc.data();
    if (!nodeDoc.exists || !nodeData || !nodeData?.title) {
      throw new Error("Node not found, or missing title");
    }
    const task = nodeData?.title;
    const subOntology = await getSubOntology({
      appName: skillsFutureApp,
      task,
      hops: deepNumber || 4,
      inputProperties: inputProperties || [],
    });
    const actors: string[] = [];
    const SYSTEM_PROMPT = getSystemPrompt(
      nodeData?.title || "",
      actors,
      subOntology,
    );
    const generatedProposals = await _generateProposals({
      subOntology,
      task,
      actors,
      mainPrompt: SYSTEM_PROMPT,
      uname,
      appName: skillsFutureApp,
      inputProperties,
    });


    await db.collection("copilotResponses").doc().set({
      nodeId,
      model,
      generatedProposals,
      createdAt: new Date(),
    });

    return res.status(200).json(generatedProposals);
    // const changes = generatedProposals.response;
    // const nodes_array = generatedProposals.nodes_array;
    // const prompt = generatedProposals.prompt;

    // saveLogs(uname, "info", {
    //   changes,
    //   nodes_array,
    //   prompt,
    //   nodeId,
    //   model,
    //   userMessage,
    //   deepNumber,
    //   SYSTEM_PROMPT,
    //   at: "copilot",
    // });

    // const filteredImprovements = [];

    // for (let improvement of changes?.improvements || []) {
    //   if (improvement.title.toLowerCase() === "unclassified") {
    //     continue;
    //   }
    //   const propertyCount: { [prop: string]: number } = {};

    //   for (let change of improvement.changes) {
    //     const prop = change.modified_property;
    //     propertyCount[prop] = (propertyCount[prop] || 0) + 1;
    //   }

    //   const hasDuplicatePropertyChange = Object.values(propertyCount).some(
    //     (count) => count > 1,
    //   );
    //   if (hasDuplicatePropertyChange) continue;

    //   for (let change of improvement.changes) {
    //     filteredImprovements.push({
    //       ...improvement,
    //       change,
    //     });
    //   }
    // }
    // if (!changes?.new_nodes) {
    //   changes.new_nodes = [];
    // }
    // if (!changes?.delete_nodes) changes.delete_nodes = [];
    // changes.improvements = filteredImprovements;
    // return res.status(200).send(changes);
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
