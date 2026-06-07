"""FastAPI application — Design Audit Agent API."""
import os
import sys
import uuid
import json
import asyncio
import tempfile
from pathlib import Path
from typing import AsyncGenerator

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

# Ensure backend dir is on path
sys.path.insert(0, str(Path(__file__).parent))

from config import settings
from schemas import (
    Report, RegressionReport, SiteConfig, MonitorRunStatus,
    ProgressEvent, Finding, PageRunResult,
)

# ── App Setup ──────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Design Audit Agent",
    description="Automated UI/UX quality analysis — L1 single page, L2 regression, L3 autonomous monitoring",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve reports and captures as static files
reports_dir = Path(settings.reports_dir)
reports_dir.mkdir(parents=True, exist_ok=True)
app.mount("/reports", StaticFiles(directory=str(reports_dir)), name="reports")

captures_dir = Path(settings.captures_dir)
captures_dir.mkdir(parents=True, exist_ok=True)
app.mount("/captures", StaticFiles(directory=str(captures_dir)), name="captures")

# In-memory run tracker for L3
_runs: dict[str, MonitorRunStatus] = {}
_run_queues: dict[str, asyncio.Queue] = {}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _save_upload(file_bytes: bytes, suffix: str = ".png") -> str:
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix, dir=settings.captures_dir)
    tmp.write(file_bytes)
    tmp.close()
    return tmp.name


async def _emit(run_id: str, event: ProgressEvent):
    q = _run_queues.get(run_id)
    if q:
        await q.put(event.model_dump())


def _run_l1_pipeline(image_path: str, image_bytes: bytes, page_id: str = "page") -> Report:
    """Full Level 1 pipeline — synchronous, called from thread pool."""
    import gemini_client
    from engines.extraction import build_ui_state
    from engines.rule_engine import run_all_rules
    from engines.evidence import EvidenceAnchor
    from engines.confidence import apply_confidence
    from addons.fix_simulator import simulate_all_fixes
    from engines.report_generator import generate_report
    from prompts.explanation import build_explanation_prompt

    run_id = f"run_{uuid.uuid4().hex[:12]}"

    # 1. Extract UIState
    ui_state = build_ui_state(image_path, image_bytes, run_id, page_id=page_id, level=1)

    # 2. Run rules
    findings = run_all_rules(ui_state)

    # 3. Evidence anchoring
    img_np = cv2.imread(image_path)
    anchor = EvidenceAnchor()
    findings = anchor.anchor_all(findings, img_np, ui_state)

    # 4. Apply confidence
    findings = apply_confidence(findings)

    # 5. Gemini UX explanations (best-effort)
    for finding in findings[:10]:  # Cap at 10 to avoid rate limits
        try:
            prompt = build_explanation_prompt(finding)
            raw = gemini_client.ask_text(prompt)
            raw = raw.strip().lstrip("```json").rstrip("```").strip()
            data = json.loads(raw)
            finding.user_impact = data.get("user_impact")
            if data.get("action"):
                from schemas import Recommendation
                finding.recommendation = Recommendation(
                    action=data.get("action"),
                    current_css=data.get("current_css"),
                    suggested_css=data.get("suggested_css"),
                    result=data.get("result"),
                )
        except Exception:
            pass

    # 6. Fix simulation for remaining
    findings = simulate_all_fixes(findings)

    # 7. Generate report
    report = generate_report(ui_state, findings, img_np)
    return report


# ── Level 1 ───────────────────────────────────────────────────────────────────

