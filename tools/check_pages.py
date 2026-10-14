"""Render every overlay page at several screen sizes and check that it works.

Checks:
  * no JavaScript errors on any page
  * nothing is positioned outside the screen, at every size
  * the behaviors that matter: alerts, postMessage, URL parameters, countdowns, stinger events

Usage:  python3 tools/check_pages.py
Needs:  pip install playwright pillow   (and a Chromium for Playwright)
"""

import pathlib
import subprocess
import time
import sys

from playwright.sync_api import sync_playwright

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGES_DIR = REPO_ROOT / "src" / "overlays"

PAGE_URLS = {
    "starting": "http://127.0.0.1:8099/src/overlays/starting.html?minutes=5&next=Ranked%20grind",
    "brb": "http://127.0.0.1:8099/src/overlays/brb.html?msg=Grabbing%20coffee&minutes=5",
    "ending": "http://127.0.0.1:8099/src/overlays/ending.html?next=Friday%208pm&socials=twitter/you,youtube/you",
    "webcam": "http://127.0.0.1:8099/src/overlays/webcam.html?bg=1&name=Alex",
    "screenshare": "http://127.0.0.1:8099/src/overlays/screenshare.html?bg=1",
    "screenshare-noname": "http://127.0.0.1:8099/src/overlays/screenshare-noname.html?bg=1",
    "screenshare-side": "http://127.0.0.1:8099/src/overlays/screenshare-side.html?bg=1",
    "screenshare-side-noname": "http://127.0.0.1:8099/src/overlays/screenshare-side-noname.html?bg=1",
    "overlay": "http://127.0.0.1:8099/src/overlays/overlay.html?bg=1&goal=42",
    "overlay-noname": "http://127.0.0.1:8099/src/overlays/overlay-noname.html?bg=1&goal=42",
    "stinger": "http://127.0.0.1:8099/src/transitions/stinger.html?bg=1&word=Be%20right%20back",
}

SCREEN_SIZES = {
    "vertical-1080x1920": (1080, 1920),
    "phone": (390, 844),
    "tablet": (768, 1024),
    "full-hd": (1920, 1080),
    "2k": (2560, 1440),
    "4k": (3840, 2160),
}

# Elements that must stay on screen.
ON_SCREEN_SELECTOR = (
    ".panel, h1, h2, .cam, .hole, .count, .track, .cols, .subtitle, .next, .chip,"
    " .info, .goal, .alert, .card, .message-content, .plate"
)

FIND_ELEMENTS_OFF_SCREEN = """(selector) => {
  const offScreen = [];
  document.querySelectorAll(selector).forEach(element => {
    const style = getComputedStyle(element);
    if (style.visibility === 'hidden' || style.display === 'none') return;
    const box = element.getBoundingClientRect();
    if (box.width === 0) return;
    const alertIsHidden = element.closest('.alert') && !document.getElementById('alert').classList.contains('on');
    const sceneIsHidden = element.closest('.scene') && !document.getElementById('scene').classList.contains('on');
    if (alertIsHidden || sceneIsHidden) return;
    const isOutside = box.right > innerWidth + 2 || box.left < -2 || box.bottom > innerHeight + 2 || box.top < -2;
    if (isOutside) offScreen.push((element.id || element.className) + ' ' + Math.round(box.left) + ',' + Math.round(box.top));
  });
  return offScreen;
}"""


class Results:
    def __init__(self):
        self.passed = 0
        self.failures = []

    def check(self, description, condition, detail=""):
        if condition:
            self.passed += 1
        else:
            self.failures.append(f"{description} {detail}".strip())
            print("  FAIL:", description, detail)


def open_page(browser_context, url_with_query, wait_ms=2000):
    page = browser_context.new_page()
    page.page_errors = []
    page.on("pageerror", lambda error: page.page_errors.append(str(error)))
    if url_with_query.startswith("http://") or url_with_query.startswith("https://"):
        goto_url = url_with_query
    else:
        goto_url = (PAGES_DIR / url_with_query.split("?")[0]).as_uri() + "?" + url_with_query.partition("?")[2]
    page.goto(goto_url, wait_until="domcontentloaded")
    page.goto(goto_url, wait_until="domcontentloaded")
    page.wait_for_timeout(wait_ms)
    return page


