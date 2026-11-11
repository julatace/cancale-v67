// Service worker : (1) rend l'app installable + consultable hors-ligne (PWA) ;
// (2) sert les PDFs bordereaux via une vraie URL HTTPS pour AirPrint.

// ⚠️ v5 (3 octobre) : la v4 gardait les fichiers de TOUS les déploiements —
// mesuré +1,1 Mo par déploiement, jamais purgé (13 à 21 déploiements par jour).
// Changer le nom fait jeter la v4 entière à l'activation, chez tout le monde.
const CACHE = 'vrm-shell-v6';
// La réserve des QR de « Ma journée hors ligne » (src/journeeHorsLigne.js) :
// remplie par la page pendant que le réseau est là, vidée à la déconnexion.
// ⚠️ PAS une version de la coquille : la purge d'activation la garde.
const CACHE_QR = 'vrm-hl-qr';
// Au plus autant de QR dans la réserve (une journée en porte quelques-uns).
const QR_MAX = 60;
// (10 nov., lot J) La photo partagée depuis l'app Photos, le temps que l'app l'ouvre.
// `vrm-hl-` : la purge d'activation la garde, la déconnexion la vide.
const CACHE_PARTAGE = 'vrm-hl-partage';
const CLE_PARTAGE = '/__vrm_partage_photo';
// Repère de la version servie : le nom du script principal de la page.
const REPERE = '/__vrm_build';
const pdfStore = {};

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil((async () => {
  // Purge les anciens caches de coquille lors d'une mise à jour.
  const keys = await caches.keys();
  // (9 nov.) Les réserves du hors connexion (`vrm-hl-*` : les QR, et les bordereaux déjà
  // ouverts — src/bordereauxHorsLigne.js) sont des DONNÉES du vendeur, pas une version de
  // la coquille : la page les remplit et les vide (déconnexion), la mise à jour les garde.
  await Promise.all(keys.filter(k => k !== CACHE && k !== CACHE_QR && !k.startsWith('vrm-hl-')).map(k => caches.delete(k)));
  await clients.claim();
})()));

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'STORE_PDF') {
    pdfStore[event.data.id] = event.data.base64;
    if (event.ports[0]) event.ports[0].postMessage({ ok: true });
  }
});

// ── Une seule version en cache ─────────────────────────────────────────────
// Chaque déploiement renomme ses fichiers (`/assets/index-<hash>.js`). Le cache
// « d'abord » les gardait TOUS : l'ancienne version ne sert plus jamais, elle
// ne fait qu'occuper le téléphone. Quand la page annonce un AUTRE script
// principal, on retire tout `/assets/` qu'elle ne nomme pas. Les morceaux
// chargés plus tard (3D, PDF) de la nouvelle version arrivent APRÈS et restent
// jusqu'au déploiement suivant. Rien à purger si la page est illisible, ou si
// c'est la même version (sinon on jetterait à chaque ouverture les morceaux
// chargés à la demande).
async function purgerAncienneVersion(res) {
  const html = await res.text();
  const noms = html.match(/\/assets\/[A-Za-z0-9._-]+/g) || [];
  const principal = noms.find(n => /\/assets\/index-[^/]+\.js$/.test(n));
  if (!principal) return;
  const cache = await caches.open(CACHE);
  const avant = await cache.match(REPERE);
  if (avant && (await avant.text()) === principal) return;
  const garder = new Set(noms);
  for (const r of await cache.keys()) {
    const p = new URL(r.url).pathname;
    if (p.startsWith('/assets/') && !garder.has(p)) await cache.delete(r);
  }
  await cache.put(REPERE, new Response(principal));
}

