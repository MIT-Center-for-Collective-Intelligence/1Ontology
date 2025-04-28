import { NextApiRequest, NextApiResponse } from "next";
import { askGemini, openai } from "./helpers";

import { dbCausal } from "@components/lib/firestoreServer/admin";
import { GEMINI_MODEL } from "@components/lib/CONSTANTS";
import { getConsultantPrompt } from "@components/lib/utils/copilotPrompts";
import {
  generateDiagram,
  createAColor,
} from "@components/lib/utils/helpersConsultant";
import { FieldValue } from "firebase-admin/firestore";

const CONSULTANT_MESSAGES = "consultantMessages";

const generateTopMessage = async (
  caseDescription: string,
  problemStatement: string,
  diagramId: string,
  previousCLD: {
    groupHierarchy: any;
    nodes: any;
    links: any;
  },
  nodeTypes: string[],
) => {
  const prompt = getConsultantPrompt(caseDescription, problemStatement);
  const messages: any = [
    {
      role: "user",
      parts: [
        {
          text: prompt,
        },
      ],
    },
  ];

  const response = (await askGemini(messages, GEMINI_MODEL)) as {
    alternatives: any;
  };
  if (response.alternatives) {
    for (let responseToUser of response.alternatives) {
      const newMessageRef = dbCausal.collection(CONSULTANT_MESSAGES).doc();
      let fullConversation = "";

      fullConversation += `AI Consultant:\n\n ${responseToUser.response}`;
      newMessageRef.set({
        id: newMessageRef.id,
        text: responseToUser.response,
        moves: responseToUser.moves,
        createdAt: new Date(),
        root: true,
        diagramId,
        cld: true,
        loadingCld: true,
      });

      await generateDiagram({
        caseDescription,
        problemStatement,
        fullConversation,
        previousCLD,
        messageId: newMessageRef.id,
        nodeTypes,
      });
      newMessageRef.update({
        loadingCld: FieldValue.delete(),
      });
    }
  }

  /* 
  {
  "alternatives": [
    {
      "moves": ["<Move1>", "<OptionalMove2>"],
      "response": "<≤80-word instruction to the user>"
    }
  }*/
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
      ? await dbCausal
          .collection("diagramPrompts")
          .where("ideaEvaluator", "==", true)
          .where("type", "==", "generate")
          .get()
      : await dbCausal
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
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ];

    const nodeTypesDocs = await dbCausal.collection("nodeTypes").get();
    const nodeTypes = [];
    for (let nodeDoc of nodeTypesDocs.docs) {
      const nodeData = nodeDoc.data();
      nodeTypes.push(nodeData.type);
    }

    const responseCLD = (await askGemini(messages, GEMINI_MODEL)) as {
      groupHierarchy: any;
      nodes: any;
      links: any;
    };

    if (
      !responseCLD?.groupHierarchy ||
      !responseCLD?.nodes ||
      !responseCLD?.links
    ) {
      throw Error("Incomplete JSON");
    }
    const newDiagramRef = dbCausal.collection("diagrams").doc();
    const groups: any = [];
    const createGroups = (tree: any, diagramId: any) => {
      for (let group of tree) {
        const groupRef = dbCausal.collection("groups").doc();
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
    createGroups(responseCLD.groupHierarchy, newDiagramRef.id);
    for (let node of responseCLD["nodes"]) {
      const nodeRef = dbCausal.collection("nodes").doc();
      const id = nodeRef.id;
      const _groups = node.groups
        .map((c: any) => {
          return {
            id: groups.find((g: any) => g.label === c)?.id || "",
            label: groups.find((g: any) => g.label === c)?.label || "",
          };
        })
        .filter((g: { id: string; label: string }) => !!g.id);

      node.groups = _groups;
      node.originalId = node.id;
      node.id = id;
      const _node = {
        ...node,
        createdAt: new Date(),
      };

      if (!nodeTypes.includes(node.nodeType)) {
        const newTypeRef = dbCausal.collection("nodeTypes").doc();
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
    for (let link of responseCLD["links"]) {
      link.source =
        responseCLD["nodes"].find((c: any) => c.originalId === link.source)
          ?.id || "";
      link.target =
        responseCLD["nodes"].find((c: any) => c.originalId === link.target)
          ?.id || "";
      const linkRef = dbCausal.collection("links").doc();

      linkRef.set({ ...link, diagrams: [newDiagramRef.id], deleted: false });
    }
    await newDiagramRef.set({
      title: newDiagramTitle,
      id: newDiagramRef.id,
      deleted: false,
      documentDetailed,
      ...(consultant ? { problemStatement, consultant: true } : {}),
    });
    await generateTopMessage(
      documentDetailed,
      problemStatement,
      newDiagramRef.id,
      responseCLD,
      nodeTypes,
    );

    return res.status(200).json({ diagramId: newDiagramRef.id });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({
      message: e.message,
    });
  }
}
