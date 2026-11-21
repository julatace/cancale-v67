import React from 'react';
// Un anneau représente uniquement les observations connues ; sa couverture
// reste affichée par le composant parent. Le reste du top est agrégé, pas perdu.
export default function RepartitionAnneau({elements,total,libelle='ventes'}) {
 const valeurs=(elements||[]).filter(e=>Number.isFinite(e.n)&&e.n>0);
 // (5 nov., chantier F, revue 2.26) Rien à répartir (aucune part, total nul ou pas su) : l'anneau
 // ne rend RIEN — jamais un cercle gris vide avec « 0 ventes » au centre.
 if(!valeurs.length||!(Number(total)>0))return null;
 const somme=valeurs.reduce((s,e)=>s+e.n,0);const reste=Math.max(0,total-somme);
 const arcs=reste?[...valeurs,{k:'Autres',n:reste}]:valeurs;
 const couleurs=['var(--vrm-accent,#0071E3)','#6E6E73','#8E8E93','#AEAEB2','#C7C7CC','#636366','#E5E5EA'];
 let avance=0;const longueur=2*Math.PI*38;
 return <figure className="vrm-repartition-anneau" aria-label={`${total} ${libelle} réparties`}>
  <svg viewBox="0 0 100 100" role="img" aria-label={arcs.map(e=>`${e.k} : ${e.n}`).join(', ')}>
   <circle cx="50" cy="50" r="38" fill="none" stroke="var(--vrm-card2)" strokeWidth="12"/>
   {arcs.map((e,i)=>{const debut=avance;avance+=e.n;return <circle key={i} cx="50" cy="50" r="38" fill="none" stroke={couleurs[i%couleurs.length]} strokeWidth="12" strokeDasharray={`${total?e.n/total*longueur:0} ${longueur}`} strokeDashoffset={-debut/Math.max(1,total)*longueur} transform="rotate(-90 50 50)"/>;})}
   <text x="50" y="49" textAnchor="middle" dominantBaseline="middle" fill="var(--vrm-ink)" fontSize="20" fontWeight="650">{total}</text>
   <text x="50" y="65" textAnchor="middle" fill="var(--vrm-muted)" fontSize="11">{libelle}</text>
  </svg>
 </figure>;
}
