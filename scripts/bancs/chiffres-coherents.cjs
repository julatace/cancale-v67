// ═══════════════════════════════════════════════════════════════════════════
// Banc : LE MÊME NOMBRE, LA MÊME VALEUR, SUR TOUS SES ÉCRANS (6 nov., audit des chiffres)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (6 nov.) : « Plus de fiabilité stp, j'ai pas 20 colis à déposer par exemple, audite tout
// le site. » Mesuré sur sa base le même jour : « à imprimer » valait 5 sur Ma journée (les
// bordereaux PRÊTS, imprimés compris, e-mails seuls) et 4 sur Colis ; le récapitulatif de Colis
// disait 11 colis à envoyer sous une carte à 12 (Vestiaire oublié) ; la Tournée comptait « à
// déposer » une vente qui attend encore son bordereau ; le widget comptait 15 colis à retirer
// quand l'app en comptait 12 (trois e-mails Vinted sans n° de suivi, comptés chacun comme un colis).
//
// Données INVENTÉES (dépôt public), de la VRAIE forme (`orders_sold` + `transaction_user_status`,
// `email_bord_{tx}` avec PDF, `vinted_bords_printed`, `vinted_ship_done`, `vc_ventes`,
// `email_track_*` lus en `meta->>`) :
//   compte_a (111) : 3 ventes « Bordereau envoyé au vendeur » (2 déjà imprimées), 1 « Le paiement a été
//     validé » (sans bordereau), 2 « Commande expédiée » avec leur VIEUX bordereau (jamais touchées
//     « Déposé » : l'état lu de Vinted gagne), 1 litige « colis déposé » en `needs_action`, 1 annulée
//     avec son bordereau, 1 finalisée ;
//   compte_b (222) : 1 « Bordereau envoyé » pas imprimé, 1 cochée « Colis fait » ;
//   compte RETIRÉ (999, absent des comptes liés) : 2 « Bordereau envoyé » — jamais comptées ;
//   Vestiaire : 1 vente à expédier sans bordereau ; un colis Mondial Relay à retirer (e-mail, n° de
//   suivi) et, APRÈS la photo publiée par l'app, un e-mail Vinted « Commande mise à jour » SANS n°.
// Recalcul INDÉPENDANT (ce fichier, sans le code de l'app) :
//   à envoyer = 5 Vinted + 1 Vestiaire = 6 · à imprimer = 2 · à déposer (Tournée) = 4, 2 attendent
//   leur bordereau · à retirer (widget) ≤ la photo de l'app, jamais un colis sans identité en plus.
// On exige, à 390 tactile et 1512 :
//   E. « à envoyer » : Ma journée (case), Colis (carte, onglet, récapitulatif), la barre (badge) et
//      le widget (`api/widget.js` EXÉCUTÉ sur les mêmes lignes) disent 6 ;
//   I. « à imprimer » : Ma journée et la case de Colis disent 2, Ma journée sans « au moins » (elle lit
//      les bordereaux captés) ; le récapitulatif lu dit 2 ;
//   D. la Tournée de dépôt : « 4 colis à déposer · 2 attendent leur bordereau » ;
//   R. le widget, à retirer : jamais plus que la photo de l'app quand le seul « nouveau » colis
//      n'a pas d'identité (dit « au moins ») ;
//   M. chaque chiffre de carte (`data-carte-chiffre` + période) a la MÊME valeur sur tous les écrans
//      qui le montrent (Ma journée, Ventes, Colis, Statistiques) ;
//   Z. aucune erreur de page.
// Juge les data-* et les nombres rendus (§6.4). Lancer : construire dist/, puis
//   node scripts/bancs/chiffres-coherents.cjs     (BANC_PORT 9071, SHOTS=dossier)
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const RACINE = path.join(__dirname, '..', '..');
const DIST = process.env.BANC_DIST || path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT || 9071);
const SHOTS = process.env.SHOTS || '';
const maintenant = new Date('2026-11-06T17:00:00+01:00');
const MS = maintenant.getTime(), J = 864e5;
const iso = (t) => new Date(t).toISOString();
const ilYa = (j) => iso(MS - j * J);
const jj = (n) => String(n).padStart(2, '0');
const jourFr = (j) => { const d = new Date(MS + j * J); return `${jj(d.getDate())}/${jj(d.getMonth() + 1)}/${d.getFullYear()}`; };
const jourIso = (j) => { const d = new Date(MS + j * J); return `${d.getFullYear()}-${jj(d.getMonth() + 1)}-${jj(d.getDate())}`; };

