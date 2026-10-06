// ==============================================================================
// Screen: Chats List (Search, All / Active / Archived Tabs, Badges)
// ==============================================================================

import { API } from '../api.js';
import { renderAvatar, formatTime, escapeHTML } from '../ui.js';

export function renderChatsScreen(container, { navigate }) {
  let activeFilter = 'all';
  let searchQuery = '';
  let refreshTimer = null;
  let cachedContacts = [];

  container.innerHTML = `
    <div class="screen">
      <header class="app-header">
        <div class="header-brand">
          <img src="icons/logo.svg" alt="Robot" style="width: 26px; height: 26px;" />
          <span class="brand-title">Conversations</span>
        </div>
        <button id="btn-refresh-chats" class="header-btn" title="Refresh">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
        </button>
      </header>

      <div class="content-scroll">
        <!-- Search Box -->
        <div style="margin-bottom: 12px; position: relative;">
          <input 
            type="text" 
            id="chat-search-input" 
            class="form-control" 
            placeholder="Search contacts or messages..." 
            style="padding-left: 36px; border-radius: 20px; font-size: 13.5px;"
          />
          <svg style="position: absolute; left: 12px; top: 12px; color: var(--text-muted);" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </div>

        <!-- Filter Tabs -->
        <div class="filter-pills">
          <button class="filter-pill active" data-tab="all">All (<span id="count-all">0</span>)</button>
          <button class="filter-pill" data-tab="active">Active (<span id="count-active">0</span>)</button>
          <button class="filter-pill" data-tab="archived">Archived (<span id="count-archived">0</span>)</button>
        </div>

        <!-- Contact List Container -->
        <div id="chats-loader" style="text-align: center; padding: 40px; color: var(--text-muted);">
          <div class="spinner" style="margin: 0 auto 12px;"></div>
          Loading chats...
        </div>

        <div id="chats-list-container" style="display: none;"></div>
      </div>
    </div>
  `;

  const searchInput = container.querySelector('#chat-search-input');
  const refreshBtn = container.querySelector('#btn-refresh-chats');
  const loader = container.querySelector('#chats-loader');
  const listContainer = container.querySelector('#chats-list-container');
  const filterButtons = container.querySelectorAll('.filter-pill');

  const countAll = container.querySelector('#count-all');
  const countActive = container.querySelector('#count-active');
  const countArchived = container.querySelector('#count-archived');

  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.getAttribute('data-tab');
      renderList();
    });
  });

  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderList();
  });

  refreshBtn.addEventListener('click', loadChats);

  async function loadChats() {
    try {
      cachedContacts = await API.getContacts('all');
      updateTabCounts();
      renderList();
    } catch (err) {
      loader.innerHTML = `<div style="color: var(--danger); padding: 20px;">Failed to load chats: ${escapeHTML(err.message)}</div>`;
    }
  }

  function updateTabCounts() {
    const total = cachedContacts.length;
    const active = cachedContacts.filter(c => !c.archived).length;
    const archived = cachedContacts.filter(c => c.archived).length;

    countAll.textContent = total;
    countActive.textContent = active;
    countArchived.textContent = archived;
  }

  function renderList() {
    loader.style.display = 'none';
    listContainer.style.display = 'block';

    if (cachedContacts.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 48px 18px; color: var(--text-dim);">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 12px; opacity: 0.6;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          <p style="font-size: 14px; color: var(--text-muted); line-height: 1.5; max-width: 280px; margin: 0 auto;">
            No chats yet. Messages will appear here when someone writes to your WhatsApp number.
          </p>
        </div>
      `;
      return;
    }

    let filtered = cachedContacts;

    if (activeFilter === 'active') {
      filtered = filtered.filter(c => !c.archived);
    } else if (activeFilter === 'archived') {
      filtered = filtered.filter(c => c.archived);
    }

    if (searchQuery) {
      filtered = filtered.filter(c => {
        const name = (c.display_name || '').toLowerCase();
        const phone = (c.wa_id || '').toLowerCase();
        const lastMsg = (c.last_message?.body || '').toLowerCase();
        return name.includes(searchQuery) || phone.includes(searchQuery) || lastMsg.includes(searchQuery);
      });
    }

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 48px 16px; color: var(--text-dim);">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 8px; opacity: 0.6;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <p>No matching conversations found</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = filtered.map(c => {
      const name = escapeHTML(c.display_name || `+${c.wa_id}`);
      const lastMsg = c.last_message;
      const snippet = lastMsg ? escapeHTML(lastMsg.body || lastMsg.ai_draft || '') : 'No messages';
      const timeStr = lastMsg ? formatTime(lastMsg.created_at) : '';
      const mode = c.mode || 'ask';
      const draftsWaiting = c.drafts_waiting || 0;
      const attention = c.needs_attention_count || 0;
      const isTakeover = c.human_takeover;

      let modeTagClass = 'pill-ask';
      let modeText = 'Ask';
      if (mode === 'auto') { modeTagClass = 'pill-auto'; modeText = 'Auto'; }
      else if (mode === 'off') { modeTagClass = 'pill-off'; modeText = 'Off'; }

      return `
        <div class="chat-item" data-id="${escapeHTML(c.id)}">
          ${renderAvatar(c.display_name || c.wa_id, 46)}
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
              <span style="font-weight: 700; font-size: 15px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${name}
              </span>
              <span style="font-size: 11.5px; color: var(--text-dim); flex-shrink: 0;">${timeStr}</span>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
              <span style="font-size: 13px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">
                ${snippet}
              </span>

              <div style="display: flex; align-items: center; gap: 5px; flex-shrink: 0;">
                ${isTakeover ? `<span style="font-size: 10px; background: rgba(0, 163, 255, 0.2); color: var(--neon-blue); border: 1px solid rgba(0, 163, 255, 0.3); border-radius: 10px; padding: 1px 6px; font-weight: 700;">TAKEOVER</span>` : ''}
                <span style="font-size: 10px; border-radius: 10px; padding: 1px 6px; font-weight: 700;" class="${modeTagClass}">${modeText}</span>
                ${draftsWaiting > 0 ? `<span style="background: var(--neon-green); color: #050b14; font-size: 10px; font-weight: 800; border-radius: 10px; padding: 1px 6px;">${draftsWaiting} DRAFT</span>` : ''}
                ${attention > 0 ? `<span style="background: var(--danger); color: white; font-size: 10px; font-weight: 800; border-radius: 10px; padding: 1px 6px;">!</span>` : ''}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    listContainer.querySelectorAll('.chat-item').forEach(el => {
      el.addEventListener('click', () => {
        const cid = el.getAttribute('data-id');
        navigate('chat', { contactId: cid });
      });
    });
  }

  loadChats();
  refreshTimer = setInterval(loadChats, 12000);

  return () => {
    if (refreshTimer) clearInterval(refreshTimer);
  };
}
