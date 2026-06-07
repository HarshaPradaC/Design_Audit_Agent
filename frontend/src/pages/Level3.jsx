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

function gradeBg(grade) {
  if (!grade) return 'bg-slate-700 text-slate-300'
  if (grade === 'A+' || grade === 'A') return 'bg-green-900/60 text-green-300 border border-green-700/50'
  if (grade === 'B') return 'bg-blue-900/60 text-blue-300 border border-blue-700/50'
  if (grade === 'C') return 'bg-yellow-900/60 text-yellow-300 border border-yellow-700/50'
  if (grade === 'D') return 'bg-orange-900/60 text-orange-300 border border-orange-700/50'
  return 'bg-red-900/60 text-red-300 border border-red-700/50'
}

function runTypeMeta(type, verdict) {
  switch (type) {
    case 'regression':  return { cls: 'border-red-800/50 bg-red-950/20',     icon: '⬇', label: 'Regression',  color: 'text-red-400' }
    case 'improvement': return { cls: 'border-green-800/50 bg-green-950/20', icon: '⬆', label: 'Improvement', color: 'text-green-400' }
    case 'neutral':     return { cls: 'border-yellow-800/50 bg-yellow-950/20', icon: '→', label: 'Neutral',   color: 'text-yellow-400' }
    case 'baseline':    return { cls: 'border-blue-800/40 bg-blue-950/15',   icon: '◎', label: 'Baseline',   color: 'text-blue-400' }
    case 'no_change':   return { cls: 'border-slate-700 bg-slate-800/30',    icon: '✓', label: 'No Change',  color: 'text-slate-400' }
    case 'error':       return { cls: 'border-orange-800/40 bg-orange-950/15', icon: '⚠', label: 'Error',   color: 'text-orange-400' }
    default:            return { cls: 'border-slate-700 bg-slate-800/30',    icon: '·', label: type || '?',  color: 'text-slate-400' }
  }
}

