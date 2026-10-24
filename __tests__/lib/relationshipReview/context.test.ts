/** @jest-environment node */
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import type { RelationshipDataset } from "../../../src/types/IRelationshipReview";
import { RelationshipError as SharedRelationshipError } from "../../../src/lib/relationshipReview/feedback";
import {
  buildRelationshipContext,
  relationshipContext,
  RelationshipError,
} from "../../../src/lib/relationshipReview/context";
import type {
  ContextOptions,
  FrozenGraphNode,
} from "../../../src/lib/relationshipReview/context";

const PIN = "06daeedf3153e3f7efa00659d69d076aa0962efdd1c373642050f5831a96a703";
const HASH = "a".repeat(64);
const V1 = "atomic-generalizations-20261019-v1";
const V3 = "atomic-generalizations-20261019-v3";
const SOURCE_FILE = path.join(
  process.cwd(),
  "src/lib/relationshipReview/data/atomic-v1/source-graph.json",
);
const ids = (nodes: readonly { id: string }[]) => nodes.map((item) => item.id);
const hash = (text: string) => createHash("sha256").update(text).digest("hex");

function dataset(
  version: string = V3,
  sourceSha256: string = PIN,
): RelationshipDataset {
  // Only the fields used by this module are needed in synthetic cases.
  return {
    version,
    sourceSha256,
    sourceApp: "final-hierarchy-with-o*net",
    sourceCapturedAt: "2026-10-19T00:00:00Z",
    cases: ["F", "G"].map((id) => ({
      id,
      title: "Saved focal",
      description: "Saved description",
      oNetTask: false,
      level: 6,
      currentGeneralizationIds: ["P1", "P2", "P1"],
      currentParents: [{ id: "P1" }, { id: "P2" }],
      analysis: {
        proposedParents: [{ nodeId: "Proposed" }, { nodeId: "P1" }],
        alternatives: [{ nodeId: "Alternative" }, { nodeId: "Proposed" }],
        referenceNodeIds: ["NotAChoice"],
      },
    })),
  } as unknown as RelationshipDataset;
}

function node(
  id: string,
  parents: string[] = [],
  children: string[] = [],
  extra: Partial<FrozenGraphNode> = {},
): FrozenGraphNode {
  const links = (refs: string[]) => [
    {
      collectionName: "main",
      nodes: refs.map((ref) => ({ id: ref, title: "Reference title" })),
    },
  ];
  return {
    id,
    title: id,
    oNetTask: false,
    nodeType: "activity",
    properties: { description: `Recorded ${id}.` },
    generalizations: links(parents),
    specializations: links(children),
    ...extra,
  };
}

function graph(): FrozenGraphNode[] {
  return [
    node("F", ["P1", "P2"], ["A1", "S1", "A2", "S2"]),
    node("G", ["P1", "P2"]),
    node("P1", ["R1"], [], { title: "Same title" }),
    node("P2", ["R2"], [], { title: "Same title" }),
    node("R1", ["Root"]),
    node("R2", ["Root"]),
    node("Root"),
    node("Proposed", ["P1"]),
    node("Alternative", ["P2"]),
    node("A1", [], [], { title: "Same child title" }),
    node("A2", [], [], { title: "Same child title" }),
    node("S1", [], [], {
      oNetTask: true,
      title: "(O*Net) 1 - Complete source one.",
    }),
    node("S2", [], [], {
      oNetTask: false,
      title: "(O*Net) 2 - Complete source two.",
    }),
    node("NotAChoice", ["F"]),
  ];
}

function errorFrom(run: () => unknown): RelationshipError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(RelationshipError);
    return error as RelationshipError;
  }
  throw new Error("Expected RelationshipError");
}

afterEach(() => jest.restoreAllMocks());

