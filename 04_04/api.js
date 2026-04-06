import {API_KEY, ENDPOINT} from './config.js'
import {log} from './logger.js'

export async function callApi(answer) {
  const isArray = Array.isArray(answer)
  const label = isArray
    ? `API → batch (${answer.length} actions: ${answer.map(a => a.action).join(', ').slice(0, 120)})`
    : `API → ${answer.action ?? JSON.stringify(answer)}`

  log(label)

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({apikey: API_KEY, task: 'filesystem', answer}),
  })
  const data = await res.json()

  log('API ← response', data)
  return data
}
