import React from 'react';
export default function AutomatisationFavoris({uid,owner,ownerActuel,headers,selection,reglagesPrets,reglages,executer,disponible=false}){
  const [vue,setVue]=React.useState(null),[erreur,setErreur]=React.useState(''),[occupe,setOccupe]=React.useState(false);
  const vivant=React.useRef(true),busy=React.useRef(false),pauseLocale=React.useRef(false);
  const courant=()=>vivant.current&&ownerActuel()===owner;
  const api=async(action,donnees={},h=headers())=>{
    const r=await fetch(`/api/compte?mode=favoris&uid=${encodeURIComponent(uid)}`,{method:action?'POST':'GET',headers:{...h,'Content-Type':'application/json'},cache:'no-store',signal:AbortSignal.timeout(15000),...(action?{body:JSON.stringify({action,...donnees})}:{})});
    const j=await r.json();if(!r.ok||!j.ok)throw Error(j.message||'La file n’a pas été confirmée.');return j;
  };
  const lire=async()=>{
    try{const j=await api();if(courant()){setVue(j.vue);setErreur('');pauseLocale.current=false;}}
    catch(e){if(courant()){setErreur(e.message);pauseLocale.current=true;}}
  };
  React.useEffect(()=>{vivant.current=true;if(uid&&owner)lire();return()=>{vivant.current=false;};},[]);
  const avancer=async()=>{
    if(!courant()||busy.current||pauseLocale.current||!vue?.active||!disponible||document.visibilityState==='hidden'||typeof executer!=='function')return;
    busy.current=true;const h=headers();
    try{
      const j=await api('suivant',{},h);
      if(!courant())return;
      setVue(j.vue);
      if(j.travail){
        const t=j.travail;
        // Never retry this dispatch, including a timeout or a lost receipt.
        let resultat='incertain';
        try{const r=await executer(t);if(r?.ok&&r.data?.resultat==='envoye')resultat='envoye';else if(r?.data?.resultat==='refuse')resultat='refuse';}catch{}
        const fini=await api('terminer',{jeton:t.jeton,resultat},h);
        if(courant())setVue(fini.vue);
      }
    }catch(e){if(courant()){setErreur(e.message+' Aucun renvoi automatique.');pauseLocale.current=true;}}
    finally{busy.current=false;}
  };
  React.useEffect(()=>{if(!vue?.active)return;avancer();const t=setInterval(avancer,15000);return()=>clearInterval(t);},[vue?.active,disponible]);
  const agir=async action=>{
    if(!courant()||occupe)return;setOccupe(true);setErreur('');
    try{const j=await api(action,action==='lancer'?{selection,reglages}:{});if(courant()){setVue(j.vue);pauseLocale.current=false;}}
    catch(e){if(courant())setErreur(e.message);}
    finally{if(courant())setOccupe(false);}
  };
  const jobs=vue?.jobs||[],compter=e=>jobs.filter(x=>x.etat===e).length;
  return <details className="vrm-favoris-automatisation" aria-label="Envoi automatique aux favoris" open={!!vue?.active||!!selection.length||!!jobs.length}>
    <summary>Envoi automatique aux favoris</summary>
    <p>Le même message enregistré est envoyé à chaque favori sélectionné, avec ta remise et ton intervalle. Maximum 10 messages sur 60 minutes par compte, tous appareils confondus.</p>
    <p>Garde cet écran VRM ouvert et visible dans ton navigateur compatible, avec l’extension 5.215 et le bon compte Vinted connecté. Aucune garantie contre un blocage Vinted.</p>
    {!disponible&&<p>Envoi indisponible ici : installe et recharge l’extension 5.215 dans un navigateur compatible. La file ne part pas depuis un navigateur sans extension.</p>}
    {vue?.active?<button type="button" disabled={occupe} onClick={()=>agir('arreter')}>Arrêter la file</button>:<button type="button" disabled={occupe||!vue||!selection.length||!disponible||!reglagesPrets||typeof executer!=='function'} onClick={()=>agir('lancer')}>{occupe?'Vérification…':'Lancer les envois sélectionnés'}</button>}
    {!!jobs.length&&<p role="status">{compter('envoye')} envoyé(s) · {compter('attente')} en attente · {compter('reserve')} en cours{compter('refuse')?` · ${compter('refuse')} interrompu(s)`:''}{compter('incertain')?` · ${compter('incertain')} à vérifier sur Vinted`:''}{compter('annule')?` · ${compter('annule')} annulé(s)`:''}</p>}
    {vue?.active&&vue.prochain>Date.now()&&<small>Prochain passage au plus tôt à {new Date(vue.prochain).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}.</small>}
    {vue?.raison&&<p>{vue.raison}</p>}
    {!!compter('incertain')&&!vue?.active&&<button type="button" disabled={occupe} onClick={()=>agir('clore')}>J’ai vérifié sur Vinted · ne pas renvoyer</button>}
    {erreur&&<p role="alert">{erreur}</p>}
    <button type="button" disabled={occupe||busy.current} onClick={lire}>Actualiser la file</button>
  </details>;
}
