// ═══════════════════════════════════════════════════════════════════════════
// L'ANIMATION DU « ? » DE CHAQUE ÉCRAN (11 nov., lot centre-aide)
// ═══════════════════════════════════════════════════════════════════════════
// Pas de vidéo hébergée : une maquette dessinée en SVG (src/composants/
// AideAnimation.jsx), un doigt qui fait le geste de l'écran. UNE scène par geste
// de `ETAPES_ECRANS` (src/aideEtapes.js) : la scène allumée allume son geste
// dans la liste. Une seconde par scène ⇒ 3 à 5 s, en boucle douce.
// Les données sont d'EXEMPLE (N°124, 45 €) : rien n'est lu de sa base.
//
// Éléments : cadre (le fond d'une carte) · vignette · badge (N°) · barre (une
// ligne de texte) · bouton · champ · chiffre · case (le plan du stock).
// Gestes : tap (le doigt touche) · montre (le doigt désigne) · tape (le champ
// se remplit de `texte`) · arrive (l'élément entre) · part (l'élément s'efface).
// ═══════════════════════════════════════════════════════════════════════════
export const LARGEUR = 320, HAUTEUR = 180, MS_SCENE = 1000;
export const GESTES_ANIM = ['tap', 'montre', 'tape', 'arrive', 'part'];

// Une carte de liste : fond, vignette, badge du N°, deux lignes, prix ou bouton.
function carte(id, y, { badge = '', titre = 'Exemple', info = '', droite = '', bouton = '' } = {}) {
  const el = [
    { id, t: 'cadre', x: 16, y, w: 288, h: 30 },
    { id: id + '-v', t: 'vignette', x: 22, y: y + 4, w: 22, h: 22 },
  ];
  let x = 50;
  if (badge) { el.push({ id: id + '-b', t: 'badge', x, y: y + 8, w: 34, h: 14, texte: badge }); x += 40; }
  el.push({ id: id + '-l', t: 'barre', x, y: y + 9, w: 96, h: 5, texte: titre });
  if (info) el.push({ id: id + '-i', t: 'barre', x, y: y + 18, w: 64, h: 4, texte: info, discret: true });
  if (bouton) el.push({ id: id + '-btn', t: 'bouton', x: 226, y: y + 7, w: 70, h: 16, texte: bouton });
  else if (droite) el.push({ id: id + '-p', t: 'barre', x: 262, y: y + 12, w: 34, h: 6, texte: droite, fort: true });
  return el;
}
const tete = (titre, phrase = true) => [
  { id: 'titre', t: 'barre', x: 16, y: 12, w: 120, h: 10, texte: titre, titre: true },
  ...(phrase ? [{ id: 'phrase', t: 'barre', x: 16, y: 30, w: 190, h: 4, discret: true }] : []),
];
const chiffre = (id, x, texte, sous, extra = {}) => ({ id, t: 'chiffre', x, y: 44, w: 90, h: 36, texte, sous, ...extra });
const casesStock = () => {
  const c = [];
  for (let r = 0; r < 3; r++) for (let k = 0; k < 6; k++) c.push({ id: `case-${r}-${k}`, t: 'case', x: 16 + k * 48, y: 76 + r * 32, w: 42, h: 26, texte: String(118 + r * 6 + k), rouge: r === 2 && k === 4 });
  return c;
};

