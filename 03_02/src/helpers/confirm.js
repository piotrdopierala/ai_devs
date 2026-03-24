import readline from "node:readline";

const colors = {
    reset: "\x1b[0m",
    dim: "\x1b[2m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m"
};

export const confirm = async (label) => {
    console.log(`\n${colors.magenta}[GATE]${colors.reset} ${label}`);
    console.log(`${colors.dim}Press Enter to continue, Ctrl+C to abort...${colors.reset}`);
    const rl = readline.createInterface({ input: process.stdin });
    await new Promise((resolve) => {
        rl.once("line", () => { rl.close(); resolve(); });
    });
};

export const printState = (title, data) => {
    console.log(`\n${colors.cyan}── ${title} ──${colors.reset}`);
    if (typeof data === "string") {
        console.log(data);
    } else {
        console.log(JSON.stringify(data, null, 2));
    }
};
