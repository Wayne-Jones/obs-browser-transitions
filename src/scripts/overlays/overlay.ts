import { getById, urlParams, formatMinutesSeconds } from '../base.js';

const ALERT_DISPLAY_MS = 5000;
const ALERT_GAP_MS = 700;
const LOWER_THIRD_DELAY_MS = 600;
const SCENE_COUNTDOWN_REFRESH_MS = 500;
const DEFAULT_GOAL_TARGET = 100;
const DEFAULT_SCENE_COUNTDOWN_MINUTES = 5;

const ALERT_KINDS = {
  follow: { icon: '+', label: 'New follower' },
  sub: { icon: '★', label: 'New subscriber' },
  raid: { icon: '→', label: 'Incoming raid' },
  tip: { icon: '$', label: 'Tip' }
};

const SCENES = {
  starting: { kicker: 'Stream', headlineMarkup: 'Starting <span class="highlight">soon</span>' },
  brb: { kicker: 'Take five', headlineMarkup: 'Be right <span class="highlight">back</span>' },
  ending: { kicker: 'Thank you', headlineMarkup: 'See you <span class="highlight">next time</span>' }
};

const alertElement = getById('alert') as HTMLElement;
const alertIcon = getById('alertIcon') as HTMLElement;
const alertLabel = getById('alertKind') as HTMLElement;
const alertName = getById('alertName') as HTMLElement;
const alertDetail = getById('alertSub') as HTMLElement;

const goalElement = getById('goal') as HTMLElement;
const goalCount = getById('goalNum') as HTMLElement;
const goalFill = getById('fill') as HTMLElement;

const lowerThird = getById('lower') as HTMLElement | null;
const nameElement = getById('name') as HTMLElement | null;
const titleElement = getById('title') as HTMLElement | null;

const sceneElement = getById('scene') as HTMLElement;
const sceneKicker = getById('sceneKicker') as HTMLElement;
const sceneHeadline = getById('sceneTitle') as HTMLElement;
const sceneCountdown = getById('count') as HTMLElement;

if (nameElement) nameElement.textContent = urlParams.get('name') || 'Your Name';
if (titleElement) titleElement.textContent = urlParams.get('title') || 'Playing · Talking · Making';
(getById('goalLabel') as HTMLElement).textContent = urlParams.get('goalLabel') || 'Follower goal';
if (urlParams.get('goal') === '0') goalElement.classList.add('off');

const startingGoal = Number(urlParams.get('goal'));
let goalValue = startingGoal > 0 ? startingGoal : 0;
let goalTarget = Number(urlParams.get('goalMax')) || DEFAULT_GOAL_TARGET;

function renderGoal() {
  const percentComplete = Math.min(100, (goalValue / goalTarget) * 100);
  goalCount.textContent = goalValue + ' / ' + goalTarget;
  goalFill.style.width = percentComplete + '%';
}

function setGoal(value: number, target?: number) {
  goalValue = value;
  if (target) goalTarget = target;
  renderGoal();
}

function setLowerThirdVisible(visible?: boolean) {
  const show = visible ?? !lowerThird?.classList.contains('on');
  lowerThird?.classList.toggle('on', show);
}

function setLowerThirdText(name?: string | null, title?: string | null) {
  if (name && nameElement) nameElement.textContent = name;
  if (title && titleElement) titleElement.textContent = title;
}

const alertQueue: Array<{ kind: string; username: string; detail: string }> = [];
let isShowingAlert = false;

function queueAlert(kind: string, username: string, detail = '') {
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

  const kindInfo = ALERT_KINDS[nextAlert.kind as keyof typeof ALERT_KINDS] || ALERT_KINDS.follow;
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

let sceneCountdownTimer: any;

function showScene(sceneName: string, countdownMinutes: number) {
  clearInterval(sceneCountdownTimer);

  const scene = SCENES[sceneName as keyof typeof SCENES];
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

(globalThis as any).overlay = {
  alert: queueAlert,
  lower: setLowerThirdVisible,
  scene: showScene,
  setGoal,
  setLower: setLowerThirdText
};

function handlePostMessage(event: MessageEvent) {
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

function enablePreviewKeys() {
  const SAMPLE_USERNAMES = ['Nova_Fox', 'pixelparade', 'quietstorm', 'mx_halcyon'];
  const SCENE_CYCLE = [null, 'starting', 'brb', 'ending'];
  let sceneCycleIndex = 0;

  const pickRandomUsername = () => SAMPLE_USERNAMES[Math.floor(Math.random() * SAMPLE_USERNAMES.length)]!;

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
        showScene(sceneName as string, sceneName === 'starting' ? DEFAULT_SCENE_COUNTDOWN_MINUTES : 0);
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

renderGoal();
if (urlParams.get('lower') !== '0') setTimeout(() => setLowerThirdVisible(true), LOWER_THIRD_DELAY_MS);
if (urlParams.get('scene')) showScene(urlParams.get('scene')!, Number(urlParams.get('minutes')) || 0);
if (urlParams.has('bg')) enablePreviewKeys();
