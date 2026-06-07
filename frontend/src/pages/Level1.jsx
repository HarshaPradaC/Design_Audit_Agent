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
  deuteranopia:   { label: 'Deuteranopia',   pct: '~6% males',   desc: 'Red-green blindness — green cone deficiency. Greens shift toward red/brown.' },
  protanopia:     { label: 'Protanopia',     pct: '~2% males',   desc: 'Red-green blindness — red cone deficiency. Reds appear dark or black.' },
  tritanopia:     { label: 'Tritanopia',     pct: '~0.003%',     desc: 'Blue-yellow blindness — blue cone deficiency. Blues shift to green, yellows to pink.' },
  achromatopsia:  { label: 'Achromatopsia',  pct: 'Very rare',   desc: 'Complete colour blindness — all hues appear as greyscale.' },
}

function toReportUrl(path) {
  if (!path) return null
  const filename = path.replace(/\\/g, '/').split('/').pop()
  return filename ? `/reports/${filename}` : null
}

export default function Level1() {
  const [file, setFile]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage]     = useState('')
  const [report, setReport]   = useState(null)
  const [error, setError]     = useState(null)

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
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Single Page Analysis</h2>
        <p className="text-slate-400 mt-1">
          Upload a screenshot to get a full design audit — WCAG contrast, spacing, alignment,
          hierarchy, consistency — with CSS fix suggestions.
        </p>
      </div>

      {/* Upload + score side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <UploadZone onFile={setFile} file={file} />
          <button
            onClick={analyze}
            disabled={!file || loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-colors"
          >
            {loading ? 'Analyzing…' : 'Analyze Design'}
          </button>
          {loading && <ProgressBar percent={progress} stage={stage} />}
          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 text-red-300 text-sm">
              {error}
            </div>
          )}
        </div>

        {report && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <ScoreCard scoreBreakdown={report.score_breakdown} summary={report.summary} />
            <ReportExport report={report} />
          </motion.div>
        )}
      </div>

      {/* Annotated screenshot + findings */}
      {report && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          <AnnotatedViewer
            imagePath={report.annotated_screenshot}
            findings={report.findings}
            title="Annotated Screenshot"
          />

          <div>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Findings ({sortedFindings.length})
            </h3>
            <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
              {sortedFindings.map(f => (
                <FindingCard key={f.finding_id} finding={f} />
              ))}
              {sortedFindings.length === 0 && (
                <p className="text-slate-500 text-sm">No findings — design looks clean!</p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Design DNA */}
      {report?.design_dna && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-slate-800/50 rounded-xl p-5 border border-slate-700"
        >
          <h3 className="font-semibold text-white mb-4">Design DNA</h3>
          <div className="flex flex-wrap gap-8 text-sm">
            {report.design_dna.primary_colors?.length > 0 && (
              <div>
                <div className="text-slate-500 text-xs uppercase tracking-wide mb-2">Brand Colours</div>
                <div className="flex gap-3 flex-wrap">
                  {report.design_dna.primary_colors.map(c => (
                    <div key={c} className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-md border border-slate-600 shadow" style={{ background: c }} />
                      <span className="font-mono text-xs text-slate-400">{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {report.design_dna.spacing_scale?.length > 0 && (
              <div>
                <div className="text-slate-500 text-xs uppercase tracking-wide mb-2">Spacing Scale</div>
                <div className="flex gap-1.5 flex-wrap">
                  {report.design_dna.spacing_scale.slice(0, 8).map(s => (
                    <span key={s} className="font-mono text-xs bg-slate-700 px-2 py-0.5 rounded text-slate-300">
                      {s}px
                    </span>
                  ))}
                </div>
              </div>
            )}
            {report.design_dna.type_scale_px?.length > 0 && (
              <div>
                <div className="text-slate-500 text-xs uppercase tracking-wide mb-2">Type Scale</div>
                <div className="flex gap-1.5 flex-wrap">
                  {report.design_dna.type_scale_px.slice(0, 6).map(s => (
                    <span key={s} className="font-mono text-xs bg-slate-700 px-2 py-0.5 rounded text-slate-300">
                      {s}px
                    </span>
                  ))}
                </div>
              </div>
            )}
            {report.design_dna.border_radius_px?.length > 0 && (
              <div>
                <div className="text-slate-500 text-xs uppercase tracking-wide mb-2">Border Radius</div>
                <div className="flex gap-1.5 flex-wrap">
                  {report.design_dna.border_radius_px.slice(0, 4).map(r => (
                    <span key={r} className="font-mono text-xs bg-slate-700 px-2 py-0.5 rounded text-slate-300">
                      {r}px
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Accessibility Persona Simulations */}
      {personaEntries.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Accessibility Persona Simulations</h3>
            <p className="text-slate-400 text-sm mt-0.5">
              How your design appears to users with colour vision deficiencies.
              Each image applies a scientific colour transformation matrix to your screenshot.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {personaEntries.map(([persona, path]) => {
              const meta = PERSONA_META[persona] || { label: persona, pct: '', desc: '' }
              const imgUrl = toReportUrl(path)
              const filename = path ? path.replace(/\\/g, '/').split('/').pop() : null
              return (
                <div
                  key={persona}
                  className="bg-slate-800/60 rounded-xl border border-slate-700 overflow-hidden"
                >
                  <div className="relative group">
                    <img
                      src={imgUrl}
                      alt={`${meta.label} simulation`}
                      className="w-full object-contain"
                      onError={(e) => {
                        e.target.style.opacity = '0.1'
                        e.target.alt = 'Unavailable'
                      }}
                    />
                    <a
                      href={imgUrl}
                      download={filename}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/90 text-white text-xs px-2 py-1 rounded-lg border border-slate-600"
                    >
                      ⬇
                    </a>
                  </div>

                  <div className="p-3 space-y-0.5">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-sm text-white">{meta.label}</span>
                      <span className="text-xs text-slate-500">{meta.pct}</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{meta.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}
    </div>
  )
}
