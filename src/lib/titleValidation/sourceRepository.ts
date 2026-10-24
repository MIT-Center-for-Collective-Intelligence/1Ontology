import fs from "fs/promises";
import path from "path";
import { TitleValidationError } from "./engine";
import { STUDY_COLLECTION } from "./repository";
import type { QuickState } from "./quick";
import type { SourceState } from "./sourceReview";

let queue: Promise<unknown> = Promise.resolve();
export async function withSourceStudy<T>(
  id: string,
  uid: string,
  preview: boolean,
  seed: () => QuickState,
  mutate: (state: SourceState) => {
    result: T;
    event?: Record<string, unknown>;
  },
) {
  if (
    !/^(quick-title-verification-|software-qa-quick-title-)[a-zA-Z0-9_-]+$/.test(
      id,
    )
  )
    throw new TitleValidationError(400, "Unknown review identifier.");
  if (preview) {
    if (
      process.env.NODE_ENV !== "development" ||
      process.env.TITLE_VALIDATION_LOCAL_PREVIEW !== "1"
    )
      throw new TitleValidationError(403, "Preview disabled.");
    const execute = async () => {
      const dir =
        process.env.TITLE_VALIDATION_PREVIEW_DIR ||
        path.join(process.cwd(), ".title-validation-preview");
      await fs.mkdir(dir, { recursive: true, mode: 0o700 });
      const file = path.join(dir, id + ".source-v2.json");
      let state: SourceState;
      try {
        state = JSON.parse(await fs.readFile(file, "utf8"));
      } catch (e: any) {
        if (e.code !== "ENOENT") throw e;
        let legacy: QuickState;
        try {
          legacy = JSON.parse(
            await fs.readFile(path.join(dir, id + ".json"), "utf8"),
          );
        } catch (e: any) {
          if (e.code !== "ENOENT") throw e;
          legacy = seed();
        }
        state = { legacy, answers: {}, drafts: {} };
      }
      // Coordinator changes in the shared preview study take effect here too.
      try {
        state.legacy = JSON.parse(
          await fs.readFile(path.join(dir, id + ".json"), "utf8"),
        );
      } catch (e: any) {
        if (e.code !== "ENOENT") throw e;
      }
      const before = JSON.stringify(state.legacy),
        oldAnswers = JSON.parse(JSON.stringify(state.answers));
      const result = mutate(state);
      if (JSON.stringify(state.legacy) !== before)
        throw Error("Historical reviews must not change");
      for (const [key, a] of Object.entries(oldAnswers))
        if (JSON.stringify(state.answers[key]) !== JSON.stringify(a))
          throw Error("Saved source answers must not change");
      await fs.writeFile(file + ".tmp", JSON.stringify(state), { mode: 0o600 });
      await fs.rename(file + ".tmp", file);
      if (result.event)
        await fs.appendFile(
          file + ".events.jsonl",
          JSON.stringify(result.event) + "\n",
          { mode: 0o600 },
        );
      return result.result;
    };
    const pending = queue.then(execute, execute);
    queue = pending.catch(() => undefined);
    return pending;
  }
  const { db } = await import("../firestoreServer/admin");
  return db.runTransaction(async (tx) => {
    const ref = db.collection(STUDY_COLLECTION).doc(id),
      doc = await tx.get(ref);
    const names = ["answers", "drafts", "sourceAnswersV2", "sourceDraftsV2"];
    const records = await Promise.all(
      names.map((name) =>
        tx.get(ref.collection(name).where("reviewerId", "==", uid)),
      ),
    );
    const rows = records.map((s) =>
      Object.fromEntries(s.docs.map((d) => [d.id, d.data()])),
    );
    let legacy: QuickState;
    if (doc.exists)
      legacy = {
        study: doc.data()!.study,
        answers: rows[0] as any,
        drafts: rows[1] as any,
      };
    else if (id.startsWith("software-qa-")) legacy = seed();
    else
      throw new TitleValidationError(
        404,
        "This review has not been prepared yet.",
      );
    const state: SourceState = {
      legacy,
      answers: rows[2] as any,
      drafts: rows[3] as any,
    };
    const original = JSON.parse(JSON.stringify(state));
    const result = mutate(state);
    if (JSON.stringify(state.legacy) !== JSON.stringify(original.legacy))
      throw Error("Historical reviews must not change");
    for (const [key, answer] of Object.entries(original.answers))
      if (JSON.stringify(state.answers[key]) !== JSON.stringify(answer))
        throw Error("Saved source answers must not change");
    if (!doc.exists) tx.create(ref, { study: legacy.study });
    for (const [key, answer] of Object.entries(state.answers)) {
      if (!original.answers[key])
        tx.create(ref.collection("sourceAnswersV2").doc(key), answer);
      else if (JSON.stringify(answer) !== JSON.stringify(original.answers[key]))
        throw Error("Saved source answers must not change");
    }
    for (const [key, draft] of Object.entries(state.drafts))
      if (JSON.stringify(draft) !== JSON.stringify(original.drafts[key]))
        tx.set(ref.collection("sourceDraftsV2").doc(key), draft);
    if (result.event)
      tx.create(ref.collection("events").doc(), {
        ...result.event,
        at: new Date().toISOString(),
      });
    return result.result;
  });
}
