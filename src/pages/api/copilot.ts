import { NextApiRequest, NextApiResponse } from "next";
import { OpenAI } from "openai";
import { askGemini } from "./helpers";
import { Content } from "@google/generative-ai";

import {
  GUIDELINES,
  LOGS,
  NODES,
} from " @components/lib/firestoreClient/collections";
import { db } from " @components/lib/firestoreServer/admin";
import {
  getNodesInThreeLevels,
  getStructureForJSON,
} from " @components/lib/utils/helpersCopilot";
import { INode } from " @components/types/INode";
import fbAuth from " @components/middlewares/fbAuth";
import { getDoerCreate, recordLogs } from " @components/lib/utils/helpers";
import {
  copilotNewNode,
  Improvement,
  PROPOSALS_SCHEMA,
} from " @components/lib/utils/copilotPrompts";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { ChatModel } from "openai/resources/chat/chat";

const saveLogs = (
  uname: string,
  type: "info" | "error",
  logs: { [key: string]: any }
) => {
  try {
    const logRef = db.collection(LOGS).doc();
    logRef.set({
      type,
      ...logs,
      createdAt: new Date(),
      doer: uname,
      doerCreate: getDoerCreate(uname),
    });
  } catch (error) {
    console.error(error);
  }
};
const openai = new OpenAI({
  apiKey: process.env.MIT_CCI_API_KEY,
  organization: process.env.MIT_CCI_API_ORG_ID,
});

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
const sendLLMRequest = async ({
  prompt,
  model = process.env.MODEL as ChatModel,
  uname,
}: {
  prompt: string;
  model: ChatModel | "Gemini 1.5 PRO";
  uname: string;
}) => {
  try {
    if (!prompt.trim() || !model.trim()) {
      throw new Error("Prompt and model are required");
    }
    if (model === "Gemini 1.5 PRO") {
      const contents: Content[] = [];

      contents.push({
        role: "user",
        parts: [
          {
            text: prompt,
          },
        ],
      });

      const response = await askGemini(contents);
      return response;
    }
    const temperature = model === "gpt-4o" ? 0 : 1;
    let isJSONObject: { jsonObject: any; isJSON: boolean } = {
      jsonObject: {},
      isJSON: false,
    };
    for (let i = 0; i < 4; i++) {
      try {
        const messages: Array<ChatCompletionMessageParam> = [
          {
            role: "user",
            content: prompt,
          },
        ];

        const completion = await openai.chat.completions.create({
          messages,
          model,
          temperature,
        });

        const response = completion.choices[0].message.content;

        isJSONObject = extractJSON(response || "");
        if (isJSONObject.isJSON) {
          break;
        }
        console.log(
          "Failed to get a complete JSON object. Retrying for the ",
          i + 1,
          " time."
        );
      } catch (error) {
        console.error("Error in generating content: ", error);
      }
    }
    if (!isJSONObject.isJSON) {
      throw new Error("Failed to get a complete JSON object");
    }
    return isJSONObject.jsonObject;
  } catch (error: any) {
    saveLogs(uname, "info", {
      type: "error",
      error: JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack,
      }),
      at: "recordLogs",
    });
  }
};
let guidelines: any = null;
const proposerAgent = async (
  userMessage: string,
  model: ChatModel | "Gemini 1.5 PRO",
  nodesArray: any[],
  uname: string,
  proposalsJSON: any = {},
  evaluation: string = ""
) => {
  try {
    console.log(guidelines, "guidelines===>");
    if (!guidelines) {
      const guidelinesSnapshot = await db.collection(GUIDELINES).get();
      guidelines = guidelinesSnapshot.docs
        .map((doc) => doc.data())
        .sort((a, b) => a.index - b.index);
    }

    let prompt = `
Objective:
'''
Carefully improving and expanding the knowledge graph.
'''

User Message:
'''
${userMessage}
'''

The knowledge Graph:
'''
${JSON.stringify(nodesArray, null, 2)}
'''

${PROPOSALS_SCHEMA}

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
    prompt +=
      "Please only generate no more than 10 improvements and 10 new nodes";

    // proposalsJSON = await callOpenAIChat([], prompt);
    // proposalsJSON = await askGemini([], prompt);

    const response: {
      improvements: Improvement[];
      new_nodes: copilotNewNode[];
    } = await sendLLMRequest({
      prompt,
      model,
      uname,
    });

    return response;
  } catch (error: any) {
    console.error(error);
    recordLogs({
      type: "error",
      error: JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack,
      }),
      at: "proposerAgent",
    });
  }
};

const getNodes = async (): Promise<Record<string, INode>> => {
  const noneDeletedNodes = await db
    .collection(NODES)
    .where("deleted", "==", false)
    .get();
  const nodes: Record<string, INode> = {};
  noneDeletedNodes.docs.forEach((doc) => {
    const data = doc.data() as INode;
    nodes[doc.id] = data;
  });
  return nodes;
};

export const generateProposals = async (
  userMessage: string,
  model: ChatModel | "Gemini 1.5 PRO",
  deepNumber: number,
  nodeId: string,
  uname: string,
  proposalsJSON: any = {},
  evaluation: string = ""
): Promise<any> => {
  const nodesArray: any = [];
  const nodes = await getNodes();
  if (!nodes[nodeId]) {
    throw new Error("Node doesn't exist");
  }
  const currentNode = nodes[nodeId];

  const currentNodeD = getStructureForJSON(currentNode, nodes);
  nodesArray.push(currentNodeD);
  const _nodesArray = getNodesInThreeLevels(
    currentNode,
    nodes,
    new Set(),
    deepNumber === 0 ? 7 : deepNumber
  );
  nodesArray.push(..._nodesArray);

  if (nodesArray.length === 0) {
    // "No related nodes found!"
  } else {
    // "Related Nodes:"
    if (evaluation) {
      return await proposerAgent(
        userMessage,
        model,
        nodesArray,
        uname,
        proposalsJSON,
        evaluation
      );
    } else {
      return await proposerAgent(userMessage, model, nodesArray, uname);
    }
  }
};

const RESPONSE = {
  message:
    "I have reviewed the knowledge graph and identified several areas for improvement and expansion. Below are my proposed improvements to existing nodes and suggestions for new nodes to enhance the knowledge graph's completeness and coherence.",
  improvements: [
    {
      title: "Manage Aircraft ",
      nodeType: "activity",
      changes: [
        {
          title: "Manage Aircraft Operations",
          reasoning:
            'The current title "Manage Aircraft " has an unnecessary space at the end and is somewhat vague. Renaming it to "Manage Aircraft Operations" provides clarity and specifies that the activity involves overseeing all aircraft-related operations.',
        },
        {
          description:
            "Coordinating and overseeing all aircraft operations, including arrivals, departures, maintenance, and ground handling services to ensure efficiency and safety.",
          reasoning:
            "The improved description is more concise and emphasizes coordination and safety in aircraft operations.",
        },
        {
          generalizations: ["Aircraft Management"],
          reasoning:
            'Adding "Aircraft Management" as a generalization places "Manage Aircraft Operations" under a broader category, improving the hierarchical structure of the knowledge graph.',
        },
      ],
    },
    {
      title: "unclassified",
      nodeType: "activity",
      changes: [
        {
          title: "General Activity",
          reasoning:
            'Renaming "unclassified" to "General Activity" provides a clearer understanding of the node\'s purpose as a placeholder for activities not yet classified.',
        },
      ],
    },
    {
      title: "Test Node",
      nodeType: "activity",
      changes: [
        {
          title: "Aircraft Maintenance Preparation",
          reasoning:
            'The current title "Test Node" is ambiguous. Renaming it to "Aircraft Maintenance Preparation" clarifies the activity\'s purpose related to preparing aircraft for maintenance procedures.',
        },
        {
          description:
            "Preparing aircraft for maintenance by documenting issues, coordinating with maintenance teams, and ensuring all safety protocols are followed.",
          reasoning:
            "Adding a detailed description helps differentiate this activity from others and provides context for its role in aircraft operations.",
        },
        {
          isPartOf: ["Manage Aircraft Operations"],
          reasoning:
            'Specifying that this activity is part of "Manage Aircraft Operations" situates it within the appropriate hierarchy in the knowledge graph.',
        },
      ],
    },
    {
      title: "Airport X",
      nodeType: "context",
      changes: [
        {
          title: "XYZ International Airport",
          reasoning:
            'Renaming "Airport X" to "XYZ International Airport" provides specificity and avoids the use of a placeholder name, enhancing clarity.',
        },
        {
          description:
            "A major international airport serving as a hub for domestic and international flights.",
          reasoning:
            "Adding a description gives context about the airport's significance and role within the aviation network.",
        },
      ],
    },
    {
      title: "Unique Actor 1",
      nodeType: "actor",
      changes: [
        {
          title: "Air Traffic Controller",
          reasoning:
            'Renaming "Unique Actor 1" to "Air Traffic Controller" specifies the actor\'s role in the aviation context, improving understanding.',
        },
        {
          description:
            "A professional responsible for coordinating aircraft movements to ensure safe distances between aircraft and efficient flow of air traffic.",
          reasoning:
            "Adding a description clarifies the responsibilities and importance of this actor within aircraft operations.",
        },
      ],
    },
    {
      title: "Node RR",
      nodeType: "activity",
      changes: [
        {
          title: "Emergency Response Coordination",
          reasoning:
            'Renaming "Node RR" to "Emergency Response Coordination" provides clarity on the node\'s purpose related to managing responses during emergencies.',
        },
        {
          description:
            "Coordinating activities and resources in response to aviation emergencies to ensure safety and effective management.",
          reasoning:
            "Adding a description helps define the scope and importance of this activity within the aviation sector.",
        },
      ],
    },
    {
      title: "Node Test 3",
      nodeType: "activity",
      changes: [
        {
          title: "Safety Inspection Procedures",
          reasoning:
            'Renaming "Node Test 3" to "Safety Inspection Procedures" clearly defines the activity\'s purpose of conducting safety inspections.',
        },
        {
          description:
            "Conducting safety inspections on aircraft and facilities to ensure compliance with aviation regulations.",
          reasoning:
            "Providing a description adds context to the activity and highlights its role in maintaining safety standards.",
        },
      ],
    },
    {
      title: "Actor",
      nodeType: "actor",
      changes: [
        {
          abilities:
            "Decision-making, action-taking, and communication skills relevant to their roles within the system.",
          reasoning:
            'Adding "abilities" provides information on the general skills required by actors, enhancing the node\'s descriptive value.',
        },
        {
          typeOfActor: "Individual, Group, or System",
          reasoning:
            'Specifying the "typeOfActor" clarifies the categories actors can belong to, improving the understanding of the node.',
        },
      ],
    },
    {
      title: "Aircraft arrives",
      nodeType: "activity",
      changes: [
        {
          actor: ["Air Traffic Controller", "Ground Crew"],
          reasoning:
            "Adding actors helps identify who is responsible for performing this activity, clarifying roles within the process.",
        },
      ],
    },
  ],
  new_nodes: [
    {
      title: "Aircraft Arrival Management",
      description:
        "Overseeing and coordinating all processes involved in the arrival of aircraft, including landing clearance, taxiing supervision, and gate assignment.",
      nodeType: "activity",
      generalizations: ["Manage Aircraft Operations"],
      parts: ["Landing Clearance", "Taxiing Supervision", "Gate Assignment"],
      actor: ["Air Traffic Controller", "Ground Crew"],
      "Objects Acted on": ["Aircraft"],
      reasoning:
        'This node specifies the activities involved in managing aircraft arrivals, filling a gap in the knowledge graph and enhancing the hierarchy under "Manage Aircraft Operations".',
    },
    {
      title: "Aircraft Departure Management",
      description:
        "Managing all processes related to the preparation and departure of aircraft, including boarding management, pushback coordination, and takeoff clearance.",
      nodeType: "activity",
      generalizations: ["Manage Aircraft Operations"],
      parts: [
        "Boarding Management",
        "Pushback Coordination",
        "Takeoff Clearance",
      ],
      actor: ["Air Traffic Controller", "Ground Crew", "Flight Crew"],
      "Objects Acted on": ["Aircraft"],
      reasoning:
        'Introducing this node complements "Aircraft Arrival Management" and completes the operational cycle within aircraft operations.',
    },
    {
      title: "Ground Crew",
      description:
        "Personnel responsible for handling various ground operations such as baggage handling, aircraft fueling, and maintenance support.",
      nodeType: "actor",
      generalizations: ["Actor"],
      abilities:
        "Expertise in ground operations, equipment handling, and adherence to safety protocols.",
      reasoning:
        'Adding "Ground Crew" provides clarity on the roles involved in ground operations and enhances the actor hierarchy.',
    },
    {
      title: "Aircraft",
      description:
        "A vehicle capable of atmospheric flight due to its lift, used for transporting passengers or cargo.",
      nodeType: "object",
      generalizations: ["Physical Object"],
      LifeSpan: "Typically 20-30 years with proper maintenance",
      modifiability:
        "Subject to upgrades and modifications per regulatory standards",
      perceivableProperties: "Model, registration number, capacity, livery",
      reasoning:
        'Including "Aircraft" as an object provides a central entity for many activities, enhancing the knowledge graph\'s structure.',
    },
    {
      title: "Air Traffic Control",
      description:
        "An organization responsible for managing the safe and orderly flow of aircraft both on the ground and in the air.",
      nodeType: "context",
      generalizations: ["Organization"],
      parts: ["Control Tower", "Approach Control", "En Route Control"],
      reasoning:
        'Adding "Air Traffic Control" as a context node places relevant actors and activities in a proper organizational context.',
    },
    {
      title: "Safety Protocol Compliance",
      description:
        "Adherence to established safety procedures and regulations in aviation operations.",
      nodeType: "evaluationDimension",
      generalizations: ["Evaluation Dimension"],
      criteriaForAcceptability:
        "100% compliance with safety protocols; no violations recorded.",
      directionOfDesirability: "Increase in compliance is desirable.",
      evaluationType: "Qualitative and Quantitative",
      measurementUnits: "Number of incidents, compliance percentage",
      reasoning:
        "Introducing this evaluation dimension allows for assessing safety in operations, which is crucial in the aviation industry.",
    },
    {
      title: "Physical Object",
      description: "An entity that occupies physical space and has mass.",
      nodeType: "object",
      generalizations: [],
      reasoning:
        'Providing a general category for physical objects under which "Aircraft" can be classified, enhancing the object hierarchy.',
    },
    {
      title: "Flight Crew",
      description:
        "The personnel responsible for operating an aircraft during flight, including pilots and cabin crew.",
      nodeType: "actor",
      generalizations: ["Actor"],
      abilities:
        "Pilot licenses, communication skills, emergency response training.",
      reasoning:
        'Adding "Flight Crew" identifies another key actor group in aircraft operations, enriching the actor category.',
    },
    {
      title: "Landing Clearance",
      description:
        "Authorization given by air traffic control for an aircraft to land on a specific runway.",
      nodeType: "activity",
      generalizations: ["Aircraft Arrival Management"],
      actor: ["Air Traffic Controller"],
      "Objects Acted on": ["Aircraft"],
      reasoning:
        'Introducing "Landing Clearance" as a part of arrival management details specific activities and adds depth to the knowledge graph.',
    },
    {
      title: "Pushback Coordination",
      description:
        "The process of coordinating the movement of an aircraft from the gate to the taxiway before departure.",
      nodeType: "activity",
      generalizations: ["Aircraft Departure Management"],
      actor: ["Ground Crew"],
      "Objects Acted on": ["Aircraft"],
      reasoning:
        "Adding this node details a specific activity within departure management, enhancing the granularity of the knowledge graph.",
    },
  ],
};

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    const { userMessage, model, deepNumber, nodeId, user } = req.body.data;
    return res.status(200).send(RESPONSE);

    if (
      !user?.userData ||
      (model !== "o1-preview" &&
        model !== "gpt-4o" &&
        model !== "Gemini 1.5 PRO")
    ) {
      throw new Error("Access forbidden");
    }

    const { uname } = user?.userData;

    console.log(" userMessage, model, deepNumber, nodeId", {
      userMessage,
      model,
      deepNumber,
      nodeId,
    });

    const response = await generateProposals(
      userMessage,
      model,
      deepNumber,
      nodeId,
      uname
    );
    saveLogs(uname, "info", {
      response,
      nodeId,
      model,
      at: "copilot",
    });

    console.log("Response: ", JSON.stringify(response, null, 2));
    return res.status(200).send(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export default fbAuth(handler);
