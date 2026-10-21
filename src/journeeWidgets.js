// ═══════════════════════════════════════════════════════════════════════════
// MA JOURNÉE EN WIDGETS (21 octobre)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « organiser le premier onglet comme l'écran d'accueil d'Apple, avec
// des widgets ». Ce module ne porte QUE la disposition (quels widgets, dans quel
// ordre, à quelle taille). Aucun chiffre n'est calculé ici : chaque widget rend
// un bloc que Ma journée calcule déjà (§11).
// La disposition est un réglage synchronisé (`vrm_journee_widgets`) de forme
// `{ v: 1, w: [{ id, t }] }`. Absente ⇒ la disposition d'aujourd'hui.
// Un widget inconnu (retiré dans une version future, faute de frappe) est
// IGNORÉ ; un doublon ne compte qu'une fois ; une taille non permise retombe
// sur la taille par défaut du widget.

export const CLE_WIDGETS_JOURNEE = 'vrm_journee_widgets';
export const TAILLES_WIDGET = ['petit', 'moyen', 'grand'];
export const NOM_TAILLE = { petit: 'Petit', moyen: 'Moyen', grand: 'Grand' };

// L'ordre de ce catalogue est celui de la feuille « Ajouter ».
export const WIDGETS_JOURNEE = {
  barre:    { nom: 'Les quatre gestes', desc: 'À envoyer, à retirer, messages, prix à baisser', tailles: ['moyen'] },
  afaire:   { nom: 'À faire', desc: 'Les actions du jour (les alertes d’argent restent toujours en tête)', tailles: ['moyen', 'grand'] },
  vendu:    { nom: 'Vendu et reçu', desc: 'Vendu ce mois et aujourd’hui, reçu ce mois', tailles: ['moyen', 'grand'] },
  semaine:  { nom: 'Cette semaine', desc: 'La courbe vendu et reçu de la semaine', tailles: ['moyen', 'grand'] },
  attente:  { nom: 'Argent en attente', desc: 'En attente chez Vinted et disponible à virer', tailles: ['moyen'] },
  recentes: { nom: 'Dernières ventes', desc: 'Les photos de tes dernières ventes', tailles: ['moyen', 'grand'], t: 'grand' },
  stock:    { nom: 'Stock actuel', desc: 'Annonces en ligne et prix d’achat renseignés', tailles: ['moyen'] },
  jours14:  { nom: '14 derniers jours', desc: 'Vendu et reçu, jour par jour', tailles: ['moyen', 'grand'] },
  urssaf:   { nom: 'Déclaration URSSAF', desc: 'Le rappel de la prochaine échéance', tailles: ['moyen'] },
  benefice: { nom: 'Ton bénéfice', desc: 'Brut et net du mois — les chiffres de Comptabilité', tailles: ['moyen', 'grand'] },
  envoyer:  { nom: 'À envoyer', desc: 'Le nombre de colis à poster', tailles: ['petit'] },
  retirer:  { nom: 'À retirer', desc: 'Le nombre de colis à aller chercher', tailles: ['petit'] },
  messages: { nom: 'Messages', desc: 'Les messages récents sans réponse', tailles: ['petit'] },
  prix:     { nom: 'Prix à baisser', desc: 'Les paires vues qui ne partent pas', tailles: ['petit'] },
};

export const tailleDefautWidget = (id) => {
  const d = WIDGETS_JOURNEE[id];
  return d ? (d.t || d.tailles[0]) : null;
};

// La disposition d'aujourd'hui : les mêmes blocs, dans le même ordre.
export const DISPO_JOURNEE_DEFAUT = ['barre', 'afaire', 'vendu', 'semaine', 'attente', 'recentes', 'stock']
  .map((id) => ({ id, t: tailleDefautWidget(id) }));

// `null` = rien de rangé (ou illisible) ⇒ l'appelant prend le défaut.
// Une liste VIDE est une vraie disposition (il a tout retiré) : elle reste vide.
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
  return out;
};

// Déplacer un widget à la place d'un autre (dans les deux sens).
export const deplacerWidget = (liste, de, vers) => {
  if (de === vers || de < 0 || vers < 0 || de >= liste.length || vers >= liste.length) return liste;
  const a = liste.slice(); const [w] = a.splice(de, 1); a.splice(vers, 0, w); return a;
};

// La taille suivante permise (pour le bouton de taille en mode « Modifier »).
export const tailleSuivante = (id, t) => {
  const d = WIDGETS_JOURNEE[id]; if (!d) return t;
  const i = d.tailles.indexOf(t);
  return d.tailles[(i + 1) % d.tailles.length];
};
