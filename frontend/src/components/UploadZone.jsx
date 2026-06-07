import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'

export default function UploadZone({ onFile, label = 'Drop a screenshot here', file }) {
  const onDrop = useCallback((accepted) => {
    if (accepted[0]) onFile(accepted[0])
  }, [onFile])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 1,
  })

  return (
    <div
      {...getRootProps()}
      className={`
        relative rounded-lg border cursor-pointer transition-all duration-150
        ${isDragActive
          ? 'border-accent bg-accent/5'
          : file
          ? 'border-sev-success/40 bg-surface-2'
          : 'border-edge-2 bg-surface-1 hover:border-edge-3 hover:bg-surface-2'
        }
      `}
    >
      <input {...getInputProps()} />

      {file ? (
        <div className="p-4 flex items-center gap-4">
          {/* Preview thumbnail */}
          <div className="w-16 h-16 rounded-md overflow-hidden bg-surface-3 flex-shrink-0 border border-edge-2">
            <img
              src={URL.createObjectURL(file)}
              alt="preview"
              className="w-full h-full object-cover"
            />
          </div>
          {/* File info */}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-ink-1 truncate">{file.name}</div>
            <div className="text-xs text-ink-3 mt-0.5">{(file.size / 1024).toFixed(0)} KB</div>
            <div className="text-xs text-ink-3 mt-1">Click to replace</div>
          </div>
          {/* Check icon */}
          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-sev-success/20 flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5l2.5 2.5 4-4" stroke="#2d8f52" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      ) : (
        <div className="px-6 py-8 text-center">
          {/* Upload icon */}
          <div className="mx-auto w-10 h-10 rounded-lg bg-surface-3 border border-edge-2 flex items-center justify-center mb-3">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-ink-3">
              <path d="M8 10V3M5 6l3-3 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-ink-2">{label}</p>
          <p className="text-xs text-ink-3 mt-1">PNG · JPG · WebP</p>
        </div>
      )}

      {isDragActive && (
        <div className="absolute inset-0 rounded-lg bg-accent/5 border-2 border-accent border-dashed flex items-center justify-center">
          <span className="text-sm font-medium text-accent">Release to upload</span>
        </div>
      )}
    </div>
  )
}
