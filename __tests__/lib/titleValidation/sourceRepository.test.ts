import fs from "fs/promises";
import os from "os";
import path from "path";
import { withSourceStudy } from "../../../src/lib/titleValidation/sourceRepository";
import { getQuickDataset } from "../../../src/lib/titleValidation/quickDataset";
import { getSourceDataset } from "../../../src/lib/titleValidation/sourceDataset";
import {
  sourceSession,
  saveSourceReview,
} from "../../../src/lib/titleValidation/sourceReview";
import type { QuickState } from "../../../src/lib/titleValidation/quick";
const previous = {
  node: process.env.NODE_ENV,
  enabled: process.env.TITLE_VALIDATION_LOCAL_PREVIEW,
  dir: process.env.TITLE_VALIDATION_PREVIEW_DIR,
};
let dir: string;
const data = getQuickDataset(),
  sources = getSourceDataset(),
  id = "software-qa-quick-title-source-storage-test";
const seed = (): QuickState => ({
  study: {
    id,
    protocol: "quick-title-verification-v1",
    datasetVersion: data.version,
    roster: [{ reviewerId: "test", label: "Software QA" }],
    flaggedReviewerIds: ["test"],
    regularLimit: 25,
    createdAt: 1,
    softwareQA: true,
  },
  answers: {},
  drafts: {},
});
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "title-source-test-"));
  Object.defineProperty(process.env, "NODE_ENV", {
    value: "development",
    configurable: true,
    writable: true,
  });
  process.env.TITLE_VALIDATION_LOCAL_PREVIEW = "1";
  process.env.TITLE_VALIDATION_PREVIEW_DIR = dir;
});
afterEach(async () => {
  for (const [key, value] of Object.entries({
    NODE_ENV: previous.node,
    TITLE_VALIDATION_LOCAL_PREVIEW: previous.enabled,
    TITLE_VALIDATION_PREVIEW_DIR: previous.dir,
  }))
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  await fs.rm(dir, { recursive: true, force: true });
});
test("source drafts/answers/timing round-trip separately while historical records stay byte-for-byte unchanged", async () => {
  const legacy = seed(),
    file = path.join(dir, id + ".json");
  await fs.writeFile(file, JSON.stringify(legacy));
  const before = await fs.readFile(file, "utf8");
  const view = await withSourceStudy(id, "test", true, seed, (s) => ({
    result: sourceSession(s, data, sources, "test", false, false, 1000),
  }));
  const p = structuredClone(view.draft!.payload);
  for (const r of Object.values(p.ratings)) r.value = "acceptable";
  p.activeTimeMs = 5000;
  await withSourceStudy(id, "test", true, seed, (s) => ({
    result: saveSourceReview(
      s,
      data,
      sources,
      "test",
      false,
      false,
      p,
      0,
      true,
      6000,
    ),
    event: { kind: "software-QA" },
  }));
  const after = await withSourceStudy(id, "test", true, seed, (s) => ({
    result: sourceSession(s, data, sources, "test", false, false, 9000),
  }));
  expect(after.completed).toBe(1);
  expect(await fs.readFile(file, "utf8")).toBe(before);
  const stored = JSON.parse(
    await fs.readFile(path.join(dir, id + ".source-v2.json"), "utf8"),
  );
  expect(Object.values(stored.answers)[0]).toMatchObject({
    activeTimeMs: 5000,
    elapsedTimeMs: 5000,
    softwareQA: true,
  });
  const bytes = JSON.stringify(stored.answers);
  await expect(
    withSourceStudy(id, "test", true, seed, (s) => {
      Object.values(s.answers)[0].activeTimeMs = 0;
      return { result: true };
    }),
  ).rejects.toThrow("must not change");
  expect(
    JSON.stringify(
      JSON.parse(
        await fs.readFile(path.join(dir, id + ".source-v2.json"), "utf8"),
      ).answers,
    ),
  ).toBe(bytes);
});
test("local coordinator expansion is reflected without overwriting earlier answers", async () => {
  await withSourceStudy(id, "test", true, seed, (s) => ({
    result: sourceSession(s, data, sources, "test", false, false, 1000),
  }));
  const legacy = seed();
  legacy.study.regularLimit = 100;
  await fs.writeFile(path.join(dir, id + ".json"), JSON.stringify(legacy));
  const view = await withSourceStudy(id, "test", true, seed, (s) => ({
    result: sourceSession(s, data, sources, "test", false, false, 2000),
  }));
  expect(view.regularLimit).toBe(100);
  expect(view.total).toBeGreaterThan(25);
});
