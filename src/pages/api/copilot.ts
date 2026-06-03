import { NextApiRequest, NextApiResponse } from "next";
import {
  askGemini,
  askGeminiWithFunctionCalling,
  chromaHitsToOntologyQueryResults,
} from "./helpers";

import { LOGS, NODES } from "@components/lib/firestoreClient/collections";
import { FieldPath } from "firebase-admin/firestore";
import { db } from "@components/lib/firestoreServer/admin";
import { INode } from "@components/types/INode";
import fbAuth from "@components/middlewares/fbAuth";
import { extractJSON, getDoerCreate } from "@components/lib/utils/helpers";
import {
  MODELS_OPTIONS,
  buildCopilotLLMPrompt,
  SystemPromptObjectiveDefinition,
} from "@components/lib/utils/copilotPrompts";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { ChatModel } from "openai/resources/chat/chat";
import { openai } from "./openaiClient";
import { Content } from "@google/genai";
import { GEMINI_MODEL } from "@components/lib/CONSTANTS";

const GEMINI_MODELS = [
  "gemini-3.1-pro-preview",
  "gemini-2.0-flash-exp",
  "gemini-2.0-flash-thinking-exp",
  "gemini-exp-1206",
  "gemini-2.5-pro",
];

type GeminiModels =
  | "gemini-3.1-pro-preview"
  | "gemini-2.0-flash-exp"
  | "gemini-2.0-flash-thinking-exp"
  | "gemini-2.5-pro"
  | "gemini-exp-1206";

export const recordLogs = async (
  logs: { [key: string]: any },
  uname: string,
) => {
  try {
    if (uname === "ouhrac") return;
    const logRef = db.collection(LOGS).doc();
    const doerCreate = getDoerCreate(uname || "");
    await logRef.set({
      type: "info",
      ...logs,
      createdAt: new Date(),
      doer: uname,
      doerCreate,
    });
  } catch (error) {
    console.error(error);
  }
};

const saveLogs = (
  uname: string,
  type: "info" | "error",
  logs: { [key: string]: any },
) => {
  try {
    const logRef = db.collection(LOGS).doc();
    logRef.set({
      type,
      ...logs,
      createdAt: new Date(),
      doer: uname,
      doerCreate: getDoerCreate(uname),
    });
  } catch (error) {
    console.error(error);
  }
};

const sendLLMRequest = async ({
  prompt,
  model = process.env.MODEL as ChatModel | GeminiModels,
  uname,
  appName,
  useFunctionCalling = false,
  inputProperties,
}: {
  prompt: string;
  model: ChatModel | GeminiModels;
  uname: string;
  appName?: string;
  useFunctionCalling?: boolean;
  inputProperties?: string[];
}) => {
  try {
    if (!prompt.trim() || !model.trim()) {
      throw new Error("Prompt and model are required");
    }

    if (GEMINI_MODELS.includes(model)) {
      const contents: Content[] = [];

      contents.push({
        role: "user",
        parts: [
          {
            text: prompt,
          },
        ],
      });

      const response = useFunctionCalling
        ? await askGeminiWithFunctionCalling({
            contents,
            model,
            appName,
            inputProperties,
          })
        : await askGemini(contents, model);
      return response;
    }

    let isJSONObject: { jsonObject: any; isJSON: boolean } = {
      jsonObject: {},
      isJSON: false,
    };
    for (let i = 0; i < 4; i++) {
      try {
        const messages: Array<ChatCompletionMessageParam> = [
          {
            role: "user",
            content: prompt,
          },
        ];

        const completion = await openai.chat.completions.create({
          messages,
          model,
          temperature: 0,
        });

        const response = completion.choices[0].message.content;

        isJSONObject = extractJSON(response || "");
        if (isJSONObject.isJSON) {
          break;
        }
        console.error(
          "Failed to get a complete JSON object. Retrying for the ",
          i + 1,
          " time.",
        );
      } catch (error) {
        console.error("Error in generating content: ", error);
      }
    }
    if (!isJSONObject.isJSON) {
      throw new Error("Failed to get a complete JSON object");
    }
    return isJSONObject.jsonObject;
  } catch (error: any) {
    console.log("error", error);
    saveLogs(uname, "info", {
      type: "error",
      error: JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack,
      }),
      at: "sendLLMRequest",
    });
  }
};

