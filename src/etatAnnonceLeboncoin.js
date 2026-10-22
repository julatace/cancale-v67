// L'état de publication et la livraison sont deux informations distinctes.
// Aucune absence dans une page de résultats ne prouve une vente ou une pause.
export function etatAnnonceLeboncoin(ad, ventes = []) {
 const transactions = Array.isArray(ventes) ? ventes : Object.values(ventes || {});
 const vente = transactions.filter(v => v && v.isSeller === true && v.itemId != null && String(v.itemId) === String(ad?.id)
  && !/annul|cancel|refund|rembours/i.test([v.stepStatus,v.parcelStatus,v.stepLabel].join(' ')))
  .sort((a,b)=>String(b.at || '').localeCompare(String(a.at || '')))[0];
 const brut = ad?.status;
 const textes = (typeof brut === 'object' && brut ? [brut.code,brut.value,brut.name,brut.label] : [brut])
  .filter(v=>typeof v==='string').map(v=>v.trim()).filter(Boolean);
 const normaliser = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[_-]+/g,' ').trim();
 const codes = textes.map(normaliser);
 let etat = 'inconnu', label = 'État non reçu';
 if (vente || codes.some(s=>/^(sold|vendu|vendue|sale completed)$/.test(s))) {etat='vendue';label='Vendue';}
 else if (codes.some(s=>/^(paused|pause|en pause|paused by user)$/.test(s))) {etat='pause';label='En pause';}
 else if (codes.some(s=>/^(active|actif|online|published|en ligne)$/.test(s))) {etat='active';label='Active';}
 else if (codes.some(s=>/^(deleted|supprime|supprimee|expired|expire|expiree|refused|refusee|refuse)$/.test(s))) {etat='retiree';label='Retirée ou expirée';}
 else if (textes.length) label = textes[textes.length-1].slice(0,100);
 const suivi=vente ? String(vente.stepLabel || vente.parcelStatus || '').slice(0,160) : '';
 const livraison=vente && (vente.parcelStatus || /colis|livr|expedi|transit|parcel|deliver|ship/i.test(suivi)) ? suivi : '';
 return {etat,label,livraison,suivi};
}
export function lienAnnonceLeboncoin(ad) {
 try {const u=new URL(ad?.url);return u.protocol==='https:' && !u.username && !u.password && /(^|\.)leboncoin\.fr$/.test(u.hostname) ? u.href : '';}
 catch {return '';}
}