const ACCOUNTS = [
  { id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) },
  { id: 2, vinted_user_id: '222', login: 'compte_b', domain: 'www.vinted.fr', updated_at: iso(MS) },
];
const ENV = 'Bordereau envoyé au vendeur';
const PAYE = 'Le paiement a été validé';
const EXP = "Commande expédiée et en cours d'acheminement ! ";
const DEPOSE = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
// uid, tx, titre, statut, champ machine, âge (j), bordereau PDF, imprimé, coché « Colis fait »
const V = [
  ['111', 9401, 'Spezial bleue 40', ENV, 'needs_action', 2, true, true],
  ['111', 9402, 'Spezial bleue 40', ENV, 'needs_action', 2, true, true],
  ['111', 9403, 'Samba noire 41', ENV, 'needs_action', 1, true, false],
  ['111', 9404, 'Gazelle verte 39', PAYE, 'needs_action', 0.5, false, false],
  ['111', 9405, 'Air Max 90 42', EXP, 'waiting', 5, true, false],
  ['111', 9406, 'Air Max 1 43', EXP, 'waiting', 4, true, true],
  ['111', 9407, 'XT-6 grise 38', DEPOSE, 'needs_action', 9, false, false],
  ['111', 9408, 'Club C 44', 'La commande a été annulée', 'failed', 4, true, false],
  ['111', 9409, 'Forum Low 43', "Commande finalisée - l'acheteur a validé la commande", 'completed', 3, false, false],
  ['222', 9501, 'Handball noire 38', ENV, 'needs_action', 1.5, true, false],
  ['222', 9502, 'Handball noire 38', ENV, 'needs_action', 2.5, true, false, true],
  ['999', 9901, 'Old Skool 41', ENV, 'needs_action', 3, true, false],
  ['999', 9902, 'Old Skool 42', ENV, 'needs_action', 3, true, false],
].map(([uid, tx, titre, status, tus, age, pdf, imprime, fait]) => ({ uid, tx, titre, status, tus, age, pdf, imprime, fait: !!fait }));
// LE RECALCUL INDÉPENDANT (aucune règle de l'app : les cas posés ci-dessus, jugés à la main).
const LIES = new Set(ACCOUNTS.map((a) => a.vinted_user_id));
const aEnvoyerV = V.filter((v) => LIES.has(v.uid) && (v.status === ENV || v.status === PAYE) && !v.fait);
const ATT = { envoyer: aEnvoyerV.length + 1, imprimer: aEnvoyerV.filter((v) => v.pdf && !v.imprime).length,
  deposer: aEnvoyerV.filter((v) => v.pdf).length, attente: aEnvoyerV.filter((v) => !v.pdf).length + 1 };

