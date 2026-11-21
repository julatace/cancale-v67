require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « STATUT AUTOMATIQUE » (9 nov.) — 390 px tactile ET 1512 px, clair ET sombre
//  vrm.center/statut servie COMME VERCEL (`_vercel.servir`), avec un /api/sante
//  dont `statut` est fabriqué par la VRAIE règle (api/_lib/statut-sondes.js :
//  `etatApres` passage après passage, puis `statutPublic`) — la forme réelle.
//   A. Un incident EN COURS sur la réception des e-mails (deux sondes ratées),
//      un incident de la base RÉSOLU il y a 5 jours (1 h 30), l'envoi des e-mails
//      pas en service, 30 jours d'historique : six rangées, 30 barres chacune,
//      la barre « pas vérifié » GRISE (jamais la couleur d'un « ok »), l'incident
//      en ambre, « Mis à jour il y a 7 min », les incidents automatiques ET
//      celui écrit à la main, en cours d'abord ; aucune autre requête.
//   B. Les sondes arrêtées (état rangé il y a 2 h) et la sonde en direct qui ne
//      sait pas (« inconnu ») : tout « Pas vérifié », gris, titre « État pas
//      vérifié » — jamais « Tout fonctionne ». (Quand la sonde en direct a
//      répondu, ses trois morceaux la suivent : c'est une vraie mesure.)
//  Données inventées. Captures : SHOTS (défaut <tmp>/banc-statut-auto) — à REGARDER.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const V = require('./_vercel.cjs');
const RACINE = path.join(__dirname, '..', '..');
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-statut-auto');
fs.mkdirSync(SHOTS, { recursive: true });
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const PORT = (Number(process.env.BANC_PORT) || 4983) + 11;
let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det !== undefined ? ' — ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 400) : ''}`); };

async function fabriquer() {
  const L = await import('file://' + path.join(RACINE, 'api', '_lib', 'statut-sondes.js'));
  const M = 60e3, H = 3600e3, J = 864e5;
  const maintenant = Date.now();
  const tous = (etat, raison, autres = {}) => Object.fromEntries(L.COMPOSANTS.map((c) => [c, autres[c] || { etat, raison }]));
  const envoi = { etat: 'pas_su', raison: 'non-configure' };
  let d = null;
  // L'incident de la base, il y a 5 jours : deux ratées, puis le retour 1 h 30 après.
  const t5 = maintenant - 5 * J;
  d = L.etatApres(d, tous('ok', 'repond', { envoi }), t5 - 20 * M).etat;
  d = L.etatApres(d, tous('ok', 'repond', { envoi, base: { etat: 'degrade', raison: 'erreur-http', http: 503 } }), t5).etat;
  d = L.etatApres(d, tous('ok', 'repond', { envoi, base: { etat: 'degrade', raison: 'erreur-http', http: 503 } }), t5 + 10 * M).etat;
  d = L.etatApres(d, tous('ok', 'repond', { envoi }), t5 + 90 * M).etat;
  // 30 jours d'historique, dans la forme rangée ([ok, dégradé, pas su, incident]) ; les 3 premiers jours pas encore sondés.
  for (let i = 29; i >= 1; i--) {
    const j = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(maintenant - i * J));
    if (d.jours[j]) continue;
    if (i >= 27) continue;
    d.jours[j] = Object.fromEntries(L.COMPOSANTS.map((c) => [c, c === 'envoi' ? [0, 0, 144, 0] : [140, 0, 4, 0]]));
  }
  // Aujourd'hui : la réception des e-mails rate deux fois de suite (silence de 14 h, d'habitude moins de 9 h).
  const silence = { etat: 'degrade', raison: 'silence', silenceH: 14, seuilH: 9 };
  d = L.etatApres(d, tous('ok', 'repond', { envoi }), maintenant - 47 * M).etat;
  d = L.etatApres(d, tous('ok', 'repond', { envoi, emails: silence }), maintenant - 17 * M).etat;
  d = L.etatApres(d, tous('ok', 'repond', { envoi, emails: silence, notifications: { etat: 'ok', raison: 'configure' } }), maintenant - 7 * M).etat;
  const a = L.statutPublic(d, maintenant);
  const vieux = L.statutPublic({ ...d, at: new Date(maintenant - 2 * H).toISOString() }, maintenant);
  return { a, vieux };
}

