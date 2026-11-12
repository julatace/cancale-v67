#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// SURVEILLANCE 5 MIN ET RETOUR ARRIÈRE — node scripts/audit-surveillance-retour.cjs [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// (12 nov., agent2-fiabilite-prod) Les VRAIS scripts, exécutés contre de faux
// serveurs locaux (un faux vrm.center, une fausse API GitHub, une fausse API
// Vercel) et un dépôt git jetable. Rien ne part sur Internet.
//   S  scripts/surveiller-prod.mjs : vert ⇒ rien ; UN raté puis bon ⇒ rien ;
//      DEUX ratés ⇒ UNE issue (e-mail) ; encore rouge ⇒ rien de plus ; revenu ⇒
//      commentaire + fermée ; base « panne » ⇒ rouge, « inconnu » ⇒ vert ; site
//      muet ⇒ rouge ; l'issue pas ouverte ⇒ le run échoue (filet).
//   W  .github/workflows/surveillance.yml : toutes les 5 min, aucun secret de
//      production, lecture + issues seulement.
//   V  scripts/revenir-en-arriere.mjs façon « vercel » : sans « OUI » rien ne
//      bouge ; avec « OUI », le déploiement de PRODUCTION prêt juste avant celui
//      qui sert (jamais une prévisualisation, jamais un raté) ; pas de précédent
//      ou pas de jeton ⇒ refus dit.
//   G  façon « git » : la dernière fusion de main annulée sur une branche
//      `retour/…` dont le contenu est EXACTEMENT celui d'avant la fusion ; main
//      intacte ; sans « OUI » rien.
//   Y  .github/workflows/revenir-en-arriere.yml : à la main seulement.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const R = path.join(__dirname, '..');
const SURV = path.join(R, 'scripts/surveiller-prod.mjs');
const RET = path.join(R, 'scripts/revenir-en-arriere.mjs');

if (process.argv.includes('--prouve')) {
  const MUTS = [
    ['alerte dès le premier raté', 'scripts/surveiller-prod.mjs', "const etat = e1.ok || (e2 && e2.ok) ? 'vert' : 'rouge';", "const etat = e1.ok ? 'vert' : 'rouge';"],
    ['base en panne ignorée', 'scripts/surveiller-prod.mjs', "else if (j.etat && j.etat.base === 'panne')", 'else if (false)'],
    ['une issue à chaque passage', 'scripts/surveiller-prod.mjs', "if (ouvertes.length) return `issue #${ouvertes[0].number} déjà ouverte : rien de plus (pas de bruit)`;", ''],
    ['jamais refermée', 'scripts/surveiller-prod.mjs', "  for (const i of ouvertes) {\n    await gh('POST'", "  for (const i of []) {\n    await gh('POST'"],
    ['« inconnu » pris pour une panne', 'scripts/surveiller-prod.mjs', "j.etat.base === 'panne')", "j.etat.base !== 'ok')"],
    ['plus toutes les 5 min', '.github/workflows/surveillance.yml', "- cron: '*/5 * * * *'", "- cron: '0 */6 * * *'"],
    ['retour sans « OUI »', 'scripts/revenir-en-arriere.mjs', "const CONFIRMER = String(process.env.CONFIRMER || '').trim().toUpperCase() === 'OUI';", 'const CONFIRMER = true;'],
    ['retour vers le déploiement qui sert déjà', 'scripts/revenir-en-arriere.mjs', "const precedent = deps.find((d) => d.uid !== actuel && (d.created || d.createdAt || 0) < tActuel);", 'const precedent = deps[0];'],
    ['retour vers une prévisualisation', 'scripts/revenir-en-arriere.mjs', "(d.target === 'production' || d.target == null) && ", ''],
    ['git : mauvais parent', 'scripts/revenir-en-arriere.mjs', "g('revert', '-m', '1', '--no-edit', f.sha)", "g('revert', '-m', '2', '--no-edit', f.sha)"],
    ['retour planifié tout seul', '.github/workflows/revenir-en-arriere.yml', 'on:\n  workflow_dispatch:', "on:\n  schedule:\n    - cron: '0 3 * * *'\n  workflow_dispatch:"],
  ];
  let rouges = 0;
  for (const [nom, rel, avant, apres] of MUTS) {
    const f = path.join(R, rel); const src = fs.readFileSync(f, 'utf8');
    if (!src.includes(avant)) { console.log(`❌ mutation « ${nom} » : motif introuvable`); continue; }
    try {
      fs.writeFileSync(f, src.replace(avant, apres));
      const r = spawnSync(process.execPath, [__filename], { cwd: R, encoding: 'utf8', timeout: 240000 });
      if (r.status !== 0) rouges++;
      console.log(`${r.status !== 0 ? '✅' : '❌'} mutation « ${nom} » ⇒ ${r.status !== 0 ? 'ROUGE' : 'encore vert'}`);
    } finally { fs.writeFileSync(f, src); }
  }
  console.log(`\n${rouges === MUTS.length ? '✅' : '❌'} ${rouges}/${MUTS.length} mutations rouges`);
  process.exit(rouges === MUTS.length ? 0 : 1);
}