def new_context(browser, width, height):
    context = browser.new_context(viewport={"width": width, "height": height})
    context.route("**/fonts.g*apis.com/**", lambda route: route.abort())  # fonts are not needed for the checks
    return context


def check_layout_at_every_size(browser, results):
    for size_name, (width, height) in SCREEN_SIZES.items():
        context = new_context(browser, width, height)
        for page_name, url in PAGE_URLS.items():
            page = open_page(context, url)
            if page_name.startswith("overlay"):
                page.evaluate("window.overlay.alert('sub', 'Nova_Fox_Long_Name', 'Tier 1')")
                page.wait_for_timeout(900)
            off_screen = page.evaluate(FIND_ELEMENTS_OFF_SCREEN, ON_SCREEN_SELECTOR)
            results.check(f"[{size_name}] {page_name}: stays on screen", not off_screen, str(off_screen[:3]))
            results.check(f"[{size_name}] {page_name}: no JavaScript errors", not page.page_errors, str(page.page_errors))
            page.close()
        context.close()


def check_behaviors(browser, results):
    context = new_context(browser, 1920, 1080)

    # --- main overlay: public API, postMessage, goal, scene ---
    page = open_page(context, "http://127.0.0.1:8099/public/overlays/overlay.html?bg=1&lower=0")
    page.evaluate("window.overlay.alert('raid', 'quietstorm', '42 viewers')")
    page.wait_for_timeout(700)
    results.check("overlay: alert shows the username", page.inner_text("#alertName") == "quietstorm")
    # text_content ignores the CSS uppercase styling that inner_text applies
    results.check("overlay: alert shows the label", page.text_content("#alertKind") == "Incoming raid")
    page.evaluate("""() => {
      postMessage({ type: 'goal', value: 30, max: 50 }, '*');
      postMessage({ type: 'lower', name: 'Alex', title: 'Ranked grind', show: true }, '*');
      postMessage({ type: 'scene', name: 'brb', minutes: 2 }, '*');
    }""")
    page.wait_for_timeout(500)
    results.check("overlay: postMessage sets the goal", page.inner_text("#goalNum") == "30 / 50")
    results.check("overlay: postMessage sets the lower third text", page.inner_text("#name") == "Alex")
    results.check("overlay: postMessage shows the lower third",
                  page.evaluate("document.getElementById('lower').classList.contains('on')"))
    results.check("overlay: postMessage shows the scene card",
                  page.evaluate("document.getElementById('scene').classList.contains('on')"))
    results.check("overlay: scene card has a countdown", ":" in page.inner_text("#count"))
    results.check("overlay: no JavaScript errors", not page.page_errors, str(page.page_errors))
    page.close()

    page = open_page(context, "http://127.0.0.1:8099/public/overlays/overlay.html?bg=1&lower=0&goal=10")
    page.evaluate("window.overlay.alert('follow', 'Nova_Fox')")
    page.wait_for_timeout(500)
    results.check("overlay: a follow alert adds one to the goal", page.inner_text("#goalNum") == "11 / 100")
    page.close()

    # --- no-nameplate overlay still works and has no lower third ---
    page = open_page(context, "http://127.0.0.1:8099/public/overlays/overlay-noname.html?bg=1&goal=5")
    results.check("overlay-noname: has no nameplate", page.query_selector("#name") is None)
    page.evaluate("window.overlay.alert('tip', 'mx_halcyon', '$5'); window.overlay.lower(true); window.overlay.setLower('x', 'y');")
    page.wait_for_timeout(500)
    results.check("overlay-noname: alerts still work", page.inner_text("#alertName") == "mx_halcyon")
    results.check("overlay-noname: lower-third calls do not throw", not page.page_errors, str(page.page_errors))
    page.close()

    # --- URL parameters ---
    page = open_page(context, "http://127.0.0.1:8099/public/overlays/screenshare.html?pos=tl&name=Alex&title=Ranked%20grind")
    body_classes = page.evaluate("document.body.className")
    results.check("screenshare: pos=tl moves the camera", "pos-tl" in body_classes and "pos-br" not in body_classes, body_classes)
    results.check("screenshare: name parameter", page.inner_text("#name") == "Alex")
    page.close()

    page = open_page(context, "http://127.0.0.1:8099/public/overlays/screenshare.html?cam=0")
    results.check("screenshare: cam=0 hides the camera frame",
                  page.evaluate("getComputedStyle(document.querySelector('.cam')).display") == "none")
    page.close()

    page = open_page(context, "http://127.0.0.1:8099/public/overlays/screenshare-side.html?side=left")
    results.check("screenshare-side: side=left flips the sidebar",
                  page.evaluate("document.body.classList.contains('flip')"))
    page.close()

    page = open_page(context, "http://127.0.0.1:8099/public/overlays/ending.html?socials=twitter/you,youtube/you")
    results.check("ending: socials become separate lines", page.inner_html("#socials").count("<br>") == 1)
    page.close()

    page = open_page(context, "http://127.0.0.1:8099/public/overlays/webcam.html?accent=FF4D8D")
    accent = page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().toLowerCase()")
    results.check("webcam: accent parameter overrides the color", accent == "#ff4d8d", accent)
    page.close()

    # --- countdowns ---
    page = open_page(context, "http://127.0.0.1:8099/public/overlays/brb.html?minutes=2")
    results.check("brb: counts down when minutes is given", "Back in" in page.text_content("#count"))
    page.close()

    page = open_page(context, "http://127.0.0.1:8099/public/overlays/brb.html")
    results.check("brb: counts up when minutes is missing", "Away for" in page.text_content("#count"))
    page.close()

    page = open_page(context, "http://127.0.0.1:8099/public/overlays/starting.html?minutes=0.03", wait_ms=2600)
    results.check("starting: switches to 'Going live' when the countdown ends",
                  "live" in page.inner_text("#title").lower(), page.inner_text("#title"))
    page.close()

    # --- stinger: the Browser Transition plugin events ---
    page = open_page(context, "http://127.0.0.1:8099/public/transitions/stinger.html")
    is_visible = "getComputedStyle(document.getElementById('ink')).visibility"
    results.check("stinger: transparent before the plugin starts it", page.evaluate(is_visible) == "hidden")
    page.evaluate("""window.dispatchEvent(new CustomEvent('transitionStart',
        { detail: { duration: 800, transitionPoint: 0.5, transition: 'test', trackMatte: false } }))""")
    page.wait_for_timeout(200)
    results.check("stinger: covers the screen while running", page.evaluate(is_visible) == "visible")
    page.wait_for_timeout(1000)
    results.check("stinger: clears itself after the duration", page.evaluate(is_visible) == "hidden")
    page.evaluate("window.dispatchEvent(new CustomEvent('transitionStart', { detail: JSON.stringify({ duration: 800 }) }))")
    page.wait_for_timeout(150)
    results.check("stinger: accepts event details sent as a JSON string", page.evaluate(is_visible) == "visible")
    page.evaluate("window.dispatchEvent(new CustomEvent('transitionStop'))")
    results.check("stinger: transitionStop hides it", page.evaluate(is_visible) == "hidden")
    results.check("stinger: no JavaScript errors", not page.page_errors, str(page.page_errors))
    page.close()

    context.close()


def main():
    _server = subprocess.Popen([sys.executable, '-m', 'http.server', '8099', '--directory', str(REPO_ROOT)],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    results = Results()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        check_layout_at_every_size(browser, results)
        check_behaviors(browser, results)
        browser.close()
    _server.terminate()
    print(f"\n{results.passed} checks passed, {len(results.failures)} failed")
    sys.exit(1 if results.failures else 0)


if __name__ == "__main__":
    main()

