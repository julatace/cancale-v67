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
function baseNeuve({ ecritActif = false, ecritChoisi = false, poolPlein = false, sansEcrit = false, abo = {}, auth = {}, visites = false, aides = null } = {}) {
  const items = sansEcrit ? [ann(9001, 'Nike Air Max 90 blanc', 30), ann(9002, 'Nike Dunk Low Panda', 20), ann(9003, 'Adidas Samba OG', 10)] : [
    ann(9001, 'Nike Air Max 90 blanc', 30, lu('12')),
    ann(9002, 'Nike Air Max 90 blanc', 29, lu('12')),     // le même N° écrit sur DEUX annonces : rouge, rien adopté
    ann(9003, 'Adidas Samba OG noir', 28, lu('4')),
    ann(9004, 'New Balance 550 vert', 27, lu('5')),
    ann(9005, 'Salomon XT-6 gris', 26, lu('9')),
    ann(9006, 'Asics Gel-1130 argent', 25, { etat: 'rien', raison: 'aucun N° écrit' }),
    ann(9007, 'Vans Old Skool noir', 24, { etat: 'ambigu', cles: ['3', '8'], raison: 'deux numéros' }),
    ann(9008, 'Nike Air Force 1', 23, lu('15')),
  ];
  const ventes = [
    { transaction_id: 51001, title: 'Adidas Gazelle bleu', price: { amount: '55.0', currency_code: 'EUR' }, status: 'Le paiement a été validé', date: iso(4), item_id: 8001, transaction_user_status: 'needs_action', photo: null },
    { transaction_id: 51002, title: 'Nike Cortez blanc', price: { amount: '40.0', currency_code: 'EUR' }, status: 'Commande finalisée', date: iso(9), item_id: 8002, transaction_user_status: 'completed', photo: null },
  ];
  const main = { vrm_bienvenue_vue: { at: 'banc' }, vrm_visite_vue: { at: 'banc' }, vrm_configuration: { etat: 'fait', at: iso(1), version: 99 }, vrm_je_vends: { choix: 'sneakers', categories: ['sneakers'], at: iso(1), vu: iso(1) }, vrm_plateformes_affichees: { sites: ['vinted'], at: iso(1) }, vrm_parcours: { v: 1, etape: null, ouvert: false, fini: iso(1), at: iso(1) },
    vinted_bords_printed: { 51001: iso(1) },
    // Les visites des écrans déjà vues (sauf le scénario D, qui les joue).
    ...(visites ? {} : { vrm_aides_accueil: { v: 1, off: {}, vues: { journee: iso(1), annonces: iso(1), ventes: iso(1), achats: iso(1) }, ...(aides || {}) } }),
    ...(ecritChoisi || ecritActif ? { vrm_numero_ecrit: { actif: ecritActif, depuis: iso(1), choisi: iso(1) } } : {}),
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

async function ouvrir(nav, { W, sombre, base, tab = 'journee', chemin = null, sansSession = false }) {
  const tel = W < 600;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } }), colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  const journal = { erreurs: [], ecrits: [] };
  pg.on('pageerror', (e) => journal.erreurs.push(String(e.message || e).slice(0, 240)));
  await pg.addInitScript(([s, sombre, sansSession]) => {
    try {
      if (!sessionStorage.getItem('banc_init')) {
        if (!sansSession) { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', s.user.id); }
        localStorage.setItem('vinted_dark', sombre ? 'true' : 'false');
        localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'banc' }));
        localStorage.setItem('vrm_visite_vue', JSON.stringify({ at: 'banc' }));
        sessionStorage.setItem('banc_init', '1');
      }
    } catch (_) {}
  }, [SESSION, sombre, sansSession]);
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

