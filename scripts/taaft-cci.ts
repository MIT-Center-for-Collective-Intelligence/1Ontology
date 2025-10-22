import { db } from "@components/lib/firestoreServer/admin";
import * as fs from "fs";
const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");
const csv = require("fast-csv");

interface CSVRow {
  [key: string]: string;
}
const API_KEY = process.env.GEMINI_Test1_API_KEY;
/* const ai = new GoogleGenAI({ apiKey: API_KEY }); */
const genAI = new GoogleGenerativeAI(process.env.MIT_CCI_GEMINI_API_KEY || "");

export const extractObject = (str: any) => {
  try {
    const start = str.indexOf("{");
    if (start === -1) return null;

    let braceCount = 0;
    for (let i = start; i < str.length; i++) {
      if (str[i] === "{") braceCount++;
      else if (str[i] === "}") braceCount--;

      if (braceCount === 0) {
        const jsonStr = str.slice(start, i + 1);
        try {
          return JSON.parse(jsonStr);
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  } catch (error) {
    return null;
  }
};

function readCSV(filePath: string): Promise<CSVRow[]> {
  return new Promise((resolve, reject) => {
    const results: CSVRow[] = [];

    fs.createReadStream(filePath)
      .pipe(csv.parse({ headers: true }))
      .on("error", (error: Error) => reject(error))
      .on("data", (row: CSVRow) => results.push(row))
      .on("end", () => resolve(results));
  });
}
async function writeCSV(filePath: string, data: CSVRow[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(filePath);
    csv
      .write(data, { headers: true })
      .pipe(ws)
      .on("finish", resolve)
      .on("error", reject);
  });
}

async function sendRequestToGemini({ prompt }: { prompt: string }) {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-pro",
      generationConfig: {
        maxOutputTokens: 3276,
        temperature: 0,
      },
    });

    console.log("Sending prompt to Gemini:", prompt);

    const result = await model.generateContent(prompt);
    console.log(JSON.stringify(result.response, null, 2));
    const response = result.response;

    const text = response.text();

    console.log("Received response from Gemini.");
    return text;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("Failed to get response from Gemini.");
  }
}

const loadAllNodes = async () => {
  const appName = "ontology-development-version";
  let nodesByIds: Record<string, any> = {};

  // Load all relevant nodes from Firestore
  const nodesDocs = await db
    .collection("nodes")
    .where("appName", "==", appName)
    .where("deleted", "==", false)
    .get();

  for (let nodeDoc of nodesDocs.docs) {
    nodesByIds[nodeDoc.id] = { id: nodeDoc.id, ...nodeDoc.data() };
  }

  // Store nodes in a dictionary for quick lookup

  // Recursive function to build nested structure
  const buildNestedStructure = (
    nodeId: string,
    visited = new Set<string>(),
  ) => {
    const nodeData = nodesByIds[nodeId];
    if (!nodeData) return {};

    const nestedResult: any = {};

    for (let collection of nodeData.specializations || []) {
      if (collection.collectionName === "main") {
        for (let { id: childId } of collection.nodes || []) {
          const childNodeData = nodesByIds[childId];
          if (!childNodeData) continue;

          nestedResult[childNodeData.title] = buildNestedStructure(
            childId,
            new Set(visited), // Clone visited set to prevent cross-path contamination
          );
        }
      } else {
        if (!nestedResult[collection.collectionName]) {
          nestedResult[collection.collectionName] = {};
        }

        for (let { id: childId } of collection.nodes || []) {
          const childNodeData = nodesByIds[childId];
          if (!childNodeData) continue;

          nestedResult[collection.collectionName][childNodeData.title] =
            buildNestedStructure(
              childId,
              new Set(visited), // Clone visited set to prevent cross-path contamination
            );
        }
      }
    }

    return nestedResult;
  };

  // Build the final object keyed by top-level node title
  const ontology_object: Record<string, any> = {};
  for (let nodeId of ["NwjLLWrQz8ODbn9hu77R"]) {
    const nodeData = nodesByIds[nodeId];
    if (!nodeData?.title) continue;

    ontology_object[nodeData.title] = buildNestedStructure(nodeId);
  }

  return { ontology_object, nodesByIds };
};
const generationConfig = {
  temperature: 0,
  // topP: 0.95,
  // topK: 64,
  maxOutputTokens: 65536,
  responseModalities: [],
  responseMimeType: "application/json",
};

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

export async function callGemini(messagesOrPrompt: any): Promise<string> {
  if (Array.isArray(messagesOrPrompt)) {
    for (let message of messagesOrPrompt) {
      if (message.role === "assistant") {
        message.role = "model";
      }
      if ("content" in message) {
        message.parts = [{ text: message.content }];
        delete message.content;
      }
    }
  }
  const apiKey = API_KEY || "";
  const genAI = new GoogleGenerativeAI(apiKey);

  const gemini = genAI.getGenerativeModel({
    model: "gemini-2.5-pro-preview-05-06",
  });

  const chatSession = await gemini.generateContent(
    {
      contents: Array.isArray(messagesOrPrompt)
        ? messagesOrPrompt
        : [
            {
              role: "user",
              parts: { text: messagesOrPrompt },
            },
          ],
    },
    generationConfig,
    safetySettings,
  );
  const response = chatSession.response.text() || "";
  return response;
}

