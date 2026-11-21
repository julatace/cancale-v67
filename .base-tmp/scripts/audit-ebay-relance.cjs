// ════════════════════════════════════════════════════════════════════════════
//  eBAY : REMETTRE EN VENTE UNE INACTIVE, SUR SON CLIC (3 novembre)
//        node scripts/audit-ebay-relance.cjs [--src dossier] [--mutation=nom]
//
//  La VRAIE route `api/ebay.js` (actions `relanceverif`, `relancer`) devant un
//  faux eBay qui rend du XML Trading au vrai format (GetItem, GetMyeBaySelling,
//  VerifyRelistFixedPriceItem, RelistFixedPriceItem) et une fausse base qui
//  filtre par vendeur. Données INVENTÉES (dépôt public).
//  Ce qui doit rester vrai :
//   · sans `confirme:true`, RIEN ne part chez eBay ;
//   · ce qui part est l'identifiant SEUL (aucun prix, aucune livraison, aucun
//     « FreeShipping ») : même prix, même livraison gérée par eBay, même SKU ;
//   · l'annonce est RELUE chez eBay : vendue, active, sans SKU, SKU d'une autre
//     paire (numérotation 013 comprise), prix différent du prix vu, livraison
//     gratuite, déjà en ligne sur un de ses comptes ⇒ refus, rien ne part ;
//   · une réponse illisible d'eBay ⇒ « incertain », jamais « fait ».
//  Et la règle de l'ÉCRAN (`src/ebayRelance.js`) : une paire vendue ailleurs,
//  sortie du stock, sans identité ou aux ventes pas vérifiées n'est PAS proposée.
//  Mutations (`--mutation=`) : `confirme` (garde de confirmation retirée),
//  `vendue` (l'écran propose une paire vendue), `gratuite` (la livraison gratuite
//  n'est plus refusée), `champs` (le corps envoyé recopie le prix et la livraison).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), os = require('os');
const iSrc = process.argv.indexOf('--src');
let RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';

// `fast-xml-parser` (lu par une autre partie de la route) n'est pas toujours
// installé dans le conteneur du banc : un bouchon qui lève s'il est appelé.
require('node:module').register('data:text/javascript,' + encodeURIComponent(
  "export async function resolve(s, c, n) { if (s === 'fast-xml-parser') return { url: 'data:text/javascript,' + encodeURIComponent('export class XMLParser { parse() { throw new Error(\"bouchon\"); } } export const XMLValidator = { validate() { return true; } };'), shortCircuit: true }; return n(s, c); }"));

if (MUT) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'relance-mut-'));
  fs.cpSync(path.join(RACINE, 'api'), path.join(tmp, 'api'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'src'));
  fs.copyFileSync(path.join(RACINE, 'src', 'ebayRelance.js'), path.join(tmp, 'src', 'ebayRelance.js'));
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  const remplace = (f, a, b) => { const p = path.join(tmp, f); const s = fs.readFileSync(p, 'utf8'); if (!s.includes(a)) { console.log('mutation introuvable : ' + a); process.exit(2); } fs.writeFileSync(p, s.replace(a, b)); };
  if (MUT === 'confirme') remplace('api/ebay.js', 'if (!seulementVerifier && b.confirme !== true)', 'if (false)');
  if (MUT === 'vendue') remplace('src/ebayRelance.js', "if (o.vendue) return", "if (false) return");
  if (MUT === 'gratuite') remplace('api/_lib/ebay-relance.js', 'if (lu.gratuite === true) return', 'if (false) return');
  if (MUT === 'champs') remplace('api/_lib/ebay-relance.js', '`<Item><ItemID>${itemId}</ItemID></Item>`', '`<Item><ItemID>${itemId}</ItemID><StartPrice>1.00</StartPrice><ShippingDetails><ShippingServiceOptions><FreeShipping>true</FreeShipping></ShippingServiceOptions></ShippingDetails></Item>`');
  RACINE = tmp;
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.message || e).slice(0, 200)); } };

const J = '11111111-1111-1111-1111-111111111111';
const JWT_J = 'eyJh.jeton-de-J.sig';
process.env.VRM_OWNER_UID = J;
process.env.EBAY_APP_ID = 'app-de-banc'; process.env.EBAY_CERT_ID = 'secret-de-banc'; process.env.EBAY_RUNAME = 'runame-de-banc';
process.env.SUPABASE_SERVICE_KEY = 'cle-service-de-banc';

