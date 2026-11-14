require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC — L'ACCUEIL DES NOUVEAUX, LE RESTE (14 nov., idées 133 134 136 139 140 143
//  145 147) : une vendeuse NEUVE (compte VRM créé il y a 2 jours, en essai Pro), une
//  boutique Vinted INVENTÉE (aucune fixture, aucune donnée réelle — dépôt public),
//  servie par _minipgrest. Rendu à 390 tactile et 1512, clair et sombre.
//   A  « J'ai déjà mes N° sur mes cartons » (134) : 8 annonces, 6 portent un N° écrit
//      (dont N° 12 sur DEUX annonces). AUCUN N° neuf n'est donné tant qu'elle n'a pas
//      répondu ; la carte montre les N° lus, le 12 en ROUGE (deux annonces), « Oui »
//      adopte les N° lus PAR ANNONCE (identifiant), jamais le 12, jamais un N° neuf ;
//   B  « Ce que VRM a trouvé chez toi » (133) : une seule liste, chaque ligne avec SON
//      geste, les nombres = ceux que les écrans publient ; « C'est noté » la range ;
//   C  le conseil du jour (140) en BAS de Ma journée (sous tout geste), « × » le range
//      pour aujourd'hui ; coupé dans Paramètres ⇒ plus rien ;
//   D  la visite d'un écran (136) : des bulles sur les boutons réels, « Passer » la
//      range, rejouable depuis le « ? » ; jamais au départ quand un geste urgent est là ;
//   E  le mini-glossaire (139) : toucher « à retirer » l'explique en une phrase ;
//   F  ton essai (145) : colis suivis, bordereaux imprimés, temps « estimé » avec sa
//      règle, jours restants ; l'appel de bienvenue (147) pour un compte Pro, absent
//      sans lien ; G  « Continuer avec Apple » (143) absent tant que Supabase ne
//      l'active pas, présent quand il l'est.
//  Chaque fois : aucune erreur JS, rien ne déborde, cibles ≥ 44 px au doigt.
//  `SHOTS=dossier` range les captures (à REGARDER, §6.2) ; `LARGEURS`, `THEMES`,
//  `SCENARIOS` restreignent ; `BANC_DIST` choisit le build (origin/main ⇒ rouge).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const { metaVersData } = require('./_meta.cjs');
const { servir } = require('./_minipgrest.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 10000 + Math.floor(Math.random() * 20000);
const SHOTS = process.env.SHOTS || '';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.vtt': 'text/vtt', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const UID = '7a1e0c55-2b1d-4c3e-9f00-00000000a133';
const VUID = '4100000001';
const iso = (j) => new Date(Date.now() - j * 86400000).toISOString();
const SESSION = { access_token: 'jeton-accueil-reste', refresh_token: 'r', totp: [], expires_at: Date.now() + 3600e3, user: { id: UID, email: 'nouvelle.vendeuse@exemple.test', created_at: iso(2), totp: [] } };

// ── LA BOUTIQUE INVENTÉE ─────────────────────────────────────────────────────
const ann = (id, title, heures, numEcrit) => ({ id, title, price: { amount: '49.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false, photo: null, brand_title: 'Nike', size_title: '42', size: '42', status: 'Très bon état', view_count: 3, favourite_count: 1, created_at_ts: Math.floor((Date.now() - heures * 3600e3) / 1000), descLen: 60, ...(numEcrit ? { numEcrit } : {}) });
const lu = (cle) => ({ etat: 'lu', cle, brut: 'N° ' + cle });
function baseNeuve({ ecritChoisi = false, poolPlein = false, sansEcrit = false, abo = {}, auth = {} } = {}) {
  const items = sansEcrit ? [ann(9001, 'Nike Air Max 90 blanc', 30), ann(9002, 'Nike Dunk Low Panda', 20), ann(9003, 'Adidas Samba OG', 10)] : [
    ann(9001, 'Nike Air Max 90 blanc', 30, lu('12')),
    ann(9002, 'Nike Air Max 90 blanc', 29, lu('12')),     // le même N° écrit sur DEUX annonces : rouge, rien adopté
    ann(9003, 'Adidas Samba OG noir', 28, lu('4')),
    ann(9004, 'New Balance 550 vert', 27, lu('5')),
    ann(9005, 'Salomon XT-6 gris', 26, lu('9')),
    ann(9006, 'Asics Gel-1130 argent', 25, { etat: 'rien', raison: 'aucun N° écrit' }),
    ann(9007, 'Vans Old Skool noir', 24, { etat: 'ambigu', cles: ['3', '8'], raison: 'deux numéros' }),
    ann(9008, 'Nike Air Force 1', 23, lu('B7')),
  ];
  const ventes = [
    { transaction_id: 51001, title: 'Adidas Gazelle bleu', price: { amount: '55.0', currency_code: 'EUR' }, status: 'Le paiement a été validé', date: iso(4), item_id: 8001, transaction_user_status: 'needs_action', photo: null },
    { transaction_id: 51002, title: 'Nike Cortez blanc', price: { amount: '40.0', currency_code: 'EUR' }, status: 'Commande finalisée', date: iso(9), item_id: 8002, transaction_user_status: 'completed', photo: null },
  ];
  const main = { vrm_bienvenue_vue: { at: 'banc' }, vrm_visite_vue: { at: 'banc' }, vrm_configuration: { etat: 'fait', at: iso(1), version: 99 }, vrm_je_vends: { choix: 'sneakers', categories: ['sneakers'], at: iso(1), vu: iso(1) }, vrm_plateformes_affichees: { sites: ['vinted'], at: iso(1) }, vrm_parcours: { v: 1, etape: null, ouvert: false, fini: iso(1), at: iso(1) },
    vinted_bords_printed: { 51001: iso(1) },
    ...(ecritChoisi ? { vrm_numero_ecrit: { actif: false, depuis: iso(1), choisi: iso(1) } } : {}),
    ...(poolPlein ? { vinted_used_numeros: ['1', '2'], vinted_annonce_numeros: { 7001: { numero: '1', auto: true } } } : {}) };
  return {
    comptes: [{ id: 1, vinted_user_id: VUID, login: 'nouvelle_boutique', domain: 'www.vinted.fr', updated_at: iso(0), created_at: iso(2) }],
    abo: { ok: true, proprietaire: false, acces: true, actif: true, statut: 'trialing', finEssai: new Date(Date.now() + 5 * 86400000).toISOString(), plan: 'pro', appelBienvenue: 'https://rendez-vous.exemple.test/julien/15-minutes', ...abo },
    auth: { external: { google: true, discord: true, apple: false, email: true }, mailer_autoconfirm: true, ...auth },
    lignes: [
      { id: 'main', data: main },
      { id: `harvest_${VUID}_listings`, data: { capturedAt: iso(0.001), nItems: items.length, payload: { items, pagination: { total_entries: items.length } } } },
      { id: `harvest_${VUID}_enligne`, data: { capturedAt: iso(0.001), complet: true, n: items.length, ids: items.map((x) => x.id), items: items.map((x) => ({ id: x.id, title: x.title })) } },
      { id: `harvest_${VUID}_orders_sold`, data: { capturedAt: iso(0.002), nItems: ventes.length, payload: { my_orders: ventes }, resume: { n: ventes.length, at: Date.now() - 120e3, txns: ['51001'], dates: { 51001: ventes[0].date } } } },
      { id: `harvest_${VUID}_orders_purchased`, data: { capturedAt: iso(0.002), nItems: 0, payload: { my_orders: [] }, resume: { n: 0, at: Date.now() - 120e3, txns: [] } } },
      { id: `harvest_${VUID}_profile`, data: { capturedAt: iso(0.001), payload: { user: { id: Number(VUID), login: 'nouvelle_boutique', feedback_reputation: 1 } } } },
      { id: 'email_track_mondialrelay_31415926', data: { carrier: 'mondialrelay', suivi: '31415926', status: 'transit', sens: 'sortant', receivedAt: iso(1) } },
      { id: 'email_track_vinted_VGS2718281828459', data: { carrier: 'vinted', suivi: 'VGS2718281828459', status: 'available', receivedAt: iso(0.5) } },
      { id: 'email_bord_51001', data: { filename: 'b-51001.pdf', transaction: '51001', receivedAt: iso(3.5), suivi: '31415926', account: 'nouvelle_boutique', dateLimite: iso(0.5) } },
    ],
  };
}

function serveur() {
  const srv = http.createServer((q, r) => {
    let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
    const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
  });
  return new Promise((ok) => srv.listen(PORT, () => ok(srv)));
}

async function ouvrir(nav, { W, sombre, base, tab = 'journee', chemin = null }) {
  const tel = W < 600;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } }), colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  const journal = { erreurs: [], ecrits: [] };
  pg.on('pageerror', (e) => journal.erreurs.push(String(e.message || e).slice(0, 240)));
  await pg.addInitScript(([s, sombre]) => {
    try {
      if (!sessionStorage.getItem('banc_init')) {
        localStorage.setItem('vrm_session', JSON.stringify(s));
        localStorage.setItem('vrm_local_owner', s.user.id);
        localStorage.setItem('vinted_dark', sombre ? 'true' : 'false');
        localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'banc' }));
        localStorage.setItem('vrm_visite_vue', JSON.stringify({ at: 'banc' }));
        sessionStorage.setItem('banc_init', '1');
      }
    } catch (_) {}
  }, [SESSION, sombre]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await pg.route('**/auth/v1/**', (r) => {
    if (/\/auth\/v1\/settings/.test(r.request().url())) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(base.auth) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: SESSION.access_token, refresh_token: 'r', expires_in: 3600, user: SESSION.user }) });
  });
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request(), m = req.method();
    const u = decodeURIComponent(metaVersData(req.url()));
    const json = (d, st = 200, rg) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': rg || `0-${Math.max(0, (Array.isArray(d) ? d.length : 1) - 1)}/${Array.isArray(d) ? d.length : 1}` }, body: JSON.stringify(d) });
    if (/\/rest\/v1\/rpc\//.test(u)) return json(null);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return json(m === 'GET' ? base.comptes : []);
    if (!/\/rest\/v1\/app_data/.test(u)) return json([]);
    if (m === 'POST' || m === 'PATCH') {
      try {
        const b = JSON.parse(req.postData() || 'null');
        const rows = Array.isArray(b) ? b : b && b.id ? [b] : [];
        const eqm = /[?&]id=eq\.([^&]*)/.exec(u);
        if (m === 'PATCH' && eqm && b && b.data) rows.push({ id: eqm[1], data: b.data });
        for (const r of rows) {
          if (!r || !r.id) continue;
          journal.ecrits.push({ id: r.id, data: r.data });
          const i = base.lignes.findIndex((x) => x.id === r.id);
          const data = r.id === 'main' && i >= 0 ? { ...base.lignes[i].data, ...r.data } : r.data;
          const l = { id: r.id, owner: UID, updated_at: iso(0), data };
          if (i >= 0) base.lignes[i] = l; else base.lignes.push(l);
        }
      } catch (_) {}
      return json(m === 'PATCH' ? [{ id: 'main' }] : [], m === 'POST' ? 201 : 200);
    }
    if (m === 'DELETE') return json([]);
    const lignes = base.lignes.map((l) => ({ owner: UID, updated_at: iso(0), ...l }));
    const r = servir(lignes, u, req.headers());
    return json(r.body, 200, r.range);
  });
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/mode=abonnement/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(base.abo) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await pg.goto(`http://localhost:${PORT}${chemin || `/?tab=${tab}`}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main, [data-accueil]', { timeout: 25000 }).catch(() => {});
  return { ctx, pg, journal, tel };
}

const ligneMain = (base) => (base.lignes.find((l) => l.id === 'main') || {}).data || {};
module.exports = { baseNeuve, serveur, ouvrir, ligneMain, UID, VUID, SESSION, PORT };
if (require.main !== module) return;