function parsePageResult(evt) {
  // Rich page_result from backend takes priority
  if (evt.page_result) return evt.page_result

  // Legacy fallback: parse from stage string
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
  const [tab, setTab] = useState('captured')   // 'captured' | 'annotated'
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
      className={`rounded-xl border overflow-hidden ${meta.cls}`}
    >
      {/* ── Card Header ── */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`text-lg font-black flex-shrink-0 ${meta.color}`}>{meta.icon}</span>
          <div className="min-w-0">
            <span className="font-semibold text-white text-sm">{r.page}</span>
            {r.verdict && (
              <span className={`ml-2 text-xs font-medium ${meta.color}`}>{r.verdict}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Grade / Score badge */}
          {hasScore && (
            <div className="flex items-center gap-1.5">
              {r.grade && (
                <span className={`text-xs font-black px-2 py-0.5 rounded-md ${gradeBg(r.grade)}`}>
                  {r.grade}
                </span>
              )}
              {r.score != null && (
                <span className="text-xs text-slate-400">
                  {Math.round(r.score)}<span className="text-slate-600">/100</span>
                </span>
              )}
            </div>
          )}
          {/* Run type badge */}
          <span className={`text-xs px-2 py-0.5 rounded-md border border-white/10 font-medium ${meta.color} bg-white/5`}>
            {meta.label}
          </span>
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-1"
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* ── Findings Row (always visible) ── */}
      {(r.total_findings > 0 || r.changes_count > 0) && (
        <div className="flex items-center gap-2 px-4 py-2 flex-wrap border-b border-white/5 bg-black/10">
          {r.total_findings > 0 && (
            <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
              {r.total_findings} findings
            </span>
          )}
          {r.critical_findings > 0 && (
            <span className="text-xs bg-red-950/50 text-red-400 px-2 py-0.5 rounded-full border border-red-900/50">
              {r.critical_findings} critical
            </span>
          )}
          {r.high_findings > 0 && (
            <span className="text-xs bg-orange-950/50 text-orange-400 px-2 py-0.5 rounded-full border border-orange-900/50">
              {r.high_findings} high
            </span>
          )}
          {r.medium_findings > 0 && (
            <span className="text-xs bg-yellow-950/50 text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-900/50">
              {r.medium_findings} medium
            </span>
          )}
          {r.low_findings > 0 && (
            <span className="text-xs bg-blue-950/50 text-blue-400 px-2 py-0.5 rounded-full border border-blue-900/50">
              {r.low_findings} low
            </span>
          )}
          {r.changes_count > 0 && (
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
              r.run_type === 'regression'  ? 'bg-red-950/50 text-red-400 border-red-900/50' :
              r.run_type === 'improvement' ? 'bg-green-950/50 text-green-400 border-green-900/50' :
              'bg-yellow-950/50 text-yellow-400 border-yellow-900/50'
            }`}>
              {r.changes_count} change{r.changes_count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* ── Expanded Body ── */}
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
                <p className="text-xs text-slate-400">{r.message}</p>
              )}

              {/* Screenshot tabs */}
              {hasScreenshot && (
                <div className="space-y-2">
                  {/* Tab switcher */}
                  {screenshotUrl && annotatedUrl && (
                    <div className="flex gap-1 text-xs">
                      <button
                        onClick={() => setTab('captured')}
                        className={`px-3 py-1 rounded-md transition-colors ${
                          tab === 'captured'
                            ? 'bg-slate-700 text-white'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        Captured
                      </button>
                      <button
                        onClick={() => setTab('annotated')}
                        className={`px-3 py-1 rounded-md transition-colors ${
                          tab === 'annotated'
                            ? 'bg-slate-700 text-white'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        Annotated
                      </button>
                    </div>
                  )}

                  {/* Screenshot image */}
                  <div className="relative rounded-lg overflow-hidden border border-slate-700/50 bg-slate-900">
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
                    <div className="hidden items-center justify-center h-20 text-slate-600 text-xs">
                      Screenshot not available
                    </div>
                    {/* Label overlay */}
                    <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded backdrop-blur-sm">
                      {tab === 'annotated' ? 'Annotated' : 'Captured'}
                    </div>
                    {/* Full-screen link */}
                    {(tab === 'captured' ? screenshotUrl : annotatedUrl) && (
                      <a
                        href={tab === 'captured' ? screenshotUrl : annotatedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded backdrop-blur-sm hover:bg-black/80"
                      >
                        Full ↗
                      </a>
                    )}
                  </div>

                  {/* Severity legend for annotated */}
                  {tab === 'annotated' && annotatedUrl && (
                    <div className="flex flex-wrap gap-3 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-600 inline-block" />Critical</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-orange-500 inline-block" />High</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-500 inline-block" />Medium</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" />Low</span>
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
                    className="text-xs px-3 py-1.5 bg-blue-900/40 hover:bg-blue-800/50 border border-blue-700/50 text-blue-300 rounded-lg transition-colors no-underline"
                  >
                    View HTML Report ↗
                  </a>
                )}
                {annotatedUrl && (
                  <a
                    href={annotatedUrl}
                    download={`${r.page}_annotated.png`}
                    className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 rounded-lg transition-colors no-underline"
                  >
                    ⬇ Annotated PNG
                  </a>
                )}
                {l1JsonUrl && (
                  <a
                    href={l1JsonUrl}
                    download={`${r.l1_report_id}.json`}
                    className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 rounded-lg transition-colors no-underline"
                  >
                    ⬇ L1 JSON
                  </a>
                )}
                {regJsonUrl && (
                  <a
                    href={regJsonUrl}
                    download={`${r.regression_report_id}.json`}
                    className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 rounded-lg transition-colors no-underline"
                  >
                    ⬇ Regression JSON
                  </a>
                )}
                {(r.run_type === 'regression' || r.run_type === 'improvement' || r.run_type === 'neutral') && (
                  <button
                    onClick={() => onApproveBaseline(r.page)}
                    disabled={r.baseline_approved}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      r.baseline_approved
                        ? 'bg-green-950/30 border-green-800/40 text-green-400 cursor-default'
                        : 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300'
                    }`}
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
          <span className="text-xs text-slate-600 flex-1 truncate">{r.message || ''}</span>
          <div className="flex gap-1.5">
            {htmlUrl && (
              <a href={htmlUrl} target="_blank" rel="noreferrer"
                className="text-[10px] px-2 py-1 bg-blue-900/30 text-blue-400 border border-blue-800/40 rounded no-underline hover:bg-blue-900/50 transition-colors">
                HTML ↗
              </a>
            )}
            {regJsonUrl && (
              <a href={regJsonUrl} download className="text-[10px] px-2 py-1 bg-slate-800 text-slate-400 border border-slate-700 rounded no-underline hover:bg-slate-700 transition-colors">
                ⬇ JSON
              </a>
            )}
            {(r.run_type === 'regression' || r.run_type === 'improvement' || r.run_type === 'neutral') && !r.baseline_approved && (
              <button
                onClick={() => onApproveBaseline(r.page)}
                className="text-[10px] px-2 py-1 bg-slate-800 text-slate-400 border border-slate-700 rounded hover:bg-slate-700 transition-colors"
              >
                Approve
              </button>
            )}
          </div>
        </div>
      )}
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
        // Polling fallback when WebSocket is unavailable
        pollRef.current = setInterval(async () => {
          try {
            const s = await getMonitorStatus(result.run_id)
            setStage(s.status)
            setProgress(Math.min(95, 15 + s.pages_processed * 20))
            // Sync page_results from REST status
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

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Autonomous Monitoring</h2>
        <p className="text-slate-400 mt-1">
          Playwright captures your live site, runs a full L1 design audit on first visit,
          then detects visual regressions on every subsequent run — automatically.
        </p>
      </div>

      {/* Config editor */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-300">Site Configuration (JSON)</label>
          <button
            onClick={() => setConfig(JSON.stringify(DEFAULT_CONFIG, null, 2))}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Reset to default
          </button>
        </div>
        <textarea
          value={config}
          onChange={e => setConfig(e.target.value)}
          rows={16}
          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 font-mono text-sm text-slate-300 focus:outline-none focus:border-blue-500 resize-y"
          spellCheck={false}
        />
        <div className="text-xs text-slate-600 leading-relaxed">
          Set <code className="bg-slate-800 px-1 rounded">url</code> to your site root.
          Each entry in <code className="bg-slate-800 px-1 rounded">pages</code> gets
          its own screenshot and full L1 design audit. <strong className="text-slate-400">
          First run</strong> saves a baseline and runs L1 analysis.
          Subsequent runs detect regressions against that baseline.
        </div>
      </div>

      {/* Start button */}
      <button
        onClick={start}
        disabled={loading}
        className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-colors"
      >
        {loading ? 'Monitoring in progress…' : done ? 'Run Again' : 'Start Monitoring Run'}
      </button>

      {/* Progress */}
      {(loading || done) && <ProgressBar percent={progress} stage={stage} />}

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 text-red-300 text-sm whitespace-pre-wrap">
          {error}
        </div>
      )}

      {/* Run ID badge */}
      {runId && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 mb-0.5">Run ID</div>
            <div className="font-mono text-slate-300 text-sm">{runId}</div>
          </div>
          <div className={`text-xs px-2 py-1 rounded-lg border font-medium ${
            done  ? 'border-green-800/50 bg-green-950/20 text-green-400' :
            error ? 'border-red-800/50 bg-red-950/20 text-red-400' :
                    'border-blue-800/50 bg-blue-950/20 text-blue-400'
          }`}>
            {done ? 'Complete' : error ? 'Error' : 'Running'}
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
            <div className="flex flex-wrap gap-2 text-xs">
              {counts.regression  > 0 && <span className="bg-red-950/30 border border-red-900/50 text-red-400 px-3 py-1 rounded-lg">{counts.regression} regression{counts.regression > 1 ? 's' : ''}</span>}
              {counts.improvement > 0 && <span className="bg-green-950/30 border border-green-900/50 text-green-400 px-3 py-1 rounded-lg">{counts.improvement} improvement{counts.improvement > 1 ? 's' : ''}</span>}
              {counts.neutral     > 0 && <span className="bg-yellow-950/30 border border-yellow-900/50 text-yellow-400 px-3 py-1 rounded-lg">{counts.neutral} neutral</span>}
              {counts.no_change   > 0 && <span className="bg-slate-800 border border-slate-700 text-slate-400 px-3 py-1 rounded-lg">{counts.no_change} unchanged</span>}
              {counts.baseline    > 0 && <span className="bg-blue-950/30 border border-blue-900/50 text-blue-400 px-3 py-1 rounded-lg">{counts.baseline} baseline{counts.baseline > 1 ? 's' : ''} saved</span>}
              {counts.error       > 0 && <span className="bg-orange-950/30 border border-orange-900/50 text-orange-400 px-3 py-1 rounded-lg">{counts.error} error{counts.error > 1 ? 's' : ''}</span>}
            </div>

            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
              Page Results <span className="text-slate-600 normal-case font-normal">(click ▼ to expand)</span>
            </h3>

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
            className="bg-green-950/20 border border-green-800/50 rounded-xl p-5"
          >
            <div className="text-center mb-4">
              <div className="text-green-400 text-2xl font-black mb-1">Run Complete</div>
              <div className="text-slate-300 text-sm">{summary}</div>
            </div>

            {/* L3 HTML Report download */}
            {l3ReportUrl && (
              <div className="flex justify-center gap-3">
                <a
                  href={l3ReportUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors no-underline"
                >
                  View L3 Summary Report ↗
                </a>
                <a
                  href={l3ReportUrl}
                  download
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium rounded-lg transition-colors no-underline border border-slate-600"
                >
                  ⬇ Download HTML
                </a>
              </div>
            )}

            {pageResults.some(r => r.run_type === 'baseline') && (
              <p className="text-slate-500 text-xs mt-3 text-center">
                Baselines saved. Run again to start detecting changes.
              </p>
            )}
            {pageResults.some(r => r.run_type === 'regression') && (
              <p className="text-slate-500 text-xs mt-2 text-center">
                Regressions detected — review findings above, then approve a new baseline when changes are intentional.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Progress Log ── */}
      {events.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
            Progress Log
          </h3>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1.5 max-h-72 overflow-y-auto font-mono text-xs">
            {events.map((e, i) => (
              <div key={i} className="flex gap-3 items-baseline">
                <span className="text-slate-700 flex-shrink-0 w-6 text-right">{String(i + 1).padStart(2, '0')}</span>
                <span className="text-slate-600 flex-shrink-0">{e.ts}</span>
                <span className={`flex-shrink-0 ${
                  e.stage?.includes('REGRESSION')  ? 'text-red-400' :
                  e.stage?.includes('IMPROVEMENT') ? 'text-green-400' :
                  e.stage?.startsWith('Baseline')  ? 'text-blue-400' :
                  e.stage?.startsWith('No change') ? 'text-slate-500' :
                  'text-slate-300'
                }`}>
                  {e.stage}
                </span>
                {e.message && <span className="text-slate-600 truncate">{e.message}</span>}
                {e.percent !== undefined && (
                  <span className="ml-auto text-slate-700 flex-shrink-0">{e.percent}%</span>
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
