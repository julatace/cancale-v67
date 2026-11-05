// ── LA FICHE COMPLÈTE D'UNE PAIRE (1er nov., maquette « numero-B-fiche-paire ») ─
// Le parcours de la paire, étape par étape, tel que `parcoursPaire`
// (src/fichePaire.js) l'a lu PAR IDENTITÉ. Une étape lue : à l'encre, pastille
// pleine. Pas su : « — » et la raison. Pas (encore) arrivée : grisée — jamais
// inventée. Aucune couleur (§7) sauf le rouge de deux paires sous ce N° (§5).
import React from 'react';
import {HistoriqueModifications} from './OutilsParcours.jsx';
import { createPortal } from 'react-dom';
import './styles-fiche-paire.css';
import './styles-annonces-outils.css';
import { texteDuree } from './etatArticle.js';

const ICONE = { achat: 'bag', numero: 'pencil', stock: 'home', annonces: 'grid', prix: 'tag', offres: 'chat', favoris: 'heart', vente: 'cash', colis: 'box', argent: 'euro', retour: 'restore' };
const eur = (c) => (c == null ? '—' : `${(c / 100).toFixed(Number.isInteger(c / 100) ? 0 : 2).replace('.', ',')} €`);
const signe = (c) => (c == null ? '—' : `${c > 0 ? '+' : c < 0 ? '−' : ''}${eur(Math.abs(c))}`);
const quand = (iso) => {
  const t = Date.parse(iso || ''); if (!Number.isFinite(t)) return '';
  const d = new Date(t), auj = new Date();
  if (d.toDateString() === auj.toDateString()) return 'auj.';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

// (3 nov.) Une ligne d'événement de la chronologie : sa date LUE (sinon « — »),
// son texte, sa preuve, son lien.
const Evenement = ({ ev }) => (
  <li className="vrm-fp-ev" data-fiche-ev={ev.cle} data-fiche-ev-date={ev.at || ''} data-fiche-tx={ev.tx || undefined}>
    {ev.at ? <time dateTime={ev.at}>{quand(ev.at)}</time> : <span className="vrm-fp-ev-sansdate">—</span>}
    <span className="vrm-fp-ev-txt">{ev.lien ? <a href={ev.lien} target="_blank" rel="noopener noreferrer">{ev.texte}</a> : ev.texte}{ev.preuve ? <small data-fiche-preuve="">{ev.preuve}</small> : null}</span>
  </li>
);

// (5 nov.) « VOIR L'ÉTAT » : tout ce qui se calcule sur cet article (le prix
// d'achat est porté par la tuile « Achat » ci-dessus, avec sa source)
// (`etatArticle`, src/etatArticle.js) — deux dates LUES par chiffre, sinon « — »
// et la raison ; « au moins » / « au plus » quand la première mise en ligne est
// plus ancienne que celle qu'on connaît. Aucune couleur (§7).
const LIB_SOURCE = { relie: 'achat relié', saisi: 'saisi à la main' };
function EtatArticle({ etat }) {
  const r = etat.republications;
  return (
    <section className="vrm-fp-etat" aria-label="L’état de cet article" data-fiche-etat-article="">
      <h3 className="vrm-fp-etat-titre">L’état</h3>
      <dl className="vrm-fp-etat-grille">
        {etat.lignes.map((l) => (
          <div key={l.cle} className="vrm-fp-etat-l" data-etat-ligne={l.cle} data-etat-val={l.jours == null ? '' : l.jours} data-etat-borne={l.borne || ''}>
            <dt>{l.titre}</dt>
            <dd><b>{texteDuree(l)}</b>{l.jours == null && l.raison ? <small>{l.raison}</small> : /^depuis/.test(l.borne || '') ? <small>pas encore vendue</small> : l.borne === 'au-plus' || l.borne === 'au-moins' ? <small>la 1re annonce n’a pas de date lue</small> : null}</dd>
          </div>
        ))}
        <div className="vrm-fp-etat-l" data-etat-ligne="republications" data-etat-val={r.n == null ? '' : r.n}>
          <dt>Republications</dt>
          <dd><b>{r.n == null ? '—' : r.n}</b><small>{r.n == null ? r.raison : 'vues par VRM'}</small></dd>
        </div>
      </dl>
    </section>
  );
}

export default function FichePaire({ owner = '', p, etat = null, lecture = false, num, onFermer, onRetour, onBordereau, onEmballer, onPrix, onDupliquer, onPublierAilleurs, neuve = null, onCopier, Photo, Icon, Retour }) {
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
          <span className="vrm-fp-titre">{(neuve && neuve.titre) || p.titre || (p.etat === 'rien' ? 'N° jamais servi' : 'Sans titre')}{(neuve && neuve.taille) || p.taille ? ` · ${(neuve && neuve.taille) || p.taille}` : ''}</span>
          {neuve ? <span className="vrm-fp-sous" data-fiche-neuve="">Photos à prendre</span> : null}
          {p.ancienNumero ? <span className="vrm-fp-sous">Ancien numéro (d’avant la remise à zéro)</span> : null}
        </span>
        {p.photo && Photo ? <span className="vrm-fp-photo">{Photo(p.photo)}</span> : null}
      </div>
      {p.double ? <p className="vrm-fp-double" role="alert" data-fiche-double="1">Deux paires présentes portent le N°{p.num} : vérifie le carton avant d’emballer ou d’imprimer.</p> : null}
      <div className="vrm-fp-tuiles">
        {/* (5 nov.) Le prix d'achat de « Voir l'état » est CE nombre (jamais écrit deux fois, §7) : sa source dessous. */}
        <div className="vrm-fp-tuile" data-fiche-resume-achat={r.achat == null ? '' : r.achat} {...(etat ? { 'data-etat-ligne': 'prix-achat', 'data-etat-val': etat.prixAchat.cents == null ? '' : etat.prixAchat.cents, 'data-etat-source': etat.prixAchat.source || '' } : {})}>
          <span>Achat</span><b>{eur(r.achat)}</b>
          {etat ? <small>{etat.prixAchat.cents == null ? etat.prixAchat.raison : LIB_SOURCE[etat.prixAchat.source]}</small> : null}
        </div>
        <div className="vrm-fp-tuile" data-fiche-resume-vente={r.vente == null ? '' : r.vente}><span>Vente</span><b>{eur(r.vente)}</b></div>
        <div className="vrm-fp-tuile" data-fiche-resume-benefice={r.benefice == null ? '' : r.benefice} data-fiche-benefice-partiel={r.benefPartiel ? '1' : undefined}>
          <span>Bénéfice</span><b>{signe(r.benefice)}</b>
          {r.benefice == null && r.raisonBenef ? <small>{r.raisonBenef}</small> : r.benefPartiel ? <small>frais pas tous confirmés</small> : null}
        </div>
      </div>
      {etat ? <EtatArticle etat={etat}/> : null}
      {(onPrix || onDupliquer || onPublierAilleurs) && !p.ancienNumero ? (
        <div className="vrm-fp-outils">
          {onPrix && !neuve ? <button type="button" className="vrm-ao-second" data-fiche-prix="" onClick={() => onPrix(p.num)}>Changer le prix</button> : null}
          {onPublierAilleurs && !neuve && p.etat !== 'rien' ? <button type="button" className="vrm-ao-second" data-fiche-publier-ailleurs="" onClick={() => onPublierAilleurs(p.num)}>Publier ailleurs</button> : null}
          {onDupliquer && p.etat !== 'rien' ? <button type="button" className="vrm-ao-second" data-fiche-dupliquer="" onClick={() => onDupliquer(p.num)}>Dupliquer</button> : null}
          {neuve && onCopier ? <button type="button" className="vrm-ao-second" data-fiche-copier="" onClick={() => onCopier(neuve)}>Copier le texte</button> : null}
        </div>
      ) : null}
      <nav className="vrm-fp-raccourcis" aria-label="Rubriques de cet article">{p.etapes.map(e=><button key={e.cle} type="button" onClick={()=>document.getElementById(`vrm-fiche-etape-${e.cle}`)?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'})}>{e.titre}</button>)}</nav>
      <HistoriqueModifications owner={owner} numero={p.num}/>
      <ol className="vrm-fp-parcours">
        {p.etapes.map((e) => (
          <li key={e.cle} id={`vrm-fiche-etape-${e.cle}`} className={'vrm-fp-etape is-' + e.etat} data-fiche-etape={e.cle} data-fiche-etat={e.etat}>
            <span className="vrm-fp-pastille" aria-hidden="true">{I(ICONE[e.cle] || 'info', 17)}</span>
            <span className="vrm-fp-txt">
              <span className="vrm-fp-ligne1"><b>{e.titre}</b>{e.date ? <time className="vrm-fp-date" dateTime={e.date}>{quand(e.date)}</time> : null}</span>
              {e.lignes ? e.lignes.map((l, j) => <span key={j} className="vrm-fp-detail" data-fiche-ligne={l.site} data-fiche-tx={l.tx || undefined}>{l.texte}{l.date && e.cle === 'vente' && e.lignes.length > 1 ? ` · ${quand(l.date)}` : ''}</span>) : null}
              {e.evenements && e.evenements.length ? <ul className="vrm-fp-evs">{e.evenements.map((ev, j) => <Evenement key={j} ev={ev}/>)}</ul> : null}
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
