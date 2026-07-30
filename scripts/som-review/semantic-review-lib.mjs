const clean = (value) => String(value || "").trim();

const titleCase = (value) =>
  clean(value)
    .split(/\s+/)
    .map((part) =>
      part
        .split("-")
        .map((segment) =>
          segment
            ? `${segment.charAt(0).toUpperCase()}${segment.slice(1).toLowerCase()}`
            : "",
        )
        .join("-"),
    )
    .join(" ");

export const normalizeCollection = (value = "") => {
  const unwrapped = clean(value).replace(/^\[/, "").replace(/\]$/, "");
  return !unwrapped || unwrapped === "default" ? "main" : unwrapped;
};

export const linkId = (link) =>
  typeof link === "string" ? link : clean(link?.id);

export const isOnetEvidence = (node) =>
  Boolean(
    node &&
    (node.oNet === true ||
      node.oNetTask === true ||
      /^\(O\*Net\)\s+[^-]+\s*-\s*/i.test(clean(node.title))),
  );

export const semanticChildren = (node, nodesById) =>
  (node?.specializations || [])
    .flatMap((collection) => collection.nodes || [])
    .map(linkId)
    .map((id) => nodesById.get(id))
    .filter((child) => child && !isOnetEvidence(child));

export const allChildren = (node) =>
  (node?.specializations || [])
    .flatMap((collection) =>
      (collection.nodes || []).map((link) => ({
        id: linkId(link),
        collectionName: normalizeCollection(collection.collectionName),
      })),
    )
    .filter((child) => child.id);

export const collectDescendantIds = (rootId, nodesById) => {
  const descendants = new Set();
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || descendants.has(id)) continue;
    descendants.add(id);
    for (const child of allChildren(nodesById.get(id))) {
      if (nodesById.has(child.id)) queue.push(child.id);
    }
  }
  return descendants;
};

export const cosineSimilarity = (left, right) => {
  if (
    !Array.isArray(left) ||
    !Array.isArray(right) ||
    left.length !== right.length
  ) {
    throw new Error("Embedding vectors must have equal non-zero dimensions");
  }
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  if (leftNorm === 0 || rightNorm === 0) {
    throw new Error("Embedding vectors must have non-zero norms");
  }
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
};

export const rankSemanticCandidates = ({
  candidates,
  candidateEmbeddings,
  queryEmbeddings,
  queryLabels,
  limitPerQuery = 24,
  overallLimit = 80,
}) => {
  if (candidates.length !== candidateEmbeddings.length) {
    throw new Error("Every semantic candidate requires one embedding");
  }
  if (queryEmbeddings.length !== queryLabels.length) {
    throw new Error("Every semantic query requires one label");
  }

  const rankedByQuery = queryEmbeddings.map((queryEmbedding, queryIndex) =>
    candidates
      .map((candidate, candidateIndex) => ({
        ...candidate,
        queryLabel: queryLabels[queryIndex],
        similarity: cosineSimilarity(
          queryEmbedding,
          candidateEmbeddings[candidateIndex],
        ),
      }))
      .sort(
        (left, right) =>
          right.similarity - left.similarity ||
          clean(left.title).localeCompare(clean(right.title), "en"),
      )
      .slice(0, limitPerQuery),
  );

  const byId = new Map();
  for (const ranked of rankedByQuery.flat()) {
    const current = byId.get(ranked.id);
    if (!current) {
      byId.set(ranked.id, {
        ...ranked,
        matchedQueries: [
          { label: ranked.queryLabel, similarity: ranked.similarity },
        ],
      });
      continue;
    }
    current.matchedQueries.push({
      label: ranked.queryLabel,
      similarity: ranked.similarity,
    });
    if (ranked.similarity > current.similarity) {
      current.similarity = ranked.similarity;
      current.queryLabel = ranked.queryLabel;
    }
  }

  return [...byId.values()]
    .map((candidate) => ({
      ...candidate,
      matchedQueries: candidate.matchedQueries.sort(
        (left, right) => right.similarity - left.similarity,
      ),
    }))
    .sort(
      (left, right) =>
        right.similarity - left.similarity ||
        clean(left.title).localeCompare(clean(right.title), "en"),
    )
    .slice(0, overallLimit);
};