const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
const PHOTO_AT = MS - 3 * 3600e3;   // la photo « à retirer » publiée par l'app, il y a 3 h
const LIGNES = [
  { id: 'main', data: {
    vrm_widget_token: 'jeton-banc',
    vinted_ship_done: Object.fromEntries(V.filter((v) => v.fait).map((v) => [String(v.tx), MS - 20 * 3600e3])),
    vinted_bords_printed: Object.fromEntries(V.filter((v) => v.imprime).map((v) => [String(v.tx), iso(MS - 30 * 3600e3)])),
    vinted_annonce_numeros: Object.fromEntries(V.map((v, i) => [`i${v.tx}`, { numero: String(40 + i), title: v.titre, auto: false, numberedAt: ilYa(40) }])),
    vinted_used_numeros: V.map((_, i) => 40 + i),
    // La photo publiée par l'app (forme du 23 oct.) : 1 colis Mondial Relay à retirer.
    vrm_colis_retirer: { at: PHOTO_AT, total: 1, vus: ['81000001'], vusTx: [], urgents: 0, prets: 1, verif: 0, aVerifier: 0, enVerification: 0, sansCode: 0, finis: [],
      colis: [[jourIso(8), PHOTO_AT - 3600e3, 'mondialrelay', 'e:81000001', 1, '', '']] },
  } },
  ...['111', '222', '999'].map((uid) => ({ id: `harvest_${uid}_orders_sold`, data: { uid, type: 'orders', capturedAt: iso(MS - 3600e3), payload: { my_orders: V.filter((v) => v.uid === uid).map((v) => ({
    transaction_id: v.tx, conversation_id: String(v.tx + 7), title: v.titre, price: { amount: '50.0', currency_code: 'EUR' }, status: v.status, transaction_user_status: v.tus, date: ilYa(v.age), photo: null })) } } })),
  ...['111', '222'].map((uid) => ({ id: `harvest_${uid}_orders_purchased`, data: { uid, type: 'orders', capturedAt: iso(MS - 3600e3), payload: { my_orders: [] } } })),
  ...V.map((v) => ({ id: `harvest_${v.uid}_txn_${v.tx}`, data: { capturedAt: ilYa(0.5), payload: { transaction: { id: v.tx, item_id: `i${v.tx}` } } } })),
  ...V.filter((v) => v.pdf).map((v) => ({ id: 'email_bord_' + v.tx, data: { transaction: String(v.tx), uid: v.uid, filename: `bordereau-${v.tx}.pdf`, modele: v.titre, article: v.titre,
    receivedAt: ilYa(Math.max(0.2, v.age - 0.2)), pdfB64: PDF_B64, suivi: '4' + String(v.tx).padStart(7, '0'), dateLimite: `${jourFr(5)} à 10:00` } })),
  { id: 'vc_ventes', data: { capturedAt: ilYa(1), ventes: { 7001: { ref: '', date: ilYa(1).slice(0, 19).replace('T', ' '), etat: 'ACTION_NEEDED', aExpedier: true, vuAt: ilYa(1), photo: '', suivi: '', compte: '',
    limite: `${jourIso(3)}T23:59:59+01:00`, montant: { cle: 'sellerEarning', devise: 'EUR', valeur: 120 }, sources: ['ventes', 'a-expedier'], statutVc: 'ship' } } } },
  { id: 'email_track_mondialrelay_81000001', data: { type: 'suivi', carrier: 'mondialrelay', suivi: '81000001', status: 'available', statusLabel: 'Arrivé au point de retrait',
    subject: 'Votre colis 81000001 est disponible dans votre Point Relais', receivedAt: iso(PHOTO_AT - 3600e3), emailAt: iso(PHOTO_AT - 3600e3), arriveLe: iso(PHOTO_AT - 3600e3),
    code: '100001', lieu: 'MAISON DU QUAI, 40 RUE DU QUAI, 35260 CANCALE', limite: jourIso(8), consigne: false, account: 'compte_a', recuSur: ['boite@exemple.fr'] } },
  // Reçu APRÈS la photo : un e-mail Vinted « Commande mise à jour », une conversation, AUCUN n° de suivi.
  { id: 'email_track_autre_conv-0000-banc', data: { type: 'suivi', carrier: 'autre', suivi: '', status: 'available', statusLabel: 'Arrivé au point relais (Vinted)',
    subject: 'Commande mise à jour pour Paire du banc', receivedAt: iso(MS - 3600e3), emailAt: iso(MS - 3600e3), arriveLe: iso(MS - 3600e3), code: null,
    lieu: 'MAISON DU QUAI, 40 RUE DU QUAI, 35260 CANCALE', limite: null, consigne: false, account: '', source: 'vinted-commande', artTitle: 'Paire du banc', conv: 'conv-0000-banc' } },
  { id: 'panel_colis_relais', data: {} },
];

