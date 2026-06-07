"""Level 3 autonomous monitoring runner."""
import asyncio
import functools
import concurrent.futures
import shutil
import cv2
from pathlib import Path
from schemas import SiteConfig, MonitorRunStatus, ProgressEvent, PageRunResult
from baseline.store import BaselineStore
from config import settings

# Dedicated thread pool — keeps blocking work off the FastAPI event loop
_pool = concurrent.futures.ThreadPoolExecutor(max_workers=2, thread_name_prefix="l3")


def _capture_in_thread(config: SiteConfig) -> list:
    """Run Playwright inside a worker thread with its OWN event loop.

    FastAPI uses asyncio.ProactorEventLoop on Windows by default, which
    conflicts with Playwright's subprocess transport. Running Playwright in a
    fresh thread with asyncio.new_event_loop() avoids the hang.
    """
    import asyncio
    from engines.capture import run_capture_session

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(run_capture_session(config))
    except Exception as e:
        print(f"[l3/capture_thread] Error: {e}")
        return []
    finally:
        loop.close()


def _l1_in_thread(capture_path: str, image_bytes: bytes, page_id: str, run_prefix: str):
    """Run full L1 pipeline in a worker thread. Returns Report (no persona images)."""
    import uuid, json, cv2
    import gemini_client
    from engines.extraction import build_ui_state
    from engines.rule_engine import run_all_rules
    from engines.evidence import EvidenceAnchor
    from engines.confidence import apply_confidence
    from addons.fix_simulator import simulate_all_fixes
    from engines.report_generator import generate_report
    from prompts.explanation import build_explanation_prompt
    from schemas import Recommendation

    run_id = f"{run_prefix}_{uuid.uuid4().hex[:8]}"
    ui_state = build_ui_state(capture_path, image_bytes, run_id, page_id=page_id, level=3)
    findings = run_all_rules(ui_state)
    img_np = cv2.imread(capture_path)
    anchor = EvidenceAnchor()
    findings = anchor.anchor_all(findings, img_np, ui_state)
    findings = apply_confidence(findings)

    # Gemini explanations — capped at 8 to stay within rate limits
    for finding in findings[:8]:
        try:
            prompt = build_explanation_prompt(finding)
            raw = gemini_client.ask_text(prompt)
            raw = raw.strip().lstrip("```json").rstrip("```").strip()
            data = json.loads(raw)
            finding.user_impact = data.get("user_impact")
            if data.get("action"):
                finding.recommendation = Recommendation(
                    action=data.get("action"),
                    current_css=data.get("current_css"),
                    suggested_css=data.get("suggested_css"),
                    result=data.get("result"),
                )
        except Exception:
            pass

    findings = simulate_all_fixes(findings)
    return generate_report(ui_state, findings, img_np, include_personas=False)


def _regression_in_thread(
    baseline_path: str,
    baseline_bytes: bytes,
    capture_path: str,
    capture_bytes: bytes,
):
    """Run blocking regression pipeline in a worker thread."""
    from engines.regression import run_regression_pipeline
    return run_regression_pipeline(baseline_path, baseline_bytes, capture_path, capture_bytes)


def _copy_capture_to_reports(capture_path: str, run_id: str, page_name: str) -> str:
    """Copy {page}_latest.png to reports/{run_id}_{page}_capture.png. Returns filename."""
    filename = f"{run_id}_{page_name}_capture.png"
    dest = Path(settings.reports_dir) / filename
    try:
        shutil.copy2(capture_path, str(dest))
        return filename
    except Exception as e:
        print(f"[l3] Could not copy capture to reports/: {e}")
        return ""


