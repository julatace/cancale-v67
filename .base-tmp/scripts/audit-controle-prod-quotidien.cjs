// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LE CONTRÔLE QUOTIDIEN DE LA PROD EN NAVIGATEUR
//   node scripts/audit-controle-prod-quotidien.cjs [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// (9 nov.) `scripts/controle-prod-quotidien.cjs` (workflow
// controle-prod-quotidien.yml) doit ÉCHOUER, en nommant la panne, dès que
// vrm.center ne se présente plus comme le dépôt l'attend. Cet audit l'EXÉCUTE
// contre une COPIE LOCALE de la production : `dist/` (l'app construite, `npm
// run build` d'abord), les réécritures et les en-têtes de vercel.json, un faux
// /api/sante — aucune donnée, aucun secret, rien vers l'extérieur :
//   S. saine ⇒ code 0, chaque partie nommée, 0 écriture bloquée ;
//   P. une panne à la fois ⇒ code 1 et la panne NOMMÉE : zip à deux dossiers,
//      autre version, clé de /api/sante absente, panne affichée, en-tête de
//      sécurité absent, icône morte, /statut absent, récupération qui ne dit
//      plus « expiré », erreur JavaScript, bouton d'inscription disparu, mode
//      exemple qui lit la base, rendu trop lent ;
//   I. l'issue GitHub (scripts/controle-prod-issue.cjs, contre un faux GitHub) :
//      rouge sans issue ⇒ UNE issue ; rouge avec issue ⇒ texte mis à jour, ni
//      nouvelle issue ni commentaire ; vert avec issue ⇒ commentaire + fermée ;
//      vert sans issue ⇒ rien ;
//   W. le workflow : 7 h 10 Paris (deux créneaux UTC, un seul joue), second essai
//      après 5 min, issue, captures en artefact, run rouge après deux échecs,
//      aucun secret hors PROD_DEMO_* ; le script bloque toute écriture.
// `--prouve` : réaffaiblit le contrôle, une règle à la fois ⇒ ROUGE exigé.
// `AUDIT_SEUL=nom` : un seul scénario de panne (sert à --prouve).
'use strict';
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib');
const { spawn, spawnSync } = require('child_process');
const R = path.join(__dirname, '..');
const SCRIPT = path.join(R, 'scripts', 'controle-prod-quotidien.cjs');
const ISSUE = path.join(R, 'scripts', 'controle-prod-issue.cjs');
const WF = path.join(R, '.github', 'workflows', 'controle-prod-quotidien.yml');
const DIST = process.env.BANC_DIST || path.join(R, 'dist');

