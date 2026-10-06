// ==============================================================================
// Screen: Chat View (Conversation Stream, Header Mode Switch, Lock Icon & Composer)
// ==============================================================================

import { API } from '../api.js';
import { renderAvatar, formatTime, showToast, escapeHTML } from '../ui.js';

export function renderChatScreen(container, { contactId, navigate }) {
  let pollingTimer = null;
  let currentContact = null;

  container.innerHTML = `
    <div class="screen" style="background: #080e1a;">
      <!-- Header -->
      <header class="app-header" style="padding: calc(var(--safe-top) + 8px) 12px 8px 12px;">
        <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
          <button id="btn-back-chat" class="header-btn" style="padding: 6px;" title="Back to Chats">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>

          <div id="header-avatar-slot"></div>

          <div style="flex: 1; min-width: 0;">
            <div id="chat-contact-name" style="font-size: 15px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              Loading...
            </div>
            <div id="chat-contact-status" style="font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 4px;">
              <span>WhatsApp</span>
            </div>
          </div>
        </div>

        <!-- Mode Switch, Lock Icon & Menu -->
        <div style="display: flex; align-items: center; gap: 6px;">
          <!-- Inline Clickable Mode Selector -->
          <select id="chat-mode-selector" class="form-control" style="width: auto; padding: 4px 8px; font-size: 11px; font-weight: 700; border-radius: 8px; cursor: pointer;">
            <option value="ask">Ask</option>
            <option value="auto">Auto</option>
            <option value="off">Off</option>
          </select>

          <!-- Lock Icon (Opens Secret Settings) -->
          <button id="btn-lock-settings" class="header-btn" title="Secret Settings (Per-Contact AI Instruction)" style="color: var(--neon-green);">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          </button>

          <!-- More Options Menu Button -->
          <button id="btn-chat-options" class="header-btn" title="More Options">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="1.5"></circle><circle cx="12" cy="5" r="1.5"></circle><circle cx="12" cy="19" r="1.5"></circle></svg>
          </button>
        </div>
      </header>

      <!-- Dropdown Menu for Takeover / Archive -->
      <div id="chat-options-menu" style="display: none; position: absolute; top: calc(var(--safe-top) + 54px); right: 12px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 10px; z-index: 50; box-shadow: 0 8px 24px rgba(0,0,0,0.5); width: 190px; overflow: hidden;">
        <button id="menu-opt-takeover" style="width: 100%; text-align: left; padding: 12px 14px; background: none; border: none; border-bottom: 1px solid var(--border-color); color: var(--text-main); font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle></svg>
          <span id="takeover-menu-text">Human Takeover</span>
        </button>
        <button id="menu-opt-archive" style="width: 100%; text-align: left; padding: 12px 14px; background: none; border: none; color: var(--text-main); font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>
          <span id="archive-menu-text">Archive Chat</span>
        </button>
      </div>

      <!-- Human Takeover Active Banner -->
      <div id="takeover-banner" style="display: none; background: rgba(0, 163, 255, 0.15); border-bottom: 1px solid rgba(0, 163, 255, 0.3); padding: 9px 14px; font-size: 12.5px; color: var(--neon-blue); align-items: center; justify-content: space-between;">
        <span><strong>You are in control</strong> &bull; AI is paused for this contact</span>
        <button id="btn-handback-banner" style="background: rgba(0, 163, 255, 0.2); border: 1px solid rgba(0, 163, 255, 0.4); border-radius: 6px; padding: 3px 8px; color: #fff; font-weight: 700; cursor: pointer; font-size: 11.5px;">Return to AI</button>
      </div>

      <!-- Message Bubbles Stream -->
      <div id="chat-stream" style="flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 14px 12px; display: flex; flex-direction: column;">
        <div style="text-align: center; padding: 40px; color: var(--text-muted);">
          <div class="spinner" style="margin: 0 auto 10px;"></div>
          Loading messages...
        </div>
      </div>

      <!-- Manual Composer Bar -->
      <div style="background: var(--bg-panel); border-top: 1px solid var(--border-color); padding: 8px 12px calc(var(--safe-bottom) + 8px) 12px; display: flex; align-items: center; gap: 8px; z-index: 20;">
        <input 
          type="text" 
          id="chat-manual-input" 
          class="form-control" 
          placeholder="Type message as Johnny..." 
          style="border-radius: 20px; font-size: 14px; padding: 10px 16px;"
          autocomplete="off"
        />
        <button id="btn-send-manual" class="floating-wa-btn" style="width: 44px; height: 44px; margin: 0; box-shadow: none;" title="Send WhatsApp Message">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </button>
      </div>

      <!-- Secret Settings Modal -->
      <div id="secret-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 100; align-items: center; justify-content: center; padding: 16px;">
        <div class="card" style="width: 100%; max-width: 440px; max-height: 85vh; overflow-y: auto; margin: 0; border: 1px solid var(--neon-green);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--neon-green)" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              <span style="font-weight: 700; font-size: 16px; color: #fff;">Secret Settings</span>
            </div>
            <button id="btn-close-secret" style="background: none; border: none; color: var(--text-muted); font-size: 20px; cursor: pointer; padding: 4px;">&times;</button>
          </div>

          <form id="secret-form">
            <div class="form-group">
              <label class="form-label" for="secret-instruction">Per-Contact AI Instruction</label>
              <textarea 
                id="secret-instruction" 
                class="form-control" 
                style="min-height: 90px; border-color: rgba(0, 240, 118, 0.4);"
                placeholder="e.g. Reply to Mom with respect, short and warm, call her Mama"
              ></textarea>
              <small style="display: block; font-size: 11px; color: var(--neon-green); margin-top: 4px;">
                ★ Appended to prompt for this person only. Always overrides AI guesses.
              </small>
            </div>

            <!-- Read-only learned profile display -->
            <div style="margin-top: 14px; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px; border: 1px solid var(--border-color);">
              <div style="font-size: 11px; font-weight: 700; color: var(--neon-blue); text-transform: uppercase; margin-bottom: 4px;">
                AI Learned Memory (Read-Only)
              </div>
              <div id="secret-learned-preview" style="font-size: 12.5px; color: var(--text-main); line-height: 1.4;"></div>
            </div>

            <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px;">
              <button type="button" id="btn-cancel-secret" class="btn-secondary" style="width: auto; padding: 8px 14px; font-size: 13px;">Cancel</button>
              <button type="submit" id="btn-save-secret" class="btn-primary" style="width: auto; padding: 8px 18px; font-size: 13px;">Save</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  // Element bindings
  const backBtn = container.querySelector('#btn-back-chat');
  const avatarSlot = container.querySelector('#header-avatar-slot');
  const contactNameEl = container.querySelector('#chat-contact-name');
  const contactStatusEl = container.querySelector('#chat-contact-status');
  const modeSelect = container.querySelector('#chat-mode-selector');
  const lockBtn = container.querySelector('#btn-lock-settings');
  const optionsBtn = container.querySelector('#btn-chat-options');
  const optionsMenu = container.querySelector('#chat-options-menu');
  const takeoverBtn = container.querySelector('#menu-opt-takeover');
  const takeoverText = container.querySelector('#takeover-menu-text');
  const archiveBtn = container.querySelector('#menu-opt-archive');
  const archiveText = container.querySelector('#archive-menu-text');
  const takeoverBanner = container.querySelector('#takeover-banner');
  const handbackBannerBtn = container.querySelector('#btn-handback-banner');

  const stream = container.querySelector('#chat-stream');
  const manualInput = container.querySelector('#chat-manual-input');
  const sendBtn = container.querySelector('#btn-send-manual');

  // Secret Modal Elements
  const secretModal = container.querySelector('#secret-modal');
  const closeSecretBtn = container.querySelector('#btn-close-secret');
  const cancelSecretBtn = container.querySelector('#btn-cancel-secret');
  const secretForm = container.querySelector('#secret-form');
  const secretInstruction = container.querySelector('#secret-instruction');
  const secretLearnedPreview = container.querySelector('#secret-learned-preview');

  backBtn.addEventListener('click', () => navigate('chats'));

  // Lock Icon opens secret settings modal
  lockBtn.addEventListener('click', () => {
    if (currentContact) {
      secretInstruction.value = currentContact.custom_instruction || '';
      const learned = currentContact.learned_profile;
      if (learned && Object.keys(learned).length > 0) {
        secretLearnedPreview.innerHTML = `
          <div><strong>Relationship:</strong> ${escapeHTML(learned.relationship_guess || 'Contact')}</div>
          <div><strong>Style:</strong> ${escapeHTML(learned.writing_style || 'Natural')}</div>
          <div><strong>Summary:</strong> "${escapeHTML(learned.summary || 'None')}"</div>
        `;
      } else {
        secretLearnedPreview.innerHTML = `<em>The AI is still learning this contact's habits (analyzes every 5 messages).</em>`;
      }
    }
    secretModal.style.display = 'flex';
  });

  closeSecretBtn.addEventListener('click', () => { secretModal.style.display = 'none'; });
  cancelSecretBtn.addEventListener('click', () => { secretModal.style.display = 'none'; });

  secretForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inst = secretInstruction.value.trim();
    try {
      await API.updateContact(contactId, { custom_instruction: inst || null });
      if (currentContact) currentContact.custom_instruction = inst || null;
      showToast("Secret instruction saved!");
      secretModal.style.display = 'none';
    } catch (err) {
      showToast(`Save failed: ${err.message}`, true);
    }
  });

  optionsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    optionsMenu.style.display = optionsMenu.style.display === 'none' ? 'block' : 'none';
  });

  document.addEventListener('click', () => {
    if (optionsMenu) optionsMenu.style.display = 'none';
  });

  modeSelect.addEventListener('change', async (e) => {
    const newMode = e.target.value;
    try {
      await API.updateContact(contactId, { mode: newMode });
      if (currentContact) currentContact.mode = newMode;
      showToast(`Mode set to ${newMode.toUpperCase()}`);
    } catch (err) {
      showToast(`Failed: ${err.message}`, true);
    }
  });

  takeoverBtn.addEventListener('click', async () => {
    optionsMenu.style.display = 'none';
    const isTakeover = currentContact?.human_takeover;
    try {
      if (isTakeover) {
        await API.handbackChat(contactId);
        showToast("Handed back to AI");
      } else {
        await API.takeoverChat(contactId);
        showToast("Human takeover active (AI paused)");
      }
      loadChat();
    } catch (err) {
      showToast(`Failed: ${err.message}`, true);
    }
  });

  handbackBannerBtn.addEventListener('click', async () => {
    try {
      await API.handbackChat(contactId);
      showToast("Handed back to AI");
      loadChat();
    } catch (err) {
      showToast(`Failed: ${err.message}`, true);
    }
  });

  archiveBtn.addEventListener('click', async () => {
    optionsMenu.style.display = 'none';
    const isArchived = currentContact?.archived;
    try {
      await API.updateContact(contactId, { archived: !isArchived });
      showToast(!isArchived ? "Chat archived" : "Chat unarchived");
      navigate('chats');
    } catch (err) {
      showToast(`Failed: ${err.message}`, true);
    }
  });

  async function loadChat() {
    try {
      const [contact, messages] = await Promise.all([
        API.getContact(contactId),
        API.getMessages(contactId)
      ]);

      currentContact = contact;
      contactNameEl.textContent = contact.display_name || `+${contact.wa_id}`;
      avatarSlot.innerHTML = renderAvatar(contact.display_name || contact.wa_id, 38);
      modeSelect.value = contact.mode || 'ask';

      const isTakeover = Boolean(contact.human_takeover);
      takeoverBanner.style.display = isTakeover ? 'flex' : 'none';
      takeoverText.textContent = isTakeover ? 'Hand back to AI' : 'Human Takeover';

      archiveText.textContent = contact.archived ? 'Unarchive Chat' : 'Archive Chat';

      contactStatusEl.innerHTML = `
        <span>+${escapeHTML(contact.wa_id)}</span>
        ${contact.relationship ? `&bull; <span>${escapeHTML(contact.relationship)}</span>` : ''}
      `;

      renderMessages(messages);
    } catch (err) {
      stream.innerHTML = `<div style="color: var(--danger); text-align: center; padding: 24px;">Failed to load chat: ${escapeHTML(err.message)}</div>`;
    }
  }

  function renderMessages(messages) {
    if (!messages || messages.length === 0) {
      stream.innerHTML = `
        <div style="text-align: center; padding: 48px; color: var(--text-dim);">
          <p>No messages yet with this contact.</p>
        </div>
      `;
      return;
    }

    stream.innerHTML = messages.map(msg => {
      const isIncoming = msg.direction === 'in';
      const sender = msg.sender;
      const status = msg.status;
      const timeStr = formatTime(msg.created_at);
      const body = escapeHTML(msg.body);

      // Draft pending approval
      if (status === 'drafted' && msg.ai_draft) {
        return `
          <div class="bubble incoming">
            <div>${body}</div>
            <div style="font-size: 10.5px; color: var(--text-dim); text-align: right; margin-top: 3px;">${timeStr}</div>
          </div>
          <div class="bubble draft-bubble" data-mid="${escapeHTML(msg.id)}">
            <div style="font-size: 11px; font-weight: 800; color: var(--neon-green); margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
              <span style="display:flex; align-items:center; gap:4px;">
                <img src="icons/logo.svg" style="width:14px; height:14px;" />
                AI PROPOSED DRAFT (WAITING APPROVAL)
              </span>
              <span>Gemini</span>
            </div>
            <div id="view-draft-${escapeHTML(msg.id)}" style="font-size: 14px; margin-bottom: 10px; background: rgba(0,0,0,0.3); padding: 8px 10px; border-radius: 8px; line-height: 1.4;">
              ${escapeHTML(msg.ai_draft)}
            </div>
            <textarea id="edit-draft-${escapeHTML(msg.id)}" class="form-control" style="display: none; margin-bottom: 10px; min-height: 70px;">${escapeHTML(msg.ai_draft)}</textarea>
            <div style="display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap;">
              <button class="btn-secondary" style="width: auto; padding: 6px 10px; font-size: 11.5px;" data-act="regen" data-mid="${escapeHTML(msg.id)}">Regenerate</button>
              <button class="btn-secondary" style="width: auto; padding: 6px 10px; font-size: 11.5px; color: var(--danger);" data-act="reject" data-mid="${escapeHTML(msg.id)}">Reject</button>
              <button class="btn-secondary" style="width: auto; padding: 6px 10px; font-size: 11.5px;" data-act="edit-toggle" data-mid="${escapeHTML(msg.id)}">Edit</button>
              <button class="btn-primary" style="width: auto; padding: 6px 14px; font-size: 11.5px;" data-act="approve" data-mid="${escapeHTML(msg.id)}">Approve &amp; Send</button>
            </div>
          </div>
        `;
      }

      // Needs attention
      if (status === 'needs_attention') {
        return `
          <div class="bubble incoming" style="border-left: 3px solid var(--danger);">
            <div style="font-size: 10.5px; font-weight: 800; color: var(--danger); margin-bottom: 3px;">ACTION REQUIRED</div>
            <div>${body}</div>
            <div style="font-size: 11px; color: var(--text-dim); margin-top: 4px;">${escapeHTML(msg.error || 'Human decision needed')}</div>
            <div style="font-size: 10.5px; color: var(--text-dim); text-align: right; margin-top: 3px;">${timeStr}</div>
          </div>
        `;
      }

      // Outgoing AI
      if (sender === 'ai') {
        return `
          <div class="bubble outgoing-ai">
            <div><span class="btn-tag tag-ai">AI</span>${body}</div>
            <div style="font-size: 10.5px; color: rgba(255,255,255,0.6); text-align: right; margin-top: 3px;">${timeStr}</div>
          </div>
        `;
      }

      // Outgoing Manual Johnny
      if (sender === 'me') {
        return `
          <div class="bubble outgoing-me">
            <div><span class="btn-tag tag-me">ME</span>${body}</div>
            <div style="font-size: 10.5px; color: rgba(255,255,255,0.6); text-align: right; margin-top: 3px;">${timeStr}</div>
          </div>
        `;
      }

      // Normal incoming
      return `
        <div class="bubble incoming">
          <div>${body}</div>
          <div style="font-size: 10.5px; color: var(--text-dim); text-align: right; margin-top: 3px;">${timeStr}</div>
        </div>
      `;
    }).join('');

    attachDraftActions();
    stream.scrollTop = stream.scrollHeight;
  }

  function attachDraftActions() {
    stream.querySelectorAll('[data-act]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.getAttribute('data-act');
        const mid = btn.getAttribute('data-mid');
        const viewEl = stream.querySelector(`#view-draft-${mid}`);
        const editEl = stream.querySelector(`#edit-draft-${mid}`);

        if (action === 'edit-toggle') {
          const isEdit = editEl.style.display !== 'none';
          if (isEdit) {
            editEl.style.display = 'none';
            viewEl.style.display = 'block';
            btn.textContent = 'Edit';
          } else {
            editEl.style.display = 'block';
            viewEl.style.display = 'none';
            btn.textContent = 'Cancel';
            editEl.focus();
          }
          return;
        }

        btn.disabled = true;
        try {
          if (action === 'approve') {
            const isEditing = editEl && editEl.style.display !== 'none';
            const textToSend = isEditing ? editEl.value.trim() : null;
            await API.approveDraft(mid, textToSend);
            showToast("Draft approved and sent!");
            loadChat();
          } else if (action === 'reject') {
            await API.rejectDraft(mid);
            showToast("Draft rejected");
            loadChat();
          } else if (action === 'regen') {
            btn.textContent = 'Generating...';
            await API.regenerateDraft(mid);
            showToast("Draft regenerated");
            loadChat();
          }
        } catch (err) {
          showToast(`Error: ${err.message}`, true);
          btn.disabled = false;
        }
      });
    });
  }

  async function sendManual() {
    const text = manualInput.value.trim();
    if (!text) return;

    manualInput.value = '';
    sendBtn.disabled = true;

    try {
      await API.sendManualMessage(contactId, text);
      loadChat();
    } catch (err) {
      showToast(`Send failed: ${err.message}`, true);
    } finally {
      sendBtn.disabled = false;
    }
  }

  sendBtn.addEventListener('click', sendManual);
  manualInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendManual();
    }
  });

  loadChat();
  pollingTimer = setInterval(loadChat, 12000);

  return () => {
    if (pollingTimer) clearInterval(pollingTimer);
  };
}
