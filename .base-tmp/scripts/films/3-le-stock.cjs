// FILM 3 — « Le Stock » (Julien : un motion design pour expliquer le Stock à qui
// découvre) : chaque paire a sa case → une paire arrive, on la range → vendue,
// sa case s'allume → le colis part, la case se libère toute seule.
// Tourné dans la VRAIE app (dist/), données inventées (_monde.cjs). Le colis de
// N°24 est déjà parti dans la base servie (« en cours d'acheminement ») : c'est
// l'app qui a libéré sa case et le dit (« Cases libérées toutes seules »).
//   FILMS_SORTIE=/dossier node scripts/films/3-le-stock.cjs   (FORMATS=portrait,paysage)
'use strict';
const { tourner } = require('./_commun.cjs');
const { monde } = require('./_monde.cjs');

async function scenario(f) {
  const P = f.format === 'portrait';
  f.telY = f.F.h; f.telOpacite = 0;
  f.titre('Ton stock, comme chez toi.', { sous: 'Tes meubles, tes étagères, une case par paire.', duree: 3.4 });
  await f.jouer(0.5);
  await f.entree(1.2);
  await f.jouer(0.4); f.cle('ouverture');
  // Les étagères.
  await f.defilerVers('[data-meuble="m1"]', { marge: 70, dur: 1.2 });
  f.titre('Chaque paire a *sa* case.', { sous: 'Son N° dessus : tu la trouves sans chercher.', duree: 3.6 });
  await f.viser('[data-meuble="m1"]', { zoom: P ? 1.32 : 1.0, dur: 1.1 });
  await f.jouer(2.0); f.cle('etagere');
  // Une paire arrive : la toucher, puis une case vide.
  f.titre('Une paire arrive ?', { sous: 'Touche-la, puis une case libre.', duree: 7.0 });
  f.repos_(0.8);
  await f.defilerVers('texte:À ranger', { marge: 40, dur: 1.0 });
  await f.toucher('button[aria-label^="Ranger l’article N°12"]', { viser: { zoom: P ? 1.35 : 1.0, dur: 0.8 }, apres: 0.3 });
  await f.defilerVers('[data-meuble="m2"]', { marge: 120, dur: 0.9 });
  await f.viser('[data-meuble="m2"]', { zoom: P ? 1.35 : 1.0, dur: 0.8 });
  await f.toucher('[data-case-ici="m2:4"]', { apres: 0.7 });
  await f.viser('[data-case-ici="m2:4"]', { zoom: P ? 1.75 : 1.12, zmax: 1.75, dur: 0.9 });
  await f.jouer(0.3); f.cle('rangee');
  await f.jouer(0.4);
  // Vendue : sa case s'allume.
  f.titre('Vendue : sa case *s’allume*.', { sous: 'Tu sais où la prendre pour le colis.', duree: 3.8 });
  await f.viser('[data-case-num="23"]', { zoom: P ? 1.75 : 1.3, zmax: 1.75, dur: 1.1 });
  await f.jouer(2.4); f.cle('allumee');
  // Le colis part : la case se libère toute seule.
  f.repos_(0.6); await f.jouer(0.5);
  f.titre('Le colis part :', { sous: 'sa case se libère toute seule.', duree: 6.2 });
  await f.defilerVers('[data-stock-sortis-meubles]', { marge: 90, dur: 1.0 });
  await f.viser('[data-stock-sortis-meubles]', { zoom: P ? 1.38 : 1.05, dur: 1.0 });
  await f.jouer(1.6); f.cle('liberee');
  // La case vide, à sa place sur l'étagère.
  await f.defilerVers('[data-meuble="m1"]', { marge: 70, dur: 1.0 });
  await f.viser('[data-case-ici="m1:11"]', { zoom: P ? 1.6 : 1.12, zmax: 1.6, dur: 0.9 });
  await f.jouer(1.2);
  f.repos_(0.8); await f.jouer(0.4);
  await f.fin('Le Stock : chaque paire à sa place.', 3.0);
}

if (require.main === module) {
  // Annonces d'abord (hors tournage) : c'est l'écran qui publie les preuves de vente que le Stock lit.
  tourner('le-stock', scenario, { formats: ['portrait', 'paysage'], monde: () => monde({ partis: ['81002'] }), tab: ['annonces', 'garage'] })
    .catch((e) => { console.error(e); process.exitCode = 1; });
}
module.exports = { scenario };
