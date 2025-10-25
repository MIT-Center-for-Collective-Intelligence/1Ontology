"""
Description:
This script processes an input CSV containing AI application skills and descriptions,
retrieves a relevant sub-ontology from an external API, and uses the Gemini 2.5 Pro
model to classify each skill into the closest generalization node in the ontology.
The results, along with rationale, token usage, and cost, are saved to an output CSV.

Requirements:
- Python 3.x
- Libraries: csv, time, json, requests, ast, google.generativeai
- Set GOOGLE_API_KEY in environment for API access

Dependencies:
- google-generativeai
- requests
- csv
- time
- json
- ast

Usage:
- Make sure GOOGLE_API_KEY or relevant credentials are set for the Gemini API.
- Update input/output CSV paths as needed
"""

import csv
import time
import json
import requests
import ast
import google.generativeai as genai

# Configure the Gemini API client using credentials from the environment
genai.configure()


# URL of the external API used to retrieve a relevant sub-ontology
API_URL = "https://1ontology.com/api/load-sub-ontology"


# Path to the input CSV file containing AI application skills
csv_file_path = "linkedin_entrylevel_finance_healthcare_MAGA.csv"
# Path to the output CSV file where classification results will be saved
output_file_path = "output_linkedin_entrylevel_finance_healthcare_MAGA.csv"

# Name of the column in CSV that contains the application prompt
prompt_column = "prompt"


def extract_object(s: str):
    """
    Extracts and parses the first valid JSON object found in a string.
    This is particularly useful because GPT responses may contain
    additional text around the JSON object.

    Args:
        s (str): Input string that may contain JSON.

    Returns:
        dict or None: Parsed JSON object if successful, else None.
    """
    if not s or "{" not in s:
        return None

    start = s.find("{")
    brace_count = 0

    # Scan through the string to find the complete JSON object
    for i in range(start, len(s)):
        if s[i] == "{":
            brace_count += 1
        elif s[i] == "}":
            brace_count -= 1

        # When all braces are balanced, attempt to parse JSON
        if brace_count == 0:
            json_str = s[start : i + 1]
            try:
                return json.loads(json_str)
            except json.JSONDecodeError:
                return None

    return None


def send_request_to_gemini(prompt: str):
    """
    Sends a text prompt to the Gemini 2.5 Pro model and returns structured response data.
    The function also captures token usage, execution time, and cost estimates.

    Args:
        prompt (str): The input text prompt for Gemini.

    Returns:
        dict: Contains the GPT response object, execution time, token usage, and cost.
    """
    try:
        start_time = time.time()
        model = genai.GenerativeModel("gemini-2.5-pro")

        # Generate response from Gemini
        response = model.generate_content(prompt)

        end_time = time.time()
        execution_time_ms = int((end_time - start_time) * 1000)

        # --- Extract response text ---
        candidate = response.candidates[0]
        text = candidate.content.parts[0].text

        # --- Extract token usage ---
        usage_metadata = response.usage_metadata
        total_tokens = {
            "input": usage_metadata.prompt_token_count,
            "thinking": usage_metadata.total_token_count
            - usage_metadata.prompt_token_count
            - usage_metadata.candidates_token_count,
            "output": usage_metadata.candidates_token_count,
        }

        # --- Compute estimated costs ---
        if total_tokens["input"] <= 200_000:
            input_price_per_million = 1.25
            output_price_per_million = 10.0
        else:
            input_price_per_million = 2.5
            output_price_per_million = 15.0

        input_cost = (total_tokens["input"] / 1_000_000) * input_price_per_million
        output_cost = (
            (total_tokens["thinking"] + total_tokens["output"]) / 1_000_000
        ) * output_price_per_million
        total_cost = input_cost + output_cost

        # --- Parse JSON from GPT response safely ---
        response_object = extract_object(text)

        # Convert token counts to string for CSV-friendly formatting
        total_tokens["input"] = str(total_tokens["input"])
        total_tokens["thinking"] = str(total_tokens["thinking"])
        total_tokens["output"] = str(total_tokens["output"])

        return {
            "responseObject": response_object,
            "executionTime": execution_time_ms,
            "usedTokens": total_tokens,
            "cost": {
                "inputCost": f"{input_cost:.6f}",
                "outputCost": f"{output_cost:.6f}",
                "totalCost": f"{total_cost:.6f}",
                "currency": "USD",
            },
        }

    except Exception as e:
        print("Error calling Gemini API:", e)
        raise RuntimeError("Failed to get response from Gemini.") from e


