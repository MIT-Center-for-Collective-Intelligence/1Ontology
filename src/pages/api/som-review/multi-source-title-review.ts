import type { NextApiRequest, NextApiResponse } from "next";
import { actorFor } from "../../../lib/titleValidation/api";
import { TitleValidationError } from "../../../lib/titleValidation/engine";
import {
  MULTI_SOURCE_COMMENT_LIMIT,
  MULTI_SOURCE_STUDY_ID,
  MultiSourceCase,
  MultiSourceRatedItem,
  MultiSourceReview,
  MultiSourceSession,
} from "../../../lib/titleValidation/multiSourceContract";
import { STUDY_COLLECTION } from "../../../lib/titleValidation/repository";

interface Study {
  version: string;
  roster: { reviewerId: string; label: string }[];
  cases: MultiSourceCase[];
}

const identifier = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value);

function hasValidCases(cases: MultiSourceCase[]) {
  if (cases.length !== 25 || new Set(cases.map((item) => item?.id)).size !== 25)
    return false;
  return cases.every((item) => {
    if (!identifier(item?.id) || !item.originalTitle || typeof item.originalTitle !== "string" ||
        typeof item.reason !== "string" || !Array.isArray(item.descriptions) ||
        item.descriptions.length < 2 || item.descriptions.length > 10 ||
        !Array.isArray(item.groups) || !item.groups.length) return false;
    const numbers = new Set(item.descriptions.map((description) => description?.number));
    return numbers.size === item.descriptions.length &&
      item.descriptions.every((description) =>
        Number.isInteger(description?.number) && description.number > 0 &&
        typeof description.sourceId === "string" && description.sourceId.length > 0 &&
        typeof description.text === "string" && description.text.length > 0) &&
      new Set(item.groups.map((group) => group?.id)).size === item.groups.length &&
      item.groups.every((group) =>
        identifier(group?.id) && typeof group.title === "string" && group.title.length > 0 &&
        typeof group.reason === "string" && Array.isArray(group.descriptionNumbers) &&
        group.descriptionNumbers.length > 0 &&
        group.descriptionNumbers.every((number) => numbers.has(number)));
  });
}

function loadStudy(value: unknown, uid: string) {
  if (!value) throw new TitleValidationError(404, "This batch has not been opened yet.");
  const study = value as Study;
  const reviewer = Array.isArray(study.roster) &&
    study.roster.find((member) => member?.reviewerId === uid);
  if (!reviewer) throw new TitleValidationError(403, "This batch is available only to assigned reviewers.");
  if (study.version !== MULTI_SOURCE_STUDY_ID || typeof reviewer.label !== "string" ||
      !Array.isArray(study.cases) || !hasValidCases(study.cases))
    throw new TitleValidationError(503, "This batch could not be loaded. Please contact the coordinator.");
  return { study, reviewerLabel: reviewer.label };
}

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function ratedItem(value: unknown, label: string): MultiSourceRatedItem {
  if (!object(value) ||
      (value.rating !== "acceptable" && value.rating !== "not_acceptable" && value.rating !== "unsure"))
    throw new TitleValidationError(400, `Choose a rating for ${label}.`);
  if (typeof value.comment !== "string" || value.comment.length > MULTI_SOURCE_COMMENT_LIMIT)
    throw new TitleValidationError(400, `The ${label} comment must be ${MULTI_SOURCE_COMMENT_LIMIT} characters or fewer.`);
  return { rating: value.rating, comment: value.comment };
}

function reviewContent(item: MultiSourceCase, body: Record<string, unknown>) {
  const titles = body.titles;
  if (!object(titles) || Object.keys(titles).length !== item.groups.length ||
      item.groups.some(({ id }) => !Object.prototype.hasOwnProperty.call(titles, id)))
    throw new TitleValidationError(400, "Rate every proposed title in this activity.");
  return {
    titles: Object.fromEntries(item.groups.map(({ id }, index) =>
      [id, ratedItem(titles[id], `proposed title ${index + 1}`)])),
    categorization: ratedItem(body.categorization, "categorization"),
  };
}

function sameRatedItem(a: MultiSourceRatedItem | undefined, b: MultiSourceRatedItem) {
  return a?.rating === b.rating && a.comment === b.comment;
}

function sameReviewContent(current: MultiSourceReview, submitted: Omit<MultiSourceReview, "revision" | "updatedAt">) {
  return sameRatedItem(current.categorization, submitted.categorization) &&
    Object.keys(current.titles).length === Object.keys(submitted.titles).length &&
    Object.entries(submitted.titles).every(([id, answer]) => sameRatedItem(current.titles[id], answer));
}

export const config = { api: { bodyParser: { sizeLimit: "128kb" } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("Vary", "Authorization");
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed." });
  }
  try {
    const actor = await actorFor(req, {});
    if (actor.preview || !identifier(actor.uid))
      throw new TitleValidationError(403, "Sign in with an assigned reviewer account.");
    if (process.env.TITLE_VALIDATION_RELEASED !== "1")
      throw new TitleValidationError(503, "This review is not enabled yet.");
    const { db } = await import("../../../lib/firestoreServer/admin");
    const studyRef = db.collection(STUDY_COLLECTION).doc(MULTI_SOURCE_STUDY_ID);
    const reviewsRef = studyRef.collection("reviews").doc(actor.uid).collection("cases");

    if (req.method === "GET") {
      const { study, reviewerLabel } = loadStudy((await studyRef.get()).data(), actor.uid);
      const allowedIds = new Set(study.cases.map(({ id }) => id));
      const ownReviews = (await reviewsRef.get()).docs.filter(({ id }) => allowedIds.has(id));
      const session: MultiSourceSession = {
        version: study.version,
        reviewerLabel,
        cases: study.cases,
        reviews: Object.fromEntries(ownReviews.map((record) => [record.id, record.data() as MultiSourceReview])),
      };
      return res.status(200).json(session);
    }

    const body = req.body;
    if (!object(body) || !identifier(body.caseId) ||
        typeof body.expectedRevision !== "number" || !Number.isSafeInteger(body.expectedRevision) ||
        body.expectedRevision < 0 ||
        Object.keys(body).some((key) => !["version", "caseId", "titles", "categorization", "expectedRevision"].includes(key)))
      throw new TitleValidationError(400, "Invalid review submission.");
    const caseId = body.caseId;
    const saved = await db.runTransaction(async (transaction) => {
      const { study } = loadStudy((await transaction.get(studyRef)).data(), actor.uid);
      if (body.version !== study.version)
        throw new TitleValidationError(409, "This batch has changed. Reload it before saving.");
      const item = study.cases.find(({ id }) => id === caseId);
      if (!item) throw new TitleValidationError(404, "This activity is not in the batch.");
      const submitted = reviewContent(item, body);
      const reviewRef = reviewsRef.doc(caseId);
      const current = (await transaction.get(reviewRef)).data() as MultiSourceReview | undefined;
      if (current && sameReviewContent(current, submitted)) return current;
      const revision = current?.revision ?? 0;
      if (body.expectedRevision !== revision)
        throw new TitleValidationError(409, "A newer review was saved. Reload it before making changes.");
      const next: MultiSourceReview = { ...submitted, revision: revision + 1, updatedAt: new Date().toISOString() };
      transaction.set(reviewRef, next);
      return next;
    });
    return res.status(200).json(saved);
  } catch (error) {
    if (error instanceof TitleValidationError)
      return res.status(error.status).json({ error: error.message });
    return res.status(503).json({ error: "The review service is temporarily unavailable. Please try again." });
  }
}
