// ══════════════════════════════════════════════════════════════════════════════
//  LOT B (9 nov. 2026) — « ANNULER » 5 s AU LIEU D'UNE CONFIRMATION, ET ⌘K QUI AGIT
//  docs/passation/2026-11-09-annuler-commandes.md
// ══════════════════════════════════════════════════════════════════════════════
// Module PUR (aucun React, aucun stockage) : exécuté tel quel par
// `scripts/audit-annuler-commandes.cjs` et lu par `scripts/bancs/annuler-commandes.cjs`.
//
// 1) LA RÈGLE DES CONFIRMATIONS (décision de Julien, 9 nov. : « fais absolument tout »)
//    · RÉVERSIBLE DANS VRM — une écriture de SA propre donnée qu'on peut remettre
//      EXACTEMENT (une sous-valeur de la ligne `main`, sa valeur d'avant connue) ⇒ le
//      geste part tout de suite et la pilule « Fait · Annuler » reste 5 s
//      (`gesteVrm`, src/gesteAnnulable.js, `PiluleAnnulerCoque`). L'annulation écrit
//      la valeur d'AVANT (jamais un « basculer »), par la file du geste ; la ligne
//      `main` part en comparer-et-échanger sur `data.rev` (`cloudPush`).
//    · IRRÉVERSIBLE OU EXTÉRIEUR — tout ce qui part chez Vinted, Leboncoin, eBay,
//      Vestiaire (publication, suppression d'annonce, offre, message, bordereau,
//      prix envoyé), une facture, un paiement, un N° réattribué ou changé (§5 : il
//      est écrit sur un carton), une suppression (fiche, achat, meuble, compte), une
//      restauration de sauvegarde ⇒ la confirmation RESTE (CLAUDE.md §3).
//    · Dans le doute : la confirmation reste.
//    L'inventaire complet (gardées / remplacées, et pourquoi) : `CONFIRMATIONS`.
//
// 2) ⌘K QUI AGIT : la loupe (⌘K, Ctrl+K, « / ») propose aussi des ACTIONS. Une action
//    OUVRE un écran ou une feuille qui existe déjà (Colis, la feuille « Tout imprimer »,
//    la feuille du prix, la fiche, Compta → export, Ma configuration) — elle n'écrit
//    RIEN et n'envoie RIEN : le geste extérieur reste derrière le clic habituel de
//    cet écran (« Imprimer », « Appliquer »…).

// ── Les champs d'avant d'une fiche, pour une opération « champs » annulable ──
// `entree` : la fiche telle qu'elle est AVANT le geste ; `patch` : les champs posés.
// Un champ absent avant vaut `undefined` (l'annulation le RETIRE, elle ne pose pas
// `null` à sa place) — c'est ce qui rend l'état d'avant EXACT.
export function champsAvant(entree, patch) {
  const e = entree && typeof entree === 'object' ? entree : {};
  const out = {};
  for (const c of Object.keys(patch || {})) out[c] = Object.prototype.hasOwnProperty.call(e, c) ? e[c] : undefined;
  return out;
}