export const detectEmptySemanticNodes = ({
  rootId,
  nodesById,
  parentEdgesByChild,
}) => {
  const descendants = collectDescendantIds(rootId, nodesById);
  return [...descendants]
    .map((id) => nodesById.get(id))
    .filter(
      (node) =>
        node &&
        node.id !== rootId &&
        !isOnetEvidence(node) &&
        allChildren(node).length === 0,
    )
    .map((node) => {
      const parentEdges = parentEdgesByChild.get(node.id) || [];
      return {
        id: node.id,
        title: clean(node.title),
        description: clean(node.properties?.description || node.description),
        synonyms: [
          ...new Set(
            (node.actionAlternatives || []).map(clean).filter(Boolean),
          ),
        ].sort((left, right) => left.localeCompare(right, "en")),
        parents: parentEdges
          .map((edge) => ({
            id: edge.parentId,
            title: clean(nodesById.get(edge.parentId)?.title),
            collectionName: normalizeCollection(edge.collectionName),
          }))
          .filter((parent) => parent.title)
          .sort((left, right) => left.title.localeCompare(right.title, "en")),
      };
    })
    .sort((left, right) => left.title.localeCompare(right.title, "en"));
};

/**
 * Named collections are structural objects even when they contain no nodes.
 * The implicit main collection is excluded because it is not a reviewer-
 * created grouping and may legitimately be absent or empty.
 */
export const detectEmptyCollections = ({ rootId, nodesById }) => {
  const descendants = collectDescendantIds(rootId, nodesById);
  const seen = new Set();
  return [...descendants]
    .map((id) => nodesById.get(id))
    .filter((node) => node && !isOnetEvidence(node))
    .flatMap((parent) =>
      (parent.specializations || []).flatMap((collection) => {
        const collectionName = normalizeCollection(collection.collectionName);
        const childIds = (collection.nodes || []).map(linkId).filter(Boolean);
        const key = `${parent.id}\u001f${collectionName}`;
        if (collectionName === "main" || childIds.length > 0 || seen.has(key)) {
          return [];
        }
        seen.add(key);
        return [
          {
            parentId: parent.id,
            parentTitle: clean(parent.title),
            collectionName,
          },
        ];
      }),
    )
    .sort(
      (left, right) =>
        left.parentTitle.localeCompare(right.parentTitle, "en") ||
        left.collectionName.localeCompare(right.collectionName, "en"),
    );
};

export const unionCandidatesById = (...candidateLists) => {
  const byId = new Map();
  for (const candidate of candidateLists.flat()) {
    if (!candidate?.id || byId.has(candidate.id)) continue;
    byId.set(candidate.id, candidate);
  }
  return [...byId.values()];
};

const SEMANTIC_REVIEW_CLASSIFICATIONS = new Set([
  "same-sell-action",
  "seller-side-temporary-use",
]);

/**
 * Direct source evidence takes precedence over model judgment. Model-positive
 * candidates remain proposals for expert review only when both their
 * classification and exact destination are allowlisted.
 */