// ── LES SCÉNARIOS ────────────────────────────────────────────────────────────
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const SCENARIOS = liste('SCENARIOS', 'A,B,C,D,E,F,G');
let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det !== undefined ? ' — ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 400) : ''}`); };
const attendre = async (pg, f, ms = 9000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await f()) return true; } catch (_) {} await pg.waitForTimeout(250); } return false; };
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
async function capture(pg, nom) { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.waitForTimeout(350); try { await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), timeout: 60000, animations: 'disabled' }); } catch (e) { console.log('    (capture ' + nom + ' manquée : ' + String(e.message).split('\n')[0] + ')'); } }
const numeros = (base) => { const n = ligneMain(base).vinted_annonce_numeros || {}; return Object.fromEntries(Object.entries(n).filter(([, v]) => v && String(v.numero || '').trim()).map(([k, v]) => [k, String(v.numero)])); };
// Les cibles au doigt de nos cartes : ≥ 44 px de haut (390, tactile).
const ciblesPetites = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-accueil-reste] button, [data-accueil-reste] a, [data-reglages-aides-accueil] button')].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 43.5 && !b.classList.contains('vrm-mot'); }).map((b) => (b.textContent || '').trim().slice(0, 30)));

async function scenarioA(nav, W, sombre, suffixe) {
  // 134 — les N° lus, la retenue, « Oui » adopte par annonce, rien pour le N° 12.
  const base = baseNeuve();
  const { ctx, pg, journal, tel } = await ouvrir(nav, { W, sombre, base, tab: 'journee' });
  const vu = await attendre(pg, () => pg.$('[data-cartons]'), 15000);
  await pg.waitForTimeout(2500);
  dit(vu, `A1 ${suffixe} « Tes N° sont déjà sur tes cartons ? » est posée`);
  dit(!Object.keys(numeros(base)).length && !(ligneMain(base).vinted_used_numeros || []).length, `A2 ${suffixe} AUCUN N° neuf donné tant qu’elle n’a pas répondu`, numeros(base));
  if (vu) {
    const etat = await pg.evaluate(() => { const c = document.querySelector('[data-cartons]'); const d = c.querySelector('[data-cartons-doublon="12"]'); const lus = [...c.querySelectorAll('[data-cartons-lu]')].map((x) => [x.getAttribute('data-cartons-lu'), x.getAttribute('data-cartons-num')]); return { n: c.getAttribute('data-cartons-a-adopter'), doublon: !!d, rouge: d ? getComputedStyle(d.closest('.vrm-ar-doublons')).color : '', lus }; });
    dit(etat.n === '4' && JSON.stringify(etat.lus) === JSON.stringify([['9003', '4'], ['9004', '5'], ['9005', '9'], ['9008', '15']]), `A3 ${suffixe} les N° lus, chacun sur SON annonce (12 exclu)`, etat);
    dit(etat.doublon && /rgb\((2[0-5]\d|1[5-9]\d), \d{1,3}, \d{1,3}/.test(etat.rouge), `A4 ${suffixe} N° 12 sur deux annonces : en ROUGE`, etat.rouge);
    if (tel) dit(!(await ciblesPetites(pg)).length, `A5 ${suffixe} cibles ≥ 44 px`, await ciblesPetites(pg));
    await pg.evaluate(() => document.querySelector('[data-cartons]').scrollIntoView({ block: 'start' }));
    await capture(pg, `A-cartons-${suffixe}`);
    await pg.click('[data-cartons-oui]');
    const pose = await attendre(pg, () => Object.keys(numeros(base)).length >= 4, 12000);
    await pg.waitForTimeout(1500);
    const n = numeros(base);
    dit(pose && n['9003'] === '4' && n['9004'] === '5' && n['9005'] === '9' && n['9008'] === '15', `A6 ${suffixe} « Oui » : chaque N° lu adopté pour SON annonce`, n);
    dit(!n['9001'] && !n['9002'] && !n['9006'] && !n['9007'], `A7 ${suffixe} …ni le 12 (deux annonces), ni un N° neuf pour les autres`, n);
    dit((ligneMain(base).vrm_numero_ecrit || {}).actif === true, `A8 ${suffixe} sa réponse est le réglage synchronisé`, ligneMain(base).vrm_numero_ecrit);
    dit(!(await pg.$('[data-cartons]')), `A9 ${suffixe} la question ne revient pas`);
  }
  dit(!journal.erreurs.length, `A10 ${suffixe} aucune erreur JS`, journal.erreurs);
  dit(!(await deborde(pg)), `A11 ${suffixe} rien ne déborde`);
  await ctx.close();
  // « Non, VRM numérote » : la numérotation reprend comme avant.
  const b2 = baseNeuve();
  const o2 = await ouvrir(nav, { W, sombre, base: b2, tab: 'journee' });
  if (await attendre(o2.pg, () => o2.pg.$('[data-cartons-non]'), 15000)) {
    await o2.pg.click('[data-cartons-non]');
    const ok = await attendre(o2.pg, () => Object.keys(numeros(b2)).length >= 8, 12000);
    dit(ok && (ligneMain(b2).vrm_numero_ecrit || {}).actif === false, `A12 ${suffixe} « Non » : VRM numérote ses annonces comme avant`, numeros(b2));
  } else dit(false, `A12 ${suffixe} « Non, VRM numérote » est proposé`);
  await o2.ctx.close();
  // Un compte qui a déjà ses N° (pool non vide) : jamais la question, jamais retenu.
  const b3 = baseNeuve({ poolPlein: true });
  const o3 = await ouvrir(nav, { W, sombre, base: b3, tab: 'journee' });
  await o3.pg.waitForTimeout(7000);
  dit(!(await o3.pg.$('[data-cartons]')) && Object.keys(numeros(b3)).length > 1, `A13 ${suffixe} un compte qui a déjà des N° n’est jamais retenu ni questionné`, numeros(b3));
  await o3.ctx.close();
}

async function scenarioB(nav, W, sombre, suffixe) {
  // 133 — une liste, chaque ligne = la publication de l'écran propriétaire, son geste.
  const base = baseNeuve({ ecritChoisi: true });
  const { ctx, pg, journal } = await ouvrir(nav, { W, sombre, base, tab: 'journee' });
  const vu = await attendre(pg, () => pg.$('[data-trouve]'), 15000);
  await pg.waitForTimeout(2500);
  dit(vu, `B1 ${suffixe} « Ce que VRM a trouvé chez toi » s’affiche après la lecture`);
  if (vu) {
    const r = await pg.evaluate(() => {
      const ls = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } };
      const lignes = Object.fromEntries([...document.querySelectorAll('[data-trouve-ligne]')].map((l) => [l.getAttribute('data-trouve-ligne'), { n: l.getAttribute('data-trouve-n'), geste: !!l.querySelector('[data-trouve-geste]') }]));
      return { lignes, pub: { colis: (ls('vrm_colis_aposter') || {}).enRetard, dater: ((ls('vinted_urssaf_mois') || {}).aDater || {}).n, num: (ls('vrm_trouve_sans_numero') || {}).n } };
    });
    const egal = (cle, v) => r.lignes[cle] && Number.isInteger(v) && r.lignes[cle].n === String(v);
    dit(egal('colis-retard', r.pub.colis) && egal('ventes-a-dater', r.pub.dater) && egal('sans-numero', r.pub.num), `B2 ${suffixe} chaque nombre est celui que l’écran publie`, r);
    dit(Object.values(r.lignes).every((l) => (Number(l.n) > 0) === l.geste), `B3 ${suffixe} une ligne à régler porte SON geste`, r.lignes);
    await pg.evaluate(() => document.querySelector('[data-trouve]').scrollIntoView({ block: 'start' }));
    await capture(pg, `B-trouve-${suffixe}`);
    const noter = await pg.$('[data-trouve-noter]');
    if (noter) { await noter.click(); await pg.waitForTimeout(1500); }
    dit(!(await pg.$('[data-trouve]')) && !!((ligneMain(base).vrm_aides_accueil || {}).trouveVu), `B4 ${suffixe} « C’est noté » la range, par compte`, ligneMain(base).vrm_aides_accueil);
  }
  dit(!journal.erreurs.length, `B5 ${suffixe} aucune erreur JS`, journal.erreurs);
  await ctx.close();
  // Le geste « Voir » des annonces sans N° ouvre la vue « Sans numéro » (il numérote lui-même et
  // n'a rien écrit : ses annonces restent sans N°, un nombre stable).
  const b2 = baseNeuve({ ecritActif: true, sansEcrit: true });
  const o2 = await ouvrir(nav, { W, sombre, base: b2, tab: 'journee' });
  if (await attendre(o2.pg, () => o2.pg.$('[data-trouve-ligne="sans-numero"] [data-trouve-geste]'), 15000)) {
    await o2.pg.click('[data-trouve-ligne="sans-numero"] [data-trouve-geste]');
    dit(await attendre(o2.pg, () => o2.pg.$('[data-vue-toutes]'), 8000), `B6 ${suffixe} « Voir » mène aux annonces`);
  } else dit(false, `B6 ${suffixe} 3 annonces sans N° : la ligne porte « Voir »`);
  await o2.ctx.close();
}

