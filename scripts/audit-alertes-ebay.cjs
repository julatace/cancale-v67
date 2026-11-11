// ════════════════════════════════════════════════════════════════════════════
//  LES ALERTES D'ACHAT eBAY, EXÉCUTÉES (11 nov., lot alertes-ebay)
//        node scripts/audit-alertes-ebay.cjs [--src dossier] [--prouve]
//
//  Exécute le VRAI code : la règle pure (api/_lib/ebay-alertes.js,
//  src/alertesEbayMarge.js, `compterAppel`, `veille.alerte` de metier.js), le VRAI
//  passage `api/ship-reminders.js?moment=alertes` et la VRAIE route `api/ebay.js`
//  (action `alertes`), contre une fausse base à état (forme réelle : app_data
//  owner/id/data, projections `alias:data->x`, filtre `cs` sur le JSON, PATCH
//  `data->>rev=eq.`, POST 409) et un FAUX eBay (OAuth client_credentials, Browse
//  `item_summary/search`, formes de la documentation — NON MESURÉES).
//  Données inventées (dépôt public).
//    R  la règle : 1re lecture muette ; nouvelle annonce = itemId jamais vu, une
//       fois toutes recherches confondues ; retirée ⇒ jamais revue ; 4 recherches
//       par heure, chacune 1 fois par heure ; échec attend une heure ; part auto
//       fil + alertes ≤ 150 ; marge par la calculette, jamais un verdict ;
//    P  le passage : sélection par `cs`, seuls les vendeurs en alerte, mêmes
//       critères = UN appel à eBay, jeton d'APPLICATION, une notification par
//       vendeur, jamais deux fois, heures calmes respectées, plafond ⇒ zéro appel,
//       panne d'eBay ⇒ s'arrête, sélection muette ⇒ 503, sans clé ⇒ 401 ;
//       aucun achat (aucun appel à l'API Order / Trading) ; réponse en nombres ;
//    W  la route : session exigée, liste projetée (jamais `vus`), « Retirer ».
//  `--prouve` : chaque mutation doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');
const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : (process.env.AUDIT_RACINE || path.join(__dirname, '..'));
const MUET = !!process.env.AUDIT_RACINE;

if (process.argv.includes('--prouve')) {
  const DEP = path.join(__dirname, '..');
  const MUTATIONS = [
    ['première lecture qui signale tout', 'api/_lib/ebay-alertes.js', "if (premiere || vu.has(x.itemId)", "if (vu.has(x.itemId)"],
    ['une annonce signalée deux fois (sans `dits`)', 'api/_lib/ebay-alertes.js', "|| dits.has(x.itemId) ||", "||"],
    ['plus de plafond par heure', 'api/_lib/ebay-alertes.js', 'export const ALERTES_PAR_HEURE = 4;', 'export const ALERTES_PAR_HEURE = 40;'],
    ['relue à chaque passage', 'api/_lib/ebay-alertes.js', 'if (Number.isFinite(at) && t - at < INTERVALLE_MS) continue;', ''],
    ['pas de regroupement des mêmes critères', 'api/_lib/ebay-alertes.js', 'let res = cache.get(due.sig);', 'let res = undefined;'],
    ['alertes hors de la part automatique', 'api/_lib/ebay-recherche.js', "if ((source === 'fil' || source === 'alerte') && fil + alerte >= PLAFOND_FIL_JOUR) return null;", "if (source === 'fil' && fil >= PLAFOND_FIL_JOUR) return null;"],
    ['notifiée avant d’être rangée', 'api/_lib/ebay-alertes.js', 'if (ecrit === true) nv.push(...trouvees); else bilan.echecs++;', 'nv.push(...trouvees);'],
    ['retirée qui revient', 'api/_lib/ebay-alertes.js', '|| ecartees.has(x.itemId)) continue;', ') continue;'],
    ['la route rend les `vus`', 'api/_lib/ebay-alertes.js', "'recherches:data->recherches,nouvelles:data->nouvelles,ecartees:data->ecartees,dernier:data->dernier'", "'data'"],
    ['port inconnu compté gratuit', 'src/alertesEbayMarge.js', "if (!Number.isSafeInteger(x.total)) manque.unshift('port pas connu');", ''],
  ];
  let rouges = 0;
  for (const [nom, f, avant, apres] of MUTATIONS) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-alertes-mut-'));
    spawnSync('sh', ['-c', `cd "${DEP}" && git ls-files -z | xargs -0 -I{} sh -c 'mkdir -p "${d}/$(dirname "{}")" && cp "{}" "${d}/{}"' 2>/dev/null; ln -s "${DEP}/node_modules" "${d}/node_modules"`]);
    // les fichiers modifiés non commités : on recopie l'arbre de travail
    for (const g of ['api', 'src', 'scripts']) spawnSync('cp', ['-r', path.join(DEP, g), d]);
    const p = path.join(d, f); const s = fs.readFileSync(p, 'utf8');
    if (!s.includes(avant)) { console.log('⚠️ mutation introuvable : ' + nom); rouges--; continue; }
    fs.writeFileSync(p, s.replace(avant, apres));
    const r = spawnSync(process.execPath, [path.join(__dirname, 'audit-alertes-ebay.cjs')], { env: { ...process.env, AUDIT_RACINE: d }, encoding: 'utf8', timeout: 120000 });
    const rouge = r.status !== 0;
    console.log((rouge ? '✅ rouge : ' : '❌ RESTE VERT : ') + nom + (rouge ? ' — ' + ((r.stdout || '').split('\n').find((l) => l.startsWith('❌')) || '').slice(0, 120) : ''));
    if (rouge) rouges++;
    spawnSync('rm', ['-rf', d]);
  }
  console.log(`\n${rouges}/${MUTATIONS.length} mutations rouges`);
  process.exit(rouges === MUTATIONS.length ? 0 : 1);
}

