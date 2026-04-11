// 05_01/agent.js
import {writeFileSync, mkdirSync} from 'fs'
import {dirname, join} from 'path'
import {fileURLToPath} from 'url'
import {callApi} from './api.js'
import {classifySignal} from './router.js'
import {decodeAttachment} from './decoder.js'
import {extractFacts, synthesizeFacts, mergeFacts, isComplete, formatFacts} from './extractor.js'
import {describeImage, transcribeAudio} from './llm.js'
import {log} from './logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, 'workspace', 'output')
mkdirSync(outDir, {recursive: true})

function saveAttachment(index, decoded) {
  const ext = decoded.mimeType
    ? decoded.mimeType.split('/')[1].split(';')[0]
    : decoded.type === 'text' ? 'txt' : 'bin'
  const filename = `attachment-${String(index).padStart(2, '0')}.${ext}`
  const filepath = join(outDir, filename)
  if (decoded.type === 'image' || decoded.type === 'audio') {
    writeFileSync(filepath, Buffer.from(decoded.base64, 'base64'))
  } else {
    writeFileSync(filepath, decoded.content, 'utf8')
  }
  log(`attachment saved: ${filename}`)
}

export async function run() {
  log('=== radiomonitoring agent start ===')

  // 1. Start session
  const startRes = await callApi({action: 'start'})
  log('session started', startRes)

  let facts = {cityName: null, cityArea: null, warehousesCount: null, phoneNumber: null}
  const fragments = []

  // 2. Listen loop
  let iteration = 0
  while (true) {
    iteration++
    log(`listen iteration ${iteration}`)

    const signal = await callApi({action: 'listen'})

    // Check for end-of-data signal
    if (signal.code !== 100) {
      log('end of data signal received', signal)
      break
    }

    const kind = classifySignal(signal)
    log(`signal classified as: ${kind}`)

    if (kind === 'noise') {
      log('signal discarded as noise')
      continue
    }

    let textContent = null

    if (kind === 'text') {
      textContent = signal.transcription
    } else if (kind === 'binary') {
      const decoded = decodeAttachment(signal.attachment, signal.meta)
      log('binary decoded', {type: decoded.type, mimeType: decoded.mimeType})
      if (decoded.type !== 'skip') saveAttachment(iteration, decoded)

      if (decoded.type === 'text') {
        textContent = decoded.content
      } else if (decoded.type === 'image') {
        try {
          textContent = await describeImage(decoded.base64, decoded.mimeType)
        } catch (err) {
          log('vision failed, skipping image', {error: err.message})
          continue
        }
      } else if (decoded.type === 'audio') {
        try {
          textContent = await transcribeAudio(decoded.base64, decoded.mimeType)
        } catch (err) {
          log('audio transcription failed, skipping', {error: err.message})
          continue
        }
      } else {
        log('binary skipped (unsupported type)')
        continue
      }
    }

    if (textContent) {
      fragments.push(textContent)
      const partial = await extractFacts(textContent)
      facts = mergeFacts(facts, partial)
      log('facts so far', facts)

      if (isComplete(facts)) {
        log('all facts collected — stopping early')
        break
      }
    }
  }

  // 3. Always synthesize — synthesis has full context and may correct per-signal extractions
  log('running synthesis', facts)
  const synth = await synthesizeFacts(fragments)
  // synthesis overwrites all non-null values (it has the full picture)
  facts = {...facts, ...Object.fromEntries(Object.entries(synth).filter(([, v]) => v !== null && v !== undefined))}
  log('facts after synthesis', facts)

  // 4. Format and transmit
  const formatted = formatFacts(facts)
  log('transmitting', formatted)

  const result = await callApi({
    action: 'transmit',
    ...formatted,
  })

  log('=== done ===', result)
  return result
}
