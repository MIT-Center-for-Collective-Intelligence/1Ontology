/** The full immutable run stays archived; a card needs only its own agents.
 * Returning unrelated request bodies can create megabytes of wrapped DOM text. */
export function proposalReviewTrace(trace: any, caseId: string) {
  if (!Array.isArray(trace.authors)) return trace; // Frozen v1 disclosure.
  const authors = trace.authors.filter((r: any) =>
    r.value.cases.some((c: any) => c.analysis.nodeId === caseId),
  );
  const critiques = trace.critiques.filter((r: any) =>
    r.value.assessments.some((c: any) => c.caseId === caseId),
  );
  if (authors.length !== 1 || critiques.length !== 2)
    throw Error("Incomplete proposal-specific agent trace");
  const jobs = new Set([...authors, ...critiques].map((r: any) => r.jobId));
  const exactRequests = trace.exactRequests.filter((r: any) =>
    jobs.has(r.jobId),
  );
  if (exactRequests.length !== jobs.size)
    throw Error("Missing proposal-specific exact requests");
  return {
    schemaVersion: trace.schemaVersion,
    scope:
      "Exact author and critical-review requests for this proposal. Its discovery request is in the original trace. The complete run archive remains privately preserved.",
    authors,
    critiques,
    exactRequests,
    selectionRule: trace.selectionRule,
    completeRun: {
      privatelyPreserved: true,
      inferenceAttempts: new Set(
        trace.allInferenceAttempts.map((a: any) => a.attemptId),
      ).size,
      discoveryFamilies: trace.discovery.plan.families,
      distinctChildren: trace.discovery.plan.distinctChildren,
      sourceSha256: trace.discovery.plan.sourceSha256,
    },
  };
}

/** Preserve every exact body once in this self-contained disclosure. Selection
 * reviews often reuse the same author/critic requests already in the case trace.
 * References point within the returned JSON; immutable evidence is never edited. */
export function relationshipTraceDisclosure(original: any, full: any, caseId: string) {
  const selected = proposalReviewTrace(full, caseId);
  if (!Array.isArray(full.authors))
    return { original, selectedChangesReview: selected };
  const requests = [
    ["original.proposalRequest", original.proposalRequest],
    ["original.challengeRequest", original.challengeRequest],
    ["original.additionalChallenge.request", original.additionalChallenge?.request],
  ] as const;
  const projectedOriginal = { ...original };
  if (original.sourceContext && original.proposalRequest?.input) {
    const input = JSON.parse(original.proposalRequest.input);
    const context = input.context?.find((c: any) => c.subject?.id === caseId);
    if (context?.sourceRecordColumns) {
      const columns = context.sourceRecordColumns;
      const unpack = (rows: any[]) => rows.map((row) =>
        Object.fromEntries(columns.map((key: string, i: number) => [key, row[i]])));
      context.records = unpack(context.records);
      context.ancestors = unpack(context.ancestors);
      context.descendantCoverage.fullDescendantRecords = unpack(context.descendantCoverage.fullDescendantRecords);
      delete context.sourceRecordColumns;
      delete context.recordEncoding;
    }
    if (JSON.stringify(context) === JSON.stringify(original.sourceContext)) {
      delete projectedOriginal.sourceContext;
      projectedOriginal.sourceContextReference = {
        exactRequest: "original.proposalRequest",
        field: "input",
        subjectId: caseId,
        note: "The JSON input contains this complete source context. Where sourceRecordColumns is present, its rows reproduce the unpacked context exactly. The immutable archive also retains the unpacked copy.",
      };
    }
  }
  return {
    original: projectedOriginal,
    selectedChangesReview: {
      ...selected,
      exactRequests: selected.exactRequests.map((request: any) => {
        const match = requests.find(([, body]) => body &&
          JSON.stringify(body) === JSON.stringify(request.body));
        if (!match) return request;
        const { body, ...identity } = request;
        return { ...identity, bodyReference: match[0] };
      }),
      requestReferenceNote: "A bodyReference identifies the identical exact request already present under original in this JSON. No request content is omitted.",
    },
  };
}
