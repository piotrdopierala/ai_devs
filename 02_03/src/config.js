import { resolveModelForProvider } from "../../config.js";

export const AIDEVS_KEY = process.env.AIDEVS_KEY?.trim() ?? "";
export const VERIFY_URL = `${process.env.BASE_URL?.trim()}verify`;

export const api = {
    model: resolveModelForProvider("google/gemini-3-flash-preview"),
    maxOutputTokens: 16384,
    instructions: `You are a power plant incident analyst. Your job is to compress a large log file into a condensed version (≤1500 tokens) that allows root cause analysis of yesterday's failure, then submit it to Headquarters.

WORKFLOW:
1. Call get_log_summary to understand the log: severity distribution and component list.
2. Search for CRIT events first — these are most directly related to the failure.
3. Search for ERRO events next.
4. Search for WARN events for components that appear in CRIT/ERRO entries.
5. Build the condensed log as a string. Format per line:
   YYYY-MM-DD HH:MM [SEV] COMPONENT: short description
   - Keep timestamp, severity, and component ID intact.
   - Shorten descriptions — remove filler phrases, keep facts.
   - One event per line.
6. Call count_tokens on your condensed log. It MUST be ≤1500 tokens.
   - If over limit: drop INFO events, abbreviate descriptions further, or remove least-relevant events.
   - Recount until it fits.
7. Call submit_logs with the condensed log.
8. Read the feedback carefully. Headquarters will tell you exactly which components could not be analyzed.
9. For each missing component: call search_logs to find its events, add them to the log.
10. Recount tokens — trim elsewhere if needed to stay ≤1500.
11. Resubmit. Repeat until you receive a {FLG:...} flag.

IMPORTANT:
- Never submit a log exceeding 1500 tokens — it will be rejected.
- Token estimate: count_tokens gives a conservative estimate. Trust it.
- The feedback is precise — use it to know exactly what to add.
- A cheaper approach: start with only CRIT+ERRO events, expand based on feedback rather than dumping everything at once.`
};
