/* Starting Soon scene: headline, "Live in" countdown with progress bar, and "Up next" line. */

const DEFAULT_COUNTDOWN_MINUTES = 5;
const COUNTDOWN_REFRESH_MS = 500;

const headline = getById('title');
const message = getById('msg');
const countdown = getById('count');
const progressTrack = getById('track');
const progressFill = getById('fill');

getById('kicker').textContent = urlParams.get('kicker') || 'Stream';
getById('next').textContent = urlParams.get('next') || 'Just chatting';
if (urlParams.get('msg')) {
  message.textContent = urlParams.get('msg');
  message.hidden = false;
}
fillMarquee(['Starting soon', urlParams.get('channel') || 'yourchannel', 'Grab a drink', 'Say hi in chat']);

function startCountdown(minutes) {
  const totalMs = minutes * 60000;
  const endTime = Date.now() + totalMs;

  function updateCountdown() {
    const remainingMs = endTime - Date.now();
    const remainingSeconds = Math.max(0, Math.round(remainingMs / 1000));
    const percentElapsed = Math.min(100, (1 - remainingMs / totalMs) * 100);

    countdown.innerHTML = '<small>Live in</small>' + formatMinutesSeconds(remainingSeconds);
    progressFill.style.width = percentElapsed + '%';

    if (remainingSeconds <= 0) {
      clearInterval(refreshTimer);
      headline.innerHTML = 'Going <span class="highlight">live</span>';
      countdown.innerHTML = '';
      progressTrack.style.display = 'none';
    }
  }

  const refreshTimer = setInterval(updateCountdown, COUNTDOWN_REFRESH_MS);
  updateCountdown();
}

const countdownMinutes = parseFloat(urlParams.get('minutes') ?? DEFAULT_COUNTDOWN_MINUTES);
if (countdownMinutes > 0) {
  startCountdown(countdownMinutes);
} else {
  progressTrack.style.display = 'none';
}
