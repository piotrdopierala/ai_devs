import { resolveModelForProvider } from "../../config.js";

export const AIDEVS_KEY = process.env.AIDEVS_KEY?.trim() ?? "";
export const RAILWAY_API_URL = `${process.env.BASE_URL?.trim() ?? "https://<BASE_URL>/"}verify`;

export const api = {
    model: resolveModelForProvider("gpt-4.1"),
    maxOutputTokens: 4096,
    instructions: `You are a railway operations agent. Your goal is to activate route X-01.

Explore the API, call action "help" to get initial description. 
Use API responses to figure out the next step.

Route format: [a-z]-[0-9]{1,2} (case-insensitive), so X-01 is valid.



If the API returns a rate limit error, read the suggested wait time from the error response (e.g. a "retry after X seconds" message or similar field), then call the wait tool with that exact number of seconds before retrying. Report the final status after completing the activation.
If server responses with a server outage guess the timeout, then extend if error contiunes to appear.
Avoid asking user for clarification. `
};
