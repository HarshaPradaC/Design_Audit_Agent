/** Severity legend matches BGR values used by OpenCV in annotation.py */
const LEGEND = [
  { key: 'critical', label: 'Critical', color: '#c44444', desc: 'Blocks accessibility or usability' },
  { key: 'high',     label: 'High',     color: '#c2601a', desc: 'Significant design problem' },
  { key: 'medium',   label: 'Medium',   color: '#a08210', desc: 'Noticeable but non-blocking' },
  { key: 'low',      label: 'Low',      color: '#3a70b8', desc: 'Minor polish improvement' },
  { key: 'info',     label: 'Info',     color: '#5e5c58', desc: 'Best-practice observation' },
]

function toReportUrl(path) {
  if (!path) return null
  const filename = path.replace(/\\/g, '/').split('/').pop()
  return filename ? `/reports/${filename}` : null
}

export default function AnnotatedViewer({ imagePath, findings, title }) {
  if (!imagePath) return null

  const src = toReportUrl(imagePath)
  const filename = imagePath.replace(/\\/g, '/').split('/').pop()

  const counts = findings?.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1
    return acc
  }, {}) || {}

  const total = findings?.length || 0
  const activeEntries = LEGEND.filter(s => counts[s.key])

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="label">{title || 'Annotated Screenshot'}</div>
        {src && (
          <a
            href={src}
            download={filename}
            className="text-xs text-ink-3 hover:text-ink-2 transition-colors flex items-center gap-1.5"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M5.5 1v6M3 5.5l2.5 2.5 2.5-2.5M1 9.5h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Download PNG
          </a>
        )}
      </div>

      {/* Explainer */}
      <p className="text-xs text-ink-3 leading-relaxed">
        Coloured bounding boxes mark findings detected by the rule engine.
        Each box label shows the principle (e.g.{' '}
        <code className="font-mono bg-surface-3 px-1 rounded text-ink-2">Contrast</code>).
      </p>

      {/* Image */}
      <div className="relative bg-surface-0 rounded-lg overflow-hidden border border-edge-2 group">
        <img
          src={src}
          alt={`Annotated screenshot — ${total} finding${total !== 1 ? 's' : ''}`}
          className="w-full object-contain"
          onError={e => { e.target.style.opacity = '0.1' }}
        />
        {/* Hover download overlay */}
        <a
          href={src}
          download={filename}
          className="absolute inset-0 flex items-end justify-end p-3 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <span className="btn-secondary text-xs">
            Save full-size PNG
          </span>
        </a>
        {/* Finding count chip */}
        <div className="absolute top-2 left-2 bg-surface-0/90 text-ink-3 text-2xs px-2 py-1 rounded border border-edge-2 backdrop-blur-sm">
          {total} finding{total !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Severity legend */}
      {activeEntries.length > 0 && (
        <div className="card-elevated p-3 space-y-2">
          <div className="label">Box colour key</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {activeEntries.map(({ key, label, color, desc }) => (
              <div key={key} className="flex items-start gap-2 text-xs">
                <span
                  className="mt-0.5 flex-shrink-0 w-2.5 h-2.5 rounded-xs border-2"
                  style={{ borderColor: color }}
                />
                <span>
                  <span className="font-semibold" style={{ color }}>{label}</span>
                  {counts[key] > 0 && (
                    <span className="text-ink-3 ml-1">×{counts[key]}</span>
                  )}
                  <span className="text-ink-3 ml-1">— {desc}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
