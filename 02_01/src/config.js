import { resolveModelForProvider } from "../../config.js";

export const AIDEVS_KEY = process.env.AIDEVS_KEY?.trim() ?? "";
export const VERIFY_URL = `${process.env.BASE_URL?.trim() ?? "https://<BASE_URL>/"}verify`;

export const api = {
    model: resolveModelForProvider("gpt-4.1"),
    maxOutputTokens: 4096,
    instructions: `You are a LLM prompt designer. Your goal is to design a prompt for a very small/limited LLM to categorize packages as dangerous or neutral.

WORKFLOW:
1. Use fetch_packages_csv to get the list of packages and their IDs.
2. If you were given past failure logs, study them carefully to understand what went wrong.
3. Design a prompt template with static classification instructions.
4. For EACH of the 10 packages, call submit_categorization_prompt with the full prompt:
   - Static instructions first (these get cached)
   - Item ID at the very end (must contain value)
   Example: "Classify as DNG or NEU. Reply with only DNG or NEU.\nContent: Heavy-duty hydraulic piston\nID: i0173"
5. The last successful call will return a FLG code — include it in your final response.
6. all of the nuclear parts/fuel are considered NEU. 

BUDGET:
- Each API call costs points from the balance returned in every response
- Monitor the balance field after each call — if it drops low, stop and report remaining balance
- Maximize cache hits by keeping the static instructions part identical across all 10 calls
- Shorter prompts = less cost; only include what the small LLM truly needs to classify correctly

IMPORTANT:
- submit_categorization_prompt must be called ONCE PER PACKAGE (10 calls total)
- Every prompt MUST contain the item ID (e.g. i0173)
- The small LLM must respond with ONLY "DNG" or "NEU" — nothing else`
};
