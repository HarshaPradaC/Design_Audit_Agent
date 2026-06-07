const GRADE_COLORS = {
  'A+': 'text-green-400', A: 'text-green-400', 'A-': 'text-green-400',
  'B+': 'text-lime-400', B: 'text-lime-400', 'B-': 'text-lime-400',
  'C+': 'text-yellow-400', C: 'text-yellow-400', 'C-': 'text-yellow-400',
  'D+': 'text-orange-400', D: 'text-orange-400', 'D-': 'text-orange-400',
  F: 'text-red-400',
}

export default function ScoreCard({ scoreBreakdown, summary }) {
  if (!scoreBreakdown) return null
  const { principle_scores, principle_grades, overall_score, overall_grade } = scoreBreakdown

  return (
    <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white">Design Score</h3>
        <div className={`text-3xl font-black ${GRADE_COLORS[overall_grade] || 'text-slate-400'}`}>
          {overall_grade} <span className="text-lg font-bold text-slate-400">{Math.round(overall_score)}</span>
        </div>
      </div>
      <div className="space-y-2">
        {Object.entries(principle_scores).map(([principle, score]) => (
          <div key={principle} className="flex items-center gap-3">
            <span className="text-xs text-slate-400 w-28 shrink-0">{principle}</span>
            <div className="flex-1 bg-slate-700 rounded-full h-1.5">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${score}%` }}
              />
            </div>
            <span className={`text-xs font-bold w-6 text-right ${GRADE_COLORS[principle_grades[principle]] || ''}`}>
              {principle_grades[principle]}
            </span>
          </div>
        ))}
      </div>
      {summary && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {summary.critical > 0 && <div className="bg-red-900/30 rounded-lg p-2"><div className="text-red-400 font-bold text-lg">{summary.critical}</div><div className="text-xs text-slate-500">Critical</div></div>}
          {summary.high > 0 && <div className="bg-orange-900/30 rounded-lg p-2"><div className="text-orange-400 font-bold text-lg">{summary.high}</div><div className="text-xs text-slate-500">High</div></div>}
          {summary.medium > 0 && <div className="bg-yellow-900/30 rounded-lg p-2"><div className="text-yellow-400 font-bold text-lg">{summary.medium}</div><div className="text-xs text-slate-500">Medium</div></div>}
        </div>
      )}
    </div>
  )
}
