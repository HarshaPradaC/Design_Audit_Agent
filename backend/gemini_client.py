import google.generativeai as genai
from config import settings

genai.configure(api_key=settings.gemini_api_key)

_vision_model = None
_text_model = None


def _get_vision_model():
    global _vision_model
    if _vision_model is None:
        _vision_model = genai.GenerativeModel("gemini-2.0-flash")
    return _vision_model


def _get_text_model():
    global _text_model
    if _text_model is None:
        _text_model = genai.GenerativeModel("gemini-2.0-flash")
    return _text_model


def ask_vision(image_bytes: bytes, prompt: str) -> str:
    model = _get_vision_model()
    image_part = {"mime_type": "image/png", "data": image_bytes}
    response = model.generate_content([prompt, image_part])
    return response.text


def ask_vision_compare(img1_bytes: bytes, img2_bytes: bytes, prompt: str) -> str:
    """Send both before/after images in one call for L2 regression."""
    model = _get_vision_model()
    response = model.generate_content([
        prompt,
        {"mime_type": "image/png", "data": img1_bytes},
        {"mime_type": "image/png", "data": img2_bytes},
    ])
    return response.text


def ask_text(prompt: str) -> str:
    model = _get_text_model()
    response = model.generate_content(prompt)
    return response.text
