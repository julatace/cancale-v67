// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LE CONTRÔLE QUOTIDIEN DE LA PRODUCTION — node scripts/audit-verifier-production.cjs [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// (5 nov.) `scripts/verifier-production.mjs` (lancé par
// .github/workflows/disponibilite.yml) doit ÉCHOUER, avec un message clair, dès
// que la production ne répond plus comme le dépôt l'attend. Cet audit l'EXÉCUTE
// contre une COPIE LOCALE de la production (un serveur qui sert public/, une
// page d'accueil au titre d'index.html et un faux /api/sante — aucune donnée,
// aucun secret), saine puis cassée d'une façon à la fois :
//   S. saine ⇒ code 0, chaque contrôle « OK » ;
//   P. chaque panne ⇒ code 1, et le message dit laquelle : extension d'une autre
//      version, zip à deux dossiers, zip remplacé par la page de l'app, paquet
//      Orion d'une autre version, clé de /api/sante absente ou pas un oui/non,
//      clé de service absente, /api/sante en 500, titre changé, manifeste ou
//      icône absents, service worker remplacé par la page, route privée ouverte,
//      serveur injoignable ; sous GitHub Actions, une annotation `::error` ;
//   W. le workflow : il lance ce script, en lecture seule, sans aucun secret ;
//      le script ne lit aucune variable d'environnement hors `VRM_ORIGINE` et
//      `GITHUB_ACTIONS`.
// `--prouve` : réaffaiblit le script, une mutation à la fois ⇒ ROUGE exigé.
'use strict';
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib');
const { spawnSync, spawn } = require('child_process');
const R = path.join(__dirname, '..');
const SCRIPT = path.join(R, 'scripts', 'verifier-production.mjs');

if (process.argv.includes('--prouve')) {
  const MUTS = [
    ['version de l’extension non comparée', "if (p.version !== versionAttendue) return", 'if (false) return'],
    ['zip à plusieurs dossiers accepté', "if (p.tetes.length !== 1 || dossiers.length !== 1) return", 'if (false) return'],
    ['page de l’app prise pour le zip', "  if (pageApp(r)) return 'la page de l’app est servie à la place du zip';\n", ''],
    ['clés de /api/sante non vérifiées', 'if (manque.length) return', 'if (false) return'],
    ['clé de service non exigée', "if (j.serviceKey !== true) return", 'if (false) return'],
    ['titre non vérifié', "if (!r.texte.includes(`<title>${titreAttendu}</title>`)) return", 'if (false) return'],
    ['version Orion non comparée', "return p.version === depot.version || `version", 'return true || `version'],
    ['service worker non vérifié', "if (pageApp(r) || !/javascript/i.test(r.type)) return", 'if (false) return'],
    ['icônes non vérifiées', 'return !mortes.length ||', 'return true ||'],
    ['échec sans code d’erreur', '  process.exitCode = 1;\n', ''],
  ];
  const src = fs.readFileSync(SCRIPT, 'utf8');
  let rouges = 0;
  process.on('exit', () => fs.writeFileSync(SCRIPT, src));
  for (const [nom, avant, apres] of MUTS) {
    if (!src.includes(avant)) { console.log(`❌ mutation « ${nom} » : motif introuvable`); continue; }
    try {
      fs.writeFileSync(SCRIPT, src.replace(avant, apres));
      const r = spawnSync(process.execPath, [__filename], { cwd: R, encoding: 'utf8', timeout: 300000 });
      if (r.status !== 0) rouges++;
      console.log(`${r.status !== 0 ? '✅' : '❌'} mutation « ${nom} » ⇒ ${r.status !== 0 ? 'ROUGE' : 'encore vert'}`);
    } finally { fs.writeFileSync(SCRIPT, src); }
  }
  const ok = rouges === MUTS.length;
  console.log(`\n${ok ? '✅' : '❌'} ${rouges}/${MUTS.length} mutations rouges`);
  process.exit(ok ? 0 : 1);
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d !== undefined ? ' — ' + String(d).slice(0, 500) : '')); };

// Un zip « stocké » (sans compression), pour servir des paquets cassés exprès.
function zip(fichiers) {
  const locaux = [], centraux = []; let off = 0;
  for (const [nom, contenu] of fichiers) {
    const n = Buffer.from(nom), d = Buffer.from(contenu), crc = zlib.crc32(d) >>> 0;
    const l = Buffer.alloc(30); l.writeUInt32LE(0x04034b50, 0); l.writeUInt16LE(20, 4); l.writeUInt32LE(crc, 14); l.writeUInt32LE(d.length, 18); l.writeUInt32LE(d.length, 22); l.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt32LE(crc, 16); c.writeUInt32LE(d.length, 20); c.writeUInt32LE(d.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(off, 42);
    locaux.push(l, n, d); centraux.push(c, n); off += 30 + n.length + d.length;
  }
  const cd = Buffer.concat(centraux);
  const e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(fichiers.length, 8); e.writeUInt16LE(fichiers.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...locaux, cd, e]);
}