export const getNodes = async (
  appName: string,
): Promise<Record<string, INode>> => {
  const noneDeletedNodes = await (appName
    ? db
        .collection(NODES)
        .where("deleted", "==", false)
        .where("appName", "==", appName)
        .get()
    : db.collection(NODES).where("deleted", "==", false).get());
  const nodes: Record<string, INode> = {};
  noneDeletedNodes.docs.forEach((doc) => {
    const data = doc.data() as INode;
    nodes[doc.id] = data;
  });
  return nodes;
};

const getEditedParts = async (
  uname: string,
): Promise<SystemPromptObjectiveDefinition> => {
  let promptDoc = await db.collection("copilotPrompts").doc(uname).get();
  if (!promptDoc.exists) {
    promptDoc = await db.collection("copilotPrompts").doc("1man").get();
  }
  if (!promptDoc.exists) throw new Error("System prompt missing!");

  const promptData = promptDoc.data() as {
    systemPrompt: {
      id: string;
      value?: string;
      editablePart?: string;
    }[];
  };

  return {
    objective: String(promptData?.systemPrompt?.[0]?.editablePart || ""),
    definition: String(promptData?.systemPrompt?.[1]?.editablePart || ""),
  };
};

/**
 * Parses nodeIds from a string (comma- or space-separated) into an array of trimmed non-empty ids.
 * @param nodeIdsStr - e.g. "id1,id2,id3" or "id1 id2 id3"
 * @returns Array of node id strings
 */
export function parseNodeIdsString(nodeIdsStr: string): string[] {
  if (!nodeIdsStr || typeof nodeIdsStr !== "string") return [];
  return nodeIdsStr
    .split(/[\s,]+/)
    .map((id) => id.trim())
    .filter(Boolean);
}

const FIRESTORE_IN_QUERY_LIMIT = 30;

/**
 * Fetches node data for the given node ids and returns nodes_ids (id -> full node data)
 * and nodes_titles (id -> title).
 * @param nodeIds - Set of node document ids
 * @returns { nodes_ids: Record<string, any>, nodes_titles: Record<string, string> }
 */
export async function getNodesByIds(nodeIds: Set<string>): Promise<{
  nodes_ids: Record<string, any>;
  nodes_titles: Record<string, string>;
}> {
  const nodes_ids: Record<string, any> = {};
  const nodes_titles: Record<string, string> = {};

  if (!nodeIds?.size) return { nodes_ids, nodes_titles };

  const ids = Array.from(nodeIds);

  for (let i = 0; i < ids.length; i += FIRESTORE_IN_QUERY_LIMIT) {
    const chunk = ids.slice(i, i + FIRESTORE_IN_QUERY_LIMIT);
    const snapshot = await db
      .collection(NODES)
      .where(
        FieldPath.documentId(),
        "in",
        chunk.map((id) => db.collection(NODES).doc(id)),
      )
      .get();

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const nodeData = { id: doc.id, ...data };
      nodes_ids[doc.id] = nodeData;
      if (data?.title != null) {
        nodes_titles[doc.id] = String(data.title);
      }
    });
  }

  return { nodes_ids, nodes_titles };
}

