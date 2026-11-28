// ════════════════════════════════════════════════════════════════════════════
//  LES AUTOMATISMES eBAY (28 nov., lot ebay-automatismes) — E1 à E6 devant un FAUX eBay
//        node scripts/audit-ebay-automatismes.cjs [--mutation=nom]
//
//  La VRAIE route `api/ebay.js` (actions autolire · autoregler · autolancer · masse · similaire) et le VRAI
//  passage horaire (`passageAutomatismesEbay`, api/_lib/ebay-automatismes.js) avec les VRAIES lectures et écritures
//  (api/_lib/ebay.js : `lireDonnee`, `modifierDonnee`, `lireReglageVendeur`, `accessToken`), devant un faux eBay
//  (Trading en XML, Negotiation en JSON) et une fausse base qui filtre par vendeur et sait comparer-et-échanger.
//  Données INVENTÉES (dépôt public). Ce qui doit rester vrai :
//   · chaque moteur est ÉTEINT par défaut ; l'allumer sans confirmation ⇒ refusé, rien écrit ;
//   · E1 : la baisse part au prix RELU, jamais sous le plancher (prix mini, sinon achat + 10 %, + la majoration) ;
//          une seule baisse par période ; sans SKU, sans plancher, plancher périmé, prix changé ⇒ rien ;
//   · E2 : l'offre aux observateurs part après N heures, UNE fois par période, jamais sous le plancher ;
//   · E3 : la contre-offre par paliers (Action Counter SEULEMENT), une par offre, jamais sous le plancher ;
//   · E4 : la remise en vente garde le SKU (relu sur la nouvelle annonce), seulement une paire prouvée chez lui,
//          jamais déjà en ligne, seulement sans frais par défaut ;
//   · E6 : la modification en masse refuse une ligne sous le plancher, exige la confirmation, passe par `revise` ;
//   · « Vendre un similaire » : un brouillon SANS N°, la pointure retirée ;
//   · §2.8 : AUCUN corps envoyé à eBay ne porte un champ de livraison ; aucune Action Accept / Decline.
//  Mutations (`--mutation=`) : `plancher` (le plancher n'est plus lu), `prix` (le prix relu n'est plus comparé),
//  `periode` (l'offre n'est plus bornée à une par période), `presence` (la présence n'est plus exigée),
//  `confirmation` (allumer sans confirmer passe), `sku` (la relance ne relit plus le SKU).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), os = require('os');
let RACINE = path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';

if (MUT) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eauto-mut-'));
  fs.cpSync(path.join(RACINE, 'api'), path.join(tmp, 'api'), { recursive: true });
  fs.cpSync(path.join(RACINE, 'src'), path.join(tmp, 'src'), { recursive: true });
  fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(tmp, 'node_modules'));
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  const remplace = (f, a, b) => { const p = path.join(tmp, f); const s = fs.readFileSync(p, 'utf8'); if (!s.includes(a)) { console.log('mutation introuvable : ' + a); process.exit(2); } fs.writeFileSync(p, s.replace(a, b)); };
  const L = 'api/_lib/ebay-automatismes.js';
  if (MUT === 'plancher') remplace(L, 'const plancherDe = (num) => (pd ? null : plancherEbay(k.planchers, num, k.maj));', "const plancherDe = (num) => ({ c: 100, de: 'mini' });");
  if (MUT === 'prix') remplace(L, "if (centimes(lu.prix) !== prixC) { await saute('baisse', a.itemId, num, 'prix-change'); continue; }", '');
  // `periode` : les DEUX gardes de la période (son état, et le journal des offres de son clic) tombent.
  if (MUT === 'periode') { const p = path.join(tmp, L); const s0 = fs.readFileSync(p, 'utf8'); if (!s0.includes('R.offres.periode * 864e5')) { console.log('mutation introuvable'); process.exit(2); } fs.writeFileSync(p, s0.split('R.offres.periode * 864e5').join('0')); }
  if (MUT === 'presence') remplace(L, "if (pr !== true) { await saute('relance', a.itemId, num, pr === null ? 'presence-pas-sue' : 'pas-prouvee'); continue; }", '');
  if (MUT === 'confirmation') remplace(L, "if (neufs.length && b.confirme !== true) return", 'if (false) return');
  if (MUT === 'sku') remplace(L, "etat = l2 && l2.itemId === neuf && l2.sku === j.sku &&", 'etat = l2 && l2.itemId === neuf &&');
  RACINE = tmp;
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.stack || e).slice(0, 300)); } };

const J = '11111111-1111-1111-1111-111111111111';
const JWT_J = 'eyJh.jeton-de-J.sig';
process.env.VRM_OWNER_UID = J;
process.env.EBAY_APP_ID = 'app-de-banc'; process.env.EBAY_CERT_ID = 'secret-de-banc'; process.env.EBAY_RUNAME = 'runame-de-banc';
process.env.SUPABASE_SERVICE_KEY = 'cle-service-de-banc';
process.env.EBAY_RELECTURE_MS = '5';
const JOUR = 864e5;
const T0 = Date.now();

