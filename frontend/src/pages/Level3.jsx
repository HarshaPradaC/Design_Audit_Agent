import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { startMonitor, getMonitorStatus, refreshBaseline } from '../api'
import ProgressBar from '../components/ProgressBar'

// ─── Default config (3 pages per spec requirement) ────────────────────────────

const DEFAULT_CONFIG = {
  url: 'https://example.com',
  name: 'my-site',
  auth: { type: 'none' },
  pages: [
    { path: '/', name: 'homepage', wait_for: null, scroll_to: 'top', dynamic_masks: [] },
    { path: '/about', name: 'about', wait_for: null, scroll_to: 'top', dynamic_masks: [] },
    { path: '/contact', name: 'contact', wait_for: null, scroll_to: 'top', dynamic_masks: [] },
  ],
  viewport: { width: 1440, height: 900 },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toReportUrl(filename) {
  if (!filename) return null
  const clean = filename.replace(/\\/g, '/').split('/').pop()
  return clean ? `/reports/${clean}` : null
}

function gradeClasses(grade) {
  if (!grade) return 'bg-surface-3 text-ink-3 border border-edge-2'
  if (grade === 'A+' || grade === 'A') return 'bg-surface-3 text-sev-success border border-edge-2'
  if (grade === 'B') return 'bg-surface-3 text-accent border border-edge-2'
  if (grade === 'C') return 'bg-surface-3 text-sev-medium border border-edge-2'
  if (grade === 'D') return 'bg-surface-3 text-sev-high border border-edge-2'
  return 'bg-surface-3 text-sev-critical border border-edge-2'
}

function runTypeMeta(type) {
  switch (type) {
    case 'regression':  return { barCls: 'bg-sev-critical',  icon: '↓', label: 'Regression',  textCls: 'text-sev-critical',  badgeCls: 'badge-critical' }
    case 'improvement': return { barCls: 'bg-sev-success',   icon: '↑', label: 'Improvement', textCls: 'text-sev-success',   badgeCls: 'badge-low' }
    case 'neutral':     return { barCls: 'bg-sev-medium',    icon: '→', label: 'Neutral',     textCls: 'text-sev-medium',    badgeCls: 'badge-medium' }
    case 'baseline':    return { barCls: 'bg-accent',        icon: '◎', label: 'Baseline',    textCls: 'text-accent',        badgeCls: 'text-accent' }
    case 'no_change':   return { barCls: 'bg-ink-3',         icon: '✓', label: 'No Change',   textCls: 'text-ink-3',         badgeCls: '' }
    case 'error':       return { barCls: 'bg-sev-high',      icon: '⚠', label: 'Error',       textCls: 'text-sev-high',      badgeCls: 'badge-high' }
    default:            return { barCls: 'bg-ink-3',         icon: '·', label: type || '?',   textCls: 'text-ink-3',         badgeCls: '' }
  }
}

function parsePageResult(evt) {
  if (evt.page_result) return evt.page_result

  const { stage, message, report_url, percent } = evt
  if (!stage) return null

  if (stage.startsWith('Baseline created')) {
    const page = stage.replace('Baseline created — ', '').replace('Baseline created - ', '')
    return { page, run_type: 'baseline', message: 'First run — baseline saved', percent }
  }
  if (stage.startsWith('No change')) {
    const page = stage.replace('No change — ', '').replace('No change - ', '')
    return { page, run_type: 'no_change', message: 'No visual change detected', percent }
  }
  if (report_url) {
    const parts = stage.split(' — ')
    const page = parts[0]
    const verdict = parts.slice(1).join(' — ')
    const run_type = verdict.includes('IMPROVEMENT') ? 'improvement'
                   : verdict.includes('REGRESSION')  ? 'regression'
                   : 'neutral'
    return { page, run_type, verdict, message, regression_report_id: report_url, percent }
  }
  if (stage.startsWith('Error') || stage.startsWith('Timeout')) {
    const page = stage.replace(/^(Error|Timeout) — /, '').replace(/^(Error|Timeout) - /, '')
    return { page, run_type: 'error', message, percent }
  }
  return null
}

// ─── Page Result Card ─────────────────────────────────────────────────────────

function PageCard({ r, onApproveBaseline }) {
  const [tab, setTab] = useState('captured')
  const [expanded, setExpanded] = useState(false)
  const meta = runTypeMeta(r.run_type)

  const screenshotUrl = toReportUrl(r.screenshot_url)
  const annotatedUrl  = toReportUrl(r.annotated_url)
  const htmlUrl       = toReportUrl(r.html_report_url)
  const l1JsonUrl     = r.l1_report_id ? `/reports/${r.l1_report_id}.json` : null
  const regJsonUrl    = r.regression_report_id ? `/reports/${r.regression_report_id}.json` : null

  const hasScreenshot = screenshotUrl || annotatedUrl
  const hasScore      = r.score != null || r.grade

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="card overflow-hidden"
    >
      {/* ── Left colored bar + header row ── */}
      <div className="flex items-stretch">
        {/* Colored type bar */}
        <div className={`w-0.5 flex-shrink-0 rounded-l ${meta.barCls}`} />

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-edge-2">
            <div className="flex items-center gap-3 min-w-0">
              <span className={`text-base font-bold flex-shrink-0 ${meta.textCls}`}>{meta.icon}</span>
              <div className="min-w-0">
                <span className="font-semibold text-ink-1 text-sm">{r.page}</span>
                {r.verdict && (
                  <span className={`ml-2 text-xs font-medium ${meta.textCls}`}>{r.verdict}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Grade / Score */}
              {hasScore && (
                <div className="flex items-center gap-1.5">
                  {r.grade && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${gradeClasses(r.grade)}`}>
                      {r.grade}
                    </span>
                  )}
                  {r.score != null && (
                    <span className="text-xs text-ink-3">
                      {Math.round(r.score)}<span className="opacity-50">/100</span>
                    </span>
                  )}
                </div>
              )}

              {/* Run type badge */}
              <span className={`badge ${meta.badgeCls}`}>{meta.label}</span>

              {/* Expand chevron */}
              <button
                onClick={() => setExpanded(v => !v)}
                className="btn-ghost text-xs px-1.5 py-1 leading-none"
                aria-label={expanded ? 'Collapse' : 'Expand'}
              >
                {expanded ? '▲' : '▼'}
              </button>
            </div>
          </div>

          {/* ── Findings pills (always visible when present) ── */}
          {(r.total_findings > 0 || r.changes_count > 0) && (
            <div className="flex items-center gap-2 px-4 py-2 flex-wrap border-b border-edge-2 bg-surface-0">
              {r.total_findings > 0 && (
                <span className="badge">{r.total_findings} findings</span>
              )}
              {r.critical_findings > 0 && (
                <span className="badge badge-critical">{r.critical_findings} critical</span>
              )}
              {r.high_findings > 0 && (
                <span className="badge badge-high">{r.high_findings} high</span>
              )}
              {r.medium_findings > 0 && (
                <span className="badge badge-medium">{r.medium_findings} medium</span>
              )}
              {r.low_findings > 0 && (
                <span className="badge badge-low">{r.low_findings} low</span>
              )}
              {r.changes_count > 0 && (
                <span className={`badge ${
                  r.run_type === 'regression'  ? 'badge-critical' :
                  r.run_type === 'improvement' ? 'badge-low' :
                  'badge-medium'
                }`}>
                  {r.changes_count} change{r.changes_count !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}

          {/* ── Expanded body ── */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 py-4 space-y-4">
                  {/* Message */}
                  {r.message && (
                    <p className="text-xs text-ink-3">{r.message}</p>
                  )}

                  {/* Screenshot tabs */}
                  {hasScreenshot && (
                    <div className="space-y-2">
                      {screenshotUrl && annotatedUrl && (
                        <div className="flex gap-1 text-xs border border-edge-2 rounded-lg p-0.5 w-fit bg-surface-0">
                          <button
                            onClick={() => setTab('captured')}
                            className={`px-3 py-1 rounded-md transition-colors ${
                              tab === 'captured'
                                ? 'bg-surface-3 text-ink-1'
                                : 'text-ink-3 hover:text-ink-2'
                            }`}
                          >
                            Captured
                          </button>
                          <button
                            onClick={() => setTab('annotated')}
                            className={`px-3 py-1 rounded-md transition-colors ${
                              tab === 'annotated'
                                ? 'bg-surface-3 text-ink-1'
                                : 'text-ink-3 hover:text-ink-2'
                            }`}
                          >
                            Annotated
                          </button>
                        </div>
                      )}

                      {/* Screenshot image */}
                      <div className="relative rounded-lg overflow-hidden border border-edge-2 bg-surface-0">
                        {tab === 'captured' && screenshotUrl ? (
                          <img
                            src={screenshotUrl}
                            alt={`${r.page} screenshot`}
                            className="w-full object-cover max-h-64 object-top"
                            onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
                          />
                        ) : tab === 'annotated' && annotatedUrl ? (
                          <img
                            src={annotatedUrl}
                            alt={`${r.page} annotated`}
                            className="w-full object-cover max-h-64 object-top"
                            onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
                          />
                        ) : (screenshotUrl || annotatedUrl) ? (
                          <img
                            src={screenshotUrl || annotatedUrl}
                            alt={`${r.page} screenshot`}
                            className="w-full object-cover max-h-64 object-top"
                          />
                        ) : null}
                        <div className="hidden items-center justify-center h-20 text-ink-3 text-xs">
                          Screenshot not available
                        </div>
                        {/* Label overlay */}
                        <div className="absolute top-2 left-2 bg-surface-0/80 text-ink-2 text-[10px] px-2 py-0.5 rounded backdrop-blur-sm border border-edge-2">
                          {tab === 'annotated' ? 'Annotated' : 'Captured'}
                        </div>
                        {/* Full-screen link */}
                        {(tab === 'captured' ? screenshotUrl : annotatedUrl) && (
                          <a
                            href={tab === 'captured' ? screenshotUrl : annotatedUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="absolute top-2 right-2 bg-surface-0/80 text-ink-2 text-[10px] px-2 py-0.5 rounded backdrop-blur-sm border border-edge-2 hover:text-ink-1 transition-colors no-underline"
                          >
                            Full ↗
                          </a>
                        )}
                      </div>

                      {/* Severity legend for annotated */}
                      {tab === 'annotated' && annotatedUrl && (
                        <div className="flex flex-wrap gap-3 text-[10px] text-ink-3">
                          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-sev-critical inline-block" />Critical</span>
                          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-sev-high inline-block" />High</span>
                          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-sev-medium inline-block" />Medium</span>
                          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-sev-low inline-block" />Low</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2">
                    {htmlUrl && (
                      <a
                        href={htmlUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-primary text-xs no-underline"
                      >
                        View HTML Report ↗
                      </a>
                    )}
                    {annotatedUrl && (
                      <a
                        href={annotatedUrl}
                        download={`${r.page}_annotated.png`}
                        className="btn-secondary text-xs no-underline"
                      >
                        ↓ Annotated PNG
                      </a>
                    )}
                    {l1JsonUrl && (
                      <a
                        href={l1JsonUrl}
                        download={`${r.l1_report_id}.json`}
                        className="btn-secondary text-xs no-underline"
                      >
                        ↓ L1 JSON
                      </a>
                    )}
                    {regJsonUrl && (
                      <a
                        href={regJsonUrl}
                        download={`${r.regression_report_id}.json`}
                        className="btn-secondary text-xs no-underline"
                      >
                        ↓ Regression JSON
                      </a>
                    )}
                    {(r.run_type === 'regression' || r.run_type === 'improvement' || r.run_type === 'neutral') && (
                      <button
                        onClick={() => onApproveBaseline(r.page)}
                        disabled={r.baseline_approved}
                        className={`btn-ghost text-xs ${r.baseline_approved ? 'text-sev-success cursor-default' : ''}`}
                      >
                        {r.baseline_approved ? '✓ Approved as Baseline' : 'Approve as Baseline'}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Collapsed quick actions ── */}
          {!expanded && (
            <div className="flex items-center gap-2 px-4 py-2 flex-wrap">
              <span className="text-xs text-ink-3 flex-1 truncate">{r.message || ''}</span>
              <div className="flex gap-1.5">
                {htmlUrl && (
                  <a href={htmlUrl} target="_blank" rel="noreferrer"
                    className="btn-primary text-[10px] px-2 py-1 no-underline">
                    HTML ↗
                  </a>
                )}
                {regJsonUrl && (
                  <a href={regJsonUrl} download
                    className="btn-secondary text-[10px] px-2 py-1 no-underline">
                    ↓ JSON
                  </a>
                )}
                {(r.run_type === 'regression' || r.run_type === 'improvement' || r.run_type === 'neutral') && !r.baseline_approved && (
                  <button
                    onClick={() => onApproveBaseline(r.page)}
                    className="btn-ghost text-[10px] px-2 py-1"
                  >
                    Approve
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Level3() {
  const [config,      setConfig]      = useState(JSON.stringify(DEFAULT_CONFIG, null, 2))
  const [runId,       setRunId]       = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [progress,    setProgress]    = useState(0)
  const [stage,       setStage]       = useState('')
  const [events,      setEvents]      = useState([])
  const [pageResults, setPageResults] = useState([])
  const [summary,     setSummary]     = useState(null)
  const [l3ReportUrl, setL3ReportUrl] = useState(null)
  const [error,       setError]       = useState(null)
  const [done,        setDone]        = useState(false)
  const wsRef     = useRef(null)
  const pollRef   = useRef(null)
  const logEndRef = useRef(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  const upsertPageResult = (result) => {
    if (!result?.page) return
    setPageResults(prev => {
      const idx = prev.findIndex(r => r.page === result.page)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], ...result }
        return next
      }
      return [...prev, result]
    })
  }

  const start = async () => {
    let parsed
    try {
      parsed = JSON.parse(config)
    } catch {
      setError('Invalid JSON — please fix the config above')
      return
    }

    setLoading(true)
    setError(null)
    setEvents([])
    setPageResults([])
    setSummary(null)
    setL3ReportUrl(null)
    setDone(false)
    setProgress(0)
    setStage('Starting…')

    try {
      const result = await startMonitor(parsed)
      setRunId(result.run_id)

      const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(`${protocol}://${location.host}/ws/${result.run_id}`)
      wsRef.current = ws

      ws.onopen = () => setStage('Connected — waiting for events…')

      ws.onmessage = (e) => {
        let evt
        try { evt = JSON.parse(e.data) } catch { return }
        if (evt.event === 'ping') return

        if (evt.event === 'progress') {
          setProgress(evt.percent ?? 0)
          setStage(evt.stage ?? '')
          setEvents(prev => [...prev, { ...evt, ts: new Date().toLocaleTimeString() }])
          const pr = parsePageResult(evt)
          upsertPageResult(pr)
        }

        if (evt.event === 'complete') {
          setProgress(100)
          setStage('Complete')
          setSummary(evt.message)
          if (evt.report_url) setL3ReportUrl(`/reports/${evt.report_url}`)
          setDone(true)
          setLoading(false)
          ws.close()
        }

        if (evt.event === 'error') {
          setError(evt.message || 'Unknown error')
          setLoading(false)
          ws.close()
        }
      }

      ws.onerror = () => {
        pollRef.current = setInterval(async () => {
          try {
            const s = await getMonitorStatus(result.run_id)
            setStage(s.status)
            setProgress(Math.min(95, 15 + s.pages_processed * 20))
            if (s.page_results?.length) {
              s.page_results.forEach(upsertPageResult)
            }
            if (s.l3_report_url) setL3ReportUrl(`/reports/${s.l3_report_url}`)
            if (s.status === 'complete' || s.status?.startsWith('error')) {
              clearInterval(pollRef.current)
              setLoading(false)
              setDone(s.status === 'complete')
              if (s.status?.startsWith('error')) setError(s.status)
              else setSummary(`${s.pages_processed} page(s) scanned · ${s.findings_count} changes`)
            }
          } catch { /* ignore */ }
        }, 3000)
      }

    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Failed to start monitoring run')
      setLoading(false)
    }
  }

  useEffect(() => {
    return () => {
      wsRef.current?.close()
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const handleApproveBaseline = async (page) => {
    try {
      await refreshBaseline(page)
      setPageResults(prev => prev.map(r =>
        r.page === page ? { ...r, baseline_approved: true } : r
      ))
    } catch (e) {
      alert(`Baseline refresh failed: ${e.message}`)
    }
  }

  const counts = pageResults.reduce((a, r) => {
    a[r.run_type] = (a[r.run_type] || 0) + 1
    return a
  }, {})

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div>
        <h2 className="text-2xl font-semibold text-ink-1">Autonomous Monitoring</h2>
        <p className="text-ink-2 mt-1 text-sm leading-relaxed">
          Playwright captures your live site, runs a full L1 design audit on first visit,
          then detects visual regressions on every subsequent run — automatically.
        </p>
      </div>

      {/* ── Config editor ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="label">Site Configuration</div>
          <button
            onClick={() => setConfig(JSON.stringify(DEFAULT_CONFIG, null, 2))}
            className="btn-ghost text-xs"
          >
            Reset
          </button>
        </div>
        <textarea
          value={config}
          onChange={e => setConfig(e.target.value)}
          rows={14}
          className="input mono w-full"
          spellCheck={false}
        />
        <p className="text-xs text-ink-3 mt-2 leading-relaxed">
          Set <code className="bg-surface-3 px-1 rounded text-ink-2">url</code> to your site root.
          Each entry in <code className="bg-surface-3 px-1 rounded text-ink-2">pages</code> gets
          its own screenshot and full L1 design audit.{' '}
          <span className="text-ink-2 font-medium">First run</span> saves a baseline and runs L1 analysis.
          Subsequent runs detect regressions against that baseline.
        </p>
      </div>

      {/* ── Start button ── */}
      <button
        onClick={start}
        disabled={loading}
        className="btn-primary w-full py-3 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Monitoring in progress…' : done ? 'Run Again' : 'Start Monitoring Run'}
      </button>

      {/* ── Progress bar ── */}
      {(loading || done) && <ProgressBar percent={progress} stage={stage} />}

      {/* ── Error ── */}
      {error && (
        <div className="card border-sev-critical/40 bg-sev-critical/5 text-sev-critical text-sm whitespace-pre-wrap p-4">
          {error}
        </div>
      )}

      {/* ── Run ID badge ── */}
      {runId && (
        <div className="card flex items-center justify-between gap-4 p-4">
          <div>
            <div className="label mb-1">Run ID</div>
            <div className="font-mono text-ink-2 text-sm">{runId}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              done  ? 'bg-sev-success' :
              error ? 'bg-sev-critical' :
                      'bg-accent'
            }`} />
            <span className={`text-xs font-medium ${
              done  ? 'text-sev-success' :
              error ? 'text-sev-critical' :
                      'text-accent'
            }`}>
              {done ? 'Complete' : error ? 'Error' : 'Running'}
            </span>
          </div>
        </div>
      )}

      {/* ── Page Results ── */}
      <AnimatePresence>
        {pageResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Summary chips */}
            <div className="flex flex-wrap gap-2">
              {counts.regression  > 0 && <span className="badge badge-critical">{counts.regression} regression{counts.regression > 1 ? 's' : ''}</span>}
              {counts.improvement > 0 && <span className="badge badge-low">{counts.improvement} improvement{counts.improvement > 1 ? 's' : ''}</span>}
              {counts.neutral     > 0 && <span className="badge badge-medium">{counts.neutral} neutral</span>}
              {counts.no_change   > 0 && <span className="badge">{counts.no_change} unchanged</span>}
              {counts.baseline    > 0 && <span className="badge text-accent">{counts.baseline} baseline{counts.baseline > 1 ? 's' : ''} saved</span>}
              {counts.error       > 0 && <span className="badge badge-high">{counts.error} error{counts.error > 1 ? 's' : ''}</span>}
            </div>

            <div className="divider" />

            <div className="label">
              Page Results
              <span className="text-ink-3 normal-case font-normal ml-2 text-xs">(click ▼ to expand)</span>
            </div>

            <div className="space-y-3">
              {pageResults.map((r, i) => (
                <PageCard
                  key={r.page + i}
                  r={r}
                  onApproveBaseline={handleApproveBaseline}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Completion Summary ── */}
      <AnimatePresence>
        {done && summary && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card-elevated p-6"
          >
            <div className="text-center mb-5">
              <div className="text-xl font-semibold text-ink-1 mb-1">Run Complete</div>
              <div className="text-ink-2 text-sm">{summary}</div>
            </div>

            {l3ReportUrl && (
              <div className="flex justify-center gap-3 flex-wrap">
                <a
                  href={l3ReportUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary no-underline"
                >
                  View L3 Summary Report ↗
                </a>
                <a
                  href={l3ReportUrl}
                  download
                  className="btn-secondary no-underline"
                >
                  ↓ Download HTML
                </a>
              </div>
            )}

            {pageResults.some(r => r.run_type === 'baseline') && (
              <p className="text-ink-3 text-xs mt-4 text-center">
                Baselines saved. Run again to start detecting changes.
              </p>
            )}
            {pageResults.some(r => r.run_type === 'regression') && (
              <p className="text-ink-3 text-xs mt-2 text-center">
                Regressions detected — review findings above, then approve a new baseline when changes are intentional.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Progress Log ── */}
      {events.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          <div className="label">Progress Log</div>
          <div className="card bg-surface-0 p-4 space-y-1.5 max-h-64 overflow-y-auto font-mono text-xs">
            {events.map((e, i) => (
              <div key={i} className="flex gap-3 items-baseline">
                <span className="text-ink-3 opacity-50 flex-shrink-0 w-6 text-right select-none">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-ink-3 opacity-60 flex-shrink-0">{e.ts}</span>
                <span className={`flex-shrink-0 ${
                  e.stage?.includes('REGRESSION')  ? 'text-sev-critical' :
                  e.stage?.includes('IMPROVEMENT') ? 'text-sev-success' :
                  e.stage?.startsWith('Baseline')  ? 'text-accent' :
                  e.stage?.startsWith('No change') ? 'text-ink-3' :
                  'text-ink-2'
                }`}>
                  {e.stage}
                </span>
                {e.message && <span className="text-ink-3 truncate">{e.message}</span>}
                {e.percent !== undefined && (
                  <span className="ml-auto text-ink-3 opacity-50 flex-shrink-0">{e.percent}%</span>
                )}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </motion.div>
      )}

    </div>
  )
}
