// ── src/messages/AvatarPersonne.jsx — la PHOTO DE PROFIL de la personne d'une conversation (28 nov., messages-parfaits) ──
// Julien (captures du 28 nov.) : chaque rangée de Messages portait une bulle générique ; il veut la photo de profil de
// l'interlocuteur, dans la rangée ET dans l'en-tête du fil. La photo vient de la boîte captée (`opposite_user.photo.url`,
// src/filUnique.js `avatarPersonne`) ; sans photo (Leboncoin, Vestiaire, eBay ne la donnent pas ; l'image « pas de photo »
// de Vinted), une INITIALE sur un disque neutre. Taille FIXE (rien ne bouge quand l'image arrive), chargement paresseux,
// décodage asynchrone. `Photo` : le composant photo de l'app (PhotoVinted : taille réduite, secours de l'extension) —
// passé en prop pour ne pas importer App.jsx. Aucune donnée n'est écrite, aucune identité n'est tirée d'une photo.
import React from 'react';
import './messages-parfaits.css';

export const initialePersonne = (nom) => String(nom || '').trim().replace(/^[^\p{L}\p{N}]+/u, '').charAt(0).toUpperCase() || '·';

export function AvatarPersonne({ photo = null, nom = '', taille = 44, Photo = null, sensible = false, className = '', attrs = null }) {
  const [rate, setRate] = React.useState('');
  const src = photo && rate !== photo ? photo : null;
  const ini = <span className={'vrm-av-ini' + (sensible ? ' vrm-sensible' : '')} data-stream-type={sensible ? 'acheteur' : undefined} aria-hidden="true">{initialePersonne(nom)}</span>;
  const style = { width: taille, height: taille };
  const img = { width: taille, height: taille, borderRadius: '50%', objectFit: 'cover', display: 'block' };
  return (
    <span className={'vrm-av' + (className ? ' ' + className : '')} style={style} data-avatar={src ? 'photo' : 'initiale'} aria-hidden="true" {...(attrs || {})}>
      {src ? (Photo
        ? <Photo src={src} alt="" loading="lazy" width={taille} height={taille} style={img} repli={ini} onError={() => setRate(photo)}/>
        : <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" width={taille} height={taille} style={img} onError={() => setRate(photo)}/>)
        : ini}
    </span>
  );
}
export default AvatarPersonne;