// ── Un PostgREST minimal : id eq/like/in, filtres data->>k (is.null, eq, neq, in, gte, lte), select projeté, Range.
const lire = (o, chemin) => { let v = o; for (const s of chemin) v = v == null ? undefined : v[s]; return v; };
const chemin = (src) => src.replace(/^data(->>|->)/, '').split(/->>|->/).map((x) => x.replace(/^"(.*)"$/, '$1'));
function projette(row, sel) {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'owner') { out[alias] = row.owner || null; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = (row.data && row.data.capturedAt) || iso(MS); continue; }
    const v = lire(row.data, chemin(src));
    out[alias] = v === undefined ? null : (/->>/.test(src) && v != null && typeof v === 'object' ? JSON.stringify(v) : (/->>/.test(src) && v != null ? String(v) : v));
  }
  return out;
}
const reLike = (pat) => new RegExp('^' + pat.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*') + '$');
function teste(val, expr) {
  if (expr === 'is.null') return val == null || val === '';
  if (expr === 'not.is.null') return !(val == null || val === '');
  const sv = val == null ? null : (typeof val === 'object' ? JSON.stringify(val) : String(val));
  let m;
  if ((m = /^eq\.(.*)$/.exec(expr))) return sv === m[1];
  if ((m = /^neq\.(.*)$/.exec(expr))) return sv !== m[1];
  if ((m = /^gte\.(.*)$/.exec(expr))) return sv != null && sv >= m[1];
  if ((m = /^lte\.(.*)$/.exec(expr))) return sv != null && sv <= m[1];
  if ((m = /^gt\.(.*)$/.exec(expr))) return sv != null && sv > m[1];
  if ((m = /^lt\.(.*)$/.exec(expr))) return sv != null && sv < m[1];
  if ((m = /^in\.\((.*)\)$/.exec(expr))) return sv != null && m[1].split(',').map((x) => x.replace(/^"|"$/g, '')).includes(sv);
  if ((m = /^not\.in\.\((.*)\)$/.exec(expr))) return !(sv != null && m[1].split(',').map((x) => x.replace(/^"|"$/g, '')).includes(sv));
  if ((m = /^like\.(.*)$/.exec(expr)) || (m = /^ilike\.(.*)$/.exec(expr))) return sv != null && reLike(m[1]).test(sv);
  return true;
}
function repondre(url, range) {
  const u = metaVersData(decodeURIComponent(url));
  if (/\/rest\/v1\/vinted_accounts/.test(u)) return { status: 200, body: ACCOUNTS };
  if (!/\/rest\/v1\/app_data/.test(u)) return { status: 200, body: [] };
  const q = u.split('?')[1] || '';
  const params = q.split('&').filter(Boolean).map((kv) => { const i = kv.indexOf('='); return [kv.slice(0, i), kv.slice(i + 1)]; });
  if (params.some(([k, v]) => k === 'select' && /^owner/.test(v) && !/vrm_widget_token/.test(v))) return { status: 400, body: { message: 'column app_data.owner does not exist' } };
  let L = LIGNES.slice(); let sel = null, limit = null;
  for (const [k, v] of params) {
    if (k === 'select') sel = v;
    else if (k === 'limit') limit = Number(v);
    else if (k === 'id') L = L.filter((r) => teste(r.id, v));
    else if (/^data(->|->>)/.test(k)) L = L.filter((r) => teste(lire(r.data, chemin(k)), v));
  }
  const total = L.length; let from = 0, to = Math.min(total, 1000) - 1;
  const mr = /^(\d+)-(\d+)$/.exec(range || '');
  if (mr) { from = Number(mr[1]); to = Math.min(Number(mr[2]), from + 999, total - 1); }
  let page = L.slice(from, to + 1); if (limit != null) page = page.slice(0, limit);
  return { status: 200, body: page.map((r) => projette(r, sel)), headers: { 'content-range': `${from}-${from + page.length - 1}/${total}` } };
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.mjs': 'text/javascript', '.wasm': 'application/wasm' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });

async function ouvrir(b, vp, tab) {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/\/rest\/v1\//.test(u)) return r.fallback();
    return ['image', 'media', 'font', 'script'].includes(r.request().resourceType()) ? r.abort() : r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' });
  });
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request(); const h = { 'access-control-allow-origin': '*' };
    if (req.method() !== 'GET' && req.method() !== 'HEAD') return route.fulfill({ status: 201, contentType: 'application/json', headers: h, body: '[]' });
    const x = repondre(req.url(), req.headers()['range']);
    return route.fulfill({ status: x.status, contentType: 'application/json', headers: { ...h, ...(x.headers || {}) }, body: JSON.stringify(x.body) });
  });
  await pg.route(/localhost:\d+\/api\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  ctx.on('page', (p) => { if (p !== pg) p.close().catch(() => {}); });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, tel };
}
const attendre = (pg, f, arg, ms = 30000) => pg.waitForFunction(f, arg, { timeout: ms }).then(() => true).catch(() => false);
const attr = (pg, sel, a) => pg.evaluate(([s, x]) => { const e = document.querySelector(s); return e ? e.getAttribute(x) : null; }, [sel, a]);
const cartes = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-carte-chiffre]')].map((e) => ({ id: e.getAttribute('data-carte-chiffre'), p: e.getAttribute('data-carte-p') || '', v: e.getAttribute('data-carte-valeur'), page: e.getAttribute('data-carte-page') || '' })));
const shot = async (pg, nom) => { if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }).catch(() => {}); };

