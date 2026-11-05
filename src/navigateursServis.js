// ══════════════════════════════════════════════════════════════════════════
// LES BOUTIQUES ET LES NAVIGATEURS SERVIS — module LÉGER (5 novembre)
// ══════════════════════════════════════════════════════════════════════════
// Sorti de src/navigateurExtension.js (qui le ré-exporte, rien ne change pour
// l'app) : la page d'accueil publique (src/Accueil.jsx) se charge AVANT l'app
// et ne doit embarquer que ceci — budget du fichier d'entrée (banc accueil.cjs).
// Aucune dépendance.

// ⚠️ LIENS_BOUTIQUES : l'adresse de la fiche, une fois PUBLIÉE et VALIDÉE par la
//    boutique — vide tant qu'elle ne l'est pas. Vide ⇒ l'app ne promet aucune
//    boutique : elle propose le zip (Chromium) ou dit que la version de ce
//    navigateur n'est pas encore en ligne. Jamais un lien deviné : une fiche
//    qui n'existe pas encore mène à une erreur 404 — le défaut du pipeline
//    Factures. À remplir quand chaque boutique a validé la fiche.
export const LIENS_BOUTIQUES = {
  chrome: '',    // https://chromewebstore.google.com/detail/<identifiant>
  edge: '',      // https://microsoftedge.microsoft.com/addons/detail/<identifiant>
  opera: '',     // https://addons.opera.com/extensions/details/<nom>
  firefox: '',   // https://addons.mozilla.org/firefox/addon/<nom>/
  safari: '',    // https://apps.apple.com/app/<nom>/id<n> — l'app conteneur (Xcode, compte Apple)
};

// Fichier d’import dédié Orion ; ne constitue pas une fiche de boutique.
export const LIEN_ORION_FICHIER = '/VRM-Orion.xpi';

// ══ OÙ L'EXTENSION SERVIE S'INSTALLE AUJOURD'HUI (5 novembre) ══════════════
// Ce que la page d'accueil publique peut PROMETTRE — rien de plus que ce qui
// marche (src/Accueil.jsx le rend tel quel ; docs/boutiques-extension.md) :
//   · `ordinateur` : le paquet Chromium servi (public/VRM-extension.zip)
//     s'installe dans Chrome, Edge, Brave, Opera et Vivaldi. Firefox seulement
//     quand SA fiche est publiée (le paquet existe, il n'est pas servi) ;
//   · `essai` : Orion (Mac, iPhone, iPad) a son paquet servi (`LIEN_ORION_FICHIER`) ;
//     la 5.319 s'installe chez Julien (5 nov.), mais la lecture de Vinted n'y
//     est pas confirmée et ses API sont partielles — « en essai », jamais promis ;
//   · `pasEncore` : ce qui n'a aucun paquet servi (Safari ; Firefox sans fiche) ;
//   · `lectureTelephone` : aucun chemin PROUVÉ ne lit Vinted depuis un téléphone
//     (Orion iPhone non confirmé, Firefox Android jamais essayé) ⇒ `false` :
//     l'ordinateur reste nécessaire. À passer à `true` seulement sur une preuve.
export const NAVIGATEURS_CHROMIUM = ['Chrome', 'Edge', 'Brave', 'Opera', 'Vivaldi'];
export function navigateursServis(liens = LIENS_BOUTIQUES, fichierOrion = LIEN_ORION_FICHIER) {
  const firefox = !!(liens && liens.firefox);
  return {
    ordinateur: [...NAVIGATEURS_CHROMIUM, ...(firefox ? ['Firefox'] : [])],
    essai: fichierOrion ? ['Orion'] : [],
    pasEncore: ['Safari', ...(firefox ? [] : ['Firefox'])],
    lectureTelephone: false,
  };
}
// La liste écrite pour une phrase : « Chrome, Edge, Brave, Opera ou Vivaldi ».
export const NAVS_ORDINATEUR_TEXTE = ((l) => `${l.slice(0, -1).join(', ')} ou ${l[l.length - 1]}`)(navigateursServis().ordinateur);
