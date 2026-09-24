const MODEL_CATALOG = {
  image: {
    title: 'Choose an image model',
    description: 'Select a production image model, then continue to the creator page.',
    models: [
      {
        id: 'openai/gpt-image-2-5-flare',
        type: 'image',
        provider: 'OpenAI',
        name: 'GPT Image 2.5 Flare',
        blurb: 'Fast premium image generation for polished marketing, concept, and product visuals.',
        badge: 'Text to Image',
        meta: 'Async Wiro Run + Task Detail',
        sizeOptions: ['auto', '1:1', '3:2', '2:3'],
        cta: 'Open Creator',
        available: true,
        hero: 'linear-gradient(135deg, rgba(6, 182, 212, 0.35), rgba(37, 99, 235, 0.18) 45%, rgba(15, 23, 42, 0.92))',
      },
      {
        id: 'openai/gpt-image-2',
        type: 'image',
        provider: 'OpenAI',
        name: 'GPT Image 2',
        blurb: 'Balanced OpenAI image model for dependable generation and editing tasks.',
        badge: 'Text to Image',
        meta: 'Async Wiro Run + Task Detail',
        sizeOptions: ['auto', '1:1', '3:2', '2:3'],
        cta: 'Open Creator',
        available: true,
        hero: 'linear-gradient(135deg, rgba(168, 85, 247, 0.38), rgba(244, 63, 94, 0.18) 45%, rgba(15, 23, 42, 0.92))',
      },
    ],
  },
  video: {
    title: 'Choose a video model',
    description: 'Video model cards are reserved for the next integration phase.',
    models: [
      { id: 'video-coming-soon-1', type: 'video', provider: 'Wiro', name: 'Video Studio', blurb: 'Prepared for future video generation workflows.', badge: 'Coming Soon', meta: 'Video integration next step', cta: 'Coming Soon', available: false, hero: 'linear-gradient(135deg, rgba(14, 116, 144, 0.55), rgba(15, 23, 42, 0.9))' },
      { id: 'video-coming-soon-2', type: 'video', provider: 'Wiro', name: 'Motion Pro', blurb: 'Prepared slot for cinematic video models.', badge: 'Coming Soon', meta: 'Video integration next step', cta: 'Coming Soon', available: false, hero: 'linear-gradient(135deg, rgba(91, 33, 182, 0.55), rgba(15, 23, 42, 0.9))' },
    ],
  },
  chat: {
    title: 'Choose a chat model',
    description: 'Chat model cards are reserved for the next integration phase.',
    models: [
      { id: 'chat-coming-soon-1', type: 'chat', provider: 'Wiro', name: 'Chat Assistant', blurb: 'Prepared for conversational model routing.', badge: 'Coming Soon', meta: 'Chat integration next step', cta: 'Coming Soon', available: false, hero: 'linear-gradient(135deg, rgba(22, 163, 74, 0.45), rgba(15, 23, 42, 0.9))' },
      { id: 'chat-coming-soon-2', type: 'chat', provider: 'Wiro', name: 'Reasoning Agent', blurb: 'Prepared slot for future reasoning models.', badge: 'Coming Soon', meta: 'Chat integration next step', cta: 'Coming Soon', available: false, hero: 'linear-gradient(135deg, rgba(249, 115, 22, 0.45), rgba(15, 23, 42, 0.9))' },
    ],
  },
};

const DEFAULT_CREDIT_COSTS = Object.freeze({ image: 10, video: 35, chat: 3 });
const IMPLEMENTED_CREATOR_TYPES = new Set(['image']);
const apiBaseMeta = document.querySelector('meta[name="chilllix-api-base"]')?.getAttribute('content') || '';
const apiBaseWindow = typeof window.CHILLLIX_API_BASE_URL === 'string' ? window.CHILLLIX_API_BASE_URL : '';
const normalizedApiBase = (apiBaseWindow || apiBaseMeta).trim().replace(/\/+$/, '');
const apiOrigin = normalizedApiBase.replace(/\/api$/, '');
const resolveApiUrl = (path) => {
  if (!apiOrigin) return path;
  return `${apiOrigin}${path.startsWith('/') ? path : `/${path}`}`;
};