async function scenarioC(nav, W, sombre, suffixe) {
  // 140 — le conseil du jour, en bas, sous tout geste ; × le range ; coupé ⇒ rien.
  const base = baseNeuve({ ecritChoisi: true, aides: { trouveVu: iso(0.1) } });
  const { ctx, pg, journal } = await ouvrir(nav, { W, sombre, base, tab: 'journee' });
  const vu = await attendre(pg, () => pg.$('[data-conseil-jour]'), 15000);
  await pg.waitForTimeout(1500);
  dit(vu && (await pg.getAttribute('[data-conseil-jour]', 'data-conseil-jour')) === '3', `C1 ${suffixe} le conseil du jour 3 (compte créé il y a 2 jours)`);
  if (vu) {
    const pos = await pg.evaluate(() => { const c = document.querySelector('[data-conseil-jour]').getBoundingClientRect().top + scrollY; const jobs = [...document.querySelectorAll('[data-job], [data-tuile]')].map((x) => x.getBoundingClientRect().bottom + scrollY); return { c, max: Math.max(0, ...jobs) }; });
    dit(pos.c > pos.max, `C2 ${suffixe} jamais au-dessus d’un geste à faire`, pos);
    await pg.evaluate(() => document.querySelector('[data-conseil-jour]').scrollIntoView({ block: 'center' }));
    await capture(pg, `C-conseil-${suffixe}`);
    await pg.click('[data-conseil-fermer]');
    const range = await attendre(pg, async () => !(await pg.$('[data-conseil-jour]')) && ((ligneMain(base).vrm_aides_accueil || {}).conseil || {}).ferme === true, 8000);
    dit(range, `C3 ${suffixe} « × » le range pour aujourd’hui`, { carte: !!(await pg.$('[data-conseil-jour]')), main: ligneMain(base).vrm_aides_accueil });
  }
  await ctx.close();
  const b2 = baseNeuve({ ecritChoisi: true, aides: { off: { conseil: true }, trouveVu: iso(0.1) } });
  const o2 = await ouvrir(nav, { W, sombre, base: b2, tab: 'journee' });
  await o2.pg.waitForTimeout(7000);
  dit(!(await o2.pg.$('[data-conseil-jour]')), `C4 ${suffixe} coupé dans Paramètres ⇒ plus de conseil`);
  dit(!journal.erreurs.length && !o2.journal.erreurs.length, `C5 ${suffixe} aucune erreur JS`, journal.erreurs.concat(o2.journal.erreurs));
  await o2.ctx.close();
}

