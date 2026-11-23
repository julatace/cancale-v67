// ── LES COUCHES DE L'IMPRESSION (16 nov., lot tampons-parametres) ──────────────
// Un bordereau s'imprime seul depuis la FICHE d'une vente (rangée ⇒ fiche ⇒ « ⋯ » ⇒
// « Imprimer le bordereau ») : la fiche est à 9000, sa feuille « ⋯ » à 9100
// (src/design/fiche-d.css). « Bordereau prêt » était à 1250 : il s'ouvrait SOUS la
// fiche, invisible, et son « Imprimer » ne se touchait pas (banc tampons-apercu, B3).
// Ordre : fiche 9000 < « ⋯ » 9100 < Bordereau prêt 9200 < l'aperçu avant impression
// 9300 (« Déplacer le tampon » l'ouvre PAR-DESSUS « Bordereau prêt ») < la
// visionneuse du PDF 9500 (« Imprimer » sur ordinateur) < « Mon compte » 10000 <
// confirmations 20000 (Z_CONFIRMATION, App.jsx).
export const Z_BORD_PRET = 9200;
export const Z_APERCU_IMPRESSION = 9300;
