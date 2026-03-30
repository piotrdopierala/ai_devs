import { fileURLToPath } from "url";
import { dirname, join } from "path";
import log from "./src/helpers/logger.js";
import { createFileLogger } from "./src/helpers/file-logger.js";
import { logStats } from "./src/helpers/stats.js";
import { run } from "./src/agent.js";
import { initWebPanel, closeBrowser } from "./src/web-panel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const main = async () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const logPath = join(__dirname, "workspace", "output", `run-${timestamp}.md`);
    const write = await createFileLogger(logPath);
    log.info(`Run log: ${logPath}`);

    await write(`# okoeditor Run Log\n\n- **Date**: ${new Date().toISOString()}\n\n---\n\n`);

    // Login to OKO web panel before the agent starts — credentials never enter the agent loop
    log.info("Logging in to OKO web panel...");
    await initWebPanel();

    const result = await run(write);

    const responseText = JSON.stringify(result);
    const flagMatch = responseText.match(/\{FLG:[^}]+\}/i);

    if (flagMatch) {
        log.success(`Done! Flag: ${flagMatch[0]}`);
        await write(`\n## Result\n\nFlag: \`${flagMatch[0]}\`\n`);
    } else {
        log.warn(`No flag found in final response: ${responseText.substring(0, 300)}`);
        await write(`\n## Result\n\nNo flag. Response: \`${responseText.substring(0, 500)}\`\n`);
    }

    logStats();
};

main().catch((err) => {
    log.error("Fatal", err.message);
    process.exit(1);
});
