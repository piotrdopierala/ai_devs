import { readFileSync, mkdirSync, appendFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const env = Object.fromEntries(
  readFileSync(join(__dirname, '..', '.env'), 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => l.split('=').map(s => s.trim()))
)

const API_KEY = env.AIDEVS_KEY
const ENDPOINT = `${env.BASE_URL.replace(/\/$/, '')}/verify`
const OPENROUTER_KEY = env.OPENROUTER_API_KEY

const logDir = join(__dirname, 'workspace', 'output')
const logFile = join(logDir, `run-${new Date().toISOString().replace(/[:.]/g, '-')}.md`)
mkdirSync(logDir, { recursive: true })

const t0 = Date.now()
const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`

function log(msg, data) {
  const line = data !== undefined
    ? `[${elapsed()}] ${msg}: ${JSON.stringify(data, null, 2)}`
    : `[${elapsed()}] ${msg}`
  console.log(line)
  appendFileSync(logFile, line + '\n')
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function apiCall(answer) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apikey: API_KEY, task: 'windpower', answer })
  })
  const json = await res.json()
  log(`>> ${answer.action}${answer.param ? '/' + answer.param : ''}`, json)
  return json
}

const spinner = ['/', '-', '\\', '|']
let spinIdx = 0
let sessionDeadline = Infinity

function spinnerTick(label) {
  process.stdout.write(`\r${spinner[spinIdx++ % 4]} ${label} [${elapsed()}]   `)
}

function spinnerClear() {
  process.stdout.write('\r' + ' '.repeat(60) + '\r')
}

async function getOneResult(label = 'waiting') {
  while (Date.now() < sessionDeadline) {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apikey: API_KEY, task: 'windpower', answer: { action: 'getResult' } })
    }).then(r => r.json())

    if (r.code === 12) {
      spinnerClear()
      log(`<< getResult [${r.sourceFunction}]`, r)
      return r
    }
    spinnerTick(label)
    await sleep(300)
  }
  spinnerClear()
  log(`session deadline exceeded while waiting for: ${label}`)
  return null
}

async function planConfigPoints(forecast, documentation) {
  const { cutoffWindMs, minOperationalWindMs } = documentation.safety

  // Pre-filter: only storm slots and their immediate next slot
  const relevantSlots = []
  for (let i = 0; i < forecast.length; i++) {
    const isStorm = forecast[i].windMs > cutoffWindMs
    const prevIsStorm = i > 0 && forecast[i - 1].windMs > cutoffWindMs
    if (isStorm || prevIsStorm) relevantSlots.push(forecast[i])
  }

  // Exact windMs lookup for post-processing
  const forecastMap = Object.fromEntries(forecast.map(s => [s.timestamp, s.windMs]))

  const systemPrompt = `You are a wind turbine scheduling expert.
Given relevant forecast slots (storms and the slot immediately after each), decide the turbine configuration for each slot:
- windMs > ${cutoffWindMs}: pitchAngle=90, turbineMode=idle (storm — mandatory)
- windMs >= ${minOperationalWindMs}: pitchAngle=0, turbineMode=production (generate power)
- windMs < ${minOperationalWindMs}: SKIP this slot, do not include it

Return JSON: { "configs": [ { "startDate": "YYYY-MM-DD", "startHour": "HH:00:00", "windMs": <number>, "pitchAngle": 0 or 90, "turbineMode": "production" or "idle" } ] }`

  const userPrompt = `Relevant slots:\n${JSON.stringify(relevantSlots, null, 2)}`

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENROUTER_KEY}` },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' }
    })
  })

  const json = await res.json()
  const content = json.choices[0].message.content
  log('LLM response', content)

  const parsed = JSON.parse(content)
  const points = Array.isArray(parsed) ? parsed
    : (parsed.configs ?? parsed.configPoints ?? Object.values(parsed).find(v => Array.isArray(v)))
  if (!Array.isArray(points)) throw new Error(`Unexpected LLM format: ${content}`)

  // Post-process: snap windMs to exact forecast values, filter invalid production points
  for (const p of points) {
    const ts = `${p.startDate} ${p.startHour}`
    if (forecastMap[ts] !== undefined) p.windMs = forecastMap[ts]
  }
  return points.filter(p => !(p.turbineMode === 'production' && p.windMs < minOperationalWindMs))
}

