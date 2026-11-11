// ════════════════════════════════════════════════════════════════════════════
//  ROBUSTESSE DE L'EXTENSION (5.356, 11 nov.) — les points « critique » et
//  « haute » de la revue `docs/passation/robustesse/extension.md`, chacun JOUÉ
//  sur le vrai code (`background.js` dans `_fond-vm.cjs`, le vrai `inject.js` et
//  le vrai `content.js` dans un faux monde de page) :
//   A. un geste part seulement de l'onglet du DOMAINE du compte (jamais d'un
//      onglet .com connecté à un autre compte) ;
//   B. le compte est revérifié au moment exact où la requête part (après
//      l'attente dans la file `requeteVinted`) ;
//   C. le moteur d'offres ne tourne jamais deux fois en même temps (verrou dans
//      `chrome.storage.local`, avec expiration) : chaque offre une fois ;
//   D. la réservation d'un N° est un comparer-et-échanger : deux Chrome ne
//      reçoivent jamais le même N° ; une réservation montrée n'expire pas en
//      rendant son N° (fond ET app, `numerosReserves`) ;
//   E. un message de page n'est cru que du canal privé inject.js ↔ content.js,
//      et le fond refuse un message qui ne vient pas d'un onglet Vinted ;
//   F. `sbGet` / `supabaseUpsert` : une base muette rend « pas su » au lieu de
//      bloquer tous les gestes ;
//   G. `storeHarvest` jette ce qui arrive si le compte a changé avant l'écriture ;
//   H. aucun clic synthétique (`.click()`) dans l'extension (§3) ;
//   I. la page ne lance plus aucune moisson hors de la file.
//  Usage : node scripts/audit-robustesse-extension.cjs [--ext dossier] [--app App.jsx] [--prouve]
//  `--ext` : un autre dossier d'extension (la preuve sur origin/main, §6.1) ;
//  `--prouve` : chaque mutation (règle réaffaiblie) doit rendre un rouge.
//  Aucune donnée réelle : tout est inventé (le dépôt est public).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), vm = require('vm'), path = require('path'), os = require('os');
const { MessageChannel } = require('worker_threads');
const { faireFond } = require('./_fond-vm.cjs');

const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? path.resolve(process.argv[i + 1]) : null; };
const EXT = arg('--ext') || path.join(__dirname, '..', 'vinted-sync-extension');
const APP = arg('--app') || (arg('--ext') ? path.join(arg('--ext'), '..', 'src', 'App.jsx') : path.join(__dirname, '..', 'src', 'App.jsx'));
const lire = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch (_) { return ''; } };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const UID = '111';

// ── C : la même conversation que audit-offres-sures (offre en attente) ──
function conv({ item, tx, oid, price, user = 500 }) {
  return { capturedAt: new Date().toISOString(), payload: { conversation: {
    id: 'c' + oid, description: 'Paire', opposite_user: { id: user, login: 'acheteur' }, transaction: { item_id: String(item) },
    messages: [{ entity_type: 'offer_request_message', entity: { user_id: user, current: true, status: 10, status_title: '', price: { amount: String(price), currency_code: 'EUR' }, transaction_id: Number(tx), offer_request_id: Number(oid) } }],
  } } };
}
const accepts = (f) => f.j.vinted.filter((v) => v.methode === 'PUT' && /\/offer_requests\/\d+\/accept$/.test(v.chemin)).length;

