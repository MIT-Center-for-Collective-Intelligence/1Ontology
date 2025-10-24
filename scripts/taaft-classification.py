import csv
import time
import json
import requests

from openai import OpenAI

API_URL = "https://1ontology.com/api/load-sub-ontology"

# Initialize the client (make sure OPENAI_API_KEY is set as an environment variable)
client = OpenAI()

# Path to your CSV file
csv_file_path = "TAAFT_human_annotation_trial.csv"
output_file_path = "output.csv"

# Column name that contains the text prompt
prompt_column = "prompt"


def extract_object(s: str):
    """
    Extracts and parses the first valid JSON object found in a string.
    Returns the parsed Python dict, or None if not found or invalid.
    """
    if not s or "{" not in s:
        return None

    start = s.find("{")
    brace_count = 0

    for i in range(start, len(s)):
        if s[i] == "{":
            brace_count += 1
        elif s[i] == "}":
            brace_count -= 1

        if brace_count == 0:
            json_str = s[start : i + 1]
            try:
                return json.loads(json_str)
            except json.JSONDecodeError:
                return None

    return None


def send_request_to_gpt(model: str, prompt: str, reasoning_effort: str = "high"):
    try:
        start_time = time.time()

        completion = client.chat.completions.create(
            model=model,
            reasoning_effort=reasoning_effort,
            messages=[{"role": "user", "content": prompt}],
        )

        usage = getattr(completion, "usage", {})
        prompt_tokens = getattr(usage, "prompt_tokens", 0)
        completion_tokens = getattr(usage, "completion_tokens", 0)
        reasoning_tokens = (
            getattr(
                getattr(usage, "completion_tokens_details", {}), "reasoning_tokens", 0
            )
            if hasattr(usage, "completion_tokens_details")
            else 0
        )
        total_tokens = getattr(usage, "total_tokens", prompt_tokens + completion_tokens)

        # Example pricing — adjust to match your model’s actual pricing
        input_cost_per_1k = 0.00125
        output_cost_per_1k = 0.01

        input_cost = (prompt_tokens / 1000) * input_cost_per_1k
        output_cost = (
            (completion_tokens + reasoning_tokens) / 1000
        ) * output_cost_per_1k
        total_cost = input_cost + output_cost

        end_time = time.time()
        execution_time_ms = int((end_time - start_time))

        text = (
            completion.choices[0].message.content.strip() if completion.choices else ""
        )

        return {
            "responseObject": extract_object(text),
            "usedTokens": {
                "input": prompt_tokens,
                "output": completion_tokens,
                "thinking": reasoning_tokens,
                "total": total_tokens,
            },
            "cost": {
                "inputCost": f"{input_cost:.6f}",
                "outputCost": f"{output_cost:.6f}",
                "totalCost": f"{total_cost:.6f}",
                "currency": "USD",
            },
            "executionTime": execution_time_ms,
        }

    except Exception as e:
        print({"error": str(e)})
        return {
            "content": "",
            "usage": None,
            "cost": {
                "inputCost": "0",
                "outputCost": "0",
                "totalCost": "0",
                "currency": "USD",
            },
            "executionTime": 0,
        }


