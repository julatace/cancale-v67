// ════════════════════════════════════════════════════════════════════════════
//  LE TRANSPORTEUR DES ANCIENS BORDEREAUX — le cron du matin EXÉCUTÉ (9 nov.)
//  `api/ship-reminders.js` (vrai handler) contre un FAUX PostgREST qui sert la
//  vraie forme : `meta` calculée comme la migration 004 (scalaires de 1er niveau,
//  `_pdf`), projections `alias:meta->>k` / `alias:data->a->>b`, filtres `owner=`,
//  `id=like.|eq.|in.(…)`, `data->resume->>t=eq.`, pagination `Range`.
//  Les lignes : `email_bord_{tx}` (avec un PDF), `email_reception_{cle}` (sujet,
//  résumé `{ t:'bordereau', tx }`), `email_texte_{cle}` (texte borné).
//   T1  un seul transporteur nommé ⇒ rangé dans `vrm_bord_transporteurs` ;
//       deux noms, texte coupé, deux e-mails du même n° en désaccord ⇒ rien
//       (« vu ») ; un bordereau qui a déjà un transporteur (même vide) n'est
//       jamais touché ; un e-mail d'un AUTRE n° ne compte pas ; autre vendeur intact ;
//   T2  aucune requête `select=data` sur un bordereau ni sur un texte ; tout est
//       projeté et paginé ;
//   T3  idempotent : second passage ⇒ aucune écriture ;
//   T4  borné : 25 candidats ⇒ 20, puis 5 (les plus récents d'abord) ;
//   T5  lecture ratée (bordereaux, suivis, textes, ligne de rangement) ⇒ rien écrit ;
//   T6  l'app (`transporteurRelu`) n'écrase jamais un transporteur ni un n° rangé ;
//   T7  MONDIAL RELAY AU DÉPART, ancien bordereau sans n° : le n° Mondial Relay écrit
//       dans le texte de SON e-mail (« N° de suivi : 8 chiffres », la règle de la
//       réception) est relu ; l'e-mail de dépôt Mondial Relay du MÊME n° fait alors
//       quitter « À envoyer » — la VRAIE route `api/widget.js` et la composition du
//       cron (`lireDonneesColis` + `txsAExpedier`), règle partagée `depart-vente.js` ;
//       deux n° différents, un n° coupé, un dépôt d'un autre n° ⇒ elle reste.
//  Données inventées (dépôt public). `--prouve` : chaque mutation rougit.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require(require('path').join(__dirname, '_horloge-notif.cjs'));
const path = require('path');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver } = require('./_mutations-audit.cjs');

