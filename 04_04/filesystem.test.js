import {test} from 'node:test'
import assert from 'node:assert/strict'
import {normalizeName, buildBatchActions} from './filesystem.js'

test('normalizeName lowercases input', () => {
  assert.equal(normalizeName('Domatowo'), 'domatowo')
})

test('normalizeName strips Polish diacritics', () => {
  assert.equal(normalizeName('łódź'), 'lodz')
})

test('normalizeName handles all diacritics: ąćęłńóśźż', () => {
  assert.equal(normalizeName('ąćęłńóśźż'), 'acelnoszz')
})

test('normalizeName converts spaces to underscores', () => {
  assert.equal(normalizeName('Natan Rams'), 'natan_rams')
})

test('normalizeName truncates to 20 chars', () => {
  const result = normalizeName('abcdefghijklmnopqrstuvwxyz')
  assert.equal(result.length, 20)
})

test('normalizeName removes non-alphanum chars', () => {
  assert.equal(normalizeName('hello-world!'), 'helloworld')
})

test('buildBatchActions first action is reset', () => {
  const actions = buildBatchActions({cities: {}, people: {}, goods: {}})
  assert.equal(actions[0].action, 'reset')
})

test('buildBatchActions creates three directories', () => {
  const actions = buildBatchActions({cities: {}, people: {}, goods: {}})
  const dirs = actions.filter(a => a.action === 'createDirectory').map(a => a.path)
  assert.deepEqual(dirs.sort(), ['/miasta', '/osoby', '/towary'])
})

test('buildBatchActions all directories come before all files', () => {
  const data = {
    cities: {Domatowo: {makaron: 60}},
    people: {'Natan Rams': 'Domatowo'},
    goods: {ryz: ['Darzlubie']}
  }
  const actions = buildBatchActions(data)
  const lastDirIdx = actions.map((a, i) => a.action === 'createDirectory' ? i : -1).filter(i => i >= 0).at(-1)
  const firstFileIdx = actions.findIndex(a => a.action === 'createFile')
  assert.ok(lastDirIdx < firstFileIdx, 'all dirs must precede all files')
})

test('buildBatchActions creates miasto file with JSON content', () => {
  const data = {cities: {Domatowo: {makaron: 60, woda: 150}}, people: {}, goods: {}}
  const actions = buildBatchActions(data)
  const file = actions.find(a => a.path === '/miasta/domatowo')
  assert.ok(file, '/miasta/domatowo file should exist')
  assert.equal(file.content, JSON.stringify({makaron: 60, woda: 150}))
})

test('buildBatchActions creates osoba file with name and link', () => {
  const data = {cities: {}, people: {'Natan Rams': 'Domatowo'}, goods: {}}
  const actions = buildBatchActions(data)
  const file = actions.find(a => a.path === '/osoby/natan_rams')
  assert.ok(file, '/osoby/natan_rams file should exist')
  assert.ok(file.content.includes('Natan Rams'))
  assert.ok(file.content.includes('[Domatowo](/miasta/domatowo)'))
})

test('buildBatchActions creates towar file linking all selling cities', () => {
  const data = {cities: {}, people: {}, goods: {ryz: ['Darzlubie', 'Opalino']}}
  const actions = buildBatchActions(data)
  const file = actions.find(a => a.path === '/towary/ryz')
  assert.ok(file, '/towary/ryz file should exist')
  assert.ok(file.content.includes('[Darzlubie](/miasta/darzlubie)'))
  assert.ok(file.content.includes('[Opalino](/miasta/opalino)'))
})
