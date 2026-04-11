// 05_01/llm.js
import {OPENROUTER_KEY, MODEL_TEXT, MODEL_SYNTH, MODEL_VISION, MODEL_AUDIO, OLLAMA_URL, PROVIDER_TEXT, PROVIDER_SYNTH, PROVIDER_VISION, MAX_RETRIES} from './config.js'
import {log} from './logger.js'

async function chatOpenRouter(messages, options = {}) {
  const model = options.model || MODEL_SYNTH

  const systemMsg = messages.find(m => m.role === 'system')
  const input = messages.filter(m => m.role !== 'system')

  const body = {model, input}
  if (systemMsg) body.instructions = systemMsg.content
  if (options.json) body.text = {format: {type: 'json_object'}}

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch('https://openrouter.ai/api/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await res.json()

    if (res.status === 429 || data.error?.code === 429) {
      const wait = 2 ** attempt * 500
      log(`OpenRouter 429 rate-limited, retry ${attempt}/${MAX_RETRIES} in ${wait}ms`)
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, wait))
        continue
      }
      throw new Error(`OpenRouter rate-limited after ${MAX_RETRIES} retries`)
    }

    const content = data.output?.[0]?.content?.[0]?.text
    if (!content) throw new Error(`OpenRouter error: ${JSON.stringify(data)}`)
    return content
  }
}

async function chatOllama(messages, options = {}) {
  const model = options.model || MODEL_TEXT

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
  const provider = options.provider || PROVIDER_TEXT

  log('LLM → request', {
    provider,
    model: options.model || (provider === 'ollama' ? MODEL_TEXT : MODEL_SYNTH),
    messageCount: messages.length,
  })

  let content
  try {
    content = provider === 'ollama'
      ? await chatOllama(messages, options)
      : await chatOpenRouter(messages, options)
  } catch (err) {
    if (provider === 'ollama') {
      log('LLM ollama failed, falling back to openrouter', {error: err.message})
      content = await chatOpenRouter(messages, {...options, provider: 'openrouter'})
    } else {
      throw err
    }
  }

  log('LLM ← response', {content: content.slice(0, 300)})
  return content
}

// Audio: transcribe via OpenRouter Gemini (supports audio input)
export async function transcribeAudio(base64, mimeType) {
  log('LLM audio → request', {model: MODEL_AUDIO, mimeType})

  const rawExt = mimeType.split('/')[1] || 'mp3'
  const format = rawExt === 'mpeg' ? 'mp3' : rawExt

  const body = {
    model: MODEL_AUDIO,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_audio',
            input_audio: {data: base64, format},
          },
          {
            type: 'input_text',
            text: 'Transcribe this audio recording exactly, word for word. Return only the transcription text.',
          },
        ],
      },
    ],
  }

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
  if (!content) throw new Error(`OpenRouter audio error: ${JSON.stringify(data)}`)
  log('LLM audio ← response', {content: content.slice(0, 300)})
  return content
}

// Vision: send image to OpenRouter vision model
export async function describeImage(base64, mimeType) {
  log('LLM vision → request', {model: MODEL_VISION, mimeType})

  const body = {
    model: MODEL_VISION,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_image',
            image_url: `data:${mimeType};base64,${base64}`,
          },
          {
            type: 'input_text',
            text: 'Extract any of these facts about a city called "Zion": its real name, area in km², number of warehouses, contact phone number. Return only the facts you see, in plain text.',
          },
        ],
      },
    ],
  }

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
  if (!content) throw new Error(`OpenRouter vision error: ${JSON.stringify(data)}`)
  log('LLM vision ← response', {content: content.slice(0, 300)})
  return content
}
