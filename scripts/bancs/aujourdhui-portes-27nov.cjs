require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Banc : TROIS PORTES SUR AUJOURD'HUI (27 nov., Julien : « Vas-y fais tout »). L'app RENDUE (dist/), la base INVENTÉE du
//  banc aujourdhui-moins-texte (ses captures iPhone : un compte, l'ordinateur éteint depuis 07:37), plus :
//   2  BÉNÉFICE « — »  — aucune vente n'a de prix d'achat (la base n'en pose aucun) : le « — » du bénéfice dit COMBIEN de prix
//                        manquent (`data-pil-prix-manquants` = le nombre de ventes de la fenêtre sans prix, `data-v2-prix-manquants`
//                        sur la tuile) et c'est LA porte : la toucher ouvre la saisie en série (`data-v2-prix-achat-serie`… ou
//                        l'écran qui la porte) ; le nombre rendu = celui publié (`vrm_benefice_jours`), jamais un autre ;
//   3  LECTURE ANCIENNE — les lectures du compte datent de 5 jours (`capturedAt`) : UNE ligne « Vinted pas lu depuis 5 jours »,
//                        le geste dessous, « Pourquoi ? » replié, « Compris » ≥ 44 px la range ; rechargée : toujours rangée ; le
//                        compte relu puis vieux de 6 jours (autre lecture) : elle revient (§2.10 — jamais une carte récurrente) ;
//   4  ORDINATEUR ÉTEINT — « Ordinateur éteint · 07:37 » : UNE phrase visible de 8 mots au plus, « Pourquoi ? » replié qui dit ce
//                        qui ne marche pas (À distance, lecture de Vinted) et quoi faire (le navigateur où est l'extension).
//  Jugé sur les data-* et les nombres rendus. 390 tactile et 1512, clair et sombre. `SHOTS=dossier` (captures à regarder),
//  `BANC_DIST` (l'AVANT : rouge attendu).
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.TZ = 'Europe/Paris';
const path = require('path'), fs = require('fs'), os = require('os');
const P = require('./design-passe.cjs');
const { baseCapture, ouvrir } = require('./aujourdhui-moins-texte.cjs');
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-aujourdhui-portes');
fs.mkdirSync(SHOTS, { recursive: true });
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 700) : '')); } return c; };
const J = 864e5;
// Les dates de lecture, FIXES pour tout le banc : la dernière lecture du compte (5 j) et une AUTRE lecture (6 j).
const T5 = Date.now() - 5 * J - 3600e3, T6 = T5 - J;
const vieillir = (b, t) => { for (const r of b.rows) if (new RegExp(`^harvest_${b.attendu.uid}_`).test(r.id) && r.data) r.data.capturedAt = new Date(t).toISOString(); };

const RELEVE = () => {
  const vu = (e) => !!e && e.getClientRects().length > 0 && e.getBoundingClientRect().width > 1;
  const h = (e) => (e ? Math.round(e.getBoundingClientRect().height) : 0);
  const mots = (e) => (e && e.innerText || '').trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const pil = document.querySelector('[data-pil-prix-manquants]');
  const porte = pil ? pil.querySelector('[data-heros-porte]') : null;
  const tuile = document.querySelector('[data-v2-prix-manquants]');
  const la = document.querySelector('[data-lecture-ancienne]');
  const ord = document.querySelector('[data-adist-jour="eteint"]');
  const rg = ord ? ord.querySelector('[data-adist-jour-rangee]') : null;
  const sous = rg ? rg.querySelector('.n-rangee-sous') : null;
  const pq = ord ? ord.querySelector('details[data-adist-jour-pourquoi]') : null;
  let pub = null; try { pub = JSON.parse(localStorage.getItem('vrm_benefice_jours') || 'null'); } catch (_) {}
  return {
    prix: pil ? { n: pil.getAttribute('data-pil-prix-manquants'), texte: (porte || pil).innerText.replace(/\s+/g, ' '), porte: !!porte, hPorte: h(porte) } : null,
    tuile: tuile ? { n: tuile.getAttribute('data-v2-prix-manquants'), porte: tuile.getAttribute('data-v2-porte'), texte: tuile.innerText.replace(/\s+/g, ' ') } : null,
    lecture: la ? { cle: la.getAttribute('data-lecture-ancienne'), jours: la.getAttribute('data-lecture-ancienne-jours'), vu: vu(la), titre: (la.querySelector('.n-rangee-titre') || {}).innerText || '', sous: (la.querySelector('.n-rangee-sous') || {}).innerText || '',
      pourquoi: !!la.querySelector('details[data-lecture-ancienne-pourquoi]:not([open])'), hCompris: h(la.querySelector('[data-lecture-ancienne-compris]')) } : null,
    nLecture: document.querySelectorAll('[data-lecture-ancienne]').length,
    ordi: ord ? { titre: (rg.querySelector('.n-rangee-titre') || {}).innerText || '', sous: sous ? sous.innerText : '', motsSous: mots(sous), sousVu: vu(sous), pourquoi: !!pq, ferme: !!pq && !pq.open,
      manque: pq ? (pq.querySelector('[data-adist-pourquoi="manque"]') || {}).textContent || '' : '', geste: pq ? (pq.querySelector('[data-adist-pourquoi="geste"]') || {}).textContent || '' : '',
      hSummary: pq ? h(pq.querySelector('summary')) : 0 } : null,
    pubOk: !!pub,
  };
};

