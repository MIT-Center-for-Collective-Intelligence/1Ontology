import { quickCoordinatorCopy } from "../../../src/lib/titleValidation/quickCoordinatorCopy";

test("coordinator counts describe the current selection, not a future assignment", () => {
  const old = quickCoordinatorCopy("quick-title-selection-original-v1");
  const active = quickCoordinatorCopy("quick-title-selection-5-15-5-v1");
  expect(old).toContain("2 kept titles, 22 single replacements, 1 split");
  expect(old).not.toContain("5 kept titles");
  expect(active).toContain("5 kept titles, 15 single replacements, 5 splits");
  expect(active).not.toContain("22 single replacements");
  for (const copy of [old, active]) {
    expect(copy).toContain("75 are reserved");
    expect(copy).toContain("319 flagged cases");
    expect(copy).not.toMatch(/activation|revision|manifest/i);
  }
});

test("source-page copy explains separate follow-up batches and saved first-round reviews", () => {
  const copy = quickCoordinatorCopy("quick-title-selection-5-15-5-v1", true);
  expect(copy).toContain("three additional sets of 25 descriptions");
  expect(copy).toContain("separate answers and timing");
  expect(copy).toContain("Rob’s separate queue");
});
