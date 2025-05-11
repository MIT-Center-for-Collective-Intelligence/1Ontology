import { db } from "@components/lib/firestoreServer/admin-exp";
import { NextApiRequest, NextApiResponse } from "next";
import { openai } from "./helpers";

interface Node {
  id: string;
  label: string;
  groups: string[];
  nodeType: string;
  isLeverage: boolean;
  leverageRationale?: string;
  sentences: string[];
}

interface Group {
  id: string;
  label: string;
  subgroups: Group[];
  sentences: string[];
}

interface Link {
  source: string;
  target: string;
  polarity: string;
  certainty: string;
  detail: string;
  sentences: string[];
}

interface ReviewResponse {
  evaluation: "accept" | "reject";
  feedback: string;
}

const extractJSON = (
  text: string,
): { jsonObject: Record<string, any>; isJSON: boolean } => {
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

const getPrompt = (documentContent: string, proposedDiagram: string) => {
  const prompt = `You are an expert in systems thinking and causal loop diagrams. We have created a proposed causal loop diagram in JSON format. Your task is to review our proposed JSON object against the original instructions we followed and the underlying business case document. Then provide a single JSON response with either "accept" or "reject," and detailed constructive feedback.
  
    # Original Instructions We Followed to Create the Proposed JSON
    
    You are an expert in systems thinking and causal loop diagrams. You will be provided with a large text document describing a business case. Your task is to deeply analyze the document and generate a causal loop diagram in JSON format with the following specifications:
    
    ## Output Format
    
    Your output must be a single JSON object with three top-level keys:
    
    1. "groupHierarchy"
    2. "nodes"
    3. "links"
    
    It is crucial that you do not include any additional text, explanations, or comments outside of this JSON object.
    
    ### groupHierarchy
    
    - This is an array of group objects representing a nested or hierarchical grouping structure.
    - Each group object must contain:
      - "id": A unique identifier for the group (e.g., "group1").
      - "label": The display name for the group (e.g., "Marketing").
      - "subgroups": An array of similar objects (each with "id", "label", and "subgroups") if there are nested levels.
      - "sentences": An array of the exact sentences from the original document that support the existence or relevance of this group.
        - Include these sentences verbatim, with no length constraints.
    
    If no nested structure is apparent, you may place all groups at the top level with empty "subgroups" arrays.
    
    ### nodes
    
    - This is an array of node objects, where each node represents a key variable or factor in the system.
    
    Each node object must have:
    1. "id": A unique identifier (e.g., "node1", "node2").
    2. "label": A short, descriptive name for the variable (e.g., "Customer Satisfaction").
    3. "groups": An array of strings, each matching one of the "label" values from "groupHierarchy". 
       - If a node belongs to a subgroup, use that subgroup's "label" (e.g., "Online Marketing").
       - A node may belong to multiple groups, even if they are far apart in the hierarchy.
    4. "nodeType": Exactly one of the following categories (or additional categories you see fit):
       - "positive outcome"
       - "negative outcome"
       - "process variable"
       - "control variable"
       - "policy"
       - "intervention"
       - "natural event"
       - "social trend"
       - "other"
    5. "isLeverage": A boolean indicating whether this node is a leverage point (true or false).
    6. "leverageRationale": A string explaining why the node is a leverage point if "isLeverage" is true. 
       - If "isLeverage" is false, this field may be omitted or left empty.
    7. "sentences": An array of the exact sentences from the original document that support or illustrate the node's existence or importance.
    
    ### links
    
    - This is an array of link objects, each representing a causal relationship between two nodes.
    
    Each link object must have:
    1. "source": The "id" of the source node.
    2. "target": The "id" of the target node.
    3. "polarity": "positive" or "negative".
       - "positive" indicates an increase in the source node leads to an increase in the target (and a decrease leads to a decrease).
       - "negative" indicates an increase in the source node leads to a decrease in the target (and a decrease leads to an increase).
    4. "certainty": "known" or "hypothetical".
       - "known": The text explicitly states or strongly implies the relationship.
         - Include the supporting verbatim sentences in "sentences".
       - "hypothetical": The relationship is inferred or assumed (with logical reasoning).
         - In this case, you may not have verbatim supporting sentences, so "sentences" can be an empty array.
    5. "detail": A string providing evidence from the text (for "known") or your reasoning (for "hypothetical").
    6. "sentences": An array of the exact sentences from the original document that specifically support this link.
       - If "certainty" is "known", list all relevant verbatim sentences.
       - If "certainty" is "hypothetical", this array should be empty.
    
    ## Analysis Guidelines
    
    1. Determine Polarity
       - "positive": Changes in the source node move the target in the same direction.
       - "negative": Changes in the source node move the target in the opposite direction.
    
    2. Classify Certainty
       - "known": The text explicitly states or strongly implies the relationship. Provide relevant sentences in "sentences".
       - "hypothetical": The relationship is inferred. Provide your reasoning in "detail", and leave "sentences" empty.
    
    3. Handle Conflicting Evidence
       - If the text presents contradictory evidence about the same relationship, represent it with multiple links (same "source" and "target") with different polarities or certainties. 
       - Explain the conflict in each link's "detail" and provide relevant sentences.
    
    4. Multi-Step Causal Chains
       - Whenever the text implies A → B → C, represent it as two links: A → B and B → C.
       - Only create a direct link A → C if the text explicitly states that direct relationship.
    
    5. Feedback Loops
       - Identify feedback loops (reinforcing or balancing).
       - Represent them accurately by ensuring the correct link polarities that create a loop.
       - When labeling a node "isLeverage = true", make sure you provide a strong "leverageRationale" (e.g., the node appears in multiple loops or wields strong influence).
    
    6. Node Grouping & Hierarchical Structure
       - Identify relevant top-level groups (e.g., Marketing, Operations, Finance, External Environment) and possible subgroups (e.g., Online Marketing).
       - Build the nested structure in "groupHierarchy".
       - Assign each node to all relevant groups/subgroups by listing them in the "groups" array.
    
    7. Node Types
       - Use appropriate "nodeType" (e.g., "policy", "intervention", "natural event", "social trend") to clarify the variable's nature.
    
    8. Node Labels
       - Keep them concise, unique, and descriptive.
    
    9. Supporting Sentences
       - For each group, node, and link, list the verbatim sentences from the original text that justify its inclusion. 
       - If multiple items are supported by the same sentence(s), duplication is acceptable.
    
    10. Optimizing Decision Making
       - Structure the causal loop diagram so it highlights:
         - Critical feedback loops for strategic decisions.
         - Nodes with the highest leverage for cost savings, risk reduction, or competitive advantage.
         - Interventions or policies that could break negative cycles or reinforce beneficial ones.
       - The goal is to facilitate thorough decision-making by experts using tools from system dynamics, risk management, or similar frameworks.
    
    ## Example Output
    
    Below is a fully fleshed-out example of the expected JSON structure. The sentence texts are **illustrative** only; in your final output, you will replace them with the exact sentences from the real business case document.
    
    {
      "groupHierarchy": [
        {
          "id": "group1",
          "label": "Marketing",
          "subgroups": [
            {
              "id": "group2",
              "label": "Online Marketing",
              "subgroups": [],
              "sentences": [
                "We plan to increase our digital presence via targeted online ads.",
                "The company recognizes online marketing as a key driver for modern customer engagement."
              ]
            }
          ],
          "sentences": [
            "Our marketing efforts have been refocused to target younger demographics.",
            "Marketing budgets have significantly grown in the last quarter."
          ]
        },
        {
          "id": "group3",
          "label": "Operations",
          "subgroups": [],
          "sentences": [
            "Operations include manufacturing efficiency and supply chain management.",
            "Optimizing operations remains a core priority."
          ]
        },
        {
          "id": "group4",
          "label": "External Environment",
          "subgroups": [],
          "sentences": [
            "Unpredictable weather events have impacted logistics this year.",
            "Social trends are quickly shifting towards eco-friendly products."
          ]
        }
      ],
      "nodes": [
        {
          "id": "node1",
          "label": "Customer Satisfaction",
          "groups": ["Marketing"],
          "nodeType": "positive outcome",
          "isLeverage": true,
          "leverageRationale": "Customer Satisfaction drives multiple reinforcing loops that affect revenue and brand reputation.",
          "sentences": [
            "Numerous surveys link customer satisfaction to repeat business.",
            "Customer feedback highlights satisfaction as the key driver of loyalty."
          ]
        },
        {
          "id": "node2",
          "label": "Product Quality",
          "groups": ["Operations"],
          "nodeType": "process variable",
          "isLeverage": false,
          "sentences": [
            "Higher quality standards reduce return rates and improve customer loyalty."
          ]
        },
        {
          "id": "node3",
          "label": "Sales Revenue",
          "groups": ["Marketing", "Operations"],
          "nodeType": "positive outcome",
          "isLeverage": false,
          "sentences": [
            "Monthly revenue reports indicate a strong correlation with marketing spending.",
            "Revenue grew by 20% after improving product quality and customer satisfaction."
          ]
        },
        {
          "id": "node4",
          "label": "Online Advertising Budget",
          "groups": ["Online Marketing"],
          "nodeType": "control variable",
          "isLeverage": false,
          "sentences": [
            "A higher online advertising budget often leads to increased site traffic and conversions."
          ]
        },
        {
          "id": "node5",
          "label": "Extreme Weather Events",
          "groups": ["External Environment"],
          "nodeType": "natural event",
          "isLeverage": false,
          "sentences": [
            "Hurricanes and floods have disrupted supply chains multiple times this year."
          ]
        }
      ],
      "links": [
        {
          "source": "node2",
          "target": "node1",
          "polarity": "positive",
          "certainty": "known",
          "detail": "Consistently high product quality increases customer satisfaction.",
          "sentences": [
            "We have found that improving product quality reduces complaints and boosts overall satisfaction.",
            "Focus group data shows a clear link between quality perception and customer happiness."
          ]
        },
        {
          "source": "node1",
          "target": "node3",
          "polarity": "positive",
          "certainty": "known",
          "detail": "Satisfied customers lead to repeat purchases, increasing sales revenue.",
          "sentences": [
            "Sales data in Q2 indicates a direct correlation between high customer satisfaction and repeat sales."
          ]
        },
        {
          "source": "node3",
          "target": "node2",
          "polarity": "positive",
          "certainty": "hypothetical",
          "detail": "With more revenue, the company could allocate more resources to product quality improvements.",
          "sentences": []
        },
        {
          "source": "node4",
          "target": "node1",
          "polarity": "positive",
          "certainty": "known",
          "detail": "Increased ad spend brings more customers, potentially boosting satisfaction if expectations are met.",
          "sentences": [
            "Our digital marketing campaign brought in 30% more leads in the last quarter.",
            "Users who discover us online tend to have higher brand awareness."
          ]
        },
        {
          "source": "node5",
          "target": "node3",
          "polarity": "negative",
          "certainty": "known",
          "detail": "Severe weather events interrupt shipping and reduce sales revenue.",
          "sentences": [
            "Two weeks of flooding halted distribution channels, causing a 15% drop in revenue."
          ]
        }
      ]
    }
    
    ## Your Task
    
    1. Read the provided business case document thoroughly.  
    2. Extract all significant variables and classify them under suitable top-level groups and potential subgroups, building out the nested "groupHierarchy."  
    3. Determine "nodeType" for each variable from the categories below or add more if necessary:
       - "positive outcome"
       - "negative outcome"
       - "process variable"
       - "control variable"
       - "policy"
       - "intervention"
       - "natural event"
       - "social trend"
       - "other"
    4. Identify feedback loops, multi-step causal chains, and any leverage points ("isLeverage = true" with a "leverageRationale").  
    5. Construct the "links" array, indicating "polarity," "certainty," and a "detail" explanation.  
    6. For each group, node, and link, provide a "sentences" array containing the verbatim sentences (or bullet points/headings) from the document that support it.  
    7. Output only the JSON object described above (no additional commentary).
    
    ## Final Instruction
    
    Please analyze the following business case document and produce the JSON that meets all the criteria above, including:
    - Complete "groupHierarchy" with supporting sentences.
    - Full "nodes" and "links" sections, each with their own supporting sentences.
    - A diagram that helps optimize decision-making by highlighting important feedback loops, high-impact interventions, and leverage points.
    
    # Business Case Document
    
    Below is the full text of the business case document we analyzed to produce our causal loop diagram. Please refer to this document to verify whether we captured all relevant nodes, groups, links, and supporting sentences accurately.
    
    ${documentContent}
    
    # Our Proposed Causal Loop Diagram (JSON)
    
    Here is the JSON object we produced. It should follow all the guidelines specified in the "Original Instructions We Followed" above.
    
    ${proposedDiagram}
    
    # Instructions for Your Review
    
    You must determine if our JSON object meets the specified requirements and accurately reflects the information from the business case. In particular:
    
    1. **Format Compliance**  
       - Does the JSON strictly follow the structure required (e.g., having "groupHierarchy", "nodes", and "links" as top-level arrays)?  
       - Does each group, node, and link contain all mandatory fields (including "sentences")?  
       - For "hypothetical" links, do we leave "sentences" empty and provide reasoning in "detail"?  
       - For "known" links, do we include verbatim supporting sentences?
    
    2. **Content Accuracy**  
       - Does the diagram comprehensively capture the relevant variables, groups, relationships, and feedback loops from the document?  
       - Are any critical points, leverage nodes, or feedback loops missing or incorrectly represented?
    
    3. **Decision-Making Facilitation**  
       - Have we clearly identified feedback loops and leverage points as per the instructions (e.g., "isLeverage" and "leverageRationale")?  
       - Does the JSON seem consistent with the instructions on highlighting potential interventions, policies, or strategies?
    
    4. **Edge Cases and Consistency**  
       - Are contradictions in the document handled correctly (e.g., separate links with different polarities or certainty)?  
       - Do "sentences" arrays truly quote verbatim text from the business case document?  
       - Do we handle multiple group memberships and nested hierarchies properly?
    
    Based on your findings, please **either** accept or reject our JSON object.
    
    # Required Output Format
    
    You must respond with **only** the following JSON structure (and no extra commentary outside it):
    
    {
      "evaluation": "accept" or "reject",
      "feedback": "A detailed paragraph or more of constructive feedback explaining your decision."
    }`;
  return prompt;
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

    if (!diagramId) {
      return res
        .status(400)
        .json({ message: "Missing diagramId in request body" });
    }

    const diagramDoc = await db.collection("diagrams").doc(diagramId).get();
    const diagramData = diagramDoc.data();
    if (!diagramData) {
      return res.status(404).json({ message: "Diagram not found" });
    }
    const documentDetailed: string = diagramData.documentDetailed;

    const nodesSnapshot: any = await db
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

    const nodeLabelMap: Record<string, string> = {};

    const nodes: Node[] = nodesSnapshot.docs.map(
      (doc: any, nodeIndex: number) => {
        const data = doc.data();
        const nodeId = `node${nodeIndex + 1}`;
        nodeLabelMap[doc.id] = nodeId;
        return {
          ...data,
          id: nodeId,
          groups: data.groups.map((c: any) => c.label),
          sentences: data.sentences || [],
        };
      },
    );

    const groups: Group[] = groupsSnapshot.docs.map(
      (doc: any, groupIdx: number) => {
        const data = doc.data();
        return {
          id: `group${groupIdx + 1}`,
          label: data.label,
          subgroups: data.subgroups || [],
          sentences: data.sentences || [],
        };
      },
    );

    const links: Link[] = linksSnapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        source: nodeLabelMap[data.source],
        target: nodeLabelMap[data.target],
        polarity: data.polarity,
        certainty: data.certainty,
        detail: data.detail,
        sentences: data.sentences || [],
      };
    });

    const previousDiagram = { groupHierarchy: groups, nodes, links };

    const openAIPrompt = getPrompt(
      documentDetailed,
      JSON.stringify(previousDiagram, null, 2),
    );

    const completion = await openai.chat.completions.create({
      messages: [{ content: openAIPrompt, role: "user" }],
      model: "o3",
      reasoning_effort: "high",
    });

    const response = completion.choices[0].message.content;
    const { jsonObject } = extractJSON(response || "");

    return res.status(200).json({ review: jsonObject, openAIPrompt });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: e.message });
  }
}

