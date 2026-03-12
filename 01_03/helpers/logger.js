/**
 * Logging with consola - beautiful CLI output.
 * All events are also written to output/app.log with full JSON bodies.
 */

import { createConsola } from "consola";
import { appendFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const LOG_DIR = join(dirname(fileURLToPath(import.meta.url)), "../output");
const LOG_FILE = join(LOG_DIR, "app.log");

const writeToFile = (tag, data) => {
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    const ts = new Date().toISOString();
    const body = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    appendFileSync(LOG_FILE, `[${ts}] [${tag}]\n${body}\n\n`);
  } catch {}
};

// Write session separator on startup
try {
  mkdirSync(LOG_DIR, { recursive: true });
  const sep = `${"=".repeat(60)}\nSession started: ${new Date().toISOString()}\n${"=".repeat(60)}\n\n`;
  appendFileSync(LOG_FILE, sep);
} catch {}

const logger = createConsola({
  level: 4,
  fancy: true,
  formatOptions: {
    date: false,
    colors: true,
    compact: false
  }
});

export const log = {
  // Standard levels
  info:    (msg, ...args) => logger.info(msg, ...args),
  success: (msg, ...args) => logger.success(msg, ...args),
  warn:    (msg, ...args) => logger.warn(msg, ...args),
  debug:   (msg, ...args) => logger.debug(msg, ...args),
  error:   (msg, ...args) => {
    logger.error(msg, ...args);
    writeToFile("ERROR", { message: msg });
  },

  // Server startup
  box:      (msg)           => { logger.box(msg); writeToFile("START", msg); },
  start:    (msg, ...args)  => logger.start(msg, ...args),
  ready:    (msg, ...args)  => logger.ready(msg, ...args),
  endpoint: (method, path, desc) =>
    logger.info(`  ${method.padEnd(5)} ${path.padEnd(18)} ${desc}`),

  // ── HTTP calls ────────────────────────────────────────────────
  httpIn: (sessionID, msg, historyLen) => {
    const isNew = historyLen === 0;
    logger.info(`◀ HTTP IN  [${sessionID}${isNew ? " NEW" : ""}]  "${msg}"`);
    writeToFile("HTTP IN", { sessionID, isNew, historyLen, msg });
  },

  httpOut: (sessionID, answer) => {
    logger.success(`▶ HTTP OUT [${sessionID}]  "${answer}"`);
    writeToFile("HTTP OUT", { sessionID, answer });
  },

  // ── LLM API calls ─────────────────────────────────────────────
  llmRequest: (endpoint, body) => {
    const inputCount = Array.isArray(body.input) ? body.input.length : "?";
    const toolNames  = body.tools?.map(t => t.name).join(", ") ?? "none";
    logger.info(`→ LLM REQUEST  model=${body.model}  input=${inputCount} items  tools=[${toolNames}]`);
    writeToFile("LLM REQUEST", { endpoint, method: "POST", body });
  },

  llmError: (status, data) => {
    logger.error(`← LLM ERROR  HTTP ${status}  ${data?.error?.message ?? "unknown"}`);
    writeToFile("LLM ERROR", { status, body: data });
  },

  llmResponse: (status, data) => {
    const u = data.usage;
    if (u) {
      const cached     = u.input_tokens_details?.cached_tokens ?? 0;
      const cacheRate  = u.input_tokens > 0 ? Math.round((cached / u.input_tokens) * 100) : 0;
      logger.success(`← LLM RESPONSE  HTTP ${status}  in=${u.input_tokens} out=${u.output_tokens} cached=${cached} (${cacheRate}%)`);
    } else {
      logger.success(`← LLM RESPONSE  HTTP ${status}  done`);
    }
    writeToFile("LLM RESPONSE", { status, body: data });
  },

  // ── Tool calls ────────────────────────────────────────────────
  tool: (name, args) => {
    logger.info(`🔧 TOOL CALL  ${name}  ${JSON.stringify(args)}`);
    writeToFile("TOOL CALL", { name, args });
  },

  toolResult: (name, success, detail = "") => {
    if (success) {
      logger.success(`   ↳ TOOL OK    ${name}  ${detail}`);
    } else {
      logger.fail(`   ↳ TOOL FAIL  ${name}  ${detail}`);
    }
    writeToFile("TOOL RESULT", { name, success, detail });
  },
};

export default log;