// ── --prouve : chaque règle affaiblie doit faire rougir SON scénario ─────────
if (process.argv.includes('--prouve')) {
  const MUTS = [
    ['un seul dossier non exigé', 'zipDeuxDossiers', "p.tetes.length === 1 && dossiers.length === 1", 'true'],
    ['version non comparée', 'zipVersion', "!!versionAttendue && p.version === versionAttendue", 'true'],
    ['clés de /api/sante non vérifiées', 'santeSansCle', "controle(`/api/sante : les ${clesSante.length} clés de sante() sont là`, !manque.length", "controle(`/api/sante : les ${clesSante.length} clés de sante() sont là`, true"],
    ['panne affichée ignorée', 'santePanne', "controle('/api/sante : aucune panne affichée', !pannes.length", "controle('/api/sante : aucune panne affichée', true"],
    ['en-têtes non comparés', 'enteteAbsent', "controle(`en-têtes de sécurité : les ${Object.keys(entetesAttendus).length} de vercel.json, valeur exacte`, !ecarts.length", "controle(`en-têtes de sécurité : les ${Object.keys(entetesAttendus).length} de vercel.json, valeur exacte`, true"],
    ['icônes non vérifiées', 'iconeMorte', "controle(`manifeste : ses ${m.icons.length} icônes répondent (des images)`, !mortes.length", "controle(`manifeste : ses ${m.icons.length} icônes répondent (des images)`, true"],
    ['« expiré » non exigé', 'recupSansExpire', "controle(`${T} : dit « expiré »`, /expir/i.test(v.message)", "controle(`${T} : dit « expiré »`, true"],
    ['erreurs JavaScript ignorées', 'jsCasse', "controle(`${T} : aucune erreur JavaScript`, !s.erreurs.length, s.erreurs.join(' ¦ '));\n    controle(`${T} : aucun fichier", "controle(`${T} : aucune erreur JavaScript`, true, s.erreurs.join(' ¦ '));\n    controle(`${T} : aucun fichier"],
    ['bouton d’inscription non exigé', 'ctaAbsent', "v.cta && v.ctaVisible && v.ctaHref === '/?inscription'", 'true'],
    ['lecture de la base en mode exemple ignorée', 'fuiteExemple', "controle(`${T} : aucune requête vers la base (lecture comprise)`, !s.base.length", "controle(`${T} : aucune requête vers la base (lecture comprise)`, true"],
    ['seuil de rendu ignoré', 'lent', "rendu && ms <= SEUIL_RENDU_MS", 'rendu'],
    ['/statut non vérifié', 'statutAbsent', "controle(`${T} : HTTP 200`, r.status() === 200, `HTTP ${r.status()}`);\n        await pg.waitForTimeout(2500);", "await pg.waitForTimeout(2500);"],
    ['échec sans code d’erreur', 'zipDeuxDossiers', "    process.exit(1);\n  }\n  console.log(`\\n✅", "  }\n  console.log(`\\n✅"],
  ];
  const src = fs.readFileSync(SCRIPT, 'utf8');
  let rouges = 0;
  process.on('exit', () => fs.writeFileSync(SCRIPT, src));
  for (const [nom, scenario, avant, apres] of MUTS) {
    if (src.split(avant).length !== 2) { console.log(`❌ mutation « ${nom} » : motif introuvable ou ambigu`); continue; }
    try {
      fs.writeFileSync(SCRIPT, src.replace(avant, apres));
      const r = spawnSync(process.execPath, [__filename], { cwd: R, encoding: 'utf8', timeout: 600000, env: { ...process.env, AUDIT_SEUL: scenario } });
      if (r.status !== 0) rouges++;
      console.log(`${r.status !== 0 ? '✅' : '❌'} mutation « ${nom} » (scénario ${scenario}) ⇒ ${r.status !== 0 ? 'ROUGE' : 'encore vert'}`);
    } finally { fs.writeFileSync(SCRIPT, src); }
  }
  const ok = rouges === MUTS.length;
  console.log(`\n${ok ? '✅' : '❌'} ${rouges}/${MUTS.length} mutations rouges`);
  process.exit(ok ? 0 : 1);
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d !== undefined ? ' — ' + String(d).slice(-1500) : '')); };

if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log(`❌ ${DIST}/index.html absent : lance d’abord « npm run build ».`); process.exit(1); }

// Un zip « stocké », pour servir des paquets cassés exprès.
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

