import {chat} from './llm.js'

const SYSTEM = `You are a data extraction assistant. Output valid JSON only, no markdown fences.`

// Parse transactions programmatically — format is perfectly structured
function parseTransactions(transakcje) {
  const cities = new Set()
  const goods = {}
  for (const line of transakcje.trim().split('\n')) {
    const parts = line.split(' -> ')
    if (parts.length !== 3) continue
    const [seller, good, buyer] = parts.map(s => s.trim())
    cities.add(seller)
    cities.add(buyer)
    if (!goods[good]) goods[good] = new Set()
    goods[good].add(seller)
  }
  return {
    cityNames: [...cities],
    goods: Object.fromEntries(Object.entries(goods).map(([k, v]) => [k, [...v]])),
  }
}

async function extractCities(ogloszenia, cityNames, knownGoods) {
  const prompt = `Extract what each city NEEDS from this bulletin board text.
Return JSON: {"CityName": {"goodname": quantity, ...}, ...}
Rules:
- Use EXACTLY these city names as keys: ${JSON.stringify(cityNames)}
- Good name keys: singular nominative Polish. Where the good matches a known trade item, use exactly this name: ${JSON.stringify(knownGoods)}
- "N butelek X" means good is "X" with quantity N (e.g., "10 butelek mleka" → "mleko": 10)
- Quantities as integers, strip all units

Text:
${ogloszenia}`

  const content = await chat(
    [{role: 'system', content: SYSTEM}, {role: 'user', content: prompt}],
    {json: true}
  )
  return JSON.parse(content)
}

function groupNotesByCity(text, cityNames) {
  const notes = text.split(/\n(?=-)/).map(n => n.replace(/^-\s*/, '').trim()).filter(Boolean)
  const grouped = Object.fromEntries(cityNames.map(c => [c, []]))
  for (const note of notes) {
    const noteLower = note.toLowerCase()
    for (const city of cityNames) {
      // Match city name prefix (handles Polish declension: Domatowo→Domatow-a/-ie)
      const prefix = city.toLowerCase().slice(0, 6)
      if (noteLower.includes(prefix)) grouped[city].push(note)
    }
  }
  return grouped
}

function extractPrepNames(text) {
  const matches = []
  const re = /\bod\s+([A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+)\b/gi
  let m
  while ((m = re.exec(text)) !== null) matches.push(m[1])
  return matches
}

async function extractPeople(rozmowy, cityNames) {
  const grouped = groupNotesByCity(rozmowy, cityNames)
  const contextLines = cityNames.map(city => {
    const notesList = grouped[city]
    const notes = notesList.length ? notesList.join(' | ') : '(no notes)'
    const prepNames = extractPrepNames(notesList.join(' '))
    const hint = prepNames.length ? ` [also found after prepositions: ${prepNames.join(', ')}]` : ''
    return `${city}: ${notes}${hint}`
  }).join('\n')

  // Step 1: extract all name tokens per city
  const tokensPrompt = `For each city, list ALL person name tokens found in the text (first names and/or surnames, separated by comma).
Look for: names before verbs, names after prepositions (od, z, u, przez, dla), names at start of phrases.
Output only the city name and name tokens, one city per line.

${contextLines}`

  const tokensRaw = await chat(
    [{role: 'system', content: 'You are a name extraction assistant. Extract ALL person name tokens (first names AND surnames) from each text segment, one line per city. Surnames after prepositions (od, z, u) are still person names.'}, {role: 'user', content: tokensPrompt}]
  )

  // Step 2: combine into full names and output JSON
  const combinePrompt = `Below are person name tokens found per city. Combine first name + surname tokens into full names.
Return JSON: {"First Last": "CityName", ...} with exactly ${cityNames.length} entries.
Use EXACTLY these city names as values: ${JSON.stringify(cityNames)}

Name tokens per city:
${tokensRaw}`

  const content = await chat(
    [{role: 'system', content: SYSTEM}, {role: 'user', content: combinePrompt}],
    {json: true}
  )
  return JSON.parse(content)
}

export async function extractData(notes) {
  const {cityNames, goods} = parseTransactions(notes.transakcje)

  const [cities, people] = await Promise.all([
    extractCities(notes.ogloszenia, cityNames, Object.keys(goods)),
    extractPeople(notes.rozmowy, cityNames),
  ])

  return {cities, people, goods}
}