let socketInstance = null;

const state = {
  user: null,
  dashboard: null,
  creditsBalance: 0,
  creditCosts: { ...DEFAULT_CREDIT_COSTS },
  savedPrompts: [],
  assets: [],
  transactions: [],
  activeDrawer: 'dashboard',
  activeAction: 'image',
  workspaceAction: 'image',
  selectedModel: null,
  drawerOpen: false,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const createElement = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

const formatDate = (value) => value ? new Date(value).toLocaleString() : '—';
const formatCoordinates = (details = {}) => {
  const lat = details?.latitude ?? details?.lastLoginLatitude ?? null;
  const lng = details?.longitude ?? details?.lastLoginLongitude ?? null;
  if (lat === null || lng === null || lat === undefined || lng === undefined) return 'No coordinates saved';
  return `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`;
};

const showAuthFeedback = (message = '') => {
  const element = $('#auth-feedback');
  element.textContent = message;
  element.classList.toggle('hidden', !message);
};

const showSettingsFeedback = (message = '', tone = 'info') => {
  const element = $('#settings-feedback');
  element.textContent = message;
  element.classList.remove('hidden', 'border-red-400/30', 'bg-red-500/10', 'text-red-200', 'border-cyan-400/30', 'bg-cyan-500/10', 'text-cyan-100');
  if (!message) {
    element.classList.add('hidden');
    return;
  }
  if (tone === 'error') {
    element.classList.add('border-red-400/30', 'bg-red-500/10', 'text-red-200');
    return;
  }
  element.classList.add('border-cyan-400/30', 'bg-cyan-500/10', 'text-cyan-100');
};

const api = async (path, options = {}) => {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(resolveApiUrl(path), { credentials: 'include', ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || 'Request failed');
    error.status = response.status;
    throw error;
  }
  return payload;
};

const getClientLocation = async () => new Promise((resolve) => {
  if (!navigator.geolocation) {
    resolve({ latitude: null, longitude: null });
    return;
  }
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => resolve({ latitude: Number(coords.latitude.toFixed(6)), longitude: Number(coords.longitude.toFixed(6)) }),
    () => resolve({ latitude: null, longitude: null }),
    { enableHighAccuracy: false, timeout: 5000, maximumAge: 60 * 1000 },
  );
});

const setDrawerOpen = (open) => {
  state.drawerOpen = open;
  $('#drawer').classList.toggle('drawer-open', open || window.innerWidth >= 1024);
  $('#drawer-overlay').classList.toggle('hidden', !open || window.innerWidth >= 1024);
};

const syncCreditsBalance = () => {
  const value = String(state.creditsBalance || 0);
  $('#credits-balance').textContent = value;
  $('#pricing-credits-balance').textContent = value;
  $('#dashboard-credits').textContent = value;
};

const updateSessionUI = () => {
  syncCreditsBalance();
  $('#session-email').textContent = state.user?.email || '';
  $('#session-role').textContent = state.user?.role || '';
  $('#session-banner').textContent = state.user
    ? `Signed in as ${state.user.email}. Cookie session active.`
    : 'Select a model and generate securely.';
};

const showAuthScreen = () => {
  $('#auth-screen').classList.remove('hidden');
  $('#app-shell').classList.add('hidden');
  requestAnimationFrame(() => $('#signin-email')?.focus());
};

const showAppShell = () => {
  $('#auth-screen').classList.add('hidden');
  $('#app-shell').classList.remove('hidden');
};