async function main() {
  log(`=== windpower run start ===`)
  log(`endpoint: ${ENDPOINT}`)

  // 1. Start service window
  const startRes = await apiCall({ action: 'start' })
  sessionDeadline = Date.now() + (startRes.sessionTimeout - 2) * 1000
  log(`session deadline in ${startRes.sessionTimeout - 2}s`)

  // 2. Fire documentation + weather in parallel
  const [docRes] = await Promise.all([
    apiCall({ action: 'get', param: 'documentation' }),
    apiCall({ action: 'get', param: 'weather' })
  ])

  // 3. Poll for weather
  let weatherRes
  while (!weatherRes) {
    const r = await getOneResult('waiting for weather')
    if (!r) throw new Error('session expired waiting for weather')
    if (r.sourceFunction === 'weather') weatherRes = r
  }


  const forecast = weatherRes.forecast

  // 4. LLM plans config points from relevant slots only
  const configPoints = await planConfigPoints(forecast, docRes)
  log(`config points (${configPoints.length})`, configPoints.map(p =>
    `${p.startDate} ${p.startHour}  wind=${p.windMs}  pitch=${p.pitchAngle}  ${p.turbineMode}`
  ))

  // 5. Fire all unlockCodeGenerator calls in parallel
  await Promise.all(configPoints.map(cp => apiCall({
    action: 'unlockCodeGenerator',
    startDate: cp.startDate,
    startHour: cp.startHour,
    windMs: cp.windMs,
    pitchAngle: cp.pitchAngle
  })))

  // 6. Collect all unlock codes, with deadline-aware polling and retry for dropped requests
  const codeMap = {}
  const pending = new Set(configPoints.map(cp => `${cp.startDate}|${cp.startHour}`))

  const pollUntilDeadline = async (deadlineMs) => {
    while (pending.size > 0 && Date.now() < deadlineMs) {
      const r = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apikey: API_KEY, task: 'windpower', answer: { action: 'getResult' } })
      }).then(r => r.json())

      if (r.code === 12 && r.sourceFunction === 'unlockCodeGenerator') {
        spinnerClear()
        log(`<< getResult [unlockCodeGenerator]`, r)
        const key = `${r.signedParams.startDate}|${r.signedParams.startHour}`
        codeMap[key] = r.unlockCode
        pending.delete(key)
      } else {
        spinnerTick(`unlock codes ${configPoints.length - pending.size}/${configPoints.length}`)
        await sleep(300)
      }
    }
  }

  await pollUntilDeadline(Date.now() + 5000)
  while (pending.size > 0) {
    for (const key of pending) {
      const cp = configPoints.find(p => `${p.startDate}|${p.startHour}` === key)
      log(`retrying unlock code for ${key}`)
      await apiCall({ action: 'unlockCodeGenerator', startDate: cp.startDate, startHour: cp.startHour, windMs: cp.windMs, pitchAngle: cp.pitchAngle })
    }
    await pollUntilDeadline(Date.now() + 5000)
  }

  // 7. Send bulk config
  const configs = {}
  for (const cp of configPoints) {
    const key = `${cp.startDate}|${cp.startHour}`
    configs[`${cp.startDate} ${cp.startHour}`] = {
      pitchAngle: cp.pitchAngle,
      turbineMode: cp.turbineMode,
      unlockCode: codeMap[key]
    }
  }
  await apiCall({ action: 'config', configs })

  // 8. Turbine check (required before done)
  await apiCall({ action: 'get', param: 'turbinecheck' })
  await getOneResult('waiting for turbinecheck')

  // 9. Submit
  const doneRes = await apiCall({ action: 'done' })

  const flagMatch = JSON.stringify(doneRes).match(/\{FLG:[^}]+\}/i)
  if (flagMatch) log(`FLAG: ${flagMatch[0]}`)
  else log(`no flag in response`)

  log(`=== done in ${elapsed()} ===`)
}

main().catch(err => {
  log(`Fatal: ${err.message}`)
  process.exit(1)
})