// ── Le widget, EXÉCUTÉ (§4.10) sur les mêmes lignes.
async function widget() {
  process.env.VAPID_PRIVATE_KEY = 'banc';
  // (8 nov.) Une clé de service FICTIVE (jamais la vraie : fetch est simulé) : depuis le 7 nov., sans clé
  // de service le widget répond 503 « configuration incomplète » (api/_lib/cle-service.js), comme il le doit.
  process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
  const vrai = global.fetch, vraiNow = Date.now;
  global.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (!u.includes('/rest/v1/')) return new Response('{}', { status: 404 });
    if ((opts.method || 'GET') !== 'GET') return new Response('', { status: 201 });
    const hs = opts.headers || {}; const x = repondre(u, hs.Range || hs.range || null);
    return new Response(JSON.stringify(x.body), { status: x.status, headers: { 'content-type': 'application/json', ...(x.headers || {}) } });
  };
  Date.now = () => MS;
  try {
    const w = (await import('file://' + path.join(RACINE, 'api', 'widget.js'))).default;
    const r = { code: null, corps: null, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, setHeader() {}, end() { return this; } };
    await w({ method: 'GET', headers: {}, query: { k: 'jeton-banc' } }, r);
    return r;
  } finally { global.fetch = vrai; Date.now = vraiNow; }
}

