import { getById, urlParams } from '../base.js';
/* ============================================================
   Shared lifecycle for the stinger transitions.

   All the stinger pages are the same page with a different wipe,
   so the element lookups, event wiring, animation loop and the
   preview hook live here once. Each page's script calls
   `startStinger` with its wipe (see stinger-wipes.ts).
   ============================================================ */

const DEFAULT_DURATION_MS = 1200;
const DEFAULT_TRANSITION_POINT = 0.5;
const LABEL_FADE_IN = 0.1;
const LABEL_HOLD = 0.03;
const LABEL_FADE_OUT = 0.12;
const PREVIEW_START_DELAY_MS = 400;
const PREVIEW_PAUSE_MS = 2200;

/** Width of the accent stripe that trails the ink, as a fraction of the screen. */
export const STRIPE_WIDTH = 0.06;

export interface StingerClipPaths {
  ink: string;
  stripe: string;
}

export interface StingerWipe {
  /** Optionally snap progress before rendering (used by the stepped wipe). */
  quantize?(progress: number): number;
  /** Clip paths for the ink and accent layers at `progress` (0–1). */
  clipPaths(progress: number, transitionPoint: number): StingerClipPaths;
}

export const clampToUnitRange = (value: number): number => Math.max(0, Math.min(1, value));

export const easeInOutCubic = (progress: number): number =>
  progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

function smoothStep(value: number): number {
  const clamped = clampToUnitRange(value);
  return clamped * clamped * (3 - 2 * clamped);
}

interface StingerPreviewApi {
  render: (progress: number, transitionPoint?: number) => void;
}

/** Wires up a stinger page. Call once, with the page's wipe. */
export function startStinger(wipe: StingerWipe): void {
  const gradientStripe = getById('accent-layer');
  const inkPanel = getById('ink');
  const centerLabel = getById('midpoint-message');
  const centerLabelContent = getById('message-content');
  const centerWord = getById('word');

  let animationFrameId = 0;
  let animationStartTime = 0;
  let durationMs = DEFAULT_DURATION_MS;
  let transitionPoint = DEFAULT_TRANSITION_POINT;
  let previewStartTimer: ReturnType<typeof setTimeout> | undefined;
  let previewIntervalTimer: ReturnType<typeof setInterval> | undefined;

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

  function renderFrame(progress: number): void {
    if (!inkPanel || !gradientStripe) return;
    const quantize = wipe.quantize;
    const frame = quantize ? quantize(progress) : progress;
    const { ink, stripe } = wipe.clipPaths(frame, transitionPoint);
    inkPanel.style.clipPath = ink;
    gradientStripe.style.clipPath = stripe;

    const fadeIn = smoothStep((frame - (transitionPoint - LABEL_FADE_IN)) / LABEL_FADE_IN);
    const fadeOut = smoothStep((frame - (transitionPoint + LABEL_HOLD)) / LABEL_FADE_OUT);
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
      } catch {
        detail = {};
      }
    }
    return (detail || {}) as Record<string, unknown>;
  }

  function stopPreviewLoop(): void {
    if (previewStartTimer !== undefined) clearTimeout(previewStartTimer);
    if (previewIntervalTimer !== undefined) clearInterval(previewIntervalTimer);
    previewStartTimer = undefined;
    previewIntervalTimer = undefined;
  }

  function startPreviewLoop(): void {
    const previewDurationMs = Number(urlParams.get('duration')) || DEFAULT_DURATION_MS;
    const previewTransitionPoint = Number(urlParams.get('tp')) || DEFAULT_TRANSITION_POINT;
    const replay = (): void => playTransition(previewDurationMs, previewTransitionPoint);
    previewStartTimer = setTimeout(replay, PREVIEW_START_DELAY_MS);
    previewIntervalTimer = setInterval(replay, previewDurationMs + PREVIEW_PAUSE_MS);
    addEventListener('click', replay);
    addEventListener('keydown', replay);
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
        Number(urlParams.get('tp')) || DEFAULT_TRANSITION_POINT,
      );
    } else {
      stopTransition();
    }
  });

  // Preview hook for tooling (scripts/previews.ts): renders an exact frame and
  // stops the auto-play loop so the frame holds still for capture.
  const previewApi: StingerPreviewApi = {
    render(progress, point = DEFAULT_TRANSITION_POINT): void {
      stopPreviewLoop();
      cancelAnimationFrame(animationFrameId);
      transitionPoint = clampToUnitRange(point);
      if (gradientStripe) gradientStripe.style.visibility = 'visible';
      if (inkPanel) inkPanel.style.visibility = 'visible';
      renderFrame(clampToUnitRange(progress));
    },
  };
  (window as unknown as { stinger: StingerPreviewApi }).stinger = previewApi;

  applyCenterWord();
  if (urlParams.has('bg')) startPreviewLoop();
}
