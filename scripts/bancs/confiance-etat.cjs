// ════════════════════════════════════════════════════════════════════════════
//  BANC — LES PAGES PUBLIQUES /confiance ET /etat (13 nov., lot 50 + 52)
//
//  Servies COMME VERCEL (`_vercel.servir` : réécritures /confiance et /etat,
//  en-têtes, CSP), 390 px tactile et 1512 px, clair et sombre :
//  1. /confiance : les six parties, les nombres RENDUS égaux à ceux du code
//     (relus dans background.js / favorisAuto.js / freinRelaisVinted.js), le
//     thème, aucun débordement, cibles au doigt ≥ 44 px, aucune violation de CSP,
//     aucune requête vers /api ; ses liens (/etat, confidentialité).
//  2. /etat avec un faux /api/sante (horloge tenue, `page.clock`) :
//      · tout ok ⇒ « Tout fonctionne » et l'heure de la vérification ;
//      · /api/sante muet (réseau coupé) ⇒ « État inconnu », trois morceaux « Pas
//        vérifié », point gris (ni bleu ni ambre), JAMAIS « Tout fonctionne », et
//        « Dernière vérification » garde celle qui a répondu + « essai sans
//        réponse » ; en 502 pareil ; `ok:false` pareil ;
//      · une réponse vieille de plus de 10 min ⇒ « État inconnu » ;
//      · une panne ⇒ « Panne en cours sur … », en ambre, sans « nous sommes
//        prévenus » ; un morceau pas vérifié ⇒ « Vérification incomplète » ;
//      · relue après 60 s page visible, PAS onglet caché, relue au retour.
//  Captures dans SHOTS (défaut : <tmp>/banc-confiance-etat). BANC_PORT : 10230.
//  `node scripts/bancs/confiance-etat.cjs`
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), os = require('os');
const RACINE = process.env.RACINE || path.join(__dirname, '..', '..');
const NM = [path.join(RACINE, 'node_modules'), path.join(__dirname, '..', '..', 'node_modules')].find((p) => fs.existsSync(path.join(p, 'playwright')));
if (!NM) { console.log('❌ playwright introuvable (node_modules absent)'); process.exit(1); }
try { require(path.join(__dirname, '_porte-banc.cjs')); } catch (_) {}
const { chromium } = require(path.join(NM, 'playwright'));
const V = require(path.join(__dirname, '_vercel.cjs'));
const PORT = Number(process.env.BANC_PORT) || 10230;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-confiance-etat');
fs.mkdirSync(SHOTS, { recursive: true });
const lireR = (f) => { try { return fs.readFileSync(path.join(RACINE, f), 'utf8'); } catch (_) { return ''; } };
const VERSION_EXT = JSON.parse(lireR('vinted-sync-extension/manifest.json') || '{}').version;

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d != null && d !== '' ? '  → ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400) : '')); } };
const debordement = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const contexte = (nav, theme, tel) => nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } }), locale: 'fr-FR', timezoneId: 'Europe/Paris', colorScheme: theme === 'sombre' ? 'dark' : 'light' });

