// ==============================================================================
// Screen: Splash (Brand & WhatsApp Connectivity Handshake)
// ==============================================================================

import { API } from '../api.js';
import { isConfigured } from '../config.js';
import { getCurrentSession } from '../supabase.js';

export function renderSplashScreen(container, { navigate }) {
  container.innerHTML = `
    <div class="screen" style="justify-content: center; align-items: center; padding: 24px; text-align: center; background: radial-gradient(circle at center, #14233c 0%, #0a101d 80%);">
      <div style="margin-bottom: 24px;">
        <img src="icons/logo.svg" alt="Robot Logo" style="width: 110px; height: 110px; filter: drop-shadow(0 0 16px rgba(0, 240, 118, 0.4)); animation: pulse 2s infinite ease-in-out;" />
      </div>

      <h1 style="font-size: 26px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 6px;">
        <span style="color: #ffffff;">Johnny TEC</span> <span style="color: var(--neon-green);">AI Reply</span>
      </h1>

      <p style="font-size: 14px; color: var(--text-muted); max-width: 280px; margin: 0 auto 36px; line-height: 1.4;">
        Your WhatsApp AI Assistant.<br>Always here. Always ready.
      </p>

      <!-- Connection Progress Container -->
      <div style="width: 100%; max-width: 280px; margin: 0 auto;">
        <div style="height: 6px; width: 100%; background: #1a273f; border-radius: 4px; overflow: hidden; margin-bottom: 12px; position: relative;">
          <div id="splash-progress" style="height: 100%; width: 25%; background: linear-gradient(90deg, var(--neon-green), var(--neon-blue)); border-radius: 4px; transition: width 0.6s ease;"></div>
        </div>
        <div id="splash-status-text" style="font-size: 12.5px; color: var(--text-muted); font-weight: 500;">Initializing AI Engine...</div>
      </div>
    </div>

    <style>
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }
    </style>
  `;

  const bar = container.querySelector('#splash-progress');
  const text = container.querySelector('#splash-status-text');

  async function performHandshake() {
    if (!isConfigured()) {
      if (bar) bar.style.width = '100%';
      if (text) {
        text.textContent = 'Configuration Required';
        text.style.color = 'var(--neon-blue)';
      }
      setTimeout(() => navigate('setup'), 600);
      return;
    }

    try {
      if (bar) bar.style.width = '60%';
      if (text) text.textContent = 'Connecting to Backend...';

      // Verify health probe
      try {
        await API.checkHealth();
      } catch (hErr) {
        console.warn("Backend health probe warning:", hErr);
      }

      if (bar) bar.style.width = '100%';
      if (text) text.textContent = 'AI System Online';

      const session = await getCurrentSession();
      setTimeout(() => {
        if (session) {
          navigate('home');
        } else {
          navigate('login');
        }
      }, 500);

    } catch (err) {
      if (bar) bar.style.width = '100%';
      if (text) {
        text.textContent = 'Connection Setup Needed';
        text.style.color = 'var(--warning)';
      }
      setTimeout(() => navigate('setup'), 800);
    }
  }

  setTimeout(performHandshake, 400);
}