const checkClassification = async ({
  appTitle,
  tagline,
  description,
  ontologyObject,
}: {
  appTitle: string;
  tagline: string;
  description: string;
  ontologyObject: any;
}) => {
  try {
    /* Determine if the application is acting on another activity */
    const promptCombined = `
## Role:
You are an analyst that classifies a software application according to: (a) what main substantive activity it performs or helps perform, represented as a "verb + object" phrase, (b) whether it performs the whole activity itself or helps a human perform the activity, and (c) which of the nodes in the ontology (provided as a JSON structure in the input) is the best classification for the main substantive activity. Work only with the supplied nodes and their fields; do not infer or invent nodes or properties. 

## Ontology Definition:
Each node in our ontology represents a type of action and has these properties:
- **title** (String) – a unique, concise title.
- **description** (String) – a detailed explanation of the node, its purpose, scope, and context.
- **specializations** (Array of Objects) – collections of more specific types of this node, organized along common dimensions. Each collection contains:
  - **collectionName** (String) – the dimension along which specializations vary.
  - **nodes** (Array of String) – titles of nodes that are specializations along this dimension.

## Input:
- Application Title: "${appTitle}"
- Application Tagline: "${tagline}"
- Application Description: '''${description}'''
- Ontology Nodes: ${JSON.stringify(ontologyObject, null, 2)}

## Output:
Return a single JSON object only (no prose), exactly with these keys and value types:
{
  "does_it_perform_the_activity_or_help_a_human_perform_it": "perform" or "help",
  "reasoning_for_does_it_perform_the_activity_or_help_a_human_perform_it": "Explain why you think the app performs the activity, or helps a human perform it.",
  "substantive_activity": "The single 'base-form verb + object' describing the substantive activity",
  "reasoning_substantive_activity": "Explain your reasoning for substantive_activity. If info is sparse/ambiguous, make the best-supported choice and note low confidence in "reasoning" fields.",
  "most_appropriate_node": {
    "title": "title of the ontology node",
    "description": "description of the ontology node"
  },
  "most_appropriate_node_rationale": "your reasoning for choosing this ontology node"
}

## Constraints:
- Output must be valid JSON: double quotes around all strings, no trailing commas, no extra keys or text.
- Always include one item in "substantive_activity".
- Use base verb forms plus their direct object in "substantive_activity" (e.g., "write code", "conduct research", "summarize text").
- Determine the most appropriate node from the ontology by applying the selection criteria below (coverage first, then specificity, then similarity). Choose the most specific node whose scope fully covers the common action represented by the phrase; if multiple nodes meet this, break ties by higher semantic similarity to the input phrase.

### Selection Criteria:
Use these criteria (in order):
1. **Coverage**: the node's description fully covers the common action represented by the input phrase and its intended outcome.
2. **Specificity**: among nodes that cover the action, prefer the narrowest scope that still fully covers it.
3. **Similarity**: prefer nodes whose title + description align with the input phrase and its implied outcome.
4. **Tie-breakers**: if still tied, prefer the node most proximal to the primary action implied by the phrase over generic meta-actions; if still tied, choose the one with clearer alignment to the input phrase.

## Procedure:
Internally follow this process:
1. From the provided application tagline and description, identify the main substantive activity it performs or helps perform, represented as a "verb + object" phrase. 
2. Specify whether it performs the whole activity itself or helps a human perform the activity. 
3. Internally, analyze the "verb + object" phrase and compare it to every node in the ontology. For each node, consider all its information.
4. Select the candidate that passes coverage with the highest overall alignment, breaking ties using the rubric above.
5. Produce the output JSON exactly as specified.
  `;

    type IResponse = {
      does_it_perform_the_activity_or_help_a_human_perform_it: string;
      reasoning_for_does_it_perform_the_activity_or_help_a_human_perform_it: string;
      substantive_activity: string;
      reasoning_substantive_activity: string;
      most_appropriate_node: {
        title: string;
        description: string;
      };
      most_appropriate_node_rationale: string;
    };
    let response = null;
    let totalTokens = "";
    let executionTime = 0;
    while (!response) {
      const responseObject = await sendRequestToGemini({
        prompt: promptCombined,
      });
      response = extractObject(responseObject);

      if (
        !response ||
        !response.hasOwnProperty(
          "does_it_perform_the_activity_or_help_a_human_perform_it",
        ) ||
        !response.hasOwnProperty(
          "reasoning_for_does_it_perform_the_activity_or_help_a_human_perform_it",
        ) ||
        !response.hasOwnProperty("substantive_activity") ||
        !response.hasOwnProperty("reasoning_substantive_activity") ||
        !response.hasOwnProperty("most_appropriate_node") ||
        !response.hasOwnProperty("most_appropriate_node_rationale")
      ) {
        response = null;
      }
    }
    console.log(promptCombined);

    return { response };
  } catch (error) {
    console.error(error);
  }
};

(async () => {
  try {
    const filePath = "TAAFT_human_annotation_trial.csv";
    const outputPath = "TAAFT_human_annotation_output.csv";
    const data = await readCSV(filePath);

    const { ontology_object } = await loadAllNodes();
    const newData = [];
    for (let rowData of data) {
      const classification: any = await checkClassification({
        appTitle: rowData.Name,
        tagline: rowData.Tagline,
        description: rowData.Description,
        ontologyObject: ontology_object,
      });

      const MA = `${classification.does_it_perform_the_activity_or_help_a_human_perform_it}: \n${classification.reasoning_for_does_it_perform_the_activity_or_help_a_human_perform_it}`;
      const SA = `${classification.substantive_activity}: \n${classification.reasoning_substantive_activity}`;
      const SAClassificationWithRational = `${classification.most_appropriate_node.title}: \n${classification.most_appropriate_node_rationale}`;
      newData.push({
        ...rowData,
        MA,
        SA,
        "SA Classification": SAClassificationWithRational,
      });
    }
    await writeCSV(outputPath, newData);
  } catch (error) {
    console.error(error);
  }
})();