export const mergeSemanticAssessments = ({
  candidates,
  modelAssessments = [],
  deterministicAssessments = [],
  validDestinationTitles = [],
}) => {
  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  const validDestinations = new Set(validDestinationTitles);
  const byId = new Map();

  const add = (assessment, assessmentSource, overwrite = false) => {
    const candidateId = clean(assessment?.candidateId);
    if (
      !candidateIds.has(candidateId) ||
      (!overwrite && byId.has(candidateId))
    ) {
      return;
    }
    const proposedParentTitle = clean(assessment?.proposedParentTitle);
    const includeForExpertReview =
      assessment?.includeForExpertReview === true &&
      SEMANTIC_REVIEW_CLASSIFICATIONS.has(assessment?.classification) &&
      validDestinations.has(proposedParentTitle);
    byId.set(candidateId, {
      ...assessment,
      candidateId,
      proposedParentTitle: includeForExpertReview ? proposedParentTitle : null,
      includeForExpertReview,
      assessmentSource,
    });
  };

  for (const assessment of modelAssessments) {
    add(assessment, "semantic-judge");
  }
  for (const assessment of deterministicAssessments) {
    add(assessment, "direct-source-evidence", true);
  }

  return candidates.map((candidate) => {
    const assessment = byId.get(candidate.id);
    return (
      assessment || {
        candidateId: candidate.id,
        classification: "unrelated",
        includeForExpertReview: false,
        proposedParentTitle: null,
        reason: "No qualifying semantic or direct source evidence was found.",
        assessmentSource: "none",
      }
    );
  });
};

const GENERIC_SELL_OBJECT =
  /^Sell\s+(?:Products?|Items?|Goods?|Suppl(?:y|ies)|Services?|Merchandise|Equipment|Parts?)$/i;

export const collectGenericEvidenceFacts = ({
  rootId,
  nodesById,
  parentEdgesByChild,
}) => {
  const descendants = collectDescendantIds(rootId, nodesById);
  return [...descendants]
    .map((id) => nodesById.get(id))
    .filter(
      (node) =>
        node &&
        !isOnetEvidence(node) &&
        GENERIC_SELL_OBJECT.test(clean(node.title)),
    )
    .flatMap((genericNode) =>
      allChildren(genericNode)
        .map((child) => nodesById.get(child.id))
        .filter(
          (child) =>
            isOnetEvidence(child) &&
            /\bsell(?:ing)?\b/i.test(clean(child.title)),
        )
        .map((task) => {
          const currentParents = (parentEdgesByChild.get(task.id) || [])
            .map((edge) => ({
              id: edge.parentId,
              title: clean(nodesById.get(edge.parentId)?.title),
              collectionName: normalizeCollection(edge.collectionName),
            }))
            .filter((parent) => parent.title)
            .sort((left, right) => left.title.localeCompare(right.title, "en"));
          return {
            genericNodeId: genericNode.id,
            genericNodeTitle: clean(genericNode.title),
            taskId: task.id,
            taskTitle: clean(task.title),
            currentParents,
          };
        }),
    )
    .sort(
      (left, right) =>
        left.genericNodeTitle.localeCompare(right.genericNodeTitle, "en") ||
        left.taskTitle.localeCompare(right.taskTitle, "en"),
    );
};

const GENERIC_OBJECT =
  "(?:products?|items?|goods?|suppl(?:y|ies)|services?|merchandise|equipment|parts?)";

const objectFamily = (value) => {
  const normalized = clean(value).toLowerCase();
  if (/^services?$/.test(normalized)) return "services";
  if (/^equipment$/.test(normalized)) return "equipment";
  if (/^parts?$/.test(normalized)) return "parts";
  if (
    /^(?:products?|items?|goods?|suppl(?:y|ies)|merchandise)$/.test(normalized)
  ) {
    return "products";
  }
  return "";
};

const genericNodeFamily = (title) =>
  objectFamily(clean(title).replace(/^Sell\s+/i, ""));

const taskBody = (title) =>
  clean(title).replace(/^\(O\*Net\)\s+[^-]+\s*-\s*/i, "");

