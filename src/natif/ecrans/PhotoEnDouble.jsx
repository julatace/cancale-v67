// ── src/natif/ecrans/PhotoEnDouble.jsx — Annonces · « Photo en double » (22 nov., Julien — choix n° 35) ─────────────
// Les groupes que rend `photosEnDouble` (src/photoEnDouble.js : le FICHIER photo exact, annonces EN LIGNE) : pour chacun,
// « Même photo sur 2 annonces : N°142 et N°157 — la même paire en double ? », une rangée par annonce (vignette, titre,
// compte, prix, N°) et « Ce n'est pas un doublon » (SON toucher, mémorisé pour ce groupe). Rien n'est modifié ni relié :
// toucher une annonce ouvre SA fiche (par son N°, l'identité de l'article). Pas de bouton plein (NATIF.md).
import React from 'react';
import { Groupe, Rangee, Vignette, Plaque, Bouton, Vide, Attente, LogoSite } from '../index.js';
import { tr } from '../../i18n/index.js';
import { numsPhotoDouble } from './photoDoubleTexte.js';

export default function PhotoEnDouble({ res, euros = (x) => String(x), onAnnonce = null, onPasDoublon = null, Icon = null }) {
  if (res === undefined) return <Groupe attrs={{ 'data-photo-double': 'lecture', 'aria-busy': 'true' }}><Attente forme="rangees" n={3} vignette={44}/></Groupe>;
  if (!res) return <Vide icone={Icon ? <Icon name="alert" size={40}/> : null} phrase={tr('egalite.pasSu')}/>;
  const pied = [tr('photoDouble.note'), res.ecartes && res.ecartes.exemplaires ? tr('photoDouble.ecartes', { n: res.ecartes.exemplaires }) : ''].filter(Boolean).join(' ');
  if (!res.groupes.length) return <><Vide icone={Icon ? <Icon name="image" size={40}/> : null} phrase={tr('egalite.vide.photodouble')}/><Groupe nu pied={pied}/></>;
  return (
    <div data-photo-double="lu" data-photo-double-n={String(res.groupes.length)}>
      {res.groupes.map((g) => (
        <Groupe key={g.cle} titre={tr('photoDouble.titre', { n: g.annonces.length, nums: numsPhotoDouble(g) })}
          action={onPasDoublon ? <Bouton variante="texte" onClick={() => onPasDoublon(g)} attrs={{ 'data-photo-double-non': g.cle }}>{tr('photoDouble.pasDoublon')}</Bouton> : null}
          attrs={{ 'data-photo-double-groupe': g.cle }}>
          {g.annonces.map((a) => (
            <Rangee key={a.id} vignette={<Vignette src={a.photo || ''} alt="" taille={44}/>} titre={a.titre || tr('egalite.sansTitre')} lignes={2}
              plaque={<><LogoSite site="vinted" taille={16}/>{a.numero ? <Plaque numero={a.numero}/> : null}</>}
              sousTitre={a.pseudo} valeur={a.prix != null && Number.isFinite(a.prix) ? euros(a.prix) : '—'}
              fin={onAnnonce ? 'chevron' : null} onClick={onAnnonce ? () => onAnnonce(a) : null} attrs={{ 'data-photo-double-annonce': a.id }}/>
          ))}
        </Groupe>
      ))}
      <Groupe nu pied={pied}/>
    </div>
  );
}
