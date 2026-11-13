// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « ROBUSTESSE DES DONNÉES » (11 nov., revue de robustesse — couche données)
//
//  EXÉCUTE (jamais une lecture d'orthographe) :
//   · les modules neufs tels quels : `src/deconnexionSure.js`, `src/sessionOnglets.js`,
//     `src/ligneCas.js`, et la fusion par `id` de `src/fusionNuage.js` ;
//   · des fonctions EXTRAITES d'App.jsx, dans un bac à sable, avec des bouchons :
//       - `fetchVintedOrders` (relais) : une page 2 ratée ⇒ « pas su », jamais une
//         liste partielle ; 1 350 commandes ⇒ toutes (plus de coupure à 1 200) ;
//       - `lireTout` : une coupure réseau ⇒ `null` (pas une exception) ;
//       - `fetchHarvestBrut` : la base ne répond pas ⇒ `undefined` (≠ « pas de ligne ») ;
//       - `fetchVintedConversations` / `fetchVintedListings` : base en panne ⇒ AUCUN
//         appel au relais serveur ;
//       - `saveRoomPlan` : deux écrivains de la pièce ⇒ les deux gestes restent ;
//       - le tri des ACHATS de `loadOrders` : un titre « n 1234 » ne fait plus
//         disparaître un vrai achat ; une transaction aussi dans SES ventes, oui.
//  `AUDIT_RACINE=<arbre>` le joue sur un autre arbre (git archive d'avant) ;
//  `--prouve` réaffaiblit chaque règle dans une copie (scripts/_mutations-audit.cjs).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver, sansCommentaires } = require('./_mutations-audit.cjs');

const MUTATIONS = {
  'relais-page-ratee-partielle': [['src/App.jsx', "if (!res.ok) return { ok: false, error: pg === 1 ? (res.status || res.error) : 'partiel', items: [], pagination: null, partiel: pg > 1 };", "if (!res.ok) { if (pg === 1) return { ok: false, error: res.status || res.error, items: [], pagination: null }; return { ok: true, items: applyStatus(all), pagination: null }; }"]],
  'relais-plafond-12': [['src/App.jsx', 'const perPage = 100; const maxPages = 50;', 'const perPage = 100; const maxPages = 12;']],
  'liretout-leve': [['src/App.jsx', '}, opts.voirSupprimes ? { vrmVoirSupprimes: true } : {}));\n    } catch (_) { return null; }', '}, opts.voirSupprimes ? { vrmVoirSupprimes: true } : {}));\n    } catch (e) { throw e; }']],
  'harvest-pas-su-null': [['src/App.jsx', 'if (!Array.isArray(rows)) return undefined;\n    const row = rows[0] ? ligneCommandes(rows[0]) : undefined;', 'if (!Array.isArray(rows)) return null;\n    const row = rows[0] ? ligneCommandes(rows[0]) : undefined;']],
  'inbox-relais-sur-panne': [['src/App.jsx', "    if (h === undefined) return { ok: false, error: 'lecture', items: [], pagination: null, raw: null, source: 'harvest-ko' };\n", '']],
  'piece-entiere': [['src/App.jsx', 'const fus = (base && actuel) ? fusion3(sansMeta(base), sansMeta(data), sansMeta(actuel), 12) : sansMeta(data);', 'const fus = sansMeta(data);']],
  'achat-par-titre': [['src/App.jsx', "if (type === 'purchased' && soldTxns.has(id)) continue;", "if (type === 'purchased' && (soldTxns.has(id) || /\\bn\\s?\\d{3,4}\\b/i.test(String(o.title || '')))) continue;"]],
  'cas-sans-rev': [['src/ligneCas.js', "const cond = rev == null ? 'is.null' : `eq.${rev}`;\n        r = await f(`${base}/rest/v1/app_data?id=eq.${enc}${filtre}&data->>rev=${cond}`", "const cond = rev == null ? 'is.null' : `eq.${rev}`;\n        r = await f(`${base}/rest/v1/app_data?id=eq.${enc}${filtre}`"]],
  'fusion-liste-contenu': [['src/fusionNuage.js', 'if (profondeur > 0 && listeParId(l) && listeParId(n) && listeParId(bl)) return fusionParId(bl, l, n, profondeur);', '']],
  'deconnexion-sans-question': [['src/deconnexionSure.js', "  const choix = await demander(n0 == null ? 1 : n0);", "  const choix = 'quand';"]],
  'onglet-sans-adoption': [['src/sessionOnglets.js', '  if (!(Number(stockee.expires_at) > maintenant + 60000)) return null;', '  return null;']],
};
if (process.argv.includes('--prouve')) { prouver(__filename, R, MUTATIONS); return; }

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
const APP = sansCommentaires(lire('src/App.jsx'));   // un « 1) » de commentaire fausserait l'extraction

