/* ============================================================
   Landing page.

   Every page card in index.html carries a `data-page` id. This
   script looks up that page's options (below), renders a small
   form into the card, and keeps a live URL in sync: editing a
   field rewrites the query string on the card's Open link and
   URL preview. Extra key/value pairs can be added by hand.
   ============================================================ */

type OptionKind = 'text' | 'number' | 'select' | 'flag' | 'color';

interface SelectItem {
  value: string;
  label: string;
}

interface OptionDef {
  key: string;
  label: string;
  kind: OptionKind;
  placeholder?: string;
  hint?: string;
  items?: readonly SelectItem[];
  /** Flags: value written when checked. Colours: the picker's starting value. */
  value?: string;
  /** Flags: start checked. */
  on?: boolean;
}

interface PageDef {
  options: readonly OptionDef[];
}

interface CustomParam {
  key: string;
  value: string;
}

/* ---------- shared option building blocks ---------- */

const ACCENT: OptionDef = { key: 'accent', label: 'flat accent', kind: 'color', value: '#D60270', hint: 'Replaces the gradient with one flat colour (hex, no #).' };
const CHECKER: OptionDef = { key: 'bg', label: 'checkerboard (bg=1)', kind: 'flag', on: true, hint: 'Preview-only backdrop for transparent pages.' };
const TRANSPARENT: OptionDef = { key: 'transparent', label: 'transparent backdrop', kind: 'flag' };
const CHANNEL: OptionDef = { key: 'channel', label: 'channel', kind: 'text', placeholder: 'yourchannel' };
const NAME: OptionDef = { key: 'name', label: 'name', kind: 'text', placeholder: 'Alex' };
const TITLE: OptionDef = { key: 'title', label: 'title', kind: 'text', placeholder: 'Playing · Talking · Making' };
const CORNER: OptionDef = {
  key: 'pos',
  label: 'webcam corner',
  kind: 'select',
  items: [
    { value: '', label: 'br (default)' },
    { value: 'bl', label: 'bottom-left' },
    { value: 'tr', label: 'top-right' },
    { value: 'tl', label: 'top-left' },
  ],
};
const CAMERA_OFF: OptionDef = { key: 'cam', label: 'hide webcam (cam=0)', kind: 'flag', value: '0' };
const SIDEBAR: OptionDef = {
  key: 'side',
  label: 'sidebar side',
  kind: 'select',
  items: [
    { value: '', label: 'right (default)' },
    { value: 'left', label: 'left' },
  ],
};
const SCENE: OptionDef = {
  key: 'scene',
  label: 'scene card',
  kind: 'select',
  items: [
    { value: '', label: 'none' },
    { value: 'starting', label: 'starting' },
    { value: 'brb', label: 'brb' },
    { value: 'ending', label: 'ending' },
  ],
};

const GOAL: OptionDef = { key: 'goal', label: 'goal', kind: 'number', placeholder: '42' };
const GOAL_MAX: OptionDef = { key: 'goalMax', label: 'goal max', kind: 'number', placeholder: '100' };
const GOAL_LABEL: OptionDef = { key: 'goalLabel', label: 'goal label', kind: 'text', placeholder: 'Follower goal' };
const SCENE_MINUTES: OptionDef = { key: 'minutes', label: 'scene minutes', kind: 'number', placeholder: '5', hint: 'Only used with a scene card.' };

/* ---------- every page's options ---------- */