(async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    for (const W of [390, 1512]) for (const th of ['clair', 'sombre']) {
      const nom = `${W}-${th}`;
      console.log(`\n▶ ${nom}`);
      const b = baseCapture(); vieillir(b, T5);
      const { ctx, pg, erreurs } = await ouvrir(nav, { W, sombre: th === 'sombre', style: '', b });
      await pg.waitForFunction(() => !!document.querySelector('[data-lecture-ancienne]'), null, { timeout: 30000 }).catch(() => {});
      const r = await pg.evaluate(RELEVE);
      if (process.env.SONDE) console.log(JSON.stringify(r, null, 1));
      // 2. Bénéfice « — » : N prix manquants, la porte.
      const n = r.prix ? Number(r.prix.n) : NaN;
      dit(r.prix && n > 0 && r.prix.texte.includes(String(n)) && r.prix.porte, `${nom} : 2 le bénéfice « — » dit « ${n} prix manquants » et c'est un bouton (la porte)`, r.prix);
      dit(!r.prix || W >= 600 || r.prix.hPorte >= 44, `${nom} : 2 la porte fait 44 px au doigt`, r.prix);
      // 3. Lecture ancienne.
      dit(r.nLecture === 1 && r.lecture && r.lecture.vu && r.lecture.jours === '5' && /5/.test(r.lecture.titre), `${nom} : 3 UNE ligne « Vinted pas lu depuis 5 jours »`, r.lecture);
      dit(r.lecture && r.lecture.sous.length > 0 && r.lecture.pourquoi && r.lecture.hCompris >= 44, `${nom} : 3 le geste dessous, « Pourquoi ? » replié, « Compris » ≥ 44 px`, r.lecture);
      // 4. Ordinateur éteint.
      dit(r.ordi && r.ordi.sousVu && r.ordi.motsSous > 0 && r.ordi.motsSous <= 8, `${nom} : 4 « ${r.ordi && r.ordi.titre} » : UNE phrase visible de 8 mots au plus`, r.ordi);
      dit(r.ordi && r.ordi.pourquoi && r.ordi.ferme && /Vinted/.test(r.ordi.manque) && /À distance/.test(r.ordi.manque) && /extension VRM/.test(r.ordi.geste) && r.ordi.hSummary >= 44,
        `${nom} : 4 « Pourquoi ? » replié dit ce qui ne marche pas (À distance, Vinted) et quoi faire (le navigateur de l'extension)`, r.ordi);
      await pg.screenshot({ path: path.join(SHOTS, `portes-${nom}.png`), fullPage: false }).catch(() => {});
      for (const [sel, q] of [['[data-lecture-ancienne]', 'lecture'], ['[data-pil-prix-manquants]', 'prix']]) {
        const el = await pg.$(sel); if (!el) continue;
        await el.evaluate((e) => e.scrollIntoView({ block: 'center' })).catch(() => {}); await pg.waitForTimeout(300);
        await pg.screenshot({ path: path.join(SHOTS, `portes-${nom}-${q}.png`), fullPage: false }).catch(() => {});
      }
      // 2. Toucher la porte ouvre la saisie (l'écran change, ou la saisie s'ouvre).
      if (th === 'clair') {
        const avant = await pg.evaluate(() => location.search + '|' + (document.querySelector('[data-v2-ecran]') || { getAttribute: () => '' }).getAttribute('data-v2-ecran'));
        const p = pg.locator('[data-pil-prix-manquants] [data-heros-porte]').first();
        if (await p.count()) { await p.click().catch(() => {}); await pg.waitForTimeout(2500); }
        const apres = await pg.evaluate(() => location.search + '|' + (document.querySelector('[data-v2-ecran]') || { getAttribute: () => '' }).getAttribute('data-v2-ecran') + '|' + !!document.querySelector('[data-cout-serie], [data-saisie-serie], [data-prix-achat-serie], .vrm-cout-serie'));
        dit(apres !== avant, `${nom} : 2 toucher « N prix manquants » ouvre la saisie des prix`, { avant, apres });
        await pg.screenshot({ path: path.join(SHOTS, `portes-${nom}-saisie.png`), fullPage: false }).catch(() => {});
        // 3. « Compris » range ; rechargée : toujours rangée ; relu puis vieux de 6 jours : revient.
        await pg.goto(pg.url().replace(/\?.*$/, '') + '?tab=journee', { waitUntil: 'domcontentloaded' });
        await pg.waitForFunction(() => !!document.querySelector('[data-lecture-ancienne-compris]'), null, { timeout: 30000 }).catch(() => {});
        await pg.locator('[data-lecture-ancienne-compris]').first().click().catch(() => {});
        await pg.waitForTimeout(800);
        dit(await pg.evaluate(() => !document.querySelector('[data-lecture-ancienne]')), `${nom} : 3 « Compris » la range`);
        await pg.reload({ waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-adist-jour]', { timeout: 30000 }).catch(() => {});
        await pg.waitForTimeout(9000);
        dit(await pg.evaluate(() => !document.querySelector('[data-lecture-ancienne]')), `${nom} : 3 rechargée, la même situation : toujours rangée (pas de carte récurrente)`);
        // La situation change : une AUTRE lecture (6 jours) sur un appareil où « Compris » rangeait celle de 5 jours (la copie des
        // lectures de l'appareil ne sait pas reculer dans le temps : un contexte neuf, le rangement posé tel que « Compris » l'écrit).
        const rangee = await pg.evaluate(() => localStorage.getItem('vrm_lecture_ancienne_rangee'));
        dit(rangee === JSON.stringify({ [`vinted:${b.attendu.uid}`]: T5 }), `${nom} : 3 « Compris » range CE compte à CETTE lecture`, rangee);
        for (const [t, attendu, quoi] of [[T6, '6', 'une autre lecture (6 jours) : la ligne revient'], [T5, null, 'la même lecture : toujours rangée']]) {
          const b2 = baseCapture(); vieillir(b2, t);
          const o = await ouvrir(nav, { W, sombre: false, style: '', b: b2 });
          await o.pg.evaluate((v) => { localStorage.setItem('vrm_lecture_ancienne_rangee', v); }, rangee || '{}');
          await o.pg.reload({ waitUntil: 'domcontentloaded' });
          await o.pg.waitForSelector('[data-adist-jour]', { timeout: 30000 }).catch(() => {});
          const vu = await o.pg.waitForFunction(() => { const e = document.querySelector('[data-lecture-ancienne]'); return e ? e.getAttribute('data-lecture-ancienne-jours') : null; }, null, { timeout: attendu ? 30000 : 12000 }).then((x) => x.jsonValue()).catch(() => null);
          dit(vu === attendu, `${nom} : 3 ${quoi}`, vu);
          await o.ctx.close();
        }
      }
      dit(!erreurs.length, `${nom} : aucune erreur de page`, erreurs.slice(0, 3));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a rencontré une erreur', String(e && e.stack || e)); }
  await nav.close(); P.srv.close();
  console.log(`\n${ok} vert(s), ${ko} rouge(s) — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
