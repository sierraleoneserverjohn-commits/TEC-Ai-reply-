// ==============================================================================
// Screen: Home Dashboard
// Real-time WhatsApp AI metrics, Dry Run badge, Bot Master toggle, Quick Actions
// ==============================================================================

import { API } from '../api.js';
import { showToast, escapeHTML } from '../ui.js';

export function renderHomeScreen(container, { navigate }) {
  container.innerHTML = `
    <div class="screen">
      <header class="app-header">
        <div class="header-brand">
          <img src="icons/logo.svg" alt="Robot" style="width: 28px; height: 28px;" />
          <span class="brand-title">Johnny TEC</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div id="dry-run-badge" style="display: none; font-size: 10px; font-weight: 800; color: #050b14; background: var(--warning); padding: 2px 7px; border-radius: 6px; letter-spacing: 0.5px;">
            DRY RUN
          </div>
          <div id="ai-status-badge" class="badge-online">AI Active</div>
        </div>
      </header>

      <div class="content-scroll">
        <!-- Greeting Header -->
        <div style="margin-bottom: 18px;">
          <h2 style="font-size: 20px; font-weight: 700; color: #fff;">Dashboard Overview</h2>
          <p style="font-size: 13px; color: var(--text-muted);">Real-time WhatsApp AI metrics</p>
        </div>

        <!-- 4 Stat Cards Grid -->
        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-header">
              <span class="stat-label">Total Messages</span>
              <span id="stat-total-change" class="stat-change up">0%</span>
            </div>
            <div id="stat-total-val" class="stat-val">-</div>
          </div>

          <div class="stat-card">
            <div class="stat-header">
              <span class="stat-label">AI Replies</span>
              <span id="stat-ai-change" class="stat-change up">0%</span>
            </div>
            <div id="stat-ai-val" class="stat-val" style="color: var(--neon-green);">-</div>
          </div>

          <div class="stat-card">
            <div class="stat-header">
              <span class="stat-label">Active Chats (24h)</span>
            </div>
            <div id="stat-active-val" class="stat-val" style="color: var(--neon-blue);">-</div>
          </div>

          <div class="stat-card">
            <div class="stat-header">
              <span class="stat-label">Avg Response Time</span>
            </div>
            <div id="stat-latency-val" class="stat-val">-</div>
          </div>
        </div>

        <!-- AI Master Status Card -->
        <div class="card" style="border-left: 4px solid var(--neon-green);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-weight: 700; font-size: 15px; color: #fff;">AI Auto-Reply Master</div>
              <div id="ai-toggle-caption" style="font-size: 12.5px; color: var(--text-muted); margin-top: 2px;">
                Automated Gemini replies active
              </div>
            </div>
            <label class="switch">
              <input type="checkbox" id="home-bot-toggle" checked />
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="card">
          <div class="card-title">Quick Actions</div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button id="qa-chats" class="btn-primary" style="justify-content: flex-start; padding: 12px 16px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              <span>View WhatsApp Chats</span>
            </button>

            <button id="qa-conn" class="btn-secondary" style="display: flex; align-items: center; justify-content: flex-start; gap: 10px; padding: 12px 16px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
              <span>Check WhatsApp Connection</span>
            </button>

            <button id="qa-settings" class="btn-secondary" style="display: flex; align-items: center; justify-content: flex-start; gap: 10px; padding: 12px 16px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              <span>Bot Settings &amp; Personality</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Bindings
  const badge = container.querySelector('#ai-status-badge');
  const dryRunBadge = container.querySelector('#dry-run-badge');
  const totalVal = container.querySelector('#stat-total-val');
  const totalChange = container.querySelector('#stat-total-change');
  const aiVal = container.querySelector('#stat-ai-val');
  const aiChange = container.querySelector('#stat-ai-change');
  const activeVal = container.querySelector('#stat-active-val');
  const latencyVal = container.querySelector('#stat-latency-val');
  const toggle = container.querySelector('#home-bot-toggle');
  const toggleCaption = container.querySelector('#ai-toggle-caption');

  container.querySelector('#qa-chats').addEventListener('click', () => navigate('chats'));
  container.querySelector('#qa-conn').addEventListener('click', () => navigate('whatsapp-connection'));
  container.querySelector('#qa-settings').addEventListener('click', () => navigate('ai-settings'));

  async function loadData() {
    try {
      const [stats, settings, connection] = await Promise.all([
        API.getStats(),
        API.getSettings(),
        API.getConnection().catch(() => ({ dry_run: false }))
      ]);

      if (connection && connection.dry_run) {
        dryRunBadge.style.display = 'block';
      } else {
        dryRunBadge.style.display = 'none';
      }

      totalVal.textContent = stats.total_messages_today ?? 0;
      totalChange.textContent = `${stats.total_messages_change >= 0 ? '+' : ''}${stats.total_messages_change}%`;
      totalChange.className = `stat-change ${stats.total_messages_change >= 0 ? 'up' : 'down'}`;

      aiVal.textContent = stats.ai_replies_today ?? 0;
      aiChange.textContent = `${stats.ai_replies_change >= 0 ? '+' : ''}${stats.ai_replies_change}%`;
      aiChange.className = `stat-change ${stats.ai_replies_change >= 0 ? 'up' : 'down'}`;

      activeVal.textContent = stats.active_chats_24h ?? 0;
      latencyVal.textContent = stats.average_response_time || "1.2s";

      const botOn = Boolean(settings.bot_enabled);
      toggle.checked = botOn;
      updateStatusVisuals(botOn);
    } catch (err) {
      console.error("Home screen data load error:", err);
    }
  }

  function updateStatusVisuals(isActive) {
    if (isActive) {
      badge.textContent = "AI Active";
      badge.className = "badge-online";
      toggleCaption.textContent = "Automated Gemini replies active";
    } else {
      badge.textContent = "AI Paused";
      badge.className = "badge-offline";
      toggleCaption.textContent = "Bot is paused globally";
    }
  }

  toggle.addEventListener('change', async () => {
    const isChecked = toggle.checked;
    updateStatusVisuals(isChecked);
    try {
      await API.updateSettings({ bot_enabled: isChecked });
      showToast(isChecked ? "AI Auto-Reply activated" : "AI Auto-Reply paused");
    } catch (err) {
      showToast(`Failed to update status: ${err.message}`, true);
      toggle.checked = !isChecked;
      updateStatusVisuals(!isChecked);
    }
  });

  loadData();
}