function extraire(src, nom) {
  const m = new RegExp(`^(?:export )?(?:async )?function ${nom}\\(|^(?:export )?const ${nom}\\s*=\\s*`, 'm').exec(src);
  if (!m) return '';
  const estFn = /function/.test(m[0]); let prof = 0, vuCorps = false;
  for (let i = m.index; i < src.length; i++) {
    const c = src[i];
    if (c === '(' || c === '[' || c === '{') { prof++; if (c === '{') vuCorps = true; }
    else if (c === ')' || c === ']' || c === '}') { prof--; if (estFn && vuCorps && prof === 0 && c === '}') return src.slice(m.index, i + 1); }
    else if (!estFn && c === ';' && prof === 0) return src.slice(m.index, i + 1);
  }
  return '';
}
// Le bloc équilibré qui commence au premier `{` après `debut`.
function bloc(src, debut) {
  const i = src.indexOf(debut); if (i < 0) return '';
  const a = src.indexOf('{', i + debut.length - 1); let prof = 0;
  for (let k = a; k < src.length; k++) { if (src[k] === '{') prof++; else if (src[k] === '}') { prof--; if (prof === 0) return src.slice(i, k + 1); } }
  return '';
}
const charger = async (fichier) => {
  const p = path.join(R, fichier); if (!fs.existsSync(p)) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'robu-'));
  // Le module et ses voisins (imports relatifs) copiés tels quels.
  for (const f of fs.readdirSync(path.dirname(p))) if (/\.js$/.test(f)) fs.copyFileSync(path.join(path.dirname(p), f), path.join(dir, f.replace(/\.js$/, '.mjs')));
  for (const f of fs.readdirSync(dir)) { const q = path.join(dir, f); fs.writeFileSync(q, fs.readFileSync(q, 'utf8').replace(/(from\s+['"]\.\/[^'"]+)\.js(['"])/g, '$1.mjs$2')); }
  return import('file://' + path.join(dir, path.basename(fichier).replace(/\.js$/, '.mjs')));
};
const enVm = (code, ctx, rendre) => { vm.createContext(ctx); vm.runInContext(code.replace(/^const (\w+)/, 'var $1') + `\n;globalThis.__f = ${rendre};`, ctx); return ctx.__f; };

// ── Une petite base PostgREST (app_data) qui juge `data->>rev` ────────────────
function baseFaussee(lignes = {}) {
  const L = new Map(Object.entries(lignes).map(([id, data]) => [id, JSON.parse(JSON.stringify(data))]));
  const journal = [];
  const rep = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });
  const f = async (url, init = {}) => {
    const u = decodeURIComponent(url); const meth = (init.method || 'GET').toUpperCase();
    const id = (/[?&]id=eq\.([^&]+)/.exec(u) || [])[1];
    journal.push({ meth, u });
    if (meth === 'GET') return rep(200, id && L.has(id) ? [{ id, data: JSON.parse(JSON.stringify(L.get(id))) }] : []);
    const corps = JSON.parse(init.body || 'null');
    if (meth === 'POST') {
      const lot = [].concat(corps);
      const fusion = /merge-duplicates/.test(String((init.headers || {}).Prefer || ''));
      for (const x of lot) { if (L.has(x.id) && !fusion) return rep(409, { code: '23505' }); }
      for (const x of lot) L.set(x.id, x.data);
      return rep(201, lot);
    }
    if (meth === 'PATCH') {
      if (!L.has(id)) return rep(200, []);
      const m = /data->>rev=(is\.null|eq\.(\d+))/.exec(u);
      const d = L.get(id); const rev = Number.isSafeInteger(d.rev) ? d.rev : null;
      if (m && !(m[1] === 'is.null' ? rev == null : rev === Number(m[2]))) return rep(200, []);
      L.set(id, corps.data); return rep(200, [{ id, data: corps.data }]);
    }
    return rep(200, []);
  };
  return { f, L, journal };
}

