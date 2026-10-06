# Johnny TEC AI Reply - WhatsApp AI Auto-Reply

Production-ready, end-to-end AI auto-reply system for the WhatsApp Business Cloud API (Meta), powered by Google Gemini, FastAPI, and Supabase. Controlled from a WhatsApp-style mobile Progressive Web App (PWA) with zero build step, dark navy design, and realtime capabilities.

---

## Architecture Overview

- **Backend (`/backend`)**: Python 3.11, FastAPI, uvicorn, httpx, supabase-py, google-genai (Gemini).
  - General brain instructions live **only** in `backend/brain.py`.
  - Background recovery loop recovers stalled or sleeping messages.
  - Meta 24-hour customer window enforcement (error code `131047`).
  - Exponential backoff retry on network errors.
  - Per-contact custom prompt override ("Secret Settings") with highest priority.
  - Autonomous behavioral learning profile generated every 5 inbound messages.
  - HMAC `X-Hub-Signature-256` webhook verification on raw bytes.
- **Database & Auth (`/supabase_schema.sql`)**: Supabase PostgreSQL with Row Level Security and Supabase Auth.
  - `contacts`, `messages`, `settings`, `logs` tables.
  - Single-owner access model enforcing `OWNER_EMAIL`.
- **Frontend (`/frontend`)**: Plain HTML5, CSS3, and ES Modules. No React, no npm, no build step. Deploys cleanly to GitHub Pages via GitHub Actions.

---

## 1. Supabase Setup Guide

