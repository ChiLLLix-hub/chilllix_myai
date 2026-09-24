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
    description: 'Video model cards are ready in the UI and can be wired to creation flows next.',
    models: [
      {
        id: 'video-coming-soon-1',
        type: 'video',
        provider: 'Wiro',
        name: 'Video Studio',
        blurb: 'Reserved slot for the first production video workflow.',
        badge: 'Coming Soon',
        meta: 'Video integration next step',
        cta: 'Coming Soon',
        available: false,
        hero: 'linear-gradient(135deg, rgba(14, 116, 144, 0.55), rgba(15, 23, 42, 0.9))',
      },
      {
        id: 'video-coming-soon-2',
        type: 'video',
        provider: 'Wiro',
        name: 'Motion Pro',
        blurb: 'Prepared catalog slot for cinematic video generation models.',
        badge: 'Coming Soon',
        meta: 'Video integration next step',
        cta: 'Coming Soon',
        available: false,
        hero: 'linear-gradient(135deg, rgba(91, 33, 182, 0.55), rgba(15, 23, 42, 0.9))',
      },
    ],
  },
  chat: {
    title: 'Choose a chat model',
    description: 'Chat model cards are in place so the creator flow can be connected after image rollout.',
    models: [
      {
        id: 'chat-coming-soon-1',
        type: 'chat',
        provider: 'Wiro',
        name: 'Chat Assistant',
        blurb: 'Reserved slot for a focused chat generation experience.',
        badge: 'Coming Soon',
        meta: 'Chat integration next step',
        cta: 'Coming Soon',
        available: false,
        hero: 'linear-gradient(135deg, rgba(22, 163, 74, 0.45), rgba(15, 23, 42, 0.9))',
      },
      {
        id: 'chat-coming-soon-2',
        type: 'chat',
        provider: 'Wiro',
        name: 'Reasoning Agent',
        blurb: 'Prepared slot for future conversational model routing.',
        badge: 'Coming Soon',
        meta: 'Chat integration next step',
        cta: 'Coming Soon',
        available: false,
        hero: 'linear-gradient(135deg, rgba(249, 115, 22, 0.45), rgba(15, 23, 42, 0.9))',
      },
    ],
  },
};

const IMPLEMENTED_CREATOR_TYPES = new Set(['image']);
const STORAGE_KEYS = Object.freeze({ token: 'chilllix.token' });

let socketInstance = null;

