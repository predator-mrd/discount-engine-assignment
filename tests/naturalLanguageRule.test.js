import { describe, expect, it, vi } from 'vitest'
import { parseModelResponse, parseNaturalLanguageRule } from '../src/inputs/naturalLanguageRule.js'

const ready = (rule = {}) => ({
  status: 'ready',
  message: 'Review this offer before adding it.',
  rule: {
    scope: 'brand',
    appliesTo: 'Natura Casa',
    type: 'percentage',
    value: 20,
    stackable: true,
    minCartValue: null,
    ...rule,
  },
})
const reply = (payload) => ({
  ok: true,
  json: async () => ({
    choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(payload) } }],
  }),
})

describe('LLM rule input', () => {
  it.each([
    [{}, { scope: 'brand', appliesTo: 'Natura Casa', value: 20, stackable: true }],
    [
      { scope: 'platform', appliesTo: 'Flipkart', type: 'flat', value: 100, stackable: false },
      { scope: 'platform', type: 'flat', value: 100 },
    ],
    [
      { scope: 'cart', appliesTo: '', value: 10, minCartValue: 5000, stackable: false },
      { scope: 'cart', minCartValue: 5000 },
    ],
  ])('validates each supported rule shape', (input, expected) => {
    expect(parseModelResponse(ready(input), 'NEW-RULE').rule).toMatchObject({
      ruleId: 'NEW-RULE',
      ...expected,
    })
  })
  it('shows a useful clarification rather than inventing a rule', () => {
    expect(() =>
      parseModelResponse(
        {
          status: 'needs_clarification',
          message: 'What percentage and minimum cart value should apply?',
          rule: null,
        },
        'R'
      )
    ).toThrow('What percentage')
  })
  it.each([
    { value: 150 },
    { value: '20' },
    { stackable: 'true' },
    { appliesTo: '' },
    { scope: 'category' },
    { minCartValue: 4000 },
    { couponCode: 'SAVE20' },
  ])('rejects invalid model output: %j', (invalid) => {
    expect(() => parseModelResponse(ready(invalid), 'R')).toThrow('invalid rule')
  })
  it('rejects a missing minimum field even on an item rule', () => {
    const payload = ready()
    delete payload.rule.minCartValue
    expect(() => parseModelResponse(payload, 'R')).toThrow('all rule fields')
  })
  it('sends a schema-constrained real API request and returns a draft only', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply(ready()))
    const result = await parseNaturalLanguageRule(
      '20% off for Natura Casa brand, stackable with other offers',
      { apiKey: 'test-key', fetchImpl }
    )
    expect(result.rule.ruleId).toMatch(/^RULE-/)
    const [url, request] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions')
    expect(url).not.toContain('test-key')
    expect(request.headers.Authorization).toBe('Bearer test-key')
    const body = JSON.parse(request.body)
    expect(body.model).toBe('openai/gpt-oss-20b')
    expect(body.response_format.type).toBe('json_schema')
    expect(body.response_format.json_schema.strict).toBe(true)
    expect(body.response_format.json_schema.schema.required).toContain('rule')
    expect(body.messages[1].content).toBe(
      '20% off for Natura Casa brand, stackable with other offers'
    )
    expect(body).not.toHaveProperty('cart')
  })
  it('requires a key and makes no offline guess', async () => {
    const fetchImpl = vi.fn()
    await expect(
      parseNaturalLanguageRule('Give a discount for big orders', { fetchImpl })
    ).rejects.toThrow('API key')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it.each([
    [401, 'key'],
    [403, 'key'],
    [429, 'quota'],
    [404, 'model'],
    [400, 'strict structured output'],
    [500, 'HTTP 500'],
  ])('handles provider HTTP %i', async (status, message) => {
    await expect(
      parseNaturalLanguageRule('20% off for Acme brand', {
        apiKey: 'test-key',
        fetchImpl: async () => ({ ok: false, status }),
      })
    ).rejects.toThrow(message)
  })
  it('handles network, truncated, and malformed responses', async () => {
    await expect(
      parseNaturalLanguageRule('an offer', {
        apiKey: 'test-key',
        fetchImpl: async () => {
          throw new TypeError('offline')
        },
      })
    ).rejects.toThrow('connection')
    await expect(
      parseNaturalLanguageRule('an offer', {
        apiKey: 'test-key',
        fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [] }) }),
      })
    ).rejects.toThrow('complete JSON')
    await expect(
      parseNaturalLanguageRule('an offer', {
        apiKey: 'test-key',
        fetchImpl: async () => ({
          ok: true,
          json: async () => ({ choices: [{ finish_reason: 'length' }] }),
        }),
      })
    ).rejects.toThrow('complete JSON')
  })
})
