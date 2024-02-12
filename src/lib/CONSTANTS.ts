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

// TO-DO: Consider storing this data in the database to identify ontology types in the project

// Defining an object to hold initial values for various ontology types
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
  // Definition for Activity ontology type
  Activity: {
    title: "",
    description: "",
    plainText: {
      notes: "",
      Preconditions: "",
      Postconditions: "",
    },
    children: {
      Actor: {},
      Process: {},
      Specializations: {},
      "Evaluation Dimension": {},
    },
    nodeType: "Activity",
  },

  // Definition for Actor ontology type
  Actor: {
    title: "",
    description: "",
    plainText: {
      "Type of actor": "",
      notes: "",
      Abilities: "",
    },
    children: {
      Specializations: {},
    },
    nodeType: "Actor",
  },

  // Definition for Process ontology type
  Process: {
    title: "",
    description: "",
    plainText: {
      "Type of Process": "",
      notes: "",
      Subactivities: "",
      Dependencies: "",
      "Performance prediction models": "",
    },
    children: { Role: {}, Specializations: {} },
    nodeType: "Process",
  },

  // Definition for Evaluation Dimension ontology type
  "Evaluation Dimension": {
    title: "",
    description: "",
    plainText: {
      "Evaluation type": "",
      notes: "",
      "Measurement units": "",
      "Direction of desirability": "",
      "Criteria for acceptability": "",
    },
    children: {
      Specializations: {},
    },
    nodeType: "Evaluation Dimension",
  },

  // Definition for Role ontology type
  Role: {
    title: "",
    description: "",
    children: { Actor: {}, Specializations: {}, Incentive: {} },
    plainText: {
      "Role type": "",
      Units: "",
      "Capabilities required": "",
      notes: "",
    },
    nodeType: "Role",
  },

  // Definition for Reward ontology type
  Reward: {
    title: "",
    description: "",
    children: { Specializations: {} },
    plainText: {
      Units: "",
      "Reward type": "",
    },
    nodeType: "Reward",
  },

  // Definition for Incentive ontology type
  Incentive: {
    title: "",
    description: "",
    children: {
      Specializations: {},
      "Evaluation Dimension": {},
      Reward: {},
    },
    plainText: {
      "Reward function": "",
      "Capabilities required": "",
      notes: "",
    },
    nodeType: "Incentive",
  },

  // Definition for Group ontology type
  Group: {
    title: "",
    description: "",
    plainText: {
      "Type of actor": "",
      Abilities: "",
      "List of individuals in group": "",
      "Number of individuals in group": "",
      notes: "",
    },
    children: {
      Specializations: {},
      Individual: {},
    },
    nodeType: "Group",
  },
};
// TO-DO: Consider storing this data in the database to identify ontology types in the project

export const NO_IMAGE_USER =
  "https://firebasestorage.googleapis.com/v0/b/ontology-41607.appspot.com/o/profilePicture%2Fno-img.png?alt=media&token=c784a749-6c29-4f7d-9495-f1dc8d948ae3";
