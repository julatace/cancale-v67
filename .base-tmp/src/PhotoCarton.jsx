// ════════════════════════════════════════════════════════════════════════════
//  « PHOTO DU CARTON » (10 nov., lot AZ + lot M) — le geste et la vue.
//  Aucune règle ici : où vit la photo, sa clé (la vente, par son identité) et sa
//  lecture sont dans src/photoCarton.js. Le geste est FACULTATIF et SON toucher :
//  l'appareil photo du téléphone (`capture="environment"`), la photo réduite dans la
//  page, puis rangée avec la vente. Rien n'est publié vers une plateforme.
//   · `BoutonPhotoCarton` : le scanner (après « Colis fait ») et « Préparer mes colis ».
//   · `PhotoCartonVente`  : la fiche de la vente — « Voir » (lu au toucher) ou « Ajouter ».
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { ouvrirVisionneuse } from './visionneuse.js';
import { compresserPhotoCarton, ecrirePhotoCarton, photoCartonDe, aPhotoCarton, idPhotoCarton, ecouterPhotoCarton } from './photoCarton.js';
import './styles-photo-carton.css';

const quand = (iso) => {
  const t = Date.parse(iso || ''); if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

const IconeAppareil = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.4-2h5l1.4 2h1.6A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.5"/>
  </svg>
);

// La photo en grand : LA visionneuse de l'app (src/Visionneuse.jsx — zoom, retour du téléphone,
// Échap, croix), avec la légende « Photo du carton · N°… ». Plus de vue à part (10 nov., lot AN).
const voirEnGrand = (src, sous = '') => ouvrirVisionneuse([src], 0, { titre: 'Photo du carton', sous });

