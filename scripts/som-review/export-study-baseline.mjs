#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import {
  buildBranchSummaries,
  buildDatasetSummary,
  compareSnapshots,
  renderBaselineMarkdown,
  renderFocusDisagreements,
  renderTomBrief,
  reviewerAlias,
} from "./study-baseline-lib.mjs";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
const { cert, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const IGNORED_DIRS = new Set([
  ".git",
  ".next",
  ".stage-cache",
  "artifacts",
  "coverage",
  "node_modules",
]);
const RECORD_FILES = [
  ["all_proposals.jsonl", "proposal"],
  ["all_controls.jsonl", "control"],
  ["manual_checks.jsonl", "manual-check"],
];
const DEFAULT_STEWARD_EMAILS = new Set(["malone@mit.edu", "rjl@mit.edu"]);
const DEFAULT_RESEARCHER_EMAILS = new Set([
  "oneweb@umich.edu",
  "oneman@mit.edu",
  "iman@honor.education",
  "caia@mit.edu",
  "acai@college.harvard.edu",
  "xinru.wang@smart.mit.edu",
  "becky97jn@gmail.com",
  "beckyxinruw@gmail.com",
  "shuo.sun@smart.mit.edu",
  "shuo.sun@u.nus.edu",
  "vcharissi@gmail.com",
  "alok.prakash@smart.mit.edu",
  "aimanim@mit.edu",
  "ethanasi@mit.edu",
]);

const parseArgs = () => {
  const values = {};
  for (let index = 2; index < process.argv.length; index += 1) {
    const argument = process.argv[index];
    if (!argument.startsWith("--")) continue;
    const [name, inlineValue] = argument.slice(2).split("=", 2);
    values[name] = inlineValue ?? process.argv[++index];
  }
  return values;
};

const required = (value, label) => {
  if (!value) throw new Error(`${label} is required`);
  return value;
};

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

const readJsonl = (file) => {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
};

const sha256File = (file) =>
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

const fileRecord = (file) => ({
  path: path.relative(REPO_ROOT, file),
  bytes: fs.statSync(file).size,
  sha256: sha256File(file),
});

const walk = (directory, visit) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, visit);
    else visit(absolute);
  }
};

const discoverDatasetDescriptors = () => {
  const manifests = [];
  walk(REPO_ROOT, (file) => {
    if (
      path.basename(file) === "manifest.json" &&
      path.basename(path.dirname(file)).includes("review-datasets")
    ) {
      manifests.push(file);
    }
  });
  return manifests
    .sort()
    .map((manifestFile) => {
      const directory = path.dirname(manifestFile);
      const manifest = readJson(manifestFile);
      if (manifest.schemaVersion !== "som-review-v1") return null;
      const trackedFiles = [
        manifestFile,
        path.join(directory, "ontology-snapshot.json"),
        ...RECORD_FILES.map(([name]) => path.join(directory, name)),
      ].filter((file) => fs.existsSync(file));
      return {
        directory,
        relativeDir: path.relative(REPO_ROOT, directory),
        manifest,
        snapshot: readJson(path.join(directory, "ontology-snapshot.json")),
        fileHashes: trackedFiles.map(fileRecord),
      };
    })
    .filter(Boolean)
    .sort((left, right) =>
      String(left.manifest.generatedAt).localeCompare(
        String(right.manifest.generatedAt),
      ),
    );
};

const loadRecords = (descriptor) =>
  RECORD_FILES.flatMap(([name, source]) =>
    readJsonl(path.join(descriptor.directory, name)).map((record) => ({
      ...record,
      _recordSource: source,
    })),
  );

const credentials = (environment) => {
  const prefix = environment === "development" ? "DEV" : "PROD";
  const privateKey = required(
    process.env[`${prefix}_ONTOLOGY_CRED_PRIVATE_KEY`],
    `${prefix}_ONTOLOGY_CRED_PRIVATE_KEY`,
  );
  return {
    projectId: required(
      process.env[`${prefix}_ONTOLOGY_CRED_PROJECT_ID`],
      `${prefix}_ONTOLOGY_CRED_PROJECT_ID`,
    ),
    clientEmail: required(
      process.env[`${prefix}_ONTOLOGY_CRED_CLIENT_EMAIL`],
      `${prefix}_ONTOLOGY_CRED_CLIENT_EMAIL`,
    ),
    privateKey: privateKey.trim().replace(/\\n/g, "\n"),
  };
};

