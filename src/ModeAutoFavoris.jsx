// ── L'ÉCRAN DU MODE AUTOMATIQUE DES FAVORIS (2 novembre 2026) ─────────────────
// Messages → Favoris reçus → « Mode automatique ». Éteint par défaut ; l'allumer
// DEMANDE (le risque est dit) ; tous les garde-fous se règlent ici ; l'état dit
// pourquoi rien ne part et quoi faire ; le journal dit à qui, quand, ou pourquoi
// un favori a été laissé de côté ; « Stop » éteint tout de suite.
// Le serveur garde les réglages, les quotas et la pause (jamais le navigateur seul).
import React from 'react';
import {createPortal} from 'react-dom';
import {requeteJsonBornee} from './requeteJsonBornee.js';
import {RAISONS_FAVORIS} from './favorisProgression.js';
import {AUTO_DEFAUT,JOURS_AUTO,validerAutoFavoris,limiteJourAuto,AUTO_JOUR_MS,AUTO_HEURE_MS} from './favorisAuto.js';
import {phraseModeAuto} from './favorisEcran.js';
// (2 nov., écran refait) L'état se dit en UNE phrase et UN geste
// (`phraseModeAuto`, src/favorisEcran.js) ; le journal ne s'affiche plus ici :
// chaque favori porte son état dans la liste de l'écran (`onVue` la lui passe).

const heure=t=>{try{return new Date(t).toLocaleString('fr-FR',{timeZone:'Europe/Paris',weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});}catch{return '';}};
export const RISQUE_AUTO='VRM écrira tout seul aux personnes qui mettent tes annonces en favori, avec ton message et ton offre enregistrés, depuis l’onglet vinted.fr de ce compte.\n\nGarde-fous : jamais une conversation déjà ouverte avec la personne, jamais quelqu’un contacté ces 30 derniers jours, jamais une paire réservée, vendue (ici ou ailleurs), en pause ou masquée ; attente au hasard après le favori ; tes horaires ; tes limites par heure et par 24 h ; 10 messages par jour la 1re semaine, 20 la 2e ; pause de 24 h au premier signe de Vinted.\n\nAttention : Vinted peut quand même voir ça comme un robot : c’est un risque pour le compte, que tu prends en l’allumant. Aucune garantie contre un blocage.';