// ── la fausse base ──
let lignes = [];
const ligne = (id) => lignes.find((r) => r.id === id && r.owner === J);
const donnee = (id) => (ligne(id) || {}).data || null;
const poser = (id, data) => { const r = ligne(id); if (r) r.data = data; else lignes.push({ owner: J, id, data }); };
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
const planchers = (parNum, plus = {}) => ({ v: 1, at: T0 - 3600000, parNum, presents: ['52', '53'], presentsAt: T0 - 3600000, ...plus });
const remettreBase = (main = {}) => {
  lignes = [{ owner: J, id: 'ebay_tokens', data: { refresh_token: 'rt-de-J', saved_at: 1 } },
    { owner: J, id: 'main', data: { vrm_planchers_ebay: planchers({ 41: [8000, null], 42: [null, 5000], 43: [8000, null], 52: [6000, null], 53: [6000, null], 54: [6000, null] }), ...main } }];
};

// ── le faux eBay ──
let items = {}, eligibles = [], offresRecues = [], journal = [], frais = '0.00', compteurNeuf = 900;
const debut = (jours) => new Date(T0 - jours * JOUR).toISOString();
const remettreEbay = () => {
  items = {
    '120000000001': { sku: 'VRM-41', prix: '100.00', statut: 'Active', debut: debut(20), obs: 3 },        // plancher 80 (mini)
    '120000000002': { sku: 'VRM-43', prix: '85.00', statut: 'Active', debut: debut(20), obs: 0 },         // plancher 80 : baisse ramenée au plancher
    '120000000003': { sku: '', prix: '70.00', statut: 'Active', debut: debut(40), obs: 2 },               // sans SKU : jamais
    '120000000004': { sku: 'VRM-99', prix: '60.00', statut: 'Active', debut: debut(40), obs: 0 },         // sans plancher : jamais
    '120000000005': { sku: 'VRM-52', prix: '70.00', statut: 'Completed', debut: debut(70), obs: 0, invendu: true },   // présente : relancée
    '120000000006': { sku: 'VRM-77', prix: '70.00', statut: 'Completed', debut: debut(70), obs: 0, invendu: true },   // pas prouvée chez lui
  };
  eligibles = []; offresRecues = []; journal = []; frais = '0.00'; compteurNeuf = 900;
};
const XML_OK = (appel, inner) => `<?xml version="1.0" encoding="UTF-8"?><${appel}Response xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack>${inner || ''}</${appel}Response>`;
const ITEM = (id, a, plein = true) => `<Item><ItemID>${id}</ItemID><Title>Paire inventée ${id.slice(-2)}</Title>${a.sku ? `<SKU>${a.sku}</SKU>` : ''}<Currency>EUR</Currency><StartPrice currencyID="EUR">${a.prix}</StartPrice>`
  + `<ListingType>FixedPriceItem</ListingType><Quantity>1</Quantity>`
  + `${plein ? `<PrimaryCategory><CategoryID>15709</CategoryID><CategoryName>Baskets</CategoryName></PrimaryCategory><ConditionID>3000</ConditionID><Description>Une paire inventée pour le banc.</Description><PictureDetails><PictureURL>https://i.ebayimg.com/images/g/x/s-l1600.jpg</PictureURL></PictureDetails><ItemSpecifics><NameValueList><Name>Marque</Name><Value>Nike</Value></NameValueList><NameValueList><Name>Pointure</Name><Value>42</Value></NameValueList></ItemSpecifics>` : ''}`
  + `<SellingStatus><CurrentPrice currencyID="EUR">${a.prix}</CurrentPrice><QuantitySold>0</QuantitySold><ListingStatus>${a.statut}</ListingStatus></SellingStatus>`
  + `<ListingDetails><StartTime>${a.debut}</StartTime></ListingDetails>${a.obs != null ? `<WatchCount>${a.obs}</WatchCount>` : ''}</Item>`;
