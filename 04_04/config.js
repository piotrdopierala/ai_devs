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
export const MODEL = 'google/gemma-4-31b-it'
export const OLLAMA_URL = env.OLLAMA_URL
export const OLLAMA_MODEL = 'gemma4:e4b'
export const PROVIDER = 'ollama' // 'openrouter' | 'ollama'
export const MAX_RETRIES = 5