const clearSession = async () => {
  state.user = null;
  state.dashboard = null;
  state.creditsBalance = 0;
  state.creditCosts = { ...DEFAULT_CREDIT_COSTS };
  state.savedPrompts = [];
  state.assets = [];
  state.transactions = [];
  socketInstance?.disconnect();
  socketInstance = null;
  updateSessionUI();
  renderDashboard();
  renderAssets();
  renderPrompts();
  renderTransactions();
  renderSettings();
  showAuthScreen();
};

const syncProfile = (profile) => {
  state.user = profile;
  state.creditsBalance = profile.creditsBalance || 0;
  state.creditCosts = { ...DEFAULT_CREDIT_COSTS, ...(profile.creditCosts || {}) };
  updateSessionUI();
};

const connectSocket = () => {
  if (!window.io || !state.user) return;
  socketInstance?.disconnect();
  socketInstance = window.io(apiOrigin || undefined, { withCredentials: true });
  socketInstance.on('generation:update', async (payload) => {
    updatePreview(payload);
    if (['completed', 'failed'].includes(payload.status)) {
      await Promise.allSettled([loadDashboard(), loadPrompts(), loadGenerations()]);
    }
  });
};

const showSection = (sectionId) => {
  $$('.content-section').forEach((section) => section.classList.add('hidden'));
  $(`#${sectionId}`)?.classList.remove('hidden');
  $$('.drawer-btn').forEach((button) => {
    const active = button.dataset.drawer === state.activeDrawer;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  $$('.topbar-btn').forEach((button) => {
    const active = button.dataset.action === state.activeAction;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
};

const setActiveDrawer = async (drawer) => {
  state.activeDrawer = drawer;
  if (drawer === 'workspace') {
    state.activeAction = state.workspaceAction;
  } else if (drawer === 'payments') {
    state.activeAction = 'payments';
  }
  showSection(drawer);
  if (window.innerWidth < 1024) setDrawerOpen(false);
};

const updateActionHeader = () => {
  const current = MODEL_CATALOG[state.activeAction] || MODEL_CATALOG.image;
  $('#catalog-kicker').textContent = state.activeAction === 'chat' ? 'AI chat' : `Generate ${state.activeAction}`;
  $('#catalog-title').textContent = current.title;
  $('#catalog-description').textContent = current.description;
};

const renderModelCards = () => {
  const grid = $('#model-card-grid');
  const catalog = MODEL_CATALOG[state.activeAction] || MODEL_CATALOG.image;
  grid.innerHTML = '';
  catalog.models.forEach((model) => {
    const card = createElement('article', 'model-card');
    const hero = createElement('div', 'model-card-hero');
    hero.style.backgroundImage = model.hero;
    const body = createElement('div', 'model-card-body');
    body.appendChild(createElement('span', 'model-card-badge', model.badge));
    body.appendChild(createElement('h3', 'text-2xl font-semibold', model.name));
    body.appendChild(createElement('p', 'text-sm uppercase tracking-[0.2em] text-slate-500', model.provider));
    body.appendChild(createElement('p', 'text-sm leading-6 text-slate-400', model.blurb));
    body.appendChild(createElement('p', 'text-xs uppercase tracking-[0.24em] text-slate-500', model.meta));
    const button = createElement('button', 'model-card-btn text-sm', model.cta);
    button.type = 'button';
    button.dataset.selectModel = model.id;
    button.disabled = !model.available;
    body.appendChild(button);
    card.append(hero, body);
    grid.appendChild(card);
  });
};

const renderDashboardList = (containerId, items, renderer, emptyText) => {
  const container = $(containerId);
  container.innerHTML = '';
  if (!items?.length) {
    container.appendChild(createElement('div', 'activity-card text-sm text-slate-400', emptyText));
    return;
  }
  items.forEach((item) => container.appendChild(renderer(item)));
};

const renderDashboard = () => {
  $('#dashboard-generations').textContent = String(state.dashboard?.stats?.totalGenerations || 0);
  $('#dashboard-success').textContent = String(state.dashboard?.stats?.successfulGenerations || 0);
  $('#dashboard-prompts').textContent = String(state.dashboard?.stats?.savedPrompts || 0);

  renderDashboardList('#dashboard-logins', state.dashboard?.recentLogins, (log) => {
    const card = createElement('article', 'activity-card');
    card.appendChild(createElement('p', 'font-medium', `${log.action.replaceAll('.', ' ')}`));
    card.appendChild(createElement('p', 'mt-2 text-sm text-slate-400', `${formatDate(log.createdAt)} · ${log.ipAddress || 'No IP'}`));
    card.appendChild(createElement('p', 'mt-1 text-xs text-slate-500', formatCoordinates(log.details)));
    return card;
  }, 'No login trace yet.');

  renderDashboardList('#dashboard-activity', state.dashboard?.recentGenerations, (generation) => {
    const card = createElement('article', 'activity-card');
    card.appendChild(createElement('p', 'font-medium', `${generation.type.toUpperCase()} · ${generation.status}`));
    card.appendChild(createElement('p', 'mt-2 text-sm text-slate-400', generation.modelUsed || 'Model pending'));
    const prompt = createElement('p', 'mt-1 text-xs text-slate-500', generation.prompt);
    prompt.title = generation.prompt;
    card.appendChild(prompt);
    return card;
  }, 'No generation history yet.');
};

const renderAssets = () => {
  const grid = $('#asset-grid');
  grid.innerHTML = '';
  if (!state.assets.length) {
    grid.appendChild(createElement('div', 'activity-card text-sm text-slate-400', 'No generation history yet.'));
    return;
  }
  state.assets.forEach((asset) => {
    const card = createElement('article', 'glass rounded-3xl p-4');
    if (asset.outputUrl) {
      const image = createElement('img', 'mb-3 h-40 w-full rounded-2xl object-cover');
      image.src = asset.outputUrl;
      image.alt = asset.prompt;
      card.appendChild(image);
    }
    card.appendChild(createElement('p', 'text-sm font-medium', `${asset.type.toUpperCase()} · ${asset.status}`));
    card.appendChild(createElement('p', 'mt-2 text-sm text-slate-400', asset.modelUsed || 'Model not recorded'));
    const prompt = createElement('p', 'mt-2 text-xs text-slate-500', asset.prompt);
    prompt.title = asset.prompt;
    card.appendChild(prompt);
    card.appendChild(createElement('p', 'mt-3 text-xs text-slate-500', formatDate(asset.createdAt)));
    grid.appendChild(card);
  });
};

const renderPrompts = (items = state.savedPrompts) => {
  const list = $('#saved-prompts-list');
  list.innerHTML = '';
  if (!items.length) {
    list.appendChild(createElement('div', 'activity-card text-sm text-slate-400', 'No saved prompts yet.'));
    return;
  }
  items.forEach((item) => {
    const row = createElement('article', 'activity-card');
    row.appendChild(createElement('p', 'font-medium', item.title));
    row.appendChild(createElement('p', 'mt-1 text-sm text-slate-400', item.promptText));
    row.appendChild(createElement('p', 'mt-2 text-xs uppercase tracking-[0.24em] text-slate-500', item.category));
    const button = createElement('button', 'secondary-btn mt-3 text-xs', 'Use Prompt');
    button.type = 'button';
    button.dataset.usePrompt = item.id;
    row.appendChild(button);
    list.appendChild(row);
  });
};

const renderTransactions = () => {
  const list = $('#payment-list');
  list.innerHTML = '';
  if (!state.transactions.length) {
    list.appendChild(createElement('div', 'activity-card text-sm text-slate-400', 'No payment transactions yet.'));
    return;
  }
  state.transactions.forEach((item) => {
    const card = createElement('article', 'activity-card');
    card.appendChild(createElement('p', 'font-medium', `${item.gateway} · ${item.paymentStatus}`));
    card.appendChild(createElement('p', 'mt-2 text-sm text-slate-400', `${item.currency} ${item.amount} · ${item.creditsAdded} credits`));
    card.appendChild(createElement('p', 'mt-1 text-xs text-slate-500', formatDate(item.createdAt)));
    list.appendChild(card);
  });
};

const renderSettings = () => {
  const security = state.dashboard?.security || {};
  $('#settings-avatar').value = state.user?.avatarUrl || '';
  const account = $('#settings-account');
  account.innerHTML = '';
  [
    ['Email', state.user?.email || '—'],
    ['Last Login', formatDate(security.lastLoginAt)],
    ['Last Login IP', security.lastLoginIp || '—'],
    ['Last Coordinates', formatCoordinates(security)],
    ['Temporary Lock', security.lockedUntil ? formatDate(security.lockedUntil) : 'Not locked'],
  ].forEach(([label, value]) => {
    const row = createElement('p', '');
    const strong = createElement('strong', '', `${label}: `);
    row.appendChild(strong);
    row.appendChild(document.createTextNode(String(value)));
    account.appendChild(row);
  });
  renderDashboardList('#settings-security', state.dashboard?.recentLogins, (log) => {
    const card = createElement('article', 'activity-card');
    card.appendChild(createElement('p', 'font-medium', log.action));
    card.appendChild(createElement('p', 'mt-2 text-sm text-slate-400', `${formatDate(log.createdAt)} · ${log.ipAddress || 'No IP'}`));
    return card;
  }, 'No security events yet.');
};

const updatePreview = ({ status, progress = 0, outputUrl } = {}) => {
  $('#generation-status').textContent = status || 'Idle';
  $('#progress-bar').style.width = `${progress}%`;
  $('#skeleton-loader').classList.toggle('hidden', !status || status === 'completed' || status === 'idle');
  if (outputUrl) {
    $('#preview-placeholder').classList.add('hidden');
    $('#preview-image').src = outputUrl;
    $('#preview-image').classList.remove('hidden');
    $('#download-link').href = outputUrl;
    $('#download-link').classList.remove('hidden');
    $('#share-btn').classList.remove('hidden');
  }
};

const resetPreview = () => {
  $('#preview-image').classList.add('hidden');
  $('#download-link').classList.add('hidden');
  $('#share-btn').classList.add('hidden');
  $('#preview-placeholder').classList.remove('hidden');
  $('#preview-image').removeAttribute('src');
  updatePreview({ status: 'idle', progress: 0 });
};

const updateCreditWarning = (message = '') => {
  const warning = $('#credit-warning');
  warning.textContent = message;
  warning.classList.toggle('hidden', !message);
};

const populateCreator = (model) => {
  state.selectedModel = model;
  $('#generation-type').value = model.type;
  $('#generation-model').value = model.id;
  $('#creator-kicker').textContent = `${model.type} creator`;
  $('#creator-title').textContent = model.name;
  $('#creator-description').textContent = model.blurb;
  $('#creator-model-provider').textContent = `${model.provider} · ${model.id}`;
  $('#creator-model-meta').textContent = model.meta;
  $('#selected-model-chip').textContent = model.badge;
  $('#generate-submit').textContent = `Generate with ${model.name}`;
  const sizeSelect = $('#aspect-ratio');
  sizeSelect.innerHTML = '';
  (model.sizeOptions || ['auto']).forEach((size) => {
    const option = createElement('option', '', size);
    option.value = size;
    sizeSelect.appendChild(option);
  });
  const requiredCredits = state.creditCosts[model.type] || 0;
  updateCreditWarning(state.creditsBalance < requiredCredits ? `This ${model.type} generation needs ${requiredCredits} credits.` : '');
  $('#catalog-view').classList.add('hidden');
  $('#creator-view').classList.remove('hidden');
  resetPreview();
  $('#prompt').focus();
};

const returnToCatalog = () => {
  state.selectedModel = null;
  $('#creator-view').classList.add('hidden');
  $('#catalog-view').classList.remove('hidden');
  updateCreditWarning('');
};

const setTopAction = (action) => {
  if (action === 'payments') {
    state.activeAction = 'payments';
    setActiveDrawer('payments');
    return;
  }
  state.activeAction = action;
  state.workspaceAction = action;
  updateActionHeader();
  renderModelCards();
  returnToCatalog();
  setActiveDrawer('workspace');
};

const loadProfile = async () => {
  const profile = await api('/api/profile');
  syncProfile(profile);
};

const loadDashboard = async () => {
  state.dashboard = await api('/api/profile/dashboard');
  syncProfile(state.dashboard.profile);
  state.transactions = state.dashboard.recentTransactions || [];
  state.assets = state.dashboard.recentGenerations || [];
  state.savedPrompts = state.dashboard.recentPrompts || [];
  renderDashboard();
  renderAssets();
  renderPrompts();
  renderTransactions();
  renderSettings();
};

const loadPrompts = async () => {
  state.savedPrompts = await api('/api/prompts');
  renderPrompts();
};

const loadGenerations = async () => {
  state.assets = await api('/api/generate');
  renderAssets();
};

const loadTransactions = async () => {
  state.transactions = await api('/api/transactions');
  renderTransactions();
};

const restoreSession = async () => {
  try {
    await loadProfile();
    await Promise.allSettled([loadDashboard(), loadPrompts(), loadGenerations(), loadTransactions()]);
    showAppShell();
    connectSocket();
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      await clearSession();
      return;
    }
    showAuthFeedback('Unable to restore the current session right now. Please refresh and try again.');
    showAuthScreen();
  }
};

$$('[data-auth-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    const target = button.dataset.authTab;
    const signInForm = $('#signin-form');
    const signUpForm = $('#signup-form');
    const showSignIn = target === 'signin';
    signInForm.classList.toggle('hidden', !showSignIn);
    signInForm.hidden = !showSignIn;
    signInForm.setAttribute('aria-hidden', String(!showSignIn));
    signUpForm.classList.toggle('hidden', showSignIn);
    signUpForm.hidden = showSignIn;
    signUpForm.setAttribute('aria-hidden', String(showSignIn));
    $$('[data-auth-tab]').forEach((tab) => {
      const active = tab.dataset.authTab === target;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    showAuthFeedback('');
  });
});

$('#signin-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  showAuthFeedback('');
  try {
    const location = await getClientLocation();
    await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: $('#signin-email').value.trim(), password: $('#signin-password').value, location }),
    });
    $('#signin-form').reset();
    await restoreSession();
  } catch (error) {
    showAuthFeedback(error.message);
  }
});

