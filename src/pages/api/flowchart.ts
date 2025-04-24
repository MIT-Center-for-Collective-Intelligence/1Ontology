import { NextApiRequest, NextApiResponse } from "next";
import { OpenAI } from "openai";
import { askGemini, openai } from "./helpers";
import { Content } from "@google/generative-ai";

import {
  ALGORITHMS,
  COPILOT_PROMPTS,
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
import { extractJSON, getDoerCreate } from " @components/lib/utils/helpers";
import {
  copilotNewNode,
  getCopilotPrompt,
  Improvement,
  MODELS_OPTIONS,
} from " @components/lib/utils/copilotPrompts";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { ChatModel } from "openai/resources/chat/chat";
import { PROPERTIES_TO_IMPROVE } from " @components/lib/CONSTANTS";

const GEMINI_MODELS = [
  "gemini-2.0-flash-exp",
  "gemini-2.0-flash-thinking-exp",
  "gemini-exp-1206",
];

type GeminiModels =
  | "gemini-2.0-flash-exp"
  | "gemini-2.0-flash-thinking-exp"
  | "gemini-exp-1206";

export const recordLogs = async (
  logs: { [key: string]: any },
  uname: string,
) => {
  try {
    if (uname === "ouhrac") return;
    const logRef = db.collection(LOGS).doc();
    const doerCreate = getDoerCreate(uname || "");
    await logRef.set({
      type: "info",
      ...logs,
      createdAt: new Date(),
      doer: uname,
      doerCreate,
    });
  } catch (error) {
    console.error(error);
  }
};

const saveLogs = (
  uname: string,
  type: "info" | "error",
  logs: { [key: string]: any },
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

let guidelines: any = null;

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  const { nodeId, user } = req.body.data;

  const { uname, claims } = user?.userData;

  try {
    if (!claims.flowChart) {
      throw new Error("Access denied!");
    }

    const nodeDoc = await db.collection(NODES).doc(nodeId).get();
    const nodeData = nodeDoc.data();
    if (!nodeData) {
      throw new Error("Node doesn't exist");
    }
    const { title } = nodeData;
    const description = nodeData.properties["description"];

    const prompt = `
    ### **Objective**

You are an expert business analyst. We will provide you with an activity, and your task is to:

1. **Analyze** the activity in detail.  
2. **Propose multiple alternative algorithms** (as many as possible) for accomplishing the activity. The algorithms should be alternative, meaning that they should define different ways to achieve the exact same goal. Each algorithm should include:
   - **Sequential steps**
   - **Parallel steps**
   - **Conditional statements** (e.g., if/else constructs)
   - **Loops** and condition-based iterations
3. For **each** proposed algorithm:
   - Construct a **performance prediction formula** that can be used to estimate its efficiency or effectiveness.  
   - Provide a brief **advantages** section describing the reasons this algorithm might be preferable.  
   - Provide a brief **disadvantages** section describing the potential drawbacks or trade-offs of using this algorithm compared to the other alternatives.

### **Requirements for the Response**

Your response must be a **JSON object** with the following structure:

json
{
  "algorithms": [
    {
      "name": "<Algorithm Name>",
      "type": "<Algorithm Type>",
      "sub_activities": [
        {
          "name": "<Step Name>",
          "id": "<Unique Step ID>",
          "type": "<Step Type>",
          "condition": "<Optional condition if this step is conditional>",
          "loop_condition": "<Optional condition if this step is a loop>",
          "sub_activities": [
            {
              "name": "<Nested Step>",
              "id": "<Nested Step ID>",
              "type": "<Nested Step Type>",
              "condition": "<Optional nested condition>",
              "loop_condition": "<Optional nested loop condition>"
            }
          ]
        }
      ],
      "performance_model": "<A string or symbolic formula representing the performance, referencing the unique ids of the sub_activities>",
      "advantages": "<A short paragraph on the benefits of using this algorithm>",
      "disadvantages": "<A short paragraph on the potential downsides of using this algorithm>"
    },
    ...
  ]
}


Where:

1. **name**  
   - A descriptive name for the algorithm (e.g., "Rapid Turnaround Strategy").  

2. **type**  
   - The type of the algorithm, relationship between the main sub-activities in the algorithm, which could be either "sequential" or "parallel".  

3. **sub_activities**  
   - A nested array of major steps that make up the algorithm.  
   - **Each step** should be an object with the following fields:
     - **name**: The name of the step (e.g., "Check-In", "Fueling").  
     - **id**: A unique step identifier (e.g., "S1", "S2") so that if a condition redirects to another step, it can be referenced unambiguously.  
     - **type**: The step type (e.g., "task", "sequential" , "parallel", "condition", "loop").  
     - **condition**: *(Optional)* If this is a conditional step (e.g., "if fuel tank is not full").  
     - **loop_condition**: *(Optional)* If this is a loop step, specify the iteration or exit condition (e.g., "while passenger groups remain").
     - **variables**: *(Optional)* If this is a loop or a conditional step, specify the list of variable names that the condition or loop depends on.
     - **sub_activities**: *(Optional)* An array of further nested steps if the step is itself composed of multiple sub-steps (particularly for type = "sequential", type = "parallel", type = "condition", or type = "loop").  

4. **performance_model**  
   - Provide a formula to calculate key metrics (time, cost, resources, etc.). You can define each variable abstractly or specifically, referencing the unique ids of the sub_activities and the variables defined for the conditions or loops.

5. **advantages**  
   - A concise paragraph on the benefits of the algorithm, compared to the alternative algorithm.

6. **disadvantages**  
   - A concise paragraph on the potential weaknesses or trade-offs of the algorithm, compared to the alternative algorithm.
### **Example**
**Input Data**:
**Activity**: "Aircraft Turnaround"

**Response**:

{
  "algorithms": [
    {
      "name": "Standard Sequential Turnaround",
      "type": "sequential",
      "sub_activities": [
        {
          "name": "Deboard Passengers",
          "id": "DeboardPassengers",
          "type": "task"
        },
        {
          "name": "Check Flight Distance",
          "id": "CheckFlightDistance",
          "type": "condition",
          "variables": ["FlightType"],
          "condition": {FlightType == "Short-haul Flight"},
          "sub_activities": [
            {
              "name": "Perform Quick Cleaning",
              "id": "PerformQuickCleaning",
              "type": "task"
            },
            {
              "name": "Skip Deep Cabin Cleaning",
              "id": "SkipDeepCabinCleaning",
              "type": "task"
            }
          ]
        },
        {
          "name": "Refuel and Offload in Parallel",
          "id": "RefuelAndOffloadInParallel",
          "type": "parallel",
          "sub_activities": [
            {
              "name": "Refuel Aircraft",
              "id": "RefuelAircraft",
              "type": "task"
            },
            {
              "name": "Offload Luggage",
              "id": "OffloadLuggage",
              "type": "task"
            }
          ]
        },
        {
          "name": "Load Cargo Repeatedly",
          "id": "LoadCargoRepeatedly",
          "type": "loop",
          "variables": ["RemainingCargoBatchesNum"],
          "loop_condition": {RemainingCargoUnitsNum != 0},
          "sub_activities": [
            {
              "name": "Load Cargo Batch",
              "id": "LoadCargoBatch",
              "type": "task"
            }
          ]
        },
        {
          "name": "Board Passengers",
          "id": "BoardPassengers",
          "type": "task"
        },
        {
          "name": "Final Safety Check",
          "id": "FinalSafetyCheck",
          "type": "task"
        }
      ],
      "performance_model": "T = t_{DeboardPassengers} + (FlightType == "Short-haul Flight" ? t_{PerformQuickCleaning} : t_{SkipDeepCabinCleaning}) + max(t_{RefuelAircraft}, t_{OffloadLuggage}) + (CargoBatchesNum * t_{LoadCargoBatch}) + t_{BoardPassengers} + t_{FinalSafetyCheck}",
      "advantages": "This approach is straightforward and less prone to mistakes, as steps are organized in a clear, mostly sequential flow with only one parallel sub-process. Ground crew coordination is relatively simple.",
      "disadvantages": "Since most steps are performed sequentially, the turnaround time can be longer. The parallelization only covers refueling and offloading, limiting potential time savings."
    },
    {
      "name": "Concurrent Multi-Task Turnaround",
      "type": "parallel",
      "sub_activities": [
        {
          "name": "Deboard and Offload in Parallel",
          "id": "DeboardAndOffloadInParallel",
          "type": "parallel",
          "sub_activities": [
            {
              "name": "Deboard Passengers",
              "id": "DeboardPassengers",
              "type": "task"
            },
            {
              "name": "Offload Luggage",
              "id": "OffloadLuggage",
              "type": "task"
            }
          ]
        },
        {
          "name": "Cabin Cleanliness Check",
          "id": "CabinCleanlinessCheck",
          "type": "condition",
          "variables": ["CabinRequiresCleaning"],
          "condition": {CabinRequiresCleaning == true},
          "sub_activities": [
            {
              "name": "Conduct Full Cabin Clean",
              "id": "ConductFullCabinClean",
              "type": "task"
            },
            {
              "name": "Skip Cleaning",
              "id": "SkipCleaning",
              "type": "task"
            }
          ]
        },
        {
          "name": "Fuel and Maintenance Sequential",
          "id": "FuelAndMaintenanceSequential",
          "type": "sequential",
          "sub_activities": [
            {
              "name": "Refuel Aircraft",
              "id": "RefuelAircraft",
              "type": "task"
            },
            {
              "name": "Perform Maintenance Checks",
              "id": "PerformMaintenanceChecks",
              "type": "task"
            }
          ]
        },
        {
          "name": "Loop Cargo Loading",
          "id": "LoopCargoLoading",
          "type": "loop",
          "variables": ["RemainingCargoBatchesNum"],
          "loop_condition": {RemainingCargoUnitsNum != 0},
          "sub_activities": [
            {
              "name": "Load Cargo Batch",
              "id": "LoadCargoBatch",
              "type": "task"
            }
          ]
        },
        {
          "name": "Board Passengers",
          "id": "BoardPassengers",
          "type": "task"
        }
      ],
      "performance_model": "T = max(t_{DeboardPassengers}, t_{OffloadLuggage}) + (CabinRequiresCleaning ? t_{ConductFullCabinClean} : 0) + (t_{RefuelAircraft} + t_{PerformMaintenanceChecks}) + (RemainingCargoBatchesNum * t_{LoadCargoBatch}) + t_{BoardPassengers}",
      "advantages": "Maximizes parallel execution of deboarding and luggage offloading, potentially reducing overall turnaround time. Allows sequential steps (fueling and maintenance) to run back-to-back while other tasks have already completed.",
      "disadvantages": "Requires more coordination and a larger ground crew to handle concurrent tasks effectively. If resources are limited or scheduling is complex, bottlenecks may shift and reduce the potential time savings."
    }
  ]
}
### **Input Data**
**Activity**: 
'''
${title}
'''
**Description**: 
'''
${description}
'''
    `;
    const messages: Array<ChatCompletionMessageParam> = [
      {
        role: "user",
        content: prompt,
      },
    ];
    const completion = await openai.chat.completions.create({
      messages,
      model: "o3",
    });
    const response = completion.choices[0].message.content;

    const isJSONObject = extractJSON(response || "");
    if (!isJSONObject.isJSON) {
      throw new Error("Incomplete JSON");
    }
    const algorithms = isJSONObject.jsonObject.algorithms;
    const algorithmRef = db.collection(ALGORITHMS).doc(nodeId);
    algorithmRef.set({
      algorithms,
      nodeId,
      createdAt: new Date(),
      uname,
      title,
      description,
    });

    return res.status(200).send({});
  } catch (error: any) {
    console.error("error", error);
    recordLogs(
      {
        type: "error",
        error: JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
        at: "flowchart",
      },
      uname,
    );
    return res.status(500).json({ error: error.message });
  }
}

export default fbAuth(handler);
