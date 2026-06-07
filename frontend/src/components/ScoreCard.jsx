import { motion } from 'framer-motion'

const GRADE_META = {
  'A+': { color: 'text-sev-success', track: '#2d8f52' },
  'A':  { color: 'text-sev-success', track: '#2d8f52' },
  'A-': { color: 'text-sev-success', track: '#2d8f52' },
  'B+': { color: 'text-sev-low',     track: '#3a70b8' },
  'B':  { color: 'text-sev-low',     track: '#3a70b8' },
  'B-': { color: 'text-sev-low',     track: '#3a70b8' },
  'C+': { color: 'text-sev-medium',  track: '#a08210' },
  'C':  { color: 'text-sev-medium',  track: '#a08210' },
  'C-': { color: 'text-sev-medium',  track: '#a08210' },
  'D+': { color: 'text-sev-high',    track: '#c2601a' },
  'D':  { color: 'text-sev-high',    track: '#c2601a' },
  'D-': { color: 'text-sev-high',    track: '#c2601a' },
  'F':  { color: 'text-sev-critical', track: '#c44444' },
}

function getGradeMeta(g) {
  return GRADE_META[g] || { color: 'text-ink-3', track: '#5e5c58' }
}

export default function ScoreCard({ scoreBreakdown, summary }) {
  if (!scoreBreakdown) return null
  const { principle_scores, principle_grades, overall_score, overall_grade } = scoreBreakdown
  const meta = getGradeMeta(overall_grade)

  return (
    <div className="card p-5 space-y-5">
      {/* Overall score row */}
      <div className="flex items-center justify-between">
        <div>
          <div className="label mb-1">Design Score</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-ink-1 tabular-nums">{Math.round(overall_score)}</span>
            <span className="text-sm text-ink-3">/ 100</span>
          </div>
        </div>
        {/* Grade ring — simplified to a badge */}
        <div className={`text-4xl font-bold tabular-nums ${meta.color}`}>
          {overall_grade}
        </div>
      </div>

      {/* Summary severity counts */}
      {summary && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { key: 'critical', label: 'Critical', cls: 'text-sev-critical bg-red-950/40 border-red-900/30' },
            { key: 'high',     label: 'High',     cls: 'text-sev-high    bg-orange-950/40 border-orange-900/30' },
            { key: 'medium',   label: 'Medium',   cls: 'text-sev-medium  bg-yellow-950/40 border-yellow-900/30' },
            { key: 'low',      label: 'Low',      cls: 'text-sev-low     bg-blue-950/40   border-blue-900/30' },
          ].map(({ key, label, cls }) => summary[key] > 0 && (
            <div key={key} className={`rounded-md p-2.5 border text-center ${cls}`}>
              <div className="text-lg font-bold leading-none tabular-nums">{summary[key]}</div>
              <div className="text-2xs mt-1 opacity-70">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Per-principle breakdown */}
      <div className="space-y-2.5">
        <div className="label">By Principle</div>
        {Object.entries(principle_scores).map(([principle, score]) => {
          const gm = getGradeMeta(principle_grades?.[principle])
          return (
            <div key={principle} className="flex items-center gap-3">
              <span className="text-xs text-ink-3 w-24 shrink-0 truncate">{principle}</span>
              <div className="flex-1 h-1 bg-edge-2 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: gm.track }}
                  initial={{ width: 0 }}
                  animate={{ width: `${score}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut', delay: 0.05 }}
                />
              </div>
              <span className={`text-xs font-semibold w-6 text-right shrink-0 ${gm.color}`}>
                {principle_grades?.[principle] || '—'}
              </span>
            </div>
          )
        })}
      </div>

      {/* WCAG pass rate */}
      {summary?.wcag_aa_pass_rate && (
        <div className="pt-1 border-t border-edge-1 flex items-center justify-between">
          <span className="text-xs text-ink-3">WCAG AA Pass Rate</span>
          <span className="text-xs font-semibold text-ink-2">{summary.wcag_aa_pass_rate}</span>
        </div>
      )}
    </div>
  )
}
