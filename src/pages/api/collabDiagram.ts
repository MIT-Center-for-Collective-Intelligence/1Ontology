import { NextApiRequest, NextApiResponse } from "next";

import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { openai } from "./helpers";
import { extractJSON } from " @components/lib/utils/helpers";

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    const { documentDetailed } = req.body;
    const prompt = `**You are an expert in systems thinking and causal loop diagrams.** You will be provided with a large text document describing a business case. Your task is to **deeply analyze** the document and generate a **causal loop diagram** in **JSON** format with the following specifications:

---

### **1. Output Format**

Your output **must** be a single JSON object with **three** top-level keys: 
1. "groupHierarchy"  
2. "nodes"  
3. "links"

It is crucial that you **do not** include any additional text, explanations, or comments outside of this JSON object.

---

#### **1.1 groupHierarchy**

- An **array** of group objects representing a **nested** or **hierarchical** grouping structure.
- Each group object should contain:
  - "label": The display name for the group (e.g., "Marketing").
  - "subgroups": An array of similar objects (each with "label", and "subgroups") if there are nested levels.

If no nested structure is apparent, you may place all groups at the top level with empty "subgroups" arrays.

---

#### **1.2 nodes**

An **array** of node objects, where each node represents a key variable or factor in the system.

Each node object must have:

- "label": A short, descriptive name for the variable (e.g., "Customer Satisfaction").  
- "groups": An array of strings, each matching one of the "label" values from "groupHierarchy" (e.g., "Marketing").  
  - If a node belongs to a subgroup, use that subgroup's "label" (e.g., "Online Marketing").  
- "nodeType": **One** of the following categories (or additional categories you see fit):  
  - **"positive outcome"**  
  - **"negative outcome"**  
  - **"process variable"**  
  - **"control variable"**  
  - **"policy"** (e.g., government or corporate policies)  
  - **"intervention"** (e.g., new programs, campaigns)  
  - **"natural event"** (e.g., weather patterns, disasters)  
  - **"social trend"** (e.g., demographic shifts, cultural changes)  
  - **"other"** (for any variables not captured by the above)  
- "isLeverage": A boolean indicating whether this node is a leverage point.  
- "leverageRationale": A string explaining **why** the node is a leverage point **if** "isLeverage" is "true"; otherwise, this field may be omitted or left empty.

---

#### **1.3 links**

An **array** of link objects, each representing a causal relationship between two nodes.

Each link object must have:

- "source": The "title" of the source node.  
- "target": The "title" of the target node.  
- "polarity": "positive" or "negative".  
  - **Positive**: an increase in the source node leads to an increase in the target (and a decrease leads to a decrease).  
  - **Negative**: an increase in the source node leads to a decrease in the target (and a decrease leads to an increase).  
- "certainty": "known" or "hypothetical".  
  - **Known**: explicitly stated or strongly implied in the document.  
  - **Hypothetical**: inferred or assumed; requires your logical reasoning.  
- "detail": A string providing evidence from the text (for "known") or your reasoning (for "hypothetical").

---

### **2. Analysis Guidelines**

1. **Determine Polarity**  
   - **Positive**: Changes in the source node move the target in the same direction.  
   - **Negative**: Changes in the source node move the target in the opposite direction.

2. **Classify Certainty**  
   - **Known**: The text explicitly states or strongly implies the relationship (include quotes or paraphrases).  
   - **Hypothetical**: The relationship is inferred (include reasoning).

3. **Handle Conflicting Evidence**  
   - If the text presents **contradictory** evidence about the same relationship, use **multiple links** with appropriate "polarity" and "certainty".  
   - Explain the conflict in each link's "detail".

4. **Multi-Step Causal Chains**  
   - Show each step (Node A → Node B → Node C) rather than skipping nodes.  
   - Only create direct links if the text explicitly states a direct relationship.

5. **Feedback Loops**  
   - Identify and represent reinforcing (R) or balancing (B) loops.  
   - Ensure the loop's overall polarity is reflected correctly via individual link polarities.

6. **Leverage Points**  
   - Mark "isLeverage = true" if a node is crucial (e.g., appears in multiple loops, exerts strong influence).  
   - Provide a **clear** "leverageRationale" if "isLeverage = true".

7. **Node Grouping & Hierarchical Structure**  
   - Identify top-level groups (e.g., Marketing, Operations, Finance, External Environment) and possible subgroups.  
   - Reflect this structure in the "groupHierarchy" top-level array.  
   - Assign each node's "groups" field to the relevant array of groups/subgroups.

8. **Node Types**  
   - Assign one of the specified categories (e.g., **"policy"**, **"natural event"**, **"social trend"**) to help clarify the nature of each node.

9. **Node Labels**  
   - Keep them **concise** but **descriptive**.  
   - Ensure uniqueness and clarity.

---

### **3. Example Output**

Below is an **illustrative** JSON structure to demonstrate the **format** and **content** expected. Field values shown are for example only; your actual output will depend on the specific business case.

{
  "groupHierarchy": [
    {
      "label": "Marketing",
      "subgroups": [
        {
          "label": "Online Marketing",
          "subgroups": []
        }
      ]
    },
    {
      "label": "Operations",
      "subgroups": []
    },
    {
      "label": "External Environment",
      "subgroups": []
    }
  ],

  "nodes": [
    {
      "label": "Customer Satisfaction",
      "groups": ["Marketing"],
      "nodeType": "positive outcome",
      "isLeverage": true,
      "leverageRationale": "A key driver that influences brand loyalty and revenue."
    },
    {
      "label": "Product Quality",
      "groups": ["Operations"],
      "nodeType": "process variable",
      "isLeverage": false
    },
    {
      "label": "New Government Regulation",
      "groups": ["External Environment"],
      "nodeType": "policy",
      "isLeverage": false
    },
    {
      "label": "Social Media Trend",
      "groups": ["Online Marketing"],
      "nodeType": "social trend",
      "isLeverage": false
    }
  ],
  "links": [
    {
      "source": "Product Quality",
      "target": "Customer Satisfaction",
      "polarity": "positive",
      "certainty": "known",
      "detail": "Survey results indicate that higher product quality increases customer satisfaction."
    },
    {
      "source": "Customer Satisfaction",
      "target": "Social Media Trend",
      "polarity": "positive",
      "certainty": "hypothetical",
      "detail": "Satisfied customers likely create positive social media buzz."
    },
    {
      "source": "New Government Regulation",
      "target": "Product Quality",
      "polarity": "negative",
      "certainty": "known",
      "detail": "\"The new regulation reduces production flexibility, which may limit quality improvements in the short term.\""
    }
  ]
}

---

### **4. Your Task**

1. **Read** the provided business case document thoroughly.  
2. **Extract** all **significant variables** and **classify** them under suitable top-level groups and potential subgroups.  
3. **Determine** the node type ("nodeType") for each variable, selecting from:
   - "positive outcome",  
   - "negative outcome",  
   - "process variable",  
   - "control variable",  
   - "policy",  
   - "intervention",  
   - "natural event",  
   - "social trend",  
   - "other".
4. **Identify** feedback loops, multi-step causal chains, and any **leverage points** (with a clear "leverageRationale").  
5. **Document** each causal relationship using **links**, specifying "polarity", "certainty", and a "detail" field.  
6. **Construct** a **hierarchical** representation of the groups in "groupHierarchy".  
7. **Output** only the JSON object (no extra commentary).

---

### **5. Final Instruction**

**Please analyze the following business case document** and produce the **JSON** that meets all the criteria above. Do not include any additional text, explanations, or comments outside of the JSON object.

**Document:**
  ${documentDetailed}`;

    const messages: Array<ChatCompletionMessageParam> = [
      {
        role: "user",
        content: prompt,
      },
    ];
    const model = "o1";
    const completion = await openai.chat.completions.create({
      messages,
      model,
    });
    console.log(completion.choices[0].message.content);
    const response: any = extractJSON(
      completion.choices[0].message.content || "",
    );
    if (!response?.groupHierarchy || !response?.nodes || !response?.links) {
      throw Error("Incomplete JSON");
    }
    return res.status(200).json({ response });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: true });
  }
}

export default handler;
