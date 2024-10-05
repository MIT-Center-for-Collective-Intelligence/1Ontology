const proposalsSchema = `
Response Structure:
'''
Please carefully generate a JSON object with the following structure:
{
   "message": "A string message that you would send to the user in response to their message. This could include your analysis, questions, or explanations regarding the requested changes.",
   "improvements" : [], // An array of improvements to existing nodes.
   "new_nodes" : [], // An array of new nodes. Note that you should not propose a new node if a node with the same title already exists in the knowledge graph.
   "guidelines": [] // The array of improvements to the detailed and minimal guidelines.
}

For the "improvements" array:
Each item should represent an object that proposes an improvement to an existing node. Please structure each object as follows:
{
   "old_title": "The current title of the node.",
   "new_title": "The improved title of the node, if there is any room for improving its title, otherwise it should be the same as the old title.",
   "nodeType": "The type of the node, which could be either 'activity', 'actor', 'object', ",
   "description": "The description of the node.",
   "specializations": [], // An array of objects, each representing a collection with the following structure: {"collection": "The title of the collection", "nodes": [An array of nodes that are specializations of the original node and are classified under this collection based on their shared characteristics. Each item in this array is a string representing the title of the specialization node.]}
   "generalizations": [], // An array of objects, each representing a collection with the following structure: {"collection": "The title of the collection", "nodes": [An array of nodes that are generalizations of the original node and are classified under this collection based on their shared characteristics. Each item in this array is a string representing the title of the generalization node.]}
   "parts": [], // An array of objects, each representing a collection with the following structure: {"collection": "The title of the collection", "nodes": [An array of nodes that are parts of the original node and are classified under this collection based on their shared characteristics. Each item in this array is a string representing the title of the part node.]}
   "isPartOf": [], // An array of objects, each representing a collection with the following structure: {"collection": "The title of the collection", "nodes": [An array of nodes that this node is a part of the original node and are classified under this collection based on their shared characteristics. Each item in this array is a string representing the title of the node that this node is a part of.]}
   // The following fields should only be included if "nodeType" is "activity":
   "actor": [], // An array of objects, each representing a collection with the following structure: {"collection": "The title of the collection", "nodes": [An array of nodes that are actors that perform the original activity node and are classified under this collection based on their shared characteristics. Each item in this array is a string representing the title of the actor node.]}
   "objects": [], // An array of objects, each representing a collection with the following structure: {"collection": "The title of the collection", "nodes": [An array of nodes that are objects that the original activity node is performed on and are classified under this collection based on their shared characteristics. Each item in this array is a string representing the title of the object node.]}
   "evaluationDimension": [], // An array of objects, each representing a collection with the following structure: {"collection": "The title of the collection", "nodes": [An array of nodes that are evaluation dimensions of the original node and are classified under this collection based on their shared characteristics. Each item in this array is a string representing the title of the evaluation dimension node.]}
   "postConditions": "The post-conditions of the activity.",
   "preConditions": "The pre-conditions of the activity.",
   "reasoning": "Your reasoning for making these improvements to the title, 'Types', 'IsTypeOf', ... of this node.",
   // The following fields should only be included if "nodeType" is "actor":
   "abilities": "The abilities of the actor.",
   "typeOfActor": "The type of actor.",
   // The following fields should only be included if "nodeType" is "group":
   "abilities": "The abilities of the actor.",
   "typeOfActor": "The type of actor.",
   "listOfIndividualsInGroup": "The list of individuals in the group.",
   "numberOfIndividualsInGroup": "The number of individuals in the group.",
   // The following fields should only be included if "nodeType" is "object":
   "size": "The size of the object.",
   "creator": "The creator of the object.",
   "creationDate": "The creation date of the object.",
   "LifeSpan": "The lifespan of the object.",
   "modifiability": "The modifiability of the object.",
   "perceivableProperties": "The perceivable properties of the object.",
   // The following fields should only be included if "nodeType" is "evaluationDimension":
   "criteriaForAcceptability": "The criteria for acceptability of the evaluation dimension.",
   "directionOfDesirability": "The direction of desirability of the evaluation dimension.",
   "evaluationType": "The evaluation type of the evaluation dimension.",
   "measurementUnits": "The measurement units of the evaluation dimension.",
   // The following fields should only be included if "nodeType" is "reward":
   "units": "The units of the reward.",
   // The following fields should only be included if "nodeType" is "incentive":
   "capabilitiesRequired": "The capabilities required for the incentive.",
   "rewardFunction": "The reward function of the incentive.",
   "evaluationDimension": [], // An array of objects, each representing a collection with the following structure: {"collection": "The title of the collection", "nodes": [An array of nodes that are evaluation dimensions of the original incentive node and are classified under this collection based on their shared characteristics. Each item in this array is a string representing the title of the evaluation dimension node.]}
   "reward": [] // An array of objects, each representing a collection with the following structure: {"collection": "The title of the collection", "nodes": [An array of nodes that are rewards of the original incentive node and are classified under this collection based on their shared characteristics. Each item in this array is a string representing the title of the reward node.]}
}

Please do not propose the creation of any new node under "specializations" or "generalizations" in an improvement object. New nodes should only be proposed under the "new_nodes" array.

For the "new_nodes" array:
Each item should represent an object proposing a new node. Please structure each object as follows:
{
   "title": "The title of the new node.",
   "description": "The description of the node.",
   "first_generalization": {}, // An object, including the node title that you would like to specify as the first generalization of this new node, and the collection in the array of specializations of this generalization, where the new node should be classified under.
   "reasoning": "Your reasoning for proposing this new node"
}

For the "guidelines" array:
Each item should represent a category as an object. Please structure each object as follows:
{
    "category": "The category of the guideline.",
    "additions": [], // Aan array of guidelines that should be added to this category.
    "removals": [], // A array of guidelines that should be removed from this category.
    "modifications": [], // An array of objects each representing a guideline that should be modified in this category. Each object should have the following structure: {"old_guideline": "The current guideline", "new_guideline": "The improved guideline"}
    "reasoning": "Your reasoning for making these changes to the guidelines in this category."
}
'''
`;