const LIB = 'api/_lib/transporteur-anciens.js';
const MUTATIONS = {
  'texte coupé qui décide': [[LIB, "const entiers = lus.filter((e) => !texteCoupe(e.texte));", "const entiers = lus;"]],
  'désaccord entre deux e-mails ignoré': [[LIB, "if (noms.length > 1) return { r: 'plusieurs' };", ""]],
  'deux noms dans un texte ignorés': [[LIB, "if (textes.some((t) => transporteursNommes(t).size > 1)) return { r: 'plusieurs' };", ""]],
  'transporteur déjà rangé écrasé': [[LIB, "if (b.transporteur != null) continue;", "if (b.transporteur) continue;"]],
  'pas idempotent': [[LIB, "if (parTx[tx] || vus[tx]) continue;", ""]],
  'pas borné': [[LIB, "const lot = candidats.slice(0, Math.max(0, max));", "const lot = candidats;"]],
  'lecture des textes ratée prise pour vide': [[LIB, "if (!Array.isArray(textes)) return { fait: false, raison: 'textes illisibles — rien écrit' };", "if (!Array.isArray(textes)) textes = [];"], [LIB, "const textes = cles.length", "let textes = cles.length"]],
  'ligne de rangement illisible prise pour vide': [[LIB, "if (memo === undefined) return { fait: false, raison: 'ligne de rangement illisible — rien écrit' };", ""]],
  'identité par autre chose que le n°': [[LIB, "emailsParTx.get(tx).push({ cle: m[1], sujet: r.sujet || '' });", "emailsParTx.get(tx).push({ cle: m[1], sujet: r.sujet || '' }); for (const [k, v] of emailsParTx) if (k !== tx) v.push({ cle: m[1], sujet: r.sujet || '' });"]],
  'select=data sur les bordereaux': [[LIB, "select=id,tx:meta->>transaction,transporteur:meta->>transporteur,suivi:meta->>suivi,recu:meta->>receivedAt'", "select=id,data,tx:meta->>transaction,transporteur:meta->>transporteur,suivi:meta->>suivi,recu:meta->>receivedAt'"]],
  'app qui écrase': [[LIB, "if (!bord.transporteur && typeof e.t === 'string' && e.t)", "if (typeof e.t === 'string' && e.t)"]],
  'n° rangé écrasé': [[LIB, "if (!String(bord.suivi || '').trim() && typeof e.s === 'string'", "if (typeof e.s === 'string'"]],
  'n° coupé qui compte': [[LIB, "if (texteCoupe(e.texte) && l.fin >= s.length - 1) continue;", ""]],
  'deux n° ⇒ le premier': [[LIB, "return lus.size === 1 ? [...lus][0] : '';", "return lus.size >= 1 ? [...lus][0] : '';"]],
  'widget sans les n° relus': [['api/widget.js', "  return avecRelus(b, relus);", "  return b;"]],
  'cron sans les n° relus': [['api/ship-reminders.js', "  return avecRelus(b, relus);", "  return b;"]],
  'cron qui ne la lance pas': [['api/ship-reminders.js', "transporteursAnciens = await passeTransporteursAnciens({", "transporteursAnciens = await (async () => null)({"]],
};
if (process.argv.includes('--prouve')) prouver(__filename, R, MUTATIONS);
else {
process.env.CRON_SECRET = 'cle-banc-anciens';
const OWNER = '11111111-2222-3333-4444-555555555555';
const AUTRE = '99999999-2222-3333-4444-555555555555';
process.env.VRM_OWNER_UID = OWNER;
process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d !== undefined ? ' — ' + String(d).slice(0, 400) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String((e && e.stack) || e).slice(0, 400)); } };

// La colonne `meta` comme la migration 004 : scalaires de premier niveau (≤ 600), `_pdf`.
function metaDe(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const m = {};
  for (const [k, v] of Object.entries(d)) if (['string', 'number', 'boolean'].includes(typeof v) && JSON.stringify(v).length <= 600) m[k] = v;
  if (d.pdfB64) m._pdf = true;
  return m;
}
function chemin(row, expr) {
  const texte = /->>[^>]*$/.test(expr);
  const parts = expr.split(/->>|->/);
  let v = parts[0] === 'data' ? row.data : parts[0] === 'meta' ? metaDe(row.data) : row[parts[0]];
  for (const p of parts.slice(1)) v = v == null ? undefined : v[p];
  if (texte && v != null && typeof v !== 'string') v = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return v === undefined ? null : v;
}
function projette(row, sel) {
  const out = {};
  for (const champ of sel.split(',')) {
    const m = /^(?:([A-Za-z_]\w*):)?(.+)$/.exec(champ.trim()); if (!m) continue;
    const expr = m[2];
    out[m[1] || expr.split(/->>|->/).pop()] = expr === 'data' ? row.data : chemin(row, expr);
  }
  return out;
}

