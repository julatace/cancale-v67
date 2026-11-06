// ════════════════════════════════════════════════════════════════════════════
//  LA SUPPRESSION D'UN COMPTE eBAY (« Marketplace Account Deletion »), EXÉCUTÉE.
//        node scripts/audit-ebay-suppression.cjs [--src dossier]
//
//  La VRAIE route (`api/ebay.js`, `?mode=deletion`) est chargée et appelée.
//  Autour d'elle, rien que des faux À ÉTAT, à la forme réelle :
//    · un faux eBay : jeton d'application (client_credentials) et
//      `GET /commerce/notification/v1/public_key/{kid}` qui rend
//      `{algorithm:"ECDSA", digest:"SHA1", key:"-----BEGIN PUBLIC KEY-----…"}`
//      (une ligne, comme eBay). La paire de clés est GÉNÉRÉE ici, la signature
//      `x-ebay-signature` (base64 de `{alg,kid,signature,digest}`) CALCULÉE ici
//      (ECDSA / SHA-1 sur le corps) ;
//    · une fausse base PostgREST : lignes (owner, id, data), filtres `eq.`,
//      `like.`, `ilike.` sur `data->>orders` (texte au format jsonb de
//      Postgres), projections `select=`, pagination `Range`, PATCH
//      conditionnel sur `data->>rev`, POST avec ou sans `on_conflict`.
//  Données INVENTÉES (le dépôt est public).
//
//  Ce qui est exigé :
//    1. défi GET ⇒ SHA-256(challengeCode + jeton + adresse) en hexadécimal ;
//    2. signature absente, fausse, d'un autre corps, `kid` inconnu ⇒ 412 et
//       la base n'a pas bougé d'un octet ;
//    3. clé publique illisible ⇒ 5xx, rien n'est écrit ;
//    4. signature bonne ⇒ chez DEUX vendeurs, pseudo, nom, adresse, e-mail,
//       téléphone de l'acheteur disparaissent ; montants, dates, n° de
//       commande, articles restent ; les autres acheteurs ne bougent pas ;
//    5. base qui ne répond pas (liste, ligne) ou écriture refusée ⇒ 5xx, rien
//       d'écrit ; rejouée, la notification ne réécrit rien ;
//    6. un VENDEUR relié qui ferme son compte eBay ⇒ ce compte est déconnecté
//       (jeton vidé), son pseudo remplacé ; ses autres comptes et les autres
//       vendeurs ne bougent pas.
//    7. (6 nov., charge) eBay envoie cette notification pour TOUS ses
//       utilisateurs (~3/min). Avec 200 vendeurs eBay en base, la notification
//       d'un INCONNU ne rend AUCUNE ligne (avant : le registre de chacun des 200
//       vendeurs, à chaque notification) et ne fait que 2 lectures sans la
//       migration 026, 1 avec (`vrm_ebay_cibles`) — quel que soit le nombre
//       de vendeurs ;
//    8. avec la migration 026 (fonction servie), 4 et 6 donnent EXACTEMENT le
//       même résultat ; la fonction qui ne répond pas ⇒ 5xx, rien d'écrit ;
//       fonction absente (404 PGRST202) ⇒ le chemin sans elle.
//  La fausse fonction reproduit `vrm_ebay_ids` (migration 026 : pseudos
//  acheteur/vendeur des commandes, pseudo et clé des comptes, minuscules, sans
//  espaces autour) — expression vérifiée en lecture seule sur le vrai Postgres
//  le 6 nov. avec des données inventées.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const crypto = require('crypto');
const Module = require('module');
const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');

// `api/_lib/ebay-gestion.js` importe `fast-xml-parser` : la suppression ne
// lit aucun XML. S'il n'est pas installé ici, un module vide le remplace (le
// vrai paquet passe en premier quand il est là).
if (typeof Module.registerHooks === 'function') {
  Module.registerHooks({
    resolve(spec, ctx, next) {
      if (spec !== 'fast-xml-parser') return next(spec, ctx);
      try { return next(spec, ctx); } catch (_) {
        return { url: 'data:text/javascript,' + encodeURIComponent('export class XMLParser{parse(){return {};}};export const XMLValidator={validate(){return true;}};'), shortCircuit: true };
      }
    },
  });
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'le contrôle a levé : ' + String(e && e.message || e).slice(0, 200)); } };

const V1 = '11111111-1111-4111-8111-111111111111';
const V2 = '22222222-2222-4222-8222-222222222222';
const V3 = '33333333-3333-4333-8333-333333333333';
const URL_DEL = 'https://vrm.center/api/ebay-deletion';
const JETON_VERIF = 'vrm-verif-0123456789abcdef0123456789abcdef';
process.env.EBAY_APP_ID = 'app-de-banc';
process.env.EBAY_CERT_ID = 'secret-de-banc';
process.env.SUPABASE_SERVICE_KEY = 'cle-service-de-banc';
process.env.VRM_OWNER_UID = V1;
process.env.EBAY_VERIF_TOKEN = JETON_VERIF;
process.env.EBAY_DELETION_URL = URL_DEL;

// ── LES CLÉS : celle d'eBay (servie par le faux eBay) et une imposture ──────
const EBAY = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const PIRATE = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const KID = 'kid-banc-0001';
const pemUneLigne = (k) => k.export({ type: 'spki', format: 'pem' }).replace(/\n/g, '');
const signer = (texte, cle = EBAY.privateKey, kid = KID) => Buffer.from(JSON.stringify({
  alg: 'ecdsa', kid, signature: crypto.sign('sha1', Buffer.from(texte, 'utf8'), cle).toString('base64'), digest: 'SHA1',
})).toString('base64');

