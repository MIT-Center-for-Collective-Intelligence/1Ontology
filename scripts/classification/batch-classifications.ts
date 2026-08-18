import "../load-env";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import {
  removeTrailingONETId,
  removeTrailingTitleId,
  searchThroughChroma,
  loadAllNodes,
  delay,
} from "./utils/lib";
import {
  copyFileSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
} from "fs";
import { resolve } from "path";
import readline from "readline";
import xlsx from "xlsx";

import { Firestore } from "firebase-admin/firestore";
import { db } from "../admin";

import { readFromSheet } from "./utils/write-sheet";
import { getClassificationPrompt } from "./utils/classification-prompts";
import {
  extractObject,
  getCostForGeminiResponse,
  SupportedGeminiModel,
} from "./utils/gemini-helpers";

const NODE_CACHE_PATH = resolve(
  __dirname,
  "ontology/classification-nodes-cache.json",
);

const TEST = false;
const MODEL = "gemini-3.5-flash";
const BATCH_POLL_INTERVAL_MS = 30_000;
const BATCH_COST_DISCOUNT = 0.5;
const MAX_CLASSIFICATION_ATTEMPTS = 10;
const BATCH_INPUT_DIR = resolve(__dirname, "classification-batch-inputs");
const COMPLETED_BATCH_STATES = new Set([
  "JOB_STATE_SUCCEEDED",
  "JOB_STATE_FAILED",
  "JOB_STATE_CANCELLED",
  "JOB_STATE_EXPIRED",
]);

const ai = new GoogleGenAI({
  apiKey: process.env.MIT_CCI_GEMINI_API_KEY || "",
  httpOptions: {
    // Creating a batch from a ~2GB JSONL can take minutes; default fetch timeouts are too low.
    timeout: 15 * 60 * 1000,
  },
});

const classificationResponseSchema = {
  type: Type.OBJECT,
  properties: {
    main_activity: {
      type: Type.STRING,
    },
    reasoning_main_activity: {
      type: Type.STRING,
    },
    most_appropriate_node: {
      type: Type.STRING,
    },
    most_appropriate_node_parent: {
      type: Type.STRING,
    },
    most_appropriate_node_rationale: {
      type: Type.STRING,
    },
    node_validation_explanation: {
      type: Type.STRING,
    },
  },
  required: [
    "main_activity",
    "reasoning_main_activity",
    "most_appropriate_node",
    "most_appropriate_node_parent",
    "most_appropriate_node_rationale",
    "node_validation_explanation",
  ],
};

type PendingClassification = {
  key: string;
  rowIdx: number;
  searchNum: number;
  name: string;
  description: string;
  tagline: string;
  ontologyObject: any;
  originalRequest?: any;
  attempt: number;
  priorClassifications: any[];
};

const normalizeNodeTitle = (title: unknown) =>
  String(title || "")
    .trim()
    .toLowerCase();

const getTitleParentKey = (title: unknown, parentTitle: unknown) =>
  `${normalizeNodeTitle(title)}::${normalizeNodeTitle(parentTitle)}`;

const getCleanTitleForApp = (appName: string, title: string) =>
  appName === "onet-ontology"
    ? removeTrailingTitleId(title)
    : removeTrailingONETId(title);

const getONetTaskId = (appName: string, nodeData: any) =>
  nodeData.oNetId ||
  (appName === "onet-ontology"
    ? null
    : typeof nodeData.title === "string" && nodeData.title.startsWith("(O*Net)")
      ? nodeData.title.replace("(O*Net)", "").split("-")[0].trim()
      : null);

const getDuplicateONetTaskJobs = (
  nodes_ids: any,
  appName: string,
  tasksByJobs: any,
) => {
  const tasksByTitle: Record<string, any[]> = {};

  for (const nodeData of Object.values(nodes_ids) as any[]) {
    const onetId = getONetTaskId(appName, nodeData);

    if (!onetId || !tasksByJobs[onetId]) {
      continue;
    }

    const cleanTitle = normalizeNodeTitle(
      getCleanTitleForApp(appName, nodeData.title || ""),
    );

    if (!tasksByTitle[cleanTitle]) {
      tasksByTitle[cleanTitle] = [];
    }

    tasksByTitle[cleanTitle].push({ onetId, job: tasksByJobs[onetId] });
  }

  const duplicateTaskJobs: any = {};
  for (const repeatedTasks of Object.values(tasksByTitle)) {
    const uniqueTaskIds = new Set(repeatedTasks.map((task) => task.onetId));

    if (uniqueTaskIds.size <= 1) {
      continue;
    }

    for (const task of repeatedTasks) {
      duplicateTaskJobs[task.onetId] = task.job;
    }
  }

  return duplicateTaskJobs;
};

const buildTitleParentLookup = (nodes_ids: any) => {
  const byTitle: Record<string, any[]> = {};
  const byTitleParent: Record<string, any[]> = {};

  for (const [nodeId, nodeData] of Object.entries(nodes_ids) as any[]) {
    const nodeTitle = nodeData.title || "";
    const parentRefs = (nodeData.generalizations || []).flatMap(
      (collection: any) => collection.nodes || [],
    );
    const parentTitles = parentRefs.length
      ? parentRefs.map(({ id: parentId }: { id: string }) => {
          return nodes_ids[parentId]?.title || "";
        })
      : [""];

    for (const parentTitle of parentTitles) {
      const entry = {
        nodeId,
        nodeTitle,
        parentTitle,
      };
      const titleKey = normalizeNodeTitle(nodeTitle);
      const titleParentKey = getTitleParentKey(nodeTitle, parentTitle);

      if (!byTitle[titleKey]) {
        byTitle[titleKey] = [];
      }
      if (!byTitleParent[titleParentKey]) {
        byTitleParent[titleParentKey] = [];
      }

      byTitle[titleKey].push(entry);
      byTitleParent[titleParentKey].push(entry);
    }
  }

  return { byTitle, byTitleParent };
};

