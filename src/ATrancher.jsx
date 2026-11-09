// ══════════════════════════════════════════════════════════════════════════════
//  L'ÉCRAN « À TRANCHER » (9 nov., lot AC) — une ligne = UNE chose + UN geste.
//  Les nombres viennent de src/aTrancher.js (`lignesATrancher`), qui ne fait que
//  CONSOMMER ce que chaque écran propriétaire publie. Le geste n'écrit rien : il
//  OUVRE l'écran propriétaire au bon endroit (`onAller`), où il tranche.
//  Formes existantes seulement (GroupeIos / RangeeIos, `vrm-vide-dessin`) : le
//  style est l'affaire de la direction artistique.
// ══════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { GroupeIos, RangeeIos } from './composants/Ios.jsx';

export default function ATrancher({ etat, onAller, entete = null }) {
  if (!etat) return null;
  const { aTrancher, manque, total, partiel } = etat;
  const resume = total > 0
    ? `${partiel ? 'Au moins ' : ''}${total} ${total > 1 ? 'choses' : 'chose'} à trancher`
    : partiel ? 'Rien à trancher dans ce qui est compté' : 'Rien à trancher';
  return (
    <div className="vrm-a-trancher" data-a-trancher={total} data-a-trancher-partiel={partiel ? '1' : '0'} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {entete}
      {aTrancher.length ? (
        <GroupeIos titre={resume} data-a-trancher-groupe="lignes"
          pied="Le geste ouvre l’écran où tu tranches ; rien ne se fait ici tout seul.">
          {aTrancher.map((l) => (
            <RangeeIos key={l.cle} data-a-trancher-ligne={l.cle} data-n={l.n}
              titre={l.quoi} detail={l.noms && l.noms.length ? `${l.pourquoi} · ${l.noms.join(', ')}` : l.pourquoi}
              valeur={l.geste.libelle} ton="geste" valeurAttrs={{ 'data-a-trancher-geste': l.cle }}
              onClick={() => onAller && onAller(l)}/>
          ))}
        </GroupeIos>
      ) : (
        <div className="vrm-vide-dessin" data-a-trancher-vide={partiel ? 'partiel' : 'zero'} style={{ textAlign: 'center', padding: '24px 8px' }}>
          <p style={{ fontWeight: 700, margin: '0 0 4px' }}>{resume}</p>
          <p style={{ margin: 0 }}>{partiel ? 'Ce qui n’a pas pu être compté est dit juste dessous.' : 'Tout ce que VRM n’a pas pu décider est réglé.'}</p>
        </div>
      )}
      {manque.length ? (
        <GroupeIos titre="Pas encore compté" data-a-trancher-groupe="pas-su"
          pied="« — » veut dire « pas su », jamais « rien » : ouvre l’écran pour le compter.">
          {manque.map((l) => (
            <RangeeIos key={l.cle} data-a-trancher-passu={l.cle}
              titre={l.nom} detail={l.raison} valeur="—"
              onClick={() => onAller && onAller(l)}/>
          ))}
        </GroupeIos>
      ) : null}
    </div>
  );
}
