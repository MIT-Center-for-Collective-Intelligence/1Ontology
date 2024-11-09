import { collection, getDocs, getFirestore } from "firebase/firestore";
import { GUIDELINES, NODES } from "../firestoreClient/collections";
import { ICollection, INode } from " @components/types/INode";
import { Post } from "./Post";
import { PROPOSALS_SCHEMA } from "../CONSTANTS";
import { recordLogs } from "./helpers";

export const sendLLMRequest = async ({
  messages,
  model,
}: {
  messages: any;
  model: string;
}) => {
  try {
    const response = await Post("/copilot", {
      messages,
      model,
    });

    return response;
  } catch (error) {
    console.error("Error making request:", error);
    throw error;
  }
};

const proposerAgent = async (
  userMessage: string,
  model: string,
  nodesArray: any[],
  proposalsJSON: any = {},
  evaluation: string = ""
) => {
  try {
    const db = getFirestore();
    const guidelinesSnapshot = await getDocs(collection(db, GUIDELINES));
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
    recordLogs({
      type: "error",
      error: JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack,
      }),
      at: "recordLogs",
    });
  }
};

const getStructureForJSON = (data: INode, nodes: Record<string, INode>) => {
  const dataCopy = JSON.parse(JSON.stringify(data));
  const getTitles = (
    propertyValue: ICollection[]
  ): { [collectionName: string]: string[] } => {
    const propertyWithTitles: { [collectionName: string]: string[] } = {};

    for (let collection of propertyValue) {
      propertyWithTitles[collection.collectionName] = [];
      for (let node of collection.nodes) {
        if (nodes[node.id]) {
          propertyWithTitles[collection.collectionName].push(
            nodes[node.id].title
          );
        }
      }
    }
    return propertyWithTitles;
  };

  const { properties } = dataCopy;
  for (let property in properties) {
    if (
      property in dataCopy.inheritance &&
      dataCopy.inheritance[property].ref
    ) {
      delete properties[property];
    } else if (Array.isArray(properties[property])) {
      properties[property] = getTitles(properties[property]);
    }
  }

  return {
    title: dataCopy.title,
    nodeType: dataCopy.nodeType,
    generalizations: getTitles(dataCopy.generalizations),
    specializations: getTitles(dataCopy.specializations),
    ...properties,
  };
};

const getNodesInThreeLevels = (
  nodeData: any,
  nodes: Record<string, any>,
  visited: Set<string>,
  deepNumber: number,
  level: number = 0
): any[] => {
  const nodesArray: any[] = [];

  if (level === deepNumber) {
    return nodesArray;
  }
  const specializations = nodeData.specializations.flatMap(
    (c: ICollection) => c.nodes
  );
  const generalizations = nodeData.generalizations.flatMap(
    (c: ICollection) => c.nodes
  );
  const items = [];
  items.push(...specializations);
  items.push(...generalizations);
  for (let property in nodeData.properties) {
    if (Array.isArray(nodeData.properties[property])) {
      const propertyNodes = nodeData.properties[property].flatMap(
        (c: ICollection) => c.nodes
      );
      items.push(...propertyNodes);
    }
  }
  for (let item of items) {
    const itemData = nodes[item.id];
    if (itemData && !visited.has(itemData.title) && !itemData?.deleted) {
      const nodeD = getStructureForJSON(itemData, nodes);
      nodesArray.push(nodeD);
      visited.add(itemData.title);
      const p = getNodesInThreeLevels(
        itemData,
        nodes,
        visited,
        deepNumber,
        level + 1
      );
      if (Array.isArray(p)) {
        nodesArray.push(...p);
      }
    }
  }

  return nodesArray;
};

export const generateProposals = async (
  userMessage: string,
  model: string,
  deepNumber: number,
  currentNode: INode,
  nodes: Record<string, INode>,
  proposalsJSON: any = {},
  evaluation: string = ""
): Promise<any> => {
  const nodesArray: any = [];
  const currentNodeD = getStructureForJSON(currentNode, nodes);
  nodesArray.push(currentNodeD);
  const _nodesArray = getNodesInThreeLevels(
    currentNode,
    nodes,
    new Set(),
    deepNumber === 0 ? 7 : deepNumber
  );
  nodesArray.push(..._nodesArray);
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
