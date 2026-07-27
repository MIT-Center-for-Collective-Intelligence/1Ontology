import crypto from "node:crypto";

const REVIEWER_ALIAS_NAMESPACE = "som-study-reviewer-v1";

const asFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const unique = (values) => [...new Set(values)];

const countBy = (values, keyFor) => {
  const counts = new Map();
  for (const value of values) {
    const key = keyFor(value);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
};

const groupBy = (values, keyFor) => {
  const groups = new Map();
  for (const value of values) {
    const key = keyFor(value);
    const group = groups.get(key) || [];
    group.push(value);
    groups.set(key, group);
  }
  return groups;
};

const round = (value, digits = 3) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const ratio = (numerator, denominator) =>
  denominator > 0 ? round(numerator / denominator) : null;

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ");

const normalizeKey = (value) => normalizeText(value).toLocaleLowerCase("en");

export const sha256 = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

export const reviewerAlias = (reviewerId, role = "contributor") => {
  const digest = sha256(
    `${REVIEWER_ALIAS_NAMESPACE}\u001f${String(reviewerId || "")}`,
  ).slice(0, 8);
  return `${role}-${digest}`;
};

export const percentile = (values, proportion) => {
  const sorted = values
    .map(asFiniteNumber)
    .filter((value) => value !== null)
    .sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const bounded = Math.min(1, Math.max(0, proportion));
  const position = (sorted.length - 1) * bounded;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const fraction = position - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * fraction;
};

export const summarizeElapsed = (records) => {
  const elapsedMs = records
    .map((record) => asFiniteNumber(record?.response?.elapsedMs))
    .filter((value) => value !== null && value >= 0);
  const median = percentile(elapsedMs, 0.5);
  const p90 = percentile(elapsedMs, 0.9);
  return {
    recorded: elapsedMs.length,
    missing: records.length - elapsedMs.length,
    medianSeconds: median === null ? null : round(median / 1000, 1),
    p90Seconds: p90 === null ? null : round(p90 / 1000, 1),
    over30Minutes: elapsedMs.filter((value) => value > 30 * 60 * 1000).length,
  };
};

const decisionSummary = (records) => {
  const agree = records.filter(
    (record) => record?.response?.decision === "agree",
  ).length;
  const disagree = records.filter(
    (record) => record?.response?.decision === "disagree",
  ).length;
  return {
    judgments: agree + disagree,
    agree,
    disagree,
    proposalAcceptanceRate: ratio(agree, agree + disagree),
  };
};

const revisionSummary = (revisions) => ({
  total: revisions.length,
  saves: revisions.filter((revision) => revision.action === "save").length,
  edits: revisions.filter((revision) => revision.action === "edit").length,
  undos: revisions.filter((revision) => revision.action === "undo").length,
});

const groupJudgments = (records, proposalById, keyFor) =>
  [
    ...groupBy(records, (record) =>
      keyFor(proposalById.get(record.proposalId)),
    ).entries(),
  ]
    .map(([key, group]) => ({
      key: key || "missing",
      ...decisionSummary(group),
      elapsed: summarizeElapsed(group),
    }))
    .sort(
      (left, right) =>
        right.judgments - left.judgments || left.key.localeCompare(right.key),
    );

const perIssueSummaries = ({
  records,
  currentResponses,
  revisions,
  aliases,
}) => {
  const issueTypes = unique([
    ...records.map((record) => record.issueType),
    ...currentResponses.map((record) => record.issueType),
  ])
    .filter(Boolean)
    .sort();

  return issueTypes.map((issueType) => {
    const issueRecords = records.filter(
      (record) => record.issueType === issueType,
    );
    const issueResponses = currentResponses.filter(
      (record) => record.issueType === issueType,
    );
    const issueRevisions = revisions.filter(
      (revision) => revision.issueType === issueType,
    );
    return {
      issueType,
      records: issueRecords.length,
      proposals: issueRecords.filter(
        (record) => record._recordSource === "proposal",
      ).length,
      controls: issueRecords.filter(
        (record) => record._recordSource === "control",
      ).length,
      manualChecks: issueRecords.filter(
        (record) => record._recordSource === "manual-check",
      ).length,
      reviewers: unique(
        issueResponses.map(
          (response) => aliases.get(response.reviewerId) || "unknown-reviewer",
        ),
      ).length,
      ...decisionSummary(issueResponses),
      elapsed: summarizeElapsed(issueResponses),
      revisions: revisionSummary(issueRevisions),
    };
  });
};

const perReviewerSummaries = ({
  currentResponses,
  revisions,
  aliases,
  roles,
}) =>
  [...groupBy(currentResponses, (record) => record.reviewerId).entries()]
    .map(([reviewerId, reviewerResponses]) => {
      const reviewerRevisions = revisions.filter(
        (revision) => revision.reviewerId === reviewerId,
      );
      return {
        reviewer: aliases.get(reviewerId) || "unknown-reviewer",
        role: roles.get(reviewerId) || "contributor",
        ...decisionSummary(reviewerResponses),
        elapsed: summarizeElapsed(reviewerResponses),
        revisions: revisionSummary(reviewerRevisions),
      };
    })
    .sort((left, right) => left.reviewer.localeCompare(right.reviewer));

export const buildDatasetSummary = ({
  descriptor,
  records,
  responses,
  revisions,
  sessions,
  aliases,
  roles,
  focusReviewerId = "",
}) => {
  const proposalById = new Map(
    records.map((record) => [record.proposalId, record]),
  );
  const currentResponses = responses.filter(
    (response) => response.status === "current",
  );
  const matchedResponses = currentResponses.filter((response) =>
    proposalById.has(response.proposalId),
  );
  const orphanedResponses = currentResponses.filter(
    (response) => !proposalById.has(response.proposalId),
  );
  const recordIds = new Set(records.map((record) => record.proposalId));
  const dependencyLinks = records.flatMap(
    (record) => record.workflow?.dependsOnProposalIds || [],
  );
  const focusResponses = focusReviewerId
    ? matchedResponses.filter(
        (response) => response.reviewerId === focusReviewerId,
      )
    : [];
  const allFocusResponses = focusReviewerId
    ? currentResponses.filter(
        (response) => response.reviewerId === focusReviewerId,
      )
    : [];
  const orphanedFocusResponses = focusReviewerId
    ? orphanedResponses.filter(
        (response) => response.reviewerId === focusReviewerId,
      )
    : [];
  const focusRevisions = focusReviewerId
    ? revisions.filter((revision) => revision.reviewerId === focusReviewerId)
    : [];
  const currentProposalIds = new Set(
    matchedResponses.map((response) => response.proposalId),
  );

  return {
    datasetVersion: descriptor.manifest.datasetVersion,
    branch: descriptor.manifest.branch,
    generatedAt: descriptor.manifest.generatedAt,
    relativeDir: descriptor.relativeDir,
    sourceOntology: descriptor.manifest.sourceOntology,
    sourceOntologySha256: descriptor.manifest.sourceOntologySha256,
    sourceSnapshotSha256:
      descriptor.manifest.sourceSnapshot?.sha256 ||
      descriptor.manifest.sourceOntologySha256,
    files: descriptor.fileHashes,
    inventory: {
      records: records.length,
      proposals: records.filter((record) => record._recordSource === "proposal")
        .length,
      controls: records.filter((record) => record._recordSource === "control")
        .length,
      manualChecks: records.filter(
        (record) => record._recordSource === "manual-check",
      ).length,
      issueTypes: unique(records.map((record) => record.issueType)).length,
      recordsWithDependencies: records.filter(
        (record) => (record.workflow?.dependsOnProposalIds || []).length > 0,
      ).length,
      dependencyLinks: dependencyLinks.length,
      brokenDependencyLinks: dependencyLinks.filter(
        (proposalId) => !recordIds.has(proposalId),
      ).length,
    },
    reviewTrace: {
      reviewers: unique(
        currentResponses.map(
          (response) => aliases.get(response.reviewerId) || "unknown-reviewer",
        ),
      ).length,
      currentResponses: currentResponses.length,
      retractedResponses: responses.filter(
        (response) => response.status === "retracted",
      ).length,
      matchedCurrentResponses: matchedResponses.length,
      orphanedCurrentResponses: orphanedResponses.length,
      proposalsWithAnyCurrentJudgment: currentProposalIds.size,
      ...decisionSummary(currentResponses),
      matchedDecisions: decisionSummary(matchedResponses),
      orphanedDecisions: decisionSummary(orphanedResponses),
      elapsed: summarizeElapsed(currentResponses),
      matchedElapsed: summarizeElapsed(matchedResponses),
      revisions: revisionSummary(revisions),
      sessions: {
        total: sessions.length,
        active: sessions.filter((session) => session.status === "active")
          .length,
        completed: sessions.filter((session) => session.status === "completed")
          .length,
      },
    },
    instrumentation: {
      timedJudgmentRate: ratio(
        summarizeElapsed(matchedResponses).recorded,
        matchedResponses.length,
      ),
      recordsMissingDetectorPromptVersion: records.filter(
        (record) =>
          !normalizeText(record.internalModelEvidence?.detectorPromptVersion),
      ).length,
      recordsMissingJudgePromptVersion: records.filter(
        (record) =>
          record.internalModelEvidence?.judgeId &&
          !normalizeText(record.internalModelEvidence?.judgePromptVersion),
      ).length,
      recordsMissingSourceSnapshotHash: records.filter(
        (record) =>
          !normalizeText(record.provenance?.sourceSnapshotSha256) &&
          !normalizeText(record.provenance?.sourceOntologySha256),
      ).length,
    },
    byIssue: perIssueSummaries({
      records,
      currentResponses: matchedResponses,
      revisions,
      aliases,
    }),
    byReviewer: perReviewerSummaries({
      currentResponses: matchedResponses,
      revisions,
      aliases,
      roles,
    }),
    byDetector: groupJudgments(
      matchedResponses,
      proposalById,
      (proposal) => proposal?.internalModelEvidence?.detectorId || "missing",
    ),
    byJudge: groupJudgments(
      matchedResponses,
      proposalById,
      (proposal) => proposal?.internalModelEvidence?.judgeId || "missing",
    ),
    byDetectorPrompt: groupJudgments(
      matchedResponses,
      proposalById,
      (proposal) =>
        proposal?.internalModelEvidence?.detectorPromptVersion || "missing",
    ),
    byJudgePrompt: groupJudgments(
      matchedResponses,
      proposalById,
      (proposal) =>
        proposal?.internalModelEvidence?.judgePromptVersion || "missing",
    ),
    byJudgeConfidence: groupJudgments(
      matchedResponses,
      proposalById,
      (proposal) =>
        proposal?.internalModelEvidence?.judgeConfidence || "missing",
    ),
    focusReviewer: focusReviewerId
      ? {
          label: aliases.get(focusReviewerId) || "focus-reviewer",
          role: roles.get(focusReviewerId) || "contributor",
          ...decisionSummary(allFocusResponses),
          matchedJudgments: focusResponses.length,
          orphanedJudgments: orphanedFocusResponses.length,
          elapsed: summarizeElapsed(allFocusResponses),
          revisions: revisionSummary(focusRevisions),
        }
      : null,
  };
};

const multiset = (values, keyFor, displayFor) => {
  const items = new Map();
  for (const value of values) {
    const key = keyFor(value);
    const existing = items.get(key) || {
      key,
      display: displayFor(value),
      count: 0,
    };
    existing.count += 1;
    items.set(key, existing);
  }
  return items;
};

const multisetDifference = (left, right) => {
  const differences = [];
  for (const [key, item] of left.entries()) {
    const remaining = item.count - (right.get(key)?.count || 0);
    if (remaining > 0) {
      differences.push({ ...item, count: remaining });
    }
  }
  return differences.sort((a, b) => a.display.localeCompare(b.display, "en"));
};

const edgeRecord = (edge, nodesById) => {
  const parentTitle = normalizeText(nodesById.get(edge.parentId)?.title);
  const childTitle = normalizeText(nodesById.get(edge.childId)?.title);
  const collectionName = normalizeText(edge.collectionName || "main");
  return {
    parentTitle: parentTitle || "[missing node]",
    collectionName: collectionName || "main",
    childTitle: childTitle || "[missing node]",
  };
};

const edgeDisplay = (edge) =>
  `${edge.parentTitle} > [${edge.collectionName}] > ${edge.childTitle}`;

export const compareSnapshots = (original, current) => {
  const originalNodesById = new Map(
    (original.nodes || []).map((node) => [node.id, node]),
  );
  const currentNodesById = new Map(
    (current.nodes || []).map((node) => [node.id, node]),
  );
  const originalTitles = multiset(
    original.nodes || [],
    (node) => normalizeKey(node.title),
    (node) => normalizeText(node.title) || "[untitled node]",
  );
  const currentTitles = multiset(
    current.nodes || [],
    (node) => normalizeKey(node.title),
    (node) => normalizeText(node.title) || "[untitled node]",
  );
  const originalEdges = (original.edges || []).map((edge) =>
    edgeRecord(edge, originalNodesById),
  );
  const currentEdges = (current.edges || []).map((edge) =>
    edgeRecord(edge, currentNodesById),
  );
  const originalEdgeSet = multiset(
    originalEdges,
    (edge) =>
      [
        normalizeKey(edge.parentTitle),
        normalizeKey(edge.collectionName),
        normalizeKey(edge.childTitle),
      ].join("\u001f"),
    edgeDisplay,
  );
  const currentEdgeSet = multiset(
    currentEdges,
    (edge) =>
      [
        normalizeKey(edge.parentTitle),
        normalizeKey(edge.collectionName),
        normalizeKey(edge.childTitle),
      ].join("\u001f"),
    edgeDisplay,
  );

  return {
    comparisonMethod:
      "Normalized title and parent-collection-child signatures; node IDs are not compared across ontology copies.",
    original: {
      ontologyName: original.ontologyName || "",
      capturedAt: original.capturedAt || "",
      nodes: (original.nodes || []).length,
      edges: (original.edges || []).length,
    },
    current: {
      ontologyName: current.ontologyName || "",
      capturedAt: current.capturedAt || "",
      nodes: (current.nodes || []).length,
      edges: (current.edges || []).length,
    },
    addedTitles: multisetDifference(currentTitles, originalTitles),
    removedTitles: multisetDifference(originalTitles, currentTitles),
    addedEdges: multisetDifference(currentEdgeSet, originalEdgeSet),
    removedEdges: multisetDifference(originalEdgeSet, currentEdgeSet),
  };
};

export const buildBranchSummaries = (datasets, snapshotComparisons) =>
  [...groupBy(datasets, (dataset) => dataset.branch).entries()]
    .map(([branch, branchDatasets]) => {
      const sorted = [...branchDatasets].sort((left, right) =>
        String(left.generatedAt).localeCompare(String(right.generatedAt)),
      );
      const totals = sorted.reduce(
        (accumulator, dataset) => {
          accumulator.records += dataset.inventory.records;
          accumulator.currentJudgments += dataset.reviewTrace.currentResponses;
          accumulator.matchedJudgments +=
            dataset.reviewTrace.matchedCurrentResponses;
          accumulator.orphanedJudgments +=
            dataset.reviewTrace.orphanedCurrentResponses;
          accumulator.agree += dataset.reviewTrace.agree;
          accumulator.disagree += dataset.reviewTrace.disagree;
          accumulator.edits += dataset.reviewTrace.revisions.edits;
          accumulator.undos += dataset.reviewTrace.revisions.undos;
          return accumulator;
        },
        {
          records: 0,
          currentJudgments: 0,
          matchedJudgments: 0,
          orphanedJudgments: 0,
          agree: 0,
          disagree: 0,
          edits: 0,
          undos: 0,
        },
      );
      return {
        branch,
        rounds: sorted.length,
        firstDatasetVersion: sorted[0]?.datasetVersion || "",
        currentDatasetVersion: sorted[sorted.length - 1]?.datasetVersion || "",
        ...totals,
        proposalAcceptanceRate: ratio(
          totals.agree,
          totals.agree + totals.disagree,
        ),
        snapshotEvolution: snapshotComparisons.get(branch) || null,
      };
    })
    .sort((left, right) => left.branch.localeCompare(right.branch));

const markdownPercent = (value) =>
  value === null || value === undefined ? "n/a" : `${Math.round(value * 100)}%`;

const markdownSeconds = (value) =>
  value === null || value === undefined ? "n/a" : `${value}s`;

const markdownTable = (headers, rows) => {
  const header = `| ${headers.join(" | ")} |`;
  const divider = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.join(" | ")} |`);
  return [header, divider, ...body].join("\n");
};

const limitedList = (items, limit = 12) => {
  if (!items.length) return ["- None."];
  const visible = items
    .slice(0, limit)
    .map(
      (item) => `- ${item.display}${item.count > 1 ? ` (${item.count})` : ""}`,
    );
  if (items.length > limit) {
    visible.push(`- ...and ${items.length - limit} more in the JSON export.`);
  }
  return visible;
};

export const renderBaselineMarkdown = (baseline) => {
  const lines = [
    "# Ontology Oversight Formative Baseline",
    "",
    `Captured: ${baseline.capturedAt}`,
    "",
    `Code revision: \`${baseline.codeState.commit}\` on \`${baseline.codeState.branch}\`${
      baseline.codeState.dirty ? " (working tree had uncommitted changes)" : ""
    }`,
    "",
    "> This is a descriptive export of operational pilot data. It is not a",
    "> preregistered or confirmatory study result, and proposal acceptance is not",
    "> equivalent to correctness.",
    "",
    "## Branch summary",
    "",
    markdownTable(
      [
        "Branch",
        "Rounds",
        "Recorded",
        "Matched",
        "Orphaned",
        "Agree",
        "Disagree",
        "Acceptance",
        "Edits",
        "Undos",
      ],
      baseline.branches.map((branch) => [
        branch.branch,
        branch.rounds,
        branch.currentJudgments,
        branch.matchedJudgments,
        branch.orphanedJudgments,
        branch.agree,
        branch.disagree,
        markdownPercent(branch.proposalAcceptanceRate),
        branch.edits,
        branch.undos,
      ]),
    ),
    "",
    "## Dataset timeline",
    "",
    markdownTable(
      [
        "Branch",
        "Dataset version",
        "Records",
        "Recorded",
        "Matched",
        "Orphaned",
        "Reviewers",
        "Acceptance",
        "Timed",
        "Median",
      ],
      baseline.datasets.map((dataset) => [
        dataset.branch,
        `\`${dataset.datasetVersion}\``,
        dataset.inventory.records,
        dataset.reviewTrace.currentResponses,
        dataset.reviewTrace.matchedCurrentResponses,
        dataset.reviewTrace.orphanedCurrentResponses,
        dataset.reviewTrace.reviewers,
        markdownPercent(dataset.reviewTrace.proposalAcceptanceRate),
        markdownPercent(dataset.instrumentation.timedJudgmentRate),
        markdownSeconds(dataset.reviewTrace.elapsed.medianSeconds),
      ]),
    ),
    "",
  ];

  for (const branch of baseline.branches) {
    const comparison = branch.snapshotEvolution;
    if (!comparison) continue;
    lines.push(
      `## ${branch.branch} snapshot evolution`,
      "",
      `${comparison.original.nodes} nodes and ${comparison.original.edges} edges became ` +
        `${comparison.current.nodes} nodes and ${comparison.current.edges} edges.`,
      "",
      `Comparison method: ${comparison.comparisonMethod}`,
      "",
      "### Added or newly titled nodes",
      "",
      ...limitedList(comparison.addedTitles),
      "",
      "### Removed or replaced titles",
      "",
      ...limitedList(comparison.removedTitles),
      "",
      "### Added structural links",
      "",
      ...limitedList(comparison.addedEdges),
      "",
      "### Removed structural links",
      "",
      ...limitedList(comparison.removedEdges),
      "",
    );
  }

  lines.push(
    "## Instrumentation status",
    "",
    "- Current judgments, save/edit/undo revisions, and sessions were exported read-only from Firestore.",
    "- Recorded, matchable, and orphaned judgments are reported separately; no historical response is silently dropped.",
    "- Reviewer labels are one-way pseudonyms; raw reviewer IDs and email addresses are excluded.",
    "- Elapsed time is wall-clock card time, not verified active attention. Values over 30 minutes are flagged.",
    "- Dataset, snapshot, prompt-evidence, agent, review code, and exporter files are SHA-256 inventoried.",
    "- The current production UI remains the operational reviewer surface. Research summaries remain separate.",
    "",
    "## Interpretation limits",
    "",
    "- These rounds were used to improve prompts, dependencies, hierarchy state, and interface behavior.",
    "- Reviewers did not receive randomized conditions, independent evidence-only and rationale stages, or a frozen confirmatory protocol.",
    "- Repeated judgments across regenerated ontology copies are not independent observations.",
    "- Agreement records whether a reviewer accepted a proposal, not whether the proposal is objectively correct.",
    "- The semantic snapshot diff uses normalized titles and edge labels because cloned ontology copies do not share node IDs.",
    "",
  );
  return `${lines.join("\n")}\n`;
};

