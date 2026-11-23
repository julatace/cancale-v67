// ═══════════════════════════════════════════════════════════
//  BANC — LES PHOTOS D'UN AUTRE HÔTE VERS LE FORMULAIRE DE DÉPÔT (19 nov. 2026, publier-agent)
//
//  Question du coordinateur : un article venu de Leboncoin ou d'eBay, publié sur Vestiaire (ou l'inverse), part avec des
//  photos servies par un AUTRE hôte que la page de dépôt. La page peut-elle les lire ? Sinon, le fond le peut-il ?
//  Mesuré, rien de supposé — base et images INVENTÉES :
//   1. Chromium réel : une page de dépôt simulée à la vraie adresse (https://fr.vestiairecollective.com/smart-listing/,
//      https://www.leboncoin.fr/deposer-une-annonce) lit une image servie par https://i.ebayimg.com/ et par
//      https://img.leboncoin.fr/ SANS en-tête CORS (comme les CDN) : `fetch` ⇒ refusé ; `no-cors` ⇒ réponse opaque
//      (0 octet lisible) ⇒ la page ne PEUT PAS en faire un fichier.
//   2. Le chemin réel des scripts de dépôt : lbc.js et vc-depot.js ne téléchargent aucune photo eux-mêmes, ils
//      demandent les octets au fond (`photoBytes`).
//   3. Le VRAI background.js (`photosEnOctets`, scripts/_fond-vm.cjs) : une photo i.ebayimg.com, img.leboncoin.fr,
//      images1.vinted.net ⇒ octets rendus ; un hôte inconnu ou un nom qui finit pareil ⇒ refusé. Aucun nouvel hôte au
//      manifeste (i.ebayimg.com y est déjà).
//  `--src chemin` : un autre background.js (preuve sur le code d'avant : i.ebayimg.com y est refusé).
// ═══════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const RACINE = path.join(__dirname, '..', '..');
const NM = path.join(RACINE, 'node_modules');
try { require(path.join(__dirname, '_porte-banc.cjs')); } catch (_) {}
const { chromium } = require(path.join(NM, 'playwright'));
const { faireFond, cheminSource } = require('../_fond-vm.cjs');
let rouges = 0, verts = 0;
const dit = (ok, quoi, d) => { if (ok) { verts++; console.log('  ✅ ' + quoi); } else { rouges++; console.log('  ❌ ' + quoi + (d !== undefined ? '\n       ' + JSON.stringify(d).slice(0, 500) : '')); } };
// Un JPEG minuscule valide (inventé).
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');

