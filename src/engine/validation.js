const MAX_RUPEES = 1_000_000_000

function text(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required.`)
  if (value.trim().length > 160) throw new Error(`${name} must be 160 characters or fewer.`)
  return value.trim().replace(/\s+/g, ' ')
}

function wholeRupees(value, name) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_RUPEES) {
    throw new Error(`${name} must be a whole-rupee amount between 0 and 1,000,000,000.`)
  }
  return value
}

export function validateCartItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item))
    throw new Error('Expected a cart item.')
  return {
    itemId: text(item.itemId, 'Item ID'),
    product: text(item.product, 'Product'),
    brand: text(item.brand, 'Brand'),
    platform: text(item.platform, 'Platform'),
    basePrice: wholeRupees(item.basePrice, 'Base price'),
  }
}

export function validateDiscountRule(rule) {
  if (!rule || typeof rule !== 'object' || Array.isArray(rule))
    throw new Error('Expected a discount rule.')
  const fields = ['ruleId', 'scope', 'appliesTo', 'type', 'value', 'stackable', 'minCartValue']
  if (Object.keys(rule).some((field) => !fields.includes(field)))
    throw new Error('The rule contains unsupported fields or conditions.')
  const ruleId = text(rule.ruleId, 'Rule ID')
  if (!['brand', 'platform', 'cart'].includes(rule.scope))
    throw new Error('Scope must be brand, platform, or cart.')
  if (!['percentage', 'flat'].includes(rule.type))
    throw new Error('Type must be percentage or flat.')
  if (typeof rule.stackable !== 'boolean') throw new Error('Stackable must be true or false.')
  if (typeof rule.value !== 'number' || !Number.isFinite(rule.value) || rule.value <= 0) {
    throw new Error('Discount value must be a positive number.')
  }
  if (
    rule.type === 'percentage' &&
    (rule.value > 100 || Math.abs(rule.value * 100 - Math.round(rule.value * 100)) > 1e-8)
  ) {
    throw new Error('Percentage must be at most 100, with up to two decimal places.')
  }
  if (rule.type === 'flat') wholeRupees(rule.value, 'Flat discount')
  let appliesTo = ''
  let minCartValue = null
  if (rule.scope === 'cart') {
    if (rule.type !== 'percentage') throw new Error('Cart offers must be percentage discounts.')
    if (rule.appliesTo !== '' && rule.appliesTo != null)
      throw new Error('Cart offers apply to the entire cart; leave applies_to empty.')
    minCartValue = wholeRupees(rule.minCartValue, 'Minimum cart value')
  } else {
    appliesTo = text(rule.appliesTo, 'Brand or platform name')
    if (rule.minCartValue != null)
      throw new Error('Only cart offers can have a minimum cart value.')
  }
  return {
    ruleId,
    scope: rule.scope,
    appliesTo,
    type: rule.type,
    value: rule.value,
    stackable: rule.stackable,
    minCartValue,
  }
}

export function validateCollection(values, validate, idKey) {
  const seen = new Set()
  return values.map((value) => {
    const result = validate(value)
    const id = result[idKey].toLowerCase()
    if (seen.has(id)) throw new Error(`Duplicate ID: ${result[idKey]}.`)
    seen.add(id)
    return result
  })
}
