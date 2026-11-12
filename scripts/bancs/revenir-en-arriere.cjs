// ── BANC : REVENIR EN ARRIÈRE (11 nov.) ──────────────────────────────────────
// Base INVENTÉE (aucune donnée réelle, aucune ligne fx/) : 20 paires « Nike Dunk Low 42 »
// identiques, trois notes, un point posé « avant une saisie en série » hier. Depuis, la
// saisie en série a mis 99 € sur 12 paires, trois notes ont été effacées, la fiche it7 a
// perdu son N°, la fiche it8 aussi mais une AUTRE paire porte maintenant le N°8, et un prix
// a été TAPÉ depuis sur it20 (une donnée plus récente).
// Preuves, à 390 px tactile et 1512 px :
//   1. Paramètres → « Revenir en arrière » : la liste des points (lue par `select=id,meta`,
//      jamais `select=data`) ;
//   2. « Voir » : l'aperçu dit 12 prix d'achat · 3 notes · 1 numéro, 1 N° refusé (porté
//      ailleurs), 1 valeur plus récente — et « Revenir à ce moment » reste FERMÉ tant qu'il
//      n'a pas répondu pour elle ;
//   3. « Les garder » puis confirmer : un point « avant une restauration » portant l'inverse
//      part D'ABORD (POST restore_1), puis la ligne `main` (PATCH gardé par data.rev) :
//      31…42 € reviennent, 45 € (tapé depuis) reste, les 3 notes reviennent, it7 retrouve
//      le N°7, it8 reste vide (8 est porté par it30), le pool n'a rien perdu ;
//   4. « Annuler la restauration » : un point « avant l'annulation » part, 99 € et les notes
//      effacées reviennent comme avant la restauration, le N°7 RESTE (un N° ne recule jamais),
//      le point de la restauration est marqué annulé ;
//   5. le point de la restauration ne s'écrit pas (la base répond 503) ⇒ RIEN n'est écrit
//      dans `main`, l'écran dit « Rien n'a changé » ;
//   6. (1512) le point du jour : 30 s après l'ouverture, un point « jour » est posé (la
//      liste du serveur n'en avait aucun aujourd'hui) ;
//   7. cibles ≥ 44 px, aucun débordement horizontal, aucune erreur de page ; captures.
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData, metaDe } = require('./_meta.cjs');
const { pathToFileURL } = require('url');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4493);
const CAPTURES = process.env.BANC_CAPTURES || '';
const SANS_JOUR = process.env.BANC_SANS_JOUR === '1';

const MAINTENANT = Date.now();
const C = (v) => JSON.parse(JSON.stringify(v));
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 200)); } };

// ── La base inventée ──
const fichesAvant = {};
for (let i = 1; i <= 20; i++) fichesAvant[`it${i}`] = { numero: String(i), title: 'Nike Dunk Low 42', buyPrice: 30 + i, account: '111' };
const AVANT = {
  vinted_annonce_numeros: fichesAvant,
  vinted_sale_overrides: {},
  vinted_buyprice_by_num: {},
  vinted_used_numeros: Array.from({ length: 30 }, (_, i) => i + 1),
  vrm_notes_paires: { 'n:1': { t: 'tache semelle', at: '2026-11-01T10:00:00.000Z' }, 'n:2': { t: 'boîte abîmée', at: '2026-11-01T10:00:00.000Z' }, 'n:3': { t: 'lacets neufs', at: '2026-11-01T10:00:00.000Z' } },
  vinted_achat_notes: {},
  vrm_compta: { depenses: [], fixes: [], packs: [], abonnements: [] },
  vinted_offvinted_buys: [],
};
delete AVANT.vinted_annonce_numeros.it20.buyPrice;
const MAINTENANT_MAIN = (() => {
  const m = C(AVANT);
  for (let i = 1; i <= 12; i++) m.vinted_annonce_numeros[`it${i}`].buyPrice = 99;
  m.vrm_notes_paires = {};
  delete m.vinted_annonce_numeros.it7.numero;
  delete m.vinted_annonce_numeros.it8.numero;
  m.vinted_annonce_numeros.it30 = { numero: '8', title: 'Autre paire', account: '111' };
  m.vinted_annonce_numeros.it20.buyPrice = 45;
  m.rev = 7;
  return m;
})();

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
srv.listen(PORT);

