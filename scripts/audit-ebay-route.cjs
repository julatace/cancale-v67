// ════════════════════════════════════════════════════════════════════════════
//  LA ROUTE eBAY, EXÉCUTÉE : qui pilote QUEL compte eBay, et ce qui part chez
//  eBay quand on publie, vérifie, programme, annule ou déplace.
//        node scripts/audit-ebay-route.cjs [--src dossier]
//
//  Mesuré le 5 octobre : `/api/ebay` n'exigeait AUCUNE session, et le compte
//  eBay de Julien est connecté en production (une ligne `ebay_tokens` avec son
//  jeton de renouvellement). N'importe qui sur Internet pouvait donc lister ses
//  commandes, publier sur SON compte, ou remplacer sa connexion par la sienne.
//
//  ── CHAQUE VENDEUR SON eBAY (5 octobre, suite) ─────────────────────────────
//  Julien : « tout doit être adaptable en fonction de la personne en face ».
//  `ebay_tokens` et les lignes `ebay_*` étaient celles de L'INSTALLATION : la
//  route refusait tout autre vendeur (403), et le jour où elle l'aurait laissé
//  passer, il aurait lu les jetons de Julien. On exige maintenant, sur une base
//  cloisonnée :
//    · un vendeur B connecté relie SON eBay (le `state` signé PORTE son
//      identifiant, ses jetons sont rangés `owner = B`) ;
//    · B ne lit jamais les jetons ni les lignes de Julien : toutes ses lectures
//      sont filtrées `owner=eq.B`, et ses appels à eBay partent avec SON jeton ;
//    · un `state` falsifié (le vendeur remplacé, la signature d'un autre) est
//      refusé : aucun échange, aucun jeton rangé ;
//    · la ligne d'avant de Julien (owner = VRM_OWNER_UID) marche sans rien
//      refaire ;
//    · un abonnement coupé ⇒ 402, zéro appel eBay ;
//    · base PAS ENCORE cloisonnée ⇒ exactement comme avant (un seul jeu de
//      données, seul le propriétaire de l'installation) — rejoué dans un
//      second processus, la sonde de schéma étant mémorisée par instance.
//
//  ── LES FRAIS ET LES ERREURS (corrigés le 5 octobre) ───────────────────────
//    · les frais sont lus PAR NOM : `ListingFee` EST le total (guide Trading
//      « Fees ») — l'ancien `totalFrais` additionnait tout et doublait ;
//      absent ⇒ null (« pas su »), jamais 0 ;
//    · toutes les <Errors> sont gardées : un Warning puis une Error ⇒ c'est
//      l'Error qui est rendue.
//
//  ── LE PLANIFICATEUR (programmer · programmees · deprogrammer ·
//     reprogrammer · limites) ────────────────────────────────────────────────
//    · ce qui engage exige `confirme:true` ET une heure, un N°, un état, un
//      UUID, des frais vus valides — refusés AVANT tout appel à eBay ;
//    · ordre : relecture des annonces → vérification à blanc (SANS UUID) →
//      ajout (AVEC UUID) ; même <Item> hors <UUID> ; <ScheduleTime> UTC DANS
//      <Item> ;
//    · une paire déjà programmée / déjà en ligne (SKU) ⇒ 409, rien d'envoyé ;
//      liste illisible ⇒ 503 ;
//    · frais plus chers que vus ⇒ 409 ; frais inconnus ⇒ refus ;
//    · coupure ⇒ « incertain » ; un second envoi avec le MÊME UUID ne crée pas
//      une seconde annonce ; 488 confirmé par GetItem (même SKU) seulement ;
//    · eBay qui ignore l'heure ⇒ `enLigneMaintenant` ;
//    · GetMyeBaySelling découpé par conteneur, paginé ;
//    · annuler : la réponse d'eBay remonte telle quelle ; déplacer : refusé
//      dans la dernière heure ;
//    · limites : des nombres lus, jamais un 0 inventé.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const cp = require('child_process');
const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');
const NON_CLOISONNEE = process.argv.includes('--non-cloisonnee');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'le contrôle a levé : ' + String(e && e.message || e).slice(0, 160)); } };

const J = '11111111-1111-1111-1111-111111111111';   // Julien, propriétaire de l'installation
const B = '22222222-2222-2222-2222-222222222222';   // un autre vendeur
const C = '33333333-3333-3333-3333-333333333333';   // un vendeur dont l'abonnement est coupé
// Un JWT a trois morceaux : le contrôle de forme du serveur l'exige.
const JWT_J = 'eyJh.jeton-de-J.sig', JWT_B = 'eyJh.jeton-de-B.sig', JWT_C = 'eyJh.jeton-de-C.sig';

process.env.VRM_OWNER_UID = J;
process.env.EBAY_APP_ID = 'app-de-banc';
process.env.EBAY_CERT_ID = 'secret-de-banc';
process.env.EBAY_RUNAME = 'runame-de-banc';
process.env.SUPABASE_SERVICE_KEY = 'cle-service-de-banc';

const MIN = 60 * 1000, H = 60 * MIN, JOUR = 24 * H;
const iso = (t) => new Date(Math.round(t / MIN) * MIN).toISOString();

// ── LA FAUSSE BASE : des lignes (owner, id), et elle sait filtrer ────────────
// ⚠️ §6.3 : l'ancienne fausse base rendait `ebay_tokens` à QUICONQUE le
// demandait, filtre ou pas — elle ne pouvait pas voir un vendeur lire les
// jetons d'un autre. Celle-ci honore `owner=eq.` et la projection `select=`.
let lignes = [];
const remettreBase = () => { lignes = [{ owner: J, id: 'ebay_tokens', data: { refresh_token: 'rt-de-J', saved_at: 1 } }]; };
remettreBase();
const projette = (r, sel) => {
  if (!sel) return r;
  const out = {};
  for (const part of decodeURIComponent(sel).split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id' || src === 'owner') { out[alias] = r[src]; continue; }
    if (src === 'data') { out[alias] = r.data; continue; }
    let v = r.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : v;
  }
  return out;
};

// ── LE FAUX eBAY : un compte par jeton (Julien et B n'ont pas le même eBay) ──
// Données INVENTÉES (le dépôt est public).
const annonce = (itemId, title, sku, prix, debut, extra) => ({ itemId, title, sku, prix, debut, ...(extra || {}) });
const ANNONCES_J = () => [
  annonce('110000000001', 'Adidas Gazelle bleu taille 40', 'VRM-22', '80.0', '2026-09-20T10:00:00.000Z', { watch: 3 }),
  annonce('110000000002', 'Nike Dunk Low panda taille 42', '', '100.0', '2026-09-21T10:00:00.000Z', { variantes: '<Variations><Variation><SKU>VAR-42</SKU></Variation></Variations>' }),
];
let ebay = {};
const remettreEbay = () => { ebay = { 'at-J': { actives: ANNONCES_J(), programmees: [], pagesProg: 1 }, 'at-B': { actives: [], programmees: [], pagesProg: 1 } }; };
remettreEbay();
let prochainId = 110000000777;
const itemFake = (a) => `<Item><ItemID>${a.itemId}</ItemID><Title>${a.title}</Title>${a.sku ? `<SKU>${a.sku}</SKU>` : ''}${a.watch != null ? `<WatchCount>${a.watch}</WatchCount>` : ''}<QuantityAvailable>1</QuantityAvailable>${a.variantes || ''}<SellingStatus><CurrentPrice currencyID="EUR">${a.prix}</CurrentPrice><QuantitySold>0</QuantitySold></SellingStatus><ListingDetails><StartTime>${a.debut}</StartTime>${a.fin ? `<EndTime>${a.fin}</EndTime>` : ''}<ViewItemURL>https://www.ebay.fr/itm/${a.itemId}</ViewItemURL></ListingDetails></Item>`;
function repListe(compte, corps) {
  const veutA = /<ActiveList>/.test(corps), veutS = /<ScheduledList>/.test(corps);
  const pageS = Number((/<ScheduledList>[\s\S]*?<PageNumber>(\d+)<\/PageNumber>/.exec(corps) || [])[1] || 1);
  let x = '<?xml version="1.0" encoding="UTF-8"?><GetMyeBaySellingResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack>';
  // eBay n'émet pas un conteneur vide (forme supposée, et servie ainsi exprès :
  // la route doit le lire « vide », jamais « pas su »).
  if (veutA && compte.actives.length) x += `<ActiveList><ItemArray>${compte.actives.map(itemFake).join('')}</ItemArray><PaginationResult><TotalNumberOfPages>1</TotalNumberOfPages></PaginationResult></ActiveList>`;
  if (veutS && compte.programmees.length) {
    const n = compte.pagesProg, par = Math.ceil(compte.programmees.length / n);
    const page = compte.programmees.slice((pageS - 1) * par, pageS * par);
    x += `<ScheduledList><ItemArray>${page.map(itemFake).join('')}</ItemArray><PaginationResult><TotalNumberOfPages>${n}</TotalNumberOfPages></PaginationResult></ScheduledList>`;
  }
  return x + '</GetMyeBaySellingResponse>';
}
const XML_OK = (inner) => `<?xml version="1.0"?><R xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack>${inner || ''}</R>`;
const XML_ECHEC = (errs) => `<?xml version="1.0"?><R xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Failure</Ack>${errs}</R>`;
const ERR = (code, sev, msg, params) => `<Errors><ShortMessage>x</ShortMessage><LongMessage>${msg}</LongMessage><ErrorCode>${code}</ErrorCode><SeverityCode>${sev}</SeverityCode>${(params || []).map((p, i) => `<ErrorParameters ParamID="${i}"><Value>${p}</Value></ErrorParameters>`).join('')}</Errors>`;
const XML_REFUS = XML_ECHEC(ERR('1047', 'Error', 'Cette annonce est déjà terminée. v^1.1#SECRET-QUI-FUIRAIT'));
const fee = (n, v) => `<Fee><Name>${n}</Name><Fee currencyID="EUR">${v}</Fee></Fee>`;
const ELIGIBLE = '110000000002';
let mode = {};
const uuidsVus = new Map();       // UUID déjà utilisé → ItemID (comme eBay : 488)
const remettre = () => { mode = { liste: 'ok', commandes: 'ok', eligibles: 'ok', envoi: 'ok', trading: 'ok', verif: 'ok', add: 'ok', end: 'ok', revise: 'ok', priv: 'ok', getitem: 'ok', mainKo: false, journalKo: false, listingsKo: false }; remettreEbay(); uuidsVus.clear(); };
remettre();

