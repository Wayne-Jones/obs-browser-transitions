/* ============================================================
   Main overlay: alerts, follower goal, lower third and scene card.
   Uses the helpers from base.js (getById, urlParams, formatMinutesSeconds).

   Control from outside the page:
     window.overlay.alert('follow' | 'sub' | 'raid' | 'tip', username, detail)
     window.overlay.setGoal(value, target)
     window.overlay.lower(visible)           window.overlay.setLower(name, title)
     window.overlay.scene('starting' | 'brb' | 'ending' | 'none', minutes)
   The same actions work through postMessage; see handlePostMessage below.
   ============================================================ */

const ALERT_DISPLAY_MS = 5000;
const ALERT_GAP_MS = 700;
const LOWER_THIRD_DELAY_MS = 600;
const SCENE_COUNTDOWN_REFRESH_MS = 500;
const DEFAULT_GOAL_TARGET = 100;
const DEFAULT_SCENE_COUNTDOWN_MINUTES = 5;

const ALERT_KINDS = {
  follow: { icon: '+', label: 'New follower' },
  sub:    { icon: '★', label: 'New subscriber' },
  raid:   { icon: '»', label: 'Incoming raid' },
  tip:    { icon: '$', label: 'Tip' }
};

const SCENES = {
  starting: { kicker: 'Stream',    headlineMarkup: 'Starting <span class="highlight">soon</span>' },
  brb:      { kicker: 'Take five', headlineMarkup: 'Be right <span class="highlight">back</span>' },
  ending:   { kicker: 'Thank you', headlineMarkup: 'See you <span class="highlight">next time</span>' }
};

const alertElement = getById('alert');
const alertIcon = getById('alertIcon');
const alertLabel = getById('alertKind');
const alertName = getById('alertName');
const alertDetail = getById('alertSub');

const goalElement = getById('goal');
const goalCount = getById('goalNum');
const goalFill = getById('fill');

const lowerThird = getById('lower');        /* missing on the "no nameplate" page */
const nameElement = getById('name');
const titleElement = getById('title');

const sceneElement = getById('scene');
const sceneKicker = getById('sceneKicker');
const sceneHeadline = getById('sceneTitle');
const sceneCountdown = getById('count');

/* ---------- settings from the URL ---------- */

if (nameElement) nameElement.textContent = urlParams.get('name') || 'Your Name';
if (titleElement) titleElement.textContent = urlParams.get('title') || 'Playing • Talking • Making';
getById('goalLabel').textContent = urlParams.get('goalLabel') || 'Follower goal';
if (urlParams.get('goal') === '0') goalElement.classList.add('off');

/* ---------- follower goal ---------- */

const startingGoal = Number(urlParams.get('goal'));
let goalValue = startingGoal > 0 ? startingGoal : 0;
let goalTarget = Number(urlParams.get('goalMax')) || DEFAULT_GOAL_TARGET;

function renderGoal() {
  const percentComplete = Math.min(100, (goalValue / goalTarget) * 100);
  goalCount.textContent = goalValue + ' / ' + goalTarget;
  goalFill.style.width = percentComplete + '%';
}

function setGoal(value, target) {
  goalValue = value;
  if (target) goalTarget = target;
  renderGoal();
}

/* ---------- lower third ---------- */

function setLowerThirdVisible(visible = !lowerThird?.classList.contains('on')) {
  lowerThird?.classList.toggle('on', visible);
}

function setLowerThirdText(name, title) {
  if (name && nameElement) nameElement.textContent = name;
  if (title && titleElement) titleElement.textContent = title;
}

/* ---------- alerts (queued so they play one at a time) ---------- */

const alertQueue = [];
let isShowingAlert = false;

function queueAlert(kind, username, detail = '') {
  alertQueue.push({ kind, username, detail });
  if (!isShowingAlert) showNextAlert();
}

function showNextAlert() {
  const nextAlert = alertQueue.shift();
  if (!nextAlert) {
    isShowingAlert = false;
    return;
  }
  isShowingAlert = true;

  const kindInfo = ALERT_KINDS[nextAlert.kind] || ALERT_KINDS.follow;
  alertIcon.textContent = kindInfo.icon;
  alertLabel.textContent = kindInfo.label;
  alertName.textContent = nextAlert.username;
  alertDetail.textContent = nextAlert.detail;
  alertElement.classList.add('on');

  if (nextAlert.kind === 'follow') {
    goalValue++;
    renderGoal();
  }

  setTimeout(() => {
    alertElement.classList.remove('on');
    setTimeout(showNextAlert, ALERT_GAP_MS);
  }, ALERT_DISPLAY_MS);
}

