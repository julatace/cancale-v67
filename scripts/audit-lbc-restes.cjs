// ═══════════════════════════════════════════════════════════════════════════
// LEBONCOIN — LES QUATRE RESTES MESURÉS LE 20 OCTOBRE
//   node scripts/audit-lbc-restes.cjs [--src background.js] [--inject lbc-inject.js]
//                                     [--app App.jsx] [--serveur double-vente.js]
// ═══════════════════════════════════════════════════════════════════════════
// Mesuré (lecture seule, sa base) :
//   1. ses 3 ventes Leboncoin (il est le vendeur) n'ont AUCUNE `dateVente` ; la
//      date ne vit que dans la LISTE v3 (`[].created_at`), le détail n'en porte
//      pas. La liste et les détails lus juste après arrivaient ENSEMBLE, et chaque
//      rangement réécrivait la ligne entière depuis sa propre lecture ;
//   2. ses 3 annonces vendues sont restées `status: 'active'` dans lbc_listings ;
//   3. `lbc_recon.paths` est plein (300/300, vieux format) : plus rien n'entrait ;
//   4. une bascule de compte dans le même onglet pouvait ranger « mes annonces »
//      du nouveau compte sous l'ancien (le fond gardait l'ancien compte).
// Le VRAI background.js et le VRAI lbc-inject.js sont exécutés (vm), sur les
// formes mesurées, avec des identifiants et des titres INVENTÉS.
const fs = require('fs'), vm = require('vm'), path = require('path');
const racine = path.join(__dirname, '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const SRC = fs.readFileSync(arg('--src', path.join(racine, 'vinted-sync-extension/background.js')), 'utf8');
const INJ = fs.readFileSync(arg('--inject', path.join(racine, 'vinted-sync-extension/lbc-inject.js')), 'utf8');
const APP = fs.readFileSync(arg('--app', path.join(racine, 'src/App.jsx')), 'utf8');
const SRV = fs.readFileSync(arg('--serveur', path.join(racine, 'api/_lib/double-vente.js')), 'utf8');

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };
const essaie = async (nom, fn) => { try { return await fn(); } catch (e) { dit(false, nom, 'a levé : ' + e.message); return null; } };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Le fond, à état, avec une base qui met quelques ms à répondre (réseau) ──
function fond(seed, local0) {
  const base = JSON.parse(JSON.stringify(seed || {}));
  const local = JSON.parse(JSON.stringify(local0 || {}));
  const ecouteurs = [];
  const dual = (fn) => function (...a) { const cb = a[a.length - 1]; const v = fn(...(typeof cb === 'function' ? a.slice(0, -1) : a)); if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout, clearTimeout, setInterval, clearInterval, URL, TextDecoder, TextEncoder,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'), atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    chrome: {
      runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener(f) { ecouteurs.push(f); } }, onMessageExternal: { addListener() {} }, getManifest: () => ({ version: 't' }), lastError: null, id: 'x' },
      alarms: { create() {}, clear() {}, get: dual(() => null), onAlarm: { addListener() {} } },
      cookies: { get: dual(() => null), getAll: dual(() => []), onChanged: { addListener() {} } },
      downloads: { onCreated: { addListener() {} } },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} },
      tabs: { onUpdated: { addListener() {} }, onRemoved: { addListener() {} }, query: dual(() => []), sendMessage: dual(() => undefined) },
      storage: { local: {
        get: dual((k) => { const ks = k == null ? Object.keys(local) : Array.isArray(k) ? k : typeof k === 'string' ? [k] : Object.keys(k); const o = {}; for (const x of ks) if (x in local) o[x] = JSON.parse(JSON.stringify(local[x])); return o; }),
        set: dual((o) => { for (const k in o) local[k] = JSON.parse(JSON.stringify(o[k])); }),
        remove: dual((k) => { for (const x of (Array.isArray(k) ? k : [k])) delete local[x]; }),
      }, onChanged: { addListener() {} } },
    },
    fetch: async (url, opts = {}) => {
      await attendre(4 + Math.floor(Math.random() * 4));
      const rep = (ok, body, status) => ({ ok, status: status || (ok ? 200 : 522), json: async () => JSON.parse(body), text: async () => body, headers: { get: () => 'application/json' } });
      const m = (opts.method || 'GET').toUpperCase();
      if (m === 'POST') { try { JSON.parse(opts.body || '[]').forEach((r) => { base[r.id] = JSON.parse(JSON.stringify(r.data)); }); } catch (_) {} return rep(true, '', 201); }
      if (m !== 'GET') return rep(true, '[]');
      const mm = /id=eq\.([^&]+)/.exec(String(url));
      const id = mm && decodeURIComponent(mm[1]);
      if (id && base[id] !== undefined) {
        const sel = /select=([^&]+)/.exec(String(url)); const s = sel ? decodeURIComponent(sel[1]) : 'data';
        if (s === 'data') return rep(true, JSON.stringify([{ id, data: base[id] }]));
        const row = {}; for (const part of s.split(',')) { const [alias, chemin] = part.includes(':') ? part.split(':') : [part, part]; const ks = chemin.split('->').map((x) => x.replace(/^>/, '')); let v = { data: base[id] }; for (const k of ks) v = v == null ? v : v[k]; row[alias] = v; }
        return rep(true, JSON.stringify([row]));
      }
      return rep(true, '[]');
    },
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
  vm.createContext(ctx); vm.runInContext(SRC, ctx, { filename: 'background.js' });
  ctx.authToken = async () => ({ user_id: 'owner-banc', access_token: 'jeton_banc', user_id: 'vendeur_banc', expires_at: Date.now() + 3600e3 });
  const envoyer = (msg) => new Promise((res) => {
    let fini = false; const r = (v) => { if (!fini) { fini = true; res(v); } };
    let async_ = false;
    for (const f of ecouteurs) { try { const ret = f(Object.assign({ from: 'cancale-lbc' }, msg), { tab: { id: 1, url: 'https://www.leboncoin.fr/' } }, r); if (ret === true) async_ = true; } catch (_) {} }
    setTimeout(() => r(undefined), async_ ? 4000 : 50);
  });
  return { ctx, base, local, envoyer };
}

