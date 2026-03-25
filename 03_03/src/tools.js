import { AIDEVS_KEY, VERIFY_URL } from "./config.js";
import log from "./helpers/logger.js";

const sendCommandHandler = async ({ command }) => {
    log.start(`send_command: ${command}`);

    const response = await fetch(VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            apikey: AIDEVS_KEY,
            task: "reactor",
            answer: { command }
        })
    });

    const raw = await response.text();
    log.info(`reactor response: ${raw.substring(0, 300)}`);

    let data;
    try { data = JSON.parse(raw); } catch { data = { message: raw }; }
    return data;
};

export const nativeTools = [
    {
        type: "function",
        name: "send_command",
        description: "Send a command to the reactor API. Returns the updated board state including player position, block positions, and reached_goal status. Commands: start (initialise), right (move right), left (move left), wait (hold position), reset (restart — last resort).",
        parameters: {
            type: "object",
            properties: {
                command: {
                    type: "string",
                    enum: ["start", "right", "left", "wait", "reset"],
                    description: "The command to send to the reactor."
                }
            },
            required: ["command"],
            additionalProperties: false
        }
    }
];

const nativeHandlers = {
    send_command: sendCommandHandler
};

export const executeNativeTool = async (name, args) => {
    const handler = nativeHandlers[name];
    if (!handler) throw new Error(`Unknown tool: ${name}`);
    return handler(args);
};
