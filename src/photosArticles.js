// Les photos sont reliées par l'identité d'annonce, jamais par son titre.
const adresse = value => {
  if (typeof value === 'string') return /^(https?:\/\/|blob:|data:image\/)/i.test(value) ? value : null;
  if (!value || typeof value !== 'object') return null;
  return adresse(value.url) || adresse(value.imageUrl) || adresse(value.src)
    || adresse(value.thumbnails?.[0]);
};
export function photoArticle(article) {
  if (!article) return null;
  return adresse(article.photo_url) || adresse(article.photoUrl)
    || adresse(article.image_url) || adresse(article.imageUrl)
    || adresse(article.photo) || adresse(article.image)
    || adresse(article.photos?.[0]) || adresse(article.images?.[0])
    || adresse(article.item?.photo) || adresse(article.item?.photos?.[0])
    || adresse(article.item?.image) || adresse(article.item?.photo_url);
}
export function photoCommande(commande, annonces = []) {
  const ligne = commande?.lineItems?.[0];
  const direct = photoArticle(commande) || photoArticle(ligne);
  if (direct) return direct;
  const id = ligne?.legacyItemId || commande?.item_id || commande?.item?.id || commande?.legacyItemId;
  if (id == null || !String(id).trim()) return null;
  const compte = commande?._acc?.vinted_user_id;
  const memes = annonces.filter(a => String(a.id ?? a.itemId ?? '') === String(id)
    && !(compte && a._acc?.vinted_user_id && String(a._acc.vinted_user_id) !== String(compte)));
  return memes.length === 1 ? photoArticle(memes[0]) : null;
}