// ── L'inventaire des confirmations (9 nov.) ──────────────────────────────────
// decision : 'annuler' (remplacée par la pilule « Annuler » 5 s) · 'gardee'.
// cle : un repère stable, cherché par l'audit dans le code (`ou`).
export const CONFIRMATIONS = [
  // Remplacées : réversibles dans VRM, état d'avant connu exactement.
  { cle: 'masquer-achat', geste: 'Masquer cet achat', ou: 'Achats → … d’un achat', decision: 'annuler', pourquoi: 'une entrée de `vinted_purchases_hidden` ; l’annulation la retire et remet l’achat à SA place dans la liste' },
  { cle: 'masquer-bordereau', geste: 'Masquer ce bordereau', ou: 'Colis → carte', decision: 'annuler', pourquoi: 'une entrée de `vinted_bords_hidden` ; l’annulation remet la valeur d’avant' },
  { cle: 'tout-retire', geste: 'Marquer TOUS ces colis récupérés', ou: 'Colis → Ma tournée', decision: 'annuler', pourquoi: 'les entrées de `vrm_colis_collected` (seuls les colis pas encore retirés) ; l’annulation les retire toutes' },
  { cle: 'marquer-vendue', geste: 'Marquer cet article vendu (le retirer des annonces)', ou: 'Annonces → fiche', decision: 'annuler', pourquoi: 'une entrée de `vinted_annonces_vendues`, rien chez Vinted' },
  { cle: 'reafficher-vendues', geste: 'Réafficher toutes les annonces marquées vendues', ou: 'Annonces', decision: 'annuler', pourquoi: 'les mêmes entrées, retirées ; l’annulation les remet' },
  { cle: 'delier-lbc', geste: 'Délier une annonce Leboncoin (« Pas le bon article », « Délier »)', ou: 'Leboncoin', decision: 'annuler', pourquoi: 'une valeur de `vrm_lbc_liens` ; l’annulation remet le MÊME N° (rien chez Leboncoin)' },
  { cle: 'delier-gros', geste: 'Délier un N° d’un achat en gros', ou: 'Achats → Fournisseurs', decision: 'annuler', pourquoi: 'les champs `buyGros` (+ `buyPrice` posé par l’achat) de SA fiche ; l’annulation remet les champs d’avant, jamais le N°' },
  { cle: 'relier-achat', geste: 'Relier un achat à une paire', ou: 'Achats à relier', decision: 'annuler', pourquoi: 'n’avait pas de confirmation : son message devient la pilule « Annuler » (les champs d’avant de CETTE fiche)' },
  // Gardées — extérieures (chez un tiers, ne se défont pas).
  { cle: 'ext-vinted', geste: 'Offres, messages, favoris, acceptation auto, republier, brouillon, mise en ligne, couleur d’un brouillon', ou: 'Messages, Favoris, Republier', decision: 'gardee', pourquoi: 'part chez Vinted (§3) : un message ou une suppression ne revient pas' },
  { cle: 'ext-ebay', geste: 'Publier, modifier prix/stock/texte, supprimer, règle d’offre, programmer, remettre en vente, baisser le prix', ou: 'eBay', decision: 'gardee', pourquoi: 'part chez eBay, sans retour' },
  { cle: 'ext-leboncoin', geste: 'Supprimer de Leboncoin, relancer le dépôt, ouvrir N ventes', ou: 'Leboncoin', decision: 'gardee', pourquoi: 'part chez Leboncoin (supprimer passe toujours par son clic confirmé, §3)' },
  { cle: 'ext-vestiaire', geste: 'Déjà publiée sur Vestiaire, clé Photoroom', ou: 'Vestiaire', decision: 'gardee', pourquoi: 'passe par l’extension (`vcMarque`) ou efface une clé du coffre' },
  { cle: 'ext-facture', geste: 'Envoyer / renvoyer / annuler une facture, déconnecter la boîte', ou: 'Factures Pro', decision: 'gardee', pourquoi: 'un e-mail parti ne revient pas ; numérotation légale continue' },
  { cle: 'ext-compte', geste: 'Résilier, changer d’offre, se déconnecter partout, déconnecter un appareil, retirer Discord, équipe, adresses e-mail', ou: 'Réglages', decision: 'gardee', pourquoi: 'paiement, sessions, ou accès d’un tiers' },
  { cle: 'ext-impression', geste: 'Vérifier avant impression, tamponner le bordereau téléchargé', ou: 'Colis', decision: 'gardee', pourquoi: 'un bordereau imprimé part sur un carton' },
  // Gardées — numéros (§5 : un N° est écrit sur un carton, jamais réattribué).
  { cle: 'num', geste: 'N° déjà servi, nouveau N°, N° porté par un autre, donner un N° libre, reprendre un ancien N°, remise en ligne « même paire », Vestiaire « Un seul N° » / défaire', ou: 'Annonces, Stock, Vestiaire', decision: 'gardee', pourquoi: 'un N° posé ou changé s’écrit là où l’article est rangé : jamais « annulé » en silence' },
  { cle: 'num-perdu', geste: 'Déclarer perdu, « n’est plus chez toi », « je m’en sépare »', ou: 'Ventes, Annonces, Ma journée', decision: 'gardee', pourquoi: 'sort la paire du stock et vide sa case au garage ; Ma journée est le chantier d’un autre agent' },
  // Gardées — suppressions et prix d'achat (il les saisit lui-même, §2.5).
  // (10 nov., lot Y) La corbeille 30 jours (src/corbeille.js) : ces suppressions DANS VRM se rattrapent
  // désormais — pilule « Annuler » 5 s, puis Paramètres → Corbeille. Plus de « Tu es sûr ? ».
  { cle: 'corbeille', geste: 'Supprimer un achat hors plateforme, une dépense, un coût, un pack, un abonnement, un modèle, une réponse rapide, une note ; retirer une fiche à publier', ou: 'Achats, Compta, Paramètres, Messages, fiche paire', decision: 'corbeille', pourquoi: 'va à la corbeille 30 jours (restaurable d’un toucher) : la valeur d’avant revient exactement, même id, même N°' },
  { cle: 'suppr', geste: 'Supprimer une vente saisie, un brouillon eBay, un meuble, une pièce, un article d’inventaire ; vider une grille', ou: 'Compta (ancienne saisie), eBay, Stock', decision: 'gardee', pourquoi: 'pas encore dans la corbeille : ligne à part (brouillons eBay, plan du Stock) ou écran ancien non relié au menu' },
  { cle: 'prix-achat', geste: 'Valider N prix d’achat, répartir un lot, annuler une répartition, poser N prix, remplacer un prix saisi, retirer un fournisseur ou un achat en gros, prix mini', ou: 'Achats, Annonces', decision: 'gardee', pourquoi: 'plusieurs prix d’achat d’un coup : il relit la liste avant (il les saisit lui-même)' },
  { cle: 'stock-plan', geste: 'Retirer un N° d’une case, libérer une case', ou: 'Stock', decision: 'gardee', pourquoi: 'le plan du Stock a sa propre ligne et sa relecture (`planLu`) : pas branché sur la file du geste (à faire avec le lot X)' },
  { cle: 'restaurer', geste: 'Importer / restaurer une sauvegarde, début de l’import', ou: 'Réglages', decision: 'gardee', pourquoi: 'remplace des données entières' },
  { cle: 'cycle', geste: '« Tous chez moi »', ou: 'Ma journée', decision: 'gardee', pourquoi: 'Ma journée est le chantier d’un autre agent (lot A) : pas touché' },
];