let LIGNES = [], APPELS = [], ECRITS = [], PANNE = () => false;
const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
global.fetch = async (url, opts = {}) => {
  const brut = String(url);
  const u = decodeURIComponent(brut);
  const meth = (opts.method || 'GET').toUpperCase();
  APPELS.push({ meth, u, range: (opts.headers || {}).Range || null });
  if (!/\/rest\/v1\//.test(u)) return J({});
  if (/\/rpc\/vrm_acces_pour/.test(u)) return J(true);
  if (PANNE(meth, u)) return new Response('<html>522</html>', { status: 522, headers: { 'content-type': 'text/html' } });
  if (meth !== 'GET') {
    let corps = []; try { corps = JSON.parse(opts.body || '[]'); } catch (_) {}
    for (const r of [].concat(corps)) {
      if (!r || !r.id) continue;
      ECRITS.push({ owner: r.owner, id: r.id, data: r.data });
      const i = LIGNES.findIndex((l) => l.owner === r.owner && l.id === r.id);
      if (i >= 0) LIGNES[i] = { owner: r.owner, id: r.id, data: r.data }; else LIGNES.push({ owner: r.owner, id: r.id, data: r.data });
    }
    return new Response('', { status: 201 });
  }
  if (/select=owner&limit=1/.test(u)) return J([{ owner: OWNER }]);
  const q = new URL(brut).searchParams;
  if (!/\/rest\/v1\/app_data\?/.test(u)) return J([]);
  let sel = LIGNES.slice();
  const own = q.get('owner'); if (own) sel = sel.filter((l) => 'eq.' + l.owner === own);
  const id = q.get('id');
  if (id && id.startsWith('like.')) { const re = new RegExp('^' + id.slice(5).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/%/g, '.*').replace(/_/g, '.') + '$'); sel = sel.filter((l) => re.test(l.id)); }
  if (id && id.startsWith('eq.')) sel = sel.filter((l) => l.id === id.slice(3));
  if (id && id.startsWith('in.(')) { const s = new Set(id.slice(4, -1).split(',')); sel = sel.filter((l) => s.has(l.id)); }
  for (const [k, v] of q.entries()) {
    if (!/^(data|meta)->/.test(k)) continue;
    if (v.startsWith('eq.')) sel = sel.filter((l) => String(chemin(l, k)) === v.slice(3));
    if (v.startsWith('in.(')) { const s = new Set(v.slice(4, -1).split(',')); sel = sel.filter((l) => s.has(String(chemin(l, k)))); }
    if (v === 'is.null') sel = sel.filter((l) => chemin(l, k) == null);
    if (v === 'not.is.null') sel = sel.filter((l) => chemin(l, k) != null);
  }
  sel.sort((a, b) => (a.id < b.id ? -1 : 1));
  const range = (opts.headers || {}).Range;
  let de = 0, a = sel.length - 1;
  if (range) { const m = /^(\d+)-(\d+)$/.exec(range); de = +m[1]; a = +m[2]; }
  a = Math.min(a, de + 999);
  const s = q.get('select') || 'data';
  return J(sel.slice(de, a + 1).map((l) => projette(l, s)));
};

const PDF = Buffer.from('%PDF-1.4 ' + 'x'.repeat(4000)).toString('base64');
const bord = (tx, extra = {}, owner = OWNER) => ({ owner, id: 'email_bord_' + tx, data: { type: 'bordereau', transaction: tx, article: 'Salomon XT-6 42', filename: `Bordereau-Vinted-${tx}.pdf`, pdfB64: PDF, receivedAt: extra.recu || '2026-10-20T10:00:00.000Z', ...extra } });
const reception = (cle, tx, sujet = "Bordereau d'envoi pour Salomon XT-6 42", owner = OWNER) => ({ owner, id: 'email_reception_' + cle, data: { subject: sujet, from: 'no-reply@vinted.fr', etat: 'integre', type: 'bordereau', resume: { v: 1, t: 'bordereau', tx, pdf: 1 } } });
const texte = (cle, t, owner = OWNER) => ({ owner, id: 'email_texte_' + cle, data: { texte: t, at: '2026-10-20T10:00:00.000Z' } });
const sansTransporteur = (b) => { delete b.data.transporteur; return b; };