const lire = (rel) => fs.readFileSync(path.join(R, rel));
const titre = /<title>([^<]+)<\/title>/.exec(lire('index.html').toString())[1].trim();
const attendue = /const EXT_ATTENDUE\s*=\s*'([0-9.]+)'/.exec(lire('src/App.jsx').toString())[1];
const PAGE = `<!doctype html><html><head><title>${titre}</title><script type="module" src="/assets/index-banc.js"></script></head><body><div id="root"></div></body></html>`;
const santeSaine = () => ({ ok: true, serviceKey: true, owner: true, ia: false, detourage: false, stripe: false, stripeWebhook: false, relancesEssai: false });

let PANNE = {};
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x'); const p = u.pathname;
  const envoyer = (code, type, corps) => { r.writeHead(code, { 'content-type': type }); r.end(corps); };
  const page = () => envoyer(200, 'text/html; charset=utf-8', PANNE.titre ? PAGE.replace(titre, 'Autre site') : PAGE);   // l'app répond à tout chemin inconnu
  if (p === '/') return page();
  if (p === '/api/sante') {
    if (PANNE.sante500) return envoyer(500, 'application/json', '{"error":"FUNCTION_INVOCATION_FAILED"}');
    const s = santeSaine(); if (PANNE.santeSansCle) delete s.relancesEssai; if (PANNE.santePasBool) s.ia = 'oui'; if (PANNE.sansServiceKey) s.serviceKey = false;
    return envoyer(200, 'application/json', JSON.stringify(s));
  }
  if (p === '/api/compte' && u.searchParams.get('mode') === 'confidentialite') return PANNE.confOuverte ? envoyer(200, 'application/json', '{"ok":true}') : envoyer(401, 'application/json', '{"ok":false}');
  if (p === '/VRM-extension.zip') {
    if (PANNE.zipAbsent) return page();
    if (PANNE.zipVersion) return envoyer(200, 'application/zip', zip([['VRM-extension/manifest.json', JSON.stringify({ manifest_version: 3, version: '5.0.0' })], ['VRM-extension/background.js', '//']]));
    if (PANNE.zipDeuxDossiers) return envoyer(200, 'application/zip', zip([['VRM-extension/manifest.json', JSON.stringify({ manifest_version: 3, version: attendue })], ['autre/x.js', '//']]));
  }
  if (p === '/VRM-Orion.xpi' && PANNE.orionVersion) return envoyer(200, 'application/x-xpinstall', zip([['manifest.json', JSON.stringify({ manifest_version: 2, version: '5.1.0' })]]));
  if (p === '/manifest.webmanifest' && PANNE.manifeste) return page();
  if (p === '/vrm-icon-v5-512.png' && PANNE.icone) { r.writeHead(404); return r.end(); }
  if (p === '/sw.js' && PANNE.sw) return page();
  const f = path.join(R, 'public', decodeURIComponent(p));
  if (f.startsWith(path.join(R, 'public')) && fs.existsSync(f) && fs.statSync(f).isFile()) {
    const ext = path.extname(f);
    const type = { '.js': 'application/javascript; charset=utf-8', '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.zip': 'application/zip', '.xpi': 'application/x-xpinstall', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' }[ext] || 'application/octet-stream';
    return envoyer(200, type, fs.readFileSync(f));
  }
  return page();
});

const lancer = (origine, env = {}) => new Promise((ok2) => {
  const c = spawn(process.execPath, [SCRIPT], { cwd: R, env: { PATH: process.env.PATH, HOME: process.env.HOME, VRM_ORIGINE: origine, ...env } });
  let out = ''; c.stdout.on('data', (d) => { out += d; }); c.stderr.on('data', (d) => { out += d; });
  const t = setTimeout(() => c.kill('SIGKILL'), 120000);
  c.on('close', (code) => { clearTimeout(t); ok2({ code, out }); });
});

