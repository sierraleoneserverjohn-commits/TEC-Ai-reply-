// ==============================================================================
// Johnny TEC AI Reply - Service Worker (App Shell Cache)
// Never intercepts or caches dynamic API or Webhook requests.
// ==============================================================================

const CACHE_NAME = 'jt-v3-shell-v1';

const APP_SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/config.js',
  './js/supabase.js',
  './js/api.js',
  './js/app.js',
  './js/ui.js',
  './js/screens/splash.js',
  './js/screens/setup.js',
  './js/screens/login.js',
  './js/screens/home.js',
  './js/screens/chats.js',
  './js/screens/chat.js',
  './js/screens/contact-settings.js',
  './js/screens/settings.js',
  './js/screens/whatsapp-connection.js',
  './js/screens/ai-settings.js',
  './js/screens/conversation-logs.js',
  './js/screens/error-logs.js',
  './js/screens/human-takeover.js',
  './js/screens/profile.js',
  './icons/logo.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // STRICT RULE: Never intercept or cache API, Webhook, Health, or Auth calls
  if (
    url.pathname.includes('/api/') ||
    url.pathname.includes('/webhook') ||
    url.pathname.includes('/health') ||
    url.hostname.includes('supabase.co') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((netRes) => {
        if (netRes && netRes.status === 200) {
          const clone = netRes.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        }
        return netRes;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
