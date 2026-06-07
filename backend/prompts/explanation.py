def build_explanation_prompt(finding) -> str:
    return f"""
You are a senior UX accessibility consultant writing a concise audit finding.

FINDING:
- Principle: {finding.principle}
- Severity: {finding.severity}
- Element location: {finding.location.description or 'unknown'}
- Measured: {finding.evidence.measured_value}
- Required: {finding.evidence.required_value}
- Element type: {finding.location.element_id or 'unknown'}

Write two things as JSON:
1. "user_impact": One sentence explaining the REAL user harm. Be specific — name who is affected and how (e.g. "Users with low vision cannot read this label in bright light conditions.")
2. "action": One concrete fix action in plain English.
3. "current_css": The current CSS property causing the issue (e.g. "color: #9CA3AF;")
4. "suggested_css": The exact CSS fix (e.g. "color: #6B7280;")
5. "result": What the fix achieves (e.g. "Achieves 4.6:1 contrast — WCAG AA compliant")

Return ONLY the JSON. No explanation.
Format: {{"user_impact": "...", "action": "...", "current_css": "...", "suggested_css": "...", "result": "..."}}
"""


def build_hierarchy_explanation_prompt(finding) -> str:
    return f"""
You are a UX auditor. Write a brief explanation for this visual hierarchy finding.

Principle: {finding.principle}
Evidence: {finding.evidence.model_dump() if hasattr(finding.evidence, 'model_dump') else finding.evidence}

Return JSON: {{"user_impact": "...", "action": "...", "current_css": "...", "suggested_css": "...", "result": "..."}}
"""
