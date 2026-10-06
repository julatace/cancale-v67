// ════════════════════════════════════════════════════════════════════════════
//  LA ROUTE eBAY, EXÉCUTÉE : qui peut piloter le compte eBay de Julien ?
//        node scripts/audit-ebay-route.cjs [--src dossier]
//
//  Mesuré le 5 octobre : `/api/ebay` n'exigeait AUCUNE session, et le compte
//  eBay de Julien est connecté en production (une ligne `ebay_tokens` avec son
//  jeton de renouvellement). N'importe qui sur Internet pouvait donc :
//    · lister ses commandes eBay (avec les acheteurs), lire ses finances ;
//    · publier ou modifier une annonce sur SON compte eBay ;
//    · ouvrir lui-même la page de consentement d'eBay (l'adresse ne contient
//      rien de secret), s'y connecter avec SON compte, et le retour rangeait ce
//      jeton à la place de celui de Julien : ses publications partaient alors
//      sur le compte d'un inconnu.
//
//  Le banc lance la VRAIE route, avec une fausse base, un faux eBay et un faux
//  service d'identité, et compte ce qui part chez eBay. Il vérifie les deux
//  sens : le propriétaire connecté pilote toujours eBay, et une connexion qu'il
//  a lui-même demandée aboutit.
//
//  ── ET LES QUATRE GESTES DU 5 OCTOBRE (« tu as accès à mon compte et tu ne
//  fais rien de ouf ») : relier une annonce à sa paire (`sku`), savoir à quelle
//  annonce eBay accepte une offre (`offreinfo`), l'envoyer aux observateurs
//  (`offre`), et retirer une annonce vendue ailleurs (`retirer`). On exige :
//    · les mêmes gardes que le reste (sans session 401, un autre vendeur 403,
//      ZÉRO appel eBay) ;
//    · `offre` et `retirer` refusés sans `confirme:true` — refusés PARCE QUE
//      non confirmés, et avant tout appel à eBay ;
//    · une remise hors 5–50 %, un identifiant qui n'est pas que des chiffres,
//      un numéro illisible : refusés, zéro appel eBay ;
//    · l'offre REVÉRIFIÉE chez eBay au moment d'envoyer : une annonce sans
//      observateur éligible, ou une vérification qui échoue ⇒ rien n'est posté ;
//    · le SKU est `VRM-{cleNum(n°)}` — la MÊME règle que l'app (exécutée ici,
//      extraite d'App.jsx), à la publication comme à la liaison, et jamais
//      recopié d'un `sku` envoyé par le navigateur ;
//    · la synchro lit le SKU (pas celui d'une variante) et les observateurs,
//      et une lecture ratée ne remplace JAMAIS la dernière capture par du vide ;
//    · aucune réponse ne transporte un jeton, même quand eBay en renvoie un.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'le contrôle a levé : ' + String(e && e.message || e).slice(0, 160)); } };

const J = '11111111-1111-1111-1111-111111111111';   // propriétaire de l'installation
const B = '22222222-2222-2222-2222-222222222222';   // un autre vendeur
// Un JWT a trois morceaux : le contrôle de forme du serveur l'exige.
const JWT_J = 'eyJh.jeton-de-J.sig', JWT_B = 'eyJh.jeton-de-B.sig';

process.env.VRM_OWNER_UID = J;
process.env.EBAY_APP_ID = 'app-de-banc';
process.env.EBAY_CERT_ID = 'secret-de-banc';
process.env.EBAY_RUNAME = 'runame-de-banc';
process.env.SUPABASE_SERVICE_KEY = 'cle-service-de-banc';

