// ==============================================================================
// Screen: Error Logs (Tabs: All / WhatsApp / AI / System, Clear Logs button)
// ==============================================================================

import { API } from '../api.js';
import { formatTime, showToast, escapeHTML } from '../ui.js';

export function renderErrorLogsScreen(container, { navigate }) {
  let activeCategory = 'all';
  let cachedErrors = [];

  container.innerHTML = `
    <div class="screen">
      <header class="app-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <button id="btn-back-errors" class="header-btn" title="Back">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <div class="brand-title" style="font-size: 17px;">System &amp; Error Logs</div>
        </div>
        <button id="btn-clear-errors" class="header-btn" title="Clear Logs" style="color: var(--danger); font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.3);">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          <span>Clear</span>
        </button>
      </header>

      <div class="content-scroll">
        <!-- Category Filter Tabs -->
        <div class="filter-pills" style="margin-bottom: 14px;">
          <button class="filter-pill active" data-cat="all">All</button>
          <button class="filter-pill" data-cat="whatsapp">WhatsApp</button>
          <button class="filter-pill" data-cat="ai">AI</button>
          <button class="filter-pill" data-cat="system">System</button>
        </div>

        <div id="errors-loader" style="text-align: center; padding: 40px; color: var(--text-muted);">
          <div class="spinner" style="margin: 0 auto 10px;"></div>
          Fetching error logs...
        </div>

        <div id="errors-list" style="display: none; display: flex; flex-direction: column; gap: 8px;"></div>
      </div>
    </div>
  `;

  const backBtn = container.querySelector('#btn-back-errors');
  const clearBtn = container.querySelector('#btn-clear-errors');
  const loader = container.querySelector('#errors-loader');
  const list = container.querySelector('#errors-list');
  const tabs = container.querySelectorAll('.filter-pill');

  backBtn.addEventListener('click', () => navigate('settings'));

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeCategory = tab.getAttribute('data-cat');
      renderErrors();
    });
  });

  clearBtn.addEventListener('click', async () => {
    if (!confirm("Clear all warning and error logs?")) return;
    clearBtn.disabled = true;
    try {
      await API.clearErrors();
      showToast("Error logs cleared");
      cachedErrors = [];
      renderErrors();
    } catch (err) {
      showToast(`Failed: ${err.message}`, true);
    } finally {
      clearBtn.disabled = false;
    }
  });

  async function loadErrors() {
    try {
      cachedErrors = await API.getErrors('all');
      renderErrors();
    } catch (err) {
      loader.innerHTML = `<div style="color: var(--danger); text-align: center; padding: 20px;">Failed to load logs: ${escapeHTML(err.message)}</div>`;
    }
  }

  function renderErrors() {
    loader.style.display = 'none';
    list.style.display = 'flex';

    let filtered = cachedErrors;
    if (activeCategory !== 'all') {
      filtered = filtered.filter(l => l.category === activeCategory);
    }

    if (filtered.length === 0) {
      list.innerHTML = `
        <div style="text-align: center; padding: 48px; color: var(--neon-green);">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 8px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          <p>Zero errors recorded. All systems operational!</p>
        </div>
      `;
      return;
    }

    list.innerHTML = filtered.map(log => {
      const isError = log.level === 'error';
      const isWarn = log.level === 'warning';

      const iconColor = isError ? 'var(--danger)' : (isWarn ? 'var(--warning)' : 'var(--neon-blue)');
      const timeStr = formatTime(log.created_at);
      const metaStr = log.meta && Object.keys(log.meta).length > 0 ? JSON.stringify(log.meta) : null;

      return `
        <div class="card" style="margin-bottom: 0; padding: 12px; border-left: 3px solid ${iconColor};">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: ${iconColor}; background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px;">
                ${escapeHTML(log.level)}
              </span>
              <span style="font-size: 11px; font-weight: 700; color: var(--text-dim); text-transform: uppercase;">
                ${escapeHTML(log.category)}
              </span>
            </div>
            <span style="font-size: 11px; color: var(--text-dim);">${timeStr}</span>
          </div>

          <div style="font-size: 13.5px; color: #fff; font-weight: 500; margin-top: 2px;">
            ${escapeHTML(log.message)}
          </div>

          ${metaStr ? `
            <div style="margin-top: 6px; font-family: monospace; font-size: 11px; color: var(--text-muted); background: rgba(0,0,0,0.3); padding: 6px 8px; border-radius: 6px; overflow-x: auto;">
              ${escapeHTML(metaStr)}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  loadErrors();
}
