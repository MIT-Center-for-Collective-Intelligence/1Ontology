import fs from "fs";
import path from "path";
import crypto from "crypto";
import Ajv, { ValidateFunction } from "ajv";
import addFormats from "ajv-formats";

import { SomIssueType } from "../../types/ISomReview";
import {
  loadOntologySnapshot,
  validateProposalAgainstSnapshot,
} from "./ontologySnapshot";
import { numberedIssueLabelMap } from "./reviewTaxonomy";

const EXPECTED_SCHEMA_VERSION = "som-review-v1";

export const SUPPORTED_ISSUE_TYPES: SomIssueType[] = [
  "title-clarity",
  "synonym-enrichment",
  "description-enrichment",
  "misc-facet-duplicate",
  "mistaken-synonym",
  "duplicate-synonym",
  "polysemy",
  "flat-list-grouping",
  "compound-object-grouping",
  "collection-design",
  "placement",
  "wrong-verb",
  "sense-relocation",
  "node-merge",
  "relocation",
  "missing-activity",
  "redundant-node",
];

export type SomProposalAvailability = "ready" | "waiting" | "not-applicable";

export const proposalAvailability = (
  record: any,
  decisions: Map<string, "agree" | "disagree">,
): SomProposalAvailability => {
  const dependencies: string[] = record?.workflow?.dependsOnProposalIds || [];
  if (dependencies.some((id) => decisions.get(id) === "disagree")) {
    return "not-applicable";
  }
  if (dependencies.some((id) => decisions.get(id) !== "agree")) {
    return "waiting";
  }
  return "ready";
};

export interface SomDataset {
  datasetVersion: string;
  manifest: any;
  recordsById: Map<string, any>;
  orderedIdsByIssue: Map<SomIssueType, string[]>;
  issueLabels: Map<SomIssueType, string>;
}

const datasetDir = (): string =>
  process.env.SOM_REVIEW_DATASET_DIR ||
  path.join(
    process.cwd(),
    "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
    "review-datasets",
  );

export const isIssueTypeEnabled = (issueType: SomIssueType): boolean => {
  if (!SUPPORTED_ISSUE_TYPES.includes(issueType)) return false;
  const disabled = (process.env.SOM_REVIEW_DISABLED_ISSUE_TYPES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return !disabled.includes(issueType);
};

const readJsonl = (filePath: string): any[] =>
  fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (err) {
        throw new Error(`Invalid JSON on line ${index + 1} of ${filePath}`);
      }
    });

export const compileProposalValidator = (
  dir?: string,
): ValidateFunction<any> => {
  const schemaPath = path.join(
    dir || datasetDir(),
    "schema",
    "review-proposal.schema.json",
  );
  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  return ajv.compile<any>(JSON.parse(fs.readFileSync(schemaPath, "utf8")));
};

export const compileResponseValidator = (dir?: string): ValidateFunction => {
  const schemaPath = path.join(
    dir || datasetDir(),
    "schema",
    "review-response.schema.json",
  );
  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  return ajv.compile(JSON.parse(fs.readFileSync(schemaPath, "utf8")));
};

const orderKey = (record: any): string =>
  crypto
    .createHash("sha256")
    .update(`${record.datasetVersion}|${record.issueType}|${record.proposalId}`)
    .digest("hex");

export const loadDataset = (dir?: string): SomDataset => {
  const root = dir || datasetDir();
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "manifest.json"), "utf8"),
  );

  if (manifest.schemaVersion !== EXPECTED_SCHEMA_VERSION) {
    throw new Error(
      `Unexpected dataset schemaVersion: ${manifest.schemaVersion}`,
    );
  }
  if (!manifest.datasetVersion) {
    throw new Error("Dataset manifest is missing datasetVersion");
  }

  const validate = compileProposalValidator(root);
  const ontologySource = loadOntologySnapshot(root, manifest);

  const records = [
    ...readJsonl(path.join(root, "all_proposals.jsonl")),
    ...readJsonl(path.join(root, "all_controls.jsonl")),
    ...readJsonl(path.join(root, "manual_checks.jsonl")),
  ];

  const recordsById = new Map<string, any>();
  for (const record of records) {
    const recordId = record?.proposalId || "<unknown>";
    if (!validate(record)) {
      throw new Error(
        `Proposal ${recordId} failed schema validation: ` +
          JSON.stringify(validate.errors),
      );
    }
    if (record.datasetVersion !== manifest.datasetVersion) {
      throw new Error(
        `Proposal ${record.proposalId} has datasetVersion ${record.datasetVersion}, ` +
          `expected ${manifest.datasetVersion}`,
      );
    }
    if (recordsById.has(record.proposalId)) {
      throw new Error(`Duplicate proposalId in dataset: ${record.proposalId}`);
    }
    try {
      validateProposalAgainstSnapshot(
        record,
        ontologySource.index,
        ontologySource.sha256,
      );
    } catch (error) {
      throw new Error(
        `Proposal ${record.proposalId} is not valid for ${ontologySource.snapshot.ontologyName}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    recordsById.set(record.proposalId, Object.freeze(record));
  }

  for (const record of recordsById.values()) {
    const dependencies: string[] = record?.workflow?.dependsOnProposalIds || [];
    for (const dependencyId of dependencies) {
      if (dependencyId === record.proposalId) {
        throw new Error(`Proposal ${record.proposalId} depends on itself`);
      }
      if (!recordsById.has(dependencyId)) {
        throw new Error(
          `Proposal ${record.proposalId} depends on missing proposal ${dependencyId}`,
        );
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (proposalId: string): void => {
    if (visited.has(proposalId)) return;
    if (visiting.has(proposalId)) {
      throw new Error(`Proposal dependency cycle includes ${proposalId}`);
    }
    visiting.add(proposalId);
    const record = recordsById.get(proposalId);
    for (const dependencyId of record?.workflow?.dependsOnProposalIds || []) {
      visit(dependencyId);
    }
    visiting.delete(proposalId);
    visited.add(proposalId);
  };
  for (const proposalId of recordsById.keys()) visit(proposalId);

  const orderedIdsByIssue = new Map<SomIssueType, string[]>();
  const issueLabels = numberedIssueLabelMap(manifest.issueTypes || []);
  for (const issue of manifest.issueTypes || []) {
    const ids = [...recordsById.values()]
      .filter((r) => r.issueType === issue.id)
      .sort((a, b) => orderKey(a).localeCompare(orderKey(b)))
      .map((r) => r.proposalId);
    orderedIdsByIssue.set(issue.id, ids);
  }

  return {
    datasetVersion: manifest.datasetVersion,
    manifest,
    recordsById,
    orderedIdsByIssue,
    issueLabels,
  };
};

let cached: SomDataset | null = null;

export const getDataset = (): SomDataset => {
  if (!cached) cached = loadDataset();
  return cached;
};
