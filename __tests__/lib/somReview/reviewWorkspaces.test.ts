import {
  getDataset,
  getDatasetByVersion,
} from "../../../src/lib/somReview/dataset";
import {
  SOM_REVIEW_WORKSPACES,
  reviewDatasetConfig,
  reviewWorkspaceOptions,
} from "../../../src/lib/somReview/reviewWorkspaces";

describe("Society of Mind review workspaces", () => {
  it("offers independent Buy and Sell workspaces with one current round each", () => {
    const options = reviewWorkspaceOptions();

    expect(options.map((workspace) => workspace.id)).toEqual(["buy", "sell"]);
    expect(options.find((workspace) => workspace.id === "buy")).toMatchObject({
      activeDatasetId: "buy-content-identity",
    });
    expect(options.find((workspace) => workspace.id === "sell")).toMatchObject({
      activeDatasetId: "sell-semantic-coverage",
    });
    for (const workspace of options) {
      expect(workspace.rounds.filter((round) => round.current)).toHaveLength(1);
    }
  });

  it("loads every registered round and resolves it by immutable version", () => {
    const configurations = SOM_REVIEW_WORKSPACES.flatMap(
      (workspace) => workspace.datasets,
    );
    expect(
      new Set(configurations.map((dataset) => dataset.datasetVersion)).size,
    ).toBe(configurations.length);

    for (const configuration of configurations) {
      const dataset = getDataset(configuration.id);
      expect(dataset.manifest.schemaVersion).toBe("som-review-v1");
      expect(dataset.datasetId).toBe(configuration.id);
      expect(dataset.datasetVersion).toBe(configuration.datasetVersion);
      expect(getDatasetByVersion(configuration.datasetVersion)).toBe(dataset);
      expect(reviewDatasetConfig(configuration.id)).toBe(configuration);
    }
  });
});
