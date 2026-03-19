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

const MAX_STEPS = 20;

const formatResult = (jsonString) => {
    let parsed;
    try { parsed = JSON.parse(jsonString); } catch { return jsonString; }
    const pretty = JSON.stringify(parsed, null, 2);
    return pretty.length > 2000 ? pretty.slice(0, 2000) + "\n\n... [truncated]" : pretty;
};

const runTool = async (toolCall) => {
    const args = JSON.parse(toolCall.arguments);
    log.tool(toolCall.name, args);

    try {
        const result = await executeNativeTool(toolCall.name, args);
        const output = JSON.stringify(result);
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
    const toolCallHistory = [];

    log.query(query);

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const logPath = join(PROJECT_ROOT, "workspace", "output", `run-${timestamp}.md`);
    const write = await createFileLogger(logPath);
    log.info(`Run log: ${logPath}`);

    await write(`# Agent Run Log\n\n- **Date**: ${new Date().toISOString()}\n- **Model**: ${api.model}\n\n## Task\n\n${query}\n\n---\n\n`);

    for (let step = 1; step <= MAX_STEPS; step++) {
        log.api(`Step ${step}`, messages.length);
        await write(`## Step ${step}\n\n`);

        const response = await chat({ input: messages, tools: nativeTools });
        log.apiDone(response.usage);

        const toolCalls = extractToolCalls(response);

        if (toolCalls.length === 0) {
            const text = extractText(response) ?? "No response";
            await write(`## Final Answer\n\n${text}\n\n`);
            log.success(`Done. Run log: ${logPath}`);
            return { response: text, toolCalls: toolCallHistory };
        }

        messages.push(...response.output);

        for (const tc of toolCalls) {
            const result = await runTool(tc);
            const args = JSON.parse(tc.arguments);
            toolCallHistory.push({ name: tc.name, arguments: args });
            await write(`### \`${tc.name}\`\n\n**Input:**\n\`\`\`json\n${JSON.stringify(args, null, 2)}\n\`\`\`\n\n**Result:**\n\`\`\`json\n${formatResult(result.output)}\n\`\`\`\n\n`);
            messages.push(result);

            const flagMatch = result.output.match(/\{FLG:[^}]+\}|"FLG"\s*:\s*"([^"]+)"/i);
            if (flagMatch) {
                const flag = flagMatch[0];
                log.success(`FLAG FOUND in tool result: ${flag}`);
                await write(`## Flag Found\n\n${flag}\n\n`);
                return { response: flag, toolCalls: toolCallHistory };
            }
        }

        await write(`---\n\n`);
    }

    throw new Error(`Max steps (${MAX_STEPS}) reached`);
};
