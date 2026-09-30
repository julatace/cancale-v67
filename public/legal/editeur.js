// ════════════════════════════════════════════════════════════════════════
//  L'IDENTITÉ DE L'ÉDITEUR — UNE SEULE SOURCE pour les cinq pages légales.
//  ⚠️ Ces informations appartiennent à Julien : elles ne se devinent pas
//  (CLAUDE.md §2.3). Tant qu'un champ vaut null, la page affiche
//  « à compléter » en surligné — jamais une valeur inventée.
//  Pour les remplir : remplacer null par le texte entre guillemets.
// ════════════════════════════════════════════════════════════════════════
window.VRM_EDITEUR = {
  nom: null,            // raison sociale ou « Prénom Nom (entrepreneur individuel) »
  forme: null,          // ex. « Entrepreneur individuel (micro-entreprise) », « SAS au capital de 1 000 € »
  adresse: null,        // adresse du siège / domiciliation
  siret: null,          // 14 chiffres
  rcs: null,            // ex. « RCS Saint-Malo 123 456 789 » ou « non inscrit au RCS »
  tva: null,            // n° de TVA intracommunautaire, ou « TVA non applicable, art. 293 B du CGI »
  email: null,          // adresse de contact (aussi point de contact DSA et demandes RGPD)
  telephone: null,      // obligatoire pour une activité commerciale (LCEN art. 6-III)
  directeur: null,      // directeur de la publication (souvent le représentant légal)
  mediateur: null,      // médiateur de la consommation : nom + site web (art. L612-1 C. conso)
};
(function () {
  var E = window.VRM_EDITEUR || {};
  var aCompleter = { nom: 'raison sociale', forme: 'forme juridique', adresse: 'adresse', siret: 'SIRET',
    rcs: 'immatriculation', tva: 'TVA', email: 'e-mail de contact', telephone: 'téléphone',
    directeur: 'directeur de la publication', mediateur: 'médiateur de la consommation' };
  document.querySelectorAll('[data-e]').forEach(function (el) {
    var k = el.getAttribute('data-e'); var v = E[k];
    if (v) { if (k === 'email') { el.innerHTML = ''; var a = document.createElement('a'); a.href = 'mailto:' + v; a.textContent = v; el.appendChild(a); } else el.textContent = v; }
    else { el.textContent = 'à compléter : ' + (aCompleter[k] || k); el.className = 'todo'; }
  });
})();