// La même ouverture avec une autre session (date de création différente).
async function ouvrirAvecSession(nav, o) { const avant = SESSION.user; SESSION.user = o.session.user; try { return await ouvrir(nav, o); } finally { SESSION.user = avant; } }

async function scenarioD(nav, W, sombre, suffixe) {
  // 136 — la visite d'Annonces part seule, une fois ; « Passer » la range ; le « ? » la rejoue.
  const base = baseNeuve({ ecritChoisi: true, visites: true });
  const { ctx, pg, journal } = await ouvrir(nav, { W, sombre, base, tab: 'annonces' });
  const vu = await attendre(pg, () => pg.$('.vrm-visite[data-visite-ecran="annonces"]'), 15000);
  dit(vu, `D1 ${suffixe} la visite d’Annonces part à la première ouverture`);
  if (vu) {
    const cible = await pg.evaluate(() => { const v = document.querySelector('.vrm-visite'); const sel = v.getAttribute('data-visite-cible'); const el = [...document.querySelectorAll(sel)].find((e) => e.getBoundingClientRect().height > 0); return { sel, ok: !!el }; });
    dit(cible.ok, `D2 ${suffixe} la bulle pointe un bouton RÉEL`, cible);
    await pg.waitForTimeout(500);
    await capture(pg, `D-visite-${suffixe}`);
    await pg.click('[data-visite-passer]');
    await pg.waitForTimeout(1500);
    dit(!(await pg.$('.vrm-visite')) && !!(((ligneMain(base).vrm_aides_accueil || {}).vues || {}).annonces), `D3 ${suffixe} « Passer » la range (par compte)`, ligneMain(base).vrm_aides_accueil);
    await pg.reload(); await pg.waitForTimeout(6000);
    dit(!(await pg.$('.vrm-visite')), `D4 ${suffixe} elle ne revient pas seule`);
    const aide = await pg.$('[data-aide-ouvrir="annonces"]');
    if (aide) {
      await aide.click();
      const rev = await attendre(pg, () => pg.$('[data-visite-revoir="annonces"]'), 5000);
      if (rev) await pg.click('[data-visite-revoir="annonces"]');
      dit(rev && await attendre(pg, () => pg.$('.vrm-visite[data-visite-ecran="annonces"]'), 6000), `D5 ${suffixe} « Revoir la visite de cet écran » depuis le « ? »`);
      const gl = await pg.$('.vrm-visite [data-visite-passer]'); if (gl) await gl.click();
    } else dit(false, `D5 ${suffixe} le « ? » d’Annonces existe`);
  }
  dit(!journal.erreurs.length, `D6 ${suffixe} aucune erreur JS`, journal.erreurs);
  await ctx.close();
  // Un geste urgent à l'écran : la visite ne part pas seule par-dessus.
  const b2 = baseNeuve({ ecritChoisi: true, visites: true });
  const o2 = await ouvrir(nav, { W, sombre, base: b2, tab: 'ventes' });
  await o2.pg.waitForTimeout(6500);
  const urgent = await o2.pg.evaluate(() => [...document.querySelectorAll('[data-urgent="1"], [data-numeros-double]')].some((e) => e.getBoundingClientRect().height > 0));
  const visite = !!(await o2.pg.$('.vrm-visite[data-visite-ecran="ventes"]'));
  dit(urgent ? !visite : true, `D7 ${suffixe} geste urgent à l’écran ⇒ pas de visite par-dessus`, { urgent, visite });
  await o2.ctx.close();
  // Un vendeur installé (compte de 90 jours) : jamais de visite.
  const b3 = baseNeuve({ ecritChoisi: true, visites: true });
  const o3 = await ouvrirAvecSession(nav, { W, sombre, base: b3, tab: 'annonces', session: { ...SESSION, user: { ...SESSION.user, created_at: iso(90) } } });
  await o3.pg.waitForTimeout(6000);
  dit(!(await o3.pg.$('.vrm-visite')), `D8 ${suffixe} un vendeur installé n’est jamais interrompu`);
  await o3.ctx.close();
}

