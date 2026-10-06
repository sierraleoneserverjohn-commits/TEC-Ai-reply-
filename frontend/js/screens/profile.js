// ==============================================================================
// Screen: Profile & Account (Email, Theme, Server Overrides, Logout)
// ==============================================================================

import { getCurrentSession, signOut } from '../supabase.js';
import { getActiveApiUrl } from '../config.js';
import { showToast, escapeHTML } from '../ui.js';

export function renderProfileScreen(container, { navigate }) {
  const currentOverride = localStorage.getItem("jt_api_override") || "";

  container.innerHTML = `
    <div class="screen">
      <header class="app-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <button id="btn-back-profile" class="header-btn" title="Back">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <div class="brand-title" style="font-size: 17px;">Owner Profile</div>
        </div>
      </header>

      <div class="content-scroll">
        <!-- Account Info Card -->
        <div class="card" style="text-align: center; padding: 24px 16px;">
          <div style="width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg, var(--neon-green), var(--neon-blue)); color: #050b14; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 24px; margin: 0 auto 12px;">
            J
          </div>
          <h2 id="prof-user-email" style="font-size: 17px; font-weight: 700; color: #fff;">Loading...</h2>
          <div style="font-size: 12px; color: var(--neon-green); font-weight: 600; margin-top: 4px;">Verified System Owner</div>
        </div>

        <!-- Preferences Card -->
        <div class="card">
          <div class="card-title">Preferences</div>

          <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0;">
            <div>
              <div style="font-weight: 600; font-size: 14px;">App Theme</div>
              <div style="font-size: 12px; color: var(--text-muted);">Dark Navy with Neon Green Accents</div>
            </div>
            <span style="font-size: 12px; font-weight: 700; color: var(--neon-green); background: var(--neon-green-dim); padding: 4px 8px; border-radius: 6px;">
              Dark (Fixed)
            </span>
          </div>
        </div>

        <!-- Connection Override Card (Convenient on Mobile) -->
        <div class="card">
          <div class="card-title">Backend Server Connection</div>
          <div class="form-group" style="margin-bottom: 8px;">
            <label class="form-label" for="prof-api-url">Active Backend URL</label>
            <input 
              type="url" 
              id="prof-api-url" 
              class="form-control" 
              placeholder="https://johnny-tec-ai-reply.onrender.com" 
              value="${escapeHTML(currentOverride || getActiveApiUrl())}"
            />
            <small style="color: var(--text-dim); font-size: 11px; margin-top: 4px; display: block;">
              Active: <code>${escapeHTML(getActiveApiUrl() || '(Not Configured)')}</code>
            </small>
          </div>
          <div style="display: flex; gap: 8px;">
            <button id="btn-save-prof-url" class="btn-secondary" style="padding: 8px 12px; font-size: 13px;">Save URL</button>
            <button id="btn-reset-prof-url" class="btn-secondary" style="padding: 8px 12px; font-size: 13px; color: var(--text-muted);">Reset</button>
          </div>
        </div>

        <!-- Logout Action -->
        <div style="margin-top: 24px;">
          <button id="btn-logout" class="btn-secondary" style="color: var(--danger); border-color: rgba(239, 68, 68, 0.4); display: flex; align-items: center; justify-content: center; gap: 8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            <span>Log Out of Device</span>
          </button>
        </div>
      </div>
    </div>
  `;

  const backBtn = container.querySelector('#btn-back-profile');
  const emailEl = container.querySelector('#prof-user-email');
  const urlInput = container.querySelector('#prof-api-url');
  const saveUrlBtn = container.querySelector('#btn-save-prof-url');
  const resetUrlBtn = container.querySelector('#btn-reset-prof-url');
  const logoutBtn = container.querySelector('#btn-logout');

  backBtn.addEventListener('click', () => navigate('settings'));

  saveUrlBtn.addEventListener('click', () => {
    const val = urlInput.value.trim().replace(/\/+$/, "");
    if (val) {
      localStorage.setItem("jt_api_override", val);
      showToast("Backend URL updated");
    }
  });

  resetUrlBtn.addEventListener('click', () => {
    localStorage.removeItem("jt_api_override");
    urlInput.value = getActiveApiUrl();
    showToast("Reset to config.js default");
  });

  logoutBtn.addEventListener('click', async () => {
    if (confirm("Are you sure you want to log out?")) {
      await signOut();
      showToast("Logged out successfully");
      navigate('login');
    }
  });

  async function loadUser() {
    const session = await getCurrentSession();
    if (session && session.user) {
      emailEl.textContent = session.user.email;
    } else {
      emailEl.textContent = "Owner Session";
    }
  }

  loadUser();
}
