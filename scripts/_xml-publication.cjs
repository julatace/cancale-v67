// ════════════════════════════════════════════════════════════════════════════
//  LE XML DE PUBLICATION, IMPRIMÉ TEL QU'IL PART CHEZ eBAY (9 octobre)
//        node scripts/_xml-publication.cjs [--src dossier] [--offre-null]
//
//  Outil de preuve de la règle d'offre (D7) : une annonce SANS règle doit
//  partir avec EXACTEMENT le XML d'avant, caractère pour caractère. Ce script
//  exécute la vraie route (`api/ebay.js` de `--src`, sinon du dépôt) contre un
//  faux eBay minimal (la forme de `bancs/ebay-write.cjs`), appelle `pubverify`,
//  `publish` et `programmer` sur trois annonces inventées, et imprime chaque
//  corps envoyé à eBay. `prouve-regle-offre.cjs` le lance sur la base d'avant
//  et sur l'arbre courant, et exige deux sorties identiques.
//  `--offre-null` : les mêmes annonces avec `offre: null` (même XML exigé).
//  Aucune donnée réelle : tout est inventé ici.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');
const OFFRE_NULL = process.argv.includes('--offre-null');
const PROPRIO = '11111111-1111-1111-1111-111111111111';
process.env.VRM_OWNER_UID = PROPRIO;
process.env.EBAY_APP_ID = 'app'; process.env.EBAY_CERT_ID = 'cert'; process.env.EBAY_RUNAME = 'ru'; process.env.SUPABASE_SERVICE_KEY = 'svc';
const envois = [];
let nItem = 0;
global.fetch = async (url, opts = {}) => {
  const u = decodeURIComponent(String(url)); const h = opts.headers || {};
  if (u.includes('/auth/v1/user')) return new Response(JSON.stringify({ id: PROPRIO, email: 'p@exemple.test' }), { status: 200 });
  if (u.includes('identity/v1/oauth2/token')) return new Response(JSON.stringify({ access_token: 'AT', refresh_token: 'RT', expires_in: 7200 }), { status: 200 });
  if (u.includes('/rest/v1/app_data')) {
    // Base NON cloisonnée (la sonde de la colonne `owner` répond 400) : un seul
    // compte, celui de l'installation — la forme d'avant le multi-vendeurs.
    if (/select=owner/.test(u)) return new Response('{"message":"column app_data.owner does not exist"}', { status: 400 });
    if (opts.method === 'POST' || opts.method === 'PATCH') return new Response('', { status: 201 });
    if (/ebay_tokens/.test(u)) return new Response(JSON.stringify([{ refresh_token: 'RT' }]), { status: 200 });
    return new Response('[]', { status: 200 });
  }
  if (u.includes('/rest/v1/rpc/')) return new Response('true', { status: 200 });
  if (u.includes('/ws/api.dll')) {
    const appel = h['X-EBAY-API-CALL-NAME'] || '';
    const corps = String(opts.body || '');
    if (/AddFixedPriceItem|VerifyAddFixedPriceItem/.test(appel)) envois.push(appel + '\n' + corps);
    if (appel === 'GetMyeBaySelling') return new Response('<?xml version="1.0"?><r xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack></r>', { status: 200 });
    if (appel === 'VerifyAddFixedPriceItem') return new Response('<?xml version="1.0"?><r xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack><Fees><Fee><Name>InsertionFee</Name><Fee currencyID="EUR">0.35</Fee></Fee><Fee><Name>ListingFee</Name><Fee currencyID="EUR">0.35</Fee></Fee></Fees></r>', { status: 200 });
    if (appel === 'AddFixedPriceItem') { nItem++; return new Response(`<?xml version="1.0"?><r xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack><ItemID>11055500011${nItem}</ItemID><StartTime>2026-10-09T10:00:00.000Z</StartTime><EndTime>2026-11-08T10:00:00.000Z</EndTime></r>`, { status: 200 }); }
    return new Response('<?xml version="1.0"?><r xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack></r>', { status: 200 });
  }
  return new Response('{}', { status: 200 });
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.end = () => r; r.setHeader = () => r; return r; };
const base = { categoryId: '15709', quantity: '1', conditionId: '3000', aspects: { Marque: 'Nike', 'Pointure EU': '44', Couleur: 'Bleu' }, ebayGere: true };
const items = [
  { ...base, title: 'Nike Air Max 1 bleu taille 44', price: '80', photos: ['https://x.test/1.jpg', 'https://x.test/2.jpg'], description: 'Paire inventée pour le banc', numero: '41' },
  { ...base, title: 'Adidas Samba blanc taille 42', price: '90.50', photos: ['https://x.test/3.jpg'], description: 'Autre paire inventée' },
  { ...base, title: 'Salomon XT-6 noir taille 43', price: '120', photos: ['https://x.test/4.jpg'], description: 'Troisième paire', numero: 'B12', conditionId: '1000' },
];
(async () => {
  const mod = await import('file://' + path.join(RACINE, 'api', 'ebay.js'));
  const appel = async (body) => { const res = faireRes(); await mod.default({ method: 'POST', query: {}, headers: { authorization: 'Bearer eyJh.banc-proprio.sig' }, body }, res); return res; };
  for (const [i, it0] of items.entries()) {
    const it = OFFRE_NULL ? { ...it0, offre: null } : it0;
    const v = await appel({ action: 'pubverify', item: it });
    console.log(`=== pubverify ${i} → HTTP ${v.code} ok=${v.corps && v.corps.ok}`);
    if (it.numero) {
      const p = await appel({ action: 'programmer', item: it, confirme: true, uuid: 'A'.repeat(31) + String(i), fraisVus: 0.35, scheduleTime: '' });
      console.log(`=== programmer ${i} → HTTP ${p.code} ok=${p.corps && p.corps.ok}`);
    }
    const q = await appel({ action: 'publish', item: it });
    console.log(`=== publish ${i} → HTTP ${q.code} ok=${q.corps && q.corps.ok}`);
  }
  console.log('=== CORPS ENVOYÉS À eBAY (' + envois.length + ')');
  for (const e of envois) console.log(e + '\n---');
})().catch((e) => { console.log('ERREUR ' + (e && e.stack || e)); process.exit(1); });
