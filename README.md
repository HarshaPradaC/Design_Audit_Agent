# Design Audit Agent

An automated UI/UX quality analysis platform powered by computer vision and Google Gemini. Upload a screenshot or point it at a live site — it extracts UI elements, runs design rules, scores against accessibility standards, and generates annotated reports with actionable fix suggestions.

---

## What it does

The agent operates at three levels of depth:

| Level | Name | What it does |
|-------|------|--------------|
| **L1** | Single-page audit | Upload a screenshot → extract UI elements → run design rules → score → annotate → HTML + JSON report |
| **L2** | Regression testing | Compare two screenshots (before/after) → detect design regressions and improvements → diff report |
| **L3** | Autonomous monitoring | Point at a live URL → capture multiple pages → L1 audit on first run → pixel-diff on subsequent runs → regression analysis on changes → full HTML summary |

---

## Features

- **Design rule engine** — checks contrast ratios (WCAG AA/AAA), alignment grids, typographic hierarchy, spacing consistency, colour harmony
- **Gemini Vision integration** — LLM-powered explanations, user impact statements, and CSS fix suggestions per finding
- **Evidence anchoring** — every finding is linked to exact pixel coordinates and measured values
- **Confidence scoring** — each finding carries a 0–100% confidence score
- **Fix simulation** — predicts the visual outcome of applying each recommended fix
- **Colour-blind personas** — simulates Deuteranopia, Protanopia, Tritanopia, Achromatopsia
- **Annotated screenshots** — OpenCV bounding boxes colour-coded by severity
- **HTML reports** — dark-theme, self-contained reports viewable in any browser
- **Baseline versioning** — SQLite-backed store with version history and approval state
- **Real-time WebSocket progress** — L3 runs stream per-page results as they complete

---

## Tech stack

**Backend**
- Python 3.12, FastAPI 0.111, Uvicorn
- OpenCV (element extraction + annotation), Playwright (headless browser capture)
- Google Generative AI SDK (Gemini 1.5 Pro)
- SQLAlchemy 2 + SQLite (baseline store)
- Pydantic v2, Jinja2

**Frontend**
- React 18, Vite 5, Tailwind CSS v3 (JIT)
- Framer Motion (page transitions, expand animations)
- Zustand (state management), Recharts (score visualisation)

---

## Project structure

```
Design_Audit_Agent/
├── backend/
│   ├── engines/
│   │   ├── rules/          # Contrast, alignment, spacing, hierarchy, consistency
│   │   ├── capture.py      # Playwright multi-page capture
│   │   ├── extraction.py   # CV element detection → UIState
│   │   ├── rule_engine.py  # Applies all rules, returns findings
│   │   ├── evidence.py     # Anchors findings to pixel evidence
│   │   ├── confidence.py   # Scores each finding 0–100
│   │   ├── regression.py   # Before/after diff pipeline
│   │   ├── report_generator.py  # HTML + annotated PNG output
│   │   └── level3_runner.py     # Async L3 orchestration
│   ├── addons/
│   │   ├── annotation.py   # OpenCV drawing
│   │   ├── design_dna.py   # Colour palette extraction
│   │   ├── fix_simulator.py
│   │   ├── persona_sim.py  # Colour-blind simulation
│   │   └── score_card.py
│   ├── baseline/
│   │   └── store.py        # SQLite baseline CRUD
│   ├── prompts/            # Gemini prompt builders
│   ├── templates/          # Jinja2 HTML report templates
│   ├── tests/
│   ├── main.py             # FastAPI app, routes, WebSocket
│   ├── schemas.py          # All Pydantic models
│   ├── config.py           # Settings (reads .env)
│   └── gemini_client.py
├── frontend/
│   └── src/
│       ├── pages/          # Level1.jsx, Level2.jsx, Level3.jsx
│       ├── components/     # FindingCard, ScoreCard, AnnotatedViewer, …
│       ├── App.jsx         # Sidebar layout + routing
│       ├── api.js          # Axios wrappers for all endpoints
│       └── store.js        # Zustand global state
├── baselines/              # Versioned baseline PNGs + SQLite DB
├── captures/               # Latest Playwright captures
├── reports/                # Generated HTML + annotated PNG reports
├── docker-compose.yml
├── Dockerfile
├── setup.bat               # One-click Windows setup
├── start_backend.bat
└── start_frontend.bat
```