def get_classification_of_taaft_row(
    app_title: str, tagline: str, description: str, ontology_object: str
):

    try:
        prompt = f"""
## Role:
You are an analyst that classifies a software application according to: (a) what main substantive activity it performs or helps perform, represented as a "verb + object" phrase, (b) whether it performs the whole activity itself or helps a human perform the activity, and (c) which of the nodes in the ontology (provided as a JSON structure in the input) is the best classification for the main substantive activity. Work only with the supplied nodes and their fields; do not infer or invent nodes or properties. 

## Ontology Definition:
Each node in our ontology represents a type of action and has these properties:
- **title** (String) – a unique, concise title.
- **description** (String) – a detailed explanation of the node, its purpose, scope, and context.
- **specializations** (Array of Objects) – collections of more specific types of this node, organized along common dimensions. Each collection contains:
  - **collectionName** (String) – the dimension along which specializations vary.
  - **nodes** (Array of String) – titles of nodes that are specializations along this dimension.

## Input:
- Application Title: "{app_title}"
- Application Tagline: "{tagline}"
- Application Description: '''{description}'''
- Ontology Nodes: {ontology_object}

## Output:
Return a single JSON object only (no prose), exactly with these keys and value types:
{{
  "does_it_perform_the_activity_or_help_a_human_perform_it": "perform" or "help",
  "reasoning_for_does_it_perform_the_activity_or_help_a_human_perform_it": "Explain why you think the app performs the activity, or helps a human perform it.",
  "substantive_activity": "The single 'base-form verb + object' describing the substantive activity",
  "reasoning_substantive_activity": "Explain your reasoning for substantive_activity. If info is sparse/ambiguous, make the best-supported choice and note low confidence in 'reasoning' fields.",
  "most_appropriate_node": {{
    "title": "title of the ontology node",
    "description": "description of the ontology node"
  }},
  "most_appropriate_node_rationale": "your reasoning for choosing this ontology node"
}}

## Constraints:
- Output must be valid JSON: double quotes around all strings, no trailing commas, no extra keys or text.
- Always include one item in "substantive_activity".
- Use base verb forms plus their direct object in "substantive_activity" (e.g., "write code", "conduct research", "summarize text").
- Determine the most appropriate node from the ontology by applying the selection criteria below (coverage first, then specificity, then similarity). Choose the most specific node whose scope fully covers the common action represented by the phrase; if multiple nodes meet this, break ties by higher semantic similarity to the input phrase.

### Selection Criteria:
Use these criteria (in order):
1. **Coverage**
2. **Specificity**
3. **Similarity**
4. **Tie-breakers**

## Procedure:
1. Identify the main substantive activity ("verb + object").
2. Specify if the app performs or helps perform it.
3. Compare to each ontology node and select the best match.
4. Produce valid JSON output exactly as specified.
        """
        response = None
        total_tokens = None
        execution_time = 0
        cost = None

        while not response:
            result = send_request_to_gpt(model="gpt-5", prompt=prompt)
            response = result["responseObject"]
            total_tokens = result["usedTokens"]
            cost = result["cost"]

            required_keys = [
                "does_it_perform_the_activity_or_help_a_human_perform_it",
                "reasoning_for_does_it_perform_the_activity_or_help_a_human_perform_it",
                "substantive_activity",
                "reasoning_substantive_activity",
                "most_appropriate_node",
                "most_appropriate_node_rationale",
            ]

            if not response or not all(key in response for key in required_keys):
                print("Invalid response detected — retrying...")
                response = None

            """ total_tokens = response["totalTokens"] """
            """ cost = response["cost"] """
            most_appropriate_node = response["most_appropriate_node"]
            sa_classification = ""
            sa_classification_alone = ""
            if most_appropriate_node:
                sa_classification = f"{most_appropriate_node['title']}: \n{response['most_appropriate_node_rationale']}"
                sa_classification_alone = most_appropriate_node["title"]
            print(response)
            return {
                "MA": f"{response['does_it_perform_the_activity_or_help_a_human_perform_it']}: \n"
                f"{response['reasoning_for_does_it_perform_the_activity_or_help_a_human_perform_it']}",
                "SA": f"{response['substantive_activity']}: \n"
                f"{response['reasoning_substantive_activity']}",
                "SAClassification": sa_classification,
                "SAClassification_alone": sa_classification_alone,
                "tokens": total_tokens["total"],
                "cost": cost["totalCost"],
            }

    except Exception as e:
        print({"error": str(e)})
        return None


with open(csv_file_path, newline="", encoding="utf-8") as csvfile, open(
    output_file_path, "w", newline="", encoding="utf-8"
) as outfile:

    print("Opening CSV file and preparing output file...")
    reader = csv.DictReader(csvfile)

    sample_row = reader.__next__()

    fieldnames = [
        "Name",
        "Tagline",
        "Description",
        "MA",
        "SA",
        "SAClassification",
        "SAClassification_alone",
        "tokens",
        "cost",
    ]

    writer = csv.DictWriter(outfile, fieldnames=fieldnames)
    writer.writeheader()
    print("Header written to output CSV. Starting processing of rows...")

    csvfile.seek(0)
    reader = csv.DictReader(csvfile)

    for i, row in enumerate(reader, start=1):
        print(f"\nProcessing row {i}: {row['Name']}")
        searchQuery = f"{row['Tagline']} \n\n {row['Description']}"
        payload = {
            "searchQuery": searchQuery,  # required must be a none empty string
            "applicationName": "final-hierarchy-with-o*net",  # required must be a none empty string
            "nodeType": "activity",  # Optional — can be None or omitted
            "searchLimit": 10,  # Optional — defaults to 40 in API
        }
        headers = {
            "Content-Type": "application/json",
            "Authorization": "Bearer YOUR_API_KEY_IF_NEEDED",
        }

        print(f"Loading sub-ontology to API for '{row['Name']}'...")
        response = requests.post(API_URL, headers=headers, data=json.dumps(payload))

        try:
            data = response.json()
            print("Received response from API.")
        except json.JSONDecodeError:
            print("Response is not valid JSON. Using empty data.")
            data = {}

        ontology_object = data["ontology_object"]
        searchResults = data["topResults"]

        print("Classifying current row...")
        classification_of_taaft_row = get_classification_of_taaft_row(
            app_title=row["Name"],
            tagline=row["Tagline"],
            description=row["Description"],
            ontology_object=json.dumps(ontology_object, indent=2),
        )
        print(classification_of_taaft_row)

        if classification_of_taaft_row:
            row_to_write = {
                "Name": row["Name"],
                "Tagline": row["Tagline"],
                "Description": row["Description"],
                **classification_of_taaft_row,
            }

            writer.writerow(row_to_write)
            outfile.flush()
            print(f"Row '{row['Name']}' processed and written to output CSV.")
        else:
            print(f"Row '{row['Name']}' could not be classified. Skipping writing.")

    print("\nAll rows processed. Output CSV completed.")
