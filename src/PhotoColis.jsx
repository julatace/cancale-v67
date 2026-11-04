// ── LA PHOTO DU COLIS (4 nov., choix de Julien n° 3) ────────────────────────
// « Photo du colis » : l'appareil photo du téléphone (input `capture`), l'image
// compressée dans la page puis rangée dans SA ligne (`colis_photo_{site}_{id}`,
// src/photoColis.js) — par l'identité de la vente, jamais dans `main`.
// Montrée dans le récapitulatif de la vente (et donc à côté d'un litige) et dans
// « Emballer ». Supprimer = la corbeille (30 jours), sur SON clic.
import React from 'react';
import { createPortal } from 'react-dom';
import './styles-photo-colis.css';
import { compresser, ecrirePhoto, lirePhoto } from './photoColis.js';

export default function PhotoColis({ ident, base, Icon, confirmer = null, onSupprimer = null, compact = false, toast = null }) {
  const [etat, setEtat] = React.useState(undefined);   // undefined lu en cours · null pas su · { url }
  const [busy, setBusy] = React.useState(false);
  const [grand, setGrand] = React.useState(false);
  const champ = React.useRef(null);
  React.useEffect(() => {
    let vivant = true; setEtat(undefined);
    if (!ident) { setEtat({ url: null }); return undefined; }
    lirePhoto(base, ident).then((r) => { if (vivant) setEtat(r); });
    const maj = (e) => { if (e && e.detail && e.detail.ident === ident) lirePhoto(base, ident).then((r) => { if (vivant) setEtat(r); }); };
    window.addEventListener('vrm:photo-colis', maj);
    return () => { vivant = false; window.removeEventListener('vrm:photo-colis', maj); };
  }, [ident]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!ident) return null;
  const prendre = async (ev) => {
    const f = ev.target.files && ev.target.files[0]; ev.target.value = '';
    if (!f) return;
    setBusy(true);
    const ph = await compresser(f);
    if (!ph) { setBusy(false); if (toast) toast('Photo illisible — reprends-la.'); return; }
    const w = await ecrirePhoto(base, ident, ph);
    setBusy(false);
    if (w.ok) setEtat({ url: ph.url, at: new Date().toISOString() });
    else if (toast) toast('La photo n’a pas pu être rangée — réessaie.');
  };
  const supprimer = async () => {
    if (confirmer && !(await confirmer())) return;
    setBusy(true);
    const r = onSupprimer ? await onSupprimer(ident) : { ok: false };
    setBusy(false);
    if (r && r.ok) setEtat({ url: null });
    else if (toast) toast(r && r.raison === 'lecture' ? 'Je n’ai pas pu relire la photo — rien n’a changé.' : 'La suppression a échoué — réessaie.');
  };
  const url = etat && etat.url;
  return (
    <div className={'vrm-photo-colis' + (compact ? ' is-compact' : '')} data-photo-colis={ident} data-photo-colis-etat={etat === undefined ? 'charge' : etat === null ? 'pas-su' : url ? 'oui' : 'non'}>
      <input ref={champ} type="file" accept="image/*" capture="environment" onChange={prendre} style={{ display: 'none' }} data-photo-colis-champ=""/>
      {url ? <>
        <button type="button" className="vrm-photo-colis-vignette" data-photo-colis-voir="" aria-label="Voir la photo du colis" onClick={() => setGrand(true)}><img src={url} alt="Photo du colis"/></button>
        <span className="vrm-photo-colis-gestes">
          <button type="button" className="vrm-photo-colis-b" data-photo-colis-reprendre="" disabled={busy} onClick={() => champ.current && champ.current.click()}>Reprendre</button>
          <button type="button" className="vrm-photo-colis-b" data-photo-colis-supprimer="" disabled={busy} onClick={supprimer} aria-label="Supprimer la photo du colis">{Icon ? <Icon name="trash" size={16}/> : 'Supprimer'}</button>
        </span>
      </> : etat === null ? <span className="vrm-photo-colis-pas-su">—</span>
        : <button type="button" className="vrm-photo-colis-prendre" data-photo-colis-prendre="" disabled={busy || etat === undefined} onClick={() => champ.current && champ.current.click()}>
          {Icon ? <Icon name="camera" size={18}/> : null}<span>{busy ? 'Photo…' : 'Photo du colis'}</span></button>}
      {grand && url && typeof document !== 'undefined' ? createPortal(<div className="vrm-photo-colis-grand" role="dialog" aria-label="Photo du colis" data-photo-colis-grand="" onClick={() => setGrand(false)}><img src={url} alt="Photo du colis"/></div>, document.body) : null}
    </div>
  );
}
