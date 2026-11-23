// (20 nov., ext. 5.410) LA CONFIRMATION « SANS RETOUR » AVANT DE SUPPRIMER SUR LEBONCOIN — retirée de l'app avec le
// geste (chantier actions-extension), elle vit ici, une seule source, recopiée dans background.js par
// scripts/recopier-gardes-extension.cjs. Le texte est celui de l'app d'avant (`supprimerLbcJournee`, askConfirm
// `danger` + `irreversible`) : titre, une ligne par annonce, ce qui reste (l'article et son N° dans le stock), et le
// bouton « Oui, supprimer de Leboncoin ». Leboncoin n'a pas de corbeille : c'est sans retour.
export function confirmationSupprimerLbc(liste) {
  const l = (Array.isArray(liste) ? liste : []).filter((r) => r && r.id);
  if (!l.length) return null;
  const titre = l.length > 1 ? `Supprimer ${l.length} annonces de Leboncoin ?` : `Supprimer ${l[0].numero ? `le N°${l[0].numero}` : 'cette annonce'} de Leboncoin ?`;
  const lignes = l.map((r) => `${r.numero ? `N°${r.numero} · ` : ''}${String(r.titre || '').slice(0, 50)}${r.ou ? ` — vendu sur ${r.ou}` : ''}`.replace(/ · $/, '')).filter(Boolean);
  return { titre, lignes, reste: 'L’article reste dans ton stock, avec son N°.', sansRetour: 'C’est sans retour : Leboncoin ne rend pas une annonce supprimée.', ok: 'Oui, supprimer de Leboncoin', irreversible: true };
}
