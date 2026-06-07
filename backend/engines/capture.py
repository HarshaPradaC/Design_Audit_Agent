"""Playwright capture engine — autonomously navigate and screenshot live sites."""
import asyncio
import os
from pathlib import Path
from schemas import SiteConfig, PageConfig, AuthConfig, CaptureResult
from config import settings

DEFAULT_DYNAMIC_SELECTORS = [
    "[data-testid*='timestamp']",
    "[class*='time']",
    "[class*='date']",
    "[class*='badge']",
    "[class*='notification-count']",
    "[class*='spinner']",
    "[class*='loader']",
    "[class*='skeleton']",
    "[class*='loading']",
]

# Chrome flags that stabilise headless on Windows
CHROMIUM_ARGS = [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-sync",
    "--no-first-run",
    "--disable-default-apps",
    "--mute-audio",
]


async def mask_dynamic_content(page, selectors: list[str]):
    """Hide dynamic elements before screenshot."""
    for selector in selectors:
        try:
            await page.evaluate(f"""
                document.querySelectorAll('{selector}').forEach(el => {{
                    el.style.visibility = 'hidden';
                }});
            """)
        except Exception:
            pass


async def authenticate(context, auth_config: AuthConfig, base_url: str):
    """Handle form-based login."""
    if auth_config.type == "none" or not auth_config.login_url:
        return None

    page = await context.new_page()
    login_url = (
        auth_config.login_url
        if auth_config.login_url.startswith("http")
        else base_url + auth_config.login_url
    )

    try:
        await page.goto(login_url, wait_until="load", timeout=20000)
    except Exception:
        await page.goto(login_url, wait_until="domcontentloaded", timeout=15000)

    username = os.getenv("SITE_USERNAME", settings.site_username)
    password = os.getenv("SITE_PASSWORD", settings.site_password)

    if auth_config.username_selector:
        await page.fill(auth_config.username_selector, username)
    if auth_config.password_selector:
        await page.fill(auth_config.password_selector, password)
    if auth_config.submit_selector:
        await page.click(auth_config.submit_selector)

    try:
        await page.wait_for_load_state("load", timeout=12000)
    except Exception:
        pass

    return page


async def capture_page(
    context,
    base_url: str,
    page_config: PageConfig,
    viewport: dict,
) -> CaptureResult:
    """Navigate to a page and capture a clean screenshot."""
    page = await context.new_page()
    await page.set_viewport_size({
        "width":  viewport.get("width",  1440),
        "height": viewport.get("height", 900),
    })

    url = (
        page_config.path
        if page_config.path.startswith("http")
        else base_url.rstrip("/") + page_config.path
    )

    # Navigate — prefer "load" over domcontentloaded for SPA compatibility;
    # avoid "networkidle" which hangs on sites with polling or analytics.
    nav_ok = False
    for wait_state, timeout_ms in [("load", 20000), ("domcontentloaded", 15000), ("commit", 10000)]:
        try:
            await page.goto(url, wait_until=wait_state, timeout=timeout_ms)
            nav_ok = True
            break
        except Exception:
            continue

    if not nav_ok:
        await page.close()
        raise RuntimeError(f"Could not navigate to {url}")

    # Wait for configured selector
    if page_config.wait_for:
        try:
            await page.wait_for_selector(page_config.wait_for, timeout=6000)
        except Exception:
            pass

    # Fixed settle time — avoids networkidle hanging on live sites with polling
    await asyncio.sleep(1.5)

    # Scroll
    if page_config.scroll_to == "bottom":
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await asyncio.sleep(0.5)
    else:
        await page.evaluate("window.scrollTo(0, 0)")

    # Mask dynamic content
    all_selectors = DEFAULT_DYNAMIC_SELECTORS + (page_config.dynamic_masks or [])
    await mask_dynamic_content(page, all_selectors)

    # Dismiss cookie banners
    for sel in ["[id*='cookie'] button", "[class*='cookie'] button", "#accept-cookies", ".cookie-accept", "[aria-label*='cookie' i] button"]:
        try:
            btn = await page.query_selector(sel)
            if btn:
                await btn.click()
                await asyncio.sleep(0.25)
                break
        except Exception:
            pass

    screenshot_bytes = await page.screenshot(full_page=False, type="png")
    await page.close()

    path = Path(settings.captures_dir) / f"{page_config.name}_latest.png"
    with open(path, "wb") as f:
        f.write(screenshot_bytes)

    return CaptureResult(
        image_bytes=screenshot_bytes,
        url=url,
        page_name=page_config.name,
        screenshot_path=str(path),
    )


async def run_capture_session(config: SiteConfig) -> list[CaptureResult]:
    """Open browser, authenticate once, capture all pages, close."""
    from playwright.async_api import async_playwright

    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=CHROMIUM_ARGS,
        )
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            ignore_https_errors=True,
        )

        viewport = {"width": config.viewport.width, "height": config.viewport.height}

        if config.auth.type != "none":
            try:
                await authenticate(context, config.auth, config.url)
            except Exception as e:
                print(f"[capture] Auth failed (continuing): {e}")

        for page_config in config.pages:
            try:
                result = await asyncio.wait_for(
                    capture_page(context, config.url, page_config, viewport),
                    timeout=45.0,
                )
                results.append(result)
                print(f"[capture] OK: {page_config.name} → {result.url}")
            except asyncio.TimeoutError:
                print(f"[capture] Timeout on {page_config.name}")
            except Exception as e:
                print(f"[capture] Failed {page_config.name}: {e}")

        await browser.close()

    return results
