import { AIDEVS_KEY, VERIFY_URL } from "./config.js";
import log from "./helpers/logger.js";

/**
 * Posts an action to the OKO /verify endpoint.
 * @param {string} action
 * @param {object} [params]
 * @returns {Promise<object>} Parsed response, or { error: string } on failure
 */
export const okoCall = async (action, params = {}) => {
    const body = {
        apikey: AIDEVS_KEY,
        task: "okoeditor",
        answer: { action, ...params }
    };

    log.start(`OKO → action: ${action} ${Object.keys(params).length ? JSON.stringify(params) : ""}`);

    let text;
    try {
        const response = await fetch(VERIFY_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        text = await response.text();
    } catch (err) {
        return { error: `Network error: ${err.message}` };
    }

    try {
        const data = JSON.parse(text);
        log.info(`OKO ← ${text.substring(0, 200)}`);
        return data;
    } catch {
        log.info(`OKO ← (non-JSON) ${text.substring(0, 200)}`);
        return { message: text };
    }
};
