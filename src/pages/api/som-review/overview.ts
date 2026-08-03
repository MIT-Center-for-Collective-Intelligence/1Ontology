import { NextApiRequest, NextApiResponse } from "next";

import fbAuth, { CustomNextApiRequest } from "../../../middlewares/fbAuth";
import {
  getDataset,
  isIssueTypeEnabled,
  isIssueTypeReleased,
  issueTypeReleaseMessage,
} from "../../../lib/somReview/dataset";
import {
  activeSessionProgress,
  pendingSummary,
  reviewerReadyDependentRecords,
} from "../../../lib/somReview/store";
import { SomIssueType, SomOverviewResponse } from "../../../types/ISomReview";
import {
  reviewAccessForToken,
  reviewSurfaceCapabilities,
  trustedPropagationAccessForToken,
} from "../../../lib/somReview/access";
import { toLinkedFollowUps } from "../../../lib/somReview/followUps";
import { numberReviewIssues } from "../../../lib/somReview/reviewTaxonomy";
import {
  blockingIssuePrerequisites,
  issuePrerequisiteTypes,
} from "../../../lib/somReview/reviewDependencies";
import { reviewRequestData } from "../../../lib/somReview/request";
import {
  reviewDatasetConfig,
  reviewWorkspaceOptions,
} from "../../../lib/somReview/reviewWorkspaces";

const handler = async (request: NextApiRequest, res: NextApiResponse) => {
  const req = request as CustomNextApiRequest;
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  try {
    const data = reviewRequestData(req.body);
    const requestedDatasetId =
      typeof data.datasetId === "string" ? data.datasetId : undefined;
    const dataset = getDataset(requestedDatasetId);
    const datasetConfig = reviewDatasetConfig(dataset.datasetId);
    const reviewerId = req.user.uid;

    const [baseIssueTypes, readyFollowUpRecords] = await Promise.all([
      Promise.all(
        numberReviewIssues(dataset.manifest.issueTypes || []).map(
          async (issue: any) => {
            const issueType = issue.id as SomIssueType;
            const enabled = isIssueTypeEnabled(issueType);
            const released = isIssueTypeReleased(dataset, issueType);
            const total = (dataset.orderedIdsByIssue.get(issueType) || [])
              .length;
            const [summary, activeSession] = enabled
              ? await Promise.all([
                  pendingSummary(dataset, issueType, reviewerId),
                  activeSessionProgress(dataset, issueType, reviewerId),
                ])
              : [
                  { reviewed: 0, pending: 0, waiting: 0, notApplicable: 0 },
                  null,
                ];
            return {
              id: issueType,
              label: issue.label,
              stage: issue.stage,
              robTaskIds: issue.robTaskIds || [],
              optional: Boolean(issue.optional),
              enabled,
              released,
              ...(!released
                ? { releaseMessage: issueTypeReleaseMessage(dataset) }
                : {}),
              total,
              prerequisiteIssueTypes: issuePrerequisiteTypes(issueType),
              blockedBy: [],
              ...summary,
              ...(activeSession ? { activeSession } : {}),
            };
          },
        ),
      ),
      reviewerReadyDependentRecords(dataset, reviewerId),
    ]);
    const issuesByType = new Map(
      baseIssueTypes.map((issue) => [issue.id, issue]),
    );
    const issueTypes = baseIssueTypes.map((issue) => ({
      ...issue,
      blockedBy: blockingIssuePrerequisites(issue.id, issuesByType),
    }));

    const reviewAccess = reviewAccessForToken(req.user);
    const trustedPropagation = trustedPropagationAccessForToken(req.user);
    const capabilities = reviewSurfaceCapabilities(
      reviewAccess,
      process.env.SOM_REVIEW_DELIBERATION_ENABLED === "true",
    );
    const body: SomOverviewResponse = {
      datasetId: dataset.datasetId,
      datasetVersion: dataset.datasetVersion,
      workspaceId: datasetConfig.workspaceId,
      roundLabel: datasetConfig.label,
      currentRound: datasetConfig.current,
      workspaces: reviewWorkspaceOptions(),
      branch: String(dataset.manifest.branch || "Sell"),
      ontologyName: String(
        dataset.manifest.sourceSnapshot?.ontologyName ||
          dataset.manifest.sourceOntology ||
          "Ontology",
      ),
      issueTypes,
      readyFollowUps: toLinkedFollowUps(dataset, readyFollowUpRecords),
      trustedPropagation,
      ...capabilities,
    };
    return res.status(200).json(body);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};

export default fbAuth(handler);
