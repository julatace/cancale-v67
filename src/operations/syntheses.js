// Synthèses de lecture : aucune modification du stock ni des missions.
export function passationMissions(missions = [], maintenant) {
  const now = Date.parse(maintenant);
  const prochaines = missions.filter(m=>['attribuee','en_cours'].includes(m.etat)).slice().sort((a,b)=>{
    const x=Date.parse(a.echeance),y=Date.parse(b.echeance);
    return (Number.isFinite(x)?x:Infinity)-(Number.isFinite(y)?y:Infinity) || String(a.cree||'').localeCompare(String(b.cree||''));
  });
  return {
    bloquees: missions.filter(m=>m.etat==='bloquee'),
    avalider: missions.filter(m=>m.etat==='terminee'),
    prochaines,
    validees: missions.filter(m=>{const at=Date.parse(m.modifie);return m.etat==='validee' && Number.isFinite(now) && at<=now && now-at<=86400000;})
  };
}
export function reapprovisionnement(consommables = []) {
  const inconnus=[], lignes=[];
  for(const x of consommables){
    if(!Number.isSafeInteger(x.stock)||x.stock<0||!Number.isSafeInteger(x.seuil)||x.seuil<0){inconnus.push(x);continue;}
    if(x.stock<=x.seuil)lignes.push({...x,minimum:x.seuil+1-x.stock});
  }
  return {lignes:lignes.sort((a,b)=>String(a.titre).localeCompare(String(b.titre),'fr')),inconnus};
}
export function csvReappro(lignes) {
  const cellule=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
  return '\uFEFF'+[['Consommable','Unité','Stock compté','Seuil','Quantité minimale pour dépasser le seuil'],...lignes.map(x=>[x.titre,x.unite,x.stock,x.seuil,x.minimum])].map(l=>l.map(cellule).join(';')).join('\r\n');
}
