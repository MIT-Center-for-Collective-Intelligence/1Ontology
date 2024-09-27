/**/

import { Timestamp } from "firebase/firestore";

export type IChildNode = {
  id: string;
  category?: string;
  editMode?: boolean;
  new?: boolean;
};

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

export type INode = {
  id: string;
  title: string;
  deleted: boolean;
  properties: { [propertyName: string]: any };
  inheritance: {
    [key: string]: {
      ref: string | null;
      inheritanceType:
        | "neverInherit"
        | "alwaysInherit"
        | "inheritUnlessAlreadyOverRidden"
        | "inheritAfterReview";
    };
  };
  specializations: {
    [key: string]: {
      id: string;
    }[];
  };
  generalizations: {
    [key: string]: {
      id: string;
    }[];
  };
  propertyOf?: {
    [propertyName: string]: {
      [collectionName: string]: {
        id: string;
      }[];
    };
  };
  root: string;
  parents: string[];
  propertyType: { [key: string]: string };
  nodeType: INodeTypes;

  category?: boolean;
  locked?: boolean;
  editMode?: boolean;
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
