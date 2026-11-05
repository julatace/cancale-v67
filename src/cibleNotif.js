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
//
// (5 nov., Julien : « cliquer une notification amène directement sur ce qui est
// arrivé, mis en évidence, pour TOUTES les notifications de VRM ») UN SEUL
// CROCHET DANS L'ÉCRAN : l'attribut `data-cible`, une liste de jetons
// « type:identité » séparés par des espaces, posé par `attrCible(...)` sur
// chaque élément qu'une notification peut viser (une ligne de vente, la carte
// d'un colis, une conversation…). `selecteursCible` cherche D'ABORD ce jeton
// (`[data-cible~="vente:7001"]`) ; les anciens attributs restent un repli.
//
//   cible=offre    conv=<id> compte=<uid>               Messages · la conversation ouverte, l'offre en évidence
//   cible=vcvente  vc=<productId Vestiaire>              Ventes · Vestiaire · la vente

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const COLONNES = ['prets', 'attente', 'retirer', 'partis'];
const TYPES = ['conv', 'offre', 'offres', 'vente', 'vcvente', 'colis', 'retrait', 'colonne', 'achat', 'urssaf', 'doublon'];
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
  const c = { type, tx: propre(g('tx')), suivi: propre(g('suivi')), conv: propre(g('conv')), compte: propre(g('compte')), num: propre(g('num')), vc: propre(g('vc')), colonne: COLONNES.includes(g('colonne')) ? g('colonne') : '', plat: ['ebay', 'leboncoin'].includes(g('plat')) ? g('plat') : '' };
  if ((type === 'conv' || type === 'offre') && !c.conv) return null;
  if (type === 'vcvente' && !c.vc) return null;
  if ((type === 'vente' || type === 'colis' || type === 'achat') && !c.tx) return null;
  if (type === 'retrait' && !c.tx && !c.suivi) return null;
  if (type === 'colonne' && !c.colonne) return null;
  return c;
}

// ── LE CROCHET `data-cible` ────────────────────────────────────────────────
// `attrCible(['vente', tx], ['colis', tx])` ⇒ « vente:7001 colis:7001 » — la
// valeur de l'attribut `data-cible` d'un élément. Une identité absente ou mal
// formée n'écrit PAS de jeton (jamais « vente: » vide qui répondrait à tout) ;
// rien du tout ⇒ `undefined` (React n'écrit pas l'attribut).
// Un N° passe par `cleNumCible` (« 007 » = « 7 »).
export function attrCible(...paires) {
  const out = [];
  for (const p of paires) {
    if (!Array.isArray(p) || !p.length) continue;
    const [type, ...ids] = p;
    if (!TYPES.includes(type)) continue;
    if (!ids.length) { out.push(type); continue; }
    const morceaux = ids.map((v, i) => (type === 'doublon' && i === ids.length - 1 && ids.length === 2 ? propre(cleNumCible(v)) : propre(v)));
    if (morceaux.some((m) => !m)) continue;
    out.push([type, ...morceaux].join(':'));
  }
  const u = [...new Set(out)];
  return u.length ? u.join(' ') : undefined;
}
// Les jetons qu'une cible cherche, du plus précis au moins précis.
export function jetonsCible(c) {
  if (!c) return [];
  switch (c.type) {
    case 'conv': case 'offre': return [c.compte ? `conv:${c.compte}:${c.conv}` : null, `conv:${c.conv}`].filter(Boolean);
    case 'offres': return ['offres'];
    case 'vente': return [`vente:${c.tx}`];
    case 'vcvente': return [`vcvente:${c.vc}`];
    case 'colis': return [`colis:${c.tx}`];
    case 'retrait': return [c.tx ? `retrait:tx:${c.tx}` : null, c.suivi ? `retrait:suivi:${c.suivi}` : null].filter(Boolean);
    case 'colonne': return [`colonne:${c.colonne}`];
    case 'achat': return [`achat:${c.tx}`];
    case 'urssaf': return ['urssaf'];
    case 'doublon': { const n = c.num ? cleNumCible(c.num) : ''; return n ? [`doublon:${c.plat || 'ebay'}:${n}`] : [`doublon:${c.plat || 'ebay'}`]; }
    default: return [];
  }
}
const parJeton = (c) => jetonsCible(c).map((j) => `[data-cible~="${q(j)}"]`);

