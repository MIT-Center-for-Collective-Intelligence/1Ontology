import { dbCausal } from "@components/lib/firestoreServer/admin";
import { NextApiRequest, NextApiResponse } from "next";
import { askGemini, openai } from "./helpers";
import fbAuth from "@components/middlewares/fbAuth";
import { getConsultantPrompt } from "@components/lib/utils/copilotPrompts";
import { GEMINI_MODEL } from "@components/lib/CONSTANTS";
import { generateDiagram } from "@components/lib/utils/helpersConsultant";
import { FieldValue } from "firebase-admin/firestore";
import { delay } from "@components/lib/utils/utils";
import { DIAGRAMS } from "@components/lib/firestoreClient/collections";

const deleteAllPreviousData = async (diagramId: string) => {
  const collections = ["nodes", "groups", "links"];
  for (let collection of collections) {
    const snapshot = await dbCausal
      .collection(collection)
      .where("diagrams", "array-contains", diagramId)
      .where("deleted", "==", false)
      .get();

    const batch = dbCausal.batch();
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
const CONSULTANT_MESSAGES = "consultantMessages";

const getThreadOfMessages = async (
  messageId: string,
): Promise<{ role: "user" | "model"; parts: { text: string }[] }[]> => {
  const messagesList = [];
  const messageDoc = await dbCausal
    .collection(CONSULTANT_MESSAGES)
    .doc(messageId)
    .get();
  const messageData: any = messageDoc.data();
  messagesList.push({
    role: messageData.role ?? "model",
    parts: [
      {
        text: JSON.stringify(
          {
            alternatives: [
              {
                response: messageData.text,
                moves: messageData.moves,
              },
            ],
          },
          null,
          2,
        ),
      },
    ],
  });
  const nextLevel = messageData.root
    ? []
    : await getThreadOfMessages(messageData.parentMessage);
  messagesList.push(...nextLevel);
  return messagesList;
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  try {
    const { userPrompt, diagramId, messageId, parentMessageId } = req.body;
    const messagesArray = (await getThreadOfMessages(messageId)).reverse();

    const diagramDoc = await dbCausal
      .collection("diagrams")
      .doc(diagramId)
      .get();
    if (!diagramDoc.exists) {
      throw new Error("Diagram not found");
    }

    const nodeTypesDocs = await dbCausal.collection("nodeTypes").get();
    const nodeTypes = [];
    for (let nodeDoc of nodeTypesDocs.docs) {
      const nodeData = nodeDoc.data();
      nodeTypes.push(nodeData.type);
    }
    const promptDoc = await dbCausal
      .collection("diagramPrompts")
      .where("consultant", "==", true)
      .get();

    const llmPrompt =
      promptDoc.docs.length > 0 ? promptDoc.docs[0].data()?.prompt : "";

    const diagramData: any = diagramDoc.data();
    const caseDescription = diagramData.documentDetailed;
    const problemStatement = diagramData.problemStatement;

    const prompt = getConsultantPrompt(caseDescription, problemStatement);
    messagesArray.unshift({
      role: "user",
      parts: [
        {
          text: prompt,
        },
      ],
    });
    const consultantResponse = (await askGemini(
      messagesArray,
      GEMINI_MODEL,
    )) as {
      alternatives: any;
    };
    const nodesSnapshot = await dbCausal
      .collection("nodes")
      .where("diagrams", "array-contains", diagramId)
      .where("deleted", "==", false)
      .get();
    const groupsSnapshot = await dbCausal
      .collection("groups")
      .where("diagrams", "array-contains", diagramId)
      .where("deleted", "==", false)
      .get();
    const linksSnapshot = await dbCausal
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

    const previousCLD = {
      nodes: previousNodes,
      groupHierarchy: previousGroups,
      links: previousLinks,
    };

    if (consultantResponse.alternatives.length > 0) {
      const newMessages = [];
      for (let alternative of consultantResponse.alternatives) {
        const newMessageRef = dbCausal.collection(CONSULTANT_MESSAGES).doc();

        const newMessage = {
          id: newMessageRef.id,
          text: alternative.response,
          createdAt: new Date(),
          root: false,
          diagramId,
          moves: alternative.moves,
          cld: true,
          loadingCld: true,
          parentMessage: parentMessageId,
        };
        const parentMessageRef = dbCausal
          .collection(CONSULTANT_MESSAGES)
          .doc(parentMessageId);
        parentMessageRef.update({
          loadingReply: FieldValue.delete(),
        });
        newMessages.push(newMessage);
        newMessageRef.set(newMessage);
      }
      let fullConversation = "";
      messagesArray.forEach((m) => {
        if (m.role === "model") {
          fullConversation += `AI Consultant:\n\n ${m.parts[0].text}`;
        } else {
          fullConversation += `Consultee:\n\n ${m.parts[0].text}`;
        }
      });
      for (let m of newMessages) {
        fullConversation += `AI Consultant:\n\n ${m.text}`;
        const newMessageRef = dbCausal
          .collection(CONSULTANT_MESSAGES)
          .doc(m.id);
        await generateDiagram({
          caseDescription,
          problemStatement,
          fullConversation,
          previousCLD,
          messageId: m.id,
          nodeTypes,
        });
        newMessageRef.update({
          loadingCld: FieldValue.delete(),
        });
      }
    }

    const _conversation = messagesArray.slice(1);

    let conversationContent = "";
    _conversation.map((m) => {
      conversationContent +
        `- ${m.role === "user" ? "Consultee" : "Consultant"}:\n${m.parts[0].text}`;
    });

    const messages: any = [
      {
        role: "user",
        parts: [
          {
            text: `   
        ${llmPrompt}
        ${caseDescription}
        
        ## Problem Description
        ${problemStatement}
        
        ${
          _conversation.length > 0
            ? `## Consultants' and Consultees' Conversation
        ${conversationContent}
        `
            : ""
        }
        
        ## You Previously Generated the Following Diagram
        ${JSON.stringify(previousCLD)}
        
        ## To-Do
        PLease revise the diagram and generate a new complete version of it as a JSON object based on the following message that was just posted in the consultant-consultee thread of conversation:
        ${userPrompt}
         `,
          },
        ],
      },
    ];

    const diagramRef = dbCausal.collection(DIAGRAMS).doc(diagramId);
    diagramRef.update({
      updating: true,
    });

    const response = (await askGemini(messages, GEMINI_MODEL)) as {
      links: any;
      nodes: any;
      groupHierarchy: any;
    };

    diagramRef.update({
      updating: FieldValue.delete(),
    });
    if (response.nodes.length > 0) {
      await delay(2000);
    } else {
      res.status(500).json({ response });
    }

    await deleteAllPreviousData(diagramId);

    const groups: any = [];

    const createGroups = (tree: any, diagramId: any) => {
      for (let group of tree) {
        const groupRef = dbCausal.collection("groups").doc();
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
    createGroups(response.groupHierarchy, diagramId);

    for (let node of response["nodes"]) {
      const nodeRef = dbCausal.collection("nodes").doc();
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
        const newTypeRef = dbCausal.collection("nodeTypes").doc();
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

    for (let link of response.links) {
      link.source =
        response.nodes.find((c: any) => c.originalId === link.source)?.id || "";
      link.target =
        response.nodes.find((c: any) => c.originalId === link.target)?.id || "";
      const linkRef = dbCausal.collection("links").doc();
      linkRef.set({ ...link, diagrams: [diagramId], deleted: false });
    }
    diagramRef.update({
      updating: FieldValue.delete(),
    });
    res.status(500).json({ response });
  } catch (error) {
    console.error("Error in consultant API:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export default fbAuth(handler);
