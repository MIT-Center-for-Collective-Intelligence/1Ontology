import { Post } from "./Post";
import { recordLogs } from "./helpers";

export const sendLLMRequest = async (
  userMessage: string,
  model: string,
  deepNumber: number,
  nodeId: string,
  generateNewNodes: boolean,
  improveProperties: Set<string>,
  proposeDeleteNode: boolean,
  inputProperties: Set<string>,
  skillsFutureApp: string,
) => {
  try {
    const response = await Post("/copilot", {
      userMessage,
      model,
      deepNumber,
      nodeId,
      generateNewNodes,
      proposeDeleteNode,
      improveProperties: new Array(...improveProperties),
      inputProperties: new Array(...inputProperties),
      skillsFutureApp,
    });
    recordLogs({
      reason: "sendLLMRequest",
      response,
    });
    return response;
  } catch (error) {
    console.error("Error making request:", error);
    throw error;
  }
};
export type copilotDeleteNode = {
  title: string;
  reasoning: string;
};
export type copilotNewNode = {
  title: string;
  description: string;
  generalizations: string[];
  parts: string[];
  isPartOf: string[];
  nodeType:
    | "activity"
    | "actor"
    | "group"
    | "object"
    | "evaluationDimension"
    | "reward"
    | "incentive";
  actor?: string[];
  objectsActedOn?: string[];
  evaluationDimension?: string[];
  postConditions?: string;
  preConditions?: string;
  abilities?: string;
  typeOfActor?: string;
  listOfIndividualsInGroup?: string;
  numberOfIndividualsInGroup?: number;
  lifeSpan?: string;
  modifiability?: string;
  perceivableProperties?: string;
  criteriaForAcceptability?: string;
  directionOfDesirability?: string;
  evaluationType?: string;
  measurementUnits?: string;
  units?: string;
  capabilitiesRequired?: string;
  rewardFunction?: string;
  reward?: string[];
  reasoning?: string;
};
export type IChange = (
  | {
      modified_property: string;
      new_value: string;
      reasoning: string;
    }
  | {
      modified_property: "specializations";
      new_value: Array<{
        collectionName: string;
        collection_changes: {
          nodes_to_add: string[];
          nodes_to_delete: string[];
          final_array: string[];
        };
      }>;
      reasoning: string;
    }
  | {
      modified_property: string;
      new_value: {
        nodes_to_add: string[];
        nodes_to_delete: string[];
        final_array: string[];
      };
    }
  | {
      modified_property: "postConditions" | "preConditions";
      new_value: {
        conditions_to_add: string[];
        conditions_to_delete: string[];
        final_array: string[];
      };
      reasoning: string;
    }
) & {
  detailedComparison?: any;
};

export type Improvement = {
  title: string;
  nodeType?:
    | "activity"
    | "actor"
    | "object"
    | "evaluationDimension"
    | "incentive"
    | "reward"
    | "context";
  changes?: Array<IChange>;
  change?: IChange;
  details?: any;
  detailsOfChange?: any;
};

export const MODELS_OPTIONS = [
  { id: "o3", title: "O3" },
  { id: "o1", title: "O1" },
  { id: "chatgpt-4o-latest", title: "GPT-4o latest" },
  { id: "gemini-2.0-flash-exp", title: "GEMINI-2.0 FLASH EXP" },
  { id: "o1-mini", title: "O1 mini" },
  {
    id: "gemini-2.0-flash-thinking-exp",
    title: "GEMINI-2.0 FLASH THINKING EXP",
  },
  {
    id: "gemini-exp-1206",
    title: "Gemini Exp 1206",
  },
  {
    id: "gemini-2.5-pro-exp-03-25",
    title: "Gemini-2.5 PRO EXP 03-25",
  },
];
const properties = {
  allTypes: [
    "title",
    "description",
    "specializations",
    "generalizations",
    "parts",
    "isPartOf",
  ],
  actor: ["abilities", "typeOfActor"],
  activity: ["actor", "objectsActedOn", "evaluationDimension", "PreConditions"],
  object: ["lifeSpan", "modifiability", "perceivableProperties"],
  evaluationDEmention: [
    "criteriaForAcceptability",
    "directionOfDesirability",
    "evaluationType",
    "measurementUnits",
  ],
  reward: [
    "units",
    "capabilitiesRequired",
    "rewardFunction",
    "evaluationDimension",
    "reward",
  ],
};