const loadAllNodesFlat = async ({
  exclusiveIds,
  nodes_ids,
  nodes_titles,
  appName,
  inputProperties,
}: {
  exclusiveIds: Set<string> | null;
  nodes_ids?: Record<string, any>;
  appName: string;
  nodes_titles?: Record<string, any>;
  inputProperties?: string[];
}) => {
  let nodesByIds: Record<string, any> = nodes_ids ? { ...nodes_ids } : {};
  let currentNodesTitles: Record<string, any> = nodes_titles
    ? { ...nodes_titles }
    : {};

  if (!nodes_ids) {
    const nodesDocs = await db
      .collection("nodes")
      .where("appName", "==", appName)
      .where("deleted", "==", false)
      .get();

    for (let nodeDoc of nodesDocs.docs) {
      nodesByIds[nodeDoc.id] = { id: nodeDoc.id, ...nodeDoc.data() };
      currentNodesTitles[nodeDoc.id] = nodeDoc.data().title;
    }
  }

  const resultNodes: any[] = [];
  const traverseNode = (nodeId: string, visited = new Set<string>()) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = nodesByIds[nodeId];
    if (!node) return;

    if (!exclusiveIds || exclusiveIds.has(nodeId)) {
      const nodeObj: any = { title: node.title };
      const inputPropsSet = inputProperties ? new Set(inputProperties) : null;

      if (!inputPropsSet || inputPropsSet.has("specializations")) {
        nodeObj.specializations = (node.specializations || []).flatMap(
          (col: any) =>
            (col.nodes || []).map((n: any) => currentNodesTitles[n.id] || n.id),
        );
      }
      if (!inputPropsSet || inputPropsSet.has("generalizations")) {
        nodeObj.generalizations = (node.generalizations?.[0]?.nodes || []).map(
          (n: any) => currentNodesTitles[n.id] || n.id,
        );
      }
      if (!inputPropsSet || inputPropsSet.has("parts")) {
        nodeObj.parts = (node.parts || []).map(
          (n: any) => currentNodesTitles[n.id] || n.id,
        );
      }
      if (!inputPropsSet || inputPropsSet.has("isPartOf")) {
        nodeObj.isPartOf = (node.isPartOf || []).map(
          (n: any) => currentNodesTitles[n.id] || n.id,
        );
      }

      resultNodes.push(nodeObj);
    }
  };

  if (exclusiveIds && exclusiveIds.size > 0) {
    for (let nodeId of exclusiveIds) {
      traverseNode(nodeId);
    }
  }
  return resultNodes;
};

const getSubOntology = async ({
  nodeId,
  hops,
}: {
  nodeId: string;
  hops: number;
}): Promise<any> => {
  const nodesById: Record<string, any> = {};
  const subgraphIds = new Set<string>();

  const collectDirected = async (options: {
    step: (
      node: Record<string, any>,
    ) => Array<{ id?: string | null } | null | undefined>;
  }) => {
    let frontier = new Set([nodeId]);
    for (let depth = 0; depth <= hops; depth++) {
      const { nodes_ids } = await getNodesByIds(frontier);
      Object.assign(nodesById, nodes_ids);

      for (const id of frontier) {
        if (nodesById[id]) subgraphIds.add(id);
      }

      if (depth === hops || frontier.size === 0) break;

      const next = new Set<string>();
      for (const id of frontier) {
        const node = nodesById[id];
        if (!node) continue;
        for (const neighbor of options.step(node)) {
          const nid = neighbor?.id;
          if (nid) next.add(String(nid));
        }
      }
      frontier = next;
    }
  };

  try {
    await collectDirected({
      step: (node) => node.generalizations?.[0]?.nodes ?? [],
    });
    await collectDirected({
      step: (node) =>
        (node.specializations ?? []).flatMap(
          (coll: { nodes?: Array<{ id?: string | null }> }) =>
            coll?.nodes ?? [],
        ),
    });

    const referencedNeighborIds = new Set<string>();
    for (const node of Object.values(nodesById)) {
      const n = node as Record<string, any>;
      for (const p of n.generalizations?.[0]?.nodes ?? []) {
        const nid = p?.id;
        if (nid && !nodesById[String(nid)]) {
          referencedNeighborIds.add(String(nid));
        }
      }
      for (const coll of n.specializations ?? []) {
        for (const c of coll?.nodes ?? []) {
          const nid = c?.id;
          if (nid && !nodesById[String(nid)]) {
            referencedNeighborIds.add(String(nid));
          }
        }
      }
    }
    if (referencedNeighborIds.size > 0) {
      const { nodes_ids } = await getNodesByIds(referencedNeighborIds);
      Object.assign(nodesById, nodes_ids);
    }

    const hitList = [...subgraphIds].map((id) => ({
      id,
      title: nodesById[id]?.title,
    }));

    return chromaHitsToOntologyQueryResults(hitList, nodesById);
  } catch (error) {
    console.error(error);
  }
};

const FIRESTORE_TITLE_IN_QUERY_LIMIT = 30;

