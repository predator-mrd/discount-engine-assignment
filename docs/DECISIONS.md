# Decisions behind the implementation

## Keep the calculator independent of its inputs

The supplied React/Vite app is the starting point. Its item-level functions (`applyDiscounts`, `processCart`, and `cartTotal`) are still available. `calculateCart` adds validation and a cart-offer pass around those functions. There is no CSV, PDF, network request, or React state inside the calculator.

CSV, PDF, and natural-language adapters each produce the same `CartItem` or `DiscountRule` objects. They share validation. Another input mode only needs an adapter; it does not need a pricing branch.

## Whole-rupee rounding

The starter rounds each percentage saving with `Math.round`, then subtracts that saving from the current price. This implementation keeps that behavior. The sample item prices add up to ₹5,932; the cart saving is `Math.round(5932 × 10 / 100) = 593`, leaving ₹5,339.

The brief writes the bed-sheet calculation as `699 × 0.90 = 629`; the exact result is 629.10. Whole-rupee rounding explains the displayed figure. Rather than introduce a second policy, every stage uses the starter's rounding rule.

To make that contract explicit, prices, flat discounts, and minimum cart values must be whole rupees. Fractional money is rejected with a clear error instead of being silently rounded on import. Percentages may have up to two decimal places. A production checkout that charges paise should use integer paise throughout and agree on a rounding policy with its payment provider.

## Selection, stacking, and ties

For each item, compare non-stackable rules by their actual rupee saving, regardless of scope. Apply the winner, then all stackable rules in their input order against the remaining price. This preserves the supplied engine's order. A stackable rule also works when no non-stackable rule matches.

Equal savings keep the earlier rule. Discounts are capped at the current price, and a rule that saves zero is not shown as an applied offer. Exact matching ignores case and repeated spaces; it does not guess that two different brand names mean the same thing.

The brief does not specify how to resolve several cart rules. I use the same convention: pick the best eligible non-stackable cart offer, then apply stackable cart offers in input order. Eligibility for every cart rule uses the same subtotal after item discounts. Cart offers appear only in the order summary; they are not allocated back to items.

With several mixed flat and percentage stackable offers, order can affect the result. The prototype follows the starter's order rather than adding a new global optimization policy. A production rule authoring flow should make priority explicit.

## Threshold wording

Cart conditions use `subtotal >= minCartValue`. The brief's English example says “more than Rs.5,000” but maps that to the same minimum-value field as an inclusive threshold. The parser follows that convention, explains it in the review, and displays “₹5,000 or more.” Tests cover ₹3,999 and ₹4,000 separately, including a base total that clears the threshold before item discounts but falls below it afterward.

## AI drafts are untrusted input

Groq receives a strict JSON schema and instructions to return either a single complete rule or a request for clarification. The default model is `openai/gpt-oss-20b`; every schema field is required and objects disallow additional properties. The model must not invent a discount amount, threshold, or target. Unsupported conditions such as dates, quantity limits, and coupon codes should be surfaced for clarification.

The response is parsed and validated locally before it reaches the confirmation view. A locally generated ID keeps model-generated identifiers out of the rule collection. Only confirmation adds the rule; discarding or editing a draft changes nothing in the cart. Provider errors, malformed JSON, incomplete responses, timeouts, and invalid field values have readable error messages.

The schema catches structural errors, not every possible misunderstanding of English. Confirmation is still useful because a syntactically valid rule can have the wrong intent. The unit and browser tests stub provider replies to exercise that boundary without spending API quota. The separate `npm run test:groq` check uses a real key to exercise the three assignment examples and an ambiguous request.

## Why there is no server

The brief allows a client-side prototype and asks for in-memory state. PDF.js can extract the specified table locally, so a backend would add setup without helping that task. Groq is called directly with the reviewer's own key, entered in the page for that session. No key is bundled, saved to browser storage, or checked into Git. Only the offer description goes to Groq; cart files stay in the browser.

This is a bring-your-own-key demo. A public service using the company's API quota should place the call behind an authenticated, rate-limited server endpoint. Putting a shared secret in a `VITE_*` variable would expose it in the built JavaScript.

## Reject incomplete imports

An upload is accepted as a whole or rejected as a whole. Skipping one malformed row could show a believable but incomplete checkout total. The app names the offending CSV row or PDF page and row, and keeps the previous data until the corrected file is uploaded.

The PDF adapter uses text coordinates to assign cells to columns. Splitting on spaces would break names such as “Natura Casa” and “Amazon India.” It supports simple left-aligned, single-line rows and repeated headers on every page. It does not perform OCR, infer wrapped cells, or parse arbitrary invoice layouts. A scanned PDF, missing table, password-protected file, or unreadable document gets an actionable error.

Files are limited to 5 MB, PDFs to 10 pages, and imports to 1,000 rows. Currency amounts are capped at ₹1,000,000,000 per field. These limits keep a session-sized prototype responsive.

## What is deliberately outside this prototype

There is no database, login, saved history, rule scheduler, tax/shipping calculation, currency conversion, or OCR pipeline. Prices are INR. Refreshing the page clears the cart, rules, and key. The interface recalculates automatically because the brief requires that after a new rule or PDF import; a separate Calculate button would add an unnecessary step.

The original assignment PDF is not included in this repository. The sample carts are newly generated from the supplied example data.