async function scenarioE(nav, W, sombre, suffixe) {
  // 139 — toucher un mot l'explique ; coupé ⇒ plus de bulle.
  const base = baseNeuve({ ecritChoisi: true });
  const { ctx, pg, journal } = await ouvrir(nav, { W, sombre, base, tab: 'journee' });
  const mot = await attendre(pg, () => pg.$('[data-glossaire]'), 15000);
  dit(mot, `E1 ${suffixe} un mot souligné dans « Ce que VRM a trouvé »`);
  if (mot) {
    const k = await pg.getAttribute('[data-glossaire]', 'data-glossaire');
    await pg.evaluate(() => document.querySelector('[data-glossaire]').scrollIntoView({ block: 'center' }));
    await pg.click('[data-glossaire]');
    let txt = '';
    const bulle = await attendre(pg, async () => { txt = await pg.evaluate((kk) => { const e = document.querySelector(`[data-glossaire-bulle="${kk}"]`); return e ? e.textContent : ''; }, k); return !!txt; }, 3000);
    dit(bulle && txt.split(/\s+/).length <= 30, `E2 ${suffixe} toucher « ${k} » l’explique en une phrase`, txt);
    await capture(pg, `E-glossaire-${suffixe}`);
    await pg.mouse.click(5, 300); await pg.waitForTimeout(400);
    dit(!(await pg.$('[data-glossaire-bulle]')), `E3 ${suffixe} un toucher ailleurs la referme`);
  }
  await ctx.close();
  const b2 = baseNeuve({ ecritChoisi: true, aides: { off: { glossaire: true } } });
  const o2 = await ouvrir(nav, { W, sombre, base: b2, tab: 'journee' });
  await attendre(o2.pg, () => o2.pg.$('[data-trouve]'), 15000);
  dit(!(await o2.pg.$('[data-glossaire]')), `E4 ${suffixe} coupé : le mot reste écrit, sans bulle`);
  dit(!journal.erreurs.length && !o2.journal.erreurs.length, `E5 ${suffixe} aucune erreur JS`, journal.erreurs.concat(o2.journal.erreurs));
  await o2.ctx.close();
}

