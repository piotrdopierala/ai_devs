import { writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { chat, extractToolCalls, extractText } from "./api.js";
import { AIDEVS_KEY, TOOLSEARCH_URL, BASE_URL } from "./config.js";
import log from "./helpers/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

const MAX_STEPS = 20;

const TOOLSEARCH_DEFINITION = [{
    type: "function",
    name: "toolsearch",
    description: "Search for available tools by natural language query. Returns up to 3 matching tools with their name, URL, and description.",
    parameters: {
        type: "object",
        properties: {
            query: { type: "string", description: "Natural language query describing the tool you need" }
        },
        required: ["query"],
        additionalProperties: false
    }
}];

const DISCOVERY_INSTRUCTIONS = `You are a tool discovery agent. Use toolsearch to find all tools needed to complete a navigation task:
1. Get the map or terrain data (10x10 grid)
2. List available vehicles and their fuel consumption rates
3. Understand movement and terrain rules (what terrain costs extra moves, what is passable)
4. Find reference materials, notes, or books with planning tips, terrain rules, or vehicle capabilities

Search with varied queries until you have found tools covering all four areas. Each search returns up to 3 results. Try different keywords — for area 4 try: "notes", "books", "rules", "reference", "planning", "movement notes". When you are confident you have found tools for all four areas, stop and summarize what you found.`;

/**
 * Calls toolsearch API and returns parsed results.
 * @param {string} query
 * @returns {Promise<object[]>} Array of discovered tool objects
 */
const callToolsearch = async (query) => {
    const response = await fetch(TOOLSEARCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apikey: AIDEVS_KEY, query })
    });
    if (!response.ok) {
        const text = await response.text();
        return [{ error: `HTTP ${response.status}`, raw: text }];
    }
    const text = await response.text();
    try {
        const parsed = JSON.parse(text);
        // Response shape: { code, message, tools: [{ name, url, description, ... }] }
        const tools = Array.isArray(parsed.tools) ? parsed.tools : (Array.isArray(parsed) ? parsed : [parsed]);
        // Resolve relative URLs against BASE_URL
        return tools.map(t => ({
            ...t,
            url: t.url?.startsWith("/") ? `${BASE_URL.replace(/\/$/, "")}${t.url}` : t.url
        }));
    } catch {
        return [{ raw: text }];
    }
};

/**
 * Runs Phase 1: discovery loop.
 * @param {Function} write - File logger append function
 * @param {string} timestamp - Shared run timestamp for output filename
 * @returns {Promise<Record<string, { url: string, description: string }>>} toolRegistry
 */
export const discover = async (write, timestamp) => {
    log.box("Phase 1 — Tool Discovery");
    await write(`## Phase 1 — Tool Discovery\n\n`);

    const registry = {};
    const messages = [{ role: "user", content: "Find all tools needed for: map/terrain data, vehicle list with fuel rates, and movement/terrain rules." }];

    for (let step = 1; step <= MAX_STEPS; step++) {
        log.api(`Discovery step ${step}`, messages.length);
        await write(`### Step ${step}\n\n`);

        const response = await chat({
            input: messages,
            tools: TOOLSEARCH_DEFINITION,
            instructions: DISCOVERY_INSTRUCTIONS
        });
        log.apiDone(response.usage);

        const toolCalls = extractToolCalls(response);

        if (toolCalls.length === 0) {
            const summary = extractText(response) ?? "Discovery complete.";
            log.success(`Discovery done: ${summary.substring(0, 100)}`);
            await write(`**Done:** ${summary}\n\n`);
            break;
        }

        messages.push(...response.output);

        for (const tc of toolCalls) {
            const args = JSON.parse(tc.arguments);
            log.tool(tc.name, args);
            const results = await callToolsearch(args.query);

            // Accumulate discovered tools into registry
            for (const tool of results) {
                if (tool.name && tool.url) {
                    registry[tool.name] = { url: tool.url, description: tool.description ?? tool.name };
                    log.success(`Discovered: ${tool.name} → ${tool.url}`);
                }
            }

            const output = JSON.stringify(results);
            log.toolResult(tc.name, true, output);
            await write(`**\`toolsearch\`** query: \`${args.query}\`\n\n\`\`\`json\n${output}\n\`\`\`\n\n`);

            messages.push({ type: "function_call_output", call_id: tc.call_id, output });
        }
    }

    // Save registry to file
    const registryPath = join(PROJECT_ROOT, "workspace", "output", `discovered-tools-${timestamp}.json`);
    await writeFile(registryPath, JSON.stringify(registry, null, 2));
    log.success(`Registry saved: ${registryPath}`);
    await write(`**Registry saved:** \`${registryPath}\`\n\n\`\`\`json\n${JSON.stringify(registry, null, 2)}\n\`\`\`\n\n---\n\n`);

    if (Object.keys(registry).length === 0) {
        throw new Error("Discovery phase found no tools — cannot proceed");
    }

    return registry;
};
