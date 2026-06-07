"""Test that all schemas instantiate correctly."""
import pytest
from schemas import (
    BBox, Colors, Font, Spacing, UIElement, UIState,
    Finding, Severity, EvidenceDetail, FindingLocation,
    Recommendation, ChangeObject, ChangeClassification,
    ScoreCard, DesignDNA, Report, ReportSummary,
    RegressionReport, BaselineEntry, SiteConfig, PageConfig,
)


def test_bbox():
    b = BBox(x=0, y=0, width=100, height=50)
    assert b.width == 100


def test_ui_element():
    el = UIElement(id="el_001", bbox=BBox(x=0, y=0, width=100, height=50))
    assert el.id == "el_001"
    assert el.colors.text is None


def test_ui_state_get_element():
    el = UIElement(id="el_001", bbox=BBox(x=0, y=0, width=100, height=50))
    state = UIState(page_id="test", run_id="run_001", screenshot_path="test.png", elements=[el])
    found = state.get_element("el_001")
    assert found is not None
    assert found.id == "el_001"
    assert state.get_element("missing") is None


def test_finding_defaults():
    f = Finding(principle="Contrast", severity=Severity.critical)
    assert f.confidence == 70
    assert f.anchored is False


def test_score_card():
    sc = ScoreCard(
        principle_scores={"Contrast": 80.0},
        principle_grades={"Contrast": "B"},
        overall_score=80.0,
        overall_grade="B",
    )
    assert sc.overall_grade == "B"


def test_site_config():
    config = SiteConfig(
        url="https://example.com",
        pages=[PageConfig(path="/", name="home")],
    )
    assert config.viewport.width == 1440
