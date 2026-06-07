"""Level 2 regression engine — compare before/after UI screenshots."""
import json
import uuid
import re
import cv2
import numpy as np
from schemas import (
    UIState, UIElement, ChangeObject, ChangeValue, ChangeClassification,
    RegressionReport, Severity, BBox,
)
from engines.rules.contrast import contrast_ratio
import gemini_client
from prompts.regression import REGRESSION_PROMPT


def _iou(a: UIElement, b: UIElement) -> float:
    ax1, ay1 = a.bbox.x, a.bbox.y
    ax2, ay2 = ax1 + a.bbox.width, ay1 + a.bbox.height
    bx1, by1 = b.bbox.x, b.bbox.y
    bx2, by2 = bx1 + b.bbox.width, by1 + b.bbox.height

    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    if ix2 <= ix1 or iy2 <= iy1:
        return 0.0

    inter = (ix2 - ix1) * (iy2 - iy1)
    union = (ax2-ax1)*(ay2-ay1) + (bx2-bx1)*(by2-by1) - inter
    return inter / union if union > 0 else 0.0


def match_elements(
    before: UIState, after: UIState
) -> list[tuple[UIElement, UIElement]]:
    """Match elements between before/after by IoU + semantic role similarity."""
    pairs = []
    used_after = set()

    for b_el in before.elements:
        best_score = 0.35
        best_match = None
        best_idx = -1

        for j, a_el in enumerate(after.elements):
            if j in used_after:
                continue
            iou = _iou(b_el, a_el)
            role_bonus = 0.1 if b_el.semantic_role == a_el.semantic_role else 0.0
            type_bonus = 0.05 if b_el.type == a_el.type else 0.0
            score = iou + role_bonus + type_bonus
            if score > best_score:
                best_score = score
                best_match = a_el
                best_idx = j

        if best_match:
            used_after.add(best_idx)
            pairs.append((b_el, best_match))

    return pairs


def classify_change(
    before_el: UIElement,
    after_el: UIElement,
    change_idx: int = 0,
) -> list[ChangeObject]:
    changes = []

    # Color change
    b_bg = before_el.colors.background
    a_bg = after_el.colors.background
    b_text = before_el.colors.text
    a_text = after_el.colors.text

    if b_bg and a_bg and b_bg.lower() != a_bg.lower():
        b_ratio = contrast_ratio(b_text or "#000", b_bg) if b_text else None
        a_ratio = contrast_ratio(a_text or "#000", a_bg) if a_text else None

        direction = ChangeClassification.neutral
        if b_ratio is not None and a_ratio is not None:
            if a_ratio < b_ratio - 0.3:
                direction = ChangeClassification.regression
            elif a_ratio > b_ratio + 0.3:
                direction = ChangeClassification.improvement

        accessibility_regression = (
            a_ratio is not None and b_ratio is not None
            and a_ratio < 4.5 and b_ratio >= 4.5
        )

        severity = Severity.critical if accessibility_regression else (
            Severity.high if direction == ChangeClassification.regression else Severity.medium
        )

        changes.append(ChangeObject(
            change_id=f"C{change_idx:03d}_COLOR",
            type="color_change",
            element_id=before_el.id,
            element_description=f"{before_el.type or 'element'} ({before_el.semantic_role or 'unknown'})",
            location=before_el.bbox,
            before=ChangeValue(value=b_bg, wcag_contrast=b_ratio),
            after=ChangeValue(value=a_bg, wcag_contrast=a_ratio),
            classification=direction,
            reasoning=f"Background changed {b_bg} -> {a_bg}" + (
                f", contrast {b_ratio:.2f}:1 -> {a_ratio:.2f}:1" if b_ratio and a_ratio else ""
            ),
            accessibility_regression=accessibility_regression,
            confidence=92,
            severity=severity,
        ))

    # Size change
    b_w, a_w = before_el.bbox.width, after_el.bbox.width
    if abs(b_w - a_w) > 10:
        delta = a_w - b_w
        direction = (
            ChangeClassification.regression if delta < -20 else (
                ChangeClassification.improvement if delta > 20 else ChangeClassification.neutral
            )
        )
        changes.append(ChangeObject(
            change_id=f"C{change_idx:03d}_SIZE",
            type="size_change",
            element_id=before_el.id,
            element_description=f"{before_el.type or 'element'} width change",
            location=before_el.bbox,
            before=ChangeValue(width_px=b_w),
            after=ChangeValue(width_px=a_w),
            classification=direction,
            reasoning=f"Width changed {b_w}px -> {a_w}px ({'+' if delta > 0 else ''}{delta}px)",
            accessibility_regression=delta < -20,
            confidence=88,
            severity=Severity.medium if abs(delta) > 20 else Severity.low,
        ))

    # Font weight change
    b_fw = before_el.font.weight
    a_fw = after_el.font.weight
    if b_fw and a_fw and b_fw != a_fw:
        direction = (
            ChangeClassification.regression if a_fw < b_fw else ChangeClassification.improvement
        )
        changes.append(ChangeObject(
            change_id=f"C{change_idx:03d}_FONT",
            type="font_change",
            element_id=before_el.id,
            element_description=f"{before_el.type or 'element'} font weight",
            location=before_el.bbox,
            before=ChangeValue(value=b_fw),
            after=ChangeValue(value=a_fw),
            classification=direction,
            reasoning=f"Font weight {b_fw} -> {a_fw}",
            accessibility_regression=a_fw < 400 and b_fw >= 400,
            confidence=85,
            severity=Severity.medium,
        ))

    return changes


