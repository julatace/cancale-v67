// ════════════════════════════════════════════════════════════════════════════
// LES PHOTOS QUE VESTIAIRE DEMANDE — la liste sous un article à préparer
// (11 nov., lot vestiaire-plus). La règle : src/photosVestiaire.js (pure).
// Une ligne courte (« Photos Vestiaire : 1 manque · 6 à vérifier ») qui déplie la
// liste ; chaque vue dit son état (manque · ok · à vérifier) et d'où vient la
// demande (aide de Vestiaire, ton formulaire, guide de vendeurs). Le geste
// « Choisir l'étiquette » ouvre le choix déjà là ; le fond renvoie à la carte
// « Ta clé Photoroom » de cet écran (le détourage existant, Vestiaire seul).
import React from 'react';
import { photosExigeesVc } from './photosVestiaire.js';
import { tr } from './i18n/index.js';
import './styles-vestiaire-plus.css';

export function textePhotosManquantes(r) {
  return r.manque.map((k) => tr('vcPhotos.vue.' + k)).join(', ');
}

export default function PhotosVestiaire({ id, famille, nPhotos, etiquette, photoroom, onEtiquette }) {
  const [ouvert, setOuvert] = React.useState(false);
  const r = photosExigeesVc({ famille, nPhotos, etiquette, photoroom });
  const aVerifier = r.vues.filter((v) => v.etat === 'a-verifier').length;
  const resume = [r.manque.length ? tr('vcPhotos.resume.manque', { n: r.manque.length }) : tr('vcPhotos.resume.rienManque'), aVerifier ? tr('vcPhotos.resume.aVerifier', { n: aVerifier }) : ''].filter(Boolean).join(' · ');
  return (
    <div className="vrm-vc-photos" data-vc-photos={id} data-vc-photos-manque={r.manque.join(',')} data-vc-photos-liste={r.liste}>
      <button type="button" className="vrm-lien-action vrm-vc-photos-tete" aria-expanded={ouvert ? 'true' : 'false'} data-vc-photos-ouvrir={id} onClick={() => setOuvert((o) => !o)}>
        <span>{tr('vcPhotos.titre')}</span><span className={'vrm-vc-photos-resume' + (r.manque.length ? ' is-geste' : '')}>{resume}</span>
      </button>
      {ouvert ? (
        <div className="vrm-vc-photos-corps">
          {r.liste === 'pas-relue' ? <p className="vrm-vc-photos-note" data-vc-photos-pasrelue="">{tr('vcPhotos.pasRelue')}</p> : null}
          <ul className="vrm-vc-photos-liste">
            {r.vues.map((v) => (
              <li key={v.k} data-vc-photo-vue={v.k} data-vc-photo-etat={v.etat} data-vc-photo-source={v.source || ''} className={'vrm-vc-photo-vue is-' + v.etat}>
                <span className="vrm-vc-photo-marque" aria-hidden="true">{v.etat === 'ok' ? '✓' : v.etat === 'manque' ? '!' : '·'}</span>
                <span className="vrm-vc-photo-texte">
                  <span className="vrm-vc-photo-nom">{v.k === 'nombre' ? tr('vcPhotos.vue.nombreN', { n: v.n, min: v.min }) : tr('vcPhotos.vue.' + v.k)}{v.siPresent ? <small> {tr('vcPhotos.siPresent')}</small> : null}{!v.exige ? <small> {tr('vcPhotos.conseille')}</small> : null}</span>
                  <span className="vrm-vc-photo-etat">{tr(v.etat === 'a-verifier' ? 'vcPhotos.etat.aVerifier' : 'vcPhotos.etat.' + v.etat)}{v.source ? ' · ' + tr('vcPhotos.source.' + v.source) : ''}</span>
                </span>
                {v.k === 'etiquette2' && v.etat === 'manque' && onEtiquette ? <button type="button" className="vrm-lien-action" data-vc-photos-etiquette={id} onClick={onEtiquette}>{tr('vcPhotos.choisirEtiquette')}</button> : null}
              </li>
            ))}
          </ul>
          <p className="vrm-vc-photos-note">{tr('vcPhotos.note')}</p>
        </div>
      ) : null}
    </div>
  );
}
