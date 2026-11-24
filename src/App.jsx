import { useMemo, useState } from 'react'
import CsvUploader from './components/CsvUploader.jsx'
import DataTable from './components/DataTable.jsx'
import ErrorBanner from './components/ErrorBanner.jsx'
import RuleInput from './components/RuleInput.jsx'
import { parseCartCSV, parseRulesCSV } from './engine/csvParser.js'
import { calculateCart } from './engine/discountEngine.js'
import { validateDiscountRule } from './engine/validation.js'
import rulesCSV from '../sample-data/rules.csv?raw'
import cartCSV from '../sample-data/cart.csv?raw'

const money = (value) => `₹${value.toLocaleString('en-IN')}`
const samplePath = `${import.meta.env.BASE_URL}samples/`
const RULE_COLUMNS = [
  {
    key: 'ruleId',
    label: 'Rule',
    render: (value) => (
      <span className="rule-id" title={value}>
        {value.startsWith('RULE-') && value.length > 20 ? `RULE-${value.slice(-8)}` : value}
      </span>
    ),
  },
  { key: 'scope', label: 'Scope', render: (value) => <span className="capitalize">{value}</span> },
  { key: 'appliesTo', label: 'Applies to', render: (value) => value || 'Entire cart' },
  {
    key: 'value',
    label: 'Offer',
    render: (value, rule) => (rule.type === 'percentage' ? `${value}% off` : `${money(value)} off`),
  },
  {
    key: 'minCartValue',
    label: 'Cart minimum',
    render: (value) => (value === null ? '—' : `${money(value)} or more`),
  },
  { key: 'stackable', label: 'Stackable', render: (value) => (value ? 'Yes' : 'No') },
]

