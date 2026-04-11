import {readFileSync} from 'fs'
import {dirname, join} from 'path'
import {fileURLToPath} from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const env = Object.fromEntries(
  readFileSync(join(__dirname, '..', '.env'), 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => l.split('=').map(s => s.trim()))
)

export const API_KEY = env.AIDEVS_KEY
export const ENDPOINT = `${env.BASE_URL.replace(/\/$/, '')}/verify`
export const OPENROUTER_KEY = env.OPENROUTER_API_KEY
export const OLLAMA_URL = env.OLLAMA_URL

export const MODEL_TEXT = 'google/gemma-4-31b-it'
export const MODEL_VISION = 'google/gemini-3.1-flash-lite-preview'
export const MODEL_SYNTH = 'google/gemma-4-31b-it'
export const MODEL_AUDIO = 'google/gemini-3.1-flash-lite-preview'

export const PROVIDER_TEXT = 'openrouter'   // 'openrouter' | 'ollama'
export const PROVIDER_VISION = 'openrouter' // vision always requires openrouter
export const PROVIDER_SYNTH = 'openrouter'  // 'openrouter' | 'ollama'
export const MAX_RETRIES = 5
