#!/usr/bin/env node
// (8 nov.) Les routes que l'extension appelle (compte?mode=commandes|favoris,
// relais, push) répondent au préalable CORS d'Orion (OPTIONS ⇒ 204 + en-têtes)
// pour une origine d'EXTENSION, et refusent toute autre origine (403, aucun
// en-tête). Exécute les VRAIS gestionnaires. --prouve : mutations.
const path = require('path'), fs = require('fs');
const R = path.join(__dirname, '..');
let rouges = 0; const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) rouges++; };
const faux = (method, origin, url) => { const h = {}; const res = { statusCode: 200, headers: h, setHeader(k, v) { h[k.toLowerCase()] = v; }, getHeader(k) { return h[k.toLowerCase()]; }, end() { this.fini = true; }, status(c) { this.statusCode = c; return this; }, json() { this.fini = true; return this; }, send() { this.fini = true; return this; } }; return { req: { method, headers: origin ? { origin } : {}, query: { mode: 'commandes' }, url: url || '/api/compte?mode=commandes' }, res }; };
(async () => {
  const lib = await import(path.join(R, 'api/_lib/cors-extension.js'));
  ok(lib.origineAutorisee('safari-web-extension://ABC-123') && lib.origineAutorisee('chrome-extension://abcdefghijklmnop') && lib.origineAutorisee('moz-extension://1234-abcd') && lib.origineAutorisee('webkit-extension://X1'), 'origines d’extension admises (Orion, Chrome, Firefox)');
  ok(!lib.origineAutorisee('https://evil.example') && !lib.origineAutorisee('null') && !lib.origineAutorisee('') && !lib.origineAutorisee('chrome-extension://a b') && !lib.origineAutorisee('https://x-extension.evil.com') && !lib.origineAutorisee('extension://x'), 'toute autre origine refusée');
  for (const route of ['api/compte.js', 'api/relais.js', 'api/push.js']) {
    let mod; try { mod = await import(path.join(R, route)); } catch (e) { ok(false, `${route} se charge (${e.message.slice(0, 80)})`); continue; }
    const a = faux('OPTIONS', 'safari-web-extension://ORION-1');
    await mod.default(a.req, a.res);
    ok(a.res.statusCode === 204 && a.res.headers['access-control-allow-origin'] === 'safari-web-extension://ORION-1' && /authorization/i.test(a.res.headers['access-control-allow-headers'] || '') && !a.res.headers['access-control-allow-credentials'], `${route} : préalable d’Orion ⇒ 204, origine renvoyée, Authorization permis, pas de cookies`);
    const b = faux('OPTIONS', 'https://evil.example');
    await mod.default(b.req, b.res);
    ok(b.res.statusCode === 403 && !b.res.headers['access-control-allow-origin'], `${route} : une autre origine ⇒ 403, aucun en-tête`);
  }
  if (process.argv.includes('--prouve')) {
    console.log('\n— Mutations —');
    const { execFileSync } = require('child_process');
    for (const [f, de, vers, nom] of [
      ['api/_lib/cors-extension.js', 'return RE_ORIGINE_EXTENSION.test(o) || ORIGINES_SITE.has(o);', 'return true;', 'toute origine admise'],
      ['api/compte.js', "  if (corsExtension(req, res)) return;", '', 'compte sans préalable'],
      ['api/_lib/cors-extension.js', "res.statusCode = ok ? 204 : 403;", 'res.statusCode = 405;', 'préalable en 405'],
    ]) {
      const p = path.join(R, f), t = fs.readFileSync(p, 'utf8');
      if (!t.includes(de)) { ok(false, `mutation introuvable : ${nom}`); continue; }
      fs.writeFileSync(p, t.replace(de, vers));
      let rouge = false; try { execFileSync(process.execPath, [__filename], { stdio: 'pipe' }); } catch (_) { rouge = true; }
      fs.writeFileSync(p, t); ok(rouge, `mutation « ${nom} » ⇒ rouge`);
    }
  }
  console.log(rouges ? `\n❌ ${rouges} rouge(s)` : '\n✅ tout vert'); process.exit(rouges ? 1 : 0);
})();
