import { readFile } from "fs/promises";

const AIDEVS_KEY = process.env.AIDEVS_KEY?.trim();
const BASE_URL = process.env.BASE_URL?.trim();

export const handlers = {
    async get_suspects_list() {
        const csvPath = new URL("../input/suspects.csv", import.meta.url);
        const text = await readFile(csvPath, "utf-8");
        const [header, ...rows] = text.trim().split("\n");
        const keys = header.split(",");
        return rows.map((row) => {
            const values = row.split(",");
            const obj = Object.fromEntries(keys.map((k, i) => [k, values[i]]));
            obj.birthYear = Number(obj.birthYear);
            return obj;
        });
    },

    async get_suspect_locations({ name, surname }) {
        const url = new URL("api/location", BASE_URL);
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apikey: AIDEVS_KEY, name, surname }),
        });
        if (!response.ok) throw new Error(`Location API error: ${response.status} ${await response.text()}`);
        return response.json();
    },

    async get_person_access_level({ name, surname, birthYear }) {
        const url = new URL("api/accesslevel", BASE_URL);
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apikey: AIDEVS_KEY, name, surname, birthYear }),
        });
        if (!response.ok) throw new Error(`Access level API error: ${response.status} ${await response.text()}`);
        return response.json();
    },

    closest_locations_proximity({ point, locations }) {
        const toRad = (deg) => (deg * Math.PI) / 180;
        const R = 6371;
        return locations.map((loc) => {
            const dLat = toRad(loc.latitude - point.latitude);
            const dLon = toRad(loc.longitude - point.longitude);
            const a =
                Math.sin(dLat / 2) ** 2 +
                Math.cos(toRad(point.latitude)) * Math.cos(toRad(loc.latitude)) * Math.sin(dLon / 2) ** 2;
            const distanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return { ...loc, distanceKm };
        });
    },

    async send_results({ name, surname, accessLevel, powerPlant }) {
        const response = await fetch(new URL("verify", BASE_URL), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apikey: AIDEVS_KEY, task: "findhim", answer: { name, surname, accessLevel, powerPlant } }),
        });
        if (!response.ok) throw new Error(`Verify API error: ${response.status} ${await response.text()}`);
        return response.json();
    },

    async get_powerplant_data() {
        const url = new URL(`data/${AIDEVS_KEY}/findhim_locations.json`, BASE_URL);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Powerplant API error: ${response.status} ${await response.text()}`);
        return response.json();
    },
};