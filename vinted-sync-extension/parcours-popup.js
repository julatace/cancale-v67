// Local, user-triggered diagnostics. No transmission or automatic download.
(()=>{
 if(/[?&]mode=(carte|reparer)\b/.test(location.search))return;
 const box=document.getElementById('parcours-favoris');if(!box)return;box.hidden=false;
 const statut=document.getElementById('parcours-statut'),rapport=document.getElementById('parcours-rapport');
 const start=document.getElementById('parcours-demarrer'),stop=document.getElementById('parcours-arreter'),effacer=document.getElementById('parcours-effacer'),copier=document.getElementById('parcours-copier');
 // 5.394 : les textes par chrome.i18n (la même règle que popup.js : le français en repli).
 const T=(cle,fr,v)=>{let s='';try{s=(chrome.i18n&&chrome.i18n.getMessage(cle))||'';}catch{s='';}if(!s)s=fr;return v?String(s).replace(/\{(\w+)\}/g,(m,k)=>(k in v?String(v[k]):m)):s;};
 let courant=null,busy=false;
 const afficher=r=>{courant=r?.rapport||null;statut.textContent=r?.message||(courant?.actif?T('pp_en_cours','Enregistrement en cours. Ferme cette fenêtre et ouvre la cloche puis le favori sur Vinted.'):courant?T('pp_arrete','Enregistrement arrêté · {n} étapes. Lis le rapport avant de le copier.',{n:courant.evenements.length}):T('pp_ouvre','Ouvre Vinted dans l’onglet actif, puis démarre.'));start.disabled=busy||courant?.actif===true;stop.disabled=busy||!courant?.actif;effacer.disabled=busy||!courant;copier.disabled=busy||!courant||courant.actif;rapport.hidden=!courant;rapport.value=courant?JSON.stringify(courant,null,2):'';};
 const envoyer=action=>new Promise(resolve=>{const timer=setTimeout(()=>resolve({ok:false,message:T('pp_muet','L’extension n’a pas répondu. Aucun démarrage confirmé.')}),6000);try{chrome.runtime.sendMessage({from:'vrm-parcours',action},r=>{const e=chrome.runtime.lastError;clearTimeout(timer);resolve(e?{ok:false,message:T('pp_indispo','Le rapport local est indisponible.')}:r||{ok:false});});}catch{clearTimeout(timer);resolve({ok:false,message:T('pp_navigateur','Ce navigateur ne permet pas cette commande.')});}});
 const agir=async action=>{if(busy)return;busy=true;afficher({rapport:courant,message:T('pp_verif','Vérification…')});try{const r=await envoyer(action);busy=false;afficher(r);}catch{busy=false;afficher({message:T('pp_pas_confirme','Le rapport local n’a pas pu être confirmé.')});}};
 start.onclick=()=>agir('demarrer');stop.onclick=()=>agir('arreter');effacer.onclick=()=>agir('effacer');copier.onclick=async()=>{if(!courant||courant.actif)return;try{await navigator.clipboard.writeText(JSON.stringify(courant,null,2));statut.textContent=T('pp_copie','Rapport copié. Tu peux le partager avec l’assistance VRM.');}catch{rapport.focus();rapport.select();statut.textContent=T('pp_selectionne','Sélectionne puis copie le rapport ci-dessous.');}};
 agir('etat');
})();
