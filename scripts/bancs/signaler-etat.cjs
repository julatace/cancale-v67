// ════════════════════════════════════════════════════════════════════════════
//  BANC — « SIGNALER UN PROBLÈME » ET LA PAGE D'ÉTAT /etat (6 nov.)
//
//  1. LA FEUILLE (src/composants/SignalerProbleme.jsx), montée par esbuild avec
//     les vraies feuilles de style (celles de src/main.jsx) et la palette de
//     src/themeMineral.js, servie sous les en-têtes de vercel.json (CSP) :
//      · l'aperçu dit l'écran, la version, l'extension, le navigateur, la taille,
//        les plantages, et masque l'e-mail tapé ;
//      · le corps POSTÉ est EXACTEMENT le texte « exact » de l'aperçu ;
//      · serveur en panne (503) ⇒ « Pas envoyé », le texte reste, jamais « Envoyé » ;
//        réseau coupé ⇒ pareil ; confirmé ⇒ « Envoyé » ;
//      · la liste du propriétaire : « À traiter », « Traité » envoie {action:'traite'} ;
//      · 390 tactile (cibles ≥ 44 px) et 1512, clair et sombre ; aucun débordement.
//  2. LA PAGE /etat (public/etat.html), servie COMME VERCEL (`_vercel.servir` :
//     réécriture /etat → /etat.html, en-têtes, CSP) avec un faux /api/sante :
//      · tout ok ⇒ « Tout fonctionne » ; e-mails en panne ⇒ « Panne en cours sur
//        la réception des e-mails » ; pas vérifié ⇒ ni panne ni « Tout
//        fonctionne » ; /api/sante muet ⇒ « VRM ne répond pas » ;
//      · la version servie (etat-version.json) ; l'heure de la vérification ;
//      · rafraîchie après 60 s si visible, PAS si l'onglet est caché (horloge
//        tenue : `page.clock`) ; zéro violation de CSP ; 390 et 1512, clair/sombre.
//  Captures dans SHOTS (défaut : <tmp>/banc-signaler-etat). BANC_PORT : 10210
//  (la feuille) et +1 (la page). Données inventées.
//  `node scripts/bancs/signaler-etat.cjs`
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const RACINE = process.env.RACINE || path.join(__dirname, '..', '..');
const NM = [path.join(RACINE, 'node_modules'), path.join(__dirname, '..', '..', 'node_modules')].find((p) => fs.existsSync(path.join(p, 'esbuild')));
if (!NM) { console.log('❌ esbuild introuvable (node_modules absent)'); process.exit(1); }
try { require(path.join(__dirname, '_porte-banc.cjs')); } catch (_) {}
const { chromium } = require(path.join(NM, 'playwright'));
const esbuild = require(path.join(NM, 'esbuild'));
const V = require(path.join(__dirname, '_vercel.cjs'));
const PORT = Number(process.env.BANC_PORT) || 10210;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-signaler-etat');
fs.mkdirSync(SHOTS, { recursive: true });
const VERSION_EXT = JSON.parse(fs.readFileSync(path.join(RACINE, 'vinted-sync-extension', 'manifest.json'), 'utf8')).version;

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d != null && d !== '' ? '  → ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400) : '')); } };

