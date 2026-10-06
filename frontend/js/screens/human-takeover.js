// ==============================================================================
// Screen: Human Takeover Mode
// ==============================================================================

import { API } from '../api.js';
import { showToast, escapeHTML } from '../ui.js';

export function renderHumanTakeoverScreen(container, { contactId, navigate }) {
  container.innerHTML = `
    <div class="screen">
      <header class="app-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <button id="btn-back-takeover" class="header-btn">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <div class="brand-title" style="font-size: 17px;">Human Takeover</div>
        </div>
      </header>

      <div class="content-scroll">
        <div class="card" style="border-left: 4px solid var(--neon-blue); text-align: center; padding: 24px 16px;">
          <div style="width: 64px; height: 64px; border-radius: 50%; background: var(--neon-blue-dim); color: var(--neon-blue); display: flex; align-items: center; justify-content: center; margin: 0 auto 14px;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><polyline points="17 11 19 13 23 9"></polyline></svg>
          </div>

          <h2 style="font-size: 18px; font-weight: 700; color: #fff; margin-bottom: 6px;">Take Over Control</h2>
          <p style="font-size: 13.5px; color: var(--text-muted); line-height: 1.5; margin-bottom: 18px;">
            While Human Takeover is active, automated AI replies are paused for this chat. You can converse directly in WhatsApp without any bot interference.
          </p>

          <div id="takeover-status-box" style="margin-bottom: 20px;">
            <div id="takeover-state-label" style="font-size: 14px; font-weight: 700; color: var(--neon-blue);">Checking status...</div>
          </div>

          <button id="btn-toggle-takeover" class="btn-primary" style="margin-bottom: 10px;">
            Take Over Chat
          </button>
        </div>

        <div class="card">
          <div class="card-title">How It Works</div>
          <ul style="font-size: 13px; color: var(--text-muted); line-height: 1.6; padding-left: 18px;">
            <li>When activated, the AI marks incoming messages as ignored.</li>
            <li>You can type and reply either from this app or directly inside WhatsApp.</li>
            <li>When you are finished chatting, click <strong>"Hand back to AI"</strong> to restore automated assistance.</li>
          </ul>
        </div>
      </div>
    </div>
  `;

  const backBtn = container.querySelector('#btn-back-takeover');
  const label = container.querySelector('#takeover-state-label');
  const actionBtn = container.querySelector('#btn-toggle-takeover');

  backBtn.addEventListener('click', () => {
    if (contactId) {
      navigate('chat', { contactId });
    } else {
      navigate('chats');
    }
  });

  let currentTakeover = false;

  async function loadTakeover() {
    if (!contactId) return;
    try {
      const contact = await API.getContact(contactId);
      currentTakeover = Boolean(contact.human_takeover);
      updateUI();
    } catch (err) {
      label.textContent = "Error: " + err.message;
    }
  }

  function updateUI() {
    if (currentTakeover) {
      label.textContent = "Takeover Active: AI is currently PAUSED";
      label.style.color = "var(--neon-blue)";
      actionBtn.textContent = "Hand Back to AI";
      actionBtn.className = "btn-secondary";
      actionBtn.style.color = "var(--neon-green)";
    } else {
      label.textContent = "AI is currently active for this chat";
      label.style.color = "var(--neon-green)";
      actionBtn.textContent = "Take Over Chat";
      actionBtn.className = "btn-primary";
    }
  }

  actionBtn.addEventListener('click', async () => {
    if (!contactId) return;
    actionBtn.disabled = true;

    try {
      if (currentTakeover) {
        await API.handbackChat(contactId);
        showToast("Chat handed back to AI");
        currentTakeover = false;
      } else {
        await API.takeoverChat(contactId);
        showToast("Human takeover active");
        currentTakeover = true;
      }
      updateUI();
    } catch (err) {
      showToast(`Action failed: ${err.message}`, true);
    } finally {
      actionBtn.disabled = false;
    }
  });

  loadTakeover();
}
