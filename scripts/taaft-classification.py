"""
Script Name: classify_ai_applications.py

Purpose:
---------
This script reads a CSV file containing AI applications and automatically classifies
each application using an ontology and GPT-5. The classification includes:
  1. Identifying the main substantive activity (verb + object) of the application.
  2. Determining whether the application performs the activity itself or assists a human.
  3. Selecting the most appropriate ontology node for the main activity.
The results, along with GPT token usage and estimated cost, are saved in an output CSV file.

Workflow:
---------
1. Load the input CSV containing application Name, Tagline, and Description.
2. For each application:
   a. Call the ontology API to retrieve relevant ontology nodes.
   b. Create a detailed GPT-5 prompt including the app info and ontology.
   c. Send the prompt to GPT-5 and extract structured JSON response.
   d. Validate the response and retry if necessary.
   e. Record:
      - Main activity and reasoning
      - Substantive activity and reasoning
      - Selected ontology node and rationale
      - Token usage and estimated cost
3. Save all results to the output CSV file.

Requirements:
-------------
- Python 3.8+
- Libraries: csv, time, json, requests, openai
- OpenAI API key must be set in the environment as OPENAI_API_KEY
- Access to ontology API endpoint: https://1ontology.com/api/load-sub-ontology

Output:
-------
A CSV file with the following columns:
- Name: Application name
- Tagline: Application tagline
- Description: Application description
- MA: Main activity and reasoning
- SA: Substantive activity and reasoning
- SAClassification: Ontology node title + rationale
- tokens: Total GPT tokens used
- cost: Estimated GPT API cost (USD)
"""

import csv
import time
import json
import requests
from openai import OpenAI

# URL of the API used to load a sub-ontology for classification
API_URL = "https://1ontology.com/api/load-sub-ontology"

# Initialize the OpenAI client
# Make sure OPENAI_API_KEY is set in the environment
client = OpenAI()

# Path to the input CSV file containing AI application info
csv_file_path = "TAAFT_human_annotation_trial.csv"
# Path to the output CSV file where classification results will be saved
output_file_path = "output.csv"

# Name of the column in CSV that contains the application prompt
prompt_column = "prompt"


def extract_object(s: str):
    """
    Extracts and parses the first valid JSON object found in a string.
    Returns a Python dict if successful, or None if no valid JSON is found.
    This is useful because GPT responses may include additional text
    around the JSON object.
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

        # When all braces are balanced, try parsing JSON
        if brace_count == 0:
            json_str = s[start : i + 1]
            try:
                return json.loads(json_str)
            except json.JSONDecodeError:
                return None

    return None


def send_request_to_gpt(model: str, prompt: str, reasoning_effort: str = "high"):
    """
    Sends a prompt to GPT-5 and returns structured response info.
    It also calculates token usage and approximate cost.
    Returns a dictionary containing:
      - 'responseObject': parsed JSON object from GPT
      - 'usedTokens': detailed token usage
      - 'cost': estimated cost in USD
      - 'executionTime': how long the call took
    """
    try:
        start_time = time.time()

        completion = client.chat.completions.create(
            model=model,
            reasoning_effort=reasoning_effort,
            messages=[{"role": "user", "content": prompt}],
        )

        # Extract token usage from response
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

        # Example pricing — adjust as needed for actual rates
        input_cost_per_1k = 0.00125
        output_cost_per_1k = 0.01
        input_cost = (prompt_tokens / 1000) * input_cost_per_1k
        output_cost = (
            (completion_tokens + reasoning_tokens) / 1000
        ) * output_cost_per_1k
        total_cost = input_cost + output_cost

        end_time = time.time()
        execution_time_ms = int((end_time - start_time))

        # Extract text content from GPT response
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
        # If GPT call fails, return default empty values
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
    """
    Takes an application’s title, tagline, description, and an ontology object.
    Sends a detailed prompt to GPT-5 asking it to:
      - Identify the main substantive activity (verb + object)
      - Determine if the app performs or assists in the activity
      - Choose the most appropriate ontology node for classification
    Returns a dictionary suitable for writing to the output CSV.
    """
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
"""
        response = None

        # Retry loop until GPT returns valid structured JSON
        while not response:
            result = send_request_to_gpt(model="gpt-5", prompt=prompt)
            response = result["responseObject"]
            total_tokens = result["usedTokens"]
            cost = result["cost"]

            # Ensure all required keys are present
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

            # Prepare simplified output fields
            most_appropriate_node = response["most_appropriate_node"]
            sa_classification = ""

            if most_appropriate_node:
                sa_classification = f"{most_appropriate_node['title']}: \n{response['most_appropriate_node_rationale']}"

            return {
                "MA": f"{response['does_it_perform_the_activity_or_help_a_human_perform_it']}: \n"
                f"{response['reasoning_for_does_it_perform_the_activity_or_help_a_human_perform_it']}",
                "SA": f"{response['substantive_activity']}: \n"
                f"{response['reasoning_substantive_activity']}",
                "SAClassification": sa_classification,
                "tokens": total_tokens["total"],
                "cost": cost["totalCost"],
            }

    except Exception as e:
        print({"error": str(e)})
        return None


# Open the input CSV and prepare output CSV
with open(csv_file_path, newline="", encoding="utf-8") as csvfile, open(
    output_file_path, "w", newline="", encoding="utf-8"
) as outfile:

    reader = csv.DictReader(csvfile)

    # Define output CSV columns
    fieldnames = [
        "Name",
        "Tagline",
        "Description",
        "MA",  # Main activity and reasoning
        "SA",  # Substantive activity and reasoning
        "SAClassification",  # Ontology node title + rationale
        "tokens",  # Total GPT tokens used
        "cost",  # Estimated GPT API cost
    ]

    writer = csv.DictWriter(outfile, fieldnames=fieldnames)
    writer.writeheader()  # Write CSV header

    csvfile.seek(0)
    reader = csv.DictReader(csvfile)

    # Process each row in the input CSV
    for i, row in enumerate(reader, start=1):
        print(f"\nProcessing row {i}: {row['Name']}")
        searchQuery = f"{row['Tagline']} \n\n {row['Description']}"
        payload = {
            "searchQuery": searchQuery,
            "applicationName": "final-hierarchy-with-o*net",
            "nodeType": "activity",
            "searchLimit": 10,
        }
        headers = {
            "Content-Type": "application/json",
            "Authorization": "Bearer YOUR_API_KEY_IF_NEEDED",
        }

        # Call API to get the sub-ontology relevant to this application
        print(f"Loading sub-ontology to API for '{row['Name']}'...")
        response = requests.post(API_URL, headers=headers, data=json.dumps(payload))

        try:
            data = response.json()
            print("Received response from API.")
        except json.JSONDecodeError:
            print("Response is not valid JSON. Using empty data.")
            data = {}

        ontology_object = data.get("ontology_object", {})
        searchResults = data.get("topResults", [])

        # Classify the application using GPT-5
        print("Classifying current row...")
        classification_of_taaft_row = get_classification_of_taaft_row(
            app_title=row["Name"],
            tagline=row["Tagline"],
            description=row["Description"],
            ontology_object=json.dumps(ontology_object, indent=2),
        )
        print(classification_of_taaft_row)

        # Write classification results to output CSV
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
