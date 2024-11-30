import { Post } from "./Post";
import { recordLogs } from "./helpers";

export const sendLLMRequest = async (
  userMessage: string,
  model: string,
  deepNumber: number,
  nodeId: string,
  generateNewNodes: boolean,
  generateImprovement: boolean
) => {
  try {
    const response = await Post("/copilot", {
      userMessage,
      model,
      deepNumber,
      nodeId,
      generateNewNodes,
      generateImprovement,
    });
    recordLogs({
      reason: "sendLLMRequest",
      response,
    });
    return response;
  } catch (error) {
    console.error("Error making request:", error);
    throw error;
  }
};

export type copilotNewNode = {
  title: string;
  description: string;
  generalizations: string[];
  parts: string[];
  isPartOf: string[];
  nodeType:
    | "activity"
    | "actor"
    | "group"
    | "object"
    | "evaluationDimension"
    | "reward"
    | "incentive";
  actor?: string[];
  objectsActedOn?: string[];
  evaluationDimension?: string[];
  postConditions?: string;
  preConditions?: string;
  abilities?: string;
  typeOfActor?: string;
  listOfIndividualsInGroup?: string;
  numberOfIndividualsInGroup?: number;
  lifeSpan?: string;
  modifiability?: string;
  perceivableProperties?: string;
  criteriaForAcceptability?: string;
  directionOfDesirability?: string;
  evaluationType?: string;
  measurementUnits?: string;
  units?: string;
  capabilitiesRequired?: string;
  rewardFunction?: string;
  reward?: string[];
  reasoning?: string;
};
export type IChange =
  | {
      modified_property: string;
      new_value: string;
      reasoning: string;
    }
  | {
      modified_property: "specializations";
      new_value: Array<{
        collectionName: string;
        collection_changes: {
          nodes_to_add: string[];
          nodes_to_delete: string[];
          final_array: string[];
        };
      }>;
      reasoning: string;
    }
  | {
      modified_property: string;
      new_value: {
        nodes_to_add: string[];
        nodes_to_delete: string[];
        final_array: string[];
      };
    }
  | {
      modified_property: "postConditions" | "preConditions";
      new_value: {
        conditions_to_add: string[];
        conditions_to_delete: string[];
        final_array: string[];
      };
      reasoning: string;
    };

export type Improvement = {
  title: string;
  nodeType:
    | "activity"
    | "actor"
    | "object"
    | "evaluationDimension"
    | "incentive"
    | "reward"
    | "context";
  changes: Array<IChange>;
  change?: IChange;
};

