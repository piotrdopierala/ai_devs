import puppeteer from "puppeteer-core";
import { OKO_CREDENTIALS, AIDEVS_KEY } from "./config.js";
import log from "./helpers/logger.js";

const OKO_BASE = "https://oko.ag3nts.org";
const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

let browser = null;
let page = null;

/**
 * Launches Chrome, logs in to the OKO panel, and holds the authenticated session.
 * Call this ONCE at app startup before the agent runs.
 * Credentials never enter the agent loop — only fetchPage is exposed to the agent.
 */
export const initWebPanel = async () => {
    browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: false,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    page = await browser.newPage();
    log.info("Chrome launched");

    await page.goto(OKO_BASE + "/", { waitUntil: "networkidle0" });
    await page.$eval('input[name="login"]', el => el.value = "");
    await page.type('input[name="login"]', OKO_CREDENTIALS.login);
    await page.type('input[name="password"]', OKO_CREDENTIALS.password);
    await page.type('input[name="access_key"]', AIDEVS_KEY);
    await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle0" }),
        page.click('button[type="submit"]')
    ]);
    log.success("OKO web panel: logged in");
};

/**
 * Fetches a page from the already-authenticated OKO panel.
 * Returns the page's visible text content (no HTML, no credentials).
 * Throws if session was invalidated (NARUSZENIE BEZPIECZEŃSTWA detected).
 * @param {string} path - e.g. "/", "/notatki", "/zadania", "/incydenty/ID"
 * @returns {Promise<string>}
 */
export const fetchPage = async (path) => {
    if (!page) throw new Error("Web panel not initialised — call initWebPanel() first");
    log.start(`OKO panel → GET ${path}`);
    await page.goto(OKO_BASE + path, { waitUntil: "networkidle0" });
    const content = await page.evaluate(() => {
        const text = document.body.innerText;
        const links = Array.from(document.querySelectorAll("a[href]"))
            .map(a => `${a.innerText.trim()} → ${a.getAttribute("href")}`)
            .filter(l => l.length > 4)
            .join("\n");
        const hiddenIds = Array.from(document.querySelectorAll("input[type=hidden]"))
            .map(i => `${i.name}=${i.value}`)
            .join("\n");
        return `${text}\n\n--- LINKS ---\n${links}${hiddenIds ? `\n\n--- FORM FIELDS ---\n${hiddenIds}` : ""}\n\n--- URL ---\n${window.location.href}`;
    });

    if (content.includes("NARUSZENIE BEZPIECZEŃSTWA")) {
        throw new Error("Session invalidated by server (NARUSZENIE BEZPIECZEŃSTWA) — agent must not visit /edit/ or /delete/ paths");
    }

    log.info(`OKO panel ← ${path} (${content.length} chars)`);
    return content;
};

export const closeBrowser = async () => {
    if (browser) {
        await browser.close();
        browser = null;
        page = null;
    }
};
