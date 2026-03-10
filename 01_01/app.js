import "../config.js";
import { fetchPeople } from "./fetchPeople.js";
import { assignTags } from "./assignTags.js";
import { submitPeople } from "./submitPeople.js";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "output");
mkdirSync(OUTPUT_DIR, { recursive: true });


function getAge(birthDate) {
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

async function main() {
  const people = await fetchPeople();
  console.log(`Fetched ${people.length} people`);

  const filtered = people.filter((p) => {
    const age = getAge(p.birthDate);
    return p.gender === "M" && age >= 20 && age <= 40 && p.birthPlace === "Grudziądz";
  });

  console.log(`Filtered ${filtered.length} people (male, 20-40, born in Grudziądz)`);

  const tagged = [];
  for (const person of filtered) {
    const tags = await assignTags(person.job);
    tagged.push({ ...person, tags });
    console.log(`${person.name} ${person.surname} (${person.job}) -> [${tags.join(", ")}]`);
  }

  const filteredInTransport = tagged.filter((p) => {return p.tags.includes("transport")})

  const toCsv = (rows) => {
    const keys = Object.keys(rows[0]);
    const lines = [keys.join(","), ...rows.map((r) => keys.map((k) => `"${String(r[k]).replace(/"/g, '""')}"`).join(","))];
    return lines.join("\n");
  };

  writeFileSync(join(OUTPUT_DIR, "people.csv"), toCsv(people));
  writeFileSync(join(OUTPUT_DIR, "filtered.csv"), toCsv(filtered));
  writeFileSync(join(OUTPUT_DIR, "filteredInTransport.csv"), toCsv(filteredInTransport));
  console.log("Saved output/people.csv, output/filtered.csv and output/filteredInTransport.csv");

  console.table(filteredInTransport.map((p) => ({ name: p.name, surname: p.surname, job: p.job, tags: p.tags.join(", ") })));

  const result = await submitPeople(filteredInTransport);
  console.log("Submit result:", result);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
