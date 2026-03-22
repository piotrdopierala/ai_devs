import { readFile } from "fs/promises";
import { chat, extractText } from "./api.js";
import { models } from "./config.js";
import log from "./helpers/logger.js";
import { confirm, printState } from "./helpers/confirm.js";

const PROMPT = `This aerial image is divided into a grid by red lines. The water near the dam has been boosted to make it visible.

Count the grid columns (left to right) and rows (top to bottom). Locate the dam sector.

Respond with ONLY JSON:
{"column": <number>, "row": <number>, "gridSize": {"columns": <number>, "rows": <number>}, "reasoning": "<explanation>"}`;

const parseCoordinates = (text) => {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in vision response");

    const parsed = JSON.parse(jsonMatch[0]);
    const { column, row } = parsed;

    if (!Number.isInteger(column) || column < 1) throw new Error(`Invalid column: ${column}`);
    if (!Number.isInteger(row) || row < 1) throw new Error(`Invalid row: ${row}`);

    return parsed;
};

export const analyzeMap = async (mapPath) => {
    const imageBuffer = await readFile(mapPath);
    const base64 = imageBuffer.toString("base64");
    const mediaType = "image/png";

    const input = [
        {
            role: "user",
            content: [
                { type: "input_image", image_url: `data:${mediaType};base64,${base64}` },
                { type: "input_text", text: PROMPT }
            ]
        }
    ];

    // Gate: before vision call
    printState("MAP ANALYSIS — Sending to vision model", {
        model: models.vision,
        imageSize: `${imageBuffer.length} bytes`,
        prompt: PROMPT
    });
    await confirm("About to call vision model for map analysis");

    log.api("Map Analysis", 1);
    const response = await chat({ model: models.vision, input });
    const text = extractText(response);
    log.apiDone(response.usage);

    // Gate: after vision call
    printState("MAP ANALYSIS — Vision model response", text);

    let result;
    try {
        result = parseCoordinates(text);
    } catch (err) {
        log.warn(`First attempt failed: ${err.message}. Retrying...`);
        printState("MAP ANALYSIS — Retry", { reason: err.message });
        await confirm("Vision parse failed. Retrying with same prompt");

        const retryResponse = await chat({ model: models.vision, input });
        const retryText = extractText(retryResponse);
        log.apiDone(retryResponse.usage);
        printState("MAP ANALYSIS — Retry response", retryText);
        result = parseCoordinates(retryText);
    }

    log.success(`Dam located at column=${result.column}, row=${result.row}`);
    printState("MAP ANALYSIS — Final coordinates", result);
    await confirm("Map analysis complete. Proceed to Manual Analyst?");

    return result;
};
