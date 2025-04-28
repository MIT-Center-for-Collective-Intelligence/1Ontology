import { askGemini } from "@components/pages/api/helpers";
import { dbCausal } from "../firestoreServer/admin";
import { GEMINI_MODEL } from "../CONSTANTS";

export const createAColor = () => {
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);

  const hexR = r.toString(16).padStart(2, "0");
  const hexG = g.toString(16).padStart(2, "0");
  const hexB = b.toString(16).padStart(2, "0");

  return `#${hexR}${hexG}${hexB}`.toLowerCase();
};

export const generateDiagram = async ({
  caseDescription,
  problemStatement,
  fullConversation,
  previousCLD,
  messageId,
  nodeTypes,
}: {
  caseDescription: string;
  problemStatement: string;
  fullConversation: string;
  previousCLD: {
    nodes: any;
    links: any;
    groupHierarchy: any;
  };
  messageId: string;
  nodeTypes: string[];
}) => {
  const superMindPrompt = getSupermindCLDPrompt({
    caseDescription,
    problemStatement,
    fullConversation,
    previousCLD,
  });
  const messages: any = [
    {
      role: "user",
      parts: [
        {
          text: superMindPrompt,
        },
      ],
    },
  ];
  const responseCLD = (await askGemini(messages, GEMINI_MODEL)) as {
    groupHierarchy: any;
    nodes: any;
    links: any;
  };
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
  createGroups(responseCLD.groupHierarchy, messageId);
  for (let node of responseCLD["nodes"]) {
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
      diagrams: [messageId],
      deleted: false,
    });
  }
  for (let link of responseCLD["links"]) {
    link.source =
      responseCLD["nodes"].find((c: any) => c.originalId === link.source)?.id ||
      "";
    link.target =
      responseCLD["nodes"].find((c: any) => c.originalId === link.target)?.id ||
      "";
    const linkRef = dbCausal.collection("links").doc();

    linkRef.set({ ...link, diagrams: [messageId], deleted: false });
  }
};

