// ════════════════════════════════════════════════════════════════════════════
//  eBAY : LA DESCRIPTION ET LE PRIX DE VINTED, ET « DEMANDÉE » ≠ « PUBLIÉE »
//        node scripts/audit-ebay-publication.cjs [--src dossier]
//
//  Julien, 15 octobre : « quand je publie une annonce sur eBay, que ça prenne la
//  description de Vinted et la copie sur eBay » ; « je veux que ça prenne le même
//  prix d'une plateforme à l'autre ». Prompt maître : « sans écraser une
//  personnalisation volontaire ni contourner les champs obligatoires eBay ;
//  aperçu et confirmation des différences » — et « vérifier après chaque
//  publication la plateforme, le compte, l'identifiant d'annonce et le résultat
//  réel ; ne pas confondre demandé et publié ».
//
//  Ce que l'audit EXÉCUTE (§4.10) :
//    A. la VRAIE route `api/ebay.js` (publish, relirepub) contre un faux eBay et
//       une fausse base : après l'ajout, UN GetItem relit l'annonce et la
//       réponse porte un verdict par point (en ligne, compte, référence, prix,
//       titre, quantité, photos) — jamais « publiée » sur une relecture ratée ;
//    B. la règle pure `verifPublication` (api/_lib/ebay-publication.js) sur des
//       réponses d'eBay servies à la main (autre prix, autre devise, annonce
//       terminée, autre vendeur, champs absents) ;
//    C. les règles de l'APP (extraites d'App.jsx, exécutées dans un `vm`) :
//       `repriseVinted` (vide ou encore celui de VRM ⇒ Vinted ; sinon SA saisie,
//       jamais écrasée), `ecartsVintedEbay` (la même liste pour l'écran et la
//       confirmation), `etatPublicationEbay`, `prixVinted`, et la règle de
//       description (`PAS_UNE_DESCRIPTION`) — la MÊME dans l'app et l'extension.
//  Données INVENTÉES (le dépôt est public).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
// Un audit ne meurt pas, il rapporte : ce qui lève devient un contrôle ROUGE.
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'le contrôle a levé : ' + String(e && e.message || e).slice(0, 160)); } };

const J = '11111111-1111-1111-1111-111111111111';
const JWT_J = 'eyJh.jeton-de-J.sig';
process.env.VRM_OWNER_UID = J;
process.env.EBAY_APP_ID = 'app-de-banc';
process.env.EBAY_CERT_ID = 'secret-de-banc';
process.env.EBAY_RUNAME = 'runame-de-banc';
process.env.SUPABASE_SERVICE_KEY = 'cle-service-de-banc';
process.env.EBAY_RELECTURE_MS = '20';

// ── LA FAUSSE BASE (owner, id) — elle honore `owner=eq.`, `id=eq.` et `select=` ──
let lignes = [];
const remettreBase = () => { lignes = [{ owner: J, id: 'ebay_tokens', data: { refresh_token: 'rt-de-J', saved_at: 1 } }]; };
const projette = (r, sel) => {
  if (!sel) return r;
  const out = {};
  for (const part of decodeURIComponent(sel).split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id' || src === 'owner') { out[alias] = r[src]; continue; }
    if (src === 'data') { out[alias] = r.data; continue; }
    let v = r.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    if (v != null && /->>[^>]*$/.test(src) && typeof v !== 'string') v = typeof v === 'object' ? JSON.stringify(v) : String(v);
    out[alias] = v == null ? null : v;
  }
  return out;
};