// ── La page Leboncoin (monde MAIN) : un faux window où tourne le vrai lbc-inject ──
function page(reseau) {
  const posts = [], appels = [], intervalles = [];
  const ls = {};
  const reponse = (url) => {
    const r = reseau(url) || { status: 404, body: '{}' };
    const body = typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
    const res = { ok: r.status < 400, status: r.status, headers: { get: () => 'application/json' }, text: async () => body, json: async () => JSON.parse(body) };
    res.clone = () => res;
    return res;
  };
  const win = {
    __vrmLbcInjected: false,
    postMessage: (m) => posts.push(JSON.parse(JSON.stringify(m))),
    fetch: async (u) => { const url = typeof u === 'string' ? u : u.url; appels.push(url); await attendre(1); return reponse(url); },
  };
  const ctx = {
    window: win, location: { origin: 'https://www.leboncoin.fr', hostname: 'www.leboncoin.fr', href: 'https://www.leboncoin.fr/' },
    localStorage: { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: (k) => { delete ls[k]; } },
    URL, Headers: class {}, FormData: class {}, console: { log() {}, warn() {}, error() {} },
    setTimeout, clearTimeout, setInterval: (f) => { intervalles.push(f); return intervalles.length; }, clearInterval() {},
  };
  vm.createContext(ctx); vm.runInContext(INJ, ctx, { filename: 'lbc-inject.js' });
  // La page appelle ses propres adresses : elles passent par le crochet installé.
  const charge = async (url) => { await win.fetch(url, { method: 'GET' }); await attendre(15); };
  return { win, posts, appels, ls, charge, tic: () => intervalles.forEach((f) => f()) };
}

