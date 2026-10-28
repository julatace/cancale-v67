// Une réponse absente ou une panne serveur ne prouve pas que Vinted n’a rien reçu.
export function retourReponseVinted(r) {
  if(r?.ok===true)return {etat:'confirme',texte:'Message envoyé sur Vinted.'};
  const status=Number(r?.status);
  const refusAvantEnvoi=['plusieurs','perime'].includes(r?.code);
  if(refusAvantEnvoi||(status>=400&&status<500&&status!==408))return {etat:'refuse',texte:r?.error||`Vinted a refusé l’envoi (${status}). Ton texte est conservé.`};
  return {etat:'incertain',texte:'Envoi non confirmé. Ton texte est conservé. Vérifie la conversation sur Vinted avant de renvoyer : le message a peut-être déjà été reçu.'};
}
export const cleReponseVinted=(uid,conversation)=>`${uid}:${conversation}`;

// Brouillons uniquement en mémoire. Aucun texte n’est enregistré dans le navigateur.
// Le propriétaire courant est relu à chaque accès, y compris pour un accusé tardif.
export function creerBrouillonsReponses(ownerActuel){
  let scope='';const textes=new Map();
  const autorise=owner=>{const actuel=String(ownerActuel()||'');if(scope!==actuel){textes.clear();scope=actuel;}return !!actuel&&String(owner||'')===actuel;};
  const cle=(uid,conv)=>JSON.stringify([String(uid),String(conv)]);
  return {
    lire(owner,uid,conv){return autorise(owner)?textes.get(cle(uid,conv))||'':'';},
    ecrire(owner,uid,conv,texte){if(!autorise(owner))return;const k=cle(uid,conv);if(typeof texte==='string'&&texte.trim())textes.set(k,texte);else textes.delete(k);},
    confirmer(owner,uid,conv,texte){if(!autorise(owner))return;const k=cle(uid,conv);if(textes.get(k)?.trim()===texte.trim())textes.delete(k);}
  };
}
