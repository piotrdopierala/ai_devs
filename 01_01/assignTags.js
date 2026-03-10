import {
  AI_API_KEY,
  EXTRA_API_HEADERS,
  RESPONSES_API_ENDPOINT,
  resolveModelForProvider
} from "../config.js";
import { extractResponseText } from "./helpers.js";

const MODEL = resolveModelForProvider("openai/gpt-4o-mini");

const ALLOWED_TAGS = {
  "IT":                 "Software development, programming, systems administration, cybersecurity, data engineering",
  "transport":          "Driving vehicles, logistics, delivery, supply chain, freight, courier, ensure and maintain roads, pipes",
  "edukacja":           "Teaching, tutoring, academic research, school or university roles",
  "medycyna":           "Healthcare, patient care, nursing, pharmacy, medical diagnostics",
  "praca z ludźmi":     "Customer service, sales, HR, social work, counselling, reception",
  "praca z pojazdami":  "Vehicle maintenance, mechanics, operating machinery or heavy equipment",
  "praca fizyczna":     "Manual labour, construction, warehouse work, physical trades",
};

const tagDescriptions = Object.entries(ALLOWED_TAGS)
  .map(([tag, desc]) => `- ${tag}: ${desc}`)
  .join("\n");

const tagsSchema = {
  type: "json_schema",
  name: "job_tags",
  strict: true,
  schema: {
    type: "object",
    properties: {
      tags: {
        type: "array",
        items: { type: "string" },
        description: `Tags that match this job. Only use tag names from this list:\n${tagDescriptions}`
      }
    },
    required: ["tags"],
    additionalProperties: false
  }
};

export async function assignTags(job) {
  const response = await fetch(RESPONSES_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${AI_API_KEY}`,
      ...EXTRA_API_HEADERS
    },
    body: JSON.stringify({
      model: MODEL,
      input: `Given the job title: "${job}", assign all matching tags from the allowed list below. Think about what this job involves day-to-day.\n\nAllowed tags:\n${tagDescriptions}`,
      text: { format: tagsSchema }
    })
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    const message = data?.error?.message ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  const outputText = extractResponseText(data);

  if (!outputText) {
    throw new Error("Missing text output in API response");
  }

  return JSON.parse(outputText).tags;
}
