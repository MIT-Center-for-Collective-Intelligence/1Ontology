import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  where,
} from "firebase/firestore";
import { GUIDELINES, NODES } from "../firestoreClient/collections";
import { ICollection, INode } from " @components/types/INode";
import { Post } from "./Post";

export const sendLLMRequest = async ({
  model,
  messages,
}: {
  model: string;
  messages: any;
}) => {
  try {
    console.log({ model, messages });
    const response = Post("http://localhost:3001/api/sendOpenAIRequest", {
      model: model,
      messages,
    });
    return response;
  } catch (error) {
    console.error("Error making request:", error);
    throw error;
  }
};

const PROPOSALS_SCHEMA = `
Response Structure:
'''
Please carefully generate a JSON object with the following structure:
{
   "message": "A string message that you would send to the user in response to their message. This could include your analysis, questions, or explanations regarding the requested changes.",
   "improvements" : [], // An array of improvements to existing nodes.
   "new_nodes" : [], // An array of new nodes. Note that you should not propose a new node if a node with the same title already exists in the knowledge graph.
   "guidelines": [] // The array of improvements to the detailed and minimal guidelines.
}

For the "improvements" array:
Each item should represent an object that proposes an improvement to an existing node. Please structure each object as follows:
{
   "old_title": "The current title of the node.",
   "new_title": "The improved title of the node, if there is any room for improving its title, otherwise it should be the same as the old title.",
   "nodeType": "The type of the node, which could be either 'activity', 'actor', 'object', 'evaluationDimension', 'incentive', or 'reward'",
   "description": "The description of the node.",
   "specializations": [], // An array of objects, each representing a collection with the following structure: {"collectionName": "The title of the collection", "nodes": [An array of nodes that are specializations of the original node and are classified under this collection based on their shared characteristics. Each item in this array is a string representing the title of the specialization node.]}
   "generalizations": [], // An array of objects, each representing a collection with the following structure: {"collectionName": "The title of the collection", "nodes": [An array of nodes that are generalizations of the original node and are classified under this collection based on their shared characteristics. Each item in this array is a string representing the title of the generalization node.]}
   "parts": [], // An array of objects, each representing a collection with the following structure: {"collectionName": "The title of the collection", "nodes": [An array of nodes that are parts of the original node and are classified under this collection based on their shared characteristics. Each item in this array is a string representing the title of the part node.]}
   "isPartOf": [], // An array of objects, each representing a collection with the following structure: {"collectionName": "The title of the collection", "nodes": [An array of nodes that this node is a part of the original node and are classified under this collection based on their shared characteristics. Each item in this array is a string representing the title of the node that this node is a part of.]}
   // The following fields should only be included if "nodeType" is "activity":
   "actor": [], // An array of objects, each representing a collection with the following structure: {"collectionName": "The title of the collection", "nodes": [An array of nodes that are actors that perform the original activity node and are classified under this collection based on their shared characteristics. Each item in this array is a string representing the title of the actor node.]}
   "objects": [], // An array of objects, each representing a collection with the following structure: {"collectionName": "The title of the collection", "nodes": [An array of nodes that are objects that the original activity node is performed on and are classified under this collection based on their shared characteristics. Each item in this array is a string representing the title of the object node.]}
   "evaluationDimension": [], // An array of objects, each representing a collection with the following structure: {"collectionName": "The title of the collection", "nodes": [An array of nodes that are evaluation dimensions of the original node and are classified under this collection based on their shared characteristics. Each item in this array is a string representing the title of the evaluation dimension node.]}
   "postConditions": "The post-conditions of the activity.",
   "preConditions": "The pre-conditions of the activity.",
   "reasoning": "Your reasoning for making these improvements to the title, 'Types', 'IsTypeOf', ... of this node.",
   // The following fields should only be included if "nodeType" is "actor":
   "abilities": "The abilities of the actor.",
   "typeOfActor": "The type of actor.",
   // The following fields should only be included if "nodeType" is "group":
   "abilities": "The abilities of the actor.",
   "typeOfActor": "The type of actor.",
   "listOfIndividualsInGroup": "The list of individuals in the group.",
   "numberOfIndividualsInGroup": "The number of individuals in the group.",
   // The following fields should only be included if "nodeType" is "object":
   "size": "The size of the object.",
   "creator": "The creator of the object.",
   "creationDate": "The creation date of the object.",
   "LifeSpan": "The lifespan of the object.",
   "modifiability": "The modifiability of the object.",
   "perceivableProperties": "The perceivable properties of the object.",
   // The following fields should only be included if "nodeType" is "evaluationDimension":
   "criteriaForAcceptability": "The criteria for acceptability of the evaluation dimension.",
   "directionOfDesirability": "The direction of desirability of the evaluation dimension.",
   "evaluationType": "The evaluation type of the evaluation dimension.",
   "measurementUnits": "The measurement units of the evaluation dimension.",
   // The following fields should only be included if "nodeType" is "reward":
   "units": "The units of the reward.",
   // The following fields should only be included if "nodeType" is "incentive":
   "capabilitiesRequired": "The capabilities required for the incentive.",
   "rewardFunction": "The reward function of the incentive.",
   "evaluationDimension": [], // An array of objects, each representing a collection with the following structure: {"collectionName": "The title of the collection", "nodes": [An array of nodes that are evaluation dimensions of the original incentive node and are classified under this collection based on their shared characteristics. Each item in this array is a string representing the title of the evaluation dimension node.]}
   "reward": [] // An array of objects, each representing a collection with the following structure: {"collectionName": "The title of the collection", "nodes": [An array of nodes that are rewards of the original incentive node and are classified under this collection based on their shared characteristics. Each item in this array is a string representing the title of the reward node.]}
}

Please do not propose the creation of any new node under "specializations" or "generalizations" in an improvement object. New nodes should only be proposed under the "new_nodes" array.

For the "new_nodes" array:
Each item should represent an object proposing a new node. Please structure each object as follows:
{
   "title": "The title of the new node.",
   "description": "The description of the node.",
   "first_generalization": {}, // An object, including the node title that you would like to specify as the first generalization of this new node, and the collection in the array of specializations of this generalization, where the new node should be classified under.
   "reasoning": "Your reasoning for proposing this new node"
}

For the "guidelines" array:
Each item should represent a category as an object. Please structure each object as follows:
{
    "category": "The category of the guideline.",
    "additions": [], // Aan array of guidelines that should be added to this category.
    "removals": [], // A array of guidelines that should be removed from this category.
    "modifications": [], // An array of objects each representing a guideline that should be modified in this category. Each object should have the following structure: {"old_guideline": "The current guideline", "new_guideline": "The improved guideline"}
    "reasoning": "Your reasoning for making these changes to the guidelines in this category."
}
'''
`;