// ── la fausse base ──
let lignes = [];
let numerotation = null;   // le marqueur 013 (objet) ou null
const remettreBase = () => { lignes = [{ owner: J, id: 'ebay_tokens', data: { refresh_token: 'rt-de-J', saved_at: 1 } }]; numerotation = null; };
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

// ── le faux eBay ──
// Une annonce : { itemId, sku, prix, statut, vendus, debut, livraison: 'geree'|'gratuite'|'flat0'|'flat', relist, variantes }
let items = {}, actives = [], journal = [], prochain = 120000000500, mode = {};
const ITEM = (a) => {
  const livr = a.livraison === 'gratuite' ? '<ShippingDetails><ShippingType>Flat</ShippingType><ShippingServiceOptions><ShippingService>FR_ColiposteColissimo</ShippingService><ShippingServiceCost currencyID="EUR">0.0</ShippingServiceCost><FreeShipping>true</FreeShipping></ShippingServiceOptions></ShippingDetails>'
    : a.livraison === 'flat0' ? '<ShippingDetails><ShippingType>Flat</ShippingType><ShippingServiceOptions><ShippingService>FR_ColiposteColissimo</ShippingService><ShippingServiceCost currencyID="EUR">0.00</ShippingServiceCost></ShippingServiceOptions></ShippingDetails>'
    : a.livraison === 'flat' ? '<ShippingDetails><ShippingType>Flat</ShippingType><ShippingServiceOptions><ShippingService>FR_ColiposteColissimo</ShippingService><ShippingServiceCost currencyID="EUR">6.5</ShippingServiceCost></ShippingServiceOptions></ShippingDetails>' : '';
  return `<Item><ItemID>${a.itemId}</ItemID><Title>Paire inventée</Title>${a.sku ? `<SKU>${a.sku}</SKU>` : ''}<Currency>EUR</Currency><StartPrice currencyID="EUR">${a.prix}</StartPrice><Description><![CDATA[<SKU>VRM-999</SKU><CurrentPrice currencyID="EUR">1.0</CurrentPrice>]]></Description>`
    + `${a.variantes ? '<Variations><Variation><SKU>VRM-1</SKU></Variation></Variations>' : ''}<SellingStatus><CurrentPrice currencyID="EUR">${a.prix}</CurrentPrice>${a.vendus === undefined ? '' : `<QuantitySold>${a.vendus}</QuantitySold>`}<ListingStatus>${a.statut}</ListingStatus></SellingStatus>`
    + `${livr}<ListingDetails><StartTime>${a.debut}</StartTime><EndTime>2026-10-30T10:00:00.000Z</EndTime>${a.relist ? `<RelistedItemID>${a.relist}</RelistedItemID>` : ''}</ListingDetails></Item>`;
};
const OK = (appel, inner) => `<?xml version="1.0" encoding="UTF-8"?><${appel}Response xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack>${inner || ''}</${appel}Response>`;
const fee = (n, v) => `<Fee><Name>${n}</Name><Fee currencyID="EUR">${v}</Fee></Fee>`;
const remettreEbay = () => {
  items = {
    '120000000101': { itemId: '120000000101', sku: 'VRM-12', prix: '74.0', statut: 'Completed', vendus: 0, debut: '2026-10-20T10:00:00.000Z', livraison: 'geree' },
  };
  actives = []; journal = []; mode = {};
};
const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });
const xmlRep = (s) => new Response(s, { status: 200, headers: { 'content-type': 'text/xml' } });
const balise = (s, t) => (new RegExp('<' + t + '>([\\s\\S]*?)</' + t + '>').exec(s || '') || [])[1] || '';
global.fetch = async (url, opts = {}) => {
  const u = String(url), m = (opts.method || 'GET').toUpperCase(), h = opts.headers || {};
  if (u.includes('/auth/v1/user')) return String(h.Authorization || h.authorization || '') === 'Bearer ' + JWT_J ? rep({ id: J, email: 'j@exemple.test' }) : rep({ msg: 'invalid' }, 401);
  if (u.includes('ebay.com')) {
    const appel = h['X-EBAY-API-CALL-NAME'] || '';
    const corps = String(opts.body || '');
    if (u.includes('/identity/v1/oauth2/token')) return rep({ access_token: 'at-J', expires_in: 7200 });
    journal.push({ appel, corps });
    if (appel === 'GetUser') return xmlRep(OK('GetUser', '<User><UserID>julien_part</UserID><EIASToken>EIAS-J-0000000001</EIASToken><Site>France</Site></User>'));
    if (appel === 'GetMyeBaySelling') {
      const x = actives.map((a) => `<Item><ItemID>${a.itemId}</ItemID><Title>x</Title><SKU>${a.sku}</SKU><SellingStatus><CurrentPrice currencyID="EUR">${a.prix}</CurrentPrice></SellingStatus></Item>`).join('');
      return xmlRep(OK('GetMyeBaySelling', x ? `<ActiveList><ItemArray>${x}</ItemArray><PaginationResult><TotalNumberOfPages>1</TotalNumberOfPages></PaginationResult></ActiveList>` : ''));
    }
    if (appel === 'GetItem') {
      const a = items[balise(corps, 'ItemID')];
      return xmlRep(OK('GetItem', a ? ITEM(a) : ''));
    }
    if (appel === 'VerifyRelistFixedPriceItem') return xmlRep(OK('VerifyRelistFixedPriceItem', `<ItemID>0</ItemID><Fees>${fee('InsertionFee', '0.0')}${fee('ListingFee', '0.0')}</Fees>`));
    if (appel === 'RelistFixedPriceItem') {
      if (mode.relist === '503') return new Response('<html>503</html>', { status: 503, headers: { 'content-type': 'text/html' } });
      const ancien = items[balise(corps, 'ItemID')];
      const id = String(prochain++);
      const prixEnvoye = balise(corps, 'StartPrice');
      items[id] = { ...ancien, itemId: id, statut: 'Active', vendus: 0, prix: prixEnvoye || ancien.prix, livraison: /FreeShipping>true/.test(corps) ? 'gratuite' : ancien.livraison, relist: '' };
      return xmlRep(OK('RelistFixedPriceItem', `<ItemID>${id}</ItemID><Fees>${fee('ListingFee', '0.0')}</Fees><StartTime>2026-11-03T10:00:00.000Z</StartTime>`));
    }
    return xmlRep(OK(appel, ''));
  }
  if (u.includes('/rest/v1/rpc/vrm_acces_pour')) return rep(true);
  if (u.includes('/rest/v1/app_data')) {
    const q = decodeURIComponent(u);
    if (/select=owner&limit=1/.test(q)) return rep([]);
    if (m !== 'GET') return rep('', 201);
    const id = (/[?&]id=eq\.([^&]*)/.exec(q) || [])[1];
    const owner = (/[?&]owner=eq\.([^&]*)/.exec(q) || [])[1];
    const sel = (/[?&]select=([^&]*)/.exec(q) || [])[1];
    if (id === 'main') { const v = (/select=v:data->>(\w+)/.exec(q) || [])[1]; return rep(v === 'vrm_numerotation' && numerotation ? [{ v: JSON.stringify(numerotation) }] : [{ v: null }]); }
    const out = lignes.filter((r) => (!id || r.id === id) && (!owner || r.owner === owner));
    return rep(out.map((r) => projette(r, sel)));
  }
  return rep({});
};
const faireRes = () => { const x = { code: null, corps: null, entetes: {} }; x.status = (n) => { x.code = n; return x; }; x.json = (o) => { x.corps = o; return x; }; x.setHeader = (k, v) => { x.entetes[String(k).toLowerCase()] = v; }; x.end = () => x; return x; };