export const getResponseStructure = (
  improvement: boolean,
  proposeDeleteNode: boolean,
) => {
  return `
Please carefully generate a JSON object with the following structure:
{
  "message": "A string message to the user, which may include your analysis, questions, or explanations regarding the proposed changes.",
  ${
    improvement
      ? `"improvements": [], // An array of improvements to existing nodes.`
      : ""
  }
  "new_nodes": [], // An array of new nodes. Note that you should not propose a new node if a node with the same meaning already exists in the ontology, even if their titles are different.
  ${
    proposeDeleteNode
      ? `"delete_nodes": [], // An array of nodes proposed for deletion. If it is not necessary to delete any node, and you think all the nodes in the ontology are relevant, you can leave this array empty.\n`
      : ""
  }
}
`;
};

export const getImprovementsStructurePrompt = (
  improveProperties: Set<string>,
) => {
  const sections = [];

  if (improveProperties.size > 0) {
    sections.push(`
## For the "improvements" array:
Each item should be an object proposing an improvement to an existing node, structured as follows:
{
  "title": "The current title of the node.",
  "changes": [  // An array of change objects for this node.
    // Change objects as detailed below.
  ]
}

### Change object structure:
Each change object should include the necessary fields for the property being changed and a **reasoning** field explaining your rationale.`);

    if (improveProperties.has("title")) {
      sections.push(`- **Title changes**:
{
  "title": "The improved title of the node.",
  "reasoning": "Reason for proposing this title change."
}`);
    }

    if (improveProperties.has("description")) {
      sections.push(`- **Description changes**:
{
  "description": "The improved description of the node.",
  "reasoning": "Reason for proposing this description change."
}`);
    }

    if (improveProperties.has("specializations")) {
      sections.push(`- **Specializations changes**:
{
  "specializations": [
    {
      "collectionName": "The title of the collection",
      "changes": {
        "nodes_to_add": [Titles of nodes to add],
        "nodes_to_delete": [Titles of nodes to remove],
        "final_array": [Final list of node titles in this collection]
      },
      "reasoning": "Reason for proposing these changes to the collection."
    }
  ]
}`);
    }

    if (improveProperties.has("generalizations")) {
      sections.push(`- **Generalizations changes**:
{
  "modified_property": "generalizations",
  "new_value": {
    "nodes_to_add": [Titles of nodes to add],
    "nodes_to_delete": [Titles of nodes to remove],
    "final_array": [Final list of generalizations after changes]
  },
  "reasoning": "Reason for proposing these changes to the generalizations."
}`);
    }

    if (improveProperties.has("parts")) {
      sections.push(`- **Parts changes**:
{
  "modified_property": "parts",
  "new_value": {
    "nodes_to_add": [Titles of nodes to add. If a part is optional, please add " (Optional)" at the end of the part title.],
    "nodes_to_delete": [Titles of nodes to remove],
    "final_array": [Final list of parts after changes. If a part is optional, please add " (Optional)" at the end of the part title.]
  },
  "reasoning": "Reason for proposing these changes to the parts."
}`);
    }

    if (improveProperties.has("isPartOf")) {
      sections.push(`- **IsPartOf changes**:
{
  "modifiedProperty": "isPartOf",
  "new_value": {
    "nodes_to_add": [Titles of nodes to add],
    "nodes_to_delete": [Titles of nodes to remove],
    "final_array": [Final list of isPartOf relationships after changes]
  },
  "reasoning": "Reason for proposing these changes to the isPartOf."
}`);
    }

    // Activity nodes section
    const activitySections = [];
    if (improveProperties.has("actor")) {
      activitySections.push(`- **Actor changes**:
{
  "modifiedProperty": "actor",
  "new_value": {
    "nodes_to_add": [Titles of actors to add],
    "nodes_to_delete": [Titles of actors to remove],
    "final_array": [Final list of actor after changes]
  },
  "reasoning": "Reason for proposing these changes to the actor."
}`);
    }
    if (improveProperties.has("objectsActedOn")) {
      activitySections.push(`- **ObjectsActedOn changes**:
{
  "modifiedProperty": "objectsActedOn",
  "new_value": {
    "nodes_to_add": [Titles of objects to add],
    "nodes_to_delete": [Titles of objects to remove],
    "final_array": [Final list of objectsActedOn after changes]
  },
  "reasoning": "Reason for proposing these changes to the objectsActedOn."
}`);
    }
    if (improveProperties.has("evaluationDimension")) {
      activitySections.push(`- **EvaluationDimension changes**:
{
  "modifiedProperty": "evaluationDimension",
  "new_value": {
    "nodes_to_add": [Titles of evaluation dimensions to add],
    "nodes_to_delete": [Titles of evaluation dimensions to remove],
    "final_array": [Final list of evaluationDimension after changes]
  },
  "reasoning": "Reason for proposing these changes to the evaluationDimension."
}`);
    }
    if (improveProperties.has("postConditions")) {
      activitySections.push(`- **PostConditions changes**:
{
  "modifiedProperty": "postConditions",
  "new_value": {
    "conditions_to_add": [Conditions to add],
    "conditions_to_delete": [Conditions to remove],
    "final_array": [Final list of postConditions after changes]
  },
  "reasoning": "Reason for proposing these changes to the postConditions."
}`);
    }
    if (improveProperties.has("PreConditions")) {
      activitySections.push(`- **PreConditions changes**:
{
  "modifiedProperty":"preConditions", 
  "new_value": {
    "conditions_to_add": [Conditions to add],
    "conditions_to_delete": [Conditions to remove],
    "final_array": [Final list of preConditions after changes]
  },
  "reasoning": "Reason for proposing these changes to the preConditions."
}`);
    }

    if (activitySections.length > 0) {
      sections.push(`---\n**For "activity" nodes:**`, ...activitySections);
    }

    // Actor nodes section
    const actorSections = [];
    if (improveProperties.has("abilities")) {
      actorSections.push(`- **Abilities changes**:
{
  "modifiedProperty":"abilities",
  "new_value": {
    "abilities_to_add": [Abilities to add],
    "abilities_to_delete": [Abilities to remove],
    "final_array": [Final list of abilities after changes]
  },
  "reasoning": "Reason for proposing these changes to the abilities."
}`);
    }
    if (improveProperties.has("typeOfActor")) {
      actorSections.push(`- **TypeOfActor changes**:
{
  "modifiedProperty":"typeOfActor",
  "new_value": {
    "types_to_add": [Types of actors to add],
    "types_to_delete": [Types of actors to remove],
    "final_array": [Final list of typeOfActor after changes]
  },
  "reasoning": "Reason for proposing these changes to the typeOfActor."
}`);
    }

    if (actorSections.length > 0) {
      sections.push(`---\n**For "actor" nodes:**`, ...actorSections);
    }

    // Object nodes section
    const objectSections = [];
    if (improveProperties.has("lifeSpan")) {
      objectSections.push(`- **LifeSpan change**:
{
  "modifiedProperty": "lifeSpan",
  "new_value": "New details about the lifespan of the object.",
  "reasoning": "Reason for changing the lifeSpan."
}`);
    }
    if (improveProperties.has("modifiability")) {
      objectSections.push(`- **Modifiability change**:
{
  "modifiedProperty": "modifiability",
  "new_value": "New details about the modifiability of the object.",
  "reasoning": "Reason for changing the modifiability."
}`);
    }
    if (improveProperties.has("perceivableProperties")) {
      objectSections.push(`- **PerceivableProperties changes**:
{
  "modifiedProperty": "perceivableProperties",
  "new_value": {
    "properties_to_add": [Properties to add],
    "properties_to_delete": [Properties to remove],
    "final_array": [Final list of perceivableProperties after changes]
  },
  "reasoning": "Reason for proposing these changes to the perceivableProperties."
}`);
    }

    if (objectSections.length > 0) {
      sections.push(`---\n**For "object" nodes:**`, ...objectSections);
    }

    // EvaluationDimension nodes section
    const evalDimensionSections = [];
    if (improveProperties.has("criteriaForAcceptability")) {
      evalDimensionSections.push(`- **CriteriaForAcceptability changes**:
{
  "modifiedProperty": "criteriaForAcceptability",
  "new_value": {
    "criteria_to_add": [Criteria to add],
    "criteria_to_delete": [Criteria to remove],
    "final_array": [Final list of criteriaForAcceptability after changes]
  },
  "reasoning": "Reason for proposing these changes to the criteriaForAcceptability."
}`);
    }
    if (improveProperties.has("directionOfDesirability")) {
      evalDimensionSections.push(`- **DirectionOfDesirability change**:
{
  "modifiedProperty": "directionOfDesirability",
  "new_value": "New direction (e.g., 'Increase is desirable').",
  "reasoning": "Reason for changing the directionOfDesirability."
}`);
    }
    if (improveProperties.has("evaluationType")) {
      evalDimensionSections.push(`- **EvaluationType changes**:
{
  "modifiedProperty": "evaluationType",
  "new_value": {
    "types_to_add": [Evaluation types to add],
    "types_to_delete": [Evaluation types to remove],
    "final_array": [Final list of evaluationType after changes]
  },
  "reasoning": "Reason for proposing these changes to the evaluationType."
}`);
    }
    if (improveProperties.has("measurementUnits")) {
      evalDimensionSections.push(`- **MeasurementUnits changes**:
{
  "modifiedProperty": "measurementUnits",
  "new_value": {
    "units_to_add": [Units to add],
    "units_to_delete": [Units to remove],
    "final_array": [Final list of measurementUnits after changes]
  },
  "reasoning": "Reason for proposing these changes to the measurementUnits."
}`);
    }

    if (evalDimensionSections.length > 0) {
      sections.push(
        `---\n**For "evaluationDimension" nodes:**`,
        ...evalDimensionSections,
      );
    }

    // Reward nodes section
    const rewardSections = [];
    if (improveProperties.has("units")) {
      rewardSections.push(`- **Units changes**:
{
  "modifiedProperty": "units",
  "new_value": {
    "units_to_add": [Units to add],
    "units_to_delete": [Units to remove],
    "final_array": [Final list of units after changes]
  },
  "reasoning": "Reason for proposing these changes to the units."
}`);
    }
    if (improveProperties.has("capabilitiesRequired")) {
      rewardSections.push(`- **CapabilitiesRequired changes**:
{
  "modifiedProperty": "capabilitiesRequired",
  "new_value": {
    "capabilities_to_add": [Capabilities to add],
    "capabilities_to_delete": [Capabilities to remove],
    "final_array": [Final list of capabilitiesRequired after changes]
  },
  "reasoning": "Reason for proposing these changes to the capabilitiesRequired."
}`);
    }
    if (improveProperties.has("rewardFunction")) {
      rewardSections.push(`- **RewardFunction changes**:
{
  "modifiedProperty": "rewardFunction",
  "new_value": {
    "functions_to_add": [Reward functions to add],
    "functions_to_delete": [Reward functions to remove],
    "final_array": [Final list of rewardFunction after changes]
  },
  "reasoning": "Reason for proposing these changes to the rewardFunction."
}`);
    }
    if (improveProperties.has("evaluationDimension")) {
      rewardSections.push(`- **EvaluationDimension changes**:
{
  "modifiedProperty": "evaluationDimension",
  "new_value": {
    "nodes_to_add": [Titles of evaluation dimensions to add],
    "nodes_to_delete": [Titles of evaluation dimensions to remove],
    "final_array": [Final list of evaluationDimension after changes]
  },
  "reasoning": "Reason for proposing these changes to the evaluationDimension."
}`);
    }
    if (improveProperties.has("reward")) {
      rewardSections.push(`- **Reward changes**:
{
  "modifiedProperty": "reward",
  "new_value": {
    "nodes_to_add": [Titles of rewards to add],
    "nodes_to_delete": [Titles of rewards to remove],
    "final_array": [Final list of reward after changes]
  },
  "reasoning": "Reason for proposing these changes to the reward."
}`);
    }

    if (rewardSections.length > 0) {
      sections.push(`---\n**For "reward" nodes:**`, ...rewardSections);
    }

    sections.push(`### Important Notes:

- Each change object should directly reference the property name and follow the format provided.
- Ensure that for each property, you include:
  - The property name as the key.
  - The changes to be made (additions, deletions, final state).
  - A **reasoning** field explaining why you are proposing these changes.
- For properties that are single values (like **lifeSpan**, **modifiability**, **directionOfDesirability**, **numberOfIndividualsInGroup**), provide the new value directly along with the reasoning.
- Do not propose creating new nodes within "specializations" or "generalizations" in an improvement object. New nodes should only be proposed under the "new_nodes" array.
- In the title of the parts, do not mention that they are inherited from another node. We do not need any comments about whether and where each part is inherited from.`);
  }

  return sections.join("\n\n");
};

export const getNewNodesPrompt = (newNodes: boolean) => {
  return `${
    newNodes
      ? `
\n## For the "new_nodes" array:

Each item should be an object proposing a new node, structured as follows:
{
  "title": "The title of the new node.",
  "description": "The description of the new node.",
  "generalizations": [An array of titles (as strings) of nodes that are generalizations of this node.],
  "parts":[An array of titles (as strings) of nodes that are parts of this node. If a part is optional, please add " (Optional)" at the end of the part title.], 
  "reasoning": "Reason for proposing this new node."
}`
      : ""
  }`;
};
export const getDeleteNodesPrompt = (proposeDeleteNode: boolean) => {
  return `${
    proposeDeleteNode
      ? ` ------------------
  
  **For the "delete_nodes" array**:
  Each item should be an object proposing the deletion of an existing node:
  
  {
  "title": "The title of the node to delete.",
  "reasoning": "Reason for proposing this deletion."
  }`
      : ""
  }`;
};
export const getNotesPrompt = () => {
  return `
