import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {classifySignal} from './router.js'

describe('classifySignal', () => {
  it('classifies transcription signal as text', () => {
    assert.equal(classifySignal({transcription: 'Hello from Zion city'}), 'text')
  })

  it('classifies short/empty transcription as noise', () => {
    assert.equal(classifySignal({transcription: '...'}), 'noise')
    assert.equal(classifySignal({transcription: ''}), 'noise')
    assert.equal(classifySignal({transcription: 'static'}), 'noise')
    assert.equal(classifySignal({transcription: 'noise'}), 'noise')
    assert.equal(classifySignal({transcription: 'hi'}), 'noise')
  })

  it('classifies attachment signal as binary', () => {
    assert.equal(classifySignal({attachment: 'BASE64==', meta: 'image/png'}), 'binary')
  })

  it('classifies signal with no useful fields as noise', () => {
    assert.equal(classifySignal({}), 'noise')
    assert.equal(classifySignal({message: 'Signal captured.', code: 100}), 'noise')
  })
})
