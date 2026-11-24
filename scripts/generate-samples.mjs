import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { parseCartCSV, parseRulesCSV } from '../src/engine/csvParser.js'
import { calculateCart } from '../src/engine/discountEngine.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sampleDir = resolve(root, 'sample-data')
const publicDir = resolve(root, 'public/samples')
await mkdir(publicDir, { recursive: true })
const cart = parseCartCSV(await readFile(resolve(sampleDir, 'cart.csv'), 'utf8')).data
const rules = parseRulesCSV(await readFile(resolve(sampleDir, 'rules.csv'), 'utf8')).data

async function makePDF(name, rows, { malformed = false, repeat = false } = {}) {
  const pdf = await PDFDocument.create()
  pdf.setTitle('Opptra sample cart')
  pdf.setAuthor('Discount Engine sample data')
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const groups = repeat ? [rows.slice(0, 3), rows.slice(3)] : [rows]
  for (const [pageIndex, group] of groups.entries()) {
    const page = pdf.addPage([700, 460])
    const draw = (text, x, y, strong = false, size = 11) =>
      page.drawText(String(text), {
        x,
        y,
        font: strong ? bold : font,
        size,
        color: rgb(0.1, 0.15, 0.25),
      })
    draw('Opptra | Sample cart', 36, 415, true, 19)
    draw('Order #OP-9921 | Date: 15 Jan 2025', 36, 385)
    const positions = [36, 265, 440, 570]
    const headers = ['Product', 'Brand', 'Platform', 'Base Price']
    headers.forEach((header, index) => draw(header, positions[index], 340, true))
    page.drawLine({
      start: { x: 36, y: 328 },
      end: { x: 666, y: 328 },
      thickness: 1,
      color: rgb(0.8, 0.83, 0.88),
    })
    group.forEach((item, index) => {
      const values = [
        item.product,
        item.brand,
        item.platform,
        malformed && index === 1 ? 'unknown' : `Rs.${item.basePrice.toLocaleString('en-IN')}`,
      ]
      values.forEach((value, column) => draw(value, positions[column], 300 - index * 30))
    })
    draw(`Page ${pageIndex + 1}`, 36, 35, false, 10)
  }
  await writeFile(resolve(sampleDir, name), await pdf.save())
}

await makePDF('cart.pdf', cart)
await makePDF('cart-multipage.pdf', cart, { repeat: true })
await makePDF('cart-malformed.pdf', cart, { malformed: true })
const below =
  'item_id,product,brand,platform,base_price\nITEM-01,Reading Lamp,Local Works,Noon,3999\n'
const boundary = below.replace('3999', '4000')
await writeFile(resolve(sampleDir, 'cart-below-threshold.csv'), below)
await writeFile(resolve(sampleDir, 'cart-at-threshold.csv'), boundary)
await writeFile(
  resolve(sampleDir, 'expected-results.json'),
  `${JSON.stringify(calculateCart(cart, rules), null, 2)}\n`
)
for (const name of ['rules.csv', 'cart.csv', 'cart.pdf'])
  await copyFile(resolve(sampleDir, name), resolve(publicDir, name))
console.log('Sample PDFs, boundary carts, downloadable files and expected results are ready.')