const journal = [];       // ce qui part chez eBay, ce qui s'écrit en base, avec quel jeton
const rep = (corps, status = 200) => new Response(status === 204 ? null : (typeof corps === 'string' ? corps : JSON.stringify(corps)), { status, headers: { 'content-type': 'application/json' } });
const xml = (s) => new Response(s, { status: 200, headers: { 'content-type': 'text/xml' } });
const balise = (s, t) => (new RegExp('<' + t + '>([\\s\\S]*?)</' + t + '>').exec(s || '') || [])[1] || '';
global.fetch = async (url, opts = {}) => {
  const u = String(url);
  const m = (opts.method || 'GET').toUpperCase();
  const h = opts.headers || {};
  if (u.includes('/auth/v1/user')) {
    const a = String((h.Authorization || h.authorization) || '');
    if (a === 'Bearer ' + JWT_J) return rep({ id: J, email: 'j@exemple.test' });
    if (a === 'Bearer ' + JWT_B) return rep({ id: B, email: 'b@exemple.test' });
    if (a === 'Bearer ' + JWT_C) return rep({ id: C, email: 'c@exemple.test' });
    return rep({ msg: 'invalid' }, 401);
  }
  if (u.includes('ebay.com')) {
    const appel = h['X-EBAY-API-CALL-NAME'] || '';
    const jeton = h['X-EBAY-API-IAF-TOKEN'] || String(h.Authorization || '').replace(/^Bearer\s+/, '') || '';
    const corps = String(opts.body || '');
    journal.push({ ou: 'ebay', m, u: u.replace(/\?.*$/, ''), appel, corps, jeton, marche: h['X-EBAY-C-MARKETPLACE-ID'] || '' });
    if (u.includes('/identity/v1/oauth2/token')) {
      // Le jeton d'accès dépend du refresh_token : c'est ce qui montre QUEL
      // compte eBay sert chaque appel.
      const rt = decodeURIComponent((/refresh_token=([^&]*)/.exec(corps) || [])[1] || '');
      const code = decodeURIComponent((/code=([^&]*)/.exec(corps) || [])[1] || '');
      if (/grant_type=authorization_code/.test(corps)) return rep({ access_token: 'at-neuf', expires_in: 7200, refresh_token: code === 'code-de-B' ? 'rt-de-B' : 'rt-neuf-de-J', refresh_token_expires_in: 47304000 });
      if (rt === 'rt-de-J' || rt === 'rt-neuf-de-J') return rep({ access_token: 'at-J', expires_in: 7200 });
      if (rt === 'rt-de-B') return rep({ access_token: 'at-B', expires_in: 7200 });
      return rep({ error: 'invalid_grant' }, 400);
    }
    if (u.includes('/ws/api.dll')) {
      const compte = ebay[jeton] || { actives: [], programmees: [], pagesProg: 1 };
      if (appel === 'GetMyeBaySelling') {
        if (mode.liste === 'ko') return xml(XML_REFUS);
        if (mode.liste === 'reseau') throw new Error('ECONNRESET');
        return xml(repListe(compte, corps));
      }
      if (appel === 'GetItem') {
        const id = balise(corps, 'ItemID');
        if (mode.getitem === 'autre') return xml(XML_OK(`<Item><ItemID>${id}</ItemID><SKU>VRM-999</SKU><ListingDetails><StartTime>2026-11-01T10:00:00.000Z</StartTime></ListingDetails></Item>`));
        const a = [...compte.actives, ...compte.programmees].find((x) => x.itemId === id);
        return xml(XML_OK(a ? `<Item><ItemID>${a.itemId}</ItemID>${a.sku ? `<SKU>${a.sku}</SKU>` : ''}<Description>x</Description><ListingDetails><StartTime>${a.debut}</StartTime>${a.fin ? `<EndTime>${a.fin}</EndTime>` : ''}</ListingDetails></Item>` : '<Item><Description>x</Description></Item>'));
      }
      if (appel === 'VerifyAddFixedPriceItem') {
        if (mode.verif === 'refus') return xml(XML_ECHEC(ERR('21916672', 'Error', 'La photo est trop petite.')));
        const prog = /<ScheduleTime>/.test(corps);
        const sched = prog ? '0.2' : '0.0';
        if (mode.verif === 'sansTotal') return xml(XML_OK(`<Fees>${fee('InsertionFee', '0.0')}${fee('SchedulingFee', sched)}</Fees>`));
        const tot = mode.verif === 'cher' ? '0.55' : (prog ? '0.2' : '0.0');
        const ins = mode.verif === 'cher' ? '0.35' : '0.0';
        return xml(XML_OK(`<Fees>${fee('BoldFee', '0.0')}${fee('InsertionFee', ins)}${fee('ListingFee', tot)}${fee('SchedulingFee', sched)}${fee('SubtitleFee', '0.0')}</Fees>`));
      }
      if (appel === 'AddFixedPriceItem') {
        if (mode.trading === 'reseau') throw new Error('ECONNRESET');
        if (mode.trading === 'refus') return xml(XML_REFUS);
        if (mode.add === 'deuxErreurs') return xml(XML_ECHEC(ERR('21917091', 'Warning', 'Le titre est long, il sera peut-être coupé.') + ERR('21916672', 'Error', 'La catégorie ne convient pas à cet objet.')));
        const uuid = balise(corps, 'UUID');
        if (uuid && uuidsVus.has(uuid)) {
          const id0 = uuidsVus.get(uuid);
          return xml(XML_ECHEC(ERR('488', 'Error', `The specified UUID has already been used; ListedByRequestAppId=1, item ID=${id0}.`, [id0])));
        }
        const id = String(prochainId++);
        const quand = balise(corps, 'ScheduleTime');
        const debut = mode.add === 'maintenant' || !quand ? iso(Date.now()) : (mode.add === 'decale' ? iso(Date.parse(quand) + 15 * MIN) : quand);
        const a = annonce(id, balise(corps, 'Title'), balise(corps, 'SKU'), balise(corps, 'StartPrice'), debut, { fin: iso(Date.parse(debut) + 30 * JOUR) });
        if (quand && mode.add !== 'maintenant') compte.programmees.push(a); else compte.actives.push(a);
        if (uuid) uuidsVus.set(uuid, id);
        // Le réseau tombe APRÈS qu'eBay a créé l'annonce : la réponse se perd.
        if (mode.add === 'reseau-apres') throw new Error('ECONNRESET');
        // La passerelle d'eBay répond 503 en HTML APRÈS avoir créé l'annonce :
        // aucun <Ack>, eBay n'a rien dit de ce qu'il a fait (revue du 6 octobre).
        if (mode.add === '503-apres') return new Response('<html><body>503 Service Unavailable</body></html>', { status: 503, headers: { 'content-type': 'text/html' } });
        if (mode.add === '488') return xml(XML_ECHEC(ERR('488', 'Error', `The specified UUID has already been used; ListedByRequestAppId=1, item ID=${id}.`, [id])));
        return xml(XML_OK(`<ItemID>${id}</ItemID><StartTime>${a.debut}</StartTime><EndTime>${a.fin}</EndTime><Fees>${fee('ListingFee', quand ? '0.2' : '0.0')}</Fees>`));
      }
      if (appel === 'EndFixedPriceItem') {
        if (mode.trading === 'reseau') throw new Error('ECONNRESET');
        if (mode.trading === 'refus' || mode.end === 'refus') return xml(mode.end === 'refus' ? XML_ECHEC(ERR('1047', 'Error', 'Une annonce programmée ne peut pas être terminée par cet appel.')) : XML_REFUS);
        const id = balise(corps, 'ItemID');
        if (mode.end !== 'reste') { compte.programmees = compte.programmees.filter((x) => x.itemId !== id); compte.actives = compte.actives.filter((x) => x.itemId !== id); }
        if (mode.end === '503-apres') return new Response('<html>503</html>', { status: 503, headers: { 'content-type': 'text/html' } });
        return xml(XML_OK('<EndTime>2026-10-05T12:00:00.000Z</EndTime>'));
      }
      if (appel === 'ReviseFixedPriceItem') {
        if (mode.trading === 'reseau') throw new Error('ECONNRESET');
        if (mode.trading === 'refus') return xml(XML_REFUS);
        const id = balise(corps, 'ItemID'); const st = balise(corps, 'ScheduleTime');
        const a = compte.programmees.find((x) => x.itemId === id);
        if (st && a) a.debut = st;
        if (mode.revise === '503-apres') return new Response('<html>503</html>', { status: 503, headers: { 'content-type': 'text/html' } });
        return xml(XML_OK());
      }
      if (mode.trading === 'reseau') throw new Error('ECONNRESET');
      if (mode.trading === 'refus') return xml(XML_REFUS);
      return xml(XML_OK());
    }
    if (u.includes('/sell/account/v1/privilege')) {
      if (mode.priv === '403') return rep({ errors: [{ errorId: 1100 }] }, 403);
      if (mode.priv === '500') return rep({ errors: [{ errorId: 2003 }] }, 500);
      if (mode.priv === 'vide') return rep({ sellerRegistrationCompleted: true });
      return rep({ sellerRegistrationCompleted: true, sellingLimit: { amount: { currency: 'EUR', value: '500.0' }, quantity: 10 } });
    }
    if (u.includes('/sell/negotiation/v1/find_eligible_items')) {
      if (mode.eligibles === '204') return rep(null, 204);
      if (mode.eligibles === 'ko') return rep({ errors: [{ errorId: 150000, message: 'System error' }] }, 500);
      return rep({ eligibleItems: [{ listingId: ELIGIBLE }], total: 1, limit: 200, offset: 0 });
    }
    if (u.includes('/sell/negotiation/v1/send_offer_to_interested_buyers')) {
      if (mode.envoi === 'refus') return rep({ errors: [{ errorId: 150020, longMessage: 'Offre refusée par eBay. Bearer at-J v^1.1#SECRET-QUI-FUIRAIT' }] }, 400);
      return rep({ offers: [{ offerId: 'o1', offerStatus: 'PENDING' }, { offerId: 'o2', offerStatus: 'PENDING' }] });
    }
    if (u.includes('/sell/fulfillment/v1/order')) return mode.commandes === 'ko' ? rep({ errors: [] }, 500) : rep({ orders: [{ orderId: '01-0001', lineItems: [{ sku: 'VRM-24' }] }], total: 1 });
    return rep({ orders: [], inventoryItems: [], total: 0 });
  }
  if (u.includes('/rest/v1/rpc/vrm_acces_pour')) {
    let qui = ''; try { qui = JSON.parse(opts.body || '{}').u; } catch (_) {}
    return rep(qui !== C);
  }
  if (u.includes('/rest/v1/app_data')) {
    const q = decodeURIComponent(u);
    if (/select=owner&limit=1/.test(q)) return NON_CLOISONNEE ? rep({ message: 'column app_data.owner does not exist' }, 400) : rep([]);
    if (m !== 'GET') {
      journal.push({ ou: 'base', m, u: q, corps: String(opts.body || '') });
      let rows = []; try { rows = [].concat(JSON.parse(opts.body || '[]')); } catch (_) {}
      for (const r of rows) {
        const cle = NON_CLOISONNEE ? (x) => x.id === r.id : (x) => x.id === r.id && x.owner === r.owner;
        const i = lignes.findIndex(cle);
        if (i >= 0) lignes[i] = { ...lignes[i], ...r }; else lignes.push({ ...r });
      }
      return rep('', 201);
    }
    journal.push({ ou: 'lecture', m, u: q });
    const id = (/[?&]id=eq\.([^&]*)/.exec(q) || [])[1];
    const owner = (/[?&]owner=eq\.([^&]*)/.exec(q) || [])[1];
    const sel = (/[?&]select=([^&]*)/.exec(q) || [])[1];
    // Une lecture qui échoue, ligne par ligne (retrait automatique, 6 octobre).
    if (id === 'main' && mode.mainKo) return rep({ message: 'boom' }, 500);
    if (id === 'ebay_retraits_auto' && mode.journalKo) return rep({ message: 'boom' }, 500);
    if (id === 'ebay_listings' && mode.listingsKo) return rep({ message: 'boom' }, 500);
    const out = lignes.filter((r) => (!id || r.id === id) && (!owner || r.owner === owner));
    return rep(out.map((r) => projette(r, sel)));
  }
  return rep({});
};
const faireRes = () => {
  const x = { code: null, corps: null, entetes: {} };
  x.status = (n) => { x.code = n; return x; }; x.json = (o) => { x.corps = o; return x; };
  x.setHeader = (k, v) => { x.entetes[String(k).toLowerCase()] = v; }; x.end = () => x; return x;
};

