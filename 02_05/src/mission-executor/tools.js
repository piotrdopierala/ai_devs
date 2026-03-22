import { readFile } from "fs/promises";
import { AIDEVS_KEY, VERIFY_URL, models } from "../config.js";
import { chat, extractText } from "../api.js";
import log from "../helpers/logger.js";

let _docsPath = null;

export const initTools = (docsPath) => {
    _docsPath = docsPath;
};

const submitHandler = async ({ instructions }) => {
    const body = {
        apikey: AIDEVS_KEY,
        task: "drone",
        answer: { instructions }
    };

    log.start(`Submitting ${instructions.length} instructions to /verify`);
    const response = await fetch(VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    const raw = await response.text();
    log.info(`/verify response: ${raw}`);

    let data;
    try { data = JSON.parse(raw); } catch { data = { message: raw }; }
    return data;
};

const analystHandler = async ({ question }) => {
    const docsHtml = await readFile(_docsPath, "utf-8");

    const systemPrompt = `You are a drone documentation analyst. You have the full HTML documentation for a DRN-BMB7 military drone.

WARNING: This documentation intentionally contains traps — conflicting function names, misleading descriptions, and functions that behave differently depending on parameters. Read VERY carefully.

Your job:
- Answer the executor's question by reading the documentation carefully.
- When suggesting instructions, provide a JSON array of instruction strings in a code block.
- If given an error message, analyze what went wrong based on the docs and suggest a corrected sequence.
- Focus on MINIMAL required instructions. Ignore cosmetic/diagnostic functions.
- The overloaded "set" function behaves differently based on parameter format — identify each variant by its parameter type.`;

    const response = await chat({
        model: models.analyst,
        instructions: systemPrompt,
        input: `<drone_documentation>\n${docsHtml}\n</drone_documentation>\n\n${question}`
    });

    return extractText(response);
};

const hardResetHandler = async () => {
    const body = {
        apikey: AIDEVS_KEY,
        task: "drone",
        answer: { instructions: ["hardReset"] }
    };

    log.start("Sending hardReset to /verify");
    const response = await fetch(VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    const raw = await response.text();
    log.info(`hardReset response: ${raw}`);

    let data;
    try { data = JSON.parse(raw); } catch { data = { message: raw }; }
    return data;
};

export const nativeTools = [
    {
        type: "function",
        name: "submit_instructions",
        description: "Submit drone instruction sequence to the /verify endpoint. Returns success with {FLG:...} or an error message describing what went wrong. Adjust instructions based on error feedback and resubmit.",
        parameters: {
            type: "object",
            properties: {
                instructions: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of drone instruction strings to execute, in order."
                }
            },
            required: ["instructions"],
            additionalProperties: false
        }
    },
    {
        type: "function",
        name: "hard_reset",
        description: "Reset the drone to factory configuration. Use this if accumulated errors make the drone unrecoverable. After reset, resubmit the full instruction sequence from scratch.",
        parameters: {
            type: "object",
            properties: {},
            additionalProperties: false
        }
    },
    {
        type: "function",
        name: "ask_analyst",
        description: "Ask the drone documentation analyst for help. Send a question describing what you need (e.g. initial instruction sequence, or what to change after an error). The analyst has full access to the drone API documentation and will suggest instructions. Always include relevant context: what you already tried, what error you got.",
        parameters: {
            type: "object",
            properties: {
                question: {
                    type: "string",
                    description: "Your question for the analyst. Include any error messages or prior attempts for context."
                }
            },
            required: ["question"],
            additionalProperties: false
        }
    }
];

const handlers = {
    submit_instructions: submitHandler,
    hard_reset: hardResetHandler,
    ask_analyst: analystHandler
};

export const executeTool = async (name, args) => {
    const handler = handlers[name];
    if (!handler) throw new Error(`Unknown tool: ${name}`);
    return handler(args);
};