1. **Create Project**:
   - Go to [supabase.com](https://supabase.com) and create a new project.
   - Note your database password and choose your nearest region.

2. **Execute Database Schema**:
   - In your Supabase dashboard, click **SQL Editor** on the left menu.
   - Click **New query**, paste the entire contents of `supabase_schema.sql`, and click **Run**.
   - This creates all tables (`contacts`, `messages`, `settings`, `logs`), indexes, check constraints, default settings, and Row Level Security policies.

3. **Retrieve Credentials**:
   - Go to **Project Settings** -> **API**.
   - Copy **Project URL** (`https://<project-ref>.supabase.co`).
   - Copy **service_role secret key** (Used *only* in backend environment variables).
   - Copy **anon public key** (Used in `frontend/js/config.js`).

4. **Create Owner User & Disable Public Sign-ups**:
   - In the Supabase dashboard, navigate to **Authentication** -> **Users**.
   - Click **Add user** -> **Create user**.
   - Enter your personal owner email (e.g., `johnny@example.com`) and a strong password. Confirm email.
   - Navigate to **Authentication** -> **Providers** -> **Email**.
   - **Important**: Toggle OFF **"Allow new users to sign up"**. This prevents unauthorized visitors from registering. Only your owner account can log in.

---

## 2. Meta WhatsApp Cloud API Setup

1. **Create Meta Developer App**:
   - Go to [developers.facebook.com](https://developers.facebook.com) and sign in.
   - Click **Create App** -> Select **Other** -> Select **Business** type.
   - Add the **WhatsApp** product to your app.

2. **Get API Credentials**:
   - In the left sidebar, navigate to **WhatsApp** -> **API Setup**.
   - Note your **Phone number ID** (e.g., `123456789012345`).
   - For permanent production use, create a System User in Meta Business Manager with `whatsapp_business_messaging` permissions and generate a permanent **System User Access Token** (`WA_TOKEN`).
   - Go to **App settings** -> **Basic** and copy your **App Secret** (`WA_APP_SECRET`).

3. **Configure Webhook**:
   - In Meta App Dashboard -> **WhatsApp** -> **Configuration**.
   - Under **Webhook**, click **Edit**:
     - **Callback URL**: `https://<your-render-service>.onrender.com/webhook`
     - **Verify Token**: Enter a secret string of your choice (must match `WA_VERIFY_TOKEN`).
   - Click **Verify and save**.
   - Under **Webhook fields**, click **Manage** and subscribe to `messages`.

---

## 3. Render Backend Deployment

1. **Deploy via Render**:
   - Go to [render.com](https://render.com) and sign in.
   - Click **New +** -> **Blueprint** and connect your GitHub repo (Render reads `render.yaml` automatically).
   - Or click **New +** -> **Web Service**:
     - **Name**: `johnny-tec-ai-reply`
     - **Root Directory**: `backend`
     - **Runtime**: `Python 3`
     - **Build Command**: `pip install -r requirements.txt`
     - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
     - **Health Check Path**: `/health`

2. **Set Environment Variables in Render**:
   | Variable | Value Description |
   |---|---|
   | `GEMINI_API_KEY` | API Key from Google AI Studio |
   | `GEMINI_MODEL` | `gemini-2.5-flash` |
   | `SUPABASE_URL` | Your Supabase Project URL (`https://xyz.supabase.co`) |
   | `SUPABASE_SERVICE_KEY` | Supabase `service_role` key (bypasses RLS) |
   | `OWNER_EMAIL` | The exact email address of your owner account |
   | `WA_TOKEN` | Meta WhatsApp Cloud API Access Token |
   | `WA_PHONE_NUMBER_ID` | WhatsApp Business Phone Number ID |
   | `WA_VERIFY_TOKEN` | Webhook verification secret token created above |
   | `WA_APP_SECRET` | Meta App Secret from App Settings |
   | `WA_API_VERSION` | `v21.0` |
   | `ALLOWED_ORIGIN` | `*` or your GitHub Pages URL |
   | `DRY_RUN` | `true` initially for safe testing, then `false` for live sending |

3. **24/7 Keep-Alive (UptimeRobot)**:
   - To keep Render awake 24/7 on free/starter tiers, create a free monitor on [uptimerobot.com](https://uptimerobot.com):
     - Monitor Type: `HTTP(s)`
     - URL: `https://<your-render-url>/health`
     - Interval: `5 minutes`

---

## 4. GitHub Pages Frontend Deployment

1. **Configure `frontend/js/config.js`**:
   Open `frontend/js/config.js` and update the three configuration values:
   ```javascript
   export const API_BASE_URL = "https://johnny-tec-ai-reply.onrender.com";
   export const SUPABASE_URL = "https://xyzref.supabase.co";
   export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI...";
   ```

2. **Enable GitHub Pages**:
   - Push your code to GitHub.
   - Go to your repository **Settings** -> **Pages**.
   - Under **Build and deployment** -> **Source**, select **GitHub Actions**.
   - The `.github/workflows/deploy-frontend.yml` workflow will automatically deploy `frontend/` to GitHub Pages upon every push to `main`.

3. **Install as Mobile PWA**:
   - Open your deployed GitHub Pages URL on your mobile device (Safari on iOS or Chrome on Android).
   - In Safari: Tap the **Share** button -> Tap **"Add to Home Screen"**.
   - In Chrome: Tap the three dots menu -> Tap **"Install App"** (or click the Install button on the Settings screen).

---

## 5. End-to-End Testing Checklist

1. **Verify Backend Health**:
   - Visit `https://<your-render-service>/health` in your browser.
   - It should return `{"status": "ok", "database": "connected", "bot": "running"}`.

2. **Log In to PWA**:
   - Open your PWA on mobile or desktop.
   - Enter your Supabase Auth owner email and password.
   - You should land directly on the Home dashboard showing real statistics.

3. **Test Webhook Ingestion**:
   - Send a WhatsApp message from a personal phone to your WhatsApp Business number.
   - Open the **Chats** tab in the PWA. The contact should appear in the list with mode set to **Ask** (the default for new senders).

4. **Test Draft Approval ("Ask me first" Mode)**:
   - Tap into the chat. You will see the incoming message on the left and the AI-generated draft in green below it.
   - Tap **Approve & Send**. The reply will be dispatched immediately via the WhatsApp API.
   - Alternatively, tap **Edit** to customize the draft before sending, or **Reject** to discard it.

5. **Test Auto-Reply ("Auto" Mode)**:
   - In the chat header, change the mode selector from **Ask** to **Auto**.
   - Send another message from your phone.
   - The bot will generate a reply and send it automatically within the configured delay.

6. **Test Human Takeover**:
   - In the chat header, tap the `...` menu and tap **Human Takeover**.
   - The blue banner **"You are in control • AI is paused for this contact"** appears.
   - Incoming messages will not trigger any AI draft or reply.
   - Reply manually as Johnny using the composer bar at the bottom.
   - When finished, tap **Return to AI** to restore automated assistance.

7. **Test Secret Settings**:
   - In the chat header, tap the **lock icon**.
   - Enter a custom rule (e.g., *"Reply to Mom with respect, short and warm, call her Mama"*).
   - Tap **Save**.
   - The backend strictly appends this per-contact instruction with highest priority for that contact only.

8. **Test Autonomous Learning**:
   - After 5 incoming messages from the contact, Gemini analyzes the conversation history and updates `contacts.learned_profile` with relationship, writing style, topics, and reply preferences.
   - View the learned memory in the Secret Settings panel.

9. **Switch DRY_RUN to Live**:
   - In Render dashboard, set `DRY_RUN=false` and redeploy.
   - Your bot is now fully live and autonomous on WhatsApp.
