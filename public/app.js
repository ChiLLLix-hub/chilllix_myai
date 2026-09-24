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

const state = {
  token: '',
  creditsBalance: 0,
  savedPrompts: [],
  assets: [],
  activeDrawer: 'workspace',
  activeAction: 'image',
  workspaceAction: 'image',
  selectedModel: null,
};

const IMPLEMENTED_CREATOR_TYPES = new Set(['image']);
const STORAGE_KEYS = Object.freeze({
  token: 'chilllix.token',
  creditsBalance: 'chilllix.creditsBalance',
  guestEmail: 'chilllix.guest.email',
  guestPassword: 'chilllix.guest.password',
});

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const createElement = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

const focusFirstCatalogAction = () => {
  const firstAction = document.querySelector('[data-select-model]:not([disabled])');
  firstAction?.focus();
};

const syncCreditsBalance = () => {
  $('#credits-balance').textContent = String(state.creditsBalance || 0);
};

const createGuestCredentials = () => {
  const random = (globalThis.crypto?.randomUUID?.() || `guest-${Date.now()}`).replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
  const email = `guest-${random}@demo.chilllix.local`;
  const password = `${random}-Chilllix!2026`;
  localStorage.setItem(STORAGE_KEYS.guestEmail, email);
  localStorage.setItem(STORAGE_KEYS.guestPassword, password);
  return { email, password };
};

const getGuestCredentials = () => {
  const email = localStorage.getItem(STORAGE_KEYS.guestEmail);
  const password = localStorage.getItem(STORAGE_KEYS.guestPassword);
  if (email && password) return { email, password };
  return createGuestCredentials();
};

const applySession = (payload) => {
  state.token = payload.token;
  state.creditsBalance = payload.user?.creditsBalance || 0;
  localStorage.setItem(STORAGE_KEYS.token, payload.token);
  localStorage.setItem(STORAGE_KEYS.creditsBalance, String(state.creditsBalance));
  syncCreditsBalance();
};

const bootstrapSession = async () => {
  const persistedToken = localStorage.getItem(STORAGE_KEYS.token);
  const persistedCredits = localStorage.getItem(STORAGE_KEYS.creditsBalance);
  if (persistedCredits) {
    state.creditsBalance = Number.parseInt(persistedCredits, 10) || 0;
    syncCreditsBalance();
  }
  if (persistedToken) {
    state.token = persistedToken;
    try {
      const profile = await api('/api/profile');
      state.creditsBalance = profile.creditsBalance || 0;
      localStorage.setItem(STORAGE_KEYS.creditsBalance, String(state.creditsBalance));
      syncCreditsBalance();
      return;
    } catch (_error) {
      localStorage.removeItem(STORAGE_KEYS.token);
    }
  }

  const credentials = getGuestCredentials();
  try {
    const loginPayload = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    applySession(loginPayload);
    return;
  } catch (error) {
    if (!/Invalid credentials/i.test(error.message)) {
      throw error;
    }
  }

  const registerPayload = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
  applySession(registerPayload);
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

const setActiveDrawer = (drawer) => {
  state.activeDrawer = drawer;
  state.activeAction = drawer === 'workspace' ? state.workspaceAction : null;
  showSection(drawer);
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
    action.disabled = !model.available;
    body.appendChild(action);

    card.append(hero, body);
    grid.appendChild(card);
  });
};

const renderAssets = () => {
  const grid = $('#asset-grid');
  grid.innerHTML = '';
  state.assets.forEach((asset) => {
    const card = createElement('article', 'glass rounded-3xl p-4');
    if (asset.outputUrl) {
      const image = createElement('img', 'mb-3 h-40 w-full rounded-2xl object-cover');
      image.src = asset.outputUrl;
      image.alt = asset.prompt;
      card.appendChild(image);
    } else {
      const chatPreview = createElement('div', 'mb-3 flex h-40 w-full items-center justify-center rounded-2xl border border-dashed border-white/10 bg-slate-900/60 px-4 text-center text-sm text-slate-300', 'Chat output preview available in transcript/export');
      card.appendChild(chatPreview);
    }

    const type = createElement('p', 'text-sm font-medium', asset.type.toUpperCase());
    const prompt = createElement('p', 'mt-2 text-xs text-slate-400', asset.prompt.slice(0, 100));
    prompt.title = asset.prompt;

    const footer = createElement('div', 'mt-3 flex items-center justify-between text-xs text-slate-400');
    footer.appendChild(createElement('span', '', `Expires ${new Date(asset.expiresAt).toLocaleDateString()}`));
    const download = createElement('a', 'text-cyan-300', 'Download');
    download.href = asset.outputUrl;
    download.download = '';
    footer.appendChild(download);

    card.append(type, prompt, footer);
    grid.appendChild(card);
  });
};