const PAGE_DEFS: Record<string, PageDef> = {
  starting: {
    options: [
      CHANNEL,
      { key: 'minutes', label: 'minutes', kind: 'number', placeholder: '5', hint: '0 hides the countdown.' },
      { key: 'next', label: 'up next', kind: 'text', placeholder: 'Just chatting' },
      { key: 'kicker', label: 'kicker', kind: 'text', placeholder: 'Stream' },
      { key: 'msg', label: 'message', kind: 'text', placeholder: 'Grab a drink' },
      ACCENT,
      TRANSPARENT,
    ],
  },
  brb: {
    options: [
      CHANNEL,
      { key: 'minutes', label: 'minutes', kind: 'number', placeholder: '5', hint: 'Leave empty to count up instead.' },
      { key: 'msg', label: 'message', kind: 'text', placeholder: 'Grabbing coffee' },
      ACCENT,
      TRANSPARENT,
    ],
  },
  ending: {
    options: [
      CHANNEL,
      { key: 'next', label: 'next stream', kind: 'text', placeholder: 'Friday 8pm' },
      { key: 'socials', label: 'socials', kind: 'text', placeholder: 'twitter/you,youtube/you', hint: 'Comma list of network/handle pairs.' },
      { key: 'msg', label: 'message', kind: 'text', placeholder: 'See you soon' },
      ACCENT,
      TRANSPARENT,
    ],
  },
  webcam: {
    options: [
      NAME,
      TITLE,
      ACCENT,
      { key: 'solid', label: 'solid backdrop', kind: 'flag' },
      CHECKER,
    ],
  },
  screenshare: {
    options: [NAME, TITLE, CORNER, CAMERA_OFF, ACCENT, CHECKER],
  },
  'screenshare-noname': {
    options: [CORNER, CAMERA_OFF, ACCENT, CHECKER],
  },
  'screenshare-side': {
    options: [NAME, TITLE, SIDEBAR, ACCENT, CHECKER],
  },
  'screenshare-side-noname': {
    options: [SIDEBAR, ACCENT, CHECKER],
  },
  overlay: {
    options: [
      NAME,
      TITLE,
      GOAL,
      GOAL_MAX,
      GOAL_LABEL,
      SCENE,
      SCENE_MINUTES,
      { key: 'lower', label: 'start lower third hidden (lower=0)', kind: 'flag', value: '0' },
      ACCENT,
      CHECKER,
    ],
  },
  'overlay-noname': {
    options: [GOAL, GOAL_MAX, GOAL_LABEL, SCENE, SCENE_MINUTES, ACCENT, CHECKER],
  },
};

/* ---------- transitions ---------- */

const STINGER_IDS = [
  'stinger',
  'stinger-vertical',
  'stinger-diagonal',
  'stinger-diamond',
  'stinger-radial',
  'stinger-iris',
  'stinger-stepped',
] as const;

const STINGER_OPTIONS: readonly OptionDef[] = [
  CHANNEL,
  { key: 'word', label: 'midpoint word', kind: 'text', placeholder: 'Be right back', hint: 'The last word is highlighted.' },
  { key: 'duration', label: 'duration (ms)', kind: 'number', placeholder: '1200', hint: 'Preview only — OBS sets the real duration.' },
  { key: 'tp', label: 'transition point', kind: 'number', placeholder: '0.5', hint: 'Preview only — 0.5 is the midpoint.' },
  ACCENT,
  CHECKER,
];

for (const id of STINGER_IDS) PAGE_DEFS[id] = { options: STINGER_OPTIONS };

/* ---------- rendering ---------- */

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (character) => {
    switch (character) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      default: return '&quot;';
    }
  });
}