// Les sélecteurs à essayer, du plus précis au moins précis — chacun une
// IDENTITÉ. `ouvrir` : le sélecteur (dans l'élément trouvé, ou l'élément lui-
// même) à toucher pour l'ouvrir ; `deplier` : ce qu'il faut déplier d'abord si
// l'élément est replié derrière « Voir les N autres ».
// `puis` : une fois l'élément ouvert, ce qu'il faut AUSSI mettre en évidence
// (l'offre dans la conversation ouverte).
export function selecteursCible(c) {
  if (!c) return { essais: [], ouvrir: null, deplier: [], puis: null };
  const r = selecteursAnciens(c);
  return { puis: null, ...r, essais: [...new Set([...parJeton(c), ...r.essais])] };
}
function selecteursAnciens(c) {
  switch (c.type) {
    case 'conv': return {
      essais: [c.compte ? `.vrm-inbox-row[data-conv="${q(c.conv)}"][data-conv-compte="${q(c.compte)}"]` : null, `.vrm-inbox-row[data-conv="${q(c.conv)}"]`].filter(Boolean),
      ouvrir: '', deplier: [] };
    // (5 nov.) Une offre : SA conversation ouverte, puis la carte de l'offre (dans le fil).
    case 'offre': return {
      essais: [c.compte ? `.vrm-inbox-row[data-conv="${q(c.conv)}"][data-conv-compte="${q(c.compte)}"]` : null, `.vrm-inbox-row[data-conv="${q(c.conv)}"]`].filter(Boolean),
      ouvrir: '', deplier: [], puis: '[data-cible~="offre"]' };
    case 'vcvente': return { essais: [`.vrm-sale-row[data-vc-vente="${q(c.vc)}"]`], ouvrir: '.vrm-ledger-sale-toggle', deplier: [] };
    case 'offres': return { essais: ['[data-offres-au-mini]'], ouvrir: '', deplier: [] };
    case 'vente': return { essais: [`.vrm-sale-row[data-tx="${q(c.tx)}"]`], ouvrir: '.vrm-ledger-sale-toggle', deplier: [] };
    case 'colis': return {
      // (2 nov.) Colis → « À envoyer » : la carte détaillée porte l'identité.
      essais: [`[data-colis-ident="v:${q(c.tx)}"]`, `[data-bord-card][data-tx-colis="${q(c.tx)}"]`],
      ouvrir: null, deplier: ['[data-cc-colonne="prets"] [data-cc-plus]', '[data-cc-colonne="attente"] [data-cc-plus]'] };
    case 'retrait': return {
      essais: [c.tx ? `[data-cc-carte="r:v:${q(c.tx)}"]` : null, c.tx ? `[data-cc-carte="r:c:${q(c.tx)}"]` : null, c.suivi ? `[data-cc-carte="r:e:${q(c.suivi)}"]` : null].filter(Boolean),
      // (5 nov., Julien : « la notification doit ouvrir directement le colis, mis en
      // évidence, AVEC SON CODE ») La ligne s'ouvre (le code est dans son détail).
      // Une ville choisie qui cache le point ⇒ « Toutes » ; « À vérifier » replié
      // s'ouvre tout seul (tout `<details>` qui contient la cible, `CibleNotif`).
      ouvrir: '.vrm-rpf-ouvrir', deplier: ['[data-retirer-villes] [data-ville=""][aria-pressed="false"]'] };
    // (2 nov.) Plus de colonnes : le groupe de la liste (« Prêts à imprimer », « En
    // attente du bordereau »), « À retirer », ou « Partis » (replié).
    // (5 nov.) « Prêts » / « En attente » : la liste « À envoyer » (`data-cible`
    // posé sur elle) — l'ancien intertitre `data-groupe` n'existe plus depuis le 2 nov.
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
    case 'offre': return "Cette offre n'est plus dans tes conversations : elle a peut-être été acceptée, refusée ou retirée, ou l'extension ne l'a pas encore relue.";
    case 'offres': return "Plus aucune offre au-dessus de ton prix mini : elle a déjà été acceptée, refusée ou retirée.";
    case 'vente': return "Cette vente n'est pas dans la liste affichée : regarde les filtres (période, état) ou repasse sur Vinted.";
    // (revue du 5 nov.) La vente est écrite par l'e-mail lui-même : absente, elle est soit hors des 30 montrées, soit pas relue.
    case 'vcvente': return "Cette vente Vestiaire n'est pas dans la liste affichée : elle est peut-être plus ancienne que les 30 montrées, ou la lecture n'est pas encore à jour.";
    // (revue du 5 nov.) La conversation est ouverte, mais son fil ne montre aucune offre en cours.
    case 'offre-fil': return "La conversation est ouverte, mais je n'y vois pas d'offre en cours : elle a peut-être été acceptée, refusée ou a expiré, ou le fil n'est pas encore relu.";
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
export const PARAMS_CIBLE = ['cible', 'tx', 'suivi', 'conv', 'compte', 'num', 'vc', 'colonne', 'plat', 'vue'];