(async () => {
  // ── 1. Se déconnecter sans perdre une saisie ────────────────────────────────
  console.log('── Se déconnecter : rien ne part sans le dire (src/deconnexionSure.js)');
  const D = await charger('src/deconnexionSure.js');
  if (!D) dit(false, 'src/deconnexionSure.js existe');
  else {
    const jouer = async ({ n, choix, envoiReussit }) => {
      let reste = n, deco = 0, demande = 0, dits = [];
      const r = await D.deconnecterSansPerte({ compter: () => reste, confirmerSimple: async () => true, demander: async () => { demande++; return choix; }, envoyer: () => { if (envoiReussit) reste = 0; }, attendre: async () => {}, deconnecter: () => { deco++; }, dire: (t) => dits.push(t), delaiMs: 2000, pasMs: 500 });
      return { r, deco, demande, dits };
    };
    let x = await jouer({ n: 0, choix: null });
    dit(x.r === 'deconnecte' && x.demande === 0, 'rien en attente ⇒ la question d\'avant, puis déconnecté');
    x = await jouer({ n: 3, choix: null });
    dit(x.r === 'annule' && x.deco === 0 && x.demande === 1, '3 changements en attente ⇒ la question est posée ; « Annuler » ne déconnecte pas');
    x = await jouer({ n: 3, choix: 'envoyer', envoiReussit: true });
    dit(x.r === 'deconnecte' && x.deco === 1, '« Envoyer d\'abord » ⇒ envoi, file vide, puis déconnecté');
    x = await jouer({ n: 3, choix: 'envoyer', envoiReussit: false });
    dit(x.r === 'garde' && x.deco === 0 && x.dits.length === 1, 'envoi qui n\'aboutit pas ⇒ on RESTE connecté et on le dit', x.dits[0]);
    x = await jouer({ n: null, choix: null });
    dit(x.demande === 1 && x.deco === 0, 'file illisible (« pas su ») ⇒ traitée comme « peut-être », jamais comme 0');
  }

  // ── 2. Un seul onglet renouvelle le jeton ───────────────────────────────────
  console.log('── Deux onglets : la session renouvelée ailleurs est adoptée (src/sessionOnglets.js)');
  const S = await charger('src/sessionOnglets.js');
  if (!S) dit(false, 'src/sessionOnglets.js existe');
  else {
    const t = 1_000_000_000_000;
    const A = { access_token: 'a1', refresh_token: 'r1', expires_at: t + 30e3, user: { id: 'u1' } };
    const B = { access_token: 'a2', refresh_token: 'r2', expires_at: t + 3600e3, user: { id: 'u1' } };
    dit(S.sessionAAdopter(A, B, t) === B, 'même vendeur, jetons neufs valables ⇒ adoptée (pas de renvoi de l\'ancien jeton)');
    dit(S.sessionAAdopter(A, { ...B, user: { id: 'u2' } }, t) === null, 'un AUTRE vendeur ⇒ jamais adoptée');
    dit(S.sessionAAdopter(A, A, t) === null, 'la même session ⇒ rien à adopter');
    dit(S.sessionAAdopter(A, { ...B, expires_at: t + 10e3 }, t) === null, 'une session rangée qui expire dans la minute ⇒ pas adoptée');
    const ordre = []; let tenu = Promise.resolve();
    const locks = { request: (nom, fn) => { const p = tenu.then(() => fn()); tenu = p.catch(() => {}); return p; } };
    await Promise.all([S.sousVerrou('x', async () => { ordre.push('a+'); await new Promise((r) => setTimeout(r, 20)); ordre.push('a-'); }, { locks }), S.sousVerrou('x', async () => { ordre.push('b+'); ordre.push('b-'); }, { locks })]);
    dit(ordre.join() === 'a+,a-,b+,b-', 'deux renouvellements sous le verrou : l\'un APRÈS l\'autre', ordre.join());
  }
  // Et App.jsx s'en sert dans `authRefresh` (le chemin exécuté au banc robustesse-donnees).
  const ar = extraire(APP, 'authRefresh');
  dit(/sousVerrou\(VERROU_RENOUVELLEMENT/.test(ar) && /sessionAAdopter\(s, readSession\(\)\)/.test(ar), 'authRefresh renouvelle sous le verrou et adopte d\'abord la session d\'un autre onglet');

  // ── 3. Comparer-et-échanger (src/ligneCas.js) ───────────────────────────────
  console.log('── Une ligne réécrite par comparer-et-échanger (src/ligneCas.js)');
  const C = await charger('src/ligneCas.js');
  if (!C) dit(false, 'src/ligneCas.js existe');
  else {
    const b = baseFaussee({ vrm_email_owners: { adresses: { 'a@x.fr': { owner: 'u' } } } });
    // L'écran a lu {a} ; un autre appareil ajoute b ; l'écran ajoute c (sa liste {a,c}).
    const lu = { 'a@x.fr': { owner: 'u' } };
    b.L.set('vrm_email_owners', { adresses: { 'a@x.fr': { owner: 'u' }, 'b@x.fr': { owner: 'u' } }, rev: 4 });
    const fus = await charger('src/fusionNuage.js');
    const r = await C.modifierLigneCas({ base: 'http://b', id: 'vrm_email_owners', entetes: (x) => ({ ...(x || {}) }), fetch: b.f,
      modifier: (actuel) => ({ ...actuel, adresses: fus.fusion3(lu, { ...lu, 'c@x.fr': { owner: 'u' } }, actuel.adresses) }) });
    const fin = b.L.get('vrm_email_owners');
    dit(r.ok && fin.adresses['b@x.fr'] && fin.adresses['c@x.fr'] && fin.adresses['a@x.fr'], 'l\'adresse ajoutée ailleurs reste, la nouvelle s\'ajoute', Object.keys(fin.adresses).join(','));
    dit(fin.rev === 5, 'la version monte (5)', String(fin.rev));
    // Devancé une fois : l'écriture se refait sur la ligne relue.
    let premier = true;
    const fDev = async (u, init) => { if (premier && init && init.method === 'PATCH') { premier = false; const d = b.L.get('vrm_email_owners'); b.L.set('vrm_email_owners', { ...d, adresses: { ...d.adresses, 'd@x.fr': { owner: 'u' } }, rev: d.rev + 1 }); } return b.f(u, init); };
    const r2 = await C.modifierLigneCas({ base: 'http://b', id: 'vrm_email_owners', entetes: (x) => ({ ...(x || {}) }), fetch: fDev, modifier: (a) => ({ ...a, adresses: { ...a.adresses, 'e@x.fr': { owner: 'u' } } }) });
    const fin2 = b.L.get('vrm_email_owners');
    dit(r2.ok && fin2.adresses['d@x.fr'] && fin2.adresses['e@x.fr'], 'devancé pendant l\'écriture ⇒ relu, refait : les deux restent', Object.keys(fin2.adresses).join(','));
    const r3 = await C.modifierLigneCas({ base: 'http://b', id: 'x', entetes: () => ({}), fetch: async () => ({ ok: false, status: 503, json: async () => ({}) }), modifier: () => ({ a: 1 }) });
    dit(!r3.ok && r3.raison === 'lecture', 'lecture ratée ⇒ rien n\'est écrit');
  }
  // Listes d'objets à `id` : fusion par id (meubles, dépenses).
  const F = await charger('src/fusionNuage.js');
  if (F) {
    const b0 = [{ id: 'm1', n: 1 }, { id: 'm2', n: 1 }];
    const v = F.fusion3(b0, [{ id: 'm1', n: 2 }, { id: 'm2', n: 1 }], [{ id: 'm1', n: 1 }, { id: 'm2', n: 3 }], 6);
    dit(Array.isArray(v) && v.length === 2 && v.find((x) => x.id === 'm1').n === 2 && v.find((x) => x.id === 'm2').n === 3, 'une liste d\'objets à id : chaque côté garde SA modification, aucun doublon', JSON.stringify(v));
  }

  // ── 4. La pièce (`saveRoomPlan`) : deux écrivains ───────────────────────────
  console.log('── La pièce : la sortie automatique et un geste ne s\'écrasent plus (App.jsx saveRoomPlan)');
  {
    const code = extraire(APP, 'saveRoomPlan');
    dit(!!code, 'App.jsx porte saveRoomPlan');
    if (code) {
      const plan0 = { rooms: [{ id: 'r1', items: [{ id: 'm1', cases: { a: ['12'] } }, { id: 'm2', cases: { b: ['30'] } }] }], rev: 2 };
      const b = baseFaussee({ vrm_room: plan0 });
      // Pendant que l'écran tient la pièce lue (plan0), la sortie automatique libère le 30 (m2) :
      const libere = JSON.parse(JSON.stringify(plan0)); libere.rooms[0].items[1].cases.b = []; libere.rev = 3; b.L.set('vrm_room', libere);
      // … et l'écran range le 44 dans m1, 800 ms plus tard, depuis SA pièce :
      const ecran = JSON.parse(JSON.stringify(plan0)); delete ecran.rev; ecran.rooms[0].items[0].cases.a = ['12', '44'];
      const fus = F || {};
      const C2 = C || {};
      const ctx = { fetch: b.f, SUPABASE_URL: 'http://b', SB_CONFLICT: 'id', sbAuth: (x) => ({ ...(x || {}) }), withOwner: (o) => o, versionNumerotation: () => null, codeRefusNumeros: () => null, signalerNumerosPerimes: () => {}, modifierLigneCas: C2.modifierLigneCas ? (o) => C2.modifierLigneCas({ ...o, fetch: b.f }) : undefined, fusion3: fus.fusion3, console };
      const save = enVm(code, ctx, 'saveRoomPlan');
      const okE = await save(ecran, JSON.parse(JSON.stringify(plan0)));
      if (process.env.BAVARD) console.log(JSON.stringify(b.L.get('vrm_room')), okE, b.journal);
      const fin = b.L.get('vrm_room');
      const m1 = fin.rooms[0].items.find((x) => x.id === 'm1'), m2 = fin.rooms[0].items.find((x) => x.id === 'm2');
      dit(okE && m1 && m1.cases.a.includes('44'), 'le geste de l\'écran est écrit (44 rangé)');
      dit(m2 && Array.isArray(m2.cases.b) && !m2.cases.b.includes('30'), 'la case libérée par la sortie automatique RESTE libérée (le 30 ne ressuscite pas)', JSON.stringify(m2 && m2.cases));
    }
  }

  // ── 5. Le relais : une page ratée = pas su ──────────────────────────────────
  console.log('── Relais Vinted : jamais une liste partielle présentée comme complète (fetchVintedOrders)');
  {
    const code = extraire(APP, 'fetchVintedOrders');
    dit(!!code, 'App.jsx porte fetchVintedOrders');
    if (code) {
      const jouer = async (pages, echecA = 0) => {
        let n = 0;
        const ctx = { fetchHarvestOrders: async () => null, applyStatus: (x) => x, vintedApiCall: async (acc, ep) => { n++; const pg = Number(/[?&]page=(\d+)/.exec(ep)[1]); if (pg === echecA) return { ok: false, status: 429 }; const nb = pg <= pages.length ? pages[pg - 1] : 0; return { ok: true, data: { my_orders: Array.from({ length: nb }, (_, i) => ({ transaction_id: pg * 1000 + i })), pagination: {} } }; }, console };
        const f = enVm(code, ctx, 'fetchVintedOrders');
        const r = await f({ vinted_user_id: '1' }, 'sold', 1, 'all', {});
        return { r, n };
      };
      let x = await jouer([100, 100, 40], 2);
      dit(x.r.ok === false && !(x.r.items || []).length, 'page 2 ratée ⇒ ok:false, aucune liste partielle', `ok=${x.r.ok} n=${(x.r.items || []).length}`);
      x = await jouer([...Array(13).fill(100), 50]);
      dit(x.r.ok === true && x.r.items.length === 1350, '1 350 commandes ⇒ toutes lues (plus de coupure muette à 1 200)', `${x.r.items && x.r.items.length}`);
      x = await jouer(Array(60).fill(100));
      dit(x.r.ok === false, 'plafond atteint sur une page pleine ⇒ pas su', `ok=${x.r.ok}`);
      x = await jouer([100, 30]);
      dit(x.r.ok === true && x.r.items.length === 130, 'lecture complète ⇒ la liste entière', `${x.r.items && x.r.items.length}`);
    }
  }

  // ── 6. lireTout : une coupure réseau = pas su ───────────────────────────────
  console.log('── lireTout : une coupure réseau rend « pas su » (null), jamais une exception');
  {
    const code = extraire(APP, 'lireTout');
    dit(!!code, 'App.jsx porte lireTout');
    if (code) {
      const mk = (fetchFn) => enVm(code, { fetch: fetchFn, fetchMemo: fetchFn, SUPABASE_URL: 'http://b', PAGE_SB: 1000, sbAuth: (x) => x || {}, sansComptesSupprimes: (x) => x, console }, 'lireTout');
      let v, leve = false;
      try { v = await mk(async () => { throw new TypeError('Failed to fetch'); })('id=like.x'); } catch (_) { leve = true; }
      dit(!leve && v === null, 'fetch rejeté ⇒ null', leve ? 'a levé' : String(v));
      leve = false;
      try { v = await mk(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } }))('id=like.x'); } catch (_) { leve = true; }
      dit(!leve && v === null, 'corps illisible (page HTML) ⇒ null', leve ? 'a levé' : String(v));
    }
  }

  // ── 7. fetchHarvestBrut et les replis vers le relais ────────────────────────
  console.log('── Une base en panne n\'envoie JAMAIS au relais serveur (fetchHarvestBrut, boîte, dressing)');
  {
    const code = extraire(APP, 'fetchHarvestBrut');
    dit(!!code, 'App.jsx porte fetchHarvestBrut');
    if (code) {
      const ctx = { busyStart: () => {}, busyEnd: () => {}, lireMoissonGroupee: async () => null, ligneCommandes: (r) => r, ligneVideeParToi: () => false, dressingEnLigne: async () => null, harvestTs: () => NaN, _harvestSeen: {}, console };
      const f = enVm(code, ctx, 'fetchHarvestBrut');
      const v1 = await f('1', 'inbox');
      ctx.lireMoissonGroupee = async () => [];
      const v2 = await f('1', 'inbox');
      dit(v1 === undefined && v2 === null, 'base en panne ⇒ undefined (pas su) · ligne absente ⇒ null', `${v1} / ${v2}`);
    }
    for (const [nom, args] of [['fetchVintedConversations', [{ vinted_user_id: '1' }, 1, {}]], ['fetchVintedListings', [{ vinted_user_id: '1' }, 1, {}]]]) {
      const c = extraire(APP, nom);
      if (!c) { dit(false, `App.jsx porte ${nom}`); continue; }
      let relais = 0;
      const ctx = { fetchHarvest: async () => undefined, vintedApiCall: async () => { relais++; return { ok: false, status: 500 }; }, extSait: () => 'absente', vmrExec: async () => null, isOnlineListing: () => true, mapWardrobeItem: (x) => x, venduChezVinted: () => false, masqueeSurVinted: () => false, console };
      const f = enVm(c, ctx, nom);
      const r = await f(...args);
      dit(relais === 0 && r && r.ok === false, `${nom} : base en panne ⇒ « pas su », 0 appel au relais serveur`, `${relais} appel(s)`);
    }
  }

  // ── 8. Les achats : jamais écartés par le titre ─────────────────────────────
  console.log('── Achats : un « transfert entre tes comptes » se prouve par la transaction (loadOrders)');
  {
    const debut = APP.indexOf("    const soldTxns = type === 'purchased'");
    const boucle = debut >= 0 ? bloc(APP.slice(debut), '    for (const { acc, res } of results) {') : '';
    const avant = debut >= 0 ? APP.slice(debut, debut + APP.slice(debut).indexOf('    for (const { acc, res } of results) {')) : '';
    dit(!!boucle, 'App.jsx : le tri des commandes de loadOrders est trouvé');
    if (boucle) {
      const corps = `async function trier(type, sales, results, achatsMasques, accNameOf){\n${avant}\n${boucle}\nreturn out; }`;
      const f = enVm(corps, { console }, 'trier');
      const res = { ok: true, items: [
        { transaction_id: 1, title: 'Nike Dunk n 1234 taille 42' },      // un VRAI achat dont le vendeur a écrit « n 1234 »
        { transaction_id: 2, title: 'Air Max N°2002' },                  // idem
        { transaction_id: 3, title: 'Jordan 1' },                        // transfert : la transaction est AUSSI une de ses ventes
      ] };
      const out = await f('purchased', { items: [{ transaction_id: 3 }] }, [{ acc: { vinted_user_id: '9' }, res }], () => new Set(), () => 'c');
      const ids = out.map((o) => o.transaction_id).sort();
      dit(ids.includes(1) && ids.includes(2), 'un titre « n 1234 » / « N°2002 » ne fait plus disparaître un vrai achat', ids.join(','));
      dit(!ids.includes(3), 'la même transaction dans SES ventes ⇒ écartée (identité)', ids.join(','));
    }
  }

  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s) sur ${ok + ko}` : `\n✅ audit-robustesse-donnees : ${ok} contrôles verts`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ audit interrompu : ' + (e && e.stack || e)); process.exit(1); });
