// Banc : LE STOCK EN ÉTAGÈRES (15 nov. 2026 ; récit : docs/passation/2026-11-15-stock-etageres.md)
//
// Julien : « le nombre de cases que l'on veut, des couleurs aux cases pour faire des
// étagères ; une pile de boîtes : si on enlève celle tout en bas, celles du dessus
// descendent toutes seules ; que les numéros soient bien attribués ».
// Données INVENTÉES (le dépôt est public) à la FORME mesurée en base (15 nov., lecture
// seule) : deux meubles d'hier (4×8 sans gravité ; 7×10 `gravite: false`, `planches: []`),
// une case prise ; + une pile d'hier (`gravite: true`) dont la case du bas porte un N° PAS
// MONTRÉ (aucune fiche : compte écarté), + 1 000 paires en ligne, + un N° en doublon.
// Il exige, au téléphone (390, tactile) et à l'ordinateur (1512), clair et sombre :
//   A l'ancien rangement repris tel quel (mêmes cases, même ordre), AUCUNE écriture au montage ;
//   B la case d'un N° pas montré est PRISE (jamais « + ») ; le doublon de N° est le seul rouge ;
//   C créer une étagère 4×3 couleur « sauge », sa rangée 1 peinte « ciel » (12 cases, 4 peintes) ;
//   D créer une pile de 5 ; y poser 3 paires (touchées en haut, elles tombent en bas) ;
//   E sortir celle du bas ⇒ les deux du dessus descendent d'un cran, c'est DIT, les N° restent ;
//   F dans la pile d'hier, retirer le haut ⇒ le N° pas montré garde sa case, personne ne passe au travers ;
//   G chercher un N° ⇒ sa case s'allume ; monter / descendre un meuble ;
//   H 44 px au doigt, aucune page plus large que l'écran, aucune erreur ; la dernière écriture
//     de `vrm_meubles` garde les champs d'origine des meubles d'hier.
//   BANC_PORT (6493), BANC_DIST (dist/), CAPTURES=dossier (captures à regarder), VARIANTES=390c,390s,1512c,1512s
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 6493;
const CAPT = process.env.CAPTURES || '';
const VARIANTES = (process.env.VARIANTES || '390c,1512s,390s,1512c').split(',');

const N = 1000;
const fiches = {}, enLigne = [];
for (let k = 1; k <= N; k++) {
  const id = String(900000 + k);
  fiches[id] = { numero: String(k), title: `Basket inventée ${k} taille ${36 + (k % 10)}`, accountId: '111' };
  enLigne.push({ id, title: fiches[id].title, is_closed: false, is_hidden: false, is_draft: false, price: { amount: String(30 + (k % 50)) + '.0' } });
}
// N°9999 : la fiche d'un compte MASQUÉ (222) — sa paire n'est pas montrée dans le Stock, son carton est dans la pile d'hier.
fiches['8009999'] = { numero: '9999', title: 'Basket d’un compte masqué', accountId: '222' };
const MAIN = {
  vinted_annonce_numeros: fiches,
  vinted_accounts_hidden: ['222'],
  vinted_used_numeros: Array.from({ length: N }, (_, k) => String(k + 1)),
  // La forme MESURÉE : deux meubles d'hier, une case prise (rangée 4, colonne 2 du 7×10).
  vrm_meubles: [{ id: 'mA', name: 'Garage', cols: 4, rows: 8 }, { id: 'mB', name: 'Bureau', cols: 7, rows: 10, gravite: false, planches: [] },
    { id: 'mQ', name: 'Pile hier', cols: 1, rows: 4, gravite: true }],
  vrm_slots: Object.assign({ '12': { m: 'mB', i: 22 }, '9999': { m: 'mQ', i: 3 }, '61': { m: 'mQ', i: 2 }, '62': { m: 'mQ', i: 1 } },
    Object.fromEntries(Array.from({ length: 30 }, (_, k) => [String(k + 20), { m: 'mA', i: k }]))),
  vrm_num_doublons: { nums: ['21'], at: Date.now() },
};
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d !== undefined && !c ? ' — ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400) : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
srv.listen(PORT);

