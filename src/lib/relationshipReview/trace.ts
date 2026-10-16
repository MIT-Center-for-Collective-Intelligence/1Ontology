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
