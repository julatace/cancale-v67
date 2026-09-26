// BANC de api/ebay.js — la route OAuth eBay, EXÉCUTÉE (§4.10 : `npm run build`
// ne compile pas `api/`, `node --check` ne voit ni un mensonge sur un échec, ni
// un en-tête d'auth mal formé). On lance la vraie route avec un FAUX eBay et un
// FAUX Supabase (global.fetch moqué) et on vérifie :
//   • sans clés → 503 honnête (jamais un 200) ;
//   • l'URL de consentement porte client_id + redirect_uri + les bons scopes ;
//   • l'échange envoie bien `authorization_code` et l'en-tête Basic base64(App:Cert) ;
//   • un refus eBay REMONTE (jamais 200) ;
//   • « connecté » n'est répondu QUE si le refresh_token a VRAIMENT été rangé ;
//   • AUCUN jeton (access/refresh) ni le Cert ne fuit dans une réponse.
const path = require('path');
const RACINE = path.join(__dirname, '..', '..');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };

const APP = 'davidfou-VRM-PRD-xxxx', CERT = 'PRD-secret-cert-value-zzzz', RU = 'David_Fournier-david-VRM-abcde';
const REFRESH = 'v^1.1#i^1#REFRESHTOKENSECRET', ACCESS = 'v^1.1#i^1#ACCESSTOKEN';

