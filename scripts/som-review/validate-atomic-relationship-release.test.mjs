import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { validateAtomicRelationshipRelease, validateAtomicReviewShape } from "./validate-atomic-relationship-release.mjs";
const hash = (b) => crypto.createHash("sha256").update(b).digest("hex");
function changed(edit, check) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "atomic-relationship-release-"),
  );
  try {
    const current = JSON.parse(
      fs.readFileSync("scripts/deployment/relationship-review-package.json"),
    );
    const pilot = [current, ...(current.history || [])].find(
      (e) => e.methodology === "atomic-generalization-pilot-v1",
    );
    assert.ok(pilot, "Missing pinned pilot manifest entry");
    const entry = structuredClone(pilot);
    const dir = path.join(
      root,
      "src/lib/relationshipReview/data",
      entry.directory,
    );
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    fs.cpSync(
      path.join("src/lib/relationshipReview/data", entry.directory),
      dir,
      { recursive: true },
    );
    const read = (file) => JSON.parse(fs.readFileSync(path.join(dir, file)));
    const write = (file, v) =>
      fs.writeFileSync(path.join(dir, file), JSON.stringify(v) + "\n");
    edit({ read, write, entry });
    const lock=read("release-lock.json");
    for(const id of Object.keys(lock.traceHashes)) lock.traceHashes[id]=hash(fs.readFileSync(path.join(dir,"traces",id+".json")));
    write("release-lock.json",lock);
    for (const [file, key] of [
      ["dataset.json", "bundleSha256"],
      ["release-lock.json", "releaseLockSha256"],
      ["presentation.json", "presentationSha256"],
      ["presentation-trace.json", "presentationTraceSha256"],
    ])
      entry[key] = hash(fs.readFileSync(path.join(dir, file)));
    check(() => validateAtomicRelationshipRelease(root, entry));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
test("validates the atomic pilot without pretending it used sibling discovery", () => {
  changed(
    () => {},
    (validate) => assert.equal(validate().cases, 5),
  );
});
test("rejects a repinned selection that adds a held case", () => {
  changed(
    ({ read, write }) => {
      const p = read("presentation.json"),
        t = read("presentation-trace.json");
      p.selectedCaseIds.push(t.sample.held[0]);
      write("presentation.json", p);
    },
    (validate) =>
      assert.throws(validate, /unresolved or omitted selected proposal/),
  );
});
test("rejects a repinned package missing a critical review request", () => {
  changed(
    ({ read, write }) => {
      const t = read("presentation-trace.json");
      t.exactRequests.pop();
      write("presentation-trace.json", t);
    },
    (validate) =>
      assert.throws(validate, /missing or repeated independent review/),
  );
});
test("rejects incomplete source consideration even when the raw result is consistently repinned", () => {
  changed(
    ({ read, write }) => {
      const t = read("presentation-trace.json"),
        c = t.critiques[0];
      c.value.cases[0].consideredSourceIds.pop();
      const response = t.rawResponses.find((r) => r.jobId === c.jobId).response;
      const text = response.output
        .flatMap((o) => o.content || [])
        .find((c) => c.type === "output_text");
      text.text = JSON.stringify(c.value);
      write("presentation-trace.json", t);
    },
    (validate) => assert.throws(validate, /reused inference differs from pinned baseline/),
  );
});

test("a repinned case cannot display a different source meaning",()=>{
  changed(({read,write})=>{const id=read("dataset.json").cases[0].id,t=read("traces/"+id+".json");t.sourceContext.subject.title="A different activity";write("traces/"+id+".json",t);},
    validate=>assert.throws(validate,/case source coverage mismatch/));
});

for (const field of ["currentParentIds","allDescendantIds"]) test("authoritative graph detects omitted "+field+" even after request pins change",()=>{
  changed(({read,write,entry})=>{
    const t=read("presentation-trace.json"),a=t.exactRequests.find(r=>r.jobId===t.authors[0].jobId),source=JSON.parse(a.body.input);
    source.cases[0][field].pop(); a.body.input=JSON.stringify(source);
    for(const c of t.critiques){const request=t.exactRequests.find(r=>r.jobId===c.jobId),input=JSON.parse(request.body.input);input.source=source;request.body.input=JSON.stringify(input);}
    for(const [i,role] of [...t.authors,...t.critiques].entries()){const request=t.exactRequests.find(r=>r.jobId===role.jobId);role.requestSha256=request.requestSha256=hash(Buffer.from(JSON.stringify(request.body)));entry.inferenceLineage[i].requestSha256=role.requestSha256;}
    write("presentation-trace.json",t);
  },validate=>assert.throws(validate,/request coverage differs from authoritative graph/));
});

test("malformed critical-review fields cannot pass admission",()=>{
  const valid={subjectId:"a",reason:"A reason",consideredSourceIds:[],decision:"admit",sourceIssueSeverity:"none",unresolvedIssues:[],strongestObjection:"An objection",objectionResolution:"A response"};
  for(const mutation of [{sourceIssueSeverity:undefined},{sourceIssueSeverity:"unknown"},{unresolvedIssues:""}])
    assert.throws(()=>validateAtomicReviewShape({cases:[{...valid,...mutation}]}),/Invalid atomic critic schema/);
});
