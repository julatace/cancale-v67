import React from 'react';
import {ETAPES_FAVORIS,RAISONS_FAVORIS,progressionFavoris,dureeFavoris,traduireResultatFavori} from './favorisProgression.js';
import {requeteJsonBornee} from './requeteJsonBornee.js';
// (11 nov., lot favoris-clair) Le suivi en direct passe par la feuille commune
// « VRM travaille » (src/suiviTravail.js) : une ligne par message, désignée par
// l'annonce (N°, titre), JAMAIS par la personne. Le miroir lit la vue de la file
// serveur ; il ne décide rien de l'envoi.
import {suivi} from './suiviTravail.js';
import {issueSuivi} from './favorisParcours.js';
import {tr} from './i18n/index.js';
function AutomatisationFavoris({uid,owner,ownerActuel,headers,selection,reglagesPrets,reglages,preparerReglages,executer,disponible=false,raisonExtension='',verifierExtension,onEtat,onPreparation,masquerSansSelection=false,onErreur,revisionVerification=0,ecranActif=true,decrireJob=null,raisonSuivi=null},ref){
  const [vue,setVue]=React.useState(null),[erreur,setErreur]=React.useState(''),[controleErreur,setControleErreur]=React.useState(null),[occupe,setOccupe]=React.useState(false),[phase,setPhase]=React.useState(''),[horloge,setHorloge]=React.useState(Date.now());
  const vivant=React.useRef(true),busy=React.useRef(false),pauseLocale=React.useRef(false),travail=React.useRef(null),lecture=React.useRef(0),mutation=React.useRef(false),decalage=React.useRef(0),prochaine=React.useRef(0);
  React.useEffect(()=>{if(onErreur)onErreur(erreur?controleErreur||{code:'non_precise'}:null);},[erreur,controleErreur]);
  const revisionVue=React.useRef(revisionVerification);
  React.useEffect(()=>{
    if(revisionVue.current===revisionVerification)return;revisionVue.current=revisionVerification;
    if(!vue?.active&&!busy.current&&!mutation.current&&['favoris_preuve_absente','favoris_identite_non_unique'].includes(controleErreur?.code)){setErreur('');setControleErreur(null);}
  },[revisionVerification]);
  const ecran=React.useRef(ecranActif);ecran.current=ecranActif;
  const contexte=React.useRef('');contexte.current=JSON.stringify([owner,uid,selection,reglages?.message,reglages?.pourcentage,reglages?.intervalleMinutes,reglages?.intervalleMaxMinutes]);
  const courant=()=>vivant.current&&ownerActuel()===owner;
  const adopter=j=>{if(!j.vue||!Array.isArray(j.vue.jobs)||typeof j.vue.active!=='boolean')throw Error('L’état de la file n’a pas été confirmé.');if(Number.isSafeInteger(j.serveur))decalage.current=j.serveur-Date.now();prochaine.current=Number(j.vue?.prochain)||0;setHorloge(Date.now());setVue(j.vue);if(onEtat)onEtat(j.vue);miroir(j.vue);};
  // ── Le miroir vers SuiviTravail ─────────────────────────────────────────
  const pilote=React.useRef(null),pauseDemandee=React.useRef(false),agirRef=React.useRef(null);
  const ETAPES_SUIVI=()=>Object.keys(ETAPES_FAVORIS).map(k=>[k,tr('favoris.suivi.etape.'+k)]);
  const surGeste=quoi=>{
    if(quoi==='pause'){pauseLocale.current=true;pauseDemandee.current=true;if(!busy.current)finirPause();}
    else if(quoi==='reprendre'){pauseDemandee.current=false;pauseLocale.current=false;}
    else if(quoi==='arret'){pauseLocale.current=true;pauseDemandee.current=false;agirRef.current?.('arreter');}
  };
  const finirPause=()=>{const p=pilote.current;if(p&&pauseDemandee.current){pauseDemandee.current=false;p.t.terminer('','pause');}};
  const demarrerSuivi=v=>{
    if(!v?.lot)return;
    const jobs=(v.jobs||[]).filter(x=>x.lot===v.lot&&x.notificationId!=null);
    if(!jobs.length)return;
    const desc=x=>{try{return decrireJob?.(x)||{};}catch{return {};}};
    const t=suivi.demarrer({sorte:'favoris',titre:tr('favoris.suivi.titre'),etapes:ETAPES_SUIVI(),uid,
      articles:jobs.map(x=>{const d=desc(x);return {id:String(x.notificationId),num:d.num||'',titre:d.titre||tr('favoris.suivi.message')};}),surGeste});
    if(t)pilote.current={t,lot:v.lot};
  };
  const miroir=v=>{
    const p=pilote.current;if(!p||!v)return;
    const etat=p.t.etat();if(!etat){pilote.current=null;return;}
    const jobs=(v.jobs||[]).filter(x=>x.lot===p.lot&&x.notificationId!=null);
    for(const x of jobs){
      const id=String(x.notificationId);
      if(x.etat==='reserve')p.t.etape(id,'autorisation');
      const iss=issueSuivi(x,code=>raisonSuivi?raisonSuivi(code):{});
      if(iss)p.t.fin(id,iss);
    }
    const ecart=Number(v.prochain)-(Date.now()+decalage.current);
    if(v.active&&ecart>1000&&!jobs.some(x=>x.etat==='reserve'))p.t.pause({ms:ecart,raison:tr('favoris.suivi.attente')});
    else p.t.finPause();
    if(!v.active&&!jobs.some(x=>x.etat==='reserve')){p.t.terminer(v.raison||'');pilote.current=null;}
  };
  React.useImperativeHandle(ref,()=>({lancer:()=>agirRef.current?.('lancer'),arreter:()=>agirRef.current?.('arreter'),clore:()=>agirRef.current?.('clore'),lire:()=>lire()}));
  const api=async(action,donnees={},h=headers())=>{
    const r=await requeteJsonBornee(`/api/compte?mode=favoris&uid=${encodeURIComponent(uid)}`,{method:action?'POST':'GET',headers:{...h,'Content-Type':'application/json'},cache:'no-store',...(action?{body:JSON.stringify({action,...donnees})}:{})});
    const j=r.json;if(!r.ok||!j?.ok){const e=Error(j?.message||'La file n’a pas été confirmée.');e.code=j?.code;e.diagnostic=j?.diagnostic;throw e;}return j;
  };
  const lire=async()=>{
    if(mutation.current||busy.current)return;const n=++lecture.current;
    try{const j=await api();if(courant()&&n===lecture.current){adopter(j);setErreur('');pauseLocale.current=false;}}
    catch(e){if(courant()&&n===lecture.current){setErreur(e.message);pauseLocale.current=true;}}
  };
  React.useEffect(()=>{vivant.current=true;return()=>{vivant.current=false;lecture.current++;};},[]);
  React.useEffect(()=>{if(uid&&owner&&ecranActif)lire();},[uid,owner,ecranActif]);
  React.useEffect(()=>{
    const suivre=e=>{const d=e.detail;if(courant()&&d?.type==='favoris'&&String(d.uid)===String(uid)&&d.suivi&&d.suivi===travail.current?.suivi&&ETAPES_FAVORIS[d.etape]){setPhase(ETAPES_FAVORIS[d.etape]);const p=pilote.current,n=travail.current?.notificationId;if(p&&n!=null)p.t.etape(String(n),d.etape);}};
    window.addEventListener('vrm:ext',suivre);return()=>window.removeEventListener('vrm:ext',suivre);
  },[uid,owner]);
  React.useEffect(()=>{if(!vue?.active||!ecranActif)return;setHorloge(Date.now());const t=setInterval(()=>setHorloge(Date.now()),1000);return()=>clearInterval(t);},[vue?.active,ecranActif]);
  const avancer=async()=>{
    if(prochaine.current>Date.now()+decalage.current)return;
    if(!courant()||busy.current||mutation.current||pauseLocale.current||!vue?.active||!ecran.current||!disponible||document.visibilityState==='hidden'||typeof executer!=='function')return;
    busy.current=true;++lecture.current;const h=headers();setPhase('Vérification du prochain envoi');
    try{
      const j=await api('suivant',{},h);if(!courant())return;adopter(j);
      if(j.travail){
        const t=j.travail;travail.current=t;
        if(!ecran.current||document.visibilityState==='hidden'){const arret=await api('terminer',{jeton:t.jeton,resultat:'refuse',raison:'ecran_inactif'},h);if(courant())adopter(arret);return;}
        let resultat='incertain',raison='reponse_inconnue',ecrits,variante;
        try{
          const r=await executer(t);
          ({resultat,raison,ecrits,variante}=traduireResultatFavori(r));
          if(resultat!=='envoye'&&courant()&&r?.error)setErreur(String(r.error).slice(0,240));
        }catch{}
        if(courant())setPhase('Enregistrement du résultat');
        const fini=await api('terminer',{jeton:t.jeton,resultat,raison,...(Number.isInteger(ecrits)?{ecrits}:{}),...(Number.isInteger(variante)?{variante}:{})},h);if(courant())adopter(fini);
      }
    }catch(e){if(courant()){setErreur(e.message+' Aucun renvoi automatique.');pauseLocale.current=true;}}
    finally{busy.current=false;travail.current=null;if(courant())setPhase('');finirPause();}
  };
  React.useEffect(()=>{if(!vue?.active||!ecranActif)return;avancer();const t=setInterval(avancer,vue?.intervalleMinutes===0?3000:15000);return()=>clearInterval(t);},[vue?.active,disponible,ecranActif,vue?.intervalleMinutes===0]);
  const agir=async action=>{
    if(!courant()||mutation.current)return;mutation.current=true;++lecture.current;setOccupe(true);setErreur('');setControleErreur(null);
    if(action==='lancer')onPreparation?.(true);
    try{
      let configuration=reglages;const contexteAuDepart=contexte.current;
      const verifierPreparation=()=>{if(!ecran.current||contexte.current!==contexteAuDepart)throw Error('Préparation interrompue : la sélection, le message ou l’écran a changé. Vérifie les destinataires avant de relancer. Aucun envoi lancé.');};
      if(action==='lancer'){
        verifierPreparation();
        if(!selection.length)throw Error('Coche au moins un favori dans la liste avant de lancer.');
        setPhase('Vérification de l’extension');
        const etat=verifierExtension?await verifierExtension():{disponible,raison:raisonExtension};
        if(!courant())return;
        verifierPreparation();
        if(!etat?.disponible||typeof executer!=='function')throw Error(etat?.raison||raisonExtension||'L’extension ne répond pas dans ce navigateur. Recharge l’extension puis cette page.');
        setPhase('Enregistrement des réglages');
        if(preparerReglages)configuration=await preparerReglages();
        else if(!reglagesPrets)throw Error('Enregistre ton message et ton intervalle avant de lancer.');
        if(!courant())return;
        verifierPreparation();
      }
      setPhase(action==='lancer'?'Préparation de la sélection':'Mise à jour de la file');
      const j=await api(action,action==='lancer'?{selection,reglages:configuration}:{});
      if(courant()){if(action==='lancer'){pauseDemandee.current=false;demarrerSuivi(j.vue);}adopter(j);pauseLocale.current=false;}
    }catch(e){if(courant()){setErreur(e.message);const diagnostic={};for(const k of ['notifications','tracesNatives','pairesNatives','formesUserId','liensExacts','parametresConfirmes','selection'])if(Number.isSafeInteger(e.diagnostic?.[k])&&e.diagnostic[k]>=0&&e.diagnostic[k]<=10000)diagnostic[k]=e.diagnostic[k];setControleErreur({code:['favoris_preuve_absente','favoris_identite_non_unique'].includes(e.code)?e.code:'non_precise',diagnostic});}}
    finally{mutation.current=false;if(courant()){if(action==='lancer')onPreparation?.(false);setOccupe(false);setPhase('');}}
  };
  agirRef.current=agir;
  const p=progressionFavoris(vue,horloge+decalage.current);
  const rangPhase=phase==='Enregistrement du résultat'?Object.keys(ETAPES_FAVORIS).length:Object.values(ETAPES_FAVORIS).indexOf(phase);
  const avancement=Math.min(p.total,p.termines+(p.encours&&rangPhase>=0?(rangPhase+1)/(Object.keys(ETAPES_FAVORIS).length+2):0));
  const raisons=[...new Set(p.jobs.filter(x=>['refuse','incertain'].includes(x.etat)).map(x=>RAISONS_FAVORIS[x.raison]).filter(Boolean))];
  if(masquerSansSelection&&!selection.length&&!p.total&&!vue?.active&&!erreur)return null;
  return <div className="vrm-favoris-automatisation" aria-label="Envoi automatique aux favoris" data-favoris-moteur={vue?.active?'active':'repos'}>
    {!disponible&&<p>{raisonExtension||'La connexion à l’extension sera vérifiée au lancement.'}</p>}
    {vue?.active?<button type="button" disabled={occupe} onClick={()=>agir('arreter')}>Arrêter la file</button>:selection.length?<button type="button" className="is-principal" disabled={occupe} onClick={()=>agir('lancer')}>{occupe?'Vérification…':'Lancer les envois sélectionnés'}</button>:null}
    {(!!p.total||!!phase)&&<div className="vrm-favoris-progression" aria-label="Progression des envois">
      {!!p.total&&<><div className="vrm-favoris-progress-head" role="status"><strong>{p.termines} / {p.total} traités</strong><span>{p.envoyes} envoyé(s) · {p.ignores} ignoré(s)</span></div><progress aria-label="Traitement des favoris" aria-valuetext={`${p.termines} sur ${p.total} traités${phase?' · '+phase:''}`} value={avancement} max={p.total}/></>}
      <p role="status" aria-live={phase?'polite':'off'}>{phase|| (vue?.active?(p.secondes>0?`Prochaine vérification dans ${dureeFavoris(p.secondes)}`:'En attente du prochain passage'):p.incertains||p.refuses?'File interrompue : vérifie le résultat ci-dessous.':'Sélection traitée ou file arrêtée.')}</p>
      {!!p.ignores&&<small>Ignorés : la conversation contient déjà des messages. Aucun nouveau message envoyé à ces favoris.</small>}
      {vue?.active&&vue.intervalleMinutes!=null&&<small>{vue.intervalleMinutes===0?'Temps entre les messages : 6 à 10 s, tiré au hasard (comme Vintex).':vue.intervalleMaxMinutes?`Temps entre les messages : entre ${vue.intervalleMinutes} et ${vue.intervalleMaxMinutes} min, tiré au hasard.`:`Temps entre les messages : ${vue.intervalleMinutes} min.`} Le plafond horaire peut prolonger l’attente.</small>}
      {!!p.total&&<p>{p.attente} en attente · {p.encours} en cours{p.incertains?` · ${p.incertains} à vérifier sur Vinted`:''}{p.refuses?` · ${p.refuses} interrompu(s)`:''}{p.annules?` · ${p.annules} annulé(s)`:''}{p.verifies?` · ${p.verifies} clôturé(s) après vérification manuelle`:''}</p>}
      {vue?.active&&!phase&&(!ecranActif||typeof document!=='undefined'&&document.visibilityState==='hidden'||!disponible)&&<p role="status">Envois suspendus : {disponible?'reviens sur cet écran pour reprendre.':'vérifie la connexion de l’extension au bon compte.'}</p>}
    </div>}
    {vue?.raison&&<p>{vue.raison}</p>}{raisons.map(x=><p role="alert" key={x}>{x}</p>)}
    {!!p.incertains&&!vue?.active&&<button type="button" disabled={occupe} onClick={()=>agir('clore')}>J’ai vérifié sur Vinted · ne pas renvoyer</button>}
    {erreur&&<p role="alert"><strong>Dernière tentative : </strong>{erreur}</p>}
    <button type="button" disabled={occupe||busy.current} onClick={lire}>Actualiser la file</button>
  </div>;
}
export default React.forwardRef(AutomatisationFavoris);
