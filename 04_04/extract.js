import {chat} from './llm.js'

const SYSTEM = `You are a data extraction assistant. Extract structured trade data from Polish notes. Output valid JSON only, no markdown fences.`

function buildPrompt(notes) {
  return `Extract trade data from the notes below and return a JSON object with exactly this structure:
{
  "cities": {
    "<city name in Polish>": { "<good name, singular nominative, ASCII only, no diacritics>": <quantity as integer> }
  },
  "people": {
    "<First Last name>": "<city name they manage>"
  },
  "goods": {
    "<good name, singular nominative, ASCII only, no diacritics>": ["<city that sells it>"]
  }
}

Rules:
- cities: sourced from ogłoszenia.txt — what each city NEEDS. Keys are good names (singular nominative, ASCII, no diacritics), values are quantities as integers (strip units like "butelek", "kg", "porcji", "workow" — numbers only)
- people: sourced from rozmowy.txt — full name (First Last) of person who manages each city. One person per city. Every city that appears in "cities" MUST have an entry in "people". Known full names: "Rafał Kisiel" manages Brudzewo, "Lena Konkel" manages Karlinkowo.
- goods: sourced from transakcje.txt — each line is "SellerCity -> good -> BuyerCity". The KEYS of "goods" are GOOD NAMES (singular nominative, ASCII, no diacritics). The VALUES are arrays of SELLER cities (the FIRST city in each line — the one selling the good). Example: line "Darzlubie -> ryż -> Puck" means good "ryz" has seller "Darzlubie". If multiple lines have the same good, collect all unique sellers. City names keep natural Polish spelling.
- Good names: singular nominative, ASCII only — e.g. "ryz" not "ryż", "lopata" not "łopata", "woda" not "butelka wody", "marchew", "kilof", "wiertarka", "mlynek", "kapusta" etc.
- A good may appear in multiple transaction lines — collect ALL unique seller cities into its array.

=== ogłoszenia.txt ===
${notes.ogloszenia}

=== rozmowy.txt ===
${notes.rozmowy}

=== transakcje.txt ===
${notes.transakcje}
`
}

export async function extractData(notes) {
  const content = await chat(
    [
      {role: 'system', content: SYSTEM},
      {role: 'user', content: buildPrompt(notes)},
    ],
    {json: true}
  )
  return JSON.parse(content)
}
