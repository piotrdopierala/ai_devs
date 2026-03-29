import { chat, extractToolCalls, extractText } from "./api.js";
import { toToolDefinitions, executeRegistryTool } from "./toolRegistry.js";
import { renderMap } from "./mapRenderer.js";
import log from "./helpers/logger.js";

const MAX_STEPS = 40;

const PLANNING_INSTRUCTIONS = `You are a route planning agent for a 10x10 grid map.

RESOURCES: 10 food, 10 fuel. Every move costs 1 food. Vehicle moves also cost fuel at the vehicle's specific rate. You start with 10 food and 10 fuel.

GOAL: Reach Skolwin (marked G on map) starting from S, in as few moves as possible without running out of food or fuel.

MAP FORMAT (when you receive map data):
  S = start, G = goal (Skolwin), . = passable terrain
  T = tree, R = river, W = water, # = stone
  Columns are X (left=0), rows are Y (top=0). Moving right = +X, moving down = +Y.

VALID MOVES: up, down, left, right

HOW TO USE TOOLS:
- Tools accept a "query" parameter — use a specific keyword or value, not a long sentence.
- Map tool: query with the city name e.g. "Skolwin".
- Vehicles tool: query each vehicle by exact name one at a time: "rocket", "horse", "walk", "car". Read the FULL note for each — it contains terrain restrictions.
- Books tool: REQUIRED — query it multiple times before planning. Use queries like "terrain rules", "water crossing", "river crossing", "movement rules", "vehicle terrain". The books contain critical rules about which terrain types each vehicle can and cannot enter. You MUST read the books before choosing a vehicle or plotting a path.
- If a tool returns an error with useful info, adapt your next query accordingly.

STRATEGY — follow this order exactly:
1. Get the map (query: "Skolwin").
2. Query each vehicle by name: rocket, horse, walk, car. Note fuel cost, food cost, and terrain restrictions from the full note.
3. Query the books tool at least 3 times with different queries about terrain and movement rules. Read everything carefully.
4. Identify S and G on the ASCII map. Note all terrain types on possible paths.
5. Using vehicle notes AND book rules, determine which terrain types each vehicle can enter.
6. Plan the shortest path from S to G that only uses terrain passable by your chosen vehicle.
7. VERIFY your math before answering: count moves × food_per_move ≤ 10 AND moves × fuel_per_move ≤ 10. If either limit is exceeded, choose a different vehicle or find a shorter path.
8. Output your final answer as a JSON array on the LAST line, with no extra text after it:
   ["vehicle_name", "move1", "move2", ...]
   - vehicle_name = exact name string (e.g. "rocket", "horse", "walk", "car")
   - moves = actual directional steps: up / down / left / right
   - NEVER output placeholder text like "move1" or "..." — only real directional moves`;

/**
 * Runs Phase 2: planning loop.
 * @param {Record<string, { url: string, description: string }>} registry
 * @param {Function} write - File logger append function
 * @param {string} [tips] - Tips from previous runs to inject as context
 * @returns {Promise<{ answer: string[], mapAscii: string }>}
 */
export const plan = async (registry, write, tips = "") => {
    log.box("Phase 2 — Route Planning");
    await write(`## Phase 2 — Route Planning\n\n`);

    const tools = toToolDefinitions(registry);
    const tipsContext = tips.trim() ? `\nPREVIOUS RUN TIPS (learn from these):\n${tips}\n` : "";
    const messages = [{
        role: "user",
        content: `Plan the optimal route from start (S) to Skolwin (G).

Step 1 — gather data (do ALL of these before planning):
- Get the map: query maps tool with "Skolwin"
- Get each vehicle: query vehicles tool with "rocket", "horse", "walk", "car" one at a time
- Read the books — query with each of these terms one at a time: "water", "river", "terrain", "movement rules". The books contain critical terrain crossing rules you MUST know before choosing a vehicle or plotting a path.

Step 2 — plan and output the answer array.${tipsContext}`
    }];

    let lastMapAscii = "";

    for (let step = 1; step <= MAX_STEPS; step++) {
        log.api(`Planning step ${step}`, messages.length);
        await write(`### Step ${step}\n\n`);

        const response = await chat({
            input: messages,
            tools,
            instructions: PLANNING_INSTRUCTIONS
        });
        log.apiDone(response.usage);

        const toolCalls = extractToolCalls(response);

        if (toolCalls.length === 0) {
            const text = extractText(response) ?? "";
            await write(`**Done:**\n${text}\n\n`);

            // Extract JSON array from the text: find last "[" to last "]" (answer is at end)
            const end = text.lastIndexOf("]");
            const start = text.lastIndexOf("[", end);
            if (start !== -1 && end !== -1) {
                try {
                    const answerArray = JSON.parse(text.slice(start, end + 1));
                    log.success(`Answer: ${JSON.stringify(answerArray)}`);
                    return { answer: answerArray, mapAscii: lastMapAscii, messages };
                } catch (e) {
                    log.warn(`JSON parse failed: ${e.message} — asking LLM to retry`);
                }
            }

            // No valid array found — push error back and let LLM retry
            messages.push(...response.output);
            messages.push({
                role: "user",
                content: "Your last response did not contain a valid JSON array. Output ONLY the answer array as the last line, e.g.: [\"walk\", \"right\", \"up\"]"
            });
            continue;
        }

        messages.push(...response.output);

        for (const tc of toolCalls) {
            const args = JSON.parse(tc.arguments);
            log.tool(tc.name, args);

            let result;
            try {
                result = await executeRegistryTool(registry, tc.name, args);
            } catch (err) {
                result = { error: err.message };
            }

            // If result contains a grid, render ASCII and inject into output
            const ascii = renderMap(result);
            if (ascii) lastMapAscii = ascii;
            const outputData = ascii ? { ...result, ascii_map: ascii } : result;
            const output = JSON.stringify(outputData);

            log.toolResult(tc.name, !result.error, output.substring(0, 200));
            await write(`**\`${tc.name}\`** query: \`${args.query}\`\n\n\`\`\`json\n${output}\n\`\`\`\n\n`);

            messages.push({ type: "function_call_output", call_id: tc.call_id, output });
        }
    }

    throw Object.assign(new Error(`Max planning steps (${MAX_STEPS}) reached without an answer`), { messages, mapAscii: lastMapAscii });
};