async function auditer(S) {
  const out = []; const dit = (bon, m, d) => out.push({ ok: !!bon, m, d });
  const fond = (o = {}) => faireFond({ src: S.bg, ...o });
  const essaie = async (nom, fn) => { try { await fn(); } catch (e) { dit(false, nom + ' — a levé', e && e.message); } };

  // ── A : l'onglet du domaine du compte ──
  await essaie('A', async () => {
    const acc = { vinted_user_id: UID, domain: 'www.vinted.fr', access_token: 'j' };
    const f = fond({ onglets: [{ id: 9, url: 'https://www.vinted.com/inbox', status: 'complete' }], vinted: () => ({ status: 200, body: {} }) });
    const r = await f.ctx.vintedPage(acc, 'PUT', '/api/v2/transactions/1/offer_requests/2/accept', null, { timeoutMs: 5000 });
    dit(f.j.vinted.length === 0 && r && r.ok === false && !!r.sansPage, 'A1 compte vinted.fr, seul un onglet vinted.com ouvert : RIEN ne part', JSON.stringify({ n: f.j.vinted.length, r: r && { ok: r.ok, sansPage: r.sansPage } }));
    const g = fond({ onglets: [{ id: 9, url: 'https://www.vinted.com/inbox', status: 'complete' }, { id: 10, url: 'https://www.vinted.fr/inbox', status: 'complete' }], vinted: () => ({ status: 200, body: {} }) });
    const r2 = await g.ctx.vintedPage(acc, 'PUT', '/api/v2/transactions/1/offer_requests/2/accept', null, { timeoutMs: 5000 });
    dit(g.j.vinted.length === 1 && r2 && r2.ok, 'A2 l’onglet vinted.fr est ouvert à côté : le geste part (de lui)', JSON.stringify({ n: g.j.vinted.length }));
  });

  // ── B : le compte revérifié au départ de la requête ──
  await essaie('B', async () => {
    let courant = UID;
    const f = fond({ vinted: () => ({ status: 200, body: {} }) });
    f.ctx.activeAccountId = async () => courant;
    f.ctx.activeUidForDomain = async () => courant;
    const acc = { vinted_user_id: UID, domain: 'www.vinted.fr', access_token: 'j' };
    let lacher; const tenu = new Promise((r) => { lacher = r; });
    const occupe = f.ctx.requeteVinted('api', () => tenu.then(() => ({ status: 200, ok: true })));   // une autre requête tient la file
    const geste = f.ctx.vintedPage(acc, 'PUT', '/api/v2/transactions/1/offer_requests/2/accept', null, { timeoutMs: 5000 });
    await attendre(20);
    courant = '222';                                     // il bascule de compte PENDANT l'attente
    lacher(); await occupe; const r = await geste;
    dit(f.j.vinted.length === 0 && r && r.ok === false, 'B1 compte changé pendant l’attente dans la file : le geste ne part pas', JSON.stringify({ n: f.j.vinted.length, sansPage: r && r.sansPage }));
    const g = fond({ vinted: () => ({ status: 200, body: {} }) });
    const rr = await g.envoyer({ from: 'vmr-bridge', action: 'exec', uid: UID, method: 'PUT', endpoint: '/api/v2/transactions/1/offer_requests/2/reject' }, { origin: 'https://vrm.center', url: 'https://vrm.center/' });
    dit(g.j.vinted.length === 1, 'B2 même compte : le geste de l’app part normalement', JSON.stringify({ n: g.j.vinted.length, rr }));
  });

  // ── C : un seul passage du moteur d'offres ──
  await essaie('C', async () => {
    const monter = (store = {}) => {
      const item = 444, tx = 9001, oid = 7001;
      const lignes = { [`harvest_${UID}_conv_${oid}`]: conv({ item, tx, oid, price: 45 }),
        main: { capturedAt: new Date().toISOString(), vinted_offres_auto: true, vinted_annonce_numeros: { [String(item)]: { num: '7', min: '40' } }, vinted_offre_refus_msg: '',
          vinted_offres_garde: { v: 1, at: Date.now(), items: [], complet: true, manques: [], ambigus: 0 } } };
      return fond({ lignes, store, connecte: UID, vinted: () => ({ status: 200, body: {} }) });
    };
    const due = (f) => { const pv = f.store.vrmOffresPrevues || {}; for (const k in pv) if (pv[k]) pv[k].at = Date.now() - 1000; };
    const f = monter();
    await f.ctx.autoAccepterOffres(UID); due(f);
    await Promise.all([f.ctx.autoAccepterOffres(UID), f.ctx.autoAccepterOffres(UID), f.ctx.autoAccepterOffres(UID)]);
    dit(accepts(f) === 1, 'C1 trois passages du moteur EN MÊME TEMPS : l’offre est acceptée UNE fois', `${accepts(f)} acceptation(s)`);
    const g = monter({ vrmOffresVerrou: { id: 'autre', jusqua: Date.now() + 5 * 60000 } });
    await g.ctx.autoAccepterOffres(UID); due(g); await g.ctx.autoAccepterOffres(UID);
    dit(accepts(g) === 0, 'C2 un passage vivant ailleurs (verrou rangé, pas expiré) : celui-ci ne fait rien', `${accepts(g)} acceptation(s)`);
    const h = monter({ vrmOffresVerrou: { id: 'mort', jusqua: Date.now() - 1000 } });
    await h.ctx.autoAccepterOffres(UID); due(h); await h.ctx.autoAccepterOffres(UID);
    dit(accepts(h) === 1 && !h.store.vrmOffresVerrou, 'C3 verrou d’un worker tué (expiré) : le moteur repart, et rend le verrou', JSON.stringify({ n: accepts(h), v: h.store.vrmOffresVerrou }));
  });

  // ── D : la réservation de N° (comparer-et-échanger, jamais réattribué) ──
  await essaie('D', async () => {
    const MAIN = () => ({ vinted_used_numeros: [1, 2, 3, 51, 52], vinted_annonce_numeros: { '10400000001': { numero: '73', accountId: UID } }, vinted_sale_overrides: {} });
    const tab = (id) => ({ tab: { id, url: 'https://www.vinted.fr/items/new' }, origin: 'https://www.vinted.fr', url: 'https://www.vinted.fr/items/new' });
    const demande = { from: 'cancale-vcapture', action: 'numeroPourPublier', domain: 'www.vinted.fr' };
    for (const existe of [false, true]) {
      const lignes = { main: MAIN() };
      if (existe) lignes.panel_num_reserves = { attente: {}, items: {} };
      const lent = (u) => (/panel_num_reserves/.test(u) ? 15 : 0);
      const a = fond({ lignes, retardLecture: lent }), b = fond({ lignes, retardLecture: lent });   // deux Chrome, UNE base
      const [ra, rb] = await Promise.all([a.envoyer(demande, tab(5)), b.envoyer(demande, tab(5))]);
      const att = Object.keys((lignes.panel_num_reserves || {}).attente || {});
      dit(ra && rb && ra.numero && rb.numero && ra.numero !== rb.numero && att.includes(ra.numero) && att.includes(rb.numero),
        `D${existe ? 2 : 1} deux Chrome réservent en même temps (ligne ${existe ? 'déjà là' : 'absente'}) : deux N° différents, tous deux réservés`, JSON.stringify({ a: ra && ra.numero, b: rb && rb.numero, att }));
    }
    const vieux = new Date(Date.now() - 5 * 3600e3).toISOString();
    const lignes = { main: MAIN(), panel_num_reserves: { attente: { 80: { at: vieux, uid: UID } }, items: {} } };
    const c = fond({ lignes });
    const rc = await c.envoyer(demande, tab(6));
    dit(rc && rc.numero === '81' && !!lignes.panel_num_reserves.attente['80'], 'D3 le N°80 montré il y a 5 h reste pris : le suivant est 81 (jamais 74)', JSON.stringify({ n: rc && rc.numero, att: Object.keys(lignes.panel_num_reserves.attente) }));
    const app = lire(S.app);
    const r = /\/\/ <reserves-num-regle>[\s\S]*?\/\/ <\/reserves-num-regle>/.exec(app);
    const cn = /const cleNum = \(v\) => \{[\s\S]*?\n\};/.exec(app);
    if (!r || !cn) { dit(false, 'D4 la règle numerosReserves de l’app existe'); }
    else {
      const ctx = {}; vm.runInNewContext(cn[0] + '\n' + r[0] + '\nthis.f = numerosReserves;', ctx);
      const o = ctx.f({ attente: { 80: { at: vieux } } }, Date.now());
      dit(o.cles.has('80'), 'D4 l’app (`numerosReserves`) garde aussi le N°80 réservé il y a 5 h', JSON.stringify([...o.cles]));
    }
  });

  // ── E : messages de page ──
  await essaie('E', async () => {
    const f = fond();
    const evil = { tab: { id: 3, url: 'https://evil.example/' }, url: 'https://evil.example/', frameId: 0 };
    await f.envoyer({ from: 'cancale-content', kind: 'vintedFrein', statut: 429, domain: 'www.vinted.fr' }, evil);
    await attendre(10);
    dit(!f.store.vrmPauseVinted, 'E1 le fond refuse un message « de page » venu d’un onglet hors Vinted (pas de pause forcée)', JSON.stringify(f.store.vrmPauseVinted || null));
    const g = fond();
    await g.envoyer({ from: 'cancale-content', kind: 'vintedFrein', statut: 429 }, { tab: { id: 3, url: 'https://www.vinted.fr/' }, url: 'https://www.vinted.fr/', frameId: 0 });
    await attendre(10);
    dit(!!g.store.vrmPauseVinted, 'E2 le même message venu d’un onglet vinted.fr est traité');
    // content.js dans un faux monde de page.
    const envois = [], ecoutes = {};
    const cw = {
      console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval, URL,
      location: { host: 'www.vinted.fr', hostname: 'www.vinted.fr', origin: 'https://www.vinted.fr', href: 'https://www.vinted.fr/' },
      document: { visibilityState: 'visible', cookie: '', addEventListener() {}, createElement: () => ({}), head: { appendChild() {} }, getElementById: () => null },
      addEventListener(t, fn) { (ecoutes[t] = ecoutes[t] || []).push(fn); }, postMessage() {},
      chrome: { runtime: { id: 'x', getURL: (p) => p, lastError: null, sendMessage(m, cb) { envois.push(m); if (typeof cb === 'function') cb(); }, onMessage: { addListener() {} } },
        storage: { local: { get(k, cb) { if (cb) cb({}); return Promise.resolve({}); }, set() { return Promise.resolve(); } }, onChanged: { addListener() {} } } },
    };
    cw.window = cw; vm.createContext(cw);
    vm.runInContext(lire(S.content), cw, { filename: 'content.js' });
    const win = vm.runInContext('window', cw);
    const emettre = (data, ports) => { for (const fn of (ecoutes.message || [])) fn({ source: win, origin: 'https://www.vinted.fr', data, ports: ports || [] }); };
    emettre({ __tag: 'CANCALE_VINTED', kind: 'label', url: '/api/v2/transactions/1/shipment/label', b64: 'JVBERi0x' });
    emettre({ __tag: 'CANCALE_VINTED', kind: 'harvest', type: 'orders', body: '{}' });
    await attendre(10);
    const faux = envois.filter((m) => m && m.from === 'cancale-content');
    dit(faux.length === 0, 'E3 content.js : un script de la page qui imite inject.js sur `window` n’est PAS relayé (faux bordereau, fausses ventes)', JSON.stringify(faux.map((m) => m.kind)));
    const mc = new MessageChannel();
    emettre({ __tag: 'CANCALE_VINTED_CANAL' }, [mc.port2]);
    mc.port1.postMessage({ __tag: 'CANCALE_VINTED', kind: 'csrf', csrf: 'tok' });
    await attendre(30);
    const bons = envois.filter((m) => m && m.from === 'cancale-content' && m.kind === 'csrf');
    const mc2 = new MessageChannel();
    emettre({ __tag: 'CANCALE_VINTED_CANAL' }, [mc2.port2]);                  // un second « canal » proposé par la page
    mc2.port1.postMessage({ __tag: 'CANCALE_VINTED', kind: 'label', b64: 'JVBERi0x', url: '/x' });
    await attendre(30);
    const vol = envois.filter((m) => m && m.from === 'cancale-content' && m.kind === 'label');
    dit(bons.length === 1 && vol.length === 0, 'E4 seul le canal remis le PREMIER (inject.js, au chargement) est relayé ; un second canal est ignoré', JSON.stringify({ bons: bons.length, vol: vol.length }));
    mc.port1.close(); mc2.port1.close();
    // inject.js : aucune donnée sur `window` (seul le port du canal y passe).
    const surWindow = [];
    const iw = {
      console: { log() {}, warn() {}, error() {} }, setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms || 0, 2)), clearTimeout, setInterval: () => 0, clearInterval,
      URL, Headers: class {}, MessageChannel, btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
      location: { host: 'www.vinted.fr', hostname: 'www.vinted.fr', origin: 'https://www.vinted.fr', href: 'https://www.vinted.fr/member/1' },
      document: { hidden: false, addEventListener() {} }, localStorage: { getItem: () => null, setItem() {} },
      addEventListener() {}, postMessage(data, o, ports) { surWindow.push({ data, ports: (ports || []).length }); },
      fetch: async () => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, text: async () => '{}', json: async () => ({}), clone() { return this; } }),
    };
    iw.window = iw; vm.createContext(iw);
    vm.runInContext(lire(S.inject), iw, { filename: 'inject.js' });
    await attendre(30);
    const donnees = surWindow.filter((x) => !(x.data && x.data.__tag === 'CANCALE_VINTED_CANAL' && x.ports === 1));
    dit(surWindow.length >= 1 && donnees.length === 0, 'E5 inject.js : rien ne passe sur `window` sauf le port du canal privé (la page ne lit ni n’imite rien)', JSON.stringify(donnees.map((x) => x.data && (x.data.kind || x.data.__tag))));
    for (const x of surWindow) { /* ports fermés avec le processus */ }
  });

  // ── F : une base muette ne bloque plus ──
  await essaie('F', async () => {
    const f = fond();
    const f0 = f.ctx.fetch;
    f.ctx.fetch = (u, o = {}) => (/\/rest\/v1\//.test(String(u)) ? new Promise((ok, ko) => { if (o.signal) o.signal.addEventListener('abort', () => ko(new Error('abort'))); }) : f0(u, o));
    const course = (p) => Promise.race([p.then((v) => ({ v })), attendre(1500).then(() => ({ pendu: true }))]);
    const lu = await course(f.ctx.sbGet('app_data?id=eq.main&select=data'));
    dit(!lu.pendu && lu.v === null, 'F1 `sbGet` sur une base qui ne répond pas : « pas su » (null), plus de blocage', JSON.stringify(lu));
    const ec = await course(f.ctx.supabaseUpsert('app_data', [{ id: 'panel_diag_banc', data: { x: 1 } }], 'id'));
    dit(!ec.pendu && ec.v === false, 'F2 `supabaseUpsert` sur une base qui ne répond pas : false, plus de blocage', JSON.stringify(ec));
  });

  // ── G : storeHarvest jette si le compte a changé ──
  await essaie('G', async () => {
    const f = fond();
    let n = 0; f.ctx.activeAccountId = async () => (n++ === 0 ? UID : '222');
    await f.ctx.storeHarvest('www.vinted.fr', 'transaction', '123', JSON.stringify({ transaction: { id: 123, item_id: 5, status: 200, status_title: 'x' } }), '/api/v2/transactions/123', 7, 'GET', 200);
    dit(!f.lignes[`harvest_${UID}_txn_123`] && !f.lignes['harvest_222_txn_123'], 'G1 compte changé avant l’écriture : rien n’est rangé (ni sous l’ancien, ni sous le nouveau)', JSON.stringify(Object.keys(f.lignes)));
    const g = fond();
    await g.ctx.storeHarvest('www.vinted.fr', 'transaction', '123', JSON.stringify({ transaction: { id: 123, item_id: 5, status: 200, status_title: 'x' } }), '/api/v2/transactions/123', 7, 'GET', 200);
    dit(!!g.lignes[`harvest_${UID}_txn_123`], 'G2 même compte : la transaction est rangée');
  });

  // ── H : aucun clic synthétique ──
  {
    const fichiers = fs.readdirSync(path.dirname(S.bg)).filter((x) => /\.js$/.test(x));
    const avec = fichiers.filter((x) => /\.click\(\)/.test(sansCommentaires(lire(path.join(path.dirname(S.bg), x)))) && /^(background|inject|content|vinted-capture|vinted-infos)\.js$/.test(x));
    const avecMut = [S.bg, S.inject].filter((p) => /\.click\(\)/.test(sansCommentaires(lire(p))));
    dit(avec.length === 0 && avecMut.length === 0, 'H1 aucun `.click()` synthétique sur vinted.fr (background, inject, content, capture, infos) — §3', JSON.stringify(avec.concat(avecMut.map((p) => path.basename(p)))));
  }

  // ── I : la page ne moissonne plus hors file ──
  await essaie('I', async () => {
    const appels = [];
    const pw = {
      console: { log() {}, warn() {}, error() {} }, setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms || 0, 2)), clearTimeout, setInterval: () => 0, clearInterval,
      URL, Headers: class {}, btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
      location: { host: 'www.vinted.fr', hostname: 'www.vinted.fr', origin: 'https://www.vinted.fr', href: 'https://www.vinted.fr/member/1' },
      document: { hidden: false, addEventListener() {} }, localStorage: { getItem: () => null, setItem() {} },
      addEventListener() {}, postMessage() {},
      fetch: async (u) => { appels.push(String(u)); return { ok: true, status: 200, headers: { get: () => 'application/json' }, text: async () => '{"user":{"id":1}}', json: async () => ({ user: { id: 1 } }), clone() { return this; } }; },
    };
    pw.window = pw; vm.createContext(pw);
    vm.runInContext(lire(S.inject), pw, { filename: 'inject.js' });
    await attendre(250);
    dit(appels.length === 0, 'I1 la page ne lance AUCUNE requête Vinted d’elle-même (la lecture passe par la file du fond)', `${appels.length} : ${appels.slice(0, 4).join(' · ')}`);
  });
  return out;
}