// ── DONNÉES INVENTÉES ─────────────────────────────────────────────────────────
const PARTI = 'acheteur_parti';
const PII = ['acheteur_parti', 'Jeanne Inventée', '12 rue Imaginaire', 'jeanne@exemple.test', '0600000000', 'Laisser chez la voisine', 'Ville-Fictive', 'Mme Destinataire'];
const commande = (orderId, username, extra) => ({
  orderId, creationDate: '2026-10-20T10:00:00.000Z', lastModifiedDate: '2026-10-21T10:00:00.000Z',
  orderFulfillmentStatus: 'FULFILLED', orderPaymentStatus: 'PAID', sellerId: 'vendeur_un',
  buyer: { username, taxAddressDetails: { city: 'Ville-Fictive', postalCode: '99999', countryCode: 'FR' },
    buyerRegistrationAddress: { fullName: 'Jeanne Inventée', contactAddress: { addressLine1: '12 rue Imaginaire', city: 'Ville-Fictive', postalCode: '99999', countryCode: 'FR' }, primaryPhone: { phoneNumber: '0600000000' }, email: 'jeanne@exemple.test' } },
  buyerCheckoutNotes: 'Laisser chez la voisine',
  pricingSummary: { total: { value: '89.00', currency: 'EUR' }, priceSubtotal: { value: '80.00', currency: 'EUR' } },
  totalMarketplaceFee: { value: '11.00', currency: 'EUR' }, totalFeeBasisAmount: { value: '89.00', currency: 'EUR' },
  paymentSummary: { totalDueSeller: { value: '78.00', currency: 'EUR' }, payments: [{ paymentMethod: 'EBAY', paymentStatus: 'PAID', amount: { value: '89.00', currency: 'EUR' } }] },
  fulfillmentStartInstructions: [{ fulfillmentInstructionsType: 'SHIP_TO', minEstimatedDeliveryDate: '2026-10-23T00:00:00.000Z',
    shippingStep: { shippingCarrierCode: 'Colissimo', shipToReferenceId: 'REF-PERSO-1', shipTo: { fullName: 'Mme Destinataire', contactAddress: { addressLine1: '12 rue Imaginaire', city: 'Ville-Fictive', postalCode: '99999', countryCode: 'FR' }, primaryPhone: { phoneNumber: '0600000000' }, email: 'jeanne@exemple.test' } } }],
  lineItems: [{ lineItemId: '1000' + orderId.slice(-4), legacyItemId: '110000000001', sku: 'VRM-22', title: 'Adidas Gazelle bleu taille 40', quantity: 1, lineItemCost: { value: '80.00', currency: 'EUR' },
    giftDetails: { recipientEmail: 'jeanne@exemple.test', senderName: 'Jeanne Inventée', message: 'x' } }],
  ...(extra || {}),
});
const autre = (orderId) => { const o = commande(orderId, 'autre_acheteur'); o.buyer.buyerRegistrationAddress.fullName = 'Paul Autre'; o.fulfillmentStartInstructions[0].shippingStep.shipTo.fullName = 'Paul Autre'; return o; };
const EIAS_V2 = 'EIAS-VENDEUR-DEUX-00000002';
let cleV2 = '';
const CLE_PRO = 'abcdef0123456789';

let lignes = [];
const etatInitial = () => [
  { owner: V1, id: 'ebay_orders', data: { orders: [commande('01-00001-00001', PARTI), autre('01-00001-00002')], capturedAt: 1, rev: 3 } },
  { owner: V2, id: 'ebay_orders_' + CLE_PRO, data: { orders: [commande('02-00002-00001', 'Acheteur_Parti', { sellerId: 'vendeur_deux_pro' }), autre('02-00002-00002')], capturedAt: 1, rev: 7 } },
  { owner: V2, id: 'ebay_orders', data: { orders: [{ ...autre('02-00002-00003'), sellerId: 'vendeur_deux' }], capturedAt: 1 } },
  { owner: V3, id: 'ebay_orders', data: { orders: [autre('03-00003-00001')], capturedAt: 1, rev: 1 } },
  { owner: V2, id: 'ebay_comptes', data: { comptes: [{ cle: cleV2, pseudo: 'vendeur_deux', principal: true, ajouteLe: 1, vuLe: 1, deconnecteLe: null }, { cle: CLE_PRO, pseudo: 'vendeur_deux_pro', principal: false, ajouteLe: 1, vuLe: 1, deconnecteLe: null }], rev: 2 } },
  { owner: V2, id: 'ebay_tokens', data: { refresh_token: 'rt-v2-principal', saved_at: 1 } },
  { owner: V2, id: 'ebay_tokens_' + CLE_PRO, data: { refresh_token: 'rt-v2-pro', saved_at: 1 } },
  { owner: V1, id: 'ebay_comptes', data: { comptes: [{ cle: 'fedcba9876543210', pseudo: 'vendeur_un', principal: true, ajouteLe: 1 }] } },
  { owner: V1, id: 'ebay_tokens', data: { refresh_token: 'rt-v1', saved_at: 1 } },
];
const copie = (x) => JSON.parse(JSON.stringify(x));
const empreinte = () => JSON.stringify([...lignes].sort((a, b) => (a.owner + a.id).localeCompare(b.owner + b.id)));

