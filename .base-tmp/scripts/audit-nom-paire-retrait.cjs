#!/usr/bin/env node
// AUDIT (13 nov., lot 7) — LE NOM DE LA PAIRE SUR CHAQUE COLIS À RETIRER, JUSQU'AU WIDGET DE L'IPHONE.
// Julien : « chaque colis à retirer porte le nom de la paire qui est dedans » — au lieu de « Colis Mondial Relay ».
// Règle §5 : relié UNIQUEMENT par identité (n° de suivi, code de retrait, conversation de SA commande) ; mieux vaut
// « Colis {transporteur} » qu'un faux nom. Il EXÉCUTE :
//   1. la règle partagée `commandeUnique` (api/_lib/commande-colis.js) : deux chemins d'identité qui désignent deux
//      commandes différentes ⇒ personne ; un seul ⇒ lui ;
//   2. la relecture partagée `retirerPublie` (api/_lib/retrait-colis.js) : le nom publié par l'app ([7]) suit chaque
//      colis compté, et un colis sorti (retiré) n'est plus nommé ;
//   3. la VRAIE route api/widget.js sur une fausse base à la forme de PostgREST : `pickupColis` = chaque colis encore
//      compté, par SON nom (publié par l'app), sinon « Colis {transporteur} » ; le plus pressé d'abord ; le widget ne
//      relie rien lui-même (aucun nom pris à un achat « au point relais » du même point).
// L'écran (Colis → À retirer, mode relais, Ma journée, hors ligne, liste publiée) : banc
// scripts/bancs/retirer-nom-paire.cjs. Fixtures INVENTÉES. `--prouve` : chaque mutation doit rendre ROUGE.
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');

