import React from 'react';
import {passationMissions,reapprovisionnement,csvReappro} from './syntheses.js';
export function PassationMissions({missions,maintenant,mode,onMode}) {
 const resume=passationMissions(missions,maintenant);
 return <details className="ops-synthese"><summary>Passation d’équipe · {resume.bloquees.length} blocage{resume.bloquees.length>1?'s':''} · {resume.avalider.length} à valider</summary>
 <p className="ops-note">État actuel des missions enregistrées. Les missions validées ci-dessous concernent les dernières 24 heures.</p>
 <div className="ops-passation" role="group" aria-label="Filtrer la passation">
 {Object.entries({bloquees:'Blocages',avalider:'À valider',prochaines:'Prochaines actions',validees:'Validées · 24 h'}).map(([k,label])=><button type="button" key={k} aria-pressed={mode===k} onClick={()=>onMode(mode===k?'':k)}><strong>{resume[k].length}</strong><span>{label}</span></button>)}
 </div>{mode && <button type="button" onClick={()=>onMode('')}>Voir toutes les missions</button>}
 </details>;
}
export function ListeReappro({consommables}) {
 const {lignes,inconnus}=reapprovisionnement(consommables);
 const exporter=()=>{const url=URL.createObjectURL(new Blob([csvReappro(lignes)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='VRM-reapprovisionnement-'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return <details className="ops-synthese"><summary>Réapprovisionnement · {lignes.length} consommable{lignes.length>1?'s':''}</summary>
 <p className="ops-note">Quantité minimale pour dépasser le seuil, calculée sur tes comptages. Aucun achat ni mouvement de stock n’est créé.</p>
 {inconnus.length>0&&<p className="ops-note">{inconnus.length} stock{inconnus.length>1?'s':''} à initialiser : exclus du calcul.</p>}
 {lignes.length ? <><ul className="ops-reappro">{lignes.map(x=><li key={x.id}><span>{x.titre}<small>{x.stock} en stock · seuil {x.seuil}</small></span><strong>+{x.minimum} {{piece:'pièce',rouleau:'rouleau',metre:'mètre'}[x.unite]||x.unite}{x.minimum>1?'s':''}</strong></li>)}</ul><button type="button" onClick={exporter}>Exporter la liste CSV</button></> : <p className="ops-note">Aucun stock renseigné au seuil ou en dessous.</p>}
 </details>;
}
