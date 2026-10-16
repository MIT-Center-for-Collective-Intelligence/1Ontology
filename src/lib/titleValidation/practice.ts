import { createHash, randomBytes } from "crypto";
import {
  TitleValidationError,
  ValidationDataset,
  ValidationState,
} from "./engine";

export const PRACTICE_PREFIX = "human-title-practice-";
export const PRACTICE_ROLES = [
  "practice-a",
  "practice-b",
  "practice-c",
] as const;
export const practiceStudyId = (ownerUid: string): string =>
  PRACTICE_PREFIX + createHash("sha256").update(ownerUid).digest("hex");

export function practiceRole(value: unknown): string {
  const role = value === undefined ? PRACTICE_ROLES[0] : value;
  if (!PRACTICE_ROLES.includes(role as (typeof PRACTICE_ROLES)[number]))
    throw new TitleValidationError(
      400,
      "Choose one of the three practice roles.",
    );
  return role as string;
}

export function newPracticeState(
  ownerUid: string,
  data: ValidationDataset,
): ValidationState {
  return {
    study: {
      id: practiceStudyId(ownerUid),
      datasetVersion: data.version,
      status: "active",
      seed: randomBytes(24).toString("hex"),
      practice: { ownerUid, purpose: "interface-practice" },
      roster: PRACTICE_ROLES.map((reviewerId, i) => ({
        reviewerId,
        label: `Practice role ${String.fromCharCode(65 + i)}`,
      })),
      caseIds: data.cases.map((item) => item.id),
      createdAt: Date.now(),
    },
    answers: {},
    presentations: {},
  };
}

export function verifyPracticeOwner(
  state: ValidationState,
  ownerUid: string,
): void {
  if (
    state.study.id !== practiceStudyId(ownerUid) ||
    state.study.practice?.ownerUid !== ownerUid ||
    state.study.practice?.purpose !== "interface-practice" ||
    state.study.roster.length !== PRACTICE_ROLES.length ||
    !state.study.roster.every((row) =>
      PRACTICE_ROLES.includes(
        row.reviewerId as (typeof PRACTICE_ROLES)[number],
      ),
    )
  )
    throw new TitleValidationError(
      403,
      "This practice copy does not belong to your account.",
    );
}
