// Suggestions manuelles pour une vente dont l'annonce n'est plus disponible.
// Une annonce active bloque aussi les anciens enregistrements du même numéro.
export function candidatsVenteSansAnnonce(numeros, annoncesEnLigne, cleNumero) {
  const actifs = new Set([...annoncesEnLigne].map(String));
  const numerosActifs = new Set();
  for (const [id, entree] of Object.entries(numeros || {})) {
    if (actifs.has(id) && entree?.numero != null) numerosActifs.add(cleNumero(entree.numero));
  }
  const historiques = new Map();
  for (const [id, entree] of Object.entries(numeros || {})) {
    if (!entree || entree.numero == null) continue;
    const numero = cleNumero(entree.numero);
    if (!numero || actifs.has(id) || numerosActifs.has(numero)) continue;
    historiques.set(numero, { ...entree, num: String(entree.numero) });
  }
  return [...historiques.values()];
}