(async () => {
  await new Promise((ok2) => srv.listen(0, '127.0.0.1', ok2));
  const O = `http://127.0.0.1:${srv.address().port}`;

  console.log('── S. la production saine');
  PANNE = {};
  const s = await lancer(O);
  const oks = (s.out.match(/^OK /gm) || []).length;
  dit(s.code === 0 && !/ÉCHEC/.test(s.out) && oks >= 9, `S1 tout répond comme le dépôt l’attend ⇒ code 0, ${oks} contrôles OK`, s.out);
  dit(/page d’accueil/.test(s.out) && /\/api\/sante/.test(s.out) && /VRM-extension\.zip/.test(s.out) && /VRM-Orion\.xpi/.test(s.out) && /manifest\.webmanifest/.test(s.out) && /sw\.js/.test(s.out), 'S2 chaque contrôle demandé est nommé : accueil, santé, extension, Orion, manifeste, service worker');

  console.log('\n── P. une panne à la fois');
  const PANNES = [
    ['zipVersion', /extension servie.*version 5\.0\.0 servie, l’app attend/, 'l’extension servie n’est pas la version attendue'],
    ['zipDeuxDossiers', /extension servie.*UN dossier/, 'le zip ne se dézippe pas en un seul dossier'],
    ['zipAbsent', /extension servie.*page de l’app est servie à la place du zip/, 'le zip absent (la page de l’app servie à sa place)'],
    ['orionVersion', /Orion.*version 5\.1\.0 servie, le dépôt porte/, 'le paquet Orion n’est pas celui du dépôt'],
    ['santeSansCle', /\/api\/sante.*clé\(s\) absente\(s\) : relancesEssai/, 'une clé de /api/sante absente'],
    ['santePasBool', /\/api\/sante.*pas un oui\/non : ia/, 'une clé de /api/sante qui n’est pas un oui/non'],
    ['sansServiceKey', /\/api\/sante.*SUPABASE_SERVICE_KEY/, 'la clé de service pas posée'],
    ['sante500', /\/api\/sante.*HTTP 500/, '/api/sante en panne (500)'],
    ['titre', /page d’accueil.*titre/, 'la page d’accueil sans son titre'],
    ['manifeste', /manifeste.*pas du JSON/, 'le manifeste remplacé par la page de l’app'],
    ['icone', /manifeste.*vrm-icon-v5-512\.png/, 'une icône du manifeste absente'],
    ['sw', /service worker.*pas du JavaScript/, 'le service worker remplacé par la page de l’app'],
    ['confOuverte', /confidentialité.*HTTP 200 au lieu de 401/, 'une route privée qui répond sans session'],
  ];
  for (const [cle, motif, nom] of PANNES) {
    PANNE = { [cle]: true };
    const r = await lancer(O);
    const ech = (r.out.match(/^ÉCHEC .*/gm) || []);
    dit(r.code === 1 && ech.length === 1 && motif.test(ech[0]) && /contrôle\(s\) en échec/.test(r.out), `P ${nom} ⇒ code 1, un seul échec, qui le dit`, `code ${r.code} · ${ech.join(' | ') || r.out.slice(-300)}`);
  }
  PANNE = { zipVersion: true };
  const g = await lancer(O, { GITHUB_ACTIONS: 'true' });
  dit(g.code === 1 && /^::error title=Production : extension servie \(VRM-extension\.zip\)::version 5\.0\.0 servie/m.test(g.out), 'P sous GitHub Actions : une annotation `::error` nomme le contrôle et la cause', g.out.slice(-400));
  srv.close();
  const mort = await lancer(O);
  dit(mort.code === 1 && (mort.out.match(/^ÉCHEC /gm) || []).length >= 9 && /réseau ou lecture impossible/.test(mort.out), 'P serveur injoignable ⇒ code 1, chaque contrôle en échec « réseau »', mort.out.slice(0, 300));

  console.log('\n── W. le workflow et le script, sans secret');
  const wf = lire('.github/workflows/disponibilite.yml').toString();
  dit(/run:\s*node scripts\/verifier-production\.mjs/.test(wf), 'W1 le workflow lance le contrôle');
  dit(/permissions:\s*\n\s*contents:\s*read/.test(wf) && !/secrets\./.test(wf) && !/\benv:/.test(wf), 'W2 le workflow est en lecture seule et ne passe aucun secret ni variable');
  dit(/schedule:\s*\n\s*-\s*cron:/.test(wf), 'W3 il tourne tout seul (planifié)');
  const src = lire('scripts/verifier-production.mjs').toString().replace(/^\s*\/\/.*$/gm, '');
  const vars = [...new Set([...src.matchAll(/process\.env\.([A-Z_]+)/g)].map((m) => m[1]))];
  dit(vars.every((v) => ['VRM_ORIGINE', 'GITHUB_ACTIONS'].includes(v)), 'W4 le script ne lit aucune autre variable d’environnement (aucun secret)', vars.join(','));
  dit(/'--proto', LOCAL \? '=http,https' : '=https'/.test(src) && /127\\\.0\\\.0\\\.1\|localhost/.test(src), 'W5 HTTPS seulement, sauf la copie locale de cet audit');

  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ l’audit a levé : ' + ((e && e.stack) || e)); process.exit(1); });
