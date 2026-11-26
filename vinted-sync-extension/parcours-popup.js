// Local, user-triggered diagnostics. No transmission or automatic download.
(()=>{
 if(/[?&]mode=(carte|reparer)\b/.test(location.search))return;
 const box=document.getElementById('parcours-favoris');if(!box)return;box.hidden=false;
 const statut=document.getElementById('parcours-statut'),rapport=document.getElementById('parcours-rapport');
 const start=document.getElementById('parcours-demarrer'),stop=document.getElementById('parcours-arreter'),effacer=document.getElementById('parcours-effacer'),copier=document.getElementById('parcours-copier');
 // 5.446 (lot ext-anciens-lots, repris du lot traduction-restes) : les textes en cinq langues par VRM_UI (vrm-ui.js, la
 // langue du navigateur, comme popup.js) ; une clé absente ou VRM_UI muet ⇒ le français écrit ici, mot pour mot.
 const T=(cle,fr,v)=>{let s='';try{const U=globalThis.VRM_UI;s=U&&U.MOTS&&U.MOTS[cle]?U.T(cle):'';}catch{s='';}if(!s)s=fr;return v?String(s).replace(/\{(\w+)\}/g,(m,k)=>(k in v?String(v[k]):m)):s;};
 try{const pose=(el,cle,fr)=>{if(el)el.textContent=T(cle,fr);};
  pose(box.querySelector('h2'),'p_diag_titre','Diagnostic des favoris');
  const ps=[...box.querySelectorAll('p')].filter(x=>!x.id);pose(ps[0],'p_diag_1',ps[0]?ps[0].textContent:'');pose(ps[1],'p_diag_2',ps[1]?ps[1].textContent:'');
  pose(start,'p_diag_demarrer','Enregistrer le parcours');pose(stop,'p_diag_arreter','Arrêter et voir le rapport');pose(copier,'p_diag_copier','Copier le rapport');pose(effacer,'p_diag_effacer','Effacer le rapport');
  pose(box.querySelector('label[for="parcours-rapport"]'),'p_diag_rapport','Rapport à consulter avant partage');
  if(rapport)rapport.setAttribute('aria-label',T('p_diag_rapport_aria','Rapport du parcours Vinted'));
  const sm=document.querySelector('#details-diag > summary');pose(sm,'p_diag_details','Détails');}catch{}
 let courant=null,busy=false;
 const afficher=r=>{courant=r?.rapport||null;statut.textContent=r?.message||(courant?.actif?T('pp_en_cours','Enregistrement en cours. Ferme cette fenêtre et ouvre la cloche puis le favori sur Vinted.'):courant?T('pp_arrete','Enregistrement arrêté · {n} étapes. Lis le rapport avant de le copier.',{n:courant.evenements.length}):T('pp_ouvre','Ouvre Vinted dans l’onglet actif, puis démarre.'));start.disabled=busy||courant?.actif===true;stop.disabled=busy||!courant?.actif;effacer.disabled=busy||!courant;copier.disabled=busy||!courant||courant.actif;rapport.hidden=!courant;rapport.value=courant?JSON.stringify(courant,null,2):'';};
 const envoyer=action=>new Promise(resolve=>{const timer=setTimeout(()=>resolve({ok:false,message:T('pp_muet','L’extension n’a pas répondu. Aucun démarrage confirmé.')}),6000);try{chrome.runtime.sendMessage({from:'vrm-parcours',action},r=>{const e=chrome.runtime.lastError;clearTimeout(timer);resolve(e?{ok:false,message:T('pp_indispo','Le rapport local est indisponible.')}:r||{ok:false});});}catch{clearTimeout(timer);resolve({ok:false,message:T('pp_navigateur','Ce navigateur ne permet pas cette commande.')});}});
 const agir=async action=>{if(busy)return;busy=true;afficher({rapport:courant,message:T('pp_verif','Vérification…')});try{const r=await envoyer(action);busy=false;afficher(r);}catch{busy=false;afficher({message:T('pp_pas_confirme','Le rapport local n’a pas pu être confirmé.')});}};
 start.onclick=()=>agir('demarrer');stop.onclick=()=>agir('arreter');effacer.onclick=()=>agir('effacer');copier.onclick=async()=>{if(!courant||courant.actif)return;try{await navigator.clipboard.writeText(JSON.stringify(courant,null,2));statut.textContent=T('pp_copie','Rapport copié. Tu peux le partager avec l’assistance VRM.');}catch{rapport.focus();rapport.select();statut.textContent=T('pp_selectionne','Sélectionne puis copie le rapport ci-dessous.');}};
 agir('etat');
})();
