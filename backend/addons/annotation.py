"""Visual annotation overlay — draw colored bounding boxes on screenshots."""
import cv2
import numpy as np
from pathlib import Path
from schemas import Finding, Severity
from config import settings

SEVERITY_COLORS_BGR = {
    Severity.critical: (38, 38, 220),
    Severity.high: (12, 88, 234),
    Severity.medium: (8, 179, 234),
    Severity.low: (235, 99, 37),
    Severity.info: (128, 114, 107),
}

SEVERITY_ORDER = {
    Severity.info: 0,
    Severity.low: 1,
    Severity.medium: 2,
    Severity.high: 3,
    Severity.critical: 4,
}


def annotate_screenshot(image: np.ndarray, findings: list[Finding]) -> np.ndarray:
    """Draw bounding boxes and labels on a copy of the screenshot."""
    annotated = image.copy()
    sorted_findings = sorted(findings, key=lambda f: SEVERITY_ORDER.get(f.severity, 0))

    for finding in sorted_findings:
        bbox = finding.location.bbox
        if bbox is None:
            continue

        color = SEVERITY_COLORS_BGR.get(finding.severity, (128, 114, 107))
        x, y, w, h = bbox.x, bbox.y, bbox.width, bbox.height

        # Draw rectangle
        cv2.rectangle(annotated, (x, y), (x + w, y + h), color, 2)

        # Draw label background
        label = f"[{finding.finding_id}] {finding.principle}"
        font_scale = 0.4
        thickness = 1
        (text_w, text_h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness)
        label_y = max(y - 4, text_h + 4)
        cv2.rectangle(annotated, (x, label_y - text_h - 2), (x + text_w + 4, label_y + 2), color, -1)

        # Draw text
        cv2.putText(
            annotated, label,
            (x + 2, label_y),
            cv2.FONT_HERSHEY_SIMPLEX, font_scale,
            (255, 255, 255), thickness, cv2.LINE_AA,
        )

    return annotated


def save_annotated(image: np.ndarray, run_id: str) -> str:
    filename = f"{run_id}_annotated.png"
    path = Path(settings.reports_dir) / filename
    cv2.imwrite(str(path), image)
    return filename  # filename only — served via /reports/<filename>