function base() {
  return [
    { owner: OWNER, id: 'main', data: {} },
    // A : Mondial Relay seul ⇒ rangé.
    sansTransporteur(bord('31000000001', { recu: '2026-10-25T10:00:00.000Z' })), reception('a1', '31000000001'),
    texte('a1', "Ton bordereau est prêt.\nN° de transaction : 31000000001\nDépose ton colis dans un point Mondial Relay avant le 27/10/2026."),
    // B : deux noms ⇒ rien.
    sansTransporteur(bord('31000000002')), reception('b1', '31000000002'),
    texte('b1', "Dépose ton colis chez Chronopost ou Colissimo selon ton choix."),
    // C : texte COUPÉ (1500 + « … ») qui ne nomme qu'un transporteur au début ⇒ rien.
    sansTransporteur(bord('31000000003')), reception('c1', '31000000003'),
    texte('c1', ('Relais Chronopost. ' + 'y'.repeat(1600)).slice(0, 1500) + '…'),
    // D : déjà « chronopost » rangé, texte qui dit Mondial Relay ⇒ jamais touché.
    bord('31000000004', { transporteur: 'chronopost' }), reception('d1', '31000000004'), texte('d1', 'Point Mondial Relay.'),
    // E : déjà rangé VIDE à la réception (la règle a vu le texte entier) ⇒ jamais touché.
    bord('31000000005', { transporteur: '' }), reception('e1', '31000000005'), texte('e1', 'Point Mondial Relay.'),
    // F : aucun e-mail gardé ⇒ compté, rien écrit.
    sansTransporteur(bord('31000000006')),
    // G : deux e-mails du même n° qui ne disent pas le même transporteur ⇒ rien.
    sansTransporteur(bord('31000000007')), reception('g1', '31000000007'), texte('g1', 'Relais Chronopost.'),
    reception('g2', '31000000007'), texte('g2', 'Point Mondial Relay.'),
    // H : un e-mail d'un AUTRE n° (31000000099, sans bordereau) qui nomme Chronopost ne relie rien à H.
    sansTransporteur(bord('31000000008')), reception('h1', '31000000099'), texte('h1', 'Relais Chronopost.'),
    // I : un e-mail qui nomme Vinted Go, et un rappel du même n° qui ne nomme personne ⇒ Vinted Go.
    sansTransporteur(bord('31000000009')), reception('i1', '31000000009'), texte('i1', 'Dépose-le dans un casier Vinted Go.'),
    reception('i2', '31000000009', 'Rappel : ton colis'), texte('i2', "N'oublie pas d'envoyer ton colis."),
    // Un AUTRE vendeur, même forme : jamais lu ni écrit.
    sansTransporteur(bord('31000000001', {}, AUTRE)), reception('z1', '31000000001', undefined, AUTRE), texte('z1', 'Relais Chronopost.', AUTRE),
  ];
}

