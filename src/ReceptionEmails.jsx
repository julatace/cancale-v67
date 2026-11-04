import ConfigurerTransfert from './ConfigurerTransfert.jsx';
import React,{useState,useEffect,useCallback,useRef} from 'react';
import {typesEmail,destinationEmail} from './receptionEmail.js';
import './reception-emails.css';
import {reponseReception,gestesEmails,ceQueVrmAFait,arriveesParAdresse} from './emailsApercu.js';
import {requeteJsonBornee} from './requeteJsonBornee.js';
const date=v=>v?new Date(v).toLocaleString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'Pas encore mesuré';
const Picto=({nom,...props})=><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{nom==='refresh'?<><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 6.1a8 8 0 0 1 13 2.4M4.9 15.5a8 8 0 0 0 13 2.4"/></>:nom==='chevron'?<path d="m9 5 7 7-7 7"/>:<><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></>}</svg>;
const libelles={integre:'Rangé','a-verifier':'À vérifier',erreur:'En attente'};
export default function ReceptionEmails({owner,headers,quarantaine,onVerifier,theme={},version=0,onAdresses,onComptes,onDeclarer,preuves,onConfirmer,section='tout',adresseGuide,guideOuvert=false,onFermerGuide,onVoirReception,onAdresseGuide,onJournal,onOnglet}){
 const [donnees,setDonnees]=useState(),[erreur,setErreur]=useState(false),[lecture,setLecture]=useState(false),[filtre,setFiltre]=useState('tous'),[recherche,setRecherche]=useState(''),[adresse,setAdresse]=useState('toutes'),[max,setMax]=useState(10),[maintenant,setMaintenant]=useState(Date.now());
 const generation=useRef(0),enCours=useRef(null),zone=useRef(null),visible=useRef(true),derniereLecture=useRef(0),versionLue=useRef(version),auth=useRef(headers);auth.current=headers;const retourAdresses=useRef(onAdresses);retourAdresses.current=onAdresses;
 const charger=useCallback((forcer=false)=>{
  if(enCours.current?.owner===owner&&forcer!==true)return enCours.current.promesse;
  enCours.current?.controle.abort();
  const g=++generation.current,controle=new AbortController(),travail={owner,g,controle,promesse:null};
  enCours.current=travail;setLecture(true);setErreur(false);
  travail.promesse=(async()=>{
   try{const r=await requeteJsonBornee('/api/email-rattacher?mode=reception',{headers:auth.current(),cache:'no-store',signal:controle.signal});if(!r.ok)throw Error();const j=r.json;if(!j?.ok||!Array.isArray(j.emails))throw Error();if(g===generation.current){setDonnees({...j,owner});retourAdresses.current?.({owner,adresses:j.adresses||[]});return true;}return false;}
   catch(_){if(g===generation.current&&!controle.signal.aborted)setErreur(true);return false;}
   finally{if(g===generation.current){derniereLecture.current=Date.now();setLecture(false);setMaintenant(Date.now());}if(enCours.current===travail)enCours.current=null;}
  })();
  return travail.promesse;
 },[owner]);
 useEffect(()=>{
  setDonnees(undefined);setFiltre('tous');setRecherche('');setAdresse('toutes');setMax(10);versionLue.current=version;charger();
  const retour=()=>{if(document.visibilityState==='visible'&&visible.current)charger();};
  document.addEventListener('visibilitychange',retour);
  const timer=setInterval(()=>{if(document.visibilityState==='visible'&&visible.current){setMaintenant(Date.now());charger();}},60000);
  return()=>{generation.current++;enCours.current?.controle.abort();enCours.current=null;clearInterval(timer);document.removeEventListener('visibilitychange',retour);};
 },[charger]);
 useEffect(()=>{if(versionLue.current!==version){versionLue.current=version;charger(true);}},[version,charger]);
 useEffect(()=>{
  if(typeof IntersectionObserver!=='function'||!zone.current)return;
  const observateur=new IntersectionObserver(entries=>{const avant=visible.current;visible.current=entries.some(e=>e.isIntersecting);if(!avant&&visible.current&&document.visibilityState==='visible'&&Date.now()-derniereLecture.current>=60000)charger();});
  observateur.observe(zone.current);return()=>observateur.disconnect();
 },[charger]);
 const d=donnees?.owner===owner?donnees:undefined;
 const emails=d?.emails||[],q=recherche.trim().toLocaleLowerCase('fr');
 const parAdresse=emails.filter(e=>adresse==='toutes'||e.adresses?.includes(adresse));
 const liste=parAdresse.filter(e=>(filtre==='tous'||e.etat===filtre)&&(!q||[e.subject,e.from,e.compte?.nom,...(e.adresses||[]),e.raison,typesEmail[e.type]||e.type].join(' ').toLocaleLowerCase('fr').includes(q)));
 return <section ref={zone} style={{'--card':theme.card,'--text':theme.text,'--border':theme.border,'--muted':theme.muted}} className="vrm-reception" aria-label="Réception des emails" data-reception-emails="" data-mode={section}>
 <div hidden={section==='configuration'}>
 <ApercuEmails d={erreur&&!d?null:d} erreur={erreur} lecture={lecture} maintenant={maintenant} quarantaine={quarantaine} preuves={preuves} onActualiser={()=>charger(true)} onVerifier={onVerifier} onJournal={onJournal} onOnglet={onOnglet}/>
 {d&&<details className="vrm-repli vrm-reception-repli" data-reception-liste="">
 <summary>Chercher un e-mail précis</summary>

 {Array.isArray(d.adresses)&&d.adresses.length>0&&<div className="vrm-reception-comptes"><label htmlFor="vrm-reception-compte">Compte / adresse</label><select id="vrm-reception-compte" value={adresse} onChange={e=>{setAdresse(e.target.value);setMax(10);}}><option value="toutes">Tous mes comptes et adresses</option>{d.adresses.map(a=><option key={a.adresse} value={a.adresse}>{a.comptes?.length===1?a.comptes[0].nom+' · ':''}{a.adresse}{a.comptes?.length>1?' · association à corriger':''}</option>)}</select>{adresse!=='toutes'&&<small>{d.adresses.find(a=>a.adresse===adresse)?.declaree===false?'Adresse à déclarer dans « Comptes et transfert ».':`Réception sur ${adresse}. Les autres comptes restent accessibles dans la liste.`}</small>}</div>}

 <div className="vrm-reception-filtres"><input type="search" aria-label="Rechercher dans la réception des emails" placeholder="Sujet, compte, expéditeur…" value={recherche} onChange={e=>{setRecherche(e.target.value);setMax(10);}}/>{filtre!=='tous'&&<button type="button" onClick={()=>setFiltre('tous')}>Tous les états</button>}</div>
 {!liste.length&&<p>{emails.length?'Aucun e-mail ne correspond.':'Aucun e-mail suivi pour l’instant.'}</p>}
 <ul className="vrm-reception-liste">{liste.slice(0,max).map(e=><li key={e.id}><details><summary aria-label={`${e.subject} · ${libelles[e.etat]} · détails et conservation`}><span className="vrm-reception-email-picto"><Picto/></span><span className="vrm-reception-email-titre"><strong>{e.subject}</strong><small className="vrm-reception-email-meta"><span className="vrm-reception-compte-nom" title={e.compte?.nom||''}>{e.compte?.nom||(e.compteAmbigu?'Compte ambigu':'Compte à identifier')}</span>{e.compte?.bloque&&<span className="vrm-reception-bloque" title={e.compte.etatLuLe?`État Vinted observé le ${date(e.compte.etatLuLe)}`:'Blocage confirmé par le profil Vinted'}>Bloqué</span>}<span>{typesEmail[e.type]||'Information'} · {date(e.at)}</span></small></span><span className="vrm-reception-etat" data-etat={e.etat}>{libelles[e.etat]}</span><Picto nom="chevron" className="vrm-reception-chevron"/></summary><div className="vrm-reception-contenu">{e.adresses?.length>0&&<p><b>Adresses de réception</b> · {e.adresses.join(' · ')}</p>}{e.adresses?.length>1&&<p>Plusieurs adresses de ta boutique figurent dans ce mail : aucun compte unique n’est déduit.</p>}{e.compte?.bloque&&<p>Blocage signalé par le profil Vinted{e.compte.etatLuLe?` · état lu le ${date(e.compte.etatLuLe)}`:''}.</p>}{!e.compte&&<p>{e.compteAmbigu?'Plusieurs comptes sont associés aux adresses de ce mail. Aucun n’est choisi arbitrairement.':'Associe cette adresse au bon compte dans Comptes liés. Le nom n’est pas deviné depuis le texte du mail.'}</p>}<p><b>Expéditeur</b> · {e.from||'Non renseigné'}</p>{e.sourceDate&&<p>Mail daté du {date(e.sourceDate)}</p>}{e.raison&&<p>{e.raison}</p>}<p>{destinationEmail(e)}</p><p className="vrm-reception-note">VRM garde cet e-mail : rien n’est supprimé (l’original reste aussi dans ta messagerie).</p></div></details></li>)}</ul>
 {liste.length>max&&<button type="button" onClick={()=>setMax(n=>n+10)}>Afficher les suivants</button>}
 </details>}
 </div>
 <div hidden={section==='reception'}> {section==='configuration'&&guideOuvert&&<button type="button" className="vrm-email-fermer-guide" onClick={onFermerGuide}>Fermer le guide</button>}{d?<ConfigurerTransfert adresses={d.adresses||[]} preuves={preuves} onComptes={onComptes} onDeclarer={onDeclarer} onConfirmer={onConfirmer} onActualiser={charger} ouvert={section==='configuration'&&guideOuvert} adresseInitiale={adresseGuide} onChoixAdresse={onAdresseGuide}/>:<p role={erreur?'alert':'status'}>{erreur?'La configuration n’a pas pu être lue.':'Lecture de la configuration…'}{erreur&&<button type="button" onClick={charger}>Réessayer</button>}</p>}</div>
 </section>;
}

// ── L'APERÇU (2 nov.) ───────────────────────────────────────────────────────
// 1. « Est-ce que mes e-mails arrivent ? » (oui / à vérifier / pas su) et le
//    dernier arrivé ; 2. ce qu'il reste à faire, une ligne par cause, son geste
//    en ambre ; 3. ce que VRM en a fait, en mots simples ; 4. chaque adresse et
//    son dernier e-mail. Les phrases viennent de src/emailsApercu.js, sur les
//    mêmes lectures que l'écran d'avant — aucune règle neuve.
function ApercuEmails({d,erreur,lecture,maintenant,quarantaine,preuves,onActualiser,onVerifier,onJournal,onOnglet}){
 const rep=reponseReception(d,maintenant);
 const gestes=d?gestesEmails({d,quarantaine,preuves}):[];
 const fait=ceQueVrmAFait(d),adresses=arriveesParAdresse(d,maintenant);
 const aller=(g)=>{if(g.vers==='a-traiter')return onVerifier?.();if(g.vers==='journal')return onJournal?.(g.etat||'','');onOnglet?.(g.vers);};
 // « Rien à faire » ne se dit que si tout ce qui pourrait demander un geste a été LU.
 const toutLu=d&&Array.isArray(quarantaine)&&(preuves!==undefined);
 return <div className="vrm-emails-apercu" data-emails-apercu="" data-reponse={rep.etat}>
  <section className="vrm-apercu-reponse" data-apercu-reponse={rep.etat} role={erreur&&!d?'alert':undefined} aria-live="polite">
   <span className="vrm-apercu-pastille" aria-hidden="true"/>
   <div className="vrm-apercu-reponse-texte"><h3>{rep.titre}</h3>{rep.phrase&&<p data-apercu-dernier="">{rep.phrase}</p>}</div>
   <button type="button" className="vrm-apercu-actualiser" onClick={onActualiser} disabled={lecture}>{lecture?'Lecture…':erreur?'Réessayer':'Actualiser'}</button>
  </section>
  {erreur&&d&&<p role="alert" className="vrm-apercu-alerte">Je n’ai pas pu relire la réception{d?' : ce qui suit date de la dernière lecture':''}. <button type="button" onClick={onActualiser} disabled={lecture}>Réessayer</button></p>}
  {d&&(gestes.length>0
   ?<section className="vrm-apercu-bloc" data-apercu-gestes={gestes.length}><h4>À faire</h4><ul className="vrm-apercu-lignes">{gestes.map(g=><li key={g.k} data-apercu-geste={g.k} data-n={g.n}><span>{g.phrase}</span><button type="button" className="vrm-apercu-geste" aria-label={g.vers==='a-traiter'?'Vérifier les emails mis de côté':`${g.bouton} : ${g.phrase}`} onClick={()=>aller(g)}>{g.bouton}</button></li>)}</ul></section>
   :toutLu?<p className="vrm-apercu-rien" data-apercu-gestes="0">Rien à faire de ton côté.</p>:null)}
  {d&&quarantaine===null&&<p className="vrm-apercu-note" data-apercu-mis-de-cote="pas-su">Je n’ai pas pu lire les e-mails mis de côté — rien n’est perdu, rouvre cet écran dans un moment.</p>}
  {fait&&<section className="vrm-apercu-bloc" data-apercu-fait={fait.sur}><h4>Ce que VRM en a fait</h4>
   {fait.lignes.length?<ul className="vrm-apercu-lignes">{fait.lignes.map(l=><li key={l.k} data-apercu-famille={l.k} data-n={l.n}><button type="button" className="vrm-apercu-lien" onClick={()=>onJournal?.(l.etat||'',l.type||'')}><span>{l.phrase}</span><span aria-hidden="true">›</span></button></li>)}</ul>:<p className="vrm-apercu-note">Aucun e-mail suivi pour l’instant : le prochain apparaîtra ici.</p>}
   {fait.sur>0&&<p className="vrm-apercu-note" data-apercu-sur={fait.sur}>Sur tes {fait.sur} derniers e-mails{fait.plus?' (les plus anciens ne sont pas comptés)':''}. Touche une ligne pour voir les e-mails.</p>}
  </section>}
  {adresses&&adresses.length>1&&<section className="vrm-apercu-bloc" data-apercu-adresses={adresses.length}><h4>Par adresse</h4><ul className="vrm-apercu-lignes">{adresses.map(a=><li key={a.adresse} data-apercu-adresse={a.adresse} data-vu={a.vu?'1':'0'}><span className="vrm-apercu-adresse"><b>{a.nom}</b><small>{a.adresse}</small></span><span className="vrm-apercu-quand" data-vu={a.vu?'1':'0'}>{a.phrase}</span></li>)}</ul></section>}
 </div>;
}
