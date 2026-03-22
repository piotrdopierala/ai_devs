import { resolveModelForProvider } from "../../config.js";

export const AIDEVS_KEY = process.env.AIDEVS_KEY?.trim() ?? "";
export const BASE_URL = process.env.BASE_URL?.trim() ?? "";
export const VERIFY_URL = `${BASE_URL}verify`;

export const DRONE_DOCS_URL = `${BASE_URL}dane/drone.html`;
export const DRONE_MAP_URL = `${BASE_URL}data/${AIDEVS_KEY}/drone.png`;

export const models = {
    vision: resolveModelForProvider("openai/gpt-5.4"),
    analyst: resolveModelForProvider("anthropic/claude-sonnet-4"),
    executor: resolveModelForProvider("google/gemini-2.5-flash")
};
