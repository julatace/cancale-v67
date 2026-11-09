// ═══════════════════════════════════════════════════════════════════════════
// LEBONCOIN CLAIR (5.333.0, 9 nov.) — la page, le relais et le fond, EXÉCUTÉS
//   node scripts/audit-lbc-clair.cjs                (le code du dépôt)
//   node scripts/audit-lbc-clair.cjs --ext <dossier> (une autre copie de
//        vinted-sync-extension/ : la preuve sur la 5.331, §6.1)
//   node scripts/audit-lbc-clair.cjs --prouve        (réaffaiblit chaque règle : rouge exigé)
// ═══════════════════════════════════════════════════════════════════════════
// Julien, sur leboncoin.fr (9 nov.) : « Compte Leboncoin : Identifiant détecté ·
// identité à confirmer — Rien envoyé depuis ce navigateur — Annonces : nouvelle
// intégration non confirmée — VRM n'a pas confirmé l'enregistrement du compte ».
// « Là j'ai plus que 1 annonce donc les données de Leboncoin circulent très mal ».
//
// Ce banc fait tourner LES VRAIS FICHIERS : `lbc-inject.js` (monde de la page),
// `lbc-relay.js` (monde isolé, même fenêtre) et `background.js` (le fond, sur une
// fausse base à état — scripts/_fond-vm.cjs). Leboncoin est imité à la FORME
// mesurée (historique-leboncoin.md, 20 oct. et 29 oct.) :
//   · `GET api.leboncoin.fr/api/account/v2/members/me/account`
//       → { account:{account_id,type}, member:{account_id, nickname:{value}} }
//   · `POST api.leboncoin.fr/api/dashboard/v1/search` (« Mes annonces »), corps
//       { context, filters:{owner:{user_id}}, limit, offset, sort_by, sort_order,
//         include_inactive, include_draft }
//       → { total, account_stats, pivot, ads:[{ list_id, subject, price:[n],
//           status, owner:{user_id}, url, images:{urls} }] }
// Tout est INVENTÉ (le dépôt est public) : aucun identifiant ni nom réel.
const fs = require('fs'), vm = require('vm'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const racine = path.join(__dirname, '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const EXT = path.resolve(arg('--ext', path.join(racine, 'vinted-sync-extension')));
const lire = (f) => fs.readFileSync(path.join(EXT, f), 'utf8');

if (process.argv.includes('--prouve')) {
  // Chaque mutation réaffaiblit UNE règle de la 5.333 dans une copie de l'extension.
  const MUT = [
    ['refusSansSessionDefinitif', 'lbc-relay.js', "if(!ok&&sansSession===true&&REJOUABLES.includes(m.action)){", "if(false){"],
    ['comptePriveNonReconnu', 'background.js', "const aMoiParOwner = !!(ownerId && (miens.has(ownerId) || miensNus.has(idCompteLbc(ownerId))));", "const aMoiParOwner = !!(ownerId && miens.has(ownerId));"],
    ['premierePageSeule', 'lbc-inject.js', "      try { completerListe(url, text, corpsReq); } catch (_) {}\n", ""],
    ['pasDeRejeuALaConnexion', 'background.js', "_lbcRejeuAttendu = false; relancerLbcApresSession().catch(() => {});", "_lbcRejeuAttendu = false;"],
    ['ambiguDitOk', 'background.js', "else if (t.ambigue === true) compte = R(false,", "else if (false) compte = R(false,"],
    ['carteSansPreuve', 'background.js', "if (!r || !r.lbcId || !(lu > 0) || !(now - lu <= LBC_LECTURE_FRAICHE_MS)) return false;", "if (!r) return false;"],
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lbc-clair-'));
  let tous = true;
  for (const [nom, fichier, avant, apres] of MUT) {
    const dir = path.join(tmp, nom); fs.mkdirSync(dir);
    for (const f of fs.readdirSync(EXT)) { const s = path.join(EXT, f); if (fs.statSync(s).isFile()) fs.copyFileSync(s, path.join(dir, f)); }
    const txt = fs.readFileSync(path.join(dir, fichier), 'utf8');
    if (!txt.includes(avant)) { console.log(`❌ mutation ${nom} : texte introuvable`); tous = false; continue; }
    fs.writeFileSync(path.join(dir, fichier), txt.replace(avant, apres));
    const r = spawnSync(process.execPath, [__filename, '--ext', dir], { encoding: 'utf8', timeout: 240000 });
    const n = ((r.stdout || '').match(/^❌/gm) || []).length;
    const ok = r.status !== 0 && n > 0; if (!ok) tous = false;
    console.log(`${ok ? '✅' : '❌'} mutation « ${nom} » ⇒ ${n} contrôle(s) rouge(s)${ok ? '' : ' — LA RÈGLE N’EST PAS PROTÉGÉE'}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(tous ? '\n✅ chaque réaffaiblissement fait rougir l’audit' : '\n❌ une mutation passe inaperçue');
  process.exit(tous ? 0 : 1);
}

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
async function jusqua(cond, ms = 8000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await cond()) return true; } catch (_) {} await attendre(20); } return false; }

const MOI = '8442c3e8-0000-4000-8000-00000000a001';     // inventé
const AUTRE = 'faf3fbba-0000-4000-8000-00000000b002';   // inventé
const ID0 = 3300000100;
const annonces = (n, owner) => Array.from({ length: n }, (_, i) => ({ list_id: ID0 + i, subject: 'Paire essai ' + (i + 1), price: [40 + i], status: 'active', owner: { user_id: owner },
  url: 'https://www.leboncoin.fr/ad/chaussures/' + (ID0 + i), images: { urls: ['https://img.leboncoin.fr/api/v1/essai/' + i + '.jpg'] }, first_publication_date: '2026-11-01 10:00:00', counters: {} }));

// ── UNE PAGE leboncoin.fr : deux mondes (page, isolé) sur UNE fenêtre ────────
function fairePage(fond, { tabId = 9, comptes = [{ id: MOI, nom: 'Totomondu' }], nAnnonces = 37, parPage = 35 } = {}) {
  const journal = { lbc: [] };
  const ecoutesRelais = [];
  const bus = [];   // { win, fn }
  const url = 'https://www.leboncoin.fr/compte/part/mes-annonces';
  const sender = { tab: { id: tabId, url }, frameId: 0, url, id: 'x' };
  const lent = (f) => (fn, ms, ...a) => f(fn, Math.max(0, Math.round((ms || 0) / 20)), ...a);
  const fenetre = (estPage) => {
    const w = { __estPage: estPage };
    w.top = w; w.self = w;
    w.location = { origin: 'https://www.leboncoin.fr', pathname: '/compte/part/mes-annonces', href: url, hostname: 'www.leboncoin.fr' };
    w.addEventListener = (type, fn) => { if (type === 'message') bus.push({ win: w, fn }); };
    w.postMessage = (data) => { if (process.env.LBC_DEBUG) console.log('  [bus]', estPage ? 'page' : 'iso', JSON.stringify(data).slice(0, 120)); const copie = JSON.parse(JSON.stringify(data)); setTimeout(() => { for (const b of bus.slice()) { try { b.fn({ source: b.win.__g || b.win, data: JSON.parse(JSON.stringify(copie)) }); } catch (_) {} } }, 1); };
    return w;
  };
  // Le faux Leboncoin (côté page).
  const serveur = async (u, init) => {
    const methode = String((init && init.method) || 'GET').toUpperCase();
    journal.lbc.push({ methode, u, corps: init && init.body });
    const json = (o) => ({ ok: true, status: 200, headers: { get: (k) => (/content-type/i.test(k) ? 'application/json; charset=utf-8' : null) }, clone() { return this; }, text: async () => JSON.stringify(o), json: async () => o });
    if (/\/api\/account\/v\d+\/members\/me\/account$/.test(u)) { const c = comptes[Math.min(journal.lbc.filter((x) => /members\/me/.test(x.u)).length - 1, comptes.length - 1)]; return json({ account: { account_id: c.id, type: 'private' }, member: { account_id: c.id, nickname: { value: c.nom } } }); }
    if (/\/api\/dashboard\/v1\/search$/.test(u) && methode === 'POST') {
      const r = JSON.parse(init.body); const owner = r.filters.owner.user_id; const tout = annonces(nAnnonces, owner);
      return json({ total: tout.length, account_stats: {}, pivot: '', ads: tout.slice(r.offset || 0, (r.offset || 0) + (r.limit || 35)) });
    }
    return { ok: false, status: 404, headers: { get: () => 'application/json' }, clone() { return this; }, text: async () => '{}', json: async () => ({}) };
  };
  // Monde de la PAGE (lbc-inject.js).
  const page = fenetre(true);
  page.fetch = serveur;
  const ls = {};
  const ctxPage = { window: page, document: { readyState: 'complete', currentScript: {}, getElementById: () => null, addEventListener() {} }, location: page.location,
    localStorage: { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: (k) => { delete ls[k]; } },
    setTimeout: lent(setTimeout), clearTimeout, setInterval: lent(setInterval), clearInterval, URL, Headers, TextEncoder, TextDecoder, JSON, Promise, console: { log() {}, warn() {}, error() {} } };
  Object.setPrototypeOf(page, ctxPage);
  vm.createContext(page);
  page.__g = vm.runInContext('globalThis', page);   // dans un vm, `window` est le global du contexte
  vm.runInContext(lire('lbc-inject.js'), page, { filename: 'lbc-inject.js' });
  // Monde ISOLÉ (lbc-relay.js) : chrome.runtime ⇄ le VRAI fond.
  const iso = fenetre(false);
  const chromeIso = { runtime: { id: 'x', lastError: null,
    sendMessage: (m, cb) => { const p = fond.envoyer(m, sender); if (process.env.LBC_DEBUG) p.then((r) => console.log('  [relais→fond]', m.action, JSON.stringify(r).slice(0, 200))); if (typeof cb === 'function') p.then((r) => cb(r)); return p; },
    onMessage: { addListener: (fn) => { ecoutesRelais.push(fn); } } } };
  const ctxIso = { window: iso, chrome: chromeIso, setTimeout: lent(setTimeout), clearTimeout, setInterval: lent(setInterval), clearInterval, TextEncoder, URL, JSON, Promise, console: { log() {}, warn() {}, error() {} },
    crypto: require('crypto').webcrypto, self: null };
  Object.setPrototypeOf(iso, ctxIso);
  vm.createContext(iso);
  iso.__g = vm.runInContext('globalThis', iso);
  vm.runInContext(lire('lbc-relay.js'), iso, { filename: 'lbc-relay.js' });
  // Le fond parle aux onglets : vers le relais de CETTE page.
  fond.ctx.chrome.tabs.sendMessage = (id, msg, opts, cb) => {
    const rappel = typeof opts === 'function' ? opts : cb;
    if (id !== tabId) { if (rappel) rappel(undefined); return; }
    if (msg && msg.action === 'lbcRejouer') journal.rejeux = (journal.rejeux || 0) + 1;
    let rendu = false; const rep = (r) => { if (!rendu) { rendu = true; if (rappel) rappel(r); } };
    for (const f of ecoutesRelais) { try { f(msg, { id: 'x' }, rep); } catch (_) {} }
  };
  fond.ctx.chrome.tabs.query = async () => [{ id: tabId, url }];
  // Ce que fait le site : son compte, puis la 1re page de « Mes annonces ».
  const charger = async () => {
    await page.fetch('https://api.leboncoin.fr/api/account/v2/members/me/account', { method: 'GET', credentials: 'include', headers: { Accept: 'application/json', api_key: 'cle-site' } });
    await attendre(30);
    await page.fetch('https://api.leboncoin.fr/api/dashboard/v1/search', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', api_key: 'cle-site' },
      body: JSON.stringify({ context: 'default', filters: { owner: { user_id: comptes[0].id } }, limit: parPage, offset: 0, sort_by: 'date', sort_order: 'desc', include_inactive: true, include_draft: false }) });
  };
  return { page, iso, journal, charger, sender, rejouerCompte: async () => page.fetch('https://api.leboncoin.fr/api/account/v2/members/me/account', { method: 'GET' }) };
}
const SESSION = { access_token: 'jeton.banc', refresh_token: 'r-banc', user_id: 'owner-banc', email: 'essai@vrm.test', expires_at: Date.now() + 365 * 864e5 };
const nbAnnonces = (fond, compte) => Object.values(((fond.lignes.lbc_listings || {}).items) || {}).filter((a) => String(a.account || '').replace(/^lbc-account:/, '') === compte).length;
const etat = async (fond, p) => fond.ctx.etatSite('https://www.leboncoin.fr/compte/part/mes-annonces', p.sender.tab.id);

(async () => {
  console.log('── A. LE CAS DE JULIEN : la page charge AVANT la connexion à VRM, puis il se connecte dans la carte');
  await (async () => {
    const fond = faireFond({ src: path.join(EXT, 'background.js'), store: { __sansSession: true }, lignes: {} });
    const p = fairePage(fond);
    await p.charger();
    await attendre(600);
    dit(!fond.lignes.lbc_accounts && !fond.lignes.lbc_listings, 'sans session VRM : rien n’est écrit (garde §2 inchangée)', JSON.stringify(Object.keys(fond.lignes)));
    const e0 = typeof fond.ctx.etatSite === 'function' ? await etat(fond, p) : null;
    const t0 = JSON.stringify(e0 && e0.lbc) || '';
    // La carte est rendue à partir de ce résumé (vrm-badge.js) ; sans résumé, elle disait le jargon.
    dit(!!(e0 && e0.lbc) && !/intégration|identité à confirmer|enregistrement du compte/i.test(t0), 'la carte ne dit plus « intégration », « identité à confirmer », « enregistrement du compte »', t0.slice(0, 300));
    // Il se connecte dans la carte (5.329/5.330) : une session arrive.
    await fond.ctx.saveSession(SESSION);
    dit((p.journal.rejeux || 0) >= 1, 'la connexion relance TOUT DE SUITE l’onglet Leboncoin (sans attendre la sonde de 30 s)', String(p.journal.rejeux || 0));
    const okA = await jusqua(() => nbAnnonces(fond, MOI) === 37 && fond.lignes.lbc_listings && fond.lignes.lbc_listings.lectures && fond.lignes.lbc_listings.lectures[MOI], 10000);
    dit(okA, 'après la connexion, sans recharger : les 37 annonces (2 pages : 35 + 2) sont rangées sous SON compte', `${nbAnnonces(fond, MOI)} rangées`);
    const acc = (fond.lignes.lbc_accounts || {}).accounts || {};
    dit(!!acc['lbc-account:' + MOI] && acc['lbc-account:' + MOI].name === 'Totomondu', 'le compte Leboncoin est confirmé tout seul (même compte vu par la page, preuve privée)', JSON.stringify(Object.keys(acc)));
    const L = fond.lignes.lbc_listings && fond.lignes.lbc_listings.lectures && fond.lignes.lbc_listings.lectures[MOI];
    dit(!!L && L.total === 37 && L.n === 37 && Array.isArray(L.ids) && L.ids.length === 37, 'la lecture COMPLÈTE est notée (37 sur 37, identifiants gardés)', JSON.stringify(L && { total: L.total, n: L.n, ids: L.ids && L.ids.length }));
    const pages = p.journal.lbc.filter((x) => /dashboard\/v1\/search/.test(x.u)).map((x) => JSON.parse(x.corps).offset);
    dit(JSON.stringify(pages) === '[0,35]', 'la page manquante est relue avec LA requête du site (seul `offset` change), une seule fois', JSON.stringify(pages));
    const e1 = await etat(fond, p);
    dit(e1.lbc && e1.lbc.compte.ok === true && /Totomondu/.test(e1.lbc.compte.texte), 'carte : « Compte Leboncoin : Totomondu ✓ »', JSON.stringify(e1.lbc && e1.lbc.compte));
    dit(e1.lbc && e1.lbc.annonces.ok === true && /^37 lues en entier/.test(e1.lbc.annonces.texte), 'carte : « Annonces : 37 lues en entier il y a … ✓ »', JSON.stringify(e1.lbc && e1.lbc.annonces));
    dit(e1.lbc && e1.lbc.compte.geste === '' && e1.lbc.annonces.geste === '', 'aucun geste demandé quand tout est prouvé', JSON.stringify(e1.lbc));
  })();

  console.log('\n── B. Connecté dès le départ : identité prouvée ⇒ confirmée sans geste');
  await (async () => {
    const fond = faireFond({ src: path.join(EXT, 'background.js'), store: { vrmSession: SESSION }, lignes: {} });
    const p = fairePage(fond, { nAnnonces: 3 });
    await p.charger();
    const ok = await jusqua(() => nbAnnonces(fond, MOI) === 3, 8000);
    dit(ok, 'session là : les 3 annonces d’une seule page sont rangées', `${nbAnnonces(fond, MOI)}`);
    const pages = p.journal.lbc.filter((x) => /dashboard\/v1\/search/.test(x.u)).length;
    dit(pages === 1, 'tout tient sur la page vue : aucune requête de plus', String(pages));
    await jusqua(async () => { const e = await etat(fond, p); return e.lbc && e.lbc.compte.ok === true; }, 4000);
    const e = await etat(fond, p);
    dit(e.lbc && e.lbc.compte.ok === true && !e.lbc.compte.geste && e.lbc.annonces.ok === true, 'compte confirmé sans geste, « Annonces : 3 lues en entier ✓ »', JSON.stringify(e.lbc && { compte: e.lbc.compte, annonces: e.lbc.annonces }));
  })();

  console.log('\n── C. Identité CONTRADICTOIRE dans le même onglet ⇒ rien envoyé + un geste');
  await (async () => {
    const fond = faireFond({ src: path.join(EXT, 'background.js'), store: { vrmSession: SESSION }, lignes: {} });
    const p = fairePage(fond, { comptes: [{ id: MOI, nom: 'Totomondu' }, { id: AUTRE, nom: 'Autrecompte' }], nAnnonces: 2 });
    // Deux réponses « moi » différentes AVANT toute liste.
    await p.page.fetch('https://api.leboncoin.fr/api/account/v2/members/me/account', { method: 'GET' });
    await p.page.fetch('https://api.leboncoin.fr/api/account/v2/members/me/account', { method: 'GET' });
    await attendre(300);
    await p.page.fetch('https://api.leboncoin.fr/api/dashboard/v1/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context: 'default', filters: { owner: { user_id: AUTRE } }, limit: 35, offset: 0, sort_by: 'date', sort_order: 'desc', include_inactive: true, include_draft: false }) });
    await attendre(800);
    dit(nbAnnonces(fond, MOI) === 0 && nbAnnonces(fond, AUTRE) === 0, 'aucune annonce attribuée (ni à l’un, ni à l’autre)', `${nbAnnonces(fond, MOI)} / ${nbAnnonces(fond, AUTRE)}`);
    const e = await etat(fond, p);
    dit(e.lbc && e.lbc.compte.ok === false && /deux comptes/.test(e.lbc.compte.texte) && /^Recharge/.test(e.lbc.geste || ''), 'carte : le compte n’est pas confirmé, UN geste (« Recharge la page, connecté au compte… »)', JSON.stringify(e.lbc && { compte: e.lbc.compte, geste: e.lbc.geste }));
  })();

  console.log('\n── D. « À retirer » sur la carte : seulement ce qui est PROUVÉ en ligne');
  await (async () => {
    const maintenant = Date.now();
    const fond = faireFond({ src: path.join(EXT, 'background.js'), store: { vrmSession: SESSION }, lignes: { lbc_a_retirer: { v: 1, at: new Date().toISOString(), liste: [
      { numero: '18', lbcId: String(ID0 + 5), titre: 'Paire essai 6', url: 'https://www.leboncoin.fr/ad/chaussures/' + (ID0 + 5), lu: maintenant - 3600e3, compte: MOI },
      { numero: '23', lbcId: '3399999999', titre: 'Paire plus en ligne', url: 'https://www.leboncoin.fr/ad/chaussures/3399999999', lu: maintenant - 3600e3, compte: MOI },
      { numero: '30', lbcId: '3399999998', titre: 'Preuve trop vieille', url: '', lu: maintenant - 30 * 3600e3, compte: MOI },
      { numero: '31', lbcId: '3399999997', titre: 'Sans preuve (app d’avant)', url: '' }] } } });
    const p = fairePage(fond, { nAnnonces: 37 });
    await p.charger();
    await jusqua(() => fond.lignes.lbc_listings && fond.lignes.lbc_listings.lectures && fond.lignes.lbc_listings.lectures[MOI], 10000);
    await attendre(100);
    const e = await etat(fond, p);
    const nums = ((e.aRetirer && e.aRetirer.liste) || []).map((r) => r.numero);
    dit(JSON.stringify(nums) === '["18"]', 'seule la N°18 (dans la lecture complète d’ici, preuve d’1 h) est proposée ; absente de la lecture, preuve de 30 h ou sans preuve ⇒ pas « à retirer »', JSON.stringify(nums));
  })();

  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ tout est vert');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ le banc a levé : ' + (e && e.stack || e)); process.exit(1); });