async function rendre(b, tel, sombre) {
  const ctx = await b.newContext({ viewport: tel ? { width: 390, height: 844 } : { width: 1512, height: 950 }, ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}), colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = [], ecrits = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') {
      if (/app_data/.test(u) && (/id=eq\.main/.test(u) || /"id":"main"/.test(req.postData() || ''))) ecrits.push({ at: Date.now(), corps: req.postData() || '' });
      return j([]);
    }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j([{ id: 1, vinted_user_id: '111', login: 'compte_invente', domain: 'www.vinted.fr', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
    if (/id=eq\.main/.test(u)) return j([{ id: 'main', data: MAIN }]);
    if (/id=eq\.harvest_111_listings/.test(u)) return j([{ id: 'harvest_111_listings', data: { capturedAt: new Date().toISOString(), complet: true, payload: { items: enLigne } } }]);
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.addInitScript(([m, sombre]) => { try { localStorage.setItem('vrm_acces_direct', '1'); for (const k in m) localStorage.setItem(k, JSON.stringify(m[k])); localStorage.setItem('vinted_dark', JSON.stringify(!!sombre)); localStorage.setItem('vrm_meubles_zoom', 'loin'); } catch (_) {} }, [MAIN, sombre]);
  const t0 = Date.now();
  await pg.goto(`http://localhost:${PORT}/?tab=garage`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-meuble="mB"] [data-case-ici="mB:22"]', { timeout: 60000 }).catch(() => {});
  const tGrille = Date.now() - t0;
  await pg.waitForTimeout(1500);
  return { ctx, pg, errs, ecrits, tGrille };
}
const ou = (pg, n) => pg.evaluate((n) => { const el = document.querySelector(`[data-case-num="${n}"]`); return el ? el.getAttribute('data-case-ici') : null; }, n);
const bloque = (pg, sel) => pg.evaluate((sel) => { const b = document.querySelector(sel); if (!b) return 'absent'; b.scrollIntoView({ block: 'center' }); const q = b.getBoundingClientRect(); const e = document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2); return e ? (e.closest(sel) ? '' : (e.className || e.tagName) + '') : 'rien'; }, sel);
async function toucher(pg, sel) {
  try { await pg.click(sel, { timeout: 8000 }); return true; } catch (e) { console.log('    (toucher ' + sel + ' : ' + (await bloque(pg, sel)) + ')'); return false; }
}
// La fiche de la paire (ouverte par une case) : refermée pour revenir au Stock.
async function fermerFiche(pg) {
  for (let k = 0; k < 3; k++) {
    const f = await pg.$('[data-fiche-fermer]'); if (!f) return;
    try { await f.click({ timeout: 3000 }); } catch (_) { await pg.keyboard.press('Escape').catch(() => {}); }
    await pg.waitForTimeout(400);
  }
}
async function retirerCase(pg, n) {
  if (!(await toucher(pg, `[data-case-num="${n}"]`))) return false;
  await pg.waitForSelector('[data-fiche-retirer]', { timeout: 8000 }).catch(() => {});
  const ok = await toucher(pg, '[data-fiche-retirer]');
  await pg.waitForTimeout(500); await fermerFiche(pg); await pg.waitForTimeout(300);
  return ok;
}

(async () => {
  let b;
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : le scénario a tourné jusqu’au bout', String(e && e.message).slice(0, 300)); } };
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const v of VARIANTES) {
      const tel = v.startsWith('390'), sombre = v.endsWith('s'); const complet = v === '390c' || v === '1512s';
      const t = `${tel ? '390' : '1512'} ${sombre ? 'sombre' : 'clair'}`;
      await essaie(t, async () => {
        const r = await rendre(b, tel, sombre); const pg = r.pg;
        // ── A ──
        dit(await ou(pg, '12') === 'mB:22', `${t} · A : N°12 est dans SA case d'hier (Bureau, rangée 4, colonne 2)`, await ou(pg, '12'));
        const ordre = await pg.evaluate(() => [...document.querySelectorAll('[data-meuble]')].map((x) => x.getAttribute('data-meuble')).join(','));
        dit(ordre === 'mA,mB,mQ', `${t} · A : les meubles d'hier dans leur ordre`, ordre);
        const nCases = await pg.evaluate(() => document.querySelectorAll('.vrm-s2d-case').length);
        dit(nCases === 32 + 70 + 4, `${t} · A : toutes leurs cases dessinées (106)`, nCases);
        dit(r.ecrits.length === 0, `${t} · A : AUCUNE écriture de la ligne main au montage (reprise sans migration)`, r.ecrits.length);
        console.log(`    (1 000 paires : la grille est là en ${r.tGrille} ms)`);
        // ── B ──
        const notee = await pg.evaluate(() => { const c = document.querySelector('[data-case-notee="9999"]'); return c ? c.getAttribute('data-case-ici') + '|' + c.getAttribute('data-case-etat') + '|' + (c.textContent || '').trim() : null; });
        dit(notee === 'mQ:3|notee|N°9999', `${t} · B : la case d'un N° pas montré est PRISE (« N°9999 », jamais « + »)`, notee);
        const rouge = await pg.evaluate(() => { const c = document.querySelector('[data-case-num="21"]'); if (!c) return null; return { dbl: c.classList.contains('is-double'), sh: getComputedStyle(c).boxShadow }; });
        const estRouge = rouge && /rgb\((\d+), (\d+), (\d+)\)/.exec(rouge.sh); const rr = estRouge ? estRouge.slice(1).map(Number) : null;
        dit(!!(rouge && rouge.dbl && rr && rr[0] > 150 && rr[1] < 120 && rr[2] < 110), `${t} · B : la case du N° en doublon est rouge (le seul rouge)`, rouge);
        const autresRouges = await pg.evaluate(() => [...document.querySelectorAll('.vrm-s2d-case')].filter((c) => !c.classList.contains('is-double')).filter((c) => { const m = /rgb\((\d+), (\d+), (\d+)\)/.exec(getComputedStyle(c).boxShadow + ' ' + getComputedStyle(c).backgroundColor); if (!m) return false; const [x, y, z] = m.slice(1).map(Number); return x > 170 && y < 90 && z < 90; }).length);
        dit(autresRouges === 0, `${t} · B : aucune autre case rouge`, autresRouges);
        if (CAPT) { await pg.evaluate(() => { const m = document.querySelector('[data-meuble="mA"]'); if (m) m.scrollIntoView({ block: 'start' }); }); await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(CAPT, `etag-${v}-1-repris.png`), fullPage: false }); }
        if (!complet) {
          const x = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
          dit(x.sw <= x.cw + 1, `${t} · H : aucune page plus large que l'écran`, x);
          await pg.evaluate(() => { const s = document.querySelector('[data-meuble="mQ"]'); if (s) s.scrollIntoView({ block: 'center' }); });
          if (CAPT) await pg.screenshot({ path: path.join(CAPT, `etag-${v}-2-meubles.png`) });
          dit(r.errs.length === 0, `${t} · H : aucune erreur d'app`, r.errs.join(' | '));
          await r.ctx.close(); return;
        }
        // ── F : la pile d'hier, le haut retiré : le N° pas montré garde sa case ──
        await retirerCase(pg, '62');
        const hier = [await ou(pg, '61'), await pg.evaluate(() => { const c = document.querySelector('[data-case-notee="9999"]'); return c ? c.getAttribute('data-case-ici') : null; })];
        dit(hier[0] === 'mQ:2' && hier[1] === 'mQ:3', `${t} · F : N°61 reste posé sur le carton N°9999 (pas montré) : personne ne passe au travers`, hier);
        // ── C : une étagère 4×3, « sauge », rangée 1 « ciel » ──
        await toucher(pg, '[data-creer-meuble]');
        await pg.waitForSelector('[data-editeur-meuble]', { timeout: 8000 });
        const presse = await pg.getAttribute('[data-type-choix="etagere"]', 'aria-pressed');
        const dims = await pg.evaluate(() => [...document.querySelectorAll('[data-editeur-dim]')].map((x) => x.value).join('×'));
        dit(presse === 'true' && dims === '4×3', `${t} · C : un meuble neuf part d'une étagère 4×3`, `${presse} ${dims}`);
        await pg.fill('[data-editeur-nom]', 'Étagère test');
        await toucher(pg, '[data-couleur-choix="sauge"]');
        await pg.click('[data-editeur-peindre] > summary');
        await toucher(pg, '[data-pinceau="ciel"]');
        await toucher(pg, '[data-peindre-rang="1"]');
        if (CAPT) { await pg.evaluate(() => document.querySelector('[data-editeur-peindre]').scrollIntoView({ block: 'center' })); await pg.screenshot({ path: path.join(CAPT, `etag-${v}-3-editeur.png`) }); }
        // 44 px au doigt (390 tactile) ; à la souris, la touche du studio fait 40 (son contrat, studio.css). Le choix des
        // planches (ChoixPlanches, App.jsx, inchangé) dessine des boutons de 30 px à la souris : hors de ce lot, dit dans le récit.
        const mini = tel ? 43.5 : 39.5;
        const petits = await pg.evaluate((mini) => [...document.querySelectorAll('[data-editeur-meuble] button')].filter((x) => x.offsetParent && (mini > 40 || !x.closest('[data-editeur-planches]'))).map((x) => [x.getAttribute('aria-label') || x.textContent.trim().slice(0, 12), Math.round(x.getBoundingClientRect().width), Math.round(x.getBoundingClientRect().height)]).filter((q) => q[1] < mini || q[2] < mini), mini);
        dit(petits.length === 0, `${t} · H : chaque bouton de l'éditeur fait ${tel ? '44 px au doigt' : '40 px (touche du studio, souris)'} au moins`, petits);
        await toucher(pg, '[data-meuble-enregistrer]');
        await pg.waitForTimeout(900);
        const nouv = await pg.evaluate(() => { const s = [...document.querySelectorAll('[data-meuble]')].find((x) => x.querySelector('.vrm-s2d-nom') && x.querySelector('.vrm-s2d-nom').textContent === 'Étagère test'); if (!s) return null; const cs = [...s.querySelectorAll('.vrm-s2d-case')]; return { id: s.getAttribute('data-meuble'), coul: s.getAttribute('data-couleur'), type: s.getAttribute('data-meuble-type'), n: cs.length, ciel: cs.filter((c) => c.getAttribute('data-couleur') === 'ciel' && c.hasAttribute('data-couleur-propre')).map((c) => c.getAttribute('data-case-ici').split(':')[1]).join(','), sauge: cs.filter((c) => c.getAttribute('data-couleur') === 'sauge').length }; });
        if (CAPT && nouv) { await pg.evaluate((id) => document.querySelector(`[data-meuble="${id}"]`).scrollIntoView({ block: 'center' }), nouv.id); await pg.screenshot({ path: path.join(CAPT, `etag-${v}-3b-etagere.png`) }); }
        dit(!!nouv && nouv.coul === 'sauge' && nouv.type === 'etagere' && nouv.n === 12 && nouv.ciel === '0,1,2,3' && nouv.sauge === 8, `${t} · C : l'étagère 4×3 « sauge » est dessinée, sa rangée 1 en « ciel »`, nouv);
        // ── D : une pile de 5 ──
        await toucher(pg, '[data-creer-meuble]');
        await pg.waitForSelector('[data-editeur-meuble]', { timeout: 8000 });
        await toucher(pg, '[data-type-choix="pile"]');
        const dimsP = await pg.evaluate(() => [...document.querySelectorAll('[data-editeur-dim]')].map((x) => x.value).join('×'));
        dit(dimsP === '1×5', `${t} · D : « Pile » propose 1 × 5`, dimsP);
        await pg.fill('[data-editeur-nom]', 'Pile test');
        await toucher(pg, '[data-meuble-enregistrer]');
        await pg.waitForTimeout(900);
        const pid = await pg.evaluate(() => { const s = [...document.querySelectorAll('[data-meuble]')].find((x) => x.querySelector('.vrm-s2d-nom') && x.querySelector('.vrm-s2d-nom').textContent === 'Pile test'); return s ? s.getAttribute('data-meuble') + '|' + s.getAttribute('data-meuble-type') + '|' + s.querySelectorAll('.vrm-s2d-case').length : null; });
        dit(pid && /\|pile\|5$/.test(pid), `${t} · D : la pile de 5 est dessinée`, pid);
        const P = pid ? pid.split('|')[0] : 'x';
        const aRanger = await pg.evaluate(() => [...document.querySelectorAll('[data-a-ranger]')].slice(0, 3).map((x) => x.getAttribute('data-a-ranger')));
        for (const n of aRanger) {
          await toucher(pg, `[data-a-ranger="${n}"]`);
          await toucher(pg, `[data-case-ici="${P}:0"]`);   // touchée EN HAUT
          await pg.waitForTimeout(500);
        }
        const places = []; for (const n of aRanger) places.push(await ou(pg, n));
        dit(aRanger.length === 3 && places.join(',') === `${P}:4,${P}:3,${P}:2`, `${t} · D : trois paires touchées en haut de la pile tombent l'une sur l'autre (bas, puis dessus)`, { aRanger, places });
        if (CAPT) { await pg.evaluate((P) => document.querySelector(`[data-meuble="${P}"]`).scrollIntoView({ block: 'center' }), P); await pg.screenshot({ path: path.join(CAPT, `etag-${v}-4-pile.png`) }); }
        // ── E : sortir celle du bas ──
        const ok = await retirerCase(pg, aRanger[0]);
        await pg.waitForTimeout(600);
        const apres = [await ou(pg, aRanger[0]), await ou(pg, aRanger[1]), await ou(pg, aRanger[2])];
        dit(ok && apres[0] === null && apres[1] === `${P}:4` && apres[2] === `${P}:3`, `${t} · E : celle du bas sort ⇒ les deux du dessus descendent d'un cran`, apres);
        const desc = await pg.evaluate((P) => { const d = document.querySelector(`[data-meuble="${P}"] [data-descente]`); return d ? { cles: d.getAttribute('data-descente'), texte: d.textContent } : null; }, P);
        dit(!!desc && desc.cles === `${aRanger[1]},${aRanger[2]}` && desc.texte.includes('N°' + aRanger[1]) && desc.texte.includes('N°' + aRanger[2]), `${t} · E : c'est DIT sur la pile (« N°… et N°… sont descendus d'un cran »)`, desc);
        const fichesApres = await pg.evaluate(() => { try { const f = JSON.parse(localStorage.getItem('vinted_annonce_numeros')); return Object.values(f).filter((x) => x && x.numero).length; } catch (_) { return -1; } });
        dit(fichesApres === N + 1, `${t} · E : aucun N° touché (1 001 fiches, mêmes numéros)`, fichesApres);
        if (CAPT) { await pg.evaluate((P) => document.querySelector(`[data-meuble="${P}"]`).scrollIntoView({ block: 'center' }), P); await pg.screenshot({ path: path.join(CAPT, `etag-${v}-5-descente.png`) }); }
        // ── G : chercher un N°, réordonner ──
        await pg.fill('[data-stock-recherche] input', '12');
        await pg.waitForSelector('[data-stock-res="12"]', { timeout: 8000 }).catch(() => {});
        await toucher(pg, '[data-stock-res="12"]');
        await pg.waitForTimeout(500);
        const allume = await pg.evaluate(() => { const c = document.querySelector('[data-case-num="12"]'); return c ? (c.classList.contains('vrm-case-flash') || c.hasAttribute('data-case-vise')) : null; });
        dit(allume === true, `${t} · G : chercher « 12 » allume la case du N°12`, allume);
        if (CAPT) await pg.screenshot({ path: path.join(CAPT, `etag-${v}-6-recherche.png`) });
        await pg.waitForTimeout(4200);
        await toucher(pg, '[data-meuble-descendre="mA"]');
        await pg.waitForTimeout(500);
        const ordre2 = await pg.evaluate(() => [...document.querySelectorAll('[data-meuble]')].map((x) => x.getAttribute('data-meuble')).slice(0, 2).join(','));
        dit(ordre2 === 'mB,mA', `${t} · G : « Descendre » le Garage le met après le Bureau`, ordre2);
        const rondPetit = await pg.evaluate((mini) => [...document.querySelectorAll('[data-meuble-monter],[data-meuble-descendre],[data-meuble-modifier]')].map((x) => x.getBoundingClientRect()).filter((q) => q.width < mini || q.height < mini).length, tel ? 43.5 : 39.5);
        dit(rondPetit === 0, `${t} · H : monter / descendre / modifier font ${tel ? 44 : 40} px au moins`, rondPetit);
        // ── H ──
        await pg.waitForTimeout(1500);
        const garde = await pg.evaluate(() => { try { const l = JSON.parse(localStorage.getItem('vrm_meubles')); const b = l.find((m) => m.id === 'mB'); return b && b.gravite === false && Array.isArray(b.planches) && b.cols === 7 && b.rows === 10 && b.name === 'Bureau' && l.length === 5; } catch (_) { return false; } });
        dit(garde, `${t} · H : les meubles d'hier gardent leurs champs d'origine (Bureau 7×10, gravite:false, planches)`);
        const x = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        dit(x.sw <= x.cw + 1, `${t} · H : aucune page plus large que l'écran`, x);
        dit(r.errs.length === 0, `${t} · H : aucune erreur d'app`, r.errs.join(' | '));
        await r.ctx.close();
      });
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n${ko} échec(s)` : '\nTout est vert');
  process.exit(ko ? 1 : 0);
})();
