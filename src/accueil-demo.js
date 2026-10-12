// ── LA DÉMONSTRATION : UNE TABLE POUR LA PAGE ET POUR LE FILM ────────────────
// ⚠️ TOUT EST INVENTÉ (§2.3, dépôt public). Aucun pseudo : les comptes sont des
//    LIBELLÉS (« Perso », « Boutique »). Aucun nom ni adresse d'acheteur. Les
//    codes de retrait et le relais sont génériques.
// ⚠️ Les écrans dessinés LISENT cette table : aucun nombre n'est tapé en dur
//    dans un composant. `scripts/audit-accueil-demo.cjs` vérifie qu'elle se
//    tient (le total d'avant + la vente = le total d'après, etc.) — un écran
//    qui roulerait de 1 159,50 € à un autre chiffre que 1 244,50 € mentirait.
// ⚠️ JS pur, sans React : le banc et l'audit l'importent depuis Node.
export const PLATEFORMES = {
  vinted: { nom: 'Vinted', point: '#12B7BE' },
  leboncoin: { nom: 'Leboncoin', point: '#F56B2A' },
  ebay: { nom: 'eBay', point: '#86B817' }, // ⚠️ jamais bleu : il se confondait avec l'accent
};

export const DEMO = {
  comptes: [
    { id: 'perso', nom: 'Perso', plateforme: 'vinted' },
    { id: 'boutique', nom: 'Boutique', plateforme: 'vinted' },
    { id: 'lbc', nom: 'Leboncoin', plateforme: 'leboncoin' },
    { id: 'ebay', nom: 'eBay', plateforme: 'ebay' },
  ],
  vente: {
    n: '128', titre: 'Nike Air Max 90', taille: 'T42', prix: 85, compte: 'perso',
    transporteur: 'Mondial Relay', delai: '5 j pour poster',
    ailleurs: [
      { plateforme: 'leboncoin', titre: 'Nike Air Max 90 T42', prix: 90, ident: 'réf. VRM-128' },
      { plateforme: 'ebay', titre: 'Nike Air Max 90 Taille 42', prix: 95, ident: 'SKU VRM-128' },
    ],
  },
  colis: [
    { n: '131', titre: 'Adidas Samba OG', taille: 'T40', compte: 'boutique', transporteur: 'Vinted Go',
      delai: 'à poster aujourd’hui', court: 'aujourd’hui', urgent: true, pret: true },
    { n: '128', titre: 'Nike Air Max 90', taille: 'T42', compte: 'perso', transporteur: 'Mondial Relay',
      delai: '5 j pour poster', court: '5 j', urgent: false, pret: true },
    { n: '97', titre: 'Veste en jean Levi’s', taille: 'M', compte: 'boutique', transporteur: 'Vinted',
      delai: '4 j pour poster', court: '4 j', urgent: false, pret: false },
  ],
  stock: ['124', '125', '126', '127', '128', '129', '130', '131'],
  jour: {
    colisAvant: 2, colisApres: 3, urgents: 1,
    aRetirerAvant: 0, aRetirerApres: 2,
    relais: { n: 2, lieu: 'Relais du Marché' },
    messages: { n: 4, comptes: ['Perso', 'Boutique'] },
    recu: 812.30,
    derniereAvant: { titre: 'Veste en jean Levi’s', prix: 38, compte: 'Boutique', quand: 'hier' },
  },
  mois: {
    avant: 1159.50, apres: 1244.50, ventesAvant: 22, ventesApres: 23,
    vintedAvant: 956.00, vinted: 1041.00, leboncoin: 158.50, ebay: 45.00,
    aDater: { n: 2, total: 64.00 },
  },
  reste: {
    code: '4821 73', lieu: 'Relais du Marché', attente: 212.40, dispo: 96.00,
    vente: { titre: 'Sac Longchamp Le Pliage', prix: 45, compte: 'Boutique' },
  },
};

// Le nom d'affichage d'un compte (« Perso »), d'après son identifiant.
export const nomCompte = (id) => (DEMO.comptes.find((c) => c.id === id) || {}).nom || '';

// 1 244,50 € — espace fine insécable entre les milliers, virgule, deux décimales.
export const euros = (n) => `${Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
