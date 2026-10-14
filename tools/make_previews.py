"""Regenerate the preview images in docs/ from the pages in overlays/.

  docs/vertical-layouts.png   every page on a 1080x1920 canvas
  docs/alerts.png             the four alert types
  docs/stinger.gif            the stinger transition between two scenes

Usage:  python3 tools/make_previews.py
Needs:  pip install playwright pillow   (and a Chromium for Playwright)
"""

import io
import pathlib

from PIL import Image
from playwright.sync_api import sync_playwright

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGES_DIR = REPO_ROOT / "overlays"
DOCS_DIR = REPO_ROOT / "docs"

VERTICAL_SIZE = (1080, 1920)
LANDSCAPE_SIZE = (1920, 1080)
BACKGROUND_GREY = (30, 30, 30)
ENTRANCE_ANIMATION_MS = 2500   # the pages fade in; wait until they have finished

# Draws the stinger at an exact point in the transition, using the page's own renderFrame function.
SHOW_STINGER_AT_PROGRESS = """(progress) => {
  cancelAnimationFrame(animationFrameId);
  gradientStripe.style.visibility = 'visible';
  inkPanel.style.visibility = 'visible';
  renderFrame(progress);
}"""


def page_url(file_name, query=""):
    return (PAGES_DIR / file_name).as_uri() + query


def new_page(browser, size):
    context = browser.new_context(viewport={"width": size[0], "height": size[1]})
    context.route("**/fonts.g*apis.com/**", lambda route: route.abort())  # keep previews fast and offline-safe
    return context.new_page()


def screenshot_image(page):
    return Image.open(io.BytesIO(page.screenshot())).convert("RGB")


def make_vertical_sheet(browser):
    scenes = [
        ("starting.html", "?minutes=5&next=Ranked%20grind"),
        ("brb.html", "?msg=Grabbing%20coffee&minutes=5"),
        ("ending.html", "?next=Friday%208pm&socials=twitter/you,youtube/you"),
        ("webcam.html", "?bg=1&name=Alex&title=Ranked%20grind"),
        ("screenshare.html", "?bg=1"),
        ("screenshare-side.html", "?bg=1"),
        ("overlay.html", "?bg=1&goal=42"),
        ("../transitions/stinger.html", "?bg=1&word=Be%20right%20back"),
    ]
    thumbnail_size = (360, 640)
    columns = 4
    sheet = Image.new("RGB", (thumbnail_size[0] * columns, thumbnail_size[1] * 2), BACKGROUND_GREY)

    for index, (file_name, query) in enumerate(scenes):
        page = new_page(browser, VERTICAL_SIZE)
        page.goto(page_url(file_name, query), wait_until="domcontentloaded")
        page.wait_for_timeout(ENTRANCE_ANIMATION_MS)
        if file_name == "overlay.html":
            page.evaluate("window.overlay.alert('sub', 'pixelparade', 'Tier 1 · 3 months')")
            page.wait_for_timeout(1300)
        if file_name == "stinger.html":
            page.evaluate(SHOW_STINGER_AT_PROGRESS, 0.5)
        thumbnail = screenshot_image(page).resize(thumbnail_size)
        sheet.paste(thumbnail, ((index % columns) * thumbnail_size[0], (index // columns) * thumbnail_size[1]))
        page.context.close()

    sheet.save(DOCS_DIR / "vertical-layouts.png")
    print("wrote docs/vertical-layouts.png")


def make_alerts_image(browser):
    alerts = [
        ("follow", "Nova_Fox", ""),
        ("sub", "pixelparade", "Tier 1 · 3 months"),
        ("raid", "quietstorm", "42 viewers"),
        ("tip", "mx_halcyon", '$5.00 · "great stream!"'),
    ]
    crop_margin = 40
    crops = []
    for kind, username, detail in alerts:
        page = new_page(browser, LANDSCAPE_SIZE)
        page.goto(page_url("overlay.html", "?bg=1&lower=0&goal=0"), wait_until="domcontentloaded")
        page.wait_for_timeout(800)
        page.evaluate("([kind, username, detail]) => window.overlay.alert(kind, username, detail)",
                      [kind, username, detail])
        page.wait_for_timeout(1300)
        left, top, right, bottom = page.evaluate(
            "(() => { const box = document.getElementById('alert').getBoundingClientRect();"
            " return [box.left, box.top, box.right, box.bottom]; })()")
        crops.append(screenshot_image(page).crop((
            max(0, int(left) - crop_margin), max(0, int(top) - crop_margin),
            int(right) + crop_margin, int(bottom) + crop_margin)))
        page.context.close()

    width = max(crop.width for crop in crops) + 40
    height = sum(crop.height for crop in crops) + 10 * (len(crops) + 1)
    sheet = Image.new("RGB", (width, height), BACKGROUND_GREY)
    next_top = 10
    for crop in crops:
        sheet.paste(crop, ((width - crop.width) // 2, next_top))
        next_top += crop.height + 10
    sheet.save(DOCS_DIR / "alerts.png")
    print("wrote docs/alerts.png")


def make_stinger_gif(browser):
    frame_count = 36
    transition_point = 0.5
    size = (1280, 720)

    page = new_page(browser, size)
    page.goto(page_url("../transitions/stinger.html", "?word=Be%20right%20back&channel=yourchannel"), wait_until="domcontentloaded")
    # Two scenes sit behind the stinger: the first until the midpoint, then the second.
    page.evaluate("""() => {
      const addScene = (id, source) => {
        const frame = document.createElement('iframe');
        frame.id = id;
        frame.src = source;
        frame.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:-1';
        document.body.appendChild(frame);
      };
      addScene('firstScene', '../overlays/starting.html?minutes=5&next=Ranked%20grind');
      addScene('secondScene', '../overlays/brb.html?msg=Grabbing%20coffee');
      document.getElementById('secondScene').style.visibility = 'hidden';
    }""")
    page.wait_for_timeout(ENTRANCE_ANIMATION_MS)

    frames = []
    for frame_index in range(frame_count):
        progress = frame_index / (frame_count - 1)
        scene_swapped = progress >= transition_point
        page.evaluate("""([progress, sceneSwapped]) => {
          document.getElementById('firstScene').style.visibility = sceneSwapped ? 'hidden' : 'visible';
          document.getElementById('secondScene').style.visibility = sceneSwapped ? 'visible' : 'hidden';
          cancelAnimationFrame(animationFrameId);
          transitionPoint = %s;
          gradientStripe.style.visibility = 'visible';
          inkPanel.style.visibility = 'visible';
          renderFrame(progress);
        }""" % transition_point, [progress, scene_swapped])
        frames.append(screenshot_image(page).resize((800, 450)))
    page.context.close()

    frames[0].save(DOCS_DIR / "stinger.gif", save_all=True, append_images=frames[1:],
                   duration=45, loop=0, optimize=True)
    print("wrote docs/stinger.gif")


def main():
    DOCS_DIR.mkdir(exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        make_vertical_sheet(browser)
        make_alerts_image(browser)
        make_stinger_gif(browser)
        browser.close()


if __name__ == "__main__":
    main()
