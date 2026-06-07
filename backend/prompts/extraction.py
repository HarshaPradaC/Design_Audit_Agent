EXTRACTION_PROMPT = """
You are a precise UI element extractor. Analyze this screenshot and return ONLY valid JSON.

For each visible UI element, extract:
- type: one of (button | input | text | image | card | nav | table | icon | badge | form | header | footer | sidebar | modal | tooltip | dropdown | checkbox | radio | select | textarea | link | list | divider | avatar | tag | progress | spinner)
- semantic_role: one of (primary_cta | secondary_cta | heading_h1 | heading_h2 | heading_h3 | body_text | label | nav_item | breadcrumb | tab | card_title | card_body | form_label | form_input | error_message | success_message | warning | info | hero_text | subtitle | caption | footer_link | logo | search | filter | pagination | data_cell | column_header)
- approximate_bbox: {x, y, width, height} in pixels from top-left corner
- text_content: visible text (empty string if none)
- visual_weight: one of (dominant | prominent | standard | subtle)
- hierarchy_level: integer 1 (most prominent) to 5 (least)

Rules:
1. Only report elements actually visible in this screenshot — no inference
2. If you cannot determine a value confidently, use null
3. Return ONLY the JSON object — no explanation, no preamble, no markdown fences
4. Aim for 15–40 elements. Skip micro-elements under 8px in either dimension.

Format: {"elements": [...]}
"""

EXTRACTION_SYSTEM = "You are a UI analysis system that returns only valid JSON. Never add explanation."