let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) { ok++; if (!MUET) console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d ? ' — ' + d : '')); } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' (planté)', String((e && e.stack) || e).slice(0, 400)); } };

// ── La fausse base et le faux eBay ─────────────────────────────────────────
const J = '11111111-1111-4111-8111-111111111111';   // Julien : 3 recherches, 2 en alerte
const B = '22222222-2222-4222-8222-222222222222';   // un autre vendeur : MÊMES critères qu'une de J
const C = '33333333-3333-4333-8333-333333333333';   // aucune alerte : jamais visité
const JWT_J = 'eyJh.jeton-de-J.sig';
process.env.SUPABASE_SERVICE_KEY = 'cle-service-de-banc';
process.env.CRON_SECRET = 'cle-banc-cron';
process.env.EBAY_APP_ID = 'app-de-banc';
process.env.EBAY_CERT_ID = 'secret-de-banc';
process.env.VRM_OWNER_UID = J;
delete process.env.VAPID_PRIVATE_KEY;

let base = new Map();
const cle = (o, i) => `${o}|${i}`;
const val = (data, chemin) => { let v = { data }; for (const seg of chemin.split(/->>?/)) v = v == null ? undefined : v[seg]; return v; };
const contient = (a, b) => (Array.isArray(b) ? Array.isArray(a) && b.every((x) => a.some((y) => contient(y, x))) : b && typeof b === 'object' ? a && typeof a === 'object' && Object.entries(b).every(([k, v]) => contient(a[k], v)) : a === b);
const projeter = (r, selBrut) => Object.fromEntries((selBrut || 'data').split(',').map((x) => {
  const [al, src] = x.includes(':') ? x.split(':') : [x.split(/->>?/).pop(), x];
  if (src === 'id') return [al, r.id]; if (src === 'owner') return [al, r.owner]; if (src === 'data') return [al, r.data];
  const v = val(r.data, src); return [al, v == null ? null : /->>[A-Za-z_0-9]+$/.test(src) && typeof v !== 'string' ? String(v) : v];
}));
const journal = [];
let mode = {};
let EBAY_ITEMS = [];
const rep = (code, corps) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status: code, headers: { 'content-type': 'application/json' } });
const item = (n, x = {}) => ({ itemId: `v1|${n}|0`, title: `Adidas Samba OG ${n}`, price: { value: '55.00', currency: 'EUR' }, shippingOptions: [{ shippingCostType: 'FIXED', shippingCost: { value: '5.00', currency: 'EUR' } }], condition: 'Occasion', image: { imageUrl: `https://i.ebayimg.com/images/g/${n}/s-l225.jpg` }, itemWebUrl: `https://www.ebay.fr/itm/${n}`, buyingOptions: ['FIXED_PRICE'], itemLocation: { country: 'FR' }, ...x });
global.fetch = async (u0, o = {}) => {
  const u = String(u0), m = (o.method || 'GET').toUpperCase(), h = o.headers || {};
  if (u.includes('/auth/v1/user')) { const a = String(h.Authorization || h.authorization || ''); return a === 'Bearer ' + JWT_J ? rep(200, { id: J, email: 'j@exemple.test' }) : rep(401, { msg: 'invalid' }); }
  if (/ebay\.com/.test(u)) {
    journal.push({ ou: 'ebay', m, u: decodeURIComponent(u), auth: String(h.Authorization || ''), corps: String(o.body || '') });
    if (u.includes('/identity/v1/oauth2/token')) return mode.token === 'ko' ? rep(401, { error: 'invalid_client' }) : rep(200, { access_token: 'jeton-app', expires_in: 7200 });
    if (u.includes('/buy/browse/v1/item_summary/search')) {
      if (mode.browse === 'panne') return rep(500, { errors: [{ errorId: 10001 }] });
      return rep(200, { total: EBAY_ITEMS.length, limit: 30, itemSummaries: EBAY_ITEMS });
    }
    return rep(200, {});
  }
  if (u.includes('/rest/v1/rpc/')) return rep(200, u.includes('vrm_acces') ? true : []);
  if (!u.includes('/rest/v1/app_data')) return rep(404, {});
  const url = new URL(u), q = url.searchParams;
  const idq = q.get('id') || '', owner = (q.get('owner') || '').replace(/^eq\./, '');
  const autres = [...q.entries()].filter(([k]) => !['id', 'owner', 'select', 'on_conflict', 'order', 'limit'].includes(k)).map(([k, v]) => `${k}=${v}`);
  journal.push({ ou: m === 'GET' ? 'lecture' : 'ecriture', m, u: decodeURIComponent(url.search), owner, corps: String(o.body || '') });
  if (m === 'GET') {
    if (q.get('select') === 'owner' && q.get('limit') === '1') return rep(200, [{ owner: J }]);
    if (mode.selection === 'ko' && /data->veilles=cs/.test(decodeURIComponent(url.search))) return rep(500, { message: 'boom' });
    if (mode.compteur === 'ko' && idq === 'eq.ebay_tokens_recherches_jour') return rep(500, { message: 'boom' });
    let lignes = [...base.entries()].map(([k, d]) => { const i = k.indexOf('|'); return { owner: k.slice(0, i), id: k.slice(i + 1), data: d }; });
    if (owner) lignes = lignes.filter((r) => r.owner === owner);
    if (idq.startsWith('eq.')) lignes = lignes.filter((r) => r.id === idq.slice(3));
    else if (idq.startsWith('like.')) { const re = new RegExp('^' + idq.slice(5).replace(/[.]/g, '\\.').replace(/\*/g, '.*') + '$'); lignes = lignes.filter((r) => re.test(r.id)); }
    for (const f of autres) {
      const mm = /^(data(?:->>?[A-Za-z_]+)+)=(eq|cs|gte|is|gt|lt|lte|neq|in)\.(.*)$/.exec(f);
      if (!mm) continue;   // un filtre que ce banc ne juge pas (autres routes) : ignoré
      const [, ch, op, v] = mm;
      lignes = lignes.filter((r) => { const x = val(r.data, ch); return op === 'eq' ? String(x) === v : op === 'cs' ? contient(x, JSON.parse(v)) : op === 'is' ? (v === 'null' ? x == null : true) : true; });
    }
    if (!owner && !/vrm_operations_v1/.test(idq)) lignes = lignes.filter(() => true);
    return rep(200, lignes.map((r) => projeter(r, q.get('select'))));
  }
  if (m === 'POST') {
    let lignes = []; try { lignes = [].concat(JSON.parse(o.body || '[]')); } catch (_) {}
    const fusion = /merge-duplicates/.test(String((h.Prefer || h.prefer || '')));
    for (const l of lignes) { if (!l.owner) return rep(400, {}); if (base.has(cle(l.owner, l.id)) && !fusion) return rep(409, { message: 'doublon' }); }
    for (const l of lignes) base.set(cle(l.owner, l.id), JSON.parse(JSON.stringify(l.data)));
    return rep(201, []);
  }
  if (m === 'PATCH') {
    const id = idq.replace(/^eq\./, ''); const k = cle(owner, id);
    if (!owner || !base.has(k)) return rep(200, []);
    const d = base.get(k);
    const passe = autres.every((f) => { let mm; if ((mm = /^data->>rev=eq\.(.*)$/.exec(f))) return d && String(d.rev) === mm[1]; if (f === 'data->>rev=is.null') return d && d.rev == null; return true; });
    if (!passe) return rep(200, []);
    const b = JSON.parse(o.body); base.set(k, b.data !== undefined ? b.data : { ...d, ...b });
    return rep(200, [{ id }]);
  }
  if (m === 'DELETE') { base.delete(cle(owner, idq.replace(/^eq\./, ''))); return rep(204, null); }
  return rep(405, {});
};
const faireRes = () => { const r = { code: 0, corps: null }; r.setHeader = () => {}; r.status = (c) => { r.code = c; return { json: (j) => { r.corps = j; return r; }, end: () => r }; }; r.json = (j) => { r.corps = j; return r; }; return r; };