async function getNodeIdsByTitle({
  appName,
  titles,
}: {
  appName?: string;
  titles: Set<string>;
}): Promise<Record<string, string>> {
  const titleToId: Record<string, string> = {};
  const allTitles = [...titles]
    .map((t) => String(t || "").trim())
    .filter(Boolean);
  if (!allTitles.length) return titleToId;

  for (let i = 0; i < allTitles.length; i += FIRESTORE_TITLE_IN_QUERY_LIMIT) {
    const chunk = allTitles.slice(i, i + FIRESTORE_TITLE_IN_QUERY_LIMIT);
    let snapshot: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData> | null =
      null;

    // Prefer the most selective query first (may require an index).
    try {
      const q = db
        .collection("nodes")
        .where("deleted", "==", false)
        .where("title", "in", chunk);
      snapshot = appName
        ? await q.where("appName", "==", appName).get()
        : await q.get();
    } catch (e) {
      // Fallback: title-only query (filter remaining constraints in memory).
      const q = db.collection("nodes").where("title", "in", chunk);
      snapshot = await q.get();
    }

    snapshot?.docs.forEach((doc) => {
      const data = doc.data() as any;
      if (data?.deleted) return;
      if (appName && data?.appName !== appName) return;
      const title = String(data?.title || "").trim();
      if (!title) return;
      if (!titleToId[title]) {
        titleToId[title] = doc.id;
      }
    });
  }

  return titleToId;
}

function collectReferencedTitlesForIds(responseObject: any): Set<string> {
  const titles = new Set<string>();
  const add = (t: any) => {
    const s = String(t || "").trim();
    if (s) titles.add(s);
  };

  const improvements = responseObject?.improvements ?? [];
  for (const imp of improvements) {
    add(imp?.title);
    const changes = imp?.changes ?? [];
    for (const ch of changes) {
      // Specializations: nested collections with nodes as string titles.
      const specs = ch?.specializations ?? [];
      for (const s of specs) {
        const nodes = s?.collection_to_add?.nodes ?? s?.nodes ?? [];
        if (Array.isArray(nodes)) nodes.forEach(add);
      }

      // Generalizations: sometimes returned as an array of titles.
      const gens = ch?.generalizations ?? [];
      if (Array.isArray(gens)) gens.forEach(add);

      // Parts: array of objects with a title.
      const parts = ch?.parts ?? [];
      if (Array.isArray(parts)) parts.forEach((p: any) => add(p?.title));
    }
  }

  // New nodes: generalizations is an array of titles, parts are objects with titles.
  const newNodes = responseObject?.new_nodes ?? [];
  for (const n of newNodes) {
    add(n?.title);
    const gens = n?.generalizations ?? [];
    if (Array.isArray(gens)) gens.forEach(add);
    const parts = n?.parts ?? [];
    if (Array.isArray(parts)) parts.forEach((p: any) => add(p?.title));
  }

  // Delete nodes: titles only.
  const delNodes = responseObject?.delete_nodes ?? [];
  for (const n of delNodes) add(n?.title);

  // Required nodes: titles only.
  const reqNodes = responseObject?.required_nodes ?? [];
  if (Array.isArray(reqNodes)) reqNodes.forEach(add);

  return titles;
}