// Le geste : « Photo du carton » ⇒ l'appareil photo ⇒ rangée avec la vente.
// `vente` = { site, tx, num } (l'identité de la vente, src/photoCarton.js `venteDuColis`) ;
// sans vente, rien n'est proposé (il n'y a nulle part où la ranger).
export function BoutonPhotoCarton({ vente, ton = 'sombre', compact = false, libelle = 'Photo du carton' }) {
  const id = vente ? idPhotoCarton(vente.site, vente.tx) : '';
  const fichier = React.useRef(null);
  const [etat, setEtat] = React.useState('');      // '' · envoi · range · echec · illisible
  const [apercu, setApercu] = React.useState(null);
  const [deja, setDeja] = React.useState(undefined);   // undefined lecture · false aucune · { at } · null pas su
  React.useEffect(() => {
    let vivant = true; setEtat(''); setApercu(null); setDeja(undefined);
    if (!id) return undefined;
    aPhotoCarton(vente.tx, vente.site).then((r) => { if (vivant) setDeja(r); });
    return () => { vivant = false; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!id) return null;
  const choisir = async (ev) => {
    const f = ev.target.files && ev.target.files[0]; ev.target.value = '';
    if (!f) return;
    setEtat('envoi');
    const d = await compresserPhotoCarton(f);
    if (!d) { setEtat('illisible'); return; }
    setApercu(d);
    const ok = await ecrirePhotoCarton({ site: vente.site, tx: vente.tx, dataUrl: d, num: vente.num || '' });
    setEtat(ok ? 'range' : 'echec');
    if (ok) setDeja({ at: new Date().toISOString() });
  };
  const ouvrir = () => { if (fichier.current) fichier.current.click(); };
  const voir = async () => {
    const sous = vente.num ? `N°${vente.num}` : '';
    if (apercu) { voirEnGrand(apercu, sous); return; }
    const r = await photoCartonDe(vente.tx, vente.site);
    if (r && r.src) voirEnGrand(r.src, sous); else setEtat(r === false ? '' : 'echec-lecture');
  };
  const range = etat === 'range' || (!etat && deja && deja.at);
  return (
    <div className={'vrm-pc is-' + ton + (compact ? ' is-compact' : '')} data-photo-carton={id} data-photo-carton-etat={etat || (deja === undefined ? 'lecture' : range ? 'range' : deja === null ? 'pas-su' : 'aucune')}>
      <input ref={fichier} type="file" accept="image/*" capture="environment" data-photo-carton-fichier="" onChange={choisir} hidden/>
      {range ? (
        <div className="vrm-pc-range" role="status">
          <button type="button" className="vrm-pc-vignette" data-photo-carton-voir="" aria-label="Voir la photo du carton" onClick={voir}>
            {apercu ? <img src={apercu} alt=""/> : <IconeAppareil/>}
          </button>
          <span className="vrm-pc-range-txt"><b>Photo du carton rangée ✓</b><small>{etat === 'range' ? 'avec la vente' : quand(deja && deja.at)}</small></span>
          <button type="button" className="vrm-pc-b is-discret" data-photo-carton-refaire="" onClick={ouvrir}>Refaire</button>
        </div>
      ) : (
        <button type="button" className="vrm-pc-b" data-photo-carton-prendre="" disabled={etat === 'envoi'} onClick={ouvrir}>
          <IconeAppareil/><span>{etat === 'envoi' ? 'Envoi…' : libelle}</span>{etat === 'envoi' ? null : <em>facultatif</em>}
        </button>
      )}
      {etat === 'echec' ? <p className="vrm-pc-note is-ambre" role="alert" data-photo-carton-echec="">Photo pas envoyée : réessaie quand le réseau revient.</p> : null}
      {etat === 'illisible' ? <p className="vrm-pc-note is-ambre" role="alert" data-photo-carton-echec="illisible">Cette photo n’a pas pu être lue : reprends-la.</p> : null}
      {etat === 'echec-lecture' ? <p className="vrm-pc-note is-ambre" role="alert">La photo n’a pas pu être lue : réessaie.</p> : null}
    </div>
  );
}

// Dans la fiche d'une vente : la photo du carton s'il y en a une (« Voir », lue au toucher), sinon
// « Ajouter » (facultatif). Une lecture ratée dit « — » (pas su), jamais « aucune ».
export function PhotoCartonVente({ site = 'vinted', tx, num = '' }) {
  const id = idPhotoCarton(site, tx);
  const [etat, setEtat] = React.useState(undefined);   // undefined · false · { at } · null
  const [lecture, setLecture] = React.useState('');
  React.useEffect(() => {
    let vivant = true; if (!id) return undefined;
    const lire = () => aPhotoCarton(tx, site).then((r) => { if (vivant) setEtat(r); });
    lire();
    const fin = ecouterPhotoCarton((x) => { if (x === id) lire(); });
    return () => { vivant = false; fin(); };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!id) return null;
  const voir = async () => {
    setLecture('…');
    const r = await photoCartonDe(tx, site);
    setLecture('');
    if (r && r.src) voirEnGrand(r.src, [num ? `N°${num}` : '', quand(r.at)].filter(Boolean).join(' · ')); else if (r === false) setEtat(false); else setLecture('pas lue');
  };
  return (
    <div className="vrm-recap-ligne vrm-pc-ligne" data-photo-carton-vente={id} data-photo-carton-vente-etat={etat === undefined ? 'lecture' : etat === null ? 'pas-su' : etat ? 'oui' : 'non'}>
      <dt>Photo du carton</dt>
      <dd>
        {etat && etat.at ? <>
          <button type="button" className="vrm-pc-voir" data-photo-carton-vente-voir="" onClick={voir}>Voir</button>
          <small className="vrm-pc-date">{lecture === 'pas lue' ? 'pas lue — réessaie' : quand(etat.at)}</small>
        </> : etat === false ? <BoutonPhotoCarton vente={{ site, tx, num }} ton="clair" compact libelle="Ajouter"/>
          : etat === null ? <span title="La base n’a pas répondu">—</span> : <span aria-busy="true">…</span>}
      </dd>
    </div>
  );
}
