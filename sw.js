// Gym Coach · Service Worker
// Gestiona el cacheo básico para uso offline y las notificaciones de descanso
// programadas, que funcionan aunque el usuario salga de la app.

const CACHE = 'gym-coach-v21';
const ASSETS = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Cache-first para funcionamiento offline; red como respaldo.
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request).catch(() => r))
  );
});

// --- Notificaciones de descanso ---
// El cliente manda { type:'schedule-rest', ms, title, body } y el SW
// dispara la notificación al cabo de ms milisegundos. Como el SW vive
// fuera de la pestaña, Android puede despertarlo aunque estés en otra app.

let restTimer = null;

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'schedule-rest') {
    clearTimeout(restTimer);
    const ms = Math.max(0, +data.ms || 0);
    restTimer = setTimeout(() => {
      self.registration.showNotification(data.title || 'Descanso terminado', {
        body: data.body || 'Toca para volver a la serie.',
        tag: 'gym-rest',
        renotify: true,
        vibrate: [280, 120, 280, 120, 500],
        silent: false,
      });
    }, ms);
  } else if (data.type === 'cancel-rest') {
    clearTimeout(restTimer);
    restTimer = null;
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});