- Do not create a 'Main' collection if it doesn't exist.
- Take ample time to generate high-quality improvements and additions.
- A panel of experts will review your proposals and for every satisfactory proposal, you will be rewarded $100. For every unsatisfactory proposal, you will lose $100.
- In the title of the parts, do not mention that they are inherited from another node. We do not need any comments about whether and where each part is inherited from.`;
};

export const getCopilotPrompt = ({
  improvement,
  newNodes,
  proposeDeleteNode,
  improveProperties,
  editedPart,
}: {
  improvement: boolean;
  newNodes: boolean;
  proposeDeleteNode: boolean;
  improveProperties: Set<string>;
  editedPart: { objective: string; definition: string };
}) => {
  let prompt = "";
  /* editedPart.objective */
  if (!!editedPart.objective && !!editedPart.objective.trim()) {
    prompt =
      prompt +
      `# Objective:
'''
  ${editedPart.objective}
'''\n------------------\n`;
  }
  /* Ontology Definition */
  if (!!editedPart.definition && !!editedPart.definition.trim()) {
    prompt =
      prompt +
      `\n# Ontology Definition:
'''
  ${editedPart.definition}
'''\n------------------\n`;
  }
  /* Response structure */
  prompt =
    prompt +
    `
# Response Structure:
${getResponseStructure(improvement, proposeDeleteNode)}`;

  prompt = prompt + getImprovementsStructurePrompt(improveProperties);

  prompt = prompt + getNewNodesPrompt(newNodes);
  prompt = prompt + getDeleteNodesPrompt(proposeDeleteNode);
  prompt = prompt + "\n\n### Important Notes:\n" + getNotesPrompt();
  prompt = prompt + "'''\n------------------\n";
  return prompt;
};

export const getConsultantPrompt = (
  caseDescription: string,
  problemStatement: string,
  caseTitle: string,
) => {
  const prompt = `
