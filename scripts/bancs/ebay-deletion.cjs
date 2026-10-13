// BANC de api/ebay-deletion.js — l'endpoint de conformité eBay, EXÉCUTÉ (§4.10).
// Vérifie que le challenge de vérification renvoie le hash EXACT attendu par
// eBay (sha256(challengeCode + verificationToken + endpoint)), que sans token
// c'est honnête (503), et qu'une notification (POST) est bien vérifiée puis acquittée (204).
const path = require('path'); const crypto = require('crypto');
const RACINE = path.join(__dirname, '..', '..');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const TOKEN = 'vrm-ebay-verif-token-0123456789abcdef', URL = 'https://vrm.center/api/ebay-deletion';
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.end = () => r; r.setHeader = () => r; return r; };

(async () => {
  const mod = await import('file://' + path.join(RACINE, 'api', 'ebay.js'));
  const handler = mod.default;

  // 1. Sans token → honnête, pas de faux hash
  delete process.env.EBAY_VERIF_TOKEN; delete process.env.EBAY_DELETION_URL;
  { const res = faireRes(); await handler({ method: 'GET', query: { mode: 'deletion', challenge_code: 'abc' }, headers: {} }, res);
    dit(res.code === 503 && res.corps && res.corps.reason === 'no-verif-token', 'sans verification token → 503 honnête (jamais un faux hash)', `HTTP ${res.code}`); }

  // 2. Challenge → hash EXACT attendu par eBay
  process.env.EBAY_VERIF_TOKEN = TOKEN; process.env.EBAY_DELETION_URL = URL;
  { const res = faireRes(); await handler({ method: 'GET', query: { mode: 'deletion', challenge_code: 'CHALLENGE123' }, headers: {} }, res);
    const attendu = crypto.createHash('sha256').update('CHALLENGE123').update(TOKEN).update(URL).digest('hex');
    dit(res.code === 200 && res.corps && res.corps.challengeResponse === attendu,
      'le challenge renvoie sha256(code + token + endpoint), l\'ordre exact d\'eBay', (res.corps && res.corps.challengeResponse || '').slice(0, 16) + '…'); }

  // 3. URL déduite du host si EBAY_DELETION_URL absent (doit rester cohérente)
  delete process.env.EBAY_DELETION_URL;
  { const res = faireRes(); await handler({ method: 'GET', query: { mode: 'deletion', challenge_code: 'X' }, headers: { host: 'pirate.test', 'x-forwarded-host': 'pirate.test' } }, res);
    const attendu = crypto.createHash('sha256').update('X').update(TOKEN).update('https://vrm.center/api/ebay-deletion').digest('hex');
    dit(res.corps && res.corps.challengeResponse === attendu, 'à défaut d\'URL explicite, l\'endpoint reste fixe même avec un Host falsifié'); }
  process.env.EBAY_DELETION_URL = URL;

  // 4. Santé (GET sans challenge) → dit si prêt
  { const res = faireRes(); await handler({ method: 'GET', query: { mode: 'deletion', mode: 'deletion' }, headers: {} }, res);
    dit(res.code === 200 && res.corps && res.corps.ready === true, 'GET sans challenge : santé ready:true quand le token est là'); }

  // 5. Ancienne et nouvelle portes : signature exigée, pas de contournement.
  const compte=(await import('file://' + path.join(RACINE,'api','compte.js'))).default;
  const v=require('../_ebay-signature-sdk.json');
  process.env.EBAY_APP_ID='FAUX_APP';process.env.EBAY_CERT_ID='FAUX_CERT';process.env.SUPABASE_SERVICE_KEY='FAUX_SERVICE';
  let ecritures=0,cles=0;
  global.fetch=async(url,opts={})=>{
    if(String(url).includes('/oauth2/token')) return {ok:true,json:async()=>({access_token:'FAUX_ACCESS',expires_in:7200})};
    if(String(url).includes('/public_key/')) {cles++;return {ok:true,status:200,json:async()=>v.response};}
    if(opts.method && opts.method!=='GET') ecritures++;
    return {ok:false,status:503,json:async()=>({})}; // base en panne
  };
  for(const [porte,mode] of [[handler,'deletion'],[compte,'ebay-deletion']]) {
    const avantSansSignature=ecritures;
    let res=faireRes();await porte({method:'POST',query:{mode},rawBody:Buffer.from(JSON.stringify(v.message)),headers:{}},res);
    dit(res.code===412 && ecritures===avantSansSignature,'notification sans signature : 412, aucune écriture ni effacement');
    const brut=Buffer.from(JSON.stringify(v.message));
    res=faireRes();await porte({method:'POST',query:{mode},rawBody:brut,headers:{'x-ebay-signature':v.signature}},res);
    dit(res.code===204,'signature valide + base en panne : 204 sur cette porte');
    const avant=ecritures;
    res=faireRes();await porte({method:'POST',query:{mode},rawBody:Buffer.from(brut.toString().replace('test_user','pirate')),headers:{'x-ebay-signature':v.signature}},res);
    dit(res.code===412 && ecritures===avant,'corps falsifié : 412, aucun effacement');
  }
  dit(cles===1,'la clé publique reste en mémoire malgré la panne de base');

  console.log(ko ? ('\n' + ko + ' controle(s) non conforme(s).') : '\nL\'endpoint de conformité eBay répond au challenge avec le bon hash et vérifie les signatures et acquitte les notifications valides.');
  process.exit(ko ? 1 : 0);
})();
