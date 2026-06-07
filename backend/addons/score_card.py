"""Score card — compute A-F grades per design principle."""
from schemas import Finding, ScoreCard, Severity

GRADE_THRESHOLDS = [
    (97, "A+"), (93, "A"), (90, "A-"),
    (87, "B+"), (83, "B"), (80, "B-"),
    (77, "C+"), (73, "C"), (70, "C-"),
    (67, "D+"), (63, "D"), (60, "D-"),
    (0, "F"),
]

SEVERITY_PENALTIES = {
    Severity.critical: 20,
    Severity.high: 12,
    Severity.medium: 6,
    Severity.low: 2,
    Severity.info: 0,
}

PRINCIPLES = ["Visual Hierarchy", "Contrast", "Spacing", "Alignment", "Consistency"]


def score_to_grade(score: float) -> str:
    for threshold, grade in GRADE_THRESHOLDS:
        if score >= threshold:
            return grade
    return "F"


def compute_score(findings: list[Finding]) -> ScoreCard:
    scores = {p: 100.0 for p in PRINCIPLES}

    for f in findings:
        principle = f.principle
        if principle not in scores:
            # Map to closest
            if "hierarchy" in principle.lower():
                principle = "Visual Hierarchy"
            else:
                scores[principle] = 100.0

        penalty = SEVERITY_PENALTIES.get(f.severity, 6)
        scores[principle] = max(0.0, scores[principle] - penalty)

    # Only include principles that exist in our defaults
    final_scores = {p: scores.get(p, 100.0) for p in PRINCIPLES}
    overall = sum(final_scores.values()) / len(final_scores)

    return ScoreCard(
        principle_scores=final_scores,
        principle_grades={p: score_to_grade(v) for p, v in final_scores.items()},
        overall_score=round(overall, 1),
        overall_grade=score_to_grade(overall),
    )


def build_summary_stats(findings: list[Finding]) -> dict:
    from collections import Counter
    counts = Counter(f.severity for f in findings)
    return {
        "total_findings": len(findings),
        "critical": counts.get(Severity.critical, 0),
        "high": counts.get(Severity.high, 0),
        "medium": counts.get(Severity.medium, 0),
        "low": counts.get(Severity.low, 0),
        "info": counts.get(Severity.info, 0),
    }
