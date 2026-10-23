// ═══════════════════════════════════════════════════════════════════════════
// MA JOURNÉE EN WIDGETS (21-22 octobre)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « organiser le premier onglet comme l'écran d'accueil d'Apple, avec
// des widgets ». Ce module ne porte QUE la disposition (quels widgets, dans quel
// ordre, à quelle taille). Aucun chiffre n'est calculé ici : chaque widget rend
// un bloc que Ma journée calcule déjà (§11).
// La disposition est un réglage synchronisé (`vrm_journee_widgets`) de forme
// `{ v: 1, w: [{ id, t }] }`. Absente ⇒ la disposition par défaut.
// Un widget inconnu (retiré dans une version future, faute de frappe) est
// IGNORÉ ; un doublon ne compte qu'une fois ; une taille non permise retombe
// sur la taille par défaut du widget ; un widget FIXE absent est remis.
//
// ⚠️ UNE TAILLE EST UNE LARGEUR, et elle ne se propose que là où elle change
// quelque chose (22 oct.). Le premier jet offrait « Grand » = la même carte,
// deux rangées plus haute et vide en bas : un choix qui ne montre rien de plus
// est un faux choix. Sur la grille de l'ordinateur (6 colonnes, la mise en page
// d'avant : vendu | semaine | attente, puis photos 2/3 | stock 1/3 — le banc
// `revendeurs` l'exige, « tout visible sans défiler ») : petit = 1/6, un tiers,
// deux tiers, pleine largeur. Sur téléphone (2 colonnes) tout ce qui n'est pas
// petit fait la largeur entière : le bouton de taille n'y est pas montré
// (styles-widgets.css).

export const CLE_WIDGETS_JOURNEE = 'vrm_journee_widgets';
export const TAILLES_WIDGET = ['petit', 'moyen', 'grand', 'pleine'];
export const NOM_TAILLE = { petit: 'Petit', moyen: 'Un tiers', grand: 'Deux tiers', pleine: 'Pleine largeur' };

// L'ordre de ce catalogue est celui de la feuille « Ajouter ». La première
// taille de chaque widget est sa taille par défaut.
// `fixe` : jamais retirable (on peut le déplacer). « À faire » porte les gestes
// qui coûtent s'ils sont oubliés (colis cochés non partis, litige, emails mis
// de côté, « Tout est OK » à confirmer…) : le retirer les ferait disparaître.
// `carte: false` : le bloc n'a pas de cadre à lui (un titre puis une liste) —
// en mode « Modifier » la grille lui en dessine un, pour qu'on voie ce qu'on tient.
export const WIDGETS_JOURNEE = {
  barre:    { nom: 'Les quatre gestes', desc: 'À envoyer, à retirer, messages, prix à baisser', tailles: ['pleine'] },
  afaire:   { nom: 'À faire', desc: 'Les actions du jour', tailles: ['pleine', 'grand', 'moyen'], fixe: true, carte: false },
  vendu:    { nom: 'Vendu et reçu', desc: 'Vendu ce mois et aujourd’hui, reçu ce mois (et ton bénéfice, si tu l’affiches)', tailles: ['moyen', 'grand', 'pleine'] },
  semaine:  { nom: 'Cette semaine', desc: 'La courbe vendu et reçu de la semaine', tailles: ['moyen', 'grand', 'pleine'] },
  attente:  { nom: 'Argent en attente', desc: 'En attente chez Vinted et disponible à virer', tailles: ['moyen', 'grand', 'pleine'] },
  recentes: { nom: 'Dernières ventes', desc: 'Les photos de tes dernières ventes', tailles: ['grand', 'pleine'], carte: false },
  stock:    { nom: 'Stock actuel', desc: 'Annonces en ligne et prix d’achat renseignés', tailles: ['moyen', 'grand', 'pleine'] },
  jours14:  { nom: '14 derniers jours', desc: 'Vendu et reçu, jour par jour', tailles: ['moyen', 'grand', 'pleine'] },
  performance: { nom: 'Performance', desc: 'Ventes du mois, prix moyen, marques et pays des acheteurs', tailles: ['moyen', 'grand', 'pleine'] },
  urssaf:   { nom: 'Déclaration URSSAF', desc: 'Le rappel de la prochaine échéance (sorti de « À faire »)', tailles: ['grand', 'pleine', 'moyen'], carte: false },
  envoyer:  { nom: 'À envoyer', desc: 'Petite case : le nombre de colis à poster', tailles: ['petit'] },
  retirer:  { nom: 'À retirer', desc: 'Petite case : le nombre de colis à aller chercher', tailles: ['petit'] },
  messages: { nom: 'Messages', desc: 'Petite case : les messages récents sans réponse', tailles: ['petit'] },
  prix:     { nom: 'Prix à baisser', desc: 'Petite case : les paires vues qui ne partent pas', tailles: ['petit'] },
};

// ⚠️ PAS DE WIDGET « TON BÉNÉFICE » (revue du 22 oct.) : le bénéfice dans Ma
// journée a déjà UN propriétaire, le réglage `vrm_journee_benefice` (Réglages →
// Affichage, « + Afficher ton bénéfice », « Masquer »), et il vit DANS la carte
// « Vendu et reçu » (décision de Julien du 21 oct., « regrouper CA et
// bénéfice »). Un widget à côté était une seconde règle : Réglages disait
// « éteint » pendant que le widget l'affichait, et l'interrupteur n'avait plus
// d'effet (§11). Un `benefice` resté dans une disposition est ignoré (inconnu).