export const ANIMATIONS_ECRANS = {
  journee: { titre: 'Ma journée',
    elements: [...tete('Ma journée'), chiffre('c1', 16, '3', 'à envoyer'), chiffre('c2', 115, '—', 'reçu'), chiffre('c3', 214, '2', 'à retirer'),
      ...carte('t1', 94, { badge: 'N°124', titre: 'Imprimer le bordereau', bouton: 'Imprimer' }), ...carte('t2', 132, { titre: 'Retirer au relais', info: 'Code 482913', droite: '›' })],
    scenes: [{ cible: 't1', geste: 'montre' }, { cible: 't2', geste: 'tap' }, { cible: 't1', geste: 'part' }, { cible: 'c2', geste: 'montre' }] },
  annonces: { titre: 'Annonces',
    elements: [...tete('Annonces'), ...carte('a1', 46, { badge: 'N°124', titre: 'Exemple en ligne', droite: '45 €' }), ...carte('a2', 84, { badge: 'N°125', titre: 'Exemple en ligne', info: 'achat' }),
      { id: 'a2-champ', t: 'champ', x: 210, y: 91, w: 86, h: 16, texte: '', place: 'prix d’achat' }, ...carte('a3', 122, { badge: 'N°126', titre: 'Exemple en ligne', droite: '60 €' })],
    scenes: [{ cible: 'a1', geste: 'arrive' }, { cible: 'a1-b', geste: 'montre' }, { cible: 'a2-champ', geste: 'tape', texte: '30 €' }, { cible: 'a3-v', geste: 'tap' }] },
  ventes: { titre: 'Ventes',
    elements: [...tete('Ventes'), ...carte('v1', 46, { badge: 'N°124', titre: 'Vendue · Vinted', droite: '45 €' }), ...carte('v2', 84, { badge: 'N°98', titre: 'Envoyée · eBay', info: 'payée · envoyée', droite: '60 €' }),
      ...carte('v3', 122, { badge: 'N°77', titre: 'Finalisée', info: 'achat' }), { id: 'v3-champ', t: 'champ', x: 210, y: 129, w: 86, h: 16, texte: '', place: 'prix d’achat' }],
    scenes: [{ cible: 'v1', geste: 'arrive' }, { cible: 'v2', geste: 'tap' }, { cible: 'v3-champ', geste: 'tape', texte: '25 €' }] },
  colis: { titre: 'Colis',
    elements: [...tete('Colis'), { id: 's1', t: 'bouton', x: 16, y: 42, w: 90, h: 18, texte: 'À envoyer', plein: true }, { id: 's2', t: 'bouton', x: 112, y: 42, w: 90, h: 18, texte: 'À retirer' },
      ...carte('k1', 68, { badge: 'N°124', titre: 'Mondial Relay', bouton: 'Imprimer' }), ...carte('k2', 104, { badge: 'N°125', titre: 'Colissimo', bouton: 'Imprimer' }),
      { id: 'depot', t: 'bouton', x: 16, y: 146, w: 120, h: 20, texte: 'Je dépose' }],
    scenes: [{ cible: 'k1-btn', geste: 'tap' }, { cible: 'k1-b', geste: 'montre' }, { cible: 'depot', geste: 'tap' }, { cible: 's2', geste: 'tap' }] },
  messages: { titre: 'Messages',
    elements: [...tete('Messages'), ...carte('m1', 46, { titre: 'Bonjour, toujours dispo ?', info: 'il y a 5 min', droite: '›' }), ...carte('m2', 84, { titre: 'Offre : 40 €', info: 'prix 45 €', bouton: 'Accepter' }),
      { id: 'saisie', t: 'champ', x: 16, y: 130, w: 220, h: 22, texte: '', place: 'Écrire…' }, { id: 'envoyer', t: 'bouton', x: 244, y: 131, w: 60, h: 20, texte: 'Envoyer', plein: true }],
    scenes: [{ cible: 'm1', geste: 'tap' }, { cible: 'm2-btn', geste: 'tap' }, { cible: 'saisie', geste: 'tape', texte: 'Oui, elle part demain !' }] },
  achats: { titre: 'Achats',
    elements: [...tete('Achats'), { id: 'ajout', t: 'bouton', x: 224, y: 10, w: 80, h: 18, texte: '+ Ajouter', plein: true }, { id: 'import', t: 'bouton', x: 16, y: 40, w: 132, h: 16, texte: 'Importer un tableur' },
      ...carte('h1', 64, { titre: 'Achat Vinted', info: 'en route', droite: '30 €' }), ...carte('h2', 102, { titre: 'Brocante', info: 'reçu', droite: '12 €' }),
      { id: 'h2-champ', t: 'champ', x: 200, y: 140, w: 104, h: 18, texte: '', place: 'N° de rangement' }],
    scenes: [{ cible: 'h1', geste: 'arrive' }, { cible: 'ajout', geste: 'tap' }, { cible: 'import', geste: 'tap' }, { cible: 'h2-champ', geste: 'tape', texte: 'N°127' }] },
  emails: { titre: 'E-mails',
    elements: [...tete('E-mails'), { id: 'adresse', t: 'champ', x: 16, y: 42, w: 200, h: 20, texte: 'ton adresse VRM', fixe: true }, { id: 'copier', t: 'bouton', x: 222, y: 43, w: 82, h: 18, texte: 'Copier' },
      ...carte('e1', 76, { titre: 'Code de retrait', info: 'Mondial Relay', droite: '›' }), ...carte('e2', 114, { titre: 'Bordereau', info: 'Vinted', droite: '›' })],
    scenes: [{ cible: 'adresse', geste: 'montre' }, { cible: 'copier', geste: 'tap' }, { cible: 'e1', geste: 'arrive' }] },
  compta: { titre: 'Argent',
    elements: [...tete('Argent'), chiffre('c1', 16, '1 240 €', 'vendu'), chiffre('c2', 115, '980 €', 'reçu'), chiffre('c3', 214, '310 €', 'bénéfice'),
      { id: 'regime', t: 'bouton', x: 16, y: 92, w: 120, h: 18, texte: 'Mon régime' }, { id: 'declarer', t: 'bouton', x: 142, y: 92, w: 90, h: 18, texte: 'Déclarer' },
      { id: 'declare', t: 'bouton', x: 16, y: 124, w: 170, h: 22, texte: 'J’ai déclaré ce mois', plein: true }],
    scenes: [{ cible: 'c1', geste: 'montre' }, { cible: 'regime', geste: 'tap' }, { cible: 'declarer', geste: 'tap' }, { cible: 'declare', geste: 'tap' }] },
  dashboard: { titre: 'Statistiques',
    elements: [...tete('Statistiques'), { id: 'periode', t: 'bouton', x: 214, y: 10, w: 90, h: 18, texte: 'Ce mois' }, chiffre('c1', 16, '42', 'ventes'), chiffre('c2', 115, '38 €', 'prix moyen'), chiffre('c3', 214, '6', 'sans prix', { ambre: true }),
      { id: 'barres', t: 'cadre', x: 16, y: 92, w: 288, h: 72 }],
    scenes: [{ cible: 'periode', geste: 'tap' }, { cible: 'c2', geste: 'tap' }, { cible: 'c3', geste: 'montre' }] },
  garage: { titre: 'Stock',
    elements: [...tete('Stock', false), { id: 'cherche', t: 'champ', x: 16, y: 38, w: 288, h: 24, texte: '', place: 'Chercher un N°' }, ...casesStock()],
    scenes: [{ cible: 'cherche', geste: 'tape', texte: '124', allume: 'case-1-0' }, { cible: 'case-1-0', geste: 'tap' }, { cible: 'case-2-4', geste: 'montre' }] },
  settings: { titre: 'Réglages',
    elements: [...tete('Réglages'), ...carte('r1', 44, { titre: 'Vérifier mon installation', info: 'extension', droite: '›' }), ...carte('r2', 80, { titre: 'Mes e-mails', info: 'ta boîte', droite: '›' }), ...carte('r3', 116, { titre: 'Mes comptes', info: 'sites', droite: '›' })],
    scenes: [{ cible: 'r1', geste: 'tap' }, { cible: 'r2', geste: 'tap' }, { cible: 'r3', geste: 'tap' }] },
  communaute: { titre: 'Communauté',
    elements: [...tete('Communauté'), { id: 'carte', t: 'cadre', x: 16, y: 42, w: 288, h: 70 }, { id: 'rejoindre', t: 'bouton', x: 24, y: 86, w: 120, h: 18, texte: 'Rejoindre la carte', plein: true },
      { id: 'code', t: 'champ', x: 16, y: 122, w: 190, h: 20, texte: '', place: 'Code du groupe' }, { id: 'quitter', t: 'bouton', x: 214, y: 122, w: 90, h: 20, texte: 'Quitter' }],
    scenes: [{ cible: 'rejoindre', geste: 'tap' }, { cible: 'code', geste: 'tape', texte: 'AB12' }, { cible: 'quitter', geste: 'tap' }] },
};

// Le centre de la cible d'une scène (là où va le doigt).
export function centreCible(anim, scene) {
  const el = anim && scene ? anim.elements.find((e) => e.id === scene.cible) : null;
  if (!el) return null;
  return { x: el.x + el.w / 2, y: el.y + el.h / 2 };
}
// La durée d'une boucle (ms).
export const dureeBoucle = (anim) => (anim ? anim.scenes.length * MS_SCENE : 0);
