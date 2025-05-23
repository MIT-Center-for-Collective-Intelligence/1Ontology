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
  try {
    const { diagramId, messageId, consultantOnly } = req.body;
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

    const diagramData: any = diagramDoc.data();
    const caseDescription = diagramData.documentDetailed;
    const problemStatement = diagramData.problemStatement;
    const diagramTitle = diagramData.title;

    const prompt = getConsultantPrompt(
      caseDescription,
      problemStatement,
      diagramTitle,
    );
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
          parentMessage: messageId,
        };
        const parentMessageRef = dbCausal
          .collection(CONSULTANT_MESSAGES)
          .doc(messageId);
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
      if (!consultantOnly) {
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
            messagesArray,
          });
          newMessageRef.update({
            loadingCld: FieldValue.delete(),
          });
        }
      }
    }

    res.status(200).json({});
  } catch (error) {
    console.error("Error in consultant API:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export default fbAuth(handler);
