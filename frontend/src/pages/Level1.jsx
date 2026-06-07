import { useState } from 'react'
import { motion } from 'framer-motion'
import { analyzeLevel1 } from '../api'
import UploadZone from '../components/UploadZone'
import ProgressBar from '../components/ProgressBar'
import ScoreCard from '../components/ScoreCard'
import FindingCard from '../components/FindingCard'
import AnnotatedViewer from '../components/AnnotatedViewer'
import ReportExport from '../components/ReportExport'

const PERSONA_META = {
  deuteranopia:  { label: 'Deuteranopia',  pct: '~6% males', desc: 'Red-green blindness — green cone deficiency. Greens shift toward red/brown.' },
  protanopia:    { label: 'Protanopia',    pct: '~2% males', desc: 'Red-green blindness — red cone deficiency. Reds appear dark or black.' },
  tritanopia:    { label: 'Tritanopia',    pct: '~0.003%',   desc: 'Blue-yellow blindness — blue cone deficiency. Blues shift to green, yellows to pink.' },
  achromatopsia: { label: 'Achromatopsia', pct: 'Very rare', desc: 'Complete colour blindness — all hues appear as greyscale.' },
}

function toReportUrl(path) {
  if (!path) return null
  const filename = path.replace(/\\/g, '/').split('/').pop()
  return filename ? `/reports/${filename}` : null
}

const pageVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
}

const sectionVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
}

