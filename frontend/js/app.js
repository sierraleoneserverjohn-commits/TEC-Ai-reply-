// ==============================================================================
// Johnny TEC AI Reply - Main Application Controller & Router
// Bottom Navigation (Home, Chats, Logs, Settings) + Floating WhatsApp Action Modal
// ==============================================================================

import { getCurrentSession } from './supabase.js';
import { isConfigured } from './config.js';
import { API } from './api.js';
import { showToast, escapeHTML } from './ui.js';

import { renderSplashScreen } from './screens/splash.js';
import { renderSetupScreen } from './screens/setup.js';
import { renderLoginScreen } from './screens/login.js';
import { renderHomeScreen } from './screens/home.js';
import { renderChatsScreen } from './screens/chats.js';
import { renderChatScreen } from './screens/chat.js';
import { renderContactSettingsScreen } from './screens/contact-settings.js';
import { renderSettingsScreen } from './screens/settings.js';
import { renderWhatsAppConnectionScreen } from './screens/whatsapp-connection.js';
import { renderAISettingsScreen } from './screens/ai-settings.js';
import { renderConversationLogsScreen } from './screens/conversation-logs.js';
import { renderErrorLogsScreen } from './screens/error-logs.js';
import { renderHumanTakeoverScreen } from './screens/human-takeover.js';
import { renderProfileScreen } from './screens/profile.js';

// Global variable for PWA deferred prompt
window.deferredPWAInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.deferredPWAInstallPrompt = e;
});

