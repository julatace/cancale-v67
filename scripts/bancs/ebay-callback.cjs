// BANC de api/ebay-callback.js — le RETOUR de consentement eBay, EXÉCUTÉ (§4.10).
// On vérifie que le callback :
//   • sur un refus (?error) → renvoie l'app vers ?ebay=refus ;
//   • sans code → ?ebay=erreur ;
//   • sur un code valide → échange, RANGE le refresh, renvoie ?ebay=connecte ;
//   • si le rangement échoue → ?ebay=erreur (JAMAIS « connecté ») ;
//   • AUCUN jeton n'apparaît dans l'URL de retour (Location).
const path = require('path');
const RACINE = path.join(__dirname, '..', '..');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };

const APP = 'davidfou-VRM-PRD-xxxx', CERT = 'PRD-secret-cert-zzzz', RU = 'David_F-VRM-abcde';
const REFRESH = 'v^1.1#i^1#REFRESHSECRET', ACCESS = 'v^1.1#i^1#ACCESSTOKEN';
let supaWriteOk = true, ebayMode = 'ok';
global.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (u.includes('identity/v1/oauth2/token')) {
    if (ebayMode === 'bad') return new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 });
    return new Response(JSON.stringify({ access_token: ACCESS, refresh_token: REFRESH, expires_in: 7200, refresh_token_expires_in: 47304000 }), { status: 200 });
  }
  if (u.includes('/rest/v1/app_data')) return new Response('', { status: supaWriteOk ? 201 : 500 });
  return new Response('{}', { status: 200 });
};
const faireRes = () => { const r = { code: null, headers: {} }; r.status = (n) => { r.code = n; return r; }; r.setHeader = (k, v) => { r.headers[k] = v; return r; }; r.json = (o) => { r.body = o; return r; }; r.end = () => r; return r; };
const loc = (res) => res.headers.Location || '';

(async () => {
  process.env.EBAY_APP_ID = APP; process.env.EBAY_CERT_ID = CERT; process.env.EBAY_RUNAME = RU; process.env.EBAY_SERVICE_KEY; process.env.SUPABASE_SERVICE_KEY = 'svc';
  const mod = await import('file://' + path.join(RACINE, 'api', 'ebay-callback.js'));
  const handler = mod.default;

  { const res = faireRes(); await handler({ query: { error: 'access_denied' } }, res);
    dit(res.code === 302 && /ebay=refus/.test(loc(res)), 'refus de consentement → retour ?ebay=refus', loc(res)); }
  { const res = faireRes(); await handler({ query: {} }, res);
    dit(res.code === 302 && /ebay=erreur/.test(loc(res)), 'aucun code → retour ?ebay=erreur', loc(res)); }

  ebayMode = 'ok'; supaWriteOk = true;
  { const res = faireRes(); await handler({ query: { code: 'C123', state: 'x' } }, res);
    dit(res.code === 302 && /ebay=connecte/.test(loc(res)), 'code valide + rangement OK → ?ebay=connecte', loc(res));
    dit(!loc(res).includes(REFRESH) && !loc(res).includes(ACCESS), 'AUCUN jeton dans l\'URL de retour', loc(res)); }

  supaWriteOk = false;
  { const res = faireRes(); await handler({ query: { code: 'C123' } }, res);
    dit(res.code === 302 && /ebay=erreur/.test(loc(res)) && !/connecte/.test(loc(res)), 'rangement échoué → ?ebay=erreur, JAMAIS connecte', loc(res)); }
  supaWriteOk = true; ebayMode = 'bad';
  { const res = faireRes(); await handler({ query: { code: 'BADCODE' } }, res);
    dit(res.code === 302 && /ebay=erreur/.test(loc(res)), 'code refusé par eBay → ?ebay=erreur', loc(res)); }

  // sans clés → erreur honnête (pas de crash)
  ebayMode = 'ok'; delete process.env.EBAY_APP_ID;
  { const res = faireRes(); await handler({ query: { code: 'C123' } }, res);
    dit(res.code === 302 && /ebay=erreur/.test(loc(res)), 'clés absentes → ?ebay=erreur', loc(res)); }

  console.log(ko ? ('\n' + ko + ' controle(s) non conforme(s).') : '\nLe retour eBay range le jeton, renvoie un statut, et ne laisse jamais fuir de jeton.');
  process.exit(ko ? 1 : 0);
})();
