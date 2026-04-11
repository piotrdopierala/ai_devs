// 05_01/api.js
import {API_KEY, ENDPOINT, MAX_RETRIES} from './config.js'
import {log} from './logger.js'

export async function callApi(answer) {
  const label = `API → ${answer.action ?? JSON.stringify(answer).slice(0, 80)}`
  log(label)

  let lastErr
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({apikey: API_KEY, task: 'radiomonitoring', answer}),
      })
      const data = await res.json()
      log('API ← response', data)
      return data
    } catch (err) {
      lastErr = err
      log(`API attempt ${attempt} failed`, {error: err.message})
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 2 ** attempt * 200))
      }
    }
  }
  throw new Error(`API call failed after ${MAX_RETRIES} attempts: ${lastErr.message}`)
}
