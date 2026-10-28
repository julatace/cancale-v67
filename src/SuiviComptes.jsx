import React from 'react';import {suiviComptes} from './suiviComptes.js';
export default function SuiviComptes({comptes=[],lignes,onComptes}){
 if(!comptes.length)return null;const suivis=suiviComptes(comptes,lignes);
 return <details className="vrm-suivi-comptes"><summary>Vinted · suivi par compte ({suivis.length})</summary><p>Dates de capture observées, pas une garantie d’exhaustivité. Les photos ne sont pas comptées par ce relevé : vérifie-les dans les annonces et les ventes.</p>
 {suivis.map(c=><section key={c.id}><h4>{c.nom}</h4><dl>{Object.entries(c.sources).map(([source,etat])=><div key={source}><dt>{source[0].toUpperCase()+source.slice(1)}</dt><dd>{etat.date?<time dateTime={etat.date}>{new Date(etat.date).toLocaleString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</time>:etat.etat==='inconnu'?'Lecture non vérifiée':'Pas de capture observée'}</dd></div>)}</dl></section>)}
 <p>Ouvre le bon compte sur Vinted avec l’extension active, puis actualise les états.</p>{onComptes&&<button type="button" onClick={onComptes}>Gérer mes comptes liés</button>}
 </details>;
}