const renderPrompts = (items = state.savedPrompts) => {
  const list = $('#saved-prompts-list');
  list.innerHTML = '';
  items.forEach((item) => {
    const row = createElement('article', 'glass rounded-3xl p-4');
    const wrapper = createElement('div', 'flex items-start justify-between gap-4');
    const content = createElement('div');
    content.appendChild(createElement('p', 'font-medium', item.title));
    content.appendChild(createElement('p', 'mt-1 text-sm text-slate-400', item.promptText));

    const tags = createElement('div', 'mt-2 flex flex-wrap gap-2 text-xs text-cyan-300');
    (item.tags || []).forEach((tag) => {
      tags.appendChild(createElement('span', '', `#${tag}`));
    });
    content.appendChild(tags);

    const useButton = createElement('button', 'secondary-btn text-xs', 'Use Prompt');
    useButton.dataset.usePrompt = item.id;

    wrapper.append(content, useButton);
    row.appendChild(wrapper);
    list.appendChild(row);
  });
};

const updatePreview = ({ status, progress = 0, outputUrl }) => {
  $('#generation-status').textContent = status;
  $('#progress-bar').style.width = `${progress}%`;
  $('#skeleton-loader').classList.toggle('hidden', status === 'completed' || status === 'idle');
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

  $('#catalog-view').classList.add('hidden');
  $('#creator-view').classList.remove('hidden');
  resetPreview();
  $('#prompt').focus();
};

const returnToCatalog = () => {
  state.selectedModel = null;
  $('#creator-view').classList.add('hidden');
  $('#catalog-view').classList.remove('hidden');
  focusFirstCatalogAction();
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

  const catalog = MODEL_CATALOG[category];
  const selected = catalog?.models.find((model) => model.available);
  if (!selected) {
    alert(`No ${category} creator is available yet.`);
    return;
  }

  populateCreator(selected);
  if (promptText) $('#prompt').value = promptText;
};

const connectSocket = () => {
  if (!window.io) return;
  const socket = window.io({ auth: state.token ? { token: state.token } : {} });
  socket.on('generation:update', (payload) => {
    updatePreview(payload);
  });
};

const api = async (path, options = {}) => {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: 'Bearer ' + state.token } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Request failed');
  return payload;
};

$('#generation-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  updatePreview({ status: 'queued', progress: 12 });
  try {
    resetPreview();
    updatePreview({ status: 'queued', progress: 12 });
    await api('/api/generate', {
      method: 'POST',
      body: JSON.stringify({
        prompt: $('#prompt').value,
        type: $('#generation-type').value,
        model: $('#generation-model').value,
        aspectRatio: $('#aspect-ratio').value,
      }),
    });
  } catch (error) {
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
    alert(error.message);
  }
});

$('#prompt-search').addEventListener('input', (event) => {
  const search = event.target.value.toLowerCase();
  renderPrompts(state.savedPrompts.filter((item) => `${item.title} ${item.promptText}`.toLowerCase().includes(search)));
});

$('#back-to-models').addEventListener('click', returnToCatalog);

document.addEventListener('click', (event) => {
  const drawerButton = event.target.closest('[data-drawer]');
  if (drawerButton) {
    setActiveDrawer(drawerButton.dataset.drawer);
  }

  const topActionButton = event.target.closest('[data-action]');
  if (topActionButton) {
    setTopAction(topActionButton.dataset.action);
  }

  const modelButton = event.target.closest('[data-select-model]');
  if (modelButton) {
    const catalog = MODEL_CATALOG[state.activeAction];
    const selected = catalog.models.find((model) => model.id === modelButton.dataset.selectModel);
    if (selected?.available) populateCreator(selected);
  }

  const usePromptButton = event.target.closest('[data-use-prompt]');
  if (usePromptButton) {
    const selected = state.savedPrompts.find((item) => item.id === usePromptButton.dataset.usePrompt);
    if (selected) {
      openCreatorForCategory(selected.category, selected.promptText);
    }
  }
});

(async () => {
  updateActionHeader();
  renderModelCards();
  renderAssets();
  renderPrompts();
  showSection('workspace');
  syncCreditsBalance();
  try {
    await bootstrapSession();
  } catch (error) {
    updatePreview({ status: error.message, progress: 0 });
  }
  connectSocket();
})();
