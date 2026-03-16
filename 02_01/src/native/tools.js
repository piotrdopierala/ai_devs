import { AIDEVS_KEY, VERIFY_URL } from "../config.js";
import log from "../helpers/logger.js";
import { appendFile, mkdir, readFile, writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "../..");
const INPUT_DIR = join(PROJECT_ROOT, "workspace", "input");
const FAILURES_LOG = join(INPUT_DIR, "failures.md");
const PACKAGES_CSV = join(INPUT_DIR, "packages.csv");
const CSV_URL = `https://<BASE_URL>/data/${AIDEVS_KEY}/categorize.csv`;

const fetchPackagesCSVHandler = async () => {
    const response = await fetch(CSV_URL);
    if (!response.ok) throw new Error(`Failed to fetch CSV: ${response.status}`);
    const csv = await response.text();
    await mkdir(INPUT_DIR, { recursive: true });
    await writeFile(PACKAGES_CSV, csv);
    return { csv };
};

const findPackageDescription = (id, csv) => {
    if (!csv || !id) return null;
    const line = csv.split("\n").find((l) => l.startsWith(id + ","));
    return line ? line.slice(id.length + 1).replace(/^"|"$/g, "") : null;
};

const saveFailureLog = async ({ prompt, response }) => {
    const idMatch = prompt.match(/\b(i\d+)\b/);
    const id = idMatch?.[1] ?? null;
    let packages = null;
    try { packages = await readFile(PACKAGES_CSV, "utf-8"); } catch { /* not yet fetched */ }
    const description = id ? findPackageDescription(id, packages) : null;

    let parsed;
    try { parsed = JSON.parse(response); } catch { /* ignore */ }
    const errorMessage = parsed?.message ?? response;
    const debug = parsed?.debug ?? null;

    const lines = [
        `- Package: \`${id ?? "unknown"}\` — ${description ?? "unknown"}`,
        `- Error: ${errorMessage}`,
        debug ? `- Debug: ${JSON.stringify(debug)}` : null,
        `- Prompt: "${prompt}"`
    ].filter(Boolean);

    await appendFile(FAILURES_LOG, lines.join("\n") + "\n\n");
};

export const reset = async () => {
    log.info("Calling reset...");
    const response = await fetch(VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            apikey: AIDEVS_KEY,
            task: "categorize",
            answer: { prompt: "reset" }
        })
    });
    const data = await response.json();
    log.info(`Reset response: ${JSON.stringify(data)}`);
    return data;
};

const submitPromptHandler = async ({ prompt }) => {
    const response = await fetch(VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            apikey: AIDEVS_KEY,
            task: "categorize",
            answer: { prompt }
        })
    });
    const raw = await response.text();
    log.info(`RAW response: ${raw}`);
    let data;
    try { data = JSON.parse(raw); } catch { data = { raw }; }

    if (data.balance !== undefined || data.debug?.balance !== undefined) {
        const balance = data.balance ?? data.debug?.balance;
        log.info(`Balance: ${balance}`);
    }

    if (data.code < 0 || data.error) {
        await saveFailureLog({ prompt, response: JSON.stringify(data) });
    }

    return data;
};

const waitHandler = async ({ time }) => {
    await new Promise((resolve) => setTimeout(resolve, time * 1000));
    return { waited: time };
};

export const nativeTools = [
    {
        type: "function",
        name: "fetch_packages_csv",
        description: "Fetch the list of packages with their content descriptions from the API.",
        parameters: {
            type: "object",
            properties: {},
            additionalProperties: false
        }
    },
    {
        type: "function",
        name: "submit_categorization_prompt",
        description: "Submit a prompt for ONE specific package to the categorization API. Call this once per package (10 times total). The prompt MUST contain the item identifier (e.g. i0173). Put static instructions FIRST and the item ID at the END to maximize cache hits. The final successful call (10th package) will return a FLG code.",
        parameters: {
            type: "object",
            properties: {
                prompt: {
                    type: "string",
                    description: "Full prompt for this specific package. Must include the item ID. Must cause the small LLM to respond with ONLY 'DNG' (dangerous) or 'NEU' (neutral)."
                }
            },
            required: ["prompt"],
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

export const nativeHandlers = {
    fetch_packages_csv: fetchPackagesCSVHandler,
    submit_categorization_prompt: submitPromptHandler,
    wait: waitHandler
};

export const isNativeTool = (name) => name in nativeHandlers;

export const executeNativeTool = async (name, args) => {
    const handler = nativeHandlers[name];
    if (!handler) throw new Error(`Unknown native tool: ${name}`);
    return handler(args);
};