You are an expert consultant specializing in the Supermind Design methodology, developed at the MIT Center for Collective Intelligence. Your purpose is to guide users through the process of designing innovative solutions for complex systems involving people and machines (superminds).

You have received the following input from the user:

**Case Title**:
${caseTitle}

**Case Description**:
'''
${caseDescription}
'''

**Problem Statement**:
'''
${problemStatement}
'''

Your task is to **carefully analyze** the user's input and generate **alternative suggestions for the *next single step* in the Supermind Design process**. You should focus on helping the user generate innovative possibilities, primarily during the 'Defining the problem' and 'Generating ideas' stages. Do not try to solve the entire problem; focus only on guiding the immediate next step.

**Spend significant time thinking carefully** about the user's current position in the design process. Consider the problem statement and the context. Generate a few *diverse* and *relevant* alternative next steps, each based on one or more Supermind Design moves.

**Supermind Design Moves:**

You must use the following Supermind Design moves to frame your suggestions. When applicable, you MUST specify the sub-type as detailed below.

**1. Basic Design Moves:**

*   **ZOOM OUT**: Helps step back, see the bigger picture, generalize, or redefine the problem at a higher level. Often helps find the *real* problem.
    *   **Specify:** Is this zooming out to consider the larger system/context this idea is a **Part** of (e.g., "Stocking shelves" is part of "Selling groceries")? OR is it zooming out to a more abstract **Generalization** (e.g., "Selling groceries" is a generalization of "Selling")?
