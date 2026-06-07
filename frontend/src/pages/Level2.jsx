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
  'A+': '#22c55e', A: '#22c55e', 'A-': '#22c55e',
  'B+': '#84cc16', B: '#84cc16', 'B-': '#84cc16',
  'C+': '#eab308', C: '#eab308', 'C-': '#eab308',
  'D+': '#f97316', D: '#f97316', 'D-': '#f97316',
  F: '#ef4444',
}

const CLS_STYLES = {
  regression:  { card: 'border-red-800/50 bg-red-950/20',    badge: 'bg-red-900/40 text-red-300 border-red-800/50',    icon: '↓', ic: 'text-red-400' },
  improvement: { card: 'border-green-800/50 bg-green-950/20', badge: 'bg-green-900/40 text-green-300 border-green-800/50', icon: '↑', ic: 'text-green-400' },
  neutral:     { card: 'border-slate-700 bg-slate-800/30',   badge: 'bg-slate-700 text-slate-300 border-slate-600',    icon: '→', ic: 'text-slate-500' },
}

const SG_STYLES = {
  critical: { card: 'border-red-800/50 bg-red-950/20',     ib: 'bg-red-900/40',     tt: 'text-red-300',    tag: 'bg-red-900/30 text-red-400 border-red-800/50' },
  high:     { card: 'border-orange-800/50 bg-orange-950/20', ib: 'bg-orange-900/40', tt: 'text-orange-300', tag: 'bg-orange-900/30 text-orange-400 border-orange-800/50' },
  medium:   { card: 'border-yellow-800/50 bg-yellow-950/20', ib: 'bg-yellow-900/40', tt: 'text-yellow-300', tag: 'bg-yellow-900/30 text-yellow-400 border-yellow-800/50' },
  positive: { card: 'border-green-800/50 bg-green-950/20',  ib: 'bg-green-900/40',  tt: 'text-green-300',  tag: 'bg-green-900/30 text-green-400 border-green-800/50' },
  info:     { card: 'border-slate-700 bg-slate-800/30',     ib: 'bg-slate-700',     tt: 'text-slate-300',  tag: 'bg-slate-700 text-slate-400 border-slate-600' },
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

// ─── Component ────────────────────────────────────────────────────────────────

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
    setReport(null)   // reset results when input changes
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
  const counts = report?.changes?.reduce((a, c) => ({ ...a, [c.classification]: (a[c.classification] || 0) + 1 }), {}) || {}
  const filteredChanges = report?.changes?.filter(c => changeFilter === 'all' || c.classification === changeFilter) || []

  const beforeScore = Math.round(report?.before_report?.summary?.overall_score ?? 0)
  const afterScore  = Math.round(report?.after_report?.summary?.overall_score  ?? 0)
  const scoreDelta  = afterScore - beforeScore
  const beforeGrade = report?.before_report?.summary?.grade
  const afterGrade  = report?.after_report?.summary?.grade

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Before / After Regression</h2>
        <p className="text-slate-400 mt-1">
          Upload two screenshots to detect design regressions, WCAG accessibility drops, and improvements.
          Elements are matched by position + semantic role and scored for impact.
        </p>
      </div>

      {/* Upload pair */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Before</div>
          <UploadZone onFile={handleBefore} file={before} label="Drop BEFORE screenshot" />
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">After</div>
          <UploadZone onFile={handleAfter} file={after} label="Drop AFTER screenshot" />
        </div>
      </div>

      <button
        onClick={analyze}
        disabled={!before || !after || loading}
        className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-colors"
      >
        {loading ? 'Comparing…' : 'Compare Designs'}
      </button>

      {loading && <ProgressBar percent={50} stage="Running regression analysis…" />}

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* ── Results ── */}
      {report && beforePreview && afterPreview && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="space-y-8"
        >
          {/* ① INTERACTIVE SLIDER */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
                Interactive Comparison
              </h3>
              <span className="text-xs text-slate-600">← drag to reveal →</span>
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-700 select-none" style={{ lineHeight: 0 }}>
              <ReactCompareImage
                leftImage={beforePreview}
                rightImage={afterPreview}
                leftImageLabel="BEFORE"
                rightImageLabel="AFTER"
                sliderLineColor="#3b82f6"
                sliderLineWidth={2}
                handleSize={44}
              />
            </div>
          </div>

          {/* ② SCORE COMPARISON */}
          <div className="grid grid-cols-3 gap-3 items-stretch">
            {/* Before */}
            <div className="bg-slate-800/60 rounded-xl p-5 border border-slate-700 text-center">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Before</div>
              <div className="text-5xl font-black" style={{ color: GRADE_COLORS[beforeGrade] ?? '#94a3b8' }}>
                {beforeGrade ?? '—'}
              </div>
              <div className="text-slate-300 font-bold text-xl mt-1">
                {beforeScore}<span className="text-xs text-slate-600 font-normal"> /100</span>
              </div>
              <div className="text-xs text-slate-600 mt-1.5">
                {report.before_report?.summary?.total_findings ?? 0} findings
              </div>
            </div>

            {/* Delta */}
            <div className={`rounded-xl p-5 border flex flex-col items-center justify-center text-center ${
              report.verdict === 'NET REGRESSION'  ? 'border-red-800/50 bg-red-950/20' :
              report.verdict === 'NET IMPROVEMENT' ? 'border-green-800/50 bg-green-950/20' :
                                                     'border-slate-700 bg-slate-800/30'
            }`}>
              <div className={`text-lg font-black tracking-wide ${
                report.verdict.includes('REGRESSION')  ? 'text-red-400'   :
                report.verdict.includes('IMPROVEMENT') ? 'text-green-400' : 'text-slate-400'
              }`}>
                {report.verdict.replace('NET ', '')}
              </div>
              <div className={`text-4xl font-black mt-2 ${
                scoreDelta > 0 ? 'text-green-400' : scoreDelta < 0 ? 'text-red-400' : 'text-slate-500'
              }`}>
                {scoreDelta > 0 ? '+' : ''}{scoreDelta}
              </div>
              <div className="text-xs text-slate-600 mt-0.5">score delta</div>
              <div className="mt-3 flex gap-2 text-xs">
                <span className="text-red-400 font-semibold">{report.net_regressions} ↓</span>
                <span className="text-slate-600">·</span>
                <span className="text-green-400 font-semibold">{report.net_improvements} ↑</span>
              </div>
            </div>

            {/* After */}
            <div className="bg-slate-800/60 rounded-xl p-5 border border-slate-700 text-center">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">After</div>
              <div className="text-5xl font-black" style={{ color: GRADE_COLORS[afterGrade] ?? '#94a3b8' }}>
                {afterGrade ?? '—'}
              </div>
              <div className="text-slate-300 font-bold text-xl mt-1">
                {afterScore}<span className="text-xs text-slate-600 font-normal"> /100</span>
              </div>
              <div className="text-xs text-slate-600 mt-1.5">
                {report.after_report?.summary?.total_findings ?? 0} findings
              </div>
            </div>
          </div>

          {/* ③ SUMMARY CHIPS */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-4 text-center">
              <div className="text-3xl font-black text-red-400">{counts.regression ?? 0}</div>
              <div className="text-xs text-red-400/60 mt-0.5 uppercase tracking-wide font-medium">Regressions</div>
            </div>
            <div className="bg-green-950/20 border border-green-900/40 rounded-xl p-4 text-center">
              <div className="text-3xl font-black text-green-400">{counts.improvement ?? 0}</div>
              <div className="text-xs text-green-400/60 mt-0.5 uppercase tracking-wide font-medium">Improvements</div>
            </div>
            <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 text-center">
              <div className="text-3xl font-black text-slate-400">{counts.neutral ?? 0}</div>
              <div className="text-xs text-slate-500 mt-0.5 uppercase tracking-wide font-medium">Neutral</div>
            </div>
          </div>

          {/* ④ ACTIONABLE SUGGESTIONS */}
          {suggestions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
                Actionable Suggestions
              </h3>
              <div className="space-y-2">
                {suggestions.map((s, i) => {
                  const st = SG_STYLES[s.priority] ?? SG_STYLES.info
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className={`rounded-xl p-4 border flex gap-4 ${st.card}`}
                    >
                      <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${st.ib} flex items-center justify-center text-xl font-bold`}>
                        {s.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`font-semibold text-sm ${st.tt}`}>{s.title}</div>
                        <p className="text-slate-400 text-xs mt-1 leading-relaxed">{s.detail}</p>
                        <div className="mt-2 flex items-start gap-2">
                          <span className={`flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-lg border ${st.tag}`}>
                            Fix
                          </span>
                          <span className="text-xs text-slate-500 italic leading-relaxed">{s.action}</span>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ⑤ ANNOTATED COMPARISONS */}
          {(report.before_report?.annotated_screenshot || report.after_report?.annotated_screenshot) && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
                Annotated Findings
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

          {/* ⑥ CHANGES LIST with filter tabs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
                Detected Changes ({report.changes?.length ?? 0})
              </h3>
              <div className="flex gap-1 bg-slate-800/60 rounded-xl p-1 border border-slate-700">
                {['all', 'regression', 'improvement', 'neutral'].map(f => (
                  <button
                    key={f}
                    onClick={() => setChangeFilter(f)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${
                      changeFilter === f
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {f === 'all' ? `All (${report.changes?.length ?? 0})` : `${f} (${counts[f] ?? 0})`}
                  </button>
                ))}
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={changeFilter}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-2"
              >
                {filteredChanges.map((c, i) => {
                  const st = CLS_STYLES[c.classification] ?? CLS_STYLES.neutral
                  return (
                    <div key={c.change_id || i} className={`rounded-xl p-4 border ${st.card}`}>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className={`text-xl font-black leading-none ${st.ic}`}>{st.icon}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border capitalize ${st.badge}`}>
                          {c.classification}
                        </span>
                        <span className="text-xs text-slate-500 font-mono bg-slate-800/60 px-1.5 py-0.5 rounded">
                          {c.type.replace(/_/g, ' ')}
                        </span>
                        {c.accessibility_regression && (
                          <span className="text-xs bg-red-900/50 text-red-300 px-2 py-0.5 rounded-full border border-red-800/50">
                            ⚠ A11y regression
                          </span>
                        )}
                        {c.pixel_diff_percentage != null && (
                          <span className="ml-auto text-xs text-slate-600 flex-shrink-0">
                            {c.pixel_diff_percentage.toFixed(1)}% pixel diff
                          </span>
                        )}
                      </div>

                      <div className="font-medium text-slate-200 text-sm mt-2">{c.element_description}</div>

                      {c.reasoning && (
                        <div className="text-xs text-slate-400 mt-1.5 leading-relaxed">{c.reasoning}</div>
                      )}

                      {/* Before / after value pill */}
                      {(c.before?.value != null || c.after?.value != null) && (
                        <div className="flex items-center gap-2 mt-2.5 font-mono text-xs text-slate-500">
                          <span className="bg-slate-800/80 border border-slate-700 px-2 py-0.5 rounded">
                            {String(c.before?.value ?? '—')}
                          </span>
                          <span className="text-slate-600">→</span>
                          <span className="bg-slate-800/80 border border-slate-700 px-2 py-0.5 rounded">
                            {String(c.after?.value ?? '—')}
                          </span>
                          {c.before?.wcag_contrast != null && c.after?.wcag_contrast != null && (
                            <span className="text-slate-600 ml-1">
                              · WCAG {c.before.wcag_contrast.toFixed(2)} → {c.after.wcag_contrast.toFixed(2)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}

                {filteredChanges.length === 0 && (
                  <p className="text-slate-500 text-sm py-6 text-center">
                    No {changeFilter === 'all' ? '' : changeFilter + ' '}changes detected.
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ⑦ PER-VERSION FINDINGS (tabbed) */}
          {(report.before_report?.findings?.length > 0 || report.after_report?.findings?.length > 0) && (
            <div className="space-y-3">
              <div className="flex gap-1 bg-slate-800/60 rounded-xl p-1 border border-slate-700 w-fit">
                {['before', 'after'].map(tab => {
                  const count = tab === 'before'
                    ? (report.before_report?.findings?.length ?? 0)
                    : (report.after_report?.findings?.length ?? 0)
                  return (
                    <button
                      key={tab}
                      onClick={() => setFindingsTab(tab)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                        findingsTab === tab ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tab} — {count} finding{count !== 1 ? 's' : ''}
                    </button>
                  )
                })}
              </div>

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