const attendue = /const EXT_ATTENDUE\s*=\s*'([0-9.]+)'/.exec(fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8'));
const VERSION = attendue ? attendue[1] : '0.0.0';
const vercel = JSON.parse(fs.readFileSync(path.join(R, 'vercel.json'), 'utf8'));
const clesSante = (() => {
  const src = fs.readFileSync(path.join(R, 'api', 'compte.js'), 'utf8');
  const i = src.indexOf('function sante(');
  const corps = src.slice(i, src.indexOf('\n}', i));
  const bloc = corps.slice(corps.indexOf('{', corps.indexOf('repondre(')));
  return [...bloc.matchAll(/\b([A-Za-z]+):/g)].map((m) => m[1]);
})();
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.zip': 'application/zip', '.txt': 'text/plain; charset=utf-8' };

let PANNE = {};
const entetes = (chemin) => {
  const out = {};
  for (const b of vercel.headers || []) {
    let re; try { re = new RegExp('^' + b.source + '$'); } catch (_) { continue; }
    if (!re.test(chemin)) continue;
    for (const h of b.headers || []) out[h.key] = h.value;
  }
  if (PANNE.enteteAbsent) delete out['X-Frame-Options'];
  return out;
};
const ecrireIndex = () => {
  let h = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  const ajout = PANNE.jsCasse ? '<script src="/casse.js"></script>' : PANNE.ctaAbsent ? '<script src="/sans-cta.js"></script>' : PANNE.fuiteExemple ? '<script src="/fuite.js"></script>' : '';
  return ajout ? h.replace('<head>', '<head>' + ajout) : h;
};
const SCRIPTS_PANNE = {
  '/casse.js': "setTimeout(function(){ throw new Error('panne posée par l’audit'); }, 50);",
  '/sans-cta.js': "new MutationObserver(function(){ document.querySelectorAll('[data-cta=\"inscription\"]').forEach(function(e){ e.removeAttribute('data-cta'); }); }).observe(document, { subtree: true, childList: true });",
  // Une LECTURE de la base pendant l'exemple (fetch d'origine, avant que la porte ne s'installe).
  '/fuite.js': "try { if (sessionStorage.getItem('vrm_mode_exemple') === '1') fetch('https://lgonxzrzjcqthjtbdpzo.supabase.co/rest/v1/app_data?select=id&limit=1').catch(function(){}); } catch (_) {}",
};

const srv = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x'); let p = decodeURIComponent(u.pathname);
  const envoyer = (code, type, corps, plus) => { r.writeHead(code, { ...entetes(p), 'content-type': type, ...(plus || {}) }); r.end(corps); };
  const app = () => { const corps = ecrireIndex(); if (PANNE.lent) return setTimeout(() => envoyer(200, MIME['.html'], corps), 400); return envoyer(200, MIME['.html'], corps); };
  if (q.method !== 'GET' && q.method !== 'HEAD') { PANNE._ecritures = (PANNE._ecritures || 0) + 1; return envoyer(405, 'application/json', '{}'); }
  if (SCRIPTS_PANNE[p]) return envoyer(200, MIME['.js'], SCRIPTS_PANNE[p]);
  if (p === '/api/sante') {
    const s = {}; for (const k of clesSante) s[k] = true;
    s.etat = { base: PANNE.santePanne ? 'panne' : 'ok', emails: 'ok', notifications: 'ok', verifieA: new Date().toISOString() };
    if (PANNE.santeSansCle) delete s[clesSante[clesSante.length - 1]];
    return envoyer(200, 'application/json', JSON.stringify(s));
  }
  if (p === '/VRM-extension.zip') {
    if (PANNE.zipDeuxDossiers) return envoyer(200, 'application/zip', zip([['VRM-extension/manifest.json', JSON.stringify({ manifest_version: 3, version: VERSION })], ['autre/x.js', '//']]));
    if (PANNE.zipVersion) return envoyer(200, 'application/zip', zip([['VRM-extension/manifest.json', JSON.stringify({ manifest_version: 3, version: '5.0.0' })], ['VRM-extension/background.js', '//']]));
  }
  if (PANNE.iconeMorte && /^\/[^/]+\.png$/.test(p) && /icon|maskable/.test(p)) { r.writeHead(404); return r.end(); }
  if (PANNE.statutAbsent && p === '/statut') { r.writeHead(404, { 'content-type': 'text/html' }); return r.end('<!doctype html><title>404</title><p>Introuvable — page absente de cette copie.</p>'); }
  if (PANNE.recupSansExpire && p === '/recuperation.js') {
    const js = fs.readFileSync(path.join(DIST, 'recuperation.js'), 'utf8').replace(/Ce lien a expiré ou a déjà servi\./g, 'Ce lien ne marche plus.');
    return envoyer(200, MIME['.js'], js);
  }
  for (const rw of vercel.rewrites || []) {
    if (/^\/api\//.test(rw.source)) continue;
    const re = new RegExp('^' + rw.source + '$'); const m = re.exec(p);
    if (m) { p = rw.destination.replace(/\$(\d)/g, (_, i) => m[Number(i)] || ''); break; }
  }
  if (p === '/') return app();
  const f = path.join(DIST, p);
  if (f.startsWith(DIST) && fs.existsSync(f) && fs.statSync(f).isFile()) return envoyer(200, MIME[path.extname(f)] || 'application/octet-stream', fs.readFileSync(f));
  return app();   // l'app répond à tout chemin inconnu (comme Vercel)
});