let ok = 0, ko = 0;
const dit = (c, l, d = '') => { if (c) { ok++; console.log('✅ ' + l); } else { ko++; console.log('❌ ' + l + (d !== '' ? ' — ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500) : '')); } };
const lancer = (script, env) => new Promise((res) => {
  const p = spawn(process.execPath, [script], { env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env }, cwd: env.__cwd || R });
  let out = ''; p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { out += d; });
  p.on('close', (code) => res({ code, out }));
});
const serveur = (gerer) => new Promise((res) => { const s = http.createServer((q, r) => { let b = ''; q.on('data', (d) => { b += d; }); q.on('end', () => gerer(q, r, b)); }); s.listen(0, '127.0.0.1', () => res(s)); });
const json = (r, code, corps) => { r.writeHead(code, { 'content-type': 'application/json' }); r.end(JSON.stringify(corps)); };

(async () => {
  // ── S. la surveillance ────────────────────────────────────────────────────
  console.log('── S. scripts/surveiller-prod.mjs (faux vrm.center, fausse API GitHub)');
  let site = { file: [] };   // file de réponses : 'ok' | 'down' | 'muet' | 'base' | 'inconnu'
  const reponse = () => (site.file.length > 1 ? site.file.shift() : site.file[0] || 'ok');
  let enCours = null;
  const SITE = await serveur((q, r) => {
    if (q.url === '/') { enCours = reponse(); }
    const mode = enCours || 'ok';
    if (mode === 'muet') return;   // ne répond jamais
    if (mode === 'down') return json(r, 502, { error: 'DEPLOYMENT_NOT_FOUND' });
    if (q.url === '/') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end('<!doctype html><title>VRM</title><div id="root"></div>'); }
    if (q.url === '/api/sante') return json(r, 200, { ok: true, serviceKey: true, owner: true, etat: { base: mode === 'base' ? 'panne' : mode === 'inconnu' ? 'inconnu' : 'ok', emails: 'ok', notifications: 'ok' } });
    return json(r, 404, {});
  });
  const GH = { issues: [], commentaires: [], panne: false, n: 0 };
  const GHS = await serveur((q, r, b) => {
    if (GH.panne) return json(r, 503, { message: 'panne' });
    const u = new URL(q.url, 'http://x');
    if (q.method === 'GET' && /\/issues$/.test(u.pathname)) return json(r, 200, GH.issues.filter((i) => i.state === 'open'));
    if (q.method === 'POST' && /\/issues$/.test(u.pathname)) { const c = JSON.parse(b); const i = { number: ++GH.n, title: c.title, body: c.body, state: 'open' }; GH.issues.push(i); return json(r, 201, i); }
    let m;
    if ((m = /\/issues\/(\d+)\/comments$/.exec(u.pathname)) && q.method === 'POST') { GH.commentaires.push({ n: Number(m[1]), body: JSON.parse(b).body }); return json(r, 201, {}); }
    if ((m = /\/issues\/(\d+)$/.exec(u.pathname)) && q.method === 'PATCH') { const i = GH.issues.find((x) => x.number === Number(m[1])); Object.assign(i, JSON.parse(b)); return json(r, 200, i); }
    return json(r, 404, {});
  });
  const envS = (extra = {}) => ({ SITE: `http://127.0.0.1:${SITE.address().port}`, PAUSE_S: '0.3', DELAI_S: '2', GITHUB_API_URL: `http://127.0.0.1:${GHS.address().port}`, GITHUB_TOKEN: 'jeton-banc', GITHUB_REPOSITORY: 'banc/depot', ECHEC_SI_ROUGE: '0', ...extra });
  const ouvertes = () => GH.issues.filter((i) => i.state === 'open');

  site.file = ['ok']; let r = await lancer(SURV, envS());
  dit(r.code === 0 && GH.issues.length === 0, 'S1 tout répond : vert, aucune issue', r.out);
  site.file = ['down', 'ok']; r = await lancer(SURV, envS());
  dit(r.code === 0 && GH.issues.length === 0 && /rejoué/.test(r.out), 'S2 UN raté puis bon : rejoué, vert, aucune alerte', r.out);
  site.file = ['down', 'down']; r = await lancer(SURV, envS());
  dit(GH.issues.length === 1 && ouvertes().length === 1 && /ne répond pas/.test(GH.issues[0].title) && /HTTP 502/.test(GH.issues[0].body), 'S3 DEUX ratés de suite : UNE issue « vrm.center ne répond pas » (GitHub envoie l’e-mail)', GH.issues);
  dit(r.code === 0, 'S3 l’issue est l’alerte : le run ne fait pas un e-mail « échec » de plus', r.out);
  site.file = ['down']; r = await lancer(SURV, envS());
  dit(GH.issues.length === 1 && GH.commentaires.length === 0, 'S4 toujours rouge : rien de plus (ni issue, ni commentaire)', { issues: GH.issues.length, com: GH.commentaires.length });
  site.file = ['ok']; r = await lancer(SURV, envS());
  dit(ouvertes().length === 0 && GH.commentaires.length === 1 && /revenu/.test(GH.commentaires[0].body), 'S5 revenu : « c’est revenu » et l’issue se ferme toute seule', GH.commentaires);
  site.file = ['base']; r = await lancer(SURV, envS());
  dit(ouvertes().length === 1 && /base de données/.test(ouvertes()[0].body), 'S6 la base « panne » deux fois : alerte « la base de données ne répond pas »', ouvertes()[0]);
  site.file = ['ok']; await lancer(SURV, envS());
  site.file = ['inconnu']; r = await lancer(SURV, envS());
  dit(ouvertes().length === 0 && r.code === 0, 'S7 la base « inconnu » (pas su) n’est PAS une panne', r.out);
  site.file = ['muet']; r = await lancer(SURV, envS({ DELAI_S: '1' }));
  dit(ouvertes().length === 1 && /pas de réponse en 1 s/.test(ouvertes()[0].body), 'S8 vrm.center muet : rouge après le délai', ouvertes()[0] && ouvertes()[0].body);
  site.file = ['ok']; await lancer(SURV, envS());
  GH.panne = true; site.file = ['down', 'down']; r = await lancer(SURV, envS());
  dit(r.code === 1, 'S9 rouge ET l’issue impossible à ouvrir : le run échoue (l’e-mail de GitHub prend le relais)', r.out);
  GH.panne = false;
  const src = fs.readFileSync(SURV, 'utf8');
  const vars = [...new Set([...src.matchAll(/process\.env\.([A-Z_]+)/g)].map((m) => m[1]))].sort();
  dit(vars.every((v) => ['SITE', 'PAUSE_S', 'DELAI_S', 'GITHUB_API_URL', 'GITHUB_REPOSITORY', 'GITHUB_TOKEN', 'RUN_URL', 'RESULTAT', 'ECHEC_SI_ROUGE'].includes(v)), 'S10 le script ne lit aucun secret de production', vars);
  SITE.close(); GHS.close();

  // ── W. le workflow de surveillance ────────────────────────────────────────
  console.log('── W. .github/workflows/surveillance.yml');
  const wf = fs.readFileSync(path.join(R, '.github/workflows/surveillance.yml'), 'utf8');
  dit(/- cron: '\*\/5 \* \* \* \*'/.test(wf), 'W1 toutes les 5 minutes');
  dit(!/secrets\./.test(wf), 'W2 aucun secret (seulement le jeton du run, pour l’issue)');
  dit(/permissions:\n  contents: read\n  issues: write\n/.test(wf) && !/contents: write/.test(wf), 'W3 droits : lire, et les issues — rien d’autre');
  dit(/node scripts\/surveiller-prod\.mjs/.test(wf) && /ECHEC_SI_ROUGE: '0'/.test(wf), 'W4 lance le vrai script, l’issue comme alerte');

  // ── V. retour arrière façon Vercel ─────────────────────────────────────────
  console.log('── V. scripts/revenir-en-arriere.mjs façon « vercel » (fausse API)');
  const T = Date.parse('2026-11-12T08:00:00Z');
  let VD = null, rollbacks = [];
  const VS = await serveur((q, r) => {
    const u = new URL(q.url, 'http://x');
    if (String(q.headers.authorization) !== 'Bearer jeton-vercel-banc') return json(r, 403, { error: { message: 'forbidden' } });
    if (u.pathname === '/v2/teams') return json(r, 200, { teams: [{ id: 'team_banc' }] });
    if (u.searchParams.get('teamId') !== 'team_banc') return json(r, 404, { error: { message: 'pas d’équipe' } });
    if (u.pathname === '/v9/projects/cancale-v67') return json(r, 200, { id: 'prj_banc', targets: { production: { id: VD.actuel } } });
    if (u.pathname === '/v6/deployments') return json(r, 200, { deployments: VD.deps });
    const m = /^\/v1\/projects\/prj_banc\/rollback\/([^/]+)$/.exec(u.pathname);
    if (m && q.method === 'POST') { rollbacks.push(m[1]); return json(r, 200, {}); }
    return json(r, 404, { error: { message: 'route' } });
  });
  const envV = (extra = {}) => ({ MODE: 'vercel', VERCEL_API: `http://127.0.0.1:${VS.address().port}`, VERCEL_TOKEN: 'jeton-vercel-banc', ...extra });
  VD = { actuel: 'dpl_aujourdhui', deps: [
    { uid: 'dpl_apercu', target: 'preview', state: 'READY', created: T + 60e3 },
    { uid: 'dpl_aujourdhui', target: 'production', state: 'READY', created: T },
    { uid: 'dpl_rate', target: 'production', state: 'ERROR', created: T - 30e3 },
    { uid: 'dpl_apercu_vieux', target: 'preview', state: 'READY', created: T - 45e3 },
    { uid: 'dpl_hier', target: 'production', state: 'READY', created: T - 86400e3, meta: { githubCommitMessage: 'Merge pull request #1136' } },
    { uid: 'dpl_avant_hier', target: 'production', state: 'READY', created: T - 2 * 86400e3 },
  ] };
  r = await lancer(RET, envV());
  dit(r.code === 0 && rollbacks.length === 0 && /dpl_hier/.test(r.out) && /Aperçu seulement/.test(r.out), 'V1 sans « OUI » : il dit la version d’avant (dpl_hier), rien ne bouge', r.out);
  r = await lancer(RET, envV({ CONFIRMER: 'oui' }));
  dit(r.code === 0 && JSON.stringify(rollbacks) === '["dpl_hier"]', 'V2 avec « OUI » : retour au déploiement de PRODUCTION prêt juste avant (ni l’aperçu, ni le raté)', { rollbacks, out: r.out });
  dit(/Promote/.test(r.out), 'V3 il prévient : les fusions suivantes ne partent plus seules (« Promote »)');
  rollbacks = []; VD.deps = VD.deps.filter((d) => d.uid === 'dpl_aujourdhui' || d.target === 'preview');
  r = await lancer(RET, envV({ CONFIRMER: 'OUI' }));
  dit(r.code === 1 && rollbacks.length === 0 && /aucun déploiement/.test(r.out), 'V4 pas de version d’avant : refus dit, rien ne bouge', r.out);
  r = await lancer(RET, envV({ VERCEL_TOKEN: '', CONFIRMER: 'OUI' }));
  dit(r.code === 1 && /VERCEL_TOKEN/.test(r.out) && /git/.test(r.out), 'V5 sans jeton : refus, et l’autre façon (git) est proposée', r.out);
  VS.close();

  // ── G. retour arrière façon git ───────────────────────────────────────────
  console.log('── G. façon « git » (dépôt jetable)');
  const D = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-retour-'));
  const git = (...a) => spawnSync('git', a, { cwd: D, encoding: 'utf8' });
  try {
    git('init', '-q', '-b', 'main'); git('config', 'user.email', 'banc@exemple.test'); git('config', 'user.name', 'banc');
    fs.writeFileSync(path.join(D, 'app.txt'), 'version 1\n'); git('add', '.'); git('commit', '-qm', 'v1');
    git('checkout', '-qb', 'lot'); fs.writeFileSync(path.join(D, 'app.txt'), 'version 2 cassée\n'); fs.writeFileSync(path.join(D, 'neuf.txt'), 'x\n'); git('add', '.'); git('commit', '-qm', 'lot');
    git('checkout', '-q', 'main'); fs.writeFileSync(path.join(D, 'autre.txt'), 'pendant\n'); git('add', '.'); git('commit', '-qm', 'pendant');
    git('merge', '--no-ff', '-q', '-m', 'Merge pull request #9 from banc/lot', 'lot');
    const avantTete = git('rev-parse', 'HEAD^1^{tree}').stdout.trim();
    const tete = git('rev-parse', 'HEAD').stdout.trim();
    r = await lancer(RET, { MODE: 'git', POUSSER: '0', __cwd: D });
    dit(r.code === 0 && /Merge pull request #9/.test(r.out) && git('branch', '--list', 'retour/*').stdout.trim() === '', 'G1 sans « OUI » : il nomme la dernière fusion, ne crée rien', r.out);
    r = await lancer(RET, { MODE: 'git', POUSSER: '0', CONFIRMER: 'OUI', __cwd: D });
    const br = git('branch', '--list', 'retour/*', '--format=%(refname:short)').stdout.trim();
    const arbre = br ? git('rev-parse', br + '^{tree}').stdout.trim() : '';
    dit(r.code === 0 && br === 'retour/' + tete.slice(0, 9) && arbre === avantTete, 'G2 avec « OUI » : branche retour/… au contenu EXACT d’avant la fusion (le travail fait pendant est gardé)', { br, arbre, avantTete, out: r.out });
    dit(git('rev-parse', 'main').stdout.trim() === tete, 'G3 main n’est pas touchée (Julien valide la demande de fusion)');
  } finally { fs.rmSync(D, { recursive: true, force: true }); }

  // ── Y. le workflow de retour ───────────────────────────────────────────────
  console.log('── Y. .github/workflows/revenir-en-arriere.yml');
  const wy = fs.readFileSync(path.join(R, '.github/workflows/revenir-en-arriere.yml'), 'utf8');
  const on = (/\non:\n([\s\S]*?)\npermissions:/.exec(wy) || [])[1] || '';
  dit(/workflow_dispatch:/.test(on) && !/schedule:|push:|pull_request|workflow_run/.test(on), 'Y1 à la main seulement (jamais tout seul)', on.slice(0, 200));
  dit(!/run:[^\n]*\$\{\{\s*inputs\./.test(wy) && /CONFIRMER: \$\{\{ inputs\.confirmer \}\}/.test(wy), 'Y2 la case passe par l’environnement (jamais collée dans la commande)');
  dit(/node scripts\/revenir-en-arriere\.mjs/.test(wy), 'Y3 lance le vrai script');

  console.log(`\n${ok} OK, ${ko} KO`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
