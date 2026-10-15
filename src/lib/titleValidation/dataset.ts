// Server-side only. Never import the proposal dataset into a reviewer component.
import frozen from "./data/prepilot-v1.json";
import { ValidationDataset, TitleValidationError } from "./engine";
export const getTitleValidationDataset = (): ValidationDataset => {
  const data = frozen as ValidationDataset;
  if (
    data.cases.length !== 5 ||
    new Set(data.cases.map((c) => c.id)).size !== 5 ||
    data.cases.some(
      (c) => !c.currentTitle || !c.description || !c.modelTitles.length,
    )
  ) {
    throw new TitleValidationError(
      500,
      "The frozen pilot dataset is unavailable.",
    );
  }
  return data;
};
