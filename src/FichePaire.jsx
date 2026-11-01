// ── LA FICHE COMPLÈTE D'UNE PAIRE (1er nov., maquette « numero-B-fiche-paire ») ─
// Le parcours de la paire, étape par étape, tel que `parcoursPaire`
// (src/fichePaire.js) l'a lu PAR IDENTITÉ. Une étape lue : à l'encre, pastille
// pleine. Pas su : « — » et la raison. Pas (encore) arrivée : grisée — jamais
// inventée. Aucune couleur (§7) sauf le rouge de deux paires sous ce N° (§5).
import React from 'react';
import { createPortal } from 'react-dom';
import './styles-fiche-paire.css';

const ICONE = { achat: 'bag', stock: 'home', annonces: 'grid', vente: 'tag', colis: 'box', argent: 'euro' };
const eur = (c) => (c == null ? '—' : `${(c / 100).toFixed(Number.isInteger(c / 100) ? 0 : 2).replace('.', ',')} €`);
const signe = (c) => (c == null ? '—' : `${c > 0 ? '+' : c < 0 ? '−' : ''}${eur(Math.abs(c))}`);
const quand = (iso) => {
  const t = Date.parse(iso || ''); if (!Number.isFinite(t)) return '';
  const d = new Date(t), auj = new Date();
  if (d.toDateString() === auj.toDateString()) return 'auj.';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

export default function FichePaire({ p, lecture = false, num, onFermer, onRetour, onBordereau, onEmballer, Photo, Icon, Retour }) {
  React.useEffect(() => {
    const k = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onFermer(); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [onFermer]);
  if (typeof document === 'undefined') return null;
  const I = (n, s = 18) => (Icon ? <Icon name={n} size={s}/> : null);
  const r = p && p.resume;
  const corps = !p ? (
    <p className="vrm-fp-vide" data-fiche-vide="">{lecture ? 'Je lis l’histoire de cette paire…' : `Le N°${num} n’est pas un numéro.`}</p>
  ) : (
    <>
      <div className="vrm-fp-entete">
        <span className={'vrm-fp-num' + (p.double ? ' is-double' : '')} data-fiche-grand-num="">{p.num}</span>
        <span className="vrm-fp-quoi">
          <span className="vrm-fp-titre">{p.titre || (p.etat === 'rien' ? 'N° jamais servi' : 'Sans titre')}{p.taille ? ` · ${p.taille}` : ''}</span>
          {p.ancienNumero ? <span className="vrm-fp-sous">Ancien numéro (d’avant la remise à zéro)</span> : null}
        </span>
        {p.photo && Photo ? <span className="vrm-fp-photo">{Photo(p.photo)}</span> : null}
      </div>
      {p.double ? <p className="vrm-fp-double" role="alert" data-fiche-double="1">Deux paires présentes portent le N°{p.num} : vérifie le carton avant d’emballer ou d’imprimer.</p> : null}
      <div className="vrm-fp-tuiles">
        <div className="vrm-fp-tuile" data-fiche-resume-achat={r.achat == null ? '' : r.achat}><span>Achat</span><b>{eur(r.achat)}</b></div>
        <div className="vrm-fp-tuile" data-fiche-resume-vente={r.vente == null ? '' : r.vente}><span>Vente</span><b>{eur(r.vente)}</b></div>
        <div className="vrm-fp-tuile" data-fiche-resume-benefice={r.benefice == null ? '' : r.benefice} data-fiche-benefice-partiel={r.benefPartiel ? '1' : undefined}>
          <span>Bénéfice</span><b>{signe(r.benefice)}</b>
          {r.benefice == null && r.raisonBenef ? <small>{r.raisonBenef}</small> : r.benefPartiel ? <small>frais pas tous confirmés</small> : null}
        </div>
      </div>
      <ol className="vrm-fp-parcours">
        {p.etapes.map((e) => (
          <li key={e.cle} className={'vrm-fp-etape is-' + e.etat} data-fiche-etape={e.cle} data-fiche-etat={e.etat}>
            <span className="vrm-fp-pastille" aria-hidden="true">{I(ICONE[e.cle] || 'info', 17)}</span>
            <span className="vrm-fp-txt">
              <span className="vrm-fp-ligne1"><b>{e.titre}</b>{e.date ? <time className="vrm-fp-date" dateTime={e.date}>{quand(e.date)}</time> : null}</span>
              {e.lignes ? e.lignes.map((l, j) => <span key={j} className="vrm-fp-detail" data-fiche-ligne={l.site} data-fiche-tx={l.tx || undefined}>{l.texte}{l.date && e.cle === 'vente' && e.lignes.length > 1 ? ` · ${quand(l.date)}` : ''}</span>) : null}
              {e.detail ? <span className="vrm-fp-detail">{e.etat === 'passu' ? <>— <span data-fiche-raison="">{e.detail}</span></> : e.detail}</span> : null}
            </span>
          </li>
        ))}
      </ol>
      {lecture ? <p className="vrm-fp-note" data-fiche-lecture="">Lecture en cours…</p>
        : p.manques.length ? <p className="vrm-fp-note" data-fiche-manques={p.manques.length}>Pas pu lire : {p.manques.join(', ')}.</p> : null}
      {p.aPoster && (onBordereau || onEmballer) ? (
        <div className="vrm-fp-actions">
          {onBordereau ? <button type="button" className="vrm-fp-b" data-fiche-bordereau={p.txAPoster} onClick={() => onBordereau(p.txAPoster)}>{I('printer')}Bordereau</button> : null}
          {onEmballer ? <button type="button" className="vrm-fp-b vrm-fp-b-plein" data-fiche-emballer="" onClick={onEmballer}>{I('box')}Emballer</button> : null}
        </div>
      ) : null}
    </>
  );
  return createPortal(
    <div className="vrm-fp" role="dialog" aria-modal="true" aria-label={`Tout sur le N°${(p && p.num) || num}`} data-fiche-paire={(p && p.num) || num} data-fiche-lecture-en-cours={lecture ? '1' : '0'} data-noswipe="1">
      {Retour ? <Retour fermer={onFermer}/> : null}
      <div className="vrm-fp-cadre">
        <header className="vrm-fp-tete">
          <button type="button" className="vrm-fp-retour" data-fiche-retour="" onClick={onRetour || onFermer}><svg aria-hidden="true" className="vrm-fp-chevron" viewBox="0 0 24 24" width="22" height="22"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>Tout sur le N°</button>
          <button type="button" className="vrm-fp-fermer" aria-label="Fermer la fiche" data-fiche-fermer="" onClick={onFermer}>{I('close', 20) || '×'}</button>
        </header>
        {corps}
      </div>
    </div>, document.body);
}
