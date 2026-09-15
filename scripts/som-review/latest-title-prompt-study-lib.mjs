import {
  inspectTitleAnswer,
  softwareChecks,
} from "./title-prompt-study-lib.mjs";

export const latestSoftwareChecks =
  softwareChecks +
  " For newly split groups, the code also identifies group sizes outside the approximate 5–9-description target so a person can review the exception rationale. A single homogeneous group is not required to split to meet that target.";

export function inspectLatestTitleAnswer(input, rawOutput, status) {
  const result = inspectTitleAnswer(input, rawOutput, status);
  if (result.status === "completed" && result.groups.length > 1) {
    for (const group of result.groups) {
      const size = new Set(group.descriptionNumbers).size;
      if (size < 5 || size > 9)
        result.observations.push(
          `“${group.title}” has ${size} ${size === 1 ? "description" : "descriptions"}. Review its reason for being outside the approximate 5–9 target.`,
        );
    }
  }
  return result;
}
