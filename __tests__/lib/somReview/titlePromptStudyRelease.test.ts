import fs from "fs";
import { titlePromptStudyRelease } from "../../../src/lib/somReview/titlePromptStudyRelease";

const complete = { version: "rob-simple-title-prompt-2026-09-13-development-v1",
  cases: Array.from({length:18},()=>({status:"completed"})), model:"gpt-6-astra",modelVersion:"2026-09-03",reasoning:"max",promptSha256:"a".repeat(64) };
afterEach(()=>jest.restoreAllMocks());
it("identifies the exact complete Astra Max pilot",()=>{
  jest.spyOn(fs,"readFileSync").mockReturnValue(Buffer.from(JSON.stringify(complete)));
  expect(titlePromptStudyRelease()).toEqual({version:complete.version,cases:18,promptSha256:complete.promptSha256,bundleSha256:expect.stringMatching(/^[a-f0-9]{64}$/)});
});
it.each([
  {...complete,cases:[{status:"pending"},...complete.cases.slice(1)]},
  {...complete,cases:complete.cases.slice(1)},
  {...complete,reasoning:"medium"},
  {...complete,model:"another-model"},
])("rejects incomplete or wrongly configured pilots",data=>{
  jest.spyOn(fs,"readFileSync").mockReturnValue(Buffer.from(JSON.stringify(data)));
  expect(()=>titlePromptStudyRelease()).toThrow();
});
