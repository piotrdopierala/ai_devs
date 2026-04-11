// 05_01/decoder.test.js
import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {decodeAttachment} from './decoder.js'

describe('decodeAttachment', () => {
  it('decodes application/json attachment', () => {
    const json = {cityName: 'Warsaw', warehousesCount: 5}
    const b64 = Buffer.from(JSON.stringify(json)).toString('base64')
    const result = decodeAttachment(b64, 'application/json')
    assert.equal(result.type, 'text')
    assert.ok(result.content.includes('Warsaw'))
  })

  it('decodes text/plain attachment', () => {
    const b64 = Buffer.from('The city area is 123.45 km2').toString('base64')
    const result = decodeAttachment(b64, 'text/plain')
    assert.equal(result.type, 'text')
    assert.equal(result.content, 'The city area is 123.45 km2')
  })

  it('returns image type for image attachments', () => {
    const b64 = Buffer.from('fake-image-data').toString('base64')
    const result = decodeAttachment(b64, 'image/png')
    assert.equal(result.type, 'image')
    assert.equal(result.base64, b64)
    assert.equal(result.mimeType, 'image/png')
  })

  it('returns skip for unknown types', () => {
    const b64 = Buffer.from('binary-stuff').toString('base64')
    const result = decodeAttachment(b64, 'application/octet-stream')
    assert.equal(result.type, 'skip')
  })
})