async function scenarioF(nav, W, sombre, suffixe) {
  // 145 + 147 — l'essai en chiffres prouvés ; l'appel pour un compte Pro ; rien sans lien.
  const base = baseNeuve({ ecritChoisi: true, aides: { trouveVu: iso(0.1), off: { conseil: true } } });
  const { ctx, pg, journal } = await ouvrir(nav, { W, sombre, base, tab: 'journee' });
  const vu = await attendre(pg, () => pg.$('[data-essai="oui"]'), 15000);
  dit(vu, `F1 ${suffixe} « Ton essai » s’affiche pendant l’essai`);
  if (vu) {
    const e = await pg.evaluate(() => { const c = document.querySelector('[data-essai="oui"]'); const g = (s, a) => { const x = c.querySelector(s); return x ? x.getAttribute(a) : null; }; return { colis: g('[data-essai-colis]', 'data-essai-colis'), bords: g('[data-essai-bordereaux]', 'data-essai-bordereaux'), min: g('[data-essai-minutes]', 'data-essai-minutes'), rest: g('[data-essai-restants]', 'data-essai-restants'), regle: !!c.querySelector('[data-essai-regle]'), appel: (c.querySelector('[data-appel-bienvenue]') || {}).href || '' }; });
    dit(e.colis === '2' && e.bords === '1' && e.rest === '5', `F2 ${suffixe} colis suivis, bordereaux imprimés, jours restants : lus`, e);
    dit(e.min === '3' && e.regle, `F3 ${suffixe} temps gagné ESTIMÉ (règle dépliable)`, e);
    dit(e.appel === 'https://rendez-vous.exemple.test/julien/15-minutes', `F4 ${suffixe} compte Pro : « Réserver » l’appel de bienvenue`, e.appel);
    await pg.evaluate(() => document.querySelector('[data-essai="oui"]').scrollIntoView({ block: 'center' }));
    await capture(pg, `F-essai-${suffixe}`);
  }
  dit(!journal.erreurs.length, `F5 ${suffixe} aucune erreur JS`, journal.erreurs);
  await ctx.close();
  for (const [abo, quoi] of [[{ plan: 'solo' }, 'compte Solo'], [{ appelBienvenue: '' }, 'lien vide']]) {
    const b = baseNeuve({ ecritChoisi: true, abo, aides: { trouveVu: iso(0.1) } });
    const o = await ouvrir(nav, { W, sombre, base: b, tab: 'journee' });
    await attendre(o.pg, () => o.pg.$('[data-essai]'), 12000);
    dit(!(await o.pg.$('[data-appel-bienvenue]')), `F6 ${suffixe} ${quoi} : aucun appel proposé`);
    await o.ctx.close();
  }
  // Le propriétaire range SON lien (Paramètres → Aide).
  const b4 = baseNeuve({ ecritChoisi: true, abo: { proprietaire: true, plan: 'pro', statut: null, finEssai: null, appelBienvenue: '' } });
  const o4 = await ouvrir(nav, { W, sombre, base: b4, tab: 'settings' });
  const pan = await attendre(o4.pg, () => o4.pg.$('[data-reglage-aides-accueil]'), 15000);
  if (pan) {
    await o4.pg.click('[data-reglage-aides-accueil]').catch(() => {});
    const champ = await attendre(o4.pg, () => o4.pg.$('[data-appel-champ]'), 6000);
    if (champ) { await o4.pg.fill('[data-appel-champ]', 'https://cal.exemple.test/julien'); await o4.pg.click('[data-appel-enregistrer]'); await o4.pg.waitForTimeout(1800); }
    await capture(o4.pg, `F-reglages-${suffixe}`);
    dit(champ && ((ligneMain(b4).vrm_appel_bienvenue || {}).lien === 'https://cal.exemple.test/julien'), `F7 ${suffixe} le propriétaire range le lien de réservation dans SA ligne`, ligneMain(b4).vrm_appel_bienvenue);
  } else dit(false, `F7 ${suffixe} Paramètres → Aide porte les aides de l’accueil`);
  await o4.ctx.close();
}