export const getSupermindCLDPrompt = ({
  caseDescription,
  problemStatement,
  fullConversation,
  previousCLD,
}: {
  caseDescription: string;
  problemStatement: string;
  fullConversation: string;
  previousCLD: {
    nodes: any;
    links: any;
    groupHierarchy: any;
  };
}) => {
  return `
  You are an expert in systems thinking and causal loop diagram (CLD) generation. You operate within an AI-powered Supermind Design consultation system. Your role is to create and iteratively update a CLD that visually represents the system being discussed, the problems being addressed, and the design process itself, based on the full context provided.
  
  ## Input
  
  You have received the following information:
  
  ### 1. **Case Description:** (The original text describing the background situation or system.)
  '''
  ${caseDescription}
  '''
  
  ### 2.  **Problem Statement:** (The original core challenge, goal, or question the consultation aims to address.)
  '''
  ${problemStatement}
  '''
  
  ### 3.  **Conversation History:** An ordered list/array of all messages exchanged between the User(s) (Consultee(s)) and the AI Consultant so far.
  '''
  ${fullConversation}
  '''
  
  ### 4.  **Previous CLD JSON:** The JSON object representing the CLD from the *immediately preceding* turn.
  '''
  ${previousCLD}
  '''
  
  ## Supermind Design Moves & Concepts (Reference Definitions)
  
  To understand the consultation context, you MUST be familiar with the following Supermind Design moves and their sub-types. The AI Consultant uses these to guide the user, and the conversation history will likely contain these terms or discussions reflecting them. You must actively look for these concepts in the conversation and represent their discussion and potential implications within the CLD structure, primarily through node labels, a dedicated tag, and hypothetical links.
  
  *   **Basic Design Moves:**
      *   **ZOOM OUT:** Stepping back, generalizing, seeing the bigger picture. (Subtypes: "Part", "Generalization")
      *   **ZOOM IN:** Breaking down problems, making ideas concrete. (Subtypes: "Parts", "Types/Ways")
      *   **ANALOGIZE:** Using analogies from potentially different domains.
  *   **Supermind Design Moves (Specific):**
      *   **GROUPIFY:** Exploring different group structures (superminds). (Subtypes: "Hierarchies", "Democracies", "Markets", "Communities", "Ecosystems")
      *   **COGNIFY:** Focusing on cognitive processes needed. (Subtypes: "Sense", "Remember", "Create", "Decide", "Learn")
      *   **TECHNIFY:** Exploring the role of technology. (Subtypes: "Tools", "Assistants", "Peers", "Managers")
  
  ## Task
  
  Your primary task is to **update** the "Previous CLD JSON" based *mainly* on the information, concepts, and discussion points presented in the **last message** of the "Conversation History". Use the "Case Description", "Problem Statement", and the *entire* "Conversation History" as essential context to understand the system's baseline, the evolution of the discussion, and the rationale behind the existing CLD structure.
  
  The goal is to produce an **updated CLD JSON object** that accurately reflects the current understanding of the system, the problem, and the ongoing Supermind Design process, explicitly incorporating Supermind concepts as discussed.
  
  ## Output Format
  
  Your output MUST be a single JSON object with three top-level keys: "groupHierarchy", "nodes", and "links". **Do not include any additional text, explanations, or comments outside of this JSON object.**
  
  ### 1. groupHierarchy
  
  -   An array of group objects for organizing nodes (nested structure).
  -   Each group object: "id" (unique string), "label" (string), "subgroups" (array), "sentences" (array of *exact verbatim sentences* from "Case Description" or specific messages in "Conversation History" supporting this group).
  -   **Update Action:** Add/modify groups based on the latest message, referencing the full context. Add supporting sentences from the relevant source text.
  
  ### 2. nodes
  
  -   An array of node objects (variables, factors, concepts, suggestions).
  -   Each node object:
      -   "id": Unique string.
      -   "label": Short, descriptive string. **Crucially, when a node represents a specific intervention, design element, or concept derived directly from a Supermind move discussed (especially in the latest message), the label MUST clearly indicate this connection.** Examples: "Intervention: Crowdsourcing Platform (Groupify)", "Proposed AI Assistant (Technify)", "Focus on Decision Process (Zoom In - Parts)", "Exploration: Market-Based Task Allocation (Groupify)".
      -   "groups": 'Array of strings (matching "groupHierarchy" labels)'.
      -   "nodeType": One of the following, describing the node's *nature or role* in the system model:
          *   "system_variable" (e.g., 'Sales Revenue', 'Customer Satisfaction')
          *   "outcome" (positive or negative end result)
          *   "process" (e.g., 'Development Cycle')
          *   "resource" / "input" (e.g., 'Budget', 'Staff')
          *   "control_variable" / "policy" / "rule" / "strategy"
          *   "intervention" / "action" / "decision" (Concrete actions/changes implemented or decided)
          *   "proposed_intervention" / "design_element" / "solution_component" (Specific ideas/components being discussed but not yet implemented)
          *   "external_factor" / "contextual_factor"
          *   "perception" / "belief" / "assumption" / "mental_model"
          *   "goal" / "objective" / "metric"
          *   "constraint" / "limitation" / "barrier"
          *   "supermind_move_suggestion" (Represents the *act* or *suggestion* of applying a move, e.g., "Suggestion: Explore Technify Options")
          *   "supermind_concept" (Abstract concepts from the methodology, e.g., 'Collective Intelligence Level')
          *   "design_question" / "information_need"
          *   "other"
      -   **"supermindCategory" (Optional String):** If the node directly represents an intervention, design element, or concept derived from a *specific* Supermind move category discussed, include this field. Use the main move name. Examples: "Groupify", "Technify", "Cognify", "ZoomIn", "ZoomOut", "Analogize". This provides an explicit tag for filtering/analysis. Omit this field if the node isn't directly tied to a specific move category.
      -   "isLeverage": Boolean (based on cumulative understanding and discussion).
      -   "leverageRationale": String explaining leverage potential.
      -   "sentences": Array of *exact verbatim sentences* from "Case Description" or specific messages in "Conversation History" supporting the node's existence or relevance in the discussion.
  -   **Update Action:** Add/modify nodes based on the latest message, referencing the full context. Use appropriate "nodeType". **Ensure labels clearly reflect Supermind connections where applicable.** Add the optional "supermindCategory" tag when a node represents a direct outcome of discussing that move category. Add supporting sentences from the relevant source text.
  
  ### 3. links
  
  -   An array of link objects (causal relationships or influences).
  -   Each link object:
      -   "source": id of source node.
      -   "target": id of target node.
      -   "polarity": "positive" or "negative".
      -   "certainty": "known" (explicitly stated/strongly implied in text) or "hypothetical" (inferred, assumed, or representing the *potential/discussed impact* of a proposed idea/move).
      -   "detail": String explaining evidence/reasoning. **Crucially, if a link represents the potential effect of a proposed Supermind-related intervention (node labeled like "Proposed AI Assistant (Technify)" or node with supermindCategory tag), this field MUST explain the *expected or discussed causal effect* based on the conversation.** Example: For a link from "Proposed AI Assistant (Technify)" to "Task Completion Speed", detail might be: "Discussed in latest message: AI assistant expected to automate routine tasks, potentially increasing completion speed."
      -   "sentences": Array of *exact verbatim sentences* from "Case Description" or specific messages in "Conversation History" supporting this link (empty for "hypothetical" unless the hypothesis *itself* is stated verbatim in the text).
  -   **Update Action:** Add/modify/remove links based on the latest message, referencing the full context. Use "hypothetical" links extensively to model the *potential effects* of discussed interventions or Supermind strategies, clearly explaining the basis in the "detail" field. Update certainty if new evidence emerges. Add supporting sentences from the relevant source text.
  
  ## Analysis Guidelines for Updating/Generating
  
  1.  **Foundation and Context:** Use the "Case Description" and "Problem Statement" as the baseline. Use the *entire* "Conversation History" to understand the evolution of ideas and the rationale behind the "Previous CLD JSON".
  2.  **Update Trigger:** The *primary driver* for changes should be the content of the **last message** in the "Conversation History".
  3.  **Integrate Supermind Design Explicitly:**
      *   **Identify Mentions:** Scan the conversation (esp. latest message) for Supermind moves/concepts.
      *   **Clear Labels:** Ensure node labels clearly state the connection when representing Supermind-derived ideas (e.g., "Platform for Community Feedback (Groupify)").
      *   **Use "supermindCategory" Tag:** Apply this optional tag to nodes representing concrete interventions/elements derived from a specific move category (e.g., the platform node above would get "supermindCategory": "Groupify").
      *   **Model Potential Effects:** Use **hypothetical links** originating from proposed interventions/design elements (especially those tagged with "supermindCategory" or having revealing labels) to show their *discussed* causal impacts. Explain the link's rationale clearly in the "detail" field, referencing the conversation.
      *   **Represent Suggestions:** Use "supermind_move_suggestion" nodes for the *act* of suggesting exploration (e.g., "Suggestion: Consider Analogies").
  4.  **Traceability is Crucial:** Ensure every "sentences" array contains *verbatim text snippets* from the correct source ("Case Description", "Problem Statement", or a specific message in "Conversation History") that justifies the element.
  5.  **Reflect Conversational Focus:** The CLD should dynamically mirror the discussion's focus.
  6.  **Certainty and Detail:** Be precise about "certainty". Use "detail" to explain reasoning, especially for "hypothetical" links and those representing the logic behind Supermind suggestions.
  7.  **Leverage Points:** Update leverage status based on cumulative insights.
  8.  **Consistency and Evolution:** Maintain consistent IDs/labels unless refined. Allow the CLD to evolve.
  9.  **Manage Complexity:** Focus on core dynamics relevant to the "Problem Statement" and current discussion.
  10. **Clarity for Users:** Aim for a CLD that helps users visualize system dynamics, design options (including Supermind strategies), potential impacts, and uncertainties, as illuminated by the latest exchange.
  
  ## Final Instruction
  
  Analyze the provided "Case Description", "Problem Statement", "Conversation History", and "Previous CLD JSON" (if available). Generate an updated CLD JSON object, focusing changes on the **last message** in the history while using all provided context. Ensure the output strictly adheres to the specified JSON format and explicitly incorporates Supermind concepts through clear node labeling, the optional "supermindCategory" tag, and appropriately detailed hypothetical links.`;
};
