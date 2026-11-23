// ════════════════════════════════════════════════════════════════════════════
//  L'HISTORIQUE DU NAVIGATEUR ENTRE LES ONGLETS DE LA BARRE (16 nov., lot barre-achats)
//
//  Julien (capture iPhone) : « Je ne veux pas qu'on puisse glisser entre les onglets ».
//  Le glisser de VRM est retiré depuis le 9 nov. ; ce qui restait, c'est le RETOUR du
//  système (bord gauche sur iPhone, geste retour d'Android) : chaque toucher de la barre
//  empilait une entrée d'historique, et le glisser depuis le bord montrait l'onglet
//  d'avant à moitié (Argent ⇒ Ma journée). Comme une barre d'onglets native (iOS), passer
//  d'un onglet de la barre à un autre REMPLACE l'entrée courante : le retour n'a plus
//  d'onglet voisin à montrer. Le retour reste entier pour le reste : une feuille se ferme,
//  un écran du menu (Messages, E-mails, Paramètres…) revient à l'écran d'où on l'a ouvert.
//  Fonction pure : la coque (src/App.jsx) et l'audit `audit-barre-achats.cjs` la lisent.
// ════════════════════════════════════════════════════════════════════════════

// `avant` : l'état d'historique courant ({ vrmTab, vrmSub, vrmFeuille }) ; `apres` : { tab, sub }.
// `groupeDe(tab)` : l'onglet de la barre qui reste allumé pour cet écran ; `barre` : les identifiants
// des onglets de la barre. Rend 'rien' (déjà là), 'remplacer' ou 'empiler'.
// Les groupes dont les écrans sont les SEGMENTS d'un même écran (Argent : Résumé · Statistiques… ; Ventes · Litiges).
const SEGMENTS = new Set(['compta', 'ventes']);
export function entreeHistorique(avant, apres, groupeDe, barre) {
  const st = avant || {};
  if (st.vrmTab === apres.tab && st.vrmSub === apres.sub) return 'rien';
  // Une feuille ouverte garde son entrée (elle se ferme par le retour) : on ne l'écrase jamais.
  if (st.vrmFeuille) return 'empiler';
  const dans = (t) => !!t && barre.includes(groupeDe(t));
  // (21 nov., onglets-menu) Deux écrans du MÊME groupe (Argent ↔ Statistiques, Ventes ↔ Litiges) : l'un remplace l'autre,
  // même quand le groupe n'est plus dans la barre (Ventes, Argent s'ouvrent depuis le Menu, qui empile).
  if (st.vrmTab && apres.tab && SEGMENTS.has(groupeDe(apres.tab)) && groupeDe(st.vrmTab) === groupeDe(apres.tab)) return 'remplacer';
  // La toute première entrée (avant VRM, sans écran) vaut Ma journée, l'écran de départ.
  return dans(st.vrmTab || 'journee') && dans(apres.tab) ? 'remplacer' : 'empiler';
}