def get_generalization_for_skill(
    skill_name: str, description: str, ontology_object: str
):
    """
    Given a skill name and description, use Gemini to determine
    the closest generalization node from a provided ontology.

    Args:
        skill_name (str): The name of the skill or activity.
        description (str): Description of the skill or activity.
        ontology_object (str): JSON string of the ontology nodes.

    Returns:
        dict or None: Classification result including closest generalization node,
                      rationale, token usage, and cost.
    """

    try:
        # Prepare prompt for GPT
        prompt = f"""
        ## Role:
        You are an analyst that classifies an activity, specifying which of the nodes in the ontology (provided as a JSON structure in the input) is the best generalization for the given activity. Work only with the supplied nodes and their fields; do not infer or invent nodes or properties. 
        
        ## Ontology Definition:
        Each node in our ontology represents a type of action and has these properties:
        - **title** (String) – a unique, concise title.
        - **description** (String) – a detailed explanation of the node, its purpose, scope, and context.
        - **specializations** *(Array of Objects)* – Groups of more specific types of this node. Each object in the array represents a collection of specializations along a common dimension.

        ## Input:
        - Activity Title: "{skill_name}"
        - Activity description: "{description}"
        - Ontology Nodes: {ontology_object}
        
        ## Output:
        Return a single JSON object only (no prose), exactly with these keys and value types:
        {{
          "closest_generalization_node": "the ontology node title that is the closest generalization of this activity, it should be a string",
          "closest_generalization_node_rationale": "your reasoning for choosing this ontology node",
        }}
        """

        response = None
        retries = 3

        for _ in range(retries):
            # Call Gemini with the prepared prompt
            result = send_request_to_gemini(prompt=prompt)

            response = result.get("responseObject")
            usedTokens = result["usedTokens"]
            cost = result.get("cost", {})

            # Validate JSON response structure
            required_keys = [
                "closest_generalization_node",
                "closest_generalization_node_rationale",
            ]
            if response and all(key in response for key in required_keys):
                # Return simplified structure for CSV
                return {
                    "closest_generalization_node": response[
                        "closest_generalization_node"
                    ],
                    "closest_generalization_node_rationale": response[
                        "closest_generalization_node_rationale"
                    ],
                    "tokens": f"- input: {usedTokens['input']}\n- thinking: {usedTokens['thinking']}\n- output: {usedTokens['output']}",
                    "cost": cost["totalCost"],
                }

            print("Invalid response detected — retrying...")
            response = None

        # All retries failed
        print("Failed to get valid response after retries.")
        return None

    except Exception as e:
        print({"error": str(e)})
        return None


# Main CSV processing logic
# ------------------------
# Open the input CSV containing raw skills, and create an output CSV to store results
with open(csv_file_path, newline="", encoding="utf-8") as csvfile, open(
    output_file_path, "w", newline="", encoding="utf-8"
) as outfile:

    reader = csv.DictReader(csvfile)

    # Define output CSV columns
    fieldnames = [
        "Skill name",
        "Skill Description",
        "Generalization (the appropriate node of the ontology)",
        "Rationale (generated by Gemini)",
        "Tokens",
        "Cost",
    ]

    writer = csv.DictWriter(outfile, fieldnames=fieldnames)
    writer.writeheader()  # Write CSV header

    csvfile.seek(0)
    reader = csv.DictReader(csvfile)
    progress = 0

    # Iterate through each row of the input CSV
    for i, row in enumerate(reader, start=1):
        # Convert 'raw_skill' string representation of list into actual Python list
        raw_skills = ast.literal_eval(row["raw_skill"])
        for skill in raw_skills:
            progress += 1
            print(
                f"\nProcessing skill {progress} out of 578, row {i}: {skill['name']}"
            )

            # Construct search query to retrieve relevant sub-ontology
            searchQuery = f"{skill['name']} \n\n {skill['description']}"
            payload = {
                "searchQuery": searchQuery,
                "applicationName": "final-hierarchy-with-o*net",
                "nodeType": "activity",
                "searchLimit": 100,
            }
            headers = {
                "Content-Type": "application/json",
                "Authorization": "Bearer YOUR_API_KEY_IF_NEEDED",
            }

            # Call API to fetch sub-ontology for the current skill
            print(f"Loading sub-ontology for '{skill['name']}'...")
            response = requests.post(API_URL, headers=headers, data=json.dumps(payload))

            try:
                data = response.json()
                print("Received response from API.")
            except json.JSONDecodeError:
                print("Response is not valid JSON. Using empty data.")
                data = {}

            ontology_object = data.get("ontology_object", {})
            searchResults = data.get("topResults", [])

            # Classify the current skill using Gemini
            print("Classifying current row...")
            generalization_of_skill = get_generalization_for_skill(
                skill_name=skill["name"],
                description=skill["description"],
                ontology_object=json.dumps(ontology_object, indent=2),
            )
            print(generalization_of_skill)

            # Write the classification results to the output CSV
            if generalization_of_skill:
                row_to_write = {
                    "Skill name": skill["name"],
                    "Skill Description": skill["description"],
                    "Generalization (the appropriate node of the ontology)": generalization_of_skill[
                        "closest_generalization_node"
                    ],
                    "Rationale (generated by Gemini)": generalization_of_skill[
                        "closest_generalization_node_rationale"
                    ],
                    "Tokens": generalization_of_skill["tokens"],
                    "Cost": generalization_of_skill["cost"],
                }
                writer.writerow(row_to_write)
                outfile.flush()
            else:
                print(f"Row '{row['Name']}' could not be classified. Skipping writing.")

    print("\nAll rows processed. Output CSV completed.")
