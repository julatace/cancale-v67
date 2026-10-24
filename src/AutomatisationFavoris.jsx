import React from 'react';
import {ETAPES_FAVORIS,RAISONS_FAVORIS,progressionFavoris,dureeFavoris} from './favorisProgression.js';
export default function AutomatisationFavoris({uid,owner,ownerActuel,headers,selection,reglagesPrets,reglages,preparerReglages,executer,disponible=false,raisonExtension='',verifierExtension,onEtat,masquerSansSelection=false,onErreur}){
  const [vue,setVue]=React.useState(null),[erreur,setErreur]=React.useState(''),[controleErreur,setControleErreur]=React.useState(null),[occupe,setOccupe]=React.useState(false),[phase,setPhase]=React.useState(''),[horloge,setHorloge]=React.useState(Date.now());
  const vivant=React.useRef(true),busy=React.useRef(false),pauseLocale=React.useRef(false),travail=React.useRef(null),lecture=React.useRef(0),mutation=React.useRef(false),decalage=React.useRef(0),prochaine=React.useRef(0);
  React.useEffect(()=>{if(onErreur)onErreur(erreur?controleErreur||{code:'non_precise'}:null);},[erreur,controleErreur]);
  const courant=()=>vivant.current&&ownerActuel()===owner;
  const adopter=j=>{if(Number.isSafeInteger(j.serveur))decalage.current=j.serveur-Date.now();prochaine.current=Number(j.vue?.prochain)||0;setHorloge(Date.now());setVue(j.vue);if(Array.isArray(j.vue?.jobs)&&onEtat)onEtat(j.vue);};
  const api=async(action,donnees={},h=headers())=>{
    const r=await fetch(`/api/compte?mode=favoris&uid=${encodeURIComponent(uid)}`,{method:action?'POST':'GET',headers:{...h,'Content-Type':'application/json'},cache:'no-store',signal:AbortSignal.timeout(15000),...(action?{body:JSON.stringify({action,...donnees})}:{})});
    const j=await r.json();if(!r.ok||!j.ok){const e=Error(j.message||'La file n’a pas été confirmée.');e.code=j.code;e.diagnostic=j.diagnostic;throw e;}return j;
  };
  const lire=async()=>{
    if(mutation.current||busy.current)return;const n=++lecture.current;
    try{const j=await api();if(courant()&&n===lecture.current){adopter(j);setErreur('');pauseLocale.current=false;}}
    catch(e){if(courant()&&n===lecture.current){setErreur(e.message);pauseLocale.current=true;}}
  };
  React.useEffect(()=>{vivant.current=true;if(uid&&owner)lire();return()=>{vivant.current=false;lecture.current++;};},[]);
  React.useEffect(()=>{
    const suivre=e=>{const d=e.detail;if(courant()&&d?.type==='favoris'&&String(d.uid)===String(uid)&&d.suivi&&d.suivi===travail.current?.suivi&&ETAPES_FAVORIS[d.etape])setPhase(ETAPES_FAVORIS[d.etape]);};
    window.addEventListener('vrm:ext',suivre);return()=>window.removeEventListener('vrm:ext',suivre);
  },[uid,owner]);
  React.useEffect(()=>{if(!vue?.active)return;const t=setInterval(()=>setHorloge(Date.now()),1000);return()=>clearInterval(t);},[vue?.active]);
  const avancer=async()=>{
    if(prochaine.current>Date.now()+decalage.current)return;
    if(!courant()||busy.current||mutation.current||pauseLocale.current||!vue?.active||!disponible||document.visibilityState==='hidden'||typeof executer!=='function')return;
    busy.current=true;++lecture.current;const h=headers();setPhase('Vérification du prochain envoi');
    try{
      const j=await api('suivant',{},h);if(!courant())return;adopter(j);
      if(j.travail){
        const t=j.travail;travail.current=t;
        let resultat='incertain',raison='reponse_inconnue';
        try{
          const r=await executer(t);
          if(r?.ok&&['envoye','ignore'].includes(r.data?.resultat))resultat=r.data.resultat;
          else if(r?.data?.resultat==='refuse')resultat='refuse';
          if(['vinted-pause','vinted-absent','vinted-autre','plafond','plafond-bordereaux','perime','plusieurs','non-autorise','origine','preparation-refusee'].includes(r?.code))resultat='refuse';
          if(RAISONS_FAVORIS[r?.data?.raison])raison=r.data.raison;
          else if(r?.code==='vinted-autre')raison='compte_vinted_different';
          else if(r?.code==='vinted-absent')raison='compte_vinted_absent';
          else if(['plafond','plafond-bordereaux'].includes(r?.code))raison='quota_extension';
          else if(r?.code==='vinted-pause')raison='pause_vinted';
          else if(['perime','plusieurs','non-autorise'].includes(r?.code))raison='extension_indisponible';
          else if(resultat==='refuse')raison='vinted_refus';
          if(resultat==='envoye')raison='';
          else if(courant()&&r?.error)setErreur(String(r.error).slice(0,240));
        }catch{}
        if(courant())setPhase('Enregistrement du résultat');
        const fini=await api('terminer',{jeton:t.jeton,resultat,raison},h);if(courant())adopter(fini);
      }
    }catch(e){if(courant()){setErreur(e.message+' Aucun renvoi automatique.');pauseLocale.current=true;}}
    finally{busy.current=false;travail.current=null;if(courant())setPhase('');}
  };
  React.useEffect(()=>{if(!vue?.active)return;avancer();const t=setInterval(avancer,15000);return()=>clearInterval(t);},[vue?.active,disponible]);
  const agir=async action=>{
    if(!courant()||mutation.current)return;mutation.current=true;++lecture.current;setOccupe(true);setErreur('');setControleErreur(null);
    try{
      let configuration=reglages;
      if(action==='lancer'){
        if(!selection.length)throw Error('Coche au moins un favori dans la liste avant de lancer.');
        setPhase('Vérification de l’extension');
        const etat=verifierExtension?await verifierExtension():{disponible,raison:raisonExtension};
        if(!courant())return;
        if(!etat?.disponible||typeof executer!=='function')throw Error(etat?.raison||raisonExtension||'L’extension ne répond pas dans ce navigateur. Recharge l’extension puis cette page.');
        setPhase('Enregistrement des réglages');
        if(preparerReglages)configuration=await preparerReglages();
        else if(!reglagesPrets)throw Error('Enregistre ton message et ton intervalle avant de lancer.');
        if(!courant())return;
      }
      setPhase(action==='lancer'?'Préparation de la sélection':'Mise à jour de la file');
      const j=await api(action,action==='lancer'?{selection,reglages:configuration}:{});
      if(courant()){adopter(j);pauseLocale.current=false;}
    }catch(e){if(courant()){setErreur(e.message);const diagnostic={};for(const k of ['notifications','tracesNatives','pairesNatives','formesUserId','liensExacts','parametresConfirmes','selection'])if(Number.isSafeInteger(e.diagnostic?.[k])&&e.diagnostic[k]>=0&&e.diagnostic[k]<=10000)diagnostic[k]=e.diagnostic[k];setControleErreur({code:['favoris_preuve_absente','favoris_identite_non_unique'].includes(e.code)?e.code:'non_precise',diagnostic});}}
    finally{mutation.current=false;if(courant()){setOccupe(false);setPhase('');}}
  };
  const p=progressionFavoris(vue,horloge+decalage.current);
  const rangPhase=phase==='Enregistrement du résultat'?Object.keys(ETAPES_FAVORIS).length:Object.values(ETAPES_FAVORIS).indexOf(phase);
  const avancement=Math.min(p.total,p.termines+(p.encours&&rangPhase>=0?(rangPhase+1)/(Object.keys(ETAPES_FAVORIS).length+2):0));
  const raisons=[...new Set(p.jobs.filter(x=>['refuse','incertain'].includes(x.etat)).map(x=>RAISONS_FAVORIS[x.raison]).filter(Boolean))];
  if(masquerSansSelection&&!selection.length&&!p.total&&!vue?.active&&!erreur)return null;
  return <details className="vrm-favoris-automatisation" aria-label="Envoi automatique aux favoris" open={!!vue?.active||!!selection.length||!!p.total||!!erreur}>
    <summary>Envoi automatique aux favoris</summary>
    <p>Le même message enregistré est envoyé à chaque favori sélectionné. Maximum 10 messages sur 60 minutes par compte. Une conversation contenant déjà des messages est ignorée.</p>
    <p>Garde cet écran ouvert et visible, avec l’extension 5.220 et le bon compte Vinted connecté. Aucune garantie contre un blocage Vinted.</p>
    {!disponible&&<p>{raisonExtension||'La connexion à l’extension sera vérifiée au lancement.'}</p>}
    {vue?.active?<button type="button" disabled={occupe} onClick={()=>agir('arreter')}>Arrêter la file</button>:<button type="button" disabled={occupe} onClick={()=>agir('lancer')}>{occupe?'Vérification…':'Lancer les envois sélectionnés'}</button>}
    {(!!p.total||!!phase)&&<div className="vrm-favoris-progression" aria-label="Progression des envois">
      {!!p.total&&<><div className="vrm-favoris-progress-head" role="status"><strong>{p.termines} / {p.total} traités</strong><span>{p.envoyes} envoyé(s) · {p.ignores} ignoré(s)</span></div><progress aria-label="Traitement des favoris" aria-valuetext={`${p.termines} sur ${p.total} traités${phase?' · '+phase:''}`} value={avancement} max={p.total}/></>}
      <p role="status" aria-live={phase?'polite':'off'}>{phase|| (vue?.active?(p.secondes>0?`Prochaine vérification dans ${dureeFavoris(p.secondes)}`:'En attente du prochain passage'):p.incertains||p.refuses?'File interrompue : vérifie le résultat ci-dessous.':'Sélection traitée ou file arrêtée.')}</p>
      {!!p.ignores&&<small>Ignorés : la conversation contient déjà des messages. Aucun nouveau message envoyé à ces favoris.</small>}
      {vue?.active&&vue.intervalleMinutes&&<small>Intervalle minimum entre les messages : {vue.intervalleMinutes} min. Le plafond horaire peut prolonger l’attente.</small>}
      {!!p.total&&<p>{p.attente} en attente · {p.encours} en cours{p.incertains?` · ${p.incertains} à vérifier sur Vinted`:''}{p.refuses?` · ${p.refuses} interrompu(s)`:''}{p.annules?` · ${p.annules} annulé(s)`:''}</p>}
    </div>}
    {vue?.raison&&<p>{vue.raison}</p>}{raisons.map(x=><p role="alert" key={x}>{x}</p>)}
    {!!p.incertains&&!vue?.active&&<button type="button" disabled={occupe} onClick={()=>agir('clore')}>J’ai vérifié sur Vinted · ne pas renvoyer</button>}
    {erreur&&<p role="alert"><strong>Dernière tentative : </strong>{erreur}</p>}
    <button type="button" disabled={occupe||busy.current} onClick={lire}>Actualiser la file</button>
  </details>;
}
