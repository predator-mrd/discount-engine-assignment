import { describe, expect, it } from 'vitest'
import { parsePdfPages } from '../src/inputs/pdfTable.js'

const cell = (str, x, y) => ({ str, transform: [1, 0, 0, 1, x, y] })
const line = (values, y) => values.map((value, index) => cell(value, [30, 250, 420, 550][index], y))
const header = line(['Product', 'Brand', 'Platform', 'Base Price'], 700)
const row = (price = 'Rs.1,299') =>
  line(['Cushion Cover', 'Natura Casa', 'Amazon India', price], 660)

describe('PDF table adapter', () => {
  it('reads a positioned table without splitting names at spaces', () => {
    const result = parsePdfPages([
      [cell('Order #OP-9921', 30, 760), ...header, ...row(), cell('Page 1', 30, 30)],
    ])
    expect(result.errors).toEqual([])
    expect(result.data).toEqual([
      {
        itemId: 'ITEM-01',
        product: 'Cushion Cover',
        brand: 'Natura Casa',
        platform: 'Amazon India',
        basePrice: 1299,
      },
    ])
  })
  it('handles separate words and small baseline differences', () => {
    const result = parsePdfPages([
      [
        ...header,
        cell('Cushion', 30, 660),
        cell('Cover', 80, 660.5),
        cell('Natura', 250, 661),
        cell('Casa', 290, 660),
        cell('Amazon India', 420, 660),
        cell('₹ 1,299', 550, 660),
      ],
    ])
    expect(result.errors).toEqual([])
    expect(result.data[0].brand).toBe('Natura Casa')
  })
  it('handles repeated headers on multiple pages and assigns unique IDs', () => {
    const result = parsePdfPages([
      [...header, ...row()],
      [...header, ...row('INR 849')],
    ])
    expect(result.data.map((item) => item.itemId)).toEqual(['ITEM-01', 'ITEM-02'])
  })
  it('reads a header whose Base and Price words are separate text fragments', () => {
    const splitHeader = [...header.slice(0, 3), cell('Base', 550, 700), cell('Price', 575, 700)]
    expect(parsePdfPages([[...splitHeader, ...row()]]).data[0].basePrice).toBe(1299)
  })
  it.each(['unknown', '-100', 'Rs.1,29', '100.25', '1e3'])(
    'rejects a malformed row atomically: %s',
    (price) => {
      const result = parsePdfPages([
        [...header, ...row(), ...line(['Tray', 'Acme', 'Shop', price], 630)],
      ])
      expect(result.data).toEqual([])
      expect(result.errors[0]).toContain('Page 1, row 2')
    }
  )
  it('reports a missing field, missing header, or empty table', () => {
    expect(
      parsePdfPages([[...header, ...line(['Tray', '', 'Shop', '100'], 660)]]).errors[0]
    ).toContain('Brand')
    expect(parsePdfPages([[...row()]]).errors[0]).toContain('header')
    expect(parsePdfPages([[...header]]).errors[0]).toContain('No cart rows')
  })
})