// Les petites cases redisent, une par une, un nombre de la barre « Les quatre
// gestes ». Les deux à la fois, c'est le même nombre écrit deux fois (§7) : la
// feuille « Ajouter » ne propose pas l'un quand l'autre est sur l'écran.
export const TUILES_JOURNEE = ['envoyer', 'retirer', 'messages', 'prix'];
export const widgetsAjoutables = (dispo) => {
  const presents = new Set((Array.isArray(dispo) ? dispo : []).map((w) => w && w.id));
  const barre = presents.has('barre');
  const tuile = TUILES_JOURNEE.some((id) => presents.has(id));
  const ids = Object.keys(WIDGETS_JOURNEE).filter((id) => !presents.has(id)
    && !(barre && TUILES_JOURNEE.includes(id))
    && !(tuile && id === 'barre'));
  // Ce qui n'est PAS proposé, et pourquoi (une phrase, seulement si c'est le cas).
  const retenu = barre && TUILES_JOURNEE.some((id) => !presents.has(id)) ? 'tuiles'
    : tuile ? 'barre' : '';
  return { ids, retenu };
};

export const tailleDefautWidget = (id) => {
  const d = WIDGETS_JOURNEE[id];
  return d ? d.tailles[0] : null;
};
export const widgetFixe = (id) => !!(WIDGETS_JOURNEE[id] && WIDGETS_JOURNEE[id].fixe);

// La disposition par défaut : les blocs de Ma journée d'avant, dans le même
// ordre et à la même place sur ordinateur (vendu | semaine | attente, puis
// photos 2/3 | stock 1/3) ; sur téléphone, l'un sous l'autre.
// ⚠️ UN CHANGEMENT, ASSUMÉ (revue du 22 oct.) : les alertes qui coûtent (deux
// paires sous un N°, double vente, colis en retard…) étaient avant les
// premières lignes de « À faire », SOUS la barre. Elles sont maintenant au-dessus
// de la grille — donc au-dessus de la barre — et ne bougent pas avec elle :
// aucune disposition ne peut les pousser en bas de l'écran. Le banc
// `journee-widgets` (A2) vérifie cet ordre-là, pas « le même qu'avant ».
export const DISPO_JOURNEE_DEFAUT = ['barre', 'afaire', 'vendu', 'semaine', 'attente', 'recentes', 'stock']
  .map((id) => ({ id, t: tailleDefautWidget(id) }));

// `null` = rien de rangé (ou illisible) ⇒ l'appelant prend le défaut.
// Une liste sans widget retirable est une vraie disposition (il a tout retiré) :
// elle garde seulement les widgets fixes.
export const normaliserDispoJournee = (v) => {
  const w = v && typeof v === 'object' && Array.isArray(v.w) ? v.w : (Array.isArray(v) ? v : null);
  if (!w) return null;
  const vus = new Set(), out = [];
  for (const x of w) {
    const id = x && typeof x === 'object' ? x.id : x;
    if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(WIDGETS_JOURNEE, id) || vus.has(id)) continue;
    vus.add(id);
    const t = x && typeof x === 'object' && WIDGETS_JOURNEE[id].tailles.includes(x.t) ? x.t : tailleDefautWidget(id);
    out.push({ id, t });
  }
  // Un widget fixe ne disparaît jamais, même d'une disposition abîmée : il
  // revient à sa place d'origine (après la barre si elle est là, sinon en tête).
  for (const id of Object.keys(WIDGETS_JOURNEE)) {
    if (!widgetFixe(id) || vus.has(id)) continue;
    const apres = out.findIndex((x) => x.id === 'barre');
    out.splice(apres >= 0 ? apres + 1 : 0, 0, { id, t: tailleDefautWidget(id) });
  }
  return out;
};

// Déplacer un widget à la place d'un autre (dans les deux sens).
export const deplacerWidget = (liste, de, vers) => {
  if (de === vers || de < 0 || vers < 0 || de >= liste.length || vers >= liste.length) return liste;
  const a = liste.slice(); const [w] = a.splice(de, 1); a.splice(vers, 0, w); return a;
};

// Retirer un widget — jamais un widget fixe.
export const retirerWidget = (liste, id) => (widgetFixe(id) ? liste : liste.filter((w) => w.id !== id));

// La taille suivante permise (pour le bouton de taille en mode « Modifier »).
export const tailleSuivante = (id, t) => {
  const d = WIDGETS_JOURNEE[id]; if (!d) return t;
  const i = d.tailles.indexOf(t);
  return d.tailles[(i + 1) % d.tailles.length];
};

// ⚠️ UNE ALERTE QUI VIVAIT DANS UNE CASE NE DOIT PAS PARTIR AVEC ELLE.
// Les colis EN RETARD (« À envoyer ») et les colis HORS DÉLAI (« À retirer » :
// non retiré, il repart chez l'expéditeur) ne sont dits, dans Ma journée d'avant,
// que par la couleur de leur case dans la barre. Si plus aucune case ne les
// montre — barre retirée et petite case absente —, ils remontent en alerte en
// tête (hors grille, non retirable). Tant qu'une case les montre, rien de plus :
// une cause, une phrase (§7).
export const caseVisible = (dispo, id) => Array.isArray(dispo) && dispo.some((w) => w && (w.id === 'barre' || w.id === id));