const lancer = (origine, env = {}) => new Promise((ok2) => {
  const c = spawn(process.execPath, [SCRIPT], { cwd: R, env: { PATH: process.env.PATH, HOME: process.env.HOME, VRM_ORIGINE: origine, ...(process.env.VRM_CHROMIUM_PATH ? { VRM_CHROMIUM_PATH: process.env.VRM_CHROMIUM_PATH } : {}), ...env } });
  let out = ''; c.stdout.on('data', (d) => { out += d; }); c.stderr.on('data', (d) => { out += d; });
  const t = setTimeout(() => c.kill('SIGKILL'), 400000);
  c.on('close', (code) => { clearTimeout(t); ok2({ code, out }); });
});

// ── Le faux GitHub (issues) ──────────────────────────────────────────────────
function fauxGithub(issues) {
  const journal = [];
  const s = http.createServer((q, r) => {
    let corps = ''; q.on('data', (d) => { corps += d; });
    q.on('end', () => {
      const j = corps ? JSON.parse(corps) : null;
      journal.push({ m: q.method, p: q.url.replace(/\?.*$/, ''), j, auth: q.headers.authorization });
      const rep = (code, x) => { r.writeHead(code, { 'content-type': 'application/json' }); r.end(JSON.stringify(x)); };
      let m;
      if (q.method === 'GET' && /^\/repos\/o\/d\/issues\?/.test(q.url)) return rep(200, issues.filter((i) => i.state === 'open'));
      if (q.method === 'POST' && q.url === '/repos/o/d/issues') { const n = { number: 100 + issues.length, title: j.title, body: j.body, state: 'open' }; issues.push(n); return rep(201, n); }
      if (q.method === 'PATCH' && (m = /^\/repos\/o\/d\/issues\/(\d+)$/.exec(q.url))) { const i = issues.find((x) => x.number === Number(m[1])); Object.assign(i, j); return rep(200, i); }
      if (q.method === 'POST' && /^\/repos\/o\/d\/issues\/\d+\/comments$/.test(q.url)) return rep(201, { id: 1 });
      rep(404, {});
    });
  });
  return { s, journal };
}
const lancerIssue = (api, env) => new Promise((ok2) => {
  const c = spawn(process.execPath, [ISSUE], { cwd: R, env: { PATH: process.env.PATH, GITHUB_API_URL: api, GITHUB_REPOSITORY: 'o/d', GITHUB_TOKEN: 'jeton-faux', RUN_URL: 'https://exemple.invalid/run/1', ...env } });
  let out = ''; c.stdout.on('data', (d) => { out += d; }); c.stderr.on('data', (d) => { out += d; });
  c.on('close', (code) => ok2({ code, out }));
});

const PANNES = [
  ['zipDeuxDossiers', 'X', /ÉCHEC\s+extension servie : se dézippe en UN seul dossier/, 'zip à deux dossiers'],
  ['zipVersion', 'X', /ÉCHEC\s+extension servie : version .*servie : 5\.0\.0/, 'extension d’une autre version'],
  ['santeSansCle', 'P', new RegExp(`ÉCHEC\\s+/api/sante : les \\d+ clés de sante\\(\\) sont là — absente\\(s\\) : ${clesSante[clesSante.length - 1]}`), `clé « ${clesSante[clesSante.length - 1]} » absente de /api/sante`],
  ['santePanne', 'P', /ÉCHEC\s+\/api\/sante : aucune panne affichée — base/, 'panne affichée par /api/sante'],
  ['enteteAbsent', 'T', /ÉCHEC\s+en-têtes de sécurité.*x-frame-options : absent/, 'X-Frame-Options absent'],
  ['iconeMorte', 'M', /ÉCHEC\s+manifeste : ses \d+ icônes répondent/, 'une icône du manifeste en 404'],
  ['statutAbsent', 'S', /ÉCHEC\s+\[iphone\] \/statut : HTTP 200 — HTTP 404/, '/statut en 404'],
  ['recupSansExpire', 'R', /ÉCHEC\s+\[iphone\] récupération, lien expiré \(dièse\) : dit « expiré »/, 'la récupération ne dit plus « expiré »'],
  ['jsCasse', 'A', /ÉCHEC\s+\[iphone\] accueil : aucune erreur JavaScript — panne posée par l’audit/, 'une erreur JavaScript sur l’accueil'],
  ['ctaAbsent', 'A', /ÉCHEC\s+\[iphone\] accueil : bouton .* vers \/\?inscription/, 'le bouton « Créer mon compte » disparu'],
  ['fuiteExemple', 'E', /ÉCHEC\s+\[iphone\] mode exemple, Ma journée : aucune requête vers la base \(lecture comprise\) — GET https:\/\/lgonxzrzjcqthjtbdpzo\.supabase\.co\/rest\/v1\/app_data/, 'le mode exemple lit la base'],
  ['lent', 'A', /ÉCHEC\s+\[iphone\] accueil : rendue en moins de 300 ms/, 'accueil rendu au-delà du seuil', { SEUIL_RENDU_MS: '300' }],
];

