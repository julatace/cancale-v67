// ── « IMPRIMER LES N », SUR ORDINATEUR (16 nov., lot impression-directe) ──────────
// La règle : src/impressionDirecte.js. Une bannière flottante, en bas à droite : « 3 bordereaux
// prêts » + le SEUL bouton plein « Imprimer les 3 » + « Plus tard ». Elle se montre à l'ouverture
// et à chaque retour sur l'onglet ; « Plus tard » la range jusqu'au prochain retour. Après
// l'impression (évènement `vrm:impression-faite` du moteur) : « 3 imprimés · Annuler » (8 s).
import React from 'react';
import { tr } from './i18n/index.js';
import { proposer, nombreAProposer } from './impressionDirecte.js';
import './impression-directe.css';

export const DUREE_APRES = 8000;

export function ImpressionDirecte({ ordi = false, publie = null, onImprimer }) {
  const [ecarte, setEcarte] = React.useState(false);
  const [apres, setApres] = React.useState(null);   // { n, marques } après une impression directe
  React.useEffect(() => {
    const f = () => { if (document.visibilityState === 'visible') setEcarte(false); };
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, []);
  React.useEffect(() => {
    const f = (e) => { const d = (e && e.detail) || {}; if (d.n > 0) setApres({ n: d.n, marques: d }); };
    window.addEventListener('vrm:impression-faite', f);
    return () => window.removeEventListener('vrm:impression-faite', f);
  }, []);
  // Le temps d'« Annuler » ne court que quand il PEUT le voir : pas pendant que la visionneuse du PDF est ouverte.
  React.useEffect(() => {
    if (!apres) return undefined;
    let reste = DUREE_APRES;
    const t = setInterval(() => {
      if (document.querySelector('[data-visionneuse-pdf]') || document.visibilityState !== 'visible') return;
      reste -= 500; if (reste <= 0) setApres(null);
    }, 500);
    return () => clearInterval(t);
  }, [apres]);
  if (apres && ordi) {
    return (
      <div className="vrm-impdir" role="status" data-impression-faite={String(apres.n)}>
        <span className="vrm-impdir-texte">{tr('impdir.faits', { n: apres.n })}</span>
        <button type="button" className="vrm-impdir-lien" data-impression-annuler="" onClick={() => {
          try { window.dispatchEvent(new CustomEvent('vrm:impression-annuler', { detail: apres.marques })); } catch (_) {}
          setApres(null);
        }}>{tr('impdir.annuler')}</button>
      </div>
    );
  }
  if (!proposer({ ordi, publie, ecarte })) return null;
  const n = nombreAProposer(publie);
  return (
    <div className="vrm-impdir" role="region" aria-label={tr('impdir.prets', { n })} data-impression-directe={String(n)}>
      <span className="vrm-impdir-texte">{tr('impdir.prets', { n })}</span>
      <button type="button" className="vrm-impdir-plein" data-impression-directe-imprimer={String(n)} onClick={() => { setEcarte(true); if (onImprimer) onImprimer(n); }}>{tr('impdir.imprimer', { n })}</button>
      <button type="button" className="vrm-impdir-lien" data-impression-directe-plus-tard="" onClick={() => setEcarte(true)}>{tr('impdir.plusTard')}</button>
    </div>
  );
}
