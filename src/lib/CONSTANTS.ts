import { INodeTypes } from " @components/types/INode";
import { DESIGN_SYSTEM_COLORS } from "./theme/colors";

// TO-DO: Consider storing this data in the database to identify node types in the project

// Defining an object to hold initial values for various node types

export const DISPLAY: {
  [key: string]: string;
} = {
  numberOfIndividualsInGroup: "Number Of Individuals In Group",
  listOfIndividualsInGroup: "List Of Individuals In Group",
  capabilitiesRequired: "Capabilities Required",
  evaluationDimension: "Evaluation Dimensions",
  performancePredictionModels: "Performance Prediction Models",
  roleType: "Role Type",
  measurementUnits: "Measurement Units",
  typeOfProcess: "Type Of Process",
  typeOfActor: "Type Of Actor",
  directionOfDesirability: "Direction Of Desirability",
  criteriaForAcceptability: "Criteria For Acceptability",
  evaluationType: "Evaluation Type",
  rewardType: "Reward Type",
  preConditions: "Pre Conditions",
  postConditions: "Post Conditions",
  subActivities: "Sub Activities",
  rewardFunction: "Reward Function",
  parts: "Parts",
  isPartOf: "Is Part of",
  actor: "Actors",
};

export const NO_IMAGE_USER =
  "https://firebasestorage.googleapis.com/v0/b/ontology-41607.appspot.com/o/profilePicture%2Fno-img.png?alt=media&token=c784a749-6c29-4f7d-9495-f1dc8d948ae3";

export const SCROLL_BAR_STYLE = {
  "&::-webkit-scrollbar": {
    width: "12px",
  },
  "&::-webkit-scrollbar-track": {
    background: (theme: any) =>
      theme.palette.mode === "dark" ? "#28282a" : "white",
  },
  "&::-webkit-scrollbar-thumb": {
    backgroundColor: "#888",
    borderRadius: "10px",
    border: (theme: any) =>
      theme.palette.mode === "dark" ? "3px solid #28282a" : "3px solid white",
  },
  "&::-webkit-scrollbar-thumb:hover": {
    background: DESIGN_SYSTEM_COLORS.orange400,
  },
};

export const SpecialCharacterRegex = /^[a-zA-Z0-9\s]+$/;

export const PROPERTIES_ORDER: any = {
  activity: [
    "actor",
    "preConditions",
    "postConditions",
    "evaluationDimension",
    "References",
  ],
  actor: ["abilities", "typeOfActor", "parts", "isPartOf"],
  group: [
    "abilities",
    "individual",
    "numberOfIndividualsInGroup",
    "listOfIndividualsInGroup",
    "typeOfActor",
  ],
  incentive: [
    "reward",
    "evaluationDimension",
    "description",
    "rewardFunction",
    "capabilitiesRequired",
  ],
  evaluationDimension: [
    "evaluationType",
    "criteriaForAcceptability",
    "description",
    "directionOfDesirability",
    "measurementUnits",
  ],
  reward: ["rewardType", "units"],
  object: [],
  evaluation: [
    "criteriaForAcceptability",
    "measurementUnits",
    "directionOfDesirability",
  ],
};

export const UNCLASSIFIED: any = {
  activity: "Unclassified",
  object: "Unclassified Objects",
  actor: "Unclassified Actors",
  evaluationDimension: "Unclassified evaluation dimensions",
  incentive: "Unclassified incentives",
  reward: "Unclassified rewards",
};
export const development = process.env.NODE_ENV === "development";
console.log("development", development);
export const WS_URL = development
  ? `ws://${process.env.NEXT_PUBLIC_DEV_WS_SERVER}/ws`
  : `wss://${process.env.NEXT_PUBLIC_WS_SERVER}/ws`;

export const CHAT_DISCUSSION_TABS = [
  { id: "discussion", title: "Discussion" },
  { id: "bug_report", title: "Bug Reports" },
  { id: "feature_request", title: "Feature Requests" },
  { id: "help", title: "Help" },
];

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
   "first_generalization": "A string representing the title of the node that you would like to specify as the first generalization of this new node; i.e., the new node should be classified as one of its specializations.
   "reasoning": "Your reasoning for proposing this new node"
}

IMPORTANT: Please do not propose any new node that already exists in the ontology. Ensure that each node is unique.
'''
`;