export const renderTomBrief = (baseline) => {
  const sell = baseline.branches.find((branch) => branch.branch === "Sell");
  const sellDatasets = baseline.datasets.filter(
    (dataset) => dataset.branch === "Sell",
  );
  const focusRows = sellDatasets
    .filter((dataset) => dataset.focusReviewer)
    .map((dataset) => [
      `\`${dataset.datasetVersion}\``,
      dataset.focusReviewer.judgments,
      dataset.focusReviewer.matchedJudgments,
      dataset.focusReviewer.orphanedJudgments,
      dataset.focusReviewer.agree,
      dataset.focusReviewer.disagree,
      markdownPercent(dataset.focusReviewer.proposalAcceptanceRate),
    ]);
  const comparison = sell?.snapshotEvolution;

  const lines = [
    "# Tom Review Package: Sell Ontology Pilot",
    "",
    "## Purpose",
    "",
    "This package supports an independent inspection of the current Sell hierarchy,",
    "followed by a review of how the expert-guided LLM workflow reached it. The",
    "sequence matters: seeing the prior expert's answers first would anchor the new",
    "review and erase the independent comparison the team wants.",
    "",
    "## Recommended review sequence",
    "",
    "1. Open the production review app and select the Sell workspace.",
    "2. Expand the current hierarchy without opening the disagreement appendix.",
    "3. Record anything unclear, misplaced, duplicated, missing, or grouped at the wrong granularity.",
    "4. Compare the original and current outlines side by side.",
    "5. Only then open `expert-steward-disagreements.md` and compare the earlier expert's reasoning with your independent notes.",
    "6. In the meeting, classify differences as agent error, reviewer error, missing evidence, policy ambiguity, or legitimate alternative organization.",
    "",
    "Production review surface: https://ontology.mit.edu/review?dataset=sell-current",
    "",
    "## What is frozen for this review",
    "",
    `- Current Sell dataset: \`${sell?.currentDatasetVersion || "not found"}\``,
    `- Baseline Sell dataset: \`${sell?.firstDatasetVersion || "not found"}\``,
    `- Code revision: \`${baseline.codeState.commit}\``,
    `- Capture time: ${baseline.capturedAt}`,
    "",
  ];

  if (comparison) {
    lines.push(
      "## Structural scan",
      "",
      `${comparison.original.nodes} nodes and ${comparison.original.edges} links became ` +
        `${comparison.current.nodes} nodes and ${comparison.current.edges} links.`,
      "",
      "This is a title-and-link comparison rather than an ID diff because each applied",
      "review cycle created a new ontology copy.",
      "",
      "### Added or newly titled nodes",
      "",
      ...limitedList(comparison.addedTitles, 20),
      "",
      "### Removed or replaced titles",
      "",
      ...limitedList(comparison.removedTitles, 20),
      "",
    );
  }

  lines.push(
    "## Expert review trace by round",
    "",
    focusRows.length
      ? markdownTable(
          [
            "Dataset version",
            "Recorded",
            "Matched",
            "Orphaned",
            "Agree",
            "Disagree",
            "Acceptance",
          ],
          focusRows,
        )
      : "No focus reviewer was configured for this export.",
    "",
    focusRows.length
      ? "The table separates judgments that still match the frozen dataset from historical responses whose source record is no longer present."
      : "",
    "",
    "The complete aggregate metrics are in `study-baseline.md`; the machine-readable",
    "file is `study-baseline.json`. The disagreement appendix intentionally omits",
    "reviewer identity and should remain closed until the independent hierarchy scan",
    "is complete.",
    "",
    "## Meeting decisions",
    "",
    "1. Which remaining Sell issues require prompt changes versus local corrections?",
    "2. Which task families can a nonexpert review reliably enough to reduce expert time?",
    "3. Which disagreements are legitimate alternatives that the system should preserve?",
    "4. What far-transfer branch, unlike the near-mirror Buy branch, will test generalization?",
    "5. What smallest paid pilot can estimate value per minute for LLM, nonexpert, and expert oversight?",
    "",
  );
  return `${lines.join("\n")}\n`;
};

