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
  /** For a part: the node that OWNS it (empty ⇒ owned here). Drives parts inheritance. */
  inheritedFrom?: string;
  optional?: boolean;
  /**
   * For a stored parts entry on an ATTACHED node: the resolved part id this
   * entry sits behind (null = front; absent = end). Broken nodes store none —
   * their array order is authoritative.
   */
  after?: string | null;
};

/**
 * Parts inheritance state. `source` = the direct generalization the node's
 * parts view resolves through (null = broken/root). `overrides` = optional
 * toggles on VIRTUAL (non-stored) parts only. Replaces both the old
 * `partsOverallSource` and the `inheritance.parts` entry (permanently nulled).
 */
export type IPartsInheritance = {
  source: string | null;
  overrides: { [partId: string]: { optional: boolean } };
};

export type ICollection = {
  collectionName: string;
  nodes: ILinkNode[];
  change?: any;
  changeType?: string;
};
export type IInheritance = {
  [key: string]: {
    ref: string | null;
    /** Display title of the node in `ref` (empty when `ref` is null). */
    title: string;
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
  inheritedPartsDetails: InheritedPartsDetail[];
  /**
   * The generalization this node draws its parts ARRANGEMENT from, or null when
   * it owns it. A stored CHOICE: it is set at creation and by an explicit user
   * reattach, cleared when the node breaks, and never re-derived.
   * `inheritance.parts.ref` (the owner) is derived from it.
   * ⚠️ LEGACY (materialize model) — replaced by `partsInheritance`; retired by
   * the one-time conversion script.
   */
  partsOverallSource?: string | null;
  /** Ref-based parts inheritance state — see {@link IPartsInheritance}. */
  partsInheritance?: IPartsInheritance;
  /**
   * DERIVED materialized copy of the resolved parts view (read-repair cache).
   * Written by write endpoints for their own node, by the annotation endpoint
   * on repair, and by the backfill sweep — never rendered from directly and
   * never cascaded; freshness is "as of last write/view/sweep".
   */
  resolvedParts?: ILinkNode[];
  specializations: ICollection[];
  generalizations: ICollection[];
  root: string;
  propertyType: {
    [key: string]: string | "string" | "string-array" | "string-select";
  };
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
  rootId?: string;
  oNetTask?: {
    id: string;
    title: string;
  };
  synsets?: string;
  pathIds?: string[];
  parentIds?: string[];
  primaryParentId?: string | null;
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
  collaborators?: string[];
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
    | "sort collections"
    | "edit property"
    | "change select-string";
  fullNode: INode | null;
  changeDetails?: { [key: string]: any };
  reasoning?: string;
  appName?: string;
  detailsOfChange?: any;
  logLLMId?: string;
  /** Pre-computed diff for collection-typed changes */
  diffValue?: DiffCollection[];
  /** Set on child logs to point at the parent log */
  triggeredBy?: {
    logId: string;
    nodeId: string;
    nodeTitle: string;
    changeType: NodeChange["changeType"];
  };
};

export type DiffLinkNode = {
  id: string;
  title: string;
  /** "added" / "removed" relative to the previous state; absent if unchanged. */
  change?: "added" | "removed";
  /** Node moved between collections. */
  changeType?: "sort";
  optional?: boolean;
  optionalChange?: "added" | "removed";
};

export type DiffCollection = {
  collectionName: string;
  /** "added" / "removed" relative to the previous state; absent if unchanged. */
  change?: "added" | "removed";
  /** Collection itself moved (only for `sort collections` diffs). */
  changeType?: "sort";
  nodes: DiffLinkNode[];
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
  outlineSpineOnly?: boolean;
  outlineLoadChildren?: boolean;
  hasUnresolvedChildren?: boolean;
};

export interface TreeViewNode {
  id: string;
  nodeId: string;
  name: string;
  category: boolean;
  nodeType?: string;
  unclassified?: boolean;
  childIds: string[];
}

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

export type TransferInheritance = {
  from: string;
  to: string;
  symbol: string;
  fromOptional: boolean;
  toOptional: boolean;
  optionalChange: "added" | "removed" | "none";
  hops: number;
};

export type InheritedPartsDetail = {
  generalizationId: string;
  generalizationTitle: string;
  createdAt: any; // Can be either firebase/firestore or firebase-admin/firestore Timestamp
  details: {
    from: string;
    to: string;
    symbol: ">" | "x" | "=" | "+";
    fromTitle: string;
    toTitle: string;
    fromOptional: boolean;
    toOptional: boolean;
    optionalChange: "added" | "removed" | "none";
    hops: number;
    userOverride?: boolean;
  }[];
  nonPickedOnes: {
    [fromId: string]: {
      id: string;
      title: string;
    }[];
  };
};
