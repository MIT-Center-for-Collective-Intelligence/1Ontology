import {
  IActivity,
  IActor,
  IEvaluation,
  IGroup,
  IIncentive,
  IProcess,
  IReward,
  IRole,
} from " @components/types/INode";

// TO-DO: Consider storing this data in the database to identify node types in the project

// Defining an object to hold initial values for various node types
export const NODES_TYPES: {
  [key: string]:
    | IActivity
    | IActor
    | IProcess
    | IEvaluation
    | IRole
    | IIncentive
    | IReward
    | IGroup;
} = {
  // Definition for Activity node type
  activity: {
    plainText: {
      title: "",
      description: "",
      notes: "",
      preConditions: "",
      postConditions: "",
    },
    children: {
      actor: {},
      process: {},
      evaluationDimension: {},
      dependents: {},
      dependencies: {},
      specializations: {},
      generalizations: {},
    },
    nodeType: "activity",
  },

  // Definition for Actor node type
  actor: {
    plainText: {
      title: "",
      description: "",
      typeOfActor: "",
      abilities: "",
      notes: "",
    },
    children: {
      specializations: {},
      generalizations: {},
    },
    nodeType: "actor",
  },

  // Definition for Process node type
  process: {
    plainText: {
      title: "",
      description: "",
      typeOfProcess: "",
      notes: "",
      subActivities: "",
      dependencies: "",
      performancePredictionModels: "",
    },
    children: {
      role: {},
      specializations: {},
      generalizations: {},
    },
    nodeType: "process",
  },

  // Definition for Evaluation Dimension node type
  evaluationDimension: {
    plainText: {
      title: "",
      description: "",
      evaluationType: "",
      measurementUnits: "",
      directionOfDesirability: "",
      criteriaForAcceptability: "",
      notes: "",
    },
    children: {
      specializations: {},
      generalizations: {},
    },
    nodeType: "evaluationDimension",
  },

  // Definition for Role node type
  role: {
    plainText: {
      title: "",
      description: "",
      roleType: "",
      units: "",
      capabilitiesRequired: "",
      notes: "",
    },
    children: {
      actor: {},
      specializations: {},
      incentive: {},
      generalizations: {},
    },
    nodeType: "role",
  },

  // Definition for Reward node type
  reward: {
    plainText: {
      title: "",
      description: "",
      units: "",
      rewardType: "",
    },
    children: {
      specializations: {},
      generalizations: {},
    },
    nodeType: "reward",
  },

  // Definition for Incentive node type
  incentive: {
    plainText: {
      title: "",
      description: "",
      rewardFunction: "",
      capabilitiesRequired: "",
      notes: "",
    },
    children: {
      specializations: {},
      evaluationDimension: {},
      generalizations: {},
      reward: {},
    },
    nodeType: "incentive",
  },

  // Definition for Group node type
  group: {
    plainText: {
      title: "",
      description: "",
      typeOfActor: "",
      abilities: "",
      listOfIndividualsInGroup: "",
      numberOfIndividualsInGroup: "",
      notes: "",
    },
    children: {
      individual: {},
      specializations: {},
      generalizations: {},
    },
    nodeType: "group",
  },
};
// TO-DO: Consider storing this data in the database to identify node types in the project

export const ORDER_CHILDREN: { [key: string]: string[] } = {
  activity: [
    "actor",
    "dependents",
    "dependencies",
    "preConditions",
    "postConditions",
    "evaluationDimension",
    "process",
    "specializations",
    "generalizations",
    "notes",
    "root",
  ],
  actor: [
    "typeOfActor",
    "abilities",
    "specializations",
    "generalizations",
    "notes",
    "root",
  ],
  process: [
    "typeOfProcess",
    "role",
    "subActivities",
    "dependencies",
    "performancePredictionModels",
    "specializations",
    "generalizations",
    "notes",
    "root",
  ],
  role: [
    "roleType",
    "actor",
    "incentive",
    "capabilitiesRequired",
    "specializations",
    "generalizations",
  ],
  evaluationDimension: [
    "evaluationType",
    "measurementUnits",
    "directionOfDesirability",
    "criteriaForAcceptability",
    "specializations",
    "generalizations",
    "notes",
    "root",
  ],
  incentive: [
    "evaluationDimension",
    "reward",
    "rewardFunction",
    "specializations",
    "generalizations",
    "notes",
    "root",
  ],
  reward: [
    "rewardType",
    "units",
    "specializations",
    "generalizations",
    "notes",
    "root",
  ],
  group: [
    "typeOfActor",
    "abilities",
    "individual",
    "numberOfIndividualsInGroup",
    "listOfIndividualsInGroup",
    "specializations",
    "generalizations",
    "notes",
    "root",
  ],
};

export const DISPLAY: {
  [key: string]: string;
} = {
  numberOfIndividualsInGroup: "Number Of Individuals In Group",
  listOfIndividualsInGroup: "List Of Individuals In Group",
  capabilitiesRequired: "Capabilities Required",
  evaluationDimension: "Evaluation Dimension",
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
};

export const NO_IMAGE_USER =
  "https://firebasestorage.googleapis.com/v0/b/ontology-41607.appspot.com/o/profilePicture%2Fno-img.png?alt=media&token=c784a749-6c29-4f7d-9495-f1dc8d948ae3";
