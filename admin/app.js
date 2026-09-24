const state = { user: null, overview: null, users: [], drawerOpen: false, activeSection: 'overview' };
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const createElement = (tag, className, text) => { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; };
const formatDate = (value) => value ? new Date(value).toLocaleString() : '—';
const api = async (path, options = {}) => {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData) && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const response = await fetch(path, { credentials: 'same-origin', ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(payload.error || 'Request failed'); error.status = response.status; throw error; }
  return payload;
};
const getClientLocation = async () => new Promise((resolve) => {
  if (!navigator.geolocation) return resolve({ latitude: null, longitude: null });
  navigator.geolocation.getCurrentPosition(({ coords }) => resolve({ latitude: Number(coords.latitude.toFixed(6)), longitude: Number(coords.longitude.toFixed(6)) }), () => resolve({ latitude: null, longitude: null }), { timeout: 5000, maximumAge: 60000 });
});
const showAuthFeedback = (message = '') => { const el = $('#auth-feedback'); el.textContent = message; el.classList.toggle('hidden', !message); };
const showUserFeedback = (message = '', tone = 'info') => {
  const el = $('#user-feedback'); el.textContent = message; el.classList.remove('hidden', 'border-red-400/30', 'bg-red-500/10', 'text-red-200', 'border-cyan-400/30', 'bg-cyan-500/10', 'text-cyan-100');
  if (!message) return el.classList.add('hidden');
  el.classList.add(tone === 'error' ? 'border-red-400/30' : 'border-cyan-400/30', tone === 'error' ? 'bg-red-500/10' : 'bg-cyan-500/10', tone === 'error' ? 'text-red-200' : 'text-cyan-100');
};
const setDrawerOpen = (open) => { state.drawerOpen = open; $('#drawer').classList.toggle('drawer-open', open || window.innerWidth >= 1024); $('#drawer-overlay').classList.toggle('hidden', !open || window.innerWidth >= 1024); };
const showAuth = () => { $('#auth-screen').classList.remove('hidden'); $('#app-shell').classList.add('hidden'); requestAnimationFrame(() => $('#login-email')?.focus()); };
const showApp = () => { $('#auth-screen').classList.add('hidden'); $('#app-shell').classList.remove('hidden'); $('#session-email').textContent = state.user?.email || ''; };
const setSection = (section) => { state.activeSection = section; $$('.content-section').forEach((node) => node.classList.add('hidden')); $(`#${section}`)?.classList.remove('hidden'); $$('.drawer-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.section === section)); if (window.innerWidth < 1024) setDrawerOpen(false); };
const renderList = (selector, items, render, empty) => { const host = $(selector); host.innerHTML = ''; if (!items?.length) return host.appendChild(createElement('div', 'activity-card text-sm text-slate-400', empty)); items.forEach((item) => host.appendChild(render(item))); };
const renderOverview = () => {
  const overview = state.overview || {};
  $('#metric-users').textContent = String(overview.activeUsers || 0);
  $('#metric-generations').textContent = String(overview.totalGenerations || 0);
  $('#metric-income').textContent = `$${Number(overview.revenue || 0).toFixed(2)}`;
  $('#metric-locked').textContent = String((overview.lockedAccounts || []).length);
  renderList('#todays-logins', overview.todaysLogins, (log) => { const card = createElement('article', 'activity-card'); card.appendChild(createElement('p', 'font-medium', log.User?.email || log.details?.email || 'Unknown user')); card.appendChild(createElement('p', 'mt-2 text-sm text-slate-400', `${formatDate(log.createdAt)} · ${log.ipAddress || 'No IP'}`)); card.appendChild(createElement('p', 'mt-1 text-xs text-slate-500', `Coords: ${log.details?.latitude ?? '—'}, ${log.details?.longitude ?? '—'}`)); return card; }, 'No logins recorded today.');
  renderList('#generation-status-list', overview.generationStatus, (item) => { const card = createElement('article', 'activity-card'); card.appendChild(createElement('p', 'font-medium', item.status)); card.appendChild(createElement('p', 'mt-2 text-sm text-slate-400', `${item.get ? item.get('count') : item.count} jobs`)); return card; }, 'No generation status data.');
  renderList('#latest-transactions', overview.recentTransactions, (tx) => { const card = createElement('article', 'activity-card'); card.appendChild(createElement('p', 'font-medium', tx.User?.email || 'Unknown user')); card.appendChild(createElement('p', 'mt-2 text-sm text-slate-400', `${tx.gateway} · ${tx.paymentStatus} · ${tx.currency} ${tx.amount}`)); card.appendChild(createElement('p', 'mt-1 text-xs text-slate-500', formatDate(tx.createdAt))); return card; }, 'No transactions recorded.');
  renderList('#latest-queries', overview.recentQueries, (query) => { const card = createElement('article', 'activity-card'); card.appendChild(createElement('p', 'font-medium', query.User?.email || 'Unknown user')); card.appendChild(createElement('p', 'mt-2 text-sm text-slate-400', query.title)); card.appendChild(createElement('p', 'mt-1 text-xs text-slate-500', query.promptText)); return card; }, 'No saved prompt activity.');
  renderList('#prompt-activity', overview.recentPromptActivity, (generation) => { const card = createElement('article', 'activity-card'); card.appendChild(createElement('p', 'font-medium', `${generation.User?.email || 'Unknown user'} · ${generation.status}`)); card.appendChild(createElement('p', 'mt-2 text-sm text-slate-400', generation.modelUsed || 'Model not recorded')); card.appendChild(createElement('p', 'mt-1 text-xs text-slate-500', generation.prompt)); return card; }, 'No prompt activity yet.');
  renderList('#locked-accounts', overview.lockedAccounts, (user) => { const card = createElement('article', 'activity-card'); card.appendChild(createElement('p', 'font-medium', user.email)); card.appendChild(createElement('p', 'mt-2 text-sm text-slate-400', user.isSuspended ? 'Admin suspended' : `Locked until ${formatDate(user.lockedUntil)}`)); return card; }, 'No locked or suspended accounts.');
  renderList('#security-events', overview.securityEvents, (event) => { const card = createElement('article', 'activity-card'); card.appendChild(createElement('p', 'font-medium', `${event.User?.email || event.details?.email || 'Unknown user'} · ${event.action}`)); card.appendChild(createElement('p', 'mt-2 text-sm text-slate-400', `${formatDate(event.createdAt)} · ${event.ipAddress || 'No IP'}`)); return card; }, 'No recent security events.');
};
const renderUsers = () => {
  const host = $('#user-list'); host.innerHTML = '';
  if (!state.users.length) return host.appendChild(createElement('div', 'activity-card text-sm text-slate-400', 'No users matched the current search.'));
  state.users.forEach((user) => {
    const card = createElement('article', 'activity-card');
    card.innerHTML = `
      <div class="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p class="font-medium text-slate-100">${user.email}</p>
          <p class="mt-1 text-xs text-slate-500">Last login ${formatDate(user.lastLoginAt)} · IP ${user.lastLoginIp || '—'} · coords ${user.lastLoginLatitude ?? '—'}, ${user.lastLoginLongitude ?? '—'}</p>
        </div>
        <div class="flex flex-wrap gap-2 text-xs">
          <span class="rounded-full border border-white/10 px-3 py-1">${user.role}</span>
          <span class="rounded-full border border-white/10 px-3 py-1">${user.isSuspended ? 'Suspended' : (user.lockedUntil ? 'Temp Locked' : 'Active')}</span>
        </div>
      </div>
      <form class="mt-4 grid gap-3 lg:grid-cols-5" data-user-form="${user.id}">
        <input class="input" type="number" name="creditsBalance" min="0" value="${user.creditsBalance || 0}" />
        <select class="input" name="role"><option value="user" ${user.role === 'user' ? 'selected' : ''}>user</option><option value="admin" ${user.role === 'admin' ? 'selected' : ''}>admin</option></select>
        <select class="input" name="isSuspended"><option value="false" ${!user.isSuspended ? 'selected' : ''}>active</option><option value="true" ${user.isSuspended ? 'selected' : ''}>suspended</option></select>
        <label class="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" name="clearLoginLock" /> Clear login lock</label>
        <button class="primary-btn" type="submit">Save</button>
      </form>`;
    host.appendChild(card);
  });
};
const loadSession = async () => {
  try {
    const profile = await api('/api/profile');
    if (profile.role !== 'admin') throw new Error('Admin access required');
    state.user = profile;
    showApp();
    await Promise.allSettled([loadOverview(), loadUsers()]);
  } catch (_error) {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch {} // ignore
    state.user = null;
    showAuth();
  }
};
const loadOverview = async () => { state.overview = await api('/api/admin/overview'); renderOverview(); };
const loadUsers = async () => { const search = $('#user-search').value.trim(); const query = search ? `?search=${encodeURIComponent(search)}` : ''; state.users = await api(`/api/admin/users${query}`); renderUsers(); };
$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  showAuthFeedback('');
  try {
    const location = await getClientLocation();
    await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: $('#login-email').value.trim(), password: $('#login-password').value, location }) });
    $('#login-form').reset();
    await loadSession();
  } catch (error) { showAuthFeedback(error.message); }
});
$('#logout-btn').addEventListener('click', async () => { try { await api('/api/auth/logout', { method: 'POST' }); } catch {} state.user = null; showAuth(); });
$('#drawer-open').addEventListener('click', () => setDrawerOpen(true));
$('#drawer-close').addEventListener('click', () => setDrawerOpen(false));
$('#drawer-overlay').addEventListener('click', () => setDrawerOpen(false));
window.addEventListener('resize', () => setDrawerOpen(state.drawerOpen));
$('#refresh-btn').addEventListener('click', async () => { await Promise.all([loadOverview(), loadUsers()]); });
$('#user-search').addEventListener('input', async () => { await loadUsers(); });
$('#user-list').addEventListener('submit', async (event) => {
  const form = event.target.closest('[data-user-form]'); if (!form) return; event.preventDefault();
  const formData = new FormData(form); const creditsRaw = String(formData.get('creditsBalance') || '').trim(); const creditsBalance = Number(creditsRaw);
  if (!creditsRaw || !Number.isInteger(creditsBalance) || creditsBalance < 0) return showUserFeedback('Credits must be a whole number greater than or equal to 0.', 'error');
  try {
    showUserFeedback('');
    await api(`/api/admin/users/${form.dataset.userForm}`, { method: 'PATCH', body: JSON.stringify({ creditsBalance, role: formData.get('role'), isSuspended: formData.get('isSuspended') === 'true', clearLoginLock: formData.get('clearLoginLock') === 'on' }) });
    await Promise.all([loadOverview(), loadUsers()]);
    showUserFeedback('User updated.');
  } catch (error) { showUserFeedback(error.message, 'error'); }
});
document.addEventListener('click', (event) => { const button = event.target.closest('[data-section]'); if (button) setSection(button.dataset.section); });
(async () => { setSection('overview'); showAuth(); await loadSession(); })();
