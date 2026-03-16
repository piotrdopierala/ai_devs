import { readFile } from "fs/promises";
import readline from "readline";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import log from "./src/helpers/logger.js";
import { logStats } from "./src/helpers/stats.js";
import { run } from "./src/agent.js";
import { reset } from "./src/native/tools.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FAILURES_LOG = join(__dirname, "workspace", "input", "failures.md");
const MAX_ITERATIONS = 10;

const readFailuresLog = async () => {
    try {
        return await readFile(FAILURES_LOG, "utf-8");
    } catch {
        return null;
    }
};

const buildTask = (failures) => {
    const base = "Design a prompt for a small LLM to categorize packages as dangerous (DNG) or neutral (NEU). Fetch the packages CSV, then call submit_categorization_prompt once per package (10 times total), each time with a prompt that includes the item ID at the end.";
    if (!failures) return base;
    return `${base}\n\nPrevious attempts failed. Use these logs to improve the prompt:\n\n${failures}`;
};

const FLAG_PATTERN = /\{FLG:[^}]+\}/i;

const confirm = (question) => new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim().toLowerCase() === "y");
    });
});

const main = async () => {
    log.box("Package Categorization Prompt Designer");

    for (let i = 1; i <= MAX_ITERATIONS; i++) {
        log.info(`Iteration ${i}/${MAX_ITERATIONS}`);
        await reset();

        const failures = await readFailuresLog();
        const task = buildTask(failures);

        const { response } = await run(task);
        log.response(response);

        if (FLAG_PATTERN.test(response)) {
            log.success("Flag found! Task complete.");
            break;
        }

        const proceed = await confirm("\nContinue with next iteration? (y/n): ");
        if (!proceed) break;
    }

    logStats();
};

main().catch((err) => {
    log.error("Fatal", err.message);
    console.error(err);
    process.exit(1);
});
