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
  objectsActedOn: "Objects Acted On",
  ONetID: "O*Net ID",
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
export const WS_URL = development
  ? `ws://${process.env.NEXT_PUBLIC_DEV_WS_SERVER}/ws`
  : `wss://${process.env.NEXT_PUBLIC_WS_SERVER}/ws`;

export const CHAT_DISCUSSION_TABS = [
  {
    id: "discussion",
    title: "Discussion",
    placeholder: "Share your thoughts or start a discussion...",
  },
  {
    id: "bug_report",
    title: "Bug Reports",
    placeholder: "Describe the bug you encountered...",
  },
  {
    id: "feature_request",
    title: "Feature Requests",
    placeholder: "Suggest a new feature or improvement...",
  },
  { id: "help", title: "Help", placeholder: "Ask for help or guidance..." },
];

export const PROPERTIES_TO_IMPROVE: { [nodeType: string]: string[] } | any = {
  allTypes: [
    "title",
    "description",
    "specializations",
    "generalizations",
    "parts",
    "isPartOf",
  ],
  actor: ["abilities", "typeOfActor"],
  activity: [
    "actor",
    "objectsActedOn",
    "evaluationDimension",
    "PreConditions",
    "postConditions",
  ],
  object: ["lifeSpan", "modifiability", "perceivableProperties"],
  evaluationDEmention: [
    "criteriaForAcceptability",
    "directionOfDesirability",
    "evaluationType",
    "measurementUnits",
  ],
  reward: [
    "units",
    "capabilitiesRequired",
    "rewardFunction",
    "evaluationDimension",
    "reward",
  ],
};