class App {
  constructor() {
    this.root = document.getElementById('app');
    this.currentScreen = null;
    this.screenParams = {};
    this.activeTeardown = null;

    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.screen) {
        this.navigate(e.state.screen, e.state.params, false);
      }
    });

    window.addEventListener('auth:expired', (e) => {
      showToast(e.detail?.message || "Session expired. Please sign in again.", true);
      this.navigate('login');
    });
  }

  async init() {
    this.navigate('splash');
  }

  navigate(screenName, params = {}, pushHistory = true) {
    if (this.activeTeardown && typeof this.activeTeardown === 'function') {
      try {
        this.activeTeardown();
      } catch (err) {
        console.warn("Screen teardown error:", err);
      }
      this.activeTeardown = null;
    }

    this.currentScreen = screenName;
    this.screenParams = params;

    if (pushHistory) {
      window.history.pushState({ screen: screenName, params }, '', `#${screenName}`);
    }

    this.render();
  }

  render() {
    this.root.innerHTML = '';

    const screenContainer = document.createElement('div');
    screenContainer.style.flex = '1';
    screenContainer.style.display = 'flex';
    screenContainer.style.flexDirection = 'column';
    screenContainer.style.overflow = 'hidden';
    screenContainer.style.position = 'relative';
    this.root.appendChild(screenContainer);

    const context = {
      navigate: (screen, params) => this.navigate(screen, params),
      ...this.screenParams
    };

    switch (this.currentScreen) {
      case 'splash':
        this.activeTeardown = renderSplashScreen(screenContainer, context);
        break;
      case 'setup':
        this.activeTeardown = renderSetupScreen(screenContainer, context);
        break;
      case 'login':
        this.activeTeardown = renderLoginScreen(screenContainer, context);
        break;
      case 'home':
        this.activeTeardown = renderHomeScreen(screenContainer, context);
        break;
      case 'chats':
        this.activeTeardown = renderChatsScreen(screenContainer, context);
        break;
      case 'chat':
        this.activeTeardown = renderChatScreen(screenContainer, context);
        break;
      case 'contact-settings':
        this.activeTeardown = renderContactSettingsScreen(screenContainer, context);
        break;
      case 'settings':
        this.activeTeardown = renderSettingsScreen(screenContainer, context);
        break;
      case 'whatsapp-connection':
        this.activeTeardown = renderWhatsAppConnectionScreen(screenContainer, context);
        break;
      case 'ai-settings':
        this.activeTeardown = renderAISettingsScreen(screenContainer, context);
        break;
      case 'conversation-logs':
        this.activeTeardown = renderConversationLogsScreen(screenContainer, context);
        break;
      case 'error-logs':
        this.activeTeardown = renderErrorLogsScreen(screenContainer, context);
        break;
      case 'human-takeover':
        this.activeTeardown = renderHumanTakeoverScreen(screenContainer, context);
        break;
      case 'profile':
        this.activeTeardown = renderProfileScreen(screenContainer, context);
        break;
      default:
        this.activeTeardown = renderHomeScreen(screenContainer, context);
        break;
    }

    // Render Bottom Navigation on primary tabs: Home, Chats, Logs, Settings
    const isMainTab = ['home', 'chats', 'conversation-logs', 'settings'].includes(this.currentScreen);
    if (isMainTab) {
      this.renderBottomNavigation();
    }
  }

  renderBottomNavigation() {
    const nav = document.createElement('nav');
    nav.className = 'bottom-nav';

    nav.innerHTML = `
      <button class="nav-item ${this.currentScreen === 'home' ? 'active' : ''}" data-nav="home" title="Home">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
        <span>Home</span>
      </button>

      <button class="nav-item ${this.currentScreen === 'chats' ? 'active' : ''}" data-nav="chats" title="Chats">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        <span>Chats</span>
      </button>

      <!-- Floating Green WhatsApp Button (Opens New Chat Modal) -->
      <button id="floating-wa-btn" class="floating-wa-btn" title="Start New WhatsApp Chat">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
      </button>

      <button class="nav-item ${this.currentScreen === 'conversation-logs' ? 'active' : ''}" data-nav="conversation-logs" title="Logs">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
        <span>Logs</span>
      </button>

      <button class="nav-item ${this.currentScreen === 'settings' ? 'active' : ''}" data-nav="settings" title="Settings">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        <span>Settings</span>
      </button>
    `;

    nav.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.navigate(btn.getAttribute('data-nav'));
      });
    });

    // Floating WhatsApp Button opens the New Chat Modal
    const floatingBtn = nav.querySelector('#floating-wa-btn');
    floatingBtn.addEventListener('click', () => {
      this.openNewChatModal();
    });

    this.root.appendChild(nav);
  }

  openNewChatModal() {
    let existingModal = document.getElementById('new-chat-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'new-chat-modal';
    modal.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 1000;
      display: flex; align-items: center; justify-content: center; padding: 16px;
    `;

    modal.innerHTML = `
      <div class="card" style="width: 100%; max-width: 400px; margin: 0; border: 1px solid var(--neon-green); box-shadow: 0 12px 36px rgba(0,0,0,0.6);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--neon-green)" stroke-width="2.2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
            <span style="font-weight: 700; font-size: 16px; color: #fff;">Start New WhatsApp Chat</span>
          </div>
          <button id="btn-close-new-chat" style="background: none; border: none; color: var(--text-muted); font-size: 22px; cursor: pointer; padding: 2px;">&times;</button>
        </div>

        <form id="new-chat-form">
          <div class="form-group">
            <label class="form-label" for="nc-phone">Phone Number (with Country Code)</label>
            <input 
              type="tel" 
              id="nc-phone" 
              class="form-control" 
              placeholder="+1234567890" 
              required
            />
            <small style="font-size: 11px; color: var(--text-dim); margin-top: 2px; display: block;">
              Digits with country code (e.g. 15550192831)
            </small>
          </div>

          <div class="form-group">
            <label class="form-label" for="nc-name">Contact Name (Optional)</label>
            <input 
              type="text" 
              id="nc-name" 
              class="form-control" 
              placeholder="e.g. Sarah Jenkins or Mom" 
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="nc-msg">First Message (Optional)</label>
            <textarea 
              id="nc-msg" 
              class="form-control" 
              placeholder="Type initial message to send..." 
              style="min-height: 70px;"
            ></textarea>
          </div>

          <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px;">
            <button type="button" id="btn-cancel-new-chat" class="btn-secondary" style="width: auto; padding: 8px 14px; font-size: 13px;">Cancel</button>
            <button type="submit" id="btn-submit-new-chat" class="btn-primary" style="width: auto; padding: 8px 18px; font-size: 13px;">Open Chat</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('#btn-close-new-chat');
    const cancelBtn = modal.querySelector('#btn-cancel-new-chat');
    const form = modal.querySelector('#new-chat-form');
    const phoneInput = modal.querySelector('#nc-phone');
    const nameInput = modal.querySelector('#nc-name');
    const msgInput = modal.querySelector('#nc-msg');
    const submitBtn = modal.querySelector('#btn-submit-new-chat');

    const closeModal = () => modal.remove();
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const phone = phoneInput.value.trim();
      const name = nameInput.value.trim();
      const msg = msgInput.value.trim();

      if (!phone) {
        showToast("Phone number is required", true);
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Opening...";

      try {
        const contact = await API.createContact({
          wa_id: phone,
          display_name: name || null,
          first_message: msg || null
        });

        closeModal();
        showToast(`Chat opened with +${contact.wa_id}`);
        this.navigate('chat', { contactId: contact.id });
      } catch (err) {
        showToast(`Failed: ${err.message}`, true);
        submitBtn.disabled = false;
        submitBtn.textContent = "Open Chat";
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
