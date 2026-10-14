/* ============================================================
   Shared helpers for the overlay pages:
   URL parameters, accent color override, channel name, clock and marquee.
   ============================================================ */

const getById = (elementId: string): HTMLElement | null => document.getElementById(elementId);
const urlParams: URLSearchParams = new URLSearchParams(location.search);

const padTwoDigits = (number: number): string => String(number).padStart(2, '0');

function formatMinutesSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return padTwoDigits(minutes) + ':' + padTwoDigits(seconds);
}

/* Text from the URL ends up in innerHTML, so drop anything that could form a tag. */
const removeHtmlCharacters = (text: string): string => text.replace(/[&<>]/g, '');

/* ---------- URL parameters ---------- */

/* ?accent=FF4D8D replaces the whole flag gradient with a single flat color. */
const ACCENT_CSS_VARIABLES: string[] = ['--flag-magenta', '--flag-purple', '--flag-blue', '--accent', '--accent-text'];

function applyAccentOverride(): void {
  const accentParam = urlParams.get('accent');
  if (!accentParam) return;
  const accentColor = '#' + accentParam.replace('#', '');
  ACCENT_CSS_VARIABLES.forEach((variableName: string) => {
    document.documentElement.style.setProperty(variableName, accentColor);
  });
}

/* ?bg=1 shows a checkerboard behind transparent pages so they can be previewed in a browser. */
function applyBackgroundOptions(): void {
  if (urlParams.has('bg')) document.body.classList.add('preview-bg');
  const isSolidPage = document.body.classList.contains('solid');
  if (isSolidPage && urlParams.has('transparent')) document.body.classList.remove('solid');
}

function applyChannelName(): void {
  const channelElement = getById('channel');
  if (channelElement) channelElement.textContent = urlParams.get('channel') || 'yourchannel';
}

function startClock(): void {
  const clockElement = getById('clock');
  if (!clockElement) return;
  const CLOCK_REFRESH_MS = 10000;
  const updateClock = (): void => {
    clockElement.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  updateClock();
  setInterval(updateClock, CLOCK_REFRESH_MS);
}

/* Fills the scrolling marquee at the bottom of the scene pages. The phrases repeat twice so the CSS animation can loop seamlessly. */
function fillMarquee(phrases: string[]): void {
  const marqueeTrack = getById('marquee-track');
  if (!marqueeTrack) return;
  const REPEATS_PER_HALF = 6;
  const phraseMarkup = phrases.map((phrase: string) => '<span>' + removeHtmlCharacters(phrase) + '</span>').join('');
  const half = phraseMarkup.repeat(REPEATS_PER_HALF);
  marqueeTrack.innerHTML = half + half;
}

applyAccentOverride();
applyBackgroundOptions();
applyChannelName();
startClock();
export { getById, urlParams, padTwoDigits, formatMinutesSeconds, removeHtmlCharacters, ACCENT_CSS_VARIABLES, applyAccentOverride, applyBackgroundOptions, applyChannelName, startClock, fillMarquee };
