// BANC de api/ebay-deletion.js — l'endpoint de conformité eBay, EXÉCUTÉ (§4.10).
// Vérifie que le challenge de vérification renvoie le hash EXACT attendu par
// eBay (sha256(challengeCode + verificationToken + endpoint)), que sans token
// c'est honnête (503), et qu'une notification (POST) est bien acquittée (200).
const path = require('path'); const crypto = require('crypto');
const RACINE = path.join(__dirname, '..', '..');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const TOKEN = 'vrm-ebay-verif-token-0123456789abcdef', URL = 'https://vrm.center/api/ebay-deletion';
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.end = () => r; return r; };

(async () => {
  const mod = await import('file://' + path.join(RACINE, 'api', 'ebay-deletion.js'));
  const handler = mod.default;

  // 1. Sans token → honnête, pas de faux hash
  delete process.env.EBAY_VERIF_TOKEN; delete process.env.EBAY_DELETION_URL;
  { const res = faireRes(); await handler({ method: 'GET', query: { challenge_code: 'abc' }, headers: {} }, res);
    dit(res.code === 503 && res.corps && res.corps.reason === 'no-verif-token', 'sans verification token → 503 honnête (jamais un faux hash)', `HTTP ${res.code}`); }

  // 2. Challenge → hash EXACT attendu par eBay
  process.env.EBAY_VERIF_TOKEN = TOKEN; process.env.EBAY_DELETION_URL = URL;
  { const res = faireRes(); await handler({ method: 'GET', query: { challenge_code: 'CHALLENGE123' }, headers: {} }, res);
    const attendu = crypto.createHash('sha256').update('CHALLENGE123').update(TOKEN).update(URL).digest('hex');
    dit(res.code === 200 && res.corps && res.corps.challengeResponse === attendu,
      'le challenge renvoie sha256(code + token + endpoint), l\'ordre exact d\'eBay', (res.corps && res.corps.challengeResponse || '').slice(0, 16) + '…'); }

  // 3. URL déduite du host si EBAY_DELETION_URL absent (doit rester cohérente)
  delete process.env.EBAY_DELETION_URL;
  { const res = faireRes(); await handler({ method: 'GET', query: { challenge_code: 'X' }, headers: { host: 'vrm.center' } }, res);
    const attendu = crypto.createHash('sha256').update('X').update(TOKEN).update('https://vrm.center/api/ebay-deletion').digest('hex');
    dit(res.corps && res.corps.challengeResponse === attendu, 'à défaut d\'URL explicite, l\'endpoint est reconstruit depuis le host'); }
  process.env.EBAY_DELETION_URL = URL;

  // 4. Santé (GET sans challenge) → dit si prêt
  { const res = faireRes(); await handler({ method: 'GET', query: {}, headers: {} }, res);
    dit(res.code === 200 && res.corps && res.corps.ready === true, 'GET sans challenge : santé ready:true quand le token est là'); }

  // 5. Notification POST → acquittée 200
  { const res = faireRes(); await handler({ method: 'POST', body: { metadata: {}, notification: {} }, headers: {} }, res);
    dit(res.code === 200 && res.corps && res.corps.ok === true, 'une notification de suppression est acquittée (200)'); }

  console.log(ko ? ('\n' + ko + ' controle(s) non conforme(s).') : '\nL\'endpoint de conformité eBay répond au challenge avec le bon hash et acquitte les notifications.');
  process.exit(ko ? 1 : 0);
})();
