import crypto from "node:crypto";

const clean = (value) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");

const titleWithoutSynonyms = (title) =>
  clean(title).replace(/\s*\(Synonyms?:[^)]*\)\s*$/i, "");

export const normalizeTitle = (value) =>
  titleWithoutSynonyms(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const stableHash = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");

const STRUCTURAL_TITLES = new Set(["(Atomic Tasks)", "(Specializations)"]);
const TOP_LEVEL_BRANCHES = [
  "Act on information (“Think”)",
  "Act on physical objects (“Do”)",
  "Act with other activities and actors (“Interact”)",
];

export const titleWords = (title) =>
  titleWithoutSynonyms(title)
    .replace(/[()[\]]/g, " ")
    .split(/\s+/)
    .map(clean)
    .filter(Boolean);

export const leadingAction = (title) => titleWords(title)[0] || "";

export const recordedActionAliases = (title) => {
  const value = clean(title);
  const synonymMatch = value.match(/\(Synonyms?:\s*([^)]*)\)\s*$/i);
  const variants = [titleWithoutSynonyms(value)];
  if (synonymMatch?.[1]) variants.push(...synonymMatch[1].split(","));
  return [
    ...new Set(
      variants
        .map((variant) => leadingAction(variant).toLowerCase())
        .filter(Boolean),
    ),
  ];
};

export const onetTaskText = (value) =>
  clean(value).replace(/^\(O\*Net\)\s+.+?\s+-\s+/i, "");

export const onetTaskId = (value) => {
  const match = clean(value).match(/^\(O\*Net\)\s+(.+?)\s+-\s+/i);
  return clean(match?.[1]);
};

