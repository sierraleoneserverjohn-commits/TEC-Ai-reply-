// ==============================================================================
// Screen: Contact Settings ("Secret Settings" Per-Contact Instruction)
// ==============================================================================

import { API } from '../api.js';
import { renderAvatar, showToast, escapeHTML } from '../ui.js';

export function renderContactSettingsScreen(container, { contactId, navigate }) {
  container.innerHTML = `
    <div class="screen">
      <header class="app-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <button id="btn-back-cs" class="header-btn">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <div class="brand-title" style="font-size: 17px;">Secret Settings</div>
        </div>
      </header>

      <div class="content-scroll">
        <div id="cs-loading" style="text-align: center; padding: 40px; color: var(--text-muted);">
          <div class="spinner" style="margin: 0 auto 10px;"></div>
          Loading contact profile...
        </div>

        <div id="cs-content" style="display: none;">
          <!-- Top Contact Card -->
          <div style="text-align: center; padding: 10px 0 16px 0;">
            <div id="cs-avatar-holder" style="display: flex; justify-content: center; margin-bottom: 8px;"></div>
            <h2 id="cs-name-header" style="font-size: 18px; font-weight: 700; color: #fff;"></h2>
            <div id="cs-phone-header" style="font-size: 13px; color: var(--text-muted); margin-top: 2px;"></div>
          </div>

          <!-- Secret Settings Form -->
          <div class="card" style="border: 1px solid var(--neon-green);">
            <div class="card-title" style="color: var(--neon-green);">
              <div style="display: flex; align-items: center; gap: 6px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                <span>Per-Contact AI Instruction</span>
              </div>
            </div>

            <form id="cs-form">
              <div class="form-group">
                <label class="form-label" for="cs-instruction">How should the AI reply to this person?</label>
                <textarea 
                  id="cs-instruction" 
                  class="form-control" 
                  style="min-height: 100px; border-color: rgba(0, 240, 118, 0.4);"
                  placeholder="e.g. Reply to Mom with respect, short and warm, call her Mama. Never mention busy schedule."
                ></textarea>
                <small style="display: block; font-size: 11px; color: var(--neon-green); margin-top: 5px;">
                  ★ Highest Priority: Overrides AI guesses for this contact only.
                </small>
              </div>

              <div class="form-group">
                <label class="form-label" for="cs-display-name">Display Name</label>
                <input type="text" id="cs-display-name" class="form-control" />
              </div>

              <div class="form-group">
                <label class="form-label" for="cs-relationship">Relationship</label>
                <input type="text" id="cs-relationship" class="form-control" placeholder="e.g. Mom, Best Friend, Client" />
              </div>

              <div class="form-group">
                <label class="form-label" for="cs-language">Preferred Language</label>
                <input type="text" id="cs-language" class="form-control" placeholder="e.g. English, Spanish, French" />
              </div>

              <button type="submit" id="btn-save-cs" class="btn-primary" style="margin-top: 10px;">
                Save Secret Settings
              </button>
            </form>
          </div>

          <!-- Read-Only Learned Profile Card -->
          <div class="card">
            <div class="card-title">
              <span>What the AI Has Learned (Self-Learned)</span>
              <span id="cs-learning-badge" style="font-size: 11px; color: var(--neon-blue); font-weight: 600;"></span>
            </div>

            <div id="cs-learned-body" style="font-size: 13.5px; line-height: 1.5; color: var(--text-main);"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  const backBtn = container.querySelector('#btn-back-cs');
  const loading = container.querySelector('#cs-loading');
  const content = container.querySelector('#cs-content');
  const avatarHolder = container.querySelector('#cs-avatar-holder');
  const nameHeader = container.querySelector('#cs-name-header');
  const phoneHeader = container.querySelector('#cs-phone-header');

  const form = container.querySelector('#cs-form');
  const inputInstruction = container.querySelector('#cs-instruction');
  const inputName = container.querySelector('#cs-display-name');
  const inputRel = container.querySelector('#cs-relationship');
  const inputLang = container.querySelector('#cs-language');
  const saveBtn = container.querySelector('#btn-save-cs');

  const learningBadge = container.querySelector('#cs-learning-badge');
  const learnedBody = container.querySelector('#cs-learned-body');

  backBtn.addEventListener('click', () => navigate('chat', { contactId }));

  async function loadContact() {
    try {
      const c = await API.getContact(contactId);
      if (!c) throw new Error("Contact not found");

      loading.style.display = 'none';
      content.style.display = 'block';

      nameHeader.textContent = c.display_name || `+${c.wa_id}`;
      phoneHeader.textContent = `WhatsApp: +${c.wa_id}`;
      avatarHolder.innerHTML = renderAvatar(c.display_name || c.wa_id, 56);

      inputInstruction.value = c.custom_instruction || '';
      inputName.value = c.display_name || '';
      inputRel.value = c.relationship || '';
      inputLang.value = c.language || '';

      const count = c.inbound_since_profile_update || 0;
      learningBadge.textContent = `${count}/5 msgs until next analysis`;

      renderLearnedMemory(c.learned_profile);
    } catch (err) {
      loading.innerHTML = `<div style="color: var(--danger); padding: 20px;">Error: ${escapeHTML(err.message)}</div>`;
    }
  }

  function renderLearnedMemory(profile) {
    if (!profile || Object.keys(profile).length === 0) {
      learnedBody.innerHTML = `
        <div style="color: var(--text-muted); font-style: italic; padding: 6px 0;">
          The AI has not analyzed enough messages yet. It updates automatically every 5 incoming messages.
        </div>
      `;
      return;
    }

    const topics = Array.isArray(profile.usual_topics) ? profile.usual_topics : [];
    const topicsHtml = topics.map(t => `<span style="display:inline-block; font-size:11.5px; background:var(--neon-blue-dim); color:var(--neon-blue); border:1px solid rgba(0,163,255,0.3); border-radius:12px; padding:2px 8px; margin:2px;">${escapeHTML(t)}</span>`).join('');

    learnedBody.innerHTML = `
      <div style="margin-bottom: 10px;">
        <div style="font-size: 11px; font-weight: 700; color: var(--text-dim); text-transform: uppercase;">Inferred Relationship</div>
        <div style="font-weight: 600; color: #fff; margin-top: 2px;">
          ${escapeHTML(profile.relationship_guess || 'Contact')} 
          <span style="font-size: 11px; color: var(--neon-green);">(${escapeHTML(profile.confidence || 'medium')} confidence)</span>
        </div>
      </div>

      <div style="margin-bottom: 10px;">
        <div style="font-size: 11px; font-weight: 700; color: var(--text-dim); text-transform: uppercase;">Writing Style</div>
        <div style="color: var(--text-muted); margin-top: 2px;">${escapeHTML(profile.writing_style || 'Natural')}</div>
      </div>

      <div style="margin-bottom: 10px;">
        <div style="font-size: 11px; font-weight: 700; color: var(--text-dim); text-transform: uppercase;">Usual Topics</div>
        <div style="margin-top: 4px;">${topicsHtml || '<span style="color:var(--text-dim)">General</span>'}</div>
      </div>

      <div style="margin-bottom: 10px;">
        <div style="font-size: 11px; font-weight: 700; color: var(--text-dim); text-transform: uppercase;">Reply Preference</div>
        <div style="color: var(--text-muted); margin-top: 2px;">${escapeHTML(profile.reply_preference || 'Standard')}</div>
      </div>

      <div>
        <div style="font-size: 11px; font-weight: 700; color: var(--text-dim); text-transform: uppercase;">Summary</div>
        <div style="color: var(--text-main); font-style: italic; background: rgba(0,0,0,0.25); padding: 8px 10px; border-radius: 8px; margin-top: 4px;">
          "${escapeHTML(profile.summary || 'None')}"
        </div>
      </div>
    `;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    saveBtn.disabled = true;

    try {
      await API.updateContact(contactId, {
        custom_instruction: inputInstruction.value.trim() || null,
        display_name: inputName.value.trim() || null,
        relationship: inputRel.value.trim() || null,
        language: inputLang.value.trim() || null
      });
      showToast("Secret settings saved!");
      navigate('chat', { contactId });
    } catch (err) {
      showToast(`Save failed: ${err.message}`, true);
    } finally {
      saveBtn.disabled = false;
    }
  });

  loadContact();
}