const proposerAgent = async (
  userMessage: string,
  nodesArray: any[],
  proposalsJSON: any = {},
  evaluation: string = ""
) => {
  const guidelinesSnapshot = await db.collection("guidelines").get();
  const guidelines = guidelinesSnapshot.docs
    .map((doc) => doc.data())
    .sort((a, b) => a.index - b.index);

  let prompt = `
Objective:
'''
Carefully improving and expanding the knowledge graph.
'''

User Message:
'''
${userMessage}
'''

The knowledgeGraph:
'''
${JSON.stringify(nodesArray, null, 2)}
'''

${proposalsSchema}

Guidelines:
'''
${JSON.stringify(guidelines, null, 2)}
'''
`;
  if (
    evaluation === "reject" &&
    (proposalsJSON?.improvements?.length > 0 ||
      proposalsJSON?.new_nodes?.length > 0 ||
      proposalsJSON?.guidelines?.length > 0)
  ) {
    prompt +=
      "\nYou previously generated the following proposal, but some of them got rejected with the reasoning detailed below:\n" +
      JSON.stringify(proposalsJSON, null, 2) +
      "\n\nPlease generate a new JSON object by improving upon your previous proposal.";
  }
  prompt +=
    "\n\nPlease take your time and carefully respond a well-structured JSON object.\n" +
    "For every helpful proposal, we will pay you $100 and for every unhelpful one, you'll lose $100.";

  // proposalsJSON = await callOpenAIChat([], prompt);
  // proposalsJSON = await askGemini([], prompt);
  const completion = await openai.chat.completions.create({
    model: "o1-preview",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  proposalsJSON = completion.choices[0].message.content;
  console.log(proposalsJSON);
  console.log(JSON.stringify(proposalsJSON, null, 2));
  // return { proposalsJSONString, proposalsJSON };
};

const getStructureForJSON = (data: any, nodeTitles: any) => {
  const getTitles = (properties: any) => {
    const propertyWithTitles = {};
    for (let category in properties) {
      propertyWithTitles[category] = [];
      for (let property of properties[category]) {
        propertyWithTitles[category].push(nodeTitles[property.id]);
      }
    }
    return propertyWithTitles;
  };

  const { properties } = data;
  for (let property in properties) {
    if (
      typeof properties[property] !== "string" &&
      (!(property in data.inheritance) ||
        !data.inheritance[property] ||
        !data.inheritance[property].ref)
    ) {
      properties[property] = getTitles(properties[property]);
    }
  }
  return {
    title: data.title,
    nodeType: data.nodeType,
    generalizations: getTitles(data.generalizations),
    specializations: getTitles(data.specializations),
    // parts: properties.parts,
    // isPartOf: properties.isPartOf,
    ...properties,
  };
};

const getNodesInThreeLevels = async (
  nodeData: any,
  nodes: Record<string, any>,
  nodesArray: any[],
  nodeTitles: any,
  level: number = 0
) => {
  if (level === 4) {
    return;
  }
  for (let category in nodeData.specializations) {
    const specializationArray = nodeData.specializations[category];
    for (let specializationObj of specializationArray) {
      const nodeDoc = await db
        .collection("nodes")
        .doc(specializationObj.id)
        .get();
      const nodeData1 = nodeDoc.data();
      if (!nodeData1.deleted && !(nodeData1.title in nodes)) {
        const nodeD = getStructureForJSON(nodeData1, nodeTitles);
        nodesArray.push(nodeD);
        nodes[nodeData1.title] = {
          id: nodeDoc.id,
          ...nodeD,
        };
        await getNodesInThreeLevels(
          nodeData1,
          nodes,
          nodesArray,
          nodeTitles,
          level + 1
        );
      }
    }
  }
  for (let category in nodeData.generalizations) {
    const generalizationArray = nodeData.generalizations[category];
    for (let generalizationObj of generalizationArray) {
      const nodeDoc = await db
        .collection("nodes")
        .doc(generalizationObj.id)
        .get();
      const nodeData1 = nodeDoc.data();
      if (!nodeData1.deleted && !(nodeData1.title in nodes)) {
        const nodeD = getStructureForJSON(nodeData1, nodeTitles);
        nodesArray.push(nodeD);
        nodes[nodeData1.title] = {
          id: nodeDoc.id,
          ...nodeD,
        };
        await getNodesInThreeLevels(
          nodeData1,
          nodes,
          nodesArray,
          nodeTitles,
          level + 1
        );
      }
    }
  }
};

const generateProposals = async (
  userMessage: string,
  nodeTitle: string,
  proposalsJSON: any = {},
  evaluation: string = ""
) => {
  const nodes: Record<string, any> = {};
  const nodesArray = [];
  const allNodesDocs = await db
    .collection("nodes")
    .where("deleted", "==", false)
    .get();
  const nodeTitles: any = {};
  for (let nodeDoc of allNodesDocs.docs) {
    const nodeData = nodeDoc.data();
    nodeTitles[nodeData.id] = nodeData.title;
  }
  // for (let nodeDoc of allNodesDocs.docs) {
  //   const nodeData = nodeDoc.data();
  //   let nodeD = getStructureForJSON(nodeData, nodeTitles);
  //   nodesArray.push(nodeD);
  //   nodes[nodeData.title] = {
  //     id: nodeDoc.id,
  //     ...nodeD,
  //   };
  // }

  const nodeDocs = await db
    .collection("nodes")
    .where("title", "==", nodeTitle)
    .get();
  for (let nodeDoc of nodeDocs.docs) {
    let nodeData = nodeDoc.data();
    if (!nodeData.deleted) {
      let nodeD = getStructureForJSON(nodeData, nodeTitles);
      nodesArray.push(nodeD);
      nodes[nodeData.title] = {
        id: nodeDoc.id,
        ...nodeD,
      };
      await getNodesInThreeLevels(nodeData, nodes, nodesArray, nodeTitles);
    }
  }
  console.log(nodesArray.length + " nodes retrieved.");

  if (nodesArray.length === 0) {
    console.log("No related nodes found!");
  } else {
    console.log("Related Nodes:");
    console.log(JSON.stringify(nodesArray, null, 2));
    if (evaluation) {
      await proposerAgent(userMessage, nodesArray, proposalsJSON, evaluation);
    } else {
      await proposerAgent(userMessage, nodesArray);
    }
  }
};

generateProposals(
  `Please improve our knowledge graph.`,
  'Act (or "Process")',
  {
    message:
      "Thank you for your feedback on the previous proposal. Based on your comments, I have revised the improvements to the knowledge graph accordingly. Please find below the updated proposals.",
    improvements: [
      {
        old_title: "Destroy",
        new_title: "Destroy",
        nodeType: "activity",
        description:
          "An entity that existed before no longer exists. For example, by applying black paint all over the front of an artistic painting, a vandal destroys the painting. Note: For the purpose of this example, assume that it is not feasible to restore the painting by removing the black paint.",
        specializations: [
          {
            collection: "Destroy what?",
            nodes: ["Destroy information", "Destroy physical object"],
          },
        ],
        generalizations: [
          {
            collection: "main",
            nodes: ['Act (or "Process")'],
          },
        ],
        preConditions: "The entity to be destroyed exists and is accessible.",
        postConditions:
          "The entity no longer exists or is no longer functional.",
        reasoning:
          "Corrected the 'preConditions' and 'postConditions' to accurately reflect the process of destruction, as the previous ones were related to 'Move' and unrelated to 'Destroy'. Ensured that the specializations and generalizations are structured according to the specified format.",
      },
      {
        old_title: "Change attributes",
        new_title: "Change attributes",
        nodeType: "activity",
        description:
          "An activity where an attribute or property of an existing entity is altered without creating a new entity or destroying the existing one. For example, changing the color of a car, updating the permissions of a file, or moving an object to a new location.",
        specializations: [
          {
            collection: "Change what attributes?",
            nodes: [
              "Move",
              "Change user of entity",
              "Exchange [Change owner of objects]",
            ],
          },
        ],
        generalizations: [
          {
            collection: "main",
            nodes: ["Modify"],
          },
        ],
        reasoning:
          "Updated the description of 'Change attributes' to accurately reflect its meaning and added the specializations and generalizations in the correct format.",
      },
      {
        old_title: "Combine",
        new_title: "Combine",
        nodeType: "activity",
        description:
          "An activity where two or more entities are brought together to form a single entity or group. Examples include attaching two parts together, mixing ingredients to create a mixture, or assembling components into a product.",
        specializations: [
          {
            collection: "main",
            nodes: ["Attach", "Package object", "Gather"],
          },
        ],
        generalizations: [
          {
            collection: "main",
            nodes: ["Modify"],
          },
        ],
        reasoning:
          "Replaced the placeholder description with a proper explanation of 'Combine', describing activities where entities are unified or assembled.",
      },
      {
        old_title: "Separate",
        new_title: "Separate",
        nodeType: "activity",
        description:
          "An activity where an entity is divided into two or more parts, or components are removed from a whole. Examples include detaching a part, removing unnecessary components, or dismantling an object.",
        specializations: [
          {
            collection: "main",
            nodes: [
              "Decide which parts of inputs to remove",
              "Physically remove unneeded parts",
              "Detach",
              "Remove packaging",
            ],
          },
        ],
        generalizations: [
          {
            collection: "main",
            nodes: ["Modify"],
          },
        ],
        reasoning:
          "Updated the description of 'Separate' to accurately describe the activity of dividing or disassembling entities, replacing the placeholder text.",
      },
      {
        old_title: "Modify inputs",
        new_title: "Modify inputs",
        nodeType: "activity",
        description:
          "An activity involving changes to the inputs before they are used in a process. This may include adjusting, refining, or enhancing inputs to better suit the requirements of the process or to improve the quality of the output.",
        specializations: [],
        generalizations: [
          {
            collection: "main",
            nodes: ["Modify"],
          },
        ],
        reasoning:
          "Provided an accurate description for 'Modify inputs', replacing the placeholder text that was previously there.",
      },
      {
        old_title: "Finalize output",
        new_title: "Finalize output",
        nodeType: "activity",
        description:
          "An activity where the final touches are applied to produce the completed output of a process. This may involve quality checks, polishing, packaging, or any actions that prepare the output for delivery or use.",
        specializations: [],
        generalizations: [
          {
            collection: "main",
            nodes: ["Modify"],
          },
        ],
        reasoning:
          "Updated the description of 'Finalize output' to accurately reflect its role in the process, replacing the placeholder text.",
      },
      {
        old_title: "Communicate",
        new_title: "Communicate",
        nodeType: "activity",
        description:
          "The act of transferring information from one entity to another, typically involving a sender and a receiver. Communication can occur through various channels and mediums, such as speech, writing, signals, or electronic media.",
        specializations: [],
        generalizations: [
          {
            collection: "main",
            nodes: ["Move information"],
          },
        ],
        reasoning:
          "Provided a proper description for 'Communicate', accurately defining the activity and its context.",
      },
      {
        old_title: "Move",
        new_title: "Move",
        nodeType: "activity",
        description: "Cause an object to change its physical location.",
        specializations: [
          {
            collection: "What is goal of move?",
            nodes: ["Load", "Unload"],
          },
          {
            collection: "How is object being moved?",
            nodes: ["Move self", "Carry", "Pull", "Push"],
          },
          {
            collection: "What is being moved?",
            nodes: ["Move information", "Move physical object"],
          },
        ],
        generalizations: [
          {
            collection: "main",
            nodes: ["Change attributes"],
          },
        ],
        actor: [
          {
            collection: "main",
            nodes: ["Controller", "Mover"],
          },
        ],
        preConditions:
          "The object to be moved exists and is at the origin location.",
        postConditions:
          "The object has been relocated to the destination location.",
        reasoning:
          "Added 'preConditions' and 'postConditions' to 'Move' to define the starting and ending states of the move action, and ensured that 'actor', 'specializations', and 'generalizations' are properly structured.",
      },
    ],
    new_nodes: [],
    guidelines: [
      {
        category: "Node Titles",
        additions: [],
        removals: [],
        modifications: [
          {
            old_guideline:
              "Titles should be unique, stand-alone, and self-explanatory.",
            new_guideline:
              "Ensure that every node's title is unique within the knowledge graph. Titles should be unique, stand-alone, and self-explanatory.",
          },
        ],
        reasoning:
          "Modified the guideline to emphasize the need for uniqueness in node titles to prevent redundancy and confusion, aligning with the existing guideline that stresses uniqueness.",
        evaluation: {
          result: "reject",
          reasoning: `This guideline seems obvious and could be easily inferred from the already existing guideline. It does not add any new value to the guidelines. Note that the guidelines should be concise and focused on the most critical aspects of the ontology.`,
        },
      },
    ],
  },
  "reject"
);