async function scenarioG(nav, W, sombre, suffixe) {
  // 143 — « Continuer avec Apple » : absent tant que Supabase ne l'active pas.
  for (const apple of [false, true]) {
    const base = baseNeuve({ auth: { external: { google: true, discord: true, apple, email: true } } });
    const { ctx, pg } = await ouvrir(nav, { W, sombre, base, chemin: '/?connexion', sansSession: true });
    await attendre(pg, () => pg.$('input[type="email"], input[type="password"]'), 15000);
    await pg.waitForTimeout(1500);
    const n = await pg.$$eval('[data-marque="apple"]', (l) => l.length).catch(() => 0);
    dit(apple ? n === 1 : n === 0, `G${apple ? 2 : 1} ${suffixe} Apple ${apple ? 'activé chez Supabase ⇒ le bouton' : 'pas activé ⇒ AUCUN bouton'}`, n);
    if (apple) await capture(pg, `G-apple-${suffixe}`);
    await ctx.close();
  }
}

(async () => {
  const srv = await serveur();
  const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const S = { A: scenarioA, B: scenarioB, C: scenarioC, D: scenarioD, E: scenarioE, F: scenarioF, G: scenarioG };
  try {
    for (const W of LARGEURS) for (const th of THEMES) for (const s of SCENARIOS) {
      if (!S[s]) continue;
      const suffixe = `${W}-${th}`;
      try { await S[s](nav, W, th === 'sombre', suffixe); } catch (e) { dit(false, `${s} ${suffixe} sans exception`, String(e && e.message || e).split('\n')[0]); }
    }
  } finally { await nav.close(); srv.close(); }
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ accueil (le reste) : tout est vert');
  process.exit(ko ? 1 : 0);
})();
