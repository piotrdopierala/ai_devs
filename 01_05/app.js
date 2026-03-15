import log from "./src/helpers/logger.js";
import { logStats } from "./src/helpers/stats.js";
import { run } from "./src/agent.js";

const main = async () => {
    log.box("Railway activation agent");

    const task = "Activate railroad route X-01.";

    const { response } = await run(task);
    log.response(response);
    logStats();
};

main().catch((err) => {
    log.error("Fatal", err.message);
    process.exit(1);
});
