import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const sample = (name) => fileURLToPath(new URL(`../sample-data/${name}`, import.meta.url))
const llmResponse = (payload) => ({
  choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(payload) } }],
})
const ruleResponse = (rule) =>
  llmResponse({ status: 'ready', message: 'Please review the offer.', rule })
const newBrandRule = {
  scope: 'brand',
  appliesTo: 'Natura Casa',
  type: 'percentage',
  value: 20,
  stackable: true,
  minCartValue: null,
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('the sample checkout matches all six prices and the cart offer', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.getByRole('button', { name: 'Load sample cart & rules' }).click()
  const prices = ['₹1,104', '₹629', '₹509', '₹2,499', '₹382', '₹809']
  for (const [index, price] of prices.entries())
    await expect(page.getByTestId(`price-ITEM-0${index + 1}`)).toHaveText(price)
  await expect(page.getByTestId('item-subtotal')).toHaveText('₹5,932')
  await expect(page.getByTestId('cart-offer')).toContainText('₹593')
  await expect(page.getByTestId('final-total')).toHaveText('₹5,339')
  await expect(page.getByText('No offers available', { exact: true })).toBeVisible()
  expect(errors).toEqual([])
  if (process.env.CAPTURE_SCREENSHOTS)
    await page.screenshot({ path: 'docs/screenshot.png', fullPage: true })
})

test('CSV uploads load the same sample without the shortcut', async ({ page }) => {
  await page.getByLabel('Upload discount rules', { exact: true }).setInputFiles(sample('rules.csv'))
  await page.getByLabel('Upload cart', { exact: true }).setInputFiles(sample('cart.csv'))
  await expect(page.getByTestId('final-total')).toHaveText('₹5,339')
})

test('a PDF replaces the cart and a malformed PDF preserves it', async ({ page }) => {
  await page.getByRole('button', { name: 'Load sample cart & rules' }).click()
  await page
    .getByLabel('Upload cart', { exact: true })
    .setInputFiles(sample('cart-below-threshold.csv'))
  await expect(page.getByTestId('final-total')).toHaveText('₹3,999')
  await expect(page.getByTestId('cart-offer')).toHaveCount(0)
  await page.getByLabel('Upload cart', { exact: true }).setInputFiles(sample('cart.pdf'))
  await expect(page.getByTestId('final-total')).toHaveText('₹5,339')
  await expect(page.getByText('cart.pdf', { exact: true })).toBeVisible()
  await page.getByLabel('Upload cart', { exact: true }).setInputFiles(sample('cart-malformed.pdf'))
  await expect(page.getByRole('alert')).toContainText('Page 1, row 2')
  await expect(page.getByTestId('final-total')).toHaveText('₹5,339')
})

test('a repeated-header multipage PDF is read in full', async ({ page }) => {
  await page.getByRole('button', { name: 'Load sample cart & rules' }).click()
  await page.getByLabel('Upload cart', { exact: true }).setInputFiles(sample('cart-multipage.pdf'))
  await expect(page.getByText('cart-multipage.pdf', { exact: true })).toBeVisible()
  await expect(page.getByTestId('final-total')).toHaveText('₹5,339')
})

test('cart offers appear at the threshold and disappear just below it', async ({ page }) => {
  await page.getByRole('button', { name: 'Load sample cart & rules' }).click()
  await page
    .getByLabel('Upload cart', { exact: true })
    .setInputFiles(sample('cart-at-threshold.csv'))
  await expect(page.getByTestId('final-total')).toHaveText('₹3,600')
  await expect(page.getByTestId('cart-offer')).toBeVisible()
  await page
    .getByLabel('Upload cart', { exact: true })
    .setInputFiles(sample('cart-below-threshold.csv'))
  await expect(page.getByTestId('cart-offer')).toHaveCount(0)
})

test('AI drafts leave checkout alone until confirmed and can be discarded', async ({ page }) => {
  await page.route('https://api.groq.com/openai/v1/chat/completions', (route) =>
    route.fulfill({ json: ruleResponse(newBrandRule) })
  )
  await page.getByRole('button', { name: 'Load sample cart & rules' }).click()
  await page.getByLabel('Groq API key', { exact: true }).fill('test-key')
  await page.getByRole('button', { name: 'Brand offer', exact: true }).click()
  await page.getByRole('button', { name: 'Review rule', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Does this look right?' })).toBeVisible()
  await expect(page.getByTestId('final-total')).toHaveText('₹5,339')
  await page.getByRole('button', { name: 'Discard', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Does this look right?' })).toHaveCount(0)
  await expect(page.getByTestId('final-total')).toHaveText('₹5,339')
  await page.getByRole('button', { name: 'Review rule', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm and add rule', exact: true }).click()
  await expect(page.getByTestId('price-ITEM-01')).toHaveText('₹883')
  await expect(page.getByTestId('final-total')).not.toHaveText('₹5,339')
  await expect(
    page.getByText('Rule added. Your current cart has been recalculated.', { exact: true })
  ).toBeVisible()
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0])
})

test('ambiguous and invalid AI replies produce useful errors without changing rules', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Load sample cart & rules' }).click()
  await page.getByLabel('Groq API key', { exact: true }).fill('test-key')
  await page.getByLabel('Offer description', { exact: true }).fill('Give a discount for big orders')
  await page.route('https://api.groq.com/openai/v1/chat/completions', (route) =>
    route.fulfill({
      json: llmResponse({
        status: 'needs_clarification',
        message: 'Please specify a percentage and minimum cart value.',
        rule: null,
      }),
    })
  )
  await page.getByRole('button', { name: 'Review rule', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('percentage and minimum cart value')
  await expect(page.getByTestId('final-total')).toHaveText('₹5,339')
  await page.unroute('https://api.groq.com/openai/v1/chat/completions')
  await page.route('https://api.groq.com/openai/v1/chat/completions', (route) =>
    route.fulfill({ json: ruleResponse({ ...newBrandRule, value: 150 }) })
  )
  await page.getByRole('button', { name: 'Review rule', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('invalid rule')
  await expect(page.getByRole('button', { name: 'Confirm and add rule' })).toHaveCount(0)
})

test('the workspace fits a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Load sample cart & rules' }).click()
  await expect(page.getByTestId('final-total')).toHaveText('₹5,339')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  )
})
