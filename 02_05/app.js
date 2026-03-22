import { join, dirname } from "path";
import { fileURLToPath } from "url";
import log from "./src/helpers/logger.js";
import { createFileLogger } from "./src/helpers/file-logger.js";
import { logStats, getStats } from "./src/helpers/stats.js";
import { confirm, printState } from "./src/helpers/confirm.js";
import { downloadResources } from "./src/download.js";
import { analyzeMap } from "./src/map-analysis.js";
import { executeMission } from "./src/mission-executor/agent.js";
import { DRONE_DOCS_URL, DRONE_MAP_URL, models } from "./src/config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const main = async () => {
    log.box("Drone Mission Agent\n02_05: map → docs → instructions → verify");

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const logPath = join(__dirname, "workspace", "output", `run-${timestamp}.md`);
    const write = await createFileLogger(logPath);
    log.info(`Run log: ${logPath}`);

    await write(`# Drone Mission — Run Log\n\n`);
    await write(`- **Date**: ${new Date().toISOString()}\n`);
    await write(`- **Models**: ${models.vision} (vision), ${models.analyst} (analyst), ${models.executor} (executor)\n\n---\n\n`);

    // ── Phase 1: Download ────────────────────────────────────────────────
    log.heading("Phase 1: Download Resources");
    await write(`## Phase 1: Download\n\n`);

    const resources = await downloadResources(DRONE_DOCS_URL, DRONE_MAP_URL);
    await write(`- drone-docs.html: ${resources.docs.size} bytes, status ${resources.docs.status}\n`);
    await write(`- drone.png: ${resources.map.size} bytes, status ${resources.map.status}\n\n`);

    printState("DOWNLOAD COMPLETE", {
        docs: `${resources.docs.size} bytes → ${resources.docs.path}`,
        map: `${resources.map.size} bytes → ${resources.map.path}`
    });
    await confirm("Downloads complete. Proceed to Map Analysis?");

    // ── Phase 2: Map Analysis ────────────────────────────────────────────
    log.heading("Phase 2: Map Analysis");
    await write(`## Phase 2: Map Analysis\n\n`);

    const coordinates = await analyzeMap(resources.map.path);
    await write(`### Result\n\nColumn: ${coordinates.column}, Row: ${coordinates.row}\n`);
    await write(`Grid: ${coordinates.gridSize.columns}x${coordinates.gridSize.rows}\n`);
    await write(`Reasoning: ${coordinates.reasoning}\n\n`);

    // ── Phase 3: Mission Executor ────────────────────────────────────────
    log.heading("Phase 3: Mission Executor");
    await write(`## Phase 3: Mission Executor\n\n`);

    const result = await executeMission(coordinates, resources.docs.path, write);

    // ── Result ───────────────────────────────────────────────────────────
    await write(`## Result\n\n${result}\n\n`);

    const flagMatch = result.match(/\{FLG:[^}]+\}|"FLG"\s*:\s*"([^"]+)"/i);
    if (flagMatch) {
        log.success(`FLAG: ${flagMatch[0]}`);
    } else {
        log.warn("No flag found in final result");
    }

    // ── Stats ────────────────────────────────────────────────────────────
    const stats = getStats();
    await write(`## Token Usage\n\n- Requests: ${stats.requests}\n- Input tokens: ${stats.input}\n- Output tokens: ${stats.output}\n`);
    logStats();

    log.success(`Run log saved: ${logPath}`);
};

main().catch((err) => {
    log.error("Fatal", err.message);
    console.error(err);
    process.exit(1);
});
