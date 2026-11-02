// ── OÙ MÈNE UNE NOTIFICATION (31 octobre, Julien : « quand on reçoit une
// notification, ça doit nous amener précisément à l'endroit où ça doit nous
// amener ») ────────────────────────────────────────────────────────────────
// Une notification porte une adresse `/?tab=…` (le serveur la pose, voir
// `api/_lib/lien-notif.js`). L'onglet, le filtre de site (`site`) et la section
// (`section`) existaient déjà ; ce module ajoute la CIBLE : l'élément précis de
// l'écran à mettre en évidence (ou à ouvrir).
//
//   cible=conv     conv=<id conversation> compte=<uid>   Messages · la conversation ouverte
//   cible=offres                                        Messages · le filtre « Offres »
//   cible=vente    tx=<transaction>                     Ventes · la vente ouverte
//   cible=colis    tx=<transaction>                     Colis · la carte du colis à poster
//   cible=retrait  tx=<transaction> suivi=<n° de suivi> Colis · « À retirer » · la carte
//   cible=colonne  colonne=prets|attente|retirer|partis Colis · la colonne
//   cible=achat    tx=<transaction>                     Achats · la ligne de l'achat
//   cible=urssaf                                        Comptabilité · « Ta déclaration URSSAF »
//   cible=doublon  num=<N°> plat=ebay|leboncoin         l'écran où se règle la double vente
//
// ⚠️ IDENTITÉS SEULEMENT (§5) : un n° de transaction, de suivi, de conversation,
// un N° (`cleNum` côté écran). Jamais un titre : « mieux vaut un blanc qu'un
// faux » — une cible absente rend l'écran nu, avec une ligne qui le dit.
// Aucune donnée sensible dans l'adresse (pas de pseudo, pas de montant).
//
// Ce module ne porte que la RÈGLE, sans React ni DOM : quels sélecteurs
// essayer, dans quel ordre, et la phrase quand rien ne répond. L'app (`CibleNotif`)
// et les bancs la lisent.

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const COLONNES = ['prets', 'attente', 'retirer', 'partis'];
const TYPES = ['conv', 'offres', 'vente', 'colis', 'retrait', 'colonne', 'achat', 'urssaf', 'doublon'];
const propre = (v) => { const s = String(v == null ? '' : v).trim(); return ID.test(s) ? s : ''; };
// Échappe une valeur d'attribut CSS (les identités sont déjà filtrées par `ID`).
const q = (s) => String(s).replace(/["\\]/g, '\\$&');
// La clé d'un N° — la même que `cleNum` (App.jsx, api/_lib/numerotation.js) :
// « 007 » = « 7 », « b125 » = « B125 ». `audit-flux-divers.cjs` les compare.
export const cleNumCible = (v) => {
  let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, '');
  if (/^\d+$/.test(s)) s = String(parseInt(s, 10));
  return s;
};

// La cible lue dans l'adresse ; `null` si rien de reconnu (l'écran s'ouvre nu).
export function lireCible(params) {
  const g = (k) => { try { return params && typeof params.get === 'function' ? params.get(k) : (params ? params[k] : null); } catch (_) { return null; } };
  const type = String(g('cible') || '');
  if (!TYPES.includes(type)) return null;
  const c = { type, tx: propre(g('tx')), suivi: propre(g('suivi')), conv: propre(g('conv')), compte: propre(g('compte')), num: propre(g('num')), colonne: COLONNES.includes(g('colonne')) ? g('colonne') : '', plat: ['ebay', 'leboncoin'].includes(g('plat')) ? g('plat') : '' };
  if (type === 'conv' && !c.conv) return null;
  if ((type === 'vente' || type === 'colis' || type === 'achat') && !c.tx) return null;
  if (type === 'retrait' && !c.tx && !c.suivi) return null;
  if (type === 'colonne' && !c.colonne) return null;
  return c;
}

// Les sélecteurs à essayer, du plus précis au moins précis — chacun une
// IDENTITÉ. `ouvrir` : le sélecteur (dans l'élément trouvé, ou l'élément lui-
// même) à toucher pour l'ouvrir ; `deplier` : ce qu'il faut déplier d'abord si
// l'élément est replié derrière « Voir les N autres ».
export function selecteursCible(c) {
  if (!c) return { essais: [], ouvrir: null, deplier: [] };
  switch (c.type) {
    case 'conv': return {
      essais: [c.compte ? `.vrm-inbox-row[data-conv="${q(c.conv)}"][data-conv-compte="${q(c.compte)}"]` : null, `.vrm-inbox-row[data-conv="${q(c.conv)}"]`].filter(Boolean),
      ouvrir: '', deplier: [] };
    case 'offres': return { essais: ['[data-offres-au-mini]'], ouvrir: '', deplier: [] };
    case 'vente': return { essais: [`.vrm-sale-row[data-tx="${q(c.tx)}"]`], ouvrir: '.vrm-ledger-sale-toggle', deplier: [] };
    case 'colis': return {
      essais: [`[data-cc-carte="v:${q(c.tx)}"]`, `[data-bord-card][data-tx-colis="${q(c.tx)}"]`],
      ouvrir: null, deplier: ['[data-cc-colonne="prets"] [data-cc-plus]', '[data-cc-colonne="attente"] [data-cc-plus]'] };
    case 'retrait': return {
      essais: [c.tx ? `[data-cc-carte="r:v:${q(c.tx)}"]` : null, c.tx ? `[data-cc-carte="r:c:${q(c.tx)}"]` : null, c.suivi ? `[data-cc-carte="r:e:${q(c.suivi)}"]` : null].filter(Boolean),
      ouvrir: null, deplier: ['[data-cc-colonne="retirer"] [data-cc-plus]'] };
    case 'colonne': return { essais: [`[data-cc-colonne="${q(c.colonne)}"]`], ouvrir: null, deplier: [] };
    case 'achat': return { essais: [`.vrm-buy-row[data-achat-tx="${q(c.tx)}"]`], ouvrir: null, deplier: [] };
    case 'urssaf': return { essais: ['[data-compta-urssaf]', '#compta-urssaf'], ouvrir: null, deplier: [] };
    // ⚠️ (1er nov., audit A5) Avec un N°, SEULE la ligne de ce N° répond —
    // jamais un repli sur « la première ligne » : la notification parlait du
    // N°40 et l'écran surlignait le N°12. Le N° de la notification est une
    // `cleNum` (`api/_lib/double-vente.js`) ; la ligne Leboncoin porte la clé de
    // chacun de ses N° (`data-lbc-retirer-num`, liste séparée par des espaces,
    // un lot « 12+15 » répond à 12 ET à 15), la ligne eBay son N° (déjà une clé).
    // Ligne absente ⇒ l'écran reste, une phrase le dit (`phraseAbsente`). Sans
    // N° (aucune identité), on montre le BLOC où se règle la double vente.
    case 'doublon': {
      const n = c.num ? cleNumCible(c.num) : '';
      return {
        essais: c.plat === 'leboncoin'
          ? (n ? [`[data-lbc-retirer-num~="${q(n)}"]`] : ['[data-lbc-retirer-bloc]'])
          : (n ? [`[data-ebay-doublon="${q(n)}"]`, `[data-ebay-doublon-ailleurs="${q(n)}"]`] : ['[data-ebay-a-retirer]', '[data-ebay-a-retirer-ailleurs]']),
        ouvrir: null, deplier: [] };
    }
    default: return { essais: [], ouvrir: null, deplier: [] };
  }
}

// La ligne dite quand l'élément n'est plus là (une phrase, le geste s'il y en a un).
export function phraseAbsente(c) {
  switch (c && c.type) {
    case 'conv': return "Cette conversation n'est plus dans la liste : elle a peut-être été retirée, ou l'extension ne l'a pas encore relue.";
    case 'offres': return "Plus aucune offre au-dessus de ton prix mini : elle a déjà été acceptée, refusée ou retirée.";
    case 'vente': return "Cette vente n'est pas dans la liste affichée : regarde les filtres (période, état) ou repasse sur Vinted.";
    case 'colis': return "Ce colis n'est plus à poster : il est peut-être déjà parti.";
    case 'retrait': return "Ce colis n'est plus dans « À retirer » : il est peut-être déjà retiré.";
    case 'colonne': return 'Rien dans cette colonne pour l\u2019instant.';
    case 'achat': return "Cet achat n'est pas dans la liste affichée.";
    case 'urssaf': return 'La carte URSSAF ne s\u2019affiche pas pour ton statut.';
    // Ne promet pas « réglée » : la ligne peut manquer parce que la liste n'est
    // pas encore relue. Le geste est dit.
    case 'doublon': return 'Cette paire n\u2019est plus dans la liste « à retirer » : la double vente est sans doute déjà réglée. Vérifie dans tes annonces de la plateforme si tu as un doute.';
    default: return '';
  }
}

// Les paramètres d'adresse qui portent une cible : retirés de la barre
// d'adresse une fois lus (un rechargement ne rejoue pas la cible).
export const PARAMS_CIBLE = ['cible', 'tx', 'suivi', 'conv', 'compte', 'num', 'colonne', 'plat', 'vue'];
