// AgroTrade Service Worker
// Handles caching, offline support, and push notifications

const CACHE_NAME = 'agrotrade-v1';
const OFFLINE_URL = '/agrotrade/';

// Files to cache for offline use
const PRECACHE_URLS = [
  '/agrotrade/',
  '/agrotrade/index.html',
  '/agrotrade/manifest.json',
  '/agrotrade/icons/icon-192.png',
  '/agrotrade/icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js',
];

// ===== INSTALL =====
self.addEventListener('install', event => {
  console.log('[SW] Installing AgroTrade Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching app shell');
      return cache.addAll(PRECACHE_URLS.filter(url => !url.startsWith('http')));
    }).then(() => self.skipWaiting())
  );
});

// ===== ACTIVATE =====
self.addEventListener('activate', event => {
  console.log('[SW] Activating AgroTrade Service Worker...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ===== FETCH =====
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip Firebase requests - always go network for data
  if (url.hostname.includes('firebase') || url.hostname.includes('firebaseio')) {
    return;
  }

  // Network first for HTML pages
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(OFFLINE_URL);
      })
    );
    return;
  }

  // Cache first for static assets (fonts, icons, CSS, JS)
  if (
    url.hostname.includes('fonts.googleapis') ||
    url.hostname.includes('fonts.gstatic') ||
    url.hostname.includes('gstatic.com') ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.destination === 'style' ||
    request.destination === 'script'
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (!response || response.status !== 200) return response;
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
          return response;
        });
      })
    );
    return;
  }
});

// ===== PUSH NOTIFICATIONS =====
self.addEventListener('push', event => {
  if (!event.data) return;
  
  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'AgroTrade', body: event.data.text() };
  }

  const options = {
    body: data.body || 'You have a new notification',
    icon: '/agrotrade/icons/icon-192.png',
    badge: '/agrotrade/icons/icon-72.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/agrotrade/' },
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'AgroTrade', options)
  );
});

// ===== NOTIFICATION CLICK =====
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/agrotrade/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('/agrotrade/') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ===== BACKGROUND SYNC =====
self.addEventListener('sync', event => {
  if (event.tag === 'sync-orders') {
    console.log('[SW] Background sync: orders');
  }
});

console.log('[SW] AgroTrade Service Worker loaded v1');
