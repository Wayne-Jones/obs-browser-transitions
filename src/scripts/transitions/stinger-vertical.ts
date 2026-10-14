import { getById, urlParams } from '../base.js';
/* ============================================================
   Stinger transition for the "Browser Transition" OBS plugin.
   ============================================================ */

const DEFAULT_DURATION_MS = 1200;
const DEFAULT_TRANSITION_POINT = 0.5;
const STRIPE_WIDTH = 0.06;
const LABEL_FADE_IN = 0.1;
const LABEL_HOLD = 0.03;
const LABEL_FADE_OUT = 0.12;
const PREVIEW_START_DELAY_MS = 400;
const PREVIEW_PAUSE_MS = 2200;

const gradientStripe: HTMLElement | null = getById('accent-layer');
const inkPanel: HTMLElement | null = getById('ink');
const centerLabel: HTMLElement | null = getById('midpoint-message');
const centerLabelContent: HTMLElement | null = getById('message-content');
const centerWord: HTMLElement | null = getById('word');

let animationFrameId = 0;
let animationStartTime = 0;
let durationMs = DEFAULT_DURATION_MS;
let transitionPoint = DEFAULT_TRANSITION_POINT;

function applyCenterWord(): void {
  if (!centerWord) return;
  const wordParam = urlParams.get('word');
  if (!wordParam || !wordParam.trim()) return;
  const words = wordParam.trim().split(/\s+/);
  const highlightedWord = words.pop() as string;
  const highlight = document.createElement('span');
  highlight.className = 'highlight';
  highlight.textContent = highlightedWord;
  centerWord.textContent = words.length ? words.join(' ') + ' ' : '';
  centerWord.appendChild(highlight);
}

const clampToUnitRange = (value: number): number => Math.max(0, Math.min(1, value));

function easeInOutCubic(progress: number): number {
  if (progress < 0.5) return 4 * progress * progress * progress;
  return 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

function smoothStep(value: number): number {
  const clamped = clampToUnitRange(value);
  return clamped * clamped * (3 - 2 * clamped);
}

function showVerticalSlice(layer: HTMLElement | null, topFraction: number, bottomFraction: number): void {
  if (!layer) return;
  const insetTopPercent = topFraction * 100;
  const insetBottomPercent = (1 - bottomFraction) * 100;
  layer.style.clipPath = `inset(${insetTopPercent}% 0 ${insetBottomPercent}% 0)`;
}

function renderFrame(progress: number): void {
  if (!inkPanel || !gradientStripe) return;
  let inkTop = 0, inkBottom = 0, stripeTop = 0, stripeBottom = 0;
  if (progress <= transitionPoint) {
    const wipe = easeInOutCubic(progress / transitionPoint);
    inkBottom = wipe;
    stripeBottom = Math.min(1, wipe + STRIPE_WIDTH * Math.min(1, wipe * 10));
  } else {
    const wipe = easeInOutCubic((progress - transitionPoint) / (1 - transitionPoint)) * (1 + STRIPE_WIDTH);
    inkTop = Math.min(1, wipe);
    inkBottom = 1;
    stripeTop = Math.max(0, wipe - STRIPE_WIDTH);
    stripeBottom = 1;
  }
  showVerticalSlice(inkPanel, inkTop, inkBottom);
  showVerticalSlice(gradientStripe, stripeTop, stripeBottom);
  const fadeIn = smoothStep((progress - (transitionPoint - LABEL_FADE_IN)) / LABEL_FADE_IN);
  const fadeOut = smoothStep((progress - (transitionPoint + LABEL_HOLD)) / LABEL_FADE_OUT);
  const labelOpacity = fadeIn * (1 - fadeOut);
  if (centerLabel) centerLabel.style.opacity = String(labelOpacity);
  if (centerLabelContent) centerLabelContent.style.transform = `translateY(${1 - labelOpacity}rem)`;
}

function hideLayers(): void {
  if (gradientStripe) gradientStripe.style.visibility = 'hidden';
  if (inkPanel) inkPanel.style.visibility = 'hidden';
  if (centerLabel) centerLabel.style.opacity = '0';
}

function onAnimationFrame(now: number): void {
  const progress = Math.min(1, (now - animationStartTime) / durationMs);
  renderFrame(progress);
  if (progress < 1) {
    animationFrameId = requestAnimationFrame(onAnimationFrame);
  } else {
    hideLayers();
  }
}

function playTransition(requestedDurationMs: number, requestedTransitionPoint: number): void {
  cancelAnimationFrame(animationFrameId);
  durationMs = requestedDurationMs > 50 ? requestedDurationMs : DEFAULT_DURATION_MS;
  const isValidPoint = requestedTransitionPoint > 0.05 && requestedTransitionPoint < 0.95;
  transitionPoint = isValidPoint ? requestedTransitionPoint : DEFAULT_TRANSITION_POINT;

  if (gradientStripe) gradientStripe.style.visibility = 'visible';
  if (inkPanel) inkPanel.style.visibility = 'visible';
  renderFrame(0);
  animationStartTime = performance.now();
  animationFrameId = requestAnimationFrame(onAnimationFrame);
}

function stopTransition(): void {
  cancelAnimationFrame(animationFrameId);
  hideLayers();
}

function readEventDetail(event: Event): Record<string, unknown> {
  let detail: any = (event as CustomEvent).detail;
  if (typeof detail === 'string') {
    try {
      detail = JSON.parse(detail);
    } catch (parseError) {
      detail = {};
    }
  }
  return (detail || {}) as Record<string, unknown>;
}

window.addEventListener('transitionStart', (event: Event) => {
  const detail = readEventDetail(event);
  playTransition(Number(detail.duration), Number(detail.transitionPoint));
});

window.addEventListener('transitionStop', stopTransition);

window.addEventListener('obsSourceActiveChanged', (event: Event) => {
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

function startPreviewLoop(): void {
  const previewDurationMs = Number(urlParams.get('duration')) || DEFAULT_DURATION_MS;
  const previewTransitionPoint = Number(urlParams.get('tp')) || DEFAULT_TRANSITION_POINT;
  const replay = (): void => playTransition(previewDurationMs, previewTransitionPoint);
  setTimeout(replay, PREVIEW_START_DELAY_MS);
  setInterval(replay, previewDurationMs + PREVIEW_PAUSE_MS);
  addEventListener('click', replay);
  addEventListener('keydown', replay);
}

applyCenterWord();
if (urlParams.has('bg')) startPreviewLoop();
