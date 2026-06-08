# Design Audit Agent — Task Write-Up

> **Company:** Aivar
> **Type:** Engineering Hiring Challenge
> **Duration:** 6 hours
> **Stack:** Python · FastAPI · React · Tailwind CSS · Google Gemini · OpenCV · Playwright

---

## Table of Contents

1. [Task Brief](#task-brief)
2. [What Was Built](#what-was-built)
3. [System Architecture](#system-architecture)
4. [Level 1 — Single-Page Audit](#level-1--single-page-audit)
5. [Level 2 — Regression Testing](#level-2--regression-testing)
6. [Level 3 — Autonomous Monitoring](#level-3--autonomous-monitoring)
7. [Frontend Design System](#frontend-design-system)
8. [Key Technical Decisions](#key-technical-decisions)
9. [Challenges & Solutions](#challenges--solutions)
10. [Deliverables](#deliverables)
11. [What I Would Do Next](#what-i-would-do-next)

---

## Task Brief

Build an autonomous **Design Audit Agent** — a system that can analyse UI screenshots for design quality issues, detect regressions between versions, and continuously monitor live websites, all without human intervention.

The system had to operate at three escalating levels of intelligence:

| Level | Trigger | Expected Output |
|-------|---------|-----------------|
| L1 | Single screenshot upload | Findings, scores, annotated image, HTML report |
| L2 | Before + after screenshots | Change detection, regression/improvement verdict |
| L3 | Live URL + page list | Autonomous capture → audit → regression loop |

---

## What Was Built

A full-stack, production-grade design intelligence platform with:

- A **Python FastAPI backend** with a multi-stage CV + LLM analysis pipeline
- A **React frontend** with a premium, enterprise-grade UI inspired by Figma, Linear, and Stripe
- **Three analysis levels** — each progressively more autonomous
- **Real-time progress streaming** via WebSocket for long-running L3 jobs
- **Persistent baseline versioning** via SQLite for regression tracking
- **HTML report generation** via Jinja2 templates served as static files
- **Annotated screenshots** with OpenCV bounding boxes colour-coded by severity
- **Docker support** for zero-config deployment

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React + Vite)                   │
│   ┌──────────┐   ┌──────────┐   ┌──────────────────────────┐   │
│   │  Level 1  │   │  Level 2  │   │         Level 3          │   │
│   │  Upload   │   │  Compare  │   │  Monitor + Live Stream   │   │
│   └────┬─────┘   └────┬─────┘   └────────────┬─────────────┘   │
└────────┼──────────────┼──────────────────────┼─────────────────┘
         │  REST POST   │  REST POST            │  WebSocket
┌────────▼──────────────▼──────────────────────▼─────────────────┐
│                     FastAPI Application                         │
│                                                                 │
│   /analyze/l1    /analyze/l2    /monitor/start   /monitor/ws   │
│         │              │               │                        │
│   ┌─────▼──────┐ ┌─────▼──────┐ ┌─────▼──────────────────┐   │
│   │ L1 Pipeline│ │ L2 Pipeline│ │    L3 Async Runner      │   │
│   └─────┬──────┘ └─────┬──────┘ └──────────┬─────────────┘   │
└─────────┼──────────────┼───────────────────┼─────────────────┘
          │              │                   │
┌─────────▼──────────────▼───────────────────▼─────────────────┐
│                      Core Engines                             │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │
│  │Extraction│  │Rule      │  │Evidence  │  │Confidence   │  │
│  │(OpenCV)  │  │Engine    │  │Anchor    │  │Scorer       │  │
│  └──────────┘  └──────────┘  └──────────┘  └─────────────┘  │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │
│  │Gemini    │  │Fix       │  │Report    │  │Playwright   │  │
│  │Client    │  │Simulator │  │Generator │  │Capture      │  │
│  └──────────┘  └──────────┘  └──────────┘  └─────────────┘  │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              Addons                                   │    │
│  │  Annotation · DesignDNA · PersonaSim · ScoreCard     │    │
│  └──────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────┘
          │
┌─────────▼──────────────────────────────────────────────────┐
│                    Persistence Layer                        │
│                                                             │
│   baselines/  (SQLite DB + versioned PNGs)                 │
│   captures/   (Playwright screenshots)                     │
│   reports/    (HTML reports + annotated PNGs)              │
│   evidence/   (Evidence artefacts)                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Level 1 — Single-Page Audit

The L1 pipeline is the core analysis unit. Everything else builds on top of it.

### Pipeline Flow

```
Upload PNG
    │
    ▼
build_ui_state()          ← OpenCV element detection
    │  Detects: buttons, text blocks, images, containers
    │  Extracts: bounding boxes, colours, fonts, spacing
    │
    ▼
run_all_rules()           ← Design rule engine
    │
    ├── contrast.py       WCAG AA/AAA ratio checks
    ├── alignment.py      Grid alignment, left-edge consistency
    ├── hierarchy.py      Font size progression, heading order
    ├── spacing.py        Padding rhythm, margin consistency
    └── consistency.py    Button style uniformity, colour reuse
    │
    ▼
EvidenceAnchor.anchor_all()   ← Pins each finding to pixel coords
    │  Measured value vs required value stored per finding
    │
    ▼
apply_confidence()        ← Scores each finding 0–100%
    │
    ▼
Gemini explanations       ← LLM enrichment (capped at 8 findings)
    │  user_impact · recommendation · current_css · suggested_css
    │
    ▼
simulate_all_fixes()      ← Predicts fix outcome
    │
    ▼
generate_report()
    │
    ├── Annotated PNG     (OpenCV bounding boxes, colour by severity)
    ├── HTML report       (Jinja2 dark-theme template)
    └── JSON Report       (Full Pydantic model serialised)
```

### Design Rules Covered

| Principle | Checks |
|-----------|--------|
| **Contrast** | Text/background WCAG AA (4.5:1 normal, 3:1 large), AAA (7:1) |
| **Alignment** | Element grid snapping, left-edge consistency across siblings |
| **Hierarchy** | Font size step ratios, heading level order, visual weight |
| **Spacing** | Padding uniformity, margin rhythm, proximity grouping |
| **Consistency** | Button variant reuse, colour palette coherence |

### Scoring

Each finding contributes to a deduction from a 100-point base score, weighted by severity:

| Severity | Weight |
|----------|--------|
| Critical | −10 |
| High | −6 |
| Medium | −3 |
| Low | −1 |
| Info | −0.5 |

A final letter grade (A–F) maps to score bands. WCAG pass rate is tracked separately.

### Colour-Blind Persona Simulation

L1 generates five renders of the annotated screenshot:
- **Original**
- **Deuteranopia** (~6% of males) — red-green, green cone deficiency
- **Protanopia** (~2% of males) — red-green, red cone deficiency
- **Tritanopia** (~0.003%) — blue-yellow, blue cone deficiency
- **Achromatopsia** (very rare) — complete colour blindness

---

## Level 2 — Regression Testing

L2 compares two states of the same interface and classifies every detected change.

### Pipeline Flow

```
Upload: before.png + after.png
    │
    ▼
L1 pipeline on both images independently
    │  → before_state (UIState)
    │  → after_state  (UIState)
    │
    ▼
Element matching
    │  Matches elements across states by position + type
    │  Unmatched → added / removed
    │
    ▼
Change extraction per matched pair
    │  Contrast delta · font size delta · spacing delta
    │  Colour shift · alignment drift
    │
    ▼
Change classification
    │
    ├── regression    (WCAG score dropped, contrast reduced, etc.)
    ├── improvement   (score increased, contrast improved)
    └── neutral       (change with no quality impact)
    │
    ▼
Gemini Vision analysis
    │  Summarises the changes in natural language
    │  Provides overall verdict: NET REGRESSION / IMPROVEMENT / NEUTRAL
    │
    ▼
RegressionReport
    ├── before_report  (full L1 Report)
    ├── after_report   (full L1 Report)
    ├── changes[]      (list of classified changes)
    ├── verdict        (string)
    └── HTML diff report
```

---

## Level 3 — Autonomous Monitoring

L3 is the fully autonomous tier. It captures live pages, runs the full analysis pipeline, stores baselines, and detects regressions — without any human input beyond the initial URL + page list.

### Run Flow

```
POST /monitor/start  { url, pages: ["homepage", "/about", "/pricing"] }
    │
    ▼
WebSocket stream opens (/monitor/{run_id}/ws)
    │
    ▼
Phase 1: Browser Capture (Playwright, dedicated thread)
    │  asyncio.ProactorEventLoop conflict on Windows → solved with
    │  asyncio.new_event_loop() per worker thread
    │  Each page: navigate → wait → screenshot PNG
    │
    ▼
Phase 2: Per-page analysis loop
    │
    ├── Copy capture → reports/{run_id}_{page}_capture.png
    │   (stable URL that persists across future runs)
    │
    ├── Check baseline (SQLite lookup)
    │
    ├─ [No baseline] ──────────────────────────────────────────┐
    │   Run full L1 pipeline                                   │
    │   Save baseline to SQLite (screenshot + annotated_url)   │
    │   Emit PageRunResult { run_type: "baseline" }            │
    │   ◄─────────────────────────────────────────────────────┘
    │
    └─ [Baseline exists] ──────────────────────────────────────┐
        Pixel diff score vs baseline                           │
        │                                                      │
        ├─ diff < 0.3% ────────────────────────────────────┐  │
        │   No analysis needed                              │  │
        │   Reuse annotated_url from saved baseline         │  │
        │   Emit PageRunResult { run_type: "no_change" }    │  │
        │   ◄───────────────────────────────────────────────┘  │
        │                                                      │
        └─ diff ≥ 0.3% ─────────────────────────────────────┐ │
            Run regression pipeline (L1 before + after)     │ │
            Classify verdict: regression/improvement/neutral│ │
            Emit PageRunResult { run_type: verdict }        │ │
            ◄───────────────────────────────────────────────┘ │
            ◄──────────────────────────────────────────────────┘
    │
    ▼
Phase 3: L3 HTML Summary Report
    │  Aggregates all PageRunResults + L1 reports
    │  Rendered via Jinja2 template
    │  Saved as reports/l3_{run_id}.html
    │
    ▼
WebSocket "complete" event
    │  Contains report_url, summary string
    └─ Frontend renders full result grid
```

### PageRunResult — Data Contract

Every page emits a `PageRunResult` event over WebSocket as it completes:

```
PageRunResult {
  page            string       Page identifier
  run_type        string       baseline | no_change | regression |
                               improvement | neutral | error
  screenshot_url  string?      Stable per-run capture path
  annotated_url   string?      Annotated PNG from L1 (persisted in baseline)
  html_report_url string?      Per-page L1 HTML report
  score           float?       0–100 design quality score
  grade           string?      A / B / C / D / F
  total_findings  int          Count of all findings
  critical_findings int
  high_findings   int
  medium_findings int
  low_findings    int
  verdict         string?      Regression verdict string
  changes_count   int          Number of detected changes
  message         string?      Human-readable summary
}
```

### Baseline Persistence

- **Storage**: SQLite (`baselines/baselines.db`) + versioned PNG files
- **Schema**: `id · page · screenshot_path · annotated_url · version · approved · report_summary · created_at`
- **Versioning**: each new baseline increments `version` — history is preserved
- **Migration**: `annotated_url` column was added post-initial schema with a safe `ALTER TABLE` migration that no-ops if the column already exists

---

## Frontend Design System

The UI was built as a premium, enterprise-grade product — not a generic Tailwind dashboard. The design language draws from Figma, Linear, Notion, and Stripe.

### Design Principles

- **No pure black** — all surfaces use warm graphite tones
- **No neon glow, no glassmorphism** — clean, flat surfaces with 1px borders
- **Ink-on-paper feel** — typography-first, generous whitespace
- **Sidebar layout** — communicates "desktop application," not a website

### Token System

All visual decisions are encoded as design tokens in `tailwind.config.js`:

```
Surface layers    surface.0 → surface.4    (warm graphite, dark to light)
Text              ink.1 → ink.3            (primary → tertiary)
Borders           edge.1 → edge.3          (subtle → prominent)
Accent            accent.DEFAULT / dim     (muted violet — used sparingly)
Severity          sev.critical / high / medium / low / info / success
```

### Component Architecture

Reusable components defined via plain CSS in `@layer components` (no `@apply` with custom tokens — avoids a known PostCSS resolution issue in Tailwind v3 JIT):

| Class | Purpose |
|-------|---------|
| `.card` | Surface-1 background, edge-2 border, 12px radius |
| `.card-elevated` | Surface-2, same border — for nested elevation |
| `.btn-primary` | Accent-filled CTA button |
| `.btn-secondary` | Surface-2 outlined button |
| `.btn-ghost` | Transparent text button |
| `.badge` + `.badge-{sev}` | Severity pill with tinted background |
| `.label` | 10px ALL CAPS tracking-widest micro-label |
| `.input` | Styled form input with focus ring |
| `.divider` | 1px horizontal rule in edge-1 |

### Page Transitions

`AnimatePresence` wraps all page content with `mode="wait"` — each navigation fades up (opacity 0→1, translateY 8px→0, 200ms ease-out).

---

## Key Technical Decisions

### 1. Playwright in a dedicated thread pool

FastAPI on Windows uses `asyncio.ProactorEventLoop`, which conflicts with Playwright's subprocess transport. Running Playwright inside `asyncio.new_event_loop()` in a `ThreadPoolExecutor` worker thread completely avoids this. All blocking CV and LLM work follows the same pattern.

```python
_pool = concurrent.futures.ThreadPoolExecutor(max_workers=2, thread_name_prefix="l3")

captures = await loop.run_in_executor(_pool, _capture_in_thread, config)
```

### 2. Stable screenshot URLs across runs

Playwright writes `{page}_latest.png` to `captures/` — overwritten on every run. To give each run a permanent, addressable screenshot, captures are immediately copied to `reports/{run_id}_{page}_capture.png` at the start of each page's analysis. This URL is what the frontend stores and displays.

### 3. In-memory report objects for HTML generation

L3 collects `(PageRunResult, Report | None)` tuples in memory throughout the run, then passes them directly to Jinja2 at the end. This avoids a second read from disk and keeps the HTML report generator stateless.

### 4. Gemini enrichment capped at 8 findings per page

The Gemini API has per-minute rate limits. To stay within them during L3 multi-page runs (which run L1 on all pages), Gemini explanations are requested only for the first 8 findings by severity. The remaining findings retain all rule-engine data but no LLM narrative.

### 5. Annotated URL persisted in baseline for no-change pages

On a no-change run, no L1 analysis is performed — but the user still expects to see annotations. The annotated screenshot path from the original baseline L1 run is now stored in the `baselines` table. On no-change pages, this stored path is reused and the `PageRunResult.annotated_url` is populated from it.

---

## Challenges & Solutions

| Challenge | Solution |
|-----------|----------|
| Windows `ProactorEventLoop` crash with Playwright inside FastAPI | Dedicated `ThreadPoolExecutor` with `asyncio.new_event_loop()` per thread |
| Screenshot URLs breaking between runs (`_latest.png` overwritten) | Copy-on-run to `reports/{run_id}_{page}_capture.png` at capture time |
| `@apply bg-surface-1` failing in Tailwind v3 JIT (`@layer components`) | Replaced all `@apply` with custom tokens → direct CSS declarations |
| No annotations showing on "NO CHANGE" L3 pages | Added `annotated_url` column to `BaselineStore`; persist on baseline save, reuse on no-change |
| Gemini API rate limits during multi-page L3 run | Hard cap of 8 Gemini calls per page; rest use rule-engine data only |
| Existing SQLite DB missing new `annotated_url` column | Inline `ALTER TABLE baselines ADD COLUMN annotated_url VARCHAR` migration in `_get_engine()`, wrapped in try/except to no-op if already present |
| Jinja2 template field mismatches (`finding.location` vs `finding.location.description`) | All template data flows through `model_dump()` → dict access; field names audited against Pydantic models |

---

## Deliverables

### Backend
- [x] L1 single-page audit pipeline (CV + rules + evidence + confidence + Gemini + annotation + reports)
- [x] L2 regression pipeline (element matching + change classification + Gemini verdict)
- [x] L3 autonomous monitoring runner (Playwright capture + baseline store + WebSocket streaming)
- [x] Jinja2 HTML report templates (per-page L1 reports + L3 summary)
- [x] SQLite baseline store with versioning and annotated_url persistence
- [x] FastAPI REST + WebSocket API
- [x] Docker + docker-compose

### Frontend
- [x] L1 page — upload → real-time progress → findings → score → annotated viewer → export
- [x] L2 page — dual upload → diff → regression verdict → change list → before/after viewer
- [x] L3 page — URL input → live page cards → per-page results → L3 report link
- [x] Premium design system — custom token palette, `@layer components`, Framer Motion transitions
- [x] All components: FindingCard, ScoreCard, AnnotatedViewer, UploadZone, ProgressBar, ReportExport

### Infrastructure
- [x] `.gitignore` covering Python, Node, env files, build artefacts, generated reports
- [x] `setup.bat` / `start_backend.bat` / `start_frontend.bat` for Windows one-click setup
- [x] `README.md` with full setup, API reference, architecture notes

---

## What I Would Do Next

Given more time, the next priorities would be:

1. **Scheduled monitoring** — cron-based L3 runs with email/Slack alerts on regression detection
2. **Baseline approval workflow** — UI for a designer to review and approve/reject proposed new baselines before they replace the current one
3. **Design token extraction** — parse CSS/Tailwind config from the live site and audit against the detected token usage
4. **Multi-device capture** — run Playwright at mobile (375px), tablet (768px), and desktop (1440px) breakpoints and audit each independently
5. **Historical trend charts** — per-page quality score over time (the version history is already in SQLite)
6. **Figma comparison** — given a Figma file URL, compare the implementation screenshot against the design spec directly
7. **CI/CD integration** — GitHub Actions step that runs L2 on PR screenshots and posts a finding summary as a PR comment

---

*Built as part of the Aivar engineering hiring challenge.*
