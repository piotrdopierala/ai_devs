/**
 * Agentic loop: chat → tools → results → repeat until done.
 * Supports both MCP and native tools with conversation state.
 */

import { chat, extractToolCalls, extractText } from "./api.js";
import { callMcpTool, mcpToolsToOpenAI } from "./mcp/client.js";
import { nativeTools, isNativeTool, executeNativeTool } from "./native/tools.js";
import { api } from "./config.js";
import log from "./helpers/logger.js";
import { createFileLogger } from "./helpers/file-logger.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..");

const MAX_STEPS = 30;

// Extract any explanatory text the model produced alongside tool calls.
const extractModelText = (response) =>
  (response.output ?? [])
    .filter(item => item.type === "message")
    .flatMap(item => item.content ?? [])
    .filter(c => c.type === "output_text" && c.text?.trim())
    .map(c => c.text)
    .join("\n");

// Pretty-print a tool result, truncating if very long.
const formatResult = (jsonString) => {
  let parsed;
  try { parsed = JSON.parse(jsonString); } catch { return jsonString; }
  const pretty = JSON.stringify(parsed, null, 2);
  return pretty.length > 2000
    ? pretty.slice(0, 2000) + "\n\n... [truncated — full result passed to model]"
    : pretty;
};

const runTool = async (mcpClient, toolCall) => {
  const args = JSON.parse(toolCall.arguments);
  log.tool(toolCall.name, args);

  try {
    const result = isNativeTool(toolCall.name)
        ? await executeNativeTool(toolCall.name, args)
        : await callMcpTool(mcpClient, toolCall.name, args);

    const output = JSON.stringify(result);
    log.toolResult(toolCall.name, true, output);
    return { type: "function_call_output", call_id: toolCall.call_id, output };
  } catch (error) {
    const output = JSON.stringify({ error: error.message });
    log.toolResult(toolCall.name, false, error.message);
    return { type: "function_call_output", call_id: toolCall.call_id, output };
  }
};

const runTools = (mcpClient, toolCalls) =>
    Promise.all(toolCalls.map(tc => runTool(mcpClient, tc)));

export const run = async (query, { mcpClient, mcpTools, conversationHistory = [] }) => {
  const tools = [...mcpToolsToOpenAI(mcpTools), ...nativeTools];
  const messages = [...conversationHistory, { role: "user", content: query }];
  const toolCallHistory = [];

  log.query(query);

  // Create run log file.
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logPath = join(PROJECT_ROOT, "workspace", "output", `run-${timestamp}.md`);
  const write = await createFileLogger(logPath);
  log.info(`Run log: ${logPath}`);

  await write(
`# Agent Run Log

> This log documents a complete agent run step by step.
> Each step shows what the model decided to do, which tools it called,
> and what results it received — so you can follow the full reasoning process.

- **Date**: ${new Date().toISOString()}
- **Model**: ${api.model}
- **Max steps**: ${MAX_STEPS}

## Task

${query}

## System Instructions

${api.instructions}

---

`);

  for (let step = 1; step <= MAX_STEPS; step++) {
    log.api(`Step ${step}`, messages.length);

    await write(`## Step ${step}\n\n`);
    await write(`> Context: ${messages.length} message(s) sent to the model.\n\n`);

    const response = await chat({ input: messages, tools });
    log.apiDone(response.usage);

    // Log any reasoning text the model produced before its tool calls.
    const modelText = extractModelText(response);
    if (modelText) {
      await write(`**Model reasoning:**\n\n${modelText}\n\n`);
    }

    const toolCalls = extractToolCalls(response);

    // No tool calls = model is done, return final answer.
    if (toolCalls.length === 0) {
      const text = extractText(response) ?? "No response";
      messages.push(...response.output);

      await write(`**The model produced no tool calls — the task is complete.**\n\n`);
      await write(`## Final Answer\n\n${text}\n\n---\n\n`);
      await write(`## Run Summary\n\n`);
      await write(`- **Steps taken**: ${step}\n`);
      await write(`- **Total tool calls**: ${toolCallHistory.length}\n`);
      await write(`- **Tools used**: ${[...new Set(toolCallHistory.map(t => t.name))].join(", ") || "none"}\n`);

      log.success(`Run log saved: ${logPath}`);
      return { response: text, toolCalls: toolCallHistory, conversationHistory: messages };
    }

    messages.push(...response.output);

    // Log tool calls and their results.
    await write(`**The model decided to call ${toolCalls.length} tool(s):**\n\n`);

    for (const tc of toolCalls) {
      toolCallHistory.push({ name: tc.name, arguments: JSON.parse(tc.arguments) });
    }

    const results = await runTools(mcpClient, toolCalls);

    for (let i = 0; i < toolCalls.length; i++) {
      const tc = toolCalls[i];
      const result = results[i];
      const args = JSON.parse(tc.arguments);
      let parsed;
      try { parsed = JSON.parse(result.output); } catch { parsed = result.output; }
      const success = !parsed?.error;

      await write(`### ${i + 1}. \`${tc.name}\` ${success ? "✅" : "❌"}\n\n`);
      await write(`**Why:** Retrieve data needed to continue the task.\n\n`);
      await write(`**Input:**\n\`\`\`json\n${JSON.stringify(args, null, 2)}\n\`\`\`\n\n`);
      await write(`**Result:**\n\`\`\`json\n${formatResult(result.output)}\n\`\`\`\n\n`);
    }

    if (response.usage) {
      await write(`**Tokens this step:** ${response.usage.input_tokens} in / ${response.usage.output_tokens} out\n\n`);
    }

    await write(`---\n\n`);

    messages.push(...results);
  }

  throw new Error(`Max steps (${MAX_STEPS}) reached`);
};
