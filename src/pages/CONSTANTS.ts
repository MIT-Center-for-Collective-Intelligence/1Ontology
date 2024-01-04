import {
  IActivity,
  IActor,
  IEvaluation,
  IGroup,
  IIncentive,
  IProcess,
  IReward,
  IRole,
} from " @components/types/IOntology";


// TO-DO: Consider storing this data in the database to identify ontology types in the project
// Defining an object to hold initial values for various ontology types
export const ONTOLOGY_TYPES: {
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
    subOntologies: {
      Actor: {},
      Process: {},
      Specializations: {},
      "Evaluation Dimension": {},
    },
    ontologyType: "Activity",
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
    subOntologies: {
      Specializations: {},
    },
    ontologyType: "Actor",
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
    subOntologies: { Role: {}, Specializations: {} },
    ontologyType: "Process",
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
    subOntologies: {
      Specializations: {},
    },
    ontologyType: "Evaluation Dimension",
  },

  // Definition for Role ontology type
  Role: {
    title: "",
    description: "",
    subOntologies: { Actor: {}, Specializations: {}, Incentive: {} },
    plainText: {
      "Role type": "",
      Units: "",
      "Capabilities required": "",
      notes: "",
    },
    ontologyType: "Role",
  },

  // Definition for Reward ontology type
  Reward: {
    title: "",
    description: "",
    subOntologies: { Specializations: {} },
    plainText: {
      Units: "",
      "Reward type": "",
    },
    ontologyType: "Reward",
  },

  // Definition for Incentive ontology type
  Incentive: {
    title: "",
    description: "",
    subOntologies: {
      Specializations: {},
      "Evaluation Dimension": {},
      Reward: {},
    },
    plainText: {
      "Reward function": "",
      "Capabilities required": "",
      notes: "",
    },
    ontologyType: "Incentive",
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
    subOntologies: {
      Specializations: {},
      Individual: {},
    },
    ontologyType: "Group",
  },
};
// TO-DO: Consider storing this data in the database to identify ontology types in the project