async function preparer(b, vp, M, { pointKo = false } = {}) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  // Le point d'hier, fabriqué par la VRAIE règle sur l'état d'avant la saisie en série.
  const snap = M.instantane((k) => (AVANT[k] === undefined ? null : C(AVANT[k])));
  const p0 = M.lignePoint({ snap, raison: 'serie', libelle: 'Saisie en série des prix d’achat', maintenant: MAINTENANT - 26 * 3600e3 });
  const rows = [{ id: 'main', data: C(MAINTENANT_MAIN) }, { id: 'restore_0', data: p0 }];
  const ecrits = [], lectures = [];
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d, st = 200) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (/\/rest\/v1\/app_data/.test(u)) lectures.push({ m: req.method(), u });
    if (req.method() === 'POST' && /\/rest\/v1\/app_data/.test(u)) {
      let corps = []; try { corps = JSON.parse(req.postData() || '[]'); } catch (_) {}
      if (!Array.isArray(corps)) corps = [corps];
      if (pointKo && corps.some((l) => l && /^restore_/.test(l.id))) return j({ message: 'indisponible' }, 503);
      for (const l of corps) {
        if (!l || !l.id) continue;
        if (rows.some((r) => r.id === l.id)) return j({ code: '23505' }, 409);
        ecrits.push({ m: 'POST', id: l.id, data: C(l.data) }); rows.push({ id: l.id, data: C(l.data) });
      }
      return j([], 201);
    }
    if (req.method() === 'PATCH' && /\/rest\/v1\/app_data/.test(u)) {
      const id = (/[?&]id=eq\.([^&]*)/.exec(u) || [])[1];
      const rev = /data->>rev=eq\.(\d+)/.exec(u), revNul = /data->>rev=is\.null/.test(u);
      let corps = null; try { corps = JSON.parse(req.postData() || 'null'); } catch (_) {}
      const ex = rows.find((r) => r.id === id);
      if (pointKo && /^restore_/.test(id || '')) return j({ message: 'indisponible' }, 503);
      if (!ex || !corps || corps.data === undefined) return j([]);
      const cur = ex.data && Number.isSafeInteger(ex.data.rev) ? ex.data.rev : null;
      if ((rev && Number(rev[1]) !== cur) || (revNul && cur != null)) return j([]);   // devancé
      ecrits.push({ m: 'PATCH', id, data: C(corps.data) }); ex.data = C(corps.data);
      return j([{ id }]);
    }
    if (req.method() !== 'GET') return j([]);
    if (/select=owner&limit=1/.test(u)) return j([]);
    if (/select=owner/.test(u)) return j({ m: 1 }, 400);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j([{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }]);
    if (!/\/rest\/v1\/app_data/.test(u)) return j([]);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '*';
    const forme = (r) => {
      if (sel === 'id,meta') return { id: r.id, meta: metaDe(r.data) };
      if (sel === 'data') return { data: r.data };
      if (/^rev:data->>rev/.test(sel)) return { rev: r.data && r.data.rev != null ? String(r.data.rev) : null, maj: new Date(MAINTENANT).toISOString(), vnum: null };
      return { ...r, owner: undefined, updated_at: new Date(MAINTENANT).toISOString() };
    };
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  const ligne = (id) => (rows.find((r) => r.id === id) || {}).data || null;
  return { ctx, pg, errs, ecrits, lectures, ligne, rows };
}
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const hauteur = (pg, sel) => pg.evaluate((s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().height) : 0; }, sel);
const capture = async (pg, nom) => { if (!CAPTURES) return; try { await pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: true }); } catch (_) {} };
const attendre = async (pg, f, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f()) return true; await pg.waitForTimeout(150); } return false; };

