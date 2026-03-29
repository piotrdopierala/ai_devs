import { fileURLToPath } from "url";
import { dirname, join } from "path";
import log from "./src/helpers/logger.js";
import { createFileLogger } from "./src/helpers/file-logger.js";
import { logStats } from "./src/helpers/stats.js";
import { discover } from "./src/discover.js";
import { plan } from "./src/plan.js";
import { submit } from "./src/submit.js";
import { readTips, appendTip, loadCachedRegistry, saveCachedRegistry } from "./src/memory.js";
import { chat, extractText } from "./src/api.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Asks the LLM to analyse a failure and produce a short actionable tip.
 * @param {{ map?: string, answer?: string[], apiResponse?: string, error?: string, messages?: object[] }} context
 * @returns {Promise<string>}
 */
const generateTip = async ({ map, answer, apiResponse, error, messages }) => {
    const parts = [];
    if (map) parts.push(`Map:\n${map}`);
    if (answer) parts.push(`Answer submitted: ${JSON.stringify(answer)}`);
    if (apiResponse) parts.push(`API response: ${apiResponse}`);
    if (error) parts.push(`Error: ${error}`);
    if (messages?.length) {
        // Serialize the planner conversation: tool calls + results + LLM text
        const log = messages.map(m => {
            if (m.role === "user") return `USER: ${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}`;
            if (m.type === "function_call") return `TOOL CALL: ${m.name}(${m.arguments})`;
            if (m.type === "function_call_output") return `TOOL RESULT: ${m.output}`;
            if (m.type === "message") {
                const text = Array.isArray(m.content) ? m.content.map(c => c.text ?? "").join("") : "";
                return text ? `LLM: ${text}` : null;
            }
            return null;
        }).filter(Boolean).join("\n");
        if (log) parts.push(`Planning conversation:\n${log}`);
    }

    const context = parts.join("\n\n");

    try {
        const response = await chat({
            input: [{ role: "user", content: `You are analysing a failed run of a navigation agent.\n\n${context}\n\nWrite a SHORT tip (3-5 sentences) explaining what likely went wrong and what should be improved in the next run. Be specific and actionable. Output only the tip text, no headings.` }],
            instructions: "You are a concise debugging assistant. Output only plain text.",
            maxOutputTokens: 300
        });
        return extractText(response) ?? context;
    } catch {
        return context;
    }
};

const main = async () => {
    log.box("savethem Agent\n03_05: Dynamic tool discovery + route planning");

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const logPath = join(__dirname, "workspace", "output", `run-${timestamp}.md`);
    const write = await createFileLogger(logPath);
    log.info(`Run log: ${logPath}`);

    await write(`# savethem Run Log\n\n- **Date**: ${new Date().toISOString()}\n\n---\n\n`);

    // Load tips from previous runs and pass to agents
    const tips = await readTips();
    if (tips.trim()) {
        log.info(`Loaded tips from memory`);
        await write(`## Memory Tips\n\n${tips}\n\n---\n\n`);
    }

    // Phase 1: discover tools (skip if cached)
    let registry = await loadCachedRegistry();
    if (registry) {
        log.success(`Using cached tool registry (${Object.keys(registry).length} tools): ${Object.keys(registry).join(", ")}`);
        await write(`## Phase 1 — Tool Discovery (cached)\n\nLoaded from memory: ${Object.keys(registry).join(", ")}\n\n---\n\n`);
    } else {
        registry = await discover(write, timestamp);
        log.info(`Discovered ${Object.keys(registry).length} tools: ${Object.keys(registry).join(", ")}`);
        await saveCachedRegistry(registry);
    }

    // Phase 2: plan route
    const { answer: answerArray, mapAscii, messages: planMessages } = await plan(registry, write, tips);

    // Submit
    const result = await submit(answerArray);
    await write(`## Submission\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\n`);

    const responseText = JSON.stringify(result);
    const flagMatch = responseText.match(/\{FLG:[^}]+\}/i);

    if (flagMatch) {
        log.success(`Done! Flag: ${flagMatch[0]}`);
    } else {
        log.warn(`Submission failed — generating tip...`);
        const tip = await generateTip({
            map: mapAscii,
            answer: answerArray,
            apiResponse: result.message ?? responseText,
            messages: planMessages
        });
        await appendTip(tip);
        log.info(`Tip saved to workspace/memory/tips.md`);
    }

    logStats();
};

main().catch(async (err) => {
    log.error("Fatal", err.message);

    log.warn(`Generating tip from error...`);
    const tip = await generateTip({ error: err.message, map: err.mapAscii, messages: err.messages }).catch(() => err.message);
    await appendTip(tip).catch(() => {});
    log.info(`Tip saved to workspace/memory/tips.md`);

    process.exit(1);
});
