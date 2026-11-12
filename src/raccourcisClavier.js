// ═══════════════════════════════════════════════════════════════════════════
// RACCOURCIS CLAVIER (10 novembre, lot P — proposition 21, validée par Julien)
// ═══════════════════════════════════════════════════════════════════════════
// « g » puis une lettre : aller à un écran. « n » : nouvel achat (le formulaire
// s'ouvre VIDE, rien n'est écrit sans son « Ajouter l'achat »). « / » et ⌘K :
// chercher (déjà dans App.jsx, rappelés ici). « ? » : la liste, dans une feuille.
//
// LES DEUX LOIS (sa validation, mot pour mot : « jamais quand on tape dans un
// champ ; jamais un geste irréversible au clavier ») :
//   · une touche tapée dans un champ (input, textarea, select, contenteditable,
//     role=textbox) n'est JAMAIS un raccourci ; ni avec ⌘/Ctrl/Alt ; ni pendant
//     qu'une feuille modale est ouverte (elle a ses propres touches : Échap) ;
//   · un raccourci ne fait que NAVIGUER ou OUVRIR : chaque action de la table
//     est `aller` (un écran) ou `ouvrir` (une feuille, un formulaire vide) —
//     `audit-raccourcis-clavier.cjs` refuse toute autre sorte.
// La règle est pure (testée sans navigateur) ; le composant qui écoute est
// src/RaccourcisClavier.jsx. Rendu : scripts/bancs/clavier-voiceover.cjs.
// ═══════════════════════════════════════════════════════════════════════════

export const DELAI_SEQUENCE = 1500; // « g » puis la lettre, en moins d'1,5 s

// Les écrans : « g » + lettre ⇒ `?tab=` (la liste blanche de App.jsx, ONGLETS_LIENS).
export const ALLER = Object.freeze([
  { touche: 'j', tab: 'journee', nom: 'Ma journée' },
  { touche: 'a', tab: 'annonces', nom: 'Annonces' },
  { touche: 'v', tab: 'ventes', nom: 'Ventes' },
  // (11 nov., lot DJ3 — Julien : Colis doit DISPARAÎTRE de la navigation) plus de « g c » : « g v » ouvre Ventes, « À expédier »
  // en tête ; « g h » Achats, « À retirer » en tête. Le même écran sous deux touches serait la même chose deux fois.
  { touche: 'm', tab: 'messages', nom: 'Messages' },
  { touche: 'h', tab: 'achats', nom: 'Achats' },
  { touche: 's', tab: 'garage', nom: 'Stock' },
  { touche: 'r', tab: 'compta', nom: 'Argent' },
  { touche: 't', tab: 'trancher', nom: 'À trancher' },
  { touche: 'e', tab: 'emails', nom: 'E-mails' },
  { touche: 'p', tab: 'settings', nom: 'Paramètres' },
]);

// Les touches seules. `sorte` : 'aller' | 'ouvrir' — RIEN d'autre (jamais un geste qui écrit).
// `ecoute: false` : déjà écoutée ailleurs (App.jsx), seulement montrée dans la liste.
export const SEULES = Object.freeze([
  { touche: 'n', sorte: 'aller', lien: '?tab=achats&achat=1', nom: 'Nouvel achat (vide, rien n’est enregistré)' },
  { touche: '/', sorte: 'ouvrir', nom: 'Chercher', ecoute: false },
  { touche: '⌘K', sorte: 'ouvrir', nom: 'Chercher, même depuis un champ', ecoute: false },
  { touche: '← →', sorte: 'aller', nom: 'Écran précédent / suivant', ecoute: false },
  { touche: '?', sorte: 'ouvrir', quoi: 'aide', nom: 'Cette liste' },
  { touche: 'Échap', sorte: 'ouvrir', nom: 'Fermer une feuille', ecoute: false },
]);

// Une touche tapée DANS un champ de saisie ?
export const dansUnChamp = (el) => {
  if (!el || typeof el !== 'object') return false;
  const tag = String(el.tagName || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  const role = typeof el.getAttribute === 'function' ? el.getAttribute('role') : null;
  return role === 'textbox' || role === 'searchbox' || role === 'combobox';
};

// La touche peut-elle être un raccourci ? `ev` : { key, ctrlKey, metaKey, altKey, repeat,
// defaultPrevented, target }, `modaleOuverte` : une feuille modale est à l'écran.
export const toucheEcoutee = (ev, modaleOuverte = false) => {
  if (!ev || typeof ev.key !== 'string') return false;
  if (ev.defaultPrevented || ev.repeat || ev.ctrlKey || ev.metaKey || ev.altKey) return false;
  if (modaleOuverte) return false;
  if (dansUnChamp(ev.target)) return false;
  return true;
};

// La machine : `etat` = { g: horodatage du « g » ou 0 }. Rend { etat, action } où
// action = null | { sorte:'aller', lien } | { sorte:'ouvrir', quoi:'aide' }.
export const lireTouche = (etat, key, maintenant) => {
  const e = etat && etat.g ? etat : { g: 0 };
  const k = String(key || '');
  const enSequence = e.g && maintenant - e.g <= DELAI_SEQUENCE;
  if (enSequence) {
    const l = k.toLowerCase();
    const a = ALLER.find((x) => x.touche === l);
    return { etat: { g: 0 }, action: a ? { sorte: 'aller', lien: '?tab=' + a.tab } : null, pris: true };
  }
  if (k === 'g') return { etat: { g: maintenant }, action: null, pris: true };
  const s = SEULES.find((x) => x.touche === k && x.ecoute !== false);
  if (!s) return { etat: { g: 0 }, action: null, pris: false };
  if (s.sorte === 'aller') return { etat: { g: 0 }, action: { sorte: 'aller', lien: s.lien }, pris: true };
  return { etat: { g: 0 }, action: { sorte: 'ouvrir', quoi: s.quoi }, pris: true };
};
