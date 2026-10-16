import fs from "fs";
import { titleValidationRelease } from "../../../src/lib/titleValidation/release";

afterEach(() => jest.restoreAllMocks());
test("release identity pins the five-case package without disclosing case text", () => {
  const release = titleValidationRelease();
  expect(release).toEqual(
    expect.objectContaining({
      version: "human-title-prepilot-20261015-v1",
      cases: 5,
      bundleSha256:
        "a759be0d165c2bca67c7729f518cf0f14b325cf9c1604442659d378dae3677ee",
    }),
  );
  expect(Object.keys(release).sort()).toEqual([
    "bundleSha256",
    "cases",
    "model",
    "promptSha256",
    "released",
    "version",
  ]);
});
test("a changed or missing package cannot advertise a valid release", () => {
  jest.spyOn(fs, "readFileSync").mockReturnValueOnce(Buffer.from("{}"));
  expect(() => titleValidationRelease()).toThrow("Staff pilot package changed");
  jest.restoreAllMocks();
  jest.spyOn(fs, "readFileSync").mockImplementationOnce(() => {
    throw Error("ENOENT");
  });
  expect(() => titleValidationRelease()).toThrow("ENOENT");
});
