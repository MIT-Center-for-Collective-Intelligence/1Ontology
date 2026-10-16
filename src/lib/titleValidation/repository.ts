import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import {
  TitleValidationError,
  ValidationState,
  ValidationAnswer,
} from "./engine";

export const STUDY_COLLECTION = "titleValidationStudiesV1";
const previewDirectory = () =>
  process.env.TITLE_VALIDATION_PREVIEW_DIR ||
  path.join(process.cwd(), ".title-validation-preview");
const safeId = (id: string) => {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id))
    throw new TitleValidationError(400, "Invalid pilot identifier.");
  return id;
};
let previewQueue: Promise<unknown> = Promise.resolve();
export function localPreviewEnabled(
  host?: string,
  remoteAddress?: string,
): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.TITLE_VALIDATION_LOCAL_PREVIEW === "1" &&
    /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host || "") &&
    ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remoteAddress || "")
  );
}
async function previewLock(
  directory: string,
  id: string,
): Promise<() => Promise<void>> {
  const lock = path.join(directory, id + ".lock");
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await fs.mkdir(lock);
      await fs.writeFile(
        path.join(lock, "owner.json"),
        JSON.stringify({ pid: process.pid }),
        { flag: "wx", mode: 0o600 },
      );
      return () => fs.rm(lock, { recursive: true });
    } catch (error: any) {
      if (error.code !== "EEXIST") throw error;
      try {
        const owner = JSON.parse(
          await fs.readFile(path.join(lock, "owner.json"), "utf8"),
        );
        try {
          process.kill(owner.pid, 0);
        } catch (probe: any) {
          if (probe.code === "ESRCH") {
            await fs.rename(lock, lock + ".stale-" + randomUUID());
            continue;
          }
        }
      } catch (probe: any) {
        if (!["ENOENT", "EEXIST"].includes(probe.code)) throw probe;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  throw new TitleValidationError(
    409,
    "The local preview is busy. Your answer has not been changed; retry shortly.",
  );
}
interface Mutation<T> {
  state: ValidationState | null;
  result: T;
  answer?: ValidationAnswer;
  event?: Record<string, unknown>;
}
export async function withStudy<T>(
  id: string,
  preview: boolean,
  mutate: (state: ValidationState | null) => Mutation<T>,
): Promise<T> {
  safeId(id);
  if (preview) {
    if (
      process.env.NODE_ENV !== "development" ||
      process.env.TITLE_VALIDATION_LOCAL_PREVIEW !== "1"
    )
      throw new TitleValidationError(403, "Local preview is disabled.");
    const execute = async () => {
      const dir = previewDirectory();
      await fs.mkdir(dir, { recursive: true, mode: 0o700 });
      const file = path.join(dir, id + ".json");
      const unlock = await previewLock(dir, id);
      try {
        let current: ValidationState | null = null;
        try {
          current = JSON.parse(await fs.readFile(file, "utf8"));
        } catch (error: any) {
          if (error.code !== "ENOENT") throw error;
        }
        const change = mutate(current);
        if (!change.state) return change.result;
        if (JSON.stringify(change.state) !== JSON.stringify(current)) {
          const temporary = file + "." + randomUUID() + ".tmp";
          await fs.writeFile(temporary, JSON.stringify(change.state), {
            flag: "wx",
            mode: 0o600,
          });
          await fs.rename(temporary, file);
        }
        if (change.event)
          await fs.appendFile(
            path.join(dir, id + ".events.jsonl"),
            JSON.stringify({ ...change.event, at: new Date().toISOString() }) +
              "\n",
            { mode: 0o600 },
          );
        return change.result;
      } finally {
        await unlock();
      }
    };
    const pending = previewQueue.then(execute, execute);
    previewQueue = pending.catch(() => undefined);
    return pending;
  }
  const { db } = await import("../firestoreServer/admin");
  return db.runTransaction(async (transaction) => {
    const ref = db.collection(STUDY_COLLECTION).doc(id),
      doc = await transaction.get(ref);
    let current: ValidationState | null = null;
    if (doc.exists) {
      const answerDocs = await transaction.get(ref.collection("answers"));
      current = {
        study: doc.data()!.study,
        presentations: doc.data()!.presentations || {},
        answers: Object.fromEntries(
          answerDocs.docs.map((d) => [d.id, d.data() as ValidationAnswer]),
        ),
      };
    }
    const change = mutate(current);
    if (!change.state) return change.result;
    if (
      !current ||
      JSON.stringify(change.state.study) !== JSON.stringify(current.study) ||
      JSON.stringify(change.state.presentations) !==
        JSON.stringify(current.presentations)
    ) {
      transaction.set(ref, {
        study: change.state.study,
        presentations: change.state.presentations,
      });
    }
    if (change.answer && !current?.answers[change.answer.id])
      transaction.create(
        ref.collection("answers").doc(change.answer.id),
        change.answer,
      );
    if (change.event)
      transaction.create(ref.collection("events").doc(), {
        ...change.event,
        at: new Date().toISOString(),
      });
    return change.result;
  });
}