(async () => {
  let mod, lib;
  try { mod = await import('file://' + path.join(R, 'api', 'ship-reminders.js')); } catch (e) { dit(false, 'api/ship-reminders.js se charge', String(e && e.message)); }
  try { lib = await import('file://' + path.join(R, LIB)); } catch (e) { lib = null; }
  const lancer = async () => {
    LIGNES = LIGNES.filter((l) => !/^cron_curseur_/.test(l.id));   // un nouveau jour pour le curseur des lots
    const res = { code: null, corps: null, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, setHeader() {}, end() { return this; } };
    await mod.default({ method: 'GET', headers: { authorization: 'Bearer cle-banc-anciens' }, query: {} }, res);
    return res;
  };
  const partAnciens = (d) => ({ parTx: (d && d.parTx) || {}, vus: (d && d.vus) || {} });
  const rangement = (owner = OWNER) => (LIGNES.find((l) => l.owner === owner && l.id === 'vrm_bord_transporteurs') || {}).data || null;
  const bilan = (res) => res && res.corps && Array.isArray(res.corps.bilans) ? (res.corps.bilans.find((b) => b && b.transporteursAnciens) || res.corps.bilans[0] || {}).transporteursAnciens : undefined;

  await essaie('T1', async () => {
    if (!mod) throw new Error('route absente');
    LIGNES = base(); APPELS = []; ECRITS = []; PANNE = () => false;
    const res = await lancer();
    const b = bilan(res);
    const r = rangement();
    dit(b && b.fait === true && b.ranges === 2 && b.vus === 3 && b.sansEmail === 2, 'T1 la passe du matin tourne : 2 rangés, 3 vus sans décision, 2 sans e-mail de leur n°', JSON.stringify(b));
    dit(r && r.parTx && r.parTx['31000000001'] && r.parTx['31000000001'].t === 'mondialrelay', 'T1 un seul nom (Mondial Relay) ⇒ rangé', JSON.stringify(r && r.parTx));
    dit(r && r.parTx && r.parTx['31000000009'] && r.parTx['31000000009'].t === 'vinted', 'T1 « Vinted Go » + un rappel muet du même n° ⇒ Vinted Go', JSON.stringify(r && r.parTx));
    dit(r && !r.parTx['31000000002'] && r.vus['31000000002'] && r.vus['31000000002'].r === 'plusieurs', 'T1 deux noms dans le texte ⇒ rien', JSON.stringify(r && r.vus));
    dit(r && !r.parTx['31000000003'] && r.vus['31000000003'] && r.vus['31000000003'].r === 'texte-coupe', 'T1 texte coupé ⇒ ne décide rien', JSON.stringify(r && r.vus));
    dit(r && !r.parTx['31000000007'] && r.vus['31000000007'] && r.vus['31000000007'].r === 'plusieurs', 'T1 deux e-mails du même n° en désaccord ⇒ rien', JSON.stringify(r && r.vus));
    dit(r && !r.parTx['31000000004'] && !r.vus['31000000004'] && !r.parTx['31000000005'] && !r.vus['31000000005'], 'T1 un bordereau qui a déjà un transporteur (même vide) n\'est jamais touché', JSON.stringify(r));
    dit(r && !r.parTx['31000000008'] && !r.vus['31000000008'] && !r.parTx['31000000099'], 'T1 un e-mail d\'un AUTRE n° ne relie rien', JSON.stringify(r));
    dit(!ECRITS.some((e) => /^email_bord_/.test(e.id)), 'T1 aucune ligne de bordereau (avec PDF) réécrite', ECRITS.map((e) => e.id).join(','));
    dit(!rangement(AUTRE) && ECRITS.filter((e) => e.id === 'vrm_bord_transporteurs').every((e) => e.owner === OWNER), 'T1 l\'autre vendeur n\'est ni lu ni écrit');
    const lus = APPELS.filter((a) => a.meth === 'GET' && /id=(like\.email_bord_|like\.email_reception_|in\.\(email_texte_)/.test(a.u));
    dit(lus.length >= 3 && lus.every((a) => !/select=([^&]*,)?data(,|&|$)/.test(a.u)), 'T2 aucune lecture `select=data` sur bordereaux, suivis ni textes', lus.map((a) => a.u).join(' | '));
    // (9 nov.) La sonde du statut (`email_reception_*`, une ligne, limit=1, propriétaire neutre) n'est pas une liste de cette passe.
    dit(lus.filter((a) => /like\./.test(a.u) && !/email_reception_/.test(a.u)).every((a) => a.range && /owner=eq\./.test(a.u)), 'T2 listes paginées (Range) et au nom du vendeur', lus.map((a) => a.u + ' ' + a.range).join(' | '));
    // T3 — second passage.
    // (9 nov.) La passe des ÉTIQUETTES (PDF, `passeTransporteursPdf`) écrit aussi dans cette ligne
    // (`pdf`/`pdfVus`) : on juge ici ce que CETTE passe range (`parTx`/`vus`), qui ne doit pas bouger.
    const avant = JSON.stringify(partAnciens(rangement()));
    const res2 = await lancer();
    const apres = JSON.stringify(partAnciens(rangement()));
    dit(apres === avant && bilan(res2) && bilan(res2).ranges === 0, 'T3 second passage : rien de neuf, rien réécrit de cette passe', JSON.stringify(bilan(res2)));
  });

  await essaie('T4', async () => {
    if (!mod) throw new Error('route absente');
    LIGNES = [{ owner: OWNER, id: 'main', data: {} }]; APPELS = []; ECRITS = []; PANNE = () => false;
    for (let i = 0; i < 25; i++) {
      const tx = String(32000000000 + i);
      LIGNES.push(sansTransporteur(bord(tx, { recu: new Date(Date.parse('2026-10-01T00:00:00Z') + i * 3600e3).toISOString() })), reception('k' + i, tx), texte('k' + i, 'Point Mondial Relay.'));
    }
    const r1 = bilan(await lancer());
    const n1 = Object.keys((rangement() || {}).parTx || {});
    dit(r1 && r1.ranges === 20 && r1.restants === 5 && n1.length === 20 && n1.includes('32000000024') && !n1.includes('32000000000'), 'T4 25 candidats ⇒ 20 au premier passage, les plus récents d\'abord', JSON.stringify(r1));
    const r2 = bilan(await lancer());
    dit(r2 && r2.ranges === 5 && Object.keys(rangement().parTx).length === 25, 'T4 les 5 restants au passage suivant', JSON.stringify(r2));
  });

  for (const [nom, panne] of [
    ['bordereaux', (m, u) => m === 'GET' && /like\.email_bord_/.test(u)],
    ['suivis des e-mails', (m, u) => m === 'GET' && /like\.email_reception_/.test(u)],
    ['textes', (m, u) => m === 'GET' && /in\.\(email_texte_/.test(u)],
    ['ligne de rangement', (m, u) => m === 'GET' && /id=eq\.vrm_bord_transporteurs/.test(u)],
  ]) {
    await essaie('T5 ' + nom, async () => {
      if (!mod) throw new Error('route absente');
      LIGNES = base(); APPELS = []; ECRITS = []; PANNE = panne;
      const b = bilan(await lancer());
      dit(b && b.fait === false && !ECRITS.some((e) => e.id === 'vrm_bord_transporteurs' && (Object.keys((e.data && e.data.parTx) || {}).length || Object.keys((e.data && e.data.vus) || {}).length)), `T5 lecture ratée (${nom}) ⇒ rien écrit, dit`, JSON.stringify(b));
    });
  }

  await essaie('T6', async () => {
    if (!lib) throw new Error('règle absente');
    const ligne = { parTx: { '1000001': { t: 'mondialrelay' } } };
    const a = lib.transporteurRelu({ transaction: '1000001', transporteur: 'chronopost' }, ligne);
    const b = lib.transporteurRelu({ transaction: '1000001' }, ligne);
    const c = lib.transporteurRelu({ transaction: '1000002' }, ligne);
    dit(a.transporteur === 'chronopost' && b.transporteur === 'mondialrelay' && b.transporteurSource === 'email-relu' && !c.transporteur, 'T6 l\'app : un transporteur rangé n\'est jamais remplacé ; un relu ne vaut que pour SON n°', JSON.stringify([a, b, c]));
    const l2 = { parTx: { '1000003': { s: '60385202' } } };
    const d = lib.transporteurRelu({ transaction: '1000003', suivi: 'XW123456789TS' }, l2);
    const e = lib.transporteurRelu({ transaction: '1000003', suivi: '' }, l2);
    dit(d.suivi === 'XW123456789TS' && e.suivi === '60385202' && e.suiviSource === 'email-relu', 'T6 un n° de suivi rangé n\'est jamais remplacé ; un bordereau sans n° reçoit le n° relu', JSON.stringify([d, e]));
  });

  await essaie('T7', async () => {
    if (!mod) throw new Error('route absente');
    const H = 3600e3, NOW = Date.now(), iso = (ms) => new Date(ms).toISOString();
    const vente = (tx) => ({ transaction_id: Number(tx), title: 'Salomon XT-6 42', status: 'Bordereau envoyé au vendeur', transaction_user_status: 'needs_action', date: iso(NOW - 50 * H), price: { amount: '80.0', currency_code: 'EUR' } });
    const TX = ['33000000001', '33000000002', '33000000003', '33000000004'];
    const poser = () => {
      LIGNES = [
        { owner: OWNER, id: 'main', data: { vrm_widget_token: '', vinted_ship_done: {}, vinted_bords_shipped: {}, vinted_bords_hidden: {}, vinted_accounts_hidden: [], vinted_pickup_done: {}, vrm_colis_collected: [], vrm_lbc_colis_done: {}, vrm_vc_colis_done: {}, vrm_vc_numeros: {}, vrm_vc_liens: {} } },
        { owner: OWNER, id: 'harvest_U1_orders_sold', data: { capturedAt: iso(NOW - 40 * H), resume: { at: iso(NOW - 40 * H), txns: TX.map(Number) }, payload: { my_orders: TX.map(vente) } } },
        { owner: OWNER, id: 'harvest_U1_orders_purchased', data: { capturedAt: iso(NOW - 40 * H), resume: { at: iso(NOW - 40 * H), txns: [] }, payload: { my_orders: [] } } },
        { owner: OWNER, id: 'panel_bords_done', data: {} },
      ];
      // Quatre anciens bordereaux (d'avant le 9 nov. : ni n° ni transporteur rangés).
      for (const tx of TX) LIGNES.push(sansTransporteur(bord(tx, { suivi: '', recu: iso(NOW - 48 * H) })));
      // A : le texte de SON e-mail dit « N° de suivi : 60385202 », et Mondial Relay dit le dépôt de CE n°.
      LIGNES.push(reception('m1', TX[0]), texte('m1', 'N° de transaction : ' + TX[0] + '\nN° de suivi : 60385202\nDépose ton colis dans un Point Relais Mondial Relay.'));
      // B : deux e-mails du même n° de transaction qui ne disent pas le même n° ⇒ rien.
      LIGNES.push(reception('m2', TX[1]), texte('m2', 'N° de suivi : 60385203\nMondial Relay.'), reception('m3', TX[1]), texte('m3', 'N° de suivi : 60385204\nMondial Relay.'));
      // C : texte coupé PILE après 8 chiffres d'un n° plus long ⇒ rien.
      LIGNES.push(reception('m4', TX[2]), texte('m4', ('Mondial Relay. ' + 'z'.repeat(1600)).slice(0, 1477) + ' N° de suivi : 60385205…'));
      // D : son n° est relu, mais le dépôt Mondial Relay est celui d'un AUTRE n° ⇒ reste.
      LIGNES.push(reception('m5', TX[3]), texte('m5', 'N° de suivi : 60385206\nMondial Relay.'));
      const depot = (n) => ({ owner: OWNER, id: 'email_track_mondialrelay_' + n, data: { type: 'suivi', carrier: 'mondialrelay', suivi: n, status: 'transit', statusLabel: 'En transit', subject: `Votre colis ${n} est entre de bonnes mains`, receivedAt: iso(NOW - 20 * H), emailAt: iso(NOW - 20 * H), sens: 'sortant' } });
      LIGNES.push(depot('60385202'), depot('60385203'), depot('60385205'), depot('60385299'));
    };
    const { contexteVendeur } = await import('file://' + path.join(R, 'api', '_lib', 'owner.js'));
    const SR = mod;
    const widget = async () => { const w = (await import('file://' + path.join(R, 'api', 'widget.js'))).default; const res = { code: null, corps: null, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, setHeader() {}, send() { return this; }, end() { return this; } }; await w({ method: 'GET', headers: {}, query: {} }, res); return res; };
    const cron = async () => { const d = await contexteVendeur.run({ owner: OWNER }, () => SR._banc.lireDonneesColis()); const t = SR._banc.txsAExpedier(d); return t ? new Set([...t.vinted].map(String)) : null; };
    poser(); APPELS = []; ECRITS = []; PANNE = () => false;
    const w0 = await widget(), c0 = await cron();
    dit(w0.corps && w0.corps.ship && w0.corps.ship.vinted === 4 && c0 && TX.every((t) => c0.has(t)), 'T7 avant la relecture : les 4 ventes Mondial Relay attendent leur envoi (widget et rappels)', JSON.stringify([w0.corps && w0.corps.ship, c0 && [...c0]]));
    const b = bilan(await lancer());
    const r = rangement();
    dit(b && b.suivis === 2 && r && r.parTx[TX[0]] && r.parTx[TX[0]].s === '60385202' && r.parTx[TX[3]] && r.parTx[TX[3]].s === '60385206', 'T7 le n° Mondial Relay écrit dans l’e-mail de SON bordereau est relu (2 n°)', JSON.stringify([b, r && r.parTx]));
    dit(r && !(r.parTx[TX[1]] && r.parTx[TX[1]].s) && !(r.parTx[TX[2]] && r.parTx[TX[2]].s), 'T7 deux n° différents, ou un n° qui touche la coupure du texte ⇒ aucun n° relu', JSON.stringify(r && r.parTx));
    const w1 = await widget(), c1 = await cron();
    dit(w1.corps && w1.corps.ship && w1.corps.ship.vinted === 3, 'T7 widget : la vente déposée chez Mondial Relay quitte « À envoyer » (3 restent)', JSON.stringify(w1.corps && w1.corps.ship));
    dit(c1 && !c1.has(TX[0]) && c1.has(TX[1]) && c1.has(TX[2]) && c1.has(TX[3]), 'T7 rappels du matin et du soir : la même (seule la vente au n° déposé sort)', JSON.stringify(c1 && [...c1]));
    PANNE = (m, u) => m === 'GET' && /id=eq\.vrm_bord_transporteurs/.test(u);
    const c2 = await cron();
    dit(c2 && c2.has(TX[0]), 'T7 ligne relue illisible ⇒ rien fusionné : la vente reste « à envoyer » (pas su ≠ parti)', JSON.stringify(c2 && [...c2]));
    PANNE = () => false;
  });

  // (9 nov.) T8 — LE CRON EXÉCUTÉ RELIT L'ÉTIQUETTE des anciens bordereaux (`passeTransporteursPdf`) :
  // un vrai PDF (fabriqué) qui nomme Mondial Relay, un autre (label capté par l'extension, sans e-mail)
  // qui nomme Chronopost ; un PDF par requête (`data->>pdfB64`), jamais `select=data`.
  await essaie('T8', async () => {
    if (!mod) throw new Error('route absente');
    const { PDFDocument, StandardFonts } = require(path.join(R, 'node_modules', 'pdf-lib'));
    const fab = async (lignes) => { const d = await PDFDocument.create(); const f = await d.embedFont(StandardFonts.Helvetica); const p = d.addPage([283, 425]); lignes.forEach((l, i) => p.drawText(l, { x: 10, y: 400 - 16 * i, font: f, size: 10 })); return Buffer.from(await d.save()).toString('base64'); };
    LIGNES = [{ owner: OWNER, id: 'main', data: {} },
      sansTransporteur(bord('34000000001', { pdfB64: await fab(['Mondial Relay', 'N° de suivi : 87650001']) })),
      { owner: OWNER, id: 'harvest_77_label_34000000002', data: { uid: '77', tx: '34000000002', capturedAt: '2026-11-05T10:00:00Z', pdfB64: await fab(['Chronopost', 'XW987654321TS']) } }];
    APPELS = []; ECRITS = []; PANNE = () => false;
    await lancer();
    const r = rangement();
    dit(r && r.pdf && r.pdf['34000000001'] && r.pdf['34000000001'].t === 'mondialrelay' && r.pdf['34000000001'].s === '87650001', 'T8 le cron relit l’étiquette d’un ancien bordereau e-mail ⇒ Mondial Relay + son n°', JSON.stringify(r && r.pdf));
    dit(r && r.pdf && r.pdf['34000000002'] && r.pdf['34000000002'].t === 'chronopost' && r.pdf['34000000002'].s === 'XW987654321TS', 'T8 et celle d’un bordereau capté par l’extension (sans e-mail) ⇒ Chronopost', JSON.stringify(r && r.pdf));
    const lusPdf = APPELS.filter((a) => a.meth === 'GET' && /pdfB64/.test(a.u));
    dit(lusPdf.length === 2 && lusPdf.every((a) => /id=eq\./.test(a.u) && /select=pdf:data->>pdfB64/.test(a.u) && /owner=eq\./.test(a.u)), 'T8 un PDF par requête, au nom du vendeur, rien d’autre que le PDF', lusPdf.map((a) => a.u).join(' | '));
    await lancer();
    dit(APPELS.filter((a) => a.meth === 'GET' && /pdfB64/.test(a.u)).length === 2, 'T8 passage suivant : aucun PDF relu (idempotent)');
  });

  console.log(`\n${ko ? '❌' : '✅'} transporteur des anciens bordereaux : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ audit planté : ' + ((e && e.stack) || e)); process.exit(1); });
}
