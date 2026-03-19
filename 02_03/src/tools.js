import { readFile, writeFile, mkdir } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { AIDEVS_KEY, VERIFY_URL } from "./config.js";
import log from "./helpers/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LOGS_PATH = join(__dirname, "..", "workspace", "input", "LOGS.txt");
const OUTPUT_DIR = join(__dirname, "..", "workspace", "output");
const CONDENSED_PATH = join(OUTPUT_DIR, "condensed.log");

// ── Helpers ──────────────────────────────────────────────────────────────────

const readLogs = async () => {
    const content = await readFile(LOGS_PATH, "utf-8");
    return content.split("\n").filter(Boolean);
};

const parseLine = (line) => {
    // Format: [YYYY-MM-DD HH:MM:SS] [SEV] message with COMPONENT mentions
    const match = line.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] \[(\w+)\] (.+)$/);
    if (!match) return null;
    return { timestamp: match[1], severity: match[2], message: match[3], raw: line };
};

// ── Tool Handlers ─────────────────────────────────────────────────────────────

const getLogSummaryHandler = async () => {
    const lines = await readLogs();
    const severityCounts = {};
    const components = new Set();

    for (const line of lines) {
        const parsed = parseLine(line);
        if (!parsed) continue;
        severityCounts[parsed.severity] = (severityCounts[parsed.severity] ?? 0) + 1;
        // Extract component IDs: uppercase words like ECCS8, WTRPMP, PWR01, FIRMWARE, etc.
        const found = parsed.message.match(/\b[A-Z][A-Z0-9]{2,}\d*\b/g) ?? [];
        for (const c of found) components.add(c);
    }

    return {
        totalLines: lines.length,
        severityCounts,
        components: [...components].sort()
    };
};

const searchLogsHandler = async ({ component, severity, pattern }) => {
    const lines = await readLogs();
    const results = [];

    for (const line of lines) {
        const parsed = parseLine(line);
        if (!parsed) continue;

        const matchesSeverity = !severity || parsed.severity === severity.toUpperCase();
        const matchesComponent = !component || parsed.message.includes(component.toUpperCase());
        const matchesPattern = !pattern || new RegExp(pattern, "i").test(line);

        if (matchesSeverity && matchesComponent && matchesPattern) {
            results.push(line);
        }
    }

    log.info(`search_logs: ${results.length} results (component=${component ?? "*"}, severity=${severity ?? "*"}, pattern=${pattern ?? "*"})`);
    return { count: results.length, lines: results };
};

const countTokensHandler = ({ text }) => {
    // Conservative estimate: ~3.5 chars per token (safer than 4)
    const tokens = Math.ceil(text.length / 3.5);
    const fits = tokens <= 1500;
    log.info(`count_tokens: ~${tokens} tokens — ${fits ? "✓ fits" : "✗ OVER LIMIT"}`);
    return { tokens, fits, limit: 1500 };
};

const submitLogsHandler = async ({ condensed_log }) => {
    const tokenCheck = countTokensHandler({ text: condensed_log });
    if (!tokenCheck.fits) {
        return {
            error: `Log too long: ~${tokenCheck.tokens} tokens (limit: 1500). Trim before submitting.`
        };
    }

    await mkdir(OUTPUT_DIR, { recursive: true });
    await writeFile(CONDENSED_PATH, condensed_log, "utf-8");
    log.info(`Saved condensed log → ${CONDENSED_PATH}`);

    log.start(`Submitting condensed log (~${tokenCheck.tokens} tokens)...`);

    const response = await fetch(VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            apikey: AIDEVS_KEY,
            task: "failure",
            answer: { logs: condensed_log }
        })
    });

    const raw = await response.text();
    log.info(`HQ raw response: ${raw}`);

    let data;
    try { data = JSON.parse(raw); } catch { data = { message: raw }; }

    return data;
};

// ── Tool Definitions (OpenAI Responses API format) ────────────────────────────

export const nativeTools = [
    {
        type: "function",
        name: "get_log_summary",
        description: "Returns total line count, severity distribution (INFO/WARN/ERRO/CRIT counts), and list of all component IDs found in the log file.",
        parameters: {
            type: "object",
            properties: {},
            additionalProperties: false
        }
    },
    {
        type: "function",
        name: "search_logs",
        description: "Search the log file for matching lines. Filter by component name (e.g. 'ECCS8'), severity level (INFO/WARN/ERRO/CRIT), or a text pattern (regex). Returns matching lines. Use this instead of loading the full file.",
        parameters: {
            type: "object",
            properties: {
                component: {
                    type: "string",
                    description: "Component ID to filter by (e.g. 'ECCS8', 'WTRPMP', 'PWR01'). Case-insensitive."
                },
                severity: {
                    type: "string",
                    enum: ["INFO", "WARN", "ERRO", "CRIT"],
                    description: "Severity level to filter by."
                },
                pattern: {
                    type: "string",
                    description: "Regex pattern to match anywhere in the line. Optional."
                }
            },
            additionalProperties: false
        }
    },
    {
        type: "function",
        name: "count_tokens",
        description: "Estimate the token count of a text string using a conservative calculation. Returns { tokens, fits, limit }. Always call this before submit_logs.",
        parameters: {
            type: "object",
            properties: {
                text: {
                    type: "string",
                    description: "The condensed log text to count tokens for."
                }
            },
            required: ["text"],
            additionalProperties: false
        }
    },
    {
        type: "function",
        name: "submit_logs",
        description: "Submit the condensed log to Headquarters for review. Returns feedback from technicians: which components are missing or unclear, or a {FLG:...} flag if analysis is complete. Will reject if over 1500 tokens.",
        parameters: {
            type: "object",
            properties: {
                condensed_log: {
                    type: "string",
                    description: "The condensed log text. One event per line. Format: YYYY-MM-DD HH:MM [SEV] COMPONENT: description. Must be ≤1500 tokens."
                }
            },
            required: ["condensed_log"],
            additionalProperties: false
        }
    }
];

const nativeHandlers = {
    get_log_summary: getLogSummaryHandler,
    search_logs: searchLogsHandler,
    count_tokens: countTokensHandler,
    submit_logs: submitLogsHandler
};

export const executeNativeTool = async (name, args) => {
    const handler = nativeHandlers[name];
    if (!handler) throw new Error(`Unknown tool: ${name}`);
    return handler(args);
};
