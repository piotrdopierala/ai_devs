const NOISE_PATTERNS = /^(\.\.\.|static|noise|silence|no signal|crackling|hiss|buzz)$/i
const MIN_TEXT_LENGTH = 10

export function classifySignal(signal) {
  if (signal.attachment) return 'binary'
  if (signal.transcription !== undefined) {
    const t = signal.transcription.trim()
    if (!t || t.length < MIN_TEXT_LENGTH || NOISE_PATTERNS.test(t)) return 'noise'
    return 'text'
  }
  return 'noise'
}
