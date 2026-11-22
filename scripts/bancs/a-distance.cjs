#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  BANC « À DISTANCE » (22 nov., ext. 5.436, capacité `adistance`) — « Mes comptes » RENDU dans la vraie app,
//  avec l'AUTRE BOUT simulé : l'ordinateur du vendeur.
//
//  Le vrai `dist/` servi par le monde du banc (_e2e-monde.cjs : faux Supabase à état, vrm.center), une session
//  posée, des données INVENTÉES (dépôt public). Deux choses simulées, à la forme réelle :
//    · LE TEMPS RÉEL — chaque écriture de la base (st.ecritures) est diffusée comme le déclencheur de la
//      migration 040 (`vrm_signal_ligne` : { id, owner, updated_at … } sur `vrm-lignes:<owner>`), par un faux
//      WebSocket Phoenix dans la page (jonction → `phx_reply ok`, puis `broadcast`/`ligne`). `--sans-temps-reel` :
//      la prise est refusée (comme avant la migration) — l'écran doit le DIRE et rester rapide par sondage ;
//    · L'EXTENSION de l'ordinateur — sa ligne `presence_{appareil}` (allumé, compte ouvert) et, pour chaque
//      `cmd_dist_*` en attente : la règle (src/aDistance.js) la juge, la prend (`pris` + appareil) puis écrit
//      l'issue (« fait », avant → après) — aux délais d'une vraie extension réveillée par le temps réel.
//  Parcours (390 tactile clair, 390 sombre, 1512 clair) : l'état de l'ordinateur ; un compte → sa boîte → un fil
//  → répondre (UN toucher) : « En cours » puis « Fait » ; LATENCE MESURÉE (toucher → « en cours » affiché,
//  toucher → « fait » affiché) ; accepter une offre DEMANDE confirmation (argent) ; « Relire » d'un compte pas
//  relu ; ordinateur éteint ⇒ « tes gestes attendront », le geste attend, « Annuler » le retire (rien ne part).
//  Jugé sur les data-* et la base, débordement, cibles ≥ 44 px. Captures (BANC_CAPTURE=dossier) À REGARDER.
//    node scripts/bancs/a-distance.cjs                  (après npm run build)
//    node scripts/bancs/a-distance.cjs --prouve         (chaque mutation du build doit rougir)
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const { monde, certificat, HOTES } = require('./_e2e-monde.cjs');
const chargerPw = () => { for (const p of [__dirname, process.cwd(), path.join(__dirname, '..', '..')]) { try { return require(require.resolve('playwright', { paths: [p] })); } catch (_) {} } return null; };
const pw = chargerPw();
const RACINE = path.join(__dirname, '..', '..');
const CHROME = process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const PORT = Number(process.env.BANC_PORT) || 4797;
const DIST0 = path.resolve(process.env.BANC_DIST || path.join(RACINE, 'dist'));
const CAPT = process.env.BANC_CAPTURE || '';
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const MUT = arg('--mutation');
const SANS_RT = process.argv.includes('--sans-temps-reel');
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0, ko = 0;
const mesures = [];
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${det ? ' — ' + String(det).slice(0, 400) : ''}`); } };

// Mutations du BUILD (§6.1).
const MUTATIONS = {
  // l'écran n'écoute plus le temps réel : il retombe sur le sondage lent ⇒ la latence dépasse 2 s
  'sans-ecoute': [[/"vrm:ligne",(\w+)\),window\.addEventListener\("vrm:ext"/g, '"vrm:ligne-x",$1),window.addEventListener("vrm:ext"']],
  // « Accepter » n'ouvre plus la feuille de confirmation
  'sans-feuille-accepter': [[/onClick:\(\)=>\w+\(\{tx:\w+\.tx,oid:\w+\.id,prix:\w+\.prix,conv:\w+\}\)/g, 'onClick:()=>{}']],
  // le geste n'est pas montré avant la relecture (pas d'ajout local)
  'sans-ajout-local': [[/(\w+)\.current\.set\((\w+)\.id,(\w+)\),(\w+)\(/g, '$1.current.set($2.id,$3),(()=>{})(']],
};
if (process.argv.includes('--prouve')) {
  const lancer = (extra) => spawnSync(process.execPath, [__filename, ...extra], { stdio: ['ignore', 'pipe', 'pipe'], env: process.env, timeout: 1200000, encoding: 'utf8' });
  const base = lancer([]); const vert = base.status === 0;
  console.log(`${vert ? '✅' : '❌'} passage sur le code tel quel : ${vert ? 'vert' : 'ROUGE'}`);
  if (!vert) console.log(String(base.stdout).split('\n').filter((l) => /❌/.test(l)).slice(0, 6).join('\n'));
  let rate = vert ? 0 : 1;
  for (const m of Object.keys(MUTATIONS)) {
    const r = lancer(['--mutation', m]); const rouges = String(r.stdout).split('\n').filter((l) => /❌/.test(l));
    const bon = r.status !== 0 && rouges.length > 0; if (!bon) rate++;
    console.log(`${bon ? '✅' : '❌'} mutation « ${m} » : ${bon ? `rouge (${rouges.length} contrôle(s))` : 'RESTE VERTE'}`);
    for (const l of rouges.slice(0, 3)) console.log('     ' + l.trim());
  }
  process.exit(rate ? 1 : 0);
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-a-distance-'));
function preparerDist() {
  const m = MUT && MUTATIONS[MUT];
  if (!m) return DIST0;
  const d = path.join(TMP, 'dist'); fs.cpSync(DIST0, d, { recursive: true }); let touche = 0;
  const marcher = (dir) => { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); if (fs.statSync(p).isDirectory()) marcher(p); else if (/\.js$/.test(f)) { const s = fs.readFileSync(p, 'utf8'); let t = s; for (const [a, b] of m) t = t.replace(a, b); if (t !== s) { fs.writeFileSync(p, t); touche++; } } } };
  marcher(d);
  if (!touche) { console.log(`❌ mutation ${MUT} : rien trouvé à muter dans dist/`); process.exit(2); }
  return d;
}
const regles = () => HOTES.map((h) => `MAP ${h} 127.0.0.1:${PORT}`).concat(['MAP * ~NOTFOUND']).join(', ');
const U = { id: 'aaaaaaaa-0000-4000-8000-000000000001', email: 'vendeur@exemple.test', mdp: 'bon-mot-de-passe' };
const A = '41000001', B = '41000002', CONV = '7300001', TX = '8800001', OID = '9900001', APP = 'aaaaaaaaaaaaaaaa';
let M, R;   // le monde, la règle (src/aDistance.js)
const ext = { allume: true, prise: 350, exec: 900, vus: new Set(), journal: [] };

function semer() {
  const t = Date.now();
  const app = M.st.tables.app_data = (M.st.tables.app_data || []).filter((r) => !/^(presence_|cmd_dist_|harvest_)/.test(r.id));
  M.st.tables.vinted_accounts = [{ vinted_user_id: A, login: 'boutique_a', domain: 'www.vinted.fr', owner: U.id }, { vinted_user_id: B, login: 'atelier_b', domain: 'www.vinted.fr', owner: U.id }];
  const iso = (ms) => new Date(ms).toISOString();
  const convs = [
    { id: Number(CONV), unread: true, updated_at: iso(t - 4 * 60000), description: 'Elle taille grand ? Je fais du 42', opposite_user: { id: 5001, login: 'acheteuse_lea' }, item_photos: [] },
    { id: 7300002, unread: false, updated_at: iso(t - 3 * 3600000), description: 'Merci, bien reçue !', opposite_user: { id: 5002, login: 'marc_92' }, item_photos: [] },
    { id: 7300003, unread: false, updated_at: iso(t - 26 * 3600000), description: 'Vous faites un prix pour deux ?', opposite_user: { id: 5003, login: 'sneakers_zoe' }, item_photos: [] },
  ];
  app.push({ id: `harvest_${A}_inbox`, owner: U.id, updated_at: iso(t), data: { uid: A, type: 'inbox', domain: 'www.vinted.fr', nItems: 3, capturedAt: iso(t - 2 * 60000), payload: { conversations: convs, pagination: {} } } });
  app.push({ id: `harvest_${A}_conv_${CONV}`, owner: U.id, updated_at: iso(t), data: { uid: A, type: 'conv', capturedAt: iso(t - 2 * 60000), payload: { conversation: { id: Number(CONV), allow_reply: true, opposite_user: { id: 5001, login: 'acheteuse_lea' }, transaction: { id: Number(TX), item_id: 91010001 },
    messages: [
      { entity_type: 'message', created_at_ts: Math.round((t - 30 * 60000) / 1000), entity: { id: 1, body: 'Bonjour, la Nike P-6000 est toujours dispo ?', user_id: 5001 } },
      { entity_type: 'message', created_at_ts: Math.round((t - 25 * 60000) / 1000), entity: { id: 2, body: 'Oui, toujours dispo !', user_id: Number(A) } },
      { entity_type: 'offer_request_message', created_at_ts: Math.round((t - 5 * 60000) / 1000), entity: { offer_request_id: Number(OID), transaction_id: Number(TX), status: 10, current: true, price: { amount: '70.0', currency_code: 'EUR' }, user_id: 5001, status_title: 'En attente' } },
      { entity_type: 'message', created_at_ts: Math.round((t - 4 * 60000) / 1000), entity: { id: 3, body: 'Elle taille grand ? Je fais du 42', user_id: 5001 } },
    ] } } } });
  // Fraîcheur : A relu il y a 3 min, B il y a 3 jours.
  app.push({ id: `harvest_${A}_orders_sold`, owner: U.id, updated_at: iso(t), data: { uid: A, type: 'orders_sold', capturedAt: iso(t - 3 * 60000), payload: { my_orders: [] } } });
  app.push({ id: `harvest_${B}_orders_sold`, owner: U.id, updated_at: iso(t), data: { uid: B, type: 'orders_sold', capturedAt: iso(t - 3 * 86400000), payload: { my_orders: [] } } });
  presence();
}
// La présence de l'ordinateur simulé (la forme de `publierPresence`, background.js).
function presence() {
  const t = Date.now();
  const app = M.st.tables.app_data;
  const atMs = ext.allume ? t : t - 2 * 3600000;
  const data = { v: 1, at: new Date(atMs).toISOString(), atMs, ver: '5.436.0', code: '5.436.0', appareil: { paquet: 'chromium', nav: 'chrome', systeme: 'mac' },
    comptes: [{ site: 'vinted', id: A, nom: 'boutique_a' }], retenues: [], enCours: '', rt: SANS_RT ? 'refuse' : 'joint', lus: {} };
  const i = app.findIndex((r) => r.id === 'presence_' + APP);
  const l = { id: 'presence_' + APP, owner: U.id, updated_at: new Date().toISOString(), data };
  if (i >= 0) app[i] = l; else app.push(l);
  M.st.ecritures.push({ t: 'app_data', id: l.id, src: 'extension', at: Date.now() });
}
// L'extension de l'ordinateur : la règle de l'app juge, prise, issue. Aucun Vinted : le banc juge l'APP.
async function tourExtension() {
  if (!ext.allume) return;
  for (const r of M.st.tables.app_data || []) {
    if (!/^cmd_dist_/.test(r.id) || !r.data || r.owner !== U.id || r.data.pour !== U.id) continue;
    const d = r.data;
    if (d.etat === 'attente' && !ext.vus.has(r.id)) {
      const c = R.adistCommande(d);
      ext.vus.add(r.id);
      ext.journal.push({ id: r.id, geste: d.geste, at: Date.now(), refus: c.refus || '' });
      setTimeout(() => {
        if (r.data.etat !== 'attente') return;   // annulée entre-temps : jamais prise
        if (c.refus) { r.data = { ...r.data, etat: 'refuse', code: c.refus, raison: 'refusée', finiLe: Date.now() }; M.st.ecritures.push({ t: 'app_data', id: r.id, src: 'extension', at: Date.now() }); return; }
        r.data = { ...r.data, etat: 'pris', prisLe: Date.now(), appareil: APP }; r.updated_at = new Date().toISOString();
        M.st.ecritures.push({ t: 'app_data', id: r.id, src: 'extension', at: Date.now() });
        setTimeout(() => {
          const apres = d.geste === 'accepter' ? d.args.prix : d.geste === 'contreOffre' ? d.args.prix : d.geste === 'prix' ? d.args.prix : undefined;
          r.data = { ...r.data, etat: 'fait', code: d.geste === 'relire' ? '' : '', raison: '', finiLe: Date.now(), ...(apres != null ? { apres } : {}) }; r.updated_at = new Date().toISOString();
          M.st.ecritures.push({ t: 'app_data', id: r.id, src: 'extension', at: Date.now() });
        }, ext.exec);
      }, ext.prise);
    }
  }
}

async function contexte(nav, { mobile, sombre }) {
  const ctx = await nav.newContext(Object.assign({ viewport: mobile ? { width: 390, height: 844 } : { width: 1512, height: 950 }, timezoneId: 'Europe/Paris', locale: 'fr-FR', ignoreHTTPSErrors: true },
    mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
  const s = M.ouvrir(M.USERS.get(U.email));
  // La base répond « temps réel prêt » (migration 040) — sauf `--sans-temps-reel`.
  // Un dépôt sur un réseau de téléphone (4G moyenne) : la base met 1,2 s à prendre la ligne — le geste doit se voir AVANT.
  await ctx.route('**/rest/v1/app_data?on_conflict*', async (route) => { const q = route.request(); if (q.method() === 'POST' && /cmd_dist_/.test(q.postData() || '')) await attendre(1200); route.continue(); });
  await ctx.route('**/rest/v1/rpc/vrm_temps_reel*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: SANS_RT ? 'false' : 'true' }));
  await ctx.addInitScript(({ s, uid, sombre, sansRt }) => {
    if (location.origin !== 'https://vrm.center') return;
    try { localStorage.setItem('schema_cloisonne', '1'); localStorage.setItem('vrm_ext_separee_' + uid, '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1');
      localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); localStorage.setItem('vrm_apparence', JSON.stringify(sombre ? 'sombre' : 'clair'));
      if (!localStorage.getItem('__banc_pose')) { localStorage.setItem('__banc_pose', '1'); localStorage.setItem('vrm_session', JSON.stringify(s)); } } catch (_) {}
    // Le faux WebSocket Phoenix de Supabase Realtime (diffusion privée) : jonction ⇒ ok, puis ce que la base diffuse.
    const Vrai = window.WebSocket; const prises = new Set();
    class FauxWS {
      constructor(url) { this.url = String(url); this.readyState = 0; this.sujet = ''; prises.add(this);
        setTimeout(() => { this.readyState = 1; this.onopen && this.onopen(); }, 30); }
      send(t) { let m = null; try { m = JSON.parse(t); } catch (_) { return; }
        if (m.event === 'phx_join') { this.sujet = m.topic; setTimeout(() => this.onmessage && this.onmessage({ data: JSON.stringify({ topic: m.topic, event: 'phx_reply', ref: m.ref, payload: { status: sansRt ? 'error' : 'ok', response: {} } }) }), 20); } }
      close() { this.readyState = 3; prises.delete(this); setTimeout(() => this.onclose && this.onclose(), 0); }
    }
    window.WebSocket = function (url, p) { return /\/realtime\/v1\/websocket/.test(String(url)) ? new FauxWS(url) : new Vrai(url, p); };
    window.__nl = 0; window.__np = 0; window.addEventListener('vrm:ligne', () => { window.__nl++; });
    window.__rtPousser = (lignes) => { window.__np += lignes.length; for (const w of prises) for (const l of lignes) if (w.readyState === 1 && w.sujet === 'realtime:vrm-lignes:' + l.owner && w.onmessage) w.onmessage({ data: JSON.stringify({ topic: w.sujet, event: 'broadcast', payload: { event: 'ligne', payload: l, type: 'broadcast' } }) }); };
  }, { s: { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: Date.now() + 3600e3, user: s.user }, uid: U.id, sombre, sansRt: SANS_RT });
  return ctx;
}
// Le déclencheur `vrm_signal_ligne` : chaque écriture ⇒ { id, owner, updated_at } diffusé à SON vendeur.
function diffuseur(pg) {
  let vu = M.st.ecritures.length, mort = false;
  (async () => { while (!mort) { await attendre(40); await tourExtension(); const neuves = M.st.ecritures.slice(vu); vu = M.st.ecritures.length;
    const l = neuves.filter((e) => e.t === 'app_data').map((e) => { const r = M.ligne(e.id); return r ? { id: r.id, owner: r.owner, updated_at: r.updated_at } : null; }).filter(Boolean);
    if (l.length && !SANS_RT) await pg.evaluate((x) => window.__rtPousser && window.__rtPousser(x), l).catch(() => {}); } })();
  return () => { mort = true; };
}
const lireEcran = (pg) => pg.evaluate(() => {
  const r = document.querySelector('[data-ecran-adistance]');
  if (!r) return null;
  const de = document.documentElement;
  const vis = (x) => { const b = x.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
  const cibles = [...document.querySelectorAll('[data-ecran-adistance] button, [data-ecran-adistance] a[href], [data-adist-page-compte] button, [data-adist-page-fil] button')].filter(vis).map((x) => { const b = x.getBoundingClientRect(); return { h: Math.round(b.height), w: Math.round(b.width), t: (x.innerText || x.getAttribute('aria-label') || '').trim().slice(0, 30) }; });
  return { ordis: r.getAttribute('data-adist-ordis'), rt: r.getAttribute('data-adist-rt'),
    ordi: [...r.querySelectorAll('[data-adist-ordi]')].map((x) => ({ id: x.getAttribute('data-adist-ordi'), allume: x.getAttribute('data-adist-allume'), texte: (x.innerText || '').replace(/\s+/g, ' ') })),
    trt: (r.querySelector('[data-adist-temps-reel]') || { getAttribute: () => null }).getAttribute('data-adist-temps-reel'),
    cmds: [...r.querySelectorAll('[data-adist-cmd]')].map((x) => ({ id: x.getAttribute('data-adist-cmd'), etat: x.getAttribute('data-adist-etat'), geste: x.getAttribute('data-adist-geste'), texte: (x.innerText || '').replace(/\s+/g, ' ') })),
    comptes: [...r.querySelectorAll('[data-adist-compte]')].map((x) => ({ id: x.getAttribute('data-adist-compte'), vieux: x.getAttribute('data-adist-vieux'), ouvert: x.getAttribute('data-adist-ouvert'), texte: (x.innerText || '').replace(/\s+/g, ' ') })),
    deborde: de.scrollWidth - de.clientWidth, petites: cibles.filter((c) => c.h < 44 || c.w < 44), texte: (r.innerText || '').replace(/\s+/g, ' ') };
}).catch(() => null);
const attendreEcran = async (pg, bon, ms = 30000, pas = 50) => { const t0 = Date.now(); let e = null; while (Date.now() - t0 < ms) { e = await lireEcran(pg); if (e && bon(e)) return e; await attendre(pas); } return e; };
const photo = async (pg, nom) => { if (!CAPT) return; try { fs.mkdirSync(CAPT, { recursive: true }); await pg.screenshot({ path: path.join(CAPT, nom + '.png'), fullPage: false }); } catch (_) {} };
const TECHNIQUES = /\b(cmd_dist|presence_|Realtime|WebSocket|token|jeton|requête|service worker|undefined|NaN|null)\b/i;
const cmdsBase = () => (M.st.tables.app_data || []).filter((r) => /^cmd_dist_/.test(r.id));

async function parcours(nav, { mobile, sombre, nom }) {
  console.log(`\n── ${nom}`);
  ext.allume = true; ext.vus.clear(); semer();
  const ctx = await contexte(nav, { mobile, sombre }); const pg = await ctx.newPage();
  const arret = diffuseur(pg);
  const reqs = []; if (process.env.DEBUG) pg.on('response', async (q) => { if (/cmd_dist_/.test(q.url())) { let b = ''; try { b = (await q.text()).replace(/.*?etat":"(\w+).*/s, '$1'); } catch (_) {} reqs.push([Date.now(), q.request().method(), decodeURIComponent(q.url()).slice(60, 100), b.slice(0, 20)]); } });
  try {
    await pg.goto('https://vrm.center/?tab=adistance', { waitUntil: 'domcontentloaded' });
    let e = await attendreEcran(pg, (x) => x.ordis === 'allume' && x.comptes.length >= 2 && (SANS_RT || x.trt === 'joint'), 60000, 300);
    await attendre(500); await photo(pg, nom + '-1-accueil');
    dit(!!e && e.ordis === 'allume' && e.ordi.some((o) => o.allume === '1' && /Chrome · Mac est allumé · boutique_a/.test(o.texte)), '« Chrome · Mac est allumé · boutique_a »', JSON.stringify(e && e.ordi));
    dit(!!e && (SANS_RT ? e.trt === 'sondage' : e.trt === 'joint'), SANS_RT ? 'temps réel refusé : c’est DIT (« toutes les 2 s »)' : 'temps réel joint : « Instantané »', JSON.stringify(e && { rt: e.rt, trt: e.trt }));
    const ca = e && e.comptes.find((c) => c.id === 'vinted:' + A), cb = e && e.comptes.find((c) => c.id === 'vinted:' + B);
    dit(!!ca && ca.ouvert === '1' && ca.vieux === '0', 'boutique_a : ouvert sur l’ordinateur, relu récemment', JSON.stringify(ca));
    dit(!!cb && cb.vieux === '1' && /Pas relu/.test(cb.texte), 'atelier_b : « Pas relu · il y a 3 jours » en ambre', JSON.stringify(cb));
    dit(!!e && e.deborde <= 0 && (!mobile || !e.petites.length), 'aucun débordement ; cibles ≥ 44 px', JSON.stringify(e && { d: e.deborde, p: e.petites.slice(0, 4) }));
    dit(!!e && !TECHNIQUES.test(e.texte), 'aucun mot technique ni « undefined » dans le texte rendu', e && (e.texte.match(TECHNIQUES) || [])[0]);
    // ── un compte → sa boîte → le fil → répondre (UN toucher pour envoyer)
    await pg.click(`[data-adist-compte="vinted:${A}"]`);
    await pg.waitForSelector(`[data-adist-conv="${CONV}"]`, { timeout: 15000 }).catch(() => {});
    await attendre(400); await photo(pg, nom + '-2-compte');
    const nonLu = await pg.getAttribute(`[data-adist-conv="${CONV}"]`, 'data-adist-non-lu').catch(() => null);
    dit(nonLu === '1', 'la boîte du compte : la conversation non lue est dite', nonLu);
    await pg.click(`[data-adist-conv="${CONV}"]`);
    await pg.waitForSelector('[data-adist-saisie]', { timeout: 15000 }).catch(() => {});
    await attendre(400);
    const offre = await pg.getAttribute(`[data-adist-offre="${OID}"]`, 'data-adist-offre-attente').catch(() => null);
    dit(offre === '1', 'le fil : l’offre de 70 € est « en attente de ta réponse », avec ses gestes', offre);
    await photo(pg, nom + '-3-fil');
    await pg.fill('[data-adist-saisie]', 'Oui elle taille normal, prenez votre pointure habituelle.');
    const avant = cmdsBase().length;
    const t0 = Date.now();
    await pg.click('[data-adist-envoyer]');
    // Le geste se voit TOUT DE SUITE dans la file, puis « en cours », puis « fait » (sans temps réel, le sondage peut voir « fait » directement).
    const e1 = await attendreEcran(pg, (x) => x.cmds.some((c) => c.geste === 'repondre'), 3000, 20); const tVu = Date.now() - t0;
    const e2 = await attendreEcran(pg, (x) => x.cmds.some((c) => c.geste === 'repondre' && (c.etat === 'pris' || c.etat === 'fait')), 8000, 20); const tPris = Date.now() - t0;
    await photo(pg, nom + '-4-en-cours');
    const e3 = await attendreEcran(pg, (x) => x.cmds.some((c) => c.geste === 'repondre' && c.etat === 'fait'), 12000, 20); const tFait = Date.now() - t0;
    console.log('     debug', JSON.stringify(await pg.evaluate(() => ({ nl: window.__nl, np: window.__np, socks: document.documentElement.getAttribute('data-temps-reel') })).catch(() => null)));
    if (process.env.DEBUG) for (const q of reqs) console.log('      req', q[0] - t0, q[1], q[2], q[3]);
    mesures.push({ nom, vu: tVu, pris: tPris, fait: tFait, extPrise: ext.prise, extExec: ext.exec });
    console.log(`     latence : montré ${tVu} ms · « en cours » ${tPris} ms · « fait » ${tFait} ms (dépôt 4G 1 200 ms, l’ordinateur simulé met ${ext.prise} ms à prendre, ${ext.exec} ms à faire)`);
    const ligne = cmdsBase().find((r) => r.data.geste === 'repondre');
    dit(cmdsBase().length === avant + 1 && ligne && ligne.data.compte === A && ligne.data.args.conv === CONV && ligne.data.args.texte.startsWith('Oui elle') && ligne.data.pour === U.id && R.adistCommande(ligne.data).cle,
      'UN toucher ⇒ UNE commande `repondre` au compte, à la conversation, au texte tapé, permise par la règle', JSON.stringify(ligne && ligne.data).slice(0, 300));
    dit(!!e1 && tVu < 800, `le geste est montré dans la file en moins de 0,8 s (${tVu} ms)`, tVu);
    const DEPOT = 1200;   // le dépôt « 4G » simulé ci-dessus
    const plafPris = DEPOT + ext.prise + (SANS_RT ? 2800 : 1000), plafFait = DEPOT + ext.prise + ext.exec + (SANS_RT ? 2800 : 1000);
    dit(!!e2 && tPris < plafPris, `l’ordinateur a pris le geste : vu en moins de ${plafPris} ms (${tPris} ms)${SANS_RT ? ' — sondage de 2 s' : ' — temps réel'}`, tPris);
    dit(!!e3 && tFait < plafFait && e3.cmds.some((c) => c.etat === 'fait' && /Message envoyé/.test(c.texte)), `« Fait · Message envoyé » en moins de ${plafFait} ms (${tFait} ms)`, tFait);
    const dansFil = await pg.evaluate(() => [...document.querySelectorAll('[data-adist-fil-geste]')].map((x) => x.getAttribute('data-adist-etat'))).catch(() => []);
    dit(dansFil.includes('fait'), 'le fil montre l’état de SON message (« fait ») sans le quitter', JSON.stringify(dansFil));
    // ── accepter l'offre : l'argent ⇒ UNE confirmation
    await attendre(300);
    const nAvant = cmdsBase().length;
    await pg.click(`[data-adist-offre="${OID}"] [data-adist-geste="accepter"]`).catch(() => {});
    await pg.waitForSelector('[data-adist-accepter-confirmer]', { timeout: 5000 }).catch(() => {});
    await attendre(400); await photo(pg, nom + '-5-accepter');
    dit(cmdsBase().length === nAvant && !!(await pg.$('[data-adist-accepter-confirmer]')), 'accepter une offre DEMANDE confirmation (rien ne part avant)', cmdsBase().length - nAvant);
    // Le plein de la feuille n'est caché par RIEN (le toast du geste précédent le couvrait : vu sur la capture).
    const couvert = await pg.evaluate(() => { const b = document.querySelector('[data-adist-accepter-confirmer]'); if (!b) return 'absent'; const r = b.getBoundingClientRect(); const x = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return x && (x === b || b.contains(x)) ? '' : String((x && x.className) || '?').slice(0, 60); }).catch(() => '?');
    dit(couvert === '', '« Accepter et vendre » est visible et touchable (rien ne le couvre)', couvert);
    await pg.click('[data-adist-accepter-confirmer]').catch(() => {});
    const e4 = await attendreEcran(pg, (x) => x.cmds.some((c) => c.geste === 'accepter' && c.etat === 'fait'), 12000, 50);
    const acc = cmdsBase().find((r) => r.data.geste === 'accepter');
    dit(!!acc && acc.data.confirme === true && acc.data.args.tx === TX && acc.data.args.oid === OID && !!e4 && e4.cmds.some((c) => c.geste === 'accepter' && /Offre acceptée à 70/.test(c.texte)), '… confirmée ⇒ commande `accepter` confirmée, « Offre acceptée à 70 € »', JSON.stringify(acc && acc.data.args));
    // ── retour, puis « Relire » d'un compte pas relu (la page du compte)
    const retour = async (lib) => { await pg.locator('button', { hasText: lib }).last().click({ timeout: 5000 }).catch(() => {}); await attendre(500); };
    await retour('boutique_a'); await retour('Mes comptes');
    await pg.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
    await photo(pg, nom + '-6-file');
    if (!mobile) {
      await pg.click(`[data-adist-compte="vinted:${B}"]`).catch(() => {});
      await pg.click(`[data-adist-relire="vinted:${B}"]`, { timeout: 8000 }).catch(() => {});
      const e5 = await attendreEcran(pg, (x) => x.cmds.some((c) => c.geste === 'relire'), 5000, 50);
      dit(!!e5 && cmdsBase().some((r) => r.data.geste === 'relire' && r.data.compte === B), '« Relire » d’atelier_b ⇒ UNE commande `relire` au bon compte', JSON.stringify(cmdsBase().map((r) => r.data.geste)));
    }
  } finally { arret(); await ctx.close().catch(() => {}); }
}
async function eteint(nav, { mobile, sombre, nom }) {
  console.log(`\n── ${nom}`);
  ext.allume = false; ext.vus.clear(); semer();
  const ctx = await contexte(nav, { mobile, sombre }); const pg = await ctx.newPage();
  const arret = diffuseur(pg);
  try {
    await pg.goto('https://vrm.center/?tab=adistance', { waitUntil: 'domcontentloaded' });
    let e = await attendreEcran(pg, (x) => x.ordis === 'eteint' && x.comptes.length >= 2, 60000, 300);
    dit(!!e && e.ordi.some((o) => o.allume === '0' && /éteint depuis \d\d:\d\d — tes gestes attendront/.test(o.texte)), '« Chrome · Mac est éteint depuis HH:MM — tes gestes attendront »', JSON.stringify(e && e.ordi));
    await pg.click(`[data-adist-compte="vinted:${A}"]`);
    await pg.click(`[data-adist-relire="vinted:${A}"]`, { timeout: 8000 }).catch(() => {});
    await attendre(300); await pg.locator('button', { hasText: 'Mes comptes' }).last().click({ timeout: 5000 }).catch(() => {}); await attendre(600);
    e = await attendreEcran(pg, (x) => x.cmds.some((c) => c.geste === 'relire' && c.etat === 'attente'), 6000, 50);
    const c = e && e.cmds.find((x) => x.geste === 'relire');
    await photo(pg, nom + '-1-attend');
    dit(!!c && /éteint — partira dès qu’il revient \(jusqu’à (demain )?\d\d:\d\d\)/.test(c.texte), 'le geste ATTEND et le dit : « ton ordinateur est éteint — partira dès qu’il revient (jusqu’à …) »', JSON.stringify(c));
    // « Annuler » : la rangée ouvre la feuille, son plein retire le geste (rien ne part).
    await pg.click(`[data-adist-cmd="${c && c.id}"]`).catch(() => {});
    await pg.waitForSelector('[data-adist-annuler]', { timeout: 5000 }).catch(() => {});
    await photo(pg, nom + '-2-annuler');
    await pg.click('[data-adist-annuler]').catch(() => {});
    await attendre(800);
    const r = cmdsBase().find((x) => x.data.geste === 'relire');
    dit(!!r && r.data.etat === 'annulee', '« Annuler ce geste » ⇒ la ligne passe « annulée » (sous condition), rien ne part', r && r.data.etat);
    ext.allume = true; presence(); await attendre(1500);
    dit(!ext.journal.some((j) => j.id === (r && r.id)), 'l’ordinateur revenu ne la prend JAMAIS', JSON.stringify(ext.journal.map((j) => j.geste)));
  } finally { arret(); await ctx.close().catch(() => {}); }
}

(async () => {
  if (!pw) { console.log('❌ Playwright introuvable'); process.exit(1); }
  if (!fs.existsSync(path.join(DIST0, 'index.html'))) { console.log(`❌ pas de build dans ${DIST0} — lance npm run build`); process.exit(1); }
  if (MUT && !MUTATIONS[MUT]) { console.log(`❌ mutation inconnue : ${MUT}`); process.exit(2); }
  const dirR = fs.mkdtempSync(path.join(TMP, 'regle-')); fs.writeFileSync(path.join(dirR, 'package.json'), '{"type":"module"}'); fs.copyFileSync(path.join(RACINE, 'src', 'aDistance.js'), path.join(dirR, 'aDistance.js'));
  R = await import(pathToFileURL(path.join(dirR, 'aDistance.js')).href);
  const DIST = preparerDist();
  M = monde({ tls: certificat(TMP), port: PORT, dist: DIST, comptes: {}, journal: [] });
  M.USERS.set(U.email, { id: U.id, email: U.email, mdp: U.mdp });
  try { await M.ecouter(); } catch (e) { console.log(`❌ le port ${PORT} est pris (${e.code}) — BANC_PORT=…`); process.exit(1); }
  const nav = await pw.chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--no-proxy-server', '--ignore-certificate-errors', `--host-resolver-rules=${regles()}`, '--use-angle=swiftshader'] });
  console.log(`app ${DIST}${MUT ? ` · MUTATION « ${MUT} »` : ''}${SANS_RT ? ' · temps réel REFUSÉ' : ' · temps réel simulé'}`);
  try {
    await parcours(nav, { mobile: true, sombre: false, nom: '390-clair' });
    if (!MUT && !process.env.UN) await parcours(nav, { mobile: true, sombre: true, nom: '390-sombre' });
    if (!process.env.UN) await parcours(nav, { mobile: false, sombre: false, nom: '1512-clair' });
    if (!process.env.UN) await eteint(nav, { mobile: true, sombre: false, nom: '390-eteint' });
  } finally { await nav.close().catch(() => {}); try { M.fermer && M.fermer(); } catch (_) {} try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {} }
  console.log('\nLatences mesurées (toucher → affiché) :');
  for (const m of mesures) console.log(`  ${m.nom.padEnd(12)} montré ${m.vu} ms · en cours ${m.pris} ms · fait ${m.fait} ms`);
  console.log(`\n${ok} verts, ${ko} rouges.`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