// ── ⌘K : les actions ─────────────────────────────────────────────────────────
// `num` : l'action porte sur un N° (elle n'apparaît que si la requête en contient un).
// `mots` : ce qu'on peut taper (sans accents, en minuscules ; un début de mot suffit).
export const ACTIONS_RECHERCHE = [
  { id: 'imprimer-jour', libelle: 'Imprimer les bordereaux du jour', sous: 'Colis → « Tout imprimer » : tu choisis, puis tu imprimes', icone: 'printer', mots: ['imprimer', 'impression', 'bordereaux', 'bordereau', 'etiquettes', 'jour', 'tout imprimer'] },
  { id: 'colis-envoyer', libelle: 'Colis à envoyer', sous: 'Colis → À envoyer', icone: 'box', mots: ['colis', 'envoyer', 'expedier', 'poster', 'deposer', 'a envoyer'] },
  { id: 'colis-retirer', libelle: 'Colis à retirer', sous: 'Colis → À retirer', icone: 'truck', mots: ['colis', 'retirer', 'retrait', 'recuperer', 'relais', 'a retirer'] },
  { id: 'export-comptable', libelle: 'Exporter pour mon comptable', sous: 'Argent → un zip : tableur, récap, factures', icone: 'doc', mots: ['exporter', 'export', 'comptable', 'comptabilite', 'compta', 'csv', 'excel', 'tableur', 'pdf', 'zip', 'xlsx', 'justificatifs'] },
  { id: 'ma-configuration', libelle: 'Ma configuration', sous: 'Plateformes, statut, numéro, affichage, notifications', icone: 'gear', mots: ['configuration', 'configurer', 'config', 'statut', 'plateformes', 'demarrage'] },
  { id: 'ma-journee', libelle: 'Ma journée', sous: 'Ce qu’il y a à faire aujourd’hui', icone: 'home', mots: ['journee', 'aujourd', 'accueil', 'ma journee'] },
  // (10 nov., lot L) La calculette d'achat : elle OUVRE une feuille qui n'écrit rien.
  { id: 'calculette', libelle: 'Calculette d’achat', sous: 'Combien je gagne si je l’achète X € ?', icone: 'euro', mots: ['calculette', 'calculer', 'calcul', 'combien', 'gagner', 'gagne', 'benefice', 'marge', 'rentable', 'acheter'] },
  { id: 'achats', libelle: 'Mes achats', sous: 'Achats', icone: 'bag', mots: ['achats', 'achat', 'acheter'] },
  { id: 'reglages', libelle: 'Réglages', sous: 'Paramètres de VRM', icone: 'gear', mots: ['reglages', 'parametres', 'preferences', 'settings', 'options'] },
  { id: 'ouvrir-num', num: true, libelle: (n) => `Ouvrir N°${n}`, sous: 'La fiche de la paire', icone: 'tag', mots: ['ouvrir', 'fiche', 'voir', 'histoire', 'paire'] },
  { id: 'baisser-prix', num: true, libelle: (n) => `Baisser le prix de N°${n}`, sous: 'La feuille du prix — rien n’est envoyé avant « Appliquer »', icone: 'euro', mots: ['baisser', 'prix', 'changer', 'modifier', 'promo', 'reduire', 'diminuer'] },
  { id: 'stock-num', num: true, libelle: (n) => `Voir N°${n} au Stock`, sous: 'Où il est rangé', icone: 'grid', mots: ['stock', 'ranger', 'rangement', 'garage', 'case', 'ou'] },
];
// Les actions proposées SUR LE CHAMP VIDE (après les suggestions).
export const ACTIONS_VIDE = ['imprimer-jour', 'colis-retirer', 'export-comptable', 'ma-configuration'];
// Un N° tapé SEUL : ce qui s'ajoute à « Tout sur le N° » (qui ouvre déjà la fiche).
export const ACTIONS_NUM_SEUL = ['baisser-prix', 'stock-num'];

