import { resolveModelForProvider } from "../../config.js";

export const AIDEVS_KEY = process.env.AIDEVS_KEY?.trim() ?? "";
export const BASE_URL = process.env.BASE_URL?.trim() ?? "";
export const VERIFY_URL = `${BASE_URL}verify`;
export const TOOLSEARCH_URL = `${BASE_URL}api/toolsearch`;

export const api = {
    model: resolveModelForProvider("google/gemini-3-flash-preview"),
    maxOutputTokens: 16384,
};