async function main() {
  const M = await import(pathToFileURL(path.join(__dirname, '..', '..', 'src', 'restauration.js')).href);
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      const T = vp.width < 600 ? '📱' : '🖥️';
      const tap = async (pg, sel) => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); if (vp.width < 600) await l.tap(); else await l.click(); };
      const ouvrirPanneau = async (pg) => {
        await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
        await pg.locator('[data-reglage-revenir]').first().waitFor({ timeout: 15000 });
        await pg.waitForTimeout(1200);   // le nuage lu (les points ne se posent pas avant)
        await pg.locator('[data-reglage-revenir]').first().scrollIntoViewIfNeeded().catch(() => {});
        await capture(pg, `retour-reglages-${vp.width}`);
        await tap(pg, '[data-reglage-revenir]');
        await pg.locator('[data-retour-liste]').first().waitFor({ timeout: 8000 });
      };
      const confirmerFeuille = async (pg, texte) => { const btn = pg.locator('.vrm-confirmation button', { hasText: texte }).last(); await btn.waitFor({ timeout: 5000 }); if (vp.width < 600) await btn.tap(); else await btn.click(); };

      await essaie(`${T} restaurer puis annuler`, async () => {
        const { ctx, pg, errs, ecrits, lectures, ligne } = await preparer(b, vp, M);
        await ouvrirPanneau(pg);
        await attendre(pg, async () => (await pg.locator('[data-retour-point]').count()) > 0);
        dit((await pg.locator('[data-retour-point="0"]').count()) === 1, `${T} 1. la liste montre le point d’hier`, await pg.locator('[data-retour-liste]').first().getAttribute('data-retour-liste'));
        const lp = lectures.filter((l) => /id=like\.restore_/.test(l.u));
        dit(lp.length > 0 && lp.every((l) => /select=id,meta/.test(l.u)), `${T} 1. la liste se lit par select=id,meta (jamais la ligne entière)`, lp.map((l) => (/select=([^&]*)/.exec(l.u) || [])[1]).join(','));
        await capture(pg, `retour-liste-${vp.width}`);
        dit((await deborde(pg)) <= 1, `${T} liste : aucun débordement horizontal`);
        await tap(pg, '[data-retour-voir="0"]');
        await pg.locator('[data-retour-apercu]').first().waitFor({ timeout: 8000 });
        const cat = async (c, a) => pg.locator(`[data-retour-cat="${c}"]`).first().getAttribute(a);
        dit((await cat('prix', 'data-retour-remis')) === '12' && (await cat('notes', 'data-retour-remis')) === '3' && (await cat('numeros', 'data-retour-remis')) === '1', `${T} 2. aperçu : 12 prix · 3 notes · 1 numéro`, `${await cat('prix', 'data-retour-remis')}/${await cat('notes', 'data-retour-remis')}/${await cat('numeros', 'data-retour-remis')}`);
        dit((await cat('numeros', 'data-retour-refus')) === '1' && (await pg.locator('[data-retour-ligne="refus"][data-retour-id="it8"]').count()) === 1, `${T} 2. le N°8 (porté par une autre paire) est dit « pas rendu »`);
        const resume = await pg.locator('[data-retour-resume]').first().innerText();
        dit(/12 prix d’achat remis/.test(resume) && /3 notes/.test(resume) && /1 numéro/.test(resume), `${T} 2. le résumé`, resume);
        dit((await pg.locator('[data-retour-apercu]').first().getAttribute('data-retour-conflits')) === '1' && (await pg.locator('[data-retour-question]').count()) === 1, `${T} 2. la valeur plus récente (45 € tapé depuis) est montrée et DEMANDÉE`);
        dit(await pg.locator('[data-retour-confirmer]').first().isDisabled(), `${T} 2. « Revenir à ce moment » fermé tant qu’il n’a pas répondu`);
        dit((await hauteur(pg, '[data-retour-confirmer]')) >= 44 && (await hauteur(pg, '[data-retour-choix="prix"]')) > 0, `${T} cibles ≥ 44 px`);
        dit((await deborde(pg)) <= 1, `${T} aperçu : aucun débordement horizontal`);
        await capture(pg, `retour-apercu-${vp.width}`);
        dit((await pg.locator('[data-retour-conflit-ligne="it20"]').count()) === 1 && /45\s*€\s*→\s*—/.test(await pg.locator('[data-retour-conflit-ligne="it20"]').first().innerText()), `${T} 2. la valeur plus récente est MONTRÉE (N°20 : 45 € → —) dans la question`);
        await pg.locator('[data-retour-question]').first().scrollIntoViewIfNeeded();
        await capture(pg, `retour-apercu-bas-${vp.width}`);
        const nAvant = ecrits.length;
        await tap(pg, '[data-retour-conflits-choix="garder"]');
        dit(!(await pg.locator('[data-retour-confirmer]').first().isDisabled()), `${T} 3. « Les garder » ouvre la confirmation`);
        await tap(pg, '[data-retour-confirmer]');
        await confirmerFeuille(pg, 'Revenir en arrière');
        await pg.locator('[data-retour-fait]').first().waitFor({ timeout: 10000 });
        await attendre(pg, async () => ecrits.slice(nAvant).some((e) => e.id === 'main'), 8000);
        const apres = ecrits.slice(nAvant);
        const iPoint = apres.findIndex((e) => /^restore_/.test(e.id)), iMain = apres.findIndex((e) => e.id === 'main');
        const pt = iPoint >= 0 ? apres[iPoint] : null;
        dit(pt && pt.id === 'restore_1' && pt.data.raison === 'restauration' && Array.isArray(pt.data.annulation) && pt.data.annulation.length > 0 && iMain > iPoint, `${T} 3. le point « avant une restauration » (avec son inverse) part AVANT la ligne main`, `point=${pt && pt.id} i=${iPoint}/${iMain}`);
        const m = ligne('main'), F = m.vinted_annonce_numeros;
        dit([1, 2, 3, 4, 5, 6, 9, 10, 11, 12].every((i) => F[`it${i}`].buyPrice === 30 + i) && F.it7.buyPrice === 37, `${T} 3. les 12 prix d’avant reviennent (31…42 €)`, [1, 7, 12].map((i) => F[`it${i}`].buyPrice).join(','));
        dit(F.it20.buyPrice === 45, `${T} 3. le prix tapé depuis (45 €) est GARDÉ`);
        dit(Object.keys(m.vrm_notes_paires || {}).length === 3 && m.vrm_notes_paires['n:1'].t === 'tache semelle', `${T} 3. les 3 notes reviennent`);
        dit(F.it7.numero === '7' && F.it8.numero === undefined && F.it30.numero === '8', `${T} 3. it7 retrouve le N°7 ; it8 reste vide (8 porté par it30)`, `${F.it7.numero}/${F.it8.numero}/${F.it30.numero}`);
        dit(AVANT.vinted_used_numeros.every((n) => m.vinted_used_numeros.includes(n)), `${T} 3. le pool n’a rien perdu`);
        dit((await pg.locator('[data-retour-fait]').first().getAttribute('data-retour-fait')) !== 'echec', `${T} 3. l’écran dit « Retour en arrière fait »`, await pg.locator('[data-retour-fait]').first().innerText().then((t) => t.replace(/\s+/g, ' ').slice(0, 140)));
        await capture(pg, `retour-fait-${vp.width}`);
        // 4. Annuler la restauration.
        const nAvant2 = ecrits.length;
        await tap(pg, '[data-retour-annuler-fait]');
        await confirmerFeuille(pg, 'Annuler la restauration');
        await attendre(pg, async () => ecrits.slice(nAvant2).some((e) => e.id === 'main') && ecrits.slice(nAvant2).some((e) => e.id === 'restore_1'), 10000);
        const ap2 = ecrits.slice(nAvant2);
        const m2 = ligne('main'), F2 = m2.vinted_annonce_numeros;
        dit(ap2.some((e) => /^restore_/.test(e.id) && e.data && e.data.raison === 'annulation'), `${T} 4. un point « avant l’annulation » est posé`);
        dit(F2.it1.buyPrice === 99 && F2.it12.buyPrice === 99 && F2.it20.buyPrice === 45 && !Object.keys(m2.vrm_notes_paires || {}).length, `${T} 4. annulée : 99 € et les notes effacées reviennent comme avant la restauration`, `${F2.it1.buyPrice}/${Object.keys(m2.vrm_notes_paires || {}).length}`);
        dit(F2.it7.numero === '7', `${T} 4. le N°7 rendu RESTE (un N° ne recule jamais)`);
        dit(typeof (ligne('restore_1') || {}).annulee === 'string', `${T} 4. le point de la restauration est marqué « annulée »`);
        dit(errs.length === 0, `${T} aucune erreur de page`, errs.join(' | ').slice(0, 200));
        await ctx.close();
      });

      await essaie(`${T} point impossible ⇒ rien écrit`, async () => {
        const { ctx, pg, errs, ecrits } = await preparer(b, vp, M, { pointKo: true });
        await ouvrirPanneau(pg);
        await attendre(pg, async () => (await pg.locator('[data-retour-point]').count()) > 0);
        await tap(pg, '[data-retour-voir="0"]');
        await pg.locator('[data-retour-apercu]').first().waitFor({ timeout: 8000 });
        await tap(pg, '[data-retour-conflits-choix="remettre"]');
        const n0 = ecrits.length;
        await tap(pg, '[data-retour-confirmer]');
        await confirmerFeuille(pg, 'Revenir en arrière');
        await pg.locator('[data-retour-fait]').first().waitFor({ timeout: 10000 });
        await pg.waitForTimeout(2500);
        dit(!ecrits.slice(n0).some((e) => e.id === 'main'), `${T} 5. le point n’a pas pu être posé (503) ⇒ RIEN écrit dans main`);
        dit((await pg.locator('[data-retour-fait]').first().getAttribute('data-retour-fait')) === 'echec' && /Rien n’a changé/.test(await pg.locator('[data-retour-fait]').first().innerText()), `${T} 5. l’écran dit « Rien n’a changé »`);
        await capture(pg, `retour-echec-${vp.width}`);
        dit((await pg.locator('[data-retour-reessayer]').count()) === 1 && /Réessaie/.test(await pg.locator('[data-retour-fait]').first().innerText()), `${T} 5. l’échec dit le geste (« Réessaie », bouton « Réessayer »)`);
        dit(errs.length === 0, `${T} aucune erreur de page`, errs.join(' | ').slice(0, 200));
        await ctx.close();
      });

      if (vp.width > 600 && !SANS_JOUR) await essaie(`${T} point du jour`, async () => {
        const { ctx, pg, ecrits } = await preparer(b, vp, M);
        await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
        await pg.locator('[data-reglage-revenir]').first().waitFor({ timeout: 15000 });
        const ok = await attendre(pg, async () => ecrits.some((e) => /^restore_/.test(e.id) && e.data && e.data.raison === 'jour'), 45000);
        const e = ecrits.find((x) => /^restore_/.test(x.id) && x.data && x.data.raison === 'jour');
        dit(ok && e.id === 'restore_1' && M.instantaneValide(e.data.snap), `${T} 6. le point du jour est posé (aucun aujourd’hui sur le serveur), dans l’emplacement libre`, e ? e.id : 'aucun');
        await ctx.close();
      });
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ revenir en arrière : ${ko} rouge(s).` : `\n✅ revenir en arrière : tout est vert`);
  process.exit(ko ? 1 : 0);
}
main();
