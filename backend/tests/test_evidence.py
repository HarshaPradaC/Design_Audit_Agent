"""Test evidence anchoring — unverifiable findings must be dropped."""
import numpy as np
import pytest
from schemas import UIElement, UIState, BBox, Colors, Finding, Severity, FindingLocation, EvidenceDetail


def _make_state(element_id="el_001"):
    el = UIElement(
        id=element_id,
        bbox=BBox(x=10, y=10, width=80, height=30),
        colors=Colors(text="#333333", background="#ffffff"),
    )
    return UIState(
        page_id="test",
        run_id="run_test",
        screenshot_path="fake.png",
        elements=[el],
    )


def _make_finding(element_id="el_001", principle="Contrast"):
    return Finding(
        finding_id="F001",
        run_id="run_test",
        principle=principle,
        severity=Severity.high,
        location=FindingLocation(
            description="test element",
            element_id=element_id,
            bbox=BBox(x=10, y=10, width=80, height=30),
        ),
        evidence=EvidenceDetail(
            measured_value="3.5:1",
            required_value="4.5:1 (WCAG AA)",
            text_color="#333333",
            background_color="#ffffff",
        ),
    )


def test_anchor_drops_missing_element():
    from engines.evidence import EvidenceAnchor
    state = _make_state("el_001")
    screenshot = np.ones((100, 200, 3), dtype=np.uint8) * 200

    finding = _make_finding(element_id="el_999")  # doesn't exist
    anchor = EvidenceAnchor()
    result = anchor.anchor(finding, screenshot, state)
    assert result is None


def test_anchor_passes_existing_element():
    from engines.evidence import EvidenceAnchor
    state = _make_state("el_001")
    screenshot = np.ones((100, 200, 3), dtype=np.uint8) * 200

    finding = _make_finding(element_id="el_001", principle="Spacing")
    anchor = EvidenceAnchor()
    result = anchor.anchor(finding, screenshot, state)
    assert result is not None
    assert result.anchored is True


def test_anchor_all_filters_none():
    from engines.evidence import EvidenceAnchor
    state = _make_state("el_001")
    screenshot = np.ones((100, 200, 3), dtype=np.uint8) * 200

    findings = [
        _make_finding(element_id="el_001", principle="Spacing"),
        _make_finding(element_id="el_999", principle="Alignment"),  # will be dropped
    ]
    anchor = EvidenceAnchor()
    results = anchor.anchor_all(findings, screenshot, state)
    assert len(results) == 1
    assert results[0].location.element_id == "el_001"
