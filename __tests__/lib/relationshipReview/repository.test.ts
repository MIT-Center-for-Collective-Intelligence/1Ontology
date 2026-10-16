import {
  saveFeedback,
  readFeedback,
  RELATIONSHIP_COLLECTION,
} from "../../../src/lib/relationshipReview/repository";
import type { FeedbackRequest } from "../../../src/lib/relationshipReview/feedback";
const docs = new Map<string, any>();
const snapshot = (key: string) => ({
  exists: docs.has(key),
  data: () => docs.get(key),
});
const ref = (key: string): any => ({
  key,
  doc: (id: string) => ref(key + "/" + id),
  collection: (id: string) => ref(key + "/" + id),
  get: async () => ({
    ...snapshot(key),
    docs: [...docs]
      .filter(
        ([k]) =>
          k.startsWith(key + "/") && !k.slice(key.length + 1).includes("/"),
      )
      .map(([k, v]) => ({ id: k.slice(key.length + 1), data: () => v })),
  }),
});
jest.mock("../../../src/lib/firestoreServer/admin", () => ({
  db: {
    collection: (name: string) => ref(name),
    runTransaction: async (fn: any) => {
      const writes: any[] = [];
      const result = await fn({
        get: async (r: any) => snapshot(r.key),
        set: (r: any, v: any) => writes.push([r.key, v]),
        create: (r: any, v: any) => {
          if (docs.has(r.key)) throw Error("already exists");
          writes.push([r.key, v]);
        },
      });
      writes.forEach(([k, v]) => docs.set(k, v));
      return result;
    },
  },
}));
const request: FeedbackRequest = {
  caseId: "reason",
  datasetVersion: "v1",
  datasetSha256: "sha",
  decision: "agree",
  revision: 0,
  requestId: "0123456789abcdef",
  note: "first",
  correction: "",
};
beforeEach(() => docs.clear());
test("lost-response replay is idempotent; revisions remain in append-only history", async () => {
  const first = await saveFeedback("tom", request);
  expect(await saveFeedback("tom", request)).toEqual(first);
  expect(docs.size).toBe(4);
  await expect(
    saveFeedback("tom", { ...request, note: "altered" }),
  ).rejects.toThrow("already used");
  await expect(
    saveFeedback("tom", { ...request, requestId: "fedcba9876543210" }),
  ).rejects.toThrow("newer answer");
  const second = await saveFeedback("tom", {
    ...request,
    revision: 1,
    requestId: "fedcba9876543210",
    decision: "discuss",
  });
  expect(second.revision).toBe(2);
  expect(
    [...docs.values()].filter((v) => v.answer).map((v) => v.answer.note),
  ).toEqual(["first", "first"]);
  expect((await readFeedback("tom", "v1")).reason.decision).toBe("discuss");
  expect(await readFeedback("iman", "v1")).toEqual({});
  expect(await readFeedback("tom", "v2")).toEqual({});
  expect(
    [...docs.keys()].every((k) => k.startsWith(RELATIONSHIP_COLLECTION + "/")),
  ).toBe(true);
});
test("a reused dataset version cannot silently bind old answers to changed proposals", async () => {
  await saveFeedback("tom", request);
  await expect(
    saveFeedback("tom", {
      ...request,
      datasetSha256: "changed",
      requestId: "fedcba9876543210",
      revision: 1,
    }),
  ).rejects.toThrow("without a new version");
  await expect(readFeedback("tom", "v1", false, "changed")).rejects.toThrow(
    "without a new version",
  );
  expect((await readFeedback("tom", "v1", false, "sha")).reason.note).toBe(
    "first",
  );
});
