
const AIDEVS_KEY = process.env.AIDEVS_KEY?.trim();
const BASE_URL = process.env.BASE_URL?.trim() ?? "https://<BASE_URL>/";

export const handlers = {
    async redirect_package({ packageid, destination, code }) {
        const url = new URL("api/packages", BASE_URL);
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apikey: AIDEVS_KEY, action: "redirect", packageid, destination, code }),
        });
        if (!response.ok) throw new Error(`Packages API error: ${response.status} ${await response.text()}`);
        const { confirmation } = await response.json();
        return { confirmation };
    },

    async check_package({ packageid }) {
        const url = new URL("api/packages", BASE_URL);
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apikey: AIDEVS_KEY, packageid, action: "check" }),
        });
        if (!response.ok) throw new Error(`Packages API error: ${response.status} ${await response.text()}`);
        return response.json();
    },
};