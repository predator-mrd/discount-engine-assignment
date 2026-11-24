import { validateCartItem, validateCollection, validateDiscountRule } from './validation.js'

export function ruleMatchesItem(item, rule) {
  const normalise = (value) => value.trim().replace(/\s+/g, ' ').toLowerCase()
  if (rule.scope === 'brand') return normalise(item.brand) === normalise(rule.appliesTo)
  if (rule.scope === 'platform') return normalise(item.platform) === normalise(rule.appliesTo)
  return false
}

export function calculateDiscountAmount(price, rule) {
  // The starter rounds each saving to whole rupees. Keep that policy at checkout.
  const saving = rule.type === 'percentage' ? Math.round((price * rule.value) / 100) : rule.value
  return Math.min(price, Math.max(0, saving))
}

export function describeRule(rule) {
  const scope = { brand: 'Brand', platform: 'Platform', cart: 'Cart' }[rule.scope]
  const offer =
    rule.type === 'percentage'
      ? `${rule.value}% off`
      : `Rs.${rule.value.toLocaleString('en-IN')} off`
  return `${scope} offer: ${offer}`
}

function selectRules(price, matchingRules) {
  const exclusive = matchingRules.filter((rule) => !rule.stackable)
  // Keeping the earlier rule on a tie makes repeated calculations predictable.
  const winner = exclusive.reduce(
    (best, rule) =>
      !best || calculateDiscountAmount(price, rule) > calculateDiscountAmount(price, best)
        ? rule
        : best,
    null
  )
  return {
    selected: [...(winner ? [winner] : []), ...matchingRules.filter((rule) => rule.stackable)],
    skipped: exclusive.filter((rule) => rule !== winner),
  }
}

function applyRules(price, selected) {
  const offers = []
  for (const rule of selected) {
    const saving = calculateDiscountAmount(price, rule)
    if (saving === 0) continue
    offers.push({
      ruleId: rule.ruleId,
      label: describeRule(rule),
      saving,
      priceBefore: price,
      priceAfter: price - saving,
    })
    price -= saving
  }
  return { price, offers }
}

export function applyDiscounts(item, rules) {
  const matching = rules.filter((rule) => ruleMatchesItem(item, rule))
  const { selected, skipped } = selectRules(item.basePrice, matching)
  const { price, offers } = applyRules(item.basePrice, selected)
  let reasoning = offers.length
    ? offers.map((offer) => offer.label).join(' + ')
    : 'No offers available'
  if (
    offers.length &&
    skipped.length &&
    selected[0] &&
    !selected[0].stackable &&
    calculateDiscountAmount(item.basePrice, selected[0]) > 0
  ) {
    const alternative = Math.max(
      ...skipped.map((rule) => calculateDiscountAmount(item.basePrice, rule))
    )
    reasoning += ` (best saving: Rs.${offers[0].saving}; next offer: Rs.${alternative})`
  }
  return {
    ...item,
    finalPrice: price,
    totalDiscount: item.basePrice - price,
    appliedRules: offers.map((offer) => offer.ruleId),
    skippedRules: skipped.map((rule) => rule.ruleId),
    reasoning,
    offers,
    status:
      offers.length > 1
        ? 'Stacked'
        : offers.length === 0
          ? 'No offer'
          : skipped.length
            ? 'Max discount'
            : 'Discount applied',
  }
}

// Keep the starter's item-level API available to every input adapter.
export function processCart(cartItems, rules) {
  return cartItems.map((item) => applyDiscounts(item, rules))
}

export function cartTotal(results) {
  return results.reduce((sum, result) => sum + result.finalPrice, 0)
}

export function calculateCart(cartItems, rules) {
  const items = validateCollection(cartItems, validateCartItem, 'itemId')
  const activeRules = validateCollection(rules, validateDiscountRule, 'ruleId')
  const results = processCart(items, activeRules)
  const baseTotal = items.reduce((sum, item) => sum + item.basePrice, 0)
  const subtotal = cartTotal(results)
  // Every threshold uses the same item subtotal, before any cart offer is applied.
  const eligible = items.length
    ? activeRules.filter((rule) => rule.scope === 'cart' && subtotal >= rule.minCartValue)
    : []
  const { selected } = selectRules(subtotal, eligible)
  const { price: finalTotal, offers: cartOffers } = applyRules(subtotal, selected)
  return {
    results,
    baseTotal,
    subtotal,
    cartOffers,
    finalTotal,
    itemSavings: baseTotal - subtotal,
    cartSavings: subtotal - finalTotal,
    totalSavings: baseTotal - finalTotal,
  }
}