export const synsetIdsFromTitle = (title) =>
  [...clean(title).matchAll(/\b([A-Za-z][A-Za-z_'-]*\.v\.\d{2})\b/g)].map(
    (match) => match[1].toLowerCase(),
  );

const semanticPath = (path) =>
  path.filter(
    (title) =>
      !STRUCTURAL_TITLES.has(title) && !/^\[[^\]]+\]$/.test(clean(title)),
  );

const evidenceBucket = (count) => {
  if (count === 1) return "single";
  if (count <= 5) return "small-multi";
  if (count <= 20) return "medium-multi";
  return "large";
};

const branchForPath = (path) =>
  TOP_LEVEL_BRANCHES.find((title) => path.includes(title)) || "Other";

export const genericActionDiagnostic = (occurrences) => {
  const flagged = occurrences.filter((record) =>
    ["act", "perform"].includes(record.leadingAction.toLowerCase()),
  );
  return {
    rule: "Flag exact leading actions Act and Perform for a separate review after title grouping and WordNet alignment.",
    occurrenceCount: flagged.length,
    uniqueTitleCount: new Set(flagged.map((record) => record.normalizedTitle))
      .size,
    examples: flagged
      .map((record) => record.exactTitle)
      .sort((left, right) => left.localeCompare(right))
      .filter(
        (title, index, values) => index === 0 || title !== values[index - 1],
      )
      .slice(0, 20),
  };
};

/**
 * The exported hierarchy stores O*NET arrays only below an `(Atomic Tasks)`
 * marker. Those array-owning titles are the exact atomic activities reviewed
 * here; marker and collection labels are not review subjects.
 */
export const extractAtomicActivities = (hierarchy) => {
  const occurrences = [];

  const walk = ({ value, path = [], ownerTitle = "", inAtomic = false }) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    for (const [rawTitle, child] of Object.entries(value)) {
      const title = clean(rawTitle);
      const nextPath = [...path, title];
      const nextInAtomic = inAtomic || title === "(Atomic Tasks)";
      const nextOwnerTitle =
        title === "(Atomic Tasks)" ? clean(path.at(-1)) : ownerTitle;
      if (Array.isArray(child)) {
        if (!nextInAtomic) continue;
        const exactRecords = child.map(clean).filter(Boolean);
        if (!exactRecords.length) continue;
        const displayPath = semanticPath(nextPath);
        const titleCountsAsAtomic = title !== "(Atomic Tasks)";
        if (!titleCountsAsAtomic) continue;
        occurrences.push({
          occurrenceId: `atomic-${stableHash(nextPath.join("\u001f")).slice(0, 20)}`,
          exactTitle: title,
          normalizedTitle: normalizeTitle(title),
          leadingAction: leadingAction(title),
          recordedActionAliases: recordedActionAliases(title),
          ownerTitle: nextOwnerTitle,
          assignedSynsetIds: synsetIdsFromTitle(nextOwnerTitle),
          path: displayPath,
          parentTitle: clean(displayPath.at(-2)),
          topLevelBranch: branchForPath(displayPath),
          evidenceBucket: evidenceBucket(exactRecords.length),
          evidenceCount: exactRecords.length,
          sourceRecords: exactRecords.map((record, index) => ({
            index: index + 1,
            oNetId: onetTaskId(record),
            exactRecord: record,
            task: onetTaskText(record),
          })),
        });
      } else {
        walk({
          value: child,
          path: nextPath,
          ownerTitle: nextOwnerTitle,
          inAtomic: nextInAtomic,
        });
      }
    }
  };

  walk({ value: hierarchy });
  const titleCounts = new Map();
  const linkedTitlesByExactRecord = new Map();
  for (const occurrence of occurrences) {
    titleCounts.set(
      occurrence.normalizedTitle,
      (titleCounts.get(occurrence.normalizedTitle) || 0) + 1,
    );
    for (const sourceRecord of occurrence.sourceRecords) {
      const linkedTitles =
        linkedTitlesByExactRecord.get(sourceRecord.exactRecord) || new Map();
      linkedTitles.set(occurrence.normalizedTitle, occurrence.exactTitle);
      linkedTitlesByExactRecord.set(sourceRecord.exactRecord, linkedTitles);
    }
  }
  return occurrences.map((occurrence) => ({
    ...occurrence,
    exactTitleOccurrenceCount: titleCounts.get(occurrence.normalizedTitle),
    sourceRecords: occurrence.sourceRecords.map((sourceRecord) => ({
      ...sourceRecord,
      otherLinkedAtomicTitles: [
        ...(linkedTitlesByExactRecord
          .get(sourceRecord.exactRecord)
          ?.entries() || []),
      ]
        .filter(
          ([normalizedTitle]) => normalizedTitle !== occurrence.normalizedTitle,
        )
        .map(([, exactTitle]) => exactTitle)
        .sort((left, right) => left.localeCompare(right)),
    })),
  }));
};

const deterministicOrder = (records, seed) =>
  [...records].sort((left, right) =>
    stableHash(`${seed}|${left.occurrenceId}`).localeCompare(
      stableHash(`${seed}|${right.occurrenceId}`),
    ),
  );

const eligibleForSample = (record) => {
  const words = titleWords(record.exactTitle);
  return (
    TOP_LEVEL_BRANCHES.includes(record.topLevelBranch) &&
    words.length >= 2 &&
    words.length <= 7 &&
    Boolean(record.leadingAction) &&
    !/[\[\]]/.test(record.exactTitle)
  );
};

export const selectStratifiedSample = ({
  occurrences,
  seed,
  priorityExactTitles = [],
  bucketQuotas = {
    single: 2,
    "small-multi": 2,
    "medium-multi": 1,
    large: 1,
  },
}) => {
  if (!clean(seed)) throw new Error("A non-empty sample seed is required");
  for (const [bucket, quota] of Object.entries(bucketQuotas)) {
    if (!Number.isInteger(quota) || quota < 1) {
      throw new Error(`Sample quota for ${bucket} must be a positive integer`);
    }
  }
  const eligible = occurrences.filter(eligibleForSample);
  const normalizedPriorityTitles = priorityExactTitles.map(normalizeTitle);
  const selected = [];
  const selectedActions = new Set();
  const strata = TOP_LEVEL_BRANCHES.flatMap((branch) =>
    Object.keys(bucketQuotas).map((bucket) => ({ branch, bucket })),
  );

  for (const stratum of strata) {
    const quota = bucketQuotas[stratum.bucket];
    const candidates = deterministicOrder(
      eligible.filter(
        (record) =>
          record.topLevelBranch === stratum.branch &&
          record.evidenceBucket === stratum.bucket,
      ),
      `${seed}|${stratum.branch}|${stratum.bucket}`,
    );
    const priorityCandidates = normalizedPriorityTitles.flatMap((title) => {
      const match = candidates.find(
        (record) => record.normalizedTitle === title,
      );
      return match ? [match] : [];
    });
    if (priorityCandidates.length > quota) {
      throw new Error(
        `Priority cases exceed the sample quota for ${stratum.branch} / ${stratum.bucket}`,
      );
    }
    const repeatedTitleCandidate = candidates.find(
      (record) =>
        record.exactTitleOccurrenceCount > 1 &&
        !selectedActions.has(record.leadingAction.toLowerCase()),
    );
    const distinctActions = candidates.filter(
      (record) => !selectedActions.has(record.leadingAction.toLowerCase()),
    );
    const pool = [
      ...priorityCandidates,
      ...(repeatedTitleCandidate ? [repeatedTitleCandidate] : []),
      ...distinctActions,
      ...candidates,
    ];
    const selectedIds = new Set();
    for (const candidate of pool) {
      if (selectedIds.has(candidate.occurrenceId)) continue;
      selectedIds.add(candidate.occurrenceId);
      selected.push(candidate);
      selectedActions.add(candidate.leadingAction.toLowerCase());
      if (selectedIds.size === quota) break;
    }
    if (selectedIds.size < quota) {
      throw new Error(
        `Not enough candidates for ${stratum.branch} / ${stratum.bucket}`,
      );
    }
  }

  return selected.map((record, index) => ({
    ...record,
    sampleIndex: index + 1,
  }));
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const uniqueIntegers = (values) =>
  [...new Set((values || []).map(Number))].sort((left, right) => left - right);

const distinctIntegers = (values, label) => {
  assert(Array.isArray(values), `${label} must be an array`);
  const numbers = values.map(Number);
  assert(
    numbers.every(Number.isInteger),
    `${label} must contain only integer indexes`,
  );
  assert(
    new Set(numbers).size === numbers.length,
    `${label} contains a repeated index`,
  );
  return [...numbers].sort((left, right) => left - right);
};

const normalizedEvidence = (value) =>
  clean(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

const actionForms = (value) => {
  const words = normalizeTitle(value).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const base = words.at(-1);
  const prefix = words.slice(0, -1).join(" ");
  const inflections = new Set([base, `${base}s`, `${base}ed`, `${base}ing`]);
  if (base.endsWith("e")) {
    inflections.add(`${base}d`);
    inflections.add(`${base.slice(0, -1)}ing`);
  }
  if (/[^aeiou]y$/.test(base)) {
    inflections.add(`${base.slice(0, -1)}ies`);
    inflections.add(`${base.slice(0, -1)}ied`);
  }
  return [...inflections].map((word) => (prefix ? `${prefix} ${word}` : word));
};

const containsRecordedAction = (quote, aliases) => {
  const normalizedQuote = ` ${normalizeTitle(quote)} `;
  return aliases.some((alias) =>
    actionForms(alias).some((form) =>
      normalizedQuote.includes(` ${normalizeTitle(form)} `),
    ),
  );
};

const REQUIRED_AUDIT_CHECKS = [
  "evidenceComplete",
  "actionPreserved",
  "groupingHomogeneous",
  "modifierGrounded",
  "existingLinksRespected",
  "titlesConsolidated",
];

export const validateGroupingAssessment = ({
  record,
  assessment,
  existingTitles,
}) => {
  assert(record, "Grouping assessment references an unknown record");
  assert(
    assessment.occurrenceId === record.occurrenceId,
    `Grouping assessment ID mismatch for ${record.exactTitle}`,
  );
  assert(
    ["keep", "rename", "split", "defer"].includes(assessment.decision),
    `Unsupported grouping decision for ${record.exactTitle}`,
  );
  const groups = Array.isArray(assessment.groups) ? assessment.groups : [];
  const deferredTaskIndexes = uniqueIntegers(assessment.deferredTaskIndexes);
  const validIndexes = new Set(record.sourceRecords.map((item) => item.index));
  const covered = new Set();
  const groupTitles = new Set();
  const currentAction = record.leadingAction.toLowerCase();

  for (const group of groups) {
    const normalized = normalizeTitle(group.title);
    assert(normalized, `A group for ${record.exactTitle} has no title`);
    assert(
      !groupTitles.has(normalized),
      `Duplicate group title "${group.title}" for ${record.exactTitle}`,
    );
    groupTitles.add(normalized);
    assert(
      ["current", "existing", "new"].includes(group.status),
      `Invalid group status for ${record.exactTitle}: ${group.status}`,
    );
    assert(
      leadingAction(group.title).toLowerCase() === currentAction,
      `Group "${group.title}" changes the leading action of ${record.exactTitle}`,
    );
    const indexes = uniqueIntegers(group.sourceTaskIndexes);
    assert(indexes.length > 0, `Group "${group.title}" has no evidence`);
    for (const index of indexes) {
      assert(
        validIndexes.has(index),
        `Group "${group.title}" cites invalid source item ${index}`,
      );
      covered.add(index);
    }
    const exists = existingTitles.has(normalized);
    if (group.status === "current") {
      assert(
        normalized === record.normalizedTitle,
        `Current group must retain exact title ${record.exactTitle}`,
      );
    } else if (group.status === "existing") {
      assert(exists, `Existing group not found in ontology: ${group.title}`);
      assert(
        normalized !== record.normalizedTitle,
        `Current title must use status current: ${group.title}`,
      );
    } else {
      assert(!exists, `New group already exists in ontology: ${group.title}`);
    }
    assert(clean(group.reason), `Group "${group.title}" needs a reason`);
  }

  for (const index of deferredTaskIndexes) {
    assert(validIndexes.has(index), `Deferred source item ${index} is invalid`);
    assert(
      !covered.has(index),
      `Source item ${index} is both grouped and deferred`,
    );
  }
  const accounted = new Set([...covered, ...deferredTaskIndexes]);
  assert(
    accounted.size === record.sourceRecords.length,
    `${record.exactTitle} accounts for ${accounted.size} of ${record.sourceRecords.length} source records`,
  );
  assert(
    clean(assessment.reason),
    `Grouping assessment for ${record.exactTitle} needs a reason`,
  );
  assert(
    ["high", "medium", "low"].includes(assessment.confidence),
    `Grouping assessment for ${record.exactTitle} needs a valid confidence`,
  );
  const audit = assessment.audit;
  assert(
    audit && typeof audit === "object",
    `${record.exactTitle} needs an audit`,
  );
  assert(
    audit.verdict === "approve",
    `${record.exactTitle} did not pass the independent audit`,
  );
  assert(
    ["high", "medium", "low"].includes(audit.confidence),
    `Audit for ${record.exactTitle} needs a valid confidence`,
  );
  assert(clean(audit.reason), `Audit for ${record.exactTitle} needs a reason`);
  for (const check of REQUIRED_AUDIT_CHECKS) {
    assert(
      audit.checks?.[check] === true,
      `Audit check ${check} did not pass for ${record.exactTitle}`,
    );
  }

  if (assessment.decision === "keep") {
    assert(
      groups.length === 1,
      `Keep must produce one group for ${record.exactTitle}`,
    );
    assert(
      groups[0].status === "current",
      `Keep must retain ${record.exactTitle}`,
    );
    assert(deferredTaskIndexes.length === 0, "Keep cannot defer evidence");
  }
  if (assessment.decision === "rename") {
    assert(
      groups.length === 1,
      `Rename must produce one group for ${record.exactTitle}`,
    );
    assert(
      groups[0].status !== "current",
      `Rename must change ${record.exactTitle}`,
    );
    assert(deferredTaskIndexes.length === 0, "Rename cannot defer evidence");
  }
  if (assessment.decision === "split") {
    assert(
      groups.length >= 2,
      `Split needs at least two groups for ${record.exactTitle}`,
    );
  }
  if (assessment.decision === "defer") {
    assert(
      groups.length === 0,
      `Defer must not manufacture groups for ${record.exactTitle}`,
    );
    assert(
      deferredTaskIndexes.length === record.sourceRecords.length,
      `Defer must defer every source item for ${record.exactTitle}`,
    );
  }

  return {
    ...assessment,
    groups: groups.map((group) => {
      const indexes = uniqueIntegers(group.sourceTaskIndexes);
      return {
        ...group,
        sourceTaskIndexes: indexes,
        sourceTasks: indexes.map(
          (index) => record.sourceRecords[index - 1].task,
        ),
      };
    }),
    deferredTaskIndexes,
    deferredTasks: deferredTaskIndexes.map(
      (index) => record.sourceRecords[index - 1].task,
    ),
  };
};

export const validateGroupingAssessments = ({
  occurrences,
  assessments,
  existingTitles: suppliedExistingTitles,
}) => {
  const recordsById = new Map(
    occurrences.map((record) => [record.occurrenceId, record]),
  );
  const existingTitles =
    suppliedExistingTitles ||
    new Set(occurrences.map((record) => record.normalizedTitle));
  const assessmentIds = new Set();
  const validated = assessments.map((assessment) => {
    assert(
      !assessmentIds.has(assessment.occurrenceId),
      `Duplicate assessment for ${assessment.occurrenceId}`,
    );
    assessmentIds.add(assessment.occurrenceId);
    return validateGroupingAssessment({
      record: recordsById.get(assessment.occurrenceId),
      assessment,
      existingTitles,
    });
  });
  assert(
    validated.length === occurrences.length,
    `Expected ${occurrences.length} assessments; received ${validated.length}`,
  );
  return validated;
};

/**
 * Rob's streamlined title pass treats an O*NET record as the unit being
 * grouped. The model proposes titles and record indexes; deterministic code
 * derives title status and the keep/rename/split/defer decision.
 */
export const validateSimpleGroupingAssessment = ({
  record,
  assessment,
  existingTitles,
}) => {
  assert(record, "Grouping assessment references an unknown record");
  assert(
    assessment.occurrenceId === record.occurrenceId,
    `Grouping assessment ID mismatch for ${record.exactTitle}`,
  );
  const groups = Array.isArray(assessment.groups) ? assessment.groups : [];
  const deferredTaskIndexes = uniqueIntegers(assessment.deferredTaskIndexes);
  const validIndexes = new Set(record.sourceRecords.map((item) => item.index));
  const covered = new Set();
  const groupTitles = new Set();
  const currentAction = record.leadingAction.toLowerCase();

  const validatedGroups = groups.map((group) => {
    const normalized = normalizeTitle(group.title);
    assert(normalized, `A group for ${record.exactTitle} has no title`);
    assert(
      !groupTitles.has(normalized),
      `Duplicate group title "${group.title}" for ${record.exactTitle}`,
    );
    groupTitles.add(normalized);
    assert(
      leadingAction(group.title).toLowerCase() === currentAction,
      `Group "${group.title}" changes the leading action of ${record.exactTitle}`,
    );
    const indexes = uniqueIntegers(group.sourceTaskIndexes);
    assert(indexes.length > 0, `Group "${group.title}" has no evidence`);
    for (const index of indexes) {
      assert(
        validIndexes.has(index),
        `Group "${group.title}" cites invalid source item ${index}`,
      );
      assert(
        !covered.has(index),
        `Source item ${index} appears in more than one group for ${record.exactTitle}`,
      );
      covered.add(index);
    }
    assert(clean(group.reason), `Group "${group.title}" needs a reason`);
    const status =
      normalized === record.normalizedTitle
        ? "current"
        : existingTitles.has(normalized)
          ? "existing"
          : "new";
    return {
      title: clean(group.title),
      status,
      sourceTaskIndexes: indexes,
      sourceTasks: indexes.map((index) => record.sourceRecords[index - 1].task),
      reason: clean(group.reason),
    };
  });

  for (const index of deferredTaskIndexes) {
    assert(validIndexes.has(index), `Deferred source item ${index} is invalid`);
    assert(
      !covered.has(index),
      `Source item ${index} is both grouped and deferred`,
    );
  }
  const accounted = new Set([...covered, ...deferredTaskIndexes]);
  assert(
    accounted.size === record.sourceRecords.length,
    `${record.exactTitle} accounts for ${accounted.size} of ${record.sourceRecords.length} source records`,
  );
  assert(
    clean(assessment.reason),
    `Grouping assessment for ${record.exactTitle} needs a reason`,
  );
  assert(
    ["high", "medium", "low"].includes(assessment.confidence),
    `Grouping assessment for ${record.exactTitle} needs a valid confidence`,
  );
  assert(
    !deferredTaskIndexes.length ||
      (validatedGroups.length === 0 &&
        deferredTaskIndexes.length === record.sourceRecords.length),
    `A deferred ${record.exactTitle} case must defer every record instead of mixing proposals and deferrals`,
  );

  const decision =
    validatedGroups.length === 0
      ? "defer"
      : validatedGroups.length === 1
        ? validatedGroups[0].status === "current"
          ? "keep"
          : "rename"
        : "split";

  return {
    occurrenceId: assessment.occurrenceId,
    decision,
    groups: validatedGroups,
    deferredTaskIndexes,
    deferredTasks: deferredTaskIndexes.map(
      (index) => record.sourceRecords[index - 1].task,
    ),
    reason: clean(assessment.reason),
    confidence: assessment.confidence,
  };
};

export const validateSimpleGroupingAssessments = ({
  occurrences,
  assessments,
  existingTitles: suppliedExistingTitles,
}) => {
  const recordsById = new Map(
    occurrences.map((record) => [record.occurrenceId, record]),
  );
  const existingTitles =
    suppliedExistingTitles ||
    new Set(occurrences.map((record) => record.normalizedTitle));
  const assessmentIds = new Set();
  const validated = assessments.map((assessment) => {
    assert(
      !assessmentIds.has(assessment.occurrenceId),
      `Duplicate assessment for ${assessment.occurrenceId}`,
    );
    assessmentIds.add(assessment.occurrenceId);
    return validateSimpleGroupingAssessment({
      record: recordsById.get(assessment.occurrenceId),
      assessment,
      existingTitles,
    });
  });
  assert(
    validated.length === occurrences.length,
    `Expected ${occurrences.length} assessments; received ${validated.length}`,
  );
  return validated;
};

/**
 * Rob's shared Claude example shows that an O*NET sentence is not always the
 * atomic evidence unit: one sentence can contain multiple direct objects for
 * the same action. V3 therefore binds groups to source-supported
 * predicate-object claims while still requiring every source record to be
 * represented or the complete case to be deferred.
 */
export const validateClaimGroupingAssessment = ({
  record,
  assessment,
  existingTitles,
  existingTitleCounts,
}) => {
  assert(record, "Grouping assessment references an unknown record");
  assert(
    assessment.occurrenceId === record.occurrenceId,
    `Grouping assessment ID mismatch for ${record.exactTitle}`,
  );
  const groups = Array.isArray(assessment.groups) ? assessment.groups : [];
  const deferredTaskIndexes = distinctIntegers(
    assessment.deferredTaskIndexes || [],
    `Deferred indexes for ${record.exactTitle}`,
  );
  const validIndexes = new Set(record.sourceRecords.map((item) => item.index));
  const representedRecords = new Set();
  const seenClaims = new Set();
  const groupTitles = new Set();
  const currentAction = record.leadingAction.toLowerCase();
  const acceptedActionAliases = record.recordedActionAliases?.length
    ? record.recordedActionAliases
    : [currentAction];

  const validatedGroups = groups.map((group) => {
    const title = clean(group.title);
    const normalized = normalizeTitle(title);
    const canonicalDirectObject = clean(group.canonicalDirectObject);
    const normalizedDirectObject = normalizeTitle(canonicalDirectObject);
    assert(normalized, `A group for ${record.exactTitle} has no title`);
    assert(
      titleWords(title).length >= 2 && titleWords(title).length <= 5,
      `Group "${title}" must contain 2-5 words`,
    );
    assert(
      !groupTitles.has(normalized),
      `Duplicate group title "${title}" for ${record.exactTitle}`,
    );
    groupTitles.add(normalized);
    assert(
      leadingAction(title).toLowerCase() === currentAction,
      `Group "${title}" changes the leading action of ${record.exactTitle}`,
    );
    assert(
      normalizedDirectObject,
      `Group "${title}" needs one canonical direct object`,
    );
    assert(
      normalized.endsWith(normalizedDirectObject),
      `Group "${title}" must end with its canonical direct object "${canonicalDirectObject}"`,
    );
    const sourceClaims = Array.isArray(group.sourceClaims)
      ? group.sourceClaims
      : [];
    assert(sourceClaims.length > 0, `Group "${title}" has no evidence claims`);

    const validatedClaims = sourceClaims.map((claim) => {
      const sourceTaskIndex = Number(claim.sourceTaskIndex);
      const directObject = clean(claim.directObject);
      const evidenceQuote = clean(claim.evidenceQuote);
      assert(
        Number.isInteger(sourceTaskIndex) && validIndexes.has(sourceTaskIndex),
        `Group "${title}" cites invalid source item ${claim.sourceTaskIndex}`,
      );
      assert(
        directObject,
        `Group "${title}" has a claim without a direct object`,
      );
      assert(
        evidenceQuote,
        `Group "${title}" has a claim without an evidence quote`,
      );
      const sourceTask = record.sourceRecords[sourceTaskIndex - 1].task;
      assert(
        normalizedEvidence(sourceTask).includes(
          normalizedEvidence(evidenceQuote),
        ),
        `Evidence quote for source item ${sourceTaskIndex} is not present in the exact O*NET record`,
      );
      assert(
        normalizedEvidence(evidenceQuote).includes(
          normalizedEvidence(directObject),
        ),
        `Direct object "${directObject}" is not present in its evidence quote`,
      );
      assert(
        containsRecordedAction(evidenceQuote, acceptedActionAliases),
        `Evidence quote for ${record.exactTitle} source item ${sourceTaskIndex} does not contain the canonical action or a recorded title synonym`,
      );
      const claimKey = `${sourceTaskIndex}|${normalizeTitle(directObject)}`;
      assert(
        !seenClaims.has(claimKey),
        `Source claim ${sourceTaskIndex} / ${directObject} appears more than once for ${record.exactTitle}`,
      );
      seenClaims.add(claimKey);
      representedRecords.add(sourceTaskIndex);
      return {
        claimId: `claim-${stableHash(`${record.occurrenceId}|${claimKey}`).slice(0, 20)}`,
        sourceTaskIndex,
        directObject,
        evidenceQuote,
        sourceTask,
      };
    });
    assert(clean(group.reason), `Group "${title}" needs a reason`);
    const status =
      normalized === record.normalizedTitle
        ? "current"
        : existingTitles.has(normalized)
          ? "existing"
          : "new";
    const existingOccurrenceCount =
      status === "existing"
        ? existingTitleCounts?.get(normalized) || 1
        : undefined;
    const sourceTaskIndexes = [
      ...new Set(validatedClaims.map((claim) => claim.sourceTaskIndex)),
    ].sort((left, right) => left - right);
    return {
      title: status === "current" ? record.exactTitle : title,
      canonicalDirectObject,
      status,
      ...(existingOccurrenceCount ? { existingOccurrenceCount } : {}),
      sourceClaims: validatedClaims,
      sourceTaskIndexes,
      sourceTasks: sourceTaskIndexes.map(
        (index) => record.sourceRecords[index - 1].task,
      ),
      reason: clean(group.reason),
    };
  });

  for (const index of deferredTaskIndexes) {
    assert(validIndexes.has(index), `Deferred source item ${index} is invalid`);
    assert(
      !representedRecords.has(index),
      `Source item ${index} is both grouped and deferred`,
    );
  }
  const accounted = new Set([...representedRecords, ...deferredTaskIndexes]);
  assert(
    accounted.size === record.sourceRecords.length,
    `${record.exactTitle} accounts for ${accounted.size} of ${record.sourceRecords.length} source records`,
  );
  assert(
    clean(assessment.reason),
    `Grouping assessment for ${record.exactTitle} needs a reason`,
  );
  assert(
    ["high", "medium", "low"].includes(assessment.confidence),
    `Grouping assessment for ${record.exactTitle} needs a valid confidence`,
  );
  assert(
    !deferredTaskIndexes.length ||
      (validatedGroups.length === 0 &&
        deferredTaskIndexes.length === record.sourceRecords.length),
    `A deferred ${record.exactTitle} case must defer every record instead of mixing proposals and deferrals`,
  );

  const decision =
    validatedGroups.length === 0
      ? "defer"
      : validatedGroups.length === 1
        ? validatedGroups[0].status === "current"
          ? "keep"
          : "rename"
        : "split";

  return {
    occurrenceId: assessment.occurrenceId,
    decision,
    groups: validatedGroups,
    deferredTaskIndexes,
    deferredTasks: deferredTaskIndexes.map(
      (index) => record.sourceRecords[index - 1].task,
    ),
    reason: clean(assessment.reason),
    confidence: assessment.confidence,
  };
};

export const validateClaimGroupingAssessments = ({
  occurrences,
  assessments,
  existingTitles: suppliedExistingTitles,
  existingTitleCounts: suppliedExistingTitleCounts,
}) => {
  const recordsById = new Map(
    occurrences.map((record) => [record.occurrenceId, record]),
  );
  const existingTitles =
    suppliedExistingTitles ||
    new Set(occurrences.map((record) => record.normalizedTitle));
  const existingTitleCounts =
    suppliedExistingTitleCounts ||
    occurrences.reduce((counts, record) => {
      counts.set(
        record.normalizedTitle,
        (counts.get(record.normalizedTitle) || 0) + 1,
      );
      return counts;
    }, new Map());
  const assessmentIds = new Set();
  const validated = assessments.map((assessment) => {
    assert(
      !assessmentIds.has(assessment.occurrenceId),
      `Duplicate assessment for ${assessment.occurrenceId}`,
    );
    assessmentIds.add(assessment.occurrenceId);
    return validateClaimGroupingAssessment({
      record: recordsById.get(assessment.occurrenceId),
      assessment,
      existingTitles,
      existingTitleCounts,
    });
  });
  assert(
    validated.length === occurrences.length,
    `Expected ${occurrences.length} assessments; received ${validated.length}`,
  );
  return validated;
};

export const claimGroupingPromptTemplate = `You are checking one atomic activity title against every exact O*NET record linked to it. The title was originally reduced to a leading verb and one direct object, so a meaning-defining modifier or an additional direct object may have been omitted.

Inputs:
- Current atomic title: [CURRENT TITLE]
- Canonical action and any action synonyms recorded in that title: [RECORDED ACTION ALIASES]
- Numbered exact O*NET records. Each record also lists every other atomic title already linked to that same sentence: [NUMBERED O*NET RECORDS]

For each record, identify every distinct direct-object claim governed by the current title's action that is not already represented by another linked atomic title. Read the complete clause: a meaning-defining restriction can appear before the object head or after it in a complement or trailing phrase, such as "alternatives for Web architecture or technologies." Carry that restriction into the proposed title when omitting it would make the activity materially broader than the evidence.

A sentence may supply more than one claim when the same action explicitly governs different objects, such as selling funeral services and selling funeral merchandise. Coordinated named subtypes that share a head noun can also require separate claims when the distinction is material, such as storing audio data and storing video data. Do not collapse them merely because they share the word "data." Do not split ordinary examples of one category, incidental audience, method, purpose, or different actions into extra claims.

Group claims that can share one accurate activity title. Use the current title when it is already informative enough; otherwise add only the smallest source-supported modifier needed to identify the activity. Every proposed title must:
- contain 2-5 words;
- preserve the current leading action;
- name exactly one canonical direct object; and
- avoid audience, method, purpose, venue, or other incidental context.

Consolidate claims requiring the same title. A new title is provisional until a later placement review. Do not evaluate WordNet, change the action, or decide final ontology placement. If the evidence cannot be classified without guessing, defer the whole case.

Return structured data only: groups with title, canonicalDirectObject, sourceClaims, and a short reason. Each sourceClaim must contain sourceTaskIndex, a concise directObject phrase copied from the record, and an exact evidenceQuote copied from the record that includes the canonical action or one recorded action synonym. Also return deferredTaskIndexes, one overall reason, and confidence. Do not return title status or a keep/rename/split label; deterministic code derives them.`;

export const claimGroupingValidationRules = `Bind the result to the exact sampled occurrence and source hierarchy hash. Require every O*NET record to contribute at least one validated predicate-object claim or, if unresolved, require the complete case to be deferred. Permit one record in multiple groups only through distinct direct-object claims for the preserved action. Require each direct-object phrase to occur in an exact evidence quote, each quote to occur in its exact source record, and each quote to include the canonical action or an action synonym recorded in the current title. Reject duplicate claims, duplicate group titles, unsupported source indexes, changed leading actions, titles outside 2-5 words, titles that do not end in their one declared canonical direct object, and partial deferrals. Derive source indexes, exact source tasks, title status, existing-title occurrence count, and keep/rename/split/defer deterministically. An existing title string does not choose a merge or placement target; placement remains a later review. This stage performs no semantic correction or independent model audit.`;

export const simpleGroupingPromptTemplate = `You are checking one atomic activity title against every O*NET record linked to it. The title was originally reduced to a leading verb and direct object, so a meaning-defining modifier may have been omitted.

Inputs:
- Current atomic title: [CURRENT TITLE]
- Numbered exact O*NET records. Each record also lists any other atomic titles linked to that same sentence: [NUMBERED O*NET RECORDS]

For each numbered record, consider only the clause represented by the current title's leading verb and direct object. Assign that record exactly once:
- to the current title when the title already describes the activity at a useful level of generality; or
- to one clearer title made by adding only the smallest source-supported modifier needed to distinguish a more specific activity.

Put records requiring the same title in one group. Preserve the current leading verb. Do not divide one O*NET record among multiple groups. Other actions or objects in the sentence are handled by their other linked atomic titles or a later coverage review. Do not evaluate WordNet senses, replace the leading verb, decide final ontology placement, or add audience, method, purpose, venue, or other incidental context. A new title is only a provisional child of the current title until later placement review.

If any record cannot be classified without guessing, defer the whole case. Return structured data only: groups with title, sourceTaskIndexes, and a short evidence-grounded reason; deferredTaskIndexes; one overall reason; and confidence. Do not return a keep/rename/split label or title status; deterministic code derives them.`;

export const simpleGroupingValidationRules = `Mechanically bind the result to the sampled source occurrence and exact source hierarchy hash. Require every O*NET record index to appear exactly once across the proposed groups or, when the case is unresolved, require every index to be deferred. Reject duplicate group titles, changed leading verbs, missing or repeated indexes, partial deferrals, and unsupported record indexes. Derive current/existing/new status from the exact ontology title inventory and derive keep, rename, split, or defer from the validated groups. Require concise reasons and confidence. This validator performs no semantic correction and no independent model audit.`;

export const assignedSynsetCheckPromptTemplate = `You are checking the WordNet verb sense currently assigned to one accepted homogeneous activity group.

Inputs:
- Accepted activity title: [GROUP TITLE]
- Every exact O*NET record in this accepted group: [GROUP O*NET RECORDS]
- Current assigned WordNet synset ID, definition, lemmas, and examples: [ASSIGNED SYNSET]

Judge whether the assigned synset accurately represents the leading verb as used in every supplied record. Use the complete title and evidence, not the verb string alone. Return correct-for-all, incorrect-for-all, mixed, or uncertain. For mixed, list the exact record indexes for which the synset is incorrect. Do not search WordNet, suggest a replacement, change the title, or decide placement.`;

export const conditionalSynsetSelectionPromptTemplate = `The assigned WordNet sense was not correct for every record in one accepted homogeneous activity group.

Inputs:
- Accepted activity title: [GROUP TITLE]
- The exact O*NET records needing a different sense: [FLAGGED O*NET RECORDS]
- Every WordNet verb synset retrieved locally for the title's exact leading verb, with IDs, definitions, lemmas, and examples: [LOCAL CANDIDATE SYNSETS]

Select the one candidate synset that best represents the leading verb across all supplied records. Use no source outside the supplied candidates and never invent an ID. Return replace with one selectedSynsetId, no-suitable-synset, or uncertain, plus a short evidence-grounded reason and confidence. Do not change the title or ontology placement.`;

export const conditionalWordNetProcedureRules = `Run only after a human accepts the homogeneous title group. First compare the accepted title and every grouped O*NET record with only the currently assigned synset. Stop when it is correct for all. For incorrect-for-all or mixed results, retrieve every verb synset for the exact leading verb from the pinned local WordNet corpus and run the conditional selection prompt only on the affected evidence. Validate every displayed definition and selected ID against that local corpus. Never browse for senses, precompute candidates for accepted assignments, or create a WordNet proposal before title acceptance.`;

export const allCandidateSynsetPromptTemplate = `You are aligning one human-accepted homogeneous activity group with WordNet.

Inputs:
- Accepted activity title: [GROUP TITLE]
- Every exact O*NET record and accepted predicate-object claim in the group: [GROUP EVIDENCE]
- The inherited WordNet synset or synsets whose lemmas match the title's exact action phrase: [MATCHING INHERITED SYNSETS]
- Every WordNet verb synset retrieved locally for that exact action phrase, with ID, definition, lemmas, and examples: [ALL LOCAL CANDIDATE SYNSETS]

Compare all supplied candidates before judging the inherited assignment. Select the one synset whose definition best represents the action as used across every evidence claim. Do not accept a sense merely because its lemma matches the title. If different evidence claims require different senses, return mixed-evidence so title grouping can be reopened. If no supplied sense fits, return no-suitable-synset. If the evidence cannot distinguish candidates, return uncertain.

Use only the supplied local candidates and never invent an ID. Return structured data only: outcome selected, mixed-evidence, no-suitable-synset, or uncertain; selectedSynsetId only for selected; one short evidence-grounded reason; and confidence. Do not change the title or ontology placement.`;

export const allCandidateWordNetProcedureRules = `Run only after a human accepts a homogeneous title group. Resolve the title's action phrase by selecting the longest locally available WordNet verb lemma that matches the start of the accepted title, so phrasal verbs such as "set up" are not reduced to "set." Filter inherited synsets to those containing that exact action lemma. Retrieve every local WordNet verb synset for the same action phrase, then make one model call containing the accepted title, all accepted evidence claims, matching inherited assignments, and all local candidates. Deterministically verify every displayed and selected ID against the pinned local corpus. Derive keep-assigned when the one selected sense is the sole matching inherited assignment, narrow-assignment when it is one of multiple matching inherited assignments, replace when it is not inherited, or reopen-grouping for mixed-evidence. No WordNet proposal is generated before title acceptance.`;

const normalizeLemma = (value) =>
  normalizeTitle(clean(value).replace(/_/g, " "));

export const resolveActionPhrase = ({
  title,
  canonicalDirectObject,
  candidateSynsets = [],
}) => {
  const normalized = normalizeTitle(title);
  const normalizedObject = normalizeTitle(canonicalDirectObject);
  if (normalizedObject && normalized.endsWith(` ${normalizedObject}`)) {
    const declaredAction = normalized.slice(0, -normalizedObject.length).trim();
    if (declaredAction) return declaredAction;
  }
  const matchingLemmas = candidateSynsets
    .flatMap((synset) => synset.lemmas || [])
    .map(normalizeLemma)
    .filter(
      (lemma) =>
        lemma && (normalized === lemma || normalized.startsWith(`${lemma} `)),
    )
    .sort((left, right) => right.split(" ").length - left.split(" ").length);
  return matchingLemmas[0] || normalizeTitle(leadingAction(title));
};

export const matchingInheritedSynsets = ({
  title,
  canonicalDirectObject,
  inheritedSynsets = [],
  candidateSynsets = [],
}) => {
  const actionPhrase = resolveActionPhrase({
    title,
    canonicalDirectObject,
    candidateSynsets,
  });
  return inheritedSynsets.filter((synset) =>
    (synset.lemmas || []).some(
      (lemma) => normalizeLemma(lemma) === actionPhrase,
    ),
  );
};

export const validateAllCandidateSynsetAssessment = ({
  bundle,
  assessment,
}) => {
  assert(bundle, "WordNet assessment references an unknown accepted group");
  assert(
    assessment.groupId === bundle.groupId,
    `WordNet group ID mismatch for ${bundle.groupTitle}`,
  );
  assert(
    ["selected", "mixed-evidence", "no-suitable-synset", "uncertain"].includes(
      assessment.outcome,
    ),
    `Unsupported WordNet outcome for ${bundle.groupTitle}`,
  );
  assert(
    clean(assessment.reason),
    `${bundle.groupTitle} needs a WordNet reason`,
  );
  assert(
    ["high", "medium", "low"].includes(assessment.confidence),
    `${bundle.groupTitle} needs a valid WordNet confidence`,
  );
  const selectedSynsetId = clean(assessment.selectedSynsetId).toLowerCase();
  const candidates = new Set(
    (bundle.candidateSynsets || []).map((item) => item.id.toLowerCase()),
  );
  if (assessment.outcome === "selected") {
    assert(
      candidates.has(selectedSynsetId),
      `${bundle.groupTitle} selected a synset outside the local candidates: ${selectedSynsetId}`,
    );
  } else {
    assert(
      !selectedSynsetId,
      `${assessment.outcome} cannot select a synset for ${bundle.groupTitle}`,
    );
  }
  const inherited = matchingInheritedSynsets({
    title: bundle.groupTitle,
    canonicalDirectObject: bundle.canonicalDirectObject,
    inheritedSynsets: bundle.inheritedSynsets || [],
    candidateSynsets: bundle.candidateSynsets || [],
  }).map((item) => item.id.toLowerCase());
  const decision =
    assessment.outcome === "mixed-evidence"
      ? "reopen-grouping"
      : assessment.outcome === "no-suitable-synset"
        ? "no-suitable-synset"
        : assessment.outcome === "uncertain"
          ? "uncertain"
          : inherited.includes(selectedSynsetId)
            ? inherited.length === 1
              ? "keep-assigned"
              : "narrow-assignment"
            : "replace";
  return {
    ...assessment,
    selectedSynsetId: selectedSynsetId || null,
    actionPhrase: resolveActionPhrase({
      title: bundle.groupTitle,
      canonicalDirectObject: bundle.canonicalDirectObject,
      candidateSynsets: bundle.candidateSynsets || [],
    }),
    matchingInheritedSynsetIds: inherited.sort(),
    decision,
  };
};

export const groupingPromptTemplate = `You are reviewing one exact atomic activity from a work-activity ontology. The ontology title was compressed to one leading verb and one direct object from longer O*NET work descriptions. Compression sometimes omitted modifiers needed to distinguish genuinely different activities.

Inputs:
- Exact current atomic title: [CURRENT TITLE]
- Current semantic parent and path: [PARENT AND PATH]
- Every exact O*NET record currently attached to this title, numbered, including any other atomic titles already linked to that exact record: [ALL SOURCE RECORDS AND EXISTING LINKS]
- Exact existing ontology titles that could be reused: [MATCHING EXISTING TITLES]

Task:
Partition the numbered O*NET records into the smallest set of homogeneous activity groups whose titles accurately convey the work. A group is homogeneous only when one stand-alone title covers the same leading action and the relevant direct-object meaning of every record assigned to it at the same useful level of specificity.

Rules:
1. Preserve the exact leading action in this title stage. Defer evidence that primarily expresses another action; WordNet alignment and placement are checked later.
2. Keep the current generic title only for records that genuinely use the object generically. When a modifier makes the object meaningfully more specific, add the smallest evidence-supported modifier to the title.
3. Records that require the same resulting title belong in one group. Never create duplicate nodes for the same proposed title.
4. Reuse an exact existing activity when it has the same action and meaning. Pay particular attention to the other atomic titles already linked to each exact source record: do not manufacture a duplicate activity for a clause that one of those links already captures. Otherwise mark the proposed title as new. A new title is provisionally a child of the current title; final placement is a later operation.
5. Keep products, services, actors, information, and other distinct direct-object types separate. Do not join distinct activities with “and” or “or” merely because one O*NET sentence mentions both.
6. Focus on the clause that instantiates the current action. Do not add audience, venue, method, purpose, or incidental actions unless they define the direct-object activity itself.
7. A source record may support more than one group only when it explicitly contains multiple separable direct-object activities governed by the current action. Every source index must be assigned to at least one group or explicitly deferred.
8. For one source record, keep the current title if it already captures the activity; otherwise propose one clearer title. For multiple records, allow: all remain together; some remain generic while others become specializations; or all move into two or more specific groups.
9. Use concise, natural activity titles. Do not infer facts absent from the supplied O*NET text.
10. Return structured data only: decision keep, rename, split, or defer; groups with title, status current/existing/new, sourceTaskIndexes, and reason; deferredTaskIndexes; one overall reason; and confidence.`;

export const groupingAuditPromptTemplate = `Independently audit a proposed homogeneous grouping for one atomic activity using the exact current title and all numbered O*NET records.

Reject or correct the proposal if it drops evidence, changes the leading action, uses incidental context as a modifier, combines different direct-object activities, splits records that one accurate title covers, creates duplicate titles, fails to reuse an exact existing activity, or labels a specific record as generic. Confirm that every evidence index is grouped or explicitly deferred and that repeated proposed titles have been consolidated. New nodes are only provisional children of the current title; this pass does not decide final placement.`;

export const groupingValidationRules = `Mechanically validate every grouping before it enters expert review: the source hierarchy hash and occurrence ID must match; every source index must be valid and accounted for; no index may be both grouped and deferred; group titles must be unique; every group must preserve the current leading action; current/existing/new status must match the snapshot title inventory; keep and rename must have exactly one group; split must have at least two groups; defer must defer all evidence; and every group and assessment must include a rationale. The validator never changes a semantic judgment.`;

export const wordNetAlignmentPromptTemplate = `You are checking the WordNet verb sense assigned to one homogeneous atomic activity group after title clarification.

Inputs:
- Resulting homogeneous activity title: [GROUP TITLE]
- Every exact O*NET source record assigned to this group: [GROUP SOURCE RECORDS]
- Current owning ontology verb and inherited assigned synset or synsets, with definitions, lemmas, and examples: [ASSIGNED SYNSETS]
- Every WordNet verb synset returned locally for the title's exact leading action, with definitions, lemmas, and examples: [CANDIDATE SYNSETS]

Task:
Decide whether the inherited assigned synset set accurately represents the leading action as it is used across every source record in this homogeneous group.

Rules:
1. Interpret the action from the complete activity title and all assigned O*NET evidence, not from the verb string alone.
2. Keep an assigned synset only if its definition fits every source record in the group. Do not accept a sense merely because its lemma matches the leading word.
3. If the assigned set is wrong or needlessly contains unrelated senses, select the best matching candidate synset or smallest justified candidate set for the exact leading action.
4. Candidate retrieval is deterministic and local. Do not browse, invent a synset ID, or use definitions outside the supplied WordNet candidates.
5. If none of the supplied candidates fits, return no-suitable-synset. If the evidence does not distinguish candidates, return uncertain rather than forcing a choice.
6. This pass does not change the title, move the activity, merge verbs, or edit the ontology. It creates an expert-review proposal only.

Return structured data only: decision keep-assigned, replace, no-suitable-synset, or uncertain; selectedSynsetIds; one evidence-grounded reason; and confidence.`;

export const wordNetAlignmentAuditPromptTemplate = `Independently audit one proposed WordNet alignment using the homogeneous activity title, all of its assigned O*NET records, every inherited synset definition, and every locally retrieved candidate definition. Reject or correct any proposal that relies on the verb string alone, overlooks a source record, keeps an unrelated inherited sense, invents a synset, selects a sense whose definition does not cover the evidence, or forces a choice where WordNet has no suitable or distinguishable candidate. This audit cannot change titles or ontology placement.`;

export const wordNetAlignmentValidationRules = `Mechanically validate each WordNet assessment before expert review: bind it to one validated homogeneous group; require the source hierarchy and title-proposal IDs to match; require every displayed O*NET record to be exactly the records assigned to that group; resolve every inherited and selected synset in the local WordNet corpus; require selected IDs to come from the locally retrieved candidate set; keep-assigned must select exactly the inherited set; replace must select a nonempty different set; no-suitable-synset and uncertain must select none; require a rationale, confidence, and an approved audit. The validator never substitutes its own semantic judgment.`;

const WORDNET_AUDIT_CHECKS = [
  "evidenceComplete",
  "assignedCompared",
  "candidateBound",
  "definitionFit",
  "noForcedChoice",
];

const sameStringSet = (left, right) => {
  const normalizedLeft = [...new Set(left || [])].sort();
  const normalizedRight = [...new Set(right || [])].sort();
  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index])
  );
};

