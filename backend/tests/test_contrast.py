"""Test WCAG contrast calculations."""
import pytest
from engines.rules.contrast import (
    wcag_relative_luminance, contrast_ratio, analyze_contrast, hex_to_rgb
)
from schemas import UIElement, BBox, Colors, Font, Severity


def test_hex_to_rgb():
    assert hex_to_rgb("#ffffff") == (255, 255, 255)
    assert hex_to_rgb("#000000") == (0, 0, 0)
    assert hex_to_rgb("#fff") == (255, 255, 255)


def test_white_luminance():
    lum = wcag_relative_luminance("#ffffff")
    assert abs(lum - 1.0) < 0.01


def test_black_luminance():
    lum = wcag_relative_luminance("#000000")
    assert abs(lum - 0.0) < 0.01


def test_max_contrast():
    ratio = contrast_ratio("#000000", "#ffffff")
    assert abs(ratio - 21.0) < 0.1


def test_min_contrast():
    ratio = contrast_ratio("#ffffff", "#ffffff")
    assert abs(ratio - 1.0) < 0.01


def test_passing_contrast_returns_none():
    el = UIElement(
        id="el_001",
        bbox=BBox(x=0, y=0, width=100, height=50),
        colors=Colors(text="#000000", background="#ffffff"),
        font=Font(size_px=16, weight=400),
    )
    result = analyze_contrast(el)
    assert result is None


def test_failing_contrast_returns_finding():
    el = UIElement(
        id="el_002",
        bbox=BBox(x=0, y=0, width=100, height=50),
        colors=Colors(text="#9CA3AF", background="#F3F4F6"),
        font=Font(size_px=16, weight=400),
    )
    finding = analyze_contrast(el)
    assert finding is not None
    assert finding.principle == "Contrast"
    assert finding.severity in (Severity.critical, Severity.high)
    assert "2." in finding.evidence.measured_value or "3." in finding.evidence.measured_value


def test_critical_vs_high_threshold():
    # Very low contrast → critical
    el = UIElement(
        id="el_003",
        bbox=BBox(x=0, y=0, width=100, height=50),
        colors=Colors(text="#cccccc", background="#ffffff"),
        font=Font(size_px=16),
    )
    finding = analyze_contrast(el)
    assert finding is not None
    ratio = float(finding.evidence.measured_value.split(":")[0])
    if ratio < 2.5:
        assert finding.severity == Severity.critical
    else:
        assert finding.severity == Severity.high
