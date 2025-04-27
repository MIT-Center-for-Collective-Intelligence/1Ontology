import { db } from "@components/lib/firestoreServer/admin-exp";
import { NextApiRequest, NextApiResponse } from "next";
import { openai } from "./helpers";

const deleteAllPreviousData = async (diagramId: string) => {
  const collections = ["nodes", "groups", "links"];
  for (let collection of collections) {
    const snapshot = await db
      .collection(collection)
      .where("diagrams", "array-contains", diagramId)
      .where("deleted", "==", false)
      .get();

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.update(doc.ref, { deleted: true }));
    await batch.commit();
  }
};
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
    const { prompt: userPrompt, diagramId, messageId } = req.body;

    const diagramDoc = await db.collection("diagrams").doc(diagramId).get();
    if (!diagramDoc.exists) {
      throw new Error("Diagram not found");
    }

    const nodeTypesDocs = await db.collection("nodeTypes").get();
    const nodeTypes = [];
    for (let nodeDoc of nodeTypesDocs.docs) {
      const nodeData = nodeDoc.data();
      nodeTypes.push(nodeData.type);
    }
    const promptDoc = await db
      .collection("diagramPrompts")
      .where("consultant", "==", true)
      .get();

    const llmPrompt =
      promptDoc.docs.length > 0 ? promptDoc.docs[0].data()?.prompt : "";

    const diagramData: any = diagramDoc.data();
    const documentDetailed = diagramData.documentDetailed;
    const problemStatement = diagramData.problemStatement;

    const nodesSnapshot = await db
      .collection("nodes")
      .where("diagrams", "array-contains", diagramId)
      .where("deleted", "==", false)
      .get();
    const groupsSnapshot = await db
      .collection("groups")
      .where("diagrams", "array-contains", diagramId)
      .where("deleted", "==", false)
      .get();
    const linksSnapshot = await db
      .collection("links")
      .where("diagrams", "array-contains", diagramId)
      .where("deleted", "==", false)
      .get();
    const nodeLabelMap: any = {};

    const previousNodes = nodesSnapshot.docs.map((doc, nodeIndex) => {
      const data = doc.data();
      data.id = `node${nodeIndex + 1}`;
      nodeLabelMap[doc.id] = `node${nodeIndex + 1}`;
      delete data.diagrams;
      return data;
    });

    const previousGroups = groupsSnapshot.docs.map((doc) => {
      const data = doc.data();
      delete data.diagrams;
      return data;
    });

    const previousLinks = linksSnapshot.docs.map((doc) => {
      const data = doc.data();
      delete data.diagrams;
      data.source = nodeLabelMap[data.source];
      data.target = nodeLabelMap[data.target];
      return data;
    });

    const previousDiagram = {
      nodes: previousNodes,
      groups: previousGroups,
      links: previousLinks,
    };

    let conversation = "";
    const conversationRef = db
      .collection("consultantConversations")
      .doc(diagramId);
    const conversationDoc = await conversationRef.get();
    const conversationData = conversationDoc.data();
    const _conversation = conversationData?.conversation || [];

    for (let m of _conversation) {
      conversation += `
${m.isConsultant ? "Systems Thinker" : m.user}: 
${m.isConsultant ? m.openAIResponse : m.message}`;
    }
    const messages: any = [
      {
        role: "user",
        content: `   
${llmPrompt}
${documentDetailed}

## Problem Description
${problemStatement}

${
  _conversation.length > 0
    ? `## Consultants' and Consultees' Conversation
${conversation}
`
    : ""
}

## You Previously Generated the Following Diagram
${JSON.stringify(previousDiagram)}

## To-Do
PLease revise the diagram and generate a new complete version of it as a JSON object based on the following message that was just posted in the consultant-consultee thread of conversation:
${userPrompt}
 `,
      },
    ];
    const model = "o3";

    const completion = await openai.chat.completions.create({
      messages,
      model,
      reasoning_effort: "high",
    });
    const response = completion.choices[0].message.content || "";

    const newMessages = [
      {
        id: db.collection("randomId").doc().id,
        sender: "user",
        text: userPrompt,
        timestamp: new Date(),
        isConsultant: false,
      },
      {
        id: db.collection("randomId").doc().id,
        sender: "consultant",
        text: "I've updated the causal diagram.",
        openAIResponse: response,
        timestamp: new Date(),
        isConsultant: true,
      },
    ];
    if (!conversationDoc.exists) {
      await conversationRef.set({
        diagramId,
        messageId,
        conversation: newMessages,
      });
    } else {
      const conversationData: any = conversationDoc.data();
      const conversation = conversationData.conversation || [];
      conversation.push(...newMessages);

      await conversationRef.update({ conversation });
    }
    await deleteAllPreviousData(diagramId);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const _response: any = extractJSON(response || "").jsonObject;
    const groups: any = [];

    const createGroups = (tree: any, diagramId: any) => {
      for (let group of tree) {
        const groupRef = db.collection("groups").doc();
        group.id = groupRef.id;
        groups.push({
          createdAt: new Date(),
          ...group,
          diagrams: [diagramId],
          deleted: false,
        });
        groupRef.set(groups[groups.length - 1]);
        if (group.subgroups) createGroups(group.subgroups, diagramId);
      }
    };
    createGroups(_response.groupHierarchy, diagramId);

    for (let node of _response["nodes"]) {
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
        diagrams: [diagramDoc.id],
        deleted: false,
      });
    }

    for (let link of _response.links) {
      link.source =
        _response.nodes.find((c: any) => c.originalId === link.source)?.id ||
        "";
      link.target =
        _response.nodes.find((c: any) => c.originalId === link.target)?.id ||
        "";
      const linkRef = db.collection("links").doc();
      linkRef.set({ ...link, diagrams: [diagramId], deleted: false });
    }

    res.status(500).json({ _response });
  } catch (error) {
    console.error("Error in consultant API:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
