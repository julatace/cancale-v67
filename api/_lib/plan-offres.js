// ════════════════════════════════════════════════════════════════════════════
//  LES OFFRES, EN CLAIR (sorti de plan-regle.js le 16 nov., lot vitesse-lectures)
// ════════════════════════════════════════════════════════════════════════════
//  La page d'accueil publique ne lit que les noms, les phrases et le supplément :
//  ce petit module, sans la règle des plans (plan-regle.js les ré-exporte à
//  l'identique — une seule source, pour l'app, le serveur et l'accueil).
// Le prix d'un compte Vinted vendeur de plus, en Solo (centimes) — la seule valeur.
export const PRIX_COMPTE_SUP_CENTIMES = 300;
// « 3 € » / « 2,50 € » : le texte du supplément, écrit une fois.
export const prixCompteSupTexte = (c = PRIX_COMPTE_SUP_CENTIMES) => (c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2).replace('.', ',')) + '\u00a0€';

// Les offres, en clair : une phrase par offre, la même dans l'app, la page
// d'accueil et (en substance) les CGV.
export const OFFRES = Object.freeze({
  solo: Object.freeze({ nom: 'Solo', phrase: 'Un compte vendeur par plateforme (un Vinted, un Leboncoin, un eBay, un Vestiaire) — ventes, annonces, colis à envoyer, offres et compta de ce compte — et autant de comptes d’achat que tu veux (leurs achats et leurs retraits).',
    // (13 nov., lot 56) Le supplément, en une ligne (Paramètres, accueil) : la même valeur partout.
    supplement: `1 compte Vinted vendeur inclus · +${prixCompteSupTexte()}/mois par compte de plus` }),
  pro: Object.freeze({ nom: 'Pro', phrase: 'Comptes vendeurs illimités : tous tes comptes vendent, tout entre dans tes totaux.' }),
});