// ── La coquille de l'app (11 nov., lot app-installable) ──────────────────────
// Les adresses servies par index.html (l'app et la page d'accueil). Le reste
// (pages statiques) ne touche jamais au cache de la coquille.
function estCoquille(url) {
  return url.origin === self.location.origin && (url.pathname === '/' || url.pathname === '/index.html');
}
// La coquille gardée, seulement si son script principal ET ses feuilles sont en
// cache. Une coquille dont un fichier manque n'est pas servie (écran blanc).
async function coquilleComplete(cache) {
  const res = await cache.match('/');
  if (!res || !res.ok) return null;
  const html = await res.clone().text();
  const noms = (html.match(/\/assets\/[A-Za-z0-9._-]+\.(?:js|css)/g) || []);
  const principal = noms.find(n => /\/assets\/index-[^/]+\.js$/.test(n));
  if (!principal) return null;
  const requis = [principal, ...noms.filter(n => /\.css$/.test(n) && /\/assets\/index-/.test(n))];
  for (const n of new Set(requis)) if (!(await cache.match(n))) return null;
  return res;
}
// Relit la coquille au réseau, sans rien servir : rangée pour la prochaine ouverture.
// Ses fichiers (`/assets/`, immuables) sont rangés AVANT elle : la prochaine
// ouverture est instantanée ET à jour. Un fichier qui manque ⇒ coquille pas rangée.
async function relireCoquille(req, cache) {
  const fresh = await fetch(req.url, { cache: 'no-store', credentials: 'same-origin' });
  if (!fresh || !fresh.ok || fresh.type !== 'basic') return;
  const html = await fresh.clone().text();
  const noms = [...new Set(html.match(/\/assets\/[A-Za-z0-9._-]+\.(?:js|css)/g) || [])].slice(0, 40);
  for (const n of noms) {
    if (await cache.match(n)) continue;
    const r = await fetch(n, { credentials: 'same-origin' });
    if (!r || r.status !== 200 || r.type !== 'basic') return;
    await cache.put(n, r);
  }
  await cache.put('/', fresh);
}

