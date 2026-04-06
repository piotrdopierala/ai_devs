import {mkdirSync, appendFileSync} from 'fs'
import {dirname, join} from 'path'
import {fileURLToPath} from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const logDir = join(__dirname, 'workspace', 'output')
const logFile = join(logDir, `run-${new Date().toISOString().replace(/[:.]/g, '-')}.md`)
mkdirSync(logDir, {recursive: true})

const t0 = Date.now()
const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`

export function log(msg, data) {
  const line = data !== undefined
    ? `[${elapsed()}] ${msg}:\n${JSON.stringify(data, null, 2)}`
    : `[${elapsed()}] ${msg}`
  console.log(line)
  appendFileSync(logFile, line + '\n\n')
}