const stripNodeIdsFromOntologyObject = (node: any): any => {
  const titleHierarchy: any = {};

  if (node?.job) {
    titleHierarchy.job = node.job;
  }

  for (const [key, value] of Object.entries(node || {}) as any[]) {
    if (key === "title" || key === "id" || key === "job") {
      continue;
    }

    if (key.startsWith("[") && key.endsWith("]")) {
      titleHierarchy[key] = stripNodeIdsFromOntologyObject(value);
      continue;
    }

    const childTitle = value?.title || key;
    titleHierarchy[childTitle] = stripNodeIdsFromOntologyObject(value);
  }

  return titleHierarchy;
};

const convertOntologyObjectToTitleHierarchy = (ontologyObject: any) => {
  const titleHierarchy: any = {};

  for (const [key, value] of Object.entries(ontologyObject || {}) as any[]) {
    const nodeTitle = value?.title || key;
    titleHierarchy[nodeTitle] = stripNodeIdsFromOntologyObject(value);
  }

  return titleHierarchy;
};

const getNodeIdsForTitle = (nodeLookup: any, title: string): string[] => {
  const titleMatches = nodeLookup.byTitle?.[normalizeNodeTitle(title)] || [];

  if (!titleMatches) {
    return [];
  }

  return titleMatches.map((match: any) => match.nodeId);
};

const validateOntologyNode = ({
  nodeTitle,
  parentTitle,
  nodeLookup,
}: {
  nodeTitle: string;
  parentTitle: string;
  nodeLookup: any;
}) => {
  const titleParentKey = getTitleParentKey(nodeTitle, parentTitle);
  const matchingNodes = nodeLookup.byTitleParent?.[titleParentKey] || [];
  const titleMatches =
    nodeLookup.byTitle?.[normalizeNodeTitle(nodeTitle)] || [];
  const idsForTitle = getNodeIdsForTitle(nodeLookup, nodeTitle);
  const titleExists = idsForTitle.length > 0;
  const titleMatchesParent = matchingNodes.length > 0;
  const resolvedNode = matchingNodes[0] || titleMatches[0];
  const availableParents = Array.from(
    new Set(
      titleMatches.map((match: any) => match.parentTitle).filter(Boolean),
    ),
  );

  let explanatory_sentence = "";

  if (titleMatchesParent) {
    explanatory_sentence = `The node "${nodeTitle}" exists under the parent "${parentTitle}" in the cached ontology.`;
  } else if (titleExists) {
    explanatory_sentence = `The title "${nodeTitle}" exists, but not under the parent "${parentTitle}". It appears under parent title(s): ${availableParents.join(", ") || "(root)"}.`;
  } else {
    explanatory_sentence = `The title "${nodeTitle}" does not exist in the cached ontology nodes.`;
  }

  return {
    exists: titleMatchesParent || titleExists,
    titleExists,
    titleMatchesParent,
    requestedNodeTitle: nodeTitle,
    requestedParentTitle: parentTitle,
    resolvedNodeId: titleMatchesParent ? resolvedNode?.nodeId || "" : "",
    resolvedNodeTitle: resolvedNode?.nodeTitle || "",
    resolvedParentTitle: resolvedNode?.parentTitle || "",
    matchingTitleIds: idsForTitle,
    matchingTitleParents: availableParents,
    explanatory_sentence,
  };
};

const makeDummyClassification = () => ({
  response: {
    main_activity: "dummy_activity",
    reasoning_main_activity: "Dummy reasoning for main activity",
    most_appropriate_node: "dummy_node",
    most_appropriate_node_parent: "dummy_parent_node",
    most_appropriate_node_rationale: "Dummy rationale for node",
    node_validation_explanation: "Dummy node validation explanation",
  },
  totalTokens: {
    input: 1231,
    cached: 12243,
    cashed: 12243,
    output: 12243,
    thinking: 109,
    total: 25826,
  },
  cost: {
    input: 0,
    output: 0,
    total: 0,
  },
  executionTime: "10",
});

const HALLUCINATION_RETRY_INSTRUCTION =
  "\n\n7. Double-check the selected node and make sure it already exists in our ontology. If it does not, please return to step 2 and continue.";

const buildBatchRequestLine = (job: PendingClassification) => {
  if (job.originalRequest) {
    const request = JSON.parse(JSON.stringify(job.originalRequest));
    if (job.attempt > 1) {
      const part = request?.contents?.[0]?.parts?.[0];
      if (part && typeof part.text === "string") {
        if (!part.text.includes(HALLUCINATION_RETRY_INSTRUCTION.trim())) {
          part.text = `${part.text}${HALLUCINATION_RETRY_INSTRUCTION}`;
        }
      }
    }

    return {
      key: job.key,
      request,
    };
  }

  const prompt = getClassificationPrompt({
    ontologyObject: job.ontologyObject,
    appTitle: job.name,
    tagline: job.tagline,
    description: job.description,
    hallucination: job.attempt > 1,
  });

  return {
    key: job.key,
    request: {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generation_config: {
        temperature: 0,
        response_mime_type: "application/json",
        response_schema: classificationResponseSchema,
      },
    },
  };
};

