import { chat, extractToolCalls, extractText } from "./api.js";
import { nativeTools, executeNativeTool } from "./tools.js";
import { api } from "./config.js";
import log from "./helpers/logger.js";
import { createFileLogger } from "./helpers/file-logger.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..");

const MAX_STEPS = 60;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const runTool = async (toolCall) => {
    const args = JSON.parse(toolCall.arguments);
    log.tool(toolCall.name, args);

    try {
        const result = await executeNativeTool(toolCall.name, args);
        const output = JSON.stringify(result);

        // Auto-handle rate limits — wait and retry
        if (result.code === -9999 || result.code === -735) {
            const waitSec = result.ban?.seconds_left ?? 5;
            log.warn(`Rate limited — waiting ${waitSec + 2}s before retry...`);
            await delay((waitSec + 2) * 1000);
            const retry = await executeNativeTool(toolCall.name, args);
            const retryOutput = JSON.stringify(retry);
            log.toolResult(toolCall.name, true, retryOutput);
            return { type: "function_call_output", call_id: toolCall.call_id, output: retryOutput };
        }

        log.toolResult(toolCall.name, true, output);
        return { type: "function_call_output", call_id: toolCall.call_id, output };
    } catch (error) {
        const output = JSON.stringify({ error: error.message });
        log.toolResult(toolCall.name, false, error.message);
        return { type: "function_call_output", call_id: toolCall.call_id, output };
    }
};

export const run = async (query) => {
    const messages = [{ role: "user", content: query }];

    log.query(query);

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const logPath = join(PROJECT_ROOT, "workspace", "output", `run-${timestamp}.md`);
    const write = await createFileLogger(logPath);
    log.info(`Run log: ${logPath}`);

    await write(`# Reactor Agent Run Log\n\n- **Date**: ${new Date().toISOString()}\n- **Model**: ${api.model}\n\n## Task\n\n${query}\n\n---\n\n`);

    for (let step = 1; step <= MAX_STEPS; step++) {
        log.api(`Step ${step}`, messages.length);
        await write(`## Step ${step}\n\n`);

        const response = await chat({ input: messages, tools: nativeTools });
        log.apiDone(response.usage);

        const toolCalls = extractToolCalls(response);

        if (toolCalls.length === 0) {
            const text = extractText(response) ?? "Done";
            log.success(`Agent finished: ${text}`);
            await write(`## Done\n\n${text}\n\n`);
            return { response: text, toolCalls: [] };
        }

        messages.push(...response.output);

        for (const tc of toolCalls) {
            const result = await runTool(tc);
            await write(`### \`${tc.name}\`\n\n**Input:** \`${tc.arguments}\`\n\n**Result:**\n\`\`\`json\n${result.output}\n\`\`\`\n\n`);
            messages.push(result);

            // Check for goal reached or flag in tool result
            let parsed;
            try { parsed = JSON.parse(result.output); } catch { parsed = {}; }
            const flagMatch = result.output.match(/\{FLG:[^}]+\}/i);
            if (parsed.reached_goal === true || flagMatch) {
                const flag = flagMatch ? flagMatch[0] : "Goal reached!";
                log.success(`Done! ${flag} Run log: ${logPath}`);
                await write(`## Goal Reached\n\n${flag}\n\n`);
                return { response: flag, toolCalls: [] };
            }
        }

        await write(`---\n\n`);
    }

    throw new Error(`Max steps (${MAX_STEPS}) reached without reaching the goal`);
};
