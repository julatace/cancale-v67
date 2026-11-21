import test from'node:test';import assert from'node:assert/strict';
import{libellePeriodeAffichee,libellePlage,raccourcisPeriode,raccourcisCarte}from'../../src/periodeCalendrier.js';
const maintenant=new Date(2026,10,8,12),demain=new Date(2026,10,9,12);
test('Les raccourcis courants gardent leur nom, les anciens montrent leurs dates',()=>{
 for(const r of[...raccourcisPeriode(maintenant),...raccourcisCarte(maintenant)]){
  const v=r.valeur;assert.equal(libellePeriodeAffichee(v,maintenant),v.label);
  if(['7 derniers jours','30 derniers jours','aujourd’hui'].includes(v.label))assert.equal(libellePeriodeAffichee(v,demain),libellePlage(v.from,v.to));
 }
 const semaine=raccourcisCarte(maintenant).find(r=>r.cle==='semaine').valeur;
 assert.equal(libellePeriodeAffichee(semaine,demain),libellePlage(semaine.from,semaine.to));
});
test('Libellé relatif faux, personnalisé ou invalide : les bornes restent inchangées',()=>{
 const from=new Date(2026,9,1),to=new Date(2026,9,31);const f=from.getTime(),t=to.getTime();
 for(const label of['7 derniers jours','ce mois','mois dernier','ce trimestre','cette année',false,{},' ']){
  const v={from,to,label};const copie={...v};const attendu=label==='mois dernier'?'mois dernier':libellePlage(from,to);
  assert.equal(libellePeriodeAffichee(v,maintenant),attendu);assert.deepEqual(v,copie);
 }
 assert.equal(libellePeriodeAffichee({from,to,label:'Clôture validée'},maintenant),'Clôture validée');assert.equal(from.getTime(),f);assert.equal(to.getTime(),t);
 assert.equal(libellePeriodeAffichee({from,to:null,label:'7 derniers jours'},maintenant),libellePlage(from,null));
});
