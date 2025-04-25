import { db } from " @components/lib/firestoreServer/admin-exp";
import { NextApiRequest, NextApiResponse } from "next";
import { openai } from "./helpers";

const extractJSON = (text: string) => {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (end === -1 || start === -1) {
      return { jsonObject: {}, isJSON: false };
    }
    const jsonArrayString = text.slice(start, end + 1);
    return { jsonObject: JSON.parse(jsonArrayString), isJSON: true };
  } catch (error) {
    return { jsonObject: {}, isJSON: false };
  }
};
const createAColor = () => {
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);

  const hexR = r.toString(16).padStart(2, "0");
  const hexG = g.toString(16).padStart(2, "0");
  const hexB = b.toString(16).padStart(2, "0");

  return `#${hexR}${hexG}${hexB}`.toLowerCase();
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  try {
    const {
      documentDetailed,
      newDiagramTitle,
      problemStatement,
      ideaEvaluator,
      consultant,
    } = req.body;
    const promptDocs = ideaEvaluator
      ? await db
          .collection("diagramPrompts")
          .where("ideaEvaluator", "==", true)
          .where("type", "==", "generate")
          .get()
      : await db
          .collection("diagramPrompts")
          .where("type", "==", "generate")
          .get();

    const promptData = promptDocs.docs[0].data();
    const llmPrompt = promptData.prompt;

    let prompt = `
  ${llmPrompt}
  ${documentDetailed}
  `;
    if (problemStatement) {
      prompt = `
${llmPrompt}
${documentDetailed}

## Problem description
${problemStatement}
`;
    }
    const messages: any = [
      {
        role: "user",
        content: prompt,
      },
    ];
    const model = "o3";

    const nodeTypesDocs = await db.collection("nodeTypes").get();
    const nodeTypes = [];
    for (let nodeDoc of nodeTypesDocs.docs) {
      const nodeData = nodeDoc.data();
      nodeTypes.push(nodeData.type);
    }

    const completion = await openai.chat.completions.create({
      messages,
      model,
      reasoning_effort: "high",
    });

    const response = extractJSON(
      completion.choices[0].message.content || "",
    ).jsonObject;

    const resRef = db.collection("responsesAI").doc();
    await resRef.set({
      response,
      createdAt: new Date(),
      llmPrompt,
    });
    if (!response?.groupHierarchy || !response?.nodes || !response?.links) {
      throw Error("Incomplete JSON");
    }
    const newDiagramRef = db.collection("diagrams").doc();
    const groups: any = [];
    const createGroups = (tree: any, diagramId: any) => {
      for (let group of tree) {
        const groupRef = db.collection("groups").doc();
        const id = groupRef.id;
        group.id = id;
        const _group = {
          id,
          createdAt: new Date(),
          ...group,
          diagrams: [diagramId],
          deleted: false,
        };
        groups.push(_group);

        groupRef.set(_group);
        if (group.subgroups) {
          createGroups(group.subgroups, diagramId);
        }
      }
    };
    createGroups(response.groupHierarchy, newDiagramRef.id);
    for (let node of response["nodes"]) {
      const nodeRef = db.collection("nodes").doc();
      const id = nodeRef.id;
      const _groups = node.groups.map((c: any) => {
        return {
          id: groups.find((g: any) => g.label === c)?.id || "",
          label: groups.find((g: any) => g.label === c)?.label || "",
        };
      });
      node.groups = _groups;
      node.originalId = node.id;
      node.id = id;
      const _node = {
        ...node,
        createdAt: new Date(),
      };

      if (!nodeTypes.includes(node.nodeType)) {
        const newTypeRef = db.collection("nodeTypes").doc();
        newTypeRef.set({
          type: node.nodeType,
          color: createAColor(),
        });
      }
      nodeRef.set({
        ..._node,
        diagrams: [newDiagramRef.id],
        deleted: false,
      });
    }
    for (let link of response["links"]) {
      link.source =
        response["nodes"].find((c: any) => c.originalId === link.source)?.id ||
        "";
      link.target =
        response["nodes"].find((c: any) => c.originalId === link.target)?.id ||
        "";
      const linkRef = db.collection("links").doc();

      linkRef.set({ ...link, diagrams: [newDiagramRef.id], deleted: false });
    }
    await newDiagramRef.set({
      title: newDiagramTitle,
      id: newDiagramRef.id,
      deleted: false,
      documentDetailed,
      ...(consultant ? { problemStatement, consultant: true } : {}),
    });
    return res.status(200).json({ diagramId: newDiagramRef.id });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({
      message: e.message,
    });
  }
}
