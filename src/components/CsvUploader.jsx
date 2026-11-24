import { useId } from 'react'

// The uploader passes the file along; the input adapters decide how to read it.
export default function CsvUploader({
  label,
  description,
  accept = '.csv',
  onLoad,
  disabled = false,
}) {
  const id = useId()
  return (
    <div className="upload-control">
      <label htmlFor={id}>{label}</label>
      <p id={`${id}-help`}>{description}</p>
      <input
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        aria-describedby={`${id}-help`}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) onLoad(file)
        }}
      />
    </div>
  )
}