(async () => {
  await new Promise((ok2) => srv.listen(0, '127.0.0.1', ok2));
  const O = `http://127.0.0.1:${srv.address().port}`;
  const SEUL = process.env.AUDIT_SEUL || '';

  if (!SEUL) {
    console.log('── S. la copie saine');
    PANNE = {};
    const s = await lancer(O, { PARTIES: 'A,S,H,R,E,P,X,M,T,C' });
    const oks = (s.out.match(/^OK /gm) || []).length;
    dit(s.code === 0 && !/ÉCHEC/.test(s.out) && oks >= 80, `S1 copie saine ⇒ code 0, ${oks} contrôles OK`, s.out);
    for (const [nom, re] of [['accueil', /OK\s+\[iphone\] accueil : bouton/], ['statut', /OK\s+\[ordinateur\] \/statut : la page d’état se rend/], ['aide', /OK\s+\[iphone\] \/aide : l’article/], ['récupération', /OK\s+\[iphone\] récupération, lien expiré \(paramètre\) : aucun appel à Supabase/], ['mode exemple', /OK\s+\[ordinateur\] mode exemple, Ventes : aucune requête vers la base/], ['santé', /OK\s+\/api\/sante : chaque clé est un oui\/non/], ['extension', /OK\s+extension servie : se dézippe en UN seul dossier/], ['manifeste', /OK\s+manifeste : ses \d+ icônes/], ['en-têtes', /OK\s+en-têtes de sécurité : les \d+ de vercel\.json/], ['compte de démo sauté et dit', /SAUTÉ\s+connexion au compte de démo — secrets PROD_DEMO_EMAIL/]]) dit(re.test(s.out), `S2 partie « ${nom} » jouée et nommée`);
    dit(/^0 requête\(s\) d’écriture bloquée\(s\)/m.test(s.out) && !PANNE._ecritures, `S3 aucune écriture tentée ni reçue par la copie (reçues : ${PANNE._ecritures || 0})`);
  }

  console.log('\n── P. une panne à la fois');
  for (const [cle, parties, re, nom, env] of PANNES) {
    if (SEUL && SEUL !== cle) continue;
    PANNE = { [cle]: true };
    const x = await lancer(O, { PARTIES: parties, ...(env || {}) });
    dit(x.code === 1 && re.test(x.out), `P ${nom} ⇒ code 1 et la panne nommée`, x.out);
  }

  if (!SEUL) {
    console.log('\n── I. l’issue GitHub');
    const cas = [
      ['rouge sans issue ⇒ UNE issue ouverte', 'rouge', [], (j, iss) => j.filter((e) => e.m === 'POST' && e.p === '/repos/o/d/issues').length === 1 && iss.length === 1 && !j.some((e) => /comments/.test(e.p)) && /contrôle.*rouge deux fois/i.test(iss[0].body) && /extension servie : se dézippe/.test(iss[0].body)],
      ['rouge avec issue ouverte ⇒ texte mis à jour, ni nouvelle issue ni commentaire', 'rouge', [{ number: 7, title: 'Contrôle quotidien de vrm.center : en échec', state: 'open', body: 'ancien' }], (j, iss) => iss.length === 1 && iss[0].body !== 'ancien' && j.some((e) => e.m === 'PATCH' && e.p === '/repos/o/d/issues/7') && !j.some((e) => e.m === 'POST')],
      ['vert avec issue ouverte ⇒ commentée puis fermée', 'vert', [{ number: 7, title: 'Contrôle quotidien de vrm.center : en échec', state: 'open' }], (j, iss) => iss[0].state === 'closed' && j.some((e) => e.m === 'POST' && e.p === '/repos/o/d/issues/7/comments' && /vert/.test(e.j.body))],
      ['vert sans issue ⇒ rien d’écrit', 'vert', [{ number: 3, title: 'Autre chose', state: 'open' }], (j, iss) => !j.some((e) => e.m !== 'GET') && iss[0].state === 'open'],
      ['une issue d’un autre titre n’est jamais touchée', 'rouge', [{ number: 3, title: 'Autre chose', state: 'open', body: 'x' }], (j, iss) => iss.find((i) => i.number === 3).body === 'x' && iss.length === 2],
    ];
    const bilan = path.join(require('os').tmpdir(), `vrm-audit-cpq-${process.pid}.json`);
    fs.writeFileSync(bilan, JSON.stringify({ resultats: [{ nom: 'extension servie : se dézippe en UN seul dossier', ok: false, detail: 'têtes : a/, b/' }, { nom: 'x', ok: true }] }));
    for (const [nom, etat, issues, juge] of cas) {
      const g = fauxGithub(issues);
      await new Promise((ok2) => g.s.listen(0, '127.0.0.1', ok2));
      const x = await lancerIssue(`http://127.0.0.1:${g.s.address().port}`, { ETAT: etat, RESULTAT: bilan });
      g.s.close();
      dit(x.code === 0 && juge(g.journal, issues) && g.journal.every((e) => e.auth === 'Bearer jeton-faux'), `I ${nom}`, x.out + JSON.stringify(g.journal).slice(0, 600));
    }
    try { fs.unlinkSync(bilan); } catch (_) {}

    console.log('\n── W. le workflow et la lecture seule');
    const wf = fs.readFileSync(WF, 'utf8');
    dit(/cron: '10 5 \* \* \*'/.test(wf) && /cron: '10 6 \* \* \*'/.test(wf) && /"\+0200"/.test(wf) && /"\+0100"/.test(wf) && /TZ=Europe\/Paris/.test(wf), 'W1 7 h 10 à Paris : deux créneaux UTC, un seul joue selon l’heure d’été ou d’hiver');
    dit(/workflow_dispatch:/.test(wf), 'W2 lançable à la main');
    dit(/sleep 300/.test(wf) && (wf.match(/node scripts\/controle-prod-quotidien\.cjs/g) || []).length === 2, 'W3 un premier essai rouge est rejoué une fois, 5 min plus tard');
    dit(/node scripts\/controle-prod-issue\.cjs/.test(wf) && /issues: write/.test(wf) && /contents: read/.test(wf), 'W4 l’issue est tenue par le script (permission issues: write, contenu en lecture)');
    dit(/actions\/upload-artifact@v4/.test(wf) && /captures\//.test(wf) && /if: always\(\)/.test(wf), 'W5 les captures partent en artefact, même rouge');
    dit(/steps\.controle\.outputs\.code != '0'[\s\S]*exit 1/.test(wf), 'W6 deux essais rouges ⇒ le run échoue');
    const secrets = [...wf.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1]);
    dit(secrets.length && secrets.every((k) => /^PROD_DEMO_(EMAIL|MDP)$/.test(k)), `W7 aucun secret hors PROD_DEMO_* (${secrets.join(', ')})`);
    dit(!/git push|gh pr|merge|vercel|--prod|rollback/i.test(wf.replace(/^\s*#.*$/gm, '')), 'W8 le workflow ne pousse, ne fusionne, ne déploie ni n’annule rien');
    const src = fs.readFileSync(SCRIPT, 'utf8');
    dit(/if \(m === 'GET' \|\| m === 'HEAD' \|\| m === 'OPTIONS'\) return route\.fallback\(\);/.test(src) && /return route\.abort\(\);/.test(src) && /serviceWorkers: 'block'/.test(src), 'W9 le contrôle bloque toute écriture avant qu’elle parte, et le service worker');
    dit(/\/auth\\\/v1\\\/token\\\?grant_type=\(password\|refresh_token\)/.test(src) && !/signup|\/auth\/v1\/(recover|otp)/.test(src.replace(/^\s*\/\/.*$/gm, '')), 'W10 seule la connexion au compte de démo passe ; aucune inscription ni envoi d’e-mail');
  }

  srv.close();
  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
