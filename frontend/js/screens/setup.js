// ==============================================================================
// Screen: Setup / Missing Configuration Screen
// Shown when API_BASE_URL or Supabase values in config.js are missing or placeholders.
// ==============================================================================

import { 
  API_BASE_URL, 
  SUPABASE_URL, 
  SUPABASE_ANON_KEY, 
  getActiveApiUrl, 
  getActiveSupabaseUrl, 
  getActiveSupabaseKey,
  isConfigured 
} from '../config.js';
import { showToast, escapeHTML } from '../ui.js';

export function renderSetupScreen(container, { navigate }) {
  const currentApi = getActiveApiUrl();
  const currentSbUrl = getActiveSupabaseUrl();
  const currentSbKey = getActiveSupabaseKey();

  container.innerHTML = `
    <div class="screen" style="justify-content: center; align-items: center; padding: 24px; background: radial-gradient(circle at center, #14233c 0%, #0a101d 85%);">
      <div style="text-align: center; margin-bottom: 24px; width: 100%; max-width: 440px;">
        <div style="width: 72px; height: 72px; margin: 0 auto 16px; border-radius: 50%; background: rgba(0, 163, 255, 0.12); border: 2px solid var(--neon-blue); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 24px rgba(0, 163, 255, 0.3);">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--neon-blue)" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
        </div>
        <h1 style="font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 6px;">App is not configured</h1>
        <p style="font-size: 13.5px; color: var(--text-muted); line-height: 1.45;">
          Please check <code style="color: var(--neon-green); background: rgba(0,240,118,0.1); padding: 2px 6px; border-radius: 4px;">frontend/js/config.js</code> or enter your deployment parameters below to connect.
        </p>
      </div>

      <div class="card" style="width: 100%; max-width: 440px; margin: 0; border-top: 3px solid var(--neon-blue);">
        <div class="card-title" style="margin-bottom: 12px; font-size: 14px;">Required Configuration</div>

        <form id="setup-form">
          <div class="form-group">
            <label class="form-label" for="setup-api-url">1. Backend API Base URL (Render)</label>
            <input 
              type="url" 
              id="setup-api-url" 
              class="form-control" 
              placeholder="https://johnny-tec-ai-reply.onrender.com" 
              value="${escapeHTML(currentApi)}"
              required
            />
            <small style="font-size: 11px; color: var(--text-dim); margin-top: 3px; display: block;">
              Render Web Service URL where FastAPI backend is deployed.
            </small>
          </div>

          <div class="form-group">
            <label class="form-label" for="setup-sb-url">2. Supabase Project URL</label>
            <input 
              type="url" 
              id="setup-sb-url" 
              class="form-control" 
              placeholder="https://xyzref.supabase.co" 
              value="${escapeHTML(currentSbUrl)}"
              required
            />
            <small style="font-size: 11px; color: var(--text-dim); margin-top: 3px; display: block;">
              Found in Supabase Dashboard &rarr; Project Settings &rarr; API.
            </small>
          </div>

          <div class="form-group">
            <label class="form-label" for="setup-sb-key">3. Supabase Anon Public Key</label>
            <input 
              type="text" 
              id="setup-sb-key" 
              class="form-control" 
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." 
              value="${escapeHTML(currentSbKey)}"
              required
            />
            <small style="font-size: 11px; color: var(--text-dim); margin-top: 3px; display: block;">
              Found in Supabase API Keys (Anon / Public key only).
            </small>
          </div>

          <button type="submit" id="btn-save-setup" class="btn-primary" style="margin-top: 8px;">
            Save &amp; Connect to Johnny TEC
          </button>
        </form>
      </div>

      <div style="margin-top: 20px; font-size: 12px; color: var(--text-dim); text-align: center; max-width: 380px;">
        To deploy permanently for GitHub Pages, update these values directly inside <code>frontend/js/config.js</code>.
      </div>
    </div>
  `;

  const form = container.querySelector('#setup-form');
  const apiUrlInput = container.querySelector('#setup-api-url');
  const sbUrlInput = container.querySelector('#setup-sb-url');
  const sbKeyInput = container.querySelector('#setup-sb-key');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const apiUrl = apiUrlInput.value.trim().replace(/\/+$/, "");
    const sbUrl = sbUrlInput.value.trim().replace(/\/+$/, "");
    const sbKey = sbKeyInput.value.trim();

    if (!apiUrl || !sbUrl || !sbKey) {
      showToast("Please provide all 3 configuration values.", true);
      return;
    }

    localStorage.setItem("jt_api_override", apiUrl);
    localStorage.setItem("jt_supabase_url_override", sbUrl);
    localStorage.setItem("jt_supabase_key_override", sbKey);

    showToast("Configuration saved!");
    navigate('splash');
  });
}
