import path from "path";

export interface SomReviewDatasetConfig {
  id: string;
  datasetVersion: string;
  workspaceId: string;
  label: string;
  relativeDir: string[];
  current: boolean;
}

export interface SomReviewWorkspaceConfig {
  id: string;
  label: string;
  activeDatasetId: string;
  originalDatasetId: string;
  datasets: SomReviewDatasetConfig[];
}

const buyDatasets: SomReviewDatasetConfig[] = [
  {
    id: "buy-content-identity",
    datasetVersion: "buy-content-identity-after-title-followup-2026-07-26-v1",
    workspaceId: "buy",
    label: "Content and identity review",
    relativeDir: [
      "Buy_Society_of_Mind_Content_Identity_2026-07-26",
      "review-datasets-content-identity-v1",
    ],
    current: true,
  },
  {
    id: "buy-title-followup",
    datasetVersion: "buy-title-followup-after-initial-review-2026-07-25-v1",
    workspaceId: "buy",
    label: "Title follow-up",
    relativeDir: [
      "Buy_Society_of_Mind_Title_Followup_2026-07-25",
      "review-datasets-title-followup-v1",
    ],
    current: false,
  },
  {
    id: "buy-initial-title-review",
    datasetVersion: "buy-exploratory-transfer-2026-07-25-v1",
    workspaceId: "buy",
    label: "Initial title review",
    relativeDir: [
      "Buy_Society_of_Mind_Exploratory_2026-07-25",
      "review-datasets-exploratory-v1",
    ],
    current: false,
  },
];

const sellDatasets: SomReviewDatasetConfig[] = [
  {
    id: "sell-semantic-coverage",
    datasetVersion: "sell-rob-semantic-coverage-2026-07-29-v1",
    workspaceId: "sell",
    label: "Whole-ontology coverage and evidence specialization",
    relativeDir: [
      "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
      "review-datasets-rob-semantic-coverage-2026-07-29",
    ],
    current: true,
  },
  {
    id: "sell-outline-followup",
    datasetVersion: "sell-rob-outline-followup-2026-07-28-v1",
    workspaceId: "sell",
    label: "Rob outline follow-up",
    relativeDir: [
      "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
      "review-datasets-rob-outline-followup-2026-07-28",
    ],
    current: false,
  },
  {
    id: "sell-current",
    datasetVersion: "sell-rob-post-structure-2026-07-25-v1",
    workspaceId: "sell",
    label: "Current hierarchy and optional checks",
    relativeDir: [
      "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
      "review-datasets-rob-post-structure-2026-07-25",
    ],
    current: false,
  },
  {
    id: "sell-structure-review",
    datasetVersion: "sell-rob-structure-wave-2026-07-24-v1",
    workspaceId: "sell",
    label: "Structure and placement review",
    relativeDir: [
      "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
      "review-datasets-rob-structure-wave-2026-07-24",
    ],
    current: false,
  },
  {
    id: "sell-content-review",
    datasetVersion: "sell-rob-content-wave-2026-07-24-v1",
    workspaceId: "sell",
    label: "Content and identity review",
    relativeDir: [
      "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
      "review-datasets-rob-content-wave-2026-07-24",
    ],
    current: false,
  },
  {
    id: "sell-after-title-corrections",
    datasetVersion: "sell-rob-title-v2-downstream-2026-07-23-v2",
    workspaceId: "sell",
    label: "Review after title corrections",
    relativeDir: [
      "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
      "review-datasets-rob-title-v2-downstream-2026-07-23",
    ],
    current: false,
  },
  {
    id: "sell-title-followup",
    datasetVersion: "sell-rob-title-applied-title-pass-2026-07-22-v1",
    workspaceId: "sell",
    label: "Title follow-up",
    relativeDir: [
      "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
      "review-datasets-rob-title-applied-2026-07-22",
    ],
    current: false,
  },
  {
    id: "sell-initial-review",
    datasetVersion: "sell-final-hierarchy-onet-2026-07-15-v4",
    workspaceId: "sell",
    label: "Initial review",
    relativeDir: [
      "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
      "review-datasets",
    ],
    current: false,
  },
];

export const SOM_REVIEW_WORKSPACES: SomReviewWorkspaceConfig[] = [
  {
    id: "buy",
    label: "Buy",
    activeDatasetId: "buy-content-identity",
    originalDatasetId: "buy-initial-title-review",
    datasets: buyDatasets,
  },
  {
    id: "sell",
    label: "Sell",
    activeDatasetId: "sell-semantic-coverage",
    originalDatasetId: "sell-initial-review",
    datasets: sellDatasets,
  },
];

export const DEFAULT_REVIEW_DATASET_ID =
  process.env.SOM_REVIEW_DEFAULT_DATASET_ID || "buy-content-identity";

const datasets = SOM_REVIEW_WORKSPACES.flatMap(
  (workspace) => workspace.datasets,
);
const datasetsById = new Map(datasets.map((dataset) => [dataset.id, dataset]));
const datasetsByVersion = new Map(
  datasets.map((dataset) => [dataset.datasetVersion, dataset]),
);

export const reviewDatasetConfig = (
  datasetId = DEFAULT_REVIEW_DATASET_ID,
): SomReviewDatasetConfig => {
  const config = datasetsById.get(datasetId);
  if (!config) {
    throw new Error(`Unknown review dataset: ${datasetId}`);
  }
  return config;
};

export const reviewWorkspaceConfig = (
  workspaceId: string,
): SomReviewWorkspaceConfig => {
  const workspace = SOM_REVIEW_WORKSPACES.find(
    (candidate) => candidate.id === workspaceId,
  );
  if (!workspace) {
    throw new Error(`Unknown review workspace: ${workspaceId}`);
  }
  return workspace;
};

export const reviewDatasetConfigByVersion = (
  datasetVersion: string,
): SomReviewDatasetConfig => {
  const config = datasetsByVersion.get(datasetVersion);
  if (!config) {
    throw new Error(`Unknown review dataset version: ${datasetVersion}`);
  }
  return config;
};

export const reviewDatasetDir = (config: SomReviewDatasetConfig): string => {
  if (
    config.id === DEFAULT_REVIEW_DATASET_ID &&
    process.env.SOM_REVIEW_DATASET_DIR
  ) {
    return process.env.SOM_REVIEW_DATASET_DIR;
  }
  return path.join(process.cwd(), ...config.relativeDir);
};

export const reviewWorkspaceOptions = () =>
  SOM_REVIEW_WORKSPACES.map((workspace) => ({
    id: workspace.id,
    label: workspace.label,
    activeDatasetId: workspace.activeDatasetId,
    rounds: workspace.datasets.map((dataset) => ({
      id: dataset.id,
      datasetVersion: dataset.datasetVersion,
      label: dataset.label,
      current: dataset.current,
    })),
  }));
