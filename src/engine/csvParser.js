import Papa from 'papaparse'
import { validateCartItem, validateDiscountRule } from './validation.js'

function number(value, name) {
  const raw = String(value ?? '').trim()
  if (!/^\d+(?:\.\d+)?$/.test(raw))
    throw new Error(`${name} must be a number, without currency symbols or separators.`)
  return Number(raw)
}

function boolean(value) {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase()
  if (['true', 'yes', '1'].includes(raw)) return true
  if (['false', 'no', '0'].includes(raw)) return false
  throw new Error('Stackable must be true or false.')
}

function parseCSV(csvText, columns, convert, idKey) {
  const parsed = Papa.parse(csvText.trim(), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) =>
      header
        .replace(/^\uFEFF/, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_'),
  })
  const errors = parsed.errors.map(
    (error) => `${Number.isInteger(error.row) ? `Row ${error.row + 2}: ` : ''}${error.message}`
  )
  const missing = columns.filter((column) => !parsed.meta.fields?.includes(column))
  if (missing.length) errors.push(`Missing columns: ${missing.join(', ')}.`)
  if (!parsed.data.length) errors.push('The CSV has no data rows.')
  if (parsed.data.length > 1000) errors.push('Please upload 1,000 rows or fewer.')
  if (errors.length) return { data: [], errors }
  const data = []
  const seen = new Set()
  parsed.data.forEach((row, index) => {
    try {
      const record = convert(row)
      const id = record[idKey].toLowerCase()
      if (seen.has(id)) throw new Error(`Duplicate ID: ${record[idKey]}.`)
      seen.add(id)
      data.push(record)
    } catch (error) {
      errors.push(`Row ${index + 2}: ${error.message}`)
    }
  })
  // A partial cart would hide missing items in the checkout total.
  return { data: errors.length ? [] : data, errors }
}

export function parseRulesCSV(csvText) {
  return parseCSV(
    csvText,
    ['rule_id', 'scope', 'applies_to', 'type', 'value', 'stackable'],
    (row) =>
      validateDiscountRule({
        ruleId: row.rule_id,
        scope: row.scope?.trim().toLowerCase(),
        appliesTo: row.applies_to?.trim(),
        type: row.type?.trim().toLowerCase(),
        value: number(row.value, 'Value'),
        stackable: boolean(row.stackable),
        minCartValue: String(row.min_cart_value ?? '').trim()
          ? number(row.min_cart_value, 'Minimum cart value')
          : null,
      }),
    'ruleId'
  )
}

export function parseCartCSV(csvText) {
  return parseCSV(
    csvText,
    ['item_id', 'product', 'brand', 'platform', 'base_price'],
    (row) =>
      validateCartItem({
        itemId: row.item_id,
        product: row.product,
        brand: row.brand,
        platform: row.platform,
        basePrice: number(row.base_price, 'Base price'),
      }),
    'itemId'
  )
}
