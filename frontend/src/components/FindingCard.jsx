import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const SEV = {
  critical: { bar: 'bg-sev-critical', badge: 'badge-critical', dot: '#c44444' },
  high:     { bar: 'bg-sev-high',     badge: 'badge-high',     dot: '#c2601a' },
  medium:   { bar: 'bg-sev-medium',   badge: 'badge-medium',   dot: '#a08210' },
  low:      { bar: 'bg-sev-low',      badge: 'badge-low',      dot: '#3a70b8' },
  info:     { bar: 'bg-ink-3',        badge: 'badge-info',     dot: '#5e5c58' },
}

export default function FindingCard({ finding }) {
  const [open, setOpen] = useState(false)
  const sev = SEV[finding.severity] || SEV.info

  const hasDetails = finding.evidence?.measured_value
    || finding.evidence?.required_value
    || finding.user_impact
    || finding.recommendation

  return (
    <div className="card overflow-hidden">
      <button
        className="w-full text-left flex items-stretch gap-0 focus:outline-none"
        onClick={() => hasDetails && setOpen(!open)}
      >
        {/* Severity bar */}
        <div className={`w-0.5 self-stretch flex-shrink-0 ${sev.bar} rounded-l-lg`} />

        <div className="flex-1 flex items-start gap-3 px-4 py-3 min-w-0">
          {/* Severity badge */}
          <span className={`badge ${sev.badge} flex-shrink-0 mt-px`}>
            {finding.severity}
          </span>

          {/* Principle + location */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-ink-1">{finding.principle}</div>
            <div className="text-xs text-ink-3 mt-0.5 truncate">
              {finding.location?.description || finding.finding_id}
            </div>
          </div>

          {/* Confidence + chevron */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <span className="text-xs text-ink-3 tabular-nums">{finding.confidence}%</span>
            {hasDetails && (
              <svg
                width="12" height="12" viewBox="0 0 12 12" fill="none"
                className={`text-ink-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
              >
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
        </div>
      </button>

      {/* Expanded details */}
      <AnimatePresence>
        {open && hasDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 ml-[2px] space-y-3 border-t border-edge-1 pt-3">

              {/* Evidence values */}
              {(finding.evidence?.measured_value || finding.evidence?.required_value) && (
                <div className="flex gap-6">
                  {finding.evidence?.measured_value && (
                    <div>
                      <div className="label mb-1">Measured</div>
                      <code className="text-xs font-mono text-sev-critical">{finding.evidence.measured_value}</code>
                    </div>
                  )}
                  {finding.evidence?.required_value && (
                    <div>
                      <div className="label mb-1">Required</div>
                      <code className="text-xs font-mono text-ink-2">{finding.evidence.required_value}</code>
                    </div>
                  )}
                </div>
              )}

              {/* User impact */}
              {finding.user_impact && (
                <p className="text-xs text-ink-3 leading-relaxed italic">{finding.user_impact}</p>
              )}

              {/* Fix suggestion */}
              {finding.recommendation && (
                <div className="bg-surface-0 rounded-md p-3 font-mono text-xs space-y-1.5 border border-edge-1">
                  {finding.recommendation.current_css && (
                    <div className="text-sev-critical/80">
                      <span className="text-ink-3 select-none">- </span>
                      {finding.recommendation.current_css}
                    </div>
                  )}
                  {finding.recommendation.suggested_css && (
                    <div className="text-sev-success/80">
                      <span className="text-ink-3 select-none">+ </span>
                      {finding.recommendation.suggested_css}
                    </div>
                  )}
                  {finding.recommendation.result && (
                    <div className="text-ink-3 pt-1 border-t border-edge-1 mt-1.5">
                      {finding.recommendation.result}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
