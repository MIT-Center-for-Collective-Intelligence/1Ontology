/**/

import { Timestamp } from "firebase/firestore";

export type IChildNode = {
  title: string;
  id: string;
  category?: string;
  editMode?: boolean;
  new?: boolean;
};

export type IChildCategory = {
  [category: string]: { id: string; title: string }[];
};

export type INodeTypes =
  | "activity"
  | "actor"
  | "process"
  | "evaluationDimension"
  | "role"
  | "incentive"
  | "reward"
  | "group";

export type INodePath = {
  id: string;
  title: string;
  category?: boolean;
};
export type InheritanceType = {
  [key: string]: { ref: string; title: string };
};

export type OntologyInheritance = {
  inheritance: {
    [type: string]: InheritanceType;
  };
};
export type INode = {
  id: string;
  deleted: boolean;
  comments: { message: string; sender: string; editMode?: boolean }[];
  editMode?: boolean;
  plainText: { [key: string]: string };
  children: { [key: string]: any };
  nodeType?: INodeTypes;
  locked?: boolean;
  category?: boolean;
  root: string;
  parents: string[];
} & OntologyInheritance;

export type IActivity = {
  nodeType: INodeTypes;
  plainText: {
    preConditions: string;
    postConditions: string;
    notes: string;
    title: string;
    description: string;
  };
  children: {
    actor: IChildCategory;
    process: IChildCategory;
    specializations: IChildCategory;
    evaluationDimension: IChildCategory;
    dependents: IChildCategory;
    dependencies: IChildCategory;
    generalizations: IChildCategory;
  };
};

export type IActor = {
  nodeType: INodeTypes;
  plainText: {
    typeOfActor: string;
    abilities: string;
    notes: string;
    title: string;
    description: string;
  };
  children: {
    generalizations: IChildCategory;
    specializations: IChildCategory;
  };
};

export type IProcess = {
  nodeType: INodeTypes;
  plainText: {
    typeOfProcess: string;
    subActivities: string;
    dependencies: string;
    performancePredictionModels: string;
    notes: string;
    title: string;
    description: string;
  };
  children: {
    role: IChildCategory;
    specializations: IChildCategory;
    generalizations: IChildCategory;
  };
};

export type IEvaluation = {
  nodeType: INodeTypes;
  plainText: {
    evaluationType: string;
    measurementUnits: string;
    directionOfDesirability: string;
    criteriaForAcceptability: string;
    notes: string;
    title: string;
    description: string;
  };
  children: {
    specializations: IChildCategory;
    generalizations: IChildCategory;
  };
};

export type IRole = {
  nodeType: INodeTypes;
  plainText: {
    roleType: string;
    units: string;
    capabilitiesRequired: string;
    notes: string;
    title: string;
    description: string;
  };
  children: {
    specializations: IChildCategory;
    incentive: IChildCategory;
    actor: IChildCategory;
  };
};

export type IIncentive = {
  nodeType: INodeTypes;
  plainText: {
    rewardFunction: string;
    capabilitiesRequired: string;
    notes: string;
    title: string;
    description: string;
  };
  children: {
    evaluationDimension: IChildCategory;
    specializations: IChildCategory;
    reward: IChildCategory;
  };
};

export type IReward = {
  nodeType: INodeTypes;
  plainText: {
    rewardType: string;
    units: string;
  };
  children: {
    specializations: IChildCategory;
  };
};
export type IGroup = {
  nodeType: INodeTypes;
  plainText: {
    typeOfActor: string;
    abilities: string;
    listOfIndividualsInGroup: string;
    numberOfIndividualsInGroup: string;
    notes: string;
    title: string;
    description: string;
  };
  children: {
    specializations: IChildCategory;
    individual: IChildCategory;
  };
};
export type IUserNode = {
  id: string;
  uname: string;
  node: string;
  field: string;
  previous: string;
  new: string;
  correct: boolean;
  wrong: boolean;
  visible: boolean;
};

export type TreeVisual = {
  [key: string]: {
    id: string;
    isCategory: boolean;
    path: string[];
    title: string;
    specializations: TreeVisual;
  };
};

export type ILockedNode = {
  [id: string]: {
    [field: string]: {
      id: string;
      uname: string;
      node: string;
      field: string;
      deleted: boolean;
      createdAt: Timestamp;
    };
  };
};

export type MainSpecializations = {
  [key: string]: {
    id: string;
    path: string[];
    title: string;
    specializations: MainSpecializations;
  };
};
