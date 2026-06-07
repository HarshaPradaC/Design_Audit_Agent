import { motion } from 'framer-motion'

export default function ProgressBar({ percent, stage }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm text-slate-400">
        <span>{stage || 'Processing...'}</span>
        <span>{percent}%</span>
      </div>
      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
          initial={{ width: '0%' }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}