$('#signup-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  showAuthFeedback('');
  if ($('#signup-password').value !== $('#signup-confirm-password').value) {
    showAuthFeedback('Passwords do not match.');
    return;
  }
  try {
    const location = await getClientLocation();
    await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: $('#signup-email').value.trim(), password: $('#signup-password').value, location }),
    });
    $('#signup-form').reset();
    await restoreSession();
  } catch (error) {
    showAuthFeedback(error.message);
  }
});

$('#logout-btn').addEventListener('click', async () => {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch (_error) {
    // ignore logout failures and clear UI anyway
  }
  await clearSession();
});

$('#drawer-open').addEventListener('click', () => setDrawerOpen(true));
$('#drawer-close').addEventListener('click', () => setDrawerOpen(false));
$('#drawer-overlay').addEventListener('click', () => setDrawerOpen(false));
window.addEventListener('resize', () => setDrawerOpen(state.drawerOpen));

$('#generation-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const requiredCredits = state.creditCosts[$('#generation-type').value] || 0;
  if (state.creditsBalance < requiredCredits) {
    updateCreditWarning(`You need ${requiredCredits} credits for this generation.`);
    setActiveDrawer('payments');
    return;
  }
  resetPreview();
  updatePreview({ status: 'queued', progress: 12 });
  try {
    await api('/api/generate', {
      method: 'POST',
      body: JSON.stringify({
        prompt: $('#prompt').value,
        type: $('#generation-type').value,
        model: $('#generation-model').value,
        aspectRatio: $('#aspect-ratio').value,
      }),
    });
    await Promise.allSettled([loadProfile(), loadDashboard(), loadGenerations()]);
    updateCreditWarning('');
  } catch (error) {
    if (error.status === 402 || /insufficient/i.test(error.message)) {
      updateCreditWarning(`You need ${requiredCredits} credits for this generation.`);
      setActiveDrawer('payments');
      updatePreview({ status: 'insufficient credits', progress: 0 });
      return;
    }
    updatePreview({ status: error.message, progress: 0 });
  }
});

