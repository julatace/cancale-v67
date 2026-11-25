// ── src/natif/Heros.jsx — la carte héros et les actions rondes (22 nov., chantier style-clarte, « en noir ») ──────────
// Julien (22 nov.) : « un mélange de 2 et 1 », « j'aime bien en noir ». PRÉSENTATIONNEL : l'écran passe des textes faits,
// des nombres formatés et des fonctions ; `valeur` null ⇒ « — » (pas su, jamais 0).
//   <Heros titre="Bénéfice brut · novembre" valeur="1 284,50" unite="€" sous="▲ +24 % …" tonSous="hausse" action={<Segmente…/>}
//          graphe={<GrapheJours…/>} trio={[{ cle, libelle, valeur }]} attrs={…}/>
//   <ActionsRondes elements={[{ cle, libelle, icone, n, plein, onClick, attrs }]}/>  — 4 ou 5, une cible de 52 au doigt.
import React from 'react';
import { cx, attenteDe, attrsAttente } from './outils.js';
import './graphe.css';

const TIRET = '—';

export function Heros({ titre = '', valeur = null, unite = '', sous = '', tonSous = '', action = null, graphe = null, pied = null, trio = [], className = '', attrs = null, children, enCours = null }) {
  const su = !(valeur == null || valeur === '');
  // (24 nov., livrable) En lecture : le grand chiffre, sa phrase et les petits chiffres encore vides en squelette.
  const att = attenteDe(enCours, su, sous);
  const vide = (v) => v == null || v === '';
  return (
    <section className={cx('n-heros', className)} {...(attrs || {})}>
      <header className="n-heros-tete">
        <h2 className="n-heros-titre">{titre}</h2>
        {action ? <div className="n-heros-action">{action}</div> : null}
      </header>
      <p className="n-heros-valeur" data-n-vide={su ? undefined : '1'} {...attrsAttente(att, 'valeur')}>{su ? valeur : TIRET}{su && unite ? <span className="n-heros-unite">{unite}</span> : null}</p>
      {sous ? <p className="n-heros-sous" data-n-ton={tonSous || undefined} {...attrsAttente(att, 'note')}>{sous}</p> : null}
      {graphe ? <div className="n-heros-graphe">{graphe}</div> : null}
      {children}
      {trio.length ? (
        <dl className="n-heros-trio">
          {trio.map((t) => (
            <div key={t.cle} className="n-heros-trio-case" {...(t.attrs || {})}>
              <dt>{t.libelle}</dt><dd>{t.onClick ? <button type="button" className="n-heros-trio-porte" onClick={t.onClick} data-heros-porte={t.cle}>
                <span className="n-heros-trio-v" {...attrsAttente(att && vide(t.valeur), 'valeur')}>{t.valeur == null || t.valeur === '' ? TIRET : t.valeur}</span>{t.pourquoi ? <span className="n-heros-trio-pourquoi">{t.pourquoi}</span> : null}</button>
                : <>{att && vide(t.valeur) ? <span className="n-heros-trio-v" data-chiffre-attente="valeur">{TIRET}</span> : vide(t.valeur) ? TIRET : t.valeur}{t.pourquoi ? <span className="n-heros-trio-pourquoi">{t.pourquoi}</span> : null}</>}</dd>
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

// (22 nov. soir, maquettes de Julien) DES CASES À CHIFFRE côte à côte (Colis : « 6 à envoyer » | « 3 à retirer ») : chaque case
// se touche en entier ; `valeur` est déjà formatée (« — » si pas su) ; `tonSous` : 'ambre' (un geste) · 'lieu' (le point relais).
const attenteCase = (c) => attenteDe(c.enCours, !(c.valeur == null || c.valeur === '' || c.valeur === TIRET), c.sous);
export function CasesChiffres({ cases = [], className = '', attrs = null }) {
  return (
    <div className={cx('n-ccs', className)} {...(attrs || {})}>
      {cases.map((c) => (
        <button key={c.cle} type="button" className="n-cc" onClick={c.onClick} disabled={!c.onClick} {...(c.attrs || {})}>
          <span className="n-cc-tete">{c.icone ? <span className="n-cc-icone" aria-hidden="true">{c.icone}</span> : null}{c.libelle}</span>
          {c.visuel ? <span className="n-cc-visuel">{c.visuel}</span> : null}
          <span className="n-cc-valeur" {...attrsAttente(attenteCase(c), 'valeur')}>{c.valeur == null || c.valeur === '' ? TIRET : c.valeur}</span>
          {c.sous ? <span className="n-cc-sous" data-n-ton={c.tonSous || undefined} {...attrsAttente(attenteCase(c), 'note')}>{c.sous}</span> : null}
        </button>
      ))}
    </div>
  );
}

export default Heros;
