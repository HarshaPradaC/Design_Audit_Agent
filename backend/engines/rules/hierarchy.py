"""Visual hierarchy analysis — font ratios, CTA prominence, heading scales."""
from schemas import Finding, Severity, UIElement, EvidenceDetail, FindingLocation, Recommendation

H1_H2_MIN_RATIO = 1.2       # h1 must be at least 20% larger than h2
CTA_MIN_WEIGHT = 500        # CTAs should be semi-bold or bolder
BODY_MAX_SIZE = 18          # body text should not exceed 18px
HERO_MIN_SIZE = 28          # hero headings must be at least 28px


def analyze_hierarchy(elements: list[UIElement], run_id: str = "") -> list[Finding]:
    findings = []

    headings = [e for e in elements if e.semantic_role and "heading" in e.semantic_role]
    ctals = [e for e in elements if e.semantic_role and "cta" in e.semantic_role]

    # Check H1 vs H2 size ratio
    h1s = [e for e in headings if "h1" in (e.semantic_role or "")]
    h2s = [e for e in headings if "h2" in (e.semantic_role or "")]

    for h1 in h1s:
        for h2 in h2s:
            h1_size = h1.font.size_px or 0
            h2_size = h2.font.size_px or 0
            if h1_size > 0 and h2_size > 0:
                ratio = h1_size / h2_size
                if ratio < H1_H2_MIN_RATIO:
                    findings.append(Finding(
                        finding_id=f"HIERARCHY_H1H2_{h1.id}",
                        run_id=run_id,
                        principle="Visual Hierarchy",
                        severity=Severity.medium,
                        location=FindingLocation(
                            description="H1 heading not sufficiently larger than H2",
                            element_id=h1.id,
                            bbox=h1.bbox,
                        ),
                        evidence=EvidenceDetail(
                            measured_value=f"H1:{h1_size:.0f}px vs H2:{h2_size:.0f}px (ratio {ratio:.2f})",
                            required_value=f"Minimum ratio: {H1_H2_MIN_RATIO}",
                            measurement_method="font_size_ratio_check",
                            extra={"h1_size": h1_size, "h2_size": h2_size, "ratio": ratio},
                        ),
                        recommendation=Recommendation(
                            action="Increase H1 size relative to H2 to establish clear hierarchy",
                            current_css=f"font-size: {h1_size:.0f}px;",
                            suggested_css=f"font-size: {h2_size * H1_H2_MIN_RATIO:.0f}px;",
                            result=f"Achieves {H1_H2_MIN_RATIO}x scale — clear visual hierarchy",
                        ),
                        confidence=78,
                    ))

    # Check primary CTA vs secondary CTA prominence
    primary_ctals = [e for e in ctals if "primary" in (e.semantic_role or "")]
    secondary_ctals = [e for e in ctals if "secondary" in (e.semantic_role or "")]

    for p in primary_ctals:
        for s in secondary_ctals:
            p_weight = p.font.weight or 400
            s_weight = s.font.weight or 400
            p_size = p.font.size_px or 16
            s_size = s.font.size_px or 16

            if p_weight <= s_weight and p_size <= s_size:
                findings.append(Finding(
                    finding_id=f"HIERARCHY_CTA_{p.id}",
                    run_id=run_id,
                    principle="Visual Hierarchy",
                    severity=Severity.high,
                    location=FindingLocation(
                        description="Primary CTA not visually dominant over secondary CTA",
                        element_id=p.id,
                        bbox=p.bbox,
                    ),
                    evidence=EvidenceDetail(
                        measured_value=f"Primary: weight={p_weight}, size={p_size}px",
                        required_value=f"Primary must outweigh secondary (weight={s_weight}, size={s_size}px)",
                        primary_weight=p_weight,
                        secondary_weight=s_weight,
                        measurement_method="cta_prominence_comparison",
                    ),
                    recommendation=Recommendation(
                        action="Increase primary CTA font weight and/or size",
                        current_css=f"font-weight: {p_weight};",
                        suggested_css=f"font-weight: {max(p_weight + 100, 600)};",
                        result="Primary CTA visually dominates secondary — clear action hierarchy",
                    ),
                    confidence=74,
                ))
            break  # One finding per primary CTA is enough

    # Check CTA font weight minimum
    for cta in ctals:
        weight = cta.font.weight or 400
        if weight < CTA_MIN_WEIGHT:
            findings.append(Finding(
                finding_id=f"HIERARCHY_CTAWEIGHT_{cta.id}",
                run_id=run_id,
                principle="Visual Hierarchy",
                severity=Severity.medium,
                location=FindingLocation(
                    description=f"CTA button has insufficient font weight",
                    element_id=cta.id,
                    bbox=cta.bbox,
                ),
                evidence=EvidenceDetail(
                    measured_value=f"font-weight: {weight}",
                    required_value=f"Minimum: {CTA_MIN_WEIGHT} (semi-bold)",
                    primary_weight=weight,
                    secondary_weight=CTA_MIN_WEIGHT,
                    measurement_method="font_weight_check",
                ),
                recommendation=Recommendation(
                    action="Set CTA font weight to at least 500 (semi-bold)",
                    current_css=f"font-weight: {weight};",
                    suggested_css=f"font-weight: 600;",
                    result="CTA text has appropriate visual prominence",
                ),
                confidence=75,
            ))

    return findings[:6]
