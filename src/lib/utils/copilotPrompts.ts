import { Post } from "./Post";
import { recordLogs } from "./helpers";

export const sendLLMRequest = async (
  userMessage: string,
  model: string,
  deepNumber: number,
  nodeId: string
) => {
  try {
    const response = await Post("/copilot", {
      userMessage,
      model,
      deepNumber,
      nodeId,
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
  changes: Array<
    | {
        title: string;
        reasoning: string;
      }
    | {
        description: string;
        reasoning: string;
      }
    | {
        specializations: { collectionName: string; nodes: string[] }[];
        reasoning: string;
      }
    | {
        generalizations: string[];
        reasoning: string;
      }
    | {
        parts: string[];
        reasoning: string;
      }
    | {
        isPartOf: string[];
        reasoning: string;
      }
    | {
        actor: string[];
        reasoning: string;
      }
    | {
        ObjectsActedOn: string[];
        reasoning: string;
      }
    | {
        evaluationDimension: string[];
        reasoning: string;
      }
    | {
        postConditions: string;
        reasoning: string;
      }
    | {
        preConditions: string;
        reasoning: string;
      }
    | {
        abilities: string;
        reasoning: string;
      }
    | {
        typeOfActor: string;
        reasoning: string;
      }
    | {
        listOfIndividualsInGroup: string;
        reasoning: string;
      }
    | {
        numberOfIndividualsInGroup: string;
        reasoning: string;
      }
    | {
        size: string;
        reasoning: string;
      }
    | {
        creator: string;
        reasoning: string;
      }
    | {
        creationDate: string;
        reasoning: string;
      }
    | {
        LifeSpan: string;
        reasoning: string;
      }
    | {
        modifiability: string;
        reasoning: string;
      }
    | {
        perceivableProperties: string;
        reasoning: string;
      }
    | {
        criteriaForAcceptability: string;
        reasoning: string;
      }
    | {
        directionOfDesirability: string;
        reasoning: string;
      }
    | {
        evaluationType: string;
        reasoning: string;
      }
    | {
        measurementUnits: string;
        reasoning: string;
      }
    | {
        units: string;
        reasoning: string;
      }
    | {
        capabilitiesRequired: string;
        reasoning: string;
      }
    | {
        rewardFunction: string;
        reasoning: string;
      }
    | {
        evaluationDimension: string[];
        reasoning: string;
      }
    | {
        reward: string[];
        reasoning: string;
      }
  >;
};

export const PROPOSALS_SCHEMA = `
Response Structure:
'''
Please carefully generate a JSON object with the following structure:
{
   "message": "A string message that you would send to the user in response to their message. This could include your analysis, questions, or explanations regarding the requested changes.",
   "improvements" : [], // An array of improvements to existing nodes.
   "new_nodes" : [] // An array of new nodes. Note that you should not propose a new node if a node with the same title already exists in the ontology.
}

For the "improvements" array:
Each item should represent an object that proposes an improvement to an existing node. Please structure each object as follows:
{
   "title": "The current title of the node.",
   "nodeType": "The type of the node, which could be either 'activity', 'actor', 'object', 'evaluationDimension', 'incentive', 'reward', or 'context'.",
   "changes": [], // An array of objects, each representing a change to a single property of the node, only if that property requires some modification. Depending on the property, the object would get only one of the following structures: 
   {
     "title": "The improved title of the node. If the node type is 'activity', its typically starts with a verb. Example: 'Turn around aircraft'.",
     "reasoning": "Your reasoning for proposing this change to the title of the node."
   },
   {
     "description": "The improved description of the node. This should be a detailed explanation of this entity to help others understand its purpose and how it differs from similar entities.",
     "reasoning": "Your reasoning for proposing this change to the description of the node."
   },
   {
     "specializations": [], // An array of objects, each representing a collection with the following structure: {"collectionName": "The title of the collection", "nodes": [An array of titles (as strings) of nodes that are specializations of this node and are classified under this collection based on their shared characteristics. These are nodes that are more specific variants of this node. Example: 'Turn around aircraft' is a specialization of 'Change user of physical object' because it involves changing the user of an aircraft.]}
     "reasoning": "Your reasoning for proposing this change to the specializations of the node."
   },
   {
     "generalizations": [], // An array of titles (as strings) of nodes that are generalizations of this node. These are nodes that this node is a specific type of. Example: "Turn around aircraft" is a generalization of "Change user of physical object" because turning around an aircraft changes its users.
     "reasoning": "Your reasoning for proposing this change to the generalizations of the node."
   },
   {
     "parts": [], // An array of titles (as strings) of nodes that are parts of this node. These are the components or sub-nodes that make up this node. For activities, parts are the sub-activities needed to achieve the overall activity goal.
     "reasoning": "Your reasoning for proposing this change to the parts of the node."
   },
   {
     "isPartOf": [], // An array of titles (as strings) of nodes that this node is a part of. These are larger nodes that this node is a component of. For activities, it includes larger activities of which this is a sub-activity. Example: The activity "Dress seats" is part of "Clean aircraft."
     "reasoning": "Your reasoning for proposing this change to the isPartOf of the node."
   },
   // The following objects should only be included if "nodeType" is "activity":
   {
     "actor": [], // An array of titles (as strings) of nodes that are individuals or groups that perform the original activity node.
     "reasoning": "Your reasoning for proposing this change to the actors of the node."
   },
   {
     "Objects Acted on": [], // An array of titles (as strings) of nodes that are objects that the original activity node is performed on.
     "reasoning": "Your reasoning for proposing this change to the objects of the node."
   },
   {
     "evaluationDimension": [], // An array of titles (as strings) of nodes that are evaluation dimensions of the original node. These are criteria used to assess the performance of this activity.
     "reasoning": "Your reasoning for proposing this change to the evaluation dimensions of the node."
   },
   {
     "postConditions": "The conditions that must be met before this activity can be performed.",
     "reasoning": "Your reasoning for proposing this change to the postConditions of the node."
   },
   {
     "preConditions": "The pre-conditions of the activity that must be met before this activity can be performed.",
     "reasoning": "Your reasoning for proposing this change to the preConditions of the node."
   },
   // The following fields should only be included if "nodeType" is "actor":
   {
     "abilities": "The skills or abilities required of this actor.",
     "reasoning": "Your reasoning for proposing this change to the abilities of the node."
   },
   {
     "typeOfActor": "The type of actor.",
     "reasoning": "Your reasoning for proposing this change to the typeOfActor of the node."
   },
   // The following fields should only be included if "nodeType" is "group":
   {
     "abilities": "The skills or abilities required of the actors that belong to this group.",
     "reasoning": "Your reasoning for proposing this change to the abilities of the node."
   },
   {
     "typeOfActor": "The specific types of actors that belong to this group.",
     "reasoning": "Your reasoning for proposing this change to the typeOfActor of the node."
   },
   {
     "listOfIndividualsInGroup": "The list of individuals that make up this group.",
     "reasoning": "Your reasoning for proposing this change to the listOfIndividualsInGroup of the node."
   },
   {
     "numberOfIndividualsInGroup": "The number of individuals in the group.",
     "reasoning": "Your reasoning for proposing this change to the numberOfIndividualsInGroup of the node."
   },
   // The following fields should only be included if "nodeType" is "object":
   {
     "size": "The size of the object.",
     "reasoning": "Your reasoning for proposing this change to the size of the node."
   },
   {
     "creator": "The creator of the object.",
     "reasoning": "Your reasoning for proposing this change to the creator of the node."
   },
   {
     "creationDate": "The creation date of the object.",
     "reasoning": "Your reasoning for proposing this change to the creationDate of the node."
   },
   {
     "LifeSpan": "The lifespan of the object.",
     "reasoning": "Your reasoning for proposing this change to the LifeSpan of the node."
   },
   {
     "modifiability": "The modifiability of the object.",
     "reasoning": "Your reasoning for proposing this change to the modifiability of the node."
   },
   {
     "perceivableProperties": "The perceivable properties of the object.",
     "reasoning": "Your reasoning for proposing this change to the perceivableProperties of the node."
   },
   // The following fields should only be included if "nodeType" is "evaluationDimension":
   {
     "criteriaForAcceptability": "The standards used to determine if the activity's performance meets expectations according to this evaluation dimension.",
     "reasoning": "Your reasoning for proposing this change to the criteriaForAcceptability of the node."
   },
   {
     "directionOfDesirability": "Indicates whether an increase or decrease in measurement would be considered desirable for this activity's performance.",
     "reasoning": "Your reasoning for proposing this change to the directionOfDesirability of the node."
   },
   {
     "evaluationType": "The evaluation type of the evaluation dimension.",
     "reasoning": "Your reasoning for proposing this change to the evaluationType of the node."
   },
   {
     "measurementUnits": "The units used to quantify this evaluation dimension.",
     "reasoning": "Your reasoning for proposing this change to the measurementUnits of the node."
   },
   // The following fields should only be included if "nodeType" is "reward":
   {
     "units": "The units of the reward.",
     "reasoning": "Your reasoning for proposing this change to the units of the node."
   },
   // The following fields should only be included if "nodeType" is "incentive":
   {
     "capabilitiesRequired": "The capabilities that actors must possess to achieve this incentive.",
     "reasoning": "Your reasoning for proposing this change to the capabilitiesRequired of the node."
   },
   {
     "rewardFunction": "The way in which the reward is structured or provided.",
     "reasoning": "Your reasoning for proposing this change to the rewardFunction of the node."
   },
   {
     "evaluationDimension": [], // An array of titles (as strings) of nodes that are evaluation dimensions of the original incentive node.
     "reasoning": "Your reasoning for proposing this change to the evaluationDimension of the node."
   },
   {
     "reward": [], // An array of titles (as strings) of nodes that are rewards of the original incentive node.
     "reasoning": "Your reasoning for proposing this change to the reward of the node."
   }
}

IMPORTANT: Please do not propose the creation of any new node under "specializations" or "generalizations" in an improvement object. New nodes should only be proposed under the "new_nodes" array.

For the "new_nodes" array:
Each item should represent an object proposing a new node. Please structure each object as follows:
{
   "title": "The title of the new node.",
   "description": "The description of the node.",
   "generalizations": [], // An array of titles (as strings) of nodes that are generalizations of this node. These are nodes that this node is a specific type of. Example: "Turn around aircraft" is a generalization of "Change user of physical object" because turning around an aircraft changes its users.
   "parts": [], // An array of titles (as strings) of nodes that are parts of this node. These are the components or sub-nodes that make up this node. For activities, parts are the sub-activities needed to achieve the overall activity goal.
   "isPartOf": [], // An array of titles (as strings) of nodes that this node is a part of. These are larger nodes that this node is a component of. For activities, it includes larger activities of which this is a sub-activity. Example: The activity "Dress seats" is part of "Clean aircraft."
   // The following objects should only be included if "nodeType" is "activity":
   "actor": [], // An array of titles (as strings) of nodes that are individuals or groups that perform the original activity node.
   "Objects Acted on": [], // An array of titles (as strings) of nodes that are objects that the original activity node is performed on.
   "evaluationDimension": [], // An array of titles (as strings) of nodes that are evaluation dimensions of the original node. These are criteria used to assess the performance of this activity.
   "postConditions": "The conditions that must be met before this activity can be performed.",
   "preConditions": "The pre-conditions of the activity that must be met before this activity can be performed.",
   // The following fields should only be included if "nodeType" is "actor":
   "abilities": "The skills or abilities required of this actor.",
   "typeOfActor": "The type of actor.",
   // The following fields should only be included if "nodeType" is "group":
   "abilities": "The skills or abilities required of the actors that belong to this group.",
   "typeOfActor": "The specific types of actors that belong to this group.",
   "listOfIndividualsInGroup": "The list of individuals that make up this group.",
   "numberOfIndividualsInGroup": "The number of individuals in the group.",
   // The following fields should only be included if "nodeType" is "object":
   "LifeSpan": "The lifespan of the object.",
   "modifiability": "The modifiability of the object.",
   "perceivableProperties": "The perceivable properties of the object.",
   // The following fields should only be included if "nodeType" is "evaluationDimension":
   "criteriaForAcceptability": "The standards used to determine if the activity's performance meets expectations according to this evaluation dimension.",
   "directionOfDesirability": "Indicates whether an increase or decrease in measurement would be considered desirable for this activity's performance.",
   "evaluationType": "The evaluation type of the evaluation dimension.",
   "measurementUnits": "The units used to quantify this evaluation dimension.",
   // The following fields should only be included if "nodeType" is "reward":
   "units": "The units of the reward.",
   // The following fields should only be included if "nodeType" is "incentive":
   "capabilitiesRequired": "The capabilities that actors must possess to achieve this incentive.",
   "rewardFunction": "The way in which the reward is structured or provided.",
   "evaluationDimension": [], // An array of titles (as strings) of nodes that are evaluation dimensions of the original incentive node.
   "reward": [], // An array of titles (as strings) of nodes that are rewards of the original incentive node.
   "reasoning": "Your reasoning for proposing this new node with these specific properties."
}

IMPORTANT NOTES:
- Please do not propose any new node that already exists in the ontology. Ensure that each node is unique.
- If a 'Main' collection does not exist, please do not create it. 
- Please note the difference between "Generalizations" and "IsPartOf" properties.
  - "Generalizations" is an array of entities that this entity is a specific type of. Example: 'Turn around aircraft' is a generalization of 'Change user of physical object' because turning around an aircraft changes its user.
  - "Is Part Of" is an array of the larger entities that this entity is a component of. For activities, it includes larger activities of which this is a sub-activity. Example: The activity "Dress seats" is part of "Clean aircraft."
'''
`;
