import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  applyDiscounts,
  calculateCart,
  processCart,
  cartTotal,
} from '../src/engine/discountEngine.js'
import { parseCartCSV, parseRulesCSV } from '../src/engine/csvParser.js'

const sample = (name) => readFileSync(new URL(`../sample-data/${name}`, import.meta.url), 'utf8')
const items = parseCartCSV(sample('cart.csv')).data
const rules = parseRulesCSV(sample('rules.csv')).data
const item = (basePrice = 1000) => ({
  itemId: 'I-1',
  product: 'Lamp',
  brand: 'Acme',
  platform: 'Shop',
  basePrice,
})
const rule = (overrides = {}) => ({
  ruleId: 'R-1',
  scope: 'brand',
  appliesTo: 'Acme',
  type: 'flat',
  value: 100,
  stackable: false,
  minCartValue: null,
  ...overrides,
})

describe('the assignment checkout', () => {
  it('keeps every starter price and applies the separate cart offer', () => {
    const checkout = calculateCart(items, rules)
    expect(checkout.results.map((result) => result.finalPrice)).toEqual([
      1104, 629, 509, 2499, 382, 809,
    ])
    expect(checkout).toMatchObject({
      baseTotal: 6594,
      subtotal: 5932,
      itemSavings: 662,
      cartSavings: 593,
      finalTotal: 5339,
      totalSavings: 1255,
    })
    expect(checkout.cartOffers).toEqual([
      expect.objectContaining({ ruleId: 'RULE-04', saving: 593 }),
    ])
    expect(checkout.results[0].appliedRules).toEqual(['RULE-01'])
    expect(checkout.results[0].reasoning).toContain('best saving: Rs.195; next offer: Rs.150')
    expect(checkout.results[1].appliedRules).toEqual(['RULE-02', 'RULE-03'])
    expect(checkout.results[1].offers[1]).toMatchObject({
      priceBefore: 699,
      saving: 70,
      priceAfter: 629,
    })
    expect(checkout.results[3].reasoning).toBe('No offers available')
    expect(checkout.results[5].appliedRules).toEqual(['RULE-03'])
    expect(cartTotal(processCart(items, rules))).toBe(5932)
  })

  it.each([
    [3999, 3999, 0],
    [4000, 3600, 1],
  ])('checks the inclusive threshold at Rs.%i', (price, total, offers) => {
    const checkout = calculateCart([item(price)], [rules[3]])
    expect(checkout.finalTotal).toBe(total)
    expect(checkout.cartOffers).toHaveLength(offers)
  })

  it('checks the threshold after item savings, not against the base total', () => {
    const checkout = calculateCart([item(4100)], [rule({ value: 200 }), rules[3]])
    expect(checkout.subtotal).toBe(3900)
    expect(checkout.cartOffers).toEqual([])
  })
})

describe('discount selection and guardrails', () => {
  it('chooses savings across scopes, then stacks on the remaining price', () => {
    const result = applyDiscounts(item(), [
      rule(),
      rule({ ruleId: 'R-2', scope: 'platform', appliesTo: 'Shop', type: 'percentage', value: 20 }),
      rule({ ruleId: 'R-3', type: 'percentage', value: 10, stackable: true }),
    ])
    expect(result.finalPrice).toBe(720)
    expect(result.appliedRules).toEqual(['R-2', 'R-3'])
  })

  it('uses the first rule for tied savings', () => {
    expect(
      applyDiscounts(item(), [rule(), rule({ ruleId: 'R-2', type: 'percentage', value: 10 })])
        .appliedRules
    ).toEqual(['R-1'])
  })

  it('uses case-insensitive exact name matching with normalized spaces', () => {
    expect(applyDiscounts({ ...item(), brand: '  ACME  ' }, [rule()]).finalPrice).toBe(900)
    expect(applyDiscounts({ ...item(), brand: 'Acme Plus' }, [rule()]).finalPrice).toBe(1000)
  })

  it('never makes an item or cart negative', () => {
    expect(
      calculateCart([item(50)], [rule({ value: 5000 }), rule({ ruleId: 'R-2', stackable: true })])
        .finalTotal
    ).toBe(0)
    expect(calculateCart([item()], [rule({ type: 'percentage', value: 100 })]).finalTotal).toBe(0)
  })

  it('does not label zero-saving rules as applied', () => {
    const checkout = calculateCart(
      [item(0)],
      [
        rule(),
        rule({
          ruleId: 'C',
          scope: 'cart',
          appliesTo: '',
          type: 'percentage',
          value: 10,
          minCartValue: 0,
        }),
      ]
    )
    expect(checkout.results[0].reasoning).toBe('No offers available')
    expect(checkout.cartOffers).toEqual([])
  })

  it('applies the best non-stackable cart offer, then stackable cart offers', () => {
    const cartRule = {
      ruleId: 'C1',
      scope: 'cart',
      appliesTo: '',
      type: 'percentage',
      value: 10,
      minCartValue: 0,
      stackable: false,
    }
    const checkout = calculateCart(
      [item()],
      [
        cartRule,
        { ...cartRule, ruleId: 'C2', value: 20 },
        { ...cartRule, ruleId: 'C3', stackable: true },
      ]
    )
    expect(checkout.cartOffers.map((offer) => offer.ruleId)).toEqual(['C2', 'C3'])
    expect(checkout.finalTotal).toBe(720)
  })

  it('handles an empty cart and a cart without rules', () => {
    expect(calculateCart([], rules)).toMatchObject({ finalTotal: 0, cartOffers: [] })
    expect(calculateCart([item()], []).finalTotal).toBe(1000)
  })

  it('does not mutate its inputs', () => {
    const cart = structuredClone(items)
    const active = structuredClone(rules)
    calculateCart(cart, active)
    expect(cart).toEqual(items)
    expect(active).toEqual(rules)
  })

  it.each([NaN, Infinity, -1, 100.5])('rejects invalid input prices: %s', (basePrice) => {
    expect(() => calculateCart([item(basePrice)], [])).toThrow('whole-rupee')
  })

  it('rejects duplicate IDs and invalid discounts before pricing', () => {
    expect(() => calculateCart([item(), item()], [])).toThrow('Duplicate ID')
    expect(() => calculateCart([item()], [rule({ value: 120, type: 'percentage' })])).toThrow(
      'at most 100'
    )
  })
})
