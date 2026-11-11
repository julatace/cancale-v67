// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : « COMPTE VINTED PAS RELU » — node scripts/audit-compte-pas-relu.cjs [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// (5 nov.) Un compte Vinted gardé dans les totaux, pas relu depuis plus de 24 h :
// UNE notification par jour au plus, au passage du matin du cron, qui nomme le(s)
// compte(s) et le geste (ouvrir vinted.fr sur ce compte, dans le navigateur où
// est l'extension VRM). Règle : api/_lib/comptes-a-relire.js ; cron :
// api/ship-reminders.js (`rappelComptesARelire`), sans nouvelle fonction `api/`.
//
// Il EXÉCUTE (§4.10) :
//   A. la règle seule — à relire (> 24 h) nommé ; lu ⇒ rien ; jamais daté ⇒ rien
//      (pas su) ; masqué, masqué au panneau, banni, supprimé ⇒ jamais nommé ;
//      rallumé au panneau ⇒ nommé ; `_enligne` (lecture publique faite depuis un
//      autre compte) ne rend pas un compte frais ; `capturedAt` prime sur
//      `updated_at` ; une entrée illisible ⇒ `null` (pas su) ; le texte nomme le
//      compte et le geste, jamais « Chrome » ;
//   B. la VRAIE route du cron contre une fausse base et un faux Web Push —
//      une notification, famille « Rappels », vers Comptes liés ; mémo du jour
//      écrit AVANT l'envoi ; déjà envoyée aujourd'hui ⇒ rien ; famille coupée ⇒
//      rien ; heures calmes ⇒ rien ne sonne (rangée dans le centre) ; chaque
//      lecture ratée ⇒ rien ; mémo non écrit ⇒ rien ; le soir ⇒ rien ; la
//      lecture des lignes captées projette (jamais `select=data`), écarte les
//      lignes vidées et pagine (`Range`).
// `--prouve` : réaffaiblit la règle et la route, une mutation à la fois, et
// exige que l'audit devienne ROUGE (puis remet les fichiers à l'identique).
// Données INVENTÉES. Aucune donnée réelle, aucun réseau.
'use strict';
require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
const path = require('path'), fs = require('fs');
const { spawnSync } = require('child_process');
const R = path.join(__dirname, '..');

// ── --prouve : chaque mutation doit rendre l'audit rouge ────────────────────
if (process.argv.includes('--prouve')) {
  const LIB = path.join(R, 'api', '_lib', 'comptes-a-relire.js');
  const CRON = path.join(R, 'api', 'ship-reminders.js');
  const MUTS = [
    ['hors des totaux nommé', LIB, "    if (compteEcarte(uid, masques, panneau)) continue;        // hors des totaux (son choix)\n", ''],
    ['banni nommé', LIB, "const banni = !!(etats[uid] && etats[uid].etat === 'banni');", 'const banni = false;'],
    ['supprimé nommé', LIB, "    if (supprimes.has(uid)) continue;                         // supprimé pour de bon\n", ''],
    ['« jamais daté » nommé', LIB, "!== 'a-relire') continue;", "=== 'lu') continue;"],
    ['seuil de 24 h ignoré', LIB, "if (etatCompteLie({ banni, lu, maintenant }) !== 'a-relire') continue;", "if (lu == null) continue;"],
    ['`_enligne` compté', LIB, "/^harvest_(\\d+)_(?!enligne$)/", "/^harvest_(\\d+)_/"],
    ['une fois par jour oublié', LIB, "  if (memo && memo.jour === jour) return { envoyer: false, raison: 'déjà envoyé aujourd’hui' };\n", ''],
    ['mémo illisible pris pour vide', LIB, "  if (memo === undefined) return { envoyer: false, raison: 'mémo illisible — rien envoyé' };\n", ''],
    ['envoi sans catégorie (heures calmes et famille contournées)', CRON, "sendPushToAll({ cat: CAT_RELECTURE, ...t,", "sendPushToAll({ ...t,"],
    ['réglages illisibles pris pour vides', CRON, "m === undefined || panneau === undefined || etats === undefined || noirs === undefined || ", ''],
    ['mémo écrit sans confirmation', CRON, "if (!(await ecrireDedup(ID_MEMO_RELECTURE, { jour: today, n: liste.length, at: new Date(maintenant).toISOString() }))) return 'mémo non écrit — rien envoyé';", "await ecrireDedup(ID_MEMO_RELECTURE, { jour: today, n: liste.length, at: new Date(maintenant).toISOString() });"],
    ['lecture complète des lignes (select=data)', CRON, "fetchPaginated(scoped(`app_data?id=like.harvest_%25&meta->>supprime=is.null&select=${SELECT_CAPTURES}`))", "fetchPaginated(scoped(`app_data?id=like.harvest_%25&meta->>supprime=is.null&select=id,data,${SELECT_CAPTURES}`))"],
  ];
  let rouges = 0;
  const origines = new Map();
  const remettre = () => { for (const [f, t] of origines) fs.writeFileSync(f, t); };
  process.on('exit', remettre);
  for (const [nom, f, avant, apres] of MUTS) {
    const src = origines.get(f) || fs.readFileSync(f, 'utf8');
    origines.set(f, src);
    if (!src.includes(avant)) { console.log(`❌ mutation « ${nom} » : le motif n'existe plus (la mutation ne prouve rien)`); rouges = -999; continue; }
    try {
      fs.writeFileSync(f, src.replace(avant, apres));
      const r = spawnSync(process.execPath, [__filename], { cwd: R, encoding: 'utf8', timeout: 300000 });
      const rouge = r.status !== 0;
      if (rouge) rouges++;
      console.log(`${rouge ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouge ? 'ROUGE' : 'encore vert'}`);
    } finally { fs.writeFileSync(f, src); }
  }
  remettre();
  const ok = rouges === MUTS.length;
  console.log(`\n${ok ? '✅' : '❌'} ${rouges}/${MUTS.length} mutations rouges`);
  process.exit(ok ? 0 : 1);
}

