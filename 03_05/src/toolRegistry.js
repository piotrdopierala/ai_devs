import { AIDEVS_KEY } from "./config.js";

/**
 * Converts a registry object into an array of LLM tool definitions.
 * Each tool accepts a single { query: string } parameter.
 * @param {Record<string, { url: string, description: string }>} registry
 * @returns {object[]} LLM tool definitions array
 */
export const toToolDefinitions = (registry) =>
    Object.entries(registry).map(([name, { description }]) => ({
        type: "function",
        name,
        description: description ?? name,
        parameters: {
            type: "object",
            properties: {
                query: { type: "string", description: "Natural language query for this tool" }
            },
            required: ["query"],
            additionalProperties: false
        }
    }));

/**
 * Calls a tool from the registry by posting { apikey, query } to its URL.
 * @param {Record<string, { url: string, description: string }>} registry
 * @param {string} name - Tool name
 * @param {{ query: string }} args
 * @returns {Promise<object>} Parsed JSON response
 */
export const executeRegistryTool = async (registry, name, args) => {
    const tool = registry[name];
    if (!tool) throw new Error(`Tool "${name}" not found in registry`);
    if (!args.query) throw new Error(`Tool "${name}" called without required query argument`);

    const response = await fetch(tool.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apikey: AIDEVS_KEY, query: args.query })
    });

    if (!response.ok) {
        const text = await response.text();
        return { error: `HTTP ${response.status}`, raw: text };
    }

    const text = await response.text();
    try { return JSON.parse(text); } catch { return { raw: text }; }
};