const OLD = 'aaaa1111-0000-4000-8000-000000000001';   // le compte d'avant
const NEW = 'bbbb2222-0000-4000-8000-000000000002';   // le compte après la bascule
const API = 'https://api.leboncoin.fr/api';
const COMPTEUR = (id) => `${API}/messaging/proxy/api/hal/${id}/counter`;
const MYADS = `${API}/adfinder/v2/myads`;
const MYADS_BODY = { ads: [{ list_id: 801, subject: 'Nike air max 1 taille 42', price: [80], status: 'active' }, { list_id: 802, subject: 'Asics gel taille 41', price: [60], status: 'active' }] };
const LISTE_URL = `${API}/consumergoods/proxy/v3/pages/transactions?limit=20&role=seller`;
const TX = 400000001;
const LISTE = [
  { id: { purchase_id: TX }, updated_at: '2026-10-02T10:00:00.000Z', created_at: '2026-09-29T08:30:00.000Z', item: { title: 'Nike air max 1 taille 42', thumbnail_url: 'https://img.leboncoin.fr/x.jpg', price: 8290, type: 'ad' }, price: 8290, user_name: 'acheteur', step: 'ongoing' },
  { id: { purchase_id: 400000002 }, updated_at: '2026-10-02T10:00:00.000Z', created_at: '2026-09-20T08:30:00.000Z', item: { title: 'Autre', thumbnail_url: 'https://img.leboncoin.fr/y.jpg', price: 1500, type: 'ad' }, price: 1500, user_name: 'x', step: 'done' },
];
const DETAIL_URL = `${API}/consumergoods/proxy/v2/pages/transactions/${TX}`;
const DETAIL = { id: 77, updated_at: '2026-10-02T10:00:00.000Z', sent_at: '2026-09-30T10:00:00.000Z', is_seller: true, delivery_method: 'mondial_relay', delivery_method_label: 'Mondial Relay', item: { id: 3300000001, title: 'Nike air max 1 taille 42', prices: { final: 8000 } }, step: { status: 'validation', label: 'Paiement effectué' } };

