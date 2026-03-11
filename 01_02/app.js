import {
  AI_API_KEY,
  buildResponsesRequest,
  EXTRA_API_HEADERS,
  RESPONSES_API_ENDPOINT,
  resolveModelForProvider,
} from "../config.js";
import {
  buildNextConversation,
  getFinalText,
  getToolCalls,
  logAnswer,
  logQuestion,
} from "./helper.js";
import {tools, handlers} from "./tools/index.js";

const model = resolveModelForProvider("gpt-5-mini");

// `buildResponsesRequest()` maps this to OpenAI web search or OpenRouter online mode.
const webSearch = true;

const requestResponse = async (input) => {
  const body = buildResponsesRequest({
    model,
    input,
    tools,
    webSearch,
  });

  const response = await fetch(RESPONSES_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_API_KEY}`,
      ...EXTRA_API_HEADERS,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message ?? `Request failed (${response.status})`);
  return data;
};

const MAX_TOOL_STEPS = 10;

/*
  Step 4: Run the tool-calling workflow.
*/

const chat = async (conversation) => {
  let currentConversation = conversation;
  let stepsRemaining = MAX_TOOL_STEPS;

  while (stepsRemaining > 0) {
    stepsRemaining -= 1;

    const response = await requestResponse(currentConversation);
    const toolCalls = getToolCalls(response);

    if (toolCalls.length === 0) {
      return getFinalText(response);
    }

    currentConversation = await buildNextConversation(currentConversation, toolCalls, handlers);
  }

  throw new Error(`Tool calling did not finish within ${MAX_TOOL_STEPS} steps.`);
};

const query = `Find and report a suspect near a power plant. Follow these steps in order:
1. Fetch the full suspects list and ALL their locations in parallel where possible.
2. Fetch powerplant data.
3. For each powerplant, call closest_locations_proximity ONCE using that powerplant as the point (use the corresponding city center coordinates approximate) and ALL suspect locations (from all suspects combined) as the locations list. Do NOT call it separately per suspect.
4. Identify which suspect was closest to a powerplant and fetch their access level.
5. Send the final report.`;
logQuestion(query);

const answer = await chat([{ role: "user", content: query }]);
logAnswer(answer);