process.env.CRON_SECRET = 'cle-banc-relecture';
const OWNER = '11111111-2222-3333-4444-555555555555';
process.env.VRM_OWNER_UID = OWNER;
process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d !== undefined ? ' — ' + String(d).slice(0, 300) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String((e && e.stack) || e).slice(0, 300)); } };

const H = 3600e3;
const MAINT = Date.parse('2026-11-05T05:00:00Z');
const iso = (ms) => new Date(ms).toISOString();

(async () => {
  let L = null;
  try { L = await import('file://' + path.join(R, 'api', '_lib', 'comptes-a-relire.js')); } catch (e) { dit(false, 'api/_lib/comptes-a-relire.js se charge', String(e && e.message)); }

  console.log('── A. la règle');
  await essaie('A', async () => {
    if (!L) throw new Error('règle absente');
    const comptes = [
      { vinted_user_id: '101', login: 'vieux_compte' },      // 30 h
      { vinted_user_id: '102', login: 'frais_compte' },      // 2 h
      { vinted_user_id: '103', login: 'jamais_lu' },         // aucune ligne
      { vinted_user_id: '104', login: 'masque_app' },        // 40 h, masqué dans l'app
      { vinted_user_id: '105', login: 'masque_panneau' },    // 40 h, masqué au panneau
      { vinted_user_id: '106', login: 'rallume' },           // 50 h, masqué dans l'app mais rallumé au panneau
      { vinted_user_id: '107', login: 'banni_compte' },      // 60 h, banni
      { vinted_user_id: '108', login: 'supprime_compte' },   // 70 h, supprimé
      { vinted_user_id: '109', login: 'enligne_seul' },      // 30 h ; `_enligne` d'il y a 1 h
      { vinted_user_id: '110', login: '' },                  // 26 h, sans login
    ];
    const lignes = [
      { id: 'harvest_101_orders_sold', cap: iso(MAINT - 30 * H), updated_at: iso(MAINT - 1 * H) },
      { id: 'harvest_101_listings', cap: iso(MAINT - 31 * H) },
      { id: 'harvest_102_listings', cap: iso(MAINT - 2 * H) },
      { id: 'harvest_102_orders_sold', updated_at: iso(MAINT - 100 * H) },
      { id: 'harvest_104_listings', cap: iso(MAINT - 40 * H) },
      { id: 'harvest_105_listings', cap: iso(MAINT - 40 * H) },
      { id: 'harvest_106_listings', cap: iso(MAINT - 50 * H) },
      { id: 'harvest_107_listings', cap: iso(MAINT - 60 * H) },
      { id: 'harvest_108_listings', cap: iso(MAINT - 70 * H) },
      { id: 'harvest_109_listings', cap: iso(MAINT - 30 * H) },
      { id: 'harvest_109_enligne', cap: iso(MAINT - 1 * H) },
      { id: 'harvest_110_listings', cap: 'pas une date', updated_at: iso(MAINT - 26 * H) },
    ];
    const caps = L.dernieresCaptures(lignes);
    dit(caps['101'] === MAINT - 30 * H, 'A1 la fraîcheur d’un compte = sa lecture la plus récente, par `capturedAt` (pas `updated_at`)', caps['101']);
    dit(caps['109'] === MAINT - 30 * H, 'A2 `harvest_{uid}_enligne` (lecture publique depuis un autre compte) ne rend pas le compte frais', caps['109']);
    dit(caps['110'] === MAINT - 26 * H, 'A3 sans `capturedAt` lisible, `updated_at` en repli (la règle `harvestTs` de l’app)', caps['110']);
    dit(L.dernieresCaptures(null) === null, 'A4 lignes illisibles ⇒ `null` (pas su)');
    const entree = { comptes, captures: caps, masques: new Set(['104', '106']), panneau: { 105: true, 106: false }, etats: { 107: { etat: 'banni' }, 101: { etat: 'actif' } }, supprimes: new Set(['108']), maintenant: MAINT };
    const l = L.comptesARelire(entree) || [];
    const uids = l.map((x) => x.uid);
    dit(uids.includes('101'), 'A5 relu il y a 30 h ⇒ nommé', uids.join(','));
    dit(!uids.includes('102'), 'A6 relu il y a 2 h ⇒ rien', uids.join(','));
    dit(!uids.includes('103'), 'A7 jamais daté ⇒ rien (pas su ne nomme personne)', uids.join(','));
    dit(!uids.includes('104') && !uids.includes('105'), 'A8 hors des totaux (masqué dans l’app, ou au panneau) ⇒ jamais nommé', uids.join(','));
    dit(uids.includes('106'), 'A9 masqué puis rallumé au panneau (`false` prime) ⇒ dans les totaux, nommé', uids.join(','));
    dit(!uids.includes('107'), 'A10 banni ⇒ jamais nommé', uids.join(','));
    dit(!uids.includes('108'), 'A11 supprimé pour de bon (`vrm_blocked_accounts`) ⇒ jamais nommé', uids.join(','));
    dit(uids.includes('109'), 'A12 frais seulement par `_enligne` ⇒ nommé (sa session n’a pas été relue)', uids.join(','));
    dit(uids.join(',') === '106,109,101,110', 'A13 le plus ancien d’abord (à égalité, par nom)', uids.join(','));
    const sans = l.find((x) => x.uid === '110');
    dit(sans && sans.nom === 'n° 110', 'A14 sans login, le compte est nommé par son numéro (jamais un nom inventé)', sans && sans.nom);
    dit(L.comptesARelire({ ...entree, comptes: null }) === null && L.comptesARelire({ ...entree, captures: null }) === null && L.comptesARelire({ ...entree, etats: null }) === null && L.comptesARelire({ ...entree, panneau: undefined }) === null, 'A15 une entrée illisible ⇒ `null` (pas su), jamais une liste');
    const exactement24 = L.comptesARelire({ ...entree, comptes: [{ vinted_user_id: '201', login: 'pile' }], captures: { 201: MAINT - 24 * H } });
    dit(Array.isArray(exactement24) && exactement24.length === 0, 'A16 relu il y a exactement 24 h ⇒ pas encore (plus de 24 h)', JSON.stringify(exactement24));
    const t1 = L.texteComptesARelire([l.find((x) => x.uid === '101')]);
    dit(t1 && /vieux_compte/.test(t1.title + t1.body) && /vinted\.fr/.test(t1.body) && /navigateur où est l’extension VRM/.test(t1.body) && /il y a 30 h/.test(t1.body), 'A17 un compte : son nom, l’âge de sa lecture, le geste (vinted.fr, le navigateur où est l’extension)', t1 && (t1.title + ' / ' + t1.body));
    const t2 = L.texteComptesARelire(l);
    dit(t2 && /^4 comptes/.test(t2.title) && ['rallume', 'vieux_compte', 'enligne_seul', 'n° 110'].every((n) => t2.body.includes(n)), 'A18 plusieurs comptes : le nombre, et chacun nommé', t2 && (t2.title + ' / ' + t2.body));
    const six = Array.from({ length: 6 }, (_, i) => ({ uid: String(300 + i), nom: 'c' + i, lu: 0, age: 'il y a 2 j' }));
    const t3 = L.texteComptesARelire(six);
    dit(t3 && /et 2 autres/.test(t3.body) && !/c4|c5/.test(t3.body), 'A19 au-delà de quatre, le reste est compté', t3 && t3.body);
    dit(![t1, t2, t3].some((t) => /Chrome/.test(t.title + t.body)), 'A20 jamais « Chrome » (le navigateur peut être Edge, Brave, Opera, Orion…)');
    dit(L.texteComptesARelire([]) === null, 'A21 aucun compte ⇒ aucun texte');
    const d = (liste, memo) => L.decisionRelecture({ liste, memo, jour: '2026-11-05' }).envoyer;
    dit(d(l, null) === true && d(l, { jour: '2026-11-04' }) === true, 'A22 rien envoyé aujourd’hui ⇒ on envoie');
    dit(d(l, { jour: '2026-11-05' }) === false, 'A23 déjà envoyée aujourd’hui ⇒ rien (une par jour au plus)');
    dit(d(l, undefined) === false, 'A24 mémo illisible ⇒ rien (pas su)');
    dit(d([], null) === false && d(null, null) === false, 'A25 aucun compte à relire, ou pas su ⇒ rien');
    const T = await import('file://' + path.join(R, 'api', '_lib', 'notif-textes.js'));
    dit(T.familleDe(L.CAT_RELECTURE) === 'rappels' && T.FAMILLES.length === 9, 'A26 la catégorie est rangée dans la famille « Rappels » des neuf familles (11 nov. : + Alertes d’achat eBay)', T.familleDe(L.CAT_RELECTURE));
    dit(T.decisionNotif({ familles: { rappels: false } }, L.CAT_RELECTURE) === false && T.decisionNotif({ familles: { compta: false } }, L.CAT_RELECTURE) === false && T.decisionNotif({}, L.CAT_RELECTURE) === true, 'A27 elle suit le choix du type « Rappels » (et l’ancien « Compta » hérité), allumée par défaut');
    const A = await import('file://' + path.join(R, 'api', '_lib', 'notif-apercus.js'));
    const ap = A.apercuFamille('rappels');
    dit(ap && ap.exemples.some((e) => /Compte Vinted pas relu/.test(e.title)), 'A28 Paramètres → Notifications la montre dans l’aperçu de « Rappels » (texte de la vraie fabrique)');
  });

  // ── B. la vraie route du cron ─────────────────────────────────────────────
  console.log('\n── B. la route du cron (fausse base, faux Web Push)');
  const webpush = require(path.join(R, 'node_modules', 'web-push'));
  const journal = [];               // écritures et envois, dans l'ordre
  const pushes = [];
  webpush.setVapidDetails = () => {};
  webpush.sendNotification = async (sub, body) => { const p = JSON.parse(body); pushes.push(p); journal.push('push:' + (p.title || '')); return { statusCode: 201 }; };
  let CFG, lectures;
  const reset = (cfg) => {
    pushes.length = 0; journal.length = 0; lectures = [];
    CFG = Object.assign({
      comptes: [{ vinted_user_id: '501', login: 'boutique_banc' }, { vinted_user_id: '502', login: 'atelier_banc' }, { vinted_user_id: '503', login: 'frais_banc' }],
      lignes: [
        { id: 'harvest_501_listings', cap: iso(Date.now() - 30 * H) },
        { id: 'harvest_502_orders_sold', cap: iso(Date.now() - 50 * H) },
        { id: 'harvest_503_listings', cap: iso(Date.now() - 1 * H) },
      ],
      main: { vinted_accounts_hidden: [] }, panneau: {}, etats: { comptes: {} }, noirs: { uids: [] },
      memo: null, prefs: {}, ko: {}, memoEcritKO: false,
    }, cfg);
  };
  const J = (o, status = 200, h = {}) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', ...h } });
  const KO = () => new Response('<html>522</html>', { status: 522, headers: { 'content-type': 'text/html' } });
  global.fetch = async (url, opts = {}) => {
    const u = decodeURIComponent(String(url));
    const meth = (opts.method || 'GET').toUpperCase();
    if (/\/rpc\/vrm_acces_pour/.test(u)) return J(true);
    if (meth !== 'GET') {
      let corps = null; try { corps = JSON.parse(opts.body); } catch (_) {}
      const id = Array.isArray(corps) && corps[0] && corps[0].id;
      if (id === 'relecture_rappel_dedup') { journal.push('memo:' + JSON.stringify(corps[0].data)); if (CFG.memoEcritKO) return new Response('', { status: 500 }); }
      if (id === 'push_journal') journal.push('centre:' + JSON.stringify(((corps[0].data || {}).entrees || []).slice(-1).map((e) => e.etat)));
      return new Response('', { status: 201 });
    }
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    if (/select=owner&limit=1/.test(u)) return J([{ owner: OWNER }]);
    if (/id=eq\.main/.test(u) && sel === 'owner') return J([{ owner: OWNER }]);
    if (/\/vinted_accounts\?/.test(u)) { if (/select=vinted_user_id,login/.test(u) && !/vinted_accounts_hidden/.test(u)) { lectures.push('comptes'); } return CFG.ko.comptes ? KO() : J(CFG.comptes); }
    if (/id=like\.harvest_%(?:&|$)/.test(u)) {
      lectures.push({ harvest: u, range: (opts.headers || {}).Range || null });
      return CFG.ko.lignes ? KO() : J(CFG.lignes);
    }
    if (/id=eq\.main/.test(u)) {
      if (/vinted_accounts_hidden/.test(sel) && !/vinted_ship_done/.test(sel)) return CFG.ko.main ? KO() : J([{ vinted_accounts_hidden: CFG.main.vinted_accounts_hidden }]);
      return J([{}]);
    }
    if (/id=eq\.panel_accounts_off/.test(u)) return CFG.ko.panneau ? KO() : J([{ data: CFG.panneau }]);
    if (/id=eq\.panel_comptes_etat/.test(u)) return CFG.ko.etats ? KO() : J([{ comptes: CFG.etats.comptes }]);
    if (/id=eq\.vrm_blocked_accounts/.test(u)) return CFG.ko.noirs ? KO() : J([{ uids: CFG.noirs.uids }]);
    if (/id=eq\.relecture_rappel_dedup/.test(u)) return CFG.ko.memo ? KO() : J(CFG.memo ? [{ data: CFG.memo }] : []);
    if (/id=eq\.push_prefs/.test(u)) return J([{ data: CFG.prefs }]);
    if (/id=eq\.push_subs/.test(u)) return J([{ data: { subs: [{ endpoint: 'https://web.push.apple.com/iphone-banc' }] } }]);
    return J([]);
  };
  let mod, libPush, libAbo = {};
  try { mod = await import('file://' + path.join(R, 'api', 'ship-reminders.js')); } catch (e) { dit(false, 'api/ship-reminders.js se charge', String(e && e.message)); }
  try { libPush = await import('file://' + path.join(R, 'api', '_lib', 'push.js')); } catch (_) { libPush = {}; }
  try { libAbo = await import('file://' + path.join(R, 'api', '_lib', 'abonnement.js')); } catch (_) {}
  const lancer = async (query = {}) => {
    if (typeof libPush.oublierPrefsVues === 'function') libPush.oublierPrefsVues();
    if (typeof libAbo.oublierAcces === 'function') libAbo.oublierAcces();
    const res = { code: null, corps: null, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, setHeader() {}, end() { return this; } };
    await mod.default({ method: 'GET', headers: { authorization: 'Bearer cle-banc-relecture' }, query }, res);
    return res;
  };
  const relus = () => pushes.filter((p) => /pas relu/.test(p.title || ''));
  const jour = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });

  await essaie('B1', async () => {
    if (!mod) throw new Error('route absente');
    reset();
    const res = await lancer();
    const p = relus()[0] || {};
    console.log(`     téléphone : « ${p.title} » / « ${p.body} »`);
    dit(relus().length === 1, 'B1 deux comptes pas relus, un frais ⇒ UNE notification', String(relus().length));
    dit(/2 comptes/.test(p.title || '') && /boutique_banc/.test(p.body || '') && /atelier_banc/.test(p.body || '') && !/frais_banc/.test(p.body || ''), 'B2 elle nomme les deux comptes, pas le compte frais', p.body);
    dit(/vinted\.fr/.test(p.body || '') && /navigateur où est l’extension VRM/.test(p.body || ''), 'B3 elle dit le geste : ouvrir vinted.fr sur ce compte, dans le navigateur où est l’extension', p.body);
    dit(p.url && /^\/\?tab=vintedaccounts/.test(p.url), 'B4 le toucher mène à Paramètres → Comptes liés', p.url);
    const iMemo = journal.findIndex((x) => x.startsWith('memo:')), iPush = journal.findIndex((x) => /^push:.*pas relus?$/.test(x)); // (8 nov.) titres sans emoji
    dit(iMemo >= 0 && iPush > iMemo && journal[iMemo].includes(`"jour":"${jour}"`), 'B5 le mémo du jour (Paris) est écrit AVANT l’envoi', journal.join(' | '));
    const b = res.corps && res.corps.bilans && res.corps.bilans[0];
    dit(b && b.relecture && b.relecture.relecture === 'envoyé' && b.relecture.n === 2 && !/boutique_banc|atelier_banc/.test(JSON.stringify(b.relecture)), 'B6 la réponse du cron dit « envoyé » et un nombre, aucun pseudo', JSON.stringify(b && b.relecture));
    const h = lectures.filter((x) => x && x.harvest);
    dit(h.length > 0 && h.every((x) => !/select=[^&]*\bdata\b/.test(x.harvest) && /meta->>capturedAt/.test(x.harvest) && /meta->>supprime=is\.null/.test(x.harvest) && x.range), 'B7 les lignes captées : projection (`capturedAt`, jamais `select=data`), lignes vidées écartées, paginées (`Range`)', h.map((x) => x.harvest + ' ' + x.range).join(' | '));
  });

  await essaie('B8', async () => {
    reset({ memo: { jour } });
    await lancer();
    dit(relus().length === 0, 'B8 déjà envoyée aujourd’hui ⇒ rien (une par jour au plus)', String(relus().length));
    reset({ memo: { jour: '2026-01-01' } });
    await lancer();
    dit(relus().length === 1, 'B9 envoyée un autre jour ⇒ de nouveau ce matin', String(relus().length));
  });

  await essaie('B10', async () => {
    reset({ prefs: { familles: { rappels: false } } });
    await lancer();
    dit(relus().length === 0, 'B10 type « Rappels » coupé ⇒ rien', String(relus().length));
    reset({ prefs: { calme: { actif: true, debut: '00:00', fin: '23:59', sauf: [] } } });
    await lancer();
    dit(relus().length === 0 && journal.some((x) => x.startsWith('centre:') && x.includes('calme')), 'B11 heures calmes ⇒ rien ne sonne, la notification est rangée dans le centre', journal.join(' | '));
  });

  for (const [cle, nom] of [['comptes', 'les comptes Vinted'], ['lignes', 'les lignes captées'], ['main', 'les comptes masqués (`main`)'], ['panneau', 'le panneau de l’extension'], ['etats', 'l’état des comptes (banni)'], ['noirs', 'les comptes supprimés'], ['memo', 'le mémo du jour']]) {
    await essaie('B-ko-' + cle, async () => {
      reset({ ko: { [cle]: true } });
      await lancer();
      dit(relus().length === 0, `B12 ${nom} illisible (522) ⇒ rien (pas su)`, String(relus().length));
    });
  }

  await essaie('B13', async () => {
    reset({ memoEcritKO: true });
    await lancer();
    dit(relus().length === 0, 'B13 mémo non écrit ⇒ rien (sans mémo confirmé, un second passage le même jour la renverrait)', String(relus().length));
    reset({ lignes: [{ id: 'harvest_501_listings', cap: iso(Date.now() - 2 * H) }, { id: 'harvest_502_listings', cap: iso(Date.now() - 3 * H) }, { id: 'harvest_503_listings', cap: iso(Date.now() - 1 * H) }] });
    await lancer();
    dit(relus().length === 0 && !journal.some((x) => x.startsWith('memo:')), 'B14 tous les comptes relus ⇒ rien, et aucun mémo', journal.join(' | '));
    reset({ main: { vinted_accounts_hidden: ['501'] }, panneau: { 502: true } });
    await lancer();
    dit(relus().length === 0, 'B15 les comptes pas relus sont hors des totaux ⇒ rien', String(relus().length));
    reset({ etats: { comptes: { 501: { etat: 'banni' } } }, noirs: { uids: ['502'] } });
    await lancer();
    dit(relus().length === 0, 'B16 l’un banni, l’autre supprimé ⇒ rien', String(relus().length));
    reset();
    await lancer({ moment: 'soir' });
    dit(relus().length === 0, 'B17 le passage du soir ne la porte pas (le matin seulement)', String(relus().length));
  });

  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ l’audit a levé : ' + ((e && e.stack) || e)); process.exit(1); });
