import { chat, extractToolCalls, extractText } from "../api.js";
import { executorConfig } from "./config.js";
import { nativeTools, executeTool, initTools } from "./tools.js";
import log from "../helpers/logger.js";
import { confirm, printState } from "../helpers/confirm.js";

const formatResult = (jsonString) => {
    let parsed;
    try { parsed = JSON.parse(jsonString); } catch { return jsonString; }
    const pretty = JSON.stringify(parsed, null, 2);
    return pretty.length > 2000 ? pretty.slice(0, 2000) + "\n\n... [truncated]" : pretty;
};

export const executeMission = async (coordinates, docsPath, write) => {
    initTools(docsPath);
    const instructions = executorConfig.buildInstructions(coordinates);
    const messages = [{ role: "user", content: "Execute the drone mission. Submit the instruction sequence and handle any errors." }];

    printState("MISSION EXECUTOR — System prompt", instructions);
    printState("MISSION EXECUTOR — Tools", nativeTools.map(t => t.name));
    await confirm("About to start Mission Executor agent loop");

    for (let step = 1; step <= executorConfig.maxSteps; step++) {
        // Gate: before each LLM call
        printState(`MISSION EXECUTOR — Step ${step}/${executorConfig.maxSteps}`, {
            messageCount: messages.length,
            lastMessage: messages[messages.length - 1]
        });
        await confirm(`About to send step ${step} to ${executorConfig.model}`);

        log.api(`Executor Step ${step}`, messages.length);
        const response = await chat({
            model: executorConfig.model,
            input: messages,
            tools: nativeTools,
            instructions,
            maxOutputTokens: executorConfig.maxOutputTokens
        });
        log.apiDone(response.usage);

        const toolCalls = extractToolCalls(response);

        if (toolCalls.length === 0) {
            const text = extractText(response) ?? "No response";
            await write(`## Final Answer\n\n${text}\n\n`);
            printState("MISSION EXECUTOR — Final response (no tool calls)", text);
            return text;
        }

        messages.push(...response.output);

        for (const tc of toolCalls) {
            const args = JSON.parse(tc.arguments);
            log.tool(tc.name, args);

            await write(`### Step ${step} — \`${tc.name}\`\n\n**Input:**\n\`\`\`json\n${JSON.stringify(args, null, 2)}\n\`\`\`\n\n`);

            try {
                const result = await executeTool(tc.name, args);
                const output = JSON.stringify(result);
                log.toolResult(tc.name, true, output);

                // Gate: after each tool result
                printState(`MISSION EXECUTOR — Tool result: ${tc.name}`, formatResult(output));
                await confirm(`Step ${step} tool result received. Continue?`);

                await write(`**Result:**\n\`\`\`json\n${formatResult(output)}\n\`\`\`\n\n`);
                messages.push({ type: "function_call_output", call_id: tc.call_id, output });

                const flagMatch = output.match(/\{FLG:[^}]+\}|"FLG"\s*:\s*"([^"]+)"/i);
                if (flagMatch) {
                    log.success(`FLAG FOUND: ${flagMatch[0]}`);
                    await write(`## Flag Found\n\n${flagMatch[0]}\n\n`);
                    return flagMatch[0];
                }
            } catch (error) {
                const output = JSON.stringify({ error: error.message });
                log.toolResult(tc.name, false, error.message);
                printState(`MISSION EXECUTOR — Tool error: ${tc.name}`, error.message);
                await write(`**Error:**\n\`\`\`\n${error.message}\n\`\`\`\n\n`);
                messages.push({ type: "function_call_output", call_id: tc.call_id, output });
            }
        }

        await write(`---\n\n`);
    }

    throw new Error(`Max steps (${executorConfig.maxSteps}) reached without finding flag`);
};
