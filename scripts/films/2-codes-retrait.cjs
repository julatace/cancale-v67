// FILM 2 — « Les codes de retrait » : Colis → À retirer → un point relais =
// une carte → le code → « En grand », au comptoir.
// Tourné dans la VRAIE app (dist/), données inventées (_monde.cjs).
//   FILMS_SORTIE=/dossier node scripts/films/2-codes-retrait.cjs   (FORMATS=portrait,paysage)
'use strict';
const { tourner } = require('./_commun.cjs');
const { monde } = require('./_monde.cjs');

async function scenario(f) {
  const P = f.format === 'portrait';
  f.telY = f.F.h; f.telOpacite = 0;
  f.titre('Trois colis t’attendent.', { sous: 'Où, avec quel code : sans fouiller tes messages.', duree: 3.4 });
  await f.jouer(0.5);
  await f.entree(1.2);
  await f.jouer(0.6); f.cle('ouverture');
  await f.toucher('[data-colis-onglet-choix="retirer"]', { viser: { zoom: P ? 1.38 : 1.05, dur: 0.8 } });
  await f.jouer(0.5); f.cle('a-retirer');
  // Un point relais = une carte.
  f.titre('Un point relais, *une* carte.', { sous: 'Tous ses colis dedans, Vinted ou pas.', duree: 4.0 });
  f.repos_(0.8);
  await f.defilerVers('texte:Prêts à retirer', { marge: 40, dur: 1.1 });
  await f.viser('texte:Relais du Marché', { zoom: P ? 1.3 : 1.0, dur: 1.0, dy: 120 });
  await f.jouer(2.0); f.cle('carte');
  // Le code.
  f.titre('Le code, d’un geste.', { duree: 3.0 });
  await f.toucher('1@[data-rp-code]', { avant: 0.36, apres: 0.6 });
  await f.viser('[data-colis-plein-ecran]', { zoom: P ? 1.38 : 1.1, dur: 0.9 });
  await f.jouer(1.2); f.cle('code');
  // En grand.
  f.titre('En grand, au comptoir.', { sous: 'Le code se lit de loin, l’écran reste allumé.', duree: 4.2 });
  await f.toucher('[data-colis-plein-ecran]', { avant: 0.36, apres: 0.3 });
  f.repos_(1.0);
  await f.jouer(1.0);
  await f.viser('texte:Code de retrait', { zoom: P ? 1.38 : 1.15, dur: 1.2, dy: 30 });
  await f.jouer(2.0); f.cle('en-grand');
  f.repos_(0.9); await f.jouer(0.8);
  await f.fin('Tes retraits, rangés par point relais.', 3.0);
}

if (require.main === module) {
  tourner('codes-retrait', scenario, { formats: ['portrait', 'paysage'], monde, tab: 'cat_bord' })
    .catch((e) => { console.error(e); process.exitCode = 1; });
}
module.exports = { scenario };