export const PROPOSALS_SCHEMA = `
Response Structure:
'''
Please carefully generate a JSON object with the following structure:
{
   "message": "A string message that you would send to the user in response to their message. This could include your analysis, questions, or explanations regarding the requested changes.",
   "improvements": [], // An array of improvements to existing nodes.
   "new_nodes": [] // An array of new nodes. Note that you should not propose a new node if a node with the same meaning already exists in the ontology, even if their titles are different.
}

For the "improvements" array:
Each item should represent an object that proposes an improvement to an existing node. Please structure each object as follows:
{
   "title": "The current title of the node.",
   "nodeType": "The type of the node, which could be 'activity', 'actor', 'object', 'evaluationDimension', 'incentive', 'reward', or 'context'.",
   "changes": [] // An array of objects, each representing a change to a single property of the node that requires modification.

   Each change object should include the necessary fields for the property being changed and a "reasoning" field explaining your reasoning for proposing this change.

   - For "title" changes:
     {
       "modified_property": "title",
       "new_value": "The improved title of the node.",
       "reasoning": "Your reasoning for proposing this change to the title of the node."
     },

   - For "description" changes:
     {
       "modified_property": "description",
       "new_value": "The improved title of the node.",
       "reasoning": "Your reasoning for proposing this change to the description of the node."
     },

     - For "specializations" changes:
     {
       "specializations": "specializations": [], // "Specializations" of a node are nodes that are specific types of that node. Example: Specializations of the node "Buy" can be classified into the following collections: 1- "Buy what?", including specializations such as "Buy fuel", "Buy parts", "Buy services", and "Buy information". 2- "Buy how?", including specializations such as "Buy online" and "Buy in person". 3- "Buy by whom?" including specializations such as: "Buy by marine operations company". The value of this field should be an array of objects, each representing a collection with the following structure: 
       {
         "collectionName": "The title of the collection",
         "changes": {
           "nodes_to_add": [An array of titles (as strings) of nodes to add to this collection.],
           "nodes_to_delete": [An array of titles (as strings) of nodes to remove from this collection.],
           "final_array": [An array of titles (as strings) representing the final set of nodes in this collection after additions and deletions.]
         },
         "reasoning": "Your reasoning for proposing this change to the specializations of the node."
       }
     },

   - For "generalizations" changes:
     {
       "modified_property": "generalizations",
        "new_value": {
         "nodes_to_add": [An array of titles (as strings) of nodes to add to generalizations.],
         "nodes_to_delete": [An array of titles (as strings) of nodes to remove from the generalizations.],
         "final_array": [An array of titles (as strings) of nodes representing the final state of the property after additions and deletions.]
       },
        "reasoning": "Your reasoning for proposing this change to the specializations of the node."
       }
     },

   - For other array property changes (other than "specializations" and "generalizations"), each change object should have the following properties:
     {
       "modified_property": "[PROPERTY_NAME]",
       "new_value": {
         "nodes_to_add": [An array of nodes to add to the existing property.],
         "nodes_to_delete": [An array of nodes to remove from the existing property.],
         "final_array": [An array representing the final state of the property after additions and deletions.]
       },
       "reasoning": "Your reasoning for proposing this change to the [PROPERTY_NAME] of the node."
     }

   - If "nodeType" is "activity" and the property you want to change is "postConditions" or "preConditions":
     {
       "modifiedProperty": "[postConditions|preConditions]",
       "new_value": {
         "conditions_to_add": [An array of conditions to add to the existing property.],
         "conditions_to_delete": [An array of conditions to remove from the existing property.],
         "final_array": [An array representing the final state of the property after additions and deletions.]
       },
       "reasoning": "Your reasoning for proposing this change to the [postConditions|preConditions] of the node."
     }
}

IMPORTANT: Please do not propose the creation of any new node under "specializations" or "generalizations" in an improvement object. New nodes should only be proposed under the "new_nodes" array.

For the "new_nodes" array:
Each item should represent an object proposing a new node. Please structure each object as follows:
{
   "title": "The title of the new node.",
   "description": "The description of the node.",
   "nodeType": "The type of the node, which could be 'activity', 'actor', 'object', 'evaluationDimension', 'incentive', 'reward', or 'context'.",
   "generalizations": [An array of titles (as strings) of nodes that are generalizations of this node. These are nodes that this node is a specific type of. Example, "But" is a generalization of nodes such as "Buy fuel", "Buy parts", "Buy services", and "Buy information".],
   "parts": [An array of titles (as strings) of nodes that are parts of this node.],
   "isPartOf": [An array of titles (as strings) of nodes that this node is a part of.],

   // NodeType-specific fields:

   // If "nodeType" is "activity":
   "actor": [An array of titles (as strings) of nodes that are individuals or groups that perform this activity.],
   "objectsActedOn": [An array of titles (as strings) of nodes that are objects that this activity is performed on.],
   "evaluationDimension": [An array of titles (as strings) of nodes that are evaluation dimensions of this activity.],
   "postConditions": [An array of conditions that must be met after this activity is performed.],
   "preConditions": [An array of conditions that must be met before this activity can be performed.],

   // If "nodeType" is "actor" or "group":
   "abilities": [An array of abilities required of this actor or group.],
   "typeOfActor": [An array of types of actors.],

   // Additional fields for "group":
   "listOfIndividualsInGroup": [An array of individuals that make up this group.],
   "numberOfIndividualsInGroup": [The number of individuals in the group.],

   // If "nodeType" is "object":
   "lifeSpan": [Details about the lifespan of the object.],
   "modifiability": [Details about the modifiability of the object.],
   "perceivableProperties": [An array of perceivable properties of the object.],

   // If "nodeType" is "evaluationDimension":
   "criteriaForAcceptability": [An array of standards used to determine if the activity's performance meets expectations according to this evaluation dimension.],
   "directionOfDesirability": [An array indicating whether an increase or decrease in measurement is considered desirable.],
   "evaluationType": [An array of evaluation types.],
   "measurementUnits": [An array of units used to quantify this evaluation dimension.],

   // If "nodeType" is "reward":
   "units": [An array of units of the reward.],

   // If "nodeType" is "incentive":
   "capabilitiesRequired": [An array of capabilities that actors must possess to achieve this incentive.],
   "rewardFunction": [An array of descriptions of how the reward is structured or provided.],
   "evaluationDimension": [An array of titles (as strings) of nodes that are evaluation dimensions of the incentive.],
   "reward": [An array of titles (as strings) of nodes that are rewards of the incentive.],

   "reasoning": "Your reasoning for proposing this new node with these specific properties."
}

IMPORTANT NOTES:
- Please do not propose any new node that already exists in the ontology, even if their titles are different. Ensure that each node is unique in meaning.
- Take as much time as needed to generate as many high-quality improvements and new nodes as possible.
- Thoroughly analyze the ontology and the user's message to identify all possible improvements and additions.
- If a 'Main' collection does not exist, please do not create it.
- Please note the difference between "specializations" and "parts" properties.
  - "specializations" is an array of specialized nodes that are specific types of this node.
  - "parts" is an array of smaller nodes that are components of this node.
'''
`;

export const MODELS_OPTIONS = [
  { id: "o1-preview", title: "O1" },
  { id: "chatgpt-4o-latest", title: "GPT-4o latest" },
  { id: "gemini-exp-1121", title: "Gemini 1.5 PRO" },
];