def _gemini_diff_changes(before_bytes: bytes, after_bytes: bytes) -> list[ChangeObject]:
    """Call Gemini multi-image comparison for additional changes."""
    try:
        raw = gemini_client.ask_vision_compare(before_bytes, after_bytes, REGRESSION_PROMPT)
        raw = re.sub(r"```json\s*", "", raw)
        raw = re.sub(r"```\s*", "", raw).strip()
        data = json.loads(raw)
        gemini_changes = []
        for i, c in enumerate(data.get("changes", [])[:10]):
            cls_map = {
                "regression": ChangeClassification.regression,
                "improvement": ChangeClassification.improvement,
                "neutral": ChangeClassification.neutral,
            }
            gemini_changes.append(ChangeObject(
                change_id=f"CGEM_{i:03d}",
                type=c.get("type", "visual_change"),
                element_description=c.get("element_description", ""),
                before=ChangeValue(value=c.get("before_value")),
                after=ChangeValue(value=c.get("after_value")),
                classification=cls_map.get(c.get("classification", "neutral"), ChangeClassification.neutral),
                reasoning=c.get("reasoning", ""),
                accessibility_regression=c.get("accessibility_regression", False),
                confidence=78,
                severity=Severity.medium,
            ))
        return gemini_changes
    except Exception as e:
        print(f"[regression] Gemini diff failed: {e}")
        return []


def run_regression_pipeline(
    before_path: str,
    before_bytes: bytes,
    after_path: str,
    after_bytes: bytes,
) -> RegressionReport:
    """Full L2 pipeline: extract both states, match elements, classify changes."""
    from engines.extraction import build_ui_state
    from engines.rule_engine import run_all_rules
    from engines.evidence import EvidenceAnchor
    from engines.confidence import apply_confidence
    from addons.fix_simulator import simulate_all_fixes
    from engines.report_generator import generate_report, generate_regression_report

    run_before = f"before_{uuid.uuid4().hex[:8]}"
    run_after = f"after_{uuid.uuid4().hex[:8]}"

    # Extract both states
    state_before = build_ui_state(before_path, before_bytes, run_before, page_id="before", level=2)
    state_after = build_ui_state(after_path, after_bytes, run_after, page_id="after", level=2)

    # Run L1 on both
    img_before = cv2.imread(before_path)
    img_after = cv2.imread(after_path)
    anchor = EvidenceAnchor()

    findings_before = run_all_rules(state_before)
    findings_before = anchor.anchor_all(findings_before, img_before, state_before)
    findings_before = apply_confidence(findings_before)
    findings_before = simulate_all_fixes(findings_before)

    findings_after = run_all_rules(state_after)
    findings_after = anchor.anchor_all(findings_after, img_after, state_after)
    findings_after = apply_confidence(findings_after)
    findings_after = simulate_all_fixes(findings_after)

    # Generate individual reports
    report_before = generate_report(state_before, findings_before, img_before, include_personas=False)
    report_after = generate_report(state_after, findings_after, img_after, include_personas=False)

    # Match elements and classify changes
    pairs = match_elements(state_before, state_after)
    all_changes: list[ChangeObject] = []
    for i, (b_el, a_el) in enumerate(pairs):
        all_changes.extend(classify_change(b_el, a_el, i))

    # Gemini multi-image diff (supplemental)
    gemini_changes = _gemini_diff_changes(before_bytes, after_bytes)

    # Merge: deduplicate by element_id + type
    seen = {(c.element_id, c.type) for c in all_changes}
    for gc in gemini_changes:
        if (gc.element_id, gc.type) not in seen:
            all_changes.append(gc)

    # SSIM pixel diff percentage
    try:
        from skimage.metrics import structural_similarity as ssim
        if img_before.shape == img_after.shape:
            gray_b = cv2.cvtColor(img_before, cv2.COLOR_BGR2GRAY)
            gray_a = cv2.cvtColor(img_after, cv2.COLOR_BGR2GRAY)
            score, diff = ssim(gray_b, gray_a, full=True)
            diff_pct = round((1 - score) * 100, 2)
            for c in all_changes:
                c.pixel_diff_percentage = diff_pct
    except Exception:
        pass

    return generate_regression_report(report_before, report_after, all_changes)