// ── LA FAUSSE BASE (forme PostgREST) ─────────────────────────────────────────
let mode = {};
let MODE_BASE = {};
let ecritures = [], lecturesCle = 0, lecturesData = [];
let requetesBase = 0, lignesRendues = 0, lecturesRegistreEntier = 0, appelsRpc = 0;
// La même extraction que `public.vrm_ebay_ids` (migration 026).
const idsDe = (id, d) => {
  const out = new Set(); const pose = (v) => { if (typeof v === 'string') { const x = v.trim().toLowerCase(); if (x) out.add(x); } };
  const tab = (v) => Array.isArray(v) ? v : [];
  if (/^ebay_orders(_[0-9a-f]{16})?$/.test(id) && d) for (const o of tab(d.orders)) { if (!o || typeof o !== 'object' || Array.isArray(o)) continue; if (o.buyer && typeof o.buyer === 'object' && !Array.isArray(o.buyer)) pose(o.buyer.username); pose(o.sellerId); }
  if (id === 'ebay_comptes' && d) for (const e of tab(d.comptes)) { if (!e || typeof e !== 'object' || Array.isArray(e)) continue; pose(e.pseudo); pose(e.cle); }
  return out;
};
// Le texte d'un jsonb chez Postgres : « {"a": 1, "b": [1, 2]} ».
const pgTexte = (v) => Array.isArray(v) ? '[' + v.map(pgTexte).join(', ') + ']'
  : (v && typeof v === 'object') ? '{' + Object.entries(v).map(([k, x]) => JSON.stringify(k) + ': ' + pgTexte(x)).join(', ') + '}' : JSON.stringify(v);
const motif = (p, ci) => new RegExp('^' + p.split('').map((c) => (c === '*' || c === '%') ? '.*' : c === '_' ? '.' : c.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('') + '$', ci ? 'is' : 's');
const chemin = (r, src) => {
  if (src === 'id' || src === 'owner') return r[src];
  if (src === 'data') return r.data;
  const texte = /->>[^>]*$/.test(src);
  let v = r.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
  if (v != null && texte && typeof v !== 'string') v = typeof v === 'object' ? pgTexte(v) : String(v);
  return v == null ? null : v;
};
const unFiltre = (r, k, v) => {
  const m = /^(eq|like|ilike|is|in)\.(.*)$/s.exec(v); if (!m) throw new Error('filtre non servi : ' + k + '=' + v);
  const x = chemin(r, k);
  if (m[1] === 'eq') return x != null && String(x) === m[2];
  if (m[1] === 'is') return m[2] === 'null' ? x == null : false;
  if (m[1] === 'in') return x != null && m[2].replace(/^\(|\)$/g, '').split(',').map((y) => y.replace(/^"|"$/g, '')).includes(String(x));
  return x != null && motif(m[2].replace(/^"|"$/g, ''), m[1] === 'ilike').test(String(x));
};
const filtrer = (sp) => {
  let l = lignes;
  for (const [k, v] of sp.entries()) {
    if (['select', 'order', 'on_conflict', 'limit'].includes(k)) continue;
    if (k === 'or') {
      // `or=(chemin.op.valeur,…)` — sans virgule ni parenthèse dans les valeurs.
      const parts = v.replace(/^\(|\)$/g, '').split(',').map((p) => { const mm = /^([a-z_]+(?:(?:->>|->)[A-Za-z0-9_]+)*)\.(.+)$/s.exec(p); if (!mm) throw new Error('or non servi : ' + p); return mm; });
      l = l.filter((r) => parts.some((mm) => unFiltre(r, mm[1], mm[2])));
      continue;
    }
    l = l.filter((r) => unFiltre(r, k, v));
  }
  return l;
};
const projette = (r, sel) => {
  if (!sel) return r;
  const out = {};
  for (const part of sel.split(',')) { const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); const src = m[2]; out[m[1] || src.split(/->>|->/).pop()] = copie(chemin(r, src) === undefined ? null : chemin(r, src)); }
  return out;
};
const rep = (corps, status = 200, h) => new Response(corps == null ? null : JSON.stringify(corps), { status, headers: { 'content-type': 'application/json', ...(h || {}) } });