async function voir(nav, W, theme, cas, statut) {
  const tel = W < 600, tag = `${cas}-${W}-${theme}`;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } }), locale: 'fr-FR', timezoneId: 'Europe/Paris', colorScheme: theme === 'sombre' ? 'dark' : 'light' });
  await ctx.route((u) => u.pathname === '/api/sante', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: V.entetesPour('/api/sante'),
    body: JSON.stringify({ ok: true, serviceKey: true, owner: true, ia: false, detourage: false, stripe: true, stripeWebhook: true, relancesEssai: false, etat: cas === 'A' ? { base: 'ok', emails: 'ok', notifications: 'ok', verifieA: new Date().toISOString() } : { base: 'inconnu', emails: 'inconnu', notifications: 'inconnu', verifieA: new Date().toISOString() }, statut }) }));
  const pg = await ctx.newPage();
  const requetes = [], errs = [];
  pg.on('request', (q) => requetes.push(q.url()));
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto(`http://localhost:${PORT}/statut`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.querySelector('main').getAttribute('data-etat-global') !== 'chargement' && document.getElementById('incidents').getAttribute('data-incidents') !== 'chargement', null, { timeout: 8000 }).catch(() => {});
  const v = await pg.evaluate(() => {
    const css = (e, p) => getComputedStyle(e)[p];
    const lignes = [...document.querySelectorAll('[data-statut-morceau]')].map((li) => ({
      c: li.getAttribute('data-statut-morceau'), etat: li.getAttribute('data-etat'), mot: li.querySelector('.mot').textContent, motCouleur: css(li.querySelector('.mot'), 'color'),
      detail: (li.querySelector('.detail') || {}).textContent || '',
      barres: [...li.querySelectorAll('.barre')].map((b) => ({ e: b.getAttribute('data-etat'), fond: css(b, 'backgroundColor'), op: css(b, 'opacity'), h: b.getBoundingClientRect().height, w: b.getBoundingClientRect().width })),
    }));
    return { global: document.querySelector('main').getAttribute('data-etat-global'), titre: document.getElementById('titre').textContent, maj: document.getElementById('maj').textContent, majN: document.getElementById('maj').getAttribute('data-maj'),
      lignes, inc: [...document.querySelectorAll('[data-incident]')].map((l) => ({ e: l.getAttribute('data-incident'), s: l.getAttribute('data-incident-source'), t: l.innerText.replace(/\s+/g, ' ') })),
      texte: document.body.innerText, deborde: document.documentElement.scrollWidth > window.innerWidth + 1, theme: document.documentElement.getAttribute('data-theme'),
      bleu: getComputedStyle(document.documentElement).getPropertyValue('--bleu').trim() };
  });
  const autres = requetes.map((u) => new URL(u)).filter((u) => !(u.host === `localhost:${PORT}` && ['/statut', '/statut.js', '/api/sante', '/etat-version.json', '/statut-incidents.json', '/logo-vrm-96.png', '/vrm-icon-v4-192.png', '/favicon.ico'].includes(u.pathname)));
  dit(!autres.length, `${tag} : aucune autre requête (ni base, ni session, ni autre site)`, autres.map(String));
  dit(!v.deborde && !errs.length && v.theme === (theme === 'sombre' ? 'dark' : 'light'), `${tag} : rien ne déborde, aucune erreur, thème ${theme}`, { deborde: v.deborde, errs });
  dit(v.lignes.length === 6 && v.lignes.every((l) => l.barres.length === 30 && l.barres.every((b) => b.h >= 20 && b.w > 3)), `${tag} : six rangées, 30 barres chacune (30 derniers jours)`, v.lignes.map((l) => [l.c, l.barres.length]));
  const fondDe = (e) => [...new Set(v.lignes.flatMap((l) => l.barres.filter((b) => b.e === e).map((b) => b.fond + '/' + b.op)))];
  const gris = fondDe('pas_su'), okf = fondDe('ok'), deg = fondDe('degrade');
  dit(gris.length === 1 && !okf.includes(gris[0]) && !deg.includes(gris[0]), `${tag} : « pas vérifié » a SA couleur, grise, distincte de « normal » et d’« incident »`, { gris, okf, deg });
  dit(![...gris, ...okf].some((f) => f.startsWith(v.bleu)) && deg.every((f) => /rgb\((178, 80, 0|255, 179, 64)\)/.test(f)), `${tag} : aucune barre bleue (l’accent reste rare) ; l’incident en ambre`, { gris, okf, deg });
  if (cas === 'A') {
    const L = Object.fromEntries(v.lignes.map((l) => [l.c, l]));
    dit(v.global === 'panne' && /Incident en cours sur la réception des e-mails/.test(v.titre), `${tag} : le titre dit l’incident en cours`, v.titre);
    dit(L.emails.etat === 'degrade' && L.emails.mot === 'Dégradé' && /14 h/.test(L.emails.detail) && /9 h/.test(L.emails.detail) && L.emails.barres[29].e === 'degrade', `${tag} : e-mails « Dégradé », la phrase dit le silence et l’habitude, la barre du jour en ambre`, L.emails);
    dit(L.envoi.etat === 'pas_su' && L.envoi.mot === 'Pas en service' && L.envoi.barres.every((b) => b.e === 'pas_su'), `${tag} : l’envoi pas branché ⇒ « Pas en service », gris tout du long`, L.envoi.mot);
    dit(L.base.etat === 'ok' && L.base.barres.filter((b) => b.e === 'degrade').length === 1 && L.base.barres.slice(0, 3).every((b) => b.e === 'pas_su') && L.notifications.mot === 'Configurées', `${tag} : la base : un jour d’incident il y a 5 jours ; les jours pas sondés en gris ; notifications « Configurées »`, L.base.barres.map((b) => b.e[0]).join(''));
    dit(v.majN === '7' && /Mis à jour il y a 7 min/.test(v.maj), `${tag} : « Mis à jour il y a 7 min »`, v.maj);
    dit(v.inc.length === 3 && v.inc[0].e === 'en-cours' && v.inc[0].s === 'auto' && /réception des e-mails/.test(v.inc[0].t) && v.inc.some((x) => x.s === 'auto' && x.e === 'resolu' && /durée 1 h 30/.test(x.t)) && v.inc.some((x) => x.s === 'main'), `${tag} : incidents auto (en cours, puis résolu avec sa durée) et celui écrit à la main`, v.inc);
  } else {
    dit(v.global === 'partiel' && v.titre === 'État pas vérifié' && !/Tout fonctionne/.test(v.texte), `${tag} : sondes arrêtées ⇒ « État pas vérifié », jamais « Tout fonctionne »`, v.titre);
    dit(v.lignes.every((l) => l.etat === 'pas_su' && l.mot === 'Pas vérifié'), `${tag} : chaque morceau « Pas vérifié »`, v.lignes.map((l) => l.mot));
    dit(v.lignes.every((l) => !l.detail), `${tag} : « sondes arrêtées » dit une fois en tête, pas sur chaque ligne`, v.lignes.map((l) => l.detail));
  }
  await pg.screenshot({ path: path.join(SHOTS, `statut-${tag}.png`), fullPage: true });
  await ctx.close();
}