const writeBatchJsonl = async (
  jobs: PendingClassification[],
  filePath: string,
) => {
  await new Promise<void>((resolveWrite, rejectWrite) => {
    const writeStream = createWriteStream(filePath, { flags: "w" });
    writeStream.on("error", rejectWrite);
    writeStream.on("finish", () => resolveWrite());

    for (const job of jobs) {
      writeStream.write(JSON.stringify(buildBatchRequestLine(job)) + "\n");
    }

    writeStream.end();
  });
};

const writeJobsJsonl = async (
  jobs: PendingClassification[],
  filePath: string,
) => {
  await new Promise<void>((resolveWrite, rejectWrite) => {
    const writeStream = createWriteStream(filePath, { flags: "w" });
    writeStream.on("error", rejectWrite);
    writeStream.on("finish", () => resolveWrite());

    for (const job of jobs) {
      writeStream.write(JSON.stringify(job) + "\n");
    }

    writeStream.end();
  });
};

const loadJobsJsonl = async (filePath: string) => {
  const jobs: PendingClassification[] = [];
  const rl = readline.createInterface({
    input: createReadStream(filePath),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) {
      continue;
    }
    jobs.push(JSON.parse(line));
  }

  return jobs;
};

const buildJobsFromRequestJsonl = async ({
  jsonlPath,
  dataset,
}: {
  jsonlPath: string;
  dataset: any[];
}) => {
  const jobs: PendingClassification[] = [];
  const rl = readline.createInterface({
    input: createReadStream(jsonlPath),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) {
      continue;
    }

    const parsed = JSON.parse(line);
    const key = String(parsed.key || "");
    const [rowIdxRaw, searchNumRaw, attemptRaw] = key.split("|");
    const rowIdx = Number(rowIdxRaw);
    const searchNum = Number(searchNumRaw);
    const attempt =
      Number(String(attemptRaw || "attempt-1").replace("attempt-", "")) || 1;
    const sheetRow = dataset[rowIdx + 2] || [];

    jobs.push({
      key,
      rowIdx,
      searchNum,
      name: sheetRow[0],
      description: sheetRow[1],
      tagline: sheetRow[2],
      ontologyObject: null,
      originalRequest: parsed.request,
      attempt,
      priorClassifications: [],
    });
  }

  return jobs;
};

const attachOriginalRequestsFromJsonl = async ({
  jobs,
  jsonlPath,
}: {
  jobs: PendingClassification[];
  jsonlPath: string;
}) => {
  const requestsByKey = new Map<string, any>();
  const rl = readline.createInterface({
    input: createReadStream(jsonlPath),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) {
      continue;
    }
    const parsed = JSON.parse(line);
    if (parsed.key) {
      requestsByKey.set(String(parsed.key), parsed.request);
    }
  }

  for (const job of jobs) {
    if (job.originalRequest || job.ontologyObject) {
      continue;
    }
    const attempt1Key = `${job.rowIdx}|${job.searchNum}|attempt-1`;
    job.originalRequest =
      requestsByKey.get(job.key) || requestsByKey.get(attempt1Key) || null;
  }
};

const ensureBatchInputDir = () => {
  if (!existsSync(BATCH_INPUT_DIR)) {
    mkdirSync(BATCH_INPUT_DIR, { recursive: true });
  }
};

const getBatchPaths = (appName: string, attemptLabel: string) => {
  ensureBatchInputDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = `classification-batch-${appName}-${attemptLabel}-${stamp}`;
  return {
    jsonlPath: resolve(BATCH_INPUT_DIR, `${base}.jsonl`),
    jobsPath: resolve(BATCH_INPUT_DIR, `${base}-jobs.jsonl`),
    latestJsonlPath: resolve(
      BATCH_INPUT_DIR,
      `classification-batch-${appName}-latest.jsonl`,
    ),
    latestJobsPath: resolve(
      BATCH_INPUT_DIR,
      `classification-batch-${appName}-latest-jobs.jsonl`,
    ),
  };
};

const saveBatchArtifacts = async ({
  jobs,
  appName,
  attemptLabel,
}: {
  jobs: PendingClassification[];
  appName: string;
  attemptLabel: string;
}) => {
  const paths = getBatchPaths(appName, attemptLabel);
  console.log(
    `Writing ${jobs.length} batch requests to disk (streaming, one line at a time)...`,
  );
  await writeBatchJsonl(jobs, paths.jsonlPath);
  await writeJobsJsonl(jobs, paths.jobsPath);
  copyFileSync(paths.jsonlPath, paths.latestJsonlPath);
  copyFileSync(paths.jobsPath, paths.latestJobsPath);

  console.log(`Saved batch JSONL: ${paths.jsonlPath}`);
  console.log(`Saved batch jobs metadata: ${paths.jobsPath}`);
  console.log(`Updated latest JSONL: ${paths.latestJsonlPath}`);

  return paths;
};

const waitForBatchJob = async (batchName: string) => {
  let batchJob = await ai.batches.get({ name: batchName });

  while (!COMPLETED_BATCH_STATES.has(String(batchJob.state))) {
    console.log(
      `Batch ${batchName} state: ${batchJob.state}. Waiting ${
        BATCH_POLL_INTERVAL_MS / 1000
      }s...`,
    );
    await delay(BATCH_POLL_INTERVAL_MS);
    batchJob = await ai.batches.get({ name: batchName });
  }

  return batchJob;
};