$('#save-prompt-btn').addEventListener('click', async () => {
  try {
    const prompt = await api('/api/prompts', {
      method: 'POST',
      body: JSON.stringify({
        title: state.selectedModel ? `${state.selectedModel.name} Prompt` : `Prompt ${state.savedPrompts.length + 1}`,
        promptText: $('#prompt').value,
        category: $('#generation-type').value,
        tags: ['favorite'],
      }),
    });
    state.savedPrompts.unshift(prompt);
    renderPrompts();
  } catch (error) {
    updatePreview({ status: error.message, progress: 0 });
  }
});

$('#prompt-search').addEventListener('input', (event) => {
  const search = event.target.value.toLowerCase();
  renderPrompts(state.savedPrompts.filter((item) => `${item.title} ${item.promptText}`.toLowerCase().includes(search)));
});

$('#history-refresh').addEventListener('click', loadGenerations);
$('#back-to-models').addEventListener('click', returnToCatalog);

$('#settings-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  showSettingsFeedback('');
  try {
    await api('/api/profile', { method: 'PUT', body: JSON.stringify({ avatarUrl: $('#settings-avatar').value || undefined }) });
    await Promise.allSettled([loadProfile(), loadDashboard()]);
    showSettingsFeedback('Settings saved.');
  } catch (error) {
    showSettingsFeedback(error.message, 'error');
  }
});

