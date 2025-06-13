/**/

import { Timestamp } from "firebase/firestore";

export type IChildCategory = {
  [category: string]: { id: string }[];
};

export type INodeTypes =
  | "activity"
  | "actor"
  | "evaluationDimension"
  | "role"
  | "incentive"
  | "reward"
  | "group"
  | "context";

export type INodePath = {
  id: string;
  title: string;
  category?: boolean;
};
export type InheritanceType = {
  ref: string | null;
  title: string;
  inheritanceType:
    | "neverInherit"
    | "alwaysInherit"
    | "inheritUnlessAlreadyOverRidden"
    | "inheritAfterReview";
};

export type ILinkNode = {
  id: string;
  title?: string;
  category?: string;
  editMode?: boolean;
  new?: boolean;
  change?: any;
  changeType?: string;
  randomId?: string;
  inheritedFrom?: string;
  optional?: boolean;
};

export type ICollection = { collectionName: string; nodes: ILinkNode[] };
export type IInheritance = {
  [key: string]: {
    ref: string | null;
    inheritanceType:
      | "neverInherit"
      | "alwaysInherit"
      | "inheritUnlessAlreadyOverRidden"
      | "inheritAfterReview";
  };
};
export type INode = {
  id: string;
  title: string;
  deleted: boolean;
  properties: {
    [propertyName: string]: any;
    parts: ICollection[];
    isPartOf: ICollection[];
  };
  inheritance: IInheritance;
  inheritanceParts: { 
    [nodeId: string]: {
      inheritedFromTitle: string;
      inheritedFromId: string;
    } | null;
  };
  specializations: ICollection[];
  generalizations: ICollection[];
  root: string;
  propertyType: { [key: string]: string | "string" | "string-array" };
  nodeType: INodeTypes;
  textValue: { [propertyName: string]: string };
  createdBy: string;
  //optional keys
  propertyOf?: {
    [propertyName: string]: ICollection[];
  };
  numberOfGeneralizations?: number;
  unclassified?: boolean;
  contributorsByProperty?: { [property: string]: string[] };
  contributors?: string[];
  category?: boolean;
  locked?: boolean;
  images?: {
    url: string;
    path: string;
    uploadedAt: Timestamp;
    uploadedBy: {
      fName: string;
      lName: string;
      uname: string;
      imageUrl: string;
      userId: string;
    };
  }[];
  oNet?: boolean;
  actionAlternatives?: string[];
  appName?: string;
  skillsFuture?: boolean;
  rootId?: string;
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

export type NodeChange = {
  id?: string;
  nodeId: string;
  modifiedBy: string;
  modifiedProperty: string | null;
  previousValue: any;
  newValue: any;
  modifiedAt: any;
  changeType:
    | "change text"
    | "sort elements"
    | "remove element"
    | "add element"
    | "add elements"
    | "remove elements"
    | "modify elements"
    | "add property"
    | "remove property"
    | "delete node"
    | "add node"
    | "add collection"
    | "delete collection"
    | "edit collection"
    | "add images"
    | "remove images"
    | "sort collections";
  fullNode: INode | null;
  changeDetails?: { [key: string]: any };
  reasoning?: string;
  skillsFuture?: boolean;
  appName?: string;
  detailsOfChange?: any;
};

export type PromptChange = {
  previousValue: {
    systemPrompt: {
      id: string;
      value?: string;
      editablePart?: string;
      endClose?: string;
    }[];
  };
  newValue: {
    systemPrompt: {
      id: string;
      value?: string;
      editablePart?: string;
      endClose?: string;
    }[];
  };
  changeDetails: {
    [id: string]: {
      previousValue: string;
      newValue: string;
    };
  };
  modifiedAt: any;
  modifiedBy: string;
  modifiedByDetails: {
    fName: string;
    lName: string;
    imageUrl: string;
  };
};

export type TreeData = {
  id: string;
  name: string;
  children?: TreeData[];
  category?: boolean;
  nodeType: string;
  nodeId: string;
  actionAlternatives?: string[];
  task?: boolean;
  comments?: boolean;
  unclassified?: boolean;
};

/**
 * Temporary types for activity flow implementation
 */

export const ACTIVITY_TYPES = {
  SEQUENTIAL: "sequential",
  PARALLEL: "parallel",
  CONDITION: "condition",
  LOOP: "loop",
  TASK: "task",
} as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[keyof typeof ACTIVITY_TYPES];

export interface IActivity {
  name: string;
  id: string;
  type: ActivityType;
  variables?: string[];
  condition?: Record<string, boolean>;
  loop_condition?: Record<string, boolean>;
  sub_activities?: IActivity[];
}

export interface ISequentialActivity extends IActivity {
  type: typeof ACTIVITY_TYPES.SEQUENTIAL;
  sub_activities: IActivity[];
}
export interface IParallelActivity extends IActivity {
  type: typeof ACTIVITY_TYPES.PARALLEL;
  sub_activities: IActivity[];
}
export interface IConditionActivity extends IActivity {
  type: typeof ACTIVITY_TYPES.CONDITION;
  variables: string[];
  condition: Record<string, boolean>;
  sub_activities: IActivity[];
}
export interface ILoopActivity extends IActivity {
  type: typeof ACTIVITY_TYPES.LOOP;
  variables: string[];
  loop_condition: Record<string, boolean>;
  sub_activities: IActivity[];
}
export interface ITaskActivity extends IActivity {
  type: typeof ACTIVITY_TYPES.TASK;
}

export type AlgorithmType =
  | typeof ACTIVITY_TYPES.SEQUENTIAL
  | typeof ACTIVITY_TYPES.PARALLEL;

export interface IAlgorithm {
  name: string;
  id?: string;
  type: AlgorithmType;
  sub_activities: IActivity[];
  performance_model: string;
  advantages: string;
  disadvantages: string;
}

// Type guard functions
export function isSequentialActivity(
  activity: IActivity,
): activity is ISequentialActivity {
  return activity.type === ACTIVITY_TYPES.SEQUENTIAL;
}

export function isParallelActivity(
  activity: IActivity,
): activity is IParallelActivity {
  return activity.type === ACTIVITY_TYPES.PARALLEL;
}

export function isConditionActivity(
  activity: IActivity,
): activity is IConditionActivity {
  return activity.type === ACTIVITY_TYPES.CONDITION;
}

export function isLoopActivity(activity: IActivity): activity is ILoopActivity {
  return activity.type === ACTIVITY_TYPES.LOOP;
}

export function isTaskActivity(activity: IActivity): activity is ITaskActivity {
  return activity.type === ACTIVITY_TYPES.TASK;
}