@app.post("/analyze/level1", response_model=Report, tags=["Level 1"])
async def analyze_level1(file: UploadFile = File(...)):
    """Upload a screenshot and get a full design audit report."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "File must be an image (PNG, JPG, WebP)")

    image_bytes = await file.read()
    suffix = Path(file.filename or "upload.png").suffix or ".png"
    image_path = _save_upload(image_bytes, suffix)

    try:
        loop = asyncio.get_event_loop()
        page_id = Path(file.filename or "page").stem
        report = await loop.run_in_executor(
            None, _run_l1_pipeline, image_path, image_bytes, page_id
        )
        return report
    except Exception as e:
        raise HTTPException(500, f"Analysis failed: {str(e)}")
    finally:
        try:
            os.unlink(image_path)
        except Exception:
            pass


# ── Level 2 ───────────────────────────────────────────────────────────────────

@app.post("/analyze/level2", response_model=RegressionReport, tags=["Level 2"])
async def analyze_level2(
    before: UploadFile = File(...),
    after: UploadFile = File(...),
):
    """Compare before/after screenshots to detect design regressions."""
    before_bytes = await before.read()
    after_bytes = await after.read()

    before_path = _save_upload(before_bytes, ".png")
    after_path = _save_upload(after_bytes, ".png")

    try:
        loop = asyncio.get_event_loop()

        def _run():
            from engines.regression import run_regression_pipeline
            return run_regression_pipeline(before_path, before_bytes, after_path, after_bytes)

        report = await loop.run_in_executor(None, _run)
        return report
    except Exception as e:
        raise HTTPException(500, f"Regression analysis failed: {str(e)}")
    finally:
        for p in [before_path, after_path]:
            try:
                os.unlink(p)
            except Exception:
                pass


# ── Level 3 ───────────────────────────────────────────────────────────────────

@app.post("/monitor/start", tags=["Level 3"])
async def monitor_start(config: SiteConfig, background_tasks: BackgroundTasks):
    """Start an autonomous monitoring run against a live site."""
    run_id = f"l3_{uuid.uuid4().hex[:10]}"
    status = MonitorRunStatus(
        run_id=run_id,
        total_pages=len(config.pages),
    )
    _runs[run_id] = status
    _run_queues[run_id] = asyncio.Queue()

    background_tasks.add_task(_run_level3, run_id, config)
    return {"run_id": run_id, "status": "started", "total_pages": len(config.pages)}


@app.get("/monitor/status/{run_id}", tags=["Level 3"])
async def monitor_status(run_id: str):
    status = _runs.get(run_id)
    if not status:
        raise HTTPException(404, f"Run {run_id} not found")
    return status


@app.post("/baseline/refresh/{page_name}", tags=["Level 3"])
async def baseline_refresh(page_name: str):
    """Approve current capture as the new baseline for a page."""
    from baseline.store import BaselineStore
    store = BaselineStore()
    result = store.refresh(page_name)
    if result:
        return {"success": True, "page": page_name, "new_version": result.version}
    raise HTTPException(404, f"No capture found for page: {page_name}")


async def _run_level3(run_id: str, config: SiteConfig):
    """Background task: autonomous monitoring run."""
    from engines.level3_runner import run_level3_async
    try:
        await run_level3_async(run_id, config, _runs, _run_queues)
    except Exception as e:
        status = _runs.get(run_id)
        if status:
            status.status = f"error: {str(e)}"


# ── WebSocket ─────────────────────────────────────────────────────────────────

@app.websocket("/ws/{run_id}")
async def websocket_progress(websocket: WebSocket, run_id: str):
    """Stream real-time progress events for a run."""
    await websocket.accept()
    q = _run_queues.get(run_id)
    if not q:
        await websocket.send_json({"event": "error", "message": f"Run {run_id} not found"})
        await websocket.close()
        return
    try:
        while True:
            try:
                event = await asyncio.wait_for(q.get(), timeout=30.0)
                await websocket.send_json(event)
                if event.get("event") == "complete":
                    break
            except asyncio.TimeoutError:
                await websocket.send_json({"event": "ping"})
    except WebSocketDisconnect:
        pass


# ── Health / Root ─────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
async def root():
    return {
        "service": "Design Audit Agent",
        "version": "1.0.0",
        "levels": ["L1 /analyze/level1", "L2 /analyze/level2", "L3 /monitor/start"],
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