const rep = (corps, status = 200) => new Response(corps == null ? null : (typeof corps === 'string' ? corps : JSON.stringify(corps)), { status, headers: { 'content-type': 'application/json' } });
const xmlRep = (s) => new Response(s, { status: 200, headers: { 'content-type': 'text/xml' } });
const balise = (s, t) => (new RegExp('<' + t + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + t + '>').exec(s || '') || [])[1] || '';
global.fetch = async (url, opts = {}) => {
  const u = String(url), m = (opts.method || 'GET').toUpperCase(), h = opts.headers || {};
  if (u.includes('/auth/v1/user')) return String(h.Authorization || h.authorization || '') === 'Bearer ' + JWT_J ? rep({ id: J, email: 'j@exemple.test' }) : rep({ msg: 'invalid' }, 401);
  if (u.includes('ebay.com')) {
    if (u.includes('/identity/v1/oauth2/token')) return rep({ access_token: 'at-J', expires_in: 7200 });
    const appel = h['X-EBAY-API-CALL-NAME'] || '';
    const corps = String(opts.body || '');
    journal.push({ appel, u, m, corps });
    if (u.includes('/sell/negotiation/v1/find_eligible_items')) return eligibles.length ? rep({ eligibleItems: eligibles.map((listingId) => ({ listingId })), total: eligibles.length }) : rep(null, 204);
    if (u.includes('/sell/negotiation/v1/send_offer_to_interested_buyers')) return rep({ offers: [{ offerId: 'o1' }, { offerId: 'o2' }] });
    const id = balise(corps, 'ItemID');
    if (appel === 'GetUser') return xmlRep(XML_OK('GetUser', '<User><UserID>julien_banc</UserID><EIASToken>EIAS-J-0000000001</EIASToken><Site>France</Site></User>'));
    if (appel === 'GetMyeBaySelling') {
      const act = Object.entries(items).filter(([, a]) => a.statut === 'Active').map(([i, a]) => ITEM(i, a, false)).join('');
      const inv = Object.entries(items).filter(([, a]) => a.invendu).map(([i, a]) => ITEM(i, a, false)).join('');
      return xmlRep(XML_OK('GetMyeBaySelling', `<ActiveList><ItemArray>${act}</ItemArray><PaginationResult><TotalNumberOfPages>1</TotalNumberOfPages></PaginationResult></ActiveList>` + (/UnsoldList/.test(corps) ? `<UnsoldList><ItemArray>${inv}</ItemArray><PaginationResult><TotalNumberOfPages>1</TotalNumberOfPages></PaginationResult></UnsoldList>` : '')));
    }
    if (appel === 'GetItem') { const a = items[id]; return xmlRep(XML_OK('GetItem', a ? ITEM(id, a.vuParGetItem ? { ...a, prix: a.vuParGetItem } : a) : '')); }
    if (appel === 'ReviseInventoryStatus') { const p = balise(corps, 'StartPrice'); if (items[id]) items[id].prix = Number(p).toFixed(2); return xmlRep(XML_OK('ReviseInventoryStatus', `<InventoryStatus><ItemID>${id}</ItemID></InventoryStatus>`)); }
    if (appel === 'VerifyRelistFixedPriceItem') return xmlRep(XML_OK('VerifyRelistFixedPriceItem', `<ItemID>0</ItemID><Fees><Fee><Name>InsertionFee</Name><Fee currencyID="EUR">${frais}</Fee></Fee><Fee><Name>ListingFee</Name><Fee currencyID="EUR">${frais}</Fee></Fee></Fees>`));
    if (appel === 'RelistFixedPriceItem') { const a = items[id]; const neuf = '1200000009' + (compteurNeuf++); items[neuf] = { ...a, statut: 'Active', invendu: false, debut: new Date().toISOString(), sku: MUT === 'sku' ? 'AUTRE' : a.sku }; a.relanceeEn = neuf; a.invendu = false; return xmlRep(XML_OK('RelistFixedPriceItem', `<ItemID>${neuf}</ItemID><Fees></Fees>`)); }
    if (appel === 'GetBestOffers') {
      const par = {};
      for (const o of offresRecues) (par[o.itemId] = par[o.itemId] || []).push(o);
      const g = Object.entries(par).map(([iid, l]) => `<ItemBestOffers><Item><ItemID>${iid}</ItemID></Item><BestOfferArray><BestOffer><BestOfferID>x</BestOfferID></BestOffer></BestOfferArray><BestOffers>${l.map((o) => `<BestOffer><BestOfferID>${o.id}</BestOfferID><Buyer><UserID>${o.buyer}</UserID></Buyer><Price currencyID="EUR">${o.prix}</Price><Quantity>1</Quantity><Status>Active</Status><ExpirationTime>${new Date(T0 + 2 * JOUR).toISOString()}</ExpirationTime></BestOffer>`).join('')}</BestOffers></ItemBestOffers>`).join('');
      return xmlRep(XML_OK('GetBestOffers', `<ItemBestOffersArray>${g}</ItemBestOffersArray>`));
    }
    if (appel === 'RespondToBestOffer') return xmlRep(XML_OK('RespondToBestOffer', ''));
    if (appel === 'EndFixedPriceItem') { if (items[id]) items[id].statut = 'Completed'; return xmlRep(XML_OK('EndFixedPriceItem', '<EndTime>2026-11-28T10:00:00Z</EndTime>')); }
    return xmlRep(XML_OK(appel, ''));
  }
  if (u.includes('/rest/v1/rpc/vrm_acces_pour')) return rep(true);
  if (u.includes('/rest/v1/app_data')) {
    const q = decodeURIComponent(u);
    if (/select=owner&limit=1/.test(q)) return rep([]);
    const id = (/[?&]id=eq\.([^&]*)/.exec(q) || [])[1];
    const owner = (/[?&]owner=eq\.([^&]*)/.exec(q) || [])[1];
    if (m === 'POST') {
      let rows = []; try { rows = JSON.parse(opts.body || '[]'); } catch (_) {}
      for (const r of (Array.isArray(rows) ? rows : [rows])) { const i = lignes.findIndex((x) => x.id === r.id && x.owner === r.owner); if (i >= 0) lignes[i] = r; else lignes.push(r); }
      return rep('', 201);
    }
    if (m === 'PATCH') {
      let b = {}; try { b = JSON.parse(opts.body || '{}'); } catch (_) {}
      const rev = (/data->>rev=eq\.([^&]*)/.exec(q) || [])[1]; const sansRev = /data->>rev=is\.null/.test(q);
      const out = lignes.filter((r) => r.id === id && (!owner || r.owner === owner) && (sansRev ? r.data.rev == null : String(r.data.rev) === rev));
      for (const r of out) r.data = b.data;
      return rep(out.map((r) => ({ id: r.id })));
    }
    const sel = (/[?&]select=([^&]*)/.exec(q) || [])[1];
    const out = lignes.filter((r) => (!id || r.id === id) && (!owner || r.owner === owner));
    return rep(out.map((r) => projette(r, sel)));
  }
  return rep({});
};
const faireRes = () => { const x = { code: null, corps: null, entetes: {} }; x.status = (n) => { x.code = n; return x; }; x.json = (o) => { x.corps = o; return x; }; x.setHeader = (k, v) => { x.entetes[String(k).toLowerCase()] = v; }; x.end = () => x; return x; };
const ecritures = () => journal.filter((x) => ['ReviseInventoryStatus', 'RespondToBestOffer', 'RelistFixedPriceItem', 'EndFixedPriceItem', 'ReviseFixedPriceItem', 'AddFixedPriceItem'].includes(x.appel) || /send_offer/.test(x.u));
const tousLesCorps = [];