// ── LE FAUX eBAY : il crée l'annonce à l'ajout et la RELIT au GetItem ─────────
// `mode.getitem` : ce que montre la relecture —
//   ok · prix (un autre prix) · devise (en dollars) · terminee (ListingStatus
//   Completed) · sans-sku · minimal (ni titre, ni photos, ni vendeur) ·
//   autre-vendeur · autre-id · ko (Ack Failure) · reseau (coupure).
// `mode.getuser` : qui porte le jeton (GetUser) — ok (julien_part) · ko (Ack
//   Failure) · autre (un autre pseudo).
// `mode.vendeur` : le vendeur que montre la relecture (défaut julien_part).
let mode = {};
const annonces = new Map();
let prochainId = 120000000100;
const journal = [];
const remettre = () => { mode = { getitem: 'ok', getuser: 'ok' }; annonces.clear(); journal.length = 0; remettreBase(); };
const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });
const balise = (s, t) => (new RegExp('<' + t + '>([\\s\\S]*?)</' + t + '>').exec(s || '') || [])[1] || '';
const OK = (appel, inner) => `<?xml version="1.0"?><${appel}Response xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack>${inner || ''}</${appel}Response>`;
const ECHEC = (appel, msg) => `<?xml version="1.0"?><${appel}Response xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Failure</Ack><Errors><ShortMessage>x</ShortMessage><LongMessage>${msg}</LongMessage><ErrorCode>17</ErrorCode><SeverityCode>Error</SeverityCode><ErrorClassification>RequestError</ErrorClassification></Errors></${appel}Response>`;
const xmlRep = (s) => new Response(s, { status: 200, headers: { 'content-type': 'text/xml' } });
function itemRelu(a) {
  const md = mode.getitem;
  const prix = md === 'prix' ? '55.0' : a.prix;
  const dev = md === 'devise' ? 'USD' : 'EUR';
  const titre = md === 'minimal' ? '' : `<Title>${a.titre}</Title>`;
  const photos = md === 'minimal' ? '' : `<PictureDetails>${new Array(a.photos).fill(0).map((_, i) => `<PictureURL>https://i.ebayimg.test/${a.itemId}/${i}.jpg</PictureURL>`).join('')}</PictureDetails>`;
  const vendeur = md === 'minimal' ? '' : `<Seller><UserID>${md === 'autre-vendeur' ? 'quelquun_dautre' : (mode.vendeur || 'julien_part')}</UserID></Seller>`;
  const sku = md === 'sans-sku' || !a.sku ? '' : `<SKU>${a.sku}</SKU>`;
  const id = md === 'autre-id' ? '999999999999' : a.itemId;
  return `<Item><ItemID>${id}</ItemID>${titre}${sku}<Quantity>${a.qte}</Quantity><Currency>${dev}</Currency><StartPrice currencyID="${dev}">${prix}</StartPrice>${vendeur}${photos}<SellingStatus><CurrentPrice currencyID="${dev}">${prix}</CurrentPrice><QuantitySold>0</QuantitySold><ListingStatus>${md === 'terminee' ? 'Completed' : 'Active'}</ListingStatus></SellingStatus><ListingDetails><StartTime>2026-10-15T10:00:00.000Z</StartTime></ListingDetails></Item>`;
}
global.fetch = async (url, opts = {}) => {
  const u = String(url);
  const m = (opts.method || 'GET').toUpperCase();
  const h = opts.headers || {};
  if (u.includes('/auth/v1/user')) {
    const a = String((h.Authorization || h.authorization) || '');
    return a === 'Bearer ' + JWT_J ? rep({ id: J, email: 'j@exemple.test' }) : rep({ msg: 'invalid' }, 401);
  }
  if (u.includes('/rest/v1/rpc/vrm_acces_pour')) return rep(true);
  if (u.includes('ebay.com')) {
    const appel = h['X-EBAY-API-CALL-NAME'] || '';
    const corps = String(opts.body || '');
    journal.push({ ou: 'ebay', appel, u: u.replace(/\?.*$/, ''), corps });
    if (u.includes('/identity/v1/oauth2/token')) return rep({ access_token: 'at-J', expires_in: 7200 });
    if (appel === 'GetUser') {
      if (mode.getuser === 'ko') return xmlRep(ECHEC(appel, 'Erreur interne au système (message inventé).'));
      return xmlRep(OK(appel, `<User><UserID>${mode.getuser === 'autre' ? 'pas_ce_compte' : (mode.vendeur || 'julien_part')}</UserID><EIASToken>EIAS-JULIEN-PART-000000001</EIASToken></User>`));
    }
    if (appel === 'GetMyeBaySelling') return xmlRep(OK(appel, ''));
    if (appel === 'AddFixedPriceItem') {
      const id = String(prochainId++);
      const nPh = (corps.match(/<PictureURL>/g) || []).length;
      annonces.set(id, { itemId: id, titre: balise(corps, 'Title'), sku: balise(corps, 'SKU'), prix: balise(corps, 'StartPrice'), qte: balise(corps, 'Quantity') || '1', photos: nPh });
      return xmlRep(OK(appel, `<ItemID>${id}</ItemID><StartTime>2026-10-15T10:00:00.000Z</StartTime><EndTime>2026-11-14T10:00:00.000Z</EndTime><Fees><Fee><Name>ListingFee</Name><Fee currencyID="EUR">0.0</Fee></Fee></Fees>`));
    }
    if (appel === 'GetItem') {
      if (mode.getitem === 'reseau') throw new Error('ECONNRESET');
      if (mode.getitem === 'ko') return xmlRep(ECHEC(appel, "L'objet est introuvable (message inventé)."));
      const a = annonces.get(balise(corps, 'ItemID'));
      if (!a) return xmlRep(ECHEC(appel, "L'objet est introuvable (message inventé)."));
      return xmlRep(OK(appel, itemRelu(a)));
    }
    return xmlRep(OK(appel, ''));
  }
  if (u.includes('/rest/v1/app_data')) {
    const q = decodeURIComponent(u);
    if (/select=owner&limit=1/.test(q)) return rep([]);
    if (m !== 'GET') { journal.push({ ou: 'base', m, u: q }); return rep('', 201); }
    const id = (/[?&]id=eq\.([^&]*)/.exec(q) || [])[1];
    const owner = (/[?&]owner=eq\.([^&]*)/.exec(q) || [])[1];
    const sel = (/[?&]select=([^&]*)/.exec(q) || [])[1];
    return rep(lignes.filter((r) => (!id || r.id === id) && (!owner || r.owner === owner)).map((r) => projette(r, sel)));
  }
  return rep({});
};
const faireRes = () => {
  const x = { code: null, corps: null, entetes: {} };
  x.status = (n) => { x.code = n; return x; }; x.json = (o) => { x.corps = o; return x; };
  x.setHeader = (k, v) => { x.entetes[String(k).toLowerCase()] = v; }; x.end = () => x; return x;
};
const chezEbay = (j) => j.filter((x) => x.ou === 'ebay' && !/oauth2\/token/.test(x.u));

