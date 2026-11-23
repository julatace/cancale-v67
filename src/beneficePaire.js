// Les montants inconnus restent inconnus. Aucun frais de port payé par
// l'acheteur n'est déduit : transportVendeur désigne une dépense saisie du vendeur.
// (10 nov., lot BA) `emballage` : le coût d'emballage SAISI pour cette vente — un frais
// comme les autres (dans `coutsVente`, donc dans tous les totaux) ; vide = non saisi,
// jamais deviné (la cascade de la vente le nomme, src/coutVente.js).
export function centimes(v){
 if(v==null || String(v).trim()==='')return null;
 const s=String(v).trim().replace(',','.');
 if(!/^\d{1,9}(?:\.\d{1,2})?$/.test(s))return null;
 const [a,b='']=s.split('.');return Number(a)*100+Number(b.padEnd(2,'0'));
}
// (21 nov., lot rentabilite — choix n° 41 de Julien) LE FORFAIT D'EMBALLAGE : un montant qu'IL règle (Ventes › une vente
// › Emballage › « Forfait », `vrm_forfait_emballage` = { actif, montant }), ÉTEINT par défaut. Allumé, il compte pour
// CHAQUE vente dont l'emballage n'est pas saisi — un frais comme les autres, dans `coutsVente`, donc dans TOUS les
// totaux (bénéfice du jour, du mois, relevé, cascade) ; un emballage saisi sur la vente passe toujours devant. Éteint,
// vide ou illisible ⇒ rien (aucun 0 deviné). Posé par l'app (`poserForfaitEmballage`) à la lecture du réglage.
let FORFAIT_EMBALLAGE=null;
export function forfaitDe(r){const c=r && r.actif===true ? centimes(r.montant) : null;return c!=null && c>0 ? c : null;}
export function poserForfaitEmballage(r){FORFAIT_EMBALLAGE=forfaitDe(r);return FORFAIT_EMBALLAGE;}
export const forfaitEmballagePose=()=>FORFAIT_EMBALLAGE;
export const champsCharges=[['commission','Commission plateforme'],['transportVendeur','Port payé par moi'],['remboursement','Remboursement acheteur'],['autresFrais','Autres frais'],['emballage','Emballage']];
export function coutsVente(e={},{forfait=FORFAIT_EMBALLAGE}={}){
 let cents=centimes(e?.fees) ?? 0,valid=!(e?.fees!=null && String(e.fees).trim()!=='' && centimes(e.fees)==null);
 for(const [key] of champsCharges){const v=e?.[key],c=centimes(v);if(v!=null && String(v).trim()!=='' && c==null)valid=false;cents+=c ?? 0;}
 const embVide=e?.emballage==null || String(e.emballage).trim()==='';
 const emballageForfait=embVide && Number.isSafeInteger(forfait) && forfait>0 ? forfait : null;
 if(emballageForfait!=null)cents+=emballageForfait;
 return {cents,total:cents/100,complet:valid && e?.fraisComplets===true,valid,emballageForfait};
}
export function beneficePaire(prix,e){
 const vente=centimes(prix),achat=centimes(e?.buyPrice),charges=coutsVente(e);
 return {...charges,vente,achat,benefice:vente==null || achat==null || !charges.valid?null:(vente-achat-charges.cents)/100};
}
