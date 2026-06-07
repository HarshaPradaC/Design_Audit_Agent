/** Severity color legend — matches BGR values used by OpenCV in annotation.py
 *  BGR critical=(38,38,220) → RGB(220,38,38), high=(12,88,234) → RGB(234,88,12),
 *  medium=(8,179,234) → RGB(234,179,8), low=(235,99,37) → RGB(37,99,235) */
const SEVERITY_LEGEND = [
  { key: 'critical', label: 'Critical', color: '#DC2626', desc: 'Blocks accessibility or usability' },
  { key: 'high',     label: 'High',     color: '#EA580C', desc: 'Significant design problem' },
  { key: 'medium',   label: 'Medium',   color: '#EAB308', desc: 'Noticeable but non-blocking' },
  { key: 'low',      label: 'Low',      color: '#2563EB', desc: 'Minor polish improvement' },
  { key: 'info',     label: 'Info',     color: '#6B7280', desc: 'Observation or best-practice note' },
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

  // Count findings per severity for the legend
  const counts = findings?.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1
    return acc
  }, {}) || {}

  const total = findings?.length || 0
  const activeLevels = SEVERITY_LEGEND.filter(s => counts[s.key])

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          {title || 'Annotated Screenshot'}
        </div>
        {src && (
          <a
            href={src}
            download={filename}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
          >
            ⬇ Download
          </a>
        )}
      </div>

      {/* What this image shows */}
      <p className="text-xs text-slate-500 leading-relaxed">
        Each coloured bounding box marks a design finding detected by the rule engine.
        The box label shows the finding ID and principle (e.g. <span className="font-mono bg-slate-800 px-1 rounded">[C1] Contrast</span>).
        Hover over the image for a full-size download.
      </p>

      {/* Image */}
      <div className="relative bg-slate-950 rounded-xl overflow-hidden border border-slate-700 group">
        <img
          src={src}
          alt={`Annotated screenshot — ${total} finding${total !== 1 ? 's' : ''}`}
          className="w-full object-contain"
          onError={(e) => {
            e.target.style.opacity = '0.15'
            e.target.alt = 'Image could not be loaded'
          }}
        />

        {/* Hover overlay */}
        <a
          href={src}
          download={filename}
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950/40"
        >
          <span className="bg-slate-900/90 text-white text-sm px-4 py-2 rounded-xl border border-slate-600 shadow-xl">
            ⬇ Save full-size PNG
          </span>
        </a>

        <div className="absolute bottom-2 left-2 text-xs text-slate-300 bg-slate-900/90 px-2 py-1 rounded-lg border border-slate-700">
          {total} finding{total !== 1 ? 's' : ''} annotated
        </div>
      </div>

      {/* Severity legend — only show levels that are present */}
      {activeLevels.length > 0 && (
        <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700 space-y-2">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Box colour key</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {activeLevels.map(({ key, label, color, desc }) => (
              <div key={key} className="flex items-start gap-2 text-xs">
                <span
                  className="mt-0.5 flex-shrink-0 w-3 h-3 rounded-sm border-2"
                  style={{ borderColor: color }}
                />
                <span>
                  <span className="font-semibold text-slate-300" style={{ color }}>{label}</span>
                  {counts[key] > 0 && (
                    <span className="text-slate-600 ml-1">×{counts[key]}</span>
                  )}
                  <span className="text-slate-500 ml-1">— {desc}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