export default function Level1() {
  const [file, setFile]         = useState(null)
  const [loading, setLoading]   = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage]       = useState('')
  const [report, setReport]     = useState(null)
  const [error, setError]       = useState(null)

  const analyze = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    setReport(null)
    setProgress(5)
    setStage('Uploading…')

    try {
      setStage('Extracting UI elements…')
      setProgress(20)
      const result = await analyzeLevel1(file, setProgress)
      setProgress(100)
      setStage('Complete')
      setReport(result)
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const severityOrder = ['critical', 'high', 'medium', 'low', 'info']
  const sortedFindings = report?.findings?.slice().sort(
    (a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
  ) || []

  const personaEntries = report?.persona_images
    ? Object.entries(report.persona_images)
    : []

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-ink-1">Single Page Analysis</h2>
        <p className="text-sm text-ink-2">
          Upload a screenshot to get a full design audit — WCAG contrast, spacing,
          alignment, hierarchy, consistency — with CSS fix suggestions.
        </p>
      </div>

      <div className="divider" />

      {/* ── Upload panel ────────────────────────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <div className="label mb-3">Upload Screenshot</div>
        <UploadZone onFile={setFile} file={file} />

        <button
          onClick={analyze}
          disabled={!file || loading}
          className="btn-primary w-full py-2.5 text-sm font-semibold"
        >
          {loading ? 'Analyzing…' : 'Analyze Design'}
        </button>

        {loading && (
          <div className="pt-1">
            <ProgressBar percent={progress} stage={stage} />
          </div>
        )}

        {error && (
          <div className="bg-red-950/30 border border-red-900/40 rounded-lg px-4 py-3 text-sm text-sev-critical">
            {error}
          </div>
        )}
      </div>

      {/* ── Score card (revealed after analysis) ────────────────────────────── */}
      {report && (
        <motion.div variants={sectionVariants} initial="hidden" animate="visible">
          <div className="label mb-3">Overall Score</div>
          <ScoreCard scoreBreakdown={report.score_breakdown} summary={report.summary} />
        </motion.div>
      )}

      {/* ── Annotated screenshot + findings ─────────────────────────────────── */}
      {report && (
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* Annotated viewer */}
          <div className="space-y-3">
            <div className="label">Annotated Screenshot</div>
            <AnnotatedViewer
              imagePath={report.annotated_screenshot}
              findings={report.findings}
              title="Annotated Screenshot"
            />
          </div>

          {/* Findings list */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="label">Findings</div>
              {sortedFindings.length > 0 && (
                <span className="text-xs text-ink-3 font-medium tabular-nums">
                  {sortedFindings.length} issue{sortedFindings.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="space-y-2 max-h-[640px] overflow-y-auto pr-0.5">
              {sortedFindings.map(f => (
                <FindingCard key={f.finding_id} finding={f} />
              ))}
              {sortedFindings.length === 0 && (
                <div className="card px-4 py-6 text-center">
                  <p className="text-sm text-ink-3">No findings — design looks clean.</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Design DNA ──────────────────────────────────────────────────────── */}
      {report?.design_dna && (
        <motion.div variants={sectionVariants} initial="hidden" animate="visible">
          <div className="label mb-3">Design DNA</div>
          <div className="card p-5">
            <div className="flex flex-wrap gap-8">

              {/* Brand colours */}
              {report.design_dna.primary_colors?.length > 0 && (
                <div className="space-y-2">
                  <div className="text-2xs font-semibold uppercase tracking-widest text-ink-3">
                    Brand Colours
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    {report.design_dna.primary_colors.map(c => (
                      <div key={c} className="flex items-center gap-2">
                        <div
                          className="w-5 h-5 rounded border border-edge-3 flex-shrink-0"
                          style={{ background: c }}
                        />
                        <span className="font-mono text-xs text-ink-2">{c}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Spacing scale */}
              {report.design_dna.spacing_scale?.length > 0 && (
                <div className="space-y-2">
                  <div className="text-2xs font-semibold uppercase tracking-widest text-ink-3">
                    Spacing Scale
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {report.design_dna.spacing_scale.slice(0, 8).map(s => (
                      <span
                        key={s}
                        className="font-mono text-xs bg-surface-2 border border-edge-1 text-ink-2 px-2 py-0.5 rounded-sm"
                      >
                        {s}px
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Type scale */}
              {report.design_dna.type_scale_px?.length > 0 && (
                <div className="space-y-2">
                  <div className="text-2xs font-semibold uppercase tracking-widest text-ink-3">
                    Type Scale
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {report.design_dna.type_scale_px.slice(0, 6).map(s => (
                      <span
                        key={s}
                        className="font-mono text-xs bg-surface-2 border border-edge-1 text-ink-2 px-2 py-0.5 rounded-sm"
                      >
                        {s}px
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Border radius */}
              {report.design_dna.border_radius_px?.length > 0 && (
                <div className="space-y-2">
                  <div className="text-2xs font-semibold uppercase tracking-widest text-ink-3">
                    Border Radius
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {report.design_dna.border_radius_px.slice(0, 4).map(r => (
                      <span
                        key={r}
                        className="font-mono text-xs bg-surface-2 border border-edge-1 text-ink-2 px-2 py-0.5 rounded-sm"
                      >
                        {r}px
                      </span>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </motion.div>
      )}

      {/* ── Accessibility persona simulations ───────────────────────────────── */}
      {personaEntries.length > 0 && (
        <motion.div variants={sectionVariants} initial="hidden" animate="visible" className="space-y-3">
          <div>
            <div className="label mb-1">Accessibility Persona Simulations</div>
            <p className="text-sm text-ink-2">
              How your design appears to users with colour vision deficiencies.
              Each image applies a scientific colour transformation matrix to your screenshot.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {personaEntries.map(([persona, path]) => {
              const meta = PERSONA_META[persona] || { label: persona, pct: '', desc: '' }
              const imgUrl = toReportUrl(path)
              const filename = path ? path.replace(/\\/g, '/').split('/').pop() : null

              return (
                <div
                  key={persona}
                  className="card overflow-hidden"
                >
                  {/* Thumbnail */}
                  <div className="relative group bg-surface-2">
                    <img
                      src={imgUrl}
                      alt={`${meta.label} simulation`}
                      className="w-full object-contain"
                      onError={e => {
                        e.target.style.opacity = '0.1'
                        e.target.alt = 'Unavailable'
                      }}
                    />
                    <a
                      href={imgUrl}
                      download={filename}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-surface-3 border border-edge-3 text-ink-2 text-xs px-2 py-1 rounded-sm hover:text-ink-1 hover:border-edge-3"
                    >
                      Download
                    </a>
                  </div>

                  {/* Meta */}
                  <div className="px-4 py-3 border-t border-edge-1 space-y-0.5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-ink-1">{meta.label}</span>
                      <span className="text-xs text-ink-3">{meta.pct}</span>
                    </div>
                    <p className="text-xs text-ink-2 leading-relaxed">{meta.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* ── Export ──────────────────────────────────────────────────────────── */}
      {report && (
        <motion.div variants={sectionVariants} initial="hidden" animate="visible">
          <div className="divider" />
          <div className="label mb-3">Export Report</div>
          <ReportExport report={report} />
        </motion.div>
      )}
    </motion.div>
  )
}
