import crypto from "crypto";
import fs from "fs";
import { getFollowupBatch, followupBatchNumber, followupStudyId } from "../../../src/lib/titleValidation/followupBatches";
import { sourceSession, sourceQuestions, saveSourceReview, SOURCE_SCOPE, SourceState } from "../../../src/lib/titleValidation/sourceReview";
import { quickKey, QuickState } from "../../../src/lib/titleValidation/quick";

const hash = (file: string) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const stateFor = (batch: 2 | 3 | 4): SourceState => {
  const { data } = getFollowupBatch(batch);
  return {
    legacy: {
      study: { id: followupStudyId(batch), datasetVersion: data.version,
        protocol: "quick-title-verification-v1", regularLimit: 25, createdAt: 1,
        roster: [{ reviewerId: "rob", label: "Rob" }, { reviewerId: "tom", label: "Tom" }], flaggedReviewerIds: [] },
      answers: {}, drafts: {},
    }, answers: {}, drafts: {},
  };
};

test("follow-up batches are three distinct sets of25 and preserve the original package hashes", () => {
  expect(hash("src/lib/titleValidation/data/quick-v1.json")).toBe("683ccb70248e96813fca2d0b862584d7cd7a61518b9acab6d3d5fbdcd1492857");
  expect(hash("src/lib/titleValidation/data/source-pages-v2.json")).toBe("6010283fd843373bd7e232f78d422faf1fc35f4db855342518f1c73f088518b5");
  const ids: string[] = [];
  for (const n of [2,3,4] as const) {
    const b = getFollowupBatch(n);
    expect(b.data.cases).toHaveLength(25);
    expect(b.sources.pages).toHaveLength(25);
    ids.push(...b.sources.pages.map(p => p.id));
    expect(b.sources.pages.flatMap(p => p.activities).every(a => a.supportingDescriptionCount === 1 && !a.flagged)).toBe(true);
    for (const p of b.sources.pages) {
      const questions = sourceQuestions(p);
      expect(new Set(questions.map(q => q.title.toLowerCase().replace(/\s+/g," ").trim())).size).toBe(questions.length);
    }
  }
  expect(new Set(ids).size).toBe(75);
});

test("invalid batch identifiers cannot select data or historical studies", () => {
  expect(followupBatchNumber(undefined)).toBeUndefined();
  for (const value of [1,5,"2",null,{},[2]]) expect(() => followupBatchNumber(value)).toThrow("Unknown review batch");
  expect(followupStudyId(2)).not.toBe(followupStudyId(3));
  expect(followupStudyId(2,true)).not.toBe(followupStudyId(2));
});

test.each([2,3,4] as const)("batch %s saves answers and cumulative timing independently for both reviewers", batch => {
  const b = getFollowupBatch(batch), state = stateFor(batch);
  const historical = JSON.stringify(state.legacy);
  for (const uid of ["rob","tom"]) {
    const view = sourceSession(state,b.data,b.sources,uid,false,false,1000);
    expect(view.total).toBe(25);
    expect(view.completed).toBe(0);
    expect(view.questions.length).toBeGreaterThan(0);
    const payload = structuredClone(view.draft!.payload);
    for (const rating of Object.values(payload.ratings)) rating.value = "acceptable";
    payload.activeTimeMs = 1200;
    const saved = saveSourceReview(state,b.data,b.sources,uid,false,false,payload,0,true,3000);
    expect(saved.answer!.activeTimeMs).toBe(1200);
    expect(saved.answer!.packageVersion).toBe(b.sources.version);
    const submitted = JSON.stringify(saved.answer);
    const revisit = sourceSession(state,b.data,b.sources,uid,false,false,4000,view.item!.id);
    const later = structuredClone(revisit.draft!.payload);
    later.activeTimeMs = 1700;
    saveSourceReview(state,b.data,b.sources,uid,false,false,later,revisit.draft!.revision,false,5000);
    expect(JSON.stringify(state.answers[quickKey(uid,view.item!.id)])).toBe(submitted);
    expect(state.drafts[quickKey(uid,view.item!.id)].payload.activeTimeMs).toBe(1700);
  }
  expect(Object.keys(state.answers)).toHaveLength(2);
  expect(JSON.stringify(state.legacy)).toBe(historical);
});

test("a source page from another batch cannot be submitted; unassigned reviewers cannot load it", () => {
  const b = getFollowupBatch(2), other = getFollowupBatch(3), state = stateFor(2);
  expect(() => sourceSession(state,b.data,b.sources,"outsider",false,false,1000)).toThrow("not assigned");
  const view = sourceSession(state,b.data,b.sources,"rob",false,false,1000);
  const payload = { ...view.draft!.payload,caseId:other.sources.pages[0].id };
  expect(() => saveSourceReview(state,b.data,b.sources,"rob",false,false,payload,0,true,3000)).toThrow("not in your assigned");
  expect(state.answers).toEqual({});
});