// ── LA RÈGLE DE L'APP (extraite d'App.jsx, exécutée) — §11 ────────────────────
function extraire(src, nom) {
  const re = new RegExp(`^(?:async )?function ${nom}\\(|^const ${nom} = `, 'm');
  const m = re.exec(src);
  if (!m) return '';
  let i = m.index, prof = 0, vuCorps = false;
  const estFn = /function/.test(m[0]);
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '(' || c === '[' || c === '{') { prof++; if (c === '{') vuCorps = true; }
    else if (c === ')' || c === ']' || c === '}') {
      prof--;
      if (estFn && vuCorps && prof === 0 && c === '}') return src.slice(m.index, i + 1);
    } else if (!estFn && c === ';' && prof === 0) return src.slice(m.index, i + 1);
  }
  return '';
}
const APP = (() => { try { return fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8'); } catch (_) { return ''; } })();
const RA = {};
{
  const noms = ['cleNum', 'NUM_OK', 'numDeSkuEbay', 'skuEbayDe'];
  const srcs = noms.map((n) => extraire(APP, n));
  if (srcs.every(Boolean)) {
    const ctx = {}; vm.createContext(ctx);
    try { vm.runInContext(srcs.join('\n') + '\n;this.R = { cleNum, NUM_OK, numDeSkuEbay, skuEbayDe };', ctx); Object.assign(RA, ctx.R || {}); } catch (_) {}
  }
}

(async () => {
  let route;
  await essaie('chargement', async () => { route = await import('file://' + path.join(RACINE, 'api', 'ebay.js')); });
  if (!route) { console.log('\n❌ audit-ebay-route : la route n\'a pas pu être chargée'); process.exit(1); }
  const app = async (jwt, corps) => {
    journal.length = 0;
    const res = faireRes();
    await route.default({ method: 'POST', query: {}, headers: jwt ? { authorization: 'Bearer ' + jwt } : {}, body: corps }, res);
    return { code: res.code, corps: res.corps, journal: journal.slice(), entetes: res.entetes };
  };
  // Le retour d'eBay, tel que le NAVIGATEUR le fait : avec ses cookies (le
  // nonce posé par `authurl`), ou sans (le navigateur de quelqu'un d'autre).
  const retourEbay = async (query, cookie) => {
    journal.length = 0;
    const res = faireRes();
    await route.default({ method: 'GET', query: { mode: 'callback', ...query }, headers: cookie ? { cookie } : {} }, res);
    return { code: res.code, loc: res.entetes.location || '', journal: journal.slice(), cookie: String(res.entetes['set-cookie'] || '') };
  };
  // Le cookie que le navigateur renverra, lu dans le Set-Cookie d'`authurl`.
  const cookieDe = (d) => { const m = /^(vrm_ebay_etat=[^;]*)/.exec(String((d && d.entetes && d.entetes['set-cookie']) || '')); return m ? m[1] : ''; };
  let cookieB = '', cookieJ = '';
  const chezEbay = (j) => j.filter((x) => x.ou === 'ebay');
  // Ce qui part chez eBay SANS compter le renouvellement du jeton (qui ne fait
  // rien au compte) : les vrais appels au compte eBay.
  const auCompte = (j) => chezEbay(j).filter((x) => !/oauth2\/token/.test(x.u));
  const appels = (j) => auCompte(j).map((x) => x.appel || x.u.replace(/^.*\/v1\//, '')).join(',');
  const ecritJetons = (j) => j.some((x) => x.ou === 'base' && /ebay_tokens|rt-de-B|rt-neuf/.test(x.u + ' ' + x.corps));
  const sansJeton = (o) => !/at-J|at-B|rt-de-|rt-neuf|v\^1\.1#|Bearer/.test(JSON.stringify(o && o.corps || {}));
  const ecrit = (j, id) => {
    const w = j.filter((x) => x.ou === 'base' && x.corps.includes(`"id":"${id}"`));
    if (!w.length) return null;
    try { return [].concat(JSON.parse(w[w.length - 1].corps)).find((r) => r.id === id) || null; } catch (_) { return null; }
  };

  // ════ BASE PAS ENCORE CLOISONNÉE : exactement comme avant (processus fils) ══
  if (NON_CLOISONNEE) {
    await essaie('np propriétaire', async () => {
      const o = await app(JWT_J, { action: 'status' });
      const lec = o.journal.filter((x) => x.ou === 'lecture' && /ebay_tokens/.test(x.u));
      dit(o.code === 200 && o.corps && o.corps.connected === true && lec.length && lec.every((x) => !/owner=eq/.test(x.u)),
        'base non cloisonnée : le propriétaire voit son compte eBay, lu SANS filtre de vendeur (comme avant)', `HTTP ${o.code} · ${lec.map((x) => x.u).join(' ')}`);
    });
    await essaie('np autre vendeur', async () => {
      for (const action of ['sync', 'status', 'authurl', 'programmer']) {
        const o = await app(JWT_B, { action, confirme: true });
        dit(o.code === 403 && chezEbay(o.journal).length === 0,
          `base non cloisonnée : un autre vendeur ne pilote pas « ${action} » (un seul jeu de données, celui de l'installation)`, `HTTP ${o.code} · ${chezEbay(o.journal).length} appel(s) eBay`);
      }
    });
    await essaie('np écriture', async () => {
      const o = await app(JWT_J, { action: 'sync' });
      const w = o.journal.find((x) => x.ou === 'base' && /ebay_listings/.test(x.corps));
      dit(!!w && /on_conflict=owner,id/.test(w.u) && /"owner":"11111111/.test(w.corps),
        'base non cloisonnée : l\'écriture garde la forme d\'avant (VRM_OWNER_UID, cible owner,id)', w ? w.u : 'aucune écriture');
    });
    console.log(`NC ok=${ok} ko=${ko}`);
    process.exit(ko ? 1 : 0);
  }

  // ── 1. Session obligatoire ─────────────────────────────────────────────────
  const TOUTES = ['sync', 'finances', 'publish', 'revise', 'sku', 'offreinfo', 'offre', 'retirer', 'programmer', 'programmees', 'deprogrammer', 'reprogrammer', 'limites'];
  for (const action of TOUTES) {
    await essaie('sans session : ' + action, async () => {
      const o = await app('', { action, item: { title: 'x' }, itemId: '110000000001', listingId: ELIGIBLE, numero: '22', remise: 10, confirme: true, price: '10' });
      dit(o.code === 401 && chezEbay(o.journal).length === 0,
        `sans session, « ${action} » est refusé et rien ne part chez eBay`,
        `HTTP ${o.code} · ${chezEbay(o.journal).length} appel(s) eBay`);
    });
  }
  await essaie('jeton falsifié', async () => {
    const o = await app('eyJh.faux.sig', { action: 'finances' });
    dit(o.code === 401 && chezEbay(o.journal).length === 0, 'un jeton que le service d\'identité ne reconnaît pas est refusé', `HTTP ${o.code}`);
  });
  await essaie('abonnement coupé', async () => {
    for (const action of ['status', 'sync', 'programmer', 'authurl']) {
      const o = await app(JWT_C, { action, confirme: true });
      dit(o.code === 402 && chezEbay(o.journal).length === 0,
        `un vendeur dont l'abonnement est coupé ne pilote pas « ${action} » (402, zéro appel eBay)`, `HTTP ${o.code}`);
    }
  });

  // ── 2. CHAQUE VENDEUR SON eBAY ─────────────────────────────────────────────
  await essaie('Julien, ligne d\'avant', async () => {
    remettreBase(); remettre();
    const o = await app(JWT_J, { action: 'status' });
    const lec = o.journal.filter((x) => x.ou === 'lecture' && /ebay_tokens/.test(x.u));
    dit(o.code === 200 && o.corps && o.corps.connected === true,
      "la ligne d'avant de Julien (owner = VRM_OWNER_UID) marche sans rien refaire : son compte eBay est relié", `HTTP ${o.code} ${JSON.stringify(o.corps)}`);
    dit(lec.length > 0 && lec.every((x) => /owner=eq\.11111111-1111-1111-1111-111111111111/.test(x.u)),
      'et ses jetons sont lus filtrés sur LUI (owner=eq.J), jamais « la première ligne venue »', lec.map((x) => x.u.replace(/^.*app_data/, '')).join(' '));
  });
  await essaie('B pas encore relié', async () => {
    remettreBase(); remettre();
    const s = await app(JWT_B, { action: 'status' });
    dit(s.code === 200 && s.corps && s.corps.connected === false,
      "un autre vendeur connecté voit SON état : pas de compte eBay relié (jamais celui de Julien)", `HTTP ${s.code} ${JSON.stringify(s.corps)}`);
    for (const action of ['sync', 'sku', 'offreinfo', 'offre', 'retirer', 'programmees', 'limites']) {
      const o = await app(JWT_B, { action, itemId: '110000000001', listingId: ELIGIBLE, numero: '22', remise: 10, confirme: true });
      const jetonJ = chezEbay(o.journal).some((x) => /rt-de-J/.test(x.corps) || x.jeton === 'at-J');
      dit(o.code === 401 && o.corps && o.corps.reason === 'not-connected' && auCompte(o.journal).length === 0 && !jetonJ,
        `B, sans eBay relié, ne pilote pas « ${action} » sur le compte de Julien : « aucun compte eBay relié », zéro appel, jamais le jeton de Julien`,
        `HTTP ${o.code} · ${o.corps && o.corps.reason} · ${auCompte(o.journal).length} appel(s) · jeton de J : ${jetonJ}`);
    }
  });
  let etatB = '', etatJ = '';
  // ⚠️⚠️ LE LIEN D'UN AUTRE (revue du 6 octobre) : B envoie SON lien de
  // consentement à Julien ; Julien accepte chez eBay ; SON navigateur revient
  // avec SON code et le state de B — mais sans le nonce de B. Rien ne doit
  // être rangé, chez personne.
  await essaie('le lien d\'un autre', async () => {
    remettreBase(); remettre();
    const d = await app(JWT_B, { action: 'authurl' });
    const etat = decodeURIComponent((/[?&]state=([^&]+)/.exec((d.corps && d.corps.url) || '') || [])[1] || '');
    const avant = JSON.stringify(lignes);
    const sansCookie = await retourEbay({ code: 'CODE-DE-LA-VICTIME', state: etat });
    const dJ = await app(JWT_J, { action: 'authurl' });
    const autreNonce = await retourEbay({ code: 'CODE-DE-LA-VICTIME', state: etat }, cookieDe(dJ));
    const n = chezEbay(sansCookie.journal).length + chezEbay(autreNonce.journal).length;
    dit(n === 0 && !ecritJetons(sansCookie.journal) && !ecritJetons(autreNonce.journal) && JSON.stringify(lignes) === avant && /ebay=erreur/.test(sansCookie.loc) && /ebay=erreur/.test(autreNonce.loc),
      'le lien de B ouvert dans le navigateur de Julien (sans le nonce de B, ou avec le sien) : aucun échange, aucun jeton rangé chez B', `${n} appel(s) eBay · ${sansCookie.loc}`);
    const jb = lignes.find((x) => x.owner === B && x.id === 'ebay_tokens');
    dit(!jb, 'et B n\'a toujours aucun eBay relié', jb ? JSON.stringify(jb.data) : 'aucun');
  });
  await essaie('B relie SON eBay', async () => {
    remettreBase(); remettre();
    const d = await app(JWT_B, { action: 'authurl' });
    etatB = decodeURIComponent((/[?&]state=([^&]+)/.exec((d.corps && d.corps.url) || '') || [])[1] || '');
    dit(d.code === 200 && etatB.includes(B), 'B demande la connexion : le state signé PORTE son identifiant', etatB || `HTTP ${d.code}`);
    cookieB = cookieDe(d);
    const sc = String((d.entetes || {})['set-cookie'] || '');
    dit(/^vrm_ebay_etat=[0-9a-f]{32};/.test(sc) && /HttpOnly/.test(sc) && /Secure/.test(sc) && /SameSite=Lax/.test(sc) && /Path=\/api\//.test(sc) && !(d.corps && JSON.stringify(d.corps).includes(cookieB.split('=')[1] || '§')),
      'et la demande pose un NONCE dans un cookie HttpOnly, Secure, SameSite=Lax (jamais dans la réponse lisible par la page)', sc || 'aucun cookie');
    const r = await retourEbay({ code: 'code-de-B', state: etatB }, cookieB);
    dit(/vrm_ebay_etat=;/.test(r.cookie) && /Max-Age=0/.test(r.cookie), 'le retour EFFACE le nonce (un lien, un seul retour)', r.cookie || 'cookie gardé');
    const w = r.journal.filter((x) => x.ou === 'base' && /ebay_tokens/.test(x.corps));
    let ligne = null; try { ligne = [].concat(JSON.parse((w[0] || {}).corps || '[]'))[0]; } catch (_) {}
    dit(/ebay=connecte/.test(r.loc) && ligne && ligne.owner === B && ligne.data && ligne.data.refresh_token === 'rt-de-B' && /on_conflict=owner,id/.test((w[0] || {}).u || ''),
      'au retour, les jetons de B sont rangés CHEZ B (owner = B, cible owner,id)', `${r.loc} · ${ligne ? 'owner=' + ligne.owner : 'rien rangé'}`);
    const j = lignes.find((x) => x.owner === J && x.id === 'ebay_tokens');
    dit(j && j.data.refresh_token === 'rt-de-J', 'et la connexion eBay de Julien n\'a pas bougé', j ? j.data.refresh_token : 'disparue');
  });
  await essaie('B pilote SON eBay', async () => {
    remettre();
    const o = await app(JWT_B, { action: 'sync' });
    const parti = auCompte(o.journal);
    dit(o.code === 200 && parti.length > 0 && parti.every((x) => x.jeton === 'at-B'),
      'la synchro de B part chez eBay avec SON jeton (at-B), jamais celui de Julien', parti.map((x) => x.jeton).join(','));
    const L = ecrit(o.journal, 'ebay_listings');
    dit(L && L.owner === B && L.data && Array.isArray(L.data.items) && L.data.items.length === 0,
      'et elle range SES annonces chez lui (owner = B, ses 0 annonces) — pas celles de Julien', L ? `owner=${L.owner} · ${L.data.items.length} annonce(s)` : 'rien rangé');
    const lec = o.journal.filter((x) => x.ou === 'lecture' && /app_data\?id=eq/.test(x.u));
    dit(lec.length > 0 && lec.every((x) => /owner=eq\.22222222/.test(x.u)), 'toutes les lectures de B sont filtrées sur B', lec.map((x) => x.u.replace(/^.*app_data/, '')).join(' '));
    const oJ = await app(JWT_J, { action: 'sync' });
    const LJ = ecrit(oJ.journal, 'ebay_listings');
    dit(auCompte(oJ.journal).every((x) => x.jeton === 'at-J') && LJ && LJ.owner === J && LJ.data.items.length === 2,
      'pendant ce temps, la synchro de Julien lit SON eBay et range chez LUI (2 annonces)', LJ ? `owner=${LJ.owner} · ${LJ.data.items.length}` : 'rien rangé');
  });
  await essaie('state falsifié', async () => {
    remettre();
    const d = await app(JWT_J, { action: 'authurl' });
    etatJ = decodeURIComponent((/[?&]state=([^&]+)/.exec((d.corps && d.corps.url) || '') || [])[1] || '');
    cookieJ = cookieDe(d);
    const [ts, , mac] = etatJ.split('.');
    // Le state de Julien, dont on remplace le vendeur par B : la signature ne colle plus.
    const forge = [ts, B, mac].join('.');
    const avant = JSON.stringify(lignes);
    const r1 = await retourEbay({ code: 'code-d-un-inconnu', state: forge }, cookieJ);
    const r2 = await retourEbay({ code: 'code-d-un-inconnu', state: ts + '.' + J + '.' + '0'.repeat(40) }, cookieJ);
    const r3 = await retourEbay({ code: 'code-d-un-inconnu', state: 'vrm' }, cookieJ);
    const r4 = await retourEbay({ code: 'code-d-un-inconnu' }, cookieJ);
    const n = [r1, r2, r3, r4].reduce((s, r) => s + chezEbay(r.journal).length, 0);
    dit(n === 0 && ![r1, r2, r3, r4].some((r) => ecritJetons(r.journal)) && JSON.stringify(lignes) === avant,
      'un state falsifié (vendeur remplacé, signature au hasard, « vrm », absent) : aucun échange, aucun jeton rangé chez personne', `${n} appel(s) eBay`);
  });
  await essaie('retour expiré', async () => {
    const vrai = Date.now;
    try {
      Date.now = () => vrai() + 31 * MIN;
      const o = await retourEbay({ code: 'code-de-B', state: etatB }, cookieB);
      dit(chezEbay(o.journal).length === 0, 'une demande de plus de 30 minutes ne sert plus', `${chezEbay(o.journal).length} appel(s) eBay`);
    } finally { Date.now = vrai; }
  });
  await essaie('retour valide de Julien', async () => {
    remettreBase();
    const o = await retourEbay({ code: 'code-de-julien', state: etatJ }, cookieJ);
    const w = o.journal.find((x) => x.ou === 'base' && /ebay_tokens/.test(x.corps));
    dit(/ebay=connecte/.test(o.loc) && w && /"owner":"11111111/.test(w.corps), "l'autre sens : la connexion que Julien a lui-même demandée aboutit, chez lui", o.loc);
  });

  // ── 3. CE QUI ENGAGE EXIGE `confirme:true` — vérifié AVANT eBay ────────────
  remettreBase();
  for (const [action, corps] of [['retirer', { itemId: '110000000001' }], ['offre', { listingId: ELIGIBLE, remise: 10 }],
    ['retirer', { itemId: '110000000001', confirme: 'true' }], ['offre', { listingId: ELIGIBLE, remise: 10, confirme: 1 }],
    ['programmer', { item: {}, uuid: 'A'.repeat(32), fraisVus: 0.2 }], ['deprogrammer', { itemId: '110000000001' }], ['reprogrammer', { itemId: '110000000001', scheduleTime: iso(Date.now() + 2 * JOUR) }]]) {
    await essaie('confirmation ' + action, async () => {
      remettre();
      const o = await app(JWT_J, { action, ...corps });
      dit(o.code === 400 && o.corps && o.corps.reason === 'confirmation' && chezEbay(o.journal).length === 0,
        `« ${action} » sans confirmation explicite (${JSON.stringify(corps.confirme)}) est refusé, zéro appel eBay`,
        `HTTP ${o.code} · ${o.corps && (o.corps.reason || o.corps.error)} · ${chezEbay(o.journal).length} appel(s) eBay`);
    });
  }
  // ── 4. VALIDATION : remise, identifiants, numéro — zéro appel eBay ─────────
  for (const remise of [4, 51, 10.5, '12abc', null]) {
    await essaie('remise ' + remise, async () => {
      const o = await app(JWT_J, { action: 'offre', listingId: ELIGIBLE, remise, confirme: true });
      dit(o.code === 400 && o.corps && o.corps.reason === 'remise' && chezEbay(o.journal).length === 0,
        `une remise de ${JSON.stringify(remise)} % est refusée (entre 5 et 50, entière), zéro appel eBay`, `HTTP ${o.code}`);
    });
  }
  for (const [action, corps] of [['retirer', { itemId: '12a', confirme: true }], ['retirer', { itemId: '110</ItemID><X>', confirme: true }],
    ['sku', { itemId: '1 2', numero: '22' }], ['offre', { listingId: '1;2', remise: 10, confirme: true }], ['offre', { listingId: '', remise: 10, confirme: true }],
    ['deprogrammer', { itemId: '11a', confirme: true }]]) {
    await essaie('identifiant ' + action, async () => {
      const o = await app(JWT_J, { action, ...corps });
      dit(o.code === 400 && /annonce eBay invalide/.test((o.corps && o.corps.error) || '') && chezEbay(o.journal).length === 0,
        `« ${action} » refuse un identifiant qui n'est pas que des chiffres (${JSON.stringify(corps.itemId || corps.listingId)}), zéro appel eBay`, `HTTP ${o.code}`);
    });
  }
  for (const numero of ['zz', '', 'B1234567', '1234567', 'ABCD1', null]) {
    await essaie('numéro ' + numero, async () => {
      const o = await app(JWT_J, { action: 'sku', itemId: '110000000002', numero });
      dit(o.code === 400 && o.corps && o.corps.reason === 'numero' && chezEbay(o.journal).length === 0,
        `« sku » refuse un numéro illisible (${JSON.stringify(numero)}), zéro appel eBay`, `HTTP ${o.code}`);
    });
  }
  await essaie('message trop long', async () => {
    const o = await app(JWT_J, { action: 'offre', listingId: ELIGIBLE, remise: 10, confirme: true, message: 'x'.repeat(2001) });
    dit(o.code === 400 && o.corps && o.corps.reason === 'message' && chezEbay(o.journal).length === 0, 'un message de plus de 2 000 caractères est refusé, zéro appel eBay', `HTTP ${o.code}`);
  });

  // ── 5. CE QUI PART CHEZ eBAY (publier, relier, offre, retirer) ─────────────
  await essaie('règle de l\'app chargée', async () => {
    dit(typeof RA.skuEbayDe === 'function' && typeof RA.numDeSkuEbay === 'function',
      "la règle du SKU existe dans l'app (`skuEbayDe`, `numDeSkuEbay`) et se charge", Object.keys(RA).join(',') || 'absente');
  });
  for (const numero of ['22', '007', 'b125', ' B-125 ', 'c 12', 'AB3']) {
    await essaie('sku ' + numero, async () => {
      remettre();
      const o = await app(JWT_J, { action: 'sku', itemId: '110000000002', numero });
      const a = auCompte(o.journal);
      const corps = (a[0] && a[0].corps) || '';
      const skuEnvoye = (/<SKU>([^<]*)<\/SKU>/.exec(corps) || [])[1] || '';
      const attendu = RA.skuEbayDe ? RA.skuEbayDe(numero) : '(règle de l\'app absente)';
      dit(o.code === 200 && a.length === 1 && a[0].appel === 'ReviseFixedPriceItem'
          && /<Item><ItemID>110000000002<\/ItemID><SKU>/.test(corps) && skuEnvoye === attendu && o.corps.sku === attendu,
        `« sku » ${JSON.stringify(numero)} ⇒ ReviseFixedPriceItem pose ${attendu} — la même règle que l'app`, `HTTP ${o.code} · envoyé ${skuEnvoye || '∅'}`);
      dit(!!RA.numDeSkuEbay && RA.numDeSkuEbay(skuEnvoye) === RA.cleNum(numero),
        `et l'app relit ${skuEnvoye || '∅'} comme le N°${RA.cleNum ? RA.cleNum(numero) : '?'} (aller-retour sans perte)`);
    });
  }
  await essaie('lecture stricte du SKU', async () => {
    const cas = { 'VRM-22': '22', 'vrm-b125': 'B125', 'VRM 7': '7', '12345-ABC': '', 'VRM-22X': '', 'XVRM-22': '', '22': '', 'VAR-42': '' };
    const faux = RA.numDeSkuEbay ? Object.entries(cas).filter(([s, n]) => RA.numDeSkuEbay(s) !== n) : [['(absente)', '']];
    dit(faux.length === 0, "l'app ne lit un numéro QUE dans un SKU « VRM-… » entier", faux.map(([s]) => s).join(' · '));
  });
  const item = { title: 'Nike Dunk Low panda T42', categoryId: '15709', price: '100', conditionId: '3000', photos: ['https://img.test/1.jpg'], aspects: { Marque: 'Nike' }, ebayGere: true };
  await essaie('publish avec numéro', async () => {
    remettre();
    const o = await app(JWT_J, { action: 'publish', item: { ...item, numero: '401' } });
    const add = auCompte(o.journal).find((x) => x.appel === 'AddFixedPriceItem');
    dit(o.code === 200 && add && /<SKU>VRM-401<\/SKU>/.test(add.corps) && o.corps.sku === 'VRM-401', 'une paire publiée part avec son SKU VRM-401', `HTTP ${o.code}`);
  });
  await essaie('publish : rien de recopié du navigateur', async () => {
    remettre();
    const o = await app(JWT_J, { action: 'publish', item: { ...item, sku: 'EVIL-1', scheduleTime: iso(Date.now() + 2 * JOUR), uuid: 'B'.repeat(32) } });
    const add = auCompte(o.journal).find((x) => x.appel === 'AddFixedPriceItem');
    dit(o.code === 200 && add && !/<SKU>/.test(add.corps) && !/<ScheduleTime>/.test(add.corps) && !/<UUID>/.test(add.corps),
      "sans numéro, aucun SKU — et un `sku`, une heure ou un UUID glissés dans `item` ne sont jamais recopiés", add ? add.corps.slice(0, 80) : 'aucun appel');
  });
  await essaie('pubverify avec numéro', async () => {
    remettre();
    const o = await app(JWT_J, { action: 'pubverify', item: { ...item, numero: 'b7' } });
    const v = auCompte(o.journal).find((x) => x.appel === 'VerifyAddFixedPriceItem');
    dit(o.code === 200 && v && /<SKU>VRM-B7<\/SKU>/.test(v.corps), 'la vérification à blanc porte le MÊME SKU que la publication (VRM-B7)');
  });
  await essaie('publish numéro illisible', async () => {
    remettre();
    const o = await app(JWT_J, { action: 'publish', item: { ...item, numero: 'zz' } });
    dit(o.code === 400 && auCompte(o.journal).length === 0, 'un numéro de paire illisible ⇒ rien n\'est publié (pas de faux lien)', `HTTP ${o.code}`);
  });
  await essaie('offreinfo', async () => {
    remettre();
    const o = await app(JWT_J, { action: 'offreinfo' });
    const e = auCompte(o.journal)[0] || {};
    dit(o.code === 200 && o.corps && JSON.stringify(o.corps.eligibles) === JSON.stringify([ELIGIBLE]) && /find_eligible_items/.test(e.u) && e.marche === 'EBAY_FR',
      '« offreinfo » lit find_eligible_items (marché EBAY_FR) et rend les annonces éligibles', `HTTP ${o.code}`);
    mode.eligibles = '204';
    const o2 = await app(JWT_J, { action: 'offreinfo' });
    dit(o2.code === 200 && o2.corps && Array.isArray(o2.corps.eligibles) && o2.corps.eligibles.length === 0, 'eBay répond 204 ⇒ « lu, aucune », pas une panne', `HTTP ${o2.code}`);
    mode.eligibles = 'ko';
    const o3 = await app(JWT_J, { action: 'offreinfo' });
    dit(o3.code >= 500 && o3.corps && o3.corps.ok === false && !('eligibles' in o3.corps), 'eBay en panne ⇒ « pas su » — jamais « aucun observateur »', `HTTP ${o3.code}`);
  });
  await essaie('offre éligible', async () => {
    remettre();
    const o = await app(JWT_J, { action: 'offre', listingId: ELIGIBLE, remise: 15, confirme: true, message: 'Toujours dispo, envoi rapide.' });
    const a = auCompte(o.journal);
    const post = a.find((x) => /send_offer_to_interested_buyers/.test(x.u));
    let corps = null; try { corps = JSON.parse(post && post.corps); } catch (_) {}
    dit(o.code === 200 && o.corps && o.corps.envoyees === 2, 'une offre confirmée sur une annonce éligible part, et la réponse dit à combien de personnes', `HTTP ${o.code}`);
    dit(a.length === 2 && /find_eligible_items/.test(a[0].u) && post && post.m === 'POST', "l'éligibilité est REVÉRIFIÉE chez eBay juste avant l'envoi");
    dit(!!corps && corps.offeredItems && corps.offeredItems[0].discountPercentage === '15' && corps.allowCounterOffer === false && corps.offerDuration.value === 2, 'le corps envoyé à eBay est celui attendu (remise « 15 », 48 h, pas de contre-offre)', JSON.stringify(corps));
  });
  await essaie('offre non éligible', async () => {
    remettre();
    const o = await app(JWT_J, { action: 'offre', listingId: '110000000099', remise: 10, confirme: true });
    dit(o.code === 409 && !auCompte(o.journal).some((x) => /send_offer/.test(x.u)), 'une annonce non éligible ⇒ refusée, RIEN n\'est posté', `HTTP ${o.code}`);
  });
  await essaie('offre vérification en panne', async () => {
    remettre(); mode.eligibles = 'ko';
    const o = await app(JWT_J, { action: 'offre', listingId: ELIGIBLE, remise: 10, confirme: true });
    dit(o.code >= 500 && !auCompte(o.journal).some((x) => /send_offer/.test(x.u)), "la vérification d'éligibilité échoue ⇒ RIEN n'est posté", `HTTP ${o.code}`);
  });
  await essaie('offre refusée par eBay', async () => {
    remettre(); mode.envoi = 'refus';
    const o = await app(JWT_J, { action: 'offre', listingId: ELIGIBLE, remise: 10, confirme: true });
    dit(o.code === 400 && /Offre refusée par eBay/.test((o.corps && o.corps.error) || '') && sansJeton(o), "un refus d'eBay remonte avec SON message — sans aucun jeton dedans", `HTTP ${o.code}`);
  });
  await essaie('retirer', async () => {
    remettre();
    const o = await app(JWT_J, { action: 'retirer', itemId: '110000000001', confirme: true });
    const e = auCompte(o.journal);
    dit(o.code === 200 && e.length === 1 && e[0].appel === 'EndFixedPriceItem' && /<ItemID>110000000001<\/ItemID><EndingReason>NotAvailable<\/EndingReason>/.test(e[0].corps),
      '« retirer » confirmé ⇒ EndFixedPriceItem (ItemID, raison NotAvailable), un seul appel', `HTTP ${o.code} · ${appels(o.journal)}`);
    mode.trading = 'refus';
    const o2 = await app(JWT_J, { action: 'retirer', itemId: '110000000001', confirme: true });
    dit(o2.code >= 400 && /déjà terminée/.test((o2.corps && o2.corps.error) || '') && sansJeton(o2), "un refus d'eBay remonte avec son message, sans jeton", `HTTP ${o2.code}`);
    mode.trading = 'reseau';
    const o3 = await app(JWT_J, { action: 'retirer', itemId: '110000000001', confirme: true });
    dit(o3.code === 504 && o3.corps && o3.corps.reason === 'incertain', 'eBay ne répond pas ⇒ « je ne sais pas si elle a été retirée »', `HTTP ${o3.code}`);
  });
  // L'annonce terminée sort de la liste rangée TOUT DE SUITE (revue du 6
  // octobre) : sinon l'alerte « à retirer » restait, et le retrait automatique
  // reprenait la même annonce à chaque ouverture. Lecture ratée ⇒ rien d'écrit.
  await essaie('retirer : la liste rangée suit', async () => {
    remettre(); remettreBase();
    lignes.push({ owner: J, id: 'ebay_listings', data: { items: [{ itemId: '110000000001', sku: 'VRM-22' }, { itemId: '110000000002', sku: '' }], capturedAt: 5 } });
    const o = await app(JWT_J, { action: 'retirer', itemId: '110000000001', confirme: true });
    const L = lignes.find((x) => x.owner === J && x.id === 'ebay_listings');
    const ids = L && L.data && Array.isArray(L.data.items) ? L.data.items.map((x) => x.itemId) : [];
    dit(o.code === 200 && o.corps.listes === true && ids.length === 1 && ids[0] === '110000000002' && L.data.capturedAt === 5,
      'après un retrait réussi, l\'annonce terminée sort de ebay_listings (les autres et la date de capture restent)', `HTTP ${o.code} · listes=${o.corps && o.corps.listes} · ${ids.join(',')}`);
    remettre(); remettreBase();
    lignes.push({ owner: J, id: 'ebay_listings', data: { items: [{ itemId: '110000000001', sku: 'VRM-22' }, { itemId: '110000000002', sku: '' }], capturedAt: 5 } });
    mode.listingsKo = true;
    const o2 = await app(JWT_J, { action: 'retirer', itemId: '110000000001', confirme: true });
    const ecritL = o2.journal.some((x) => x.ou === 'base' && /ebay_listings/.test(x.corps));
    dit(o2.code === 200 && o2.corps.listes === null && !ecritL, 'liste rangée illisible ⇒ le retrait est dit fait, la liste n\'est PAS réécrite depuis une lecture ratée', `listes=${o2.corps && o2.corps.listes} · écrite=${ecritL}`);
  });
  await essaie('modifier : réponse sans Ack', async () => {
    remettre(); mode.trading = 'reseau';
    const o = await app(JWT_J, { action: 'revise', itemId: '110000000001', price: '70' });
    dit(o.code === 504 && o.corps.reason === 'incertain', 'changer un prix, réseau coupé ⇒ « incertain », jamais « eBay a refusé »', `HTTP ${o.code} · ${o.corps && o.corps.error}`);
    remettre(); mode.trading = 'refus';
    const o2 = await app(JWT_J, { action: 'revise', itemId: '110000000001', price: '70' });
    dit(o2.code !== 504 && o2.corps.ok === false && o2.corps.reason !== 'incertain', 'l\'autre sens : un vrai refus (Ack Failure) reste un refus', `HTTP ${o2.code}`);
  });

  // ── 5 bis. LE RETRAIT AUTOMATIQUE (proposition 8, 6 octobre) ──────────────
  //    L'interrupteur est relu PAR LA ROUTE dans SA ligne `main` ; le SKU de
  //    l'annonce est redemandé à eBay et doit être celui de la paire vendue.
  await essaie('retrait automatique', async () => {
    const fin = (o) => auCompte(o.journal).some((x) => x.appel === 'EndFixedPriceItem');
    const AUTO = { action: 'retirer', itemId: '110000000001', confirme: true, auto: true, sku: 'VRM-22', titre: 'Adidas Gazelle bleu taille 40' };
    remettre(); remettreBase();
    let o = await app(JWT_J, AUTO);
    dit(o.code === 403 && o.corps.reason === 'auto-eteint' && !fin(o), 'automatique, interrupteur jamais allumé ⇒ 403, rien n\'est envoyé à eBay', `HTTP ${o.code} · ${appels(o.journal)}`);
    remettre(); remettreBase(); lignes.push({ owner: J, id: 'main', data: { vrm_ebay_retrait_auto: false } });
    o = await app(JWT_J, AUTO);
    dit(o.code === 403 && !fin(o), 'interrupteur éteint ⇒ rien n\'est envoyé', `HTTP ${o.code}`);
    remettre(); remettreBase(); lignes.push({ owner: J, id: 'main', data: { vrm_ebay_retrait_auto: true } }); mode.mainKo = true;
    o = await app(JWT_J, AUTO);
    dit(o.code === 503 && o.corps.reason === 'reglage-pas-su' && !fin(o), 'réglage illisible ⇒ « pas su » ne vaut pas « allumé » : rien n\'est envoyé', `HTTP ${o.code}`);
    remettre(); remettreBase(); lignes.push({ owner: J, id: 'main', data: { vrm_ebay_retrait_auto: true } });
    o = await app(JWT_J, { ...AUTO, sku: '' });
    dit(o.code === 400 && !fin(o), 'automatique sans SKU de paire ⇒ refusé avant eBay', `HTTP ${o.code}`);
    mode.getitem = 'autre';
    o = await app(JWT_J, AUTO);
    dit(o.code === 409 && o.corps.reason === 'sku-change' && !fin(o), 'l\'annonce eBay ne porte plus ce SKU ⇒ 409, rien n\'est retiré (identité, §5)', `HTTP ${o.code} · ${appels(o.journal)}`);
    remettre(); remettreBase(); lignes.push({ owner: J, id: 'main', data: { vrm_ebay_retrait_auto: true } });
    o = await app(JWT_J, AUTO);
    const ordre = auCompte(o.journal).map((x) => x.appel).filter(Boolean);
    const jr = lignes.find((r) => r.id === 'ebay_retraits_auto' && r.owner === J);
    dit(o.code === 200 && ordre.indexOf('GetItem') >= 0 && ordre.indexOf('GetItem') < ordre.indexOf('EndFixedPriceItem'), 'allumé et même SKU ⇒ eBay est relu PUIS l\'annonce est terminée', `HTTP ${o.code} · ${ordre.join(',')}`);
    dit(jr && jr.data && Array.isArray(jr.data.items) && jr.data.items[0].sku === 'VRM-22' && o.corps.journal === true, 'et le retrait est NOTÉ (il peut relire ce qui a été fait en son nom)', JSON.stringify(jr && jr.data));
    remettre(); remettreBase(); lignes.push({ owner: J, id: 'main', data: { vrm_ebay_retrait_auto: true } }, { owner: J, id: 'ebay_retraits_auto', data: { items: [{ itemId: '1', sku: 'VRM-1', at: 1 }] } }); mode.journalKo = true;
    o = await app(JWT_J, AUTO);
    const jr2 = lignes.find((r) => r.id === 'ebay_retraits_auto' && r.owner === J);
    dit(o.code === 200 && o.corps.journal === false && jr2.data.items.length === 1 && jr2.data.items[0].sku === 'VRM-1', 'journal illisible ⇒ il n\'est PAS réécrit depuis le vide (son historique reste)', JSON.stringify(jr2 && jr2.data));
    remettre(); remettreBase();
    o = await app(JWT_B, AUTO);
    dit(!fin(o), 'un AUTRE vendeur ne retire rien chez Julien, même en « automatique »', `HTTP ${o.code}`);
  });

  // ── 6. LES FRAIS, PAR NOM ; LES ERREURS, TOUTES ────────────────────────────
  await essaie('frais par nom', async () => {
    remettre(); mode.verif = 'cher';
    const o = await app(JWT_J, { action: 'pubverify', item: { ...item, numero: '22' } });
    const f = (o.corps && o.corps.frais) || {};
    dit(o.code === 200 && o.corps.fees === 0.55 && f.total === 0.55 && f.insertion === 0.35,
      'les frais sont lus PAR NOM : total = ListingFee 0,55 € (tout additionner donnait 0,90 €)', `fees=${o.corps && o.corps.fees} · ${JSON.stringify({ total: f.total, insertion: f.insertion })}`);
    mode.verif = 'sansTotal';
    const o2 = await app(JWT_J, { action: 'pubverify', item: { ...item, numero: '22' } });
    dit(o2.code === 200 && o2.corps && o2.corps.fees === null && o2.corps.frais && o2.corps.frais.total === null,
      'ListingFee absent ⇒ total « pas su » (null) — jamais 0', `fees=${o2.corps && o2.corps.fees}`);
  });
  await essaie('frais de programmation', async () => {
    remettre();
    const quand = iso(Date.now() + 2 * JOUR);
    const o = await app(JWT_J, { action: 'pubverify', item: { ...item, numero: '22' }, scheduleTime: quand });
    const v = auCompte(o.journal).find((x) => x.appel === 'VerifyAddFixedPriceItem');
    dit(o.code === 200 && o.corps.frais && o.corps.frais.programmation === 0.2 && o.corps.programme === quand && v && new RegExp(`<Item>[\\s\\S]*<ScheduleTime>${quand}</ScheduleTime>[\\s\\S]*</Item>`).test(v.corps) && !/<UUID>/.test(v.corps),
      'vérifier avec une heure ⇒ <ScheduleTime> dans <Item>, frais de programmation lu par nom (0,20 €), aucun UUID', `prog=${o.corps && o.corps.frais && o.corps.frais.programmation}`);
    const o2 = await app(JWT_J, { action: 'pubverify', item: { ...item, numero: '22' }, scheduleTime: '2026-10-11 18:00' });
    dit(o2.code === 400 && o2.corps.reason === 'heure' && auCompte(o2.journal).length === 0, 'une heure mal formée à la vérification ⇒ 400, zéro appel eBay', `HTTP ${o2.code}`);
  });
  await essaie('toutes les erreurs', async () => {
    remettre(); mode.add = 'deuxErreurs';
    const o = await app(JWT_J, { action: 'publish', item: { ...item, numero: '23' } });
    dit(o.code >= 400 && /catégorie ne convient pas/.test((o.corps && o.corps.error) || '') && !/titre est long/.test((o.corps && o.corps.error) || ''),
      'deux <Errors> (un Warning PUIS une Error) ⇒ c\'est le message de l\'ERREUR qui est rendu', `HTTP ${o.code} · ${o.corps && o.corps.error}`);
  });

  // ── 7. PROGRAMMER ──────────────────────────────────────────────────────────
  const UUID1 = 'ABCDEF0123456789ABCDEF0123456789';
  const prog = (extra) => ({ action: 'programmer', confirme: true, uuid: UUID1, fraisVus: 0.2, scheduleTime: iso(Date.now() + 2 * JOUR), item: { ...item, numero: '30' }, ...(extra || {}) });
  for (const [nom, st] of [['format', '2026-10-11 18:00'], ['passée', iso(Date.now() - H)], ['+5 min', iso(Date.now() + 5 * MIN)], ['+22 jours', iso(Date.now() + 22 * JOUR)], ['date impossible', '2026-02-30T10:00:00.000Z']]) {
    await essaie('heure ' + nom, async () => {
      remettre();
      const o = await app(JWT_J, prog({ scheduleTime: st }));
      dit(o.code === 400 && o.corps && o.corps.reason === 'heure' && chezEbay(o.journal).length === 0, `programmer avec une heure ${nom} (${st}) ⇒ 400 « heure », zéro appel eBay`, `HTTP ${o.code} · ${o.corps && o.corps.reason}`);
    });
  }
  await essaie('programmer sans numéro', async () => {
    remettre();
    const o = await app(JWT_J, prog({ item: { ...item } }));
    dit(o.code === 400 && o.corps.reason === 'numero' && chezEbay(o.journal).length === 0, 'programmer EXIGE un N° (sans lui, une paire vendue ailleurs ne se retrouve pas) — 400, zéro appel', `HTTP ${o.code}`);
  });
  await essaie('programmer sans état', async () => {
    remettre();
    const it2 = { ...item, numero: '30' }; delete it2.conditionId;
    const o = await app(JWT_J, prog({ item: it2 }));
    dit(o.code === 400 && o.corps.reason === 'champs' && chezEbay(o.journal).length === 0 && !auCompte(o.journal).some((x) => /<ConditionID>3000/.test(x.corps)),
      "programmer sans l'état de l'objet ⇒ 400 « champs » (plus d'« Occasion » posé en silence)", `HTTP ${o.code}`);
  });
  await essaie('programmer uuid / frais vus', async () => {
    remettre();
    const o = await app(JWT_J, prog({ uuid: 'abc' }));
    const o2 = await app(JWT_J, prog({ fraisVus: undefined }));
    const o3 = await app(JWT_J, prog({ fraisVus: '0.2' }));
    dit(o.code === 400 && o.corps.reason === 'uuid' && o2.code === 400 && o2.corps.reason === 'frais-vus' && o3.code === 400 && chezEbay([...o.journal, ...o2.journal, ...o3.journal]).length === 0,
      'un UUID mal formé, ou des frais vus absents ⇒ 400, zéro appel eBay', `${o.code}/${o2.code}/${o3.code}`);
  });
  let addCorps = '', verifCorps = '';
  await essaie('programmer : l\'ordre et le corps', async () => {
    remettre();
    const p = prog({ item: { ...item, numero: 'b 125', sku: 'VRM-999' } });
    const o = await app(JWT_J, p);
    const a = auCompte(o.journal);
    const v = a.find((x) => x.appel === 'VerifyAddFixedPriceItem'), ad = a.find((x) => x.appel === 'AddFixedPriceItem');
    verifCorps = (v && v.corps) || ''; addCorps = (ad && ad.corps) || '';
    dit(o.code === 200 && o.corps.ok === true && a.map((x) => x.appel).join(',') === 'GetMyeBaySelling,VerifyAddFixedPriceItem,AddFixedPriceItem',
      'programmer ⇒ relire ses annonces, PUIS vérifier à blanc, PUIS ajouter — dans cet ordre', `HTTP ${o.code} · ${appels(o.journal)}`);
    dit(/<SKU>VRM-B125<\/SKU>/.test(addCorps) && !/VRM-999/.test(addCorps), 'le SKU vient du N° (« b 125 » ⇒ VRM-B125), jamais du `sku` du navigateur', (/<SKU>[^<]*<\/SKU>/.exec(addCorps) || ['∅'])[0]);
    const itemDe = (s) => (/<Item>[\s\S]*<\/Item>/.exec(s) || [''])[0];
    dit(/<UUID>ABCDEF0123456789ABCDEF0123456789<\/UUID>/.test(itemDe(addCorps)) && !/<UUID>/.test(verifCorps),
      "l'UUID part à l'AJOUT (dans <Item>) et jamais à la vérification");
    dit(itemDe(addCorps).replace(/<UUID>[^<]*<\/UUID>/, '') === itemDe(verifCorps),
      "la vérification et l'ajout envoient le MÊME <Item>, à l'UUID près");
    dit(new RegExp(`<Item>[\\s\\S]*<ScheduleTime>${p.scheduleTime}</ScheduleTime>[\\s\\S]*</Item>`).test(addCorps), `<ScheduleTime> part en UTC DANS <Item> (${p.scheduleTime})`);
    dit(o.corps.debut === p.scheduleTime && /^\d+$/.test(o.corps.itemId) && o.corps.enLigneMaintenant === false && o.corps.frais && o.corps.frais.programmation === 0.2,
      "la réponse rend l'ItemID et l'heure RETENUE par eBay, et les frais lus par nom", JSON.stringify({ id: o.corps.itemId, debut: o.corps.debut }));
    const lg = /<GetMyeBaySellingRequest[\s\S]*<ActiveList><Include>true<\/Include>[\s\S]*<ScheduledList><Include>true<\/Include>/.test((a[0] || {}).corps || '');
    dit(lg, 'la relecture demande les annonces EN LIGNE et PROGRAMMÉES (<ScheduledList><Include>true)');
    dit(!o.journal.some((x) => x.ou === 'base'), "programmer n'écrit rien en base (la vérité est chez eBay)");
  });
  await essaie('programmer : une paire, une annonce', async () => {
    remettre();
    ebay['at-J'].programmees.push(annonce('110000000500', 'Salomon XT-6', 'VRM-30', '120.0', iso(Date.now() + 3 * JOUR)));
    const o = await app(JWT_J, prog());
    dit(o.code === 409 && o.corps.reason === 'deja-programmee' && o.corps.itemId === '110000000500' && !auCompte(o.journal).some((x) => /Verify|AddFixed/.test(x.appel)),
      'la paire N°30 déjà PROGRAMMÉE sur eBay ⇒ 409, ni vérification ni ajout', `HTTP ${o.code} · ${appels(o.journal)}`);
    remettre();
    ebay['at-J'].actives.push(annonce('110000000501', 'Salomon XT-6', 'VRM-30', '120.0', '2026-09-01T10:00:00.000Z'));
    const o2 = await app(JWT_J, prog());
    dit(o2.code === 409 && o2.corps.reason === 'deja-en-ligne' && !auCompte(o2.journal).some((x) => /AddFixed/.test(x.appel)),
      'la paire déjà EN LIGNE sur eBay ⇒ 409 « déjà en vente », rien d\'ajouté', `HTTP ${o2.code}`);
    remettre(); mode.liste = 'ko';
    const o3 = await app(JWT_J, prog());
    dit(o3.code === 503 && o3.corps.reason === 'pas-su' && !auCompte(o3.journal).some((x) => /AddFixed|Verify/.test(x.appel)),
      'ses annonces illisibles ⇒ 503 « pas su », rien n\'est programmé', `HTTP ${o3.code}`);
    // Plus de 5 pages de programmées : la liste est INCOMPLÈTE, l'absence de la
    // paire n'est pas prouvée.
    remettre();
    for (let k = 0; k < 7; k++) ebay['at-J'].programmees.push(annonce('11000000097' + k, 'P' + k, 'VRM-6' + k, '10.0', iso(Date.now() + JOUR)));
    ebay['at-J'].pagesProg = 7;
    const o4 = await app(JWT_J, prog());
    const lectures = auCompte(o4.journal).filter((x) => x.appel === 'GetMyeBaySelling').length;
    dit(o4.code === 503 && o4.corps.reason === 'pas-su' && lectures === 5 && !auCompte(o4.journal).some((x) => /AddFixed|Verify/.test(x.appel)),
      'plus de 5 pages de programmées ⇒ liste incomplète (5 pages lues) : l\'absence n\'est pas prouvée, rien n\'est programmé', `HTTP ${o4.code} · ${lectures} page(s)`);
  });
  // « VRM-030 », « vrm-30 », « VRM 30 » (retapé dans le Seller Hub) désignent
  // la N°30 — la même lecture que l'app (revue du 6 octobre).
  await essaie('une paire, une annonce : formes du SKU', async () => {
    for (const forme of ['VRM-030', 'vrm-30', 'VRM 30', 'VRM30']) {
      remettre();
      ebay['at-J'].programmees.push(annonce('110000000510', 'Salomon XT-6', forme, '120.0', iso(Date.now() + 3 * JOUR)));
      const o = await app(JWT_J, prog());
      remettre();
      ebay['at-J'].actives.push(annonce('110000000511', 'Salomon XT-6', forme, '120.0', '2026-09-01T10:00:00.000Z'));
      const o2 = await app(JWT_J, { action: 'publish', item: { ...item, numero: '30' } });
      dit(o.code === 409 && o.corps.reason === 'deja-programmee' && o2.code === 409 && o2.corps.reason === 'deja-en-ligne' && ![o, o2].some((x) => auCompte(x.journal).some((y) => /AddFixed/.test(y.appel))),
        `une annonce sous « ${forme} » est la N°30 : programmer et publier la refusent (409), rien d'ajouté`, `programmer HTTP ${o.code} · publier HTTP ${o2.code}`);
    }
    remettre();
    ebay['at-J'].actives.push(annonce('110000000512', 'Autre', 'VRM-300', '50.0', '2026-09-01T10:00:00.000Z'));
    const o3 = await app(JWT_J, { action: 'publish', item: { ...item, numero: '30' } });
    dit(o3.code === 200 && o3.corps.ok === true, 'l\'autre sens : « VRM-300 » n\'est PAS la N°30 — la publication part', `HTTP ${o3.code}`);
  });
  // « Publier » avait AUCUNE garde : une paire déjà en vente ou programmée
  // repartait en seconde annonce (revue du 6 octobre, prouvé).
  await essaie('publier : une paire, une annonce', async () => {
    remettre();
    const o = await app(JWT_J, { action: 'publish', item: { ...item, numero: '22' } });
    const n = ebay['at-J'].actives.filter((x) => x.sku === 'VRM-22').length;
    dit(o.code === 409 && o.corps.reason === 'deja-en-ligne' && n === 1 && !auCompte(o.journal).some((x) => /AddFixed/.test(x.appel)),
      'publier la N°22, déjà EN LIGNE ⇒ 409, eBay n\'a toujours qu\'une annonce VRM-22', `HTTP ${o.code} · ${n} annonce(s)`);
    remettre();
    ebay['at-J'].programmees.push(annonce('110000000777', 'Salomon XT-6', 'VRM-30', '120.0', iso(Date.now() + JOUR)));
    const o2 = await app(JWT_J, { action: 'publish', item: { ...item, numero: '30' } });
    const n2 = [...ebay['at-J'].actives, ...ebay['at-J'].programmees].filter((x) => x.sku === 'VRM-30').length;
    dit(o2.code === 409 && o2.corps.reason === 'deja-programmee' && o2.corps.itemId === '110000000777' && n2 === 1,
      'publier la N°30, PROGRAMMÉE pour demain ⇒ 409 « déjà programmée », une seule annonce VRM-30', `HTTP ${o2.code} · ${n2} annonce(s)`);
    remettre(); mode.liste = 'ko';
    const o3 = await app(JWT_J, { action: 'publish', item: { ...item, numero: '30' } });
    dit(o3.code === 503 && o3.corps.reason === 'pas-su' && !auCompte(o3.journal).some((x) => /AddFixed/.test(x.appel)),
      'ses annonces illisibles ⇒ 503 « pas su », rien n\'est publié', `HTTP ${o3.code}`);
    remettre();
    const o4 = await app(JWT_J, { action: 'publish', item: { ...item } });
    dit(o4.code === 200 && o4.corps.ok === true && !auCompte(o4.journal).some((x) => x.appel === 'GetMyeBaySelling'),
      'l\'autre sens : une annonce SANS N° (pas de SKU, rien à comparer) part comme avant', `HTTP ${o4.code} · ${appels(o4.journal)}`);
  });
  // Une passerelle 5xx sans <Ack> APRÈS qu'eBay a agi : « incertain », jamais
  // « refusé » (sinon le brouillon reste à republier — une seconde annonce).
  await essaie('eBay sans réponse claire', async () => {
    remettre(); uuidsVus.clear(); mode.add = '503-apres';
    const o = await app(JWT_J, prog());
    const n = ebay['at-J'].programmees.filter((x) => x.sku === 'VRM-30').length;
    dit(o.code === 504 && o.corps.reason === 'incertain' && n === 1, 'programmer : eBay crée l\'annonce puis répond 503 en HTML ⇒ 504 « incertain », jamais « refusée »', `HTTP ${o.code} · ${o.corps && o.corps.error}`);
    remettre(); mode.add = '503-apres';
    const o2 = await app(JWT_J, { action: 'publish', item: { ...item, numero: '401' } });
    dit(o2.code === 504 && o2.corps.reason === 'incertain', 'publier : même cas ⇒ 504 « incertain »', `HTTP ${o2.code}`);
    const avecProg0 = (dans) => { remettre(); ebay['at-J'].programmees.push(annonce('110000000900', 'Salomon XT-6', 'VRM-30', '120.0', iso(Date.now() + dans))); };
    avecProg0(2 * JOUR); mode.end = '503-apres';
    const o3 = await app(JWT_J, { action: 'deprogrammer', itemId: '110000000900', confirme: true });
    dit(o3.code === 504 && o3.corps.reason === 'incertain', 'annuler : eBay annule puis répond 503 ⇒ « incertain », jamais « eBay a refusé »', `HTTP ${o3.code}`);
    avecProg0(3 * JOUR); mode.revise = '503-apres';
    const o4 = await app(JWT_J, { action: 'reprogrammer', itemId: '110000000900', scheduleTime: iso(Date.now() + 4 * JOUR), confirme: true });
    dit(o4.code === 504 && o4.corps.reason === 'incertain', 'déplacer : même cas ⇒ « incertain »', `HTTP ${o4.code}`);
    remettre(); mode.end = '503-apres';
    const o5 = await app(JWT_J, { action: 'retirer', itemId: '110000000001', confirme: true });
    dit(o5.code === 504 && o5.corps.reason === 'incertain', 'retirer : même cas ⇒ « incertain »', `HTTP ${o5.code}`);
    remettre(); mode.end = 'refus';
    const o6 = await app(JWT_J, { action: 'retirer', itemId: '110000000001', confirme: true });
    dit(o6.code !== 504 && o6.corps.ok === false && o6.corps.reason !== 'incertain', 'l\'autre sens : un VRAI refus d\'eBay (Ack Failure) reste un refus', `HTTP ${o6.code}`);
  });
  await essaie('programmer : les frais', async () => {
    remettre(); mode.verif = 'cher';
    const o = await app(JWT_J, prog({ fraisVus: 0.2 }));
    dit(o.code === 409 && o.corps.reason === 'frais' && !auCompte(o.journal).some((x) => x.appel === 'AddFixedPriceItem'),
      'eBay annonce 0,55 € quand il en a vu 0,20 € ⇒ 409 « frais », AUCUN ajout', `HTTP ${o.code}`);
    remettre(); mode.verif = 'sansTotal';
    const o2 = await app(JWT_J, prog());
    dit(o2.code === 502 && o2.corps.reason === 'frais-pas-su' && !auCompte(o2.journal).some((x) => x.appel === 'AddFixedPriceItem'),
      'eBay n\'annonce pas son total ⇒ rien n\'est programmé sans connaître les frais', `HTTP ${o2.code}`);
    remettre(); mode.verif = 'refus';
    const o3 = await app(JWT_J, prog());
    dit(o3.code === 200 && o3.corps.ok === false && o3.corps.etape === 'verif' && /trop petite/.test(o3.corps.error || '') && !auCompte(o3.journal).some((x) => x.appel === 'AddFixedPriceItem'),
      'eBay refuserait à la vérification ⇒ son message remonte, rien n\'est ajouté', `HTTP ${o3.code}`);
  });
  await essaie('programmer : eBay ignore ou décale l\'heure', async () => {
    remettre(); mode.add = 'decale';
    const p = prog();
    const o = await app(JWT_J, p);
    dit(o.code === 200 && o.corps.debut === iso(Date.parse(p.scheduleTime) + 15 * MIN) && o.corps.demande === p.scheduleTime,
      "eBay retient un quart d'heure plus tard ⇒ c'est SON heure qui est rendue (`debut`), à côté de la demande", `debut=${o.corps && o.corps.debut}`);
    remettre(); mode.add = 'maintenant';
    const o2 = await app(JWT_J, prog());
    dit(o2.code === 200 && o2.corps.enLigneMaintenant === true, "eBay l'a mise en ligne TOUT DE SUITE ⇒ `enLigneMaintenant`, jamais « programmée »", `enLigneMaintenant=${o2.corps && o2.corps.enLigneMaintenant}`);
  });
  await essaie('programmer : coupure puis second envoi', async () => {
    remettre(); uuidsVus.clear(); mode.add = 'reseau-apres';
    const o = await app(JWT_J, prog());
    dit(o.code === 504 && o.corps.reason === 'incertain', 'le réseau tombe après l\'ajout ⇒ « incertain », jamais « refusée »', `HTTP ${o.code}`);
    mode.add = 'ok';
    const o2 = await app(JWT_J, prog());
    const n = ebay['at-J'].programmees.filter((x) => x.sku === 'VRM-30').length;
    dit(o2.code === 409 && o2.corps.reason === 'deja-programmee' && n === 1,
      'le second envoi trouve la paire déjà programmée (relue par SKU) ⇒ eBay n\'a qu\'UNE annonce pour elle', `HTTP ${o2.code} · ${n} annonce(s)`);
  });
  await essaie('programmer : 488', async () => {
    remettre(); uuidsVus.clear(); mode.add = '488';
    const o = await app(JWT_J, prog());
    dit(o.code === 200 && o.corps.ok === true && o.corps.deja === true && /^\d+$/.test(o.corps.itemId) && auCompte(o.journal).some((x) => x.appel === 'GetItem'),
      '488 « UUID déjà utilisé » CONFIRMÉ par GetItem (même SKU) ⇒ « déjà programmée », avec son ItemID', `HTTP ${o.code} · ${appels(o.journal)}`);
    remettre(); uuidsVus.clear(); mode.add = '488'; mode.getitem = 'autre';
    const o2 = await app(JWT_J, prog());
    dit(o2.code === 504 && o2.corps.reason === 'incertain' && o2.corps.ok === false, '488 dont l\'annonce porte un AUTRE SKU ⇒ « incertain », jamais ok', `HTTP ${o2.code}`);
  });
  await essaie('programmer tout de suite', async () => {
    remettre();
    const o = await app(JWT_J, prog({ scheduleTime: '', fraisVus: 0 }));
    const ad = auCompte(o.journal).find((x) => x.appel === 'AddFixedPriceItem');
    dit(o.code === 200 && ad && !/<ScheduleTime>/.test(ad.corps) && /<UUID>/.test(ad.corps),
      'sans heure (« tout de suite ») : aucun <ScheduleTime>, mais toujours l\'UUID et la relecture', `HTTP ${o.code}`);
  });
  await essaie('programmer : rien ne fuit', async () => {
    remettre(); mode.add = 'deuxErreurs';
    const o = await app(JWT_J, prog());
    dit(o.code === 422 && sansJeton(o) && !/<\?xml|<Errors>/.test(JSON.stringify(o.corps)), 'un refus rend le message d\'eBay — ni jeton, ni XML brut', `HTTP ${o.code}`);
  });

  // ── 8. LIRE LES PROGRAMMÉES · LA SYNCHRO DÉCOUPÉE PAR CONTENEUR ────────────
  await essaie('programmees', async () => {
    remettre();
    ebay['at-J'].programmees.push(annonce('110000000600', 'New Balance 550', 'VRM-24', '90.0', iso(Date.now() + JOUR)));
    const o = await app(JWT_J, { action: 'programmees' });
    const w = ecrit(o.journal, 'ebay_programmees');
    dit(o.code === 200 && o.corps.items.length === 1 && o.corps.items[0].sku === 'VRM-24' && o.corps.items[0].debut && w && w.owner === J && w.data.items.length === 1,
      '« programmees » lit la liste des programmées et la range chez le vendeur', `HTTP ${o.code} · ${w ? w.owner : 'rien rangé'}`);
    dit(Array.isArray(o.corps.enLigne) && o.corps.enLigne.some((x) => x.sku === 'VRM-22'), 'et rend les identités EN LIGNE (ce qui dit qu\'une programmée est bien partie)');
    mode.liste = 'ko';
    const o2 = await app(JWT_J, { action: 'programmees' });
    dit(o2.code >= 500 && ecrit(o2.journal, 'ebay_programmees') === null,
      'eBay ne répond pas ⇒ 5xx et AUCUNE écriture : la dernière capture reste (« rien lu » ne vaut pas « rien »)', `HTTP ${o2.code}`);
  });
  await essaie('pagination des programmées', async () => {
    remettre();
    ebay['at-J'].programmees.push(annonce('110000000701', 'A', 'VRM-41', '10.0', iso(Date.now() + JOUR)), annonce('110000000702', 'B', 'VRM-42', '10.0', iso(Date.now() + JOUR)));
    ebay['at-J'].pagesProg = 2;
    const o = await app(JWT_J, { action: 'programmees' });
    const ls = auCompte(o.journal).filter((x) => x.appel === 'GetMyeBaySelling');
    dit(o.code === 200 && o.corps.items.length === 2 && ls.length === 2 && /<ScheduledList>[\s\S]*<PageNumber>2<\/PageNumber>/.test(ls[1].corps) && !/<ActiveList>/.test(ls[1].corps),
      'deux pages de programmées ⇒ la page 2 est lue (et seulement la liste qui en a une)', `${o.corps && o.corps.items.length} programmée(s) · ${ls.length} appel(s)`);
  });
  await essaie('sync découpée par conteneur', async () => {
    remettre();
    ebay['at-J'].actives = [ANNONCES_J()[0]];
    ebay['at-J'].programmees = [annonce('110000000800', 'Asics Gel', 'VRM-25', '70.0', iso(Date.now() + 2 * JOUR))];
    const o = await app(JWT_J, { action: 'sync' });
    const L = ecrit(o.journal, 'ebay_listings'), P = ecrit(o.journal, 'ebay_programmees');
    dit(L && L.data.items.length === 1 && L.data.items[0].itemId === '110000000001' && P && P.data.items.length === 1 && P.data.items[0].itemId === '110000000800',
      'la synchro range 1 annonce EN LIGNE et 1 PROGRAMMÉE, chacune à sa place (une programmée n\'est jamais « en ligne »)',
      `en ligne : ${L ? L.data.items.map((x) => x.itemId).join(',') : '∅'} · programmées : ${P ? P.data.items.map((x) => x.itemId).join(',') : '∅'}`);
  });
  await essaie('sync', async () => {
    remettre();
    const o = await app(JWT_J, { action: 'sync' });
    const L = ecrit(o.journal, 'ebay_listings');
    const a1 = L && L.data.items.find((x) => x.itemId === '110000000001');
    const a2 = L && L.data.items.find((x) => x.itemId === '110000000002');
    dit(o.code === 200 && !!a1 && a1.sku === 'VRM-22', 'la synchro range le SKU de chaque annonce (VRM-22)', a1 ? 'sku=' + a1.sku : 'rien rangé');
    dit(!!a2 && a2.sku === '', "le SKU d'une VARIANTE ne devient pas celui de l'annonce", a2 ? 'sku=' + JSON.stringify(a2.sku) : 'absente');
    dit(!!a1 && a1.observateurs === 3 && a1.vues === '3' && !!a2 && a2.observateurs === null, 'les observateurs sont rangés en nombre — absents ⇒ null, jamais 0');
    dit(sansJeton(o), 'la réponse de la synchro ne transporte aucun jeton');
  });
  await essaie('sync annonces illisibles', async () => {
    remettre(); mode.liste = 'ko';
    const o = await app(JWT_J, { action: 'sync' });
    dit(ecrit(o.journal, 'ebay_listings') === null && ecrit(o.journal, 'ebay_programmees') === null,
      'eBay ne rend pas les annonces ⇒ annonces ET programmées gardent leur dernière capture');
  });
  await essaie('sync commandes illisibles', async () => {
    remettre(); mode.commandes = 'ko';
    const o = await app(JWT_J, { action: 'sync' });
    dit(ecrit(o.journal, 'ebay_orders') === null && ecrit(o.journal, 'ebay_listings') !== null,
      'eBay ne rend pas les commandes ⇒ elles gardent leur dernière capture, les annonces lues sont rangées quand même');
  });

  // ── 9. ANNULER · DÉPLACER ──────────────────────────────────────────────────
  const avecProg = (debutDans) => { remettre(); ebay['at-J'].programmees.push(annonce('110000000900', 'Salomon XT-6', 'VRM-30', '120.0', iso(Date.now() + debutDans))); };
  await essaie('annuler', async () => {
    avecProg(2 * JOUR);
    const o = await app(JWT_J, { action: 'deprogrammer', itemId: '110000000900', confirme: true });
    dit(o.code === 200 && o.corps.ok === true && o.corps.verifie === true && appels(o.journal) === 'GetMyeBaySelling,EndFixedPriceItem,GetMyeBaySelling',
      'annuler une programmée ⇒ relire, EndFixedPriceItem, relire : elle a disparu (verifie:true)', `HTTP ${o.code} · ${appels(o.journal)}`);
    avecProg(2 * JOUR); mode.end = 'refus';
    const o2 = await app(JWT_J, { action: 'deprogrammer', itemId: '110000000900', confirme: true });
    dit(o2.code === 422 && o2.corps.reason === 'refus' && /ne peut pas être terminée/.test(o2.corps.error || ''),
      "eBay refuse l'annulation ⇒ SA réponse remonte telle quelle (l'écran renvoie au Seller Hub)", `HTTP ${o2.code} · ${o2.corps && o2.corps.error}`);
    avecProg(2 * JOUR); mode.end = 'reste';
    const o3 = await app(JWT_J, { action: 'deprogrammer', itemId: '110000000900', confirme: true });
    dit(o3.code === 409 && o3.corps.reason === 'toujours-programmee', 'eBay dit « fait » mais elle est toujours programmée ⇒ on le dit (409), jamais « annulée »', `HTTP ${o3.code}`);
    remettre();
    const o4 = await app(JWT_J, { action: 'deprogrammer', itemId: '110000000001', confirme: true });
    dit(o4.code === 409 && o4.corps.reason === 'pas-programmee' && o4.corps.enLigne === true && !auCompte(o4.journal).some((x) => x.appel === 'EndFixedPriceItem'),
      'une annonce déjà EN LIGNE n\'est pas « annulée » ici (409, renvoi vers « Retirer d\'eBay »), zéro End', `HTTP ${o4.code}`);
    remettre(); mode.liste = 'ko';
    const o5 = await app(JWT_J, { action: 'deprogrammer', itemId: '110000000900', confirme: true });
    dit(o5.code === 503 && !auCompte(o5.journal).some((x) => x.appel === 'EndFixedPriceItem'), 'liste illisible ⇒ 503, on ne termine jamais à l\'aveugle', `HTTP ${o5.code}`);
  });
  await essaie('déplacer', async () => {
    avecProg(3 * H);
    const nouv = iso(Date.now() + 2 * JOUR);
    const o = await app(JWT_J, { action: 'reprogrammer', itemId: '110000000900', scheduleTime: nouv, confirme: true });
    const rv = auCompte(o.journal).find((x) => x.appel === 'ReviseFixedPriceItem');
    dit(o.code === 200 && rv && new RegExp(`<Item><ItemID>110000000900</ItemID><ScheduleTime>${nouv}</ScheduleTime></Item>`).test(rv.corps) && o.corps.debut === nouv,
      'déplacer à plus d\'1 h du départ ⇒ ReviseFixedPriceItem avec la nouvelle heure UTC, relue chez eBay', `HTTP ${o.code} · debut=${o.corps && o.corps.debut}`);
    avecProg(40 * MIN);
    const o2 = await app(JWT_J, { action: 'reprogrammer', itemId: '110000000900', scheduleTime: nouv, confirme: true });
    dit(o2.code === 409 && o2.corps.reason === 'derniere-heure' && !auCompte(o2.journal).some((x) => x.appel === 'ReviseFixedPriceItem'),
      'à moins d\'1 h du départ (relu chez eBay) ⇒ 409 « dernière heure », zéro Revise', `HTTP ${o2.code}`);
    avecProg(3 * H);
    const o3 = await app(JWT_J, { action: 'reprogrammer', itemId: '110000000900', scheduleTime: iso(Date.now() + 22 * JOUR), confirme: true });
    dit(o3.code === 400 && o3.corps.reason === 'heure' && chezEbay(o3.journal).length === 0, 'une nouvelle heure à plus de 3 semaines ⇒ 400, zéro appel', `HTTP ${o3.code}`);
  });

  // ── 10. LIMITES DE VENTE ───────────────────────────────────────────────────
  await essaie('limites', async () => {
    remettre();
    const o = await app(JWT_J, { action: 'limites' });
    const e = auCompte(o.journal)[0] || {};
    dit(o.code === 200 && o.corps.quantite === 10 && o.corps.montant === 500 && o.corps.devise === 'EUR' && /sell\/account\/v1\/privilege/.test(e.u),
      '« limites » lit /sell/account/v1/privilege : 10 annonces, 500 € par mois', JSON.stringify(o.corps));
    mode.priv = 'vide';
    const o2 = await app(JWT_J, { action: 'limites' });
    dit(o2.code === 200 && o2.corps.quantite === null && o2.corps.montant === null, 'aucune limite dans la réponse ⇒ null (« pas su »), jamais 0', JSON.stringify(o2.corps));
    mode.priv = '403';
    const o3 = await app(JWT_J, { action: 'limites' });
    dit(o3.corps && o3.corps.ok === false && o3.corps.reason === 'scope' && !('quantite' in o3.corps), 'droit refusé ⇒ « scope », aucun nombre');
    mode.priv = '500';
    const o4 = await app(JWT_J, { action: 'limites' });
    dit(o4.code >= 500 && o4.corps.ok === false && !('quantite' in o4.corps), 'eBay en panne ⇒ échec dit, aucun nombre inventé', `HTTP ${o4.code}`);
  });

  // ── 11. BASE PAS ENCORE CLOISONNÉE : rejouée dans un processus neuf ─────────
  await essaie('base non cloisonnée', async () => {
    const args = [__filename, '--non-cloisonnee'];
    if (iSrc > 0) args.push('--src', RACINE);
    const r = cp.spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 60000 });
    const sortie = String(r.stdout || '');
    process.stdout.write(sortie.split('\n').filter((l) => /^(✅|❌)/.test(l)).map((l) => '   ' + l).join('\n') + '\n');
    const m = /NC ok=(\d+) ko=(\d+)/.exec(sortie);
    dit(!!m && m[2] === '0' && Number(m[1]) >= 3, 'base non cloisonnée : comportement d\'avant à l\'identique', m ? m[0] : String(r.stderr || '').slice(0, 160));
  });

  console.log(ko ? `\n❌ audit-ebay-route : ${ko} rouge(s), ${ok} vert(s)`
                 : `\n✅ audit-ebay-route : ${ok} contrôles — chaque vendeur pilote SON eBay et jamais celui d'un autre ; ce qui engage exige sa confirmation ; frais lus par nom ; programmer, annuler, déplacer disent ce qu'eBay a vraiment fait`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('❌ audit-ebay-route est tombé :', e && e.message); process.exit(1); });