const getResponseText = (response: any): string => {
  if (!response) {
    return "";
  }

  if (typeof response.text === "string") {
    return response.text;
  }

  const parts = response?.candidates?.[0]?.content?.parts || [];
  return parts
    .map((part: any) => part?.text || "")
    .filter(Boolean)
    .join("\n");
};

const parseBatchResponses = async (batchJob: any) => {
  const responsesByKey: Record<string, any> = {};

  if (batchJob.dest?.fileName) {
    const resultFilePath = resolve(
      __dirname,
      `classification-batch-results-${Date.now()}.jsonl`,
    );
    await ai.files.download({
      file: batchJob.dest.fileName,
      downloadPath: resultFilePath,
    });
    const fileContent = readFileSync(resultFilePath, "utf-8");

    for (const line of fileContent.split("\n")) {
      if (!line.trim()) {
        continue;
      }

      const parsed = JSON.parse(line);
      const key = parsed.key || parsed.metadata?.key;
      if (key) {
        responsesByKey[key] = parsed;
      }
    }

    return responsesByKey;
  }

  const inlineResponses = batchJob.dest?.inlinedResponses || [];
  for (let i = 0; i < inlineResponses.length; i++) {
    const inlineResponse = inlineResponses[i];
    const key = inlineResponse?.metadata?.key || `inline-${i}`;
    responsesByKey[key] = inlineResponse;
  }

  return responsesByKey;
};

const classificationFromBatchEntry = ({
  entry,
  model,
  executionTimeMs,
}: {
  entry: any;
  model: string;
  executionTimeMs: number;
}) => {
  if (!entry) {
    throw new Error("Missing batch response entry");
  }

  if (entry.error) {
    throw new Error(
      typeof entry.error === "string"
        ? entry.error
        : entry.error?.message || JSON.stringify(entry.error),
    );
  }

  const responsePayload = entry.response || entry;
  const responseText = getResponseText(responsePayload);
  const responseObject = extractObject(responseText);
  const usageMetadata = responsePayload?.usageMetadata;
  const summaryCost = usageMetadata
    ? getCostForGeminiResponse(model as SupportedGeminiModel, usageMetadata)
    : {
        usedTokens: {
          input: 0,
          cashed: 0,
          output: 0,
          thinking: 0,
          total: 0,
        },
        cost: { input: 0, output: 0, total: 0 },
      };

  return {
    response: responseObject,
    totalTokens: {
      input: summaryCost.usedTokens.input,
      cached: summaryCost.usedTokens.cashed,
      cashed: summaryCost.usedTokens.cashed,
      output: summaryCost.usedTokens.output,
      thinking: summaryCost.usedTokens.thinking,
      total: summaryCost.usedTokens.total,
    },
    cost: {
      input: summaryCost.cost.input * BATCH_COST_DISCOUNT,
      output: summaryCost.cost.output * BATCH_COST_DISCOUNT,
      total: summaryCost.cost.total * BATCH_COST_DISCOUNT,
    },
    executionTime: String(executionTimeMs),
  };
};

const waitForUploadedFileActive = async (fileName: string) => {
  for (let attempt = 1; attempt <= 60; attempt++) {
    const file = await ai.files.get({ name: fileName });
    const state = String(file.state || "");
    console.log(`Uploaded file ${fileName} state: ${state}`);

    if (state === "ACTIVE") {
      return file;
    }

    if (state === "FAILED") {
      throw new Error(
        `Uploaded file ${fileName} failed processing: ${JSON.stringify(
          file.error || file,
        )}`,
      );
    }

    await delay(5_000);
  }

  throw new Error(
    `Uploaded file ${fileName} did not become ACTIVE in time. Try again later.`,
  );
};

const createBatchWithRetry = async ({
  model,
  fileName,
  appName,
  maxAttempts = 5,
}: {
  model: string;
  fileName: string;
  appName: string;
  maxAttempts?: number;
}) => {
  await waitForUploadedFileActive(fileName);

  let lastError: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(
        `Creating batch job from ${fileName} (attempt ${attempt}/${maxAttempts})...`,
      );
      const createdBatch = await ai.batches.create({
        model,
        src: { fileName },
        config: {
          displayName: `classification-${appName}-${Date.now()}`,
          httpOptions: {
            timeout: 15 * 60 * 1000,
          },
        },
      });
      return createdBatch;
    } catch (error: any) {
      lastError = error;
      const message = String(error?.message || error);
      const cause = error?.cause;
      const isRetryable =
        message.includes("fetch failed") ||
        cause?.code === "UND_ERR_SOCKET" ||
        message.includes("ECONNRESET") ||
        message.includes("ETIMEDOUT") ||
        message.includes("socket") ||
        message.includes("timeout");

      console.error(
        `batches.create failed on attempt ${attempt}/${maxAttempts}:`,
        message,
      );
      if (cause) {
        console.error(
          `cause: code=${cause.code || "n/a"} bytesWritten=${
            cause.socket?.bytesWritten || "n/a"
          } bytesRead=${cause.socket?.bytesRead || "n/a"}`,
        );
      }

      if (!isRetryable || attempt >= maxAttempts) {
        break;
      }

      const waitMs = attempt * 15_000;
      console.log(`Retrying batches.create in ${waitMs / 1000}s...`);
      await delay(waitMs);
    }
  }

  console.error(
    [
      "batches.create kept failing after upload.",
      "Most likely Gemini is closing the connection while accepting this ~1.8GB / 13k-request batch.",
      "Next options: split into smaller JSONL chunks (e.g. 500–1000 requests), or retry later.",
    ].join(" "),
  );

  throw lastError;
};