describe("frozen relationship context", () => {
  it("shares the error constructor used by the API", () => {
    expect(RelationshipError).toBe(SharedRelationshipError);
  });

  it("retains multiple parents, duplicate titles, roles and recorded branch direction", () => {
    const result = buildRelationshipContext(dataset(), HASH, "F", graph());
    expect(result.available).toBe(true);
    expect(result.focus?.description).toBe("Recorded F.");
    expect(ids(result.generalizations)).toEqual(["P1", "P2"]);
    expect(result.generalizationsTotal).toBe(2);
    expect(result.generalizations.map((item) => item.title)).toEqual([
      "Same title",
      "Same title",
    ]);
    expect(result.choices.map((choice) => choice.node.id)).toEqual([
      "F",
      "P1",
      "P2",
      "Proposed",
      "Alternative",
    ]);
    expect(
      result.choices.find((choice) => choice.node.id === "P1")?.roles,
    ).toEqual(["current", "proposed"]);
    expect(
      result.choices.find((choice) => choice.node.id === "Proposed")?.roles,
    ).toEqual(["proposed", "alternative"]);
    expect(result.ancestors.edges).toEqual(
      expect.arrayContaining([
        { generalizationId: "P1", specializationId: "F" },
        { generalizationId: "P2", specializationId: "F" },
        { generalizationId: "R1", specializationId: "P1" },
        { generalizationId: "R2", specializationId: "P2" },
        { generalizationId: "Root", specializationId: "R1" },
        { generalizationId: "Root", specializationId: "R2" },
      ]),
    );
    expect(
      ids(result.ancestors.nodes).filter((id) => id === "Root"),
    ).toHaveLength(1);
    expect(result.ancestors.edges).not.toContainEqual({
      generalizationId: "Proposed",
      specializationId: "F",
    });
    expect(
      result.limitations.some((text) =>
        text.includes("Unapproved proposed-parent IDs:"),
      ),
    ).toBe(true);
    expect(result.ancestors.truncated).toBe(false);
  });

  it("omits unrecorded levels and preserves recorded zero", () => {
    const result = buildRelationshipContext(dataset(), HASH, "F", [
      node("F", ["P1", "P2"]),
      node("P1", [], [], { level: 0 }),
      node("P2", [], [], { level: 3 }),
    ]);
    expect(result.focus).not.toHaveProperty("level");
    expect(
      result.generalizations.map(({ id, level }) => ({ id, level })),
    ).toEqual([
      { id: "P1", level: 0 },
      { id: "P2", level: 3 },
    ]);
    expect(result.limitations).toContain(
      "Node levels are not calculated here; missing levels are omitted.",
    );
  });

  it("separates source records and activities without inventing reverse links", () => {
    const result = buildRelationshipContext(dataset(), HASH, "F", graph());
    expect(ids(result.specializationPage.items)).toEqual(["A1", "A2"]);
    expect(ids(result.sourcePage.items)).toEqual(["S1", "S2"]);
    expect(result.sourcePage.items.every((item) => item.oNetTask)).toBe(true);
    expect(result.sourcePage.items[1].title).toBe(
      "(O*Net) 2 - Complete source two.",
    );
    expect(ids(result.specializationPage.items)).not.toContain("NotAChoice");
    const parent = buildRelationshipContext(dataset(), HASH, "F", graph(), {
      focusId: "P1",
    });
    expect(parent.specializationPage.total).toBe(0); // F's parent link does not fill P1's child list.
    for (const focusId of ["F", "P1", "Proposed", "Alternative"])
      expect(
        buildRelationshipContext(dataset(), HASH, "F", graph(), { focusId })
          .focus?.id,
      ).toBe(focusId);
  });

  it("paginates distinct activity and source IDs independently, with defaults and a cap", () => {
    const activities = Array.from({ length: 30 }, (_, i) => `A${i}`);
    const sources = Array.from({ length: 11 }, (_, i) => `S${i}`);
    const input = [
      node("F", [], [...activities, ...sources, "A0", "S0"]),
      ...activities.map((id) => node(id)),
      ...sources.map((id) => node(id, [], [], { oNetTask: true })),
    ];
    const first = buildRelationshipContext(dataset(), HASH, "F", input);
    expect(first.specializationPage).toMatchObject({
      total: 30,
      offset: 0,
      limit: 8,
      nextOffset: 8,
    });
    expect(first.sourcePage).toMatchObject({
      total: 11,
      offset: 0,
      limit: 8,
      nextOffset: 8,
    });
    expect(ids(first.specializationPage.items)).toEqual(activities.slice(0, 8));
    const second = buildRelationshipContext(dataset(), HASH, "F", input, {
      activityOffset: 8,
      sourceOffset: 8,
    });
    expect(ids(second.specializationPage.items)).toEqual(
      activities.slice(8, 16),
    );
    expect(ids(second.sourcePage.items)).toEqual(sources.slice(8));
    expect(second.sourcePage.nextOffset).toBeNull();
    const capped = buildRelationshipContext(dataset(), HASH, "F", input, {
      limit: 999,
    });
    expect(capped.specializationPage.limit).toBe(25);
    expect(capped.specializationPage.items).toHaveLength(25);
    expect(capped.specializationPage.nextOffset).toBe(25);
    const end = buildRelationshipContext(dataset(), HASH, "F", input, {
      activityOffset: 29,
      sourceOffset: Number.MAX_SAFE_INTEGER,
    });
    expect(ids(end.specializationPage.items)).toEqual(["A29"]);
    expect(end.specializationPage.nextOffset).toBeNull();
    expect(end.sourcePage.items).toEqual([]);
    expect(end.sourcePage.nextOffset).toBeNull();
  });

  it("reports missing choices, direct references and ancestor references without fabricated nodes", () => {
    const input = [
      node("F", ["P1", "MissingParent"], ["A1", "MissingChild"]),
      node("P1", ["MissingAncestor"]),
      node("A1"),
    ];
    const result = buildRelationshipContext(dataset(), HASH, "F", input);
    expect(result.generalizationsTotal).toBe(2);
    expect(ids(result.generalizations)).toEqual(["P1"]);
    expect(result.specializationPage.total).toBe(1);
    expect(result.missingNodeIds).toEqual(
      expect.arrayContaining([
        "MissingParent",
        "MissingChild",
        "MissingAncestor",
        "Proposed",
        "Alternative",
        "P2",
      ]),
    );
    expect(result.ancestors.edges).toContainEqual({
      generalizationId: "MissingAncestor",
      specializationId: "P1",
    });
    const missingFocus = buildRelationshipContext(dataset(), HASH, "F", input, {
      focusId: "Proposed",
    });
    expect(missingFocus.available).toBe(true);
    expect(missingFocus.focus).toBeNull();
    expect(missingFocus.generalizations).toEqual([]);
    expect(missingFocus.limitations).toContain(
      "The selected node is missing from the frozen source.",
    );
  });

  it("detects self-loops and multi-parent cycles without duplicating ancestor nodes", () => {
    const input = [
      node("F", ["P1", "P2", "F"]),
      node("P1", ["Shared"]),
      node("P2", ["Shared"]),
      node("Shared", ["P1"]),
    ];
    const result = buildRelationshipContext(dataset(), HASH, "F", input);
    expect(ids(result.ancestors.nodes)).toEqual(["P1", "P2", "Shared"]);
    expect(result.ancestors.cycles).toEqual(
      expect.arrayContaining([
        ["F", "F"],
        ["P1", "Shared", "P1"],
      ]),
    );
    expect(result.ancestors.truncated).toBe(false);
  });

  it("stops new ancestor discovery at depth six, but does not call a leaf truncated", () => {
    const chain = (length: number) => [
      node("F", ["N1"]),
      ...Array.from({ length }, (_, i) =>
        node(`N${i + 1}`, i + 1 < length ? [`N${i + 2}`] : []),
      ),
    ];
    const result = buildRelationshipContext(dataset(), HASH, "F", chain(7));
    expect(ids(result.ancestors.nodes)).toEqual([
      "N1",
      "N2",
      "N3",
      "N4",
      "N5",
      "N6",
    ]);
    expect(result.ancestors.truncated).toBe(true);
    expect(result.limitations).toContain(
      "Ancestor paths stop at 6 recorded steps.",
    );
    expect(
      buildRelationshipContext(dataset(), HASH, "F", chain(6)).ancestors
        .truncated,
    ).toBe(false);
  });

  it("uses the shortest recorded depth when branches share an ancestor", () => {
    const input = [
      node("F", ["N1", "Shared"]),
      node("N1", ["N2"]),
      node("N2", ["N3"]),
      node("N3", ["N4"]),
      node("N4", ["N5"]),
      node("N5", ["Shared"]),
      node("Shared", ["Top"]),
      node("Top"),
    ];
    const result = buildRelationshipContext(dataset(), HASH, "F", input);
    expect(ids(result.ancestors.nodes)).toContain("Top");
    expect(result.ancestors.truncated).toBe(false);
    expect(result.ancestors.edges).toContainEqual({
      generalizationId: "Shared",
      specializationId: "N5",
    });
  });

  it("bounds visited ancestors and explicitly limits direct-parent summaries", () => {
    const parents = Array.from({ length: 121 }, (_, i) => `P${i}`);
    const result = buildRelationshipContext(dataset(), HASH, "F", [
      node("F", parents),
      ...parents.map((id) => node(id)),
    ]);
    expect(result.generalizationsTotal).toBe(121);
    expect(result.generalizations).toHaveLength(120);
    expect(ids(result.generalizations)).toEqual(parents.slice(0, 120));
    expect(result.focus).not.toHaveProperty("currentGeneralizationIds");
    expect(result.ancestors.nodes.length + 1).toBeLessThanOrEqual(120);
    expect(result.ancestors.truncated).toBe(true);
    expect(
      result.limitations.some((text) =>
        text.startsWith("Direct Generalizations are limited"),
      ),
    ).toBe(true);
    expect(
      result.limitations.some((text) => text.includes("120 visited nodes")),
    ).toBe(true);

    const branches = Array.from({ length: 10 }, (_, i) => `B${i}`);
    const wide = [node("F", branches)];
    for (const branch of branches) {
      const leaves = Array.from({ length: 20 }, (_, i) => `${branch}_${i}`);
      wide.push(node(branch, leaves), ...leaves.map((id) => node(id)));
    }
    const bounded = buildRelationshipContext(dataset(), HASH, "F", wide);
    expect(ids(bounded.ancestors.nodes).slice(0, 10)).toEqual(branches);
    expect(bounded.ancestors.nodes).toHaveLength(119);
    expect(bounded.ancestors.truncated).toBe(true);
  });

  it.each([
    -1,
    0.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    "1",
    null,
    true,
  ])("rejects invalid offsets: %p", (value) => {
    for (const key of ["activityOffset", "sourceOffset"])
      expect(
        errorFrom(() =>
          buildRelationshipContext(dataset(), HASH, "F", graph(), {
            [key]: value,
          }),
        ).status,
      ).toBe(400);
  });

  it.each([0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1, "8", null])(
    "rejects invalid limits: %p",
    (limit) => {
      expect(
        errorFrom(() =>
          buildRelationshipContext(dataset(), HASH, "F", graph(), { limit }),
        ).status,
      ).toBe(400);
    },
  );

  it("rejects malformed focus/options and well-formed IDs outside the case's choices", () => {
    for (const focusId of [null, 1, "", "../P1", " P1", "x".repeat(129)])
      expect(
        errorFrom(() =>
          buildRelationshipContext(dataset(), HASH, "F", graph(), { focusId }),
        ).status,
      ).toBe(400);
    for (const focusId of ["NotAChoice", "Root", "A1", "G"])
      expect(
        errorFrom(() =>
          buildRelationshipContext(dataset(), HASH, "F", graph(), { focusId }),
        ).status,
      ).toBe(404);
    for (const options of [null, [], "options", { unknown: 1 }])
      expect(
        errorFrom(() =>
          buildRelationshipContext(
            dataset(),
            HASH,
            "F",
            graph(),
            options as unknown as ContextOptions,
          ),
        ).status,
      ).toBe(400);
    expect(
      errorFrom(() =>
        buildRelationshipContext(dataset(), HASH, "Unknown", graph()),
      ).status,
    ).toBe(404);
    expect(
      errorFrom(() =>
        buildRelationshipContext(dataset(), HASH, "../F", graph()),
      ).status,
    ).toBe(400);
    expect(
      errorFrom(() =>
        buildRelationshipContext(dataset(), "not-a-hash", "F", graph()),
      ).status,
    ).toBe(400);
  });

  it.each([
    "relationship-evidence-20261017-v3",
    "atomic-generalizations-20261019-v2",
  ])(
    "returns an explicit empty unavailable disclosure for %s without reading a source",
    (version) => {
      const read = jest.spyOn(fs, "readFileSync").mockImplementation(() => {
        throw new Error("Must not read");
      });
      const result = relationshipContext(
        dataset(version, "b".repeat(64)),
        HASH,
        "F",
      );
      expect(result.available).toBe(false);
      expect(result.focus).toBeNull();
      expect(result.choices).toEqual([]);
      expect(result.generalizations).toEqual([]);
      expect(result.specializationPage.total).toBe(0);
      expect(result.sourcePage.total).toBe(0);
      expect(result.ancestors).toEqual({
        nodes: [],
        edges: [],
        truncated: false,
        cycles: [],
      });
      expect(result.limitations).toEqual([
        "This saved version has no approved frozen neighborhood.",
      ]);
      expect(result.sourceSha256).toBe("b".repeat(64));
      expect(read).not.toHaveBeenCalled();
    },
  );

  it("fails closed on the dataset pin before reading, and on wrong source bytes for both approved releases", () => {
    const read = jest
      .spyOn(fs, "readFileSync")
      .mockReturnValue(Buffer.from(JSON.stringify(graph())));
    for (const version of [V1, V3]) {
      const bad = dataset(version, "b".repeat(64));
      expect(errorFrom(() => relationshipContext(bad, HASH, "F")).status).toBe(
        500,
      );
      expect(
        errorFrom(() => buildRelationshipContext(bad, HASH, "F", graph()))
          .status,
      ).toBe(500);
    }
    expect(read).not.toHaveBeenCalled();
    for (const version of [V1, V3]) {
      const error = errorFrom(() =>
        relationshipContext(dataset(version), HASH, "F"),
      );
      expect(error.status).toBe(500);
      expect(error.message).toContain("does not match its pin");
    }
    expect(read).toHaveBeenCalledTimes(2); // Rejected bytes were not cached.
    expect(read).toHaveBeenCalledWith(SOURCE_FILE);
  });

  it("hashes exactly the returned payload and binds it to the case, dataset, release and pages", () => {
    const saved = dataset();
    const result = buildRelationshipContext(saved, HASH, "F", graph());
    const { contextSha256, ...payload } = result;
    expect(contextSha256).toBe(hash(JSON.stringify(payload)));
    expect(result).toMatchObject({
      caseId: "F",
      datasetVersion: V3,
      datasetSha256: HASH,
      sourceSha256: PIN,
      disclosureVersion: "frozen-ontology-neighborhood-v1",
      sourceApp: "final-hierarchy-with-o*net",
      sourceCapturedAt: "2026-10-19T00:00:00Z",
    });
    expect(
      buildRelationshipContext(saved, HASH, "F", graph()).contextSha256,
    ).toBe(contextSha256);
    for (const changed of [
      buildRelationshipContext(saved, HASH, "G", graph()),
      buildRelationshipContext(saved, "b".repeat(64), "F", graph()),
      buildRelationshipContext(dataset(V1), HASH, "F", graph()),
      buildRelationshipContext(saved, HASH, "F", graph(), { sourceOffset: 1 }),
      buildRelationshipContext(saved, HASH, "F", graph(), {
        focusId: "Proposed",
      }),
    ])
      expect(changed.contextSha256).not.toBe(contextSha256);
  });

  it("does not mutate synthetic inputs or share their node summaries", () => {
    const saved = dataset();
    const input = graph();
    const before = JSON.stringify({ saved, input });
    const first = buildRelationshipContext(saved, HASH, "F", input);
    const originalHash = first.contextSha256;
    const mutable = first.focus!;
    mutable.title = "Caller changed this";
    mutable.description = "Caller changed this";
    expect(JSON.stringify({ saved, input })).toBe(before);
    expect(
      buildRelationshipContext(saved, HASH, "F", input).contextSha256,
    ).toBe(originalHash);
    expect(
      errorFrom(() =>
        buildRelationshipContext(saved, HASH, "F", [node("F"), node("F")]),
      ).status,
    ).toBe(500);
  });

  it("verifies and caches the actual pinned source, shares it across releases, and isolates returned summaries", () => {
    jest.isolateModules(() => {
      const server = jest.requireActual<
        typeof import("../../../src/lib/relationshipReview/context")
      >("../../../src/lib/relationshipReview/context");
      const read = jest.spyOn(fs, "readFileSync");
      const sourceReads = () =>
        read.mock.calls.filter(([file]) => file === SOURCE_FILE);
      const caseId = "PL2EVJXSN2lREDbIHD40";
      const base = dataset();
      const saved = {
        ...base,
        cases: [
          {
            ...base.cases[0],
            id: caseId,
            currentParents: [],
            currentGeneralizationIds: ["BBtPz5kme40w9IqBO2Qz"],
          },
        ],
      };
      const first = server.relationshipContext(saved, HASH, caseId);
      expect(first.focus?.title).toBe("Repair Chainsaw");
      expect(sourceReads()).toHaveLength(1);
      const originalHash = first.contextSha256;
      const originalDescription = first.focus?.description;
      const mutable = first.focus!;
      mutable.title = "Caller changed this";
      mutable.description = "Caller changed this";
      const second = server.relationshipContext(saved, HASH, caseId);
      expect(second.focus?.title).toBe("Repair Chainsaw");
      expect(second.focus?.description).toBe(originalDescription);
      expect(second.contextSha256).toBe(originalHash);
      expect(
        server.relationshipContext({ ...saved, version: V1 }, HASH, caseId)
          .available,
      ).toBe(true);
      expect(sourceReads()).toHaveLength(1);
      expect(() =>
        server.relationshipContext(
          { ...saved, sourceSha256: "b".repeat(64) },
          HASH,
          caseId,
        ),
      ).toThrow("source pin mismatch");
      expect(sourceReads()).toHaveLength(1);
      expect(read).toHaveBeenCalledWith(SOURCE_FILE);
    });
  });
});
