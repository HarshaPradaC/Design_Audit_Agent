"""
Single source of truth for all data models.
Define first — everything else depends on these.
"""
from __future__ import annotations
from typing import Any, Optional
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field


# ─── Primitives ───────────────────────────────────────────────────────────────

class BBox(BaseModel):
    x: int
    y: int
    width: int
    height: int


class Colors(BaseModel):
    background: Optional[str] = None
    text: Optional[str] = None
    contrast_ratio: Optional[float] = None
    wcag_aa_pass: Optional[bool] = None
    wcag_aaa_pass: Optional[bool] = None


class Font(BaseModel):
    size_px: Optional[float] = None
    weight: Optional[int] = None
    family: Optional[str] = None


class Spacing(BaseModel):
    padding_top: Optional[int] = None
    padding_right: Optional[int] = None
    padding_bottom: Optional[int] = None
    padding_left: Optional[int] = None
    margin_top: Optional[int] = None


# ─── Severity / Enums ─────────────────────────────────────────────────────────

class Severity(str, Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"
    info = "info"


class ChangeClassification(str, Enum):
    regression = "regression"
    improvement = "improvement"
    neutral = "neutral"


class AgentLevel(int, Enum):
    L1 = 1
    L2 = 2
    L3 = 3


# ─── UI Element / State ───────────────────────────────────────────────────────

class UIElement(BaseModel):
    id: str
    type: Optional[str] = None
    semantic_role: Optional[str] = None
    text: Optional[str] = None
    bbox: BBox
    colors: Colors = Field(default_factory=Colors)
    font: Font = Field(default_factory=Font)
    spacing: Spacing = Field(default_factory=Spacing)
    border_radius_px: Optional[int] = None
    hierarchy_level: Optional[int] = None
    visual_weight: Optional[str] = None
    source: str = "opencv"
    extraction_confidence: Optional[int] = None


class PageMetadata(BaseModel):
    primary_color: Optional[str] = None
    background_color: Optional[str] = None
    total_elements_detected: int = 0
    extraction_model: Optional[str] = None


class UIState(BaseModel):
    page_id: str
    url: Optional[str] = None
    captured_at: datetime = Field(default_factory=datetime.utcnow)
    run_id: str
    level: int = 1
    viewport: dict = Field(default_factory=lambda: {"width": 1440, "height": 900})
    screenshot_path: str
    elements: list[UIElement] = Field(default_factory=list)
    page_metadata: PageMetadata = Field(default_factory=PageMetadata)

    def get_element(self, element_id: str) -> Optional[UIElement]:
        for el in self.elements:
            if el.id == element_id:
                return el
        return None


# ─── Finding ──────────────────────────────────────────────────────────────────

class EvidenceDetail(BaseModel):
    measured_value: Optional[str] = None
    required_value: Optional[str] = None
    background_color: Optional[str] = None
    text_color: Optional[str] = None
    gap_px: Optional[float] = None
    minimum_px: Optional[float] = None
    nearest_grid: Optional[float] = None
    element_x: Optional[int] = None
    nearest_column: Optional[float] = None
    primary_weight: Optional[int] = None
    secondary_weight: Optional[int] = None
    measurement_method: Optional[str] = None
    pixel_crop_path: Optional[str] = None
    extra: Optional[dict] = None


class FindingLocation(BaseModel):
    description: Optional[str] = None
    element_id: Optional[str] = None
    bbox: Optional[BBox] = None


class Recommendation(BaseModel):
    action: Optional[str] = None
    current_css: Optional[str] = None
    suggested_css: Optional[str] = None
    result: Optional[str] = None


class Finding(BaseModel):
    finding_id: str = ""
    run_id: str = ""
    principle: str
    severity: Severity
    location: FindingLocation = Field(default_factory=FindingLocation)
    evidence: EvidenceDetail = Field(default_factory=EvidenceDetail)
    user_impact: Optional[str] = None
    recommendation: Optional[Recommendation] = None
    confidence: int = 70
    anchored: bool = False
    hallucination_check: Optional[str] = None
    gemini_explanation: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ─── Regression / L2 ──────────────────────────────────────────────────────────

class ChangeValue(BaseModel):
    value: Optional[Any] = None
    wcag_contrast: Optional[float] = None
    width_px: Optional[int] = None
    height_px: Optional[int] = None


class ChangeObject(BaseModel):
    change_id: str = ""
    type: str
    element_id: Optional[str] = None
    element_description: Optional[str] = None
    location: Optional[BBox] = None
    before: ChangeValue = Field(default_factory=ChangeValue)
    after: ChangeValue = Field(default_factory=ChangeValue)
    classification: ChangeClassification = ChangeClassification.neutral
    reasoning: Optional[str] = None
    accessibility_regression: bool = False
    pixel_diff_percentage: Optional[float] = None
    confidence: int = 70
    severity: Severity = Severity.medium


# ─── Score / Grade ────────────────────────────────────────────────────────────

class PrincipleScore(BaseModel):
    score: float
    grade: str


class ScoreCard(BaseModel):
    principle_scores: dict[str, float] = Field(default_factory=dict)
    principle_grades: dict[str, str] = Field(default_factory=dict)
    overall_score: float = 0.0
    overall_grade: str = "F"


# ─── Design DNA ───────────────────────────────────────────────────────────────

class DesignDNA(BaseModel):
    primary_colors: list[str] = Field(default_factory=list)
    neutral_colors: list[str] = Field(default_factory=list)
    spacing_scale: list[int] = Field(default_factory=list)
    type_scale_px: list[float] = Field(default_factory=list)
    border_radius_px: list[int] = Field(default_factory=list)
    shadow_style: Optional[str] = None


# ─── Report (top-level output) ────────────────────────────────────────────────

class ReportSummary(BaseModel):
    total_findings: int = 0
    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0
    info: int = 0
    overall_score: float = 0.0
    grade: str = "F"
    wcag_aa_pass_rate: str = "0%"


class Report(BaseModel):
    report_id: str
    agent_level: int = 1
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    page_analyzed: str = ""
    summary: ReportSummary = Field(default_factory=ReportSummary)
    score_breakdown: ScoreCard = Field(default_factory=ScoreCard)
    design_dna: Optional[DesignDNA] = None
    findings: list[Finding] = Field(default_factory=list)
    annotated_screenshot: Optional[str] = None
    html_report: Optional[str] = None
    persona_images: Optional[dict[str, str]] = None


# ─── Regression Report / L2 ───────────────────────────────────────────────────

class RegressionReport(BaseModel):
    report_id: str
    agent_level: int = 2
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    before_page: str = ""
    after_page: str = ""
    changes: list[ChangeObject] = Field(default_factory=list)
    net_regressions: int = 0
    net_improvements: int = 0
    verdict: str = "NEUTRAL"
    before_report: Optional[Report] = None
    after_report: Optional[Report] = None
    before_annotated: Optional[str] = None
    after_annotated: Optional[str] = None
    html_report: Optional[str] = None


# ─── Baseline / L3 ────────────────────────────────────────────────────────────

class BaselineEntry(BaseModel):
    baseline_id: str
    page: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    approved: bool = True
    approved_by: str = "auto"
    screenshot_path: str
    ui_state_path: Optional[str] = None
    report_summary: Optional[dict] = None
    annotated_url: Optional[str] = None
    version: int = 1


class PageConfig(BaseModel):
    path: str
    name: str
    wait_for: Optional[str] = None
    scroll_to: Optional[str] = None
    dynamic_masks: list[str] = Field(default_factory=list)


class AuthConfig(BaseModel):
    type: str = "none"
    login_url: Optional[str] = None
    username_selector: Optional[str] = None
    password_selector: Optional[str] = None
    submit_selector: Optional[str] = None
    credentials_env: Optional[str] = None


class ViewportConfig(BaseModel):
    width: int = 1440
    height: int = 900


class SiteConfig(BaseModel):
    url: str
    name: str = "site"
    auth: AuthConfig = Field(default_factory=AuthConfig)
    pages: list[PageConfig] = Field(default_factory=list)
    viewport: ViewportConfig = Field(default_factory=ViewportConfig)


# ─── Capture Result ───────────────────────────────────────────────────────────

class CaptureResult(BaseModel):
    image_bytes: bytes
    url: str
    page_name: str
    screenshot_path: Optional[str] = None

    model_config = {"arbitrary_types_allowed": True}


# ─── L3 Page Run Result ───────────────────────────────────────────────────────

class PageRunResult(BaseModel):
    page: str
    run_type: str = "baseline"          # baseline | regression | improvement | neutral | no_change | error
    screenshot_url: Optional[str] = None     # {run_id}_{page}_capture.png in reports/
    annotated_url: Optional[str] = None      # annotated PNG filename in reports/
    html_report_url: Optional[str] = None    # L1 HTML filename in reports/
    l1_report_id: Optional[str] = None       # L1 JSON report ID
    regression_report_id: Optional[str] = None
    score: Optional[float] = None
    grade: Optional[str] = None
    total_findings: int = 0
    critical_findings: int = 0
    high_findings: int = 0
    medium_findings: int = 0
    low_findings: int = 0
    verdict: Optional[str] = None           # NET REGRESSION / NET IMPROVEMENT / NEUTRAL
    changes_count: int = 0
    message: Optional[str] = None
    baseline_approved: bool = False


# ─── WebSocket Progress Events ────────────────────────────────────────────────

class ProgressEvent(BaseModel):
    event: str
    stage: Optional[str] = None
    percent: Optional[int] = None
    message: Optional[str] = None
    finding: Optional[Finding] = None
    report_url: Optional[str] = None
    page_result: Optional[PageRunResult] = None


# ─── L3 Monitor Run ───────────────────────────────────────────────────────────

class MonitorRunStatus(BaseModel):
    run_id: str
    status: str = "running"
    pages_processed: int = 0
    total_pages: int = 0
    findings_count: int = 0
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    page_reports: dict[str, str] = Field(default_factory=dict)
    page_results: list[PageRunResult] = Field(default_factory=list)
    l3_report_url: Optional[str] = None
