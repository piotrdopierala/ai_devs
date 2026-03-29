import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MEMORY_DIR = join(__dirname, "..", "workspace", "memory");
const TIPS_PATH = join(MEMORY_DIR, "tips.md");
const CACHED_REGISTRY_PATH = join(MEMORY_DIR, "last-tools.json");

/** Read all tips from memory. Returns empty string if file doesn't exist. */
export const readTips = async () => {
    try { return await readFile(TIPS_PATH, "utf8"); } catch { return ""; }
};

/** Append a dated tip entry to tips.md. */
export const appendTip = async (tip) => {
    await mkdir(MEMORY_DIR, { recursive: true });
    const entry = `\n## ${new Date().toISOString()}\n\n${tip}\n`;
    let existing = "";
    try { existing = await readFile(TIPS_PATH, "utf8"); } catch { existing = "# Run Tips\n"; }
    await writeFile(TIPS_PATH, existing + entry);
};

/** Load the cached tool registry from a previous run. Returns null if not found. */
export const loadCachedRegistry = async () => {
    try {
        const text = await readFile(CACHED_REGISTRY_PATH, "utf8");
        return JSON.parse(text);
    } catch { return null; }
};

/** Save the tool registry to memory for reuse in future runs. */
export const saveCachedRegistry = async (registry) => {
    await mkdir(MEMORY_DIR, { recursive: true });
    await writeFile(CACHED_REGISTRY_PATH, JSON.stringify(registry, null, 2));
};
