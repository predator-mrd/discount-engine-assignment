import { useEffect, useRef, useState } from 'react'
import { DEFAULT_MODEL, parseNaturalLanguageRule } from '../inputs/naturalLanguageRule.js'
import ErrorBanner from './ErrorBanner.jsx'

const examples = [
  '20% off for Natura Casa brand, stackable with other offers',
  'Rs.100 flat discount on all Flipkart items',
  '10% off if cart value is more than Rs.5,000',
]

export default function RuleInput({ onConfirm, disabled }) {
  const [description, setDescription] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [pending, setPending] = useState(null)
  const [errors, setErrors] = useState([])
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const controller = useRef(null)
  const reviewHeading = useRef(null)
  useEffect(() => () => controller.current?.abort(), [])
  useEffect(() => {
    if (pending) reviewHeading.current?.focus()
  }, [pending])

  function editDescription(value) {
    setDescription(value)
    setPending(null)
    setErrors([])
    setNotice('')
  }

  async function parse(event) {
    event.preventDefault()
    setPending(null)
    setErrors([])
    setNotice('')
    setBusy(true)
    const request = new AbortController()
    controller.current = request
    try {
      const result = await parseNaturalLanguageRule(description, {
        apiKey,
        model,
        signal: request.signal,
      })
      if (!request.signal.aborted) setPending(result)
    } catch (error) {
      if (!request.signal.aborted) setErrors([error.message])
    } finally {
      if (!request.signal.aborted) setBusy(false)
    }
  }

  return (
    <section className="panel rule-editor" aria-labelledby="rule-input-title">
      <div className="section-top">
        <span className="eyebrow">Write an offer</span>
        <span className="badge lavender">AI assisted</span>
      </div>
      <h2 id="rule-input-title">Your words. A new rule.</h2>
      <p className="muted">Describe the offer, review the details, then add it to the cart.</p>
      <form onSubmit={parse}>
        <label htmlFor="offer-description">Offer description</label>
        <textarea
          id="offer-description"
          rows={4}
          maxLength={1200}
          value={description}
          disabled={busy || disabled}
          placeholder="e.g. 20% off for Natura Casa brand, stackable with other offers"
          onChange={(event) => editDescription(event.target.value)}
        />
        <div className="examples">
          <span className="muted small">Try an example</span>
          {examples.map((example, index) => (
            <button
              className="example-button"
              type="button"
              key={example}
              disabled={busy || disabled}
              onClick={() => editDescription(example)}
            >
              {['Brand offer', 'Platform offer', 'Cart offer'][index]}
            </button>
          ))}
        </div>
        <details className="connection-settings" open>
          <summary>Groq connection{apiKey ? ' · key entered' : ' · add your API key'}</summary>
          <label htmlFor="api-key">Groq API key</label>
          <input
            id="api-key"
            type="password"
            autoComplete="off"
            value={apiKey}
            disabled={busy}
            onChange={(event) => {
              setApiKey(event.target.value)
              setPending(null)
            }}
            placeholder="Paste your key for this session"
          />
          <label htmlFor="model-name">Model</label>
          <input
            id="model-name"
            value={model}
            disabled={busy}
            onChange={(event) => {
              setModel(event.target.value)
              setPending(null)
            }}
          />
          <p className="small muted">
            The key stays in this page’s memory. Only your offer description is sent to Groq; your
            cart stays here.
          </p>
          <a
            className="small"
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noreferrer"
          >
            Get a Groq API key
          </a>
          {apiKey && (
            <button
              type="button"
              className="text-button small"
              disabled={busy}
              onClick={() => {
                setApiKey('')
                setPending(null)
              }}
            >
              Clear key
            </button>
          )}
        </details>
        <div className="actions">
          <button
            className="button dark"
            type="submit"
            disabled={busy || disabled || !description.trim()}
          >
            {busy ? 'Reading your offer…' : 'Review rule'}
          </button>
          {busy && (
            <button
              className="text-button"
              type="button"
              onClick={() => {
                controller.current?.abort()
                setBusy(false)
                setNotice('Parsing cancelled.')
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
      <ErrorBanner errors={errors} />
      {pending && (
        <div className="rule-preview" aria-labelledby="review-title">
          <h3 id="review-title" tabIndex={-1} ref={reviewHeading}>
            Does this look right?
          </h3>
          <p className="small muted">This rule will only apply after you confirm it.</p>
          <dl>
            <div>
              <dt>Scope</dt>
              <dd className="capitalize">{pending.rule.scope}</dd>
            </div>
            <div>
              <dt>Applies to</dt>
              <dd>{pending.rule.appliesTo || 'Entire cart'}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd className="capitalize">{pending.rule.type}</dd>
            </div>
            <div>
              <dt>Discount</dt>
              <dd>
                {pending.rule.type === 'percentage'
                  ? `${pending.rule.value}%`
                  : `Rs.${pending.rule.value}`}
              </dd>
            </div>
            <div>
              <dt>Stackable</dt>
              <dd>{pending.rule.stackable ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt>Minimum cart value</dt>
              <dd>
                {pending.rule.minCartValue === null
                  ? 'None'
                  : `Rs.${pending.rule.minCartValue.toLocaleString('en-IN')} or more`}
              </dd>
            </div>
          </dl>
          {pending.message && <p className="small muted">{pending.message}</p>}
          <div className="actions">
            <button
              type="button"
              className="button primary"
              disabled={disabled}
              onClick={() => {
                onConfirm(pending.rule)
                setPending(null)
                setDescription('')
                setNotice('Rule added. Your current cart has been recalculated.')
              }}
            >
              Confirm and add rule
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setPending(null)
                setNotice('Draft discarded. Active rules are unchanged.')
              }}
            >
              Discard
            </button>
          </div>
        </div>
      )}
      <p className="small notice" role="status">
        {notice}
      </p>
    </section>
  )
}
