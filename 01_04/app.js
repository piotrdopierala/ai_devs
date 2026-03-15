/**
 * Shipment document generation agent app
 */

import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { createMcpClient, listMcpTools } from "./src/mcp/client.js";
import { onShutdown } from "./src/helpers/shutdown.js";
import { logStats } from "./src/helpers/stats.js";
import log from "./src/helpers/logger.js";
import { run } from "./src/agent.js";

const main = async () => {
  log.box("Shipment document generation agent");
  const task = `Prepare a shipment document on route: Gdańsk - Żarnowiec. 
  Our budget is 0 PP, use packages financed by System. 
  Save the document to the output directory. 
  All placeholders must be filled with concrete values derived from the regulations — no field may be left blank or as a placeholder.
  Additional data to be used in the form : | Pole | Wartość | | --- | --- | | Nadawca (identyfikator) | 450202122 | | Punkt nadawczy | Gdańsk | | Punkt docelowy | Żarnowiec | | Waga | 2,8 tony (2800 kg) | | Budżet | 0 PP (przesyłka ma być darmowa lub finansowana przez System) | | Zawartość | kasety z paliwem do reaktora | | Uwagi specjalne | brak - nie dodawaj żadnych uwag |`;

  let mcpClient;

  try {
    log.start("Connecting to MCP server...");
    mcpClient = await createMcpClient();
    const mcpTools = await listMcpTools(mcpClient);
    log.success(`MCP: ${mcpTools.map((tool) => tool.name).join(", ")}`);

    const shutdown = onShutdown(async () => {
      logStats();
      if (mcpClient) await mcpClient.close();
    });

    const { response, toolCalls } = await run(task, { mcpClient, mcpTools });
    log.response(response);

    // Find the output document written by the agent and save a JSON-stringified version.
    const writeCall = toolCalls.find(tc =>
      tc.name === "fs_write" &&
      tc.arguments.path?.startsWith("output/") &&
      !tc.arguments.path.includes("terminal_message")
    );
    if (writeCall) {
      const docPath = join("workspace", writeCall.arguments.path);
      const content = await readFile(docPath, "utf-8");
      const msgPath = join("workspace", "output", "answer.txt");
      await writeFile(msgPath, JSON.stringify(content));
      log.success(`answer.txt saved`);
    }

    await shutdown();
  } catch (error) {
    if (mcpClient) {
      await mcpClient.close().catch(() => {});
    }
    throw error;
  }
};

main().catch((err) => {
  log.error("Startup error", err.message);
  process.exit(1);
});
