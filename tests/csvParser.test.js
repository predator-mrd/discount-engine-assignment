import { describe, expect, it } from 'vitest'
import { parseCartCSV, parseRulesCSV } from '../src/engine/csvParser.js'

const cartHeader = 'item_id,product,brand,platform,base_price\n'
const rulesHeader = 'rule_id,scope,applies_to,type,value,stackable,min_cart_value\n'

describe('CSV adapters', () => {
  it('reads quoted product names and normalizes headers', () => {
    const result = parseCartCSV(
      '\uFEFFItem ID,Product,Brand,Platform,Base Price\nI1,"Tray, large",Acme,Shop,1000\n'
    )
    expect(result.errors).toEqual([])
    expect(result.data[0].product).toBe('Tray, large')
  })
  it('allows a cart rule with a blank applies_to field', () => {
    expect(parseRulesCSV(rulesHeader + 'R1,cart,,percentage,10,false,4000').data[0]).toMatchObject({
      scope: 'cart',
      minCartValue: 4000,
      appliesTo: '',
    })
  })
  it('accepts the original six-column item rules format', () => {
    expect(
      parseRulesCSV('rule_id,scope,applies_to,type,value,stackable\nR1,brand,Acme,flat,100,false')
        .data
    ).toHaveLength(1)
  })
  it.each(['100rupees', 'NaN', '-1', '1.50', 'Infinity', '1e3'])(
    'rejects an invalid price without partially accepting rows: %s',
    (price) => {
      const result = parseCartCSV(cartHeader + `I1,Lamp,Acme,Shop,100\nI2,Tray,Acme,Shop,${price}`)
      expect(result.data).toEqual([])
      expect(result.errors[0]).toContain('Row 3')
    }
  )
  it('rejects duplicate IDs, missing columns, empty files and malformed rows', () => {
    expect(
      parseCartCSV(cartHeader + 'I1,Lamp,Acme,Shop,100\ni1,Tray,Acme,Shop,200').errors[0]
    ).toContain('Duplicate ID')
    expect(parseCartCSV('product\nLamp').errors.join(' ')).toContain('Missing columns')
    expect(parseCartCSV(cartHeader).errors).not.toHaveLength(0)
    expect(parseCartCSV(cartHeader + 'I1,Lamp,Acme,Shop').data).toEqual([])
  })
  it.each(['maybe', '', 'false-ish'])('rejects an unrecognized boolean: %s', (value) => {
    expect(
      parseRulesCSV(rulesHeader + `R1,brand,Acme,flat,100,${value},`).errors.join(' ')
    ).toContain('Stackable')
  })
  it.each([
    'R1,cart,,percentage,10,false,',
    'R1,cart,,flat,100,false,4000',
    'R1,brand,Acme,percentage,101,false,',
    'R1,brand,Acme,flat,100,false,4000',
  ])('rejects unsupported or incomplete rules: %s', (row) => {
    expect(parseRulesCSV(rulesHeader + row).data).toEqual([])
    expect(parseRulesCSV(rulesHeader + row).errors).not.toHaveLength(0)
  })
})
