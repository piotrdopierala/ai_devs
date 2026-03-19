import log from "./src/helpers/logger.js";
import { logStats } from "./src/helpers/stats.js";
import { run } from "./src/agent.js";

const TASK = `Analyze the power plant incident log from yesterday and help Headquarters perform a root cause analysis.

STEPS:
1. Call get_log_summary to understand the log size and contents.
2. Search for CRIT and ERRO events — these are the core of the failure.
3. Search for WARN events on components involved in critical failures.
4. Build a condensed log (one event per line, format: YYYY-MM-DD HH:MM [SEV] COMPONENT: description).
5. Count tokens — must be ≤1500. Trim if needed.
6. Submit to Headquarters and read their feedback.
7. Based on feedback, search for missing components and update the log.
8. Recount tokens, resubmit. Repeat until you receive a {FLG:...} flag.`;

const main = async () => {
    log.box("Power Plant Log Analyzer\nTask: compress incident logs → submit to HQ → iterate until flag");

    const { response } = await run(TASK);
    log.response(response);

    const flagMatch = response.match(/\{FLG:[^}]+\}/i);
    if (flagMatch) {
        log.success(`FLAG: ${flagMatch[0]}`);
    }

    logStats();
};

main().catch((err) => {
    log.error("Fatal", err.message);
    console.error(err);
    process.exit(1);
});
