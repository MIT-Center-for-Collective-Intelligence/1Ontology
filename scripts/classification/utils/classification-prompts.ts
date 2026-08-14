export const sanitizeForGeminiSafety = (text: string) =>
  String(text || "")
    .replace(/\bNSFW\b/gi, "adult-themed")
    .replace(/\berotic\b/gi, "adult-themed")
    .replace(/\buncensored\b/gi, "open-ended")
    .replace(/\bunfiltered\b/gi, "open-ended")
    .replace(/\bunrestricted\b/gi, "open-ended")
    .replace(/\bfantasies\b/gi, "fictional scenarios")
    .replace(/\bgraphic images\b/gi, "generated images");

export const getClassificationPrompt = ({
  ontologyObject,
  appTitle,
  tagline,
  description,
  hallucination,
}: {
  ontologyObject: any;
  appTitle: string;
  tagline: string;
  description: string;
  hallucination: boolean;
}) => {
  return `
    ## Role:
    You are an analyst who classifies a software application according to: (a) the main activity it performs or helps perform, represented as a "verb + object" phrase, and (b) which of the nodes in the ontology (provided as a JSON structure in the input) is the best classification for the main activity. Work only with the supplied nodes and their fields; do not infer or invent nodes or properties. 
    
    ## Ontology Definition:
    In our ontology, every node represents a work-related activity. The ontology is represented as a nested JSON structure, in which each node title is a key and its value contains that node's child titles:
    {
      “Node title”: {
        “Child node title 1”: {...},
        “Child node title 2”: {...},
        “Child node title 3”: {...}
      },
      …,
      [“job”: Optional field representing the job (occupation) title for repeated O*NET task titles only.]
    }
    
    If a node has many direct children, we group those children in collections. These collection names are also represented as keys in the JSON structure but they are always in square brackets.
    
    ## Output:
    Return a single JSON object only (no prose), with exactly these keys and value types:
    {
      "main_activity": "The single 'base-form verb + object' describing the main activity",
      "reasoning_main_activity": "Explain your reasoning for main_activity. If info is sparse or ambiguous, make the best-supported choice and note low confidence in "reasoning" fields.",
      "most_appropriate_node": "Only the exact node title of the ontology node.",
      "most_appropriate_node_parent": "Only the exact title of the selected node's direct parent. Use an empty string only if the selected node is the root node.",
      "most_appropriate_node_rationale": "your reasoning for choosing this ontology node",
      "node_validation_explanation": "The explanatory sentence returned by validate_ontology_node for the selected node title and parent title."
    }
    
    ## Constraints:
    - Output must be valid JSON: double quotes around all strings, no trailing commas, no extra keys or text.
    - Always include one item in "main_activity".
    - Use base verb forms plus their direct object in "main_activity" (e.g., "write code", "conduct research", "summarize text").
    - To classify the main activity of the application: 
    choose the most specific node whose scope fully covers the main activity. 
    - Do not choose nodes whose title starts with “(O*NET)” as the most_appropriate_node.
    
    - These examples illustrate how to apply this principle:
      1- For an app for automobile driving that plans a route to the user’s destination: 
         The most specific node whose scope fully covers this app would be something like “plan route.” This node covers all the detailed navigational decisions the app makes, but it is more specific than a node like “drive car.” 
    
      2- For a “self-driving” car app that steers the car, accelerates, brakes, etc., but still requires a human to be behind the wheel and ready to take over in unusual situations:
          The most specific node whose scope fully covers this app would be something like “drive car.” There is no other simple description that fully covers all the actions this app takes that is more specific than “drive car.”
    
      3- For an image generation app that takes a verbal description of a landscape and generates an image of a landscape based on this description:
          A node like “generate landscape image” would fully cover the scope of this activity even though in practice, a user might try many different verbal descriptions before finding one that captured what the user wanted.
      4- For a cleaning robot that can clean floors, dust furniture, and empty trash cans:
          The most specific node that covers all these kinds of cleaning might be something like “clean rooms.” But if there isn’t any node like that in the ontology, the best classification might be a node called “clean.” This node is very general, but if there is no other node that covers all three activities (clean floors, dust furniture, and empty trash cans) and is more specific than “clean,” then “clean” might be the best classification.
    
    Note that, in some cases, the above examples illustrate an app performing an entire activity. In other cases, they illustrate an app helping a human perform an activity. But in all cases, we try to choose the most specific activity that fully covers the scope of what the app does.
    
    
    ## Procedure:
    Internally follow this process:
    1. From the provided application tagline and description, identify the main activity the application performs or helps perform, represented as a "verb + object" phrase. 
    2. Internally, analyze the "verb + object" phrase and compare it to every node in the ontology. For each node, consider all its information.
    3. Select the node that best satisfies the classification principle and examples above.
    4. Before producing the final JSON, you must call validate_ontology_node with the exact selected node title and the exact selected node's direct parent title.
    5. If validate_ontology_node says the node title and parent title do not match an existing node, choose another existing ontology node and call validate_ontology_node again.
    6. Produce the output JSON exactly as specified, using the explanatory_sentence returned by validate_ontology_node as node_validation_explanation.
    ${
      hallucination
        ? "7. Double-check the selected node and make sure it already exists in our ontology. If it does not, please return to step 2 and continue."
        : ""
    }
    
    ## Input:
    ### Ontology Nodes:
    ${JSON.stringify(ontologyObject, null, 2)}
    ### Application Title:
    "${appTitle}"
    ### Application Tagline:
    "${tagline}"
    ### Application Description:
    '''${description}'''`;
};

