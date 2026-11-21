// Local, user-triggered diagnostics. No transmission or automatic download.
(()=>{
 const box=document.getElementById('parcours-favoris');if(!box)return;box.hidden=false;
 const statut=document.getElementById('parcours-statut'),rapport=document.getElementById('parcours-rapport');
 const start=document.getElementById('parcours-demarrer'),stop=document.getElementById('parcours-arreter'),effacer=document.getElementById('parcours-effacer'),copier=document.getElementById('parcours-copier');
 let courant=null,busy=false;
 const afficher=r=>{courant=r?.rapport||null;statut.textContent=r?.message||(courant?.actif?'Enregistrement en cours. Ferme cette fenêtre et ouvre la cloche puis le favori sur Vinted.':courant?'Enregistrement arrêté · '+courant.evenements.length+' étapes. Lis le rapport avant de le copier.':'Ouvre Vinted dans l’onglet actif, puis démarre.');start.disabled=busy||courant?.actif===true;stop.disabled=busy||!courant?.actif;effacer.disabled=busy||!courant;copier.disabled=busy||!courant||courant.actif;rapport.hidden=!courant;rapport.value=courant?JSON.stringify(courant,null,2):'';};
 const envoyer=action=>new Promise(resolve=>{const timer=setTimeout(()=>resolve({ok:false,message:'L’extension n’a pas répondu. Aucun démarrage confirmé.'}),6000);try{chrome.runtime.sendMessage({from:'vrm-parcours',action},r=>{const e=chrome.runtime.lastError;clearTimeout(timer);resolve(e?{ok:false,message:'Le rapport local est indisponible.'}:r||{ok:false});});}catch{clearTimeout(timer);resolve({ok:false,message:'Ce navigateur ne permet pas cette commande.'});}});
 const agir=async action=>{if(busy)return;busy=true;afficher({rapport:courant,message:'Vérification…'});try{const r=await envoyer(action);busy=false;afficher(r);}catch{busy=false;afficher({message:'Le rapport local n’a pas pu être confirmé.'});}};
 start.onclick=()=>agir('demarrer');stop.onclick=()=>agir('arreter');effacer.onclick=()=>agir('effacer');copier.onclick=async()=>{if(!courant||courant.actif)return;try{await navigator.clipboard.writeText(JSON.stringify(courant,null,2));statut.textContent='Rapport copié. Tu peux le partager avec l’assistance VRM.';}catch{rapport.focus();rapport.select();statut.textContent='Sélectionne puis copie le rapport ci-dessous.';}};
 agir('etat');
})();
