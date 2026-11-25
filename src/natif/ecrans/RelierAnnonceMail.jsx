// ── « Relier à l'annonce » d'une vente vue par e-mail (24 nov., docs/passation/2026-11-24-vente-mail-annonce.md) ──────────
// Une vente connue seulement par son e-mail, qu'aucune identité ne relie à une annonce (ni la photo exacte, ni son clic) :
// UN geste, « Relier à l'annonce ». La feuille propose les annonces en ligne du MÊME compte, rangées par ressemblance (titre,
// taille, prix — src/venteMailAnnonce.js `candidatsRelier`), avec leur photo Vinted à côté de celle de la vente : c'est SON
// toucher qui relie (§5). Reliée : la vente prend le N° de l'annonce, l'annonce sort d'« en ligne » ; « Délier » défait.
// Aucun style en ligne : des composants de src/natif/.
import React from 'react';
import { tr } from '../../i18n/index.js';
import { Feuille, Groupe, Rangee, Vignette, Plaque, Bouton } from '../index.js';

const vignette = (src, Photo) => <Vignette src={src || ''} alt="" taille={56} image={src && Photo ? <Photo src={src} alt="" loading="lazy" decoding="async"/> : null}/>;

export function RelierAnnonceMail({ ra, r, Photo, Icon, rangee = false }) {
  const [ouverte, setOuverte] = React.useState(false);
  if (!ra) return null;
  if (ra.lie) {
    const delier = <Bouton variante="texte" onClick={(e) => { if (e && e.stopPropagation) e.stopPropagation(); ra.delier(); }} attrs={{ 'data-vm-delier': ra.lie, 'data-vm-via': ra.via || '' }}>{tr('vm.delier')}</Bouton>;
    return rangee ? <Rangee icone={Icon ? <Icon name="link" size={22}/> : null} titre={tr('vm.relieeA')} sousTitre={tr('vm.attenteVinted')} onClick={ra.delier} valeur={tr('vm.delier')}
      attrs={{ 'data-vn-geste': 'delier-annonce', 'data-vm-delier': ra.lie, 'data-vm-via': ra.via || '' }}/> : <span className="n-vt-vm" data-vm-lie={ra.lie}>{delier}</span>;
  }
  if (!Array.isArray(ra.candidats) || !ra.candidats.length) return null;
  const ouvrir = (e) => { if (e && e.stopPropagation) e.stopPropagation(); setOuverte(true); };
  const feuille = (
    <Feuille ouverte={ouverte} onFermer={() => setOuverte(false)} titre={tr('vm.titre')} detente="moitie" detentes={['moitie', 'pleine']} attrs={{ 'data-vm-feuille': '' }}>
      <Groupe titre={tr('vm.laVente')}>
        <Rangee vignette={vignette(r && r.photo, Photo)} titre={(r && r.titre) || ''} lignes={2} valeur={(r && r.prix) || null} attrs={{ 'data-vm-vente': '' }}/>
      </Groupe>
      <Groupe titre={tr('vm.choisir')} pied={tr('vm.pied')}>
        {ra.candidats.map((c) => <Rangee key={c.id} vignette={vignette(c.photo, Photo)} titre={c.titre} lignes={2} plaque={c.num ? <Plaque numero={c.num}/> : null} valeur={c.prix || null}
          fin="chevron" onClick={() => { setOuverte(false); ra.relier(c.id); }} attrs={{ 'data-vm-candidat': c.id }}/>)}
      </Groupe>
    </Feuille>
  );
  return <>
    {rangee ? <Rangee icone={Icon ? <Icon name="link" size={22}/> : null} titre={tr('vm.relier')} fin="chevron" onClick={ouvrir} attrs={{ 'data-vn-geste': 'relier-annonce', 'data-vm-relier': String(ra.candidats.length) }}/>
      : <Bouton variante="teinte" icone={Icon ? <Icon name="link" size={18}/> : null} onClick={ouvrir} attrs={{ 'data-vm-relier': String(ra.candidats.length) }}>{tr('vm.relier')}</Bouton>}
    {feuille}
  </>;
}
