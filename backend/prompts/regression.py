REGRESSION_PROMPT = """
You are comparing two UI screenshots: BEFORE (first image) and AFTER (second image) a code change.

Analyze both images and identify every visual difference. For each difference return:
1. "type": what changed (color_change | size_change | position_change | text_change | element_added | element_removed | spacing_change | font_change)
2. "element_description": what element changed (be specific)
3. "before_value": the value before (hex color, px size, etc.)
4. "after_value": the value after
5. "classification": "regression" | "improvement" | "neutral"
6. "reasoning": one sentence why you classified it this way
7. "accessibility_regression": true if contrast, size, or readability got worse

Classify as REGRESSION if:
- Contrast decreased (text harder to read)
- Elements became smaller or harder to tap
- Visual hierarchy became less clear
- Spacing became more cramped
- Important elements were removed or hidden

Classify as IMPROVEMENT if:
- Contrast increased
- Elements became more accessible
- Hierarchy became clearer
- Touch targets got larger

Return ONLY JSON. Format: {"changes": [...], "summary": "one sentence overall verdict"}
"""
