/** Converts any absolute or relative path to a /reports/<filename> URL. */
function reportUrl(path) {
  if (!path) return null
  // Handle Windows backslashes and POSIX forward slashes
  const filename = path.replace(/\\/g, '/').split('/').pop()
  return filename ? `/reports/${filename}` : null
}

export default function ReportExport({ report }) {
  if (!report) return null

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${report.report_id}.json`
    a.click()
  }

  const htmlUrl = reportUrl(report.html_report)
  const annotatedUrl = reportUrl(report.annotated_screenshot)
  const annotatedFilename = report.annotated_screenshot
    ? report.annotated_screenshot.replace(/\\/g, '/').split('/').pop()
    : null

  return (
    <div className="mt-4 space-y-2">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Export &amp; Download</div>
      <div className="flex flex-wrap gap-2">
        {/* JSON always available */}
        <button
          onClick={downloadJson}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-200 transition-colors border border-slate-600 hover:border-slate-500"
        >
          <span>⬇</span>
          <span>JSON Report</span>
        </button>

        {/* HTML opens in new tab — served as static file from /reports */}
        {htmlUrl && (
          <a
            href={htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-600 rounded-lg text-sm text-blue-100 transition-colors border border-blue-600 hover:border-blue-500 no-underline"
          >
            <span>↗</span>
            <span>Full HTML Report</span>
          </a>
        )}

        {/* Annotated PNG — direct download */}
        {annotatedUrl && (
          <a
            href={annotatedUrl}
            download={annotatedFilename}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-200 transition-colors border border-slate-600 hover:border-slate-500 no-underline"
          >
            <span>⬇</span>
            <span>Annotated PNG</span>
          </a>
        )}
      </div>
    </div>
  )
}
