import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const SEV_STYLES = {
  critical: { badge: 'bg-red-900/50 text-red-300 border border-red-800', border: 'border-l-red-500' },
  high: { badge: 'bg-orange-900/50 text-orange-300 border border-orange-800', border: 'border-l-orange-500' },
  medium: { badge: 'bg-yellow-900/50 text-yellow-300 border border-yellow-800', border: 'border-l-yellow-500' },
  low: { badge: 'bg-blue-900/50 text-blue-300 border border-blue-800', border: 'border-l-blue-500' },
  info: { badge: 'bg-slate-700 text-slate-300', border: 'border-l-slate-500' },
}

export default function FindingCard({ finding }) {
  const [open, setOpen] = useState(false)
  const sev = SEV_STYLES[finding.severity] || SEV_STYLES.info

  return (
    <motion.div
      layout
      className={`bg-slate-800/60 rounded-xl border-l-4 ${sev.border} overflow-hidden`}
    >
      <button
        className="w-full text-left p-4 flex items-start gap-3"
        onClick={() => setOpen(!open)}
      >
        <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase shrink-0 mt-0.5 ${sev.badge}`}>
          {finding.severity}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-white text-sm">{finding.principle}</div>
          <div className="text-slate-400 text-xs truncate">{finding.location?.description || finding.finding_id}</div>
        </div>
        <div className="text-slate-500 text-xs shrink-0">{finding.confidence}%</div>
        <span className="text-slate-500 text-xs shrink-0">{open ? '▲' : '▼'}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="px-4 pb-4 space-y-3"
          >
            <div className="flex gap-4 text-xs">
              <div>
                <div className="text-slate-500 uppercase tracking-wide mb-0.5">Measured</div>
                <div className="font-mono text-cyan-400">{finding.evidence?.measured_value || '—'}</div>
              </div>
              <div>
                <div className="text-slate-500 uppercase tracking-wide mb-0.5">Required</div>
                <div className="font-mono text-slate-300">{finding.evidence?.required_value || '—'}</div>
              </div>
            </div>
            {finding.user_impact && (
              <p className="text-slate-400 text-xs italic">{finding.user_impact}</p>
            )}
            {finding.recommendation && (
              <div className="bg-slate-900 rounded-lg p-3 font-mono text-xs space-y-1">
                <div className="text-red-400">— {finding.recommendation.current_css}</div>
                <div className="text-green-400">+ {finding.recommendation.suggested_css}</div>
                {finding.recommendation.result && (
                  <div className="text-slate-500 pt-1">→ {finding.recommendation.result}</div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
