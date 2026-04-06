import {OPENROUTER_KEY, MODEL} from './config.js'
import {log} from './logger.js'

export async function chat(messages, options = {}) {
  const model = options.model || MODEL

  // Responses API: system message goes in `instructions`, rest in `input`
  const systemMsg = messages.find(m => m.role === 'system')
  const input = messages.filter(m => m.role !== 'system')

  const body = {model, input}
  if (systemMsg) body.instructions = systemMsg.content
  if (options.json) body.text = {format: {type: 'json_object'}}

  log('LLM → request', {
    model,
    instructions: systemMsg?.content?.slice(0, 300),
    input: input.map(m => ({role: m.role, content: m.content.slice(0, 400) + (m.content.length > 400 ? ' …(truncated)' : '')})),
  })

  const res = await fetch('https://openrouter.ai/api/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  const content = data.output?.[0]?.content?.[0]?.text

  if (!content) {
    log('LLM ← error', data)
    throw new Error(`LLM error: ${JSON.stringify(data)}`)
  }

  log('LLM ← response', {content: content.slice(0, 1000) + (content.length > 1000 ? ' …(truncated)' : '')})
  return content
}
