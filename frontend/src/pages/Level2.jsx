import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactCompareImage from 'react-compare-image'
import { analyzeLevel2 } from '../api'
import UploadZone from '../components/UploadZone'
import ProgressBar from '../components/ProgressBar'
import FindingCard from '../components/FindingCard'
import AnnotatedViewer from '../components/AnnotatedViewer'

// ─── Constants ────────────────────────────────────────────────────────────────

const GRADE_COLORS = {
  'A+': '#2d8f52', A: '#2d8f52', 'A-': '#2d8f52',
  'B+': '#3a70b8', B: '#3a70b8', 'B-': '#3a70b8',
  'C+': '#a08210', C: '#a08210', 'C-': '#a08210',
  'D+': '#c2601a', D: '#c2601a', 'D-': '#c2601a',
  F: '#c44444',
}

// Classification row styles — warm graphite palette, no slate-*
const CLS_STYLES = {
  regression: {
    card:  'border-red-900/40 bg-red-950/10',
    badge: 'badge badge-critical',
    arrow: '↓',
    arrowColor: 'text-sev-critical',
  },
  improvement: {
    card:  'border-green-900/40 bg-green-950/10',
    badge: 'badge badge-success',
    arrow: '↑',
    arrowColor: 'text-sev-success',
  },
  neutral: {
    card:  'border-edge-2 bg-surface-1',
    badge: 'badge badge-info',
    arrow: '→',
    arrowColor: 'text-ink-3',
  },
}

// Suggestion priority styles — warm, muted severity palette
const SG_STYLES = {
  critical: {
    border:     'border-red-900/40',
    bg:         'bg-red-950/10',
    iconBg:     'bg-red-950/40',
    titleColor: 'text-sev-critical',
    tag:        'badge badge-critical',
  },
  high: {
    border:     'border-orange-900/40',
    bg:         'bg-orange-950/10',
    iconBg:     'bg-orange-950/40',
    titleColor: 'text-sev-high',
    tag:        'badge badge-high',
  },
  medium: {
    border:     'border-yellow-900/40',
    bg:         'bg-yellow-950/10',
    iconBg:     'bg-yellow-950/40',
    titleColor: 'text-sev-medium',
    tag:        'badge badge-medium',
  },
  positive: {
    border:     'border-green-900/40',
    bg:         'bg-green-950/10',
    iconBg:     'bg-green-950/40',
    titleColor: 'text-sev-success',
    tag:        'badge badge-success',
  },
  info: {
    border:     'border-edge-2',
    bg:         'bg-surface-1',
    iconBg:     'bg-surface-3',
    titleColor: 'text-ink-2',
    tag:        'badge badge-info',
  },
}

// ─── Suggestion engine ────────────────────────────────────────────────────────