const state = {
  token: '',
  user: null,
  creditsBalance: 0,
  savedPrompts: [],
  assets: [],
  adminUsers: [],
  activeDrawer: 'workspace',
  activeAction: 'image',
  workspaceAction: 'image',
  selectedModel: null,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const createElement = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

const showAuthFeedback = (message = '') => {
  const element = $('#auth-feedback');
  element.textContent = message;
  element.classList.toggle('hidden', !message);
};

const showAdminFeedback = (message = '', tone = 'info') => {
  const element = $('#admin-feedback');
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

const syncCreditsBalance = () => {
  const value = String(state.creditsBalance || 0);
  $('#credits-balance').textContent = value;
  $('#pricing-credits-balance').textContent = value;
};

const updateSessionUI = () => {
  syncCreditsBalance();
  $('#session-email').textContent = state.user?.email || '';
  $('#session-role').textContent = state.user?.role || '';
  $('#session-banner').textContent = state.user
    ? `Signed in as ${state.user.email}`
    : 'Select a model, then open the creator.';
  $('#admin-drawer-btn').classList.toggle('hidden', state.user?.role !== 'admin');
};

const showAuthScreen = () => {
  $('#auth-screen').classList.remove('hidden');
  $('#app-shell').classList.add('hidden');
  $$('#generate-submit, #save-prompt-btn, [data-select-model]').forEach((element) => {
    element.disabled = true;
  });
};

const showAppShell = () => {
  $('#auth-screen').classList.add('hidden');
  $('#app-shell').classList.remove('hidden');
  renderModelCards();
  $$('#generate-submit, #save-prompt-btn, [data-select-model]').forEach((element) => {
    if (element.matches('[data-select-model]')) {
      const unavailable = element.closest('.model-card')?.dataset.disabled === 'true';
      element.disabled = unavailable;
      return;
    }
    element.disabled = false;
  });
};

const clearSession = ({ showAuth = true } = {}) => {
  state.token = '';
  state.user = null;
  state.creditsBalance = 0;
  state.savedPrompts = [];
  state.assets = [];
  state.adminUsers = [];
  socketInstance?.disconnect();
  socketInstance = null;
  localStorage.removeItem(STORAGE_KEYS.token);
  updateSessionUI();
  renderModelCards();
  renderAssets();
  renderPrompts();
  renderAdminUsers([]);
  if (showAuth) showAuthScreen();
};

const applyAuthPayload = (payload) => {
  state.token = payload.token;
  state.user = payload.user;
  state.creditsBalance = payload.user?.creditsBalance || 0;
  localStorage.setItem(STORAGE_KEYS.token, payload.token);
  updateSessionUI();
  showAppShell();
  connectSocket();
};

const syncProfile = (profile) => {
  state.user = profile;
  state.creditsBalance = profile.creditsBalance || 0;
  updateSessionUI();
  if (state.user?.role !== 'admin' && state.activeDrawer === 'admin') {
    setActiveDrawer('workspace');
  }
};

const connectSocket = () => {
  if (!window.io || !state.token) return;
  socketInstance?.disconnect();
  socketInstance = window.io({ auth: { token: state.token } });
  socketInstance.on('generation:update', async (payload) => {
    updatePreview(payload);
    if (payload.status === 'completed' || payload.status === 'failed') {
      await Promise.allSettled([loadProfile(), loadGenerations()]);
    }
  });
};

const api = async (path, options = {}) => {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (state.token) {
    headers.Authorization = 'Bearer ' + state.token;
  }

  const response = await fetch(path, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || 'Request failed');
    error.status = response.status;
    error.payload = payload;
    if (response.status === 401) clearSession();
    throw error;
  }
  return payload;
};

const focusFirstCatalogAction = () => {
  const firstAction = document.querySelector('[data-select-model]:not([disabled])');
  firstAction?.focus();
};

const updateActionHeader = () => {
  const current = MODEL_CATALOG[state.activeAction];
  $('#catalog-kicker').textContent = state.activeAction === 'chat' ? 'AI chat' : `Generate ${state.activeAction}`;
  $('#catalog-title').textContent = current.title;
  $('#catalog-description').textContent = current.description;
};

const renderModelCards = () => {
  const grid = $('#model-card-grid');
  const catalog = MODEL_CATALOG[state.activeAction];
  grid.innerHTML = '';

  catalog.models.forEach((model) => {
    const card = createElement('article', 'model-card');
    card.dataset.modelId = model.id;
    card.dataset.disabled = String(!model.available);

    const hero = createElement('div', 'model-card-hero');
    hero.style.backgroundImage = model.hero;

    const body = createElement('div', 'model-card-body');
    body.appendChild(createElement('span', 'model-card-badge', model.badge));
    body.appendChild(createElement('h3', 'text-2xl font-semibold', model.name));
    body.appendChild(createElement('p', 'text-sm uppercase tracking-[0.2em] text-slate-500', model.provider));
    body.appendChild(createElement('p', 'text-sm leading-6 text-slate-400', model.blurb));
    body.appendChild(createElement('p', 'text-xs uppercase tracking-[0.24em] text-slate-500', model.meta));

    const action = createElement('button', 'model-card-btn text-sm', model.cta);
    action.type = 'button';
    action.dataset.selectModel = model.id;
    action.disabled = !state.token || !model.available;
    body.appendChild(action);

    card.append(hero, body);
    grid.appendChild(card);
  });
};

const renderAssets = () => {
  const grid = $('#asset-grid');
  grid.innerHTML = '';

  if (!state.assets.length) {
    grid.appendChild(createElement('div', 'rounded-3xl border border-dashed border-white/10 bg-slate-900/50 p-6 text-sm text-slate-400', 'No generations yet. Sign in and create your first image model run.'));
    return;
  }

  state.assets.forEach((asset) => {
    const card = createElement('article', 'glass rounded-3xl p-4');
    if (asset.outputUrl) {
      const image = createElement('img', 'mb-3 h-40 w-full rounded-2xl object-cover');
      image.src = asset.outputUrl;
      image.alt = asset.prompt;
      card.appendChild(image);
    } else {
      const placeholder = createElement('div', 'mb-3 flex h-40 w-full items-center justify-center rounded-2xl border border-dashed border-white/10 bg-slate-900/60 px-4 text-center text-sm text-slate-300', 'Output is still processing or unavailable.');
      card.appendChild(placeholder);
    }

    const title = createElement('p', 'text-sm font-medium', `${asset.type.toUpperCase()} · ${asset.status}`);
    const prompt = createElement('p', 'mt-2 text-xs text-slate-400', asset.prompt.slice(0, 100));
    prompt.title = asset.prompt;

    const footer = createElement('div', 'mt-3 flex items-center justify-between text-xs text-slate-400');
    footer.appendChild(createElement('span', '', new Date(asset.createdAt).toLocaleString()));
    if (asset.outputUrl) {
      const download = createElement('a', 'text-cyan-300', 'Download');
      download.href = asset.outputUrl;
      download.download = '';
      footer.appendChild(download);
    }

    card.append(title, prompt, footer);
    grid.appendChild(card);
  });
};

const renderPrompts = (items = state.savedPrompts) => {
  const list = $('#saved-prompts-list');
  list.innerHTML = '';

  if (!items.length) {
    list.appendChild(createElement('div', 'rounded-3xl border border-dashed border-white/10 bg-slate-900/50 p-6 text-sm text-slate-400', 'Saved prompts will appear here after you store them from the creator.'));
    return;
  }

  items.forEach((item) => {
    const row = createElement('article', 'glass rounded-3xl p-4');
    const wrapper = createElement('div', 'flex items-start justify-between gap-4');
    const content = createElement('div');
    content.appendChild(createElement('p', 'font-medium', item.title));
    content.appendChild(createElement('p', 'mt-1 text-sm text-slate-400', item.promptText));

    const tags = createElement('div', 'mt-2 flex flex-wrap gap-2 text-xs text-cyan-300');
    (item.tags || []).forEach((tag) => tags.appendChild(createElement('span', '', `#${tag}`)));
    content.appendChild(tags);

    const useButton = createElement('button', 'secondary-btn text-xs', 'Use Prompt');
    useButton.type = 'button';
    useButton.dataset.usePrompt = item.id;

    wrapper.append(content, useButton);
    row.appendChild(wrapper);
    list.appendChild(row);
  });
};

const renderAdminUsers = (users = state.adminUsers) => {
  const list = $('#admin-user-list');
  list.innerHTML = '';

  if (!users.length) {
    list.appendChild(createElement('div', 'rounded-3xl border border-dashed border-white/10 bg-slate-900/50 p-6 text-sm text-slate-400', 'No users matched the current search.'));
    return;
  }

  users.forEach((user) => {
    const card = createElement('article', 'admin-user-card');
    card.dataset.userId = user.id;

    const header = createElement('div', 'flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between');
    const identity = createElement('div');
    identity.appendChild(createElement('p', 'font-medium text-slate-100', user.email));
    identity.appendChild(createElement('p', 'text-xs uppercase tracking-[0.24em] text-slate-500', `Created ${new Date(user.createdAt).toLocaleDateString()}`));
    const badges = createElement('div', 'flex flex-wrap gap-2 text-xs');
    badges.appendChild(createElement('span', 'selected-model-chip', user.role));
    badges.appendChild(createElement('span', 'selected-model-chip', user.isSuspended ? 'Suspended' : 'Active'));
    header.append(identity, badges);

    const form = createElement('form', 'admin-user-form');
    form.dataset.userForm = user.id;

    const creditsLabel = createElement('label', 'space-y-2 text-sm text-slate-300');
    creditsLabel.appendChild(createElement('span', '', 'Credits'));
    const creditsInput = createElement('input', 'input w-full');
    creditsInput.type = 'number';
    creditsInput.min = '0';
    creditsInput.name = 'creditsBalance';
    creditsInput.value = String(user.creditsBalance || 0);
    creditsLabel.appendChild(creditsInput);

    const roleLabel = createElement('label', 'space-y-2 text-sm text-slate-300');
    roleLabel.appendChild(createElement('span', '', 'Role'));
    const roleSelect = createElement('select', 'input w-full');
    roleSelect.name = 'role';
    ['user', 'admin'].forEach((role) => {
      const option = createElement('option', '', role);
      option.value = role;
      option.selected = role === user.role;
      roleSelect.appendChild(option);
    });
    roleLabel.appendChild(roleSelect);

    const suspendedLabel = createElement('label', 'space-y-2 text-sm text-slate-300');
    suspendedLabel.appendChild(createElement('span', '', 'Status'));
    const suspendedSelect = createElement('select', 'input w-full');
    suspendedSelect.name = 'isSuspended';
    [['false', 'Active'], ['true', 'Suspended']].forEach(([value, text]) => {
      const option = createElement('option', '', text);
      option.value = value;
      option.selected = String(user.isSuspended) === value;
      suspendedSelect.appendChild(option);
    });
    suspendedLabel.appendChild(suspendedSelect);

    const saveButton = createElement('button', 'primary-btn', 'Save');
    saveButton.type = 'submit';

    form.append(creditsLabel, roleLabel, suspendedLabel, saveButton);
    card.append(header, form);
    list.appendChild(card);
  });
};

const updatePreview = ({ status, progress = 0, outputUrl } = {}) => {
  $('#generation-status').textContent = status || 'Idle';
  $('#progress-bar').style.width = `${progress}%`;
  $('#skeleton-loader').classList.toggle('hidden', status === 'completed' || status === 'idle' || !status);
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

  updateCreditWarning(state.creditsBalance <= 0 ? 'Your balance is low. Add credits before starting a new generation.' : '');
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
  focusFirstCatalogAction();
};

const showSection = (sectionId) => {
  $$('.content-section').forEach((section) => section.classList.add('hidden'));
  $(`#${sectionId}`)?.classList.remove('hidden');
  $$('.drawer-btn').forEach((button) => {
    const isActive = button.dataset.drawer === state.activeDrawer;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
  $$('.topbar-btn').forEach((button) => {
    const isActive = button.dataset.action === state.activeAction;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
};

const setActiveDrawer = async (drawer) => {
  if (drawer === 'admin' && state.user?.role !== 'admin') return;
  state.activeDrawer = drawer;
  if (drawer === 'workspace') {
    state.activeAction = state.workspaceAction;
    updateActionHeader();
    renderModelCards();
  } else if (drawer === 'library') {
    await loadGenerations();
  } else if (drawer === 'prompts') {
    await loadPrompts();
  } else if (drawer === 'admin') {
    await loadAdminView();
  } else {
    state.activeAction = null;
  }
  showSection(drawer);
};

const setTopAction = (action) => {
  state.activeAction = action;
  if (action === 'pricing') {
    state.activeDrawer = 'pricing';
    showSection('pricing');
    return;
  }
  state.workspaceAction = action;
  state.activeDrawer = 'workspace';
  updateActionHeader();
  renderModelCards();
  returnToCatalog();
  showSection('workspace');
};

const openCreatorForCategory = (category, promptText = '') => {
  if (!IMPLEMENTED_CREATOR_TYPES.has(category)) {
    alert(`${category.charAt(0).toUpperCase() + category.slice(1)} creator is not available yet.`);
    return;
  }
  setTopAction(category);
  const selected = MODEL_CATALOG[category]?.models.find((model) => model.available);
  if (!selected) {
    alert(`No ${category} creator is available yet.`);
    return;
  }
  populateCreator(selected);
  if (promptText) $('#prompt').value = promptText;
};

const loadProfile = async () => {
  const profile = await api('/api/profile');
  syncProfile(profile);
  return profile;
};

const loadPrompts = async () => {
  state.savedPrompts = await api('/api/prompts');
  renderPrompts();
};

const loadGenerations = async () => {
  state.assets = await api('/api/generate');
  renderAssets();
};

const loadAdminView = async () => {
  if (state.user?.role !== 'admin') return;
  const search = $('#admin-user-search').value.trim();
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  const [overview, users] = await Promise.all([
    api('/api/admin/overview'),
    api(`/api/admin/users${query}`),
  ]);
  $('#admin-users').textContent = String(overview.activeUsers || 0);
  $('#admin-generations').textContent = String(overview.totalGenerations || 0);
  $('#admin-revenue').textContent = `$${Number(overview.revenue || 0).toFixed(2)}`;
  $('#admin-logs-count').textContent = String((overview.logs || []).length);
  state.adminUsers = users;
  renderAdminUsers();
};

const hydrateAuthenticatedState = async () => {
  await Promise.all([loadProfile(), loadPrompts(), loadGenerations()]);
  showAppShell();
};

const restoreSession = async () => {
  const persistedToken = localStorage.getItem(STORAGE_KEYS.token);
  if (!persistedToken) {
    clearSession();
    return;
  }
  state.token = persistedToken;
  try {
    await hydrateAuthenticatedState();
    connectSocket();
  } catch (_error) {
    clearSession();
  }
};

const redirectToPricingForCredits = (message) => {
  updateCreditWarning(message);
  setTopAction('pricing');
  alert(message);
};

$('#signin-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  showAuthFeedback('');
  try {
    const payload = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: $('#signin-email').value.trim(),
        password: $('#signin-password').value,
      }),
    });
    applyAuthPayload(payload);
    await Promise.all([loadPrompts(), loadGenerations()]);
    setTopAction('image');
    $('#signin-form').reset();
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
    const payload = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: $('#signup-email').value.trim(),
        password: $('#signup-password').value,
      }),
    });
    applyAuthPayload(payload);
    await Promise.all([loadPrompts(), loadGenerations()]);
    setTopAction('image');
    $('#signup-form').reset();
  } catch (error) {
    showAuthFeedback(error.message);
  }
});