export const renderFocusDisagreements = ({
  datasets,
  focusReviewerId,
  focusReviewerLabel,
}) => {
  const lines = [
    "# Expert Steward Disagreements",
    "",
    "> Open this appendix only after the new reviewer has independently inspected",
    "> the current hierarchy. It contains operational pilot judgments, not ground truth.",
    "",
    `Reviewer label: ${focusReviewerLabel}`,
    "",
  ];
  let total = 0;
  let orphaned = 0;
  let orphanedDisagreements = 0;
  for (const dataset of datasets) {
    const proposalById = new Map(
      dataset.records.map((record) => [record.proposalId, record]),
    );
    const orphanedFocusResponses = dataset.responses.filter(
      (response) =>
        response.status === "current" &&
        response.reviewerId === focusReviewerId &&
        !proposalById.has(response.proposalId),
    );
    orphaned += orphanedFocusResponses.length;
    orphanedDisagreements += orphanedFocusResponses.filter(
      (response) => response.response?.decision === "disagree",
    ).length;
    const disagreements = dataset.responses
      .filter(
        (response) =>
          response.status === "current" &&
          response.reviewerId === focusReviewerId &&
          response.response?.decision === "disagree" &&
          proposalById.has(response.proposalId),
      )
      .map((response) => ({
        response,
        proposal: proposalById.get(response.proposalId),
      }))
      .sort((left, right) =>
        String(left.proposal.issueType).localeCompare(
          String(right.proposal.issueType),
        ),
      );
    if (!disagreements.length) continue;
    total += disagreements.length;
    lines.push(`## ${dataset.manifest.datasetVersion}`, "");
    for (const { response, proposal } of disagreements) {
      const payload = response.response || {};
      lines.push(
        `### ${normalizeText(proposal.subject?.title) || "Untitled item"}`,
        "",
        `- Issue type: \`${proposal.issueType}\``,
        `- Question: ${normalizeText(proposal.reviewerView?.question)}`,
        `- Agent proposal: ${normalizeText(proposal.reviewerView?.proposedState)}`,
        `- Disagreement reason: ${normalizeText(payload.disagreementReason) || "Not recorded."}`,
        `- Suggested correction: ${normalizeText(payload.suggestedCorrection) || "Not recorded."}`,
        "",
      );
    }
  }
  if (total === 0) {
    lines.push(
      "No current disagreements were found for the focus reviewer.",
      "",
    );
  }
  lines.splice(
    6,
    0,
    `Matchable current disagreements across exported rounds: ${total}`,
    `Unmatched historical focus-reviewer responses: ${orphaned} (${orphanedDisagreements} disagreements). Their source records are no longer present, so this appendix does not reconstruct their content.`,
    "",
  );
  return `${lines.join("\n")}\n`;
};