async function construire(theme) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'banc-signaler-'));
  // (8 nov., démarrage léger) les feuilles de l'app ont quitté main.jsx pour src/stylesApp.js (même ordre)
  const main = fs.readFileSync(path.join(RACINE, 'src', 'main.jsx'), 'utf8') + '\n' + (fs.existsSync(path.join(RACINE, 'src', 'stylesApp.js')) ? fs.readFileSync(path.join(RACINE, 'src', 'stylesApp.js'), 'utf8') : '');
  const css = [...main.matchAll(/^import\s+'\.\/([^']+\.css)';/gm)].map((m) => path.join(RACINE, 'src', m[1]));
  const src = (f) => JSON.stringify(path.join(RACINE, 'src', f));
  const sombre = theme === 'sombre';
  fs.writeFileSync(path.join(dir, 'entree.jsx'), `
${css.map((c) => `import ${JSON.stringify(c)};`).join('\n')}
import React from 'react';
import {createRoot} from 'react-dom/client';
import * as TH from ${src('themeMineral.js')};
import { SheetShell } from ${src('composants/SheetShell.jsx')};
import { SignalerProbleme, SignalementsRecus } from ${src('composants/SignalerProbleme.jsx')};
import { EtatPanne } from ${src('composants/EtatPanne.jsx')};
const PAL=${sombre}?TH.MINERAL_DARK:TH.MINERAL;
const v=TH.variablesTheme(PAL,${sombre});for(const [k,x] of Object.entries(v))document.documentElement.style.setProperty(k,x);
document.documentElement.setAttribute('data-theme','${sombre ? 'dark' : 'light'}');
document.body.style.background=PAL.bg;document.body.style.color=PAL.text;document.body.style.margin='0';
function FermeAuRetour({ fermer }) { React.useEffect(() => { history.pushState({ banc: 1 }, ''); const p = () => fermer && fermer(); window.addEventListener('popstate', p); return () => window.removeEventListener('popstate', p); }, []); return null; }
const Feuille = (p) => <SheetShell {...p} FermeAuRetour={FermeAuRetour}/>;
// Le contexte de l'appareil, inventé (jamais une donnée réelle).
const contexte = () => ({ ecran: 'cat_bord', ecranAvant: 'ventes', version: '6 novembre à 14:32', extension: '5.322.0', navigateur: 'Chrome',
  ecranTaille: { largeur: window.innerWidth, hauteur: window.innerHeight },
  plantages: [{ message: "Cannot read properties of undefined (reading 'numero')", ecran: 'cat_bord', origine: 'ecran', version: '6 novembre à 14:32', at: '2026-11-06T09:12:00Z' },
              { message: 'CSP connect-src ← https://exemple.test', ecran: 'ventes', origine: 'csp', version: '6 novembre à 14:32', at: '2026-11-06T09:40:00Z' }] });
function Demo() {
  return (<main className="vrm-main" data-demo="" style={{padding:16,maxWidth:760,margin:'0 auto',boxSizing:'border-box'}}>
    <h1 style={{fontSize:28,margin:'8px 0 16px',color:PAL.text}}>Paramètres</h1>
    <SignalerProbleme Feuille={Feuille} contexte={contexte} entetes={() => ({ Authorization: 'Bearer banc' })}/>
    <section style={{marginTop:24}} data-demo-liste=""><h2 style={{fontSize:13,color:PAL.muted}}>Signalements reçus</h2>
      <SignalementsRecus entetes={() => ({ Authorization: 'Bearer banc' })} PanneEl={EtatPanne}/></section>
  </main>);
}
createRoot(document.getElementById('r')).render(<Demo/>);
`);
  await esbuild.build({ entryPoints: [path.join(dir, 'entree.jsx')], bundle: true, outdir: path.join(dir, 'out'), format: 'esm', jsx: 'automatic',
    loader: { '.js': 'jsx', '.woff2': 'empty', '.woff': 'empty', '.png': 'empty', '.svg': 'empty', '.jpg': 'empty' }, nodePaths: [NM], logLevel: 'error',
    define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{"MODE":"production","PROD":true,"DEV":false}' }, external: ['/fonts/*', '/images/*', '/textures/*'] });
  fs.writeFileSync(path.join(dir, 'out', 'index.html'), '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/entree.css"></head><body><div id="r"></div><script type="module" src="/entree.js"></script></body></html>');
  return path.join(dir, 'out');
}

const LISTE = [
  { id: 'signalement_2026110609_aaaaaaaaaaaa_1', texte: 'Les bordereaux ne s’impriment plus depuis ce matin.', ecran: 'cat_bord', ecranAvant: 'ventes', version: '6 novembre à 14:32', extension: '5.322.0', navigateur: 'Chrome', ecranTaille: { largeur: 390, hauteur: 844 }, plantages: [{ message: "Cannot read properties of undefined (reading 'numero')", ecran: 'cat_bord', origine: 'ecran', version: '6 novembre à 14:32', at: '2026-11-06T09:12:00Z' }], de: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', at: '2026-11-06T09:15:00Z', traite: false, traiteLe: null },
  { id: 'signalement_2026110608_bbbbbbbbbbbb_1', texte: 'Mon compte Leboncoin n’apparaît pas.', ecran: 'settings', ecranAvant: '', version: '6 novembre à 08:02', extension: null, navigateur: 'inconnu', ecranTaille: { largeur: 1512, hauteur: 950 }, plantages: [], de: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', at: '2026-11-06T08:20:00Z', traite: true, traiteLe: '2026-11-06T08:40:00Z' },
];

const debordement = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function feuille(nav, theme, tel, OUTS) {
  const T = `${tel ? '390' : '1512'} ${theme}`, F = `${theme}-${tel ? '390' : '1512'}`;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } }), locale: 'fr-FR', timezoneId: 'Europe/Paris', colorScheme: theme === 'sombre' ? 'dark' : 'light' });
  const origine = `http://localhost:${PORT}`;
  await V.cspBanc(ctx, origine, 'feuille ' + T);
  let mode = 'panne'; const postes = [];
  await ctx.route((u) => u.pathname === '/api/compte', async (route) => {
    const q = route.request();
    if (q.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, signalements: LISTE, nonTraites: 1 }) });
    const corps = JSON.parse(q.postData() || '{}'); postes.push(corps);
    if (corps.action === 'traite') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: corps.id, traite: corps.traite }) });
    if (mode === 'reseau') return route.abort('failed');
    if (mode === 'panne') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, raison: 'base' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: 'signalement_2026110610_aaaaaaaaaaaa_1', notifie: true }) });
  });
  OUTS.courant = OUTS[theme];
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto(origine + '/', { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-signalements]', { timeout: 15000 });
  await pg.screenshot({ path: path.join(SHOTS, `liste-${F}.png`), fullPage: true });
  // La liste : « À traiter » d'abord, puis « Traité ».
  dit(await pg.locator('[data-signalement]').count() === 1 && await pg.getAttribute('[data-signalements]', 'data-signalements-a-traiter') === '1', `${T} — la liste du propriétaire montre « À traiter » (1 sur 2)`);
  await pg.click('[data-signalement-traiter]');
  await pg.waitForFunction(() => document.querySelector('[data-signalements]').getAttribute('data-signalements-a-traiter') === '0', null, { timeout: 5000 }).catch(() => {});
  const tr = postes.find((p) => p.action === 'traite');
  dit(tr && tr.id === LISTE[0].id && tr.traite === true, `${T} — « Traité » envoie {action:'traite', id, traite:true}`, tr);
  // La feuille.
  await pg.click('[data-signaler-ouvrir]');
  await pg.waitForSelector('[data-feuille-signaler]', { timeout: 5000 });
  await pg.waitForTimeout(450);
  const grise = await pg.isDisabled('[data-signaler-envoyer]');
  dit(grise, `${T} — « Envoyer » grisé tant que rien n’est écrit`);
  await pg.fill('[data-signaler-texte]', 'Les bordereaux ne sortent plus. Écris-moi à perso.banc@exemple.test');
  const ap = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-apercu-ligne]')].map((l) => [l.getAttribute('data-apercu-ligne'), l.querySelector('dd').textContent])));
  dit(ap['Écran ouvert'] === 'cat_bord' && ap['Écran d’avant'] === 'ventes' && ap['Version de l’app'] === '6 novembre à 14:32' && ap['Version de l’extension'] === '5.322.0' && ap['Navigateur'] === 'Chrome' && /^\d+ × \d+$/.test(ap['Taille d’écran']) && ap['Plantages de cet appareil'] === '2',
    `${T} — l’aperçu dit l’écran, la version, l’extension, le navigateur, la taille, les plantages`, ap);
  dit(/\{email\}/.test(ap['Ton message']) && !/perso\.banc@/.test(ap['Ton message']), `${T} — l’e-mail tapé est masqué DANS l’aperçu (ce qui part)`, ap['Ton message']);
  await pg.click('[data-feuille-signaler] details:last-of-type summary');
  if (tel) {
    const h = await pg.evaluate(() => { const b = document.querySelector('[data-signaler-envoyer]').getBoundingClientRect(); const s = [...document.querySelectorAll('[data-feuille-signaler] summary')].map((x) => x.getBoundingClientRect().height); return { b: b.height, s: Math.min(...s) }; });
    dit(h.b >= 44 && h.s >= 44, `${T} — cibles au doigt ≥ 44 px (Envoyer, les replis)`, h);
  }
  await pg.screenshot({ path: path.join(SHOTS, `feuille-${F}.png`) });
  // Serveur en panne : « Pas envoyé », le texte reste.
  mode = 'panne';
  await pg.click('[data-signaler-envoyer]');
  await pg.waitForSelector('[data-signalement-refus]', { timeout: 5000 }).catch(() => {});
  const json = await pg.textContent('[data-apercu-json]');
  const envoye1 = postes.filter((p) => !p.action).pop();
  dit(envoye1 && JSON.stringify(envoye1, null, 2) === json, `${T} — le corps posté est EXACTEMENT le texte « exact » de l’aperçu`, envoye1);
  const e1 = await pg.evaluate(() => ({ etat: document.querySelector('[data-signalement-etat]').getAttribute('data-signalement-etat'), refus: (document.querySelector('[data-signalement-refus]') || {}).textContent || '', texte: document.querySelector('[data-signaler-texte]').value, envoye: /Envoyé\./.test(document.body.textContent) }));
  dit(e1.etat === 'refus' && /^Pas envoyé\./.test(e1.refus) && /ranger/.test(e1.refus) && e1.texte.length > 10 && !e1.envoye, `${T} — serveur en panne : « Pas envoyé », la raison, le texte gardé, jamais « Envoyé »`, e1);
  await pg.screenshot({ path: path.join(SHOTS, `feuille-refus-${F}.png`) });
  mode = 'reseau';
  await pg.click('[data-signaler-envoyer]');
  await pg.waitForFunction(() => /connexion/.test((document.querySelector('[data-signalement-refus]') || {}).textContent || ''), null, { timeout: 5000 }).catch(() => {});
  const e2 = await pg.evaluate(() => ({ refus: (document.querySelector('[data-signalement-refus]') || {}).textContent || '', envoye: /Envoyé\./.test(document.body.textContent) }));
  dit(/^Pas envoyé\./.test(e2.refus) && /connexion/.test(e2.refus) && !e2.envoye, `${T} — réseau coupé : « Pas envoyé »`, e2);
  mode = 'ok';
  await pg.click('[data-signaler-envoyer]');
  await pg.waitForSelector('[data-signalement-etat="envoye"]', { timeout: 5000 }).catch(() => {});
  dit(await pg.locator('[data-signalement-etat="envoye"]').count() === 1, `${T} — confirmé par le serveur : « Envoyé »`);
  await pg.screenshot({ path: path.join(SHOTS, `feuille-envoye-${F}.png`) });
  const deb = await debordement(pg);
  dit(deb <= 0 && !errs.length, `${T} — aucun débordement horizontal, aucune erreur`, { deb, errs });
  await ctx.close();
}

// ── La page /etat ────────────────────────────────────────────────────────────
const SANTE = (etat) => ({ ok: true, serviceKey: true, owner: true, ia: false, detourage: false, stripe: true, stripeWebhook: true, relancesEssai: false, etat });
async function etat(nav, theme, tel, port) {
  const T = `/etat ${tel ? '390' : '1512'} ${theme}`, F = `${theme}-${tel ? '390' : '1512'}`;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } }), locale: 'fr-FR', timezoneId: 'Europe/Paris', colorScheme: theme === 'sombre' ? 'dark' : 'light' });
  const vues = V.observer(ctx);
  let reponse = SANTE({ base: 'ok', emails: 'ok', notifications: 'ok', verifieA: '2026-11-06T13:31:05.000Z' });
  let appels = 0;
  await ctx.route((u) => u.pathname === '/api/sante', (route) => { appels++; if (reponse === 'muet') return route.abort('failed'); if (reponse === '502') return route.fulfill({ status: 502, body: '<html>502</html>' }); return route.fulfill({ status: 200, contentType: 'application/json', headers: V.entetesPour('/api/sante'), body: JSON.stringify(reponse) }); });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: new Date('2026-11-06T13:31:10Z') });
  await pg.goto(`http://localhost:${port}/etat`, { waitUntil: 'domcontentloaded' });
  const attendre = (g) => pg.waitForFunction((x) => document.querySelector('main').getAttribute('data-etat-global') === x, g, { timeout: 5000 }).catch(() => {});
  const lire = () => pg.evaluate(() => ({ g: document.querySelector('main').getAttribute('data-etat-global'), titre: document.getElementById('titre').textContent, phrase: document.getElementById('phrase').textContent, heure: document.getElementById('heure').textContent,
    m: Object.fromEntries([...document.querySelectorAll('[data-etat-morceau]')].map((l) => [l.getAttribute('data-etat-morceau'), l.getAttribute('data-etat') + ' · ' + l.querySelector('.mot').textContent])),
    theme: document.documentElement.getAttribute('data-theme'), fond: getComputedStyle(document.body).backgroundColor }));
  await attendre('ok');
  const a = await lire();
  dit(a.g === 'ok' && a.titre === 'Tout fonctionne' && a.m.base === 'ok · Fonctionne' && a.m.extension === 'ok · Version ' + VERSION_EXT && /^14:31:05$/.test(a.heure), `${T} — tout ok : « Tout fonctionne », la version servie, l’heure de la vérification`, a);
  dit(a.theme === (theme === 'sombre' ? 'dark' : 'light') && (theme === 'sombre' ? a.fond === 'rgb(0, 0, 0)' : a.fond === 'rgb(242, 242, 247)'), `${T} — le thème suit le système (${theme})`, a.fond);
  await pg.screenshot({ path: path.join(SHOTS, `etat-ok-${F}.png`), fullPage: true });
  // Rafraîchie après 60 s, page visible.
  reponse = SANTE({ base: 'ok', emails: 'panne', notifications: 'ok', verifieA: '2026-11-06T13:32:10.000Z' });
  const n0 = appels;
  await pg.clock.runFor(61000);
  await attendre('panne');
  const b = await lire();
  dit(appels > n0 && b.g === 'panne' && b.titre === 'Panne en cours sur la réception des e-mails' && b.m.emails === 'panne · En panne' && b.m.base === 'ok · Fonctionne' && /prévenus/.test(b.phrase), `${T} — 60 s plus tard (visible) : relue, « Panne en cours sur la réception des e-mails »`, b);
  const ambre = await pg.evaluate(() => getComputedStyle(document.querySelector('[data-etat-morceau="emails"] .mot')).color);
  dit(ambre === (theme === 'sombre' ? 'rgb(255, 179, 64)' : 'rgb(178, 80, 0)'), `${T} — la panne en ambre (jamais rouge)`, ambre);
  await pg.screenshot({ path: path.join(SHOTS, `etat-panne-${F}.png`), fullPage: true });
  // Onglet caché : rien n'est sondé.
  await pg.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  const n1 = appels;
  await pg.clock.runFor(180000);
  dit(appels === n1, `${T} — onglet caché pendant 3 min : aucune requête`, appels - n1);
  // Revenu visible après plus de 60 s : relue tout de suite.
  reponse = SANTE({ base: 'ok', emails: 'inconnu', notifications: 'ok', verifieA: '2026-11-06T13:35:10.000Z' });
  await pg.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
  await attendre('partiel');
  const c = await lire();
  dit(appels === n1 + 1 && c.g === 'partiel' && c.titre !== 'Tout fonctionne' && !/Panne/.test(c.titre) && /réception des e-mails/.test(c.phrase) && c.m.emails === 'inconnu · Pas vérifié', `${T} — de retour visible : relue ; « pas vérifié » n’est ni une panne ni « Tout fonctionne »`, c);
  // /api/sante muet.
  reponse = 'muet';
  await pg.clock.runFor(61000);
  await attendre('injoignable');
  const d = await lire();
  dit(d.g === 'injoignable' && d.titre === 'VRM ne répond pas' && /prévenus/.test(d.phrase) && d.m.base === 'inconnu · Pas vérifié', `${T} — /api/sante muet : « VRM ne répond pas — nous sommes prévenus »`, d);
  await pg.screenshot({ path: path.join(SHOTS, `etat-muet-${F}.png`), fullPage: true });
  reponse = '502';
  await pg.clock.runFor(61000);
  const e = await lire();
  dit(e.g === 'injoignable', `${T} — /api/sante en 502 : pareil`, e.g);
  const deb = await debordement(pg);
  dit(deb <= 0 && !errs.length, `${T} — aucun débordement horizontal, aucune erreur`, { deb, errs });
  dit(!vues.length, `${T} — aucune violation de la CSP de vercel.json`, vues.map((x) => x.texte));
  await ctx.close();
}

(async () => {
  const nav = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--no-sandbox', '--use-angle=swiftshader'] });
  const OUTS = { clair: await construire('clair'), sombre: await construire('sombre') };
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
  const srv = http.createServer((q, r) => {
    let f = decodeURIComponent(q.url).split('?')[0]; if (f === '/') f = '/index.html';
    if (f === '/favicon.ico') { r.writeHead(204); return r.end(); }
    const p = path.join(OUTS.courant, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
  });
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); });
  // La page /etat : public/ tel que Vercel le sert, plus etat-version.json (posé au build).
  const pub = fs.mkdtempSync(path.join(os.tmpdir(), 'banc-etat-'));
  for (const f of ['etat.html', 'etat.js', 'logo-vrm-96.png', 'vrm-icon-v4-192.png']) fs.copyFileSync(path.join(RACINE, 'public', f), path.join(pub, f));
  fs.writeFileSync(path.join(pub, 'etat-version.json'), JSON.stringify({ extension: VERSION_EXT }));
  const srvEtat = V.servir(pub, PORT + 1);
  try {
    for (const theme of ['clair', 'sombre']) for (const tel of [true, false]) await feuille(nav, theme, tel, OUTS);
    for (const theme of ['clair', 'sombre']) for (const tel of [true, false]) await etat(nav, theme, tel, PORT + 1);
  } finally { await nav.close(); srv.close(); srvEtat.close(); }
  ko += V.bilanCsp();
  console.log(`\nCaptures : ${SHOTS}`);
  console.log(`${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ le banc a levé : ' + (e && e.stack || e)); process.exit(1); });
