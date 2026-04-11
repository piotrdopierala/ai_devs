// 05_01/extractor.js
import {chat} from './llm.js'
import {log} from './logger.js'
import {PROVIDER_TEXT, PROVIDER_SYNTH, MODEL_TEXT, MODEL_SYNTH} from './config.js'

const EXTRACT_SYSTEM = `Extract from the text any of these fields about a city called "Zion" (also known as "Syjon" in Polish):
- cityName: the real name of the city (if you see "Syjon" that is the city)
- cityArea: area in km² as a number (no units)
- warehousesCount: number of warehouses (integer) — look for "magazyn", "magazyny", "magazynów", "warehouse", "warehouses"
- phoneNumber: contact phone number (string)
Return JSON with only the fields you found. Return {} if nothing relevant. Do NOT guess or invent values.`

const SYNTH_SYSTEM = `You have collected fragments from radio intercepts about a city called "Zion" (also known as "Syjon" in Polish).
Your job is to identify the REAL name of Zion/Syjon and its properties.

Key rules:
- Some fragments contain a JSON array of settlements with fields: name, occupiedArea, riverAccess, farmAnimals, inhabitants. The "occupiedArea" field is the city area in km².
- "Syjon" / "Zion" is a codename. The real city name is one of those settlements in the JSON list.
- Match clues from text transcriptions (river access, farm animals, trade goods, warehouses) to identify which settlement IS Syjon.
- warehousesCount may appear in infrastructure data in any fragment.
- phoneNumber comes from images or text mentioning a contact number.

Return JSON with all four fields:
- cityName: the real settlement name (from the JSON list)
- cityArea: occupiedArea of that settlement as a number
- warehousesCount: integer — only if explicitly mentioned in the fragments (look for "magazyn", "magazyny", "magazynów"). Do NOT guess.
- phoneNumber: string

IMPORTANT: If you cannot find a value with confidence, set it to null. Do NOT invent numbers.`

export async function extractFacts(text, options = {}) {
  try {
    const raw = await chat(
      [
        {role: 'system', content: EXTRACT_SYSTEM},
        {role: 'user', content: text},
      ],
      {json: true, provider: PROVIDER_TEXT, model: MODEL_TEXT, ...options}
    )
    const parsed = JSON.parse(raw)
    log('extractor ← facts', parsed)
    return parsed
  } catch (err) {
    log('extractor parse failed', {error: err.message})
    return {}
  }
}

export async function synthesizeFacts(fragments) {
  const combined = fragments.join('\n\n---\n\n')
  try {
    const raw = await chat(
      [
        {role: 'system', content: SYNTH_SYSTEM},
        {role: 'user', content: combined},
      ],
      {json: true, provider: PROVIDER_SYNTH, model: MODEL_SYNTH}
    )
    const parsed = JSON.parse(raw)
    log('synthesize ← facts', parsed)
    return parsed
  } catch (err) {
    log('synthesize parse failed', {error: err.message})
    return {}
  }
}

export function mergeFacts(facts, partial) {
  const result = {...facts}
  for (const [k, v] of Object.entries(partial)) {
    if (v !== null && v !== undefined && result[k] === null) {
      result[k] = v
    }
  }
  return result
}

export function isComplete(facts) {
  return Object.values(facts).every(v => v !== null && v !== undefined)
}

export function formatFacts(facts) {
  const area = parseFloat(facts.cityArea)
  return {
    cityName: facts.cityName,
    cityArea: isNaN(area) ? facts.cityArea : (Math.round(area * 100) / 100).toFixed(2),
    warehousesCount: parseInt(facts.warehousesCount, 10),
    phoneNumber: String(facts.phoneNumber),
  }
}
