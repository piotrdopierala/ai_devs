import { resolveModelForProvider } from "../../config.js";

export const AIDEVS_KEY = process.env.AIDEVS_KEY?.trim() ?? "";
export const BASE_URL = process.env.BASE_URL?.trim() ?? "";
export const VERIFY_URL = `${BASE_URL}verify`;

export const OKO_CREDENTIALS = {
    login: process.env.OKO_LOGIN?.trim() ?? "",
    password: process.env.OKO_PASSWORD?.trim() ?? ""
};

export const api = {
    model: resolveModelForProvider("google/gemini-3-flash-preview"),
    firewallModel: resolveModelForProvider("google/gemini-2.5-flash-lite"),
    maxOutputTokens: 8192,
    firewallMaxOutputTokens: 4096
};