export default function ModeAutoFavoris({uid,owner,ownerActuel,headers,nomCompte,extensionAuto,onVue,variante='',FermeAuRetour=null}){
  const [feuille,setFeuille]=React.useState(false);
  const [vue,setVue]=React.useState(undefined),[form,setForm]=React.useState(null),[erreur,setErreur]=React.useState(''),[occupe,setOccupe]=React.useState(false),[confirmer,setConfirmer]=React.useState(false),[ouvert,setOuvert]=React.useState(false);
  const [maintenant,setMaintenant]=React.useState(Date.now());
  const n=React.useRef(0);
  const api=async(action,donnees={})=>{
    const r=await requeteJsonBornee(`/api/compte?mode=favoris&uid=${encodeURIComponent(uid)}`,{method:action?'POST':'GET',headers:{...headers(),'Content-Type':'application/json'},cache:'no-store',...(action?{body:JSON.stringify({action,...donnees})}:{})});
    if(!r.ok||!r.json?.ok)throw Error(r.json?.message||'Le serveur n’a pas confirmé. Rien n’a changé.');
    return r.json;
  };
  const adopter=v=>{setVue(v||null);try{onVue?.(v||null);}catch{}const a=v?.auto?.reglages;setForm(f=>f&&ouvert?f:{...AUTO_DEFAUT,...(a||{})});};
  const lire=async()=>{const k=++n.current;try{const j=await api();if(k===n.current&&ownerActuel()===owner){adopter(j.vue);setErreur('');}}catch(e){if(k===n.current)setErreur(e.message);}};
  React.useEffect(()=>{setVue(undefined);setForm(null);setConfirmer(false);if(uid&&owner)lire();},[uid,owner]);
  React.useEffect(()=>{const t=setInterval(()=>setMaintenant(Date.now()),30000);const ec=e=>{if(String(e.detail?.uid)===String(uid))lire();};window.addEventListener('vrm:favoris-auto',ec);return()=>{clearInterval(t);window.removeEventListener('vrm:favoris-auto',ec);};},[uid,owner]);
  const auto=vue?.auto||null,reg=auto?.reglages||null,actif=reg?.actif===true;
  const pause=Number(auto?.pauseJusqua)>maintenant?Number(auto.pauseJusqua):0;
  const envois=(auto?.envois||[]).filter(t=>t>maintenant-AUTO_JOUR_MS);
  const limite=reg?limiteJourAuto(reg,auto?.allumeLe,maintenant):null;
  let erreurForm='';try{if(form)validerAutoFavoris(form);}catch(e){erreurForm=e.message;}
  const changer=(k,v)=>setForm(f=>({...f,[k]:v}));
  const signaler=a=>{try{window.dispatchEvent(new CustomEvent('vrm:favoris-auto-regle',{detail:{uid:String(uid),actif:a}}));}catch{}};
  const enregistrer=async(allumer,confirme=false)=>{
    if(occupe)return;setOccupe(true);setErreur('');
    try{const r=validerAutoFavoris({...form,actif:allumer});const j=await api('auto_regler',{reglages:r,confirme});if(ownerActuel()===owner){adopter(j.vue);signaler(allumer);setConfirmer(false);setOuvert(false);setFeuille(false);}}
    catch(e){setErreur(e.message);}finally{setOccupe(false);}
  };
  const stop=async()=>{if(occupe)return;setOccupe(true);setErreur('');try{const j=await api('auto_stop');adopter(j.vue);signaler(false);}catch(e){setErreur(e.message+' Réessaie : le Stop doit être confirmé par le serveur.');}finally{setOccupe(false);}};
  if(!uid||!owner)return null;
  const reglagesForm=form?<div className="vrm-favoris-auto-reglages">
      <label>Attente après le favori, entre<input type="text" inputMode="numeric" maxLength={4} aria-label="Attente minimale en minutes" value={form.attenteMin} onChange={e=>changer('attenteMin',e.target.value)}/>et<input type="text" inputMode="numeric" maxLength={4} aria-label="Attente maximale en minutes" value={form.attenteMax} onChange={e=>changer('attenteMax',e.target.value)}/>min (tirée au hasard)</label>
      <label>Horaires (heure de Paris), de<input type="text" inputMode="numeric" maxLength={2} aria-label="Heure de début" value={form.heureDebut} onChange={e=>changer('heureDebut',e.target.value)}/>h à<input type="text" inputMode="numeric" maxLength={2} aria-label="Heure de fin" value={form.heureFin} onChange={e=>changer('heureFin',e.target.value)}/>h</label>
      <div role="group" aria-label="Jours" className="vrm-favoris-segment vrm-favoris-auto-jours">{JOURS_AUTO.map(([j,l])=><button type="button" key={j} aria-pressed={form.jours.map(Number).includes(j)} onClick={()=>changer('jours',form.jours.map(Number).includes(j)?form.jours.map(Number).filter(x=>x!==j):[...form.jours.map(Number),j])}>{l}</button>)}</div>
      <label>Au plus<input type="text" inputMode="numeric" maxLength={2} aria-label="Messages par 24 heures" value={form.parJour} onChange={e=>changer('parJour',e.target.value)}/>messages par 24 h et<input type="text" inputMode="numeric" maxLength={2} aria-label="Messages par heure" value={form.parHeure} onChange={e=>changer('parHeure',e.target.value)}/>par heure</label>
      <small>En plus de la limite d’actions de l’extension (50 par heure). La 1re semaine après l’allumage : 10 par jour au plus, la 2e : 20. Entre deux messages : 3 à 12 min au hasard. Le message et l’offre sont ceux de « Ton message ».</small>
      {erreurForm&&<p role="alert">{erreurForm}</p>}
      {!confirmer?<div className="vrm-favoris-auto-boutons">
        <button type="button" onClick={()=>{setOuvert(false);setForm({...AUTO_DEFAUT,...(reg||{})});}}>Annuler</button>
        {actif?<button type="button" className="is-principal" disabled={occupe||!!erreurForm} onClick={()=>enregistrer(true)}>Enregistrer</button>
          :<button type="button" className="is-principal" data-favoris-auto-continuer disabled={occupe||!!erreurForm} onClick={()=>setConfirmer(true)}>Continuer</button>}
      </div>:<div className="vrm-favoris-auto-confirmer" role="alertdialog" aria-label="Allumer le mode automatique ?" data-favoris-auto-confirmer>
        <strong>Allumer le mode automatique ?</strong>
        {RISQUE_AUTO.split('\n\n').map((t,i)=><p key={i}>{t}</p>)}
        <div className="vrm-favoris-auto-boutons"><button type="button" onClick={()=>setConfirmer(false)}>Annuler</button><button type="button" className="is-principal" data-favoris-auto-oui disabled={occupe} onClick={()=>enregistrer(true,true)}>{occupe?'Allumage…':'Oui, écrire tout seul'}</button></div>
      </div>}
    </div>:null;
  const dit=phraseModeAuto({auto,maintenant,extensionAuto,lu:vue!==undefined});
  const etat=dit?.etat||'lecture';
  const ouvrirReglages=()=>{setOuvert(true);setConfirmer(false);setForm(f=>({...AUTO_DEFAUT,...(reg||{}),...(f||{})}));};
  // ── (3 nov.) Dans la carte sombre de l'écran « Fusion » : UNE rangée — « Mode auto »,
  // l'interrupteur, et, s'il y a quelque chose, UNE ligne (le geste qui débloque, en
  // ambre ; sinon l'état). L'allumer passe TOUJOURS par la feuille (réglages, puis la
  // confirmation qui dit le risque) ; l'éteindre = Stop, tout de suite.
  if(variante==='carte'){
    const ligne=!dit?'':!actif?'':dit.ton==='geste'?(dit.geste||dit.texte):dit.texte.replace(/^(Allumé|Éteint|En attente)( :|,) ?/,'').replace(/^./,c=>c.toUpperCase());
    const fermer=()=>{if(!occupe){setFeuille(false);setOuvert(false);setConfirmer(false);}};
    const corps=<div className="vrm-favoris-voile vrm-fa-voile" data-noswipe="1" onClick={fermer}>
      {FermeAuRetour&&<FermeAuRetour fermer={fermer}/>}
      <div className="vrm-fa-feuille" role="dialog" aria-modal="true" aria-label="Mode auto" data-fav-auto-feuille onClick={e=>e.stopPropagation()}>
        <div className="vrm-fa-feuille-tete"><strong>Mode auto</strong><button type="button" className="vrm-fa-fermer" aria-label="Fermer" disabled={occupe} onClick={fermer}><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg></button></div>
        <div className="vrm-fa-feuille-corps vrm-favoris-auto">
          {actif&&reg&&!ouvert&&<>
            <p className="vrm-favoris-auto-compteurs" data-favoris-auto-compteurs>
              <span><b>{envois.length}</b> / {limite} sur 24 h</span>
              <span><b>{envois.filter(t=>t>maintenant-AUTO_HEURE_MS).length}</b> / {reg.parHeure} cette heure</span>
              <span>{reg.heureDebut} h–{reg.heureFin} h · {JOURS_AUTO.filter(([j])=>reg.jours.includes(j)).map(([,l])=>l).join(' ')}</span>
            </p>
            <div className="vrm-favoris-auto-boutons"><button type="button" className="vrm-favoris-auto-stop" data-favoris-auto-stop disabled={occupe} onClick={async()=>{await stop();setFeuille(false);}}>Éteindre</button><button type="button" onClick={()=>{setForm({...AUTO_DEFAUT,...reg});setOuvert(true);}}>Modifier</button></div>
          </>}
          {!actif&&!ouvert&&<div className="vrm-favoris-auto-boutons"><button type="button" className="is-principal" data-favoris-auto-allumer disabled={occupe||vue===undefined} onClick={ouvrirReglages}>Régler et allumer</button></div>}
          {ouvert&&form&&reglagesForm}
          {erreur&&<p role="alert">{erreur}</p>}
        </div>
      </div>
    </div>;
    return <div className="vrm-fa-auto" data-favoris-auto={actif?'on':'off'} data-favoris-auto-etat={etat} data-fav-auto-etat={etat} data-fav-auto-ton={dit?.ton||''}>
      <button type="button" className="vrm-fa-auto-tete" data-fav-auto-ouvrir onClick={()=>{if(!actif)ouvrirReglages();setFeuille(true);}} disabled={vue===undefined}>
        <span className="vrm-fa-auto-nom">Mode auto</span>
        {ligne&&<span className={'vrm-fa-auto-ligne'+(dit?.ton==='geste'?' is-geste':'')} data-fav-auto-phrase title={dit?.texte||undefined}>{ligne}</span>}
      </button>
      <button type="button" role="switch" aria-checked={actif} aria-label="Mode auto" className="vrm-fa-switch" data-fav-auto-switch data-fav-auto-allume={actif?'1':'0'} disabled={occupe||vue===undefined}
        onClick={()=>{if(actif)stop();else{ouvrirReglages();setFeuille(true);}}}><i aria-hidden="true"/></button>
      {erreur&&!feuille&&<p role="alert" className="vrm-fa-auto-erreur">{erreur}</p>}
      {feuille&&(typeof document!=='undefined'?createPortal(corps,document.body):corps)}
    </div>;
  }
  return <section className="vrm-favoris-auto" aria-label="Mode automatique des messages aux favoris" data-favoris-auto={actif?'on':'off'} data-favoris-auto-etat={etat} data-fav-auto-etat={etat} data-fav-auto-ton={dit?.ton||''}>
    <header><div><h4>Mode automatique</h4><small data-fav-auto-allume={actif?'1':'0'}>{actif?'Allumé':'Éteint'}</small></div>
      {actif?<button type="button" className="vrm-favoris-auto-stop" data-favoris-auto-stop disabled={occupe} onClick={stop}>Stop</button>
        :<button type="button" data-favoris-auto-allumer disabled={occupe||vue===undefined} onClick={()=>{setOuvert(true);setConfirmer(false);setForm(f=>({...AUTO_DEFAUT,...(reg||{}),...(f||{})}));}}>Allumer…</button>}
    </header>
    {vue===undefined&&!erreur&&<p role="status">Lecture…</p>}
    {dit&&<p role="status" data-favoris-auto-phrase data-fav-auto-phrase>{dit.texte.replace(/^(Allumé|Éteint)( :|,) ?/,'').replace(/^./,c=>c.toUpperCase())}</p>}
    {dit?.geste&&<p className={dit.ton==='geste'?'vrm-favoris-auto-geste':'vrm-favoris-auto-calme'} data-fav-auto-geste>{dit.geste}</p>}
    {actif&&reg&&!ouvert&&<details className="vrm-repli vrm-favoris-auto-repli">
      <summary>Réglages et limites</summary>
      <p className="vrm-favoris-auto-compteurs" data-favoris-auto-compteurs>
        <span><b>{envois.length}</b> / {limite} sur 24 h{limite<reg.parJour?' (démarrage en douceur)':''}</span>
        <span><b>{envois.filter(t=>t>maintenant-AUTO_HEURE_MS).length}</b> / {reg.parHeure} cette heure</span>
        <span>{reg.heureDebut} h–{reg.heureFin} h · {JOURS_AUTO.filter(([j])=>reg.jours.includes(j)).map(([,l])=>l).join(' ')}</span>
      </p>
      <p className="vrm-favoris-note">Les messages partent tant que VRM est ouvert sur cet ordinateur, avec l’onglet vinted.fr de ce compte. Ordinateur éteint : rien ne part, rien n’est rattrapé d’un coup.</p>
      <button type="button" onClick={()=>{setForm({...AUTO_DEFAUT,...reg});setOuvert(true);}}>Modifier les réglages</button>
    </details>}
    {ouvert&&form&&reglagesForm}
    {erreur&&<p role="alert">{erreur}</p>}
  </section>;
}
