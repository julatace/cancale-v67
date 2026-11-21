import React from 'react';
import { phraseDejaEnStock } from './dejaEnStock.js';

// « Tu as déjà N paires de ce modèle en stock » (9 nov., lot F). Une INFORMATION :
// toucher déplie la liste des paires (N°, photo, taille, en ligne depuis N j).
// Aucun bouton, aucune écriture, aucune liaison (§5).
// r : le résultat de `pairesDuModele` ; Photo : le composant photo de l'app.
export function DejaEnStock({ r, autres = false, C, Photo = null }) {
  if (!r || !r.n) return null;
  return <details className="vrm-repli" data-deja-stock={r.n} style={{ fontSize: 13, color: C.text, marginTop: 6 }}>
    <summary style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', gap: 6 }}>
      <span data-deja-stock-phrase="">{phraseDejaEnStock(r.n, { autres })}</span>
    </summary>
    <div data-deja-stock-liste="" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
      {r.paires.map((p) => (
        <div key={p.id} data-deja-stock-paire={p.id} data-deja-stock-num={p.num || undefined} style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ width: 36, height: 36, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: C.card2 || C.border }}>
            {p.photo && Photo ? <Photo src={p.photo} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <b style={{ fontVariantNumeric: 'tabular-nums' }}>{p.num ? `N°${p.num}` : 'Sans N°'}</b> {p.titre}
            </span>
            <span style={{ display: 'block', fontSize: 12, color: C.muted }}>
              {p.taille ? `Taille ${p.taille}` : 'taille pas lue'} · {p.jours == null ? 'en ligne depuis : pas su' : p.jours === 0 ? 'en ligne depuis aujourd’hui' : `en ligne depuis ${p.jours} j`}
            </span>
          </span>
        </div>
      ))}
    </div>
  </details>;
}