---

## Quick start (local)

### Prerequisites
- Python 3.12+
- Node.js 18+
- Google Gemini API key ([get one here](https://aistudio.google.com/app/apikey))

### 1. Backend

```bash
cd backend
python -m venv ../venv
# Windows:
..\venv\Scripts\activate
# macOS/Linux:
source ../venv/bin/activate

pip install -r requirements.txt
playwright install chromium

# Create .env
echo GEMINI_API_KEY=your_key_here > .env

uvicorn main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. The backend runs on **http://localhost:8000**.

### Windows one-click

```
setup.bat          # install deps + playwright
start_backend.bat  # starts uvicorn
start_frontend.bat # starts vite dev server
```

---

## Docker

```bash
# Copy your API key into the environment first
echo GEMINI_API_KEY=your_key_here > backend/.env

docker-compose up --build
```

- Frontend → http://localhost:5173
- Backend API → http://localhost:8000
- API docs → http://localhost:8000/docs

---

## Configuration

All settings are read from `backend/.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | *(required)* | Google Generative AI key |
| `baseline_dir` | `../baselines` | Where baseline PNGs + DB are stored |
| `captures_dir` | `../captures` | Playwright output directory |
| `reports_dir` | `../reports` | HTML + annotated PNG output |
| `evidence_dir` | `../evidence` | Evidence artefacts |
| `site_username` | *(optional)* | HTTP basic auth for captured sites |
| `site_password` | *(optional)* | HTTP basic auth for captured sites |

---

## API reference

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/analyze/l1` | Upload PNG → L1 audit, returns `Report` |
| `POST` | `/analyze/l2` | Upload before + after PNGs → regression `RegressionReport` |
| `POST` | `/monitor/start` | Start L3 run with `SiteConfig`, returns `run_id` |
| `GET`  | `/monitor/{run_id}` | Poll run status + page results |
| `WS`   | `/monitor/{run_id}/ws` | Stream real-time `ProgressEvent` objects |
| `GET`  | `/reports/{filename}` | Serve generated HTML / PNG report |
| `GET`  | `/captures/{filename}` | Serve raw capture screenshots |

Full interactive docs at **http://localhost:8000/docs**.

---

## L3 monitoring — how it works

```
First run:
  URL → Playwright captures N pages
  → L1 full audit per page (CV extraction + rules + Gemini explanations)
  → Baseline saved to SQLite (screenshot + annotated_url)
  → HTML summary report generated

Subsequent runs:
  URL → Playwright captures N pages
  → Pixel diff vs baseline per page
    ├─ diff < 0.3% → NO CHANGE  (reuse baseline annotation)
    └─ diff ≥ 0.3% → Regression pipeline
                     → Element matching + change classification
                     → Gemini Vision analysis
                     → NET REGRESSION / IMPROVEMENT / NEUTRAL verdict
  → Updated HTML summary report
```

Real-time progress is streamed over WebSocket — the frontend updates each page card as results arrive.

---

## Design rule coverage

| Principle | Rules checked |
|-----------|---------------|
| **Contrast** | Text/background WCAG AA (4.5:1 normal, 3:1 large), WCAG AAA |
| **Alignment** | Element grid alignment, left-edge consistency |
| **Hierarchy** | Font size progression, heading order, visual weight |
| **Spacing** | Padding consistency, margin rhythm, proximity grouping |
| **Consistency** | Button style uniformity, colour token reuse |

---

## Running tests

```bash
cd backend
pytest tests/ -v
```
