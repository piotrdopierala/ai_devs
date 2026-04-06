import {readNotes} from './notes.js'
import {extractData} from './extract.js'
import {buildBatchActions, normalizeName} from './filesystem.js'
import {callApi} from './api.js'
import {chat} from './llm.js'
import {MAX_RETRIES} from './config.js'
import {log} from './logger.js'

const RULES = `Filesystem rules:
- Filenames must match ^[a-z0-9_]+$ (lowercase, digits, underscores only — no Polish diacritics)
- Max filename length: 20 characters
- Directories: /miasta, /osoby, /towary must exist
- Markdown links must point to existing files (e.g. [City](/miasta/city) requires /miasta/city to exist)
- All filenames globally unique across the entire filesystem
- /miasta/<city> content: JSON string like {"good": quantity}
- /osoby/<name> content: "First Last\n\n[City](/miasta/city)"
- /towary/<good> content: one markdown link per line to each selling city`

async function getFixActions(error, state, originalData) {
  const prompt = `The virtual filesystem validation failed with this error:
${JSON.stringify(error, null, 2)}

Current filesystem state:
${JSON.stringify(state, null, 2)}

Original extracted data (ground truth — use this to reconstruct correct content):
${JSON.stringify(originalData, null, 2)}

${RULES}

Output a JSON object {"actions": [...]} containing an array of filesystem actions to fix the errors.
Allowed action types: createFile, createDirectory, deleteFile, deleteDirectory.
Only include the actions needed to fix the specific error. Do not reset the whole filesystem.
IMPORTANT: Do NOT include createDirectory actions for directories that already exist in the current filesystem state — only createFile actions for missing files.`

  const content = await chat(
    [
      {role: 'system', content: 'You are a filesystem repair agent. Output valid JSON only. Keep your response concise — no more than 10 actions.'},
      {role: 'user', content: prompt},
    ],
    {json: true}
  )
  let parsed
  try {
    parsed = JSON.parse(content)
  } catch (e) {
    log('Failed to parse fix actions JSON', e.message)
    return []
  }
  return Array.isArray(parsed) ? parsed : (parsed.actions || [])
}

export async function run() {
  log('=== START ===')

  log('Step 1: Reading notes')
  const notes = readNotes()
  log('Notes loaded', {files: Object.keys(notes), sizes: Object.fromEntries(Object.entries(notes).map(([k, v]) => [k, v.length]))})

  log('Step 2: Extracting data with LLM')
  const data = await extractData(notes)
  log('Extracted data', {
    cities: Object.keys(data.cities),
    people: data.people,
    goods: Object.keys(data.goods),
  })

  log('Step 3: Building batch actions')
  const actions = buildBatchActions(data)
  log('Batch built', {count: actions.length, actions: actions.map(a => `${a.action} ${a.path ?? ''}`).join(', ')})

  log('Step 4: Sending batch to API')
  await callApi(actions)

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    log(`Step 5.${attempt}: Calling done (attempt ${attempt}/${MAX_RETRIES})`)
    const result = await callApi({action: 'done'})

    if (result.code === 0 || result.flag) {
      log('SUCCESS', {flag: result.flag || result.message})
      return
    }

    if (attempt === MAX_RETRIES) {
      log('Max retries reached', result)
      return
    }

    log(`Validation failed — getting filesystem state for fix attempt`)
    const state = await callApi({action: 'listFiles', path: '/'})

    log('Requesting fix actions from LLM')
    const normalizedData = {
      ...data,
      cities: Object.fromEntries(
        Object.entries(data.cities).map(([city, goods]) => [
          city,
          Object.fromEntries(Object.entries(goods).map(([k, v]) => [normalizeName(k), v])),
        ])
      ),
      goods: Object.fromEntries(
        Object.entries(data.goods).map(([good, cities]) => [normalizeName(good), cities])
      ),
    }
    const fixActions = await getFixActions(result, state, normalizedData)
    log('Fix actions received', fixActions)

    if (fixActions.length === 0) {
      log('LLM returned no fix actions — stopping')
      return
    }

    await callApi(fixActions)
  }
}