const proposerAgent = async (
  userMessage: string,
  nodesArray: any[],
  proposalsJSON: any = {},
  evaluation: string = ""
) => {
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
  const completion: any = await sendLLMRequest({
    model: "o1-preview",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  proposalsJSON = completion.choices[0].message.content;
  console.log(proposalsJSON);
  console.log(JSON.stringify(proposalsJSON, null, 2));
  return { proposalsJSON };
};

const getStructureForJSON = (data: any, nodeTitles: any) => {
  const getTitles = (propertyValue: ICollection[]) => {
    const propertyWithTitles: { [collectionName: string]: string[] } = {};
    for (let collection of propertyValue) {
      propertyWithTitles[collection.collectionName] = [];
      for (let node of collection.nodes) {
        propertyWithTitles[collection.collectionName].push(nodeTitles[node.id]);
      }
    }
    return propertyWithTitles;
  };

  const { properties } = data;
  for (let property in properties) {
    if (property in data.inheritance && data.inheritance[property].ref) {
      delete properties[property];
    } else if (typeof properties[property] !== "string") {
      properties[property] = getTitles(properties[property]);
    }
  }
  return {
    title: data.title,
    nodeType: data.nodeType,
    generalizations: getTitles(data.generalizations),
    specializations: getTitles(data.specializations),
    ...properties,
  };
};

const getNodesInThreeLevels = async (
  nodeData: any,
  nodes: Record<string, any>,
  nodesArray: any[],
  nodeTitles: any,
  level: number = 0
) => {
  const db = getFirestore();
  if (level === 4) {
    return;
  }
  for (let _collection of nodeData.specializations) {
    for (let specializationObj of _collection.nodes) {
      const nodeDoc = await getDoc(
        doc(collection(db, NODES), specializationObj.id)
      );
      const nodeData1 = nodeDoc.data() as INode;

      if (!nodeData1.deleted && !(nodeData1.title in nodes)) {
        const nodeD = getStructureForJSON(nodeData1, nodeTitles);
        nodesArray.push(nodeD);
        nodes[nodeData1.title] = {
          id: nodeDoc.id,
          ...nodeD,
        };
        await getNodesInThreeLevels(
          nodeData1,
          nodes,
          nodesArray,
          nodeTitles,
          level + 1
        );
      }
    }
  }
  for (let _collection of nodeData.generalizations) {
    for (let generalizationObj of _collection.nodes) {
      const nodeDoc = await getDoc(
        doc(collection(db, NODES), generalizationObj.id)
      );
      const nodeData1 = nodeDoc.data() as INode;
      if (!nodeData1.deleted && !(nodeData1.title in nodes)) {
        const nodeD = getStructureForJSON(nodeData1, nodeTitles);
        nodesArray.push(nodeD);
        nodes[nodeData1.title] = {
          id: nodeDoc.id,
          ...nodeD,
        };
        await getNodesInThreeLevels(
          nodeData1,
          nodes,
          nodesArray,
          nodeTitles,
          level + 1
        );
      }
    }
  }
  for (let property in nodeData.properties) {
    if (Array.isArray(nodeData.properties[property])) {
      for (let _collection of nodeData.properties[property]) {
        for (let itemObj of _collection.nodes) {
          const nodeDoc = await getDoc(doc(collection(db, NODES), itemObj.id));
          const nodeData1 = nodeDoc.data() as INode;
          if (!nodeData1.deleted && !(nodeData1.title in nodes)) {
            const nodeD = getStructureForJSON(nodeData1, nodeTitles);
            nodesArray.push(nodeD);
            nodes[nodeData1.title] = {
              id: nodeDoc.id,
              ...nodeD,
            };
            await getNodesInThreeLevels(
              nodeData1,
              nodes,
              nodesArray,
              nodeTitles,
              level + 1
            );
          }
        }
      }
    }
  }
};

export const generateProposals = async (
  userMessage: string,
  nodeTitle: string,
  proposalsJSON: any = {},
  evaluation: string = ""
) => {
  const db = getFirestore();
  const nodes: Record<string, any> = {};
  const nodesArray = [];
  const allNodesDocs = await getDocs(
    query(collection(db, NODES), where("deleted", "==", false))
  );

  const nodeTitles: any = {};
  for (let nodeDoc of allNodesDocs.docs) {
    const nodeData = nodeDoc.data();
    nodeTitles[nodeData.id] = nodeData.title;
  }

  const nodeDocs = await getDocs(
    query(collection(db, NODES), where("title", "==", nodeTitle))
  );

  for (let nodeDoc of nodeDocs.docs) {
    let nodeData = nodeDoc.data();
    if (!nodeData.deleted) {
      let nodeD = getStructureForJSON(nodeData, nodeTitles);
      nodesArray.push(nodeD);
      nodes[nodeData.title] = {
        id: nodeDoc.id,
        ...nodeD,
      };
      await getNodesInThreeLevels(nodeData, nodes, nodesArray, nodeTitles);
    }
  }
  console.log(nodesArray.length + " nodes retrieved.");

  if (nodesArray.length === 0) {
    console.log("No related nodes found!");
  } else {
    console.log("Related Nodes:");
    console.log(JSON.stringify(nodesArray, null, 2));
    if (evaluation) {
      return await proposerAgent(
        userMessage,
        nodesArray,
        proposalsJSON,
        evaluation
      );
    } else {
      return await proposerAgent(userMessage, nodesArray);
    }
  }
};
