import { AIDEVS_KEY, VERIFY_URL, ZMAIL_URL } from "./config.js";
import log from "./helpers/logger.js";

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ── Tool Handlers ─────────────────────────────────────────────────────────────

const waitHandler = async ({ seconds }) => {
    const ms = Math.min(seconds, 30) * 1000;
    log.info(`Waiting ${Math.min(seconds, 30)}s for new emails...`);
    await delay(ms);
    return { waited: Math.min(seconds, 30) };
};

const searchMailHandler = async ({ action, ...params }) => {
    const body = { apikey: AIDEVS_KEY, action, ...params };

    log.start(`zmail API: action=${action}, params=${JSON.stringify(params)}`);

    const response = await fetch(ZMAIL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    const raw = await response.text();
    log.info(`zmail response: ${raw.substring(0, 200)}`);

    let data;
    try { data = JSON.parse(raw); } catch { data = { message: raw }; }
    return data;
};

const getMessageHandler = async ({ id }) => {
    log.start(`zmail getMessage: id=${id}`);

    const response = await fetch(ZMAIL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apikey: AIDEVS_KEY, action: "getMessage", id })
    });

    const raw = await response.text();
    log.info(`getMessage response: ${raw.substring(0, 200)}`);

    let data;
    try { data = JSON.parse(raw); } catch { data = { message: raw }; }
    return data;
};

const submitAnswerHandler = async ({ password, date, confirmation_code }) => {
    log.start(`Submitting answer: date=${date}, password=${password}, code=${confirmation_code}`);

    const response = await fetch(VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            apikey: AIDEVS_KEY,
            task: "mailbox",
            answer: { password, date, confirmation_code }
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
        name: "wait",
        description: "Wait for a number of seconds before continuing. Use this when you've checked all existing emails but are still missing values — new emails may arrive in the live mailbox. Wait 10 seconds then re-check the inbox.",
        parameters: {
            type: "object",
            properties: {
                seconds: {
                    type: "number",
                    description: "How many seconds to wait (max 30)."
                }
            },
            required: ["seconds"],
            additionalProperties: false
        }
    },
    {
        type: "function",
        name: "search_mail",
        description: "Call the zmail API with a given action. Start with action 'help' to discover available actions. All extra parameters (query, page, ids, etc.) are forwarded to the API as-is.",
        parameters: {
            type: "object",
            properties: {
                action: {
                    type: "string",
                    description: "The API action to perform (e.g. 'help', 'getInbox', 'search', 'getMessages')."
                },
                query: {
                    type: "string",
                    description: "Search query or filter. Used with 'search' action."
                },
                page: {
                    type: "number",
                    description: "Page number for paginated results."
                },
                ids: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of message IDs. Used with 'getMessages' action."
                }
            },
            required: ["action"],
            additionalProperties: true
        }
    },
    {
        type: "function",
        name: "get_message",
        description: "Fetch the full content of an email by its ID. Use this after finding emails in the inbox to read their complete body text.",
        parameters: {
            type: "object",
            properties: {
                id: {
                    type: "string",
                    description: "The email message ID to retrieve."
                }
            },
            required: ["id"],
            additionalProperties: false
        }
    },
    {
        type: "function",
        name: "submit_answer",
        description: "Submit the collected values (password, attack date, confirmation code) to Headquarters for verification. Returns feedback or a {FLG:...} flag on success.",
        parameters: {
            type: "object",
            properties: {
                password: {
                    type: "string",
                    description: "The password found in the mailbox."
                },
                date: {
                    type: "string",
                    description: "The attack date found in the mailbox."
                },
                confirmation_code: {
                    type: "string",
                    description: "The confirmation/security code found in the mailbox."
                }
            },
            required: ["password", "date", "confirmation_code"],
            additionalProperties: false
        }
    }
];

const nativeHandlers = {
    wait: waitHandler,
    search_mail: searchMailHandler,
    get_message: getMessageHandler,
    submit_answer: submitAnswerHandler
};

export const executeNativeTool = async (name, args) => {
    const handler = nativeHandlers[name];
    if (!handler) throw new Error(`Unknown tool: ${name}`);
    return handler(args);
};
