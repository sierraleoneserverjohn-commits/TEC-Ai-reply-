// ==============================================================================
// Screen: AI Settings (Global Bot Switch, Delay, Personality Presets)
// ==============================================================================

import { API } from '../api.js';
import { showToast, escapeHTML } from '../ui.js';

export function renderAISettingsScreen(container, { navigate }) {
  container.innerHTML = `
    <div class="screen">
      <header class="app-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <button id="btn-back-ai" class="header-btn">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <div class="brand-title" style="font-size: 17px;">AI Settings</div>
        </div>
      </header>

      <div class="content-scroll">
        <form id="ai-settings-form">
          <!-- Bot Master Switch Card -->
          <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-weight: 700; font-size: 15px; color: #fff;">AI Master Enabled</div>
                <div style="font-size: 12.5px; color: var(--text-muted); margin-top: 2px;">
                  Toggle all automated WhatsApp replies
                </div>
              </div>
              <label class="switch">
                <input type="checkbox" id="ai-cfg-bot-enabled" checked />
                <span class="slider"></span>
              </label>
            </div>
          </div>

          <!-- Configuration Card -->
          <div class="card">
            <div class="card-title">Behavior &amp; Style</div>

            <div class="form-group">
              <label class="form-label" for="ai-cfg-delay">Response Delay (Seconds)</label>
              <input 
                type="number" 
                id="ai-cfg-delay" 
                class="form-control" 
                min="0" 
                max="60" 
                placeholder="2"
              />
              <small style="color: var(--text-dim); font-size: 11.5px; display: block; margin-top: 4px;">
                Simulates natural human typing pause before sending reply.
              </small>
            </div>

            <div class="form-group">
              <label class="form-label" for="ai-cfg-personality">Default Personality Preset</label>
              <select id="ai-cfg-personality" class="form-control">
                <option value="friendly_helpful">Friendly &amp; Helpful</option>
                <option value="professional">Professional</option>
                <option value="casual">Casual &amp; Banter</option>
                <option value="short_direct">Short &amp; Direct</option>
              </select>
              <small style="color: var(--text-dim); font-size: 11.5px; display: block; margin-top: 4px;">
                Applied when no per-contact secret instruction is provided.
              </small>
            </div>

            <div class="form-group">
              <label class="form-label" for="ai-cfg-lang">Default Fallback Language</label>
              <input 
                type="text" 
                id="ai-cfg-lang" 
                class="form-control" 
                placeholder="en" 
              />
            </div>

            <button type="submit" id="btn-save-ai-settings" class="btn-primary" style="margin-top: 8px;">
              Save AI Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  const backBtn = container.querySelector('#btn-back-ai');
  const form = container.querySelector('#ai-settings-form');
  const botEnabled = container.querySelector('#ai-cfg-bot-enabled');
  const delayInput = container.querySelector('#ai-cfg-delay');
  const personalitySelect = container.querySelector('#ai-cfg-personality');
  const langInput = container.querySelector('#ai-cfg-lang');
  const saveBtn = container.querySelector('#btn-save-ai-settings');

  backBtn.addEventListener('click', () => navigate('settings'));

  async function loadSettings() {
    try {
      const cfg = await API.getSettings();
      botEnabled.checked = Boolean(cfg.bot_enabled);
      delayInput.value = cfg.response_delay_seconds ?? 2;
      personalitySelect.value = cfg.default_personality || 'friendly_helpful';
      langInput.value = cfg.default_language || 'en';
    } catch (err) {
      showToast(`Error: ${err.message}`, true);
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    saveBtn.disabled = true;

    try {
      await API.updateSettings({
        bot_enabled: botEnabled.checked,
        response_delay_seconds: parseInt(delayInput.value, 10) || 0,
        default_personality: personalitySelect.value,
        default_language: langInput.value.trim() || 'en'
      });
      showToast("AI settings updated successfully!");
    } catch (err) {
      showToast(`Save failed: ${err.message}`, true);
    } finally {
      saveBtn.disabled = false;
    }
  });

  loadSettings();
}
