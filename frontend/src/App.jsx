import { useState } from 'react'
import { motion } from 'framer-motion'
import Level1 from './pages/Level1'
import Level2 from './pages/Level2'
import Level3 from './pages/Level3'

const TABS = [
  { id: 'l1', label: 'L1 Analyze', desc: 'Single Page Analysis' },
  { id: 'l2', label: 'L2 Compare', desc: 'Before/After Regression' },
  { id: 'l3', label: 'L3 Monitor', desc: 'Autonomous Monitoring' },
]

export default function App() {
  const [tab, setTab] = useState('l1')

  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-200">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Design Audit Agent</h1>
            <p className="text-xs text-slate-500">Automated UI/UX Intelligence</p>
          </div>
          <nav className="flex gap-2">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === t.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {tab === 'l1' && <Level1 />}
          {tab === 'l2' && <Level2 />}
          {tab === 'l3' && <Level3 />}
        </motion.div>
      </main>
    </div>
  )
}
