const state = {
  token: '',
  creditsBalance: 0,
  savedPrompts: [],
  assets: [],
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const setActiveSection = (sectionId) => {
  $$('.section-panel').forEach((section) => section.classList.add('hidden'));
  $(`#${sectionId}`)?.classList.remove('hidden');
  $$('.nav-btn').forEach((button) => button.classList.toggle('active', button.dataset.section === sectionId));
};

const setMode = (mode) => {
  $('#generation-type').value = mode;
  $$('.mode-btn').forEach((button) => button.classList.toggle('active', button.dataset.mode === mode));
};

const renderAssets = () => {
  const grid = $('#asset-grid');
  grid.innerHTML = '';
  state.assets.forEach((asset) => {
    const card = document.createElement('article');
    card.className = 'glass rounded-2xl p-3';
    card.innerHTML = `
      <img src="${asset.outputUrl}" alt="${asset.prompt}" class="mb-3 h-40 w-full rounded-xl object-cover" />
      <p class="text-sm font-medium">${asset.type.toUpperCase()}</p>
      <p class="mt-2 text-xs text-slate-400" title="${asset.prompt}">${asset.prompt.slice(0, 100)}</p>
      <div class="mt-3 flex items-center justify-between text-xs text-slate-400">
        <span>Expires ${new Date(asset.expiresAt).toLocaleDateString()}</span>
        <a href="${asset.outputUrl}" download class="text-cyan-300">Download</a>
      </div>
    `;
    grid.appendChild(card);
  });
};

const renderPrompts = (items = state.savedPrompts) => {
  const list = $('#saved-prompts-list');
  list.innerHTML = '';
  items.forEach((item) => {
    const row = document.createElement('article');
    row.className = 'glass rounded-2xl p-4';
    row.innerHTML = `
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="font-medium">${item.title}</p>
          <p class="mt-1 text-sm text-slate-400">${item.promptText}</p>
          <div class="mt-2 flex flex-wrap gap-2 text-xs text-cyan-300">${(item.tags || []).map((tag) => `<span>#${tag}</span>`).join('')}</div>
        </div>
        <button class="secondary-btn text-xs" data-use-prompt="${item.id}">Use Prompt</button>
      </div>
    `;
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
    $('#preview-image').classList.add('hidden');
    $('#download-link').classList.add('hidden');
    $('#share-btn').classList.add('hidden');
    $('#preview-placeholder').classList.remove('hidden');
    await api('/api/generate', {
      method: 'POST',
      body: JSON.stringify({
        prompt: $('#prompt').value,
        type: $('#generation-type').value,
        aspectRatio: $('#aspect-ratio').value,
        stylePreset: $('#style-preset').value,
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
        title: `Prompt ${state.savedPrompts.length + 1}`,
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

document.addEventListener('click', (event) => {
  if (event.target.matches('[data-section]')) setActiveSection(event.target.dataset.section);
  if (event.target.matches('[data-mode]')) setMode(event.target.dataset.mode);
  if (event.target.matches('[data-use-prompt]')) {
    const selected = state.savedPrompts.find((item) => item.id === event.target.dataset.usePrompt);
    if (selected) {
      $('#prompt').value = selected.promptText;
      setMode(selected.category);
      setActiveSection('workspace');
    }
  }
});

(() => {
  renderAssets();
  renderPrompts();
  connectSocket();
})();