// ── LES RÈGLES DE L'APP, EXTRAITES D'App.jsx ET EXÉCUTÉES ────────────────────
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
const lire = (f) => { try { return fs.readFileSync(path.join(RACINE, f), 'utf8'); } catch (_) { return ''; } };
const APP = lire('src/App.jsx');
const EXT = lire('vinted-sync-extension/background.js');
const RA = {};
{
  const noms = ['montantSaisi', 'eurEbay', 'prixVinted', 'PAS_UNE_DESCRIPTION', 'lbcDescription', 'prixChampEbay', 'memePrixEbay', 'normDescEbay', 'repriseVinted', 'ecartsVintedEbay', 'ecartsBrouillonVinted', 'texteEcartsBrouillon', 'etatPublicationEbay', 'NOMS_POINTS_PUB', 'textePointPub'];
  const srcs = noms.map((n) => [n, extraire(APP, n)]);
  const manque = srcs.filter(([, s]) => !s).map(([n]) => n);
  RA._manque = manque;
  const ctx = {}; vm.createContext(ctx);
  for (const [n, s] of srcs) { if (!s) continue; try { vm.runInContext(s + `\n;this.${n} = ${n};`, ctx); } catch (e) { RA._manque.push(n + ' (illisible)'); } }
  Object.assign(RA, ctx);
}
const lignePas = (src) => { const m = /^const PAS_UNE_DESCRIPTION = (\/.*\/[a-z]*);/m.exec(src || ''); return m ? m[1] : ''; };