(async () => {
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  let srv = null;
  try {
    const pub = fs.mkdtempSync(path.join(os.tmpdir(), 'banc-statut-auto-'));
    for (const f of ['statut.html', 'statut.js', 'logo-vrm-96.png', 'vrm-icon-v4-192.png']) fs.copyFileSync(path.join(RACINE, 'public', f), path.join(pub, f));
    fs.writeFileSync(path.join(pub, 'etat-version.json'), JSON.stringify({ extension: '5.329.0' }));
    const h = (x) => new Date(Date.now() - x * 3600e3).toISOString();
    fs.writeFileSync(path.join(pub, 'statut-incidents.json'), JSON.stringify({ incidents: [
      { debut: h(30), fin: h(29), titre: 'Bordereaux Mondial Relay en retard', texte: 'Les bordereaux arrivaient avec quelques minutes de retard. Rétabli.', touche: ['autre'] },
    ] }));
    srv = V.servir(pub, PORT);
    const { a, vieux } = await fabriquer();
    for (const W of LARGEURS) for (const t of THEMES) { await voir(nav, W, t, 'A', a); await voir(nav, W, t, 'B', vieux); }
  } finally { await nav.close(); if (srv && srv.close) srv.close(); }
  console.log(`\nCaptures : ${SHOTS}`);
  console.log(ko ? `${ko} KO` : 'Tout est vert');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('KO banc planté : ' + (e && e.stack || e)); process.exit(1); });
