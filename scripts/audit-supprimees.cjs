// ════════════════════════════════════════════════════════════════════════════
//  UNE ANNONCE SUPPRIMÉE SUR VINTED SORT DE VRM TOUT DE SUITE (5.165)
//
//  Julien, 9 octobre 18:40 : « je viens de supprimer beaucoup de paires et elles
//  sont encore marquées dans les annonces ». MESURÉ : la seule trace était
//  `harvest_{uid}_wreq_api_v2_items_id_delete` — posée AVANT la requête (donc
//  aussi pour une suppression refusée), sans statut, une ligne par compte
//  écrasée à chaque suppression ; et le statut du mouchard ne portait pas
//  l'identifiant. Le dressing de cinq comptes datait du 8 au soir.
//
//  On EXÉCUTE le vrai code, de bout en bout, sur des données inventées :
//   1. `inject.js` (monde de la page) : seul un `POST /api/v2/items/{id}/delete`
//      RÉUSSI (2xx), sur Vinted, part — dans le rappel de la réponse, avant le
//      code de la page (qui navigue) ; fetch ET XHR ;
//   2. `content.js` le relaie tel quel au service worker ;
//   3. `background.js` le range dans `harvest_{uid}_supprimees` (lire-fusionner-
//      réécrire gardé, une seule chaîne, file dans chrome.storage), prévient
//      l'app, et refuse ce qui n'est pas une suppression réussie d'un compte connu ;
//   4. LA RÈGLE est la même dans l'app et dans l'extension (§11) : on compare
//      leurs SORTIES, pas leur orthographe ;
//   5. les files Leboncoin et eBay de l'extension écartent l'annonce supprimée
//      APRÈS la lecture du dressing ; « pas su » n'écarte rien ; le dressing
//      relu après la suppression fait foi ;
//   6. les photos d'une annonce supprimée ne sont plus demandées à Vinted.
//  Usage : node scripts/audit-supprimees.cjs [--mutation nom]
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), vm = require('vm'), path = require('path'), os = require('os');
const { metaVersData } = require('./bancs/_meta.cjs');
const { faireFond } = require('./_fond-vm.cjs');
const racine = path.join(__dirname, '..');
const lire = (r) => fs.readFileSync(path.join(racine, r), 'utf8');
const F = { bg: lire('vinted-sync-extension/background.js'), inject: lire('vinted-sync-extension/inject.js'),
  content: lire('vinted-sync-extension/content.js'), app: lire('src/App.jsx') };

