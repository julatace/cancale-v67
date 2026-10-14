// Un champ vide n’est pas un montant nul. Afficher les décimales sans arrondi implicite.
export function formaterMontantEbay(value,currency){
 if(value==null || !['string','number'].includes(typeof value))return '—';
 const match=/^(-?)(\d{1,15})(?:[.,](\d{1,8}))?$/.exec(String(value).trim());
 if(!match)return '—';
 const fraction=(match[3] || '').replace(/0+$/,'');
 if(fraction.length>2)return '—';
 const entier=BigInt(match[2]),decimales=fraction.padEnd(2,'0');
 const signe=match[1] && (entier!==0n || decimales!=='00')?'-':'';
 const code=typeof currency==='string'?currency.trim():'';
 return signe+new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(entier)+','+decimales+(code?' '+(code==='EUR'?'€':code):'');
}