const runClassificationBatch = async ({
  jobs,
  appName,
  model,
  jsonlPath,
  uploadedFileName,
}: {
  jobs: PendingClassification[];
  appName: string;
  model: string;
  jsonlPath?: string;
  uploadedFileName?: string;
}) => {
  if (!jobs.length) {
    return {} as Record<string, any>;
  }

  if (TEST) {
    const dummyByKey: Record<string, any> = {};
    for (const job of jobs) {
      dummyByKey[job.key] = makeDummyClassification();
    }
    return dummyByKey;
  }

  let fileName = uploadedFileName;

  if (!fileName) {
    let batchInputPath = jsonlPath;
    if (!batchInputPath) {
      const saved = await saveBatchArtifacts({
        jobs,
        appName,
        attemptLabel: `attempt-${jobs[0]?.attempt || 1}`,
      });
      batchInputPath = saved.jsonlPath;
    } else {
      console.log(`Reusing existing batch JSONL: ${batchInputPath}`);
    }

    const fileStats = statSync(batchInputPath);
    const fileSizeMb = (fileStats.size / (1024 * 1024)).toFixed(1);
    console.log(
      `Uploading batch JSONL (${fileSizeMb} MB). Gemini SDK has no byte progress callback; logging heartbeat every 15s...`,
    );

    const uploadStartedAt = Date.now();
    const uploadHeartbeat = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - uploadStartedAt) / 1000);
      console.log(
        `Still uploading batch JSONL... ${elapsedSec}s elapsed (${fileSizeMb} MB)`,
      );
    }, 15_000);

    let uploadedFile: any;
    try {
      uploadedFile = await ai.files.upload({
        file: batchInputPath,
        config: {
          mimeType: "jsonl",
          displayName: `classification-batch-${appName}`,
        },
      });
    } finally {
      clearInterval(uploadHeartbeat);
    }

    const uploadElapsedSec = Math.floor((Date.now() - uploadStartedAt) / 1000);
    fileName = uploadedFile.name || "";
    console.log(`Uploaded batch file: ${fileName} in ${uploadElapsedSec}s`);
  } else {
    console.log(`Skipping upload; using existing Gemini file: ${fileName}`);
  }

  const createdBatch = await createBatchWithRetry({
    model,
    fileName: fileName || "",
    appName,
  });

  console.log(`Created batch job: ${createdBatch.name}`);
  const startTime = Date.now();
  const completedBatch = await waitForBatchJob(createdBatch.name || "");
  const executionTimeMs = Date.now() - startTime;

  if (completedBatch.state !== "JOB_STATE_SUCCEEDED") {
    throw new Error(
      `Batch job ${completedBatch.name} finished with state ${completedBatch.state}: ${JSON.stringify(
        completedBatch.error || {},
      )}`,
    );
  }

  const rawResponses = await parseBatchResponses(completedBatch);
  const classificationsByKey: Record<string, any> = {};

  for (const job of jobs) {
    try {
      classificationsByKey[job.key] = classificationFromBatchEntry({
        entry: rawResponses[job.key],
        model,
        executionTimeMs,
      });
    } catch (error: any) {
      console.error(
        `Failed to parse batch response for ${job.key}:`,
        error?.message || error,
      );
      classificationsByKey[job.key] = {
        response: null,
        totalTokens: {
          input: 0,
          cached: 0,
          cashed: 0,
          output: 0,
          thinking: 0,
          total: 0,
        },
        cost: { input: 0, output: 0, total: 0 },
        executionTime: String(executionTimeMs),
        error: String(error?.message || error),
      };
    }
  }

  return classificationsByKey;
};

const hasRequiredClassificationFields = (response: any) =>
  !!response &&
  response.hasOwnProperty("main_activity") &&
  response.hasOwnProperty("reasoning_main_activity") &&
  response.hasOwnProperty("most_appropriate_node") &&
  response.hasOwnProperty("most_appropriate_node_parent") &&
  response.hasOwnProperty("most_appropriate_node_rationale") &&
  response.hasOwnProperty("node_validation_explanation");

const saveClassificationError = async ({
  classification,
  name,
  rowNum,
}: any) => {
  try {
    const newTaaftRef = db.collection("taaftMITError").doc();
    await newTaaftRef.set({
      classification,
      name,
      rowNum,
      createdAt: new Date(),
    });
  } catch (error) {
    const newTaaftRef = db.collection("taaftMITError").doc();
    await newTaaftRef.set({
      classification: JSON.stringify(classification, null, 2),
      name,
      rowNum,
      createdAt: new Date(),
      errorSaving: true,
    });
  }
};

const getResults = (results: any, nodes_ids: any) => {
  const loadAllTheAncestors = (nodeIds: string[]): string[] => {
    const ids = [];
    for (let id of nodeIds) {
      const node = nodes_ids[id];
      if (node && node.generalizations && node.generalizations.length > 0) {
        const generalizations = node.generalizations[0].nodes || [];
        const generalizationIds = generalizations.map(
          (n: { id: string }) => n.id,
        );
        ids.push(...generalizationIds);
        ids.push(...loadAllTheAncestors(generalizationIds));
      } else if (!node) {
        console.log(id, "missing id");
      }
    }
    return ids;
  };

  const loadAllTheDescendants = (nodeIds: string[]): string[] => {
    const ids = [];
    for (let id of nodeIds) {
      const node = nodes_ids[id];
      if (node && node.specializations && node.specializations.length > 0) {
        const specializations = node.specializations.flatMap(
          (s: any) => s.nodes,
        );
        const specializationIds = specializations.map(
          (n: { id: string }) => n.id,
        );
        ids.push(...specializationIds);
        ids.push(...loadAllTheDescendants(specializationIds));
      }
    }
    return ids;
  };

  const required_ids = results.map((r: any) => r.id);
  const all_ancestors = loadAllTheAncestors(required_ids);
  const all_descendants = loadAllTheDescendants(required_ids);

  return new Set([...required_ids, ...all_ancestors, ...all_descendants]);
};

