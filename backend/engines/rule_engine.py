"""Orchestrate all 5 rule analyzers into a single findings list."""
import uuid
from schemas import UIState, Finding
from engines.rules.contrast import analyze_contrast
from engines.rules.spacing import analyze_spacing
from engines.rules.alignment import analyze_alignment
from engines.rules.hierarchy import analyze_hierarchy
from engines.rules.consistency import analyze_consistency


def run_all_rules(ui_state: UIState) -> list[Finding]:
    run_id = ui_state.run_id
    findings: list[Finding] = []
    elements = ui_state.elements

    # Per-element rules
    for element in elements:
        f = analyze_contrast(element, run_id)
        if f:
            findings.append(f)

    # Multi-element rules
    findings.extend(analyze_spacing(elements, run_id))
    findings.extend(analyze_alignment(elements, run_id))
    findings.extend(analyze_hierarchy(elements, run_id))
    findings.extend(analyze_consistency(elements, run_id))

    # Assign sequential IDs and run_id
    seen_ids: set[str] = set()
    deduped: list[Finding] = []
    for i, f in enumerate(findings):
        f.run_id = run_id
        base_id = f.finding_id or f"F{i+1:03d}"
        if base_id in seen_ids:
            base_id = f"{base_id}_{uuid.uuid4().hex[:4]}"
        f.finding_id = base_id
        seen_ids.add(base_id)
        deduped.append(f)

    # Sort: critical first
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
    deduped.sort(key=lambda f: severity_order.get(f.severity.value if hasattr(f.severity, 'value') else f.severity, 5))

    return deduped
