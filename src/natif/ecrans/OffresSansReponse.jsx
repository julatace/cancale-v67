// ── src/natif/ecrans/OffresSansReponse.jsx — « Offres sans réponse » (22 nov., Julien — choix n° 33) ─────────────
// La liste que rend `offresSansReponse` (src/offresSansReponse.js) : de la plus ancienne à la plus récente, une rangée
// par offre (vignette, titre de la paire, « 50 € proposés · prix 70 € · mini 55 € », l'âge, la note de l'acheteur si
// elle est lue). Un toucher ouvre la conversation dans le PANNEAU de l'extension (`onOuvrir`) : c'est là qu'il accepte,
// refuse ou fait une contre-offre (CLAUDE.md §3) — aucun geste d'offre ici. Trois états : lecture · pas su · lu.
import React from 'react';
import { Groupe, Rangee, Vignette, Pastille, Vide, Attente, LogoSite } from '../index.js';
import { tr } from '../../i18n/index.js';
import { offreFace } from '../../offresSansReponse.js';

const NOMS = { vinted: 'Vinted', vestiaire: 'Vestiaire', ebay: 'eBay', leboncoin: 'Leboncoin' };
export const ageTexte = (age) => tr('osr.age.' + ((age && age.cle) || 'inconnu'), { n: (age && age.n) || 0 });

export default function OffresSansReponse({ res, euros = (x) => String(x), onOuvrir = null, Note = null, Icon = null }) {
  if (!res || res.etat === 'encours') return <Groupe titre={tr('osr.titre')} attrs={{ 'data-osr': 'lecture', 'aria-busy': 'true' }}><Attente forme="rangees" n={2} vignette={44}/></Groupe>;
  if (res.etat === 'passu') return <Groupe titre={tr('osr.titre')} attrs={{ 'data-osr': 'passu' }}><Vide icone={Icon ? <Icon name="alert" size={32}/> : null} phrase={tr('osr.pasSu')}/></Groupe>;
  const pied = tr('osr.pied', { sites: (res.nonLus || []).map((s) => NOMS[s] || s).join(', ') });
  return (
    <Groupe titre={tr('osr.titre')} pied={pied} attrs={{ 'data-osr': 'lu', 'data-osr-n': String(res.n) }}>
      {!res.lignes.length ? <Rangee titre={tr('osr.vide')} attrs={{ 'data-osr-vide': '' }}/> : res.lignes.map((l) => {
        const face = offreFace(l);
        // L'âge d'abord (c'est le classement), puis le prix et le plancher ; « sous le plancher » et la note de l'acheteur en 3e ligne.
        const sous = [ageTexte(l.age), l.prix != null ? tr('osr.prix', { x: euros(l.prix) }) : '', l.mini != null ? tr('osr.mini', { x: euros(l.mini) }) : '', l.plancher != null ? tr('osr.plancher', { x: euros(l.plancher) }) : ''].filter(Boolean).join(' · ');
        return (
          <Rangee key={l.cle} vignette={<Vignette src={l.photo || ''} alt="" taille={44}/>} titre={l.titre || (NOMS[l.site] || l.site)} lignes={2}
            plaque={<LogoSite site={l.site} taille={16} nom={NOMS[l.site] || l.site}/>}
            sousTitre={sous} sousLignes={2} note={face === 'sous' || (Note && l.note) ? <>{face === 'sous' ? <Pastille ton="ambre">{tr('osr.sous')}</Pastille> : null}{Note && l.note ? <> <Note u={l.note}/></> : null}</> : null}
            valeur={l.offre != null ? euros(l.offre) : '—'} valeurForte fin={onOuvrir ? 'chevron' : null}
            onClick={onOuvrir ? () => onOuvrir(l) : null}
            attrs={{ 'data-osr-ligne': l.cle, 'data-osr-site': l.site, 'data-osr-face': face || '', 'data-osr-ts': l.ts == null ? '' : String(l.ts), 'aria-label': tr('osr.ouvrir', { x: l.offre != null ? euros(l.offre) : '—', titre: l.titre || '' }) }}/>
        );
      })}
    </Groupe>
  );
}