// ── Notifications push (ventes en temps réel, même app fermée) ──
// (5 nov.) Le serveur joint le numéro de l'entrée du centre de notifications
// (`notif`) : ajouté à l'adresse, l'app marque cette entrée lue à l'ouverture.
// Seulement un entier, seulement sur un chemin de l'app.
const avecNotif = (url, n) => {
  const u = String(url || '/');
  if (!Number.isSafeInteger(n) || n <= 0 || !u.startsWith('/')) return u;
  return u + (u.includes('?') ? '&' : '?') + 'notif=' + n;
};
// (8 nov.) La forme vient du serveur (api/_lib/notif-belle.js) : icône de VRM,
// badge MONOCHROME (Android le dessine dans la barre d'état), étiquette par
// genre ou par objet, `renotify` seulement pour un fait nouveau, une action
// (Android, Chrome, Edge ; iOS l'ignore) qui ouvre le même écran que le toucher.
// L'image n'arrive que prouvée (la photo de l'e-mail de CETTE vente).
const cheminApp = (u) => (typeof u === 'string' && u.startsWith('/') && !u.startsWith('//') ? u : '/');
const ICONE_VRM = '/vrm-icon-v5-192.png', BADGE_VRM = '/vrm-badge-96.png';
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'VRM';
  const actions = Array.isArray(data.actions) ? data.actions.filter((x) => x && typeof x.action === 'string' && typeof x.title === 'string').slice(0, 2) : [];
  // Regroupée (`tagGroupe`) : elle prend l'étiquette du genre et ferme celles du
  // même genre déjà affichées (« 3 bordereaux prêts à imprimer » au lieu de trois).
  const tag = typeof data.tagGroupe === 'string' && data.tagGroupe ? data.tagGroupe : (typeof data.tag === 'string' && data.tag ? data.tag : 'vrm');
  const genre = typeof data.genre === 'string' ? data.genre : '';
  const opts = {
    body: data.body || '',
    icon: ICONE_VRM,
    badge: BADGE_VRM,
    tag,
    renotify: data.renotify !== false,   // même étiquette : re-sonne seulement pour un fait nouveau
    timestamp: Date.now(),
    data: {
      genre,
      url: avecNotif(cheminApp(data.url), data.notif),
      actions: Object.fromEntries(actions.map((x) => [x.action, avecNotif(cheminApp(x.url || data.url), data.notif)])),
    },
  };
  if (actions.length) opts.actions = actions.map((x) => ({ action: x.action, title: x.title }));
  if (typeof data.image === 'string' && /^https:\/\/images\d*\.vinted\.net\//.test(data.image)) opts.image = data.image;
  event.waitUntil((async () => {
    if (data.tagGroupe && genre && self.registration.getNotifications) {
      try { for (const n of await self.registration.getNotifications()) if (n.data && n.data.genre === genre) n.close(); } catch (_) {}
    }
    await self.registration.showNotification(title, opts);
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const d = event.notification.data || {};
  const url = (event.action && d.actions && d.actions[event.action]) || d.url || '/';
  // (11 nov., lot avis-negatif) Un lien vers les avis du compte SUR VINTED (et lui seul :
  // la même forme que src/avisNegatif.js, RE_LIEN_AVIS) s'ouvre tel quel, dans une fenêtre
  // à lui — l'app ouverte n'y peut rien (elle ne sait aller que vers ses écrans).
  if (/^https:\/\/www\.vinted\.[a-z]{2,3}(\.[a-z]{2})?\/member\/\d{1,20}\?tab=feedback$/.test(url)) { event.waitUntil(clients.openWindow(url)); return; }
  event.waitUntil((async () => {
    // (11 nov., lot app-installable) Seule une fenêtre de L'APP (la coquille `/`)
    // sait sauter d'écran : une page statique ouverte (aide, CGU, statut) ne
    // l'entend pas. La plus récemment vue d'abord. Aucune ⇒ l'app s'ouvre sur
    // l'adresse (l'app installée sur iPhone et Android, l'onglet ailleurs).
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const app = all.filter((c) => { try { return estCoquille(new URL(c.url)); } catch (_) { return false; } })
      .sort((a, b) => (b.focused - a.focused) || ((b.visibilityState === 'visible') - (a.visibilityState === 'visible')));
    for (const c of app) {
      try { if ('focus' in c) await c.focus(); } catch (_) {}
      // App déjà ouverte : on lui dit vers quel onglet sauter.
      try { c.postMessage({ type: 'open-url', url }); return; } catch (_) {}
    }
    await clients.openWindow(url);
  })());
});

// ── ⚠️ RENOUVELLEMENT AUTO DE L'ABONNEMENT PUSH ──────────────────────────────
// Apple/Chrome font TOURNER le jeton d'abonnement (« subscription ») de temps en
// temps. Sans écouter cet événement, l'ancien jeton devient muet et les
// notifications s'arrêtent SANS erreur visible — c'est exactement le « je reçois
// plus de notif » de Julien. Ici on se ré-abonne tout seul et on renvoie le
// nouveau jeton au serveur.
// ⚠️ ÉGALE à src/vapid.js et à api/_lib/push.js (audit-vapid.cjs) : un
// service worker ne peut pas importer un module de l'app.
const VAPID_PUBLIC = 'BIImaPEF-sZb0ohfXGjjR2eKYVVAyz1I3-fYXNlsSUrTQfGM4le_OxJbUML2YyL5ctFea-LS7NfPD9RotDJ0bbc';
function vapidKey(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const s = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(s); const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    try {
      const sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey(VAPID_PUBLIC) });
      await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'subscribe', sub: sub.toJSON() }) });
    } catch (_) { /* ré-abonnement impossible : l'app le refera à la prochaine ouverture */ }
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

  // 1 bis) Les QR de Ma journée hors ligne : `/hl-qr?u=<adresse>`. La réserve
  //    d'abord (c'est hors ligne qu'on les demande) ; sinon le réseau, sans
  //    cookie ni référent. Rien ⇒ 404 : la page dit « donne le code ».
  //    ⚠️⚠️ (22 oct., revue) SEULEMENT CE QUE LA PAGE DE VRM DEMANDE. Une
  //    NAVIGATION vers `/hl-qr?u=…` (un lien ou une redirection posés par
  //    n'importe quel site) faisait aller chercher ET RANGER durablement
  //    n'importe quelle adresse, de n'importe quelle taille, dans le stockage
  //    de vrm.center. Une navigation n'est jamais un QR : 404, rien n'est
  //    demandé, rien n'est rangé. Le reste ne passe que pour une IMAGE (le QR
  //    affiché hors ligne) ou la mise en réserve de `rechaufferQr` (en-tête
  //    `x-vrm-hl-qr`) ; et la réserve garde au plus `QR_MAX` entrées (les plus
  //    anciennes partent d'abord).
  if (url.pathname === '/hl-qr') {
    event.respondWith((async () => {
      try {
        if (req.mode === 'navigate') return new Response('', { status: 404 });
        const c = await caches.open(CACHE_QR);
        const hit = await c.match(req);
        if (hit) return hit;
        const demandeDeVrm = req.destination === 'image' || req.headers.get('x-vrm-hl-qr') === '1';
        const u = url.searchParams.get('u') || '';
        if (demandeDeVrm && /^https:\/\//i.test(u)) {
          const res = await fetch(u, { mode: 'no-cors', credentials: 'omit', referrerPolicy: 'no-referrer' });
          // (22 oct.) C'est ICI que le QR entre dans la réserve : la page ne va
          // plus le chercher elle-même. Sa politique de sécurité du contenu
          // (connect-src, vercel.json) refuserait les hôtes des transporteurs —
          // ils changent ; ce fichier-ci n'est pas sous
          // cette politique (vercel.json l'exclut, `/((?!sw\.js).*)`).
          if (res && (res.ok || res.type === 'opaque')) {
            try {
              await c.put(req, res.clone());
              const cles = await c.keys();
              for (const k of cles.slice(0, Math.max(0, cles.length - QR_MAX))) await c.delete(k);
            } catch (_) {}
          }
          return res;
        }
      } catch (_) {}
      return new Response('', { status: 404 });
    })());
    return;
  }

  // 1 ter) (10 nov., lot J) PARTAGER UNE PHOTO VERS VRM (`share_target` du manifeste) :
  //    l'app Photos envoie la photo en POST ici. Rien n'est écrit en base : la photo
  //    attend dans la réserve de l'appareil (`CACHE_PARTAGE`, une seule, 15 Mo au plus,
  //    une image seulement) et l'app ouvre « Nouvel achat » avec elle
  //    (`?tab=achats&achat=1&photo=partage`, src/partagePhoto.js) ; l'app la retire dès
  //    qu'elle l'a lue. Pas d'image ⇒ « Nouvel achat » sans photo.
  if (url.pathname === '/partage-achat' && req.method === 'POST') {
    event.respondWith((async () => {
      let ok = false;
      try {
        const fd = await req.formData();
        const f = fd.getAll('photo').find((x) => x && typeof x === 'object' && /^image\//.test(x.type || '') && x.size > 0 && x.size <= 15 * 1024 * 1024);
        if (f) {
          const c = await caches.open(CACHE_PARTAGE);
          await c.put(CLE_PARTAGE, new Response(f, { headers: { 'content-type': f.type, 'x-vrm-partage-at': String(Date.now()) } }));
          ok = true;
        }
      } catch (_) {}
      return Response.redirect(new URL('/?tab=achats&achat=1' + (ok ? '&photo=partage' : ''), self.location.origin).href, 303);
    })());
    return;
  }

  // ⚠️ JAMAIS DE CACHE SUR /api/. Ces routes répondent à des questions dont la
  // réponse change (la clé IA est-elle configurée ? les chiffres du widget) :
  // mises en cache par la règle 3 ci-dessous — même origine, GET, non-navigation
  // — elles seraient figées pour toujours sur leur première réponse.
  if (url.pathname.startsWith('/api/')) return;
  // Ne jamais mettre un lien de récupération en cache ni le remplacer par la coque privée.
  if (url.pathname === '/recuperation.html' || url.pathname.startsWith('/recuperation.')) return;
  // (6 nov.) La page d'état publique (/etat, public/etat.html) : une vraie page
  // statique — la navigation ci-dessous la rangerait sous « / » à la place de
  // l'app (comme les pages légales). Elle va au réseau, sans cache : un état
  // gardé en cache dirait « Tout fonctionne » d'hier.
  if (url.pathname === '/etat' || url.pathname.startsWith('/etat.') || url.pathname === '/etat-version.json') return;
  // (8 nov.) Le centre d'aide (/aide, public/aide/) : des pages statiques, au réseau —
  // sinon la navigation les rangerait sous « / » et ouvrirait l'app à leur place.
  if (url.pathname === '/aide' || url.pathname.startsWith('/aide/')) return;

  // On ne gère que le GET même origine ; le reste (POST, cross-origin) au réseau.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // ⚠️ Les pages légales (/legal/*.html) sont de vraies pages statiques : la
  // navigation ci-dessous range la réponse sous « / » — ouvrir les CGU aurait
  // remplacé l'app en cache par les CGU. Elles vont au réseau, sans cache.
  if (url.pathname.startsWith('/legal/')) return;

  // 2) Navigation.
  //    (11 nov., lot app-installable) Seule la COQUILLE de l'app (`/`, `/index.html`)
  //    est rangée sous « / ». Une autre page statique (`/statut`, `/f/…`,
  //    `/extension-retour.html`…) passait par ici et REMPLAÇAIT l'app en cache :
  //    elle va au réseau, comme les pages légales.
  if (req.mode === 'navigate' && !estCoquille(url)) return;
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      // (11 nov.) OUVERTURE INSTANTANÉE au 2e lancement : la coquille gardée est
      // servie tout de suite, SI tous ses fichiers sont là (sinon : page blanche hors
      // ligne). Le réseau la relit derrière : la suivante est la nouvelle version, et
      // la page propose « Mettre à jour » (src/miseAJour.js). Les DONNÉES ne passent
      // jamais par ici (Supabase, /api/ : réseau), elles sont relues par l'app.
      // Un rechargement demandé (`location.reload`, « Mettre à jour ») va au réseau.
      const voulueFraiche = req.cache === 'reload' || req.cache === 'no-cache' || req.cache === 'no-store';
      const gardee = voulueFraiche ? null : await coquilleComplete(cache);
      if (gardee) {
        event.waitUntil(relireCoquille(req, cache).catch(() => {}));
        event.waitUntil(purgerAncienneVersion(gardee.clone()).catch(() => {}));
        return gardee;
      }
      try {
        const fresh = await fetch(req);
        if (fresh.ok) {
          cache.put('/', fresh.clone()).catch(() => {});
          event.waitUntil(purgerAncienneVersion(fresh.clone()).catch(() => {}));
        }
        return fresh;
      } catch (_) {
        const cached = (await cache.match('/')) || (await cache.match(req));
        if (cached) return cached;
        // ⚠️⚠️ JAMAIS `Response.error()` SUR UNE NAVIGATION. Mesuré chez Julien :
        // sur Edge, ça affichait « impossible d'ouvrir cette page » de façon
        // COLLANTE — le service worker brickait l'onglet, et l'app ne s'ouvrait
        // plus JAMAIS sur ce navigateur (elle marchait sur Chrome). Un secours
        // qui rend l'app inaccessible est pire que pas de secours. On renvoie
        // une petite page qui explique et propose de réessayer — jamais un
        // cul-de-sac. Elle réessaie une fois toute seule, sans boucler.
        return new Response(
          '<!doctype html><html lang="fr"><head><meta charset="utf-8">' +
          '<meta name="viewport" content="width=device-width,initial-scale=1">' +
          '<title>VRM</title></head>' +
          '<body style="margin:0;font-family:system-ui,-apple-system,sans-serif;background:#f6f7f9;color:#14181d;display:flex;min-height:100vh;align-items:center;justify-content:center">' +
          '<div style="max-width:360px;padding:24px;text-align:center">' +
          '<div style="font-size:17px;font-weight:700;margin-bottom:8px">Connexion en cours…</div>' +
          '<div style="font-size:13px;color:#5b6675;line-height:1.5;margin-bottom:16px">La page n\'a pas pu se charger. Tes données sont intactes.</div>' +
          '<button onclick="location.reload()" style="border:none;background:#14181d;color:#fff;border-radius:10px;padding:11px 18px;font-size:14px;font-weight:600;cursor:pointer">Réessayer</button>' +
          '<script>setTimeout(function(){location.reload()},4000)</script>' +
          '</div></body></html>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
    })());
    return;
  }

  // 3) Fichiers du build (`/assets/`, hashés donc immuables) : cache d'abord.
  //    ⚠️ SEULEMENT eux. Tout le reste (le zip de l'extension, les logos, le
  //    manifeste) garde le MÊME nom d'un déploiement à l'autre : servi « cache
  //    d'abord », il restait figé pour toujours sur sa première version — le
  //    lien « Télécharger l'extension » sans `?v=` rendait l'ANCIEN zip, le
  //    défaut le plus coûteux du projet (§ zip). Ceux-là : réseau d'abord,
  //    cache en secours (hors-ligne).
  const immuable = url.pathname.startsWith('/assets/');
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    if (hit && immuable) return hit;
    try {
      const res = await fetch(req);
      // ⚠️ Une adresse AVEC paramètres n'entre pas dans le cache : la vérification
      // de version (`/?_v=<horodatage>`, main.jsx, chaque minute) y laissait une
      // copie de la page à chaque fois, jamais relue ni purgée.
      if (res && res.status === 200 && res.type === 'basic' && !url.search) cache.put(req, res.clone()).catch(() => {});
      return res;
    } catch (_) {
      return hit || Response.error();
    }
  })());
});