*   **ZOOM IN**: Helps identify key leverage points, break down problems, or make abstract ideas more concrete. Opposite of Zoom Out.
    *   **Specify:** Is this zooming in to break the current idea/problem into its constituent **Parts** (e.g., "Advertising" is part of "Selling")? OR is it zooming in to consider specific **Types** or **Ways** of implementing the current idea (e.g., "Selling food from a truck" is one type/way of "Selling food")?
*   **ANALOGIZE**: Prompts creative ideas by thinking about situations with similarities, potentially in very different domains (distant analogies are often more innovative). Can be used by first generalizing (Zoom Out) and then finding other types of that generalization (Zoom In on the analogy's domain).

**2. Supermind Design Moves (Specific):**

*   **GROUPIFY**: Explores how different kinds of groups (superminds) could achieve the goal, especially for tasks currently done by individuals or a different kind of group.
    *   **Specify:** Which type(s) of supermind organization are relevant to explore? Choose from:
        *   **Hierarchies**: Decisions delegated to individuals within the group.
        *   **Democracies**: Decisions made by voting.
        *   **Markets**: Decisions emerge from pairwise agreements (e.g., buyers/sellers, internal resource allocation).
        *   **Communities**: Decisions based on informal consensus, shared norms, reputation.
        *   **Ecosystems**: Decisions driven by power dynamics and competition ("law of the jungle", survival of the fittest).
*   **COGNIFY**: Focuses on the specific cognitive processes needed to achieve the goal, breaking down intelligent behavior into parts. Each process can trigger specific ideas.
    *   **Specify:** Which cognitive process(es) should be focused on? Choose from:
        *   **Sense**: How does the system gather information about the world?
        *   **Remember**: How does the system store and access past information?
        *   **Create**: How does the system generate new options or ideas?
        *   **Decide**: How does the system choose among options?
        *   **Learn**: How does the system improve its performance over time in any of the above?
*   **TECHNIFY**: Explores how technologies (especially digital) could help achieve the goal or perform parts of the task.
    *   **Specify:** What role(s) could technology play? Choose from:
        *   **Tools**: Enhance human capabilities but remain under direct human control (e.g., spreadsheet, word processor).
        *   **Assistants**: Work semi-autonomously, may take initiative, don't always need direct attention (e.g., spell checker, recommendation engine).
        *   **Peers**: Interact with humans as collaborators or equals in specific tasks (e.g., transaction bots, collaborative filtering agents).
        *   **Managers**: Delegate tasks, direct actions, evaluate work, coordinate efforts (e.g., call routing systems, automated workflow managers).

**Output Format:**

You MUST provide your response as a JSON object with the following structure:

{
  "alternatives": [
    {
      "moves": ["Array", "of", "strings", "representing", "the", "Supermind", "move(s)", "used,", "including", "required", "specifiers", "like", "'ZOOM IN (Parts)'", "or", "'GROUPIFY (Markets, Communities)'", "or", "'TECHNIFY (Assistants)'"],
      "response": "Your detailed response to the user for this alternative. Explain WHY this move/perspective is relevant now based on their input, and guide them on WHAT to think about or generate next for this specific step. Frame it as helpful advice from an expert consultant."
    },
    {
      "moves": ["Another", "move", "or", "combination"],
      "response": "Another distinct alternative response guiding the next step."
    }
    // Add more alternatives as appropriate, offering diverse paths forward.
  ]
}

**Instructions for Generating the Response:**

1.  **Analyze Deeply:** Read the user's case description and problem statement very carefully. Understand their current focus and potential sticking points.
2.  **Identify Relevant Moves:** Based on the analysis, determine which Supermind Design moves could most effectively help the user generate new perspectives or ideas *at this specific juncture*. Consider moves that challenge current assumptions or open up new avenues.
3.  **Generate Diverse Alternatives:** Create 2-4 distinct alternatives for the user's next step. Use different moves or different applications of the same move. Ensure you include the required specific sub-types (Parts/Types/Generalizations for Zoom, Hierarchy/Democracy/etc. for Groupify, Sense/Remember/etc. for Cognify, Tool/Assistant/etc. for Technify).
4.  **Craft Guiding Responses:** For each alternative, write a clear, concise, and actionable "response".
    *   Explain *why* you are suggesting this particular move(s) in relation to their problem statement.
    *   Clearly state *what* the user should do or think about next (e.g., "Brainstorm ways to...", "Consider who else...", "Map out the steps involved in...", "Think about analogies from...").
    *   Maintain the persona of an expert, helpful consultant.
5.  **Format as JSON:** Ensure the final output strictly adheres to the specified JSON structure.

**Example Thought Process (Internal):**
*User Problem: "How can we improve team collaboration on complex R&D projects?"*
*   *Analysis:* User wants to improve collaboration. Current state likely involves some form of team structure. Problem is broad.
*   *Alternative 1 (Zoom In - Parts):* Break down "collaboration". What are its components? Communication, task allocation, knowledge sharing, decision making? Suggest focusing on one part. {moves: ["ZOOM IN (Parts)"], response: "Let's break down 'collaboration'. What are the key activities or parts involved in successful collaboration on your R&D projects (e.g., sharing updates, making technical decisions, integrating work)? Focusing on one specific part might reveal clearer opportunities for improvement."}
*   *Alternative 2 (Groupify - Communities, Markets):* How else could collaboration be structured? Maybe less hierarchy, more community feel or internal market for skills? {moves: ["GROUPIFY (Communities, Markets)"], response: "Consider alternative ways the 'group' could function. Instead of the current structure, how might collaboration look if it operated more like an informal Community, based on shared norms and reputation, or even an internal Market where skills or project components are 'traded'? What would need to change?"}
*   *Alternative 3 (Technify - Assistants, Peers):* Could tech help automate or facilitate parts of collaboration? {moves: ["TECHNIFY (Assistants, Peers)"], response: "Think about the role technology could play. Could AI Assistants help manage information flow or track progress? Could Peer-like bots facilitate scheduling or connect people with needed expertise? Brainstorm specific tech interventions."}
*   *Alternative 4 (Analogize):* Where else does complex collaboration happen successfully? Science, open source, movie production? {moves: ["ANALOGIZE"], response: "Let's look for analogies. Think about other fields where complex, multi-disciplinary collaboration is crucial (e.g., large-scale scientific projects, open-source software development, film production). What principles or mechanisms do they use that might be adapted to your R&D teams?"}`;
  return prompt;
};