// ── LE FAUX eBAY ─────────────────────────────────────────────────────────────
// Données INVENTÉES (le dépôt est public). Deux annonces actives : la première
// porte un SKU VRM et 3 observateurs ; la seconde n'a de SKU que sur une de ses
// VARIANTES (qui ne doit pas devenir le SKU de l'annonce).
const ANNONCES_XML = '<?xml version="1.0" encoding="UTF-8"?><GetMyeBaySellingResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack><ActiveList><ItemArray>'
  + '<Item><ItemID>110000000001</ItemID><Title>Adidas Gazelle bleu taille 40</Title><SKU>VRM-22</SKU><WatchCount>3</WatchCount><QuantityAvailable>1</QuantityAvailable><SellingStatus><CurrentPrice currencyID="EUR">80.0</CurrentPrice><QuantitySold>0</QuantitySold></SellingStatus><ListingDetails><StartTime>2026-09-20T10:00:00.000Z</StartTime><ViewItemURL>https://www.ebay.fr/itm/110000000001</ViewItemURL></ListingDetails></Item>'
  + '<Item><ItemID>110000000002</ItemID><Title>Nike Dunk Low panda taille 42</Title><QuantityAvailable>2</QuantityAvailable><Variations><Variation><SKU>VAR-42</SKU></Variation></Variations><SellingStatus><CurrentPrice currencyID="EUR">100.0</CurrentPrice></SellingStatus></Item>'
  + '</ItemArray></ActiveList></GetMyeBaySellingResponse>';
const XML_OK = (inner) => `<?xml version="1.0"?><R xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack>${inner || ''}</R>`;
const XML_REFUS = '<?xml version="1.0"?><R xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Failure</Ack><Errors><ShortMessage>Refus</ShortMessage><LongMessage>Cette annonce est déjà terminée. v^1.1#SECRET-QUI-FUIRAIT</LongMessage></Errors></R>';
const ELIGIBLE = '110000000002';
let mode = {};
const remettre = () => { mode = { liste: 'ok', commandes: 'ok', eligibles: 'ok', envoi: 'ok', trading: 'ok' }; };
remettre();

