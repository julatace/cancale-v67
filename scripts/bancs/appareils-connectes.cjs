// ════════════════════════════════════════════════════════════════════════════
//  BANC — APPAREILS CONNECTÉS : LES NAVIGATEURS DE L'EXTENSION (23 nov., lot appareils-connectes). Données INVENTÉES.
//  Le VRAI composant monté seul (outils/appareils-connectes), sur une fausse base à DEUX vendeurs, 390 tactile et 1512 :
//   A1 trois navigateurs (les siens), le plus récent d'abord ; rien de l'autre vendeur (Edge) ;
//   A2 la lecture demandée porte `owner=eq.` et une projection scalaire (jamais `select=data`) ;
//   A3 « Active » seulement vue < 24 h ; version et date illisibles : pas affichées (« date pas lue ») ;
//   A4 « pas su » (?base=passu) : la phrase et « Réessayer », jamais « aucun » ; rien ne déborde, ni NaN.
//  Doit être ROUGE sur le code d'avant (le composant n'existe pas).
//  Lancer : node scripts/bancs/appareils-connectes.cjs  (SHOTS=dossier pour les captures, à REGARDER)
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const { lancer, REGLES_PAGE } = require('./_harnais-lots.cjs');
lancer({ lot: 'appareils-connectes', url: '/?base=lu', parcours: async (pg, { W, th, SHOTS, dit }) => {
  await pg.waitForSelector('[data-ext-navigateurs]:not([data-ext-navigateurs="lecture"])', { timeout: 15000 });
  const a = await pg.evaluate(() => ({ n: document.querySelector('[data-ext-navigateurs]').getAttribute('data-ext-navigateurs'),
    l: [...document.querySelectorAll('[data-ext-navigateur]')].map((x) => ({ id: x.getAttribute('data-ext-navigateur'), act: x.getAttribute('data-ext-active'), t: x.innerText })), q: window.__Q.slice() }));
  dit(a.n === '3' && a.l.map((x) => x.id).join() === 'aa1,bb2,cc3' && !a.l.some((x) => /Edge/.test(x.t)), `A1 ${W} ${th} : ses trois navigateurs, le plus récent d’abord, rien de l’autre vendeur`, a.l);
  dit(a.q.length && a.q.every((q) => /(^|&)owner=eq\./.test(q) && !/select=[^&]*(^|,)data(,|&|$)/.test(q)), `A2 ${W} ${th} : \`owner=eq.\`, projection scalaire`, a.q);
  dit(a.l[0].act === '1' && /Active/.test(a.l[0].t) && a.l[1].act === '0' && a.l[2].act === '' && /date pas lue/.test(a.l[2].t) && !/version/.test(a.l[2].t), `A3 ${W} ${th} : « Active » < 24 h ; illisible : rien d’inventé`, a.l);
  const r = await pg.evaluate(REGLES_PAGE, null);
  dit(!r.deborde && !r.nan, `A4 ${W} ${th} : rien ne déborde, aucun NaN`, r);
  await pg.screenshot({ path: path.join(SHOTS, `navigateurs-${W}-${th}.png`), fullPage: true });
  await pg.goto(pg.url().replace('base=lu', 'base=passu')); await pg.waitForSelector('[data-ext-navigateurs="pas-su"]', { timeout: 10000 }).catch(() => {});
  const p = await pg.evaluate(() => ({ e: !!document.querySelector('[data-ext-navigateurs-erreur]'), b: [...document.querySelectorAll('button')].some((b) => /Réessayer/.test(b.textContent)), aucun: /Aucun navigateur/.test(document.body.innerText) }));
  dit(p.e && p.b && !p.aucun, `A4b ${W} ${th} : pas su ⇒ la phrase et « Réessayer », jamais « aucun »`, p);
} });
