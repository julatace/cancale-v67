// ── src/natif/Vide.jsx — l'état vide : une icône, UNE phrase, UN geste ───────────────────
// Props :
//   icone     nœud (une icône de l'app, taille 40) — muette, décorative
//   phrase    la phrase (17/22) : ce qu'il n'y a pas, dit simplement
//   detail    (rare) une 2e ligne courte, 15/20 — pas une explication permanente
//   action    nœud : UN <Bouton variante="teinte">…</Bouton> (ou rien)
// Exemple :
//   <Vide icone={<Icon name="box" size={40}/>} phrase="Aucun colis à envoyer."
//         action={<Bouton onClick={voirVentes}>Voir les ventes</Bouton>}/>
import React from 'react';
import { cx } from './outils.js';

export function Vide({ icone = null, phrase, detail = '', action = null, className = '' }) {
  return (
    <div className={cx('n-vide', className)}>
      {icone ? <span className="n-vide-icone" aria-hidden="true">{icone}</span> : null}
      <p className="n-vide-phrase">{phrase}</p>
      {detail ? <p className="n-vide-detail">{detail}</p> : null}
      {action ? <div className="n-vide-action">{action}</div> : null}
    </div>
  );
}

export default Vide;