$$('[data-auth-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    const target = button.dataset.authTab;
    $$('#signin-form, #signup-form').forEach((form) => form.classList.add('hidden'));
    $(`#${target}-form`).classList.remove('hidden');
    $$('[data-auth-tab]').forEach((tab) => {
      const active = tab.dataset.authTab === target;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-pressed', String(active));
    });
    showAuthFeedback('');
  });
});

$('#logout-btn').addEventListener('click', () => {
  clearSession();
  returnToCatalog();
  setTopAction('image');
});

$('#generation-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.token) {
    clearSession();
    showAuthFeedback('Please sign in to generate content.');
    return;
  }
  if (state.creditsBalance <= 0) {
    redirectToPricingForCredits('You do not have enough credits. Please add credits before generating.');
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
    await loadProfile();
    updateCreditWarning('');
  } catch (error) {
    if (error.status === 402 || /insufficient credits/i.test(error.message)) {
      redirectToPricingForCredits('You do not have enough credits. Please add credits before generating.');
      updatePreview({ status: 'insufficient credits', progress: 0 });
      return;
    }
    updatePreview({ status: error.message, progress: 0 });
  }
});

$('#save-prompt-btn').addEventListener('click', async () => {
  if (!state.token) {
    clearSession();
    showAuthFeedback('Please sign in to save prompts.');
    return;
  }
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
    alert(error.message);
  }
});

