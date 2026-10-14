// Les photos sont reliées par l'identité d'annonce, jamais par son titre.
const adresse = (value, profondeur = 0) => {
  if (profondeur > 5) return null;
  if (typeof value === 'string') return /^(https?:\/\/|blob:|data:image\/)/i.test(value) ? value : null;
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) { for (const v of value) { const u = adresse(v, profondeur + 1); if (u) return u; } return null; }
  for (const cle of ['url','imageUrl','src','uri','full_size_url','photo_url','thumbnails']) {
    const u = adresse(value[cle], profondeur + 1); if (u) return u;
  }
  return null;
};
export function photoArticle(article) {
  if (!article) return null;
  for (const value of [article.photo_url,article.photoUrl,article.image_url,article.imageUrl,
    article.photo,article.image,article.photos,article.images,article.imageUrls,
    article.item?.photo,article.item?.photos,article.item?.image,article.item?.photo_url]) {
    const u = adresse(value); if (u) return u;
  }
  return null;
}
export function photoCommande(commande, annonces = []) {
  const ligne = commande?.lineItems?.[0];
  const direct = photoArticle(commande) || photoArticle(ligne);
  if (direct) return direct;
  const id = ligne?.legacyItemId ?? commande?.item_id ?? commande?.item?.id ?? commande?.legacyItemId;
  if (id == null || !String(id).trim()) return null;
  const compte = commande?._acc?.vinted_user_id;
  const compteEbay = commande?._compte;
  const memes = annonces.filter(a => String(a.id ?? a.itemId ?? '') === String(id)
    && !(compte && a._acc?.vinted_user_id && String(a._acc.vinted_user_id) !== String(compte))
    && !(compteEbay && a._compte && String(a._compte) !== String(compteEbay)));
  return memes.length === 1 ? photoArticle(memes[0]) : null;
}
