// ════════════════════════════════════════════════════════════════════════
//  L'IDENTITÉ DE L'ÉDITEUR — UNE SEULE SOURCE pour les cinq pages légales.
//  ⚠️ Ces informations appartiennent à Julien : elles ne se devinent pas
//  (CLAUDE.md §2.3). Tant qu'un champ vaut null, la page affiche
//  « à compléter » en surligné — jamais une valeur inventée.
//  Pour les remplir : remplacer null par le texte entre guillemets.
//  ⚠️ (22 octobre) LE SERVEUR LIT AUSSI CE FICHIER (api/_lib/mentions-legales.js)
//  et REFUSE D'OUVRIR LE PAIEMENT tant qu'un champ de `VRM_EDITEUR_OBLIGATOIRES`
//  est vide : on ne vend pas un abonnement sur des CGV qui ne disent ni qui
//  vend, ni où écrire pour se rétracter. Le fichier reste un simple script (pas
//  d'import, pas d'export) : il marche dans les pages ET dans le serveur.
// ════════════════════════════════════════════════════════════════════════
(typeof window !== 'undefined' ? window : globalThis).VRM_EDITEUR = {
  nom: null,            // raison sociale ou « Prénom Nom (entrepreneur individuel) »
  forme: null,          // ex. « Entrepreneur individuel (micro-entreprise) », « SAS au capital de 1 000 € »
  adresse: null,        // adresse du siège / domiciliation
  siret: null,          // 14 chiffres
  rcs: null,            // ex. « RCS Saint-Malo 123 456 789 » ou « non inscrit au RCS »
  tva: null,            // n° de TVA intracommunautaire, ou « TVA non applicable, art. 293 B du CGI »
  email: 'vrm.vinted35+contact@gmail.com',          // adresse de contact (aussi point de contact DSA et demandes RGPD)
  telephone: null,      // obligatoire pour une activité commerciale (LCEN art. 6-III)
  directeur: null,      // directeur de la publication (souvent le représentant légal)
  mediateur: null,      // médiateur de la consommation : nom + site web (art. L612-1 C. conso)
};
// Les libellés, et les champs sans lesquels le paiement reste FERMÉ (tous :
// identité, adresse, immatriculation, TVA, contact, téléphone, directeur de la
// publication, médiateur — art. L111-1, L221-5, L612-1 C. conso, LCEN art. 6-III).
(typeof window !== 'undefined' ? window : globalThis).VRM_EDITEUR_LIBELLES = { nom: 'raison sociale', forme: 'forme juridique', adresse: 'adresse', siret: 'SIRET',
  rcs: 'immatriculation', tva: 'TVA', email: 'e-mail de contact', telephone: 'téléphone',
  directeur: 'directeur de la publication', mediateur: 'médiateur de la consommation' };
(typeof window !== 'undefined' ? window : globalThis).VRM_EDITEUR_OBLIGATOIRES = ['nom', 'forme', 'adresse', 'siret', 'rcs', 'tva', 'email', 'telephone', 'directeur', 'mediateur'];
(function () {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;   // lu par le serveur : rien à afficher
  var E = window.VRM_EDITEUR || {};
  var aCompleter = window.VRM_EDITEUR_LIBELLES || {};
  document.querySelectorAll('[data-e]').forEach(function (el) {
    var k = el.getAttribute('data-e'); var v = E[k];
    if (v) { if (k === 'email') { el.innerHTML = ''; var a = document.createElement('a'); a.href = 'mailto:' + v; a.textContent = v; el.appendChild(a); } else el.textContent = v; }
    else { el.textContent = 'à compléter : ' + (aCompleter[k] || k); el.className = 'todo'; }
  });
})();