const addIds = (node: any, appCacheNodes: any, newIds: any, number: number) => {
  const queue = [...(node.specializations ?? [])];
  const visitedIds = new Set(Object.values(newIds));
  let currentNumber = number;

  while (queue.length > 0) {
    const specialization = queue.shift();
    const nodes = specialization?.nodes ?? [];

    for (let childNode of nodes) {
      if (visitedIds.has(childNode.id)) {
        continue;
      }

      while (newIds[`node ${currentNumber}`]) {
        currentNumber += 1;
      }

      newIds[`node ${currentNumber}`] = childNode.id;
      visitedIds.add(childNode.id);
      currentNumber += 1;

      const cachedNode = appCacheNodes[childNode.id];
      queue.push(...(cachedNode?.specializations ?? []));
    }
  }

  return newIds;
};

const loadNodesFromCache = (appName: string) => {
  if (!existsSync(NODE_CACHE_PATH)) {
    throw new Error(
      `Missing node cache at ${NODE_CACHE_PATH}. Run: ts-node cache-classification-nodes.ts`,
    );
  }

  const cache = JSON.parse(readFileSync(NODE_CACHE_PATH, "utf8"));
  const appCacheNodes: any = cache[appName];
  for (let id in appCacheNodes) {
    appCacheNodes[id].id = id;
  }
  const root: any = Object.values(appCacheNodes).find((n: any) => n.root);
  let newIds: any = { "node 1": root.id };
  newIds = addIds(root, appCacheNodes, newIds, 1);

  const invertedObj = Object.fromEntries(
    Object.entries(newIds).map(([key, value]) => [value, key]),
  );

  const nodesByTitle: any = {};
  for (let nodeId in appCacheNodes) {
    const nodeData = appCacheNodes[nodeId];
    nodesByTitle[nodeData.title.toLowerCase().trim()] = invertedObj[nodeId];
  }
  return { nodes_ids: appCacheNodes, nodes_titles: nodesByTitle, newIds };
};

const readSheetData = (relativeFilePath: string): any[] => {
  const filePath = path.join(__dirname, relativeFilePath);
  const workbook = xlsx.readFile(filePath);
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return [];
  }

  return xlsx.utils.sheet_to_json<any>(workbook.Sheets[firstSheetName], {
    defval: null,
  });
};