(async () => {
  console.log(`Recalcul indépendant : à envoyer ${ATT.envoyer} · à imprimer ${ATT.imprimer} · à déposer ${ATT.deposer} (+${ATT.attente} sans bordereau)`);
  console.log('── Le widget (api/widget.js exécuté)');
  try {
    const w = await widget();
    const s = (w.corps && w.corps.ship) || {};
    dit(w.code === 200 && s.total === ATT.envoyer, `E widget : ${ATT.envoyer} colis à envoyer (ni le compte retiré, ni le coché « Colis fait », ni les ventes « expédiée » au vieux bordereau, ni l'annulée)`, `HTTP ${w.code} · ${s.total}`);
    dit(w.corps && w.corps.pickup === 1 && w.corps.pickupAuMoins === true, 'R widget : un e-mail sans n° de suivi reçu après la photo n’ajoute AUCUN colis à retirer (1, « au moins »)', `pickup=${w.corps && w.corps.pickup} auMoins=${w.corps && w.corps.pickupAuMoins}`);
  } catch (e) { dit(false, 'le widget s’exécute', String(e && e.message || e).slice(0, 200)); }

  srv.listen(PORT);
  const b = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const vues = [{ width: 390, height: 844 }, { width: 1512, height: 982 }];
  try {
    for (const vp of vues) {
      const T = vp.width;
      console.log(`── ${T} px`);
      const toutes = [];
      // Ma journée
      { const { ctx, pg, errs } = await ouvrir(b, vp, 'journee');
        await attendre(pg, () => { const e = document.querySelector('[data-tuile="envoyer"]'); return e && e.getAttribute('data-n') && document.querySelector('[data-journee-a-imprimer]') && document.querySelector('[data-journee-a-imprimer]').getAttribute('data-exact') === '1'; }, null, 40000);
        const n = await attr(pg, '[data-tuile="envoyer"]', 'data-n');
        dit(n === String(ATT.envoyer), `${T} E Ma journée : ${ATT.envoyer} colis à envoyer`, n);
        const ai = await attr(pg, '[data-journee-a-imprimer]', 'data-journee-a-imprimer'), ex = await attr(pg, '[data-journee-a-imprimer]', 'data-exact');
        dit(ai === String(ATT.imprimer) && ex === '1', `${T} I Ma journée : ${ATT.imprimer} à imprimer (pas encore imprimés), exact — jamais les prêts déjà imprimés`, `${ai} exact=${ex}`);
        toutes.push(...(await cartes(pg)).map((c) => ({ ...c, ecran: 'journee' })));
        await shot(pg, `chiffres-journee-${T}`);
        dit(!errs.length, `${T} Z Ma journée sans erreur`, errs.slice(0, 2).join(' | '));
        await ctx.close(); }
      // Colis
      { const { ctx, pg, errs } = await ouvrir(b, vp, 'cat_bord');
        await attendre(pg, () => { const e = document.querySelector('[data-fu-colis-envoyer]'); return e && e.getAttribute('data-fu-colis-envoyer') !== ''; }, null, 40000);
        await pg.click('[data-colis-onglet-choix="envoyer"]').catch(() => {});
        await attendre(pg, () => !!document.querySelector('[data-colis-recap]') && !!document.querySelector('[data-tournee-ouvrir]'), null, 20000);
        await pg.waitForTimeout(800);
        const carte = await attr(pg, '[data-fu-colis-envoyer]', 'data-fu-colis-envoyer');
        const ong = await attr(pg, '[data-colis-onglet-choix="envoyer"]', 'data-colis-onglet-n');
        const rec = await attr(pg, '[data-colis-recap]', 'data-colis-recap');
        const badge = await pg.evaluate(() => { const e = [...document.querySelectorAll('[data-badge-n]')].map((x) => x.getAttribute('data-badge-n')); return e; });
        dit(carte === String(ATT.envoyer) && ong === String(ATT.envoyer) && rec === String(ATT.envoyer), `${T} E Colis : carte, onglet et récapitulatif disent ${ATT.envoyer}`, `carte ${carte} · onglet ${ong} · récap ${rec}`);
        dit(badge.includes(String(ATT.envoyer)), `${T} E la barre (badge de Colis) dit ${ATT.envoyer}`, JSON.stringify(badge));
        const imp = await pg.evaluate(() => { const e = document.querySelector('[data-carte-chiffre="imprimer"]'); return e ? e.getAttribute('data-carte-valeur') : null; });
        dit(imp === String(ATT.imprimer), `${T} I Colis : la case « À imprimer » dit ${ATT.imprimer}`, imp);
        const recTxt = await pg.evaluate(() => { const e = document.querySelector('[data-colis-recap-texte]'); return e ? e.textContent : ''; });
        const mImp = /(\d+)\s+bordereaux?\s+à imprimer/.exec(recTxt);
        dit(!!mImp && Number(mImp[1]) === ATT.imprimer, `${T} I le récapitulatif lu dit ${ATT.imprimer} à imprimer`, recTxt.replace(/\s+/g, ' ').slice(0, 140));
        toutes.push(...(await cartes(pg)).map((c) => ({ ...c, ecran: 'cat_bord' })));
        await pg.click('[data-tournee-ouvrir]').catch(() => {});
        await attendre(pg, () => !!document.querySelector('[data-tournee-sheet]'), null, 8000);
        await pg.waitForTimeout(500);
        const st = await pg.evaluate(() => { const e = document.querySelector('[data-tournee-sheet]'); return e ? e.innerText : ''; });
        const md = /(\d+)\s+colis à déposer(?:\s*·\s*(\d+)\s+(?:attend|attendent))?/.exec(st);
        dit(!!md && Number(md[1]) === ATT.deposer && Number(md[2] || 0) === ATT.attente, `${T} D Tournée : ${ATT.deposer} colis à déposer · ${ATT.attente} attendent leur bordereau`, md ? md[0] : st.slice(0, 120));
        await shot(pg, `chiffres-tournee-${T}`);
        dit(!errs.length, `${T} Z Colis sans erreur`, errs.slice(0, 2).join(' | '));
        await ctx.close(); }
      // Ventes et Statistiques : leurs cartes (pour la règle M)
      for (const tab of ['ventes', 'dashboard']) {
        const { ctx, pg, errs } = await ouvrir(b, vp, tab);
        await attendre(pg, () => document.querySelectorAll('[data-carte-chiffre]').length > 0, null, 30000);
        await pg.waitForTimeout(2500);
        toutes.push(...(await cartes(pg)).map((c) => ({ ...c, ecran: tab })));
        dit(!errs.length, `${T} Z ${tab} sans erreur`, errs.slice(0, 2).join(' | '));
        await ctx.close();
      }
      if (process.env.BANC_DEBUG) console.log(JSON.stringify(toutes));
      // M — le même chiffre (id + période) a la même valeur partout.
      const par = new Map();
      for (const c of toutes) { if (c.v == null || c.v === '') continue; const k = c.id + '|' + c.p; if (!par.has(k)) par.set(k, []); par.get(k).push(c); }
      const ecarts = [...par.entries()].filter(([, l]) => new Set(l.map((c) => c.v)).size > 1);
      const communs = [...par.entries()].filter(([, l]) => new Set(l.map((c) => c.ecran)).size > 1).length;
      dit(communs > 0 && !ecarts.length, `${T} M chaque chiffre de carte a la même valeur sur tous ses écrans (${communs} chiffre(s) montré(s) sur plusieurs écrans)`,
        ecarts.map(([k, l]) => `${k}: ${l.map((c) => c.ecran + '=' + c.v).join(' ')}`).join(' ; '));
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} chiffres-coherents : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