function CartResults({ checkout }) {
  return (
    <section className="panel results-panel" aria-labelledby="results-title">
      <div className="section-top">
        <div>
          <span className="eyebrow">At checkout</span>
          <h2 id="results-title">A better price, explained.</h2>
        </div>
        <span className="badge green">{checkout.results.length} items</span>
      </div>
      <div className="checkout-layout">
        <div className="result-list">
          {checkout.results.map((item) => (
            <article className="result-item" key={item.itemId}>
              <div className="product-mark" aria-hidden="true">
                {item.product
                  .split(' ')
                  .map((word) => word[0])
                  .slice(0, 2)
                  .join('')}
              </div>
              <div className="item-copy">
                <div className="item-heading">
                  <h3>{item.product}</h3>
                  <span className={`badge ${item.totalDiscount ? 'green' : 'neutral'}`}>
                    {item.status}
                  </span>
                </div>
                <p className="small muted">
                  {item.brand} <span aria-hidden="true">·</span> {item.platform}
                </p>
                <p className={`offer-label ${item.totalDiscount ? '' : 'muted'}`}>
                  {item.reasoning}
                </p>
                {item.appliedRules.length > 0 && (
                  <details className="offer-details">
                    <summary>See savings breakdown</summary>
                    <ul>
                      {item.offers.map((offer) => (
                        <li key={offer.ruleId}>
                          {offer.label} · {money(offer.priceBefore)} − {money(offer.saving)} ={' '}
                          {money(offer.priceAfter)}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
              <div className="item-price">
                <strong data-testid={`price-${item.itemId}`}>{money(item.finalPrice)}</strong>
                {item.totalDiscount > 0 && (
                  <>
                    <s>{money(item.basePrice)}</s>
                    <span className="saving">Save {money(item.totalDiscount)}</span>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
        <aside className="order-summary" aria-label="Order summary">
          <h3>Order summary</h3>
          <div className="summary-row">
            <span>Original total</span>
            <span>{money(checkout.baseTotal)}</span>
          </div>
          <div className="summary-row">
            <span>Item savings</span>
            <span className="saving">−{money(checkout.itemSavings)}</span>
          </div>
          <div className="summary-row subtotal">
            <span>Item subtotal</span>
            <strong data-testid="item-subtotal">{money(checkout.subtotal)}</strong>
          </div>
          {checkout.cartOffers.map((offer) => (
            <div className="cart-offer" data-testid="cart-offer" key={offer.ruleId}>
              <span>{offer.label}</span>
              <strong>−{money(offer.saving)}</strong>
              <small>{money(offer.saving)} saved on your cart</small>
            </div>
          ))}
          <div className="summary-row final-total">
            <span>You pay</span>
            <strong data-testid="final-total">{money(checkout.finalTotal)}</strong>
          </div>
          <div className="total-saving">You’re saving {money(checkout.totalSavings)} today.</div>
          <p className="small muted">
            Cart offers are checked after item savings. All prices are in INR.
          </p>
        </aside>
      </div>
    </section>
  )
}

export default function App() {
  const [rules, setRules] = useState([])
  const [cartItems, setCartItems] = useState([])
  const [rulesErrors, setRulesErrors] = useState([])
  const [cartErrors, setCartErrors] = useState([])
  const [rulesFile, setRulesFile] = useState('No rules loaded')
  const [cartFile, setCartFile] = useState('No cart loaded')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const [notice, setNotice] = useState('')
  const [showCart, setShowCart] = useState(false)
  const checkout = useMemo(() => calculateCart(cartItems, rules), [cartItems, rules])

  function loadExample() {
    setRules(parseRulesCSV(rulesCSV).data)
    setCartItems(parseCartCSV(cartCSV).data)
    setRulesFile('Sample rules · includes cart offer')
    setCartFile('Sample cart · 6 items')
    setRulesErrors([])
    setCartErrors([])
    setRevision((value) => value + 1)
    setNotice('Sample cart and four rules loaded. Checkout is ready below.')
  }

  async function upload(file, kind) {
    const isRules = kind === 'rules'
    const setErrors = isRules ? setRulesErrors : setCartErrors
    setErrors([])
    setBusy(true)
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Please choose a file smaller than 5 MB.')
      const extension = file.name.split('.').pop().toLowerCase()
      let parsed
      if (extension === 'csv') parsed = (isRules ? parseRulesCSV : parseCartCSV)(await file.text())
      else if (!isRules && extension === 'pdf') {
        const { parseCartPDF } = await import('./inputs/pdfCartParser.js')
        parsed = await parseCartPDF(file)
      } else
        throw new Error(isRules ? 'Please choose a rules CSV.' : 'Please choose a cart CSV or PDF.')
      if (parsed.errors.length) {
        setErrors([
          ...parsed.errors,
          'Your previous data has been kept. Fix the file and upload it again.',
        ])
        return
      }
      if (isRules) {
        setRules(parsed.data)
        setRulesFile(file.name)
        setRevision((value) => value + 1)
      } else {
        setCartItems(parsed.data)
        setCartFile(file.name)
      }
      setNotice(
        `${file.name} loaded. ${isRules ? 'Rules replaced' : 'Cart replaced'} and checkout recalculated.`
      )
    } catch (error) {
      setErrors([error.message, 'Your previous data has been kept.'])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to workspace
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a className="wordmark" href="./" aria-label="Opptra home">
            O<span>pp</span>tra<span className="wordmark-dot">.</span>
          </a>
          <div className="header-divider" />
          <span className="header-title">Discount Studio</span>
          <span className="session-label">Session workspace</span>
        </div>
      </header>
      <main id="main">
        <section className="hero">
          <div>
            <span className="eyebrow">The discount engine</span>
            <h1>
              Every offer.
              <br />
              <span>The best price.</span>
            </h1>
            <p>
              Bring your cart and offers together. We’ll work out the savings and show exactly how
              each price adds up.
            </p>
          </div>
          <div className="hero-action">
            <button className="button primary" disabled={busy} onClick={loadExample}>
              Load sample cart & rules
            </button>
            <p className="small muted">Six products. Four offers. One clear total.</p>
          </div>
        </section>
        <div className="workspace-stats" aria-label="Workspace status">
          <span>
            <strong>{cartItems.length}</strong> cart items
          </span>
          <span>
            <strong>{rules.length}</strong> active rules
          </span>
          <span className="stat-saving">
            <strong>{money(checkout.totalSavings)}</strong> total savings
          </span>
        </div>
        <div className="input-layout">
          <section className="panel import-panel" aria-labelledby="import-title">
            <span className="eyebrow">Start with your data</span>
            <h2 id="import-title">A cart. A few good offers.</h2>
            <p className="muted">
              Upload your files or use the sample above. New uploads replace the current data.
            </p>
            <div className="upload-grid">
              <CsvUploader
                label="Upload discount rules"
                description="CSV · Brand, platform and cart offers"
                disabled={busy}
                onLoad={(file) => upload(file, 'rules')}
              />
              <CsvUploader
                label="Upload cart"
                description="CSV or text PDF · Up to 5 MB"
                accept=".csv,.pdf"
                disabled={busy}
                onLoad={(file) => upload(file, 'cart')}
              />
            </div>
            <div className="file-status">
              <span>{rulesFile}</span>
              <span>{cartFile}</span>
            </div>
            {busy && (
              <p role="status" className="small">
                Reading your file…
              </p>
            )}
            <ErrorBanner errors={rulesErrors} />
            <ErrorBanner errors={cartErrors} />
            <div className="sample-links">
              <span className="small muted">Sample files</span>
              <a href={`${samplePath}rules.csv`} download>
                Rules CSV
              </a>
              <a href={`${samplePath}cart.csv`} download>
                Cart CSV
              </a>
              <a href={`${samplePath}cart.pdf`} download>
                Cart PDF
              </a>
            </div>
            <div className="import-note">
              <strong>Simple inputs. Clear results.</strong>
              <p className="small muted">
                PDFs need a text table with Product, Brand, Platform and Base Price columns. Scanned
                images aren’t supported.
              </p>
            </div>
            {cartItems.length > 0 && (
              <details onToggle={(event) => setShowCart(event.currentTarget.open)}>
                <summary>View imported cart</summary>
                {showCart && (
                  <DataTable
                    caption="Imported cart"
                    rows={cartItems}
                    columns={[
                      { key: 'product', label: 'Product' },
                      { key: 'brand', label: 'Brand' },
                      { key: 'platform', label: 'Platform' },
                      { key: 'basePrice', label: 'Base price', render: money },
                    ]}
                  />
                )}
              </details>
            )}
          </section>
          <RuleInput
            key={revision}
            disabled={busy}
            onConfirm={(rule) => {
              const validated = validateDiscountRule(rule)
              setRules((current) => [...current, validated])
              setNotice('New rule added. Checkout now includes the updated offers.')
            }}
          />
        </div>
        <p className="workspace-notice" role="status">
          {notice}
        </p>
        {cartItems.length > 0 ? (
          <CartResults checkout={checkout} />
        ) : (
          <section className="panel empty-checkout">
            <span className="empty-symbol" aria-hidden="true">
              %
            </span>
            <h2>Your next good deal starts here.</h2>
            <p className="muted">
              Load the sample or upload a cart to see every item’s final price.
            </p>
          </section>
        )}
        <section className="panel active-rules" aria-labelledby="rules-title">
          <div className="section-top">
            <div>
              <span className="eyebrow">Behind the savings</span>
              <h2 id="rules-title">Active discount rules</h2>
            </div>
            <span className="badge neutral">{rules.length} rules</span>
          </div>
          <DataTable
            caption="Active discount rules"
            columns={RULE_COLUMNS}
            rows={rules}
            emptyMessage="No rules yet. Upload a rules CSV or describe a new offer."
          />
          <p className="small muted">
            The best non-stackable offer wins. Stackable offers apply next, in the order shown. Cart
            offers apply after item discounts.
          </p>
        </section>
      </main>
      <footer>
        <span>Opptra Discount Studio</span>
        <span>Prices explained. Offers made clear.</span>
        <span>Data stays in this session.</span>
      </footer>
    </div>
  )
}