export const getClassificationPromptPath = ({
  ontologyObject,
  appTitle,
  tagline,
  description,
  hallucination,
}: {
  ontologyObject: any;
  appTitle: string;
  tagline: string;
  description: string;
  hallucination: boolean;
}) => {
  return `
    ## Role:
    You are an analyst who classifies a software application according to: (a) the main activity it performs or helps perform, represented as a "verb + object" phrase, and (b) which of the nodes in the ontology (provided as a JSON structure in the input) is the best classification for the main activity. Work only with the supplied nodes and their fields; do not infer or invent nodes or properties. 
    
    ## Ontology Definition:
    In our ontology, every node represents a work-related activity. The ontology is represented as a nested JSON structure, in which each node title is a key and its value contains that node's child titles:
    {
      “Node title”: {
        “Child node title 1”: {...},
        “Child node title 2”: {...},
        “Child node title 3”: {...}
      },
      …,
      [“job”: Optional field representing the job (occupation) title for repeated O*NET task titles only.]
    }
    
    If a node has many direct children, we group those children in collections. These collection names are also represented as keys in the JSON structure but they are always in square brackets.
    
    ## Output:
    Return a single JSON object only (no prose), with exactly these keys and value types:
    {
      "main_activity": "The single 'base-form verb + object' describing the main activity",
      "reasoning_main_activity": "Explain your reasoning for main_activity. If info is sparse or ambiguous, make the best-supported choice and note low confidence in "reasoning" fields.",
      "most_appropriate_node": "Only the exact node title of the ontology node.",
      "most_appropriate_node_path": ["The exact root node title", "Each exact child node title in order", "The exact most_appropriate_node title"],
      "most_appropriate_node_rationale": "your reasoning for choosing this ontology node",
      "node_validation_explanation": "The explanatory sentence returned by validate_ontology_node for the selected node title and path."
    }
    
    ## Constraints:
    - Output must be valid JSON: double quotes around all strings, no trailing commas, no extra keys or text.
    - Always include one item in "main_activity".
    - Use base verb forms plus their direct object in "main_activity" (e.g., "write code", "conduct research", "summarize text").
    - To classify the main activity of the application: 
    choose the most specific node whose scope fully covers the main activity. 
    - Do not choose nodes whose title starts with “(O*NET)” as the most_appropriate_node.
    - The "most_appropriate_node_path" value must be an array of exact ontology node titles from the root node to "most_appropriate_node", inclusive. Do not include collection names in square brackets unless they are actual ontology nodes.
    
    - These examples illustrate how to apply this principle:
      1- For an app for automobile driving that plans a route to the user’s destination: 
         The most specific node whose scope fully covers this app would be something like “plan route.” This node covers all the detailed navigational decisions the app makes, but it is more specific than a node like “drive car.” 
    
      2- For a “self-driving” car app that steers the car, accelerates, brakes, etc., but still requires a human to be behind the wheel and ready to take over in unusual situations:
          The most specific node whose scope fully covers this app would be something like “drive car.” There is no other simple description that fully covers all the actions this app takes that is more specific than “drive car.”
    
      3- For an image generation app that takes a verbal description of a landscape and generates an image of a landscape based on this description:
          A node like “generate landscape image” would fully cover the scope of this activity even though in practice, a user might try many different verbal descriptions before finding one that captured what the user wanted.
      4- For a cleaning robot that can clean floors, dust furniture, and empty trash cans:
          The most specific node that covers all these kinds of cleaning might be something like “clean rooms.” But if there isn’t any node like that in the ontology, the best classification might be a node called “clean.” This node is very general, but if there is no other node that covers all three activities (clean floors, dust furniture, and empty trash cans) and is more specific than “clean,” then “clean” might be the best classification.
    
    Note that, in some cases, the above examples illustrate an app performing an entire activity. In other cases, they illustrate an app helping a human perform an activity. But in all cases, we try to choose the most specific activity that fully covers the scope of what the app does.
    
    
    ## Procedure:
    Internally follow this process:
    1. From the provided application tagline and description, identify the main activity the application performs or helps perform, represented as a "verb + object" phrase. 
    2. Internally, analyze the "verb + object" phrase and compare it to every node in the ontology. For each node, consider all its information.
    3. Select the node that best satisfies the classification principle and examples above.
    4. Trace the exact path from the root node through each parent node to the selected node.
    5. Before producing the final JSON, you must call validate_ontology_node with the exact selected node title and the exact path from the root node to the selected node.
    6. If validate_ontology_node says the node title and path do not match an existing ontology path, choose another existing ontology node path and call validate_ontology_node again.
    7. Produce the output JSON exactly as specified, using the explanatory_sentence returned by validate_ontology_node as node_validation_explanation.
    ${
      hallucination
        ? "8. Double-check the selected node and make sure it already exists in our ontology. If it does not, please return to step 2 and continue."
        : ""
    }
    
    ## Input:
    ### Ontology Nodes:
    ${JSON.stringify(ontologyObject, null, 2)}
    ### Application Title:
    "${appTitle}"
    ### Application Tagline:
    "${tagline}"
    ### Application Description:
    '''${description}'''`;
};
