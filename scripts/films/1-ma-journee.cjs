// FILM 1 — « Ma journée » : on ouvre l'app → les gestes du jour → un colis à
// envoyer → le N° contrôlé → le bordereau tamponné de son N°, imprimé.
// Tourné dans la VRAIE app (dist/), données inventées (_monde.cjs).
//   FILMS_SORTIE=/dossier node scripts/films/1-ma-journee.cjs   (FORMATS=portrait,paysage)
'use strict';
const { tourner } = require('./_commun.cjs');
const { monde } = require('./_monde.cjs');

async function scenario(f) {
  const P = f.format === 'portrait';
  f.telY = f.F.h; f.telOpacite = 0;
  f.titre('Ta journée de revendeur.', { sous: 'Tous tes comptes, une seule page.', duree: 3.1 });
  await f.jouer(0.5);
  await f.entree(1.2);
  await f.jouer(0.9); f.cle('ouverture');
  await f.jouer(0.5);
  // Ce qui s'est passé : vendu, bénéfice, reçu.
  f.titre('Ce que tu as *vendu*, ce que tu as gagné.', { duree: 3.2 });
  await f.viser('[data-fu-case="vendu-mois"]', { zoom: P ? 1.45 : 1.0, dur: 1.2, dy: -70 });
  await f.jouer(2.2); f.cle('chiffres');
  // Puis ce qu'il reste à faire, dans l'ordre.
  f.titre('Puis ce qu’il reste à faire.', { sous: 'Dans l’ordre, un geste par ligne.', duree: 3.4 });
  f.repos_(1.0);
  await f.defilerVers('[data-tuile="envoyer"]', { marge: 210, dur: 1.1 });
  await f.viser('[data-tuile="retirer"]', { zoom: P ? 1.3 : 0.95, dur: 1.0 });
  await f.jouer(1.6); f.cle('a-faire');
  // Un toucher : « 2 colis à envoyer ».
  await f.viser('[data-tuile="envoyer"]', { zoom: P ? 1.5 : 1.1, dur: 0.7 });
  await f.jouer(0.3);
  await f.toucher('[data-tuile="envoyer"]');
  await f.attendreQue('[data-lot-imprimer]', 3);
  f.titre('Deux colis à envoyer ce matin.', { duree: 2.4 });
  f.repos_(0.9);
  await f.jouer(1.8);
  // Le N° et la photo, comparés à la paire.
  f.titre('Le N° et la photo, contre la vraie paire.', { sous: 'Jamais la mauvaise chaussure dans le carton.', duree: 4.4 });
  await f.defilerVers('input[aria-label^="Article contrôlé : New"]', { marge: 430, dur: 0.8 });
  await f.viser('input[aria-label^="Article contrôlé : Asics"]', { zoom: P ? 1.55 : 1.15, dur: 1.0, dx: -110, dy: 20 });
  await f.jouer(0.4);
  await f.toucher('input[aria-label^="Article contrôlé : Asics"]', { avant: 0.32, apres: 0.35 });
  await f.toucher('input[aria-label^="Article contrôlé : New"]', { avant: 0.32, apres: 0.5 });
  await f.jouer(0.6); f.cle('controle');
  f.repos_(0.8); await f.jouer(0.5);
  await f.toucher('[data-lot-imprimer]', { avant: 0.36, apres: 0.2 });
  // Le bordereau, avec son N° tamponné (rendu par l'app, pdf.js).
  await f.attendreQue('[data-placeur-tampon="pret"]', 8);
  f.titre('Son N° est tamponné sur le bordereau.', { duree: 3.6 });
  await f.jouer(0.4);
  await f.viser('[data-tampon-scene]', { zoom: P ? 1.9 : 1.4, dur: 1.3, part: [0.05, 0.02, 0.85, 0.42] });
  await f.jouer(1.9); f.cle('tampon');
  f.repos_(0.9);
  await f.jouer(0.5);
  await f.toucher('[data-tampon-imprimer]', { avant: 0.4, apres: 0.5 });
  f.titre('Imprimé. Prêt à déposer.', { duree: 2.0 });
  await f.jouer(1.9);
  await f.fin('Ta journée de revente, en une page.', 3.0);
}

if (require.main === module) {
  tourner('ma-journee', scenario, { formats: ['portrait', 'paysage'], monde, tab: 'journee' })
    .catch((e) => { console.error(e); process.exitCode = 1; });
}
module.exports = { scenario };
