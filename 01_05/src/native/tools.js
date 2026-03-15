import { AIDEVS_KEY, RAILWAY_API_URL } from "../config.js";

const performActionHandler = async ({ action_name, parameters = {} }) => {
    const response = await fetch(RAILWAY_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            apikey: AIDEVS_KEY,
            task: "railway",
            answer: { action: action_name, ...parameters }
        })
    });

    return response.json();
};

const waitHandler = async ({ time }) => {
    await new Promise((resolve) => setTimeout(resolve, time * 1000));
    return { waited: time };
};

export const nativeTools = [
    {
        type: "function",
        name: "perform_action",
        description: "Perform a railway API action. All action-specific fields (e.g. route, value) MUST be placed inside the `parameters` object, not at the top level. Example: {action_name: 'setstatus', parameters: {route: 'X-01', value: 'RTOPEN'}}",
        parameters: {
            type: "object",
            properties: {
                action_name: {
                    type: "string",
                    description: "Name of action to perform."
                },
                parameters: {
                    type: "object",
                    description: "Action-specific fields such as route, value. Example: {route: 'X-01'} or {route: 'X-01', value: 'RTOPEN'}."
                }
            },
            required: ["action_name"],
            additionalProperties: false
        }
    },
    {
        type: "function",
        name: "wait",
        description: "Wait before the next action (use when rate limited).",
        parameters: {
            type: "object",
            properties: {
                time: {
                    type: "number",
                    description: "Wait time in seconds."
                }
            },
            required: ["time"],
            additionalProperties: false
        }
    }
];

export const nativeHandlers = { perform_action: performActionHandler, wait: waitHandler };

export const isNativeTool = (name) => name in nativeHandlers;

export const executeNativeTool = async (name, args) => {
    const handler = nativeHandlers[name];
    if (!handler) throw new Error(`Unknown native tool: ${name}`);
    return handler(args);
};
