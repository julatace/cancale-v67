// BANC DE api/detourage.js — la route de détourage Photoroom, EXÉCUTÉE.
// §4.10 : `npm run build` ne compile pas `api/`, et `node --check` ne voit ni un
// mensonge sur un échec, ni un appel mal formé. On lance la vraie route avec un
// FAUX Photoroom (global.fetch moqué) et on vérifie :
//   • sans clé → 503 honnête (pas un 200 mensonger), et GET ready:false ;
//   • avec clé → l'appel porte bien `x-api-key` et le base64, et la route rend
//     l'image détourée ;
//   • une erreur Photoroom (500 / 403) REMONTE (on ne fait jamais semblant) ;
//   • une image manquante → 400.
const path = require('path');
const RACINE = path.join(__dirname, '..', '..');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };

let dernierAppel = null;
function poserFetch(mode) {
  global.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (u.includes('sdk.photoroom.com')) {
      dernierAppel = { url: u, headers: opts.headers || {}, body: opts.body || '' };
      if (mode === 'err500') return new Response('upstream boom', { status: 500 });
      if (mode === 'err403') return new Response('bad key', { status: 403 });
      // Succès : Photoroom renvoie des OCTETS d'image (ici un faux PNG).
      const png = Buffer.from('\x89PNG\r\n\x1a\nFAKECUTOUT', 'binary');
      return new Response(png, { status: 200, headers: { 'content-type': 'image/png' } });
    }
    return new Response('{}', { status: 200 });
  };
}
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.end = () => r; return r; };

(async () => {
  const mod = await import('file://' + path.join(RACINE, 'api', 'detourage.js'));
  const handler = mod.default;

  // ── 1. SANS CLÉ : rien n'est promis ────────────────────────────────────────
  delete process.env.PHOTOROOM_API_KEY;
  poserFetch('ok');
  { const res = faireRes(); await handler({ method: 'GET', query: {} }, res);
    dit(res.code === 200 && res.corps && res.corps.ready === false, 'sans clé : GET dit ready:false', 'ready=' + (res.corps && res.corps.ready)); }
  { const res = faireRes(); await handler({ method: 'POST', body: { b64: 'aGVsbG8=' } }, res);
    dit(res.code === 503 && res.corps && res.corps.ok === false && res.corps.reason === 'no-key',
      'sans clé : POST → 503 honnête (jamais un 200 qui ment)', `HTTP ${res.code}`); }

  // ── 2. AVEC CLÉ : l'appel est bien formé et l'image revient ─────────────────
  process.env.PHOTOROOM_API_KEY = 'test-key-123';
  poserFetch('ok'); dernierAppel = null;
  { const res = faireRes(); await handler({ method: 'POST', body: { b64: 'data:image/jpeg;base64,QUJD' } }, res);
    dit(res.code === 200 && res.corps && res.corps.ok === true && typeof res.corps.b64 === 'string' && res.corps.b64.length > 0,
      'avec clé : la route rend l\'image détourée', `HTTP ${res.code}`);
    dit(dernierAppel && (dernierAppel.headers['x-api-key'] === 'test-key-123'),
      'l\'appel Photoroom porte la clé (x-api-key), jamais dans le code', dernierAppel ? JSON.stringify(dernierAppel.headers['x-api-key']) : '(aucun appel)');
    let corpsEnvoye = {}; try { corpsEnvoye = JSON.parse(dernierAppel.body); } catch (_) {}
    dit(corpsEnvoye.image_file_b64 === 'QUJD', 'le base64 est transmis SANS le préfixe data-URL', JSON.stringify(corpsEnvoye.image_file_b64)); }

  // ── 3. UNE ERREUR PHOTOROOM REMONTE (on ne fait jamais semblant) ───────────
  poserFetch('err500');
  { const res = faireRes(); await handler({ method: 'POST', body: { b64: 'QUJD' } }, res);
    dit(res.code >= 500 && res.corps && res.corps.ok === false, 'erreur serveur Photoroom (500) → la route répond en échec, pas 200', `HTTP ${res.code}`); }
  poserFetch('err403');
  { const res = faireRes(); await handler({ method: 'POST', body: { b64: 'QUJD' } }, res);
    dit(res.code === 403 && res.corps && res.corps.ok === false, 'clé refusée (403) → remonte tel quel', `HTTP ${res.code}`); }

  // ── 4. IMAGE MANQUANTE ─────────────────────────────────────────────────────
  poserFetch('ok');
  { const res = faireRes(); await handler({ method: 'POST', body: {} }, res);
    dit(res.code === 400 && res.corps && res.corps.ok === false, 'image manquante → 400', `HTTP ${res.code}`); }

  console.log(ko ? ('\n' + ko + ' controle(s) non conforme(s).') : '\nLa route détoure via Photoroom, avec la clé cachée côté serveur, et ne ment jamais sur un échec.');
  process.exit(ko ? 1 : 0);
})();
