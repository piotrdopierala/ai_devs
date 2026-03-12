import { startHttpServer, saveHistory } from "./server.js";
import log from "./helpers/logger.js";
import {server as serverConfig} from "./config.js";

const main = async () => {
    log.box("Starting Task 01_03\nChatbot over HTTP, tools usage.");

    const server = startHttpServer(serverConfig, () => ({mcpClient, mcpTools}));

    const shutdown = async () => {
        log.warn("Shutting down...");
        await saveHistory();
        server.close();
        process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
};

main().catch((error) => {
    log.error("Startup error", error.message);
    process.exit(1);
});