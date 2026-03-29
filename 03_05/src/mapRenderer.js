const GRID_FIELDS = ["map", "grid", "terrain", "board"];

const LEGEND = "Legend: S=start  G=goal  .=open  T=tree  R=river  #=stone  ?=unknown";

/**
 * Finds a 2D array grid in an object by checking known field names.
 * @param {object} obj
 * @returns {string[][] | null}
 */
const findGrid = (obj) => {
    if (!obj || typeof obj !== "object") return null;
    for (const field of GRID_FIELDS) {
        const val = obj[field];
        if (Array.isArray(val) && Array.isArray(val[0])) return val;
    }
    // one level deep
    for (const val of Object.values(obj)) {
        if (Array.isArray(val) && Array.isArray(val[0])) return val;
    }
    return null;
};

/**
 * Renders a 2D grid array as an ASCII string with column/row headers and a legend.
 * @param {object} responseData - Raw JSON response from a tool call
 * @returns {string} ASCII representation, or "" if no grid found
 */
export const renderMap = (responseData) => {
    const grid = findGrid(responseData);
    if (!grid || grid.length === 0) return "";

    const cols = grid[0].length;
    const header = "   " + Array.from({ length: cols }, (_, i) => String(i).padStart(2)).join("");
    const rows = grid.map((row, r) =>
        String(r).padStart(2) + " " + row.map(cell => String(cell ?? "?").padStart(2)).join("")
    );

    return [header, ...rows, "", LEGEND].join("\n");
};
