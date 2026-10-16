import fs from "fs/promises";
import path from "path";
import { createHash, randomUUID } from "crypto";
import {
  FeedbackRequest,
  feedbackHash,
  nextFeedback,
  RelationshipError,
} from "./feedback";
import type { RelationshipFeedback } from "../../types/IRelationshipReview";

export const RELATIONSHIP_COLLECTION = "relationshipReviewDatasetsV1";
const actorId = (uid: string) => createHash("sha256").update(uid).digest("hex");
interface ReviewState {
  feedback: Record<string, RelationshipFeedback>;
  requests: Record<string, { hash: string; answer: RelationshipFeedback }>;
}
let localQueue: Promise<unknown> = Promise.resolve();
async function localState<T>(
  uid: string,
  version: string,
  mutate: (state: ReviewState) => T,
  write: boolean,
): Promise<T> {
  const execute = async () => {
    const dir = path.join(process.cwd(), ".relationship-review-preview");
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    const file = path.join(dir, version + "-" + actorId(uid) + ".json");
    let state: ReviewState = { feedback: {}, requests: {} };
    try {
      state = JSON.parse(await fs.readFile(file, "utf8"));
    } catch (e: any) {
      if (e.code !== "ENOENT") throw e;
    }
    const result = mutate(state);
    if (write) {
      const temp = file + "." + randomUUID() + ".tmp";
      await fs.writeFile(temp, JSON.stringify(state), {
        flag: "wx",
        mode: 0o600,
      });
      await fs.rename(temp, file);
    }
    return result;
  };
  const result = localQueue.then(execute, execute);
  localQueue = result.catch(() => undefined);
  return result;
}
export async function readFeedback(
  uid: string,
  version: string,
  preview = false,
  expectedSha?: string,
): Promise<Record<string, RelationshipFeedback>> {
  if (preview) return localState(uid, version, (s) => s.feedback, false);
  const { db } = await import("../firestoreServer/admin");
  const datasetRef = db.collection(RELATIONSHIP_COLLECTION).doc(version);
  const manifest = await datasetRef.get();
  if (
    manifest.exists &&
    expectedSha &&
    manifest.data()!.datasetSha256 !== expectedSha
  )
    throw new RelationshipError(
      409,
      "This proposal set changed without a new version. Existing feedback is preserved; the review needs a corrected release.",
    );
  const docs = await datasetRef
    .collection("reviewers")
    .doc(actorId(uid))
    .collection("answers")
    .get();
  return Object.fromEntries(
    docs.docs.map((d) => [d.id, d.data() as RelationshipFeedback]),
  );
}
export async function saveFeedback(
  uid: string,
  request: FeedbackRequest,
  preview = false,
): Promise<RelationshipFeedback> {
  const hash = feedbackHash(request),
    savedAt = new Date().toISOString();
  if (preview)
    return localState(
      uid,
      request.datasetVersion,
      (s) => {
        const prior = s.requests[request.requestId];
        if (prior) {
          if (prior.hash !== hash)
            throw new RelationshipError(
              409,
              "This save identifier was already used for different feedback.",
            );
          return prior.answer;
        }
        const answer = nextFeedback(
          request,
          s.feedback[request.caseId] || null,
          savedAt,
        );
        s.feedback[request.caseId] = answer;
        s.requests[request.requestId] = { hash, answer };
        return answer;
      },
      true,
    );
  const { db } = await import("../firestoreServer/admin");
  const datasetRef = db
    .collection(RELATIONSHIP_COLLECTION)
    .doc(request.datasetVersion);
  const ref = datasetRef.collection("reviewers").doc(actorId(uid));
  return db.runTransaction(async (tx) => {
    const answerRef = ref.collection("answers").doc(request.caseId),
      eventRef = ref.collection("events").doc(request.requestId);
    const [current, event, manifest, reviewer] = await Promise.all([
      tx.get(answerRef),
      tx.get(eventRef),
      tx.get(datasetRef),
      tx.get(ref),
    ]);
    if (
      manifest.exists &&
      manifest.data()!.datasetSha256 !== request.datasetSha256
    )
      throw new RelationshipError(
        409,
        "This proposal set changed without a new version. Existing feedback is preserved; the review needs a corrected release.",
      );
    if (event.exists) {
      if (event.data()!.hash !== hash)
        throw new RelationshipError(
          409,
          "This save identifier was already used for different feedback.",
        );
      return event.data()!.answer as RelationshipFeedback;
    }
    const answer = nextFeedback(
      request,
      current.exists ? (current.data() as RelationshipFeedback) : null,
      savedAt,
    );
    if (!manifest.exists)
      tx.create(datasetRef, {
        datasetVersion: request.datasetVersion,
        datasetSha256: request.datasetSha256,
        createdAt: savedAt,
      });
    if (!reviewer.exists)
      tx.create(ref, {
        softwareQA: uid.startsWith("software-qa:"),
        createdAt: savedAt,
      });
    tx.set(answerRef, answer);
    // Every revision is retained. An agreement is feedback only; no nodes are written.
    tx.create(eventRef, {
      hash,
      answer,
      previousRevision: current.exists ? current.data()!.revision : 0,
      datasetSha256: request.datasetSha256,
      at: savedAt,
      softwareQA: uid.startsWith("software-qa:"),
    });
    return answer;
  });
}
