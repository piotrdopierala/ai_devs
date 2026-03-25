import log from "./src/helpers/logger.js";
import { logStats } from "./src/helpers/stats.js";
import { run } from "./src/agent.js";

const main = async () => {
    log.box("Reactor Agent\n03_03: LLM-guided robot navigation → reactor goal");

    const query = "Send the 'start' command first to initialise the board, then navigate the robot step by step to the goal at column 7, row 5. After each command, analyse the board and blocks data carefully before deciding your next move. Keep sending commands until reached_goal is true.";

    const { response } = await run(query);

    log.response(response);
    logStats();
};

main().catch((err) => {
    log.error("Fatal", err.message);
    console.error(err);
    process.exit(1);
});