function enrichResponseObjectWithIds(
  responseObject: any,
  titleToId: Record<string, string>,
) {
  try {
    if (!responseObject || typeof responseObject !== "object") {
      return responseObject;
    }

    const out = responseObject;

    const normalizeTitle = (v: any): string => {
      if (typeof v === "string") return v.trim();
      return String(v || "").trim();
    };

    const lookup = (rawTitle: any): string | undefined => {
      const t = normalizeTitle(rawTitle);
      return t ? titleToId[t] : undefined;
    };

    const buildTitleIdArray = (
      arr: any[],
    ): { title: string; id?: string }[] => {
      const res: { title: string; id?: string }[] = [];
      for (let i = 0; i < arr.length; i++) {
        const title = normalizeTitle(arr[i]);
        if (!title) continue;
        res.push({ title, id: titleToId[title] });
      }
      return res;
    };

    const addIdsToPartsInPlace = (parts: any[]) => {
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (!p || typeof p !== "object") continue;
        (p as any).id = lookup((p as any).title);
      }
    };

    const improvements = out.improvements;
    if (Array.isArray(improvements)) {
      for (let i = 0; i < improvements.length; i++) {
        const imp = improvements[i];
        const changes = imp?.changes;
        if (!Array.isArray(changes)) continue;

        for (let j = 0; j < changes.length; j++) {
          const ch = changes[j];

          const specs = ch?.specializations;
          if (Array.isArray(specs)) {
            for (let k = 0; k < specs.length; k++) {
              const s = specs[k];
              const cta = s?.collection_to_add;
              const nodes =
                (cta && typeof cta === "object" ? cta.nodes : null) ?? s?.nodes;
              if (!Array.isArray(nodes)) continue;

              const nodesWithIds = buildTitleIdArray(nodes);
              if (cta && typeof cta === "object") {
                cta.nodes_with_ids = nodesWithIds;
              } else if (s && typeof s === "object") {
                s.nodes_with_ids = nodesWithIds;
              }
            }
          }

          const gens = ch?.generalizations;
          if (Array.isArray(gens)) {
            ch.generalizations_with_ids = buildTitleIdArray(gens);
          }

          const parts = ch?.parts;
          if (Array.isArray(parts)) {
            addIdsToPartsInPlace(parts);
          }
        }
      }
    }

    const newNodes = out.new_nodes;
    if (Array.isArray(newNodes)) {
      for (let i = 0; i < newNodes.length; i++) {
        const n = newNodes[i];

        const gens = n?.generalizations;
        if (Array.isArray(gens)) {
          n.generalizations_with_ids = buildTitleIdArray(gens);
        }

        const parts = n?.parts;
        if (Array.isArray(parts)) {
          addIdsToPartsInPlace(parts);
        }
      }
    }

    const delNodes = out.delete_nodes;
    if (Array.isArray(delNodes)) {
      for (let i = 0; i < delNodes.length; i++) {
        const n = delNodes[i];
        if (!n || typeof n !== "object") continue;
        if (!("title" in n)) continue;
        (n as any).id = lookup((n as any).title);
      }
    }

    const reqNodes = out.required_nodes;
    if (Array.isArray(reqNodes)) {
      out.required_nodes_with_ids = buildTitleIdArray(reqNodes);
    }

    return out;
  } catch (error) {
    console.log(error, "error");
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  const {
    user,
    userMessage,
    model,
    nodeId,
    generateNewNodes,
    improveProperties,
    proposeDeleteNode,
    inputProperties,
    appName,
    systemPromptObjectiveDefinition,
  } = req.body.data;

  const { uname } = user?.userData;
  try {
    const modelIndex = MODELS_OPTIONS.findIndex(
      (option) => option.id === model,
    );
    if (!user?.userData || modelIndex === -1) {
      throw new Error("Access forbidden");
    }
    const nodeDoc = await db.collection("nodes").doc(nodeId).get();
    const nodeData = nodeDoc.data();
    if (!nodeDoc.exists || !nodeData || !nodeData?.title) {
      throw new Error("Node not found, or missing title");
    }

    const subOntology = await getSubOntology({
      nodeId,
      hops: 5,
    });

    console.log("subOntology", subOntology);

    const editedPartFromClient = (systemPromptObjectiveDefinition ||
      null) as SystemPromptObjectiveDefinition | null;
    const editedPart = editedPartFromClient ?? (await getEditedParts(uname));

    const SYSTEM_PROMPT = buildCopilotLLMPrompt({
      editedPart,
      improvement: (improveProperties || []).length > 0,
      newNodes: !!generateNewNodes,
      proposeDeleteNode: !!proposeDeleteNode,
      improveProperties: improveProperties || [],
      userMessage,
      subOntology,
      nodeTitle: nodeData?.title || "",
    });
    const response: any = await sendLLMRequest({
      prompt: SYSTEM_PROMPT,
      model: GEMINI_MODEL,
      uname,
      appName,
      useFunctionCalling: true,
      inputProperties,
    });
    const generatedProposals = response.responseObject;
    try {
      await db.collection("copilotResponses").doc().set({
        nodeId,
        model,
        response,
        createdAt: new Date(),
      });
    } catch (error) {
      console.error(error);
    }

    const referencedTitles = collectReferencedTitlesForIds(generatedProposals);
    const titleToId = await getNodeIdsByTitle({
      appName,
      titles: referencedTitles,
    });
    const enriched = enrichResponseObjectWithIds(generatedProposals, titleToId);
    console.log(JSON.stringify(enriched, null, 2));
    return res.status(200).json(enriched);
  } catch (error: any) {
    console.error("error", error);
    recordLogs(
      {
        type: "error",
        error: JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
        at: "copilot",
      },
      uname,
    );
    return res.status(500).json({ error: error.message });
  }
}

export default fbAuth(handler);
