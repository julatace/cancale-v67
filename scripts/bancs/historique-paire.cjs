// ════════════════════════════════════════════════════════════════════════════
//  BANC — L'HISTORIQUE DE LA PAIRE : « RANGÉE DANS LE STOCK » (23 nov., lot historique-paire). Données INVENTÉES.
//  Le VRAI composant (LigneDeTemps) monté seul (outils/historique-paire), 390 tactile et 1512, clair et sombre :
//   R1 la paire N°12 : « Rangée » (data-lt-quoi="rangee") à SA date (caseAt), entre « Numérotée » et la publication ;
//   R2 une case du Stock sans fiche datée (?cas=slot) : « Rangée » sous « Date inconnue », jamais une date ;
//   R3 fiches pas lues (?cas=passu) : « Pas encore lu : … la case du Stock » ; deux fiches sous le N° (?cas=double) : rien ;
//   R4 la page ne déborde pas, ni NaN. Doit être ROUGE sur le code d'avant (aucun événement « rangee »).
//  Lancer : node scripts/bancs/historique-paire.cjs  (SHOTS=dossier pour les captures, à REGARDER)
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const { lancer, REGLES_PAGE } = require('./_harnais-lots.cjs');
const lire = (pg) => pg.evaluate(() => ({
  ordre: [...document.querySelectorAll('.vrm-lt-liste:not(.is-sans-date) [data-lt-quoi]')].map((x) => x.getAttribute('data-lt-quoi')),
  date: (document.querySelector('.vrm-lt-liste:not(.is-sans-date) [data-lt-quoi="rangee"]') || { getAttribute: () => '' }).getAttribute('data-lt-date'),
  sansDate: [...document.querySelectorAll('[data-lt-groupe="sans-date"] [data-lt-quoi]')].map((x) => x.getAttribute('data-lt-quoi')),
  pasSu: (document.querySelector('[data-lt-pas-su]') || { getAttribute: () => '' }).getAttribute('data-lt-pas-su'),
}));
lancer({ lot: 'historique-paire', url: '/?cas=date', parcours: async (pg, { W, th, SHOTS, dit }) => {
  await pg.waitForSelector('[data-ligne-temps]', { timeout: 15000 });
  const a = await lire(pg);
  const i = a.ordre.indexOf('rangee');
  dit(i > 0 && a.ordre[i - 1] === 'numerotee' && a.ordre[i + 1] === 'publiee' && a.date === '2026-10-04T16:20:00.000Z', `R1 ${W} ${th} : « Rangée » à SA date, entre « Numérotée » et la publication`, a);
  const r = await pg.evaluate(REGLES_PAGE, null);
  dit(!r.deborde && !r.nan, `R4 ${W} ${th} : rien ne déborde, aucun NaN`, r);
  await pg.screenshot({ path: path.join(SHOTS, `historique-rangee-${W}-${th}.png`), fullPage: true });
  const base = pg.url().replace(/cas=date/, '');
  await pg.goto(base.replace('?', '?cas=slot&')); await pg.waitForSelector('[data-ligne-temps]');
  const b = await lire(pg);
  dit(!b.ordre.includes('rangee') && b.sansDate.includes('rangee'), `R2 ${W} ${th} : case du Stock sans date ⇒ « Date inconnue »`, b);
  await pg.goto(base.replace('?', '?cas=passu&')); await pg.waitForSelector('[data-ligne-temps]');
  const c = await lire(pg);
  dit(!c.ordre.includes('rangee') && /rangement/.test(c.pasSu || ''), `R3 ${W} ${th} : fiches pas lues ⇒ nommé`, c);
  await pg.goto(base.replace('?', '?cas=double&')); await pg.waitForSelector('[data-ligne-temps]');
  const d = await lire(pg);
  dit(!d.ordre.includes('rangee') && !d.sansDate.includes('rangee'), `R3b ${W} ${th} : deux fiches sous le N° ⇒ aucune « Rangée »`, d);
} });