/* ---------- scene card (starting / brb / ending) ---------- */

let sceneCountdownTimer;

function showScene(sceneName, countdownMinutes) {
  clearInterval(sceneCountdownTimer);

  const scene = SCENES[sceneName];
  if (!scene) {
    sceneElement.classList.remove('on');
    return;
  }

  sceneKicker.textContent = scene.kicker;
  sceneHeadline.innerHTML = scene.headlineMarkup;
  sceneCountdown.textContent = '';
  sceneElement.classList.add('on');

  if (countdownMinutes > 0) {
    const endTime = Date.now() + countdownMinutes * 60000;
    const updateCountdown = () => {
      const remainingSeconds = Math.max(0, Math.round((endTime - Date.now()) / 1000));
      sceneCountdown.textContent = formatMinutesSeconds(remainingSeconds);
      if (remainingSeconds <= 0) clearInterval(sceneCountdownTimer);
    };
    sceneCountdownTimer = setInterval(updateCountdown, SCENE_COUNTDOWN_REFRESH_MS);
    updateCountdown();
  }
}

/* ---------- public API and postMessage ---------- */

window.overlay = {
  alert: queueAlert,
  lower: setLowerThirdVisible,
  scene: showScene,
  setGoal,
  setLower: setLowerThirdText
};

/* postMessage examples:
     { type: 'alert', kind: 'sub', name: 'pixelparade', sub: 'Tier 1 · 3 months' }
     { type: 'goal',  value: 30, max: 50 }
     { type: 'lower', name: 'Alex', title: 'Ranked grind', show: true }
     { type: 'scene', name: 'brb', minutes: 5 } */
function handlePostMessage(event) {
  const message = event.data || {};
  switch (message.type) {
    case 'alert':
      queueAlert(message.kind, message.name, message.sub);
      break;
    case 'lower':
      setLowerThirdText(message.name, message.title);
      setLowerThirdVisible(message.show);
      break;
    case 'scene':
      showScene(message.name, message.minutes);
      break;
    case 'goal':
      setGoal(message.value, message.max);
      break;
  }
}
addEventListener('message', handlePostMessage);

/* ---------- preview keys (only with ?bg=1 so they never fire inside OBS by accident) ---------- */

function enablePreviewKeys() {
  const SAMPLE_USERNAMES = ['Nova_Fox', 'pixelparade', 'quietstorm', 'mx_halcyon'];
  const SCENE_CYCLE = [null, 'starting', 'brb', 'ending'];
  let sceneCycleIndex = 0;

  const pickRandomUsername = () => SAMPLE_USERNAMES[Math.floor(Math.random() * SAMPLE_USERNAMES.length)];

  addEventListener('keydown', event => {
    switch (event.key) {
      case '1':
        queueAlert('follow', pickRandomUsername());
        break;
      case '2':
        queueAlert('sub', pickRandomUsername(), 'Tier 1 · 3 months');
        break;
      case '3':
        setLowerThirdVisible();
        break;
      case '4': {
        sceneCycleIndex = (sceneCycleIndex + 1) % SCENE_CYCLE.length;
        const sceneName = SCENE_CYCLE[sceneCycleIndex];
        showScene(sceneName, sceneName === 'starting' ? DEFAULT_SCENE_COUNTDOWN_MINUTES : 0);
        break;
      }
      case '5':
        goalValue++;
        renderGoal();
        break;
      case '6':
        goalElement.classList.toggle('off');
        break;
    }
  });
}

/* ---------- start ---------- */

renderGoal();
if (urlParams.get('lower') !== '0') setTimeout(() => setLowerThirdVisible(true), LOWER_THIRD_DELAY_MS);
if (urlParams.get('scene')) showScene(urlParams.get('scene'), Number(urlParams.get('minutes')) || 0);
if (urlParams.has('bg')) enablePreviewKeys();