(async () => {
  console.log('── 1. LA LISTE (date de vente) ET UN DÉTAIL ARRIVENT ENSEMBLE : LA DATE RESTE');
  await essaie('date concurrente', async () => {
    let perdues = 0;
    for (let i = 0; i < 5; i++) {
      const f = fond({ lbc_ventes: { ventes: {} } });
      await Promise.all([
        f.envoyer({ action: 'lbcVente', url: LISTE_URL, body: JSON.stringify(LISTE) }),
        f.envoyer({ action: 'lbcVente', url: DETAIL_URL, body: JSON.stringify(DETAIL) }),
      ]);
      await attendre(80);
      const v = ((f.base.lbc_ventes || {}).ventes || {})[String(TX)] || {};
      if (!(v.dateVente === '2026-09-29T08:30:00.000Z' && v.isSeller === true && v.price === 8000)) perdues++;
    }
    dit(perdues === 0, 'la vente garde SA date (liste) ET son côté vendeur + prix (détail), 5 essais sur 5', perdues + ' essai(s) où la date ou le détail a été effacé');
    const f = fond({ lbc_ventes: { ventes: {} } });
    await f.envoyer({ action: 'lbcVente', url: DETAIL_URL, body: JSON.stringify(DETAIL) });
    await attendre(30);
    const v = ((f.base.lbc_ventes || {}).ventes || {})[String(TX)] || {};
    dit(!v.dateVente, 'le détail seul ne date rien (jamais l’heure de capture)', 'dateVente=' + (v.dateVente || '—'));
  });

  console.log('\n── 1b. UNE VENTE OUVERTE DIRECTEMENT, JAMAIS VUE DATÉE : LA PAGE RELIT LA LISTE QUE LE SITE A DEMANDÉE');
  await essaie('relecture liste', async () => {
    const reseau = (u) => (u === LISTE_URL ? { status: 200, body: LISTE } : u === DETAIL_URL ? { status: 200, body: DETAIL } : null);
    // Visite 1 : la page a demandé la liste (sans cette vente).
    const p = page((u) => (u === LISTE_URL ? { status: 200, body: [LISTE[1]] } : reseau(u)));
    await p.charge(LISTE_URL);
    await attendre(900);           // le crochet relit les détails de la liste (ici aucun à lire)
    p.appels.length = 0;
    await p.charge(DETAIL_URL);    // il ouvre la vente directement (un lien)
    await attendre(950);
    dit(p.appels.includes(LISTE_URL), 'la liste EXACTE déjà demandée par le site est relue (aucune adresse devinée)', JSON.stringify(p.appels));
    const nListe = p.appels.filter((u) => u === LISTE_URL).length;
    p.appels.length = 0;
    await p.charge(DETAIL_URL);
    await attendre(950);
    dit(!p.appels.includes(LISTE_URL), 'pas une seconde fois avant 6 h', 'relectures=' + nListe + ' puis ' + p.appels.filter((u) => u === LISTE_URL).length);
    // Sans aucune liste vue : rien n'est inventé.
    const q = page(reseau);
    await q.charge(DETAIL_URL); await attendre(950);
    dit(!q.appels.some((u) => /v3\/pages\/transactions/.test(u)), 'jamais vu de liste ⇒ aucune adresse fabriquée', JSON.stringify(q.appels));
    // Déjà vue datée : on ne relit pas.
    const r2 = page(reseau);
    await r2.charge(LISTE_URL); await attendre(950); r2.appels.length = 0;
    await r2.charge(DETAIL_URL); await attendre(950);
    dit(!r2.appels.includes(LISTE_URL), 'une vente déjà vue datée ne fait rien relire');
  });

  console.log('\n── 2. UNE ANNONCE VENDUE (vente prouvée) N’EST PLUS « EN VENTE », MÊME `status: active`');
  const extraire = (src) => { const m = /\/\/ <lbc-en-vente-regle>[\s\S]*?\/\/ <\/lbc-en-vente-regle>/.exec(src); return m ? m[0] : null; };
  const rApp = extraire(APP), rExt = extraire(SRC), rSrv = extraire(SRV);
  dit(!!rApp && rApp === rExt && rExt === rSrv, 'la règle est la MÊME, texte pour texte, dans l’app, l’extension et le serveur (§11)', [rApp, rExt, rSrv].map((x) => (x ? x.length : 'absente')).join(' / '));
  const ventes = { [TX]: { txId: String(TX), isSeller: true, itemId: '3300000001', stepStatus: 'validation' }, '9': { txId: '9', isSeller: true, itemId: '3300000009', stepStatus: 'cancelled' }, '8': { txId: '8', isSeller: false, itemId: '3300000008' } };
  const ads = { '3300000001': { id: '3300000001', subject: 'Nike', status: 'active', ref: '12' }, '3300000009': { id: '3300000009', subject: 'Vans', status: 'active', ref: '13' }, '3300000008': { id: '3300000008', subject: 'Puma', status: 'active', ref: '14' }, '3300000007': { id: '3300000007', subject: 'Morte', status: 'deleted', ref: '15' } };
  if (rApp) await essaie('règle app', async () => {
    const c = {}; vm.createContext(c); vm.runInContext(rApp + '\n;this.f=annonceLbcEnVente;this.v=annoncesLbcVendues;', c);
    const vd = c.v(ventes);
    const en = Object.values(ads).filter((a) => c.f(a, vd)).map((a) => a.id).sort();
    dit(JSON.stringify(en) === JSON.stringify(['3300000008', '3300000009']), 'vendue (prouvée) ⇒ hors vente ; vente annulée ou achat ⇒ toujours en vente ; morte ⇒ hors vente', JSON.stringify(en));
  });
  await essaie('fond lireLbcAnnonces', async () => {
    const f = fond({ lbc_listings: { items: ads }, lbc_ventes: { ventes }, lbc_accounts: { accounts: {} } });
    const r = await f.ctx.lireLbcAnnonces();
    const ids = (r.items || []).map((a) => a.id).sort();
    dit(!ids.includes('3300000001'), 'l’extension : l’annonce vendue sort de ses annonces en vente', JSON.stringify(ids));
    dit(ids.includes('3300000009'), 'l’extension : une vente ANNULÉE la laisse en vente');
  });
  await essaie('serveur', async () => {
    const m2 = await import(require('url').pathToFileURL(arg('--serveur', path.join(racine, 'api/_lib/double-vente.js'))).href);
    const map = m2.annoncesLbcParNumero(ads, ventes, {}, null);
    dit(!map.has('12') && map.has('13'), 'le serveur (double vente) : la paire vendue sur Leboncoin n’y est plus « en vente »', JSON.stringify([...map.keys()]));
  });

  console.log('\n── 3. LES CHEMINS VUS : PLEINS (300/300), LES NEUFS ENTRENT, LES ANCIENS TOMBENT, CE QUI SERT RESTE');
  await essaie('chemins', async () => {
    const vieux = Array.from({ length: 290 }, (_, i) => `www.leboncoin.fr/_next/data/{id}/page${i}.json`)
      .concat(Array.from({ length: 10 }, (_, i) => `api.leboncoin.fr/api/consumergoods/proxy/v${i}/pages/transactions`));
    const f = fond({ lbc_recon: { paths: vieux, samples: [] } });
    const neufs = ['GET api.leboncoin.fr/api/shippingproxy/v1/parcels/{id}/label → 200 [pdf]', 'GET www.leboncoin.fr/compte/part/page999 → 200 [html]'];
    await f.envoyer({ action: 'lbcPaths', paths: neufs, url: 'https://www.leboncoin.fr/' });
    await attendre(60);
    const p = (f.base.lbc_recon || {}).paths || [];
    dit(neufs.every((x) => p.includes(x)), 'les chemins NEUFS entrent dans une ligne pleine', p.length + ' chemins, neufs présents : ' + neufs.filter((x) => p.includes(x)).length + '/2');
    dit(p.length <= 300, 'la ligne reste bornée à 300', String(p.length));
    dit(p.filter((x) => /transactions/.test(x)).length === 10, 'les chemins qui servent (transactions) ne tombent pas', String(p.filter((x) => /transactions/.test(x)).length));
    dit(!p.includes('www.leboncoin.fr/_next/data/{id}/page0.json') && p.includes('www.leboncoin.fr/_next/data/{id}/page289.json'), 'ce sont les plus anciens qui tombent (le plus ancien parti, le plus récent gardé)');
    // Un ancien chemin nu dont la forme neuve arrive : un seul exemplaire.
    const f2 = fond({ lbc_recon: { paths: ['api.leboncoin.fr/api/adfinder/v2/myads'] } });
    await f2.envoyer({ action: 'lbcPaths', paths: ['GET api.leboncoin.fr/api/adfinder/v2/myads → 200 [json]'], url: 'x' });
    await attendre(60);
    const p2 = (f2.base.lbc_recon || {}).paths || [];
    dit(p2.length === 1 && /^GET /.test(p2[0]), 'l’ancienne forme nue s’efface devant la neuve (pas de doublon)', JSON.stringify(p2));
    // Côté page : un chemin revu repart parmi les 200 plus récents.
    const pg = page(() => ({ status: 200, body: {} }));
    for (let i = 0; i < 250; i++) await pg.win.fetch(`${API}/x${i}/y`);
    await pg.win.fetch(`${API}/x0/y`);
    await attendre(10); pg.tic();
    const dernier = pg.posts.filter((m) => m.kind === 'lbcpaths').pop();
    dit(!!dernier && dernier.paths.some((x) => /\/x0\/y/.test(x)) && dernier.paths.some((x) => /\/x249\/y/.test(x)), 'la page envoie les 200 PLUS RÉCENTS (un chemin revu en fait partie)', dernier ? dernier.paths.length + ' envoyés' : 'rien');
  });

  console.log('\n── 4. BASCULE DE COMPTE DANS LE MÊME ONGLET : « MES ANNONCES » JAMAIS SOUS L’ANCIEN COMPTE');
  await essaie('page : compteur de CE document', async () => {
    const reseau = (u) => (u.includes('/counter') ? { status: 200, body: { userId: 'x', unread: 0, pollingTime: 30 } } : u === MYADS ? { status: 200, body: MYADS_BODY } : null);
    // Nouveau document : « mes annonces » arrive AVANT le compteur.
    const p = page(reseau);
    await p.charge(MYADS);
    const avant = p.posts.filter((m) => m.kind === 'lbcraw');
    dit(avant.length === 0, 'avant le compteur de ce document, la liste n’est pas envoyée (elle attend)', avant.length + ' envoi(s)');
    await p.charge(COMPTEUR(NEW));
    const apres = p.posts.filter((m) => m.kind === 'lbcraw');
    dit(apres.length === 1 && apres[0].session === NEW, 'au compteur, elle part avec CE compte', JSON.stringify(apres.map((m) => m.session)));
    // Compteur puis liste : immédiat.
    const q = page(reseau);
    await q.charge(COMPTEUR(NEW)); await q.charge(MYADS);
    const qq = q.posts.filter((m) => m.kind === 'lbcraw');
    dit(qq.length === 1 && qq[0].session === NEW, 'compteur déjà relu dans ce document ⇒ elle part tout de suite avec lui');
    // Deux comptes dans le même document : plus rien n'est attribué.
    const r = page(reseau);
    await r.charge(COMPTEUR(OLD)); await r.charge(COMPTEUR(NEW)); await r.charge(MYADS);
    dit(r.posts.filter((m) => m.kind === 'lbcraw').length === 0, 'deux comptes vus dans le même document ⇒ rien n’est attribué');
  });
  await essaie('fond : le compte de la page, jamais le dernier vu', async () => {
    // Le fond croit encore au compte d'AVANT (bascule) ; la liste arrive avec le compte de la page.
    const vieux = { vrmLbcCompte: { v: 2, id: OLD, name: 'Ancien', type: 'pro', at: Date.now() } };
    const f = fond({}, vieux);
    await f.envoyer({ action: 'lbcRaw', url: MYADS, body: JSON.stringify(MYADS_BODY), session: NEW });
    await attendre(60);
    const items = Object.values(((f.base.lbc_listings || {}).items) || {});
    dit(items.length === 2 && items.every((i) => i.account === NEW), 'rangées sous le compte que la page a lu (le nouveau)', JSON.stringify(items.map((i) => i.account)));
    dit(!items.some((i) => i.accountName === 'Ancien'), 'aucun nom de l’ancien compte collé dessus');
    const g = fond({}, vieux);
    await g.envoyer({ action: 'lbcRaw', url: MYADS, body: JSON.stringify(MYADS_BODY) });
    await attendre(60);
    const it2 = Object.values(((g.base.lbc_listings || {}).items) || {});
    dit(!it2.some((i) => i.account === OLD), 'sans compte joint par la page : rien n’est rangé sous l’ancien compte', JSON.stringify(it2.map((i) => i.account)));
    // Un compte LIÉ n'est jamais la session, même joint par la page.
    const h = fond({}, Object.assign({ vrmLbcLies: { ids: [NEW], at: Date.now() } }, vieux));
    await h.envoyer({ action: 'lbcRaw', url: MYADS, body: JSON.stringify(MYADS_BODY), session: NEW });
    await attendre(60);
    const it3 = Object.values(((h.base.lbc_listings || {}).items) || {});
    dit(!it3.some((i) => i.account === NEW || i.account === OLD), 'un compte de la liste des comptes liés n’est jamais pris pour la session');
  });

  console.log(ko === 0 ? '\nLeboncoin : ventes datées, vendues hors vente, chemins vivants, compte de la page.' : '\n' + ko + ' contrôle(s) au rouge.');
  process.exit(ko === 0 ? 0 : 1);
})();