export const validateWordNetAssessment = ({ bundle, assessment }) => {
  assert(bundle, "WordNet assessment references an unknown group");
  assert(
    assessment.groupId === bundle.groupId,
    `WordNet group ID mismatch for ${bundle.groupTitle}`,
  );
  assert(
    ["keep-assigned", "replace", "no-suitable-synset", "uncertain"].includes(
      assessment.decision,
    ),
    `Unsupported WordNet decision for ${bundle.groupTitle}`,
  );
  assert(
    clean(assessment.reason),
    `${bundle.groupTitle} needs a WordNet reason`,
  );
  assert(
    ["high", "medium", "low"].includes(assessment.confidence),
    `${bundle.groupTitle} needs a valid WordNet confidence`,
  );

  const selected = [...new Set(assessment.selectedSynsetIds || [])].sort();
  const assigned = bundle.assignedSynsets.map((item) => item.id).sort();
  const candidates = new Set(bundle.candidateSynsets.map((item) => item.id));
  for (const synsetId of selected) {
    assert(
      candidates.has(synsetId),
      `${bundle.groupTitle} selected a synset outside the local candidates: ${synsetId}`,
    );
  }
  if (assessment.decision === "keep-assigned") {
    assert(
      sameStringSet(selected, assigned),
      `Keep-assigned must retain the exact inherited set for ${bundle.groupTitle}`,
    );
  }
  if (assessment.decision === "replace") {
    assert(
      selected.length > 0,
      `Replace needs a synset for ${bundle.groupTitle}`,
    );
    assert(
      !sameStringSet(selected, assigned),
      `Replace must change the inherited set for ${bundle.groupTitle}`,
    );
  }
  if (
    assessment.decision === "no-suitable-synset" ||
    assessment.decision === "uncertain"
  ) {
    assert(
      selected.length === 0,
      `${assessment.decision} cannot select a synset for ${bundle.groupTitle}`,
    );
  }

  const audit = assessment.audit;
  assert(
    audit?.verdict === "approve",
    `${bundle.groupTitle} failed WordNet audit`,
  );
  assert(
    clean(audit.reason),
    `${bundle.groupTitle} needs a WordNet audit reason`,
  );
  assert(
    ["high", "medium", "low"].includes(audit.confidence),
    `${bundle.groupTitle} needs a valid WordNet audit confidence`,
  );
  for (const check of WORDNET_AUDIT_CHECKS) {
    assert(
      audit.checks?.[check] === true,
      `WordNet audit check ${check} did not pass for ${bundle.groupTitle}`,
    );
  }

  return { ...assessment, selectedSynsetIds: selected };
};