const MUTATIONS = {
  // deux commandes différentes : on garde la première (devinée)
  'unique-devine': ['api/_lib/commande-colis.js', "  return vus.every((o) => String(o.transaction_id) === tx) ? vus[0] : null;", '  return vus[0];'],
  // le nom publié n'est plus relu
  'nom-pas-relu': ['api/_lib/retrait-colis.js', "liste.push({ nom: typeof c[7] === 'string'", "liste.push({ nom: false && typeof c[7] === 'string'"],
  // le widget ne donne plus la liste
  'widget-sans-liste': ['api/widget.js', '      pickupColis: pubRetirer ? colisNommes(pubRetirer.liste) : null,', '      pickupColis: null,'],
  // le widget écrit « Colis » sans le transporteur
  'widget-sans-transporteur': ['api/widget.js', "  return t !== 'Colis' ? `Colis ${t}` : 'Colis';", "  return 'Colis';"],
};
if (process.argv.includes('--prouve')) {
  let rates = 0;
  for (const [nom, [f, de, vers]] of Object.entries(MUTATIONS)) {
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-nom-paire-'));
    for (const x of ['api', 'src']) fs.cpSync(path.join(R, x), path.join(t, x), { recursive: true });
    fs.copyFileSync(path.join(R, 'package.json'), path.join(t, 'package.json'));
    fs.symlinkSync(fs.realpathSync(path.join(R, 'node_modules')), path.join(t, 'node_modules'));
    const src = fs.readFileSync(path.join(t, f), 'utf8');
    if (src.split(de).length !== 2) { console.log(`❌ mutation ${nom} : ancre ${src.includes(de) ? 'pas unique' : 'introuvable'} dans ${f}`); rates++; fs.rmSync(t, { recursive: true, force: true }); continue; }
    fs.writeFileSync(path.join(t, f), src.replace(de, vers));
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_RACINE: t }, encoding: 'utf8' });
    const rouges = (r.stdout.match(/^❌/gm) || []).length;
    const tombe = r.status !== 0 && rouges > 0;
    if (!tombe) rates++;
    console.log(`${tombe ? '✅' : '❌'} mutation « ${nom} » ⇒ ${tombe ? rouges + ' rouge(s)' : 'VERTE (le contrôle ne la voit pas)'}`);
    fs.rmSync(t, { recursive: true, force: true });
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) non attrapée(s)` : `\n✅ ${Object.keys(MUTATIONS).length}/${Object.keys(MUTATIONS).length} mutations attrapées`);
  process.exit(rates ? 1 : 0);
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d ? ' — ' + d : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' — le contrôle a pu s’exécuter', String((e && e.stack) || e).split('\n').slice(0, 2).join(' ').slice(0, 240)); } };
const importer = (p) => import('file://' + path.join(R, p));

// ── Une fausse base à état, à la forme de PostgREST (reprise d'audit-rappels-paire.cjs) ──
const A = '11111111-2222-3333-4444-555555555555';
process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.VRM_OWNER_UID = A;
process.env.EMAIL_INBOUND_SECRET = 'cle-banc-paire';
process.env.CRON_SECRET = 'cle-banc-cron';
process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';
delete process.env.AI_API_KEY; delete process.env.ANTHROPIC_API_KEY;
const webpush = require(path.join(R, 'node_modules', 'web-push'));
const pushes = [];
webpush.setVapidDetails = () => {};
webpush.sendNotification = async (sub, body) => { pushes.push({ endpoint: sub.endpoint, ...JSON.parse(body) }); return { statusCode: 201 }; };

const base = new Map();
let pannes = new Set(), acces = true;
const lus = [], ecrits = [];
const rep = (c, s = 200) => new Response(typeof c === 'string' ? c : JSON.stringify(c), { status: s, headers: { 'content-type': 'application/json' } });
const chemin = (obj, ch) => { let v = obj; for (const seg of ch.split(/->>|->/)) v = v == null ? undefined : v[seg]; return v; };
// La colonne `meta` : les scalaires de premier niveau ≤ 600 caractères (vrm_meta).
const metaDe = (d) => { const m = {}; if (d && typeof d === 'object') for (const [k, v] of Object.entries(d)) { if (v == null || typeof v === 'object') continue; const s = String(v); if (s.length <= 600) m[k] = s; } return m; };
const valeur = (l, k) => {
  if (k === 'id') return l.id; if (k === 'owner') return l.owner;
  if (k.startsWith('meta->>')) return metaDe(l.data)[k.slice(7)];
  if (k.startsWith('data->>') || k.startsWith('data->')) { const v = chemin(l.data, k.replace(/^data(->>|->)/, '')); return v == null ? undefined : (typeof v === 'object' ? JSON.stringify(v) : String(v)); }
  return undefined;
};
const teste = (x, op) => {
  const i = op.indexOf('.'); const o = op.slice(0, i), v = op.slice(i + 1);
  if (o === 'eq') return x === v;
  if (o === 'neq') return x !== v;
  if (o === 'like' || o === 'ilike') { const re = new RegExp('^' + v.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*') + '$', o === 'ilike' ? 'i' : ''); return x != null && re.test(x); }
  if (o === 'in') return v.replace(/^\(|\)$/g, '').split(',').map((y) => y.replace(/^"|"$/g, '')).includes(x);
  if (o === 'is') return v === 'null' ? x == null : true;
  if (o === 'not') return !teste(x, v);
  // (13 nov.) `cs` sur un tableau JSON : chaque objet demandé est contenu dans un élément (PostgREST `@>`).
  if (o === 'cs') { try { const arr = JSON.parse(x); const voulu = JSON.parse(v); return Array.isArray(arr) && voulu.every((w) => arr.some((a) => a && Object.entries(w).every(([kk, vv]) => a[kk] === vv))); } catch (_) { return false; } }
  return true;
};
const decoupeOr = (s) => { const out = []; let p = 0, cur = ''; for (const ch of s.replace(/^\(|\)$/g, '')) { if (ch === '(') p++; if (ch === ')') p--; if (ch === ',' && !p) { out.push(cur); cur = ''; } else cur += ch; } if (cur) out.push(cur); return out; };
const filtrer = (u) => {
  const conds = [];
  for (const [k, v] of u.searchParams) {
    if (['select', 'on_conflict', 'limit', 'order', 'offset'].includes(k)) continue;
    if (k === 'or') { const alts = decoupeOr(v).map((e) => { const j = e.indexOf('.'); return [e.slice(0, j), e.slice(j + 1)]; }); conds.push((l) => alts.some(([kk, op]) => teste(valeur(l, kk), op))); continue; }
    conds.push((l) => teste(valeur(l, k), v));
  }
  return [...base.entries()].map(([cle, d]) => { const i = cle.indexOf('|'); return { owner: cle.slice(0, i), id: cle.slice(i + 1), data: d }; }).filter((l) => conds.every((c) => c(l)));
};
const projeter = (l, sel) => {
  if (!sel || sel === '*') return { owner: l.owner, id: l.id, data: l.data };
  const o = {};
  for (const part of sel.split(',')) {
    const [alias, ch] = part.includes(':') ? part.split(/:(.+)/) : [part.split(/->>|->/).pop(), part];
    if (ch === 'id' || ch === 'owner') { o[alias] = l[ch]; continue; }
    if (ch === 'data') { o[alias] = l.data; continue; }
    if (ch.startsWith('meta->>')) { const v = metaDe(l.data)[ch.slice(7)]; o[alias] = v == null ? null : v; continue; }
    const v = chemin(l.data, ch.replace(/^data(->>|->)/, ''));
    o[alias] = v === undefined ? null : (/->>[^>]*$/.test(ch) && v != null && typeof v !== 'object' ? String(v) : v);
  }
  return o;
};
global.fetch = async (url, opts = {}) => {
  const u = new URL(String(url));
  const m = (opts.method || 'GET').toUpperCase();
  const brut = decodeURIComponent(u.pathname + u.search);
  if (u.pathname === '/rest/v1/rpc/vrm_acces_pour') return rep(acces);
  if (u.pathname === '/rest/v1/vinted_accounts') return rep([]);
  if (u.pathname !== '/rest/v1/app_data') return rep([]);
  if (m === 'POST') {
    const prefer = String((opts.headers && (opts.headers.Prefer || opts.headers.prefer)) || '');
    // (29 oct.) `return=representation` rend les lignes VRAIMENT écrites, comme
    // PostgREST (une ligne ignorée en doublon n'y est pas) — le comparer-et-échanger
    // de `push_dedup` (`modifierCas`) le lit (§6.3 : la forme de la réponse).
    const ecritesIci = [];
    for (const r of JSON.parse(opts.body || '[]')) {
      ecrits.push({ id: r.id, owner: r.owner || A });
      if (pannes.has('ecrire:' + r.id)) return rep('<html>522</html>', 522);
      const cle = `${r.owner || A}|${r.id}`;
      if (/ignore-duplicates/.test(prefer) && base.has(cle)) continue;
      base.set(cle, r.data);
      ecritesIci.push({ owner: r.owner || A, id: r.id, data: r.data });
    }
    return /return=representation/.test(prefer) ? rep(ecritesIci, 201) : new Response('', { status: 201 });
  }
  if (m === 'PATCH') {
    const corps = JSON.parse(opts.body || '{}');
    const t = filtrer(u); for (const l of t) base.set(`${l.owner}|${l.id}`, corps.data);
    return rep(t.map((l) => ({ id: l.id })));
  }
  if (m === 'DELETE') { for (const l of filtrer(u)) base.delete(`${l.owner}|${l.id}`); return new Response('', { status: 204 }); }
  lus.push(brut);
  for (const p of pannes) if (p.startsWith('lire:') && brut.includes(p.slice(5))) return new Response('<html>522</html>', { status: 522, headers: { 'content-type': 'text/html' } });
  const sel = u.searchParams.get('select') || '';
  if (sel === 'owner' && u.searchParams.get('limit') === '1') return rep([]);   // base cloisonnée
  return rep(filtrer(u).map((l) => projeter(l, sel)));
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.send = () => r; r.end = () => r; return r; };

(async () => {
  // ── 1. La règle partagée : une commande, ou personne ──
  await essaie('commandeUnique', async () => {
    const M = await importer('api/_lib/commande-colis.js');
    const a = { transaction_id: 9501, title: 'Paire A' }, a2 = { transaction_id: '9501', title: 'Paire A' }, b = { transaction_id: 9502, title: 'Paire B' };
    dit(typeof M.commandeUnique === 'function', '1a la règle partagée existe (api/_lib/commande-colis.js, `commandeUnique`)');
    if (typeof M.commandeUnique !== 'function') return;
    dit(M.commandeUnique(a, null) === a && M.commandeUnique(null, b) === b, '1b un seul chemin d\'identité trouve la commande ⇒ elle');
    dit(M.commandeUnique(a, a2) === a, '1c deux chemins, la même transaction ⇒ elle');
    dit(M.commandeUnique(a, b) === null, '1d deux chemins, deux commandes différentes ⇒ personne (jamais un nom choisi)');
    dit(M.commandeUnique(null, undefined) === null, '1e aucun chemin ⇒ personne');
  });

  // ── 2. La relecture partagée de la liste publiée ──
  await essaie('retirerPublie', async () => {
    const P = await importer('api/_lib/retrait-colis.js');
    const T = Date.parse('2026-11-13T09:00:00Z');
    const pub = { at: T - 3600e3, aVerifier: 0, colis: [
      ['2026-11-17', T - 86400e3, 'mondialrelay', 'e:40000001', 1, '', '', 'Paire inventée bleue 42'],
      ['2026-11-14', T - 86400e3, 'chronopost', 'e:06000000000001', 1, '', '', ''],
      ['2026-11-18', T - 86400e3, 'mondialrelay', 'e:40000009', 1, '', '', 'Paire retirée'],
      ['2026-11-16', T - 86400e3, 'vinted', 'e:1VGO00000001', 1, '', ''],            // publication d'avant : pas de [7]
    ] };
    const sorti = (cle) => (cle === 'e:40000009' ? true : false);
    const r = P.retirerPublie(pub, T, '2026-11-13', sorti);
    const L = (r && r.liste) || [];
    dit(!!r && r.n === 3 && L.length === 3, '2a les colis comptés, un par un (le retiré sort)', JSON.stringify(r && { n: r.n, liste: L }));
    const nom = (tr) => (L.find((x) => x.transporteur === tr) || {}).nom;
    dit(nom('mondialrelay') === 'Paire inventée bleue 42', '2b le nom publié par l\'app suit SON colis', JSON.stringify(L));
    dit(nom('chronopost') === '' && nom('vinted') === '', '2c sans nom publié (aucune identité, ou publication d\'avant) ⇒ vide, jamais deviné', JSON.stringify(L));
    dit(!L.some((x) => x.nom === 'Paire retirée'), '2d un colis sorti (retiré) n\'est plus nommé', JSON.stringify(L));
  });

  // ── 3. La vraie route du widget ──
  await essaie('route api/widget', async () => {
    base.clear();
    const T0 = Date.parse('2026-11-13T07:00:00Z');
    base.set(`${A}|main`, {
      vrm_widget_token: '', vinted_pickup_done: {}, vinted_ship_done: {}, vinted_bords_shipped: {}, vinted_bords_hidden: {}, vrm_colis_collected: [],
      vrm_colis_retirer: { total: 4, prets: 4, sansCode: 0, aVerifier: 0, urgents: 1, at: T0, vus: [], vusTx: [], finis: [],
        colis: [
          ['2026-11-17', T0 - 86400e3, 'mondialrelay', 'e:40000001', 1, '', '', 'Paire inventée bleue 42'],
          ['2026-11-14', T0 - 86400e3, 'chronopost', 'e:06000000000001', 1, '', '', ''],
          ['2026-11-16', T0 - 86400e3, 'mondialrelay', 'e:40000002', 1, '', ''],
          ['2026-11-18', T0 - 86400e3, 'vinted', 'v:111:9502', 1, '', '', 'Paire inventée argent'],
        ] },
    });
    // Les e-mails « disponible » de ces colis (le widget relit qu'ils sont encore là).
    const tr = (carrier, suivi, o = {}) => base.set(`${A}|email_track_${carrier}_${suivi}`, { type: 'suivi', carrier, suivi, status: 'available', subject: `Votre colis ${suivi} est disponible`, receivedAt: '2026-11-12T08:00:00Z', emailAt: '2026-11-12T08:00:00Z', arriveLe: '2026-11-12T08:00:00Z', lieu: 'SUPER U ACCUEIL, 2 Avenue de la Mer, 35260 Cancale', ...o });
    tr('mondialrelay', '40000001', { limite: '2026-11-17', code: '400001' }); tr('chronopost', '06000000000001', { limite: '2026-11-14', code: '700001' }); tr('mondialrelay', '40000002', { limite: '2026-11-16', code: '400002' });
    // Le PIÈGE : un achat « au point relais » (même point, même jour) qu'aucune identité ne relie au Chronopost.
    base.set(`${A}|harvest_111_orders_purchased`, { capturedAt: '2026-11-13T06:00:00Z', resume: { n: 1, at: '2026-11-13T06:00:00Z', txns: ['9502'] }, payload: { my_orders: [
      { transaction_id: 9504, title: 'Paire piège noire', status: 'Colis déposé en point relais', transaction_user_status: 'needs_action' },
      { transaction_id: 9502, title: 'Paire inventée argent', status: 'Colis déposé en point relais', transaction_user_status: 'needs_action' },
    ] } });
    const w = await importer('api/widget.js');
    const res = faireRes();
    const VraieDate = Date, FIXE = Date.parse('2026-11-13T09:00:00Z');
    global.Date = class extends VraieDate { constructor(...a) { if (a.length) super(...a); else super(FIXE); } static now() { return FIXE; } };
    try { await w.default({ method: 'GET', headers: {}, query: {} }, res); } finally { global.Date = VraieDate; }
    const c = res.corps || {};
    dit(res.code === 200, '3a le widget répond', `HTTP ${res.code}`);
    const L = Array.isArray(c.pickupColis) ? c.pickupColis : null;
    dit(!!L && L.length === 4, '3b `pickupColis` : chaque colis compté de la liste de l\'app', JSON.stringify(c.pickupColis));
    if (!L) return;
    const noms = L.map((x) => x.nom);
    dit(noms.includes('Paire inventée bleue 42') && noms.includes('Paire inventée argent'), '3c le nom de la paire (relié par identité, publié par l\'app) sur son colis', JSON.stringify(noms));
    dit(noms.includes('Colis Chronopost') && noms.includes('Colis Mondial Relay'), '3d sans nom : « Colis {transporteur} »', JSON.stringify(noms));
    dit(!noms.some((n) => /piège/.test(n)), '3e le widget ne relie rien lui-même : aucun nom pris à un achat du même point', JSON.stringify(noms));
    dit(L[0].nom === 'Colis Chronopost' && L[0].jours === 1, '3f le plus pressé d\'abord (dernier jour demain)', JSON.stringify(L[0]));
    dit(L.filter((x) => x.paire).length === 2 && L.every((x) => typeof x.paire === 'boolean'), '3g `paire` dit si le nom est celui d\'une paire (sinon le transporteur)', JSON.stringify(L));
  });

  console.log(`\n${ko ? '❌' : '✅'} audit-nom-paire-retrait : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
