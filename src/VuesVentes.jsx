import React, { useEffect, useId, useRef, useState } from 'react';
import { lireVues, ecrireVues, nettoyerVue, restaurerVue } from './vuesVentes.js';
import './vues-ventes.css';
const periodeLisible = p => p ? [p.from,p.to].map(d=>d?new Date(d).toLocaleDateString('fr-FR'):'…').join(' → ') : '';
const libelles = { all:'Toutes', pending:'À expédier', done:'Terminées', cancelled:'Annulées', aexpedier:'À expédier', transit:'En transit', finalisees:'Finalisées', annulees:'Annulées' };
export default function VuesVentes({ owner, plateforme, valeur, onAppliquer }) {
  const contexte = JSON.stringify([owner, plateforme]);
  const [etat, setEtat] = useState(() => ({ contexte, vues:lireVues(owner, plateforme) }));
  const vues = etat.contexte === contexte ? etat.vues : lireVues(owner, plateforme);
  const [nom,setNom] = useState(''), [message,setMessage] = useState(''), [supprimee,setSupprimee] = useState(null);
  const details = useRef(null), bouton = useRef(null), champ = useRef(null);
  const id = useId();
  useEffect(() => { setNom('');setMessage('');setSupprimee(null);if(details.current)details.current.open=false; }, [contexte]);
  useEffect(() => {
    const actualiser = e => { if(e.key === `vrm_vues_ventes:${JSON.stringify([owner,plateforme])}`) setEtat({contexte,vues:lireVues(owner,plateforme)}); };
    window.addEventListener('storage',actualiser);return()=>window.removeEventListener('storage',actualiser);
  },[contexte,owner,plateforme]);
  const sauver = liste => {
    if(!ecrireVues(owner,plateforme,liste)){setMessage('Enregistrement impossible. Vérifie que le stockage du navigateur est autorisé.');return false;}
    setEtat({contexte,vues:liste});return true;
  };
  const enregistrer = e => {
    e.preventDefault();const titre=nom.trim(), vue=nettoyerVue(valeur,plateforme), actuelles=lireVues(owner,plateforme);
    if(!titre){setMessage('Donne un nom à cette vue.');champ.current?.focus();return;}
    if(actuelles.some(v=>v.nom.toLocaleLowerCase('fr')===titre.toLocaleLowerCase('fr'))){setMessage('Ce nom existe déjà. Choisis un autre nom.');return;}
    if(actuelles.length>=12){setMessage('Tu as déjà 12 vues. Supprime une vue avant d’en ajouter une.');return;}
    if(!vue){setMessage('Ces filtres ne peuvent pas être enregistrés.');return;}
    if(sauver([...actuelles,{id:crypto.randomUUID(),nom:titre,vue}])){setNom('');setSupprimee(null);setMessage('Vue enregistrée sur ce navigateur.');}
  };
  const appliquer = v => {const valeur=restaurerVue(v.vue,plateforme);if(!valeur)return;onAppliquer(valeur);details.current.open=false;bouton.current?.focus();setMessage(`Vue « ${v.nom} » appliquée.`);};
  return <div className="vrm-vues" data-vues-plateforme={plateforme}>
    <details ref={details} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();details.current.open=false;bouton.current?.focus();}}}>
      <summary ref={bouton}>Mes vues{vues.length>0 && <span>{vues.length}</span>}</summary>
      <section aria-label="Vues de ventes enregistrées" className="vrm-vues-panneau">
        <p>Retrouve tes filtres sur ce navigateur. Le compte sélectionné reste inchangé. Les dates enregistrées restent fixes.</p>
        {!owner ? <p>Connecte-toi pour enregistrer tes vues.</p> : <>
          {vues.length ? <ul>{vues.map(v=><li key={v.id}><button type="button" className="vrm-vue-appliquer" onClick={()=>appliquer(v)}><strong>{v.nom}</strong><small>{v.vue.filtre==='done' && plateforme==='ebay'?'Expédiées':libelles[v.vue.filtre]}{v.vue.recherche ? ` · ${v.vue.recherche}`:''}{v.vue.periode ? ` · ${periodeLisible(v.vue.periode)}`:''}</small></button><button type="button" aria-label={`Supprimer la vue ${v.nom}`} onClick={()=>{if(sauver(lireVues(owner,plateforme).filter(x=>x.id!==v.id))){setSupprimee(v);setMessage('Vue supprimée.');}}}>×</button></li>)}</ul> : <p>Aucune vue enregistrée.</p>}
          {supprimee && <button type="button" onClick={()=>{const actuelles=lireVues(owner,plateforme);if(actuelles.length>=12 || actuelles.some(v=>v.id===supprimee.id || v.nom.toLocaleLowerCase('fr')===supprimee.nom.toLocaleLowerCase('fr'))){setMessage('Impossible de restaurer cette vue : vérifie les noms et le nombre de vues.');return;}if(sauver([...actuelles,supprimee])){setSupprimee(null);setMessage('Vue restaurée.');}}}>Annuler la suppression</button>}
          <form onSubmit={enregistrer}><label htmlFor={id}>Enregistrer les filtres actuels</label><div><input ref={champ} id={id} value={nom} onChange={e=>setNom(e.target.value)} maxLength={40} placeholder="Nom de la vue" autoComplete="off"/><button type="submit">Enregistrer</button></div></form>
        </>}
      </section>
    </details>
    <span role="status" className="vrm-vues-message">{message}</span>
  </div>;
}
