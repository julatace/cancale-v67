// ── src/natif/GaleriePops.jsx — « Voir tous les pop-ups » (23 nov., Julien, compte PROPRIÉTAIRE de l'installation seulement) ─
// Ouverte par Paramètres (zone réservée, `useEstProprietaire`) : une petite barre flottante (‹ · pause/lecture · › · n/N ·
// fermer) fait passer, un par un ou en lecture automatique (3,5 s), CHAQUE carte d'événement du registre des notifications
// (src/galeriePops.js ← api/_lib/notif-apercus.js), puis les trois messages courts (ok, erreur, info). Données d'exemple
// seulement, rien écrit en base, aucune notification envoyée. `autorise` faux ⇒ rien n'est monté ni écouté.
import React from 'react';
import { exemplesPops } from '../galeriePops.js';
import { tr } from '../i18n/index.js';
import { TYPES_CENTRE } from '../journalNotifs.js';
const nomFamille = (f) => (TYPES_CENTRE.find((t) => t.id === f) || {}).titre || f;
import './galerie-pops.css';

const PAS = 3500;
const TOASTS = [{ ton: 'ok', cle: 'gal.toast.ok' }, { ton: 'err', cle: 'gal.toast.err' }, { ton: 'info', cle: 'gal.toast.info' }];

export function GaleriePops({ autorise = false, Icon }) {
  const [ouverte, setOuverte] = React.useState(false);
  const [i, setI] = React.useState(0);
  const [lecture, setLecture] = React.useState(true);
  const liste = React.useMemo(() => (ouverte ? [...exemplesPops().map((x) => ({ sorte: 'pop', ...x })), ...TOASTS.map((t) => ({ sorte: 'toast', cle: 'toast-' + t.ton, famille: 'toast', ...t }))] : []), [ouverte]);
  React.useEffect(() => {
    if (!autorise) return undefined;
    const f = () => { setI(0); setLecture(true); setOuverte(true); };
    window.addEventListener('vrm:galerie-pops', f);
    return () => window.removeEventListener('vrm:galerie-pops', f);
  }, [autorise]);
  const x = liste[i] || null;
  React.useEffect(() => {
    if (!ouverte || !x) return;
    try {
      window.dispatchEvent(new Event('vrm:evenements-vider'));
      if (x.sorte === 'pop') window.dispatchEvent(new CustomEvent('vrm:evenement', { detail: x.ev }));
      else window.dispatchEvent(new CustomEvent('vrm:toast', { detail: { texte: tr(x.cle), ton: x.ton } }));
    } catch (_) {}
  }, [ouverte, x]);
  React.useEffect(() => { if (!ouverte || !lecture || !liste.length) return undefined; const t = setTimeout(() => setI((k) => (k + 1) % liste.length), PAS); return () => clearTimeout(t); }, [ouverte, lecture, i, liste.length]);
  if (!autorise || !ouverte) return null;
  const fermer = () => { setOuverte(false); try { window.dispatchEvent(new Event('vrm:evenements-vider')); } catch (_) {} };
  const ic = (n, t) => (Icon ? <Icon name={n} size={18}/> : t);
  return (
    <div className="n-galerie" role="toolbar" aria-label={tr('gal.titre')} data-galerie-pops={liste.length} data-galerie-i={i} data-galerie-famille={x ? x.famille : ''}>
      <button type="button" className="n-galerie-b" aria-label={tr('gal.precedent')} onClick={() => { setLecture(false); setI((k) => (k - 1 + liste.length) % liste.length); }}><span className="n-galerie-fleche-g">{ic('chevron', '‹')}</span></button>
      <button type="button" className="n-galerie-b" aria-label={lecture ? tr('gal.pause') : tr('gal.lecture')} aria-pressed={!lecture} onClick={() => setLecture((v) => !v)} data-galerie-lecture={lecture ? '1' : '0'}>
        {lecture ? <span className="n-galerie-pause" aria-hidden="true"><i/><i/></span> : ic('play', '▶')}</button>
      <button type="button" className="n-galerie-b" aria-label={tr('gal.suivant')} onClick={() => { setLecture(false); setI((k) => (k + 1) % liste.length); }}>{ic('chevron', '›')}</button>
      <span className="n-galerie-n">{tr('gal.position', { i: i + 1, n: liste.length })}{x ? ' · ' + (x.famille === 'toast' ? tr('gal.toasts') : nomFamille(x.famille)) : ''}</span>
      <button type="button" className="n-galerie-b" aria-label={tr('gal.fermer')} onClick={fermer}>{ic('close', '×')}</button>
    </div>
  );
}
export default GaleriePops;
