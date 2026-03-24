import log from "./src/helpers/logger.js";
import { logStats } from "./src/helpers/stats.js";
import { run } from "./src/agent.js";

const main = async () => {
    log.box("Firmware Agent\n03_02: shell API → explore → configure → run binary → submit");

    const query = "Please start by running 'help' to learn the available commands on this VM shell, then work step by step to run the firmware binary at /opt/firmware/cooler/cooler.bin and obtain the ECCS code. Once you have it, submit it.";

    const { response } = await run(query);

    log.response(response);
    logStats();
};

main().catch((err) => {
    log.error("Fatal", err.message);
    console.error(err);
    process.exit(1);
});