const configuredEmails = (defaults, configured) =>
  new Set([
    ...defaults,
    ...(configured || "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  ]);

const inferRole = (user) => {
  const claimed = user.customClaims?.somReviewRole;
  if (
    claimed === "steward" ||
    claimed === "researcher" ||
    claimed === "contributor"
  ) {
    return claimed;
  }
  const email = String(user.email || "")
    .trim()
    .toLowerCase();
  const stewards = configuredEmails(
    DEFAULT_STEWARD_EMAILS,
    process.env.SOM_REVIEW_STEWARD_EMAILS,
  );
  const researchers = configuredEmails(
    DEFAULT_RESEARCHER_EMAILS,
    process.env.SOM_REVIEW_RESEARCHER_EMAILS,
  );
  if (user.emailVerified && stewards.has(email)) return "steward";
  if (user.emailVerified && researchers.has(email)) return "researcher";
  return "contributor";
};

const queryCollection = async (db, collection, datasetVersion) => {
  const snapshot = await db
    .collection(collection)
    .where("datasetVersion", "==", datasetVersion)
    .get();
  return snapshot.docs.map((document) => document.data());
};

const git = (...arguments_) =>
  execFileSync("git", arguments_, {
    cwd: REPO_ROOT,
    encoding: "utf8",
  }).trim();

const codeState = () => {
  const statusLines = git("status", "--porcelain").split("\n").filter(Boolean);
  return {
    commit: git("rev-parse", "HEAD"),
    branch: git("branch", "--show-current"),
    dirty: statusLines.length > 0,
    dirtyPaths: statusLines.map((line) => line.slice(3)),
  };
};

const codeInventory = () => {
  const files = [];
  const addTree = (relativeDirectory) => {
    const absolute = path.join(REPO_ROOT, relativeDirectory);
    if (!fs.existsSync(absolute)) return;
    walk(absolute, (file) => files.push(file));
  };
  addTree("scripts/som-review");
  addTree("src/lib/somReview");
  addTree("src/components/SomReview");
  for (const relative of [
    "src/pages/review.tsx",
    "src/pages/review/admin.tsx",
    "docs/research/review-workflow-dependency-spec.md",
  ]) {
    const absolute = path.join(REPO_ROOT, relative);
    if (fs.existsSync(absolute)) files.push(absolute);
  }
  return [...new Set(files)]
    .filter((file) => fs.statSync(file).isFile())
    .sort()
    .map(fileRecord);
};

const write = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value, "utf8");
};

const main = async () => {
  loadEnvConfig(REPO_ROOT);
  const args = parseArgs();
  const environment = args.environment || "production";
  const capturedAt = args["captured-at"] || new Date().toISOString();
  const outputDirectory = path.resolve(required(args["out-dir"], "--out-dir"));
  const focusReviewerEmail = args["focus-reviewer-email"] || "";
  const focusReviewerLabel = args["focus-reviewer-label"] || "expert-steward";
  const includeFocusFreeText = args["include-focus-free-text"] === "true";
  const serviceAccount = credentials(environment);
  const app = initializeApp(
    { credential: cert(serviceAccount) },
    `som-study-baseline-${environment}-${Date.now()}`,
  );
  const auth = getAuth(app);
  const db = getFirestore(app);
  const descriptors = discoverDatasetDescriptors();
  if (!descriptors.length) throw new Error("No som-review-v1 datasets found");

  const rawDatasets = await Promise.all(
    descriptors.map(async (descriptor) => {
      const [responses, revisions, sessions] = await Promise.all([
        queryCollection(
          db,
          "somReviewResponses",
          descriptor.manifest.datasetVersion,
        ),
        queryCollection(
          db,
          "somReviewResponseRevisions",
          descriptor.manifest.datasetVersion,
        ),
        queryCollection(
          db,
          "somReviewSessions",
          descriptor.manifest.datasetVersion,
        ),
      ]);
      return {
        ...descriptor,
        records: loadRecords(descriptor),
        responses,
        revisions,
        sessions,
      };
    }),
  );

  const reviewerIds = [
    ...new Set(
      rawDatasets.flatMap((dataset) => [
        ...dataset.responses.map((record) => record.reviewerId),
        ...dataset.revisions.map((record) => record.reviewerId),
        ...dataset.sessions.map((record) => record.reviewerId),
      ]),
    ),
  ].filter(Boolean);
  const userResult = reviewerIds.length
    ? await auth.getUsers(reviewerIds.map((uid) => ({ uid })))
    : { users: [] };
  const usersById = new Map(userResult.users.map((user) => [user.uid, user]));
  const roles = new Map(
    reviewerIds.map((reviewerId) => [
      reviewerId,
      inferRole(usersById.get(reviewerId) || {}),
    ]),
  );
  const aliases = new Map(
    reviewerIds.map((reviewerId) => [
      reviewerId,
      reviewerAlias(reviewerId, roles.get(reviewerId)),
    ]),
  );
  let focusReviewerId = "";
  if (focusReviewerEmail) {
    const focusUser = await auth.getUserByEmail(focusReviewerEmail);
    focusReviewerId = focusUser.uid;
    roles.set(focusReviewerId, inferRole(focusUser));
    aliases.set(focusReviewerId, focusReviewerLabel);
  }

  const datasets = rawDatasets.map((dataset) =>
    buildDatasetSummary({
      descriptor: dataset,
      records: dataset.records,
      responses: dataset.responses,
      revisions: dataset.revisions,
      sessions: dataset.sessions,
      aliases,
      roles,
      focusReviewerId,
    }),
  );
  const snapshotComparisons = new Map();
  for (const branch of [
    ...new Set(rawDatasets.map((item) => item.manifest.branch)),
  ]) {
    const branchDatasets = rawDatasets
      .filter((item) => item.manifest.branch === branch)
      .sort((left, right) =>
        String(left.manifest.generatedAt).localeCompare(
          String(right.manifest.generatedAt),
        ),
      );
    if (branchDatasets.length > 1) {
      snapshotComparisons.set(
        branch,
        compareSnapshots(
          branchDatasets[0].snapshot,
          branchDatasets[branchDatasets.length - 1].snapshot,
        ),
      );
    }
  }

  const baseline = {
    schemaVersion: "som-study-baseline-v1",
    capturedAt,
    environment,
    firestoreProjectId: serviceAccount.projectId,
    status: "formative-operational-trace",
    privacy: {
      rawReviewerIdsIncluded: false,
      reviewerEmailsIncluded: false,
      freeTextIncludedInBaseline: false,
      privateFocusAppendixGenerated: includeFocusFreeText,
      reviewerLabels: "one-way pseudonyms, plus an optional named role label",
    },
    interpretation:
      "Descriptive operational pilot evidence; not a preregistered or confirmatory evaluation.",
    codeState: codeState(),
    codeInventory: codeInventory(),
    branches: buildBranchSummaries(datasets, snapshotComparisons),
    datasets,
  };

  write(
    path.join(outputDirectory, "study-baseline.json"),
    `${JSON.stringify(baseline, null, 2)}\n`,
  );
  write(
    path.join(outputDirectory, "study-baseline.md"),
    renderBaselineMarkdown(baseline),
  );
  write(
    path.join(outputDirectory, "tom-review-brief.md"),
    renderTomBrief(baseline),
  );
  if (includeFocusFreeText && focusReviewerId) {
    write(
      path.join(outputDirectory, "private-expert-steward-disagreements.md"),
      renderFocusDisagreements({
        datasets: rawDatasets,
        focusReviewerId,
        focusReviewerLabel,
      }),
    );
  }
  write(
    path.join(outputDirectory, "README.md"),
    [
      "# Ontology Pilot Baseline",
      "",
      "- `tom-review-brief.md`: blind-first instructions and compact Sell audit for Tom.",
      "- `study-baseline.md`: human-readable aggregate audit across all Sell and Buy rounds.",
      "- `study-baseline.json`: machine-readable metrics and SHA-256 inventories.",
      "- Reviewer free text is excluded from this public package.",
      "",
      "Regenerate from the repository root:",
      "",
      "```bash",
      `node scripts/som-review/export-study-baseline.mjs --environment ${environment} --out-dir ${path.relative(
        REPO_ROOT,
        outputDirectory,
      )} --focus-reviewer-email <email> --focus-reviewer-label expert-steward`,
      "```",
      "",
      "The exporter reads review data and writes local artifacts. It does not mutate Firestore or an ontology.",
      "",
      "To create the private disagreement appendix, rerun into a non-repository directory with `--include-focus-free-text true`. Do not publish that file without a disclosure-risk review and reviewer approval.",
      "",
    ].join("\n"),
  );

  process.stdout.write(
    `PASS: exported ${datasets.length} datasets and ${baseline.branches.length} branches to ${outputDirectory}\n`,
  );
};

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
