// ══════════════════════════════════════════════════════════════════════════════
//  LA NOTE PRIVÉE D'UNE PAIRE — la FORME seulement (10 nov., lot BD)
// ══════════════════════════════════════════════════════════════════════════════
// La règle (identité, ambiguïté, écriture) est src/notePaire.js ; l'état et le geste
// (`NotePaireCoque`, App.jsx) passent ici ce qu'il faut montrer :
//   · une note ⇒ l'icône + le texte (une ligne en liste, en entier en bloc) ; un
//     toucher la modifie ;
//   · pas de note et `ajout` ⇒ l'icône seule, discrète (44 px au doigt) ;
//   · note cachée (N° porté par deux paires) ⇒ « Note cachée », sans le texte.
// Neutre : une note n'est pas un geste à faire (ni ambre, ni rouge, §7).
// ══════════════════════════════════════════════════════════════════════════════
import React from 'react';
import './styles-note-paire.css';

export function IconeNote({ size = 16 }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="vrm-note-icone">
      <path d="M5 4.5h10.5L19.5 8.5V19a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5V5a.5.5 0 0 1 .5-.5Z"/>
      <path d="M8 10h8M8 13.5h8M8 17h5"/>
    </svg>
  );
}

export function NotePaireVue({ note = null, variante = 'ligne', ajout = false, onEditer = null, numero = '' }) {
  const bloc = variante === 'bloc';
  if (note && note.cachee) {
    return <span className={'vrm-note vrm-note-cachee' + (bloc ? ' is-bloc' : '')} data-note-paire="cachee" data-note-num={numero || undefined} title={note.raison || ''}>
      <IconeNote size={bloc ? 18 : 15}/><span className="vrm-note-texte">Note cachée · {note.raison}</span>
    </span>;
  }
  if (!note) {
    if (!ajout || !onEditer) return null;
    return <button type="button" className={'vrm-note-ajout' + (bloc ? ' is-bloc' : '')} data-note-paire="ajout" data-note-num={numero || undefined}
      aria-label={numero ? `Ajouter une note privée au N°${numero}` : 'Ajouter une note privée'} title="Note privée (toi seul la vois)" onClick={onEditer}>
      <IconeNote size={bloc ? 18 : 16}/>{bloc ? <span>Ajouter une note</span> : null}
    </button>;
  }
  const corps = <><IconeNote size={bloc ? 18 : 15}/><span className="vrm-note-texte" data-note-texte="">{note.texte}</span></>;
  if (!onEditer) return <span className={'vrm-note' + (bloc ? ' is-bloc' : '')} data-note-paire="lue" data-note-num={numero || undefined}>{corps}</span>;
  return <button type="button" className={'vrm-note' + (bloc ? ' is-bloc' : '')} data-note-paire="lue" data-note-num={numero || undefined}
    aria-label={`Note privée${numero ? ` du N°${numero}` : ''} : ${note.texte} — la modifier`} onClick={onEditer}>{corps}</button>;
}
