/* ============================================================
   Stinger transition for the "Browser Transition" OBS plugin.

   The plugin fires `transitionStart` with { duration, transitionPoint, ... }.
   The page stays fully transparent until then. It wipes in, fully covers the
   screen at the transition point (that is when OBS swaps scenes), then wipes out.
   ============================================================ */

const DEFAULT_DURATION_MS = 1200;
const DEFAULT_TRANSITION_POINT = 0.5;      /* 0..1: how far through the transition the scenes swap */
const STRIPE_WIDTH = 0.06;                 /* gradient stripe width as a fraction of the screen */
const LABEL_FADE_IN = 0.1;                 /* label timing, as fractions of the whole transition */
const LABEL_HOLD = 0.03;
const LABEL_FADE_OUT = 0.12;
const PREVIEW_START_DELAY_MS = 400;
const PREVIEW_PAUSE_MS = 2200;

const gradientStripe = getById('accent-layer');
const inkPanel = getById('ink');
const centerLabel = getById('midpoint-message');
const centerLabelContent = getById('message-content');
const centerWord = getById('word');

let animationFrameId = 0;
let animationStartTime = 0;
let durationMs = DEFAULT_DURATION_MS;
let transitionPoint = DEFAULT_TRANSITION_POINT;

/* ?word=Be right back puts the last word in the highlighted block. */
function applyCenterWord() {
  const wordParam = urlParams.get('word');
  if (!wordParam || !wordParam.trim()) return;
  const words = wordParam.trim().split(/\s+/);
  const highlightedWord = words.pop();
  const highlight = document.createElement('span');
  highlight.className = 'highlight';
  highlight.textContent = highlightedWord;
  centerWord.textContent = words.length ? words.join(' ') + ' ' : '';
  centerWord.appendChild(highlight);
}

/* ---------- easing helpers ---------- */

const clampToUnitRange = value => Math.max(0, Math.min(1, value));

function easeInOutCubic(progress) {
  if (progress < 0.5) return 4 * progress * progress * progress;
  return 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

function smoothStep(value) {
  const clamped = clampToUnitRange(value);
  return clamped * clamped * (3 - 2 * clamped);
}

/* Shows only the horizontal slice of a layer between two fractions of the screen width. */
function showHorizontalSlice(layer, leftFraction, rightFraction) {
  const insetRightPercent = (1 - rightFraction) * 100;
  const insetLeftPercent = leftFraction * 100;
  layer.style.clipPath = `inset(0 ${insetRightPercent}% 0 ${insetLeftPercent}%)`;
}

/* ---------- animation ---------- */

/* `progress` runs from 0 (start) to 1 (end) over the whole transition. */
function renderFrame(progress) {
  let inkLeft = 0, inkRight = 0, stripeLeft = 0, stripeRight = 0;

  if (progress <= transitionPoint) {
    /* Wipe in: the gradient stripe leads and the ink panel follows. */
    const wipe = easeInOutCubic(progress / transitionPoint);
    inkRight = wipe;
    stripeRight = Math.min(1, wipe + STRIPE_WIDTH * Math.min(1, wipe * 10));
  } else {
    /* Wipe out: the ink panel leaves first and the stripe trails behind it. */
    const wipe = easeInOutCubic((progress - transitionPoint) / (1 - transitionPoint)) * (1 + STRIPE_WIDTH);
    inkLeft = Math.min(1, wipe);
    inkRight = 1;
    stripeLeft = Math.max(0, wipe - STRIPE_WIDTH);
    stripeRight = 1;
  }

  showHorizontalSlice(inkPanel, inkLeft, inkRight);
  showHorizontalSlice(gradientStripe, stripeLeft, stripeRight);

  const fadeIn = smoothStep((progress - (transitionPoint - LABEL_FADE_IN)) / LABEL_FADE_IN);
  const fadeOut = smoothStep((progress - (transitionPoint + LABEL_HOLD)) / LABEL_FADE_OUT);
  const labelOpacity = fadeIn * (1 - fadeOut);
  centerLabel.style.opacity = labelOpacity;
  centerLabelContent.style.transform = `translateY(${1 - labelOpacity}rem)`;
}

function hideLayers() {
  gradientStripe.style.visibility = 'hidden';
  inkPanel.style.visibility = 'hidden';
  centerLabel.style.opacity = 0;
}

function onAnimationFrame(now) {
  const progress = Math.min(1, (now - animationStartTime) / durationMs);
  renderFrame(progress);
  if (progress < 1) {
    animationFrameId = requestAnimationFrame(onAnimationFrame);
  } else {
    hideLayers();
  }
}

function playTransition(requestedDurationMs, requestedTransitionPoint) {
  cancelAnimationFrame(animationFrameId);
  durationMs = requestedDurationMs > 50 ? requestedDurationMs : DEFAULT_DURATION_MS;
  const isValidPoint = requestedTransitionPoint > 0.05 && requestedTransitionPoint < 0.95;
  transitionPoint = isValidPoint ? requestedTransitionPoint : DEFAULT_TRANSITION_POINT;

  gradientStripe.style.visibility = 'visible';
  inkPanel.style.visibility = 'visible';
  renderFrame(0);
  animationStartTime = performance.now();
  animationFrameId = requestAnimationFrame(onAnimationFrame);
}

function stopTransition() {
  cancelAnimationFrame(animationFrameId);
  hideLayers();
}

/* ---------- Browser Transition plugin events ---------- */

/* Event details may arrive as an object or as a JSON string, depending on the plugin version. */
function readEventDetail(event) {
  let detail = event && event.detail;
  if (typeof detail === 'string') {
    try {
      detail = JSON.parse(detail);
    } catch (parseError) {
      detail = {};
    }
  }
  return detail || {};
}

window.addEventListener('transitionStart', event => {
  const detail = readEventDetail(event);
  playTransition(Number(detail.duration), Number(detail.transitionPoint));
});

window.addEventListener('transitionStop', stopTransition);

/* Older plugin builds only send an "active" flag with no duration, so fall back to the defaults. */
window.addEventListener('obsSourceActiveChanged', event => {
  const detail = readEventDetail(event);
  if (detail.active) {
    playTransition(
      Number(urlParams.get('duration')) || DEFAULT_DURATION_MS,
      Number(urlParams.get('tp')) || DEFAULT_TRANSITION_POINT
    );
  } else {
    stopTransition();
  }
});

/* ---------- preview mode (open in a normal browser with ?bg=1) ---------- */

function startPreviewLoop() {
  const previewDurationMs = Number(urlParams.get('duration')) || DEFAULT_DURATION_MS;
  const previewTransitionPoint = Number(urlParams.get('tp')) || DEFAULT_TRANSITION_POINT;
  const replay = () => playTransition(previewDurationMs, previewTransitionPoint);

  setTimeout(replay, PREVIEW_START_DELAY_MS);
  setInterval(replay, previewDurationMs + PREVIEW_PAUSE_MS);
  addEventListener('click', replay);
  addEventListener('keydown', replay);
}

applyCenterWord();
if (urlParams.has('bg')) startPreviewLoop();