function renderOption(pageId: string, option: OptionDef, index: number): string {
  const controlId = `opt-${pageId}-${index}`;
  const label = `<span class="opt-label">${escapeHtml(option.label)}</span>`;
  const title = option.hint ? ` title="${escapeHtml(option.hint)}"` : '';

  if (option.kind === 'flag') {
    const checked = option.on ? ' checked' : '';
    return `<label class="opt opt-flag"${title}>`
      + `<input id="${controlId}" type="checkbox" data-kind="flag" data-opt="${option.key}" data-on="${escapeHtml(option.value ?? '1')}"${checked}>`
      + label
      + '</label>';
  }

  if (option.kind === 'color') {
    return `<label class="opt opt-flag"${title}>`
      + `<input id="${controlId}" type="checkbox" data-kind="color" data-opt="${option.key}">`
      + `<input class="swatch" type="color" data-color="${option.key}" value="${escapeHtml(option.value ?? '#D60270')}">`
      + label
      + '</label>';
  }

  if (option.kind === 'select') {
    const items = (option.items ?? [])
      .map((item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`)
      .join('');
    return `<label class="opt"${title} for="${controlId}">${label}`
      + `<select id="${controlId}" data-kind="select" data-opt="${option.key}">${items}</select>`
      + '</label>';
  }

  const placeholder = option.placeholder ? ` placeholder="${escapeHtml(option.placeholder)}"` : '';
  return `<label class="opt"${title} for="${controlId}">${label}`
    + `<input id="${controlId}" type="${option.kind}" data-kind="${option.kind}" data-opt="${option.key}"${placeholder} autocomplete="off" spellcheck="false">`
    + '</label>';
}

function collectQuery(mount: HTMLElement, customParams: readonly CustomParam[]): string {
  const search = new URLSearchParams();

  for (const control of mount.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-kind]')) {
    const key = control.dataset.opt;
    if (!key) continue;

    switch (control.dataset.kind) {
      case 'flag':
        if ((control as HTMLInputElement).checked) search.set(key, control.dataset.on ?? '1');
        break;
      case 'color': {
        if ((control as HTMLInputElement).checked) {
          const picker = mount.querySelector<HTMLInputElement>(`input[type="color"][data-color="${key}"]`);
          search.set(key, (picker?.value ?? '#000000').replace('#', '').toUpperCase());
        }
        break;
      }
      default: {
        const value = control.value.trim();
        if (value) search.set(key, value);
        break;
      }
    }
  }

  for (const param of customParams) search.set(param.key, param.value);

  return search.toString().replace(/\+/g, '%20');
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const helper = document.createElement('textarea');
    helper.value = text;
    helper.setAttribute('readonly', '');
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    document.body.append(helper);
    helper.select();
    const copied = document.execCommand('copy');
    helper.remove();
    return copied;
  }
}

function buildCard(card: HTMLElement, def: PageDef): void {
  const mount = card.querySelector<HTMLElement>('.builder');
  const pageHref = card.querySelector<HTMLAnchorElement>('a.page-link')?.getAttribute('href');
  if (!mount || !pageHref) return;

  const pageId = card.dataset.page ?? 'page';
  const customParams: CustomParam[] = [];

  mount.innerHTML = [
    '<div class="options">',
    def.options.map((option, index) => renderOption(pageId, option, index)).join(''),
    '</div>',
    '<div class="custom">',
    '<input class="custom-key" type="text" placeholder="key" aria-label="Custom parameter name" autocomplete="off" spellcheck="false">',
    '<input class="custom-value" type="text" placeholder="value" aria-label="Custom parameter value" autocomplete="off" spellcheck="false">',
    '<button type="button" class="custom-add btn">add</button>',
    '</div>',
    '<div class="chips"></div>',
    '<div class="urlbar">',
    '<code class="url"></code>',
    '<a class="open-link btn primary" target="_blank" rel="noopener">open</a>',
    '<button type="button" class="copy btn" title="Copies the full address">copy</button>',
    '</div>',
  ].join('');

  const urlSlot = mount.querySelector<HTMLElement>('.url')!;
  const openLink = mount.querySelector<HTMLAnchorElement>('.open-link')!;
  const copyButton = mount.querySelector<HTMLButtonElement>('.copy')!;
  const keyInput = mount.querySelector<HTMLInputElement>('.custom-key')!;
  const valueInput = mount.querySelector<HTMLInputElement>('.custom-value')!;
  const addButton = mount.querySelector<HTMLButtonElement>('.custom-add')!;
  const chips = mount.querySelector<HTMLElement>('.chips')!;

  const relativeUrl = (): string => {
    const query = collectQuery(mount, customParams);
    return pageHref + (query ? '?' + query : '');
  };

  const refresh = (): void => {
    const url = relativeUrl();
    urlSlot.textContent = url;
    openLink.href = url;
  };

  const renderChips = (): void => {
    chips.innerHTML = '';
    customParams.forEach((param, index) => {
      const chip = document.createElement('span');
      chip.className = 'param-chip';
      chip.append(`${param.key}=${param.value}`);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'chip-remove';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Remove ${param.key}`);
      remove.addEventListener('click', () => {
        customParams.splice(index, 1);
        renderChips();
        refresh();
      });

      chip.append(remove);
      chips.append(chip);
    });
  };

  const addCustomParam = (): void => {
    const key = keyInput.value.trim();
    if (!key) return;

    const param: CustomParam = { key, value: valueInput.value.trim() };
    const existing = customParams.findIndex((entry) => entry.key === key);
    if (existing >= 0) customParams[existing] = param;
    else customParams.push(param);

    keyInput.value = '';
    valueInput.value = '';
    keyInput.focus();
    renderChips();
    refresh();
  };

  addButton.addEventListener('click', addCustomParam);
  keyInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') valueInput.focus();
  });
  valueInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') addCustomParam();
  });

  mount.addEventListener('input', refresh);
  mount.addEventListener('change', refresh);

  copyButton.addEventListener('click', async () => {
    const copied = await copyToClipboard(new URL(relativeUrl(), location.href).href);
    copyButton.textContent = copied ? 'copied' : 'ctrl+c';
    setTimeout(() => {
      copyButton.textContent = 'copy';
    }, 1400);
  });

  renderChips();
  refresh();
}

for (const card of document.querySelectorAll<HTMLElement>('.card[data-page]')) {
  const def = PAGE_DEFS[card.dataset.page ?? ''];
  if (def) buildCard(card, def);
}

export {};
