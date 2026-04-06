import {readFileSync} from 'fs'
import {dirname, join} from 'path'
import {fileURLToPath} from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const NOTES_DIR = join(__dirname, 'workspace', 'input', 'natan_notes')

export function readNotes() {
  return {
    ogloszenia: readFileSync(join(NOTES_DIR, 'ogłoszenia.txt'), 'utf8'),
    rozmowy: readFileSync(join(NOTES_DIR, 'rozmowy.txt'), 'utf8'),
    transakcje: readFileSync(join(NOTES_DIR, 'transakcje.txt'), 'utf8'),
  }
}
