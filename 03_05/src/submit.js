import { AIDEVS_KEY, VERIFY_URL } from "./config.js";
import log from "./helpers/logger.js";

/**
 * Submits the answer to /verify and returns the response.
 * @param {string[]} answerArray - [vehicle_name, move1, move2, ...]
 * @returns {Promise<object>} Parsed response from /verify
 */
export const submit = async (answerArray) => {
    log.start(`Submitting answer: ${JSON.stringify(answerArray)}`);

    const response = await fetch(VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            apikey: AIDEVS_KEY,
            task: "savethem",
            answer: answerArray
        })
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { message: text }; }

    const flagMatch = text.match(/\{FLG:[^}]+\}/i);
    if (flagMatch) {
        log.success(`FLAG: ${flagMatch[0]}`);
    } else {
        log.info(`Response: ${text.substring(0, 300)}`);
    }

    return data;
};
