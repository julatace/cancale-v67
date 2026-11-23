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
// Le design de PRODUCTION (la garde des bancs montrerait sinon le DOM d’avant le 17 nov., scripts/bancs/_garde-reseau.cjs).
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';
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
const LBC = '777001', PDF_B64 = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n' + 'x'.repeat(200)).toString('base64');
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
  app.push({ id: `harvest_${B}_orders_sold`, owner: U.id, updated_at: iso(t), data: { uid: B, type: 'orders_sold', capturedAt: iso(t - 3 * 86400000), payload: { my_orders: [] } } });
  // Le miroir : 3 annonces (une masquée, une vendue qui ne se montre pas), 3 ventes (à envoyer avec PDF, à envoyer sans, en route,
  // terminée), un bordereau rangé avec son PDF ; un compte Leboncoin, une annonce, une conversation.
  const item = (id, title, prix, plus = {}) => ({ id: Number(id), title, size: '42', price: { amount: String(prix), currency_code: 'EUR' }, is_hidden: false, is_closed: false, is_draft: false, is_reserved: false, photo: { url: 'https://images1.vinted.net/t/' + id + '.jpg' }, ...plus });
  app.push({ id: `harvest_${A}_listings`, owner: U.id, updated_at: iso(t), data: { uid: A, type: 'listings', nItems: 3, capturedAt: iso(t - 4 * 60000), payload: { code: 0, pagination: {}, items: [
    item('91010001', 'Nike P-6000 noire', 85), item('91010002', 'Adidas Samba blanche', 60, { is_hidden: true }), item('91010003', 'Asics Gel-1130', 70, { is_closed: true })] } } });
  const order = (tx, title, status, tus, prix) => ({ transaction_id: Number(tx), title, status, transaction_user_status: tus, price: { amount: String(prix), currency_code: 'EUR' }, date: iso(t - 86400000), photo: { url: 'https://images1.vinted.net/t/o' + tx + '.jpg' }, conversation_id: 7300001 });
  app.push({ id: `harvest_${A}_orders_sold`, owner: U.id, updated_at: iso(t), data: { uid: A, type: 'orders_sold', capturedAt: iso(t - 3 * 60000), payload: { order_details_enabled: true, pagination: {}, my_orders: [
    order('8800101', 'Nike Dunk Low', 'Bordereau envoyé au vendeur', 'needs_action', 95), order('8800102', 'New Balance 550', 'Bordereau envoyé au vendeur', 'needs_action', 80),
    order('8800103', 'Puma Suede', 'Colis expédié', 'waiting', 50), order('8800104', 'Vans Old Skool', 'Commande finalisée', 'completed', 40)] } } });
  app.push({ id: `harvest_${A}_label_8800101`, owner: U.id, updated_at: iso(t), data: { uid: A, tx: '8800101', capturedAt: iso(t - 3600000), pdfB64: PDF_B64 } });
  app.push({ id: 'lbc_accounts', owner: U.id, updated_at: iso(t), data: { accounts: { ['lbc-account:' + LBC]: { id: 'lbc-account:' + LBC, name: 'boutique_lbc', seenAt: iso(t - 60000), sessionAt: iso(t - 60000) } } } });
  app.push({ id: 'lbc_listings', owner: U.id, updated_at: iso(t), data: { updatedAt: iso(t - 5 * 60000), lectures: { [LBC]: { at: iso(t - 5 * 60000) } }, items: { '2900000001': { id: '2900000001', ref: 'B125', price: 120, status: 'active', subject: 'Jordan 4 Retro', images: ['https://images1.vinted.net/t/lbc.jpg'], seenAt: iso(t - 5 * 60000) } } } });
  app.push({ id: 'lbc_fil_conv-lbc-1', owner: U.id, updated_at: iso(t), data: { n: 2, dernierAt: iso(t - 10 * 60000), apercu: 'Bonjour, encore dispo ?', dernierDeMoi: false, compte: 'lbc-account:' + LBC, updatedAt: iso(t - 10 * 60000),
    messages: [{ t: 'Bonjour, encore dispo ?', at: t - 12 * 60000, deMoi: false }, { t: 'Je peux passer samedi', at: t - 10 * 60000, deMoi: false }] } });
  // 5.438 (`santenote`) : la note publiée par l'extension dans la ligne de la jauge de boutique_a (forme de `resumeNote`).
  app.push({ id: `actions_compte_${A}_${APP}`, owner: U.id, updated_at: iso(t), data: { uid: A, nav: APP, ts: [], at: iso(t - 4 * 60000), max: 50,
    note: { n: 70, pct: 60, at: t - 4 * 60000, pts: [{ k: 'captcha', n24: 2, n72: 2, r: 30 }], manque: ['vues'], cap: 30, fav: 9, reglage: { actionsHeure: 50, favorisHeure: 15 }, reduite: true, par: ['note'], prec: false, ph: 'reduite', raison: { k: 'captcha', n: 2, h: 24 } } } });
  presence();
}
// La présence de l'ordinateur simulé (la forme de `publierPresence`, background.js).
function presence() {
  const t = Date.now();
  const app = M.st.tables.app_data;
  const atMs = ext.allume ? t : t - 2 * 3600000;
  const data = { v: 1, at: new Date(atMs).toISOString(), atMs, ver: '5.436.0', code: '5.436.0', appareil: { paquet: 'chromium', nav: 'chrome', systeme: 'mac' },
    comptes: [{ site: 'vinted', id: A, nom: 'boutique_a' }, { site: 'leboncoin', id: LBC, nom: '' }], retenues: [], enCours: '', rt: SANS_RT ? 'refuse' : 'joint', lus: {} };
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
      localStorage.setItem('vrm_design_v2', '1');   // le design de production (sinon le harnais montre le DOM d’avant le 17 nov.)
      localStorage.setItem('vinted_annonce_numeros', JSON.stringify({ '91010001': { numero: '134', min: '80', accountId: '41000001', title: 'Nike P-6000 noire' }, '91010002': { numero: '135', accountId: '41000001', title: 'Adidas Samba blanche' } }));
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
    let e = await attendreEcran(pg, (x) => x.ordis === 'allume' && x.comptes.length >= 2 && x.comptes.some((c) => c.vieux === '1') && (SANS_RT || x.trt === 'joint'), 60000, 300);
    await attendre(500); await photo(pg, nom + '-1-accueil');
    dit(!!e && e.ordis === 'allume' && e.ordi.some((o) => o.allume === '1' && /Chrome · Mac est allumé · boutique_a/.test(o.texte)), '« Chrome · Mac est allumé · boutique_a »', JSON.stringify(e && e.ordi));
    dit(!!e && (SANS_RT ? e.trt === 'sondage' : e.trt === 'joint'), SANS_RT ? 'temps réel refusé : c’est DIT (« toutes les 2 s »)' : 'temps réel joint : « Instantané »', JSON.stringify(e && { rt: e.rt, trt: e.trt }));
    const ca = e && e.comptes.find((c) => c.id === 'vinted:' + A), cb = e && e.comptes.find((c) => c.id === 'vinted:' + B);
    dit(!!ca && ca.ouvert === '1' && ca.vieux === '0', 'boutique_a : ouvert sur l’ordinateur, relu récemment', JSON.stringify(ca));
    dit(!!cb && cb.vieux === '1' && /Pas relu/.test(cb.texte), 'atelier_b : « Pas relu · il y a 3 jours » en ambre', JSON.stringify(cb));
    // 5.438 : la note de santé sur la rangée (la plus fraîche publiée par l'extension) ; atelier_b n'en a pas ⇒ rien d'inventé.
    dit(!!ca && /Santé 70\/100/.test(ca.texte) && /cadence 30\/h/.test(ca.texte) && !!cb && !/Santé \d/.test(cb.texte), '5.438 : « Santé 70/100 · cadence 30/h » sur boutique_a ; atelier_b sans note publiée : rien d’inventé', JSON.stringify({ a: ca && ca.texte, b: cb && cb.texte }));
    dit(!!e && e.deborde <= 0 && (!mobile || !e.petites.length), 'aucun débordement ; cibles ≥ 44 px', JSON.stringify(e && { d: e.deborde, p: e.petites.slice(0, 4) }));
    dit(!!e && !TECHNIQUES.test(e.texte), 'aucun mot technique ni « undefined » dans le texte rendu', e && (e.texte.match(TECHNIQUES) || [])[0]);
    // ── un compte → sa boîte → le fil → répondre (UN toucher pour envoyer)
    await pg.click(`[data-adist-compte="vinted:${A}"]`);
    await pg.waitForSelector(`[data-adist-conv="${CONV}"]`, { timeout: 15000 }).catch(() => {});
    await attendre(400); await photo(pg, nom + '-2-compte');
    { const n = await pg.evaluate(() => { const g = document.querySelector('[data-adist-note]'); return g ? { n: g.getAttribute('data-adist-note'), t: (g.innerText || '').replace(/\s+/g, ' '), pt: !!g.querySelector('[data-adist-note-point="captcha"]'), mq: !!g.querySelector('[data-adist-note-manque="vues"]') } : null; });
      dit(!!n && n.n === '70' && n.pt && n.mq && /Cadence réduite à 30\/h/.test(n.t) && /2 vérification/.test(n.t), '5.438 : la page du compte : « Santé du compte · Note 70/100 · Cadence réduite à 30/h : 2 vérification(s) demandée(s) en 24 h », le point, les vues pas comptées', JSON.stringify(n)); }
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

async function miroir(nav, { mobile, sombre, nom }) {
  console.log(`\n── ${nom}`);
  ext.allume = true; ext.vus.clear(); semer();
  const ctx = await contexte(nav, { mobile, sombre }); const pg = await ctx.newPage();
  const arret = diffuseur(pg);
  if (process.env.DEBUG) { pg.on('pageerror', (e) => console.log('   PAGEERROR', String(e).slice(0, 300))); pg.on('console', (m) => { if (m.type() === 'error') console.log('   CONSOLE', m.text().slice(0, 300)); }); pg.on('requestfinished', (q) => { if (/presence_|cmd_dist/.test(q.url())) console.log('   REQ', decodeURIComponent(q.url()).slice(50, 160)); }); pg.on('response', async (r) => { if (r.status() >= 400) console.log('   HTTP', r.status(), r.url().slice(0, 140)); if (/orders_sold/.test(r.url()) && /x0:/.test(decodeURIComponent(r.url()))) { let t = ''; try { t = await r.text(); } catch (_) {} console.log('   VENTES', r.status(), t.slice(0, 300)); } }); }
  const derniere = () => cmdsBase().sort((a, b) => b.data.demandeLe - a.data.demandeLe)[0];
  const attendreLigne = async (fn, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const r = cmdsBase().find(fn); if (r) return r; await attendre(50); } return null; };
  try {
    // Aujourd'hui : « Ton ordinateur … » en UN toucher vers Mes comptes.
    await pg.goto('https://vrm.center/?tab=journee', { waitUntil: 'domcontentloaded' });
    if (process.env.DEBUG) { await attendre(12000); console.log('   DOM', JSON.stringify(await pg.evaluate(() => ({ v2: !!document.querySelector('[data-v2-ecran="aujourdhui"]'), jour: !!document.querySelector('[data-adist-jour]'), colonnes: document.querySelectorAll('[data-v2-ecran="aujourdhui"] .n-colonne, [data-v2-ecran="aujourdhui"] [class*=colonne]').length, inert: !!document.querySelector('[inert]'), html: [...new Set([...document.querySelectorAll('#vrm-contenu [data-v2-ecran], #vrm-contenu [data-jv2], #vrm-contenu [class*="jv2"], #vrm-contenu [data-espace]')].map((x) => x.tagName + '.' + String(x.className).slice(0, 40) + JSON.stringify(Object.keys(x.dataset).slice(0, 4))))].slice(0, 12), tab: location.search, anc: localStorage.getItem('vrm_banc_dom_ancien'), des: document.documentElement.getAttribute('data-design'), v2k: localStorage.getItem('vrm_design_v2') })))); }
    const ok1 = await pg.waitForSelector('[data-adist-jour-rangee]', { timeout: 60000 }).then(() => true).catch(() => false);
    const txt = ok1 ? (await pg.innerText('[data-adist-jour-rangee]').catch(() => '')).replace(/\s+/g, ' ') : '';
    await photo(pg, nom + '-0-aujourdhui');
    dit(ok1 && /Ton ordinateur \(Chrome · Mac\) est allumé · 2 comptes/.test(txt), 'Aujourd’hui : « Ton ordinateur (Chrome · Mac) est allumé · 2 comptes »', txt);
    await pg.click('[data-adist-jour-rangee]').catch(() => {});
    const ok2 = await pg.waitForSelector('[data-ecran-adistance]', { timeout: 15000 }).then(() => true).catch(() => false);
    dit(ok2, '… UN toucher ouvre « Mes comptes »');
    await attendreEcran(pg, (x) => x.ordis === 'allume' && x.comptes.length >= 3, 30000, 200);
    // ── ANNONCES d'un compte Vinted
    await pg.click(`[data-adist-compte="vinted:${A}"]`);
    await pg.click('[data-adist-vue="annonces"]', { timeout: 10000 }).catch(() => {});
    await pg.waitForSelector('[data-adist-annonce="91010001"]', { timeout: 15000 }).catch(() => {});
    await attendre(500); await photo(pg, nom + '-7-annonces');
    const ann = await pg.evaluate(() => [...document.querySelectorAll('[data-adist-annonce]')].map((x) => ({ id: x.getAttribute('data-adist-annonce'), etat: x.getAttribute('data-adist-annonce-etat'), t: (x.innerText || '').replace(/\s+/g, ' ') }))).catch(() => []);
    const a1 = ann.find((x) => x.id === '91010001'), a2 = ann.find((x) => x.id === '91010002');
    dit(ann.length === 2 && a1 && /N°134/.test(a1.t) && /85,00/.test(a1.t) && a1.etat === 'enligne' && a2 && a2.etat === 'masquee' && !ann.some((x) => x.id === '91010003'),
      'les annonces DU compte : N° (par identité), prix, en ligne / masquée ; la vendue n’y est pas', JSON.stringify(ann));
    // Changer le prix : 2 touchers (la rangée, « Changer le prix ») + le prix + « Passer de … à … ».
    await pg.click('[data-adist-annonce="91010001"]');
    await pg.click('[data-adist-annonce-prix="91010001"]', { timeout: 5000 }).catch(() => {});
    await pg.waitForSelector('[data-adist-prix-saisie]', { timeout: 5000 }).catch(() => {});
    await pg.fill('[data-adist-prix-saisie]', '75');
    await attendre(300); await photo(pg, nom + '-8-prix-plancher');
    const bloque = await pg.evaluate(() => { const b = document.querySelector('[data-adist-prix-envoyer]'); return b ? { dis: b.disabled || b.getAttribute('aria-disabled') === 'true', t: (b.closest('.n-feuille, [role="dialog"]') || document.body).innerText.replace(/\s+/g, ' ') } : null; }).catch(() => null);
    dit(!!bloque && bloque.dis && /Sous ton plancher \(80,00/.test(bloque.t) && /Ton prix mini : 80,00/.test(bloque.t), '75 € sous le prix mini (80 €) : pas envoyé, et c’est dit', JSON.stringify(bloque).slice(0, 300));
    const n0 = cmdsBase().length;
    await pg.click('[data-adist-prix-envoyer]').catch(() => {});
    await attendre(300);
    dit(cmdsBase().length === n0, '… aucun geste ne part sous le plancher', cmdsBase().length - n0);
    await pg.fill('[data-adist-prix-saisie]', '81');
    await pg.click('[data-adist-prix-envoyer]').catch(() => {});
    const lp = await attendreLigne((r) => r.data.geste === 'prix');
    dit(!!lp && lp.data.args.id === '91010001' && lp.data.args.prix === 81 && lp.data.args.prixAvant === 85 && lp.data.avant === 85 && lp.data.num === '134' && lp.data.compte === A, 'Passer de 85 € à 81 € ⇒ UNE commande `prix` (prix vu 85, N°134, ce compte)', JSON.stringify(lp && lp.data.args));
    const e1 = await attendreEcran(pg, (x) => x.cmds.some((c) => c.geste === 'prix' && c.etat === 'fait'), 10000, 50);
    dit(!!e1 && e1.cmds.some((c) => c.geste === 'prix' && /Prix changé : 85,00 € → 81,00 €/.test(c.texte)), '« Prix changé : 85,00 € → 81,00 € » (avant → après)', JSON.stringify(e1 && e1.cmds.filter((c) => c.geste === 'prix')));
    // Masquer / afficher : UN toucher dans la feuille.
    await pg.click('[data-adist-annonce="91010002"]').catch(() => {});
    await pg.click('[data-adist-annonce-masquer]', { timeout: 5000 }).catch(() => {});
    const lm = await attendreLigne((r) => r.data.geste === 'afficher');
    dit(!!lm && lm.data.args.id === '91010002', 'une annonce masquée ⇒ « Afficher » en UN toucher (commande `afficher`)', JSON.stringify(lm && lm.data));
    // Republier : le destructif DEMANDE un 2e toucher.
    await attendre(400);
    await pg.click('[data-adist-annonce="91010001"]').catch(() => {});
    await pg.waitForSelector('[data-adist-annonce-republier]', { timeout: 5000 }).catch(() => {});
    await photo(pg, nom + '-9-annonce');
    const nR = cmdsBase().length;
    await pg.click('[data-adist-annonce-republier]').catch(() => {});
    await attendre(300);
    const avant2 = cmdsBase().length;
    await pg.click('[data-adist-annonce-republier]').catch(() => {});
    const lr = await attendreLigne((r) => r.data.geste === 'republier');
    dit(avant2 === nR && !!lr && lr.data.confirme === true && lr.data.args.id === '91010001', 'Republier : rien au 1er toucher, la commande confirmée au 2e', { avant2: avant2 - nR, lr: !!lr });
    // ── VENTES
    await attendre(400);
    await pg.click('[data-adist-vue="ventes"]').catch(() => {});
    await pg.waitForSelector('[data-adist-vente="8800101"]', { timeout: 15000 }).catch(() => {});
    await attendre(500); await photo(pg, nom + '-10-ventes');
    const ven = await pg.evaluate(() => [...document.querySelectorAll('[data-adist-vente]')].map((x) => ({ tx: x.getAttribute('data-adist-vente'), g: x.getAttribute('data-adist-vente-groupe'), pdf: x.getAttribute('data-adist-vente-pdf') }))).catch(() => []);
    dit(ven.length === 2 && ven.every((v) => v.g === 'envoyer') && ven.find((v) => v.tx === '8800101').pdf === '1' && ven.find((v) => v.tx === '8800102').pdf === '0', 'À envoyer : les 2 ventes du compte, le bordereau rangé est vu (sans lire le PDF)', JSON.stringify(ven));
    await pg.click('[data-adist-ventes-seg="route"]').catch(() => {}); await attendre(300);
    const route = await pg.evaluate(() => [...document.querySelectorAll('[data-adist-vente]')].map((x) => x.getAttribute('data-adist-vente'))).catch(() => []);
    await pg.click('[data-adist-ventes-seg="terminees"]').catch(() => {}); await attendre(300);
    const fin = await pg.evaluate(() => [...document.querySelectorAll('[data-adist-vente]')].map((x) => x.getAttribute('data-adist-vente'))).catch(() => []);
    dit(route.join() === '8800103' && fin.join() === '8800104', 'En route / Terminées : chacune à sa place', JSON.stringify({ route, fin }));
    await pg.click('[data-adist-ventes-seg="envoyer"]').catch(() => {}); await attendre(300);
    // Le PDF revient SUR CE TÉLÉPHONE : une nouvelle fenêtre avec le fichier.
    await pg.click('[data-adist-vente="8800101"]').catch(() => {});
    await pg.waitForSelector('[data-adist-bord-ouvrir="8800101"]', { timeout: 5000 }).catch(() => {});
    const popup = ctx.waitForEvent('page', { timeout: 8000 }).catch(() => null);
    await pg.click('[data-adist-bord-ouvrir="8800101"]').catch(() => {});
    const w = await popup;
    let url = ''; if (w) { await attendre(1200); url = w.url(); }
    dit(!!w && /^blob:https:\/\/vrm\.center\//.test(url), '« Ouvrir le bordereau » : le PDF s’ouvre sur ce téléphone (fichier lu dans SA base)', url);
    if (w) await w.close().catch(() => {});
    await pg.keyboard.press('Escape').catch(() => {}); await attendre(400);
    await pg.click('[data-adist-vente="8800102"]').catch(() => {});
    await pg.click('[data-adist-bord-generer="8800102"]', { timeout: 5000 }).catch(() => {});
    const lb = await attendreLigne((r) => r.data.geste === 'bordereau');
    dit(!!lb && lb.data.args.tx === '8800102', 'sans PDF : « Générer le bordereau » ⇒ commande `bordereau` (l’ordinateur le génère)', JSON.stringify(lb && lb.data.args));
    await pg.keyboard.press('Escape').catch(() => {}); await attendre(400);
    await pg.locator('button', { hasText: 'Mes comptes' }).last().click({ timeout: 5000 }).catch(() => {}); await attendre(600);
    // ── LEBONCOIN : boîte, fil, répondre ; annonces avec « Changer le prix »
    await pg.click(`[data-adist-compte="leboncoin:${LBC}"]`).catch(() => {});
    await pg.waitForSelector('[data-adist-conv="conv-lbc-1"]', { timeout: 15000 }).catch(() => {});
    await pg.click('[data-adist-conv="conv-lbc-1"]').catch(() => {});
    await pg.waitForSelector('[data-adist-saisie]', { timeout: 10000 }).catch(() => {});
    await attendre(300); await photo(pg, nom + '-11-lbc-fil');
    await pg.fill('[data-adist-saisie]', 'Oui, samedi ça marche.').catch(() => {});
    await pg.click('[data-adist-envoyer]').catch(() => {});
    const ll = await attendreLigne((r) => r.data.geste === 'repondre' && r.data.site === 'leboncoin');
    dit(!!ll && ll.data.compte === LBC && ll.data.args.conv === 'conv-lbc-1', 'Leboncoin : la conversation DU compte, répondre ⇒ commande `repondre` Leboncoin, à ce compte', JSON.stringify(ll && ll.data));
    await pg.locator('button', { hasText: 'boutique_lbc' }).last().click({ timeout: 5000 }).catch(() => {}); await attendre(500);
    await pg.click('[data-adist-vue="annonces"]').catch(() => {});
    const okL = await pg.waitForSelector('[data-adist-annonce="2900000001"]', { timeout: 10000 }).then(() => true).catch(() => false);
    await photo(pg, nom + '-12-lbc-annonces');
    dit(okL, 'Leboncoin : ses annonces (un seul compte relié : elles sont à lui)');
    const e = await lireEcran(pg);
    dit(!!e && e.deborde <= 0 && (!mobile || !e.petites.length), 'miroir : aucun débordement ; cibles ≥ 44 px', JSON.stringify(e && { d: e.deborde, p: e.petites.slice(0, 4) }));
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
    if (process.env.UN !== 'miroir') await parcours(nav, { mobile: true, sombre: false, nom: '390-clair' });
    if (!MUT && !process.env.UN) await parcours(nav, { mobile: true, sombre: true, nom: '390-sombre' });
    if (!process.env.UN) await parcours(nav, { mobile: false, sombre: false, nom: '1512-clair' });
    if (!process.env.UN) await eteint(nav, { mobile: true, sombre: false, nom: '390-eteint' });
    if (!process.env.UN || process.env.UN === 'miroir') await miroir(nav, { mobile: true, sombre: false, nom: '390-miroir' });
    if (!process.env.UN && !MUT) await miroir(nav, { mobile: false, sombre: false, nom: '1512-miroir' });
  } finally { await nav.close().catch(() => {}); try { M.fermer && M.fermer(); } catch (_) {} try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {} }
  console.log('\nLatences mesurées (toucher → affiché) :');
  for (const m of mesures) console.log(`  ${m.nom.padEnd(12)} montré ${m.vu} ms · en cours ${m.pris} ms · fait ${m.fait} ms`);
  console.log(`\n${ok} verts, ${ko} rouges.`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
