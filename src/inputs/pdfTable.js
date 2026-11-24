import { validateCartItem } from '../engine/validation.js'

function groupLines(items) {
  const lines = []
  for (const item of items.filter((item) => typeof item.str === 'string' && item.str.trim())) {
    const y = item.transform[5]
    let line = lines.find((entry) => Math.abs(entry.y - y) < 3)
    if (!line) {
      line = { y, cells: [] }
      lines.push(line)
    }
    line.cells.push({ text: item.str.trim(), x: item.transform[4] })
  }
  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) => ({ ...line, cells: line.cells.sort((a, b) => a.x - b.x) }))
}

function findColumns(line) {
  const headings = [[], [], [], []]
  const hasBase = line.cells.some((cell) => /^base$/i.test(cell.text))
  for (const cell of line.cells) {
    const label = cell.text
      .toLowerCase()
      .replace(/[_\s]+/g, ' ')
      .trim()
    if (/^product(?: name)?$/.test(label)) headings[0].push(cell.x)
    if (label === 'brand') headings[1].push(cell.x)
    if (label === 'platform') headings[2].push(cell.x)
    if (/^base(?: price)?$/.test(label) || (!hasBase && label === 'price')) headings[3].push(cell.x)
  }
  if (headings.some((positions) => positions.length !== 1)) return null
  const columns = headings.map((positions) => positions[0])
  return columns.every((x, index) => index === 0 || x > columns[index - 1]) ? columns : null
}

function readPrice(raw) {
  const value = raw.replace(/^(?:Rs\.?|INR|₹)\s*/i, '').trim()
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.00)?$/.test(value)) {
    throw new Error('Base Price must be a whole-rupee amount, for example Rs.1,299.')
  }
  return Number(value.replaceAll(',', ''))
}

// Use column positions, since names such as "Natura Casa" contain spaces too.
export function parsePdfPages(pages) {
  const data = []
  const errors = []
  pages.forEach((items, pageIndex) => {
    const lines = groupLines(items)
    let columns = null
    let row = 0
    for (const line of lines) {
      const found = findColumns(line)
      if (found) {
        columns = found
        continue
      }
      if (!columns) continue
      const text = line.cells.map((cell) => cell.text).join(' ')
      if (
        /^[-_─\s]+$/.test(text) ||
        /^(?:page\s+\d|(?:sub\s*)?total\b|grand\s+total\b|order\s*#|date\s*:)/i.test(text)
      )
        continue
      row += 1
      const values = ['', '', '', '']
      for (const cell of line.cells) {
        let column = 0
        // Small tolerance allows a value to start just left of its heading.
        for (let i = 1; i < columns.length; i += 1) if (cell.x >= columns[i] - 4) column = i
        values[column] += `${values[column] ? ' ' : ''}${cell.text}`
      }
      try {
        data.push(
          validateCartItem({
            itemId: `ITEM-${String(data.length + 1).padStart(2, '0')}`,
            product: values[0],
            brand: values[1],
            platform: values[2],
            basePrice: readPrice(values[3]),
          })
        )
      } catch (error) {
        errors.push(`Page ${pageIndex + 1}, row ${row}: ${error.message}`)
      }
    }
    if (!columns)
      errors.push(
        `Page ${pageIndex + 1}: couldn't find the Product, Brand, Platform, Base Price table header.`
      )
  })
  if (!data.length && !errors.length)
    errors.push('No cart rows found. Use a text PDF with a simple four-column table.')
  if (data.length > 1000) errors.push('Please upload 1,000 items or fewer.')
  return { data: errors.length ? [] : data, errors }
}