function deriveSuggestions(changes) {
  if (!changes?.length) return []
  const sg = []

  // Critical: WCAG AA failures
  const a11y = changes.filter(c => c.accessibility_regression)
  a11y.forEach(c => {
    const bc = c.before?.wcag_contrast, ac = c.after?.wcag_contrast
    sg.push({
      priority: 'critical', icon: '⚠',
      title: 'Fix WCAG AA accessibility regression',
      detail: `"${c.element_description || 'element'}" fell below the 4.5:1 contrast minimum.${
        bc && ac ? ` Contrast dropped from ${bc.toFixed(2)}:1 to ${ac.toFixed(2)}:1.` : ''
      }`,
      action: 'Restore the original colour pair or pick a new combination that passes 4.5:1 (AA normal text) or 3:1 (AA large text / UI components).',
    })
  })

  // High: contrast degraded but not failed
  const colReg = changes.filter(c => c.type === 'color_change' && c.classification === 'regression' && !c.accessibility_regression)
  if (colReg.length) sg.push({
    priority: 'high', icon: '🎨',
    title: `${colReg.length} colour change${colReg.length > 1 ? 's' : ''} reduced contrast`,
    detail: 'These are above the 4.5:1 failure floor but have degraded from the original — cumulative on user fatigue.',
    action: 'Run the updated palette through a WCAG checker. Aim for 7:1 (AAA) for body text.',
  })

  // Medium: touch targets shrank
  const sizeReg = changes.filter(c => c.type === 'size_change' && c.classification === 'regression')
  if (sizeReg.length) sg.push({
    priority: 'medium', icon: '📐',
    title: `${sizeReg.length} element${sizeReg.length > 1 ? 's' : ''} significantly shrank`,
    detail: 'Smaller interactive targets reduce usability on touch devices and hurt motor-impaired users.',
    action: 'Ensure touch targets are at least 44×44 px (WCAG 2.5.5 AAA) or at minimum 24×24 px (AA).',
  })

  // Medium: font weight lightened
  const fontReg = changes.filter(c => c.type === 'font_change' && c.classification === 'regression')
  if (fontReg.length) sg.push({
    priority: 'medium', icon: 'T',
    title: `Font weight reduced on ${fontReg.length} element${fontReg.length > 1 ? 's' : ''}`,
    detail: 'Lighter weights hurt legibility at smaller sizes and for low-vision users.',
    action: 'Body text: font-weight ≥ 400. Headings: 600–700. Never go below 300 for any visible text.',
  })

  // Positive: improvements found
  const imps = changes.filter(c => c.classification === 'improvement')
  if (imps.length) sg.push({
    priority: 'positive', icon: '✓',
    title: `${imps.length} measurable improvement${imps.length > 1 ? 's' : ''} detected`,
    detail: 'The "After" version shows positive design changes — better contrast, larger targets, or stronger hierarchy.',
    action: 'Confirm these match the intended redesign, then run L3 to update the monitoring baseline.',
  })

  // Fallback: all neutral
  if (!sg.length && changes.length) sg.push({
    priority: 'info', icon: '→',
    title: 'No critical regressions found',
    detail: 'All detected changes are neutral or positive from an accessibility perspective.',
    action: 'Still review visual and brand changes manually — some things only human review catches.',
  })

  return sg
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GradeCell({ label, grade, score, findingsCount }) {
  const color = GRADE_COLORS[grade] ?? '#5e5c58'
  return (
    <div className="card p-5 text-center flex flex-col items-center gap-1">
      <div className="label mb-2">{label}</div>
      <div className="text-5xl font-black leading-none" style={{ color }}>
        {grade ?? '—'}
      </div>
      <div className="text-xl font-bold text-ink-1 mt-1">
        {score}
        <span className="text-xs font-normal text-ink-3"> /100</span>
      </div>
      <div className="text-xs text-ink-3 mt-0.5">
        {findingsCount} finding{findingsCount !== 1 ? 's' : ''}
      </div>
    </div>
  )
}

function DeltaCell({ verdict, scoreDelta, netRegressions, netImprovements }) {
  const isRegression  = verdict?.includes('REGRESSION')
  const isImprovement = verdict?.includes('IMPROVEMENT')

  const borderColor = isRegression  ? 'border-red-900/40'
                    : isImprovement ? 'border-green-900/40'
                    : 'border-edge-2'
  const bgColor     = isRegression  ? 'bg-red-950/10'
                    : isImprovement ? 'bg-green-950/10'
                    : 'bg-surface-1'
  const verdictColor = isRegression  ? 'text-sev-critical'
                     : isImprovement ? 'text-sev-success'
                     : 'text-ink-3'
  const deltaColor   = scoreDelta > 0 ? 'text-sev-success'
                     : scoreDelta < 0 ? 'text-sev-critical'
                     : 'text-ink-3'

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} p-5 flex flex-col items-center justify-center text-center gap-1`}>
      <div className={`text-xs font-bold uppercase tracking-widest ${verdictColor}`}>
        {verdict?.replace('NET ', '') ?? '—'}
      </div>
      <div className={`text-4xl font-black leading-none mt-1 ${deltaColor}`}>
        {scoreDelta > 0 ? '+' : ''}{scoreDelta}
      </div>
      <div className="label mt-0.5">score delta</div>
      <div className="flex items-center gap-3 mt-2">
        <span className="text-xs font-semibold text-sev-critical">{netRegressions} ↓</span>
        <span className="text-ink-3">·</span>
        <span className="text-xs font-semibold text-sev-success">{netImprovements} ↑</span>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Level2() {
  const [before,        setBefore]        = useState(null)
  const [after,         setAfter]         = useState(null)
  const [beforePreview, setBeforePreview] = useState(null)
  const [afterPreview,  setAfterPreview]  = useState(null)
  const [loading,       setLoading]       = useState(false)
  const [report,        setReport]        = useState(null)
  const [error,         setError]         = useState(null)
  const [changeFilter,  setChangeFilter]  = useState('all')
  const [findingsTab,   setFindingsTab]   = useState('before')

  const handleBefore = (file) => {
    setBefore(file)
    setBeforePreview(file ? URL.createObjectURL(file) : null)
    setReport(null)
  }
  const handleAfter = (file) => {
    setAfter(file)
    setAfterPreview(file ? URL.createObjectURL(file) : null)
    setReport(null)
  }

  const analyze = async () => {
    if (!before || !after) return
    setLoading(true)
    setError(null)
    setReport(null)
    try {
      const result = await analyzeLevel2(before, after)
      setReport(result)
      setChangeFilter('all')
      setFindingsTab('before')
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Comparison failed')
    } finally {
      setLoading(false)
    }
  }

  // Derived data
  const suggestions = deriveSuggestions(report?.changes)
  const counts = report?.changes?.reduce(
    (a, c) => ({ ...a, [c.classification]: (a[c.classification] || 0) + 1 }),
    {}
  ) || {}
  const filteredChanges = report?.changes?.filter(
    c => changeFilter === 'all' || c.classification === changeFilter
  ) || []

  const beforeScore      = Math.round(report?.before_report?.summary?.overall_score ?? 0)
  const afterScore       = Math.round(report?.after_report?.summary?.overall_score  ?? 0)
  const scoreDelta       = afterScore - beforeScore
  const beforeGrade      = report?.before_report?.summary?.grade
  const afterGrade       = report?.after_report?.summary?.grade
  const beforeFindings   = report?.before_report?.summary?.total_findings ?? 0
  const afterFindings    = report?.after_report?.summary?.total_findings  ?? 0

  const FILTER_TABS = ['all', 'regression', 'improvement', 'neutral']

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-ink-1">Before / After Regression</h2>
        <p className="text-sm text-ink-2">
          Upload two screenshots to detect design regressions, WCAG accessibility drops, and improvements.
          Elements are matched by position and semantic role, then scored for impact.
        </p>
      </div>

      {/* ── Upload pair ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="label mb-3">Before</div>
          <UploadZone onFile={handleBefore} file={before} label="Drop BEFORE screenshot" />
        </div>
        <div>
          <div className="label mb-3">After</div>
          <UploadZone onFile={handleAfter} file={after} label="Drop AFTER screenshot" />
        </div>
      </div>

      {/* ── Compare button ──────────────────────────────────────────────────── */}
      <button
        onClick={analyze}
        disabled={!before || !after || loading}
        className="btn-primary w-full py-3 justify-center"
      >
        {loading ? 'Comparing…' : 'Compare Designs'}
      </button>

      {/* ── Progress ────────────────────────────────────────────────────────── */}
      {loading && <ProgressBar percent={50} stage="Running regression analysis…" />}

      {/* ── Error ───────────────────────────────────────────────────────────── */}
      {error && (
        <div className="card border-red-900/40 bg-red-950/10 p-4 text-sev-critical text-sm">
          {error}
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────────────────────── */}
      {report && beforePreview && afterPreview && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="space-y-6"
        >

          {/* ① Interactive Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="label">Interactive Comparison</div>
              <span className="text-xs text-ink-3">← drag to reveal →</span>
            </div>
            <div className="card overflow-hidden select-none" style={{ lineHeight: 0 }}>
              <ReactCompareImage
                leftImage={beforePreview}
                rightImage={afterPreview}
                leftImageLabel="BEFORE"
                rightImageLabel="AFTER"
                sliderLineColor="#7c6af6"
                sliderLineWidth={2}
                handleSize={44}
              />
            </div>
          </div>

          {/* ② Score comparison — 3-column */}
          <div className="space-y-3">
            <div className="label">Score Comparison</div>
            <div className="grid grid-cols-3 gap-3 items-stretch">
              <GradeCell
                label="Before"
                grade={beforeGrade}
                score={beforeScore}
                findingsCount={beforeFindings}
              />
              <DeltaCell
                verdict={report.verdict}
                scoreDelta={scoreDelta}
                netRegressions={report.net_regressions}
                netImprovements={report.net_improvements}
              />
              <GradeCell
                label="After"
                grade={afterGrade}
                score={afterScore}
                findingsCount={afterFindings}
              />
            </div>
          </div>

          {/* ③ Summary chips */}
          <div className="space-y-3">
            <div className="label">Change Summary</div>
            <div className="flex flex-wrap gap-3">
              {/* Regressions chip */}
              <div className="card border-red-900/40 bg-red-950/10 px-5 py-3 flex items-center gap-3 min-w-[110px]">
                <span className="text-2xl font-black text-sev-critical">{counts.regression ?? 0}</span>
                <span className="text-xs font-medium text-sev-critical/70 uppercase tracking-wide leading-tight">
                  Regressions
                </span>
              </div>
              {/* Improvements chip */}
              <div className="card border-green-900/40 bg-green-950/10 px-5 py-3 flex items-center gap-3 min-w-[110px]">
                <span className="text-2xl font-black text-sev-success">{counts.improvement ?? 0}</span>
                <span className="text-xs font-medium text-sev-success/70 uppercase tracking-wide leading-tight">
                  Improvements
                </span>
              </div>
              {/* Neutral chip */}
              <div className="card px-5 py-3 flex items-center gap-3 min-w-[110px]">
                <span className="text-2xl font-black text-ink-2">{counts.neutral ?? 0}</span>
                <span className="text-xs font-medium text-ink-3 uppercase tracking-wide leading-tight">
                  Neutral
                </span>
              </div>
            </div>
          </div>

          {/* ④ Actionable suggestions */}
          {suggestions.length > 0 && (
            <div className="space-y-3">
              <div className="label">Actionable Suggestions</div>
              <div className="space-y-2">
                {suggestions.map((s, i) => {
                  const st = SG_STYLES[s.priority] ?? SG_STYLES.info
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.2 }}
                      className={`card-elevated border ${st.border} ${st.bg} p-4 flex gap-4`}
                    >
                      {/* Icon */}
                      <div className={`flex-shrink-0 w-9 h-9 rounded-md ${st.iconBg} flex items-center justify-center text-base font-bold`}>
                        {s.icon}
                      </div>
                      {/* Body */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className={`text-sm font-semibold ${st.titleColor}`}>{s.title}</div>
                        <p className="text-xs text-ink-2 leading-relaxed">{s.detail}</p>
                        <div className="flex items-start gap-2 pt-0.5">
                          <span className={`flex-shrink-0 ${st.tag}`}>Fix</span>
                          <span className="text-xs text-ink-3 italic leading-relaxed">{s.action}</span>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ⑤ Annotated comparisons — 2-col grid */}
          {(report.before_report?.annotated_screenshot || report.after_report?.annotated_screenshot) && (
            <div className="space-y-3">
              <div className="label">Annotated Findings</div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {report.before_report?.annotated_screenshot && (
                  <AnnotatedViewer
                    imagePath={report.before_report.annotated_screenshot}
                    findings={report.before_report.findings ?? []}
                    title="Before — rule engine findings"
                  />
                )}
                {report.after_report?.annotated_screenshot && (
                  <AnnotatedViewer
                    imagePath={report.after_report.annotated_screenshot}
                    findings={report.after_report.findings ?? []}
                    title="After — rule engine findings"
                  />
                )}
              </div>
            </div>
          )}

          {/* ⑥ Changes list with filter tabs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="label">
                Detected Changes ({report.changes?.length ?? 0})
              </div>
              {/* Filter tabs */}
              <div className="flex items-center gap-1 p-1 card">
                {FILTER_TABS.map(f => {
                  const active = changeFilter === f
                  return (
                    <button
                      key={f}
                      onClick={() => setChangeFilter(f)}
                      className={
                        active
                          ? 'px-3 py-1 rounded-sm text-xs font-semibold bg-accent text-white transition-colors duration-150'
                          : 'btn-ghost px-3 py-1 text-xs capitalize'
                      }
                    >
                      {f === 'all'
                        ? `All (${report.changes?.length ?? 0})`
                        : `${f.charAt(0).toUpperCase() + f.slice(1)} (${counts[f] ?? 0})`}
                    </button>
                  )
                })}
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={changeFilter}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="card divide-y divide-edge-1"
              >
                {filteredChanges.length === 0 ? (
                  <p className="text-ink-3 text-sm py-8 text-center">
                    No {changeFilter === 'all' ? '' : changeFilter + ' '}changes detected.
                  </p>
                ) : (
                  filteredChanges.map((c, i) => {
                    const st = CLS_STYLES[c.classification] ?? CLS_STYLES.neutral
                    return (
                      <div key={c.change_id || i} className="p-4 space-y-2">
                        {/* Top row: badge + type + a11y tag + pixel diff */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-black text-base leading-none ${st.arrowColor}`}>
                            {st.arrow}
                          </span>
                          <span className={st.badge}>
                            {c.classification}
                          </span>
                          <span className="text-2xs font-mono text-ink-3 bg-surface-2 border border-edge-2 px-1.5 py-0.5 rounded-xs">
                            {c.type.replace(/_/g, ' ')}
                          </span>
                          {c.accessibility_regression && (
                            <span className="badge badge-critical">⚠ A11y regression</span>
                          )}
                          {c.pixel_diff_percentage != null && (
                            <span className="ml-auto text-2xs text-ink-3 flex-shrink-0">
                              {c.pixel_diff_percentage.toFixed(1)}% pixel diff
                            </span>
                          )}
                        </div>

                        {/* Element description */}
                        <div className="text-sm font-medium text-ink-1">{c.element_description}</div>

                        {/* Reasoning */}
                        {c.reasoning && (
                          <div className="text-xs text-ink-2 leading-relaxed">{c.reasoning}</div>
                        )}

                        {/* Before / after value pills */}
                        {(c.before?.value != null || c.after?.value != null) && (
                          <div className="flex items-center gap-2 font-mono text-xs text-ink-3 flex-wrap">
                            <span className="bg-surface-2 border border-edge-2 px-2 py-0.5 rounded-xs">
                              {String(c.before?.value ?? '—')}
                            </span>
                            <span className="text-ink-3">→</span>
                            <span className="bg-surface-2 border border-edge-2 px-2 py-0.5 rounded-xs">
                              {String(c.after?.value ?? '—')}
                            </span>
                            {c.before?.wcag_contrast != null && c.after?.wcag_contrast != null && (
                              <span className="text-ink-3 ml-1">
                                · WCAG {c.before.wcag_contrast.toFixed(2)} → {c.after.wcag_contrast.toFixed(2)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ⑦ Per-version findings (tabbed) */}
          {(report.before_report?.findings?.length > 0 || report.after_report?.findings?.length > 0) && (
            <div className="space-y-3">
              <div className="label">Per-Version Findings</div>

              {/* Tab strip */}
              <div className="flex items-center gap-1 p-1 card w-fit">
                {['before', 'after'].map(tab => {
                  const count = tab === 'before'
                    ? (report.before_report?.findings?.length ?? 0)
                    : (report.after_report?.findings?.length ?? 0)
                  const active = findingsTab === tab
                  return (
                    <button
                      key={tab}
                      onClick={() => setFindingsTab(tab)}
                      className={
                        active
                          ? 'px-4 py-1.5 rounded-sm text-xs font-semibold bg-accent text-white capitalize transition-colors duration-150'
                          : 'btn-ghost px-4 py-1.5 text-xs capitalize'
                      }
                    >
                      {tab} — {count} finding{count !== 1 ? 's' : ''}
                    </button>
                  )
                })}
              </div>

              {/* Findings scroll list */}
              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {((findingsTab === 'before'
                  ? report.before_report?.findings
                  : report.after_report?.findings) ?? []
                ).map(f => <FindingCard key={f.finding_id} finding={f} />)}
              </div>
            </div>
          )}

        </motion.div>
      )}
    </div>
  )
}