// Les nombres que la page DOIT rendre : relus dans le code (jamais recopiés ici).
const bg = lireR('vinted-sync-extension/background.js');
const n = (src, re) => { const m = re.exec(src); return m ? m[1] : null; };
const paliers = (n(bg, /const PAUSE_PALIERS_MIN = \[([^\]]+)\]/) || '').split(',').map(Number);
const DU_CODE = {
  'actions-heure': n(bg, /const ACTIONS_MAX_HEURE = (\d+)/),
  'actions-jour': n(bg, /const DISCRETION_JOUR_DEFAUT = (\d+)/),
  'prudence-heure': n(bg, /const PRUDENCE_ACTIONS_HEURE = (\d+)/),
  'pause-min': String(paliers[0]),
  'pause-max': String(paliers[paliers.length - 1] / 60),
  'lbc-suppressions-heure': n(bg, /const LBC_SUPPRIME_MAX_HEURE = (\d+)/),
  'favoris-jour': n(lireR('src/favorisAuto.js'), /AUTO_DEFAUT = Object\.freeze\(\{[^}]*parJour: (\d+)/),
  'favoris-heure': n(lireR('src/favorisAuto.js'), /AUTO_DEFAUT = Object\.freeze\(\{[^}]*parHeure: (\d+)/),
  'relais-demi-heure': n(lireR('src/freinRelaisVinted.js'), /MAX_PAR_FENETRE = (\d+)/),
};

async function confiance(nav, theme, tel) {
  const T = `/confiance ${tel ? '390' : '1512'} ${theme}`, F = `${theme}-${tel ? '390' : '1512'}`;
  const ctx = await contexte(nav, theme, tel);
  const vues = V.observer(ctx);
  const api = []; ctx.on('request', (q) => { if (/\/api\//.test(q.url())) api.push(q.url()); });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const rep = await pg.goto(`http://localhost:${PORT}/confiance`, { waitUntil: 'load' });
  const l = await pg.evaluate(() => ({
    present: !!document.querySelector('main[data-confiance]'),
    titre: document.title, h1: (document.querySelector('h1') || {}).textContent || '',
    sections: [...document.querySelectorAll('[data-section]')].map((s) => s.getAttribute('data-section')),
    affs: document.querySelectorAll('[data-affirmation]').length,
    chiffres: Object.fromEntries([...document.querySelectorAll('[data-chiffre]')].map((x) => [x.getAttribute('data-chiffre'), x.textContent.trim()])),
    liens: [...document.querySelectorAll('a')].map((a) => ({ h: a.getAttribute('href'), haut: Math.round(a.getBoundingClientRect().height) })),
    theme: document.documentElement.getAttribute('data-theme'), fond: getComputedStyle(document.body).backgroundColor,
    texte: document.body.innerText,
  }));
  dit(rep && rep.status() === 200 && l.present && /ne fait jamais/.test(l.h1), `${T} — la page répond, son titre dit ce qu’elle est`, { s: rep && rep.status(), h1: l.h1 });
  dit(['lu', 'clic', 'auto', 'limites', 'jamais', 'donnees'].every((s) => l.sections.includes(s)) && l.affs >= 25, `${T} — les six parties (${l.affs} affirmations)`, l.sections);
  const ecarts = Object.entries(DU_CODE).filter(([k, v]) => !v || l.chiffres[k] !== v).map(([k, v]) => `${k} : page ${l.chiffres[k]} / code ${v}`);
  dit(!ecarts.length, `${T} — chaque nombre rendu est celui du code (${Object.keys(DU_CODE).length})`, ecarts);
  dit(/\b50 actions par heure et par compte\b/.test(l.texte.replace(/\s+/g, ' ')) || DU_CODE['actions-heure'] !== '50', `${T} — « ${DU_CODE['actions-heure']} actions par heure et par compte » se lit tel quel`);
  dit(l.theme === (theme === 'sombre' ? 'dark' : 'light') && (theme === 'sombre' ? l.fond === 'rgb(0, 0, 0)' : l.fond === 'rgb(242, 242, 247)'), `${T} — le thème suit le système (${theme})`, l.fond);
  dit(l.liens.some((a) => a.h === '/etat') && l.liens.some((a) => a.h === '/legal/confidentialite.html'), `${T} — liée à /etat et à la politique de confidentialité`);
  if (tel) dit(l.liens.every((a) => a.haut >= 44), `${T} — chaque lien fait au moins 44 px de haut`, l.liens.filter((a) => a.haut < 44));
  const accent = await pg.evaluate(() => [...document.querySelectorAll('li b, h2, h1')].map((e) => getComputedStyle(e).color).filter((c, i, t) => t.indexOf(c) === i));
  dit(accent.length <= 2, `${T} — le texte reste neutre (l’accent est réservé aux liens)`, accent);
  await pg.screenshot({ path: path.join(SHOTS, `confiance-${F}.png`), fullPage: true });
  dit(await debordement(pg) <= 0 && !errs.length, `${T} — aucun débordement horizontal, aucune erreur`, errs);
  dit(!api.length, `${T} — aucune requête vers /api (la page ne lit rien)`, api);
  dit(!vues.length, `${T} — aucune violation de la CSP de vercel.json`, vues.map((x) => x.texte));
  await ctx.close();
}

const SANTE = (etat) => ({ ok: true, serviceKey: true, owner: true, etat });
async function etat(nav, theme, tel) {
  const T = `/etat ${tel ? '390' : '1512'} ${theme}`, F = `${theme}-${tel ? '390' : '1512'}`;
  const ctx = await contexte(nav, theme, tel);
  const vues = V.observer(ctx);
  let reponse = SANTE({ base: 'ok', emails: 'ok', notifications: 'ok', verifieA: '2026-11-13T09:31:05.000Z' });
  let appels = 0;
  await ctx.route((u) => u.pathname === '/api/sante', (route) => {
    appels++;
    if (reponse === 'muet') return route.abort('failed');
    if (reponse === '502') return route.fulfill({ status: 502, body: '<html>502</html>' });
    return route.fulfill({ status: 200, contentType: 'application/json', headers: V.entetesPour('/api/sante'), body: JSON.stringify(reponse) });
  });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: new Date('2026-11-13T09:31:10Z') });
  await pg.goto(`http://localhost:${PORT}/etat`, { waitUntil: 'domcontentloaded' });
  // Après un tour d'horloge, attendre la RÉPONSE (la requête est rendue en asynchrone) :
  // un nouvel essai raté change l'heure de l'essai ; une réponse change la phrase.
  const essaiApres = (avant) => pg.waitForFunction((x) => ((document.getElementById('essai') || {}).textContent || '') !== x && /essai/.test((document.getElementById('essai') || {}).textContent || ''), avant, { timeout: 5000 }).catch(() => {});
  const phraseDit = (re) => pg.waitForFunction((x) => new RegExp(x).test(document.getElementById('phrase').textContent), re, { timeout: 5000 }).catch(() => {});
  const attendre = (g) => pg.waitForFunction((x) => document.querySelector('main').getAttribute('data-etat-global') === x, g, { timeout: 5000 }).catch(() => {});
  const lire = () => pg.evaluate(() => ({ g: document.querySelector('main').getAttribute('data-etat-global'), titre: document.getElementById('titre').textContent, phrase: document.getElementById('phrase').textContent,
    heure: document.getElementById('heure').textContent, essai: (document.getElementById('essai') || {}).textContent || '', pied: document.querySelector('.pied').textContent,
    m: Object.fromEntries([...document.querySelectorAll('[data-etat-morceau]')].map((l) => [l.getAttribute('data-etat-morceau'), l.getAttribute('data-etat') + ' · ' + l.querySelector('.mot').textContent])),
    point: getComputedStyle(document.querySelector('h1 .point')).backgroundColor, texte: document.body.innerText }));
  const BLEU = theme === 'sombre' ? 'rgb(10, 132, 255)' : 'rgb(0, 113, 227)', AMBRE = theme === 'sombre' ? 'rgb(255, 179, 64)' : 'rgb(178, 80, 0)';
  const pasDeFeuVert = (x) => x.g === 'inconnu' && x.titre === 'État inconnu' && !/Tout fonctionne|tout va bien/i.test(x.texte) && ['base', 'emails', 'notifications'].every((k) => x.m[k] === 'inconnu · Pas vérifié') && x.point !== BLEU && x.point !== AMBRE;

  await attendre('ok');
  const a = await lire();
  dit(a.g === 'ok' && a.titre === 'Tout fonctionne' && a.m.base === 'ok · Fonctionne' && a.m.extension === 'ok · Version ' + VERSION_EXT && a.heure === '10:31:05' && !a.essai && a.point === BLEU, `${T} — tout ok : « Tout fonctionne », l’heure de la vérification`, a);
  await pg.screenshot({ path: path.join(SHOTS, `etat-ok-${F}.png`), fullPage: true });

  // Pas de réponse (réseau coupé) ⇒ état inconnu, jamais « tout va bien ».
  reponse = 'muet';
  await pg.clock.runFor(61000);
  await attendre('inconnu');
  const b = await lire();
  dit(pasDeFeuVert(b) && /ta connexion comme de VRM : on ne sait pas/.test(b.phrase) && !/prévenus/.test(b.phrase), `${T} — /api/sante muet : « État inconnu », trois « Pas vérifié », point gris, jamais « Tout fonctionne »`, b);
  dit(b.heure === '10:31:05' && /essai sans réponse à 10:32:1\d/.test(b.essai), `${T} — muet : « Dernière vérification » reste celle qui a répondu, l’essai raté est dit à part`, { heure: b.heure, essai: b.essai });
  await pg.screenshot({ path: path.join(SHOTS, `etat-inconnu-${F}.png`), fullPage: true });
  reponse = '502';
  let n2 = appels;
  await pg.clock.runFor(61000);
  await essaiApres(b.essai);
  const b2 = await lire();
  dit(appels > n2 && pasDeFeuVert(b2), `${T} — /api/sante en 502 : « État inconnu »`, b2);
  reponse = { ok: false };
  n2 = appels;
  await pg.clock.runFor(61000);
  await essaiApres(b2.essai);
  const b3 = await lire();
  dit(appels > n2 && pasDeFeuVert(b3) && b3.essai !== b2.essai, `${T} — /api/sante « ok:false » : « État inconnu »`, b3);
  // Une réponse figée (vérification de plus de 10 min) ne dit rien de maintenant.
  reponse = SANTE({ base: 'ok', emails: 'ok', notifications: 'ok', verifieA: '2026-11-13T09:20:00.000Z' });
  await pg.clock.runFor(61000);
  await phraseDit('plus de 10 minutes');
  const c = await lire();
  dit(pasDeFeuVert(c) && /plus de 10 minutes/.test(c.phrase), `${T} — une vérification vieille de plus de 10 min : « État inconnu »`, c);

  // Une panne ⇒ dite, en ambre, sans promesse.
  reponse = SANTE({ base: 'ok', emails: 'panne', notifications: 'ok', verifieA: '2026-11-13T09:35:12.000Z' });
  const n0 = appels;
  await pg.clock.runFor(61000);
  await attendre('panne');
  const d = await lire();
  dit(appels > n0 && d.titre === 'Panne en cours sur la réception des e-mails' && d.m.emails === 'panne · En panne' && d.m.base === 'ok · Fonctionne' && !/prévenus/.test(d.texte) && d.point === AMBRE && d.heure === '10:35:12' && !d.essai, `${T} — 60 s plus tard : « Panne en cours sur la réception des e-mails », ambre, sans « nous sommes prévenus »`, d);
  await pg.screenshot({ path: path.join(SHOTS, `etat-panne-${F}.png`), fullPage: true });
  // Onglet caché : rien n'est sondé.
  await pg.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  const n1 = appels;
  await pg.clock.runFor(180000);
  dit(appels === n1, `${T} — onglet caché pendant 3 min : aucune requête`, appels - n1);
  // Retour visible : relue tout de suite ; un morceau pas vérifié n'est ni panne ni feu vert.
  reponse = SANTE({ base: 'ok', emails: 'inconnu', notifications: 'ok', verifieA: '2026-11-13T09:39:13.000Z' });
  await pg.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
  await attendre('partiel');
  const e = await lire();
  dit(appels === n1 + 1 && e.titre === 'Vérification incomplète' && /réception des e-mails/.test(e.phrase) && e.m.emails === 'inconnu · Pas vérifié' && e.point !== BLEU, `${T} — de retour visible : relue ; « pas vérifié » n’est ni une panne ni « Tout fonctionne »`, e);
  const liens = await pg.evaluate(() => [...document.querySelectorAll('.liens a')].map((a) => ({ h: a.getAttribute('href'), haut: Math.round(a.getBoundingClientRect().height) })));
  dit(liens.some((x) => x.h === '/confiance') && liens.every((x) => x.haut >= 44), `${T} — lien vers /confiance, liens de 44 px`, liens);
  dit(await debordement(pg) <= 0 && !errs.length, `${T} — aucun débordement horizontal, aucune erreur`, errs);
  dit(!vues.length, `${T} — aucune violation de la CSP de vercel.json`, vues.map((x) => x.texte));
  await ctx.close();
}

(async () => {
  const pub = fs.mkdtempSync(path.join(os.tmpdir(), 'banc-confiance-'));
  for (const f of ['confiance.html', 'confiance.js', 'etat.html', 'etat.js', 'logo-vrm-96.png', 'vrm-icon-v4-192.png']) { const p = path.join(RACINE, 'public', f); if (fs.existsSync(p)) fs.copyFileSync(p, path.join(pub, f)); }
  fs.writeFileSync(path.join(pub, 'etat-version.json'), JSON.stringify({ extension: VERSION_EXT }));
  const srv = V.servir(pub, PORT);
  const nav = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--no-sandbox', '--use-angle=swiftshader'] });
  try {
    for (const theme of ['clair', 'sombre']) for (const tel of [true, false]) await confiance(nav, theme, tel);
    for (const theme of ['clair', 'sombre']) for (const tel of [true, false]) await etat(nav, theme, tel);
  } finally { await nav.close(); srv.close(); }
  ko += V.bilanCsp();
  console.log(`\nCaptures : ${SHOTS}`);
  console.log(`${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ le banc a levé : ' + (e && e.stack || e)); process.exit(1); });
