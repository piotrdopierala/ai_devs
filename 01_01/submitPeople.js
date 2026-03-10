const AIDEVS_KEY = process.env.AIDEVS_KEY?.trim();
if (!AIDEVS_KEY) {
  console.error("Error: AIDEVS_KEY is not set in .env");
  process.exit(1);
}

const VERIFY_URL = "https://<BASE_URL>/verify";

export async function submitPeople(people) {
  const answer = people.map((p) => ({
    name: p.name,
    surname: p.surname,
    gender: p.gender,
    born: new Date(p.birthDate).getFullYear(),
    city: p.birthPlace,
    tags: p.tags
  }));

  const response = await fetch(VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apikey: AIDEVS_KEY, task: "people", answer })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Submit failed: ${response.status} ${JSON.stringify(data)}`);
  }

  return data;
}
