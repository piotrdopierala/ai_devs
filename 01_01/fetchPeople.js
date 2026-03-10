const AIDEVS_KEY = process.env.AIDEVS_KEY?.trim();
if (!AIDEVS_KEY) {
  console.error("Error: AIDEVS_KEY is not set in .env");
  process.exit(1);
}

const PEOPLE_CSV_URL = `https://<BASE_URL>/data/${AIDEVS_KEY}/people.csv`;

function parseCsv(text) {
  const [headerLine, ...rows] = text.trim().split("\n");
  const headers = headerLine.split(",").map((h) => h.trim());

  return rows
    .filter((row) => row.trim())
    .map((row) => {
      const values = row.split(",").map((v) => v.trim());
      return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
    });
}

export async function fetchPeople() {
  const response = await fetch(PEOPLE_CSV_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch people CSV: ${response.status} ${response.statusText}`);
  }

  const csv = await response.text();
  return parseCsv(csv);
}
