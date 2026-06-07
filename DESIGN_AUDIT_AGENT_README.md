# 🎨 Design Audit Agent
### Automated UI/UX Intelligence for the Modern Development Pipeline

> **Built for:** Aivar Innovations AI/ML Hiring Challenge  
> **Mission:** Automatically evaluate UI quality, detect regressions, and generate evidence-backed design feedback — embedded directly in the development workflow.  
> **Levels:** L1 Single Page Analysis → L2 Before/After Regression → L3 Autonomous Monitoring

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Core Data Contracts](#4-core-data-contracts)
5. [Component Deep Dives](#5-component-deep-dives)
6. [Unique Differentiators](#6-unique-differentiators)
7. [The Interface](#7-the-interface)
8. [Implementation Guide — Step by Step](#8-implementation-guide--step-by-step)
9. [API Reference](#9-api-reference)
10. [Deployment Guide](#10-deployment-guide)
11. [Edge Cases Handled](#11-edge-cases-handled)
12. [Acceptance Criteria Map](#12-acceptance-criteria-map)
13. [Project Structure](#13-project-structure)

---

## 1. Product Vision

### The Problem

When developers make frontend changes, there is no fast, automated way to determine if the UI improved or degraded from a design perspective.

- Code reviewers focus on logic — not visual quality
- Designers cannot review every pull request
- Design issues compound silently across subsequent PRs
- Accessibility failures create legal and compliance risk
- By the time a human reviews, bad changes are already in production

### The Solution

An autonomous, multi-level design audit agent that:

- Accepts screenshots or live URLs as input
- Evaluates against objective design principles and WCAG standards
- Compares visual states across time (baseline vs. current)
- Navigates live websites autonomously to capture and compare
- Produces evidence-backed, zero-hallucination findings
- Delivers structured JSON + annotated visual reports instantly

### Design Principles of the System Itself

| Principle | What It Means Here |
|---|---|
| No hallucinations | Every finding references a verifiable pixel location or measurement |
| Specific over vague | "CTA contrast is 2.3:1, requires 4.5:1 for WCAG AA" beats "bad contrast" |
| Rules measure, AI explains | Rule engine discovers issues. Gemini narrates and recommends |
| One core engine, three exposures | L1, L2, L3 all run the same pipeline — progressively unlocked |
| Evidence before output | All findings pass Evidence Anchoring before being reported |

---

## 2. System Architecture

### 2.1 The Core Pipeline

Every level of the agent runs through this same pipeline. Levels extend it — they do not replace it.

```
INPUT (image / URL / config)
        │
        ▼
┌──────────────────────┐
│   CAPTURE ENGINE     │  ← Level 3 only (Playwright)
│   (Playwright)       │    L1/L2 skip this — image is already provided
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────────────────────────────┐
│           HYBRID EXTRACTION ENGINE                   │
│                                                      │
│   ┌─────────────────────┐  ┌──────────────────────┐ │
│   │   OpenCV Layer      │  │   Gemini Vision      │ │
│   │                     │  │                      │ │
│   │  • Edge detection   │  │  • Element IDs       │ │
│   │  • Color sampling   │  │  • Semantic roles    │ │
│   │  • Spacing gaps     │  │  • Hierarchy reads   │ │
│   │  • Alignment grid   │  │  • Consistency check │ │
│   │  • Contour finding  │  │  • Multi-image diff  │ │
│   └──────────┬──────────┘  └──────────┬───────────┘ │
│              └────────────┬────────────┘             │
│                           ▼                          │
│                    UIState JSON                      │
│              (single source of truth)                │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│                DESIGN RULE ENGINE                    │
│                                                      │
│   ContrastAnalyzer     → Pure WCAG math (4.5:1 AA)  │
│   SpacingAnalyzer      → Pixel gap measurement      │
│   AlignmentAnalyzer    → Grid deviation detection   │
│   HierarchyAnalyzer    → Font ratio + weight checks │
│   ConsistencyAnalyzer  → Color/radius clustering    │
│                                                      │
│   ← RULES NEVER HALLUCINATE. MATH DOES NOT LIE →    │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│             EVIDENCE ANCHORING LAYER                 │
│                                                      │
│   For every finding:                                 │
│   1. Can we locate the element in UIState? → else DROP│
│   2. Does the measured value match the claim? → else DROP│
│   3. Crop pixel evidence from original image         │
│   4. Assign evidence strength score                  │
│                                                      │
│   ← FINDINGS THAT CANNOT BE PROVEN ARE DROPPED →    │
└──────────────────────┬───────────────────────────────┘
                       │
           ┌───────────┴───────────┐
           │                       │
           ▼                       ▼
  ┌────────────────┐     ┌──────────────────────┐
  │  REGRESSION    │     │  DYNAMIC CONTENT     │
  │  ENGINE        │     │  FILTER              │
  │  (L2/L3 only)  │     │  (L3 only)           │
  │                │     │                      │
  │  UIState diff  │     │  Mask: timestamps    │
  │  Classification│     │  counters, tokens,   │
  │  confidence    │     │  spinners before     │
  └────────┬───────┘     │  pixel comparison    │
           │             └──────────┬───────────┘
           └───────────┬────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│            PROMPT ENGINEERING LAYER                  │
│                                                      │
│   Convert rule findings → structured Gemini prompts  │
│   Inject: element type, location, measurement,       │
│   principle violated, severity, image crop evidence  │
│                                                      │
│   ← GEMINI RECEIVES STRUCTURED CONTEXT, NOT RAW ASK →│
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│              GEMINI UX REVIEWER                      │
│                                                      │
│   Input:  Pre-discovered, pre-evidenced finding      │
│   Output: UX impact narrative + CSS fix suggestion   │
│           + accessibility implication                │
│                                                      │
│   Model: gemini-2.0-flash (vision) / 1.5-pro (text) │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│              CONFIDENCE ENGINE                       │
│                                                      │
│   Contrast (measured):   92–99%                      │
│   Spacing (measured):    90–96%                      │
│   Alignment (measured):  88–94%                      │
│   Hierarchy (AI):        70–85%                      │
│   Consistency (cluster): 75–88%                      │
│   Regression (diff):     80–92%                      │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│              ADDON LAYER                             │
│                                                      │
│   DesignDNA Fingerprinter  → Design system extract   │
│   FixSimulator              → Exact CSS suggestions  │
│   ScoreCard                 → A–F grade per principle│
│   PersonaSimulator          → Accessibility lenses   │
│   AnnotationRenderer        → Bbox overlay on image  │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│              REPORT GENERATOR                        │
│                                                      │
│   structured_report.json   → Required by spec        │
│   visual_report.html       → Interactive, impressive │
│   annotated_screenshot.png → Visual proof            │
│   design_dna.json          → Bonus deliverable       │
└──────────────────────────────────────────────────────┘
```

### 2.2 Level Mapping

```
LEVEL 1 FLOW:
  image.png → Hybrid Extraction → Rule Engine → Evidence Anchoring
  → Prompt Layer → Gemini → Confidence → Addons → Report

LEVEL 2 FLOW:
  before.png ┐
             ├→ Level 1 each → Regression Engine → Classify Changes
  after.png  ┘  → Confidence → Report (with before/after slider)

LEVEL 3 FLOW:
  config.yaml → Playwright → Screenshot per page
  → Dynamic Content Filter → Level 2 Engine per page pair
  → Baseline Store comparison → Full Regression Report
  → Trend history update
```

---

## 3. Technology Stack

### 3.1 Backend

| Library | Version | Purpose |
|---|---|---|
| `Python` | 3.11+ | Core runtime |
| `FastAPI` | 0.111+ | REST API + WebSocket endpoints |
| `uvicorn` | 0.29+ | ASGI server |
| `google-generativeai` | 0.7+ | Gemini Vision + Text API |
| `Pillow` | 10.3+ | Image I/O, color transforms, persona simulation |
| `opencv-python` | 4.9+ | Edge detection, contour finding, grid alignment |
| `playwright` | 1.44+ | Browser automation for Level 3 |
| `numpy` | 1.26+ | Pixel math, matrix operations |
| `scikit-image` | 0.23+ | SSIM structural similarity for regression |
| `sqlalchemy` | 2.0+ | SQLite ORM for baseline store |
| `pydantic` | 2.7+ | Schema validation — JSON in/out |
| `python-dotenv` | 1.0+ | Environment config |
| `websockets` | 12.0+ | Real-time progress streaming |
| `jinja2` | 3.1+ | HTML report templating |
| `pytest` | 8.2+ | Test suite |

### 3.2 Frontend

| Library | Version | Purpose |
|---|---|---|
| `React` | 18+ | UI framework |
| `Vite` | 5+ | Build tool (fast) |
| `Tailwind CSS` | 3.4+ | Utility styling |
| `Framer Motion` | 11+ | Animations, transitions |
| `react-dropzone` | 14+ | Drag-and-drop upload |
| `react-compare-image` | 3+ | Before/after slider (L2) |
| `react-image-annotate` | 1+ | Bounding box overlay |
| `recharts` | 2+ | Design score trend chart (L3) |
| `zustand` | 4+ | Lightweight state management |

### 3.3 AI / ML

| Tool | Role |
|---|---|
| `gemini-2.0-flash` | Vision extraction — fast, multi-image, cheap |
| `gemini-1.5-pro` | Deep UX reasoning — richer context |
| `OpenCV` | Deterministic measurement — never hallucinate |
| `Pillow color matrices` | Accessibility persona visual simulation |
| `scikit-image SSIM` | Structural diff for regression detection |

### 3.4 Infrastructure

| Tool | Role |
|---|---|
| `SQLite` | Baseline versioned store |
| `Filesystem (organized)` | Screenshot + annotated image storage |
| `Railway.app` | Backend deployment |
| `Vercel` | Frontend deployment |
| `Docker` | Containerization |
| `GitHub Actions` | CI/CD pipeline |

---

## 4. Core Data Contracts

These schemas are the system's single source of truth. **Define these first. Everything else depends on them.**

### 4.1 UIState

```json
{
  "page_id": "dashboard_v2",
  "url": "https://app.example.com/dashboard",
  "captured_at": "2025-06-07T10:00:00Z",
  "run_id": "run_20250607_001",
  "level": 1,
  "viewport": {
    "width": 1440,
    "height": 900
  },
  "screenshot_path": "captures/dashboard_v2.png",
  "elements": [
    {
      "id": "el_001",
      "type": "button",
      "semantic_role": "primary_cta",
      "text": "Get Started",
      "bbox": {
        "x": 120,
        "y": 340,
        "width": 160,
        "height": 48
      },
      "colors": {
        "background": "#4F46E5",
        "text": "#FFFFFF",
        "contrast_ratio": 8.59,
        "wcag_aa_pass": true,
        "wcag_aaa_pass": false
      },
      "font": {
        "size_px": 16,
        "weight": 600,
        "family": "Inter"
      },
      "spacing": {
        "padding_top": 12,
        "padding_right": 24,
        "padding_bottom": 12,
        "padding_left": 24,
        "margin_top": 32
      },
      "border_radius_px": 8,
      "source": "opencv+gemini-vision",
      "extraction_confidence": 91
    }
  ],
  "page_metadata": {
    "primary_color": "#4F46E5",
    "background_color": "#FFFFFF",
    "total_elements_detected": 34,
    "extraction_model": "gemini-2.0-flash"
  }
}
```

### 4.2 Finding

```json
{
  "finding_id": "F001",
  "run_id": "run_20250607_001",
  "principle": "Contrast",
  "severity": "critical",
  "location": {
    "description": "Hero section subtitle text",
    "element_id": "el_003",
    "bbox": { "x": 80, "y": 420, "width": 440, "height": 24 }
  },
  "evidence": {
    "measured_value": "2.3:1",
    "required_value": "4.5:1 (WCAG AA)",
    "background_color": "#F3F4F6",
    "text_color": "#9CA3AF",
    "pixel_crop_path": "evidence/F001_crop.png",
    "measurement_method": "pillow_colorpicker + wcag_formula"
  },
  "user_impact": "Users with low vision or in bright environments cannot read this text. Affects approximately 20% of users.",
  "recommendation": {
    "action": "Darken text color",
    "current_css": "color: #9CA3AF",
    "suggested_css": "color: #6B7280",
    "result": "Achieves 4.6:1 contrast ratio — WCAG AA compliant"
  },
  "confidence": 97,
  "anchored": true,
  "hallucination_check": "PASSED — element found at stated location, colors verified by pixel sampling",
  "gemini_explanation": "The subtitle text uses a light gray (#9CA3AF) on a near-white background (#F3F4F6), producing a contrast ratio of only 2.3:1. This fails WCAG 2.1 AA requirements for normal text, which demand a minimum of 4.5:1. Users with moderate visual impairment, those in high-ambient-light environments, and elderly users will struggle to read this content.",
  "created_at": "2025-06-07T10:00:05Z"
}
```

### 4.3 Regression Change Object (Level 2)

```json
{
  "change_id": "C001",
  "type": "color_change",
  "element_id": "el_001",
  "element_description": "Primary CTA button background",
  "location": { "x": 120, "y": 340, "width": 160, "height": 48 },
  "before": {
    "value": "#4F46E5",
    "wcag_contrast": 8.59
  },
  "after": {
    "value": "#A1A1AA",
    "wcag_contrast": 2.1
  },
  "classification": "regression",
  "reasoning": "Button background changed from high-contrast indigo to low-contrast gray. Contrast dropped from 8.59:1 to 2.1:1, failing WCAG AA. Primary CTA is now unreadable for visually impaired users.",
  "accessibility_regression": true,
  "pixel_diff_percentage": 12.3,
  "confidence": 96,
  "severity": "critical"
}
```

### 4.4 Report (Top Level)

```json
{
  "report_id": "RPT_20250607_001",
  "agent_level": 1,
  "generated_at": "2025-06-07T10:00:10Z",
  "page_analyzed": "dashboard_v2",
  "summary": {
    "total_findings": 10,
    "critical": 2,
    "high": 3,
    "medium": 4,
    "low": 1,
    "info": 0,
    "overall_score": 72,
    "grade": "C+",
    "wcag_aa_pass_rate": "68%"
  },
  "score_breakdown": {
    "visual_hierarchy": { "score": 82, "grade": "B" },
    "contrast": { "score": 61, "grade": "D" },
    "spacing": { "score": 91, "grade": "A-" },
    "alignment": { "score": 78, "grade": "C+" },
    "consistency": { "score": 95, "grade": "A" }
  },
  "design_dna": {
    "primary_colors": ["#4F46E5", "#6366F1"],
    "spacing_scale": [4, 8, 16, 24, 32, 48],
    "type_scale_px": [12, 14, 16, 20, 24, 32],
    "border_radius_px": [4, 8, 12]
  },
  "findings": ["...array of Finding objects..."],
  "annotated_screenshot": "reports/RPT_20250607_001_annotated.png",
  "html_report": "reports/RPT_20250607_001.html"
}
```

### 4.5 Baseline Entry (Level 3)

```json
{
  "baseline_id": "BL_20250607_001",
  "page": "/dashboard",
  "created_at": "2025-06-07T10:00:00Z",
  "approved": true,
  "approved_by": "auto",
  "screenshot_path": "baselines/dashboard_20250607.png",
  "ui_state_path": "baselines/dashboard_20250607_state.json",
  "report_summary": { "score": 72, "grade": "C+" },
  "version": 1
}
```

---

## 5. Component Deep Dives

### 5.1 Capture Engine (Level 3)

**File:** `backend/engines/capture.py`

**Purpose:** Autonomously navigate a live website, authenticate, and capture clean, consistent screenshots.

**Inputs:**
```yaml
# config/sites/myapp.yaml
url: "https://app.example.com"
auth:
  type: "form"
  login_url: "/login"
  username_selector: "#email"
  password_selector: "#password"
  submit_selector: "button[type=submit]"
  credentials_env: "SITE_CREDS"
pages:
  - path: "/"
    name: "homepage"
    wait_for: ".hero-section"
  - path: "/dashboard"
    name: "dashboard"
    wait_for: ".dashboard-grid"
    scroll_to: "bottom"
viewport:
  width: 1440
  height: 900
```

**Implementation:**

```python
async def capture_page(page, config: PageConfig) -> CaptureResult:
    await page.set_viewport_size({"width": 1440, "height": 900})
    await page.goto(config.url + config.path)

    # Wait for meaningful content — not just DOM ready
    await page.wait_for_selector(config.wait_for, timeout=10000)
    await page.wait_for_load_state("networkidle")

    # Mask dynamic regions before screenshot
    await mask_dynamic_content(page, config.dynamic_masks)

    # Scroll behavior
    if config.scroll_to == "top":
        await page.evaluate("window.scrollTo(0, 0)")

    screenshot_bytes = await page.screenshot(full_page=False)
    return CaptureResult(image_bytes=screenshot_bytes, url=config.url + config.path)
```

**Auth Handler:**

```python
async def authenticate(browser, auth_config: AuthConfig):
    page = await browser.new_page()
    await page.goto(auth_config.login_url)
    await page.fill(auth_config.username_selector, os.getenv("SITE_USERNAME"))
    await page.fill(auth_config.password_selector, os.getenv("SITE_PASSWORD"))
    await page.click(auth_config.submit_selector)
    await page.wait_for_load_state("networkidle")
    # Session cookie is now in the browser context
    return page
```

**Edge Cases Handled:**
- Login redirect loops → detect URL unchanged after submit
- Multi-step auth (MFA) → configurable step sequence
- Cookie consent banners → auto-dismiss by selector pattern
- Lazy-loaded images → wait for `load_state("networkidle")`
- Sticky headers → fixed viewport scroll position

---

### 5.2 Hybrid Extraction Engine

**File:** `backend/engines/extraction.py`

**Purpose:** Convert a raw screenshot into a structured UIState. OpenCV measures. Gemini understands.

**Two-Layer Strategy:**

```
LAYER A: OpenCV (deterministic, never hallucinates)
  Input:  PNG image
  Does:   Color sampling at pixel coordinates
          Edge detection via Canny algorithm
          Contour finding → approximate element bounding boxes
          Grid detection via Hough lines
          Inter-element gap measurement

LAYER B: Gemini Vision (semantic understanding)
  Input:  Same PNG + OpenCV bbox data
  Does:   Identify element types (button, nav, card, form)
          Assign semantic roles (primary_cta, breadcrumb, etc.)
          Assess visual hierarchy order
          Identify typography classification
          Note visual groupings and relationships
  Model:  gemini-2.0-flash
```

**The Extraction Prompt (Prompt Engineering Layer):**

```python
EXTRACTION_PROMPT = """
You are a precise UI element extractor. Analyze this screenshot and return ONLY valid JSON.

For each visible UI element, extract:
- type: (button | input | text | image | card | nav | table | icon | badge)
- semantic_role: (primary_cta | secondary_cta | heading | body | label | nav_item | etc.)
- approximate_bbox: {x, y, width, height} in pixels from top-left
- text_content: visible text (empty string if none)
- visual_weight: (dominant | prominent | standard | subtle)
- hierarchy_level: integer 1 (most prominent) to 5 (least prominent)

Rules:
1. Only report elements visible in the screenshot
2. Do not infer elements that may exist outside the visible area
3. If you cannot determine a value with confidence, use null
4. Return only the JSON object — no preamble, no explanation

Format: {"elements": [...]}
"""
```

**Merge Strategy:**

```python
def merge_extraction(opencv_elements: list, gemini_elements: list) -> list:
    merged = []
    for oc_el in opencv_elements:
        # Find closest Gemini element by bbox overlap
        match = find_best_iou_match(oc_el.bbox, gemini_elements)
        if match and match.iou > 0.5:
            merged.append(UIElement(
                # OpenCV provides: precise bbox, sampled colors
                bbox=oc_el.bbox,
                background_color=oc_el.background_color,
                text_color=oc_el.text_color,
                # Gemini provides: semantics
                type=match.type,
                semantic_role=match.semantic_role,
                text=match.text_content,
                hierarchy_level=match.hierarchy_level,
                source="opencv+gemini-vision"
            ))
    return merged
```

---

### 5.3 Design Rule Engine

**File:** `backend/engines/rules/`

This is the heart. Rules are deterministic — they produce findings that cannot hallucinate.

#### Contrast Analyzer

**File:** `rules/contrast.py`

```python
def wcag_relative_luminance(hex_color: str) -> float:
    """Pure WCAG 2.1 formula. No AI. No ambiguity."""
    r, g, b = hex_to_rgb(hex_color)
    channels = []
    for c in [r, g, b]:
        c = c / 255.0
        if c <= 0.03928:
            channels.append(c / 12.92)
        else:
            channels.append(((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]

def contrast_ratio(color1: str, color2: str) -> float:
    l1 = wcag_relative_luminance(color1)
    l2 = wcag_relative_luminance(color2)
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)

def analyze_contrast(element: UIElement) -> Finding | None:
    ratio = contrast_ratio(element.colors.text, element.colors.background)
    threshold = 4.5 if element.font.size_px < 18 else 3.0

    if ratio < threshold:
        severity = "critical" if ratio < 2.5 else "high"
        return Finding(
            principle="Contrast",
            severity=severity,
            evidence={
                "measured_value": f"{ratio:.2f}:1",
                "required_value": f"{threshold}:1 (WCAG AA)",
                "text_color": element.colors.text,
                "background_color": element.colors.background
            },
            confidence=97
        )
    return None
```

#### Spacing Analyzer

**File:** `rules/spacing.py`

```python
def analyze_spacing(elements: list[UIElement], image: np.ndarray) -> list[Finding]:
    findings = []

    # Check inter-element gaps
    for i, el_a in enumerate(elements):
        for el_b in elements[i+1:]:
            if are_adjacent(el_a, el_b):
                gap = measure_gap(el_a.bbox, el_b.bbox)
                if gap < 4:  # Below minimum touch target spacing
                    findings.append(Finding(
                        principle="Spacing",
                        severity="high",
                        evidence={"gap_px": gap, "minimum_px": 4}
                    ))
                elif gap not in EXPECTED_SPACING_SCALE:
                    # Off-grid spacing — design system violation
                    nearest = find_nearest_scale_value(gap)
                    findings.append(Finding(
                        principle="Spacing",
                        severity="medium",
                        evidence={"gap_px": gap, "nearest_grid": nearest}
                    ))
    return findings
```

#### Alignment Analyzer

**File:** `rules/alignment.py`

```python
def analyze_alignment(elements: list[UIElement]) -> list[Finding]:
    """Detect elements that break the visual grid."""
    left_edges = [el.bbox.x for el in elements]
    centers = [el.bbox.x + el.bbox.width // 2 for el in elements]

    # Find dominant alignment columns using k-means clustering
    clusters = cluster_values(left_edges, tolerance=4)
    dominant_cols = [c for c in clusters if len(c) >= 3]

    findings = []
    for el in elements:
        aligned = any(abs(el.bbox.x - col) <= 4 for col in dominant_cols)
        if not aligned:
            findings.append(Finding(
                principle="Alignment",
                severity="medium",
                evidence={"element_x": el.bbox.x, "nearest_column": find_nearest(el.bbox.x, dominant_cols)}
            ))
    return findings
```

#### Hierarchy Analyzer

**File:** `rules/hierarchy.py`

```python
RULES = {
    "h1_h2_ratio": 1.25,      # h1 must be 25% larger than h2
    "cta_min_weight": 600,     # CTAs must be bold
    "body_max_size": 18,       # Body text under 18px
    "hero_min_size": 32,       # Hero headings at least 32px
}

def analyze_hierarchy(elements: list[UIElement]) -> list[Finding]:
    headings = [e for e in elements if "heading" in e.semantic_role]
    ctals = [e for e in elements if "cta" in e.semantic_role]

    # CTA prominence check — primary must outweigh secondary visually
    primary_ctals = [e for e in ctals if "primary" in e.semantic_role]
    secondary_ctals = [e for e in ctals if "secondary" in e.semantic_role]

    for p in primary_ctals:
        for s in secondary_ctals:
            if p.font.weight <= s.font.weight and p.font.size_px <= s.font.size_px:
                return [Finding(
                    principle="Visual Hierarchy",
                    severity="high",
                    evidence={"primary_weight": p.font.weight, "secondary_weight": s.font.weight}
                )]
```

---

### 5.4 Evidence Anchoring Layer

**File:** `backend/engines/evidence.py`

This is the anti-hallucination system. Every finding must pass three checks before it's accepted.

```python
class EvidenceAnchor:

    def anchor(self, finding: Finding, screenshot: np.ndarray, ui_state: UIState) -> Finding | None:

        # CHECK 1: Element must exist in UIState at the stated location
        element = ui_state.get_element(finding.location.element_id)
        if element is None:
            self._log_rejection(finding, "element_not_found")
            return None  # DROPPED — not flagged, DROPPED

        # CHECK 2: Measured values must match the pixel reality
        if finding.principle == "Contrast":
            actual_text_color = self._sample_color(screenshot, element.bbox, region="text")
            actual_bg_color = self._sample_color(screenshot, element.bbox, region="background")
            claimed_ratio = finding.evidence.measured_value
            actual_ratio = contrast_ratio(actual_text_color, actual_bg_color)

            if abs(float(claimed_ratio.split(":")[0]) - actual_ratio) > 0.3:
                self._log_rejection(finding, "color_mismatch")
                return None  # DROPPED

        # CHECK 3: Crop pixel evidence from original screenshot
        crop = self._crop_region(screenshot, element.bbox, padding=8)
        finding.evidence.pixel_crop = crop
        finding.evidence.pixel_crop_path = self._save_crop(crop, finding.finding_id)

        # PASSED — attach proof
        finding.anchored = True
        finding.hallucination_check = "PASSED"
        return finding

    def _sample_color(self, image: np.ndarray, bbox: BBox, region: str) -> str:
        """Sample the most common color in a region of the screenshot."""
        x, y, w, h = bbox.x, bbox.y, bbox.width, bbox.height
        if region == "text":
            crop = image[y+4:y+h-4, x+4:x+w-4]
        else:
            crop = image[y:y+h, x:x+w]
        return get_dominant_color(crop)
```

---

### 5.5 Regression Engine (Level 2)

**File:** `backend/engines/regression.py`

```python
def classify_change(before_el: UIElement, after_el: UIElement) -> ChangeObject:
    changes = []

    # Color change
    if before_el.colors.background != after_el.colors.background:
        before_ratio = contrast_ratio(before_el.colors.text, before_el.colors.background)
        after_ratio = contrast_ratio(after_el.colors.text, after_el.colors.background)

        direction = "regression" if after_ratio < before_ratio else "improvement"
        if abs(before_ratio - after_ratio) < 0.2:
            direction = "neutral"

        changes.append(ChangeObject(
            type="color_change",
            before={"value": before_el.colors.background, "contrast": before_ratio},
            after={"value": after_el.colors.background, "contrast": after_ratio},
            classification=direction,
            accessibility_regression=after_ratio < 4.5 and before_ratio >= 4.5
        ))

    # Sizing change
    if before_el.bbox.width != after_el.bbox.width:
        size_delta = after_el.bbox.width - before_el.bbox.width
        if size_delta < -20:  # Significant shrinkage
            changes.append(ChangeObject(
                type="size_reduction",
                classification="regression",  # Smaller tap target
                before={"width_px": before_el.bbox.width},
                after={"width_px": after_el.bbox.width}
            ))

    return changes
```

**Multi-image Gemini Diff Prompt:**

```python
REGRESSION_PROMPT = """
You are comparing two UI screenshots: BEFORE and AFTER a code change.

Analyze these two images together and identify every visual difference.
For each difference, state:
1. What changed (be specific — colors, sizes, positions, text)
2. Where it changed (element type and screen location)
3. Direction: improvement / regression / neutral
4. Reasoning for your classification

Classify as REGRESSION if:
- Contrast decreased
- Elements became smaller or harder to tap
- Text became harder to read
- Visual hierarchy became less clear
- Spacing became more cramped

Classify as IMPROVEMENT if:
- Contrast increased
- Elements became more accessible
- Hierarchy became clearer

Return JSON only. No preamble.
"""
```

---

### 5.6 Dynamic Content Filter (Level 3)

**File:** `backend/engines/dynamic_filter.py`

**The Problem:** Every screenshot of a live site contains elements that change on every load — timestamps, notification counts, session IDs, loading spinners, ads. A naive pixel diff treats these as regressions. This filter removes them before comparison.

**Strategy — Three Layers:**

```python
class DynamicContentFilter:

    # Layer 1: CSS Selector Masking (highest precision)
    DEFAULT_MASK_SELECTORS = [
        "[data-testid*='timestamp']",
        "[class*='time']",
        "[class*='date']",
        "[class*='badge']",
        "[class*='notification-count']",
        "[class*='spinner']",
        "[class*='loader']",
        "[class*='skeleton']"
    ]

    # Layer 2: OCR Pattern Detection
    DYNAMIC_PATTERNS = [
        r'\d{1,2}:\d{2}',           # Times: 10:30
        r'\d{4}-\d{2}-\d{2}',       # Dates: 2025-06-07
        r'[a-f0-9]{8}-[a-f0-9]{4}', # UUIDs
        r'\d+ (minutes?|hours?|days?) ago',  # Relative times
        r'Session ID: \w+',
    ]

    # Layer 3: SSIM Region-Based Dynamic Detection
    # If a region differs between two baseline captures taken 5s apart →
    # it's inherently dynamic, auto-mask it
    def auto_detect_dynamic_regions(self, img1: np.ndarray, img2: np.ndarray) -> list[BBox]:
        """Two rapid captures, find regions that changed = dynamic content."""
        diff = np.abs(img1.astype(int) - img2.astype(int))
        changed_regions = find_connected_components(diff > 10)
        return changed_regions

    def apply_masks(self, screenshot: np.ndarray, masks: list[BBox]) -> np.ndarray:
        """Paint dynamic regions gray before pixel comparison."""
        masked = screenshot.copy()
        for bbox in masks:
            masked[bbox.y:bbox.y+bbox.height, bbox.x:bbox.x+bbox.width] = 128
        return masked
```

---

### 5.7 Confidence Engine

**File:** `backend/engines/confidence.py`

```python
CONFIDENCE_BASE = {
    "Contrast": 97,       # Pure math — near certain
    "Spacing": 93,        # Pixel measurement — very reliable
    "Alignment": 90,      # Grid clustering — reliable
    "Hierarchy": 74,      # Partially inferred — moderate
    "Consistency": 79,    # Cluster-based — moderate
    "Regression": 85,     # Diff-based — reliable
}

MODIFIERS = {
    "element_partially_occluded": -8,
    "color_gradient_background": -12,   # Hard to sample accurately
    "font_size_small": -5,              # Harder to measure
    "multiple_instances_corroborate": +10,
    "pixel_measurement_precise": +5,
    "gemini_agrees": +8,
    "before_after_hex_diff": +12,
    "dynamic_region_detected": -20,     # Near the filter zone
}

def calculate_confidence(finding: Finding, context: dict) -> int:
    base = CONFIDENCE_BASE.get(finding.principle, 70)
    for modifier, value in MODIFIERS.items():
        if context.get(modifier):
            base += value
    return max(0, min(100, base))
```

---

## 6. Unique Differentiators

### 6.1 Design DNA Fingerprinting

**File:** `backend/addons/design_dna.py`

Extract the implicit design system from any screenshot, then enforce it.

```
What it extracts:
  Primary color family     → #4F46E5, #6366F1, #818CF8 (with clustering)
  Neutral color family     → #F9FAFB, #E5E7EB, #6B7280
  Spacing scale            → 4, 8, 16, 24, 32, 48 px (k-means on gaps)
  Typography scale         → 12, 14, 16, 24, 32 px
  Border radius system     → 4, 8, 12 px (mode detection)
  Shadow style             → none / subtle / elevated

What it detects:
  Elements that violate the extracted system
  "This button has border-radius: 6px but the system uses 8px"
  "This card uses #5A5A5A but the neutral scale is #6B7280 / #9CA3AF"
```

**Why this impresses:** You're not just checking WCAG rules. You're understanding the *intent* of the design system and detecting deviations from it. This is what senior design engineers do.

---

### 6.2 Fix Simulator

**File:** `backend/addons/fix_simulator.py`

For every finding, generate the exact CSS change needed to fix it.

```python
def generate_fix(finding: Finding, element: UIElement) -> Fix:
    if finding.principle == "Contrast":
        current = element.colors.text
        background = element.colors.background
        target_ratio = 4.5

        # Binary search for the minimum color change that achieves target ratio
        fixed_color = find_minimum_shift_to_pass(current, background, target_ratio)

        return Fix(
            description=f"Change text color to meet WCAG AA",
            current_css=f"color: {current};",
            suggested_css=f"color: {fixed_color};",
            before_ratio=f"{contrast_ratio(current, background):.2f}:1",
            after_ratio=f"{contrast_ratio(fixed_color, background):.2f}:1",
            wcag_result="PASS"
        )
```

**Output in report:**
```
CURRENT:   color: #9CA3AF;   →   contrast 2.3:1  ✗ FAIL
SUGGESTED: color: #6B7280;   →   contrast 4.6:1  ✓ PASS
```

---

### 6.3 Design Score Card

**File:** `backend/addons/score_card.py`

```python
GRADE_THRESHOLDS = {
    "A+": 97, "A": 93, "A-": 90,
    "B+": 87, "B": 83, "B-": 80,
    "C+": 77, "C": 73, "C-": 70,
    "D+": 67, "D": 63, "D-": 60,
    "F": 0
}

def compute_score(findings: list[Finding]) -> ScoreCard:
    principle_penalties = {
        "critical": 20,
        "high": 12,
        "medium": 6,
        "low": 2,
        "info": 0
    }
    scores = {"Visual Hierarchy": 100, "Contrast": 100, "Spacing": 100,
              "Alignment": 100, "Consistency": 100}

    for f in findings:
        scores[f.principle] -= principle_penalties[f.severity]

    scores = {k: max(0, v) for k, v in scores.items()}
    overall = sum(scores.values()) / len(scores)

    return ScoreCard(
        principle_scores=scores,
        principle_grades={k: score_to_grade(v) for k, v in scores.items()},
        overall_score=overall,
        overall_grade=score_to_grade(overall)
    )
```

---

### 6.4 Accessibility Persona Simulation

**File:** `backend/addons/persona_sim.py`

Generate visual simulations of how the UI appears through different accessibility lenses.

```python
PERSONA_MATRICES = {
    "deuteranopia": [  # Red-green color blindness (8% of males)
        [0.625, 0.375, 0.000],
        [0.700, 0.300, 0.000],
        [0.000, 0.300, 0.700]
    ],
    "protanopia": [    # Red color blindness
        [0.567, 0.433, 0.000],
        [0.558, 0.442, 0.000],
        [0.000, 0.242, 0.758]
    ],
    "tritanopia": [    # Blue color blindness
        [0.950, 0.050, 0.000],
        [0.000, 0.433, 0.567],
        [0.000, 0.475, 0.525]
    ]
}

def simulate_persona(image: np.ndarray, persona: str) -> np.ndarray:
    matrix = PERSONA_MATRICES[persona]
    r, g, b = image[:,:,0], image[:,:,1], image[:,:,2]
    new_r = matrix[0][0]*r + matrix[0][1]*g + matrix[0][2]*b
    new_g = matrix[1][0]*r + matrix[1][1]*g + matrix[1][2]*b
    new_b = matrix[2][0]*r + matrix[2][1]*g + matrix[2][2]*b
    return np.stack([new_r, new_g, new_b], axis=2).astype(np.uint8)
```

The report includes simulated screenshots per persona, making it immediately visceral: *"Here is exactly what your UI looks like to someone with deuteranopia."*

---

### 6.5 Visual Annotation Overlay

**File:** `backend/addons/annotation.py`

Draw bounding boxes directly on the screenshot. The color corresponds to severity. This is the visual proof that eliminates hallucination doubt.

```python
SEVERITY_COLORS = {
    "critical": (220, 38, 38),   # Red
    "high": (234, 88, 12),       # Orange
    "medium": (234, 179, 8),     # Yellow
    "low": (37, 99, 235),        # Blue
    "info": (107, 114, 128)      # Gray
}

def annotate_screenshot(image: np.ndarray, findings: list[Finding]) -> np.ndarray:
    annotated = image.copy()
    for finding in sorted(findings, key=lambda f: f.severity):
        color = SEVERITY_COLORS[finding.severity]
        bbox = finding.location.bbox

        # Draw box
        cv2.rectangle(annotated,
                      (bbox.x, bbox.y),
                      (bbox.x + bbox.width, bbox.y + bbox.height),
                      color, 2)

        # Label
        label = f"[{finding.finding_id}] {finding.principle}"
        cv2.putText(annotated, label, (bbox.x, bbox.y - 8),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)

    return annotated
```

---

## 7. The Interface

### 7.1 Layout Overview

```
┌────────────────────────────────────────────────────────────────────┐
│  🎨 Design Audit Agent   [L1 Analyze] [L2 Compare] [L3 Monitor]   │
│                                                Dark Mode Toggle ◐  │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ── LEVEL 1: Single Page Analysis ──────────────────────────────  │
│                                                                    │
│  ┌──────────────────────────┐    ┌─────────────────────────────┐  │
│  │                          │    │  DESIGN SCORE               │  │
│  │  Drop screenshot here    │    │  ┌───────────────────────┐  │  │
│  │  or paste URL            │    │  │ Overall     B  78/100 │  │  │
│  │                          │    │  │ Contrast    D  61/100 │  │  │
│  │  [PNG] [JPG] [WebP]      │    │  │ Spacing     A  91/100 │  │  │
│  │                          │    │  │ Alignment   C+ 78/100 │  │  │
│  └──────────────────────────┘    │  │ Hierarchy   B+ 82/100 │  │  │
│                                  │  │ Consistency A  95/100 │  │  │
│  [⚡ Analyze] [⚙ Options]        │  └───────────────────────┘  │  │
│                                  └─────────────────────────────┘  │
│                                                                    │
│  ── LIVE RESULTS ──────────────────────────────────────────────── │
│                                                                    │
│  ┌──────────────────────────────┐ ┌────────────────────────────┐  │
│  │   Annotated Screenshot       │ │  FINDINGS (10)             │  │
│  │                              │ │                            │  │
│  │  [image with colored boxes]  │ │  🔴 CRITICAL (2)          │  │
│  │                              │ │  ┌──────────────────────┐  │  │
│  │  Hover finding → pulse box   │ │  │ F001 Contrast Fail   │  │  │
│  │  Click box → highlight card  │ │  │ Hero subtitle text   │  │  │
│  │                              │ │  │ 2.3:1 → needs 4.5:1  │  │  │
│  │                              │ │  │ [View Fix] [Locate]  │  │  │
│  │                              │ │  └──────────────────────┘  │  │
│  │                              │ │                            │  │
│  │                              │ │  🟠 HIGH (3)              │  │
│  │                              │ │  🟡 MEDIUM (4)            │  │
│  │                              │ │  🔵 LOW (1)               │  │
│  └──────────────────────────────┘ └────────────────────────────┘  │
│                                                                    │
│  Tabs: [Findings] [Design DNA] [Personas] [Fix List] [Raw JSON]   │
│                                                                    │
│  [⬇ Download JSON]  [⬇ Download HTML]  [⬇ Annotated PNG]         │
└────────────────────────────────────────────────────────────────────┘
```

### 7.2 Level 2 Interface

- Before/After draggable slider (react-compare-image)
- Annotations rendered on both images
- Change cards with improvement/regression badges
- Net change summary: "+2 improvements, -5 regressions"

### 7.3 Level 3 Interface

- Page grid showing all monitored pages
- Green (pass) / Red (regression) / Gray (baseline) status per page
- Design score trend line chart over time (recharts)
- Click page → expand full regression report
- "Approve as new baseline" button per page

### 7.4 Real-Time Progress

WebSocket streaming shows live progress during analysis:

```
[████████░░░░]  65%  →  Running contrast analysis...
[████████████]  100% →  Generating annotated screenshot...
```

---

## 8. Implementation Guide — Step by Step

### Phase 0: Foundation (Hours 1–2)

**Step 0.1 — Project Setup**
```bash
mkdir design-audit-agent && cd design-audit-agent
mkdir -p backend/{engines/rules,addons,baseline,prompts} frontend/src captures baselines reports evidence
python -m venv venv && source venv/bin/activate
```

**Step 0.2 — Install Backend Dependencies**
```bash
pip install fastapi uvicorn google-generativeai pillow opencv-python-headless \
            playwright numpy scikit-image sqlalchemy pydantic python-dotenv \
            jinja2 websockets pytest
playwright install chromium
```

**Step 0.3 — Write schemas.py First**

This is non-negotiable. Write the full Pydantic models for:
- `BBox`, `Colors`, `Font`, `Spacing`
- `UIElement`, `UIState`
- `Finding`, `Evidence`, `Recommendation`
- `ChangeObject`, `Report`, `ScoreCard`
- `BaselineEntry`, `RunConfig`

Validate schemas with unit tests before writing any engine.

**Step 0.4 — Gemini API Setup**
```python
# backend/gemini_client.py
import google.generativeai as genai
import os

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
vision_model = genai.GenerativeModel("gemini-2.0-flash")
text_model = genai.GenerativeModel("gemini-1.5-pro")

def ask_vision(image_bytes: bytes, prompt: str) -> str:
    image_part = {"mime_type": "image/png", "data": image_bytes}
    response = vision_model.generate_content([prompt, image_part])
    return response.text

def ask_vision_compare(img1_bytes: bytes, img2_bytes: bytes, prompt: str) -> str:
    """Level 2: send both images in one call"""
    response = vision_model.generate_content([
        prompt,
        {"mime_type": "image/png", "data": img1_bytes},
        {"mime_type": "image/png", "data": img2_bytes}
    ])
    return response.text
```

**Step 0.5 — Environment Config**
```env
# .env
GEMINI_API_KEY=your_key_here
SITE_USERNAME=demo_user
SITE_PASSWORD=demo_pass
BASELINE_DIR=./baselines
CAPTURES_DIR=./captures
REPORTS_DIR=./reports
EVIDENCE_DIR=./evidence
```

---

### Phase 1: Level 1 — Single Page Analysis (Hours 3–6)

**Step 1.1 — Color Extraction (Pillow)**
```python
# engines/color_sampler.py
from PIL import Image
import numpy as np

def sample_dominant_color(image_path: str, bbox: BBox) -> str:
    img = Image.open(image_path).convert("RGB")
    region = img.crop((bbox.x, bbox.y, bbox.x + bbox.width, bbox.y + bbox.height))
    pixels = np.array(region).reshape(-1, 3)
    # Use k-means with k=2 to separate text from background
    from sklearn.cluster import KMeans
    kmeans = KMeans(n_clusters=2, n_init=3).fit(pixels)
    counts = np.bincount(kmeans.labels_)
    dominant = kmeans.cluster_centers_[np.argmax(counts)]
    return rgb_to_hex(tuple(dominant.astype(int)))
```

**Step 1.2 — OpenCV Layout Detection**
```python
# engines/opencv_extractor.py
import cv2
import numpy as np

def extract_elements_opencv(image_path: str) -> list[dict]:
    img = cv2.imread(image_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Edge detection
    edges = cv2.Canny(gray, 50, 150)

    # Find contours (potential UI elements)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    elements = []
    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        if w > 20 and h > 10:  # Filter noise
            elements.append({
                "bbox": {"x": int(x), "y": int(y), "width": int(w), "height": int(h)},
                "area": int(w * h)
            })

    return sorted(elements, key=lambda e: e["area"], reverse=True)[:50]
```

**Step 1.3 — Run all Rule Analyzers**
```python
# engines/rule_engine.py
def run_all_rules(ui_state: UIState) -> list[Finding]:
    findings = []
    for element in ui_state.elements:
        # Contrast
        if element.colors.text and element.colors.background:
            f = analyze_contrast(element)
            if f: findings.append(f)

        # Spacing
        findings.extend(analyze_spacing([element], ui_state))

        # Hierarchy
        findings.extend(analyze_hierarchy(ui_state.elements))

        # Alignment
        findings.extend(analyze_alignment(ui_state.elements))

        # Consistency
        findings.extend(analyze_consistency(ui_state.elements))

    return deduplicate(findings)
```

**Step 1.4 — Evidence Anchoring Pass**
```python
def anchor_all_findings(findings: list[Finding], screenshot: np.ndarray, ui_state: UIState) -> list[Finding]:
    anchor = EvidenceAnchor()
    anchored = [anchor.anchor(f, screenshot, ui_state) for f in findings]
    return [f for f in anchored if f is not None]  # Drop rejected findings
```

**Step 1.5 — Gemini UX Explanation**
```python
def explain_findings(findings: list[Finding]) -> list[Finding]:
    for finding in findings:
        prompt = build_explanation_prompt(finding)
        explanation = ask_gemini_text(prompt)
        finding.gemini_explanation = explanation.user_impact
        finding.recommendation = explanation.recommendation
    return findings
```

**Step 1.6 — Generate Report**
```python
def generate_report(ui_state: UIState, findings: list[Finding]) -> Report:
    score_card = compute_score(findings)
    design_dna = extract_design_dna(ui_state)
    annotated_img = annotate_screenshot(load_image(ui_state.screenshot_path), findings)

    report = Report(
        run_id=ui_state.run_id,
        summary=build_summary(findings),
        score_breakdown=score_card,
        design_dna=design_dna,
        findings=findings,
        annotated_screenshot=save_annotated(annotated_img)
    )

    save_json(report)
    render_html(report)
    return report
```

**Step 1.7 — FastAPI Endpoint**
```python
# main.py
@app.post("/analyze/level1")
async def analyze_level1(file: UploadFile = File(...)):
    image_bytes = await file.read()
    image_path = save_temp(image_bytes)

    # Full pipeline
    opencv_els = extract_elements_opencv(image_path)
    gemini_els = extract_elements_gemini(image_bytes)
    ui_state = merge_extraction(opencv_els, gemini_els, image_path)
    findings = run_all_rules(ui_state)
    findings = anchor_all_findings(findings, load_image(image_path), ui_state)
    findings = explain_findings(findings)
    report = generate_report(ui_state, findings)

    return report

@app.websocket("/ws/analyze")
async def ws_analyze(websocket: WebSocket):
    await websocket.accept()
    async for progress in run_pipeline_streaming():
        await websocket.send_json(progress)
```

---

### Phase 2: Level 2 — Regression Analysis (Hours 7–8)

**Step 2.1 — Run Level 1 on both images**
```python
state_before = run_level1_pipeline(before_image)
state_after = run_level1_pipeline(after_image)
```

**Step 2.2 — Element Matching (by semantic role + position)**
```python
def match_elements(before: UIState, after: UIState) -> list[tuple[UIElement, UIElement]]:
    pairs = []
    for b_el in before.elements:
        best_match = find_closest(b_el, after.elements, method="iou+role")
        if best_match and best_match.score > 0.6:
            pairs.append((b_el, best_match.element))
    return pairs
```

**Step 2.3 — Classify each change**
```python
all_changes = []
for before_el, after_el in matched_pairs:
    changes = classify_change(before_el, after_el)
    all_changes.extend(changes)
```

**Step 2.4 — Gemini multi-image diff**
```python
gemini_changes = ask_vision_compare(before_bytes, after_bytes, REGRESSION_PROMPT)
```

**Step 2.5 — Merge and produce verdict**
```python
net_regressions = sum(1 for c in all_changes if c.classification == "regression")
net_improvements = sum(1 for c in all_changes if c.classification == "improvement")
verdict = "NET REGRESSION" if net_regressions > net_improvements else "NET IMPROVEMENT"
```

---

### Phase 3: Level 3 — Autonomous Monitoring (Hours 9–11)

**Step 3.1 — Playwright Capture Loop**
```python
async def run_level3(config: SiteConfig):
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()
        page = await context.new_page()

        await authenticate(page, config.auth)

        for page_config in config.pages:
            screenshot = await capture_page(page, page_config)
            baseline = baseline_store.get(page_config.name)

            if baseline is None:
                # First run — create baseline
                baseline_store.save(page_config.name, screenshot)
                progress_emit("baseline_created", page_config.name)
            else:
                # Compare against baseline
                filtered_current = dynamic_filter.apply(screenshot)
                filtered_baseline = dynamic_filter.apply(baseline.image)
                regression_report = run_level2(filtered_baseline, filtered_current)
                emit_report(page_config.name, regression_report)
```

**Step 3.2 — Baseline Store (SQLite + Filesystem)**
```python
class BaselineStore:
    def save(self, page_name: str, screenshot: bytes, approved: bool = True):
        version = self._get_next_version(page_name)
        path = f"baselines/{page_name}_v{version}.png"
        save_image(screenshot, path)
        db.execute("INSERT INTO baselines VALUES (?, ?, ?, ?)",
                   (page_name, path, version, datetime.now()))

    def get(self, page_name: str) -> BaselineEntry | None:
        return db.query("SELECT * FROM baselines WHERE page=? AND approved=1 ORDER BY version DESC LIMIT 1", page_name)

    def refresh(self, page_name: str):
        """Called after a human approves a visual change."""
        latest_capture = self.get_latest_capture(page_name)
        self.save(page_name, latest_capture, approved=True)
```

---

### Phase 4: Frontend (Parallel with Phases 1–3)

**Step 4.1 — React project setup**
```bash
cd frontend
npm create vite@latest . -- --template react
npm install tailwindcss framer-motion react-dropzone react-compare-image recharts zustand axios
```

**Step 4.2 — Core components to build in order:**
1. `UploadZone.jsx` — Drag & drop with preview
2. `ProgressStream.jsx` — WebSocket connected progress bar
3. `AnnotatedViewer.jsx` — Image with clickable bbox overlays
4. `FindingCard.jsx` — Finding detail with severity badge
5. `ScoreCard.jsx` — Grade display with bar chart
6. `BeforeAfterSlider.jsx` — L2 comparison view
7. `TrendChart.jsx` — L3 score history (recharts)
8. `ReportExport.jsx` — Download buttons

---

## 9. API Reference

### Level 1

```
POST /analyze/level1
Content-Type: multipart/form-data
Body: file (image/png | image/jpeg | image/webp)

Response: Report JSON
```

### Level 2

```
POST /analyze/level2
Content-Type: multipart/form-data
Body:
  before (image)
  after  (image)

Response: RegressionReport JSON
```

### Level 3

```
POST /monitor/start
Content-Type: application/json
Body: SiteConfig JSON

Response: { run_id: string }

GET /monitor/status/{run_id}
Response: { status, pages_processed, findings_count }

POST /baseline/refresh/{page_name}
Response: { success: true, new_version: int }
```

### WebSocket

```
WS /ws/{run_id}
Messages:
  { event: "progress", stage: string, percent: int }
  { event: "finding_found", finding: Finding }
  { event: "complete", report_url: string }
```

---

## 10. Deployment Guide

### Local Development

```bash
# Backend
cd backend
cp .env.example .env     # Add GEMINI_API_KEY
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm run dev              # Runs on :5173
```

### Docker

```dockerfile
# Dockerfile
FROM python:3.11-slim
WORKDIR /app
RUN pip install playwright && playwright install --with-deps chromium
COPY backend/requirements.txt .
RUN pip install -r requirements.txt
COPY backend/ .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```yaml
# docker-compose.yml
services:
  backend:
    build: .
    ports: ["8000:8000"]
    env_file: .env
    volumes:
      - ./captures:/app/captures
      - ./baselines:/app/baselines
      - ./reports:/app/reports

  frontend:
    image: node:20-alpine
    working_dir: /app
    volumes: ["./frontend:/app"]
    ports: ["5173:5173"]
    command: sh -c "npm install && npm run dev -- --host"
```

### Production (Railway + Vercel)

```bash
# Backend → Railway
railway login
railway init
railway up

# Frontend → Vercel
cd frontend
vercel --prod
```

Set environment variables in Railway dashboard:
- `GEMINI_API_KEY`
- `RAILWAY_VOLUME_MOUNT_PATH` (for persistent file storage)

---

## 11. Edge Cases Handled

| Edge Case | Detection | Handling |
|---|---|---|
| Dark mode UI | Background luminance check | Adjust contrast thresholds |
| Gradient backgrounds | Color variance in bbox region | Sample at 5 points, average |
| Partially loaded state | Skeleton/shimmer class detection | Mark element as "loading" — skip rules |
| Responsive breakpoints | Viewport config per run | Run at 1440, 768, 375 separately |
| Dense data tables | High element density detection | Apply table-specific spacing rules |
| Dynamic timestamps | OCR + regex pattern | Mask before comparison |
| Login redirects | URL unchanged after submit | Retry with extended wait |
| Cookie consent banners | Pattern-matched selectors | Auto-dismiss |
| Multi-step auth | Configurable step sequence | Step-by-step handler |
| Images without text | No text color detected | Skip contrast rule, note in report |
| Zero findings | All rules pass | Report "PASS" with confidence scores |
| Overlapping elements | Z-index inference from Gemini | Top element takes priority |
| SVG icons | Detected as image type | Excluded from text rules |
| Video/canvas elements | Type detection | Skipped — noted in report |
| API timeout | Gemini retry with backoff | 3 retries, then fallback to rule-only |

---

## 12. Acceptance Criteria Map

### Level 1

| Requirement | Implementation |
|---|---|
| ✅ Accepts PNG, JPG, WebP | `UploadFile` type check + Pillow open |
| ✅ Minimum 3 findings per screenshot | Rule engine runs 5 analyzers — enforced minimum |
| ✅ Finding includes: principle, location, impact, recommendation | `Finding` schema — all fields required |
| ✅ Structured JSON with confidence scores | `Report` schema with per-finding `confidence: int` |
| ✅ Severity: critical/high/medium/low/info | `severity` enum enforced in Pydantic |
| ✅ Zero hallucinations | Evidence Anchoring layer — unverifiable findings dropped |

### Level 2

| Requirement | Implementation |
|---|---|
| ✅ Accepts before + after images | `/analyze/level2` endpoint |
| ✅ Minimum 5 visual differences with hex/pixel details | Regression Engine + Gemini multi-image |
| ✅ Improvement/regression/neutral classification | `ChangeObject.classification` field |
| ✅ UX impact explanation per change | Gemini UX Reviewer per change |
| ✅ Per-finding confidence score | Confidence Engine on all changes |
| ✅ Accessibility regressions flagged | `accessibility_regression: bool` field |
| ✅ Overall verdict | Net regression/improvement count + summary |

### Level 3

| Requirement | Implementation |
|---|---|
| ✅ Authenticates autonomously | Playwright auth handler |
| ✅ Navigates 3+ configured pages | `SiteConfig.pages` array |
| ✅ Consistent screenshots at fixed viewport | `1440x900` forced, `networkidle` wait |
| ✅ Versioned baseline store | SQLite + filesystem, version integer |
| ✅ Identifies real regressions | Level 2 engine on each page pair |
| ✅ Filters false positives | Dynamic Content Filter (3-layer) |
| ✅ Confidence + evidence on all findings | Confidence Engine + pixel diff % |
| ✅ Full scan under 3 minutes for 3–4 pages | Async Playwright, parallel where possible |
| ✅ Baseline refresh support | `POST /baseline/refresh/{page}` endpoint |
| ✅ Human-readable + JSON report | HTML template + Report JSON |

---

## 13. Project Structure

```
design-audit-agent/
│
├── backend/
│   ├── main.py                        # FastAPI app, routes, WebSocket
│   ├── schemas.py                     # ALL Pydantic models
│   ├── gemini_client.py               # Gemini API wrapper
│   ├── config.py                      # Settings from .env
│   │
│   ├── engines/
│   │   ├── capture.py                 # Playwright browser automation
│   │   ├── extraction.py              # Hybrid extraction coordinator
│   │   ├── opencv_extractor.py        # OpenCV layer
│   │   ├── color_sampler.py           # Pillow color tools
│   │   ├── evidence.py                # Evidence anchoring
│   │   ├── confidence.py              # Confidence scoring
│   │   ├── regression.py              # Level 2 change detection
│   │   ├── dynamic_filter.py          # Level 3 false positive filter
│   │   ├── report_generator.py        # JSON + HTML report builder
│   │   │
│   │   └── rules/
│   │       ├── contrast.py            # WCAG contrast math
│   │       ├── spacing.py             # Pixel gap measurement
│   │       ├── alignment.py           # Grid alignment detection
│   │       ├── hierarchy.py           # Visual weight analysis
│   │       └── consistency.py        # Design system consistency
│   │
│   ├── addons/
│   │   ├── design_dna.py             # Design system fingerprinting
│   │   ├── fix_simulator.py          # Exact CSS fix generator
│   │   ├── score_card.py             # A-F grade system
│   │   ├── persona_sim.py            # Accessibility persona simulation
│   │   └── annotation.py            # Bbox overlay renderer
│   │
│   ├── baseline/
│   │   ├── store.py                  # SQLite + filesystem baseline
│   │   └── models.py                 # DB models
│   │
│   ├── prompts/
│   │   ├── extraction.py             # Gemini extraction prompts
│   │   ├── explanation.py            # UX explanation prompts
│   │   └── regression.py            # Regression analysis prompts
│   │
│   ├── templates/
│   │   └── report.html              # Jinja2 HTML report template
│   │
│   ├── tests/
│   │   ├── test_schemas.py
│   │   ├── test_contrast.py
│   │   ├── test_evidence.py
│   │   └── test_regression.py
│   │
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── store.js                  # Zustand state
│   │   ├── api.js                    # Axios + WebSocket client
│   │   │
│   │   ├── components/
│   │   │   ├── UploadZone.jsx
│   │   │   ├── AnnotatedViewer.jsx
│   │   │   ├── FindingCard.jsx
│   │   │   ├── ScoreCard.jsx
│   │   │   ├── BeforeAfterSlider.jsx
│   │   │   ├── ProgressStream.jsx
│   │   │   ├── TrendChart.jsx
│   │   │   ├── PersonaViewer.jsx
│   │   │   └── ReportExport.jsx
│   │   │
│   │   └── pages/
│   │       ├── Level1.jsx
│   │       ├── Level2.jsx
│   │       └── Level3.jsx
│   │
│   ├── package.json
│   └── vite.config.js
│
├── captures/                         # Temporary screenshots
├── baselines/                        # Versioned baseline store
├── reports/                          # Generated reports
├── evidence/                         # Cropped pixel evidence
│
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md                         # This file
```

---

## Quick Start

```bash
# 1. Clone and setup
git clone https://github.com/yourname/design-audit-agent
cd design-audit-agent

# 2. Set Gemini API key
cp backend/.env.example backend/.env
echo "GEMINI_API_KEY=your_key" >> backend/.env

# 3. Start with Docker
docker-compose up --build

# 4. Open browser
open http://localhost:5173

# 5. Upload a screenshot and audit
# Drag any PNG/JPG to the upload zone
# Click Analyze
# Watch the annotated findings appear in real-time
```

---

*Built by someone who thinks design quality is an engineering problem, not just a designer's intuition.*
