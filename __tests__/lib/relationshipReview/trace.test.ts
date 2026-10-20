import { proposalReviewTrace, relationshipTraceDisclosure } from "../../../src/lib/relationshipReview/trace";
import {
  getRelationshipDataset,
  getRelationshipTrace,
} from "../../../src/lib/relationshipReview/dataset";
import { getPresentationTrace } from "../../../src/lib/relationshipReview/presentation";
import { relationshipSourceEvidence } from "../../../src/lib/relationshipReview/evidence";

test("atomic cards retain complete sources and three exact inference bodies within the disclosure bound", () => {
  const {dataset}=getRelationshipDataset();
  if(dataset.methodology!=="atomic-generalization-pilot-v1") return;
  const full=getPresentationTrace(dataset.version);
  for(const c of dataset.cases){
    const original=getRelationshipTrace(c.id,dataset.version);
    const response=relationshipTraceDisclosure(original,full,c.id);
    expect(response.selectedChangesReview.authors).toHaveLength(1);
    expect(response.selectedChangesReview.critiques).toHaveLength(2);
    const requests=response.selectedChangesReview.exactRequests;
    expect(requests).toHaveLength(3);
    const bodies=new Map<string,unknown>([["original.proposalRequest",original.proposalRequest],["original.challengeRequest",original.challengeRequest],["original.additionalChallenge.request",original.additionalChallenge.request]]);
    for(const request of requests) expect(request.body || bodies.get(request.bodyReference)).toBeTruthy();
    expect(JSON.stringify(response).length).toBeLessThan(500000);
    const evidence=relationshipSourceEvidence(dataset,c.id,original);
    expect(evidence.complete).toBe(true);
    expect(evidence.records.length).toBeGreaterThan(0);
  }
});
const author = (jobId: string, id: string) => ({
  jobId,
  value: { cases: [{ analysis: { nodeId: id } }] },
});
const critic = (jobId: string, id: string) => ({
  jobId,
  value: { assessments: [{ caseId: id }] },
});
const fixture = () => ({
  schemaVersion: "v2",
  authors: [author("a1", "one"), author("a2", "two")],
  critiques: [
    critic("c1", "one"),
    critic("c2", "one"),
    critic("c3", "two"),
    critic("c4", "two"),
  ],
  exactRequests: ["a1", "a2", "c1", "c2", "c3", "c4"].map((jobId) => ({
    jobId,
    body: { instructions: "exact " + jobId },
  })),
  allInferenceAttempts: [{ attemptId: "kept" }],
  allInferenceResponses: [{ text: "large unrelated response" }],
  discovery: {
    plan: { families: 51, distinctChildren: 626, sourceSha256: "source" },
  },
  selectionRule: "Unchanged pinned rule",
});
test("serves only participating agents and exact bodies without altering the frozen run", () => {
  const full = fixture(),
    before = JSON.stringify(full),
    one = proposalReviewTrace(full, "one");
  expect(one.authors.map((r: any) => r.jobId)).toEqual(["a1"]);
  expect(one.critiques.map((r: any) => r.jobId)).toEqual(["c1", "c2"]);
  expect(one.exactRequests.map((r: any) => r.jobId)).toEqual([
    "a1",
    "c1",
    "c2",
  ]);
  expect(one.exactRequests[0]).toBe(full.exactRequests[0]);
  expect(one.allInferenceResponses).toBeUndefined();
  expect(one.completeRun.privatelyPreserved).toBe(true);
  expect(JSON.stringify(full)).toBe(before);
});
test("a missing critic or exact body fails closed", () => {
  const full = fixture();
  full.critiques.pop();
  expect(() => proposalReviewTrace(full, "two")).toThrow("Incomplete");
  const missing = fixture();
  missing.exactRequests.shift();
  expect(() => proposalReviewTrace(missing, "one")).toThrow("Missing");
});
test("keeps the original v1 trace readable", () => {
  const legacy = { editor: {}, critiques: [], exactRequests: [] };
  expect(proposalReviewTrace(legacy, "old")).toBe(legacy);
});
test("every current proposal has a complete bounded disclosure rather than the whole run", () => {
  const { dataset } = getRelationshipDataset();
  if (!dataset.cases.some((c) => c.scope === "sibling-review" || c.scope === "atomic-activity-review")) return;
  const full = getPresentationTrace(dataset.version);
  for (const c of dataset.cases) {
    const selectedChangesReview = proposalReviewTrace(full, c.id);
    const original = getRelationshipTrace(c.id, dataset.version) as any;
    const before = JSON.stringify(original);
    const response = relationshipTraceDisclosure(original, full, c.id);
    expect(JSON.stringify(original)).toBe(before);
    if (response.original.sourceContextReference) {
      const context = JSON.parse(response.original.proposalRequest.input).context.find((value: any) => value.subject.id === c.id);
      if (context.sourceRecordColumns) {
        const columns = context.sourceRecordColumns;
        const unpack = (rows: any[]) => rows.map((row) => Object.fromEntries(columns.map((key: string, i: number) => [key, row[i]])));
        context.records = unpack(context.records);
        context.ancestors = unpack(context.ancestors);
        context.descendantCoverage.fullDescendantRecords = unpack(context.descendantCoverage.fullDescendantRecords);
        delete context.sourceRecordColumns;
        delete context.recordEncoding;
      }
      expect(context).toEqual(original.sourceContext);
    }
    expect(selectedChangesReview.exactRequests).toHaveLength(3);
    for (const request of response.selectedChangesReview.exactRequests) {
      const resolved = request.bodyReference
        ? request.bodyReference.split(".").reduce((value: any, key: string) => value[key], response)
        : request.body;
      expect(resolved).toEqual(selectedChangesReview.exactRequests.find((r: any) => r.jobId === request.jobId).body);
    }
    expect(JSON.stringify(response).length).toBeLessThan(500000);
  }
});