async def run_level3_async(
    run_id: str,
    config: SiteConfig,
    runs: dict,
    queues: dict,
):
    """Full L3 monitoring run: capture → L1/regression per page → L3 HTML report."""
    status: MonitorRunStatus = runs[run_id]
    q = queues.get(run_id)
    store = BaselineStore()
    loop = asyncio.get_running_loop()
    l3_page_data = []  # (PageRunResult, Report | None) — collected for HTML report

    async def emit(
        event: str,
        stage: str = "",
        percent: int = 0,
        message: str = "",
        report_url: str = "",
        page_result: PageRunResult = None,
    ):
        evt = ProgressEvent(
            event=event,
            stage=stage,
            percent=percent,
            message=message,
            report_url=report_url or None,
            page_result=page_result,
        )
        if q:
            await q.put(evt.model_dump())

    # ─── Phase 1: Browser Capture ─────────────────────────────────────────────

    await emit("progress", "Launching browser", 5,
               f"Opening {config.url} — capturing {len(config.pages)} page(s)")

    try:
        captures = await asyncio.wait_for(
            loop.run_in_executor(_pool, _capture_in_thread, config),
            timeout=120.0,
        )
    except asyncio.TimeoutError:
        msg = "Browser capture timed out (120 s). Check that the URL is reachable."
        await emit("error", "Capture timeout", 5, msg)
        status.status = "error: capture timeout"
        return
    except Exception as e:
        await emit("error", "Capture failed", 5, str(e))
        status.status = f"error: {e}"
        return

    if not captures:
        msg = (
            "No pages captured. Possible causes:\n"
            "• URL unreachable from this machine\n"
            "• SSL certificate error\n"
            "• Playwright chromium not installed (run: playwright install chromium)"
        )
        await emit("error", "No captures", 5, msg)
        status.status = "error: no captures"
        return

    await emit("progress", f"Browser closed — {len(captures)} page(s) captured", 15,
               "Starting design analysis…")
    status.status = "analyzing"
    total = len(captures)

    # ─── Phase 2: Per-page analysis ───────────────────────────────────────────

    for i, capture in enumerate(captures):
        page_name = capture.page_name
        base_pct = 15 + int((i / total) * 75)

        # Copy capture PNG to reports/ for stable per-run URL
        screenshot_filename = _copy_capture_to_reports(capture.screenshot_path, run_id, page_name)

        await emit("progress", f"Checking baseline — {page_name}", base_pct,
                   f"Page {i + 1} of {total}")

        baseline = store.get(page_name)

        # ── First run: L1 audit + save baseline ──────────────────────────────

        if baseline is None:
            await emit("progress", f"Running L1 audit — {page_name}", base_pct + 2,
                       "First run: analyzing design quality…")

            l1_report = None
            pr = PageRunResult(
                page=page_name,
                run_type="baseline",
                screenshot_url=screenshot_filename or None,
                message="Baseline saved. Run again to detect regressions.",
            )

            try:
                l1_report = await asyncio.wait_for(
                    loop.run_in_executor(
                        _pool,
                        functools.partial(
                            _l1_in_thread,
                            capture.screenshot_path,
                            capture.image_bytes,
                            page_name,
                            run_id,
                        ),
                    ),
                    timeout=120.0,
                )
                pr.annotated_url = l1_report.annotated_screenshot
                pr.html_report_url = l1_report.html_report
                pr.l1_report_id = l1_report.report_id
                pr.score = l1_report.summary.overall_score
                pr.grade = l1_report.summary.grade
                pr.total_findings = l1_report.summary.total_findings
                pr.critical_findings = l1_report.summary.critical
                pr.high_findings = l1_report.summary.high
                pr.medium_findings = l1_report.summary.medium
                pr.low_findings = l1_report.summary.low
                pr.message = (
                    f"Baseline saved · {pr.total_findings} finding(s) · "
                    f"Score {pr.score:.0f}/100 {pr.grade}"
                )
            except asyncio.TimeoutError:
                pr.message = "L1 analysis timed out — baseline saved without full audit"
                print(f"[l3] L1 timeout on {page_name}")
            except Exception as e:
                pr.message = f"L1 error: {e} — baseline saved"
                print(f"[l3] L1 error on {page_name}: {e}")

            store.save(page_name, capture.image_bytes, annotated_url=pr.annotated_url)
            status.pages_processed += 1
            status.page_results.append(pr)
            l3_page_data.append((pr, l1_report))

            await emit(
                "progress",
                f"Baseline created — {page_name}",
                base_pct + 8,
                pr.message,
                page_result=pr,
            )
            continue

        # ── Subsequent run: pixel diff → regression ───────────────────────────

        await emit("progress", f"Comparing with baseline — {page_name}",
                   base_pct + 2, "Running pixel diff…")

        baseline_np = cv2.imread(baseline.screenshot_path)
        current_np  = cv2.imread(capture.screenshot_path)

        if baseline_np is not None and current_np is not None:
            from engines.dynamic_filter import DynamicContentFilter
            diff_score = DynamicContentFilter().pixel_diff_score(baseline_np, current_np)
            if diff_score < 0.003:
                pr = PageRunResult(
                    page=page_name,
                    run_type="no_change",
                    screenshot_url=screenshot_filename or None,
                    annotated_url=baseline.annotated_url,  # reuse baseline L1 annotation
                    message="Design unchanged since last baseline",
                )
                status.pages_processed += 1
                status.page_results.append(pr)
                l3_page_data.append((pr, None))
                await emit(
                    "progress",
                    f"No change — {page_name}",
                    base_pct + 6,
                    "Pixel diff below threshold — design unchanged",
                    page_result=pr,
                )
                continue

        # Load baseline bytes for regression
        try:
            with open(baseline.screenshot_path, "rb") as f:
                baseline_bytes = f.read()
        except OSError as e:
            await emit("progress", f"Baseline read error — {page_name}", base_pct + 3, str(e))
            continue

        await emit("progress", f"Running regression analysis — {page_name}",
                   base_pct + 4,
                   "Extracting UI elements, matching, calling Gemini Vision…")

        try:
            reg_report = await asyncio.wait_for(
                loop.run_in_executor(
                    _pool,
                    functools.partial(
                        _regression_in_thread,
                        baseline.screenshot_path,
                        baseline_bytes,
                        capture.screenshot_path,
                        capture.image_bytes,
                    ),
                ),
                timeout=180.0,
            )

            status.findings_count += len(reg_report.changes)
            status.page_reports[page_name] = reg_report.report_id

            verdict = reg_report.verdict  # NET REGRESSION / NET IMPROVEMENT / NEUTRAL
            run_type = (
                "regression"  if "REGRESSION"  in verdict else
                "improvement" if "IMPROVEMENT" in verdict else
                "neutral"
            )

            after = reg_report.after_report
            pr = PageRunResult(
                page=page_name,
                run_type=run_type,
                screenshot_url=screenshot_filename or None,
                annotated_url=after.annotated_screenshot if after else None,
                html_report_url=after.html_report if after else None,
                l1_report_id=after.report_id if after else None,
                regression_report_id=reg_report.report_id,
                score=after.summary.overall_score if after else None,
                grade=after.summary.grade if after else None,
                total_findings=after.summary.total_findings if after else 0,
                critical_findings=after.summary.critical if after else 0,
                high_findings=after.summary.high if after else 0,
                medium_findings=after.summary.medium if after else 0,
                low_findings=after.summary.low if after else 0,
                verdict=verdict,
                changes_count=len(reg_report.changes),
                message=f"{len(reg_report.changes)} change(s) — {verdict}",
            )

            status.page_results.append(pr)
            l3_page_data.append((pr, after))

            await emit(
                "progress",
                f"{page_name} — {verdict}",
                base_pct + 9,
                f"{len(reg_report.changes)} change(s) detected",
                report_url=reg_report.report_id,
                page_result=pr,
            )

        except asyncio.TimeoutError:
            pr = PageRunResult(
                page=page_name,
                run_type="error",
                screenshot_url=screenshot_filename or None,
                message="Regression analysis timed out (180 s)",
            )
            status.page_results.append(pr)
            l3_page_data.append((pr, None))
            await emit("progress", f"Timeout — {page_name}", base_pct + 6,
                       "Regression analysis timed out (180 s)", page_result=pr)

        except Exception as e:
            print(f"[l3] Regression error on {page_name}: {e}")
            pr = PageRunResult(
                page=page_name,
                run_type="error",
                screenshot_url=screenshot_filename or None,
                message=str(e),
            )
            status.page_results.append(pr)
            l3_page_data.append((pr, None))
            await emit("progress", f"Error — {page_name}", base_pct + 6,
                       str(e), page_result=pr)

        status.pages_processed += 1

    # ─── Phase 3: Generate L3 HTML summary report ─────────────────────────────

    l3_report_filename = ""
    try:
        from engines.report_generator import generate_l3_html_report
        from datetime import datetime
        l3_report_filename = generate_l3_html_report(
            run_id=run_id,
            page_data=l3_page_data,
            site_url=config.url,
            generated_at=datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
        )
        status.l3_report_url = l3_report_filename or None
    except Exception as e:
        print(f"[l3] L3 HTML report generation failed: {e}")

    # ─── Phase 4: Done ────────────────────────────────────────────────────────

    status.status = "complete"
    from datetime import datetime
    status.completed_at = datetime.utcnow()

    regressions  = sum(1 for pr, _ in l3_page_data if pr.run_type == "regression")
    improvements = sum(1 for pr, _ in l3_page_data if pr.run_type == "improvement")
    baselines    = sum(1 for pr, _ in l3_page_data if pr.run_type == "baseline")

    summary = (
        f"{status.pages_processed} page(s) scanned · "
        f"{regressions} regression(s) · {improvements} improvement(s) · "
        f"{baselines} baseline(s) saved"
    )
    await emit("complete", "Monitoring run complete", 100, summary,
               report_url=l3_report_filename)