$('#share-btn').addEventListener('click', async () => {
  const url = $('#download-link').getAttribute('href');
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    updatePreview({ status: 'link copied', progress: 100, outputUrl: url });
  } catch (_error) {
    updatePreview({ status: 'unable to copy link', progress: 0, outputUrl: url });
  }
});

document.addEventListener('click', async (event) => {
  const drawerButton = event.target.closest('[data-drawer]');
  if (drawerButton) {
    await setActiveDrawer(drawerButton.dataset.drawer);
    return;
  }

  const topActionButton = event.target.closest('[data-action]');
  if (topActionButton) {
    setTopAction(topActionButton.dataset.action);
    return;
  }

  const modelButton = event.target.closest('[data-select-model]');
  if (modelButton) {
    const catalog = MODEL_CATALOG[state.activeAction] || MODEL_CATALOG.image;
    const selected = catalog.models.find((model) => model.id === modelButton.dataset.selectModel);
    if (selected?.available && IMPLEMENTED_CREATOR_TYPES.has(selected.type)) populateCreator(selected);
    return;
  }

  const usePromptButton = event.target.closest('[data-use-prompt]');
  if (usePromptButton) {
    const selected = state.savedPrompts.find((item) => item.id === usePromptButton.dataset.usePrompt);
    if (selected) {
      setTopAction(selected.category);
      const model = MODEL_CATALOG[selected.category]?.models.find((entry) => entry.available);
      if (model) {
        populateCreator(model);
        $('#prompt').value = selected.promptText;
      }
    }
  }
});

(async () => {
  updateActionHeader();
  renderModelCards();
  renderDashboard();
  renderAssets();
  renderPrompts();
  renderTransactions();
  renderSettings();
  showSection('dashboard');
  showAuthScreen();
  await restoreSession();
})();
