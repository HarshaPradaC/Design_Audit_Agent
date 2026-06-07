function toReportUrl(path) {
  if (!path) return null
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

  const htmlUrl       = toReportUrl(report.html_report)
  const annotatedUrl  = toReportUrl(report.annotated_screenshot)
  const annotFilename = report.annotated_screenshot
    ? report.annotated_screenshot.replace(/\\/g, '/').split('/').pop()
    : null

  return (
    <div className="space-y-2.5">
      <div className="label">Export</div>
      <div className="flex flex-wrap gap-2">

        {/* JSON report */}
        <button onClick={downloadJson} className="btn-secondary flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v7M3.5 6L6 8.5 8.5 6M1 10.5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          JSON Report
        </button>

        {/* Full HTML report */}
        {htmlUrl && (
          <a
            href={htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary flex items-center gap-1.5 no-underline"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M5 2H2.5A1.5 1.5 0 001 3.5v6A1.5 1.5 0 002.5 11h6A1.5 1.5 0 0010 9.5V7M7.5 1H11m0 0v3.5M11 1L5.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Full HTML Report
          </a>
        )}

        {/* Annotated PNG */}
        {annotatedUrl && (
          <a
            href={annotatedUrl}
            download={annotFilename}
            className="btn-secondary flex items-center gap-1.5 no-underline"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v7M3.5 6L6 8.5 8.5 6M1 10.5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Annotated PNG
          </a>
        )}
      </div>
    </div>
  )
}
