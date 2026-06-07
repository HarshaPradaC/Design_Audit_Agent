import { motion } from 'framer-motion'

export default function ProgressBar({ percent = 0, stage = '' }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-2 truncate pr-4">{stage || 'Processing…'}</span>
        <span className="text-xs font-mono text-ink-3 tabular-nums flex-shrink-0">{percent}%</span>
      </div>
      {/* Track */}
      <div className="relative w-full h-1 bg-edge-2 rounded-full overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-accent rounded-full"
          initial={{ width: '0%' }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}
