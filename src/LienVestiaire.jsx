// ── RELIER UN ARTICLE VINTED ET SON ANNONCE VESTIAIRE (3 nov.) ────────────────
// La feuille du geste « Relier » : l'article d'un côté, la liste des articles de
// l'autre côté pas encore reliés (suggestions d'abord, par ressemblance, puis
// tous, filtrables). C'est SON toucher qui relie (§5) ; la règle est dans
// src/lienVestiaire.js, l'écriture dans App.jsx (`HoteLienVc`).
// Aucune phrase explicative (sa demande) : le N° qui reste et le N° à barrer
// sont montrés, pas expliqués.
import React from 'react';
import { createPortal } from 'react-dom';
import './styles-annonces-outils.css';
import './lien-vestiaire.css';

const sansAccent = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function FeuilleLienVc({ cible, candidats, suggestions = [], lecture = false, panne = false, onRelier, onFermer, Photo }) {
  const [q, setQ] = React.useState('');
  const [enCours, setEnCours] = React.useState('');
  React.useEffect(() => {
    const k = (e) => { if (e.key === 'Escape' && !e.defaultPrevented && !enCours) { e.preventDefault(); onFermer(); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [onFermer, enCours]);
  if (typeof document === 'undefined' || !cible) return null;
  const sugg = new Set(suggestions.map((s) => String(s.id)));
  const mots = sansAccent(q).split(/\s+/).filter(Boolean);
  const garde = (c) => !mots.length || mots.every((m) => sansAccent(`${c.titre} ${c.num ? 'n' + c.num + ' ' + c.num : ''}`).includes(m));
  const proposes = suggestions.map((s) => candidats.find((c) => String(c.id) === String(s.id))).filter(Boolean).filter(garde);
  const autres = candidats.filter((c) => !sugg.has(String(c.id))).filter(garde);
  const relier = async (c) => { if (enCours) return; setEnCours(String(c.id)); try { await onRelier(c); } finally { setEnCours(''); } };
  const Ligne = ({ c, propose }) => (
    <li className="vrm-ao-site vrm-lvc-ligne" data-lien-vc-candidat={c.id} data-lien-vc-suggere={propose ? '1' : undefined}>
      <span className="vrm-lvc-photo">{c.photo && Photo ? <Photo src={c.photo}/> : null}</span>
      <span className="vrm-ao-site-nom vrm-lvc-nom"><b>{c.titre || '—'}</b><small>{[c.num ? `N°${c.num}` : '', c.detail || ''].filter(Boolean).join(' · ')}</small></span>
      <button type="button" className="vrm-lvc-relier" data-lien-vc-relier={c.id} disabled={!!enCours} onClick={() => relier(c)}>{enCours === String(c.id) ? '…' : 'Relier'}</button>
    </li>
  );
  return createPortal(
    <div className="vrm-ao-voile" data-lien-vc={cible.sens} onClick={(e) => { if (e.target === e.currentTarget && !enCours) onFermer(); }}>
      <div className="vrm-ao-feuille vrm-lvc-feuille" role="dialog" aria-modal="true" aria-label={cible.sens === 'vc' ? 'Relier à un article Vinted' : 'Relier à une annonce Vestiaire'}>
        <header className="vrm-ao-tete">
          <h2>{cible.sens === 'vc' ? 'Article Vinted' : 'Annonce Vestiaire'}</h2>
          <button type="button" className="vrm-ao-x" aria-label="Fermer" data-lien-vc-fermer="" onClick={onFermer} disabled={!!enCours}>×</button>
        </header>
        <div className="vrm-lvc-cible" data-lien-vc-cible={cible.id}>
          <span className="vrm-lvc-photo">{cible.photo && Photo ? <Photo src={cible.photo}/> : null}</span>
          <span className="vrm-ao-site-nom vrm-lvc-nom"><b>{cible.titre || '—'}</b><small>{cible.num ? `N°${cible.num}` : ''}{cible.site ? `${cible.num ? ' · ' : ''}${cible.site}` : ''}</small></span>
        </div>
        <input className="vrm-lvc-cherche" type="search" inputMode="search" enterKeyHint="search" aria-label="Chercher" placeholder="Titre ou N°" value={q} onChange={(e) => setQ(e.target.value)} data-lien-vc-cherche=""/>
        {panne ? <p className="vrm-ao-vide" data-lien-vc-panne="">Lecture impossible — réessaie</p>
          : lecture ? <p className="vrm-ao-vide" data-lien-vc-lecture="">…</p>
          : <>
            {proposes.length ? <><h3 className="vrm-lvc-titre">Suggestions</h3><ul className="vrm-ao-sites" data-lien-vc-suggestions={proposes.length}>{proposes.map((c) => <Ligne key={c.id} c={c} propose/>)}</ul></> : null}
            {autres.length ? <><h3 className="vrm-lvc-titre">{proposes.length ? 'Tous les autres' : 'Tous'}</h3><ul className="vrm-ao-sites" data-lien-vc-tous={autres.length}>{autres.slice(0, 80).map((c) => <Ligne key={c.id} c={c}/>)}</ul></> : null}
            {!proposes.length && !autres.length ? <p className="vrm-ao-vide" data-lien-vc-aucun="">Aucun article à relier</p> : null}
          </>}
      </div>
    </div>, document.body);
}