global.fetch = async (url, opts = {}) => {
  const u = new URL(String(url));
  const m = (opts.method || 'GET').toUpperCase();
  const h = opts.headers || {};
  if (u.hostname === 'api.ebay.com') {
    if (u.pathname === '/identity/v1/oauth2/token') {
      if (!/grant_type=client_credentials/.test(String(opts.body || ''))) return rep({ error: 'invalid_grant' }, 400);
      return rep({ access_token: 'jeton-application', expires_in: 7200, token_type: 'Application Access Token' });
    }
    const mk = /^\/commerce\/notification\/v1\/public_key\/([^/]+)$/.exec(u.pathname);
    if (mk && m === 'GET') {
      lecturesCle++;
      if (String(h.Authorization || '') !== 'Bearer jeton-application') return rep({ errors: [{ errorId: 1001 }] }, 401);
      if (mode.cleKo) return rep({ errors: [{ errorId: 195000 }] }, 500);
      if (decodeURIComponent(mk[1]) !== KID) return rep({ errors: [{ errorId: 195001, message: 'public key not found' }] }, 404);
      return rep({ algorithm: 'ECDSA', digest: 'SHA1', key: pemUneLigne(EBAY.publicKey) });
    }
    return rep({ errors: [{ message: 'non servi par le banc : ' + u.pathname }] }, 404);
  }
  if (u.pathname === '/rest/v1/rpc/vrm_ebay_cibles') {
    requetesBase++; appelsRpc++;
    if (!mode.rpc) return rep({ code: 'PGRST202', message: 'Could not find the function public.vrm_ebay_cibles(p_ids) in the schema cache' }, 404);
    if (mode.rpcKo || mode.listeKo) return rep({ message: 'panne' }, 503);
    if (String(h.Authorization || '') !== 'Bearer cle-service-de-banc' && String(h.apikey || '') !== 'cle-service-de-banc') return rep({ message: 'permission denied' }, 401);
    const ids = new Set((JSON.parse(opts.body || '{}').p_ids || []).map(String));
    const out = lignes.filter((r) => /^ebay/.test(r.id) && [...idsDe(r.id, r.data)].some((x) => ids.has(x))).map((r) => ({ owner: r.owner, id: r.id }))
      .sort((a, b) => (a.owner + a.id).localeCompare(b.owner + b.id));
    lignesRendues += out.length;
    return rep(out);
  }
  if (u.pathname === '/rest/v1/app_data') {
    const sp = u.searchParams;
    if (m === 'GET') {
      requetesBase++;
      if (sp.get('id') === 'eq.ebay_comptes' && !sp.get('owner') && !sp.get('or')) lecturesRegistreEntier++;
      // La sonde de cloisonnement (`session.js`) : la colonne owner existe.
      if (sp.get('select') === 'owner' && sp.get('limit') === '1') return rep([]);
      const sel = sp.get('select') || '';
      if (mode.listeKo && /owner,/.test(sel) && !sp.get('owner')) return rep({ message: 'panne' }, 503);
      let l;
      try { l = filtrer(sp); } catch (e) { return rep({ message: String(e.message) }, 400); }
      if (sel === 'data' && sp.get('id')) {
        lecturesData.push(sp.get('id').replace(/^eq\./, '') + '@' + String(sp.get('owner') || '').replace(/^eq\./, ''));
        if (mode.ligneKo) return rep({ message: 'panne' }, 503);
      }
      const ord = sp.get('order');
      if (ord) { const cles = ord.split(',').map((x) => x.split('.')[0]); l = [...l].sort((a, b) => { for (const c of cles) { const d = String(a[c]).localeCompare(String(b[c])); if (d) return d; } return 0; }); }
      const plage = /^(\d+)-(\d+)$/.exec(String(h.Range || h.range || ''));
      let out = l.map((r) => projette(r, sel));
      if (plage) {
        const a = +plage[1], b = +plage[2];
        if (a > 0 && a >= out.length) return rep({ message: 'range' }, 416, { 'content-range': '*/' + out.length });
        out = out.slice(a, b + 1);
      }
      if (!sp.get('owner')) lignesRendues += out.length;
      return rep(out);
    }
    if (m === 'PATCH') {
      if (mode.ecritureKo) return rep({ message: 'refus' }, 503);
      const l = filtrer(sp);
      const corps = JSON.parse(opts.body);
      for (const r of l) { r.data = corps.data; ecritures.push({ m, id: r.id, owner: r.owner }); }
      return rep(l.map((r) => ({ id: r.id })));
    }
    if (m === 'POST') {
      if (mode.ecritureKo) return rep({ message: 'refus' }, 503);
      const rows = JSON.parse(opts.body);
      const fusion = sp.get('on_conflict') === 'owner,id';
      for (const nv of rows) {
        const ex = lignes.find((r) => r.owner === nv.owner && r.id === nv.id);
        if (ex && !fusion) return rep({ message: 'duplicate key' }, 409);
        if (ex) ex.data = nv.data; else lignes.push({ owner: nv.owner, id: nv.id, data: nv.data });
        ecritures.push({ m, id: nv.id, owner: nv.owner });
      }
      return rep(null, 201);
    }
  }
  return rep({ message: 'non servi par le banc : ' + m + ' ' + u.pathname }, 404);
};

const faireRes = () => { const r = { code: null, corps: null, entetes: {} }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = (k, v) => { r.entetes[String(k).toLowerCase()] = v; }; r.end = () => r; return r; };
const notif = (data, id = 'notif-1') => ({ metadata: { topic: 'MARKETPLACE_ACCOUNT_DELETION', schemaVersion: '1.0', deprecated: false },
  notification: { notificationId: id, eventDate: '2026-11-02T10:00:00.000Z', publishDate: '2026-11-02T10:00:05.000Z', publishAttemptCount: 1, data } });
const DATA_PARTI = { username: PARTI, userId: 'imm-uid-parti', eiasToken: 'EIAS-ACHETEUR-PARTI-0001' };
const corpsParti0 = notif(DATA_PARTI);