const veille = (id, titre, mots, x = {}) => ({ id, titre, mots, exclus: '', categorie: '', etatArticle: 'tous', minimum: null, maximum: 9000, pays: 'tous', pointure: '42', achatImmediat: true, livraisonFR: true, etat: 'preparee', cree: '2026-11-01T10:00:00.000Z', version: 1, evenements: [], ...x });
const ops = (veilles) => ({ version: 1, revision: 3, missions: [], reservations: [], lots: [], consommables: [], veilles, receptions: [], dossiers: [], journal: [], commandes: [] });

(async () => {
  const imp = (p) => import('file://' + path.join(RACINE, p));
  let A, R, M, G, MET, CR;
  await essaie('chargement', async () => {
    A = await imp('api/_lib/ebay-alertes.js'); R = await imp('api/_lib/ebay-recherche.js'); G = await imp('src/alertesEbayMarge.js'); MET = await imp('src/operations/metier.js');
    CR = (await imp('api/ship-reminders.js')).default; M = (await imp('api/ebay.js')).default;
  });
  if (!A || !CR || !M) { console.log(`\n❌ audit-alertes-ebay : chargement impossible`); process.exit(1); }
  const T0 = Date.parse('2026-11-11T13:05:00.000Z');   // 14 h 05 à Paris : pas une heure calme
  const H = 3600e3;

  // ══ R : la règle pure ═════════════════════════════════════════════════════
  await essaie('R', async () => {
    const v = veille('va', 'Samba 42', 'adidas samba', { alerte: true });
    const c = R.criteresRecherche(MET.criteresDeVeille(v)).c; const sig = A.signatureCriteres(c);
    const red = (xs) => R.reduireResultats({ total: xs.length, itemSummaries: xs }, c).items;
    let x = A.integrer(null, { v, sig, items: red([item(1), item(2)]), t: T0 });
    dit(x.nouvelles.length === 0, 'R1 la PREMIÈRE lecture ne signale rien (on ne sait pas ce qu’il avait vu)', String(x.nouvelles.length));
    x = A.integrer(x.e, { v, sig, items: red([item(1), item(2), item(3)]), t: T0 + H });
    dit(x.nouvelles.length === 1 && x.nouvelles[0].itemId === 'v1|3|0', 'R2 la lecture suivante signale la SEULE annonce nouvelle (par itemId)', x.nouvelles.map((n) => n.itemId).join(','));
    const v2 = veille('vb', 'Samba toutes', 'samba', { alerte: true, pointure: '' });
    const c2 = R.criteresRecherche(MET.criteresDeVeille(v2)).c, sig2 = A.signatureCriteres(c2);
    let y = A.integrer(x.e, { v: v2, sig: sig2, items: red([item(4)]), t: T0 + H });
    y = A.integrer(y.e, { v: v2, sig: sig2, items: red([item(3), item(4), item(5)]), t: T0 + 2 * H });
    dit(y.nouvelles.map((n) => n.itemId).join(',') === 'v1|5|0', 'R3 une annonce déjà signalée par une AUTRE recherche ne l’est pas deux fois', y.nouvelles.map((n) => n.itemId).join(','));
    // 50 annonces au même titre, même prix : chacune son identité, chacune signalée une fois.
    const memes = Array.from({ length: 50 }, (_, i) => item(100 + i, { title: 'Adidas Samba OG 42 noir' }));
    let z = A.integrer(y.e, { v, sig, items: red([item(1)]), t: T0 + 3 * H });
    z = A.integrer(z.e, { v, sig, items: red(memes), t: T0 + 4 * H });
    const z2 = A.integrer(z.e, { v, sig, items: red(memes), t: T0 + 5 * H });
    dit(z.nouvelles.length === 50 && new Set(z.nouvelles.map((n) => n.itemId)).size === 50 && z2.nouvelles.length === 0, 'R4 50 annonces identiques (même titre, même prix) : chacune par SON itemId, jamais deux fois', `${z.nouvelles.length} puis ${z2.nouvelles.length}`);
    // Retirée ⇒ jamais revue.
    const e2 = { ...z2.e, ecartees: ['v1|900|0'] };
    const w = A.integrer(e2, { v, sig, items: red([item(900)]), t: T0 + 6 * H });
    dit(w.nouvelles.length === 0, 'R5 une annonce RETIRÉE de la liste ne revient pas', String(w.nouvelles.length));
    // Critères modifiés ⇒ première lecture.
    const v3 = { ...v, maximum: 8000 }; const sig3 = A.signatureCriteres(R.criteresRecherche(MET.criteresDeVeille(v3)).c);
    const m3 = A.integrer(w.e, { v: v3, sig: sig3, items: red([item(901)]), t: T0 + 7 * H });
    dit(sig3 !== sig && m3.nouvelles.length === 0, 'R6 critères modifiés ⇒ première lecture, muette', String(m3.nouvelles.length));
    // 4 par heure, chacune une fois par heure.
    const six = Array.from({ length: 6 }, (_, i) => veille('v' + i, 'R' + i, 'samba ' + i, { alerte: true, cree: `2026-11-0${i + 1}T10:00:00.000Z` }));
    const d1 = A.aRelireMaintenant(null, six, T0);
    dit(d1.dues.length === 4 && d1.enAttente === 2, 'R7 au plus 4 recherches par vendeur et par heure (les autres attendent, dit)', `${d1.dues.length} + ${d1.enAttente}`);
    let e = null; for (const d of d1.dues) e = A.integrer(e, { v: d.v, sig: d.sig, items: [], t: T0 }).e;
    const d2 = A.aRelireMaintenant(e, six, T0 + 10 * 60e3);
    dit(d2.dues.length === 0, 'R8 la même heure : plus aucune (plafond de l’heure atteint)', String(d2.dues.length));
    const d3 = A.aRelireMaintenant(e, six, T0 + H + 60e3);
    dit(d3.dues.length === 4 && d3.dues.slice(0, 2).every((d) => !d1.dues.some((x) => x.v.id === d.v.id)), 'R9 l’heure suivante : celles qui attendaient d’abord', d3.dues.map((d) => d.v.id).join(','));
    const ech = A.marquerEchec(null, { v, sig, t: T0, raison: 'ebay' });
    dit(A.aRelireMaintenant(ech, [v], T0 + 30 * 60e3).dues.length === 0 && A.aRelireMaintenant(ech, [v], T0 + H).dues.length === 1, 'R10 une lecture RATÉE attend une heure comme une réussie (jamais relancée à chaque passage)');
    const sansAlerte = A.aRelireMaintenant(null, [veille('x', 'X', 'samba')], T0);
    dit(sansAlerte.dues.length === 0, 'R11 une recherche sans alerte allumée n’est jamais relue par le serveur');
    // Part automatique : fil + alertes ≤ 150, la main garde ses 50.
    const j = R.jourParis(T0);
    dit(R.compterAppel({ jour: j, n: 150, fil: 100, alerte: 50 }, j, 200, 'alerte') === null && R.compterAppel({ jour: j, n: 150, fil: 100, alerte: 50 }, j, 200, 'fil') === null && R.compterAppel({ jour: j, n: 150, fil: 100, alerte: 50 }, j, 200, 'main').n === 151, 'R12 fil + alertes ≤ 150 par jour ; les 50 dernières restent à « Chercher »');
    // Le verbe d'un verdict n'existe nulle part.
    const srcs = ['api/_lib/ebay-alertes.js', 'api/_lib/ebay-alertes-texte.js', 'src/AlertesEbay.jsx', 'src/alertesEbayMarge.js'].map((f) => fs.readFileSync(path.join(RACINE, f), 'utf8').replace(/\/\/[^\n]*/g, '')).join('\n');
    const frs = fs.readFileSync(path.join(RACINE, 'src/i18n/langues/fr.js'), 'utf8').split('\n').filter((l) => l.includes('"alertesEbay.')).join('\n');
    dit(!/bonne affaire|bon plan|à saisir|affaire/i.test(srcs + frs) && !/sort\([^)]*benefice/.test(srcs), 'R13 aucun verdict (« bonne affaire »…), aucun tri par marge');
    // La marge : la calculette, SES chiffres.
    const x1 = { itemId: 'v1|1|0', prix: 5500, port: 500, total: 6000 };
    const mToi = G.margePossible(x1, { revente: 12000, reventeSite: 'vinted', mots: 'samba' }, {});
    dit(mToi.etat === 'ok' && mToi.benefice === 6000 && mToi.base.source === 'toi' && mToi.borne === 'au-plus', 'R14 son prix de revente 120 € − 60 € port compris = au plus 60 € (emballage pas compté)', JSON.stringify(mToi).slice(0, 160));
    const mMed = G.margePossible(x1, { mots: 'samba' }, { revente: () => ({ modele: 'samba', mediane: G.mediane([8000, 9000, 15000]), n: 3 }) });
    dit(mMed.etat === 'ok' && mMed.base.source === 'mediane' && mMed.base.montant === 9000 && mMed.benefice === 3000, 'R15 sans son prix : la MÉDIANE de ses ventes du modèle (80/90/150 ⇒ 90 €)', JSON.stringify(mMed.base));
    dit(G.margePossible(x1, { mots: 'samba' }, { revente: () => undefined }).etat === 'pas-su' && G.margePossible(x1, { mots: 'samba' }, { revente: () => null }).etat === 'sans-base', 'R16 ventes pas lues ⇒ « pas su » ; aucune base ⇒ rien (jamais un chiffre inventé)');
    const mPort = G.margePossible({ itemId: 'v1|2|0', prix: 5500, port: null, total: null }, { revente: 12000, mots: 'samba' }, {});
    dit(mPort.etat === 'ok' && mPort.borne === 'au-plus' && mPort.manque[0] === 'port pas connu', 'R17 port inconnu ⇒ « au plus », le manque NOMMÉ (jamais gratuit)', JSON.stringify(mPort.manque));
    // `veille.alerte` : SON clic, une recherche active seulement.
    const d0 = ops([veille('va', 'Samba', 'samba', { etat: 'archivee' })]);
    let refus = ''; try { MET.appliquer(d0, { id: '9b2f5a1e-0000-4000-8000-000000000001', type: 'veille.alerte', donnees: { cible: 'va', alerte: true } }, { acteur: J, maintenant: new Date(T0).toISOString() }); } catch (e2) { refus = e2.message; }
    const d1o = MET.appliquer(ops([veille('va', 'Samba', 'samba')]), { id: '9b2f5a1e-0000-4000-8000-000000000002', type: 'veille.alerte', donnees: { cible: 'va', alerte: true, revente: 12000, site: 'ebay' } }, { acteur: J, maintenant: new Date(T0).toISOString() });
    dit(/Restaure/.test(refus) && d1o.veilles[0].alerte === true && d1o.veilles[0].revente === 12000 && d1o.veilles[0].reventeSite === 'ebay', 'R18 l’alerte s’allume par une opération (`veille.alerte`), jamais sur une recherche archivée');
  });

  // ══ P : le passage, par la VRAIE fonction ════════════════════════════════
  const passer = async (t, auth = 'Bearer cle-banc-cron') => { const vrai = Date.now; Date.now = () => t; try { const r = faireRes(); await CR({ method: 'GET', headers: { authorization: auth }, query: { moment: 'alertes' } }, r); return r; } finally { Date.now = vrai; } };
  const appelsEbay = () => journal.filter((x) => x.ou === 'ebay' && x.u.includes('/buy/browse/'));
  const notifs = (o) => [...base.entries()].filter(([k]) => k.startsWith(o + '|push_')).map(([, d]) => JSON.stringify(d)).join('\n');
  await essaie('P', async () => {
    base = new Map();
    base.set(cle(J, 'vrm_operations_v1'), ops([veille('j1', 'Samba 42', 'adidas samba', { alerte: true }), veille('j2', 'XT-6 43', 'salomon xt 6', { alerte: true, pointure: '43' }), veille('j3', 'Dunk', 'nike dunk')]));
    base.set(cle(B, 'vrm_operations_v1'), ops([veille('b1', 'Samba de B', 'adidas samba', { alerte: true })]));
    base.set(cle(C, 'vrm_operations_v1'), ops([veille('c1', 'Rien', 'nike dunk')]));
    EBAY_ITEMS = [item(1), item(2)];
    journal.length = 0;
    const r401 = await passer(T0, 'Bearer mauvaise');
    dit(r401.code === 401 && !appelsEbay().length, 'P1 sans la clé du cron ⇒ 401, aucun appel à eBay', String(r401.code));
    const r1 = await passer(T0);
    const sel = journal.find((x) => x.ou === 'lecture' && /data->veilles=cs\./.test(x.u));
    dit(r1.code === 200 && r1.corps.vendeurs === 2 && !!sel && /select=owner,veilles:data->veilles/.test(sel.u), 'P2 seuls les vendeurs avec une alerte (filtre `cs`, projection) — C jamais visité', JSON.stringify(r1.corps).slice(0, 200));
    dit(appelsEbay().length === 2 && r1.corps.regroupees === 1 && r1.corps.recherches === 3, 'P3 mêmes critères chez J et B = UN appel à eBay (3 recherches, 2 appels)', `appels=${appelsEbay().length} regroupees=${r1.corps.regroupees}`);
    dit(appelsEbay().every((x) => x.auth === 'Bearer jeton-app') && journal.some((x) => x.ou === 'ebay' && /grant_type=client_credentials/.test(x.corps)) && !journal.some((x) => x.ou === 'ebay' && /refresh_token|\/sell\/|\/buy\/order|ws\/api\.dll/.test(x.u + x.corps)), 'P4 le jeton d’APPLICATION (client_credentials) ; aucun appel d’achat ni de vendeur');
    dit(r1.corps.nouvelles === 0 && !notifs(J) && !notifs(B), 'P5 première lecture : aucune notification');
    const cptJ = base.get(cle(J, 'ebay_tokens_recherches_jour'));
    dit(cptJ && cptJ.n === 2 && cptJ.alerte === 2, 'P6 chaque recherche compte dans SES 200 du jour (part automatique)', JSON.stringify(cptJ));
    dit(!/vrm|@|adidas|samba/i.test(JSON.stringify(r1.corps)), 'P7 la réponse du cron ne porte que des nombres');
    journal.length = 0;
    const r2 = await passer(T0 + 30 * 60e3);
    dit(r2.code === 200 && appelsEbay().length === 0, 'P8 30 min plus tard : rien à relire (une fois par heure)', `appels=${appelsEbay().length}`);
    EBAY_ITEMS = [item(1), item(2), item(3)];
    journal.length = 0;
    const r3 = await passer(T0 + H + 60e3);
    const nj = notifs(J);
    dit(r3.code === 200 && r3.corps.nouvelles === 2 && /Nouvelle annonce eBay/.test(nj) && /Samba 42/.test(nj) && /60 € port compris/.test(nj), 'P9 une NOUVELLE annonce ⇒ une notification à J (et une à B, son vendeur), le prix port compris', JSON.stringify(r3.corps).slice(0, 160) + ' · ' + nj.slice(0, 200));
    dit((nj.match(/Nouvelle annonce eBay/g) || []).length === 1, 'P10 une notification par vendeur et par passage', String((nj.match(/Nouvelle annonce eBay/g) || []).length));
    const avant = notifs(J);
    journal.length = 0;
    const r4 = await passer(T0 + 2 * H + 2 * 60e3);
    dit(r4.corps.nouvelles === 0 && notifs(J) === avant, 'P11 la même annonce n’est JAMAIS signalée deux fois', String(r4.corps.nouvelles));
    // Heures calmes : 3 h à Paris — rangée dans la cloche, rien ne sonne.
    EBAY_ITEMS = [item(1), item(2), item(3), item(4)];
    process.env.VRM_NOTIF_HORLOGE = '2026-11-12T02:30:00.000Z';
    const r5 = await passer(T0 + 4 * H);
    delete process.env.VRM_NOTIF_HORLOGE;
    const n5 = notifs(J);
    if (process.env.DEBUG_ALERTES) console.log(n5);
    const entrees = [...base.entries()].filter(([k]) => k.startsWith(J + '|push_')).flatMap(([, d]) => (d && Array.isArray(d.entrees) ? d.entrees : []));
    const e4 = entrees.find((e) => /Samba OG 4/.test(e.texte || ''));
    dit(r5.corps.nouvelles >= 1 && e4 && e4.etat === 'calme' && n5.length > 0, 'P12 heures calmes (3 h 30 à Paris) : la notification est rangée « calme » dans la cloche, rien ne sonne', JSON.stringify(e4));
    // Plafond du jour : zéro appel à eBay.
    base.set(cle(J, 'ebay_tokens_recherches_jour'), { jour: R.jourParis(T0 + 6 * H), n: 150, fil: 150, plafond: 200, rev: 9 });
    base.delete(cle(B, 'vrm_operations_v1'));
    journal.length = 0;
    const r6 = await passer(T0 + 6 * H);
    dit(r6.code === 200 && appelsEbay().length === 0 && r6.corps.plafonds === 1, 'P13 part automatique du jour faite ⇒ zéro appel à eBay, dit (plafonds)', JSON.stringify(r6.corps).slice(0, 160));
    // Compteur illisible ⇒ rien ne part.
    base.delete(cle(J, 'ebay_tokens_recherches_jour'));
    mode = { compteur: 'ko' }; journal.length = 0;
    const r7 = await passer(T0 + 8 * H);
    mode = {};
    dit(appelsEbay().length === 0 && r7.corps.echecs >= 1 && r7.code === 500, 'P14 compteur illisible ⇒ aucun appel à eBay, l’échec est dit (500 : GitHub prévient)', JSON.stringify(r7.corps).slice(0, 120));
    // eBay en panne : le passage s'arrête après 3 pannes, rien de vu n'est perdu.
    const vusAvant = JSON.stringify((base.get(cle(J, 'ebay_tokens_alertes')) || {}).vus);
    base.set(cle(J, 'vrm_operations_v1'), ops(Array.from({ length: 6 }, (_, i) => veille('p' + i, 'P' + i, 'adidas samba ' + i, { alerte: true, cree: `2026-11-0${i + 1}T10:00:00.000Z` }))));
    mode = { browse: 'panne' }; journal.length = 0;
    const r8 = await passer(T0 + 10 * H);
    mode = {};
    dit(r8.code === 500 && r8.corps.panne === 'ebay' && appelsEbay().length === 3, 'P15 eBay en panne : 3 essais puis le passage s’arrête (500)', `appels=${appelsEbay().length} ${JSON.stringify(r8.corps).slice(0, 100)}`);
    const e8 = base.get(cle(J, 'ebay_tokens_alertes'));
    dit(e8 && Object.values(e8.recherches).filter((r) => r.echec).length === 3 && vusAvant !== undefined, 'P16 les recherches en panne sont datées (attendent une heure), rien n’est signalé', JSON.stringify(Object.values(e8.recherches).map((r) => r.echec)));
    // Sélection muette ⇒ 503, personne n'est visité.
    mode = { selection: 'ko' }; journal.length = 0;
    const r9 = await passer(T0 + 12 * H);
    mode = {};
    dit(r9.code === 503 && appelsEbay().length === 0, 'P17 sélection illisible ⇒ 503, aucun appel à eBay', String(r9.code));
  });

  // ══ W : la route `alertes` d'api/ebay.js ══════════════════════════════════
  await essaie('W', async () => {
    const appel = async (corps, jwt = JWT_J) => { const r = faireRes(); await M({ method: 'POST', headers: { authorization: 'Bearer ' + jwt, 'content-type': 'application/json' }, query: {}, body: { action: 'alertes', ...corps } }, r); return r; };
    const r0 = await appel({ op: 'lire' }, 'eyJh.inconnu.sig');
    dit(r0.code === 401, 'W1 sans session ⇒ 401', String(r0.code));
    journal.length = 0;
    const r1 = await appel({ op: 'lire' });
    const lec = journal.find((x) => x.ou === 'lecture' && /ebay_tokens_alertes/.test(x.u));
    dit(r1.code === 200 && r1.corps.ok && Array.isArray(r1.corps.nouvelles) && r1.corps.nouvelles.length >= 1 && lec && !/select=data(&|$)/.test(lec.u) && !/vus/.test(JSON.stringify(r1.corps)) && !/dits/.test(JSON.stringify(r1.corps)), 'W2 la liste, projetée (jamais `vus` ni `dits`)', (lec && lec.u) + ' · ' + JSON.stringify(r1.corps).slice(0, 160));
    const x = r1.corps.nouvelles[0];
    dit(x && /^https:\/\/i\.ebayimg\.com\//.test(x.photo) && /^https:\/\/www\.ebay\.fr\/itm\//.test(x.url) && Number.isSafeInteger(x.prix) && 'port' in x, 'W3 chaque annonce : photo eBay, lien eBay, prix, port', JSON.stringify(x).slice(0, 200));
    const r2 = await appel({ op: 'ecarter', itemIds: [x.itemId] });
    dit(r2.code === 200 && !r2.corps.nouvelles.some((n) => n.itemId === x.itemId), 'W4 « Retirer » l’enlève de la liste', String(r2.code));
    const r3 = await appel({ op: 'ecarter', itemIds: ['<script>'] });
    dit(r3.code === 400, 'W5 un identifiant illisible n’écrit rien (400)', String(r3.code));
    dit(!journal.some((x2) => x2.ou === 'ebay' && /\/buy\/browse\//.test(x2.u)), 'W6 lire la liste ne coûte aucun appel à eBay');
  });

  // ══ Sources : 12 fonctions, le cron GitHub ═══════════════════════════════
  await essaie('S', async () => {
    const wf = fs.readFileSync(path.join(RACINE, '.github/workflows/alertes-ebay.yml'), 'utf8');
    dit(/moment=alertes/.test(wf) && /CRON_SECRET/.test(wf) && /cron: '\d+ \* \* \* \*'/.test(wf), 'S1 GitHub appelle `?moment=alertes` chaque heure, avec CRON_SECRET');
    const fonctions = fs.readdirSync(path.join(RACINE, 'api')).filter((f) => f.endsWith('.js'));
    dit(fonctions.length <= 12, 'S2 toujours 12 fonctions api/ au plus', String(fonctions.length));
  });

  console.log(`\n${ko ? '❌' : '✅'} audit-alertes-ebay : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