(async () => {
  try {
    const sheetId = "197Imqmguj8b3P4DzEeN4xDjE_F7MWJw3XEpGM1SoeOA";
    const logsCollection = "classifierLogs";
    const appName =
      process.argv[2] === "1" ? "final-hierarchy-with-o*net" : "onet-ontology";
    console.log(appName, "appName");

    const { nodes_ids, newIds }: any = loadNodesFromCache(appName);

    const dwasReferences = readSheetData(
      "data/ONET_DATA/Task Statements-new.xlsx",
    );
    const tasks_by_jobs: any = {};
    for (let row of dwasReferences) {
      tasks_by_jobs[row["Task ID"]] = row["Title"];
    }

    const saveLogsDocs = await db
      .collection(logsCollection)
      .where("appName", "==", appName)
      .where("deleted", "==", false)
      .get();

    const processedRows: string[] = ([] = saveLogsDocs.docs.map(
      (doc) => `${doc.data().rowNum}-${doc.data().searchNum}`,
    ));
    console.log(processedRows, "processedRows");

    console.log("Reading Data...");

    let dataset = await readFromSheet({
      sheetName: "Classification",
      sheetId,
    });

    const invertedObj = Object.fromEntries(
      Object.entries(newIds).map(([key, value]) => [value, key]),
    );
    const nodes_ids_copy: any = {};
    for (let nodeId in nodes_ids) {
      const nodeData = JSON.parse(JSON.stringify(nodes_ids[nodeId]));
      const onetId = getONetTaskId(appName, nodeData);
      const newTitle =
        appName === "onet-ontology"
          ? removeTrailingTitleId(nodeData.title)
          : removeTrailingONETId(nodeData.title);

      for (let specialization of nodeData.specializations) {
        for (let node of specialization.nodes) {
          node.id = invertedObj[node.id];
        }
      }
      for (let collection of nodeData.generalizations) {
        for (let node of collection.nodes) {
          node.id = invertedObj[node.id];
        }
      }
      nodes_ids_copy[invertedObj[nodeId]] = {
        ...nodeData,
        ...(onetId ? { oNetId: onetId } : {}),
        title: newTitle,
      };
    }

    const nodeLookup = buildTitleParentLookup(nodes_ids_copy);
    const duplicateONetTaskJobs = getDuplicateONetTaskJobs(
      nodes_ids_copy,
      appName,
      tasks_by_jobs,
    );

    const uploadedFileArgIndex = process.argv.indexOf("--uploaded-file");
    let uploadedFileName =
      uploadedFileArgIndex >= 0
        ? process.argv[uploadedFileArgIndex + 1]
        : undefined;

    if (uploadedFileArgIndex >= 0 && !uploadedFileName) {
      throw new Error(
        "Missing value for --uploaded-file. Example: --uploaded-file files/mo4lucw5s5ac",
      );
    }

    const reuseJsonlArgIndex = process.argv.indexOf("--reuse-jsonl");
    const reuseJsonlPath =
      reuseJsonlArgIndex >= 0
        ? process.argv[reuseJsonlArgIndex + 1] ||
          resolve(
            BATCH_INPUT_DIR,
            `classification-batch-${appName}-latest.jsonl`,
          )
        : uploadedFileName
          ? resolve(
              BATCH_INPUT_DIR,
              `classification-batch-${appName}-latest.jsonl`,
            )
          : null;

    let pendingJobs: PendingClassification[] = [];
    let reusedJsonlPath: string | undefined;

    if (reuseJsonlPath) {
      const latestJobsPath = resolve(
        BATCH_INPUT_DIR,
        `classification-batch-${appName}-latest-jobs.jsonl`,
      );
      const pairedJobsPath = reuseJsonlPath.replace(/\.jsonl$/, "-jobs.jsonl");
      const jobsPath = existsSync(pairedJobsPath)
        ? pairedJobsPath
        : latestJobsPath;

      if (!existsSync(reuseJsonlPath)) {
        throw new Error(
          `Cannot reuse batch file. Missing JSONL (${reuseJsonlPath}).`,
        );
      }

      if (existsSync(jobsPath)) {
        pendingJobs = await loadJobsJsonl(jobsPath);
        await attachOriginalRequestsFromJsonl({
          jobs: pendingJobs,
          jsonlPath: reuseJsonlPath,
        });
        console.log(
          `Reusing ${pendingJobs.length} prepared jobs from ${jobsPath}`,
        );
      } else {
        console.log(
          `Jobs metadata missing; rebuilding lightweight job list from JSONL + sheet...`,
        );
        pendingJobs = await buildJobsFromRequestJsonl({
          jsonlPath: reuseJsonlPath,
          dataset,
        });
        const recoveredJobsPath = resolve(
          BATCH_INPUT_DIR,
          `classification-batch-${appName}-latest-jobs.jsonl`,
        );
        await writeJobsJsonl(
          pendingJobs.map(({ originalRequest, ...rest }) => rest),
          recoveredJobsPath,
        );
        console.log(
          `Recovered ${pendingJobs.length} jobs metadata at ${recoveredJobsPath}`,
        );
      }

      reusedJsonlPath = reuseJsonlPath;
      console.log(`Reusing batch JSONL from ${reuseJsonlPath}`);
    } else {
      let totalToSearch = 0;
      for (let rowIdx = 2; rowIdx < dataset.length; rowIdx++) {
        const row = dataset[rowIdx];
        const name = row[0];
        const description = row[1];
        const tagline = row[2];
        const recordIdx = rowIdx - 2;
        for (const searchNum of [100]) {
          if (
            name &&
            description &&
            tagline &&
            !processedRows.includes(`${recordIdx}-${searchNum}`)
          ) {
            totalToSearch += 1;
          }
        }
      }

      console.log(
        `Starting ontology search for ${totalToSearch} apps (Chroma top 100 + ancestors/descendants)...`,
      );

      let searchDone = 0;
      for (let rowIdx = 2; rowIdx < dataset.length; rowIdx++) {
        const row = dataset[rowIdx];
        const name = row[0];
        const description = row[1];
        const tagline = row[2];
        let recordIdx = rowIdx - 2;
        const searchNum = 100;

        if (
          name &&
          description &&
          tagline &&
          !processedRows.includes(`${recordIdx}-${searchNum}`)
        ) {
          searchDone += 1;
          console.log(
            `Ontology search ${searchDone}/${totalToSearch}: row ${recordIdx} - ${name}`,
          );

          const query = `${appName}\n${name}\n${description}\n${tagline}`;

          const results =
            (searchNum as any) === "full"
              ? null
              : await searchThroughChroma({
                  query,
                  resultsNum: Number(searchNum),
                  appName,
                  nodeType: "",
                  oNetTask: false,
                });

          let required_ids: any =
            (searchNum as any) === "full"
              ? null
              : getResults(results, nodes_ids);
          required_ids =
            (searchNum as any) === "full"
              ? null
              : new Set(
                  new Array(...required_ids).map(
                    (id: string) => invertedObj[id],
                  ),
                );

          const { ontology_object } = await loadAllNodes({
            exclusiveIds: (searchNum as any) === "full" ? null : required_ids,
            nodes_ids: nodes_ids_copy,
            synonyms: false,
            test: TEST,
            appName: appName,
            addId: false,
            tasks_by_jobs: duplicateONetTaskJobs,
          });

          const titleHierarchyOntologyObject =
            convertOntologyObjectToTitleHierarchy(ontology_object);

          pendingJobs.push({
            key: `${recordIdx}|${searchNum}|attempt-1`,
            rowIdx: recordIdx,
            searchNum,
            name,
            description,
            tagline,
            ontologyObject: titleHierarchyOntologyObject,
            attempt: 1,
            priorClassifications: [],
          });
        }
      }

      console.log(`Prepared ${pendingJobs.length} classification requests`);

      if (pendingJobs.length > 0) {
        const saved = await saveBatchArtifacts({
          jobs: pendingJobs,
          appName,
          attemptLabel: "attempt-1",
        });
        reusedJsonlPath = saved.jsonlPath;
      }
    }

    let jobsToRun = pendingJobs;

    while (jobsToRun.length > 0) {
      const shouldReuseJsonl =
        !!reusedJsonlPath && jobsToRun.every((job) => job.attempt === 1);

      const classificationsByKey = await runClassificationBatch({
        jobs: jobsToRun,
        appName,
        model: MODEL,
        jsonlPath: shouldReuseJsonl ? reusedJsonlPath : undefined,
        uploadedFileName:
          jobsToRun.every((job) => job.attempt === 1) && uploadedFileName
            ? uploadedFileName
            : undefined,
      });

      // After first submit, clear so retries write a fresh JSONL / re-upload
      if (shouldReuseJsonl) {
        reusedJsonlPath = undefined;
      }
      if (uploadedFileName) {
        uploadedFileName = undefined;
      }

      const retryJobs: PendingClassification[] = [];

      for (const job of jobsToRun) {
        let classification: any = null;
        let parseError: Error | null = null;

        try {
          classification = classificationsByKey[job.key];
          if (!classification) {
            throw new Error(`No batch response for key ${job.key}`);
          }
        } catch (error: any) {
          parseError = error;
          classification = {
            response: null,
            totalTokens: {
              input: 0,
              cached: 0,
              cashed: 0,
              output: 0,
              thinking: 0,
              total: 0,
            },
            cost: { input: 0, output: 0, total: 0 },
            executionTime: "0",
            error: String(error?.message || error),
          };
        }

        const allClassifications = [
          ...job.priorClassifications,
          classification,
        ];
        const response = classification?.response;

        if (
          !parseError &&
          response?.most_appropriate_node &&
          response?.most_appropriate_node_parent !== undefined
        ) {
          const finalValidation = validateOntologyNode({
            nodeTitle: response.most_appropriate_node,
            parentTitle: response.most_appropriate_node_parent,
            nodeLookup,
          });
          response.node_validation_explanation =
            finalValidation.explanatory_sentence;
        }

        const nodeValidation =
          !parseError &&
          response?.most_appropriate_node !== undefined &&
          response?.most_appropriate_node_parent !== undefined
            ? validateOntologyNode({
                nodeTitle: response.most_appropriate_node,
                parentTitle: response.most_appropriate_node_parent,
                nodeLookup,
              })
            : { titleMatchesParent: false };

        const foundClassification =
          TEST ||
          (!parseError &&
            hasRequiredClassificationFields(response) &&
            nodeValidation.titleMatchesParent);

        console.log(
          foundClassification,
          "foundClassification",
          job.rowIdx,
          job.searchNum,
          `attempt ${job.attempt}`,
        );

        if (!foundClassification) {
          if (allClassifications.length >= MAX_CLASSIFICATION_ATTEMPTS) {
            await saveClassificationError({
              classification: allClassifications,
              rowNum: job.rowIdx,
              name: job.name,
            });
            throw new Error(
              `No Classification is found for row ${job.rowIdx} Name:${job.name} after sending the request ${MAX_CLASSIFICATION_ATTEMPTS} times`,
            );
          }

          retryJobs.push({
            ...job,
            key: `${job.rowIdx}|${job.searchNum}|attempt-${job.attempt + 1}`,
            attempt: job.attempt + 1,
            priorClassifications: allClassifications,
          });
          continue;
        }

        const finalClassification =
          allClassifications[allClassifications.length - 1];
        let totalCost = 0;
        let totalTokens = 0;
        let totalExecutionTime = 0;

        for (const attemptClassification of allClassifications) {
          totalCost += Number(attemptClassification.cost.total || 0);
          totalTokens += Number(attemptClassification.totalTokens.total);
          totalExecutionTime +=
            Number(attemptClassification.executionTime) / 1000;
        }

        const rowCost = totalCost.toFixed(6);
        const rowTokens = totalTokens;
        const executionTime = Math.floor(totalExecutionTime);
        const finalResponse = finalClassification.response;
        const finalNodeValidation = validateOntologyNode({
          nodeTitle: finalResponse.most_appropriate_node,
          parentTitle: finalResponse.most_appropriate_node_parent,
          nodeLookup,
        });

        const SA = `${finalResponse.main_activity}:\n ${finalResponse.reasoning_main_activity}`;
        const selectedNodeTitle =
          nodes_ids_copy[finalNodeValidation.resolvedNodeId]?.title ||
          finalResponse.most_appropriate_node;
        const SA_Class = `${selectedNodeTitle}:\n ${finalResponse.most_appropriate_node_rationale}`;

        const saveLogRef = db.collection(logsCollection).doc();
        console.log("classified", job.rowIdx, "searchNum", job.searchNum);

        console.log({
          SA,
          SA_Class,
          tokens: `${rowTokens} tokens`,
          seconds: `${executionTime} seconds`,
          rowCost,
          requests: allClassifications.length,
        });

        await saveLogRef.set({
          rowNum: job.rowIdx,
          name: job.name,
          classification: JSON.stringify(finalClassification, null, 2),
          classifications: JSON.stringify(allClassifications, null, 2),
          rowClass: {
            SA,
            SA_Class,
            tokens: `${rowTokens} tokens`,
            seconds: `${executionTime} seconds`,
            rowCost,
            requests: allClassifications.length,
          },
          appName: appName,
          searchNum: job.searchNum,
          createdAt: new Date(),
          searchType: true,
          deleted: false,
        });
      }

      jobsToRun = retryJobs;
      if (jobsToRun.length > 0) {
        console.log(`Retrying ${jobsToRun.length} invalid classifications...`);
      }
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
