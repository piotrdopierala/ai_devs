import { readFile } from "fs/promises";
import { join, extname } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { chat, extractText } from "../api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WORKSPACE_ROOT = join(__dirname, "../../workspace");

const MIME_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp"
};

const visionHandler = async ({ path, question }) => {
  const imagePath = join(WORKSPACE_ROOT, path);
  const mimeType = MIME_TYPES[extname(path).toLowerCase()] ?? "image/png";
  const base64 = (await readFile(imagePath)).toString("base64");

  const response = await chat({
    input: [{
      role: "user",
      content: [
        { type: "input_text", text: question },
        { type: "input_image", image_url: `data:${mimeType};base64,${base64}` }
      ]
    }],
    tools: undefined
  });

  return { answer: extractText(response) };
};

export const nativeTools = [
  {
    type: "function",
    name: "vision",
    description: "Analyze an image file from the workspace and answer a question about its contents.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the image file relative to workspace root (e.g. 'input/trasy-wylaczone.png')"
        },
        question: {
          type: "string",
          description: "Question to ask about the image"
        }
      },
      required: ["path", "question"],
      additionalProperties: false
    }
  }
];

export const nativeHandlers = { vision: visionHandler };

export const isNativeTool = (name) => name in nativeHandlers;

export const executeNativeTool = async (name, args) => {
  const handler = nativeHandlers[name];
  if (!handler) throw new Error(`Unknown native tool: ${name}`);
  return handler(args);
};
