// Ne transforme jamais une lecture inconnue en absence ou en panne.
export function actionsReglages({comptes=[],emails=null,preuves=null}) {
  const actions=[];
  if(emails) {
    const sans=comptes.filter(c=>!String(emails[String(c.vinted_user_id)]||'').trim());
    if(sans.length) actions.push({id:'adresses',titre:`${sans.length} compte${sans.length>1?'s':''} sans adresse associée`,texte:'Associe l’adresse qui reçoit ses emails Vinted.',geste:'Associer',cible:'comptes'});
  }
  if(preuves?.cloisonnee && preuves?.adresses) {
    const attente=Object.entries(preuves.adresses).filter(([,p])=>p && ['envoyee','expiree'].includes(p.etat));
    if(attente.length) actions.push({id:'confirmation',titre:`${attente.length} adresse${attente.length>1?'s':''} à confirmer`,texte:'Vérifie le lien reçu dans ta boîte email.',geste:'Vérifier',cible:'adresses'});
  }
  return actions;
}
