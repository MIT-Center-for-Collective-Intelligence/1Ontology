import { Post } from "./Post";
import { recordLogs } from "./helpers";

export const sendLLMRequest = async (
  userMessage: string,
  model: string,
  deepNumber: number,
  nodeId: string,
  generateNewNodes: boolean,
  improveProperties: Set<string>,
  proposeDeleteNode: boolean,
  inputProperties: Set<string>,
  skillsFutureApp: string,
) => {
  try {
    const response = await Post("/copilot", {
      userMessage,
      model,
      deepNumber,
      nodeId,
      generateNewNodes,
      proposeDeleteNode,
      improveProperties: new Array(...improveProperties),
      inputProperties: new Array(...inputProperties),
      skillsFutureApp,
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
export type copilotDeleteNode = {
  title: string;
  reasoning: string;
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
  { id: "o3", title: "O3" },
  { id: "o1", title: "O1" },
  { id: "chatgpt-4o-latest", title: "GPT-4o latest" },
  { id: "gemini-2.0-flash-exp", title: "GEMINI-2.0 FLASH EXP" },
  { id: "o1-mini", title: "O1 mini" },
  {
    id: "gemini-2.0-flash-thinking-exp",
    title: "GEMINI-2.0 FLASH THINKING EXP",
  },
  {
    id: "gemini-exp-1206",
    title: "Gemini Exp 1206",
  },
  {
    id: "gemini-2.5-pro-exp-03-25",
    title: "Gemini-2.5 PRO EXP 03-25",
  },
];
const properties = {
  allTypes: [
    "title",
    "description",
    "specializations",
    "generalizations",
    "parts",
    "isPartOf",
  ],
  actor: ["abilities", "typeOfActor"],
  activity: ["actor", "objectsActedOn", "evaluationDimension", "PreConditions"],
  object: ["lifeSpan", "modifiability", "perceivableProperties"],
  evaluationDEmention: [
    "criteriaForAcceptability",
    "directionOfDesirability",
    "evaluationType",
    "measurementUnits",
  ],
  reward: [
    "units",
    "capabilitiesRequired",
    "rewardFunction",
    "evaluationDimension",
    "reward",
  ],
};

export const getResponseStructure = (
  improvement: boolean,
  proposeDeleteNode: boolean,
) => {
  return `
  Please carefully generate a JSON object with the following structure:
  {
    "message": "A string message to the user, which may include your analysis, questions, or explanations regarding the proposed changes.",
    ${
      improvement
        ? `"improvements": [], // An array of improvements to existing nodes.\n    `
        : ""
    }"new_nodes": [], // An array of new nodes. Note that you should not propose a new node if a node with the same meaning already exists in the ontology, even if their titles are different.
    ${
      proposeDeleteNode
        ? `"delete_nodes": [], // An array of nodes proposed for deletion. If it is not necessary to delete any node, and you think all the nodes in the ontology are relevant, you can leave this array empty.\n`
        : ""
    }}
  
`;
};

export const getImprovementsStructurePrompt = (
  improveProperties: Set<string>,
) => {
  return `${
    improveProperties.size > 0
      ? ` ------------------
   For the "improvements" array:
   Each item should be an object proposing an improvement to an existing node, structured as follows:
   {
     "title": "The current title of the node.",
     "nodeType": "The type of the node (e.g., 'activity', 'actor', etc.).",
     "changes": [  // An array of change objects for this node.
       // Change objects as detailed below.
     ]
   }
 
   Each change object should include the necessary fields for the property being changed and a **reasoning** field explaining your rationale.
 
  ${
    improveProperties.has("title") ||
    improveProperties.has("description") ||
    improveProperties.has("specializations") ||
    improveProperties.has("generalizations") ||
    improveProperties.has("parts") ||
    improveProperties.has("isPartOf")
      ? "**For all node types:**"
      : ""
  }
 ${
   improveProperties.has("title")
     ? `- **Title changes**:
   {
     "title": "The improved title of the node.",
     "reasoning": "Reason for proposing this title change."
   }`
     : ""
 }
   ${
     improveProperties.has("description")
       ? `- **Description changes**:
   {
     "description": "The improved description of the node.",
     "reasoning": "Reason for proposing this description change."
   }`
       : ""
   }
   ${
     improveProperties.has("specializations")
       ? `- **Specializations changes**:
   {
     "specializations": [
       {
         "collectionName": "The title of the collection",
         "changes": {
           "nodes_to_add": [Titles of nodes to add],
           "nodes_to_delete": [Titles of nodes to remove],
           "final_array": [Final list of node titles in this collection]
         },
         "reasoning": "Reason for proposing these changes to the collection."
       }
     ]
   }`
       : ""
   }
  ${
    improveProperties.has("generalizations")
      ? `- **Generalizations changes**:
   {
     "modified_property": "generalizations",
     "new_value": {
       "nodes_to_add": [Titles of nodes to add],
       "nodes_to_delete": [Titles of nodes to remove],
       "final_array": [Final list of generalizations after changes]
     },
     "reasoning": "Reason for proposing these changes to the generalizations."
   }`
      : ""
  }
   ${
     improveProperties.has("parts")
       ? `- **Parts changes**:
   {
     "modified_property": "parts",
     "new_value": {
       "nodes_to_add": [Titles of nodes to add],
       "nodes_to_delete": [Titles of nodes to remove],
       "final_array": [Final list of parts after changes]
     },
     "reasoning": "Reason for proposing these changes to the parts."
   }`
       : ""
   }
  ${
    improveProperties.has("isPartOf")
      ? `- **IsPartOf changes**:
   {
     "modifiedProperty": "isPartOf",
     "new_value": {
       "nodes_to_add": [Titles of nodes to add],
       "nodes_to_delete": [Titles of nodes to remove],
       "final_array": [Final list of isPartOf relationships after changes]
     },
     "reasoning": "Reason for proposing these changes to the isPartOf."
   }
  `
      : ""
  } 
  ${
    improveProperties.has("actor") ||
    improveProperties.has("objectsActedOn") ||
    improveProperties.has("evaluationDimension") ||
    improveProperties.has("PreConditions")
      ? `---
      **For "activity" nodes:**`
      : ""
  }${
    improveProperties.has("actor")
      ? `- **Actor changes**:
   {
     "modifiedProperty": "actor",
     "new_value": {
       "nodes_to_add": [Titles of actors to add],
       "nodes_to_delete": [Titles of actors to remove],
       "final_array": [Final list of actor after changes]
     },
     "reasoning": "Reason for proposing these changes to the actor."
   }`
      : ""
  }${
    improveProperties.has("objectsActedOn")
      ? `- **ObjectsActedOn changes**:
   {
     "modifiedProperty": "objectsActedOn",
     "new_value": {
       "nodes_to_add": [Titles of objects to add],
       "nodes_to_delete": [Titles of objects to remove],
       "final_array": [Final list of objectsActedOn after changes]
     },
     "reasoning": "Reason for proposing these changes to the objectsActedOn."
   }`
      : ""
  }${
    improveProperties.has("evaluationDimension")
      ? `- **EvaluationDimension changes**:
   {
     "modifiedProperty": "evaluationDimension",
     "new_value": {
       "nodes_to_add": [Titles of evaluation dimensions to add],
       "nodes_to_delete": [Titles of evaluation dimensions to remove],
       "final_array": [Final list of evaluationDimension after changes]
     },
     "reasoning": "Reason for proposing these changes to the evaluationDimension."
   }`
      : ""
  }${
    improveProperties.has("postConditions")
      ? `- **PostConditions changes**:
   {
     "modifiedProperty": "postConditions",
     "new_value": {
       "conditions_to_add": [Conditions to add],
       "conditions_to_delete": [Conditions to remove],
       "final_array": [Final list of postConditions after changes]
     },
     "reasoning": "Reason for proposing these changes to the postConditions."
   }`
      : ""
  }${
    improveProperties.has("PreConditions")
      ? `- **PreConditions changes**:
   {
     "modifiedProperty":"preConditions", 
     "new_value": {
       "conditions_to_add": [Conditions to add],
       "conditions_to_delete": [Conditions to remove],
       "final_array": [Final list of preConditions after changes]
     },
     "reasoning": "Reason for proposing these changes to the preConditions."
   }`
      : ""
  }${
    improveProperties.has("abilities") || improveProperties.has("typeOfActor")
      ? `**For "actor" nodes:**`
      : ""
  }${
    improveProperties.has("abilities")
      ? `- **Abilities changes**:
   {
     "modifiedProperty":"abilities",
     "new_value": {
       "abilities_to_add": [Abilities to add],
       "abilities_to_delete": [Abilities to remove],
       "final_array": [Final list of abilities after changes]
     },
     "reasoning": "Reason for proposing these changes to the abilities."
   }`
      : ""
  }${
    improveProperties.has("typeOfActor")
      ? `- **TypeOfActor changes**:
   {
     "modifiedProperty":"typeOfActor",
     "new_value": {
       "types_to_add": [Types of actors to add],
       "types_to_delete": [Types of actors to remove],
       "final_array": [Final list of typeOfActor after changes]
     },
     "reasoning": "Reason for proposing these changes to the typeOfActor."
   }`
      : ""
  }${
    improveProperties.has("lifeSpan") ||
    improveProperties.has("modifiability") ||
    improveProperties.has("perceivableProperties")
      ? `---
       **For "object" nodes:**`
      : ""
  }${
    improveProperties.has("lifeSpan")
      ? `
   - **LifeSpan change**:
   {
     "modifiedProperty": "lifeSpan",
     "new_value": "New details about the lifespan of the object.",
     "reasoning": "Reason for changing the lifeSpan."
   }`
      : ""
  }
  
     ${
       improveProperties.has("modifiability")
         ? `
   - **Modifiability change**:
   {
     "modifiedProperty": "modifiability",
     "new_value": "New details about the modifiability of the object.",
     "reasoning": "Reason for changing the modifiability."
   }`
         : ""
     }${
       improveProperties.has("perceivableProperties")
         ? `
    - **PerceivableProperties changes**:
   {
     "modifiedProperty": "perceivableProperties",
     "new_value": {
       "properties_to_add": [Properties to add],
       "properties_to_delete": [Properties to remove],
       "final_array": [Final list of perceivableProperties after changes]
     },
     "reasoning": "Reason for proposing these changes to the perceivableProperties."
   }`
         : ""
     }${
       improveProperties.has("criteriaForAcceptability") ||
       improveProperties.has("directionOfDesirability") ||
       improveProperties.has("evaluationType") ||
       improveProperties.has("measurementUnits")
         ? `
         ---
         **For "evaluationDimension" nodes:**`
         : ""
     }${
       improveProperties.has("criteriaForAcceptability")
         ? `  
   - **CriteriaForAcceptability changes**:
   {
     "modifiedProperty": "criteriaForAcceptability",
     "new_value": {
       "criteria_to_add": [Criteria to add],
       "criteria_to_delete": [Criteria to remove],
       "final_array": [Final list of criteriaForAcceptability after changes]
     },
     "reasoning": "Reason for proposing these changes to the criteriaForAcceptability."
   }`
         : ""
     }${
       improveProperties.has("directionOfDesirability")
         ? `
   - **DirectionOfDesirability change**:
   {
     "modifiedProperty": "directionOfDesirability",
     "new_value": "New direction (e.g., 'Increase is desirable').",
     "reasoning": "Reason for changing the directionOfDesirability."
   }`
         : ""
     }${
       improveProperties.has("evaluationType")
         ? `
   - **EvaluationType changes**:
   {
     "modifiedProperty": "evaluationType",
     "new_value": {
       "types_to_add": [Evaluation types to add],
       "types_to_delete": [Evaluation types to remove],
       "final_array": [Final list of evaluationType after changes]
     },
     "reasoning": "Reason for proposing these changes to the evaluationType."
   }
    `
         : ""
     }${
       improveProperties.has("measurementUnits")
         ? `
 - **MeasurementUnits changes**:
   {
     "modifiedProperty": "measurementUnits",
     "new_value": {
       "units_to_add": [Units to add],
       "units_to_delete": [Units to remove],
       "final_array": [Final list of measurementUnits after changes]
     },
     "reasoning": "Reason for proposing these changes to the measurementUnits."
   }`
         : ""
     }${
       improveProperties.has("units") ||
       improveProperties.has("capabilitiesRequired") ||
       improveProperties.has("rewardFunction") ||
       improveProperties.has("evaluationDimension") ||
       improveProperties.has("reward")
         ? `**For "reward" nodes:**`
         : ""
     }${
       improveProperties.has("units")
         ? `
   ---
   - **Units changes**:
   {
     "modifiedProperty": "units",
     "new_value": {
       "units_to_add": [Units to add],
       "units_to_delete": [Units to remove],
       "final_array": [Final list of units after changes]
     },
     "reasoning": "Reason for proposing these changes to the units."
   }
   `
         : ""
     }${
       improveProperties.has("capabilitiesRequired")
         ? `
   ---
   
   **For "incentive" nodes:**
   
   - **CapabilitiesRequired changes**:
   {
     "modifiedProperty": "capabilitiesRequired",
     "new_value": {
       "capabilities_to_add": [Capabilities to add],
       "capabilities_to_delete": [Capabilities to remove],
       "final_array": [Final list of capabilitiesRequired after changes]
     },
     "reasoning": "Reason for proposing these changes to the capabilitiesRequired."
   }
   `
         : ""
     }
 ${
   improveProperties.has("rewardFunction")
     ? `     
   - **RewardFunction changes**:
   {
     "modifiedProperty": "rewardFunction",
     "new_value": {
       "functions_to_add": [Reward functions to add],
       "functions_to_delete": [Reward functions to remove],
       "final_array": [Final list of rewardFunction after changes]
     },
     "reasoning": "Reason for proposing these changes to the rewardFunction."
   }
   `
     : ""
 }
 ${
   improveProperties.has("evaluationDimension")
     ? `  
   - **EvaluationDimension changes**:
   {
     "modifiedProperty": "evaluationDimension",
     "new_value": {
       "nodes_to_add": [Titles of evaluation dimensions to add],
       "nodes_to_delete": [Titles of evaluation dimensions to remove],
       "final_array": [Final list of evaluationDimension after changes]
     },
     "reasoning": "Reason for proposing these changes to the evaluationDimension."
   }
   `
     : ""
 }
      ${
        improveProperties.has("reward")
          ? `   
   - **Reward changes**:
   {
    "modifiedProperty": "reward",
     "new_value": {
       "nodes_to_add": [Titles of rewards to add],
       "nodes_to_delete": [Titles of rewards to remove],
       "final_array": [Final list of reward after changes]
     },
     "reasoning": "Reason for proposing these changes to the reward."
   }
   `
          : ""
      }
   **Important Notes:**
   
   - Each change object should directly reference the property name and follow the format provided.
   - Ensure that for each property, you include:
   
     - The property name as the key.
     - The changes to be made (additions, deletions, final state).
     - A **reasoning** field explaining why you are proposing these changes.
   
   - For properties that are single values (like **lifeSpan**, **modifiability**, **directionOfDesirability**, **numberOfIndividualsInGroup**), provide the new value directly along with the reasoning.
   - Do not propose creating new nodes within "specializations" or "generalizations" in an improvement object. New nodes should only be proposed under the "new_nodes" array.
   
   `
      : ""
  }`;
};
export const getNewNodesPrompt = (newNodes: boolean) => {
  return `${
    newNodes
      ? `------------------
  **For the "new_nodes" array**:
  
  Each item should be an object proposing a new node, structured as follows:
  {
    "title": "The title of the new node.",
    "description": "The description of the new node.",
    "nodeType": "The type of the node, which could be 'activity', 'actor', 'object', 'evaluationDimension', 'incentive', 'reward', or 'context'.",
    "generalizations": [An array of titles (as strings) of nodes that are generalizations of this node.],
  
  // Include nodeType-specific properties as applicable:
  
  // For "activity" nodes:
  "actor": [],
  "objectsActedOn": [],
  "evaluationDimension": [],
  "postConditions": [],
  "preConditions": [],
  
  // For "actor" nodes:
  "abilities": [],
  "typeOfActor": [],
  

  // For "object" nodes:
  "lifeSpan": "Details about lifespan",
  "modifiability": "Details about modifiability",
  "perceivableProperties": [],
  
  // For "evaluationDimension" nodes:
  "criteriaForAcceptability": [],
  "directionOfDesirability": [],
  "evaluationType": [],
  "measurementUnits": [],
  
  // For "reward" nodes:
  "units": [],
  
  // For "incentive" nodes:
  "capabilitiesRequired": [],
  "rewardFunction": [],
  "evaluationDimension": [],
  "reward": [],
  
  "reasoning": "Reason for proposing this new node."
  }`
      : ""
  }`;
};
export const getDeleteNodesPrompt = (proposeDeleteNode: boolean) => {
  return `${
    proposeDeleteNode
      ? ` ------------------
  
  **For the "delete_nodes" array**:
  Each item should be an object proposing the deletion of an existing node:
  
  {
  "title": "The title of the node to delete.",
  "reasoning": "Reason for proposing this deletion."
  }`
      : ""
  }`;
};
export const getNotesPrompt = () => {
  return `- Do not create a 'Main' collection if it doesn't exist.
  - Specializations of a node should have the exact same node type as the original node." I moved the former to guidelines.
  - Take ample time to generate high-quality improvements and additions.
  - A panel of experts will review your proposals and for every satisfactory proposal, you will be rewarded $100. For every unsatisfactory proposal, you will lose $100.`;
};

export const getCopilotPrompt = ({
  improvement,
  newNodes,
  proposeDeleteNode,
  improveProperties,
  editedPart,
}: {
  improvement: boolean;
  newNodes: boolean;
  proposeDeleteNode: boolean;
  improveProperties: Set<string>;
  editedPart: { objective: string; definition: string };
}) => {
  let prompt = "";
  /* editedPart.objective */
  if (!!editedPart.objective && !!editedPart.objective.trim()) {
    prompt =
      prompt +
      `Objective:
'''
  ${editedPart.objective}
'''`;
  }
  /* Ontology Definition */
  if (!!editedPart.definition && !!editedPart.definition.trim()) {
    prompt =
      prompt +
      `Ontology Definition:
'''
  ${editedPart.definition}
'''`;
  }
  /* Response structure */
  prompt = prompt + "'''";
  prompt =
    prompt +
    `Response Structure:
    ${getResponseStructure(improvement, proposeDeleteNode)}`;

  prompt = prompt + getImprovementsStructurePrompt(improveProperties);

  prompt = prompt + getNewNodesPrompt(newNodes);
  prompt = prompt + getDeleteNodesPrompt(proposeDeleteNode);
  prompt = prompt + "IMPORTANT NOTES:\n" + getNotesPrompt();
  prompt = prompt + "'''";
  return prompt;
};
