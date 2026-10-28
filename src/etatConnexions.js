export function etatExtensionAffichage({presente,version,retard=false}){
 if(!presente)return {etat:'inconnue',titre:'Aucune réponse dans ce navigateur',detail:'Cela ne prouve pas que l’extension est désinstallée. Ouvre VRM dans le navigateur où elle est autorisée.'};
 if(!/^\d+(?:\.\d+){1,3}$/.test(String(version||'')))return {etat:'inconnue',titre:'Extension détectée · version non confirmée',detail:'Le navigateur répond, mais sa version doit être vérifiée avant de conclure sur la mise à jour.'};
 if(retard)return {etat:'action',titre:`Version ${version} · mise à jour disponible`,detail:'Mets à jour l’installation de ce navigateur, puis recharge VRM.'};
 return {etat:'presente',titre:`Version ${version} · détectée ici`,detail:'Le lien avec cette page répond. Cela ne confirme pas la récupération de toutes les données ni la connexion de chaque compte.'};
}
export function etatDerniereLecture(valeur,maintenant=Date.now()){
 if(valeur===undefined)return {etat:'lecture',titre:'Vérification en cours…'};
 if(valeur===null||!Number.isFinite(valeur.n)||valeur.n<0)return {etat:'inconnue',titre:'Lecture impossible · à réessayer'};
 if(valeur.n===0)return {etat:'vide',titre:'Aucune donnée enregistrée pour cette source'};
 if(!Number.isFinite(valeur.ts)||valeur.ts<=0)return {etat:'inconnue',titre:'Données présentes · date non vérifiée'};
 if(valeur.ts>maintenant+300000)return {etat:'inconnue',titre:'Horodatage à vérifier'};
 return {etat:'observee',titre:'Mise à jour observée',date:new Date(valeur.ts).toISOString()};
}
