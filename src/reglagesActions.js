import { tr } from './i18n/index.js';   // (15 nov., finition) le titre court, dans les 5 langues
// Ne transforme jamais une lecture inconnue en absence ou en panne.
// Hors de l'app (bancs node), le dictionnaire n'est pas chargé : la phrase française d'origine, en court.
const sansEmail=(n)=>{ const c='fin.reglages.sansEmail'; const t=tr(c,{n}); return t&&t!==c?t:`${n} compte${n>1?'s':''} sans e-mail`; };
// (24 nov., textes-restes) Le geste et la ligne « à confirmer », dans la langue ; même repli français hors de l'app.
const dit=(c,v,fr)=>{ const t=tr(c,v); return t&&t!==c?t:fr; };
export function actionsReglages({comptes=[],emails=null,preuves=null}) {
  const actions=[];
  if(emails) {
    const sans=comptes.filter(c=>!String(emails[String(c.vinted_user_id)]||'').trim());
    if(sans.length) actions.push({id:'adresses',titre:sansEmail(sans.length),texte:'',geste:dit('reglages.action.associer',undefined,'Associer une adresse'),cible:'comptes'});
  }
  if(preuves?.cloisonnee && preuves?.adresses) {
    const attente=Object.entries(preuves.adresses).filter(([,p])=>p && ['envoyee','expiree'].includes(p.etat));
    if(attente.length) actions.push({id:'confirmation',titre:dit('reglages.action.aConfirmer',{n:attente.length},`${attente.length} adresse${attente.length>1?'s':''} à confirmer`),texte:'',geste:dit('reglages.action.verifier',undefined,'Vérifier'),cible:'adresses'});
  }
  return actions;
}
