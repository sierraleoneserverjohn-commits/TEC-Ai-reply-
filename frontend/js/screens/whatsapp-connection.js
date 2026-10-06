// ==============================================================================
// Screen: WhatsApp Connection Status (Webhook, Phone ID, 24h window, Dry Run)
// ==============================================================================

import { API } from '../api.js';
import { formatTime, showToast, escapeHTML } from '../ui.js';

export function renderWhatsAppConnectionScreen(container, { navigate }) {
  container.innerHTML = `
    <div class="screen">
      <header class="app-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <button id="btn-back-conn" class="header-btn" title="Back">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <div class="brand-title" style="font-size: 17px;">WhatsApp Connection</div>
        </div>
      </header>

      <div class="content-scroll">
        <!-- Status Card -->
        <div class="card" style="border-left: 4px solid var(--neon-green);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="font-size: 15px; font-weight: 700; color: #fff;">Connection State</div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span id="conn-dry-run-tag" style="display: none; font-size: 10px; font-weight: 800; color: #050b14; background: var(--warning); padding: 2px 6px; border-radius: 4px;">
                DRY RUN
              </span>
              <span id="conn-state-badge" class="badge-online">Checking...</span>
            </div>
          </div>
          <div id="conn-state-desc" style="font-size: 13px; color: var(--text-muted); line-height: 1.4;">
            Verifying Graph API handshake and webhook synchronization...
          </div>
        </div>

        <!-- Read-Only Details Card -->
        <div class="card">
          <div class="card-title">Cloud API &amp; Webhook Details</div>

          <div style="display: flex; flex-direction: column; gap: 14px; font-size: 13.5px;">
            <div>
              <div style="font-size: 11px; font-weight: 700; color: var(--text-dim); text-transform: uppercase;">Display Phone Number</div>
              <div id="conn-display-phone" style="font-weight: 600; color: #fff; margin-top: 2px;">-</div>
            </div>

            <div>
              <div style="font-size: 11px; font-weight: 700; color: var(--text-dim); text-transform: uppercase;">Verified Business Name</div>
              <div id="conn-verified-name" style="font-weight: 600; color: #fff; margin-top: 2px;">-</div>
            </div>

            <div>
              <div style="font-size: 11px; font-weight: 700; color: var(--text-dim); text-transform: uppercase;">Phone Number ID</div>
              <div id="conn-phone-id" style="font-family: monospace; color: var(--text-muted); margin-top: 2px;">-</div>
            </div>

            <div>
              <div style="font-size: 11px; font-weight: 700; color: var(--text-dim); text-transform: uppercase;">Meta 24-Hour Policy Window</div>
              <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px;">
                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--neon-green);"></span>
                <span style="font-weight: 600; color: #fff;">Active Enforcement (Error 131047 Safeguard)</span>
              </div>
              <small style="font-size: 11px; color: var(--text-dim); margin-top: 2px; display: block;">
                Messages are only sent if user wrote within 24 hours to prevent Meta policy blocks.
              </small>
            </div>

            <div>
              <div style="font-size: 11px; font-weight: 700; color: var(--text-dim); text-transform: uppercase;">Last Received WhatsApp Message</div>
              <div id="conn-last-webhook" style="color: var(--text-muted); margin-top: 2px;">-</div>
            </div>
          </div>
        </div>

        <!-- Test Connection Button -->
        <button id="btn-test-conn" class="btn-primary" style="margin-bottom: 14px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          <span>Test Live Connection</span>
        </button>

        <div style="font-size: 12px; color: var(--text-dim); text-align: center; line-height: 1.4;">
          Meta API tokens and secrets are stored server-side in Render environment variables.
        </div>
      </div>
    </div>
  `;

  const backBtn = container.querySelector('#btn-back-conn');
  const dryRunTag = container.querySelector('#conn-dry-run-tag');
  const badge = container.querySelector('#conn-state-badge');
  const desc = container.querySelector('#conn-state-desc');
  const displayPhone = container.querySelector('#conn-display-phone');
  const verifiedName = container.querySelector('#conn-verified-name');
  const phoneId = container.querySelector('#conn-phone-id');
  const lastWebhook = container.querySelector('#conn-last-webhook');
  const testBtn = container.querySelector('#btn-test-conn');

  backBtn.addEventListener('click', () => navigate('settings'));

  async function loadStatus() {
    try {
      const data = await API.getConnection();
      if (data.dry_run) {
        dryRunTag.style.display = 'inline-block';
      } else {
        dryRunTag.style.display = 'none';
      }

      if (data.connected) {
        badge.textContent = data.dry_run ? "CONNECTED (DRY RUN)" : "CONNECTED (LIVE)";
        badge.className = "badge-online";
        desc.textContent = "WhatsApp Cloud API is active and receiving webhook events.";
      } else {
        badge.textContent = "DISCONNECTED";
        badge.className = "badge-offline";
        desc.textContent = data.error || "Unable to reach Meta Graph API. Check WA_TOKEN and WA_PHONE_NUMBER_ID.";
      }

      displayPhone.textContent = data.display_phone_number || "Not Available";
      verifiedName.textContent = data.verified_name || "Meta Business Account";
      phoneId.textContent = data.phone_number_id || "-";
      lastWebhook.textContent = data.last_webhook_at ? formatTime(data.last_webhook_at) : "No webhooks recorded yet";
    } catch (err) {
      badge.textContent = "OFFLINE";
      badge.className = "badge-offline";
      desc.textContent = err.message;
    }
  }

  testBtn.addEventListener('click', async () => {
    testBtn.disabled = true;
    testBtn.querySelector('span').textContent = "Testing...";
    try {
      const res = await API.testConnection();
      if (res.connected) {
        showToast("Connection test passed!");
      } else {
        showToast("Test failed: " + (res.error || "Could not reach Meta API"), true);
      }
      loadStatus();
    } catch (err) {
      showToast("Test error: " + err.message, true);
    } finally {
      testBtn.disabled = false;
      testBtn.querySelector('span').textContent = "Test Live Connection";
    }
  });

  loadStatus();
}
