import assert from 'node:assert/strict'
import { createInterface } from 'node:readline'
import { parseNaturalLanguageRule, DEFAULT_MODEL } from '../src/inputs/naturalLanguageRule.js'

// Read a key from the environment or stdin; never write it to a fixture or report.
async function readKey() {
  if (!process.argv.includes('--stdin-key')) return process.env.GROQ_API_KEY
  const interactive = process.stdin.isTTY
  if (interactive) process.stdin.setRawMode(true)
  const input = createInterface({ input: process.stdin, terminal: false })
  console.log('Waiting for the Groq API key on stdin. The key will not be printed.')
  try {
    const key = await new Promise((resolve, reject) => {
      input.once('line', resolve)
      input.once('close', () => reject(new Error('No key was received on stdin.')))
    })
    return key.trim()
  } finally {
    input.close()
    if (interactive) process.stdin.setRawMode(false)
  }
}

const cases = [
  {
    name: 'stackable brand offer',
    description: '20% off for Natura Casa brand, stackable with other offers',
    expected: {
      scope: 'brand',
      appliesTo: 'Natura Casa',
      type: 'percentage',
      value: 20,
      stackable: true,
      minCartValue: null,
    },
  },
  {
    name: 'flat platform offer',
    description: 'Rs.100 flat discount on all Flipkart items',
    expected: {
      scope: 'platform',
      appliesTo: 'Flipkart',
      type: 'flat',
      value: 100,
      stackable: false,
      minCartValue: null,
    },
  },
  {
    name: 'cart threshold offer',
    description: '10% off if cart value is more than Rs.5,000',
    expected: {
      scope: 'cart',
      appliesTo: '',
      type: 'percentage',
      value: 10,
      stackable: false,
      minCartValue: 5000,
    },
  },
]

try {
  const apiKey = await readKey()
  if (!apiKey) throw new Error('Set GROQ_API_KEY or use --stdin-key before running this check.')
  const model = process.env.GROQ_MODEL || DEFAULT_MODEL
  for (const example of cases) {
    const { rule } = await parseNaturalLanguageRule(example.description, { apiKey, model })
    const { ruleId, ...fields } = rule
    assert.ok(ruleId)
    assert.deepEqual(fields, example.expected)
    console.log(`PASS: ${example.name}`)
  }
  let clarified = false
  try {
    await parseNaturalLanguageRule('Give a discount for big orders', { apiKey, model })
  } catch (error) {
    // A provider failure must not count as successful ambiguity handling.
    if (
      !/(?:percentage|discount|minimum|threshold|amount|value)/i.test(error.message) ||
      /(?:HTTP|quota|key|connection|timed out|JSON|invalid rule)/i.test(error.message)
    )
      throw error
    clarified = true
  }
  assert.ok(clarified, 'Ambiguous input should ask for clarification instead of creating a rule.')
  console.log('PASS: ambiguous input asks for clarification')
  console.log(`All 4 live Groq checks passed using ${model}.`)
} catch (error) {
  console.error(`Live Groq check failed: ${error.message}`)
  process.exitCode = 1
}