(async () => {
  let route = null, lib = null;
  await essaie('chargement de la route', async () => { route = await import('file://' + path.join(RACINE, 'api', 'ebay.js')); });
  await essaie('chargement de la règle de relecture', async () => { lib = await import('file://' + path.join(RACINE, 'api', '_lib', 'ebay-publication.js')); });
  const app = async (corps) => {
    journal.length = 0;
    const res = faireRes();
    await route.default({ method: 'POST', query: {}, headers: { authorization: 'Bearer ' + JWT_J }, body: corps }, res);
    return { code: res.code, corps: res.corps || {}, journal: journal.slice() };
  };
  const item = { title: 'Nike Air Max 1 bleu taille 44', categoryId: '15709', price: '49', quantity: '1', conditionId: '3000', photos: ['https://img.test/1.jpg', 'https://img.test/2.jpg', 'https://img.test/3.jpg'], aspects: { Marque: 'Nike' }, ebayGere: true, numero: '401' };
  const point = (v, cle) => (v && Array.isArray(v.points) ? v.points.find((p) => p.cle === cle) : null) || {};

  // ── A. LA ROUTE ─────────────────────────────────────────────────────────────
  console.log('\n— A. Publier : la route RELIT l\'annonce chez eBay —');
  await essaie('[A-relu] publication relue', async () => {
    remettre();
    const o = await app({ action: 'publish', item });
    const v = o.corps.verification;
    const iAdd = chezEbay(o.journal).findIndex((x) => x.appel === 'AddFixedPriceItem');
    const apres = chezEbay(o.journal).slice(iAdd + 1);
    dit(o.code === 200 && o.corps.ok === true && apres.filter((x) => x.appel === 'GetItem').length === 1 && apres.every((x) => x.appel === 'GetItem'),
      '[A-relu] après AddFixedPriceItem : UNE relecture (GetItem), rien d\'autre ne part chez eBay', chezEbay(o.journal).map((x) => x.appel).join(','));
    dit(!!v && v.lu === true && v.verdict === 'verifiee' && v.itemId === String(o.corps.itemId),
      '[A-relu] l\'annonce relue telle qu\'envoyée ⇒ verdict « verifiee », sur le MÊME numéro d\'annonce', JSON.stringify(v && { lu: v.lu, verdict: v.verdict, itemId: v.itemId }));
    dit(o.corps.plateforme === 'ebay' && o.corps.compte === 'julien_part' && /^\d+$/.test(String(o.corps.itemId)),
      '[A-relu] la réponse dit la plateforme (eBay), le compte (pseudo lu chez eBay quand le registre ne le porte pas) et le numéro', `${o.corps.plateforme} · ${o.corps.compte} · ${o.corps.itemId}`);
    const etats = ['annonce', 'compte', 'reference', 'prix', 'titre', 'quantite', 'photos'].map((k) => `${k}=${point(v, k).etat}`).join(' ');
    dit(['annonce', 'compte', 'reference', 'prix', 'titre', 'quantite', 'photos'].every((k) => point(v, k).etat === 'ok'),
      '[A-relu] sept points relus et conformes : en ligne, compte, référence VRM-401, prix 49 €, titre, quantité, 3 photos', etats);
  });
  for (const [md, cle, verdict, quoi] of [
    ['prix', 'prix', 'ecarts', 'eBay montre 55 € pour 49 € envoyés'],
    ['devise', 'prix', 'ecarts', 'eBay montre le prix en dollars'],
    ['sans-sku', 'reference', 'partielle', 'eBay ne montre pas la référence VRM-401'],
    ['terminee', 'annonce', 'pas-active', 'eBay dit l\'annonce « Completed »'],
    ['autre-vendeur', 'compte', 'ecarts', 'eBay nomme un autre vendeur'],
  ]) {
    await essaie(`[A-ecart] ${md}`, async () => {
      remettre(); mode.getitem = md;
      // Le registre connaît le pseudo du compte principal : c'est lui qu'on attend.
      lignes.push({ owner: J, id: 'ebay_comptes', data: { comptes: [{ cle: 'a1b2c3d4e5f60718', pseudo: 'julien_part', principal: true, ajouteLe: 1 }] } });
      const o = await app({ action: 'publish', item });
      const v = o.corps.verification || {};
      const p = point(v, cle);
      dit(o.code === 200 && v.lu === true && v.verdict === verdict && p.etat === (md === 'sans-sku' ? 'pas-lu' : 'ecart'),
        `[A-ecart] ${quoi} ⇒ « ${verdict} », le point « ${cle} » le dit (jamais « verifiee »)`, `verdict ${v.verdict} · ${cle}=${p.etat} vu=${p.vu}`);
    });
  }
  // ── (revue du 15 octobre) LE COMPTE SE JUGE SUR LE JETON ─────────────────
  // Le registre garde le pseudo appris à la CONNEXION ; renommé chez eBay, il
  // faisait sortir « à vérifier · Compte chez eBay : nouveau (envoyé : ancien) »
  // — un écart qui ne pouvait jamais révéler un mauvais compte.
  const registre = (pseudo) => lignes.push({ owner: J, id: 'ebay_comptes', data: { comptes: [{ cle: 'a1b2c3d4e5f60718', pseudo, principal: true, ajouteLe: 1 }] } });
  const getUsers = (j) => chezEbay(j).filter((x) => x.appel === 'GetUser').length;
  await essaie('[A-renomme] pseudo renommé chez eBay', async () => {
    remettre(); registre('julien_ancien'); mode.vendeur = 'julien_nouveau';
    const o = await app({ action: 'publish', item });
    const v = o.corps.verification || {};
    const p = point(v, 'compte');
    dit(o.code === 200 && v.verdict === 'verifiee' && p.etat === 'ok' && p.renomme === 'julien_ancien' && o.corps.compte === 'julien_nouveau' && getUsers(o.journal) === 1,
      '[A-renomme] pseudo renommé depuis la connexion : eBay confirme que le jeton est ce vendeur (UN GetUser) ⇒ « verifiee », le compte nommé est l\'ACTUEL, l\'ancien est gardé', `verdict ${v.verdict} · compte=${p.etat} renomme=${p.renomme} · nommé « ${o.corps.compte} » · GetUser ×${getUsers(o.journal)}`);
    const id = String(o.corps.itemId || '');
    const r = await app({ action: 'relirepub', itemId: id, attendu: { sku: 'VRM-401', prix: 49, titre: item.title, quantite: 1, photos: 3 } });
    const pr = point(r.corps.verification, 'compte');
    dit(r.code === 200 && r.corps.verification && r.corps.verification.verdict === 'verifiee' && pr.etat === 'ok' && r.corps.compte === 'julien_nouveau' && r.journal.filter((x) => x.ou === 'base').length === 0,
      '[A-renomme] « Relire chez eBay » juge pareil (même règle), et n\'écrit toujours rien', `verdict ${r.corps.verification && r.corps.verification.verdict} · compte=${pr.etat} · « ${r.corps.compte} »`);
  });
  await essaie('[A-renomme] jeton illisible', async () => {
    remettre(); registre('julien_ancien'); mode.vendeur = 'julien_nouveau'; mode.getuser = 'ko';
    const o = await app({ action: 'publish', item });
    const v = o.corps.verification || {};
    const p = point(v, 'compte');
    dit(o.code === 200 && p.etat === 'pas-lu' && v.verdict === 'verifiee' && o.corps.compte === 'julien_ancien',
      '[A-renomme] eBay ne dit pas qui porte le jeton ⇒ le compte est « pas vérifié » (ni écart, ni conforme), le pseudo mémorisé reste nommé', `verdict ${v.verdict} · compte=${p.etat} · « ${o.corps.compte} »`);
  });
  await essaie('[A-autre-jeton] vendeur ≠ jeton', async () => {
    remettre(); registre('julien_ancien'); mode.vendeur = 'julien_nouveau'; mode.getuser = 'autre';
    const o = await app({ action: 'publish', item });
    const v = o.corps.verification || {};
    const p = point(v, 'compte');
    dit(o.code === 200 && v.verdict === 'ecarts' && p.etat === 'ecart' && p.attendu === 'pas_ce_compte' && p.vu === 'julien_nouveau',
      '[A-autre-jeton] l\'autre sens : le jeton porte un AUTRE pseudo que le vendeur relu ⇒ l\'écart reste dit (attendu = le pseudo ACTUEL du jeton)', `verdict ${v.verdict} · vu ${p.vu} · attendu ${p.attendu}`);
  });
  await essaie('[A-meme-pseudo] aucun GetUser de trop', async () => {
    remettre(); registre('julien_part');
    const o = await app({ action: 'publish', item });
    dit(o.code === 200 && point(o.corps.verification, 'compte').etat === 'ok' && getUsers(o.journal) === 0,
      '[A-meme-pseudo] pseudo mémorisé = vendeur relu ⇒ AUCUN GetUser (on ne demande qui porte le jeton que sur un écart)', `GetUser ×${getUsers(o.journal)}`);
  });
  await essaie('[A-minimal] champs absents', async () => {
    remettre(); mode.getitem = 'minimal';
    const o = await app({ action: 'publish', item });
    const v = o.corps.verification || {};
    dit(v.verdict === 'verifiee' && ['titre', 'photos', 'compte'].every((k) => point(v, k).etat === 'pas-lu'),
      '[A-minimal] eBay ne montre ni titre, ni photos, ni vendeur ⇒ ces points sont « pas lu » (jamais « conformes »), l\'essentiel (en ligne, prix, référence) reste vérifié', ['titre', 'photos', 'compte'].map((k) => `${k}=${point(v, k).etat}`).join(' '));
  });
  for (const md of ['ko', 'reseau', 'autre-id']) {
    await essaie(`[A-demandee] ${md}`, async () => {
      remettre(); mode.getitem = md;
      const o = await app({ action: 'publish', item });
      const v = o.corps.verification;
      dit(o.code === 200 && o.corps.ok === true && !!o.corps.itemId && !!v && v.lu === false,
        `[A-demandee] relecture ${md === 'ko' ? 'refusée par eBay' : md === 'reseau' ? 'coupée' : 'qui rend une AUTRE annonce'} ⇒ l'ajout reste dit (numéro), la vérification vaut « pas lu » — l'écran dit « demandée », jamais « publiée »`, `HTTP ${o.code} · ${JSON.stringify(v)}`);
    });
  }
  await essaie('[A-relire] relirepub', async () => {
    remettre(); mode.getitem = 'ko';
    const o = await app({ action: 'publish', item });
    const id = String(o.corps.itemId || '');
    mode.getitem = 'ok';
    const r = await app({ action: 'relirepub', itemId: id, attendu: { sku: 'VRM-401', prix: 49, titre: item.title, quantite: 1, photos: 3 } });
    const pasEcrit = r.journal.filter((x) => x.ou === 'base').length === 0 && chezEbay(r.journal).every((x) => x.appel === 'GetItem');
    dit(r.code === 200 && r.corps.verification && r.corps.verification.verdict === 'verifiee' && pasEcrit,
      '[A-relire] « Relire chez eBay » : UNE lecture (GetItem), aucune écriture, et le verdict « verifiee » arrive', `HTTP ${r.code} · ${r.corps.verification && r.corps.verification.verdict} · ${chezEbay(r.journal).map((x) => x.appel).join(',')}`);
    const r2 = await app({ action: 'relirepub', itemId: id, attendu: { sku: 'EVIL-1', prix: 49, titre: item.title, quantite: 1, photos: 3 } });
    dit(r2.code === 200 && !point(r2.corps.verification, 'reference').cle, '[A-relire] un « sku » envoyé par l\'écran qui n\'est pas « VRM-{n°} » ne désigne rien (pas comparé)', JSON.stringify(point(r2.corps.verification, 'reference')));
    const r3 = await app({ action: 'relirepub', itemId: '12;DROP', attendu: {} });
    dit(r3.code === 400 && chezEbay(r3.journal).length === 0, '[A-relire] un numéro d\'annonce illisible ⇒ 400, rien ne part chez eBay', `HTTP ${r3.code}`);
  });
  await essaie('[A-regle] règle d\'offre', async () => {
    remettre();
    const o = await app({ action: 'publish', item: { ...item, numero: '402', offre: { accepte: 44, refuse: null } } });
    const iAdd = chezEbay(o.journal).findIndex((x) => x.appel === 'AddFixedPriceItem');
    const gets = chezEbay(o.journal).slice(iAdd + 1).filter((x) => x.appel === 'GetItem').length;
    dit(o.code === 200 && gets === 1 && o.corps.verification && o.corps.verification.lu === true && o.corps.offre,
      '[A-regle] publiée AVEC une règle d\'offre : toujours UNE seule relecture, qui sert la règle ET la vérification', `GetItem ×${gets}`);
  });

  // ── B. LA RÈGLE PURE `verifPublication` ─────────────────────────────────────
  console.log('\n— B. verifPublication —');
  await essaie('[B] règle pure', async () => {
    if (!lib || typeof lib.verifPublication !== 'function') throw new Error('verifPublication absente');
    const a = lib.attenduDePublication({ title: 'Titre  test', price: '49,50', quantity: '2', photos: ['a', 'b'], sku: 'VRM-7' }, 'julien_part');
    dit(a.titre === 'Titre test' && a.prix === 49.5 && a.quantite === 2 && a.photos === 2 && a.sku === 'VRM-7', '[B] ce qui est parti, réduit à ce qu\'on compare (prix « 49,50 » ⇒ 49,5, espaces réduits)', JSON.stringify(a));
    const xml = (inner) => `<?xml version="1.0"?><GetItemResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack>${inner}</GetItemResponse>`;
    const v0 = lib.verifPublication(xml('<Description>x</Description>'), '1', a);
    dit(v0.lu === false, '[B] une réponse sans <Item> ne prouve rien (lu:false)');
    const v1 = lib.verifPublication('<html>503</html>', '1', a);
    dit(v1.lu === false, '[B] une page HTML (passerelle) ne prouve rien (lu:false)');
    const v2 = lib.verifPublication(xml('<Item><ItemID>1</ItemID><SKU>vrm-007</SKU><SellingStatus><CurrentPrice currencyID="EUR">49.5</CurrentPrice><ListingStatus>Active</ListingStatus></SellingStatus></Item>'), '1', a, { memeSku: (x, y) => x.replace(/\D/g, '').replace(/^0+/, '') === y.replace(/\D/g, '').replace(/^0+/, '') });
    dit(v2.lu === true && v2.verdict === 'verifiee' && point(v2, 'reference').etat === 'ok' && point(v2, 'quantite').etat === 'pas-lu',
      '[B] « vrm-007 » est la référence VRM-7 (même N°) ; une quantité non montrée est « pas lu »', `${v2.verdict} · ref=${point(v2, 'reference').etat} · qte=${point(v2, 'quantite').etat}`);
    const v3 = lib.verifPublication(xml('<Item><ItemID>1</ItemID><SKU>VRM-7</SKU><SellingStatus><CurrentPrice currencyID="EUR">49.5</CurrentPrice></SellingStatus></Item>'), '1', a);
    dit(v3.verdict === 'partielle' && point(v3, 'annonce').etat === 'pas-lu', '[B] un statut d\'annonce non montré ⇒ « partielle » (jamais « verifiee » sans savoir qu\'elle est en ligne)', v3.verdict);
    // (revue du 15 octobre) confirmerCompte : un écart de compte revu par ce
    // que dit eBay du JETON.
    if (typeof lib.confirmerCompte !== 'function') throw new Error('confirmerCompte absente');
    const aC = lib.attenduDePublication({ title: 'T', price: '49', quantity: '1', photos: ['a'], sku: 'VRM-7' }, 'julien_ancien');
    const vC = lib.verifPublication(xml('<Item><ItemID>1</ItemID><SKU>VRM-7</SKU><Seller><UserID>julien_nouveau</UserID></Seller><SellingStatus><CurrentPrice currencyID="EUR">49</CurrentPrice><ListingStatus>Active</ListingStatus></SellingStatus></Item>'), '1', aC);
    const c1 = lib.confirmerCompte(vC, { pseudo: 'JULIEN_NOUVEAU' });
    const c2 = lib.confirmerCompte(vC, { pseudo: 'pas_ce_compte' });
    const c3 = lib.confirmerCompte(vC, null);
    const c4 = lib.confirmerCompte({ lu: false }, { pseudo: 'x' });
    dit(vC.verdict === 'ecarts' && c1.verdict === 'verifiee' && point(c1, 'compte').etat === 'ok' && point(c1, 'compte').renomme === 'julien_ancien',
      '[B] confirmerCompte : le jeton s\'appelle comme le vendeur relu (casse comprise) ⇒ même compte renommé, « verifiee »', `${vC.verdict} → ${c1.verdict}`);
    dit(c2.verdict === 'ecarts' && point(c2, 'compte').attendu === 'pas_ce_compte' && c3.verdict === 'verifiee' && point(c3, 'compte').etat === 'pas-lu' && c4.lu === false,
      '[B] confirmerCompte : autre pseudo de jeton ⇒ écart ; jeton illisible ⇒ « pas lu » ; une relecture ratée reste « pas lu »', `${c2.verdict} · ${point(c3, 'compte').etat} · ${c4.lu}`);
    dit(lib.compteANommer(c1, 'julien_ancien') === 'julien_nouveau' && lib.compteANommer(c2, 'julien_ancien') === 'julien_ancien' && lib.compteANommer({ lu: false }, 'julien_ancien') === 'julien_ancien',
      '[B] compteANommer : le vendeur relu quand il est prouvé le sien, sinon le pseudo mémorisé');
  });

  // ── C. LES RÈGLES DE L'APP ──────────────────────────────────────────────────
  console.log('\n— C. L\'app : reprendre Vinted sans rien écraser —');
  dit(RA._manque.length === 0, '[C] les règles de l\'app sont toutes extraites d\'App.jsx', RA._manque.join(', '));
  await essaie('[C-reprise] repriseVinted', async () => {
    const R = RA.repriseVinted;
    const cas = [
      ['champ vide ⇒ Vinted', R('', null, '49'), { poser: true, valeur: '49' }],
      ['encore celui de VRM ⇒ suit la nouvelle paire', R('49', '49', '62'), { poser: true, valeur: '62' }],
      ['SA saisie ⇒ jamais écrasée', R('55', '49', '62'), { poser: false }],
      ['brouillon rouvert (rien de posé par VRM) ⇒ gardé', R('59', null, '49'), { poser: false }],
      ['prix Vinted inconnu, champ encore à VRM ⇒ vidé (jamais l\'ancien prix d\'une AUTRE paire)', R('49', '49', null), { poser: true, valeur: '' }],
      ['description tapée puis paire changée ⇒ gardée', R('Ma description', 'Texte Vinted A', 'Texte Vinted B'), { poser: false }],
    ];
    const faux = cas.filter(([, x, y]) => JSON.stringify(x) !== JSON.stringify(y));
    dit(faux.length === 0, '[C-reprise] vide ou encore celui de VRM ⇒ Vinted ; sinon SA saisie, jamais écrasée (6 cas)', faux.map(([n, x]) => `${n} → ${JSON.stringify(x)}`).join(' · '));
  });
  await essaie('[C-ecarts] ecartsVintedEbay', async () => {
    const E = RA.ecartsVintedEbay;
    const p = { prixVinted: 49, desc: 'Très bon état, boîte d\'origine.' };
    const c1 = E(p, '49,00', 'Très bon état,  boîte d\'origine.');
    const c2 = E(p, '55', 'Très bon état, boîte d\'origine.');
    const c3 = E(p, '49', 'Ma description à moi');
    const c4 = E({ prixVinted: null, desc: '' }, '55', 'x');
    const c5 = E(p, '', '');
    dit(c1.length === 0, '[C-ecarts] 49 et « 49,00 », la même description aux espaces près ⇒ aucun écart', JSON.stringify(c1));
    dit(c2.length === 1 && c2[0].cle === 'prix' && c2[0].vinted === 49 && c2[0].ici === 55, '[C-ecarts] 55 € ici, 49 € sur Vinted ⇒ l\'écart de prix, avec les deux montants', JSON.stringify(c2));
    dit(c3.length === 1 && c3[0].cle === 'description', '[C-ecarts] une description personnalisée ⇒ l\'écart de description', JSON.stringify(c3.map((x) => x.cle)));
    dit(c4.length === 0, '[C-ecarts] prix et description Vinted inconnus ⇒ aucun écart inventé', JSON.stringify(c4));
    dit(c5.length === 2 && c5.find((x) => x.cle === 'prix').ici === null, '[C-ecarts] champs vidés ⇒ deux écarts, « ici » vaut « pas de prix »', JSON.stringify(c5));
  });
  await essaie('[C-brouillon] ecartsBrouillonVinted', async () => {
    // (revue du 15 octobre) Le planificateur programmait un brouillon à 59 €
    // pendant que la paire était à 49 € sur Vinted, sans un mot.
    const F = RA.ecartsBrouillonVinted, T = RA.texteEcartsBrouillon;
    const paires = [{ id: '7041', title: 'Nike Air Max 1 bleu taille 44', prixVinted: 49, desc: 'Très bon état.' }, { id: '7099', title: 'Nike Air Max 1 bleu taille 44', prixVinted: 59, desc: 'Mon texte' }];
    const b1 = F({ pairId: '7041', prix: '59', description: 'Mon texte' }, paires);
    const b2 = F({ pairId: '7041', prix: '49,00', description: 'Très bon état.' }, paires);
    const b3 = F({ pairId: '7777', titre: 'Nike Air Max 1 bleu taille 44', prix: '59', description: 'Mon texte' }, paires);
    const b4 = F({ prix: '59' }, paires);
    dit(b1.ecarts.map((e) => e.cle).join(',') === 'prix,description' && b1.ecarts[0].vinted === 49 && b1.ecarts[0].ici === 59,
      '[C-brouillon] un brouillon à 59 € de la paire 7041 (49 € sur Vinted) ⇒ l\'écart de prix et de description', JSON.stringify(b1.ecarts.map((e) => [e.cle, e.vinted, e.ici].join(':'))));
    dit(b2.ecarts.length === 0, '[C-brouillon] au prix de Vinted, sa description ⇒ aucun écart', JSON.stringify(b2.ecarts));
    dit(b3.ecarts.length === 0 && !b3.pair && b4.ecarts.length === 0,
      '[C-brouillon] §5 : la paire par son IDENTITÉ (`pairId`) — une autre annonce au MÊME titre ne désigne rien ; sans `pairId`, rien n\'est comparé', `${JSON.stringify(b3)} · ${JSON.stringify(b4)}`);
    dit(T(b1.ecarts) === 'sur Vinted : 49,00 € · description différente' && T(b2.ecarts) === '' && T([{ cle: 'description' }]) === 'description différente de Vinted',
      '[C-brouillon] une seule phrase pour la liste, l\'aperçu et la confirmation', T(b1.ecarts));
  });
  await essaie('[C-etat] etatPublicationEbay', async () => {
    const S = RA.etatPublicationEbay;
    const r = [S(null), S(undefined), S({ lu: false }), S({ lu: true, verdict: 'verifiee' }), S({ lu: true, verdict: 'ecarts' }), S({ lu: true, verdict: 'pas-active' }), S({ lu: true, verdict: 'partielle' }), S({ lu: true })];
    dit(JSON.stringify(r) === JSON.stringify(['demandee', 'demandee', 'demandee', 'verifiee', 'ecarts', 'pas-active', 'partielle', 'partielle']),
      '[C-etat] pas de relecture ⇒ « demandée » ; un verdict inconnu ⇒ « partielle », jamais « vérifiée »', JSON.stringify(r));
    const t = RA.textePointPub({ cle: 'prix', etat: 'ecart', vu: 55, attendu: 49, devise: 'EUR' });
    dit(/55,00\s*€/.test(t) && /49,00\s*€/.test(t), '[C-etat] un écart dit les DEUX valeurs (eBay montre, envoyé)', t);
  });
  await essaie('[C-prix] prixVinted', async () => {
    const P = RA.prixVinted;
    const r = [P({ amount: '49.0', currency_code: 'EUR' }), P({ amount: '49.0', currency_code: 'USD' }), P('49,50 €'), P(0), P(null), P({ amount: 'abc' })];
    dit(JSON.stringify(r) === JSON.stringify([49, null, 49.5, null, null, null]), '[C-prix] le prix Vinted en euros ; autre devise, nul, illisible ⇒ inconnu', JSON.stringify(r));
    dit(RA.prixChampEbay(49) === '49' && RA.prixChampEbay(49.5) === '49,50' && RA.prixChampEbay(null) === '', '[C-prix] posé dans le champ comme on le tape (« 49 », « 49,50 »)', `${RA.prixChampEbay(49)} · ${RA.prixChampEbay(49.5)}`);
  });
  await essaie('[C-desc] description', async () => {
    const D = RA.lbcDescription;
    const pubs = [
      'Une communauté, des milliers de marques et de styles de seconde main. Prêt à te lancer ? Découvre comment ça marche !',
      "Pour chaque achat effectué, tu bénéficies de notre Politique de remboursement, de transactions sécurisées et d'un service client.",
      'A community of thousands of brands and second-hand styles. Ready to get started?',
    ];
    dit(pubs.every((t) => D(t) === ''), '[C-desc] les textes de Vinted (dont la protection acheteur) ne partent JAMAIS comme description', pubs.map((t) => JSON.stringify(D(t).slice(0, 20))).join(' '));
    const vraie = 'Nike Air Max 1, portées 3 fois. Je rembourse si la pointure ne va pas.';
    dit(D(vraie) === vraie && D('Description' + vraie) === vraie, '[C-desc] l\'autre sens : une vraie description reste ENTIÈRE (et le libellé « Description » collé est retiré)', D(vraie).slice(0, 40));
    const a = lignePas(APP), e = lignePas(EXT);
    dit(!!a && a === e, '[C-desc] §11 : `PAS_UNE_DESCRIPTION` est la MÊME dans l\'app et l\'extension', a === e ? 'identiques' : `app ${a.length} car. · extension ${e.length} car.`);
    const ebayPub = /const PUB = \/une communaut/.test(APP);
    dit(!ebayPub, '[C-desc] la liste eBay n\'a plus SA règle (`PUB`) : une notion, une règle');
  });

  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
