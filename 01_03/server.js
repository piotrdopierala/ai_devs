import { createServer } from "node:http";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chat } from "./agent.js";
import log from "./helpers/logger.js";

const sessions = new Map();

const readJson = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });

const sendJson = (res, status, data) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
};

// --- route handlers ---

const postChat = async (req, res) => {
  const { sessionID, msg } = await readJson(req);

  if (!sessionID || !msg) {
    sendJson(res, 400, { error: "sessionID and msg are required" });
    return;
  }

  const history = sessions.get(sessionID) ?? [];
  log.httpIn(sessionID, msg, history.length);

  const conversation = [...history, { role: "user", content: msg }];
  const answer = await chat(conversation);

  sessions.set(sessionID, [...conversation, { role: "assistant", content: answer }]);
  log.httpOut(sessionID, answer);
  sendJson(res, 200, { msg: answer });
};

// --- router ---

export const createRequestHandler = () => async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (url.pathname === "/api/chat" && req.method === "POST") {
      await postChat(req, res);
      return;
    }

    res.writeHead(404);
    res.end();
  } catch (err) {
    log.error(err.message);
    sendJson(res, 500, { error: err.message });
  }
};

// --- history persistence ---

export const saveHistory = async () => {
  const outputDir = join(process.cwd(), "output");
  await mkdir(outputDir, { recursive: true });

  const lines = [];
  for (const [sessionID, messages] of sessions) {
    lines.push(`=== Session: ${sessionID} ===`);
    for (const { role, content } of messages) {
      lines.push(`[${role}]: ${content}`);
    }
    lines.push("");
  }

  await writeFile(join(outputDir, "chat-history.txt"), lines.join("\n"), "utf8");
};

// --- server ---

export const startHttpServer = (serverConfig) => {
  const httpServer = createServer(createRequestHandler());

  httpServer.listen(serverConfig.port, serverConfig.host, () => {
    log.ready(`http://${serverConfig.host}:${serverConfig.port}`);
    log.endpoint("POST", "/api/chat", "send message");
  });

  return httpServer;
};
