import { db } from " @components/lib/firestoreServer/admin-exp";
import { NextApiRequest, NextApiResponse } from "next";
import { openai } from "./helpers";
import { extractJSON } from " @components/lib/utils/helpers";

interface SolutionsResponse {
  description: string;
  advantages: string;
}
[];
interface DiagramGroup {
  id: string;
  label: string;
  subgroups?: DiagramGroup[];
  [key: string]: any;
}

const getPrompt = (inputJSON: any) => {
  return `You are an advanced LLM with expertise in business analysis and problem-solving. You will receive a JSON input containing:
  1) A "case" field describing a business scenario.
  2) A "problem" field summarizing the core challenge or issue to be solved.
  
  Your task:
  1) Carefully read and analyze both the case description and problem statement.
  2) Propose up to four detailed and concrete solutions to the problem.
  3) For each solution, provide:
     - A "description" of the solution.
     - The "advantages" of implementing it.
  
  Important:
  - Output your answer **exclusively** as valid JSON with the following structure (do not include any other text):
  json
  {
    "solutions": [
      {
        "description": "...",
        "advantages": "..."
      },
      {
        "description": "...",
        "advantages": "..."
      }
    ]
  }
  You may propose from one to four solutions, but no more than four.
  Ensure each solution is clearly explained and actionable.
  Example Input (JSON):
  {
    "case": "The case description goes here.",
    "problem": "The problem statement goes here."
  }
  Expected Output (JSON):
  {
    "solutions": [
      {
        "description": "Detailed description of solution 1",
        "advantages": "Detailed description of the advantages of this solution"
      },
      {
        "description": "Detailed description of solution 2",
        "advantages": "Detailed description of the advantages of this solution"
      }
    ]
  }
  When you generate your final answer, do not include the example input or any explanations—only provide the final JSON output under the "solutions" array.
  
  ## Input JSON:
  ${JSON.stringify(inputJSON, null, 2)}
  `;
};
const getPreviousDiagram = async (diagramId: string) => {
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
    const data = doc.data() as any;
    data.id = `node${index + 1}`;
    nodeLabelMap[doc.id] = data.id;
    delete data.diagrams;
    return data;
  });

  const previousGroups = groupsSnapshot.docs.map((doc) => {
    const data = doc.data() as any;
    delete data.diagrams;
    return data;
  });

  let previousLinks = linksSnapshot.docs.map((doc) => {
    const data = doc.data() as any;
    delete data.diagrams;
    data.source = nodeLabelMap[data.source];
    data.target = nodeLabelMap[data.target];
    return data;
  });
  previousLinks = previousLinks.filter((c) => c.source && c.target);
  const previousDiagram = {
    nodes: previousNodes,
    groups: previousGroups,
    links: previousLinks,
  };

  return previousDiagram;
};

const generateSolutionDiagram = async (
  solution: {
    description: string;
    advantages: string;
  },
  caseDescription: string,
  problem: string,
  llmPrompt: string,
  previousDiagram: {
    nodes: any;
    groups: any;
    links: any;
  },
  diagramId: string,
  solutionId: string,
) => {
  const messages: Array<any> = [
    {
      role: "user",
      content: `${llmPrompt}\n## Input JSON:
    {
      "case": ${caseDescription},
      "problem": ${problem},
    }`,
    },
    { role: "assistant", content: JSON.stringify(previousDiagram, null, 2) },
    {
      role: "user",
      content: `Below is the proposed solution. Please take as much time as needed to thoroughly review it and produce a revised causal loop diagram that accurately reflects this proposal.
'''
${solution}
'''
You have to give me  new diagram
`,
    },
  ];

  const completion = await openai.chat.completions.create({
    messages,
    model: "o1",
    reasoning_effort: "high",
  });

  const response = extractJSON(completion.choices[0]?.message?.content || "")
    .jsonObject as any;

  if (!response?.groupHierarchy || !response?.nodes || !response?.links) {
    throw new Error("Incomplete JSON");
  }
  const groups: DiagramGroup[] = [];
  const createGroups = (tree: any, solutionId: string) => {
    for (let group of tree) {
      const groupRef = db.collection("groups").doc();
      group.id = groupRef.id;
      groups.push({
        createdAt: new Date(),
        ...group,
        diagrams: [solutionId],
        deleted: false,
      });
      groupRef.set({ ...groups[groups.length - 1], solutionId });
      if (group.subgroups) createGroups(group.subgroups, diagramId);
    }
  };
  createGroups(response.groupHierarchy, solutionId);

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
      diagrams: [solutionId],
      deleted: false,
    });
  }

  for (let link of response.links) {
    link.source =
      response.nodes.find((c: any) => c.originalId === link.source)?.id || "";
    link.target =
      response.nodes.find((c: any) => c.originalId === link.target)?.id || "";
    const linkRef = db.collection("links").doc();
    linkRef.set({
      ...link,
      diagrams: [solutionId],
      deleted: false,
      solutionId,
    });
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    const { diagramId } = req.body;
    const diagramDoc = await db.collection("diagrams").doc(diagramId).get();

    const promptsDocs = await db
      .collection("diagramPrompts")
      .where("ideaEvaluator", "==", true)
      .where("type", "==", "generate")
      .get();
    let llmPrompt = "";
    if (promptsDocs.docs.length > 0) {
      const promptData = promptsDocs.docs[0].data();
      llmPrompt = promptData.prompt;
    }
    const diagramData = diagramDoc.data();
    if (diagramData) {
      const { documentDetailed, problemStatement } = diagramData;
      const prompt = getPrompt({
        case: documentDetailed,
        problem: problemStatement,
      });
      const messages: any = [
        {
          role: "user",
          content: prompt,
        },
      ];
      const completion = await openai.chat.completions.create({
        messages,
        model: "o1",
        reasoning_effort: "high",
      });
      const { solutions }: any = extractJSON(
        completion.choices[0]?.message?.content || "",
      ).jsonObject as SolutionsResponse;

      const previousDiagram: {
        nodes: any;
        groups: any;
        links: any;
      } = await getPreviousDiagram(diagramId);

      for (let solution of solutions) {
        const newRefSolutionRef = db.collection("diagramSolutions").doc();

        await generateSolutionDiagram(
          solution,
          documentDetailed,
          problemStatement,
          llmPrompt,
          previousDiagram,
          diagramId,
          newRefSolutionRef.id,
        );
        newRefSolutionRef.set({
          ...solution,
          createdAt: new Date(),
          diagramId,
          deleted: false,
        });
      }
      return res.status(200).json({});
    } else {
      throw new Error("Diagram not found!");
    }
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: error.message });
  }
}