(async () => {
  console.log('── 1. la page de dépôt ne peut pas lire une image d’un autre hôte');
  // DE VRAIS serveurs (pas de `route.fulfill`, qui contourne CORS) : les noms des sites résolus vers 127.0.0.1 par
  // Chromium lui-même (`--host-resolver-rules`), en http local — la règle CORS est la même qu'en https.
  const http = require('http');
  const PORT = Number(process.env.BANC_PORT) || 8961;
  const srv = http.createServer((req, res) => {
    const h = String(req.headers.host || '').split(':')[0];
    if (/^(i\.ebayimg\.com|img\.leboncoin\.fr|images1\.vinted\.net)$/.test(h)) { res.writeHead(200, { 'content-type': 'image/jpeg' }); res.end(JPEG); return; }   // aucun Access-Control-Allow-Origin, comme les CDN
    res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><html><body><form><input type="file" multiple></form></body></html>');
  });
  await new Promise((ok) => srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server', `--host-resolver-rules=MAP * 127.0.0.1:${PORT}`] });
  try {
    for (const [depot, imgs] of [['fr.vestiairecollective.com/smart-listing/', ['i.ebayimg.com/images/g/abc/s-l1600.jpg', 'img.leboncoin.fr/api/v1/lbcpb1/images/a.jpg']], ['www.leboncoin.fr/deposer-une-annonce', ['i.ebayimg.com/images/g/abc/s-l1600.jpg', 'images1.vinted.net/t/x.jpeg']]]) {
      const ctx = await nav.newContext(); const pg = await ctx.newPage();
      await pg.goto(`http://${depot.replace('/', ':' + PORT + '/')}`);
      for (const img of imgs) {
        const u = `http://${img.replace('/', ':' + PORT + '/')}`;
        const r = await pg.evaluate(async (u) => {
          const out = {};
          try { const x = await fetch(u); out.cors = { ok: x.ok, n: (await x.arrayBuffer()).byteLength }; } catch (e) { out.cors = { refuse: String(e && e.message || e).slice(0, 60) }; }
          try { const x = await fetch(u, { mode: 'no-cors' }); out.opaque = { type: x.type, n: (await x.arrayBuffer()).byteLength }; } catch (e) { out.opaque = { refuse: String(e).slice(0, 60) }; }
          return out;
        }, u);
        dit(r.cors && r.cors.refuse && r.opaque && r.opaque.type === 'opaque' && r.opaque.n === 0, `1 ${depot.split('/')[0]} ⇒ ${img.split('/')[0]} : fetch refusé (CORS), no-cors opaque (0 octet lisible)`, r);
      }
      await ctx.close();
    }
  } finally { await nav.close(); srv.close(); }

  console.log('── 2. les scripts de dépôt demandent les octets au fond');
  for (const f of ['lbc.js', 'vc-depot.js']) {
    const t = fs.readFileSync(path.join(RACINE, 'vinted-sync-extension', f), 'utf8');
    const fetchs = (t.match(/\bfetch\(/g) || []).length;
    dit(/action: 'photoBytes'/.test(t) && !/fetch\(\s*(?:u|url|src|ph|photo|p)\b/.test(t), `2 ${f} : les photos passent par le fond (\`photoBytes\`), aucun fetch de photo dans la page (${fetchs} fetch au total)`);
  }

  console.log('── 3. le VRAI background.js télécharge, hôte par hôte');
  const b = faireFond({ src: cheminSource() });
  const vu = [];
  b.ctx.fetch = async (u) => { vu.push(String(u)); return { ok: true, status: 200, headers: { get: (k) => (/type/i.test(k) ? 'image/jpeg' : String(JPEG.length)) }, arrayBuffer: async () => JPEG.buffer.slice(JPEG.byteOffset, JPEG.byteOffset + JPEG.length) }; };
  const urls = ['https://i.ebayimg.com/images/g/abc/s-l1600.jpg', 'https://img.leboncoin.fr/api/v1/lbcpb1/images/a.jpg', 'https://images1.vinted.net/t/x.jpeg', 'https://exemple.invalid/a.jpg', 'https://evil-ebayimg.com/a.jpg', 'https://a.i.ebayimg.com/a.jpg'];
  const r = await b.ctx.photosEnOctets(urls, 12);
  const ok = (u) => { const x = r.find((y) => y.url === u); return !!(x && x.b64); };
  dit(ok(urls[0]) && ok(urls[1]) && ok(urls[2]), '3 i.ebayimg.com, img.leboncoin.fr, images1.vinted.net ⇒ octets rendus par le fond', r.map((x) => [x.url, !!x.b64, x.erreur]));
  dit(!ok(urls[3]) && !ok(urls[4]) && !ok(urls[5]) && !vu.some((u) => /exemple|evil|a\.i\.ebayimg/.test(u)), '3 un hôte inconnu, un nom qui finit pareil, un sous-domaine ⇒ refusés SANS requête', vu);
  const man = JSON.parse(fs.readFileSync(path.join(RACINE, 'vinted-sync-extension', 'manifest.json'), 'utf8'));
  dit((man.host_permissions || []).includes('https://i.ebayimg.com/*'), '3 i.ebayimg.com est déjà au manifeste : aucun nouvel hôte');
  console.log(`\n${rouges ? '❌' : '✅'} banc photos-autre-hote : ${verts} vert(s), ${rouges} rouge(s)`);
  process.exitCode = rouges ? 1 : 0;
})();
