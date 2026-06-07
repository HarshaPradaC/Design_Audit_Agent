import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Level1 from './pages/Level1'
import Level2 from './pages/Level2'
import Level3 from './pages/Level3'

// ─── Navigation config ────────────────────────────────────────────────────────

const NAV = [
  {
    id: 'l1',
    label: 'L1 Analyze',
    sublabel: 'Single-page audit',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="1" y="1" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M4 5h7M4 7.5h5M4 10h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'l2',
    label: 'L2 Compare',
    sublabel: 'Regression analysis',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="1" y="2" width="5.5" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
        <rect x="8.5" y="2" width="5.5" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M7.5 7.5H7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'l3',
    label: 'L3 Monitor',
    sublabel: 'Autonomous capture',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M7.5 4.5v3l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
]

const PAGE_META = {
  l1: {
    title: 'Design Analysis',
    description: 'Upload a UI screenshot to run a full L1 design audit.',
  },
  l2: {
    title: 'Regression Comparison',
    description: 'Compare before and after screenshots to detect design changes.',
  },
  l3: {
    title: 'Autonomous Monitoring',
    description: 'Capture and audit a live site across multiple pages automatically.',
  },
}

// ─── Sidebar Nav Item ─────────────────────────────────────────────────────────

function NavItem({ item, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left
        transition-colors duration-150 group relative
        ${active
          ? 'bg-surface-2 text-ink-1'
          : 'text-ink-3 hover:bg-surface-2/60 hover:text-ink-2'
        }
      `}
    >
      {/* Active indicator */}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-accent rounded-r-full" />
      )}
      <span className={`flex-shrink-0 transition-colors ${active ? 'text-accent' : 'text-ink-3 group-hover:text-ink-2'}`}>
        {item.icon}
      </span>
      <div className="min-w-0">
        <div className={`text-sm font-medium leading-none mb-0.5 ${active ? 'text-ink-1' : ''}`}>
          {item.label}
        </div>
        <div className="text-2xs text-ink-3 leading-none">{item.sublabel}</div>
      </div>
    </button>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState('l1')
  const meta = PAGE_META[tab]

  return (
    <div className="flex h-screen bg-surface-0 text-ink-1 overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="w-[210px] flex-shrink-0 flex flex-col bg-surface-1 border-r border-edge-1">

        {/* Brand */}
        <div className="px-4 pt-5 pb-4 border-b border-edge-1">
          <div className="flex items-center gap-2.5">
            {/* Logo mark */}
            <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center flex-shrink-0 shadow-elevated">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 3.5h10M2 7h6M2 10.5h8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-ink-1 leading-none mb-0.5">Design Audit</div>
              <div className="text-2xs text-ink-3 leading-none">Agent v1.0</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          <div className="label px-3 mb-2">Audit Levels</div>
          {NAV.map(item => (
            <NavItem
              key={item.id}
              item={item}
              active={tab === item.id}
              onClick={() => setTab(item.id)}
            />
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-edge-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-sev-success flex-shrink-0" />
            <span className="text-xs text-ink-3">Gemini Vision API</span>
          </div>
          <div className="text-2xs text-ink-3 leading-relaxed">
            Evidence-anchored findings. Zero hallucination policy.
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Page header */}
        <header className="flex-shrink-0 border-b border-edge-1 px-8 py-4 bg-surface-0">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-semibold text-ink-1 leading-tight">{meta.title}</h1>
              <p className="text-sm text-ink-3 mt-0.5">{meta.description}</p>
            </div>
            {/* Level badge */}
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`badge ${
                tab === 'l1' ? 'badge-low' :
                tab === 'l2' ? 'badge-medium' :
                'badge-critical'
              }`}>
                {tab.toUpperCase()}
              </span>
            </div>
          </div>
        </header>

        {/* Scrollable page content */}
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="px-8 py-6 max-w-4xl"
            >
              {tab === 'l1' && <Level1 />}
              {tab === 'l2' && <Level2 />}
              {tab === 'l3' && <Level3 />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
