// ==============================================================================
// Screen: Settings Main Hub (Profile, Connection, AI Settings, Logs, Install PWA)
// ==============================================================================

import { getCurrentSession, signOut } from '../supabase.js';
import { showToast } from '../ui.js';

export function renderSettingsScreen(container, { navigate }) {
  container.innerHTML = `
    <div class="screen">
      <header class="app-header">
        <div class="header-brand">
          <img src="icons/logo.svg" alt="Robot" style="width: 26px; height: 26px;" />
          <span class="brand-title">Settings</span>
        </div>
      </header>

      <div class="content-scroll">
        <!-- Profile Card -->
        <div id="settings-profile-card" class="card" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-left: 4px solid var(--neon-blue);">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, var(--neon-green), var(--neon-blue)); color: #050b14; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px;">
              J
            </div>
            <div>
              <div id="settings-user-email" style="font-weight: 700; font-size: 15px; color: #fff;">Owner Account</div>
              <div style="font-size: 12px; color: var(--text-muted);">View Account &amp; Server Config &rarr;</div>
            </div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" color="var(--text-dim)"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>

        <!-- Navigation Rows -->
        <div class="card" style="padding: 4px 0;">
          <!-- WhatsApp Connection -->
          <div id="row-wa-conn" class="settings-row" style="display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; cursor: pointer; border-bottom: 1px solid var(--border-color);">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(0, 240, 118, 0.12); color: var(--neon-green); display: flex; align-items: center; justify-content: center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
              </div>
              <div>
                <div style="font-weight: 600; font-size: 14px; color: #fff;">WhatsApp Connection</div>
                <div style="font-size: 12px; color: var(--text-muted);">Phone ID, status &amp; 24h window</div>
              </div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" color="var(--text-dim)"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>

          <!-- AI Settings -->
          <div id="row-ai-settings" class="settings-row" style="display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; cursor: pointer; border-bottom: 1px solid var(--border-color);">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(0, 163, 255, 0.12); color: var(--neon-blue); display: flex; align-items: center; justify-content: center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              </div>
              <div>
                <div style="font-weight: 600; font-size: 14px; color: #fff;">AI Settings</div>
                <div style="font-size: 12px; color: var(--text-muted);">Personality presets &amp; response delay</div>
              </div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" color="var(--text-dim)"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>

          <!-- Conversation Logs -->
          <div id="row-conv-logs" class="settings-row" style="display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; cursor: pointer; border-bottom: 1px solid var(--border-color);">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(168, 85, 247, 0.12); color: #c084fc; display: flex; align-items: center; justify-content: center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              </div>
              <div>
                <div style="font-weight: 600; font-size: 14px; color: #fff;">Conversation Logs</div>
                <div style="font-size: 12px; color: var(--text-muted);">All, auto, drafts, manual, failed</div>
              </div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" color="var(--text-dim)"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>

          <!-- Error Logs -->
          <div id="row-error-logs" class="settings-row" style="display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; cursor: pointer;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(239, 68, 68, 0.12); color: var(--danger); display: flex; align-items: center; justify-content: center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              </div>
              <div>
                <div style="font-weight: 600; font-size: 14px; color: #fff;">Error Logs</div>
                <div style="font-size: 12px; color: var(--text-muted);">System alerts &amp; clear logs action</div>
              </div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" color="var(--text-dim)"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
        </div>

        <!-- PWA Install Prompt Card -->
        <div id="pwa-install-card" class="card" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="icons/icon-192.png" style="width: 32px; height: 32px; border-radius: 8px;" />
            <div>
              <div style="font-weight: 600; font-size: 13.5px; color: #fff;">Install PWA App</div>
              <div style="font-size: 11.5px; color: var(--text-muted);">Add to Home Screen for fast mobile access</div>
            </div>
          </div>
          <button id="btn-install-pwa" class="btn-primary" style="width: auto; padding: 6px 12px; font-size: 12px;">Install</button>
        </div>

        <!-- Logout Button -->
        <div style="margin-top: 14px;">
          <button id="btn-settings-logout" class="btn-secondary" style="color: var(--danger); border-color: rgba(239, 68, 68, 0.4); display: flex; align-items: center; justify-content: center; gap: 8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            <span>Log Out</span>
          </button>
        </div>
      </div>
    </div>
  `;

  const emailEl = container.querySelector('#settings-user-email');
  const logoutBtn = container.querySelector('#btn-settings-logout');
  const installBtn = container.querySelector('#btn-install-pwa');

  container.querySelector('#settings-profile-card').addEventListener('click', () => navigate('profile'));
  container.querySelector('#row-wa-conn').addEventListener('click', () => navigate('whatsapp-connection'));
  container.querySelector('#row-ai-settings').addEventListener('click', () => navigate('ai-settings'));
  container.querySelector('#row-conv-logs').addEventListener('click', () => navigate('conversation-logs'));
  container.querySelector('#row-error-logs').addEventListener('click', () => navigate('error-logs'));

  logoutBtn.addEventListener('click', async () => {
    if (confirm("Log out of your account?")) {
      await signOut();
      showToast("Signed out");
      navigate('login');
    }
  });

  // Handle PWA installation
  installBtn.addEventListener('click', () => {
    if (window.deferredPWAInstallPrompt) {
      window.deferredPWAInstallPrompt.prompt();
      window.deferredPWAInstallPrompt.userChoice.then((choice) => {
        if (choice.outcome === 'accepted') {
          showToast("App installed to home screen!");
        }
        window.deferredPWAInstallPrompt = null;
      });
    } else {
      showToast("To install, open browser menu and choose 'Add to Home Screen'");
    }
  });

  async function loadUser() {
    const session = await getCurrentSession();
    if (session && session.user) {
      emailEl.textContent = session.user.email;
    } else {
      emailEl.textContent = "Owner Account";
    }
  }

  loadUser();
}
