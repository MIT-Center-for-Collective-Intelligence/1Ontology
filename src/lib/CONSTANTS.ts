import { DESIGN_SYSTEM_COLORS } from "./theme/colors";

// TO-DO: Consider storing this data in the database to identify node types in the project

// Defining an object to hold initial values for various node types

// TO-DO: Consider storing this data in the database to identify node types in the project

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
  parts: "Parts",
  isPartOf: "Is Part of",
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
