"""Color sampling utilities using Pillow — deterministic, never hallucinate."""
import numpy as np
from PIL import Image
from sklearn.cluster import KMeans
from schemas import BBox


def rgb_to_hex(rgb: tuple) -> str:
    return "#{:02x}{:02x}{:02x}".format(int(rgb[0]), int(rgb[1]), int(rgb[2]))


def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 3:
        hex_color = "".join(c * 2 for c in hex_color)
    return int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)


def sample_dominant_color(image: np.ndarray, bbox: BBox, n_clusters: int = 2) -> str:
    """Extract most common color in a bounding box region using k-means."""
    x, y, w, h = bbox.x, bbox.y, bbox.width, bbox.height
    # Clamp to image bounds
    img_h, img_w = image.shape[:2]
    x1 = max(0, x)
    y1 = max(0, y)
    x2 = min(img_w, x + w)
    y2 = min(img_h, y + h)

    if x2 <= x1 or y2 <= y1:
        return "#808080"

    region = image[y1:y2, x1:x2]
    if region.size == 0:
        return "#808080"

    # Convert BGR (OpenCV) to RGB
    if len(region.shape) == 3 and region.shape[2] == 3:
        region = region[:, :, ::-1]

    pixels = region.reshape(-1, 3).astype(float)

    if len(pixels) < n_clusters:
        avg = pixels.mean(axis=0)
        return rgb_to_hex(tuple(avg))

    try:
        kmeans = KMeans(n_clusters=n_clusters, n_init=3, random_state=42)
        kmeans.fit(pixels)
        counts = np.bincount(kmeans.labels_)
        dominant_idx = np.argmax(counts)
        dominant_color = kmeans.cluster_centers_[dominant_idx]
        return rgb_to_hex(tuple(dominant_color))
    except Exception:
        avg = pixels.mean(axis=0)
        return rgb_to_hex(tuple(avg))


def sample_text_and_background(image: np.ndarray, bbox: BBox) -> tuple[str, str]:
    """
    Sample text color (darker cluster) and background (lighter cluster)
    from a bounding box region.
    """
    x, y, w, h = bbox.x, bbox.y, bbox.width, bbox.height
    img_h, img_w = image.shape[:2]
    x1, y1 = max(0, x), max(0, y)
    x2, y2 = min(img_w, x + w), min(img_h, y + h)

    if x2 <= x1 or y2 <= y1:
        return "#000000", "#ffffff"

    region = image[y1:y2, x1:x2]
    if len(region.shape) == 3 and region.shape[2] == 3:
        region = region[:, :, ::-1]  # BGR → RGB

    pixels = region.reshape(-1, 3).astype(float)

    if len(pixels) < 2:
        return "#000000", "#ffffff"

    try:
        kmeans = KMeans(n_clusters=2, n_init=3, random_state=42)
        kmeans.fit(pixels)
        centers = kmeans.cluster_centers_
        counts = np.bincount(kmeans.labels_)

        # Lighter color = background (higher luminance sum)
        lum = [0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] for c in centers]
        bg_idx = int(np.argmax(lum))
        text_idx = 1 - bg_idx

        bg_color = rgb_to_hex(tuple(centers[bg_idx]))
        text_color = rgb_to_hex(tuple(centers[text_idx]))
        return text_color, bg_color
    except Exception:
        return "#000000", "#ffffff"


def get_dominant_color(image: np.ndarray) -> str:
    """Get single dominant color of an entire image region."""
    if image.size == 0:
        return "#808080"
    if len(image.shape) == 3 and image.shape[2] == 3:
        region_rgb = image[:, :, ::-1]
    else:
        region_rgb = image
    pixels = region_rgb.reshape(-1, 3).astype(float)
    avg = pixels.mean(axis=0)
    return rgb_to_hex(tuple(avg))


def image_to_numpy(image_path: str) -> np.ndarray:
    """Load image as numpy array in BGR format (OpenCV convention)."""
    import cv2
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Could not load image: {image_path}")
    return img


def numpy_to_pil(image: np.ndarray) -> Image.Image:
    rgb = image[:, :, ::-1]  # BGR → RGB
    return Image.fromarray(rgb.astype(np.uint8))
