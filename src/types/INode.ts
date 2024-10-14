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
  | "group";

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
    [propertyName: string]: ICollection[] | string | boolean | number;
  };
  inheritance: IInheritance;
  specializations: ICollection[];
  generalizations: ICollection[];
  propertyOf?: {
    [propertyName: string]: ICollection[];
  };
  root: string;
  propertyType: { [key: string]: string };
  nodeType: INodeTypes;
  category?: boolean;
  locked?: boolean;
  numberOfGeneralizations: number;
  textValue: { [propertyName: string]: string };
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
    | "modify elements"
    | "add property"
    | "remove property"
    | "delete node"
    | "add node"
    | "add collection"
    | "delete collection"
    | "edit collection";
  fullNode: INode | null;
  changeDetails?: { [key: string]: any };
};
