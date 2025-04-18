import { db } from " @components/lib/firestoreServer/admin-exp";
import { NextApiRequest, NextApiResponse } from "next";
import { openai } from "./helpers";
import { ChatCompletionMessageParam } from "openai/resources";

const delay = (timeout: number) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(true);
    }, timeout);
  });
};

interface DiagramNode {
  id: string;
  originalId?: string;
  groups: any;
  [key: string]: any;
}

interface DiagramGroup {
  id: string;
  label: string;
  subgroups?: DiagramGroup[];
  [key: string]: any;
}

interface DiagramLink {
  source: string;
  target: string;
  [key: string]: any;
}

interface DiagramResponse {
  nodes: DiagramNode[];
  groups: DiagramGroup[];
  links: DiagramLink[];
  groupHierarchy: DiagramGroup[];
}

const extractJSON = (
  text: string,
): { jsonObject: DiagramResponse | {}; isJSON: boolean } => {
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

const deleteAllPreviousData = async (diagramId: string): Promise<void> => {
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
    const { diagramId, feedback } = req.body;

    const promptDoc = await db
      .collection("diagramPrompts")
      .doc("generate")
      .get();
    const llmPrompt = promptDoc.data()?.prompt;

    const diagramDoc = await db.collection("diagrams").doc(diagramId).get();
    const documentDetailed = diagramDoc.data()?.documentDetailed;

    const snapshots = await Promise.all([
      db
        .collection("nodes")
        .where("diagrams", "array-contains", diagramId)
        .where("deleted", "==", false)
        .get(),
      db
        .collection("groups")
        .where("diagrams", "array-contains", diagramId)
        .where("deleted", "==", false)
        .get(),
      db
        .collection("links")
        .where("diagrams", "array-contains", diagramId)
        .where("deleted", "==", false)
        .get(),
    ]);

    const [nodesSnapshot, groupsSnapshot, linksSnapshot] = snapshots;
    const nodeLabelMap: Record<string, string> = {};

    const previousNodes = nodesSnapshot.docs.map((doc, index) => {
      const data = doc.data() as DiagramNode;
      data.id = `node${index + 1}`;
      nodeLabelMap[doc.id] = data.id;
      delete data.diagrams;
      return data;
    });

    const previousGroups = groupsSnapshot.docs.map((doc) => {
      const data = doc.data() as DiagramGroup;
      delete data.diagrams;
      return data;
    });

    const previousLinks = linksSnapshot.docs.map((doc) => {
      const data = doc.data() as DiagramLink;
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

    const messages: Array<ChatCompletionMessageParam> = [
      { role: "user", content: `${llmPrompt}\n${documentDetailed}` },
      { role: "assistant", content: JSON.stringify(previousDiagram, null, 2) },
      {
        role: "user",
        content: `Based on the provided feedback, generate a new object response. Feedback: ${feedback}`,
      },
    ];

    const completion = await openai.chat.completions.create({
      messages,
      model: "o3",
      reasoning_effort: "high",
    });

    const response = extractJSON(completion.choices[0]?.message?.content || "")
      .jsonObject as DiagramResponse

    if (!response?.groupHierarchy || !response?.nodes || !response?.links) {
      throw new Error("Incomplete JSON");
    }

    await deleteAllPreviousData(diagramId);
    await delay(2000);
    const groups: DiagramGroup[] = [];

    const createGroups = (tree: DiagramGroup[], diagramId: string) => {
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
    createGroups(response.groupHierarchy, diagramId);

    for (let node of response["nodes"]) {
      const nodeRef = db.collection("nodes").doc();
      const id = nodeRef.id;
      const _groups = node.groups.map((c: any) => {
        return {
          id: groups.find((g) => g.label === c)?.id || "",
          label: groups.find((g) => g.label === c)?.label || "",
        };
      });
      node.groups = _groups;
      node.originalId = node.id;
      node.id = id;
      const _node = {
        ...node,
        createdAt: new Date(),
      };

      nodeRef.set({
        ..._node,
        diagrams: [diagramDoc.id],
        deleted: false,
      });
    }

    for (let link of response.links) {
      link.source =
        response.nodes.find((c) => c.originalId === link.source)?.id || "";
      link.target =
        response.nodes.find((c) => c.originalId === link.target)?.id || "";
      const linkRef = db.collection("links").doc();
      linkRef.set({ ...link, diagrams: [diagramId], deleted: false });
    }

    return res.status(200).json({ diagram: diagramDoc.data() });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: error.message });
  }
}
