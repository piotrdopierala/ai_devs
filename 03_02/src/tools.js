import { AIDEVS_KEY, VERIFY_URL, SHELL_URL } from "./config.js";
import log from "./helpers/logger.js";

// ── Tool Handlers ─────────────────────────────────────────────────────────────

const shellHandler = async ({ cmd }) => {
    log.start(`shell: cmd=${cmd}`);

    const response = await fetch(SHELL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apikey: AIDEVS_KEY, cmd })
    });

    const raw = await response.text();
    log.info(`shell response: ${raw.substring(0, 300)}`);

    let data;
    try { data = JSON.parse(raw); } catch { data = { message: raw }; }

    // For cat/file content responses, add numbered lines so the agent can count correctly
    if (data.code === 150 && typeof data.data === "string") {
        const lines = data.data.split("\n");
        data.numbered_lines = lines.map((line, i) => `${i + 1}: ${line}`).join("\n");
    }

    return data;
};

const submitAnswerHandler = async ({ code }) => {
    log.start(`Submitting ECCS code: ${code}`);

    const response = await fetch(VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            apikey: AIDEVS_KEY,
            task: "firmware",
            answer: { confirmation: code }
        })
    });

    const raw = await response.text();
    log.info(`Hub response: ${raw}`);

    let data;
    try { data = JSON.parse(raw); } catch { data = { message: raw }; }
    return data;
};

// ── Tool Definitions (OpenAI Responses API format) ────────────────────────────

export const nativeTools = [
    {
        type: "function",
        name: "shell",
        description: "Execute a command on the remote VM shell. Start with 'help' to discover available commands. This is a non-standard Linux shell — not all standard commands are available.",
        parameters: {
            type: "object",
            properties: {
                cmd: {
                    type: "string",
                    description: "The shell command to execute on the VM."
                }
            },
            required: ["cmd"],
            additionalProperties: false
        }
    },
    {
        type: "function",
        name: "submit_answer",
        description: "Submit the ECCS code obtained from running the firmware binary. The code follows the format ECCS-xxxxxxxx... Returns feedback or a {FLG:...} flag on success.",
        parameters: {
            type: "object",
            properties: {
                code: {
                    type: "string",
                    description: "The ECCS code to submit (format: ECCS-xxxxxxxx...)."
                }
            },
            required: ["code"],
            additionalProperties: false
        }
    }
];

const nativeHandlers = {
    shell: shellHandler,
    submit_answer: submitAnswerHandler
};

export const executeNativeTool = async (name, args) => {
    const handler = nativeHandlers[name];
    if (!handler) throw new Error(`Unknown tool: ${name}`);
    return handler(args);
};
