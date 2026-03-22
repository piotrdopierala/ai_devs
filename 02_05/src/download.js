import { writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import log from "./helpers/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INPUT_DIR = join(__dirname, "..", "workspace", "input");

const downloadFile = async (url, filename) => {
    log.start(`Downloading ${url}`);
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Download failed: ${url} (${response.status})`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const path = join(INPUT_DIR, filename);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, buffer);

    log.success(`Saved ${filename} (${buffer.length} bytes)`);
    return { path, size: buffer.length, status: response.status };
};

export const downloadResources = async (docsUrl, mapUrl) => {
    const docs = await downloadFile(docsUrl, "drone-docs.html");
    const map = await downloadFile(mapUrl, "drone.png");
    return { docs, map };
};
