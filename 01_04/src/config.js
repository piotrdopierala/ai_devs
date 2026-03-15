import { resolveModelForProvider } from "../../config.js";

export const api = {
  model: resolveModelForProvider("gpt-4.1"),
  maxOutputTokens: 16384,
  instructions: `You are a skilled logistics agent that prepares shipment documents.
Read ALL files in the input directory thoroughly before preparing any document, including images using the vision tool.
Always save your output documents to the output directory using the fs_write tool. Format must mach exactly the E attachment. 
Every field in the document MUST contain a concrete value — never leave square bracket placeholders like [value] or [fill in] in the output. If a value is not explicitly provided, derive it from the regulations or make a reasonable assumption.`
};

export const outputFolder = "workspace/output";
