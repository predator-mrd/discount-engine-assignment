export default function DataTable({ columns, rows, emptyMessage = 'No data loaded.', caption }) {
  if (!rows?.length) return <p className="empty-state">{emptyMessage}</p>
  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-label={caption || 'Data table'}>
      <table>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((column) => (
              <th scope="col" key={column.key}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.ruleId || row.itemId || index}>
              {columns.map((column) => (
                <td key={column.key}>
                  {column.render ? column.render(row[column.key], row) : (row[column.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
