// ==============================================================================
// Screen: Conversation Logs (Filterable: All, Auto-Replied, Drafts, Manual, Failed)
// ==============================================================================

import { API } from '../api.js';
import { formatTime, escapeHTML } from '../ui.js';

export function renderConversationLogsScreen(container, { navigate }) {
  let activeTab = 'all';
  let searchQuery = '';
  let cachedLogs = [];

  container.innerHTML = `
    <div class="screen">
      <header class="app-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <button id="btn-back-conv" class="header-btn" title="Back">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <div class="brand-title" style="font-size: 17px;">Conversation Logs</div>
        </div>
      </header>

      <div class="content-scroll">
        <!-- Search -->
        <div style="margin-bottom: 12px; position: relative;">
          <input 
            type="text" 
            id="conv-search" 
            class="form-control" 
            placeholder="Search conversation text..." 
            style="border-radius: 20px; font-size: 13.5px; padding-left: 36px;"
          />
          <svg style="position: absolute; left: 12px; top: 12px; color: var(--text-muted);" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </div>

        <!-- Filter Tabs: All, Auto-Replied, Drafts, Manual, Failed -->
        <div class="filter-pills" style="margin-bottom: 14px;">
          <button class="filter-pill active" data-tab="all">All</button>
          <button class="filter-pill" data-tab="auto">Auto-Replied</button>
          <button class="filter-pill" data-tab="drafts">Drafts</button>
          <button class="filter-pill" data-tab="manual">Manual</button>
          <button class="filter-pill" data-tab="failed">Failed</button>
        </div>

        <div id="conv-logs-loader" style="text-align: center; padding: 40px; color: var(--text-muted);">
          <div class="spinner" style="margin: 0 auto 10px;"></div>
          Loading conversation logs...
        </div>

        <div id="conv-logs-list" style="display: none; display: flex; flex-direction: column; gap: 8px;"></div>
      </div>
    </div>
  `;

  const backBtn = container.querySelector('#btn-back-conv');
  const searchInput = container.querySelector('#conv-search');
  const loader = container.querySelector('#conv-logs-loader');
  const list = container.querySelector('#conv-logs-list');
  const tabs = container.querySelectorAll('.filter-pill');

  backBtn.addEventListener('click', () => navigate('settings'));

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeTab = tab.getAttribute('data-tab');
      renderLogs();
    });
  });

  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderLogs();
  });

  async function loadLogs() {
    try {
      cachedLogs = await API.getLogs('all');
      renderLogs();
    } catch (err) {
      loader.innerHTML = `<div style="color: var(--danger); text-align: center; padding: 20px;">Failed to load logs: ${escapeHTML(err.message)}</div>`;
    }
  }

  function renderLogs() {
    loader.style.display = 'none';
    list.style.display = 'flex';

    let filtered = cachedLogs;
    if (activeTab === 'auto') {
      filtered = filtered.filter(m => m.sender === 'ai');
    } else if (activeTab === 'drafts') {
      filtered = filtered.filter(m => m.status === 'drafted');
    } else if (activeTab === 'manual') {
      filtered = filtered.filter(m => m.sender === 'me');
    } else if (activeTab === 'failed') {
      filtered = filtered.filter(m => m.status === 'failed' || m.status === 'needs_attention' || m.status === 'failed_outside_window');
    }

    if (searchQuery) {
      filtered = filtered.filter(m => {
        const body = (m.body || m.ai_draft || '').toLowerCase();
        const contact = (m.contacts?.display_name || m.contacts?.wa_id || '').toLowerCase();
        return body.includes(searchQuery) || contact.includes(searchQuery);
      });
    }

    if (filtered.length === 0) {
      list.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-dim);">
          No conversation entries found.
        </div>
      `;
      return;
    }

    list.innerHTML = filtered.map(item => {
      const isAI = item.sender === 'ai';
      const isMe = item.sender === 'me';
      const isDraft = item.status === 'drafted';
      const isError = item.status === 'failed' || item.status === 'needs_attention' || item.status === 'failed_outside_window';

      let tagColor = 'var(--neon-blue)';
      let tagBg = 'rgba(0, 163, 255, 0.15)';
      let tagLabel = 'USER';

      if (isError) {
        tagColor = 'var(--danger)';
        tagBg = 'rgba(239, 68, 68, 0.15)';
        tagLabel = item.status === 'failed_outside_window' ? '>24H BLOCKED' : 'FAILED';
      } else if (isDraft) {
        tagColor = 'var(--warning)';
        tagBg = 'rgba(245, 158, 11, 0.15)';
        tagLabel = 'DRAFT';
      } else if (isAI) {
        tagColor = 'var(--neon-green)';
        tagBg = 'rgba(0, 240, 118, 0.15)';
        tagLabel = 'AI REPLY';
      } else if (isMe) {
        tagColor = '#fff';
        tagBg = 'rgba(255, 255, 255, 0.2)';
        tagLabel = 'MANUAL';
      }

      const contactName = item.contacts?.display_name || `+${item.contacts?.wa_id || item.contact_id || 'Unknown'}`;
      const timeStr = formatTime(item.created_at);
      const metrics = (item.tokens_used || item.latency_ms) 
        ? `<span style="font-size: 11px; color: var(--text-dim); margin-left: auto;">${item.tokens_used ? item.tokens_used + ' tok ' : ''}${item.latency_ms ? item.latency_ms + 'ms' : ''}</span>`
        : '';

      return `
        <div class="card" style="margin-bottom: 0; padding: 12px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 10px; font-weight: 800; color: ${tagColor}; background: ${tagBg}; padding: 2px 6px; border-radius: 4px;">
                ${tagLabel}
              </span>
              <span style="font-weight: 600; font-size: 13.5px; color: #fff;">${escapeHTML(contactName)}</span>
            </div>
            <span style="font-size: 11px; color: var(--text-dim);">${timeStr}</span>
          </div>

          <div style="font-size: 13.5px; color: var(--text-main); line-height: 1.4; word-break: break-word;">
            "${escapeHTML(item.body || item.ai_draft || '')}"
          </div>

          ${item.error ? `
            <div style="font-size: 11px; color: var(--danger); margin-top: 4px;">
              Error: ${escapeHTML(item.error)}
            </div>
          ` : ''}

          ${metrics ? `<div style="display: flex; margin-top: 6px;">${metrics}</div>` : ''}
        </div>
      `;
    }).join('');
  }

  loadLogs();
}