(async () => {
  let route;
  await essaie('chargement de la route', async () => { route = await import('file://' + path.join(RACINE, 'api', 'ebay.js')); });
  if (!route) { console.log(`\n${ok} ✅ · ${ko} ❌`); process.exit(1); }
  const app = async (corps) => { journal.length = 0; const res = faireRes(); await route.default({ method: 'POST', query: {}, headers: { authorization: 'Bearer ' + JWT_J }, body: corps }, res); return { code: res.code, j: res.corps || {}, appels: journal.map((x) => x.appel), journal: journal.slice() }; };
  const relist = (r) => r.journal.filter((x) => x.appel === 'RelistFixedPriceItem');
  const BASE = { itemId: '120000000101', numero: '12', prixVu: '74' };

  await essaie('A. confirmation', async () => {
    remettreBase(); remettreEbay();
    const r = await app({ action: 'relancer', ...BASE });
    dit(r.code === 400 && r.j.reason === 'confirmation' && r.appels.length === 0, 'sans `confirme:true` : refus « confirmation », AUCUN appel à eBay', JSON.stringify({ c: r.code, j: r.j, a: r.appels }));
    const r2 = await app({ action: 'relancer', ...BASE, confirme: 'oui' });
    dit(r2.code === 400 && r2.j.reason === 'confirmation' && relist(r2).length === 0, '`confirme` doit être EXACTEMENT `true` (« oui » ne suffit pas)', JSON.stringify(r2.j));
  });

  await essaie('B. vérifier à blanc', async () => {
    remettreBase(); remettreEbay();
    const r = await app({ action: 'relanceverif', ...BASE });
    dit(r.code === 200 && r.j.ok === true && r.j.num === '12' && r.j.sku === 'VRM-12' && r.j.prix === 74 && r.j.frais && r.j.frais.total === 0, '`relanceverif` : relue chez eBay, N°12, 74 €, frais lus (0,00 €)', JSON.stringify(r.j));
    dit(r.appels.includes('GetItem') && r.appels.includes('GetMyeBaySelling') && r.appels.includes('VerifyRelistFixedPriceItem') && !r.appels.includes('RelistFixedPriceItem'), 'vérifier ne remet RIEN en vente (GetItem · liste des comptes · vérification à blanc)', r.appels.join(','));
  });

  await essaie('C. remettre en vente', async () => {
    remettreBase(); remettreEbay();
    const r = await app({ action: 'relancer', ...BASE, confirme: true });
    const env = relist(r);
    dit(r.code === 200 && r.j.ok === true && /^\d+$/.test(String(r.j.itemId)) && r.j.ancien === '120000000101' && r.j.sku === 'VRM-12', 'sur SA confirmation : remise en vente, nouvelle annonce, même SKU', JSON.stringify(r.j));
    dit(env.length === 1 && /<RelistFixedPriceItemRequest[\s\S]*<Item><ItemID>120000000101<\/ItemID><\/Item>/.test(env[0].corps), 'ce qui part : l’identifiant SEUL (`<Item><ItemID>…</ItemID></Item>`)', env[0] && env[0].corps.slice(0, 400));
    dit(env.length === 1 && !/StartPrice|ShippingDetails|FreeShipping|ShippingServiceCost|<SKU>/.test(env[0].corps), 'aucun prix, aucune livraison, aucun « FreeShipping » envoyé (§2.8) : eBay recopie l’annonce', env[0] && env[0].corps.slice(0, 400));
    dit(r.j.verifie === true && items[r.j.itemId] && items[r.j.itemId].prix === '74.0' && items[r.j.itemId].livraison === 'geree', 'relue après coup : même prix, livraison gérée par eBay (`verifie`)', JSON.stringify(items[r.j.itemId]));
  });

  const refuse = async (nom, prep, corps, reason, statut) => {
    await essaie(nom, async () => {
      remettreBase(); remettreEbay(); prep();
      const r = await app({ action: 'relancer', ...BASE, ...(corps || {}), confirme: true });
      dit(r.code === statut && r.j.reason === reason && relist(r).length === 0, nom + ` ⇒ ${statut} « ${reason} », rien ne part`, JSON.stringify({ c: r.code, j: r.j }));
    });
  };
  await refuse('D. vendue sur eBay (QuantitySold 1)', () => { items['120000000101'].vendus = 1; }, null, 'vendue', 409);
  await refuse('E. encore en ligne chez eBay', () => { items['120000000101'].statut = 'Active'; }, null, 'en-ligne', 409);
  await refuse('F. QuantitySold absent (pas su)', () => { items['120000000101'].vendus = undefined; }, null, 'pas-su', 503);
  await refuse('G. sans SKU (aucune identité)', () => { items['120000000101'].sku = ''; }, null, 'sans-identite', 409);
  await refuse('H. SKU d’une AUTRE paire', () => { items['120000000101'].sku = 'VRM-13'; }, null, 'identite', 409);
  await refuse('I. prix chez eBay ≠ prix vu', () => { items['120000000101'].prix = '69.0'; }, null, 'prix-change', 409);
  await refuse('J. livraison gratuite (FreeShipping)', () => { items['120000000101'].livraison = 'gratuite'; }, null, 'livraison-gratuite', 409);
  await refuse('K. port fixe à 0,00 €', () => { items['120000000101'].livraison = 'flat0'; }, null, 'livraison-gratuite', 409);
  await refuse('L. déjà remise en vente (RelistedItemID)', () => { items['120000000101'].relist = '120000000999'; }, null, 'deja-relancee', 409);
  await refuse('M. la paire est déjà en ligne sur eBay (autre annonce, même SKU)', () => { actives = [{ itemId: '120000000222', sku: 'VRM-12', prix: '80.0' }]; }, null, 'deja-en-ligne', 409);
  await refuse('N. annonce à variantes', () => { items['120000000101'].variantes = true; }, null, 'variantes', 409);
  await refuse('O. écran ouvert avant la remise à zéro (numérotation)', () => { numerotation = { version: 2, archive: 'B', coupure: '2026-10-09T00:00:00Z' }; }, { numerotation: 1 }, 'numerotation-perimee', 409);
  await essaie('P. port fixe payant : accepté', async () => {
    remettreBase(); remettreEbay(); items['120000000101'].livraison = 'flat';
    const r = await app({ action: 'relancer', ...BASE, confirme: true });
    dit(r.code === 200 && relist(r).length === 1, 'un port payé par l’acheteur (6,50 €) n’est pas « gratuit » : remise en vente', JSON.stringify(r.j));
  });
  await essaie('Q. numérotation 013 : un SKU d’avant la coupure', async () => {
    remettreBase(); remettreEbay(); numerotation = { version: 2, archive: 'B', coupure: '2026-10-09T00:00:00Z' };
    items['120000000101'].sku = 'VRM-21'; items['120000000101'].debut = '2026-09-01T10:00:00.000Z';
    const r1 = await app({ action: 'relancer', ...BASE, numero: '21', numerotation: 2, confirme: true });
    dit(r1.code === 409 && r1.j.reason === 'identite' && relist(r1).length === 0, '« VRM-21 » publiée AVANT la remise à zéro désigne la B21, pas la 21 : refus', JSON.stringify(r1.j));
    const r2 = await app({ action: 'relancer', ...BASE, numero: 'B21', numerotation: 2, confirme: true });
    dit(r2.code === 200 && r2.j.num === 'B21' && relist(r2).length === 1, '…et la B21 est bien celle-là', JSON.stringify(r2.j));
  });
  await essaie('R. eBay muet', async () => {
    remettreBase(); remettreEbay(); mode.relist = '503';
    const r = await app({ action: 'relancer', ...BASE, confirme: true });
    dit(r.code === 504 && r.j.reason === 'incertain' && r.j.ok === false, 'une réponse sans Ack (503 HTML) : « incertain », jamais « fait »', JSON.stringify(r.j));
  });

  // ── LA RÈGLE DE L'ÉCRAN ──
  await essaie('S. src/ebayRelance.js', async () => {
    const R = await import('file://' + path.join(RACINE, 'src', 'ebayRelance.js'));
    const base = { n: '12', prix: '74' };
    dit(R.relanceProposable(base).propose === true, 'une inactive reliée (N°12), vendue nulle part, chez lui : proposée');
    dit(R.relanceProposable({ ...base, vendue: 'Vinted' }).propose === false, 'vendue ailleurs (Vinted) : PAS proposée', JSON.stringify(R.relanceProposable({ ...base, vendue: 'Vinted' })));
    dit(R.relanceProposable({ ...base, n: '' }).propose === false, 'sans N° (pas d’identité) : pas proposée');
    dit(R.relanceProposable({ ...base, verifManque: true }).propose === false, 'ventes pas encore vérifiées : pas proposée');
    dit(R.relanceProposable({ ...base, retraitAuto: { at: 1 } }).propose === false, 'retirée d’eBay par VRM car vendue ailleurs : pas proposée');
    dit(R.relanceProposable({ ...base, sortie: R.numeroSorti('12', { '12@987': { id: '987' } }) }).propose === false, 'déclarée partie du stock (`12@annonce`) : pas proposée');
    dit(R.relanceProposable({ ...base, sortie: R.numeroSorti('12', null) }).propose === false, 'stock illisible (pas su) : pas proposée');
    dit(R.relanceProposable({ ...base, sortie: R.numeroSorti('12', { '13': {} }) }).propose === true, 'une AUTRE paire sortie (N°13) ne bloque pas la N°12');
    dit(R.relanceProposable({ ...base, deja: { etat: 'en-vente' } }).propose === false && R.relanceProposable({ ...base, ancienne: true }).propose === false, 'déjà de retour sur eBay, ou capture ancienne : pas proposée');
  });

  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
