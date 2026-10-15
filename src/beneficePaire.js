// Les montants inconnus restent inconnus. Aucun frais de port payé par
// l'acheteur n'est déduit : transportVendeur désigne une dépense saisie du vendeur.
export function centimes(v){
 if(v==null || String(v).trim()==='')return null;
 const s=String(v).trim().replace(',','.');
 if(!/^\d{1,9}(?:\.\d{1,2})?$/.test(s))return null;
 const [a,b='']=s.split('.');return Number(a)*100+Number(b.padEnd(2,'0'));
}
export const champsCharges=[['commission','Commission plateforme'],['transportVendeur','Port payé par moi'],['remboursement','Remboursement acheteur'],['autresFrais','Autres frais']];
export function coutsVente(e={}){
 let cents=centimes(e?.fees) ?? 0,valid=!(e?.fees!=null && String(e.fees).trim()!=='' && centimes(e.fees)==null);
 for(const [key] of champsCharges){const v=e?.[key],c=centimes(v);if(v!=null && String(v).trim()!=='' && c==null)valid=false;cents+=c ?? 0;}
 return {cents,total:cents/100,complet:valid && e?.fraisComplets===true,valid};
}
export function beneficePaire(prix,e){
 const vente=centimes(prix),achat=centimes(e?.buyPrice),charges=coutsVente(e);
 return {...charges,vente,achat,benefice:vente==null || achat==null || !charges.valid?null:(vente-achat-charges.cents)/100};
}
// Sur VINTED, le boost est le seul frais que rien ne donne (mesuré le 15 oct. :
// aucune source n'a son prix par annonce). Une case « Boost » vide veut donc
// dire INCONNU, jamais 0 : le bénéfice d'une vente Vinted n'est complet que si
// le boost est écrit (0 s'il n'y en a pas eu). eBay garde sa règle.
export const boostConnu=(e)=>centimes(e?.fees)!=null;
export function beneficeVinted(prix,e){
 const b=beneficePaire(prix,e);
 return {...b,complet:b.complet && boostConnu(e),boostInconnu:!boostConnu(e)};
}
