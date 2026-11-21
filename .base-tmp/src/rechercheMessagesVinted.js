const accents=v=>String(v??'').normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase('fr-FR');
const mots=v=>accents(v).replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const numero=v=>accents(v).replace(/\s+/g,'');
// La recherche ne crée aucun lien article/stock : elle lit le numéro déjà relié
// par l’identité native de la conversation et de son article.
export function correspondRechercheMessage(conversation,paire,recherche){
 const brut=String(recherche??'').normalize('NFC').trim().slice(0,200);if(!brut)return true;
 const num=paire?.num==null?'':numero(paire.num);
 const reference=/(?:^|\s)(?:n[°º]|n[o.](?:\s+|(?=\d))|num[ée]ro(?:\s+|(?=\d))|#)\s*([\p{L}\p{N}_-]+)/giu;
 const explicites=[...brut.matchAll(reference)];
 if(explicites.some(x=>!num||numero(x[1])!==num))return false;
 const reste=brut.replace(reference,' ');
 if(!reste.trim())return true;
 if(num&&numero(reste)===num)return true;
 const texte=mots([conversation?.opposite_user?.login,conversation?.item_title,conversation?.item?.title,paire?.titre,conversation?.description].filter(Boolean).join(' '));
 const termes=mots(reste).split(/\s+/).filter(Boolean),entiers=new Set(texte.split(' '));
 return termes.length>0&&termes.every(t=>num&&numero(t)===num||(/^\d+$/.test(t)?entiers.has(t):texte.includes(t)));
}
