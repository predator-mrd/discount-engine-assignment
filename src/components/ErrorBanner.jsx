export default function ErrorBanner({ errors }) {
  if (!errors?.length) return null
  return (
    <div className="error-banner" role="alert">
      <strong>
        {errors.length === 1 ? 'Please check this' : `${errors.length} things to check`}
      </strong>
      <ul>
        {errors.map((error, index) => (
          <li key={index}>{error}</li>
        ))}
      </ul>
    </div>
  )
}
