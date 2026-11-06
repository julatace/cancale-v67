// FILM 4 — « Plusieurs comptes, un seul endroit » : le sélecteur à logos
// (Vinted, Leboncoin, eBay, Vestiaire), les ventes de tous les comptes, chacune
// avec son compte, puis Compta → « À recopier sur l'URSSAF » → Copier.
// Tourné dans la VRAIE app (dist/), données inventées (_monde.cjs).
//   FILMS_SORTIE=/dossier node scripts/films/4-plusieurs-comptes.cjs   (FORMATS=portrait,paysage)
'use strict';
const { tourner } = require('./_commun.cjs');
const { monde } = require('./_monde.cjs');

async function scenario(f) {
  const P = f.format === 'portrait';
  f.telY = f.F.h; f.telOpacite = 0;
  f.titre('Vinted, Leboncoin, eBay, Vestiaire.', { sous: 'Tous tes comptes, un seul endroit.', duree: 3.4 });
  await f.jouer(0.5);
  await f.entree(1.2);
  await f.jouer(1.0); f.cle('ouverture');
  // Le sélecteur à logos.
  f.titre('Un site d’un geste.', { duree: 3.6 });
  await f.viser('[data-site="toutes"]', { zoom: P ? 1.5 : 1.1, dur: 1.0, dx: 120 });
  await f.jouer(0.3);
  await f.toucher('[data-site="leboncoin"]', { apres: 0.7 });
  await f.toucher('[data-site="ebay"]', { apres: 0.7 }); f.cle('logos');
  await f.toucher('[data-site="toutes"]', { apres: 0.4 });
  // Chaque vente dit son compte.
  f.titre('Chaque vente dit *son* compte.', { sous: 'Trois comptes Vinted, Leboncoin, eBay : une liste.', duree: 4.2 });
  f.repos_(0.8);
  await f.defilerVers('texte:À venir', { marge: 30, dur: 1.0 });
  await f.viser('texte:À venir', { zoom: P ? 1.3 : 1.0, dur: 1.0, dy: 230 });
  await f.jouer(2.2); f.cle('ventes');
  // Compta : le chiffre à recopier.
  f.repos_(0.7); await f.jouer(0.3);
  await f.toucher('.vrm-nav-more', { apres: 0.35 });
  await f.toucher('.vrm-plus-tuile[data-nav-entree="compta"]', { apres: 0.5 });
  await f.attendreQue('[data-prevision-carte="lu"]', 4);
  f.titre('Le chiffre à recopier sur l’URSSAF.', { sous: 'Daté au jour du versement, tous sites compris.', duree: 4.8 });
  await f.defilerVers('[data-prevision-carte]', { marge: 30, dur: 1.0 });
  await f.viser('[data-prevision-carte]', { zoom: P ? 1.3 : 1.0, dur: 1.0, dy: -40 });
  await f.jouer(1.0);
  await f.toucher('texte:Copier', { avant: 0.4, apres: 0.9 }); f.cle('urssaf');
  await f.jouer(0.8);
  f.repos_(0.8); await f.jouer(0.3);
  await f.fin('Tous tes comptes, un seul endroit.', 3.0);
}

if (require.main === module) {
  // Ventes · Vinted d'abord (hors tournage) : c'est l'écran qui publie le CA daté au versement.
  tourner('plusieurs-comptes', scenario, { formats: ['portrait', 'paysage'], monde, tab: ['cat_ventes', 'ventes'] })
    .catch((e) => { console.error(e); process.exitCode = 1; });
}
module.exports = { scenario };
