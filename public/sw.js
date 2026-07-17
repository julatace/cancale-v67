// Service worker : (1) rend l'app installable + consultable hors-ligne (PWA) ;
// (2) sert les PDFs bordereaux via une vraie URL HTTPS pour AirPrint.

const CACHE = 'vrm-shell-v2';
const pdfStore = {};

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil((async () => {
  // Purge les anciens caches de coquille lors d'une mise à jour.
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
  await clients.claim();
})()));

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'STORE_PDF') {
    pdfStore[event.data.id] = event.data.base64;
    if (event.ports[0]) event.ports[0].postMessage({ ok: true });
  }
});

// ── Notifications push (ventes en temps réel, même app fermée) ──
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'VRM';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'vrm',
    data: { url: data.url || '/' },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if ('focus' in c) {
        await c.focus();
        // App déjà ouverte : on lui dit vers quel onglet sauter.
        try { c.postMessage({ type: 'open-url', url }); } catch (_) {}
        return;
      }
    }
    await clients.openWindow(url);
  })());
});

// Stratégie réseau :
//  - /print-pdf/{id} : servi depuis la mémoire (bordereaux AirPrint).
//  - navigation (chargement de la page) : réseau d'abord, cache en secours
//    (permet d'ouvrir l'app hors-ligne avec le dernier écran connu).
//  - assets même origine (JS/CSS/images du build) : cache d'abord, réseau sinon,
//    et on met en cache au passage. On ne touche JAMAIS aux appels Supabase /
//    Vinted / proxy (cross-origin) : ils passent directement au réseau, pour ne
//    pas servir de données périmées.
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) Bordereaux PDF en mémoire.
  if (url.pathname.startsWith('/print-pdf/')) {
    const id = url.pathname.slice('/print-pdf/'.length);
    const base64 = pdfStore[id];
    if (base64) {
      event.respondWith((async () => {
        const bin = atob(base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new Response(bytes, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Length': String(bytes.length),
            'Content-Disposition': 'inline; filename="bordereau.pdf"',
          },
        });
      })());
    }
    return;
  }

  // On ne gère que le GET même origine ; le reste (POST, cross-origin) au réseau.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // 2) Navigation : réseau d'abord, secours cache.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put('/', fresh.clone()).catch(() => {});
        return fresh;
      } catch (_) {
        const cache = await caches.open(CACHE);
        return (await cache.match('/')) || (await cache.match(req)) || Response.error();
      }
    })());
    return;
  }

  // 3) Assets du build (immuables, hashés) : cache d'abord.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone()).catch(() => {});
      return res;
    } catch (_) {
      return hit || Response.error();
    }
  })());
});
