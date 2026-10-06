// ==============================================================================
// Screen: Login (Supabase Auth Email + Password)
// Only owner account matching OWNER_EMAIL in backend can manage the bot.
// ==============================================================================

import { signIn } from '../supabase.js';
import { isConfigured } from '../config.js';
import { showToast } from '../ui.js';

export function renderLoginScreen(container, { navigate }) {
  if (!isConfigured()) {
    navigate('setup');
    return;
  }

  container.innerHTML = `
    <div class="screen" style="justify-content: center; align-items: center; padding: 24px;">
      <div style="text-align: center; margin-bottom: 28px; width: 100%;">
        <div style="width: 76px; height: 76px; margin: 0 auto 16px; border-radius: 50%; background: rgba(0, 240, 118, 0.1); border: 2px solid var(--neon-green); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 20px rgba(0, 240, 118, 0.25);">
          <img src="icons/logo.svg" alt="Robot Logo" style="width: 48px; height: 48px;" />
        </div>
        <h1 style="font-size: 22px; font-weight: 700; color: #fff; margin-bottom: 4px;">Johnny TEC AI Reply</h1>
        <p style="font-size: 13.5px; color: var(--text-muted);">Sign in with your Owner Account</p>
      </div>

      <div class="card" style="width: 100%; max-width: 380px; margin: 0;">
        <form id="login-form">
          <div class="form-group">
            <label class="form-label" for="login-email">Email Address</label>
            <input 
              type="email" 
              id="login-email" 
              class="form-control" 
              placeholder="owner@example.com" 
              required 
              autocomplete="email"
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="login-pass">Password</label>
            <input 
              type="password" 
              id="login-pass" 
              class="form-control" 
              placeholder="••••••••••••" 
              required 
              autocomplete="current-password"
            />
          </div>

          <div id="login-error-msg" style="color: var(--danger); font-size: 13px; margin-bottom: 12px; display: none;"></div>

          <button type="submit" id="btn-login-submit" class="btn-primary" style="margin-top: 4px;">
            Sign In
          </button>
        </form>

        <div style="margin-top: 14px; text-align: center;">
          <button id="btn-reconfig" style="background:none; border:none; color:var(--text-dim); font-size:12px; cursor:pointer;">
            Change Backend / Supabase Settings &rarr;
          </button>
        </div>
      </div>

      <div style="margin-top: 24px; font-size: 11.5px; color: var(--text-dim); text-align: center;">
        Protected with Supabase Auth &bull; Private Owner Access
      </div>
    </div>
  `;

  const form = container.querySelector('#login-form');
  const emailInput = container.querySelector('#login-email');
  const passInput = container.querySelector('#login-pass');
  const submitBtn = container.querySelector('#btn-login-submit');
  const errorMsg = container.querySelector('#login-error-msg');
  const reconfigBtn = container.querySelector('#btn-reconfig');

  reconfigBtn.addEventListener('click', () => navigate('setup'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMsg.style.display = 'none';

    submitBtn.disabled = true;
    submitBtn.textContent = "Signing In...";

    try {
      await signIn(emailInput.value, passInput.value);
      showToast("Welcome back!");
      navigate('home');
    } catch (err) {
      errorMsg.textContent = err.message || "Invalid email or password";
      errorMsg.style.display = "block";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Sign In";
    }
  });
}