(async () => {
  let route, mod, lib;
  await essaie('chargement', async () => {
    route = await import('file://' + path.join(RACINE, 'api', 'ebay.js'));
    mod = await import('file://' + path.join(RACINE, 'api', '_lib', 'ebay-automatismes.js'));
    lib = await import('file://' + path.join(RACINE, 'api', '_lib', 'ebay.js'));
  });
  if (!route || !mod) { console.log(`\n${ok} ✅ · ${ko} ❌`); process.exit(1); }
  const app = async (corps) => { journal.length = 0; const res = faireRes(); await route.default({ method: 'POST', query: {}, headers: { authorization: 'Bearer ' + JWT_J }, body: corps }, res); tousLesCorps.push(...journal.map((x) => x.corps)); return { code: res.code, j: res.corps || {}, journal: journal.slice() }; };
  const lire = async (q) => { const r = await fetch('https://base.test/rest/v1/' + q); return r.json(); };
  const passer = async (maintenant) => {
    journal.length = 0;
    const b = await mod.passageAutomatismesEbay({ lire: (q) => lire(q).then((rows) => rows.filter((r) => /data->>actif=eq\.true/.test(q) ? r.data && r.data.actif === true : true).map((r) => ({ owner: r.owner }))).catch(() => null),
      lireDonnee: lib.lireDonnee, modifierDonnee: lib.modifierDonnee, lireReglageVendeur: lib.lireReglageVendeur, accessToken: lib.accessToken, lireComptes: lib.lireComptes, comptesActifs: lib.comptesActifs, maintenant, budgetMs: 60000 });
    tousLesCorps.push(...journal.map((x) => x.corps));
    return { b, journal: journal.slice() };
  };
  // la fausse base doit savoir rendre la sélection du passage (filtre `data->>actif`)
  const ancienFetch = global.fetch;
  global.fetch = async (url, opts) => {
    const u = decodeURIComponent(String(url));
    if (u.includes('/rest/v1/app_data') && /data->>actif=eq\.true/.test(u)) return rep(lignes.filter((r) => r.id === mod.ID_AUTO && r.data && r.data.actif === true).map((r) => ({ owner: r.owner, data: r.data })));
    return ancienFetch(url, opts);
  };
  const etatAuto = () => mod.etatNormal(donnee(mod.ID_AUTO));
  const allumer = async (reglages) => app({ action: 'autoregler', reglages, confirme: true });

  await essaie('A. éteint par défaut', async () => {
    remettreBase(); remettreEbay();
    const r = await app({ action: 'autolire', annonces: true });
    const R = r.j.reglages || {};
    dit(r.code === 200 && ['baisse', 'offres', 'paliers', 'relance'].every((k) => R[k] && R[k].actif === false), 'sans réglage : les quatre moteurs sont ÉTEINTS', JSON.stringify(R));
    dit(Array.isArray(r.j.annonces) && r.j.annonces.find((a) => a.itemId === '120000000001').num === '41' && r.j.annonces.find((a) => a.itemId === '120000000001').plancherC === 8000, 'la page lit ses annonces avec leur N° (SKU) et leur plancher (prix mini 80 €)', JSON.stringify((r.j.annonces || []).slice(0, 2)));
    const p = await passer(T0);
    dit(p.b.fait === true && p.b.vendeurs === 0 && ecritures().length === 0, 'le passage horaire ne visite personne (aucun moteur allumé) et n’écrit rien chez eBay', JSON.stringify(p.b));
  });
  await essaie('B. allumer exige SA confirmation', async () => {
    remettreBase(); remettreEbay();
    const r = await app({ action: 'autoregler', reglages: { baisse: { actif: true, pct: 10, jours: 14 } } });
    dit(r.code === 400 && r.j.reason === 'confirmation' && !donnee(mod.ID_AUTO), 'allumer sans confirmer ⇒ 400 « confirmation », RIEN écrit', JSON.stringify({ c: r.code, j: r.j }));
    const r2 = await allumer({ baisse: { actif: true, pct: 10, jours: 14 } });
    dit(r2.code === 200 && etatAuto().actif === true && etatAuto().comptes.principal.reglages.baisse.actif === true, 'confirmé ⇒ allumé, la ligne est marquée active (le passage la visitera)', JSON.stringify(r2.j));
    const r3 = await app({ action: 'autoregler', reglages: { baisse: { pct: 15 } } });
    dit(r3.code === 200 && etatAuto().comptes.principal.reglages.baisse.pct === 15, 'changer un palier d’un moteur déjà allumé ne redemande rien', JSON.stringify(r3.j));
    const r4 = await app({ action: 'autoregler', reglages: { baisse: { pct: 33 } } });
    dit(r4.code === 200 && etatAuto().comptes.principal.reglages.baisse.pct === 5, 'une valeur hors des choix (33 %) ⇒ le défaut, jamais elle', JSON.stringify(etatAuto().comptes.principal.reglages.baisse));
  });
  await essaie('C. E1 baisse par règle', async () => {
    remettreBase(); remettreEbay();
    await allumer({ baisse: { actif: true, pct: 10, jours: 14 } });
    const p = await passer(T0);
    const rev = p.journal.filter((x) => x.appel === 'ReviseInventoryStatus');
    const prixDe = (id) => (rev.find((x) => balise(x.corps, 'ItemID') === id) || {}).corps;
    dit(/<StartPrice>90\.00<\/StartPrice>/.test(prixDe('120000000001') || ''), '100 € sans vente depuis 20 j, −10 % ⇒ 90,00 €', String(prixDe('120000000001')));
    dit(/<StartPrice>80\.00<\/StartPrice>/.test(prixDe('120000000002') || ''), '85 € −10 % = 76 € ⇒ ramené à SON plancher 80,00 € (jamais dessous)', String(prixDe('120000000002')));
    dit(rev.every((x) => Number(balise(x.corps, 'StartPrice')) >= 80), 'AUCUNE baisse sous le plancher', rev.map((x) => balise(x.corps, 'StartPrice')).join(','));
    dit(!prixDe('120000000003') && !prixDe('120000000004'), 'sans SKU VRM-n°, sans plancher : AUCUNE baisse', rev.map((x) => balise(x.corps, 'ItemID')).join(','));
    const ordre = p.journal.map((x) => x.appel).filter(Boolean);
    const i1 = ordre.indexOf('ReviseInventoryStatus');
    dit(i1 > 0 && ordre.lastIndexOf('GetItem', i1) > ordre.indexOf('GetMyeBaySelling') && ordre.indexOf('GetItem', i1) > i1, 'ordre : liste → annonce RELUE → baisse → relue après', ordre.join(','));
    const jl = etatAuto().journal.filter((e) => e.moteur === 'baisse' && e.etat === 'fait');
    dit(jl.length === 2 && jl.every((e) => e.apresC >= e.plancherC), 'deux baisses au journal, « fait », chacune ≥ son plancher', JSON.stringify(jl.map((e) => [e.num, e.avantC, e.apresC, e.plancherC])));
    dit(etatAuto().journal.some((e) => e.etat === 'saute' && e.raison === 'sans-identite') && etatAuto().journal.some((e) => e.etat === 'saute' && e.raison === 'sans-plancher'), 'ce qui est sauté est DIT (sans référence, sans plancher)', '');
    const p2 = await passer(T0 + 3600000);
    dit(p2.journal.filter((x) => x.appel === 'ReviseInventoryStatus').length === 0, 'une heure après : aucune 2e baisse (une par période de 14 j)', '');
    donnee('main').vrm_planchers_ebay.at = T0 + 15 * JOUR - 3600000;   // l'app a republié le plancher entre-temps
    const p3 = await passer(T0 + 15 * JOUR);
    const r3 = p3.journal.filter((x) => x.appel === 'ReviseInventoryStatus');
    dit(r3.length === 1 && /<StartPrice>81\.00<\/StartPrice>/.test(r3[0].corps), '15 j plus tard : 90 € −10 % = 81 € ; l’annonce au plancher (80 €) ne bouge plus', r3.map((x) => x.corps).join(' | '));
  });
  await essaie('C2. E1 : prix changé, plancher périmé, majoration', async () => {
    remettreBase(); remettreEbay();
    items['120000000001'].vuParGetItem = '95.00';
    await allumer({ baisse: { actif: true, pct: 10, jours: 14 } });
    const p = await passer(T0);
    dit(!p.journal.some((x) => x.appel === 'ReviseInventoryStatus' && balise(x.corps, 'ItemID') === '120000000001') && etatAuto().journal.some((e) => e.raison === 'prix-change'), 'le prix relu (95 €) n’est pas celui de la liste (100 €) ⇒ rien, et c’est dit', '');
    remettreBase({ vrm_planchers_ebay: planchers({ 41: [8000, null] }, { at: T0 - 4 * JOUR }) }); remettreEbay();
    await allumer({ baisse: { actif: true, pct: 10, jours: 14 } });
    const p2 = await passer(T0);
    dit(!p2.journal.some((x) => x.appel === 'ReviseInventoryStatus'), 'plancher publié il y a 4 jours (> 72 h) ⇒ AUCUNE baisse', '');
    remettreBase({ vrm_ebay_majoration: { v: 1, comptes: { principal: 10 } } }); remettreEbay();
    await allumer({ baisse: { actif: true, pct: 10, jours: 14 } });
    const p3 = await passer(T0);
    const c3 = (p3.journal.find((x) => x.appel === 'ReviseInventoryStatus' && balise(x.corps, 'ItemID') === '120000000001') || {}).corps || '';
    dit(/<StartPrice>90\.00<\/StartPrice>/.test(c3) && !p3.journal.some((x) => x.appel === 'ReviseInventoryStatus' && balise(x.corps, 'ItemID') === '120000000002'), 'majoration eBay +10 % : plancher 80 → 88 ; 100 → 90 part, 85 (sous 88) ne baisse plus', c3);
  });
  await essaie('D. E2 offre aux observateurs', async () => {
    remettreBase(); remettreEbay();
    eligibles = ['120000000001', '120000000002'];
    await allumer({ offres: { actif: true, pct: 10, heures: 24, periode: 7 } });
    const p0 = await passer(T0);
    dit(!p0.journal.some((x) => /send_offer/.test(x.u)), '1er passage : les observateurs sont NOTÉS, aucune offre avant 24 h', '');
    const p1 = await passer(T0 + 25 * 3600000);
    const env = p1.journal.filter((x) => /send_offer/.test(x.u)).map((x) => JSON.parse(x.corps));
    dit(env.length === 1 && env[0].offeredItems[0].listingId === '120000000001' && env[0].offeredItems[0].discountPercentage === '10', 'après 25 h : UNE offre −10 % sur l’annonce à 100 € (90 € ≥ plancher)', JSON.stringify(env));
    dit(etatAuto().journal.some((e) => e.moteur === 'offres' && e.itemId === '120000000002' && e.raison === 'sous-plancher'), '85 € −10 % = 76,50 € < plancher 80 € ⇒ AUCUNE offre, dit', '');
    const jo = donnee('ebay_offres_envoyees');
    dit(!!(jo && jo.items && jo.items['120000000001'] && jo.items['120000000001'].etat === 'envoyee'), 'l’offre est notée au journal de SON clic (`ebay_offres_envoyees`) : son bouton « offre » la voit', JSON.stringify(jo && jo.items));
    donnee('main').vrm_planchers_ebay.at = T0 + 4 * JOUR - 3600000;
    const p2 = await passer(T0 + 4 * JOUR);
    dit(!p2.journal.some((x) => /send_offer/.test(x.u)), '3 jours après l’offre (son offre de 48 h est finie) : aucune 2e offre (une par période de 7 j)', '');
    donnee('main').vrm_planchers_ebay.at = T0 + 9 * JOUR - 3600000;
    const p3 = await passer(T0 + 9 * JOUR);
    dit(p3.journal.filter((x) => /send_offer/.test(x.u)).length === 1, '9 jours après (7 j après l’offre) : la période est passée, une nouvelle offre part', '');
    dit(env.every((c) => !/shipping|livraison/i.test(JSON.stringify(c)) && c.allowCounterOffer === false), 'le corps : la remise seule, aucun champ de livraison (§2.8)', '');
  });
  await essaie('E. E3 contre-offre par paliers', async () => {
    remettreBase(); remettreEbay();
    offresRecues = [{ id: '5001', itemId: '120000000001', buyer: 'acheteur_banc', prix: '60.00' }];
    await allumer({ paliers: { actif: true, preset: 'standard' } });
    const p = await passer(T0);
    const rs = p.journal.filter((x) => x.appel === 'RespondToBestOffer');
    dit(rs.length === 1 && /<Action>Counter<\/Action>/.test(rs[0].corps) && /<CounterOfferPrice currencyID="EUR">90\.00<\/CounterOfferPrice>/.test(rs[0].corps), 'offre 60 € sur 100 € (plancher 80) ⇒ contre-offre 90,00 € (1er palier, 50 %)', rs.map((x) => x.corps).join(' | '));
    const p2 = await passer(T0 + 3600000);
    dit(!p2.journal.some((x) => x.appel === 'RespondToBestOffer'), 'la même offre n’est jamais contre-offerte deux fois', '');
    offresRecues = [{ id: '5002', itemId: '120000000001', buyer: 'acheteur_banc', prix: '70.00' }];
    const p3 = await passer(T0 + 7200000);
    const r3 = p3.journal.filter((x) => x.appel === 'RespondToBestOffer');
    dit(r3.length === 1 && /<CounterOfferPrice currencyID="EUR">84\.00<\/CounterOfferPrice>/.test(r3[0].corps), 'sa nouvelle offre (70 €) ⇒ palier suivant : 84,00 €', r3.map((x) => x.corps).join(''));
    offresRecues = [{ id: '5003', itemId: '120000000001', buyer: 'acheteur_banc', prix: '75.00' }];
    const p4 = await passer(T0 + 3 * 3600000);
    const r4 = p4.journal.filter((x) => x.appel === 'RespondToBestOffer');
    dit(r4.length === 1 && /<CounterOfferPrice currencyID="EUR">80\.00<\/CounterOfferPrice>/.test(r4[0].corps), 'puis le plancher (80,00 €), l’étape finale — jamais dessous', r4.map((x) => x.corps).join(''));
    offresRecues = [{ id: '5004', itemId: '120000000001', buyer: 'acheteur_banc', prix: '78.00' }];
    const p5 = await passer(T0 + 4 * 3600000);
    dit(!p5.journal.some((x) => x.appel === 'RespondToBestOffer'), 'paliers épuisés : plus rien (l’offre reste à SON toucher)', '');
    offresRecues = [{ id: '5005', itemId: '120000000003', buyer: 'autre_banc', prix: '40.00' }];
    const p6 = await passer(T0 + 5 * 3600000);
    dit(!p6.journal.some((x) => x.appel === 'RespondToBestOffer'), 'une annonce sans SKU VRM-n° : jamais de contre-offre', '');
    // (28 nov., lot ebay-crm, C6) Un acheteur de SA liste d'exclusion (par identifiant, casse ignorée) : aucune contre-offre.
    lignes.push({ owner: J, id: 'vrm_crm_exclus', data: { liste: [{ site: 'ebay', id: 'acheteur_exclu' }] } });
    offresRecues = [{ id: '5006', itemId: '120000000001', buyer: 'Acheteur_Exclu', prix: '60.00' }];
    const p7 = await passer(T0 + 6 * 3600000);
    dit(!p7.journal.some((x) => x.appel === 'RespondToBestOffer'), 'un acheteur EXCLU (liste d’exclusion du CRM) : jamais de contre-offre automatique', '');
  });
  await essaie('F. E4 remise en vente', async () => {
    remettreBase(); remettreEbay();
    await allumer({ relance: { actif: true, parJour: 3, gratuitSeul: true } });
    const p = await passer(T0);
    const rl = p.journal.filter((x) => x.appel === 'RelistFixedPriceItem');
    if (process.env.DEBUG_EAUTO) console.log(JSON.stringify(etatAuto().journal), p.journal.map((x) => x.appel).join(','));
    dit(rl.length === 1 && balise(rl[0].corps, 'ItemID') === '120000000005' && rl[0].corps === '<?xml version="1.0" encoding="utf-8"?><RelistFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents"><Item><ItemID>120000000005</ItemID></Item></RelistFixedPriceItemRequest>', 'la paire présente (N°52) est remise en vente : l’identifiant SEUL part (aucun champ changé)', rl.map((x) => x.corps).join(''));
    const jr = etatAuto().journal.find((e) => e.moteur === 'relance' && e.etat === 'fait');
    dit(!!jr && jr.sku === 'VRM-52' && items[jr.neuf] && items[jr.neuf].sku === 'VRM-52', 'la nouvelle annonce RELUE porte le même SKU VRM-52 ⇒ « fait »', JSON.stringify(jr));
    dit(etatAuto().journal.some((e) => e.moteur === 'relance' && e.itemId === '120000000006' && e.raison === 'pas-prouvee'), 'N°77 pas en vente ailleurs (pas prouvée chez lui) ⇒ rien, dit', '');
    const p2 = await passer(T0 + 3600000);
    dit(!p2.journal.some((x) => x.appel === 'RelistFixedPriceItem'), 'jamais remise en vente deux fois', '');
    remettreBase(); remettreEbay(); frais = '0.35';
    await allumer({ relance: { actif: true, parJour: 3, gratuitSeul: true } });
    const p3 = await passer(T0);
    dit(!p3.journal.some((x) => x.appel === 'RelistFixedPriceItem') && etatAuto().journal.some((e) => e.raison === 'frais'), 'eBay facturerait 0,35 € ⇒ « sans frais seulement » : rien', '');
    remettreBase(); remettreEbay(); items['120000000007'] = { sku: 'VRM-52', prix: '75.00', statut: 'Active', debut: debut(2), obs: 0 };
    await allumer({ relance: { actif: true, parJour: 3, gratuitSeul: true } });
    const p4 = await passer(T0);
    dit(!p4.journal.some((x) => x.appel === 'RelistFixedPriceItem' && balise(x.corps, 'ItemID') === '120000000005'), 'le N°52 est déjà en ligne sur ce compte ⇒ jamais une 2e annonce', '');
  });
  await essaie('G. E6 modification en masse', async () => {
    remettreBase(); remettreEbay();
    const r0 = await app({ action: 'masse', op: 'pct', pct: 10, lignes: [{ itemId: '120000000001', prixVu: '100.00' }] });
    dit(r0.code === 400 && r0.j.reason === 'confirmation' && !ecritures().length, 'sans confirmation ⇒ 400, rien envoyé', JSON.stringify(r0.j));
    const r = await app({ action: 'masse', op: 'pct', pct: 10, confirme: true, lignes: [{ itemId: '120000000001', prixVu: '100.00' }, { itemId: '120000000002', prixVu: '85.00' }] });
    const rev = r.journal.filter((x) => x.appel === 'ReviseInventoryStatus');
    const l2 = (r.j.lignes || []).find((x) => x.itemId === '120000000002');
    dit(r.code === 200 && rev.length === 1 && /<StartPrice>90\.00<\/StartPrice>/.test(rev[0].corps), '−10 % sur deux annonces : 100 → 90 part (par `revise`, prix vu relu)', JSON.stringify(r.j.lignes));
    dit(l2 && l2.ok === false && l2.raison === 'sous-plancher', '85 → 76,50 est sous le plancher (80 €) : la ligne est REFUSÉE, jamais remontée en silence', JSON.stringify(l2));
    items['120000000001'].prix = '90.00';
    const r2 = await app({ action: 'masse', op: 'prix', prix: '79', confirme: true, lignes: [{ itemId: '120000000001', prixVu: '95.00' }] });
    dit(!r2.journal.some((x) => x.appel === 'ReviseInventoryStatus') && r2.j.lignes[0].ok === false, 'nouveau prix 79 € (sous 80) ⇒ refusé ; et un prix vu périmé ne part jamais', JSON.stringify(r2.j.lignes));
    const r3 = await app({ action: 'masse', op: 'fin', confirme: true, lignes: [{ itemId: '120000000004' }] });
    dit(r3.code === 200 && r3.journal.some((x) => x.appel === 'EndFixedPriceItem' && balise(x.corps, 'ItemID') === '120000000004'), '« Terminer » : la fin d’annonce de SON clic (EndFixedPriceItem)', JSON.stringify(r3.j));
  });
  await essaie('H. Vendre un similaire', async () => {
    remettreBase(); remettreEbay();
    const r = await app({ action: 'similaire', itemId: '120000000001' });
    const b = donnee('ebay_brouillons');
    const d = b && b.items && b.items[r.j.brouillon];
    dit(r.code === 200 && !!d && !d.numero && !d.pairId && d.similaireDe === '120000000001' && d.etatBrouillon === 'brouillon', 'un BROUILLON prérempli, SANS N° ni paire (il choisira la paire, donc un nouveau N°)', JSON.stringify(d && { titre: d.titre, numero: d.numero, similaireDe: d.similaireDe }));
    dit(!!d && d.aspects.Marque === 'Nike' && !('Pointure' in d.aspects) && d.photos.length === 1 && !r.journal.some((x) => ['AddFixedPriceItem', 'RelistFixedPriceItem'].includes(x.appel)), 'la pointure est retirée, la marque gardée ; RIEN n’est publié', JSON.stringify(d && d.aspects));
  });
  await essaie('I. Lancer maintenant', async () => {
    remettreBase(); remettreEbay();
    await allumer({ baisse: { actif: true, pct: 10, jours: 14 } });
    const r = await app({ action: 'autolancer' });
    dit(r.code === 200 && r.j.bilan && r.j.bilan.baisse === 2, '« Lancer maintenant » passe les moteurs allumés de CE compte', JSON.stringify(r.j.bilan));
    const l = await app({ action: 'autolire' });
    dit(l.j.journal.some((e) => e.moteur === 'baisse' && e.etat === 'fait') && l.j.dernier && l.j.dernier.gestes === 2, 'la page relit le journal et le dernier passage', JSON.stringify(l.j.dernier));
  });
  await essaie('J. un compte qui n’est pas en euros', async () => {
    remettreBase(); remettreEbay();
    lignes.push({ owner: J, id: 'ebay_comptes', data: { comptes: [{ cle: 'aaaaaaaaaaaaaaa1', pseudo: 'banc_uk', principal: true, ajouteLe: 1, site: 'GB' }] } });
    poser(mod.ID_AUTO, { v: 1, actif: true, comptes: { principal: { reglages: { baisse: { actif: true, pct: 10, jours: 14 } } } }, journal: [] });
    const p = await passer(T0);
    dit(!ecritures().length && etatAuto().comptes.principal.dernier && etatAuto().comptes.principal.dernier.raison === 'devise', 'compte eBay.co.uk (livres) : AUCUN geste automatique (le plancher est en euros), dit « devise »', JSON.stringify(etatAuto().comptes.principal.dernier));
  });
  // §2.8 et §3 sur TOUT ce qui est parti chez eBay pendant ce banc.
  dit(tousLesCorps.length > 20 && !tousLesCorps.some((c) => /FreeShipping|ShippingServiceCost|ShippingDetails|shippingCost|"shipping/i.test(String(c))), '§2.8 : aucun corps envoyé à eBay ne porte un champ de livraison', String(tousLesCorps.length) + ' corps');
  dit(!tousLesCorps.some((c) => /<Action>(Accept|Decline)<\/Action>/.test(String(c))), '§3 : aucune Action Accept / Decline n’est jamais partie (c’est eBay qui accepte, à SON seuil)', '');
  console.log(`\n${ok} ✅ · ${ko} ❌${MUT ? ' (mutation ' + MUT + ')' : ''}`);
  process.exit(ko ? 1 : 0);
})();
