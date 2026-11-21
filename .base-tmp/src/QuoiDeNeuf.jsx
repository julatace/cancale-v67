// ═══════════════════════════════════════════════════════════════════════════
// « QUOI DE NEUF » — la carte de Ma journée, la feuille, la liste de Paramètres
// (11 nov.). Les règles : src/nouveautes.js. Rien de bloquant : une ligne
// discrète qui s'ouvre en feuille ; « Voir » mène à l'écran ; « Tout vu » la range.
// App.jsx fournit SheetShell (avec le vrai FermeAuRetour, portail) et Bouton.
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { libelleNombre, lienDe } from './nouveautes.js';
import './quoi-de-neuf.css';

const dateCourte = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || '');
  if (!m) return '';
  const mois = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  return `${Number(m[3])} ${mois[Number(m[2]) - 1]}`;
};

// La carte : une ligne, toute la carte se touche. Rien à voir ⇒ rien.
export function QuoiDeNeufCarte({ aVoir, onOuvrir }) {
  if (!Array.isArray(aVoir) || !aVoir.length) return null;
  return (
    <button type="button" className="vrm-qdn-carte" data-quoi-de-neuf-carte="" data-n={String(aVoir.length)} onClick={onOuvrir}
      aria-label={`Nouveau : ${libelleNombre(aVoir.length)}. Ouvrir.`}>
      <span className="vrm-qdn-pastille">Nouveau</span>
      <span className="vrm-qdn-texte">{libelleNombre(aVoir.length)}</span>
      <span className="vrm-qdn-premier">{aVoir[0].titre}</span>
      <svg className="vrm-qdn-chevron" aria-hidden="true" width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l6 6-6 6"/></svg>
    </button>
  );
}

// Les lignes (feuille et Paramètres) : titre, phrase, date, « Voir ».
export function QuoiDeNeufListe({ liste, vues = {}, onVoir }) {
  return (
    <ul className="vrm-qdn-liste" data-quoi-de-neuf-liste="">
      {liste.map((n) => (
        <li key={n.id} className="vrm-qdn-ligne" data-nouveaute={n.id} data-nouveaute-vue={vues[n.id] ? '1' : '0'}>
          <div className="vrm-qdn-corps">
            <div className="vrm-qdn-titre">{!vues[n.id] && <span className="vrm-qdn-point" aria-label="nouveau"/>}{n.titre}</div>
            <div className="vrm-qdn-phrase">{n.phrase}</div>
            <div className="vrm-qdn-date">{dateCourte(n.date)}</div>
          </div>
          <a className="vrm-qdn-voir" href={lienDe(n)} data-nouveaute-voir={n.tab}
            onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); onVoir(n); }}>Voir</a>
        </li>
      ))}
    </ul>
  );
}

export function QuoiDeNeufFeuille({ aVoir, onVoir, onToutVu, onFermer, SheetShell, Bouton }) {
  return (
    <SheetShell onClose={onFermer} titre="Quoi de neuf" sousTitre={libelleNombre(aVoir.length)} data-quoi-de-neuf-feuille="">
      <QuoiDeNeufListe liste={aVoir} onVoir={onVoir}/>
      <div className="vrm-fs-pied">
        <Bouton variante="primaire" plein data-quoi-de-neuf-vu="" onClick={onToutVu}>Tout vu</Bouton>
      </div>
    </SheetShell>
  );
}

// Paramètres → Aide → « Quoi de neuf » : tout ce qui le concerne depuis son inscription.
export function QuoiDeNeufReglage({ liste, vues, onVoir }) {
  if (!liste.length) return <p className="vrm-qdn-vide" data-quoi-de-neuf-vide="">Rien de neuf depuis ton inscription.</p>;
  return <QuoiDeNeufListe liste={liste} vues={vues} onVoir={onVoir}/>;
}
