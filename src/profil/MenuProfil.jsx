import { tr } from '../i18n/index.js';
import React,{useState} from 'react';
import {AvatarCompte,ChoixPhoto,useNomMasque,poserNomMasque} from './AvatarPersonnel.jsx';
import {nomAffiche,initialeAffichee,emailMasque} from './identiteProfil.js';
// ═══════════════════════════════════════════════════════════════════════════
// LE MENU DU PROFIL (11 nov., lot DJ6)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « je veux qu'on ne voie pas les Paramètres mais que quand on clique sur
// le profil ils apparaissent ». La photo (colonne de l'ordinateur, en-tête du
// téléphone) ouvre CETTE feuille : photo + nom (ou masqué) + e-mail + formule,
// puis Paramètres · Appareils connectés · Se déconnecter. « g p » et ⌘K mènent
// toujours à Paramètres (src/raccourcisClavier.js) ; `?tab=settings` aussi.

// La pastille ronde (photo, sinon l'initiale), partout la même.
export function PastilleProfil({owner,headers,nom,email,taille=32,className=''}){
 const masque=useNomMasque(owner,headers);
 // Pas encore lu ⇒ on ne montre pas l'initiale du nom (elle pourrait être masquée).
 const lettre=masque===undefined?'':initialeAffichee({masque,nom,email});
 return <span className={`vrm-profil-pastille ${className}`} aria-hidden="true" data-nom-masque={masque===undefined?'':masque?'1':'0'} style={{width:taille,height:taille,fontSize:Math.round(taille*0.42)}}><AvatarCompte owner={owner} headers={headers} lettre={lettre}/></span>;
}
// Le nom de la coque : masqué (ou pas encore lu) ⇒ « Mon compte ».
export function useNomCoque({owner,headers,nom,email}){
 const masque=useNomMasque(owner,headers);
 return {masque,texte:nomAffiche({masque:masque!==false,nom,email})};
}

// (14 nov., refonte de la coque) `enPlus` : les commandes que la barre du haut du téléphone ne porte plus
// (l'état « Actions Vinted », l'œil des montants) — posées par la coque, après Paramètres.
export default function MenuProfil({owner,headers,email,nom,offre,theme:C,Feuille,Icon,onFermer,onParametres,onAppareils,onDeconnexion,enPlus=null,ecrans=null}){
 const masque=useNomMasque(owner,headers);
 const [occupe,setOccupe]=useState(false),[msg,setMsg]=useState(''),[photo,setPhoto]=useState(false);
 const basculer=async()=>{setOccupe(true);setMsg('');try{await poserNomMasque(owner,headers,!masque);}catch(e){setMsg(e.message);}finally{setOccupe(false);}};
 const ligne=(id,icone,lib,onClick,extra={})=><button type="button" className="vrm-profil-ligne" data-profil-menu={id} onClick={onClick} {...extra}>
  <span className="vrm-profil-ligne-ic" aria-hidden="true"><Icon name={icone} size={18}/></span><span className="vrm-profil-ligne-lib">{lib}</span><span aria-hidden="true" className="vrm-profil-ligne-fin"><Icon name="chevron" size={15}/></span></button>;
 const nomVu=masque===false?nomAffiche({masque:false,nom,email}):tr('profil.nomMasque');
 return <Feuille onClose={onFermer} titre={tr('coque.monProfil')} maxWidth={420} data-menu-profil="">
  <div className="vrm-profil-menu">
   <div className="vrm-profil-tete">
    <button type="button" className="vrm-profil-photo" data-profil-photo="" aria-label={tr('profil.changerPhoto')} aria-expanded={photo} onClick={()=>setPhoto(v=>!v)}>
     <PastilleProfil owner={owner} headers={headers} nom={nom} email={email} taille={64}/>
    </button>
    <div style={{minWidth:0}}>
     <div className="vrm-profil-nom vrm-sensible" data-stream-type="compte" data-profil-nom={masque===false?'visible':'masque'}>{nomVu}</div>
     {(masque!==false||String(nom||'').trim())?<div className="vrm-profil-mail vrm-sensible" data-stream-type="compte" data-profil-mail="">{masque===false?email:emailMasque(email)}</div>:null}
     {offre?<span className="vrm-profil-offre" data-profil-offre={offre}>{offre}</span>:null}
    </div>
   </div>
   {photo&&<div className="vrm-profil-choix-photo" data-profil-choix-photo=""><ChoixPhoto owner={owner} headers={headers} theme={C} compact/></div>}
   {/* (14 nov., maquette de Julien) Au téléphone, l'avatar ouvre AUSSI le reste des écrans (le menu du haut). */}
   {ecrans}
   {/* (11 nov., lot DJ6) Le geste le plus fréquent d'abord : Paramètres, puis le réglage du nom. */}
   <div className="vrm-profil-groupe">
    {ligne('parametres','gear',tr('ecran.settings'),onParametres)}
    {ligne('appareils','shield',tr('profil.appareils'),onAppareils)}
   </div>
   {enPlus?<div className="vrm-profil-groupe" data-profil-coque="">{enPlus}</div>:null}
   <div className="vrm-profil-groupe">
    <label className="vrm-profil-ligne vrm-profil-bascule" data-profil-menu="masquer">
     <span className="vrm-profil-ligne-ic" aria-hidden="true"><Icon name="eye" size={18}/></span>
     <span className="vrm-profil-ligne-lib">{tr('profil.masquerNom')}</span>
     <input type="checkbox" role="switch" checked={masque===true} disabled={occupe||masque===undefined} onChange={basculer} aria-label={tr('profil.masquerNom')}/>
    </label>
   </div>
   {msg&&<p role="alert" style={{fontSize:13,margin:'0 4px'}}>{msg}</p>}
   <div className="vrm-profil-groupe">
    {ligne('deconnexion','door',tr('profil.deconnexion'),onDeconnexion)}
   </div>
  </div>
 </Feuille>;
}
