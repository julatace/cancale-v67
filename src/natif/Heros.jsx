// ── src/natif/Heros.jsx — la carte héros et les actions rondes (22 nov., chantier style-clarte, « en noir ») ──────────
// Julien (22 nov.) : « un mélange de 2 et 1 », « j'aime bien en noir ». PRÉSENTATIONNEL : l'écran passe des textes faits,
// des nombres formatés et des fonctions ; `valeur` null ⇒ « — » (pas su, jamais 0).
//   <Heros titre="Bénéfice brut · novembre" valeur="1 284,50" unite="€" sous="▲ +24 % …" tonSous="hausse" action={<Segmente…/>}
//          graphe={<GrapheJours…/>} trio={[{ cle, libelle, valeur }]} attrs={…}/>
//   <ActionsRondes elements={[{ cle, libelle, icone, n, plein, onClick, attrs }]}/>  — 4 ou 5, une cible de 52 au doigt.
import React from 'react';
import { cx } from './outils.js';
import './graphe.css';

const TIRET = '—';

export function Heros({ titre = '', valeur = null, unite = '', sous = '', tonSous = '', action = null, graphe = null, pied = null, trio = [], className = '', attrs = null, children }) {
  const su = !(valeur == null || valeur === '');
  return (
    <section className={cx('n-heros', className)} {...(attrs || {})}>
      <header className="n-heros-tete">
        <h2 className="n-heros-titre">{titre}</h2>
        {action ? <div className="n-heros-action">{action}</div> : null}
      </header>
      <p className="n-heros-valeur" data-n-vide={su ? undefined : '1'}>{su ? valeur : TIRET}{su && unite ? <span className="n-heros-unite">{unite}</span> : null}</p>
      {sous ? <p className="n-heros-sous" data-n-ton={tonSous || undefined}>{sous}</p> : null}
      {graphe ? <div className="n-heros-graphe">{graphe}</div> : null}
      {children}
      {trio.length ? (
        <dl className="n-heros-trio">
          {trio.map((t) => (
            <div key={t.cle} className="n-heros-trio-case" {...(t.attrs || {})}>
              <dt>{t.libelle}</dt><dd>{t.valeur == null || t.valeur === '' ? TIRET : t.valeur}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {pied}
    </section>
  );
}

export function ActionsRondes({ elements = [], libelle = '', className = '', attrs = null }) {
  return (
    <nav className={cx('n-actions-rondes', className)} aria-label={libelle || undefined} {...(attrs || {})}>
      {elements.map((e) => (
        <button key={e.cle} type="button" className="n-action-ronde" data-n-plein={e.plein ? '' : undefined} onClick={e.onClick} disabled={!e.onClick} {...(e.attrs || {})}>
          <span className="n-action-ronde-disque" aria-hidden="true">{e.icone}{e.n > 0 ? <span className="n-action-ronde-n">{e.n > 99 ? '99+' : e.n}</span> : null}</span>
          <span className="n-action-ronde-libelle">{e.libelle}</span>
        </button>
      ))}
    </nav>
  );
}

export default Heros;
