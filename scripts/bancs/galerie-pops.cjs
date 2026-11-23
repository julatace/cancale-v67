// ════════════════════════════════════════════════════════════════════════════
//  BANC — « VOIR TOUS LES POP-UPS » (23 nov., Julien ; compte PROPRIÉTAIRE de l'installation seulement)
//  P1 le propriétaire voit l'entrée dans Paramètres ; « Voir tous les pop-ups » ouvre la barre de la galerie ;
//  P2 la galerie passe CHAQUE exemple du registre des notifications (api/_lib/notif-apercus.js via src/galeriePops.js —
//     le nombre attendu est relu dans le registre, pas recopié) puis les 3 messages courts ; chacun s'affiche (une carte
//     `.n-pop` avec un titre, ou un message court) ;
//  P3 rien n'est écrit en base pendant toute la galerie ; aucune erreur ;
//  P4 un vendeur ordinaire ne voit pas l'entrée, et l'événement `vrm:galerie-pops` n'ouvre rien chez lui.
//  Contexte : scripts/bancs/design-passe.cjs. `SHOTS=dossier` (à REGARDER), `LARGEURS`. Données d'exemple seulement.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || '';
const LARGEURS = String(process.env.LARGEURS || '390,1512').split(',').map(Number);
let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 400) : ''}`); };
const visible = (pg, sel) => pg.evaluate((s) => [...document.querySelectorAll(s)].some((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; }), sel);
const cliquerVisible = (pg, sel) => pg.evaluate((s) => { const e = [...document.querySelectorAll(s)].find((x) => { const b = x.getBoundingClientRect(); return b.width > 0 && b.height > 0; }); if (!e) return false; e.scrollIntoView({ block: 'center' }); e.click(); return true; }, sel);
const attendre = async (pg, f, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await f()) return true; await pg.waitForTimeout(250); } return false; };
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }); };
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);

async function attenduDuRegistre() {
  const m = await import(path.join(__dirname, '..', '..', 'src', 'galeriePops.js'));
  return m.exemplesPops().length + 3;
}
// Le contexte de design-passe (session, base, routes : `mode=abonnement` ⇒ propriétaire). Un VENDEUR : la même route rend
// `proprietaire: false` (Playwright prend la dernière route posée) et la mémoire de l'appareil est vidée, puis on recharge.
async function ouvrirParametres(nav, W, b, proprio) {
  const o = await P.ouvrir(nav, { W, sombre: false, b, url: '/?tab=settings' });
  const ecrits = [];
  // Chaque écriture vers la base, nommée par la ligne visée (`id=eq.…` ou les `id` du corps) ; chaque appel à /api/push.
  o.pg.on('request', (r) => {
    const u = r.url();
    if (/\/api\/push/.test(u) && r.method() !== 'GET') ecrits.push('PUSH ' + u.slice(0, 80));
    if (!/\/rest\/v1\//.test(u) || !/POST|PATCH|DELETE/.test(r.method())) return;
    let ids = []; const m = /[?&]id=eq\.([^&]+)/.exec(decodeURIComponent(u)); if (m) ids.push(m[1]);
    try { const b = JSON.parse(r.postData() || 'null'); for (const x of (Array.isArray(b) ? b : [b])) if (x && x.id) ids.push(String(x.id)); } catch (_) {}
    for (const id of (ids.length ? ids : ['?'])) ecrits.push(r.method() + ' ' + id);
  });
  if (!proprio) {
    await o.pg.route('**/api/**', (r) => (/mode=abonnement/.test(r.request().url()) ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, proprietaire: false, acces: true }) }) : r.fallback()));
    await o.pg.addInitScript(() => { try { for (const k of Object.keys(localStorage)) if (k.startsWith('vrm_proprio_vu_')) localStorage.removeItem(k); } catch (_) {} });
    await o.pg.reload({ waitUntil: 'domcontentloaded' });
  }
  await o.pg.waitForSelector('.vrm-main', { timeout: 40000 }).catch(() => {});
  o.ecrits = ecrits; o.erreurs.length = 0;
  return o;
}
const ouvrirRangee = async (pg) => {
  // La rangée vit dans le groupe « Propriétaire » de la catégorie qui la CONTIENT (`data-categorie-contient`, Aide aujourd'hui).
  const cat = '[data-categorie-contient*=" galerie-pops "]';
  await attendre(pg, async () => (await visible(pg, '[data-reglage-galerie-pops]')) || (await visible(pg, cat)), 15000);
  if (!(await visible(pg, '[data-reglage-galerie-pops]'))) { await cliquerVisible(pg, cat); await attendre(pg, () => visible(pg, '[data-reglage-galerie-pops]'), 8000); }
};

async function proprietaire(nav, W, b, attendu) {
  const T = `[propriétaire ${W}px]`;
  const o = await ouvrirParametres(nav, W, b, true);
  await ouvrirRangee(o.pg);
  dit(await visible(o.pg, '[data-reglage-galerie-pops]'), `${T} P1 Paramètres porte « Voir tous les pop-ups »`);
  await cliquerVisible(o.pg, '[data-reglage-galerie-pops]');
  await attendre(o.pg, () => visible(o.pg, '[data-galerie-ouvrir]'), 8000);
  // Le témoin : ce que l'app écrit d'elle-même (synchronisation) pendant une durée comparable, SANS la galerie.
  const t0 = o.ecrits.length; await o.pg.waitForTimeout(14000); const temoin = new Set(o.ecrits.slice(t0));
  const avant = o.ecrits.length;
  await cliquerVisible(o.pg, '[data-galerie-ouvrir]');
  if (!(await attendre(o.pg, () => visible(o.pg, '.n-galerie'), 8000))) { dit(false, `${T} P2 la barre de la galerie s'ouvre`); await o.ctx.close(); return; }
  const n = Number(await o.pg.getAttribute('.n-galerie', 'data-galerie-pops'));
  dit(n === attendu, `${T} P2 la galerie compte ${attendu} exemples (registre + 3 messages courts)`, String(n));
  await o.pg.click('[data-galerie-lecture="1"]').catch(() => {});
  const vus = []; const manques = [];
  for (let k = 0; k < n; k++) {
    await o.pg.waitForTimeout(450);
    const r = await o.pg.evaluate(() => {
      const g = document.querySelector('.n-galerie'); const pop = [...document.querySelectorAll('.n-pop')].find((x) => x.getBoundingClientRect().height > 0);
      const toast = [...document.querySelectorAll('.vrm-toast')].find((x) => x.getBoundingClientRect().height > 0);
      return { i: g && g.getAttribute('data-galerie-i'), famille: g && g.getAttribute('data-galerie-famille'), titre: pop ? (pop.querySelector('.n-pop-titre') || {}).textContent : '', toast: toast ? toast.textContent : '' };
    });
    vus.push(r.famille);
    if (!(r.titre || r.toast)) manques.push(`${r.i}:${r.famille}`);
    if (k === 0 || r.famille !== vus[k - 1]) await capture(o.pg, `galerie-${W}-${String(k).padStart(2, '0')}-${r.famille}`);
    await o.pg.click('.n-galerie [aria-label="Suivant"]');
  }
  dit(!manques.length, `${T} P2 chaque exemple s'affiche (${n})`, manques.join(', '));
  dit(new Set(vus).size >= 5, `${T} P2 plusieurs familles passent (${[...new Set(vus)].join(',')})`);
  // Les points de restauration automatiques de l'app (`restore_N`, toutes les N minutes, sans rapport avec ce qu'on regarde) sont
  // de la synchronisation, comme le témoin ; tout le reste écrit pendant la galerie serait SON écriture.
  const pendant = o.ecrits.slice(avant).filter((x) => (!temoin.has(x) && !/^(POST|PATCH) restore_\d+$/.test(x)) || /^PUSH/.test(x));
  dit(!pendant.length, `${T} P3 la galerie n'écrit rien en base et n'envoie aucune notification (hors la synchronisation que l'app fait sans elle : ${[...temoin].join(', ') || 'rien'})`, pendant.join(' ¦ '));
  await o.pg.click('.n-galerie [aria-label="Fermer"]');
  await o.pg.waitForTimeout(400);
  dit(!(await visible(o.pg, '.n-galerie')), `${T} Fermer retire la barre`);
  dit(!(await deborde(o.pg)), `${T} rien ne déborde`);
  dit(!o.erreurs.length, `${T} P3 aucune erreur JS`, o.erreurs.join(' ¦ '));
  await o.ctx.close();
}
async function vendeur(nav, W, b) {
  const T = `[vendeur ${W}px]`;
  const o = await ouvrirParametres(nav, W, b, false);
  await o.pg.waitForSelector('[data-categorie-ouvrir], [data-reglages-disposition]', { timeout: 20000 }).catch(() => {});
  await o.pg.waitForTimeout(2500);
  const cats = await o.pg.evaluate(() => document.querySelectorAll('[data-categorie-ouvrir]').length);
  dit(cats > 0 && !(await o.pg.$('[data-reglage-galerie-pops]')) && !(await o.pg.$('[data-categorie-contient*=" galerie-pops "]')), `${T} P4 un vendeur ne voit pas « Voir tous les pop-ups » (ni la rangée ni une catégorie qui la contient ; ${cats} catégories)`);
  await o.pg.evaluate(() => window.dispatchEvent(new Event('vrm:galerie-pops')));
  await o.pg.waitForTimeout(800);
  dit(!(await o.pg.$('.n-galerie')), `${T} P4 l'événement n'ouvre rien chez un vendeur`);
  await o.ctx.close();
}

(async () => {
  await new Promise((ok) => srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] });
  try {
    const attendu = await attenduDuRegistre(); const b = base();
    for (const W of LARGEURS) { await proprietaire(nav, W, b, attendu); await vendeur(nav, W, b); }
  } catch (e) { dit(false, 'le banc a pu aller au bout', String(e && e.stack || e).slice(0, 400)); }
  await nav.close(); srv.close();
  console.log(ko ? `\n❌ galerie des pop-ups : ${ko} défaut(s)` : '\n✅ galerie des pop-ups : rien à signaler');
  process.exit(ko ? 1 : 0);
})();