// ── Mutations : la règle réaffaiblie doit rendre un rouge ──
const MUTATIONS = {
  onglet_quelconque: { f: 'bg', m: (s) => s.replace("const tab = (tabs || []).find((t) => ongletDuDomaine(t, domaine));", "const tab = (tabs || []).find((t) => ongletEstVinted(t) && t.status === 'complete');"), attendu: 'A1' },
  compte_pas_revu: { f: 'bg', m: (s) => s.replace("if (!actif || !acc || acc.vinted_user_id == null || String(actif) !== String(acc.vinted_user_id)) { noterDiag('page_compte_change'); return { refus: 'compte' }; }", ''), attendu: 'B1' },
  sans_verrou: { f: 'bg', m: (s) => s.replace("if (v && Number(v.jusqua) > t) return null;", ''), attendu: 'C1' },
  memo_pas_relu: { f: 'bg', m: (s) => s.replace("if (v && Number(v.jusqua) > t) return null;", '').replace("if (stFrais[o.oid]) { st[o.oid] = stFrais[o.oid]; continue; }", ''), attendu: 'C1' },
  ecriture_aveugle: { f: 'bg', m: (s) => s.replace("const cond = rev0 == null ? 'data->>rev=is.null' : `data->>rev=eq.${rev0}`;", "const cond = 'select=id';").replace("Prefer: 'resolution=ignore-duplicates,return=representation'", "Prefer: 'resolution=merge-duplicates,return=representation'"), attendu: 'D' },
  attente_expire: { f: 'bg', m: (s) => s.replace("for (const n of Object.keys((resa && resa.attente) || {})) add(n);", "for (const [n, v] of Object.entries((resa && resa.attente) || {})) { const at = Date.parse((v && v.at) || ''); if (!isNaN(at) && t - at < RESA_ATTENTE_MS) add(n); }"), attendu: 'D3' },
  app_attente_expire: { f: 'app', m: (s) => s.replace("{ const c = cleNum(n); if (c) out.cles.add(c); }\n  }\n  for (const [id, v] of Object.entries((data.items", "{ const at = Date.parse((v && v.at) || ''); const c = cleNum(n); if (c && !isNaN(at) && t - at < RESA_ATTENTE_MS) out.cles.add(c); }\n  }\n  for (const [id, v] of Object.entries((data.items"), attendu: 'D4' },
  page_crue: { f: 'content', m: (s) => s.replace("      if (canal || event.source !== window || event.origin !== location.origin) return;\n      const d = event.data;\n      if (!d || d.__tag !== 'CANCALE_VINTED_CANAL' || !event.ports || !event.ports[0]) return;", "      const d = event.data;\n      if (d && d.__tag === 'CANCALE_VINTED') { for (const f of recus) f(d); return; }\n      if (canal || event.source !== window || event.origin !== location.origin) return;\n      if (!d || d.__tag !== 'CANCALE_VINTED_CANAL' || !event.ports || !event.ports[0]) return;"), attendu: 'E3' },
  second_canal: { f: 'content', m: (s) => s.replace("      if (canal || event.source !== window", "      if (event.source !== window"), attendu: 'E4' },
  fond_crédule: { f: 'bg', m: (s) => s.replace("if (!h || !VINTED_HOTE.test(h.replace(/:\\d+$/, ''))", "if (!h"), attendu: 'E1' },
  sans_delai: { f: 'bg', m: (s) => s.replace("headers: {apikey:SUPABASE_KEY,Authorization:`Bearer ${session.access_token}`}, signal: signalDelai(SB_DELAI_LECTURE_MS) });", "headers: {apikey:SUPABASE_KEY,Authorization:`Bearer ${session.access_token}`} });"), attendu: 'F1' },
  ecriture_sans_delai: { f: 'bg', m: (s) => s.replace("      signal: signalDelai(SB_DELAI_ECRITURE_MS),\n", ''), attendu: 'F2' },
  compte_lu_au_debut: { f: 'bg', m: (s) => s.replace("{ const encore = await activeAccountId(domain); if (!encore || String(encore) !== String(uid)) { noterDiag('moisson_compte_change'); return; } }", ''), attendu: 'G1' },
  clic_remis: { f: 'bg', m: (s) => s.replace("if(activer&&!ouverte){b.scrollIntoView({block:'center'});", "if(activer&&!ouverte){b.click();b.scrollIntoView({block:'center'});"), attendu: 'H1' },
};