// ── RÉAFFAIBLIR UNE RÈGLE (§6.1) ────────────────────────────────────────────
const MUTATIONS = {
  // la page posterait une suppression REFUSÉE (403)
  statutpage: [['inject', `      if (!(st >= 200 && st < 300)) return;               // refusée, échouée : rien\n`, '']],
  // le fond rangerait un message de suppression refusée
  statutfond: [['bg', `if (!/^\\d{4,15}$/.test(id) || !(st >= 200 && st < 300))`, `if (!/^\\d{4,15}$/.test(id))`]],
  // « pas su » écarterait (les deux côtés)
  passu: [['bg', `if (!ids || typeof ids !== 'object') return false;          // pas su : on n'écarte rien`, `if (!ids || typeof ids !== 'object') return true;`],
          ['app', `if (!ids || typeof ids !== 'object') return false;          // pas su : on n'écarte rien`, `if (!ids || typeof ids !== 'object') return true;`]],
  // plus de marge : une moisson partie avant la suppression la ressusciterait
  marge: [['bg', `return !(Number(capTs) >= at + SUPPR_MARGE_MS);`, `return !(Number(capTs) >= at);`],
          ['app', `return !(Number(capTs) >= at + SUPPR_MARGE_MS);`, `return !(Number(capTs) >= at);`]],
  // l'app seule change la règle : les deux écrans divergent
  divergence: [['app', `return !(Number(capTs) >= at + SUPPR_MARGE_MS);`, `return !(Number(capTs) >= at + 60 * 60 * 1000);`]],
  // la file Leboncoin de l'extension ne lirait plus les suppressions
  filelbc: [['bg', `  const listRows = retirerSupprimeesLignes((await sbGet('app_data?id=like.harvest_*_listings&select=id,data')) || [], await lireSupprimeesTous());\n  const online = []`, `  const listRows = (await sbGet('app_data?id=like.harvest_*_listings&select=id,data')) || [];\n  const online = []`]],
};
const iM = process.argv.indexOf('--mutation');
const MUT = iM > 0 ? process.argv[iM + 1] : '';
if (MUT) {
  if (!MUTATIONS[MUT]) { console.log(`mutation inconnue : ${MUT} (${Object.keys(MUTATIONS).join(', ')})`); process.exit(2); }
  for (const [f, de, vers] of MUTATIONS[MUT]) {
    const n = F[f].split(de).length - 1;
    if (n !== 1) { console.log(`❌ mutation ${MUT} : ancre trouvée ${n} fois dans ${f} — mets la mutation à jour`); process.exit(1); }
    F[f] = F[f].replace(de, vers);
  }
  console.log(`(mutation « ${MUT} »)`);
}
const BG_MUT = path.join(os.tmpdir(), `vrm-supp-bg-${process.pid}.js`);
fs.writeFileSync(BG_MUT, F.bg);

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`); return null; } };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// ════════════════════════════════════════════════════════════════════════════
// 1-2. La page (inject.js) puis le relais (content.js)
// ════════════════════════════════════════════════════════════════════════════
function mondePage(repondre) {
  const ecoute = {}, posts = [], ordre = [];
  class FauxXHR {
    constructor() { this._l = {}; this.status = 0; }
    open(m, u) { this._m = m; this._u = u; }
    setRequestHeader() {}
    addEventListener(t, fn) { (this._l[t] = this._l[t] || []).push(fn); }
    getResponseHeader() { return 'application/json'; }
    send() { setTimeout(() => { const r = repondre(this._m, this._u); this.status = r.status; this.responseText = '{}'; (this._l.load || []).forEach((fn) => fn.call(this)); }, 1); }
  }
  const g = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms || 0, 2)), clearTimeout, setInterval: () => 0, clearInterval,
    URL, Headers: class {}, btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    location: { host: 'www.vinted.fr', origin: 'https://www.vinted.fr', href: 'https://www.vinted.fr/member/1' },
    document: { hidden: true, addEventListener() {} },
    localStorage: { getItem: () => String(Date.now()), setItem() {} },     // la moisson de la page ne démarre pas
    addEventListener(type, fn) { (ecoute[type] = ecoute[type] || []).push(fn); },
    postMessage(data) { posts.push(data); ordre.push('post:' + (data && data.kind)); },
    XMLHttpRequest: FauxXHR,
    fetch: async (url, init) => {
      const r = repondre(String((init && init.method) || 'GET'), String(url));
      return { ok: r.status < 400, status: r.status, headers: { get: () => 'application/json' }, text: async () => '{}', json: async () => ({}), clone() { return this; } };
    },
  };
  g.window = g; g.self = g; g.globalThis = g;
  vm.createContext(g);
  vm.runInContext(F.inject, g, { filename: 'inject.js' });
  return { g, posts, ordre };
}
function relais(messagesPage) {
  // content.js dans son monde isolé : on lui livre ce que la page a posté.
  const ecoute = {}, envoyes = [];
  const g = {
    console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout,
    location: { host: 'www.vinted.fr' },
    document: { createElement: () => ({ remove() {} }), head: { appendChild() {} }, documentElement: { appendChild() {} } },
    addEventListener(type, fn) { (ecoute[type] = ecoute[type] || []).push(fn); },
    postMessage() {},
    chrome: { runtime: { getURL: (p) => 'chrome-extension://x/' + p, sendMessage: (m) => envoyes.push(m) },
      storage: { local: { get: (k, cb) => cb({}) }, onChanged: { addListener() {} } } },
  };
  g.window = g; g.self = g; g.globalThis = g;
  vm.createContext(g);
  vm.runInContext(F.content, g, { filename: 'content.js' });
  const fenetre = vm.runInContext('window', g);
  for (const d of messagesPage) for (const fn of (ecoute.message || [])) fn({ source: fenetre, data: d });
  return envoyes;
}

// ════════════════════════════════════════════════════════════════════════════
// 4. La règle de l'app et celle de l'extension, extraites et exécutées
// ════════════════════════════════════════════════════════════════════════════
function regleDe(texte, quoi) {
  const m = /\/\/ <supprimees-regle>[^\n]*\n([\s\S]*?)\/\/ <\/supprimees-regle>/.exec(texte);
  if (!m) throw new Error(`bloc <supprimees-regle> introuvable dans ${quoi}`);
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(m[1] + '\n;this.supprimeeApres = supprimeeApres;', ctx);
  return ctx.supprimeeApres;
}
function lignesApp() {
  const m = /(const retirerSupprimees = [\s\S]*?)\/\/ ── DE QUAND DATE LA LECTURE DU DRESSING/.exec(F.app);
  if (!m) throw new Error('retirerSupprimees / retirerSupprimeesLignes introuvables dans App.jsx');
  const r = /\/\/ <supprimees-regle>[^\n]*\n([\s\S]*?)\/\/ <\/supprimees-regle>/.exec(F.app);
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(r[1] + '\n' + m[1] + '\n;this.f = retirerSupprimeesLignes;', ctx);
  return ctx.f;
}

// ════════════════════════════════════════════════════════════════════════════
// 5. Les files de l'extension (buildLbcData / buildEbayData) dans un vm
// ════════════════════════════════════════════════════════════════════════════
const T0 = Date.parse('2026-10-08T22:29:00.000Z');           // la lecture du dressing (inventée)
const NUMEROS = { '101': { numero: '101', title: 'Paire A', mp: { lbc: true, ebay: true } }, '202': { numero: '202', title: 'Paire B', mp: { lbc: true, ebay: true } } };
const dressing = (cap) => [{ id: 'harvest_9001_listings', data: { uid: '9001', capturedAt: new Date(cap).toISOString(), payload: { items: [
  { id: 101, title: 'Paire A', price: { amount: '40' }, is_closed: false }, { id: 202, title: 'Paire B', price: { amount: '50' }, is_closed: false }] } } }];
const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };
function projette(rows, url) {
  const sel = decodeURIComponent((/[?&]select=([^&]*)/.exec(url) || [])[1] || '');
  if (!sel || sel === '*') return rows;
  return rows.map((row) => {
    const out = {};
    for (const part of sel.split(',').map((x) => x.trim()).filter(Boolean)) {
      const m = /^(?:([^:]+):)?(.+)$/.exec(part); if (!m) continue;
      const src = m[2]; const alias = m[1] || src.split('->').pop().replace(/^>/, '');
      if (src === 'id') { out[alias] = row.id; continue; }
      if (src === 'data') { out[alias] = row.data; continue; }
      if (/^data(->|->>)/.test(src)) { let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = (v == null ? null : v[seg]); out[alias] = v == null ? null : v; continue; }
      out[alias] = row[src];
    }
    return out;
  });
}
function fileExt({ cap, supp, suppKO }) {
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout, clearTimeout, setInterval, clearInterval, URL, TextDecoder, TextEncoder,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'), atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    chrome: {
      runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener() {} }, getManifest: () => ({ version: 't' }), lastError: null, id: 'x' },
      alarms: { create() {}, onAlarm: { addListener() {} } },
      cookies: { get: dual(null), getAll: dual([]), onChanged: { addListener() {} } },
      downloads: { onCreated: { addListener() {} } },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} },
      tabs: { onUpdated: { addListener() {} }, query: dual([]), sendMessage: dual(undefined) },
      storage: { local: { get: dual({}), set: dual(undefined), remove: dual(undefined) } },
    },
    fetch: async (url, opts = {}) => {
      const u = decodeURIComponent(metaVersData(String(url)));
      const j = (d) => ({ ok: true, status: 200, json: async () => d, text: async () => JSON.stringify(d), headers: { get: () => 'application/json' } });
      if ((opts.method || 'GET') === 'POST') return { ok: true, status: 201, json: async () => ({}), text: async () => '', headers: { get: () => '' } };
      if (/_supprimees/.test(u)) {
        if (suppKO) return { ok: false, status: 522, json: async () => { throw new Error('HTML'); }, text: async () => '<html>522</html>', headers: { get: () => 'text/html' } };
        return j(projette(supp ? [{ id: 'harvest_9001_supprimees', data: { uid: '9001', ids: supp } }] : [], u));
      }
      if (/id=eq\.main/.test(u)) return j(projette([{ data: { vinted_annonce_numeros: NUMEROS, vinted_accounts_hidden: [], vinted_accounts: [{ vinted_user_id: '9001', login: 'compteA' }] } }], u));
      if (/id=like\.harvest_\*_listings/.test(u)) return j(projette(dressing(cap), u));
      return j([]);
    },
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
  vm.createContext(ctx); vm.runInContext(F.bg, ctx, { filename: 'background.js' });
  return ctx;
}
const numsDe = (r) => ((r && r.queue) || []).map((a) => String(a.numero)).sort();

(async () => {
  console.log('── 1. La page : seule une suppression RÉUSSIE part, avec son identifiant');
  await essaie('page', async () => {
    const statuts = { '1000000001': 200, '1000000002': 403, '1000000003': 500, '1000000004': 204 };
    const P = mondePage((m, u) => { const k = /items\/(\d+)/.exec(u); return { status: (k && statuts[k[1]]) || 200 }; });
    const page = [];
    await P.g.fetch('/api/v2/items/1000000001/delete', { method: 'POST' }).then(() => { P.ordre.push('page'); });
    await P.g.fetch('/api/v2/items/1000000002/delete', { method: 'POST' });
    await P.g.fetch('/api/v2/items/1000000003/delete', { method: 'POST' });
    await P.g.fetch('/api/v2/items/1000000001', { method: 'GET' });
    await P.g.fetch('/api/v2/items/1000000001/favourite', { method: 'POST' });
    await P.g.fetch('https://pub.example.com/api/v2/items/1000000001/delete', { method: 'POST' });
    const x = new P.g.XMLHttpRequest(); x.open('POST', '/api/v2/items/1000000004/delete'); x.send(); await pause(10);
    const supp = P.posts.filter((p) => p && p.kind === 'suppression');
    page.push(...supp);
    dit(supp.some((p) => p.itemId === '1000000001' && p.status === 200), 'un POST …/items/{id}/delete → 200 part, avec l’IDENTIFIANT de l’annonce', JSON.stringify(supp));
    dit(supp.some((p) => p.itemId === '1000000004' && p.status === 204), 'par XHR aussi (204)', JSON.stringify(supp));
    dit(!supp.some((p) => p.itemId === '1000000002' || p.itemId === '1000000003'), 'une suppression REFUSÉE (403) ou ÉCHOUÉE (500) ne part pas', JSON.stringify(supp.map((p) => p.itemId + '→' + p.status)));
    dit(supp.length === 2, 'ni une lecture, ni un autre geste, ni un autre site', `${supp.length} message(s)`);
    dit(P.ordre.indexOf('post:suppression') >= 0 && P.ordre.indexOf('post:suppression') < P.ordre.indexOf('page'),
      'elle part dans le rappel de la réponse, AVANT le code de la page (qui navigue)', P.ordre.join(' · '));
    dit(supp.every((p) => !('body' in p) && Object.keys(p).sort().join(',') === '__tag,at,itemId,kind,status'), 'jamais de corps : l’identifiant, le statut, l’heure', JSON.stringify(supp[0]));
    console.log('── 2. Le relais (content.js) la transmet au service worker');
    const env = relais(page);
    dit(env.filter((m) => m.kind === 'suppression').length === 2 && env.every((m) => m.from === 'cancale-content' && m.domain === 'www.vinted.fr'),
      'les deux suppressions arrivent au fond, étiquetées par NOUS (from, domain)', JSON.stringify(env));
  });

  console.log('── 3. Le fond les range, par compte, sans rien perdre');
  const TAB = { tab: { id: 7, url: 'https://www.vinted.fr/member/1' }, url: 'https://www.vinted.fr/member/1' };
  const msg = (id, status = 200, at) => ({ from: 'cancale-content', domain: 'www.vinted.fr', kind: 'suppression', itemId: id, status, at: at || new Date().toISOString() });
  const ligneSupp = (f) => (f.lignes.harvest_111_supprimees || {});
  await essaie('fond', async () => {
    const f = faireFond({ src: BG_MUT, lignes: {} });
    await f.envoyer(msg('2000000001'), TAB); await pause(30);
    dit(!!(ligneSupp(f).ids || {})['2000000001'], 'une suppression réussie est rangée dans harvest_{uid}_supprimees', JSON.stringify(ligneSupp(f)));
    dit(f.j.evts.some((e) => e && e.type === 'maj' && e.quoi === 'annonces' && e.uid === '111'), 'et l’app est prévenue (maj · annonces · compte)', JSON.stringify(f.j.evts));
    await f.envoyer(msg('2000000002', 403), TAB); await pause(30);
    dit(!(ligneSupp(f).ids || {})['2000000002'], 'un message de suppression REFUSÉE (403) n’est pas rangé — le fond revérifie', JSON.stringify(ligneSupp(f).ids));
    await f.envoyer(msg('12ab'), TAB); await pause(30);
    dit(Object.keys(ligneSupp(f).ids || {}).length === 1, 'un identifiant qui n’en est pas un n’est pas rangé', JSON.stringify(ligneSupp(f).ids));
    // Il en supprime dix à la suite : aucune ne se perd (une seule chaîne).
    await Promise.all(Array.from({ length: 10 }, (_, i) => f.envoyer(msg(String(3000000000 + i)), TAB))); await pause(80);
    const n = Object.keys(ligneSupp(f).ids || {}).filter((k) => /^30000000/.test(k)).length;
    dit(n === 10, 'dix suppressions à la suite : les dix sont rangées (aucun lire-réécrire ne perd l’autre)', `${n}/10`);
    // La PREMIÈRE vue fait foi.
    await f.envoyer(msg('2000000001', 200, new Date(Date.now() + 60000).toISOString()), TAB); await pause(30);
    dit(Date.parse(ligneSupp(f).ids['2000000001']) <= Date.now(), 'la même annonce revue plus tard garde sa PREMIÈRE heure', ligneSupp(f).ids['2000000001']);
  });
  await essaie('sans compte', async () => {
    const f = faireFond({ src: BG_MUT, lignes: {}, connecte: null });
    await f.envoyer(msg('2000000009'), TAB); await pause(30);
    dit(!Object.keys(f.lignes).some((k) => /_supprimees$/.test(k)), 'aucun compte connecté : rien n’est rangé (on ne devine pas le compte)', Object.keys(f.lignes).join(','));
  });
  await essaie('lecture ratée', async () => {
    let ko522 = true;
    const f = faireFond({ src: BG_MUT, lignes: { harvest_111_supprimees: { uid: '111', ids: { '2100000001': '2026-10-09T18:30:00.000Z' } } }, lectureKO: (u) => ko522 && /_supprimees/.test(u) });
    await f.envoyer(msg('2100000002'), TAB); await pause(30);
    const ids = (ligneSupp(f).ids || {});
    dit(ids['2100000001'] && !ids['2100000002'], 'lecture de la ligne ratée : RIEN n’est écrit (les suppressions rangées ne sont pas effacées)', JSON.stringify(ids));
    dit((f.store.vrmSupprAttente || []).some((e) => e.id === '2100000002'), 'et la suppression vue attend dans chrome.storage (le service worker peut mourir)', JSON.stringify(f.store.vrmSupprAttente));
    ko522 = false;
    await f.ctx.viderSuppressions(); await pause(20);
    const ids2 = (ligneSupp(f).ids || {});
    dit(ids2['2100000001'] && ids2['2100000002'] && !(f.store.vrmSupprAttente || []).length, 'la base revenue : elle est rangée au tour suivant, sans perdre l’ancienne', JSON.stringify(ids2));
  });

  console.log('── 4. La même règle des deux côtés (§11)');
  await essaie('règle', async () => {
    const app = regleDe(F.app, 'App.jsx'), ext = regleDe(F.bg, 'background.js');
    const at = Date.parse('2026-10-09T18:42:26.000Z');
    const ids = { '10010527192': new Date(at).toISOString() };
    const cas = [
      ['lecture d’hier, supprimée aujourd’hui', ids, '10010527192', at - 20 * 3600e3, true],
      ['une autre annonce', ids, '99', at - 20 * 3600e3, false],
      ['lecture partie AVANT, rangée 2 min après', ids, '10010527192', at + 2 * 60e3, true],
      ['dressing relu 10 min après (il fait foi)', ids, '10010527192', at + 10 * 60e3, false],
      ['lecture sans date', ids, '10010527192', NaN, true],
      ['suppressions pas lues (null)', null, '10010527192', at - 3600e3, false],
      ['aucune suppression ({})', {}, '10010527192', at - 3600e3, false],
      ['heure illisible', { '10010527192': 'n’importe' }, '10010527192', at - 3600e3, false],
    ];
    let diverge = [];
    for (const [nom, i, id, cap, attendu] of cas) {
      const a = app(i, id, cap), e = ext(i, id, cap);
      if (a !== e) diverge.push(nom);
      dit(a === attendu && e === attendu, `${nom} → ${attendu ? 'écartée' : 'gardée'}`, `app ${a} · extension ${e}`);
    }
    dit(!diverge.length, 'l’app et l’extension rendent la MÊME sortie sur tous les cas', diverge.join(' · '));
    const fApp = lignesApp();
    const ctx = fileExt({ cap: T0 }); const fExt = ctx.retirerSupprimeesLignes;
    const lignes = dressing(T0), supp = new Map([['9001', { '101': new Date(T0 + 3600e3).toISOString() }]]);
    const idsDe = (ls) => JSON.stringify((ls || []).map((r) => ((r.data && r.data.payload && r.data.payload.items) || []).map((it) => it.id)));
    const sA = idsDe(fApp(lignes, supp)), sE = idsDe(fExt(lignes, supp));
    dit(sA === sE && sA === '[[202]]', 'appliquée à des lignes de dressing : même résultat, l’annonce 101 retirée', `app ${sA} · ext ${sE}`);
    dit(JSON.stringify(fApp(lignes, null)) === JSON.stringify(lignes), 'suppressions pas lues : les lignes repartent telles quelles');
  });

  console.log('── 5. Les files Leboncoin et eBay de l’extension');
  await essaie('files', async () => {
    const supp = { '101': new Date(T0 + 20 * 3600e3).toISOString() };
    const lbc = await fileExt({ cap: T0, supp }).buildLbcData();
    dit(!numsDe(lbc).includes('101') && numsDe(lbc).includes('202'), 'Leboncoin : l’annonce supprimée APRÈS la lecture sort de la file, l’autre reste', numsDe(lbc).join(','));
    const eb = await fileExt({ cap: T0, supp }).buildEbayData();
    dit(!numsDe(eb).includes('101') && numsDe(eb).includes('202'), 'eBay : pareil', numsDe(eb).join(','));
    const ko = await fileExt({ cap: T0, suppKO: true }).buildLbcData();
    dit(numsDe(ko).includes('101'), '« pas su » (suppressions illisibles) : on n’écarte RIEN', numsDe(ko).join(','));
    const relu = await fileExt({ cap: T0 + 21 * 3600e3, supp }).buildLbcData();
    dit(numsDe(relu).includes('101'), 'le dressing relu après la suppression fait foi', numsDe(relu).join(','));
  });

  console.log('── 6. Les photos d’une annonce supprimée ne sont plus demandées à Vinted');
  await essaie('photos', async () => {
    const cap = new Date(Date.now() - 20 * 3600e3).toISOString();
    const f = faireFond({ src: BG_MUT, lignes: {
      harvest_111_listings: { capturedAt: cap, payload: { items: [{ id: 5000000001, nPhotos: 6, is_closed: false }, { id: 5000000002, nPhotos: 6, is_closed: false }] } },
      harvest_111_supprimees: { uid: '111', ids: { '5000000001': new Date().toISOString() } },
      vinted_item_details: {},
    }, vinted: () => ({ status: 404, body: {} }) });
    await f.ctx.capterPhotosAnnonces('111');
    const lus = f.j.vinted.map((x) => x.chemin).filter((c) => /5000000001|5000000002/.test(c));
    dit(!lus.some((c) => /5000000001/.test(c)), 'aucune lecture /items/{id} pour l’annonce qu’il vient de supprimer (c’était un 404 assuré)', lus.join(' · '));
    dit(lus.some((c) => /5000000002/.test(c)), 'l’autre est toujours complétée', lus.join(' · '));
  });

  try { fs.unlinkSync(BG_MUT); } catch (_) {}
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
