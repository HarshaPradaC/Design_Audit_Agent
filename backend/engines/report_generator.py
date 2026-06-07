"""Assemble final Report and RegressionReport objects, generate HTML."""
import uuid
import json
from pathlib import Path
from datetime import datetime
from jinja2 import Environment, FileSystemLoader
from schemas import (
    Report, ReportSummary, ScoreCard, Finding, UIState,
    RegressionReport, ChangeObject, DesignDNA,
)
from addons.score_card import compute_score, build_summary_stats
from addons.design_dna import extract_design_dna
from addons.annotation import annotate_screenshot, save_annotated
from addons.persona_sim import generate_persona_images
from config import settings


def _load_template():
    template_dir = Path(__file__).parent.parent / "templates"
    env = Environment(loader=FileSystemLoader(str(template_dir)))
    return env.get_template("report.html")


def _load_l3_template():
    template_dir = Path(__file__).parent.parent / "templates"
    env = Environment(loader=FileSystemLoader(str(template_dir)))
    return env.get_template("l3_report.html")


def generate_report(
    ui_state: UIState,
    findings: list[Finding],
    image_np,
    include_personas: bool = True,
) -> Report:
    run_id = ui_state.run_id
    report_id = f"RPT_{run_id}"

    score_card = compute_score(findings)
    stats = build_summary_stats(findings)
    design_dna = extract_design_dna(ui_state)

    # Annotated screenshot
    annotated = annotate_screenshot(image_np, findings)
    annotated_path = save_annotated(annotated, run_id)

    # Persona simulations
    persona_images = {}
    if include_personas:
        try:
            persona_images = generate_persona_images(image_np, run_id)
        except Exception as e:
            print(f"[report] Persona generation failed: {e}")

    # WCAG pass rate
    contrast_findings = [f for f in findings if f.principle == "Contrast"]
    total_els = ui_state.page_metadata.total_elements_detected or 1
    failed = len(contrast_findings)
    pass_rate = f"{max(0, 100 - int(failed / total_els * 100))}%"

    summary = ReportSummary(
        total_findings=stats["total_findings"],
        critical=stats["critical"],
        high=stats["high"],
        medium=stats["medium"],
        low=stats["low"],
        info=stats["info"],
        overall_score=score_card.overall_score,
        grade=score_card.overall_grade,
        wcag_aa_pass_rate=pass_rate,
    )

    report = Report(
        report_id=report_id,
        agent_level=ui_state.level,
        page_analyzed=ui_state.page_id,
        summary=summary,
        score_breakdown=score_card,
        design_dna=design_dna,
        findings=findings,
        annotated_screenshot=annotated_path,
        persona_images=persona_images if persona_images else None,
    )

    # Save JSON
    json_path = Path(settings.reports_dir) / f"{report_id}.json"
    with open(json_path, "w", encoding="utf-8") as f:
        f.write(report.model_dump_json(indent=2))

    # Render HTML
    try:
        template = _load_template()
        html = template.render(report=report, findings=findings, score_card=score_card)
        html_path = Path(settings.reports_dir) / f"{report_id}.html"
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html)
        report.html_report = f"{report_id}.html"  # filename only — served via /reports/<filename>
    except Exception as e:
        print(f"[report] HTML render failed: {e}")

    return report


def generate_l3_html_report(
    run_id: str,
    page_data: list,
    site_url: str = "",
    generated_at: str = "",
) -> str:
    """Generate L3 monitoring run summary HTML. Returns filename (served via /reports/)."""
    enriched = []
    for pr, report in page_data:
        l1_data = None
        if report is not None:
            try:
                l1_data = report.model_dump()
            except Exception:
                pass
        enriched.append({
            "page_result": pr.model_dump() if hasattr(pr, "model_dump") else pr,
            "l1_report": l1_data,
        })

    try:
        template = _load_l3_template()
        html = template.render(
            run_id=run_id,
            site_url=site_url,
            generated_at=generated_at,
            page_data=enriched,
        )
        filename = f"l3_{run_id}.html"
        path = Path(settings.reports_dir) / filename
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)
        return filename
    except Exception as e:
        print(f"[l3_report] HTML generation failed: {e}")
        return ""


def generate_regression_report(
    before_report: Report,
    after_report: Report,
    changes: list[ChangeObject],
) -> RegressionReport:
    run_id = f"L2_{uuid.uuid4().hex[:8]}"
    report_id = f"RPT_{run_id}"

    regressions = sum(1 for c in changes if c.classification.value == "regression")
    improvements = sum(1 for c in changes if c.classification.value == "improvement")
    verdict = "NET REGRESSION" if regressions > improvements else (
        "NET IMPROVEMENT" if improvements > regressions else "NEUTRAL"
    )

    report = RegressionReport(
        report_id=report_id,
        before_page=before_report.page_analyzed,
        after_page=after_report.page_analyzed,
        changes=changes,
        net_regressions=regressions,
        net_improvements=improvements,
        verdict=verdict,
        before_report=before_report,
        after_report=after_report,
        before_annotated=before_report.annotated_screenshot,
        after_annotated=after_report.annotated_screenshot,
    )

    json_path = Path(settings.reports_dir) / f"{report_id}.json"
    with open(json_path, "w", encoding="utf-8") as f:
        f.write(report.model_dump_json(indent=2))

    return report
