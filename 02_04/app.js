import log from "./src/helpers/logger.js";
import { logStats } from "./src/helpers/stats.js";
import { run } from "./src/agent.js";

const TASK = `Search the email inbox to find 3 values and submit them to Headquarters.

STEPS:
1. Call search_mail with action "help" to discover the API.
2. Browse the inbox to see what emails are available.
3. Find the attack date — look for emails from Wiktor (proton.me) or mentioning an attack/atak.
4. Find the password — search for emails about passwords/hasło.
5. Find the confirmation code — search for SEC- codes or security-related emails.
6. Read each relevant email fully with get_message before extracting values.
7. Submit all 3 values with submit_answer.
8. If rejected, re-search and try again. The mailbox is live.`;

const main = async () => {
    log.box("Mailbox Search Agent\nTask: search inbox → find password, date, code → submit to HQ");

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
