import {run} from './agent.js'

run().catch(err => console.error('Fatal error:', err.message))
