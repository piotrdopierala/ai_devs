import {OPENROUTER_KEY, MODEL, OLLAMA_URL, OLLAMA_MODEL, PROVIDER} from './config.js'
import {log} from './logger.js'

async function chatOpenRouter(messages, options) {
  const model = options.model || MODEL

  const systemMsg = messages.find(m => m.role === 'system')
  const input = messages.filter(m => m.role !== 'system')

  const body = {model, input}
  if (systemMsg) body.instructions = systemMsg.content
  if (options.json) body.text = {format: {type: 'json_object'}}

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
  if (!content) throw new Error(`OpenRouter error: ${JSON.stringify(data)}`)
  return content
}

async function chatOllama(messages, options) {
  const model = options.model || OLLAMA_MODEL

  const body = {model, messages, stream: false}
  if (options.json) body.format = 'json'

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  })

  const data = await res.json()
  const content = data.message?.content
  if (!content) throw new Error(`Ollama error: ${JSON.stringify(data)}`)
  return content
}

export async function chat(messages, options = {}) {
  const provider = options.provider || PROVIDER
  const model = options.model || (provider === 'ollama' ? OLLAMA_MODEL : MODEL)

  log('LLM → request', {
    provider,
    model,
    messages: messages.map(m => ({role: m.role, content: m.content})),
  })

  const content = provider === 'ollama'
    ? await chatOllama(messages, options)
    : await chatOpenRouter(messages, options)

  log('LLM ← response', {provider, content})
  return content
}
