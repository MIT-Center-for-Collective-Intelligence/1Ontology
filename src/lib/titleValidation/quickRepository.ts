import fs from "fs/promises";
import path from "path";
import { QuickState } from "./quick";
import { STUDY_COLLECTION } from "./repository";
import { TitleValidationError } from "./engine";

let queue: Promise<unknown> = Promise.resolve();
export async function withQuickStudy<T>(
  id: string,
  uid: string,
  preview: boolean,
  mutate: (state: QuickState | null) => {
    state: QuickState | null;
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
      const file = path.join(dir, id + ".json");
      let state: QuickState | null = null;
      try {
        state = JSON.parse(await fs.readFile(file, "utf8"));
      } catch (e: any) {
        if (e.code !== "ENOENT") throw e;
      }
      const change = mutate(state);
      if (change.state) {
        const tmp = file + ".tmp";
        await fs.writeFile(tmp, JSON.stringify(change.state), { mode: 0o600 });
        await fs.rename(tmp, file);
      }
      if (change.event)
        await fs.appendFile(
          file + ".events.jsonl",
          JSON.stringify({ ...change.event, at: new Date().toISOString() }) +
            "\n",
          { mode: 0o600 },
        );
      return change.result;
    };
    const pending = queue.then(execute, execute);
    queue = pending.catch(() => undefined);
    return pending;
  }
  const { db } = await import("../firestoreServer/admin");
  return db.runTransaction(async (tx) => {
    const ref = db.collection(STUDY_COLLECTION).doc(id),
      doc = await tx.get(ref);
    const answers = await tx.get(
      ref.collection("answers").where("reviewerId", "==", uid),
    );
    const drafts = await tx.get(
      ref.collection("drafts").where("reviewerId", "==", uid),
    );
    const original = doc.exists
      ? ({
          study: doc.data()!.study,
          answers: Object.fromEntries(
            answers.docs.map((d) => [d.id, d.data()]),
          ),
          drafts: Object.fromEntries(drafts.docs.map((d) => [d.id, d.data()])),
        } as QuickState)
      : null;
    const change = mutate(
      original ? JSON.parse(JSON.stringify(original)) : null,
    );
    if (change.state) {
      if (
        JSON.stringify(original?.study) !== JSON.stringify(change.state.study)
      )
        tx.set(ref, { study: change.state.study });
      for (const [key, answer] of Object.entries(change.state.answers)) {
        if (!original?.answers[key])
          tx.create(ref.collection("answers").doc(key), answer);
        else if (
          JSON.stringify(original.answers[key]) !== JSON.stringify(answer)
        )
          throw new TitleValidationError(
            409,
            "Saved answers cannot be overwritten.",
          );
      }
      for (const [key, draft] of Object.entries(change.state.drafts))
        if (JSON.stringify(original?.drafts[key]) !== JSON.stringify(draft))
          tx.set(ref.collection("drafts").doc(key), draft);
    }
    if (change.event)
      tx.create(ref.collection("events").doc(), {
        ...change.event,
        at: new Date().toISOString(),
      });
    return change.result;
  });
}