const VIDES = new Set(['de', 'du', 'des', 'le', 'la', 'les', 'l', 'd', 'un', 'une', 'mon', 'ma', 'mes', 'a', 'au', 'aux', 'pour', 'sur', 'en', 'et', 'n', 'no', 'num', 'numero', 'paire', 'article']);
export const normaliser = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, ' ').replace(/[^a-z0-9°#\s]/g, ' ').replace(/\s+/g, ' ').trim();

// Le N° d'une requête mêlée de mots (« baisser le prix de 88 », « n°b125 », « #88 »).
// `lireNumero(texte)` : la règle de la loupe (`lireNumeroCherche`) — un N° ou null.
export function numeroDansRequete(q, lireNumero) {
  if (typeof lireNumero !== 'function') return null;
  const brut = String(q == null ? '' : q).trim();
  if (!brut) return null;
  const seul = lireNumero(brut);
  if (seul) return { cle: seul, seul: true };
  const t = brut.replace(/\b(n|no|num|numero|numéro)\s*[°º.]?\s*(?=[a-z]?\d)/gi, '').replace(/[#°º]/g, ' ').split(/\s+/).filter(Boolean);
  for (let i = t.length - 1; i >= 0; i--) { if (!/\d/.test(t[i])) continue; const k = lireNumero(t[i]); if (k) return { cle: k, seul: false, mot: t[i] }; }
  return null;
}

// Les actions pour une requête. `lireNumero` : la règle des N° de la loupe.
// Rend [{ id, libelle, sous, icone, num }] — au plus `max`. Chaque mot tapé (hors
// petits mots) doit être le DÉBUT d'un mot de l'action ; un N° seul ne propose que
// ACTIONS_NUM_SEUL ; une requête sans N° ne propose jamais une action à N°.
export function actionsPour(q, { lireNumero, max = 4 } = {}) {
  const brut = String(q == null ? '' : q).trim();
  const parId = (id) => ACTIONS_RECHERCHE.find((a) => a.id === id);
  const forme = (a, n) => ({ id: a.id, libelle: typeof a.libelle === 'function' ? a.libelle(n) : a.libelle, sous: a.sous, icone: a.icone, num: n || null });
  if (!brut) return ACTIONS_VIDE.map(parId).filter(Boolean).map((a) => forme(a, null));
  const num = numeroDansRequete(brut, lireNumero);
  if (num && num.seul) return ACTIONS_NUM_SEUL.map(parId).filter(Boolean).map((a) => forme(a, num.cle));
  let txt = normaliser(brut);
  if (num && num.mot) txt = normaliser(brut.replace(num.mot, ' '));
  const mots = txt.split(' ').filter((m) => m && !VIDES.has(m) && !/^\d+$/.test(m));
  if (!mots.length || !mots.some((m) => m.length >= 3)) return [];
  const out = [];
  for (const a of ACTIONS_RECHERCHE) {
    if (!!a.num !== !!num) continue;
    const vocab = [...new Set([...a.mots, ...normaliser(typeof a.libelle === 'function' ? a.libelle('') : a.libelle).split(' ')].flatMap((m) => normaliser(m).split(' ')).filter(Boolean))];
    let score = 0, tous = true;
    for (const m of mots) {
      const exact = vocab.includes(m);
      const debut = !exact && m.length >= 2 && vocab.some((v) => v.startsWith(m));
      if (exact) score += 2; else if (debut) score += 1; else { tous = false; break; }
    }
    if (tous && score > 0) out.push({ a, score });
  }
  out.sort((x, y) => y.score - x.score);
  return out.slice(0, max).map(({ a }) => forme(a, num ? num.cle : null));
}

// Ce qu'une action OUVRE (aucune écriture, aucun envoi) — lu par la coque et le banc.
// tab : l'onglet ; colis : l'onglet de Colis ; feuille : 'lot' (Tout imprimer),
// 'prix' (PrixPartout), 'fiche' (FichePaire), 'configuration', 'export' ; stock : un N°.
export function destinationAction(a) {
  if (!a) return null;
  switch (a.id) {
    case 'imprimer-jour': return { tab: 'cat_bord', colis: 'envoyer', feuille: 'lot' };
    case 'colis-envoyer': return { tab: 'cat_bord', colis: 'envoyer' };
    case 'colis-retirer': return { tab: 'cat_bord', colis: 'retirer' };
    case 'export-comptable': return { tab: 'compta', feuille: 'export' };
    case 'ma-configuration': return { feuille: 'configuration' };
    case 'ma-journee': return { tab: 'journee' };
    case 'achats': return { tab: 'achats' };
    case 'calculette': return { feuille: 'calculette' };
    case 'reglages': return { tab: 'settings' };
    case 'ouvrir-num': return a.num ? { feuille: 'fiche', num: a.num } : null;
    case 'baisser-prix': return a.num ? { feuille: 'prix', num: a.num } : null;
    case 'stock-num': return a.num ? { tab: 'garage', stock: a.num } : null;
    default: return null;
  }
}

// La demande d'ouverture d'une carte qui vit dans un écran chargé à la demande
// (Compta → « Exporter pour mon comptable ») : posée par la coque, lue par l'écran.
export const DEMANDE_COMMANDE = { export: 0 };
