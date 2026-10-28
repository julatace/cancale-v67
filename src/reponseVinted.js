// Une réponse absente ou une panne serveur ne prouve pas que Vinted n’a rien reçu.
export function retourReponseVinted(r) {
  if(r?.ok===true)return {etat:'confirme',texte:'Message envoyé sur Vinted.'};
  const status=Number(r?.status);
  const refusAvantEnvoi=['plusieurs','perime'].includes(r?.code);
  if(refusAvantEnvoi||(status>=400&&status<500&&status!==408))return {etat:'refuse',texte:r?.error||`Vinted a refusé l’envoi (${status}). Ton texte est conservé.`};
  return {etat:'incertain',texte:'Envoi non confirmé. Ton texte est conservé. Vérifie la conversation sur Vinted avant de renvoyer : le message a peut-être déjà été reçu.'};
}
export const cleReponseVinted=(uid,conversation)=>`${uid}:${conversation}`;