const journal = [];       // ce qui part chez eBay, ce qui s'écrit en base
const rep = (corps, status = 200) => new Response(status === 204 ? null : (typeof corps === 'string' ? corps : JSON.stringify(corps)), { status, headers: { 'content-type': 'application/json' } });
const xml = (s) => new Response(s, { status: 200, headers: { 'content-type': 'text/xml' } });
global.fetch = async (url, opts = {}) => {
  const u = String(url);
  const m = (opts.method || 'GET').toUpperCase();
  const h = opts.headers || {};
  if (u.includes('/auth/v1/user')) {
    const a = String((h.Authorization || h.authorization) || '');
    if (a === 'Bearer ' + JWT_J) return rep({ id: J, email: 'j@exemple.test' });
    if (a === 'Bearer ' + JWT_B) return rep({ id: B, email: 'b@exemple.test' });
    return rep({ msg: 'invalid' }, 401);
  }
  if (u.includes('ebay.com')) {
    const appel = h['X-EBAY-API-CALL-NAME'] || '';
    journal.push({ ou: 'ebay', m, u: u.replace(/\?.*$/, ''), appel, corps: String(opts.body || ''), marche: h['X-EBAY-C-MARKETPLACE-ID'] || '' });
    if (u.includes('/identity/v1/oauth2/token')) return rep({ access_token: 'at-banc', expires_in: 7200, refresh_token: 'rt-banc', refresh_token_expires_in: 47304000 });
    if (u.includes('/ws/api.dll')) {
      if (appel === 'GetMyeBaySelling') return mode.liste === 'ko' ? xml(XML_REFUS) : xml(ANNONCES_XML);
      if (appel === 'GetItem') return xml(XML_OK('<Item><Description>x</Description></Item>'));
      if (mode.trading === 'reseau') throw new Error('ECONNRESET');
      if (mode.trading === 'refus') return xml(XML_REFUS);
      if (appel === 'AddFixedPriceItem') return xml(XML_OK('<ItemID>110000000777</ItemID>'));
      if (appel === 'EndFixedPriceItem') return xml(XML_OK('<EndTime>2026-10-05T12:00:00.000Z</EndTime>'));
      return xml(XML_OK());
    }
    if (u.includes('/sell/negotiation/v1/find_eligible_items')) {
      if (mode.eligibles === '204') return rep(null, 204);
      if (mode.eligibles === 'ko') return rep({ errors: [{ errorId: 150000, message: 'System error' }] }, 500);
      return rep({ eligibleItems: [{ listingId: ELIGIBLE }], total: 1, limit: 200, offset: 0 });
    }
    if (u.includes('/sell/negotiation/v1/send_offer_to_interested_buyers')) {
      if (mode.envoi === 'refus') return rep({ errors: [{ errorId: 150020, longMessage: 'Offre refusée par eBay. Bearer at-banc v^1.1#SECRET-QUI-FUIRAIT' }] }, 400);
      return rep({ offers: [{ offerId: 'o1', offerStatus: 'PENDING' }, { offerId: 'o2', offerStatus: 'PENDING' }] });
    }
    if (u.includes('/sell/fulfillment/v1/order')) return mode.commandes === 'ko' ? rep({ errors: [] }, 500) : rep({ orders: [{ orderId: '01-0001', lineItems: [{ sku: 'VRM-24' }] }], total: 1 });
    return rep({ orders: [], inventoryItems: [], total: 0 });
  }
  if (u.includes('/rest/v1/')) {
    if (m !== 'GET') { journal.push({ ou: 'base', m, u: decodeURIComponent(u), corps: String(opts.body || '') }); return rep('', 201); }
    if (u.includes('ebay_tokens')) return rep([{ refresh_token: 'rt-existant' }]);
    if (/select=owner&limit=1/.test(u)) return rep([{ owner: J }]);
    return rep([]);
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
    return { code: res.code, corps: res.corps, journal: journal.slice() };
  };
  const retourEbay = async (query) => {
    journal.length = 0;
    const res = faireRes();
    await route.default({ method: 'GET', query: { mode: 'callback', ...query }, headers: {} }, res);
    return { code: res.code, loc: res.entetes.location || '', journal: journal.slice() };
  };
  const chezEbay = (j) => j.filter((x) => x.ou === 'ebay');
  // Ce qui part chez eBay SANS compter le renouvellement du jeton (qui ne fait
  // rien au compte) : les vrais appels au compte eBay.
  const auCompte = (j) => chezEbay(j).filter((x) => !/oauth2\/token/.test(x.u));
  const ecritJetons = (j) => j.some((x) => x.ou === 'base' && /ebay_tokens|rt-banc/.test(x.u + ' ' + x.corps));
  const sansJeton = (o) => !/at-banc|rt-banc|rt-existant|v\^1\.1#|Bearer/.test(JSON.stringify(o && o.corps || {}));

  // ── 1. Les actions : session obligatoire, propriétaire seulement ────────────
  const NOUVELLES = ['sku', 'offreinfo', 'offre', 'retirer'];
  for (const action of ['sync', 'finances', 'publish', 'revise', ...NOUVELLES]) {
    await essaie('sans session : ' + action, async () => {
      const o = await app('', { action, item: { title: 'x' }, itemId: '110000000001', listingId: ELIGIBLE, numero: '22', remise: 10, confirme: true, price: '10' });
      dit(o.code === 401 && chezEbay(o.journal).length === 0,
        `sans session, « ${action} » est refusé et rien ne part chez eBay`,
        `HTTP ${o.code} · ${chezEbay(o.journal).length} appel(s) eBay`);
    });
  }
  for (const action of ['sync', ...NOUVELLES]) {
    await essaie('autre vendeur : ' + action, async () => {
      const o = await app(JWT_B, { action, itemId: '110000000001', listingId: ELIGIBLE, numero: '22', remise: 10, confirme: true });
      dit(o.code === 403 && chezEbay(o.journal).length === 0,
        `un autre vendeur connecté ne pilote pas « ${action} » sur le compte eBay de l'installation`,
        `HTTP ${o.code} · ${chezEbay(o.journal).length} appel(s) eBay`);
    });
  }
  await essaie('jeton falsifié', async () => {
    const o = await app('eyJh.faux.sig', { action: 'finances' });
    dit(o.code === 401 && chezEbay(o.journal).length === 0, 'un jeton que le service d\'identité ne reconnaît pas est refusé', `HTTP ${o.code}`);
  });
  // L'autre sens : le propriétaire connecté pilote toujours eBay.
  await essaie('propriétaire', async () => {
    const o = await app(JWT_J, { action: 'status' });
    dit(o.code === 200 && o.corps && o.corps.ok && o.corps.connected === true,
      "l'autre sens : le propriétaire connecté voit son compte eBay relié", `HTTP ${o.code} ${JSON.stringify(o.corps)}`);
  });

  // ── 2. Le retour de consentement : seulement s'il l'a demandé ──────────────
  await essaie('retour sans state', async () => {
    const o = await retourEbay({ code: 'code-d-un-inconnu' });
    dit(chezEbay(o.journal).length === 0 && !ecritJetons(o.journal),
      "un retour de consentement SANS demande signée n'échange ni ne range aucun jeton",
      `${chezEbay(o.journal).length} appel(s) eBay · jetons écrits : ${ecritJetons(o.journal)}`);
  });
  await essaie('retour state falsifié', async () => {
    const o = await retourEbay({ code: 'code-d-un-inconnu', state: 'vrm' });
    const o2 = await retourEbay({ code: 'code-d-un-inconnu', state: 'mg0abcd.' + '0'.repeat(40) });
    dit(chezEbay(o.journal).length === 0 && chezEbay(o2.journal).length === 0,
      'un state inventé (« vrm », ou une signature au hasard) est refusé',
      `${chezEbay(o.journal).length + chezEbay(o2.journal).length} appel(s) eBay`);
  });
  let etat = '';
  await essaie('demande du propriétaire', async () => {
    const o = await app(JWT_J, { action: 'authurl', state: 'vrm' });
    const url = (o.corps && o.corps.url) || '';
    etat = (/[?&]state=([^&]+)/.exec(url) || [])[1] || '';
    etat = decodeURIComponent(etat);
    dit(o.code === 200 && etat && etat !== 'vrm', "la demande de consentement porte un state fabriqué par le SERVEUR (pas celui du navigateur)", etat || url);
  });
  await essaie('retour valide', async () => {
    const o = await retourEbay({ code: 'code-de-julien', state: etat });
    dit(chezEbay(o.journal).some((x) => /oauth2\/token/.test(x.u)) && /ebay=connecte/.test(o.loc),
      "l'autre sens : la connexion qu'il a lui-même demandée aboutit", `${o.loc} · ${chezEbay(o.journal).length} appel(s) eBay`);
  });
  await essaie('retour expiré', async () => {
    const vrai = Date.now;
    try {
      Date.now = () => vrai() + 31 * 60 * 1000;
      const o = await retourEbay({ code: 'code-de-julien', state: etat });
      dit(chezEbay(o.journal).length === 0, 'une demande de plus de 30 minutes ne sert plus', `${chezEbay(o.journal).length} appel(s) eBay`);
    } finally { Date.now = vrai; }
  });

  // ── 3. CE QUI ENGAGE EXIGE `confirme:true` — vérifié AVANT eBay ────────────
  // On juge la RAISON du refus : sur le code d'avant, l'action inconnue est
  // aussi refusée en 400 sans appel — ce contrôle-là serait vert sur le défaut.
  for (const [action, corps] of [['retirer', { itemId: '110000000001' }], ['offre', { listingId: ELIGIBLE, remise: 10 }],
    ['retirer', { itemId: '110000000001', confirme: 'true' }], ['offre', { listingId: ELIGIBLE, remise: 10, confirme: 1 }]]) {
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
        `une remise de ${JSON.stringify(remise)} % est refusée (entre 5 et 50, entière), zéro appel eBay`,
        `HTTP ${o.code} · ${o.corps && (o.corps.reason || o.corps.error)}`);
    });
  }
  for (const [action, corps] of [['retirer', { itemId: '12a', confirme: true }], ['retirer', { itemId: '110</ItemID><X>', confirme: true }],
    ['sku', { itemId: '1 2', numero: '22' }], ['offre', { listingId: '1;2', remise: 10, confirme: true }], ['offre', { listingId: '', remise: 10, confirme: true }]]) {
    await essaie('identifiant ' + action, async () => {
      const o = await app(JWT_J, { action, ...corps });
      dit(o.code === 400 && /annonce eBay invalide/.test((o.corps && o.corps.error) || '') && chezEbay(o.journal).length === 0,
        `« ${action} » refuse un identifiant qui n'est pas que des chiffres (${JSON.stringify(corps.itemId || corps.listingId)}), zéro appel eBay`,
        `HTTP ${o.code} · ${o.corps && o.corps.error}`);
    });
  }
  for (const numero of ['zz', '', 'B1234567', '1234567', 'ABCD1', null]) {
    await essaie('numéro ' + numero, async () => {
      const o = await app(JWT_J, { action: 'sku', itemId: '110000000002', numero });
      dit(o.code === 400 && o.corps && o.corps.reason === 'numero' && chezEbay(o.journal).length === 0,
        `« sku » refuse un numéro illisible (${JSON.stringify(numero)}), zéro appel eBay`, `HTTP ${o.code} · ${o.corps && o.corps.error}`);
    });
  }
  await essaie('message trop long', async () => {
    const o = await app(JWT_J, { action: 'offre', listingId: ELIGIBLE, remise: 10, confirme: true, message: 'x'.repeat(2001) });
    dit(o.code === 400 && o.corps && o.corps.reason === 'message' && chezEbay(o.journal).length === 0,
      'un message de plus de 2 000 caractères est refusé (pas coupé en douce), zéro appel eBay', `HTTP ${o.code}`);
  });

  // ── 5. CE QUI PART CHEZ eBAY ──────────────────────────────────────────────
  // 5a. Le SKU : `VRM-{cleNum}`, la MÊME règle que l'app (§11).
  await essaie('règle de l\'app chargée', async () => {
    dit(typeof RA.skuEbayDe === 'function' && typeof RA.numDeSkuEbay === 'function',
      "la règle du SKU existe dans l'app (`skuEbayDe`, `numDeSkuEbay`) et se charge", Object.keys(RA).join(',') || 'absente');
  });
  for (const numero of ['22', '007', 'b125', ' B-125 ', 'c 12', 'AB3']) {
    await essaie('sku ' + numero, async () => {
      remettre();
      const o = await app(JWT_J, { action: 'sku', itemId: '110000000002', numero });
      const appels = auCompte(o.journal);
      const corps = (appels[0] && appels[0].corps) || '';
      const skuEnvoye = (/<SKU>([^<]*)<\/SKU>/.exec(corps) || [])[1] || '';
      const attendu = RA.skuEbayDe ? RA.skuEbayDe(numero) : '(règle de l\'app absente)';
      dit(o.code === 200 && appels.length === 1 && appels[0].appel === 'ReviseFixedPriceItem'
          && /<Item><ItemID>110000000002<\/ItemID><SKU>/.test(corps) && skuEnvoye === attendu && o.corps.sku === attendu,
        `« sku » ${JSON.stringify(numero)} ⇒ ReviseFixedPriceItem pose ${attendu} — la même règle que l'app`,
        `HTTP ${o.code} · ${appels.map((x) => x.appel).join(',')} · envoyé ${skuEnvoye || '∅'}`);
      dit(!!RA.numDeSkuEbay && RA.numDeSkuEbay(skuEnvoye) === RA.cleNum(numero),
        `et l'app relit ${skuEnvoye || '∅'} comme le N°${RA.cleNum ? RA.cleNum(numero) : '?'} (aller-retour sans perte)`);
    });
  }
  await essaie('lecture stricte du SKU', async () => {
    const cas = { 'VRM-22': '22', 'vrm-b125': 'B125', 'VRM 7': '7', '12345-ABC': '', 'VRM-22X': '', 'XVRM-22': '', '22': '', 'VAR-42': '' };
    const faux = RA.numDeSkuEbay ? Object.entries(cas).filter(([s, n]) => RA.numDeSkuEbay(s) !== n) : [['(absente)', '']];
    dit(faux.length === 0, "l'app ne lit un numéro QUE dans un SKU « VRM-… » entier — jamais dans un SKU à lui ni dans des chiffres nus",
      faux.map(([s]) => `${s}→${RA.numDeSkuEbay ? RA.numDeSkuEbay(s) : '?'}`).join(' · '));
  });
  // 5b. La publication porte le SKU de la paire — jamais celui du navigateur.
  const item = { title: 'Nike Dunk Low panda T42', categoryId: '15709', price: '100', photos: ['https://img.test/1.jpg'], aspects: { Marque: 'Nike' }, ebayGere: true };
  await essaie('publish avec numéro', async () => {
    remettre();
    const o = await app(JWT_J, { action: 'publish', item: { ...item, numero: '401' } });
    const add = auCompte(o.journal).find((x) => x.appel === 'AddFixedPriceItem');
    dit(o.code === 200 && add && /<SKU>VRM-401<\/SKU>/.test(add.corps) && o.corps.sku === 'VRM-401',
      'une paire publiée part avec son SKU VRM-401 (et la réponse le dit)', `HTTP ${o.code} · sku=${o.corps && o.corps.sku}`);
  });
  await essaie('publish sans numéro', async () => {
    remettre();
    const o = await app(JWT_J, { action: 'publish', item: { ...item, sku: 'EVIL-1' } });
    const add = auCompte(o.journal).find((x) => x.appel === 'AddFixedPriceItem');
    dit(o.code === 200 && add && !/<SKU>/.test(add.corps),
      "sans numéro, aucun SKU — et un `sku` envoyé par le navigateur n'est jamais recopié", add ? (/<SKU>[^<]*<\/SKU>/.exec(add.corps) || ['∅'])[0] : 'aucun appel');
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
  // 5c. L'offre aux observateurs.
  await essaie('offreinfo', async () => {
    remettre();
    const o = await app(JWT_J, { action: 'offreinfo' });
    const e = auCompte(o.journal)[0] || {};
    dit(o.code === 200 && o.corps && o.corps.ok === true && JSON.stringify(o.corps.eligibles) === JSON.stringify([ELIGIBLE]) && /find_eligible_items/.test(e.u) && e.m === 'GET' && e.marche === 'EBAY_FR',
      '« offreinfo » lit find_eligible_items (GET, marché EBAY_FR) et rend les annonces éligibles', `HTTP ${o.code} · ${JSON.stringify(o.corps)}`);
    mode.eligibles = '204';
    const o2 = await app(JWT_J, { action: 'offreinfo' });
    dit(o2.code === 200 && o2.corps && o2.corps.ok === true && Array.isArray(o2.corps.eligibles) && o2.corps.eligibles.length === 0,
      'eBay répond 204 (aucune annonce éligible) ⇒ « lu, aucune », pas une panne', `HTTP ${o2.code} · ${JSON.stringify(o2.corps)}`);
    mode.eligibles = 'ko';
    const o3 = await app(JWT_J, { action: 'offreinfo' });
    dit(o3.code >= 500 && o3.corps && o3.corps.ok === false && !('eligibles' in o3.corps),
      'eBay en panne ⇒ « pas su » (5xx, aucune liste) — jamais « aucun observateur »', `HTTP ${o3.code} · ${JSON.stringify(o3.corps)}`);
  });
  await essaie('offre éligible', async () => {
    remettre();
    const o = await app(JWT_J, { action: 'offre', listingId: ELIGIBLE, remise: 15, confirme: true, message: 'Toujours dispo, envoi rapide.' });
    const appels = auCompte(o.journal);
    const post = appels.find((x) => /send_offer_to_interested_buyers/.test(x.u));
    let corps = null; try { corps = JSON.parse(post && post.corps); } catch (_) {}
    const attendu = { allowCounterOffer: false, offerDuration: { unit: 'DAY', value: 2 }, offeredItems: [{ listingId: ELIGIBLE, discountPercentage: '15', quantity: 1 }], message: 'Toujours dispo, envoi rapide.' };
    const egal = (a, b) => JSON.stringify(a, Object.keys(a || {}).sort()) === JSON.stringify(b, Object.keys(b || {}).sort()) && JSON.stringify(a && a.offeredItems) === JSON.stringify(b.offeredItems) && JSON.stringify(a && a.offerDuration) === JSON.stringify(b.offerDuration);
    dit(o.code === 200 && o.corps && o.corps.ok === true && o.corps.envoyees === 2,
      'une offre confirmée sur une annonce éligible part, et la réponse dit à combien de personnes', `HTTP ${o.code} · ${JSON.stringify(o.corps)}`);
    dit(appels.length === 2 && /find_eligible_items/.test(appels[0].u) && post && post.m === 'POST' && post.marche === 'EBAY_FR',
      "l'éligibilité est REVÉRIFIÉE chez eBay juste avant l'envoi (GET puis POST, marché EBAY_FR)", appels.map((x) => x.m + ' ' + x.u.replace(/^.*\/v1\//, '')).join(' → '));
    dit(!!corps && egal(corps, attendu), 'le corps envoyé à eBay est exactement celui attendu (remise « 15 », 1 paire, 48 h, pas de contre-offre)', JSON.stringify(corps));
  });
  await essaie('offre non éligible', async () => {
    remettre();
    const o = await app(JWT_J, { action: 'offre', listingId: '110000000099', remise: 10, confirme: true });
    const post = auCompte(o.journal).some((x) => /send_offer/.test(x.u));
    dit(o.code === 409 && o.corps && o.corps.reason === 'non-eligible' && !post,
      'une annonce que find_eligible_items ne cite pas ⇒ refusée, RIEN n\'est posté', `HTTP ${o.code} · posté=${post}`);
  });
  await essaie('offre vérification en panne', async () => {
    remettre(); mode.eligibles = 'ko';
    const o = await app(JWT_J, { action: 'offre', listingId: ELIGIBLE, remise: 10, confirme: true });
    const post = auCompte(o.journal).some((x) => /send_offer/.test(x.u));
    dit(o.code >= 500 && o.corps && o.corps.ok === false && !post,
      "la vérification d'éligibilité échoue ⇒ « pas su » : RIEN n'est posté", `HTTP ${o.code} · posté=${post}`);
  });
  await essaie('offre refusée par eBay', async () => {
    remettre(); mode.envoi = 'refus';
    const o = await app(JWT_J, { action: 'offre', listingId: ELIGIBLE, remise: 10, confirme: true });
    dit(o.code === 400 && o.corps && o.corps.ok === false && /Offre refusée par eBay/.test(o.corps.error || '') && sansJeton(o),
      "un refus d'eBay remonte avec SON message — sans aucun jeton dedans", `HTTP ${o.code} · ${o.corps && o.corps.error}`);
  });
  // 5d. Retirer une annonce vendue ailleurs.
  await essaie('retirer', async () => {
    remettre();
    const o = await app(JWT_J, { action: 'retirer', itemId: '110000000001', confirme: true });
    const e = auCompte(o.journal);
    dit(o.code === 200 && o.corps && o.corps.ok === true && e.length === 1 && e[0].appel === 'EndFixedPriceItem'
        && /<ItemID>110000000001<\/ItemID><EndingReason>NotAvailable<\/EndingReason>/.test(e[0].corps),
      '« retirer » confirmé ⇒ EndFixedPriceItem (ItemID, raison NotAvailable), un seul appel', `HTTP ${o.code} · ${e.map((x) => x.appel).join(',')}`);
    mode.trading = 'refus';
    const o2 = await app(JWT_J, { action: 'retirer', itemId: '110000000001', confirme: true });
    dit(o2.code >= 400 && o2.corps && o2.corps.ok === false && /déjà terminée/.test(o2.corps.error || '') && sansJeton(o2),
      "un refus d'eBay remonte avec son message, sans jeton", `HTTP ${o2.code} · ${o2.corps && o2.corps.error}`);
    mode.trading = 'reseau';
    const o3 = await app(JWT_J, { action: 'retirer', itemId: '110000000001', confirme: true });
    dit(o3.code === 504 && o3.corps && o3.corps.reason === 'incertain',
      'eBay ne répond pas ⇒ « je ne sais pas si elle a été retirée » (jamais « retirée », jamais « pas retirée »)', `HTTP ${o3.code} · ${o3.corps && o3.corps.reason}`);
  });

  // ── 6. LA SYNCHRO : SKU, observateurs, et « rien lu ne vaut pas rien » ─────
  const ecrit = (j, id) => {
    const w = j.filter((x) => x.ou === 'base' && x.corps.includes(`"id":"${id}"`));
    if (!w.length) return null;
    try { const l = [].concat(JSON.parse(w[w.length - 1].corps)); return (l.find((r) => r.id === id) || {}).data || null; } catch (_) { return null; }
  };
  await essaie('sync', async () => {
    remettre();
    const o = await app(JWT_J, { action: 'sync' });
    const L = ecrit(o.journal, 'ebay_listings');
    const a1 = L && L.items && L.items.find((x) => x.itemId === '110000000001');
    const a2 = L && L.items && L.items.find((x) => x.itemId === '110000000002');
    dit(o.code === 200 && !!a1 && a1.sku === 'VRM-22', 'la synchro range le SKU de chaque annonce (VRM-22)', a1 ? 'sku=' + a1.sku : 'rien rangé');
    dit(!!a2 && a2.sku === '', "le SKU d'une VARIANTE ne devient pas celui de l'annonce", a2 ? 'sku=' + JSON.stringify(a2.sku) : 'absente');
    dit(!!a1 && a1.observateurs === 3 && a1.vues === '3' && !!a2 && a2.observateurs === null,
      'les observateurs (WatchCount) sont rangés en nombre — et absents ⇒ null, jamais 0 ; `vues` reste pour les lecteurs d\'avant',
      a1 ? `obs=${a1.observateurs} vues=${a1.vues} · sans=${a2 && a2.observateurs}` : '');
    dit(sansJeton(o), 'la réponse de la synchro ne transporte aucun jeton');
  });
  await essaie('sync annonces illisibles', async () => {
    remettre(); mode.liste = 'ko';
    const o = await app(JWT_J, { action: 'sync' });
    dit(ecrit(o.journal, 'ebay_listings') === null,
      'eBay ne rend pas les annonces ⇒ la dernière capture est GARDÉE (aucune liste vide écrite par-dessus)',
      ecrit(o.journal, 'ebay_listings') ? 'réécrite avec ' + JSON.stringify((ecrit(o.journal, 'ebay_listings').items || []).length) + ' annonce(s)' : 'gardée');
  });
  await essaie('sync commandes illisibles', async () => {
    remettre(); mode.commandes = 'ko';
    const o = await app(JWT_J, { action: 'sync' });
    dit(ecrit(o.journal, 'ebay_orders') === null && ecrit(o.journal, 'ebay_listings') !== null,
      'eBay ne rend pas les commandes ⇒ elles gardent leur dernière capture, les annonces lues sont rangées quand même',
      `commandes ${ecrit(o.journal, 'ebay_orders') ? 'réécrites' : 'gardées'} · annonces ${ecrit(o.journal, 'ebay_listings') ? 'rangées' : 'pas rangées'}`);
  });

  console.log(ko ? `\n❌ audit-ebay-route : ${ko} rouge(s), ${ok} vert(s)`
                 : `\n✅ audit-ebay-route : ${ok} contrôles — seul le propriétaire connecté pilote le compte eBay ; ce qui engage exige sa confirmation ; le SKU suit la règle de l'app`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('❌ audit-ebay-route est tombé :', e && e.message); process.exit(1); });
