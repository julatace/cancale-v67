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
    article.item_photo,article.item_photos,article.transaction?.item_photo,
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

// L’identité transaction → article vient de Vinted. Les archives restent isolées par compte.
export function photoVenteVinted(commande, annonces = [], itemId = null, archives = {}, transactions = {}) {
  const enrichie = itemId != null ? {...commande,item_id:itemId} : commande;
  const directe = photoCommande(enrichie, annonces);
  if (directe) return directe;
  const id = itemId ?? commande?.item_id ?? commande?.item?.id;
  const uid = commande?._acc?.vinted_user_id;
  const tid=commande?.transaction_id;
  if(uid!=null && tid!=null){const photo=photoArticle(transactions[JSON.stringify([String(uid),String(tid)])]);if(photo)return photo;}
  if (id == null || uid == null) return null;
  return photoArticle(archives[JSON.stringify([String(uid),String(id)])]);
}

export function demandesPhotosVentes(commandes,annonces,identites,archives,transactions,forces=new Set()){
 const out={archives:new Map(),transactions:new Map()};
 for(const o of commandes || []){
  const uid=o?._acc?.vinted_user_id,tid=o?.transaction_id,id=identites?.[String(tid)] ?? o?.item_id ?? o?.item?.id;
  if(uid==null || !/^\d+$/.test(String(uid)))continue;
  if(photoVenteVinted(o,annonces,id,archives,transactions) && !forces.has(JSON.stringify([String(uid),String(tid)])))continue;
  if(tid!=null && /^\d+$/.test(String(tid)))out.transactions.set(`harvest_${uid}_txn_${tid}`,JSON.stringify([String(uid),String(tid)]));
  if(id!=null && /^\d+$/.test(String(id)))out.archives.set(`coffre_${uid}_${id}`,JSON.stringify([String(uid),String(id)]));
 }
 return out;
}
export function photosTransactionsLues(rows,demandes){
 const out={};
 for(const row of rows || []){
  const key=demandes.get(row.id),photo=photoArticle({photo:row.photo}) || photoArticle({photo:row.photoItem});
  if(key && photo)out[key]={photo};
 }
 return out;
}

export function photosVenteVintedCandidates(commande,annonces=[],itemId=null,archives={},transactions={}){
 const uid=commande?._acc?.vinted_user_id,tid=commande?.transaction_id,id=itemId ?? commande?.item_id ?? commande?.item?.id;
 const sources=[photoArticle(commande),id!=null?photoCommande({item_id:id,_acc:commande?._acc},annonces):null,
  uid!=null && tid!=null?photoArticle(transactions[JSON.stringify([String(uid),String(tid)])]):null,
  uid!=null && id!=null?photoArticle(archives[JSON.stringify([String(uid),String(id)])]):null];
 return [...new Set(sources.filter(Boolean))];
}
export function choisirPhotoDisponible(candidates,etat,favorite=null){
 if(favorite && candidates.includes(favorite) && etat(favorite)!=='ko')return favorite;
 return candidates.find(url=>etat(url)!=='ko') || candidates[0] || null;
}
