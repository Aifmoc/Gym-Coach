// Gym Coach v21 · Service Worker
// Offline-first para assets. Las notificaciones de descanso son best-effort:
// Android/Chrome puede suspender el service worker con la pantalla bloqueada.

const CACHE = 'gym-coach-v21-20260909';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS).catch(() => {})));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
      self.clients.claim(),
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Para navegación/index priorizamos red para que un push de GitHub Pages no quede atrapado en caché antigua.
  if (req.mode === 'navigate' || new URL(req.url).pathname.endsWith('/index.html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

let restTimer = null;
let restDueAt = 0;

function showRestNotification(data = {}) {
  return self.registration.showNotification(data.title || 'Descanso terminado', {
    body: data.body || 'Toca para volver a la serie.',
    tag: 'gym-rest',
    renotify: true,
    vibrate: [400, 180, 400, 180, 700],
    silent: false,
    requireInteraction: true,
    data: { kind: 'gym-rest' },
  });
}

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'schedule-rest') {
    clearTimeout(restTimer);
    restDueAt = Math.max(Date.now(), +data.dueAt || (Date.now() + Math.max(0, +data.ms || 0)));
    const delay = Math.max(0, restDueAt - Date.now());

    // setTimeout dentro de un SW NO es garantía con Android dormido; es solo el mejor fallback web disponible.
    restTimer = setTimeout(() => {
      showRestNotification(data).catch(() => {});
      restDueAt = 0;
    }, delay);
  }

  if (data.type === 'cancel-rest') {
    clearTimeout(restTimer);
    restTimer = null;
    restDueAt = 0;
    self.registration.getNotifications({ tag: 'gym-rest' })
      .then((ns) => ns.forEach((n) => n.close()))
      .catch(() => {});
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});