$('#prompt-search').addEventListener('input', (event) => {
  const search = event.target.value.toLowerCase();
  renderPrompts(state.savedPrompts.filter((item) => `${item.title} ${item.promptText}`.toLowerCase().includes(search)));
});

$('#admin-refresh-btn').addEventListener('click', async () => {
  try {
    showAdminFeedback('');
    await loadAdminView();
  } catch (error) {
    showAdminFeedback(error.message, 'error');
  }
});

$('#admin-user-search').addEventListener('input', async () => {
  if (state.user?.role !== 'admin') return;
  try {
    await loadAdminView();
  } catch (error) {
    showAdminFeedback(error.message, 'error');
  }
});

$('#admin-user-list').addEventListener('submit', async (event) => {
  const form = event.target.closest('[data-user-form]');
  if (!form) return;
  event.preventDefault();

  const userId = form.dataset.userForm;
  const formData = new FormData(form);

  try {
    showAdminFeedback('');
    const updated = await api(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        creditsBalance: Number(formData.get('creditsBalance')),
        role: formData.get('role'),
        isSuspended: formData.get('isSuspended') === 'true',
      }),
    });

    state.adminUsers = state.adminUsers.map((user) => (user.id === updated.id ? updated : user));
    renderAdminUsers();
    showAdminFeedback(`Updated ${updated.email}.`);

    if (state.user?.id === updated.id) {
      syncProfile(updated);
      await loadAdminView();
    }
  } catch (error) {
    showAdminFeedback(error.message, 'error');
  }
});

$('#back-to-models').addEventListener('click', returnToCatalog);

$('#share-btn').addEventListener('click', async () => {
  const url = $('#download-link').getAttribute('href');
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    updatePreview({ status: 'link copied', progress: 100, outputUrl: url });
  } catch (_error) {
    alert('Unable to copy the share link.');
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
    if (!state.token) {
      clearSession();
      showAuthFeedback('Please sign in to use a model.');
      return;
    }
    const catalog = MODEL_CATALOG[state.activeAction];
    const selected = catalog.models.find((model) => model.id === modelButton.dataset.selectModel);
    if (selected?.available) populateCreator(selected);
    return;
  }

  const usePromptButton = event.target.closest('[data-use-prompt]');
  if (usePromptButton) {
    const selected = state.savedPrompts.find((item) => item.id === usePromptButton.dataset.usePrompt);
    if (selected) openCreatorForCategory(selected.category, selected.promptText);
  }
});

(async () => {
  updateActionHeader();
  renderModelCards();
  renderAssets();
  renderPrompts();
  renderAdminUsers([]);
  showSection('workspace');
  showAuthScreen();
  await restoreSession();
})();
