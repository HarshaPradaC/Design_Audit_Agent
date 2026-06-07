"""Accessibility persona simulation — generate color-blindness filtered screenshots."""
import numpy as np
from PIL import Image
from pathlib import Path
from config import settings

PERSONA_MATRICES = {
    "deuteranopia": [
        [0.625, 0.375, 0.000],
        [0.700, 0.300, 0.000],
        [0.000, 0.300, 0.700],
    ],
    "protanopia": [
        [0.567, 0.433, 0.000],
        [0.558, 0.442, 0.000],
        [0.000, 0.242, 0.758],
    ],
    "tritanopia": [
        [0.950, 0.050, 0.000],
        [0.000, 0.433, 0.567],
        [0.000, 0.475, 0.525],
    ],
    "achromatopsia": [
        [0.299, 0.587, 0.114],
        [0.299, 0.587, 0.114],
        [0.299, 0.587, 0.114],
    ],
}


def simulate_persona(image: np.ndarray, persona: str) -> np.ndarray:
    """Apply color-blindness transformation matrix to an image (RGB numpy array)."""
    if persona not in PERSONA_MATRICES:
        return image
    matrix = PERSONA_MATRICES[persona]
    # image expected as RGB
    r = image[:, :, 0].astype(float)
    g = image[:, :, 1].astype(float)
    b = image[:, :, 2].astype(float)
    new_r = np.clip(matrix[0][0] * r + matrix[0][1] * g + matrix[0][2] * b, 0, 255)
    new_g = np.clip(matrix[1][0] * r + matrix[1][1] * g + matrix[1][2] * b, 0, 255)
    new_b = np.clip(matrix[2][0] * r + matrix[2][1] * g + matrix[2][2] * b, 0, 255)
    return np.stack([new_r, new_g, new_b], axis=2).astype(np.uint8)


def generate_persona_images(image_np: np.ndarray, run_id: str) -> dict[str, str]:
    """Generate all persona simulations and save them. Returns {persona: path}."""
    # Convert BGR (OpenCV) → RGB for PIL
    rgb_image = image_np[:, :, ::-1]
    results = {}
    reports_dir = Path(settings.reports_dir)

    for persona in PERSONA_MATRICES:
        try:
            simulated = simulate_persona(rgb_image, persona)
            pil_img = Image.fromarray(simulated)
            filename = f"{run_id}_{persona}.png"
            path = reports_dir / filename
            pil_img.save(str(path))
            results[persona] = filename  # filename only — served via /reports/<filename>
        except Exception as e:
            print(f"[persona_sim] Failed for {persona}: {e}")

    return results
