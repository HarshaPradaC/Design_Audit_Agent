"""Fix simulator — generate exact CSS suggestions for every finding."""
from schemas import Finding, Recommendation


def _darken_hex(hex_color: str, amount: int = 20) -> str:
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 3:
        hex_color = "".join(c * 2 for c in hex_color)
    r = max(0, int(hex_color[0:2], 16) - amount)
    g = max(0, int(hex_color[2:4], 16) - amount)
    b = max(0, int(hex_color[4:6], 16) - amount)
    return f"#{r:02x}{g:02x}{b:02x}"


def simulate_fix(finding: Finding) -> Finding:
    """Enrich finding.recommendation with a concrete CSS fix if not already set."""
    if finding.recommendation and finding.recommendation.suggested_css:
        return finding  # Already has a fix

    rec = Recommendation()

    if finding.principle == "Contrast":
        text = finding.evidence.text_color or "#555555"
        bg = finding.evidence.background_color or "#ffffff"
        fixed = _darken_hex(text, 30)
        rec.action = "Darken text color to meet WCAG AA contrast"
        rec.current_css = f"color: {text};"
        rec.suggested_css = f"color: {fixed};"
        rec.result = "Estimated contrast improvement — verify with contrast checker"

    elif finding.principle == "Spacing":
        gap = finding.evidence.gap_px or 0
        nearest = finding.evidence.nearest_grid or 8
        rec.action = "Adjust spacing to nearest 4px grid value"
        rec.current_css = f"gap: {gap:.0f}px;"
        rec.suggested_css = f"gap: {nearest:.0f}px;"
        rec.result = f"Aligns to {nearest:.0f}px grid spacing"

    elif finding.principle == "Alignment":
        x = finding.evidence.element_x or 0
        col = finding.evidence.nearest_column or 0
        rec.action = "Align element to the dominant layout column"
        rec.current_css = f"/* left edge at {x}px */"
        rec.suggested_css = f"margin-left: {col:.0f}px;"
        rec.result = f"Element aligns to column at {col:.0f}px"

    elif finding.principle == "Visual Hierarchy":
        weight = (finding.evidence.primary_weight or 400)
        rec.action = "Increase font weight for prominence"
        rec.current_css = f"font-weight: {weight};"
        rec.suggested_css = f"font-weight: {min(weight + 200, 900)};"
        rec.result = "Improved visual prominence"

    elif finding.principle == "Consistency":
        bg = finding.evidence.background_color or "#cccccc"
        rec.action = "Use a color from the established design system palette"
        rec.current_css = f"background-color: {bg};"
        rec.suggested_css = f"/* replace {bg} with design system color */"
        rec.result = "Consistent color usage"

    else:
        rec.action = "Review and fix the identified design issue"
        rec.current_css = "/* see finding details */"
        rec.suggested_css = "/* apply recommended fix */"
        rec.result = "Design quality improvement"

    finding.recommendation = rec
    return finding


def simulate_all_fixes(findings: list[Finding]) -> list[Finding]:
    return [simulate_fix(f) for f in findings]