function sources(dossier) {
  return { bg: path.join(dossier, 'background.js'), inject: path.join(dossier, 'inject.js'), content: path.join(dossier, 'content.js'), app: APP };
}
function afficher(res) {
  let ko = 0;
  for (const r of res) { if (!r.ok) ko++; console.log(`${r.ok ? '✅' : '❌'} ${r.m}${!r.ok && r.d ? ' — ' + r.d : ''}`); }
  return ko;
}

(async () => {
  const S = sources(EXT);
  const res = await auditer(S);
  let ko = afficher(res);
  if (process.argv.includes('--prouve')) {
    console.log('\n── mutations (chacune doit rendre un rouge)');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'robustesse-ext-'));
    for (const [nom, mu] of Object.entries(MUTATIONS)) {
      const S2 = { ...S };
      const orig = lire(S[mu.f]); const mute = mu.m(orig);
      if (mute === orig) { ko++; console.log(`❌ mutation ${nom} : le texte visé n'existe plus`); continue; }
      const f = path.join(tmp, nom + '-' + path.basename(S[mu.f])); fs.writeFileSync(f, mute); S2[mu.f] = f;
      const r = await auditer(S2);
      const rouges = r.filter((x) => !x.ok).map((x) => x.m.split(' ')[0]);
      const pris = rouges.some((x) => x.startsWith(mu.attendu));
      if (!pris) ko++;
      console.log(`${pris ? '✅' : '❌'} mutation ${nom} ⇒ rouge ${mu.attendu}${pris ? '' : ' (rouges : ' + rouges.join(',') + ')'}`);
    }
  }
  console.log(ko ? `\n❌ robustesse de l'extension : ${ko} rouge(s)` : `\n✅ robustesse de l'extension : tout est vert`);
  process.exit(ko ? 1 : 0);
})();
