import { getById, urlParams, fillMarquee, formatMinutesSeconds } from '../base.js';

const TIMER_REFRESH_MS = 500;

const message = getById('msg') as HTMLElement;
const countdown = getById('count') as HTMLElement;

if (urlParams.get('msg')) message.textContent = urlParams.get('msg');
fillMarquee(['Be right back', urlParams.get('channel') || 'yourchannel', 'Chat among yourselves', 'Back shortly']);

function startCountdown(minutes: number) {
  const endTime = Date.now() + minutes * 60000;

  function updateCountdown() {
    const remainingSeconds = Math.max(0, Math.round((endTime - Date.now()) / 1000));
    countdown.innerHTML = '<small>Back in</small>' + formatMinutesSeconds(remainingSeconds);
    if (remainingSeconds <= 0) {
      clearInterval(refreshTimer);
      countdown.innerHTML = '<small>Any second now</small>';
    }
  }

  const refreshTimer = setInterval(updateCountdown, TIMER_REFRESH_MS);
  updateCountdown();
}

function startAwayTimer() {
  const startTime = Date.now();
  const updateAwayTimer = () => {
    const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
    countdown.innerHTML = '<small>Away for</small>' + formatMinutesSeconds(elapsedSeconds);
  };
  setInterval(updateAwayTimer, TIMER_REFRESH_MS);
  updateAwayTimer();
}

const countdownMinutes = parseFloat(urlParams.get('minutes') ?? '0');
if (countdownMinutes > 0) {
  startCountdown(countdownMinutes);
} else {
  startAwayTimer();
}