(async () => {
  let handler, cleCompteDe, oublierClesEbay, oublierRpcEbay = () => {};
  await essaie('chargement', async () => {
    const mod = await import('file://' + path.join(RACINE, 'api', 'ebay.js'));
    handler = mod.default;
    ({ cleCompteDe } = await import('file://' + path.join(RACINE, 'api', '_lib', 'ebay.js')));
    try { const ms = await import('file://' + path.join(RACINE, 'api', '_lib', 'ebay-suppression.js')); oublierClesEbay = ms.oublierClesEbay || (() => {}); if (ms.oublierRpcEbay) oublierRpcEbay = ms.oublierRpcEbay; } catch (_) { oublierClesEbay = () => {}; }
  });
  if (!handler) { console.log('\n❌ audit-ebay-suppression : la route n\'a pas pu être chargée'); process.exit(1); }
  cleV2 = cleCompteDe(EIAS_V2);
  const remettre = (m) => { lignes = etatInitial(); mode = { ...MODE_BASE, ...(m || {}) }; ecritures = []; lecturesCle = 0; lecturesData = []; requetesBase = 0; lignesRendues = 0; lecturesRegistreEntier = 0; appelsRpc = 0; oublierClesEbay(); oublierRpcEbay(); };
  // Appelle la route comme Vercel : `req.body` déjà analysé (corps JSON), ou
  // `texte` : le corps brut tel qu'envoyé.
  const poster = async ({ corps, entete, texte, sansEntete }) => {
    const res = faireRes();
    const headers = { 'content-type': 'application/json' };
    if (!sansEntete) headers['x-ebay-signature'] = entete;
    await handler({ method: 'POST', query: { mode: 'deletion' }, headers, body: texte != null ? texte : corps }, res);
    return res;
  };
  const tout = () => JSON.stringify(lignes);
  const ordre = (owner, id, orderId) => (lignes.find((r) => r.owner === owner && r.id === id).data.orders || []).find((o) => o.orderId === orderId);

  // ── 1. LE DÉFI GET ────────────────────────────────────────────────────────
  await essaie('défi', async () => {
    const res = faireRes();
    await handler({ method: 'GET', query: { mode: 'deletion', challenge_code: 'a8628072-3d33-45ee-9004-bee86830a22d' }, headers: { host: 'ailleurs.example' } }, res);
    const attendu = crypto.createHash('sha256').update('a8628072-3d33-45ee-9004-bee86830a22d' + JETON_VERIF + URL_DEL).digest('hex');
    dit(res.code === 200 && res.corps && res.corps.challengeResponse === attendu && Object.keys(res.corps).length === 1,
      'défi GET : {challengeResponse: sha256(challengeCode + jeton + adresse déclarée)} en hexadécimal, rien d\'autre', `HTTP ${res.code}`);
  });

  // 2 à 6 se jouent DEUX fois : sans la migration 026 (fonction absente, 404),
  // puis avec (`vrm_ebay_cibles` servie). Le résultat doit être le même.
  for (const passe of [{}, { rpc: true }]) {
    MODE_BASE = passe;
    console.log(passe.rpc ? '\n── avec la migration 026 (vrm_ebay_cibles)' : '\n── sans la migration 026');
    // ── 2. SIGNATURE ABSENTE / FAUSSE ⇒ 412, RIEN TOUCHÉ ─────────────────────
    const corpsParti = notif(DATA_PARTI);
    const texteParti = JSON.stringify(corpsParti);
    for (const [nom, req] of [
      ['signature absente', { corps: corpsParti, sansEntete: true }],
      ['en-tête illisible', { corps: corpsParti, entete: 'pas-du-base64-json' }],
      ['signée par une autre clé', { corps: corpsParti, entete: signer(texteParti, PIRATE.privateKey) }],
      ['signature d\'un AUTRE corps (pseudo changé)', { corps: corpsParti, entete: signer(JSON.stringify(notif({ ...DATA_PARTI, username: 'autre_acheteur' }))) }],
      ['kid inconnu d\'eBay', { corps: corpsParti, entete: signer(texteParti, EBAY.privateKey, 'kid-forge-999') }],
    ]) {
      await essaie(nom, async () => {
        remettre(); const avant = empreinte();
        const res = await poster(req);
        dit(res.code === 412 && empreinte() === avant && ecritures.length === 0 && lecturesData.length === 0,
          `${nom} ⇒ 412, aucune ligne lue ni écrite`, `HTTP ${res.code} · ${ecritures.length} écriture(s)`);
      });
    }

    // ── 3. CLÉ PUBLIQUE ILLISIBLE ⇒ 5xx (eBay rejoue), RIEN ÉCRIT ────────────
    await essaie('clé illisible', async () => {
      remettre({ cleKo: true }); const avant = empreinte();
      const res = await poster({ corps: corpsParti, entete: signer(texteParti) });
      dit(res.code >= 500 && empreinte() === avant && ecritures.length === 0, 'eBay ne rend pas la clé publique ⇒ 5xx, rien d\'effacé', `HTTP ${res.code}`);
    });

    // ── 4. SIGNATURE BONNE ⇒ ANONYMISÉ CHEZ DEUX VENDEURS, MONTANTS GARDÉS ──
    await essaie('signature bonne', async () => {
      remettre();
      const avant = copie(lignes);
      const res = await poster({ corps: corpsParti, entete: signer(texteParti) });
      dit(res.code >= 200 && res.code < 300, 'signature bonne ⇒ acquittée (2xx)', `HTTP ${res.code}`);
      const restes = PII.filter((s) => tout().toLowerCase().includes(s.toLowerCase()));
      // Les autres acheteurs gardent leur nom (le même faux nom de rue est partagé
      // par construction : on ne cherche que dans les commandes de l'acheteur parti).
      const c1 = ordre(V1, 'ebay_orders', '01-00001-00001'), c2 = ordre(V2, 'ebay_orders_' + CLE_PRO, '02-00002-00001');
      const restesCmd = PII.filter((s) => JSON.stringify([c1, c2]).toLowerCase().includes(s.toLowerCase()));
      dit(restesCmd.length === 0, 'chez les DEUX vendeurs, ses commandes ne portent plus ni pseudo, ni nom, ni adresse, ni e-mail, ni téléphone, ni notes', restesCmd.join(' · ') || 'rien ne reste');
      dit(!tout().toLowerCase().includes(PARTI), 'son pseudo n\'est plus nulle part dans la base (casse comprise)', restes.includes(PARTI) ? 'encore présent' : '');
      const garde = (a, b) => ['orderId', 'creationDate', 'lastModifiedDate', 'orderPaymentStatus', 'orderFulfillmentStatus', 'pricingSummary', 'totalMarketplaceFee', 'totalFeeBasisAmount', 'paymentSummary']
        .every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k])) && a.lineItems.length === b.lineItems.length && a.lineItems.every((li, i) => li.title === b.lineItems[i].title && li.sku === b.lineItems[i].sku && JSON.stringify(li.lineItemCost) === JSON.stringify(b.lineItems[i].lineItemCost));
      const a1 = avant.find((r) => r.owner === V1 && r.id === 'ebay_orders').data.orders[0], a2 = avant.find((r) => r.owner === V2 && r.id === 'ebay_orders_' + CLE_PRO).data.orders[0];
      dit(!!c1 && !!c2 && garde(c1, a1) && garde(c2, a2), 'montants, dates, n° de commande, statuts et articles GARDÉS (la compta en a besoin)');
      dit(!!c1 && c1.buyer && c1.buyer.username === 'compte eBay supprimé', 'l\'acheteur porte la marque neutre « compte eBay supprimé »', c1 && JSON.stringify(c1.buyer));
      const autres = [[V1, 'ebay_orders', '01-00001-00002'], [V2, 'ebay_orders_' + CLE_PRO, '02-00002-00002'], [V3, 'ebay_orders', '03-00003-00001']]
        .every(([o, id, oid]) => JSON.stringify(ordre(o, id, oid)) === JSON.stringify(avant.find((r) => r.owner === o && r.id === id).data.orders.find((x) => x.orderId === oid)));
      dit(autres, 'les commandes des AUTRES acheteurs (et le vendeur où il n\'est pas) ne bougent pas');
      const v3 = lignes.find((r) => r.owner === V3 && r.id === 'ebay_orders');
      dit(!ecritures.some((w) => w.owner === V3) && !lecturesData.some((x) => x.endsWith(V3)), 'un vendeur chez qui il n\'apparaît pas n\'est ni lu en entier ni réécrit', lecturesData.join(' '));
      const r1 = lignes.find((r) => r.owner === V1 && r.id === 'ebay_orders').data.rev, r2 = lignes.find((r) => r.owner === V2 && r.id === 'ebay_orders_' + CLE_PRO).data.rev;
      dit(r1 === 4 && r2 === 8 && v3.data.rev === 1, 'écriture en comparer-et-échanger (version montée d\'un cran)', `rev ${r1}/${r2}`);
      const tokens = lignes.filter((r) => /^ebay_tokens/.test(r.id)).every((r) => /^rt-/.test(r.data.refresh_token));
      dit(tokens, 'un ACHETEUR supprimé ne déconnecte aucun vendeur');
      // Rejouée (eBay renvoie tant qu'il n'a pas eu son 2xx) : rien ne bouge.
      const n0 = ecritures.length, e0 = empreinte(), cles0 = lecturesCle;
      const res2 = await poster({ corps: corpsParti, entete: signer(texteParti) });
      dit(res2.code >= 200 && res2.code < 300 && ecritures.length === n0 && empreinte() === e0, 'rejouée : acquittée, rien n\'est réécrit', `HTTP ${res2.code} · ${ecritures.length - n0} écriture(s)`);
      dit(lecturesCle === cles0, 'la clé publique est gardée en cache (pas relue chez eBay à chaque notification)', `${lecturesCle - cles0} lecture(s)`);
    });

    // ── 4 bis. LE CORPS BRUT (texte, mis en forme) se vérifie aussi ──────────
    await essaie('corps brut', async () => {
      remettre();
      const brut = JSON.stringify(corpsParti, null, 2);
      const res = await poster({ texte: brut, entete: signer(brut) });
      dit(res.code >= 200 && res.code < 300 && !tout().toLowerCase().includes(PARTI), 'corps reçu brut (texte) signé ⇒ vérifié et anonymisé', `HTTP ${res.code}`);
      remettre(); const avant = empreinte();
      const res2 = await poster({ texte: brut.replace('acheteur_parti', 'autre_acheteur'), entete: signer(brut) });
      dit(res2.code === 412 && empreinte() === avant, 'corps brut modifié après signature ⇒ 412, rien touché', `HTTP ${res2.code}`);
    });

    // ── 5. LA BASE QUI NE RÉPOND PAS ⇒ 5xx, RIEN ÉCRIT ───────────────────────
    for (const [nom, m] of [['liste des lignes illisible', { listeKo: true }], ['ligne illisible (lecture KO, écriture OK)', { ligneKo: true }], ['écriture refusée', { ecritureKo: true }]]) {
      await essaie(nom, async () => {
        remettre(m); const avant = empreinte();
        const res = await poster({ corps: corpsParti, entete: signer(texteParti) });
        dit(res.code >= 500 && empreinte() === avant, `${nom} ⇒ 5xx (eBay rejouera), rien d'écrit`, `HTTP ${res.code} · ${ecritures.length} écriture(s)`);
      });
    }
    await essaie('sans clé de service', async () => {
      remettre(); const avant = empreinte();
      const k = process.env.SUPABASE_SERVICE_KEY; delete process.env.SUPABASE_SERVICE_KEY;
      const res = await poster({ corps: corpsParti, entete: signer(texteParti) });
      process.env.SUPABASE_SERVICE_KEY = k;
      dit(res.code >= 500 && empreinte() === avant, 'sans clé de service (pas de vue sur tous les vendeurs) ⇒ 5xx, jamais « rien trouvé »', `HTTP ${res.code}`);
    });

    // ── 6. UN VENDEUR RELIÉ FERME SON COMPTE eBAY ─────────────────────────────
    await essaie('vendeur supprimé', async () => {
      remettre();
      const avant = copie(lignes);
      const corps = notif({ username: 'vendeur_deux', userId: 'imm-uid-v2', eiasToken: EIAS_V2 }, 'notif-v2');
      const res = await poster({ corps, entete: signer(JSON.stringify(corps)) });
      dit(res.code >= 200 && res.code < 300, 'vendeur relié supprimé ⇒ acquitté', `HTTP ${res.code}`);
      const reg = lignes.find((r) => r.owner === V2 && r.id === 'ebay_comptes').data.comptes;
      const p = reg.find((e) => e.principal), pro = reg.find((e) => e.cle === CLE_PRO);
      dit(!!p && Number(p.deconnecteLe) > 0 && p.pseudo === 'compte eBay supprimé', 'son compte eBay est marqué DÉCONNECTÉ et son pseudo remplacé', JSON.stringify(p));
      dit(lignes.find((r) => r.owner === V2 && r.id === 'ebay_tokens').data.refresh_token === '', 'le jeton de ce compte est vidé (comme « Déconnecter »)');
      dit(!!pro && !pro.deconnecteLe && pro.pseudo === 'vendeur_deux_pro' && lignes.find((r) => r.owner === V2 && r.id === 'ebay_tokens_' + CLE_PRO).data.refresh_token === 'rt-v2-pro', 'son AUTRE compte eBay reste relié');
      dit(lignes.find((r) => r.owner === V1 && r.id === 'ebay_tokens').data.refresh_token === 'rt-v1', 'les autres vendeurs ne bougent pas');
      const cmd = ordre(V2, 'ebay_orders', '02-00002-00003'), a = avant.find((r) => r.owner === V2 && r.id === 'ebay_orders').data.orders[0];
      dit(cmd && cmd.sellerId === 'compte eBay supprimé' && JSON.stringify(cmd.buyer) === JSON.stringify(a.buyer) && JSON.stringify(cmd.pricingSummary) === JSON.stringify(a.pricingSummary),
        'dans ses ventes, seul son pseudo de vendeur change (acheteurs et montants intacts)');
      dit(!tout().includes('"vendeur_deux"'), 'son pseudo n\'est plus nulle part');
    });
  }
  MODE_BASE = {};

  // ── 7. LA CHARGE : 200 VENDEURS eBAY, 200 NOTIFICATIONS D'INCONNUS ───────
  const ajouterVendeurs = (n) => {
    for (let i = 0; i < n; i++) {
      const o = '4' + String(i).padStart(7, '0') + '-4444-4444-8444-444444444444';
      const cle = crypto.createHash('sha256').update('banc-' + i).digest('hex').slice(0, 16);
      lignes.push({ owner: o, id: 'ebay_comptes', data: { comptes: [{ cle, pseudo: 'vendeur_banc_' + i, principal: true, ajouteLe: 1 }] } });
      lignes.push({ owner: o, id: 'ebay_orders', data: { orders: [autre('9' + String(i).padStart(2, '0') + '-00000-0000' + (i % 10))], capturedAt: 1 } });
      lignes.push({ owner: o, id: 'ebay_tokens', data: { refresh_token: 'rt-banc-' + i, saved_at: 1 } });
    }
  };
  for (const passe of [{}, { rpc: true }]) {
    const nom = passe.rpc ? 'avec 026' : 'sans 026';
    await essaie('charge ' + nom, async () => {
      remettre(passe); ajouterVendeurs(200);
      const avant = empreinte();
      let codes = new Set(), maxReq = 0, maxLignes = 0; const req0 = requetesBase;
      for (let k = 0; k < 200; k++) {
        const r0 = requetesBase, l0 = lignesRendues;
        const corps = notif({ username: 'inconnu_' + k, userId: 'imm-' + k, eiasToken: 'EIAS-INCONNU-' + String(k).padStart(6, '0') }, 'notif-c' + k);
        const res = await poster({ corps, entete: signer(JSON.stringify(corps)) });
        codes.add(res.code);
        maxReq = Math.max(maxReq, requetesBase - r0); maxLignes = Math.max(maxLignes, lignesRendues - l0);
      }
      const totalReq = requetesBase - req0;
      dit(codes.size === 1 && codes.has(200), `${nom} : 200 notifications d'inconnus, 200 vendeurs eBay en base ⇒ toutes acquittées (200)`, [...codes].join(','));
      dit(maxLignes === 0, `${nom} : chaque notification d'un inconnu ne rend AUCUNE ligne (avant : le registre des 200 vendeurs, à chaque fois)`, `au plus ${maxLignes} ligne(s) par notification`);
      dit(lecturesRegistreEntier === 0, `${nom} : le registre eBay de TOUS les vendeurs n'est jamais lu en entier`, `${lecturesRegistreEntier} lecture(s) entière(s)`);
      // Sans 026, la fonction absente est sondée UNE fois (puis retenue 10 min).
      const plafond = passe.rpc ? 200 : 2 * 200 + 1;
      dit(totalReq <= plafond && maxReq <= (passe.rpc ? 1 : 3), `${nom} : ${passe.rpc ? '1 lecture' : '2 lectures'} de la base par notification (${passe.rpc ? '' : '+ une sonde de la fonction, '}quel que soit le nombre de vendeurs)`, `${totalReq} pour 200 notifications, au plus ${maxReq} pour une`);
      if (passe.rpc) dit(appelsRpc === 200, `${nom} : la fonction indexée est bien celle qui répond`, `${appelsRpc} appel(s)`);
      dit(empreinte() === avant && ecritures.length === 0, `${nom} : rien n'est écrit`, `${ecritures.length} écriture(s)`);
      // Et le vendeur n° 137 (parmi 200) qui ferme son compte : retrouvé.
      const cle137 = crypto.createHash('sha256').update('banc-137').digest('hex').slice(0, 16);
      const o137 = '4' + String(137).padStart(7, '0') + '-4444-4444-8444-444444444444';
      const reg = lignes.find((r) => r.owner === o137 && r.id === 'ebay_comptes');
      reg.data.comptes[0].pseudo = 'Vendeur_Banc_137';   // casse différente de la notification
      const corps = notif({ username: 'vendeur_banc_137', userId: 'imm-137', eiasToken: 'autre-eias-inconnu' }, 'notif-137');
      const res = await poster({ corps, entete: signer(JSON.stringify(corps)) });
      const apres = lignes.find((r) => r.owner === o137 && r.id === 'ebay_comptes').data.comptes[0];
      dit(res.code === 200 && apres.pseudo === 'compte eBay supprimé' && Number(apres.deconnecteLe) > 0 && lignes.find((r) => r.owner === o137 && r.id === 'ebay_tokens').data.refresh_token === '',
        `${nom} : le vendeur 137 sur 200, reconnu par son pseudo (casse différente), est déconnecté — et lui seul`, `HTTP ${res.code} · ${JSON.stringify(apres).slice(0, 90)}`);
      const autres = lignes.filter((r) => r.id === 'ebay_tokens' && /^4/.test(r.owner) && r.owner !== o137).every((r) => /^rt-banc-/.test(r.data.refresh_token));
      dit(autres, `${nom} : les 199 autres vendeurs ne bougent pas`);
      // Reconnu par sa clé seule (pseudo changé chez eBay depuis).
      remettre(passe); ajouterVendeurs(200);
      const o42 = '4' + String(42).padStart(7, '0') + '-4444-4444-8444-444444444444';
      const cle42 = crypto.createHash('sha256').update('banc-42').digest('hex').slice(0, 16);
      // La clé d'un compte est dérivée de son EIASToken : on pose la clé que la
      // route calculera pour cet EIASToken.
      const eias42 = 'EIAS-VENDEUR-42-NOUVEAU-PSEUDO';
      lignes.find((r) => r.owner === o42 && r.id === 'ebay_comptes').data.comptes[0].cle = cleCompteDe(eias42);
      void cle42;
      const c42 = notif({ username: 'pseudo_tout_neuf_42', userId: 'imm-42', eiasToken: eias42 }, 'notif-42');
      const r42 = await poster({ corps: c42, entete: signer(JSON.stringify(c42)) });
      const e42 = lignes.find((r) => r.owner === o42 && r.id === 'ebay_comptes').data.comptes[0];
      dit(r42.code === 200 && Number(e42.deconnecteLe) > 0 && lignes.find((r) => r.owner === o42 && r.id === 'ebay_tokens').data.refresh_token === '',
        `${nom} : un vendeur reconnu par sa CLÉ seule (pseudo changé chez eBay) est déconnecté`, `HTTP ${r42.code}`);
      void cle137;
    });
  }

  // ── 8. LA FONCTION QUI NE RÉPOND PAS ⇒ 5xx, RIEN ÉCRIT ───────────────────
  await essaie('rpc en panne', async () => {
    remettre({ rpc: true, rpcKo: true }); const avant = empreinte();
    const res = await poster({ corps: corpsParti0, entete: signer(JSON.stringify(corpsParti0)) });
    dit(res.code >= 500 && empreinte() === avant && ecritures.length === 0, 'avec 026 : la fonction ne répond pas ⇒ 5xx (eBay rejouera), rien d\'écrit — jamais « personne »', `HTTP ${res.code}`);
  });

  console.log(`\n${ok} contrôle(s) conforme(s), ${ko} non conforme(s).`);
  console.log(ko ? '❌ audit-ebay-suppression : NON CONFORME' : '✅ audit-ebay-suppression : signature vérifiée, données anonymisées chez tous les vendeurs, rien sans preuve.');
  process.exit(ko ? 1 : 0);
})();
