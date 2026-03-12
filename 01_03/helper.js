import log from "./helpers/logger.js";

export const getToolCalls = (response) =>
  response.output.filter((item) => item.type === "function_call");

export const getFinalText = (response) =>
  response.output_text
  ?? response.output.find((item) => item.type === "message")?.content?.[0]?.text
  ?? "No response";

export const logToolCall = (name, args) => {
  log.tool(name, args);
};

export const logToolResult = (name, result, elapsedMs) => {
  log.toolResult(name, true, `${JSON.stringify(result)} (${elapsedMs}ms)`);
};

export const logToolError = (name, error, elapsedMs) => {
  log.toolResult(name, false, `${error.message} (${elapsedMs}ms)`);
};

export const executeToolCall = async (call, handlers) => {
  const args = JSON.parse(call.arguments);
  const handler = handlers[call.name];

  if (!handler) {
    throw new Error(`Unknown tool: ${call.name}`);
  }

  logToolCall(call.name, args);
  const start = Date.now();
  try {
    const result = await handler(args);
    logToolResult(call.name, result, Date.now() - start);
    return {
      type: "function_call_output",
      call_id: call.call_id,
      output: JSON.stringify(result),
    };
  } catch (error) {
    logToolError(call.name, error, Date.now() - start);
    throw error;
  }
};

export const buildNextConversation = async (conversation, toolCalls, handlers) => {
  const toolResults = await Promise.all(
    toolCalls.map((call) => executeToolCall(call, handlers)),
  );

  return [...conversation, ...toolCalls, ...toolResults];
};
