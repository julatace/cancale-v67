// api/_lib/sans-bruit.js — retire UN avertissement de la plateforme des journaux.
//
// Mesuré le 20 octobre (Vercel, « runtime errors », 7 jours) : le SEUL groupe
// d'« erreurs » de production était
//   [DEP0169] DeprecationWarning: `url.parse()` behavior is not standardized…
// 1 336 fois, sur 6 routes, depuis le 31 juillet — dont /api/ai et /api/compte,
// qui n'appellent jamais `url.parse`. Aucun fichier de `api/` ne l'appelle :
// c'est l'environnement Node 24 de Vercel (et `web-push`, sur l'adresse d'un
// service de notification) qui l'émet, une fois par instance qui démarre.
// Conséquence : le tableau des erreurs de production était rempli à 100 % par
// ce bruit — une VRAIE erreur d'une route s'y serait noyée.
//
// On ne coupe QUE ce code-là (DEP0169). Tout autre avertissement, toute autre
// dépréciation, toute erreur passe tel quel. Importé EN PREMIER par chaque
// route (`audit-sans-bruit.cjs` le vérifie), pour être posé avant que la
// plateforme ne traite la première requête de l'instance.
const CODE = 'DEP0169';
const MARQUE = Symbol.for('vrm.sansBruit');

if (typeof process !== 'undefined' && typeof process.emitWarning === 'function' && !process.emitWarning[MARQUE]) {
  const original = process.emitWarning;
  const filtre = function (avert, ...reste) {
    try {
      const a0 = reste[0];
      const code = (avert && typeof avert === 'object' && avert.code)
        || (a0 && typeof a0 === 'object' ? a0.code : reste[1]);
      if (code === CODE) return undefined;
    } catch (_) { /* en cas de doute, on laisse passer */ }
    return original.call(process, avert, ...reste);
  };
  filtre[MARQUE] = true;
  process.emitWarning = filtre;
}

export const SANS_BRUIT = CODE;
