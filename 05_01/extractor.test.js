// 05_01/extractor.test.js
import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {mergeFacts, isComplete, formatFacts} from './extractor.js'

describe('mergeFacts', () => {
  it('merges partial facts into existing facts', () => {
    const facts = {cityName: null, cityArea: null, warehousesCount: null, phoneNumber: null}
    const partial = {cityName: 'Warsaw', warehousesCount: 5}
    const result = mergeFacts(facts, partial)
    assert.equal(result.cityName, 'Warsaw')
    assert.equal(result.warehousesCount, 5)
    assert.equal(result.cityArea, null)
    assert.equal(result.phoneNumber, null)
  })

  it('does not overwrite existing non-null values', () => {
    const facts = {cityName: 'Warsaw', cityArea: null, warehousesCount: null, phoneNumber: null}
    const partial = {cityName: 'Krakow'}
    const result = mergeFacts(facts, partial)
    assert.equal(result.cityName, 'Warsaw')
  })
})

describe('isComplete', () => {
  it('returns true when all fields populated', () => {
    assert.equal(isComplete({cityName: 'Warsaw', cityArea: '123.45', warehousesCount: 5, phoneNumber: '123456789'}), true)
  })

  it('returns false when any field is null', () => {
    assert.equal(isComplete({cityName: 'Warsaw', cityArea: null, warehousesCount: 5, phoneNumber: '123456789'}), false)
  })
})

describe('formatFacts', () => {
  it('rounds cityArea to 2 decimal places', () => {
    const result = formatFacts({cityName: 'Warsaw', cityArea: '123.456', warehousesCount: '5', phoneNumber: '123'})
    assert.equal(result.cityArea, '123.46')
  })

  it('converts warehousesCount to integer', () => {
    const result = formatFacts({cityName: 'Warsaw', cityArea: '123.45', warehousesCount: '5.9', phoneNumber: '123'})
    assert.equal(result.warehousesCount, 5)
  })
})