export const findExplicitSellModifierCandidates = (facts) => {
  const values = [];
  const seen = new Set();
  const directPattern = new RegExp(
    `\\b(?:sell|selling)\\s+([a-z][a-z-]*(?:\\s+[a-z][a-z-]*){0,2})\\s+(${GENERIC_OBJECT})\\b`,
    "gi",
  );
  const sharedPattern = new RegExp(
    `\\b(?:sell|selling)\\s+([a-z][a-z-]*)\\s+(${GENERIC_OBJECT})((?:(?:\\s*,\\s*|\\s+(?:or|and)\\s+)${GENERIC_OBJECT})+)`,
    "gi",
  );

  const addCandidate = ({ fact, modifier, object }) => {
    if (
      !modifier ||
      /\b(?:and|or|other|such)\b/i.test(modifier) ||
      objectFamily(object) !== genericNodeFamily(fact.genericNodeTitle)
    ) {
      return;
    }
    const proposedTitle = `Sell ${titleCase(`${modifier} ${object}`)}`;
    const key = `${fact.genericNodeId}\u001f${fact.taskId}\u001f${proposedTitle.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    values.push({
      genericNodeId: fact.genericNodeId,
      genericNodeTitle: fact.genericNodeTitle,
      taskId: fact.taskId,
      proposedTitle,
      evidencePhrase: `${modifier} ${object}`,
    });
  };

  for (const fact of facts) {
    const body = taskBody(fact.taskTitle);
    for (const match of body.matchAll(directPattern)) {
      addCandidate({
        fact,
        modifier: clean(match[1]),
        object: clean(match[2]),
      });
    }
    for (const match of body.matchAll(sharedPattern)) {
      const modifier = clean(match[1]);
      const objects = [
        match[2],
        ...(match[3].match(new RegExp(GENERIC_OBJECT, "gi")) || []),
      ];
      const family = genericNodeFamily(fact.genericNodeTitle);
      const matchingObjects = objects.filter(
        (object) => objectFamily(object) === family,
      );
      const preferredObject =
        matchingObjects.find(
          (object) =>
            clean(object).toLowerCase() ===
            clean(fact.genericNodeTitle)
              .replace(/^Sell\s+/i, "")
              .toLowerCase(),
        ) || matchingObjects[0];
      if (preferredObject) {
        addCandidate({ fact, modifier, object: preferredObject });
      }
    }
  }

  return values.sort(
    (left, right) =>
      left.genericNodeTitle.localeCompare(right.genericNodeTitle, "en") ||
      left.proposedTitle.localeCompare(right.proposedTitle, "en") ||
      left.taskId.localeCompare(right.taskId, "en"),
  );
};

const SELLER_SIDE_TEMPORARY_USE_PATTERNS = [
  /\b(?:sell\s+or\s+rent|rent\s*,\s*sell|rent\s+or\s+sell)\b/i,
  /\b(?:rent|lease)\b.{0,100}\b(?:to|for|on behalf of)\s+(?:customers?|clients?|guests?|tenants?)\b/i,
  /\bshow\s*,?\s*(?:rent|lease)\s*,?\s*or\s+assign\b/i,
  /\brent\s+properties?\s+or\s+manage\s+rental\s+properties?\b/i,
];

export const findSellerSideTemporaryUseCandidates = ({
  candidates,
  destinationTitle = "Rent out",
}) =>
  candidates.flatMap((candidate) => {
    if (
      !/^(?:Rent|Lease)\b/i.test(clean(candidate.title)) ||
      !Array.isArray(candidate.sourceTasks)
    ) {
      return [];
    }
    const matchingSourceTasks = candidate.sourceTasks.filter((task) =>
      SELLER_SIDE_TEMPORARY_USE_PATTERNS.some((pattern) =>
        pattern.test(clean(task)),
      ),
    );
    if (matchingSourceTasks.length === 0) return [];
    return [
      {
        candidateId: candidate.id,
        classification: "seller-side-temporary-use",
        includeForExpertReview: true,
        proposedParentTitle: destinationTitle,
        matchingSourceTasks,
        reason: `Direct source evidence uses rent or lease in a provider-side context: ${matchingSourceTasks
          .map((task) => `'${clean(task)}'`)
          .join("; ")}.`,
      },
    ];
  });