let ebayBody = null, ebayAuth = null, supaWrites = [], supaHasRow = false, supaReadOk = true, ebayMode = 'ok', finMode = 'ok';
function poserFetch() {
  global.fetch = async (url, opts = {}) => {
    const u = String(url); const h = opts.headers || {};
    if (u.includes('identity/v1/oauth2/token')) {
      ebayBody = String(opts.body || ''); ebayAuth = h.Authorization || h.authorization || '';
      if (ebayMode === 'badkey') return new Response(JSON.stringify({ error: 'invalid_client', error_description: 'client authentication failed' }), { status: 401 });
      if (ebayMode === 'down') return new Response('boom', { status: 500 });
      if (ebayBody.includes('client_credentials')) return new Response(JSON.stringify({ access_token: ACCESS, expires_in: 7200 }), { status: 200 });
      if (ebayBody.includes('authorization_code')) return new Response(JSON.stringify({ access_token: ACCESS, refresh_token: REFRESH, expires_in: 7200, refresh_token_expires_in: 47304000 }), { status: 200 });
      if (ebayBody.includes('refresh_token')) return new Response(JSON.stringify({ access_token: ACCESS, expires_in: 7200 }), { status: 200 });
      return new Response('{}', { status: 200 });
    }
    if (u.includes('/sell/finances/v1/seller_funds_summary')) {
      if (finMode === 'scope') return new Response(JSON.stringify({ errors: [{ errorId: 1100, message: 'Access denied: insufficient permissions' }] }), { status: 403 });
      return new Response(JSON.stringify({ totalFunds: { value: '250.94', currency: 'EUR' }, availableFunds: { value: '227.54', currency: 'EUR' }, processingFunds: { value: '12.40', currency: 'EUR' }, fundsOnHold: { value: '11.00', currency: 'EUR' } }), { status: 200 });
    }
    if (u.includes('/rest/v1/app_data')) {
      if (opts.method === 'POST') { supaWrites.push(String(opts.body || '')); return new Response('', { status: supaWriteOk ? 201 : 500 }); }
      // GET status
      if (!supaReadOk) return new Response('err', { status: 522 });
      return new Response(JSON.stringify(supaHasRow ? [{ refresh_token: REFRESH }] : []), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  };
}
let supaWriteOk = true;
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.end = () => r; return r; };
const noSecret = (o) => { const s = JSON.stringify(o || {}); return !s.includes(CERT) && !s.includes(REFRESH) && !s.includes(ACCESS); };

(async () => {
  const mod = await import('file://' + path.join(RACINE, 'api', 'ebay.js'));
  const handler = mod.default;
  poserFetch();

  // ── 1. SANS CLÉS : rien n'est promis ────────────────────────────────────────
  delete process.env.EBAY_APP_ID; delete process.env.EBAY_CERT_ID; delete process.env.EBAY_RUNAME;
  { const res = faireRes(); await handler({ method: 'GET', query: {} }, res);
    dit(res.code === 200 && res.corps && res.corps.ready === false, 'sans clés : GET dit ready:false', 'ready=' + (res.corps && res.corps.ready)); }
  { const res = faireRes(); await handler({ method: 'POST', body: { action: 'apptoken' } }, res);
    dit(res.code === 503 && res.corps && res.corps.reason === 'no-key', 'sans clés : POST → 503 honnête (jamais un 200 qui ment)', `HTTP ${res.code}`); }

  // ── 2. CLÉS POSÉES ──────────────────────────────────────────────────────────
  process.env.EBAY_APP_ID = APP; process.env.EBAY_CERT_ID = CERT; process.env.SUPABASE_SERVICE_KEY = 'svc-key';
  { const res = faireRes(); await handler({ method: 'GET', query: {} }, res);
    dit(res.corps && res.corps.ready === true && res.corps.canConsent === false, 'clés posées mais pas de RuName : ready:true, canConsent:false'); }

  // ── 3. URL DE CONSENTEMENT ──────────────────────────────────────────────────
  { const res = faireRes(); await handler({ method: 'POST', body: { action: 'authurl' } }, res);
    dit(res.code === 503 && res.corps && res.corps.reason === 'no-runame', 'authurl sans RuName → 503 honnête'); }
  process.env.EBAY_RUNAME = RU;
  { const res = faireRes(); await handler({ method: 'GET', query: {} }, res);
    dit(res.corps && res.corps.canConsent === true, 'avec RuName : canConsent:true'); }
  { const res = faireRes(); await handler({ method: 'POST', body: { action: 'authurl', state: 'x' } }, res);
    const u = res.corps && res.corps.url || '';
    dit(res.code === 200 && u.includes('auth.ebay.com') && u.includes('client_id=' + encodeURIComponent(APP)) && u.includes('redirect_uri=' + encodeURIComponent(RU)) && /sell\.inventory/.test(decodeURIComponent(u)),
      'authurl : URL de consentement complète (client_id + redirect_uri + scopes vendeur)', u.slice(0, 60) + '…'); }

  // ── 4. JETON APPLICATIF : les clés marchent, l'en-tête Basic est correct ────
  ebayMode = 'ok';
  { const res = faireRes(); await handler({ method: 'POST', body: { action: 'apptoken' } }, res);
    const attendu = 'Basic ' + Buffer.from(`${APP}:${CERT}`).toString('base64');
    dit(res.code === 200 && res.corps && res.corps.works === true, 'apptoken : les clés sont validées');
    dit(ebayAuth === attendu, 'l\'échange porte l\'en-tête Basic base64(App:Cert)', ebayAuth ? 'ok' : '(aucun)');
    dit(/grant_type=client_credentials/.test(ebayBody || ''), 'et le grant_type client_credentials');
    dit(noSecret(res.corps), 'apptoken ne renvoie AUCUN jeton ni le Cert'); }

  // ── 5. UN REFUS eBAY REMONTE (jamais 200) ───────────────────────────────────
  ebayMode = 'badkey';
  { const res = faireRes(); await handler({ method: 'POST', body: { action: 'apptoken' } }, res);
    dit(res.code === 401 && res.corps && res.corps.ok === false, 'clés refusées par eBay (401) → remonte, pas 200', `HTTP ${res.code}`); }
  ebayMode = 'down';
  { const res = faireRes(); await handler({ method: 'POST', body: { action: 'apptoken' } }, res);
    dit(res.code === 502 && res.corps && res.corps.ok === false, 'eBay en panne (5xx) → 502, pas 200'); }

  // ── 6. ÉCHANGE DU CODE → refresh rangé serveur ──────────────────────────────
  ebayMode = 'ok';
  { const res = faireRes(); await handler({ method: 'POST', body: { action: 'exchange' } }, res);
    dit(res.code === 400, 'exchange sans code → 400'); }
  supaWrites = []; supaWriteOk = true;
  { const res = faireRes(); await handler({ method: 'POST', body: { action: 'exchange', code: 'C123' } }, res);
    dit(res.code === 200 && res.corps && res.corps.connected === true, 'exchange OK → connected:true');
    dit(/grant_type=authorization_code/.test(ebayBody || '') && /redirect_uri=/.test(ebayBody || ''), 'l\'échange envoie authorization_code + redirect_uri');
    dit(supaWrites.length === 1 && supaWrites[0].includes(REFRESH), 'le refresh_token est RANGÉ côté serveur (Supabase)', supaWrites.length + ' écriture(s)');
    dit(noSecret(res.corps), 'exchange ne renvoie AUCUN jeton au navigateur'); }

  // ── 7. ON N'ANNONCE « connecté » QUE SI ON A VRAIMENT RANGÉ ─────────────────
  supaWriteOk = false; supaWrites = [];
  { const res = faireRes(); await handler({ method: 'POST', body: { action: 'exchange', code: 'C123' } }, res);
    dit(res.code === 500 && res.corps && res.corps.reason === 'store-failed', 'rangement échoué → 500 honnête, JAMAIS « connecté »', `HTTP ${res.code}`); }
  supaWriteOk = true;

  // ── 8. ÉTAT DU COMPTE ───────────────────────────────────────────────────────
  supaHasRow = true; supaReadOk = true;
  { const res = faireRes(); await handler({ method: 'POST', body: { action: 'status' } }, res);
    dit(res.code === 200 && res.corps && res.corps.connected === true, 'status : compte relié → connected:true');
    dit(noSecret(res.corps), 'status ne renvoie pas le jeton'); }
  supaHasRow = false;
  { const res = faireRes(); await handler({ method: 'POST', body: { action: 'status' } }, res);
    dit(res.corps && res.corps.connected === false, 'status : aucun compte → connected:false'); }
  supaReadOk = false;
  { const res = faireRes(); await handler({ method: 'POST', body: { action: 'status' } }, res);
    dit(res.code === 503 && res.corps && res.corps.reason === 'store-unreachable', 'base injoignable → 503, jamais « pas connecté » inventé (§ pas su ≠ non)'); }

  // ── 9. SOLDE À VIRER (getSellerFundsSummary) ────────────────────────────────
  // Le compte est relié (refresh rangé) ; eBay renvoie le solde. On lit les
  // montants qu'eBay LABELLISE, jamais un calcul de notre part (§5.14).
  supaHasRow = true; supaReadOk = true; ebayMode = 'ok'; finMode = 'ok'; supaWrites = []; ebayBody = null;
  { const res = faireRes(); await handler({ method: 'POST', body: { action: 'finances' } }, res);
    dit(res.code === 200 && res.corps && res.corps.ok === true && res.corps.dispo === 227.54, 'finances : « disponible à virer » = ce qu\'eBay renvoie (227,54 €)', 'dispo=' + (res.corps && res.corps.dispo));
    dit(res.corps && res.corps.enAttente === 12.40 && res.corps.retenu === 11.00, 'et « en attente » / « retenu » restent DISTINCTS (§5.14 escrow≠dispo)', `att=${res.corps && res.corps.enAttente} ret=${res.corps && res.corps.retenu}`);
    dit(!/scope=/.test(ebayBody || ''), 'le RAFRAÎCHISSEMENT ne redemande AUCUN scope (n\'ajoute pas un droit non accordé → ne casse pas les accès)', ebayBody ? 'body sans scope' : '(aucun appel)');
    dit(supaWrites.some(w => w.includes('ebay_finances')), 'le solde est rangé (ebay_finances) pour le tableau de bord');
    dit(noSecret(res.corps), 'finances ne renvoie AUCUN jeton'); }

  // ── 10. DROIT « paiements » PAS ENCORE ACCORDÉ (jeton d'avant) → 403 ─────────
  // On n'invente aucun chiffre : on dit « reconnecte-toi ». « Pas su » ≠ « 0 € ».
  finMode = 'scope';
  { const res = faireRes(); await handler({ method: 'POST', body: { action: 'finances' } }, res);
    dit(res.code === 200 && res.corps && res.corps.ok === false && res.corps.reason === 'scope', 'accès paiements manquant (403) → reason:scope, jamais un solde inventé', `HTTP ${res.code} reason=${res.corps && res.corps.reason}`);
    dit(res.corps && res.corps.dispo == null, 'et AUCUN montant n\'est renvoyé (pas de 0 € trompeur)'); }

  console.log(ko ? ('\n' + ko + ' controle(s) non conforme(s).')
    : '\nLa route eBay s\'authentifie avec les clés cachées, range le jeton côté serveur, lit le solde sans jamais l\'inventer, et ne ment jamais sur un échec.');
  process.exit(ko ? 1 : 0);
})();
