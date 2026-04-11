// 05_01/app.js
import {run} from './agent.js'

run().catch(err => {
  console.error('Fatal error:', err.message)
  process.exit(1)
})
