export function qualiteVentes(lignes=[]){
 const r={total:0,achatManquant:0,prixManquant:0,fraisAConfirmer:0,fraisNonSuivis:0,calculables:0,horsCalcul:0};
 for(const l of lignes){if(l?.incluse!==true)continue;r.total++;
  if(l.supporte===false){r.horsCalcul++;continue;}
  if(l.achatConnu!==true)r.achatManquant++;
  if(l.prixConnu!==true)r.prixManquant++;
  if(l.fraisSuivis===false)r.fraisNonSuivis++;else if(l.fraisConfirmes!==true)r.fraisAConfirmer++;
  if(l.achatConnu===true&&l.prixConnu===true&&l.valide===true)r.calculables++;
 }
 return r;
}
