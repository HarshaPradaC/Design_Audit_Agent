import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion } from 'framer-motion'

export default function UploadZone({ onFile, label = 'Drop screenshot here', file }) {
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
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
        isDragActive
          ? 'border-blue-500 bg-blue-900/10'
          : file
          ? 'border-green-600 bg-green-900/10'
          : 'border-slate-700 hover:border-slate-500 bg-slate-900/30'
      }`}
    >
      <input {...getInputProps()} />
      {file ? (
        <div>
          <div className="text-green-400 text-2xl mb-2">✓</div>
          <p className="text-green-400 font-medium">{file.name}</p>
          <p className="text-slate-500 text-sm mt-1">{(file.size / 1024).toFixed(0)} KB — click to replace</p>
          <img
            src={URL.createObjectURL(file)}
            alt="preview"
            className="mt-3 max-h-32 mx-auto rounded-lg object-contain opacity-80"
          />
        </div>
      ) : (
        <div>
          <div className="text-slate-500 text-3xl mb-3">↑</div>
          <p className="text-slate-300 font-medium">{label}</p>
          <p className="text-slate-500 text-sm mt-1">PNG, JPG, WebP supported</p>
        </div>
      )}
    </div>
  )
}
