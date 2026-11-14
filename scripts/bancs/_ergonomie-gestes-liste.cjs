// ════════════════════════════════════════════════════════════════════════════
//  Les 15 gestes du banc `ergonomie-gestes.cjs` (14 nov.) — chacun : un plafond de touchers, ses
//  chemins du plus court au plus long, et son BUT vérifié dans la page (un data-*, jamais un libellé).
//  Pas : ['t', sel] toucher · ['s', sel, texte] saisir · ['d', sel] toucher DÉCISIF (compté, pas joué) ·
//  ['a', sel] attendre · ['v', sel] lire (à l'écran, défilé compté, pas un toucher).
// ════════════════════════════════════════════════════════════════════════════
module.exports = ({ vu, BARRE }) => {
  const onglet = (id) => `${BARRE} [data-nav-entree="${id}"]`;
  const menu = '[data-menu-ecrans]';
  const entreeMenu = (id) => `[role="menu"] [data-nav-entree="${id}"]`;
  const loupe = 'button[data-recherche-loupe]';
  const champ = '[data-recherche-champ]';
  // Un N° EN LIGNE de la base inventée (le premier de la vue Republier, numéroté par l'app au chargement) ;
  // « 169 » y est une paire VENDUE (la fiche de toute son histoire).
  const EN_LIGNE = '203';
  return [
    { id: 'imprimer', nom: 'Imprimer les bordereaux du jour', plafond: 2,
      but: vu('[data-lot-imprimer]'),
      chemins: [
        { nom: 'Ma journée → Imprimer', pas: [['t', 'button[data-tuile="envoyer"]'], ['d', '[data-lot-imprimer]']] },
        { nom: 'Ventes → Tout imprimer', pas: [['t', onglet('ventes')], ['t', '[data-colis-barre-btn="imprimer"]'], ['d', '[data-lot-imprimer]']] },
      ] },
    { id: 'retrait', nom: 'Retirer un colis et montrer son code', plafond: 3,
      // Le code se lit SUR la ligne du colis (« ce qu'il faut au comptoir, sans toucher », CarteRelais).
      but: vu('[data-rp-code-visible="418205"]'),
      chemins: [
        { nom: 'Ma journée → À retirer', pas: [['t', 'button[data-tuile="retirer"]'], ['v', '[data-rp-code-visible="418205"]']] },
        { nom: 'Paires → Achats → À retirer', pas: [['t', onglet('paires')], ['t', '[data-paires-segment="achats"]'], ['v', '[data-rp-code-visible="418205"]']] },
      ] },
    { id: 'prixachat', nom: 'Saisir un prix d’achat', plafond: 3,
      // Le champ du prix est OUVERT, le curseur dedans : il tape le prix (une saisie, pas un toucher), puis Entrée.
      but: vu('[data-ask-champ], .vrm-confirmation input'),
      chemins: [
        { nom: 'Ma journée → prix manquants → Saisir', pas: [['t', 'button[data-job="achat-a-relier"]'], ['t', '[data-ar-saisir]']] },
      ] },
    { id: 'trouvernum', nom: 'Trouver la paire N°x', plafond: 3,
      but: vu('[data-fiche-paire]'),
      chemins: [
        { nom: 'Loupe → N° → résultat', pas: [['t', loupe], ['s', champ, EN_LIGNE], ['a', '[data-tout-parcours]'], ['t', `[data-tout-parcours="${EN_LIGNE}"]`]] },
      ] },
    { id: 'offre', nom: 'Répondre à une offre', plafond: 3,
      // Le fil de l'offre ouvert, son geste de réponse à l'écran (Accepter avec l'extension ; sans elle, VRM le dit et
      // renvoie sur Vinted : la place du geste est la même).
      but: vu('.vrm-chat-panel'),
      chemins: [
        { nom: 'Ma journée → messages → l’offre (en tête)', pas: [['t', 'button[data-tuile="messages"]'], ['t', '[data-conv="18999000001"]'], ['d', '[data-offre-geste="accepter"], .vrm-chat-panel [data-plancher-saisir], .vrm-chat-panel a[href*="vinted"]']] },
        { nom: 'Ma journée → messages → Offres reçues → offre', pas: [['t', 'button[data-tuile="messages"]'], ['t', '[data-filtre-offres]'], ['t', '[data-conv="18999000001"]'], ['d', '[data-offre-geste="accepter"], .vrm-chat-panel [data-plancher-saisir], .vrm-chat-panel a[href*="vinted"]']] },
        { nom: '☰ → Messages → offre', pas: [['t', menu], ['t', entreeMenu('messages')], ['t', '[data-conv="18999000001"]'], ['d', '[data-offre-geste="accepter"], .vrm-chat-panel [data-plancher-saisir], .vrm-chat-panel a[href*="vinted"]']] },
      ] },
    { id: 'baisserprix', nom: 'Baisser un prix', plafond: 3,
      but: vu('[data-prix-champ]'),
      chemins: [
        { nom: 'Loupe → N° → Baisser', pas: [['t', loupe], ['s', champ, EN_LIGNE], ['t', '[data-recherche-action="baisser-prix"]'], ['d', '[data-prix-appliquer]']] },
      ] },
    { id: 'republier', nom: 'Republier (à la main, conseillé)', plafond: 3,
      // Le kit « à la main » ouvert pour la paire CHOISIE (c'est lui qui choisit et qui publie, §3) ; le toucher décisif :
      // « Tout copier » / « Ouvrir Vinted ».
      but: vu('[data-kit-main]'),
      chemins: [
        { nom: 'Loupe → N° → Republier', pas: [['t', loupe], ['s', champ, EN_LIGNE], ['t', '[data-recherche-action="republier-num"]'], ['d', '[data-kit-tout-copier], [data-kit-ouvrir-vinted]']] },
        { nom: 'Paires → Republier → coche → À la main', pas: [['t', onglet('paires')], ['t', '[data-vue-republier]'], ['t', '[data-selection-annonce] input[type=checkbox]'], ['t', '[data-republier-main-lancer]'], ['d', '[data-kit-tout-copier], [data-kit-ouvrir-vinted]']] },
      ] },
    { id: 'depose', nom: 'Marquer un colis déposé', plafond: 3,
      // Réversible : la pilule « Annuler » (5 s) remplace toute confirmation.
      but: vu('[data-pilule-annuler]'),
      chemins: [
        { nom: 'Ventes → ⋯ → Déposé', pas: [['t', onglet('ventes')], ['t', '[data-colis-plus="22000000253"]'], ['t', '[data-geste="fait"]']] },
      ] },
    { id: 'relierachat', nom: 'Relier un achat', plafond: 3,
      but: vu('[data-ar-relier]'),
      chemins: [
        { nom: 'Ma journée → sans achat → Relier', pas: [['t', 'button[data-job="achat-a-relier"]'], ['d', '[data-ar-relier]']] },
      ] },
    { id: 'afaire', nom: 'Voir ce qui est à faire', plafond: 0,
      but: vu('[data-tuile], [data-job]'),
      chemins: [{ nom: 'à l’ouverture', pas: [['v', 'button[data-job], button[data-tuile]']] }] },
    { id: 'urssaf', nom: 'Déclarer l’URSSAF du mois', plafond: 3,
      but: vu('[data-urssaf-cest-declare]'),
      chemins: [
        { nom: 'Argent → Déclarer → J’ai déclaré', pas: [['t', onglet('compta')], ['t', '[data-section="declarer"]'], ['d', '[data-urssaf-cest-declare]']] },
      ] },
    { id: 'compte', nom: 'Changer de compte', plafond: 3,
      but: vu('[data-ui-menu-compte="3150001111"]'),
      chemins: [
        { nom: 'Paires → compte ▾ → vendeur_2', pas: [['t', onglet('paires')], ['t', '[data-ui-menu-compte]'], ['t', '[data-ui-compte-choix="3150001111"]']] },
      ] },
    { id: 'message', nom: 'Lire un message', plafond: 3,
      but: vu('.vrm-chat-panel'),
      chemins: [
        { nom: 'Ma journée → messages → fil', pas: [['t', 'button[data-tuile="messages"]'], ['t', '[data-conv]']] },
        { nom: '☰ → Messages → fil', pas: [['t', menu], ['t', entreeMenu('messages')], ['t', '[data-conv]']] },
      ] },
    { id: 'publier', nom: 'Publier une paire partout', plafond: 3,
      // La feuille « Publier partout » de la paire choisie ; le toucher décisif : « Publier ».
      but: vu('[data-publier-partout]'),
      chemins: [
        { nom: 'Loupe → N° → Publier partout', pas: [['t', loupe], ['s', champ, EN_LIGNE], ['t', '[data-recherche-action="partout-num"]'], ['d', '[data-publier-partout]']] },
        { nom: 'Paires → la paire → Publier partout', pas: [['t', onglet('paires')], ['t', '[data-fiche-plus-bouton]'], ['t', '[data-fiche-partout], [data-fiche-publier-ailleurs]'], ['d', '[data-publier-partout]']] },
      ] },
    { id: 'benefice', nom: 'Voir le bénéfice du mois', plafond: 1,
      but: vu('[data-fu-case="benefice-mois"], [data-benef-notion="benefice"]'),
      chemins: [{ nom: 'à l’ouverture', pas: [['v', '[data-fu-case="benefice-mois"]']] }] },
  ];
};
