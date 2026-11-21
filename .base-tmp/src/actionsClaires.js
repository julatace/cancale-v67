// Le prix comparé à une offre vient d’une seule annonce du même compte.
export function prixAnnoncePourOffre(annonces,item,uid) {
  if(item==null||!uid||!Array.isArray(annonces))return null;
  const lignes=annonces.filter(it=>it?.id!=null&&String(it.id)===String(item)&&String(it._acc?.vinted_user_id||'')===String(uid));
  if(lignes.length!==1)return null;
  const it=lignes[0],devise=it.currency||it.price?.currency_code||'EUR';
  if(devise!=='EUR')return null;
  const brut=typeof it.price==='object'?it.price?.amount:it.price;
  if(brut==null||typeof brut==='boolean'||String(brut).trim()==='')return null;
  const prix=Number(String(brut).replace(',','.'));
  return Number.isFinite(prix)&&prix>0?prix:null;
}

// Comparaison au centime, uniquement sur les deux montants renseignés.
export function comparaisonMinimum(offre,mini) {
  const centimes=v=>typeof v==='number'&&Number.isFinite(v)&&v>0&&Math.round(v*100)>0&&Number.isSafeInteger(Math.round(v*100))?Math.round(v*100):null;
  const o=centimes(offre),m=centimes(mini);
  if(o==null)return {etat:'offre-inconnue'};
  if(m==null)return {etat:'minimum-inconnu'};
  return {etat:o<m?'sous-minimum':'minimum-atteint',ecart:Math.abs(o-m)/100};
}
