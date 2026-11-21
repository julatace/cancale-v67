// ════════════════════════════════════════════════════════════════════════════
//  LE VENDU PAR SEMAINE, FAÇON SANTÉ (8 nov. 2026, « beauté », point 5)
//  En tête de Statistiques : douze semaines en barres (une teinte : le bleu de
//  l'app), axes discrets (trois graduations rondes à droite, une date sur trois
//  dessous), et en haut le DÉTAIL de la semaine touchée — son montant en grand,
//  ses ventes, l'écart à la semaine d'avant. Toucher ou glisser le doigt sur le
//  graphique change la semaine (comme Santé) ; au clavier, ← → ; un tableau caché
//  dit tout au lecteur d'écran. Les chiffres sont ceux de `rythmeVendu` (src/
//  statsVentes.js, `ventesFaites`) ; une plateforme pas lue ⇒ « au moins ».
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { graduations, detailSemaine, semaineSous } from './graphiqueSemaines.js';

const dateCourte = (ms) => new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).replace('.', '');
const dateLongue = (ms) => new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

export function GraphiqueSemaines({ semaines, partiel = false, manque = [], fmt, titre = 'Vendu par semaine' }) {
  const n = Array.isArray(semaines) ? semaines.length : 0;
  const [choisi, setChoisi] = React.useState(n ? n - 1 : 0);
  const refPlot = React.useRef(null);
  const refBarres = React.useRef([]);
  if (!n) return null;
  const i = Math.min(choisi, n - 1);
  const D = detailSemaine(semaines, i, { partiel });
  const max = Math.max(0, ...semaines.map((s) => Number(s.eur) || 0));
  const G = graduations(max);
  const haut = G[G.length - 1] || 1;
  const euros = (v) => (fmt ? fmt(v) : `${Math.round(v)} €`);
  const libSemaine = D.enCours ? 'Cette semaine' : `Semaine du ${dateLongue(D.debut)}`;
  const comparaison = D.avant == null ? '' : D.pct != null
    ? `${D.pct > 0 ? '+' : D.pct < 0 ? '−' : ''}${Math.abs(D.pct)} % par rapport à la semaine d’avant`
    : `la semaine d’avant : ${euros(D.avant)}`;
  const choisirSous = (e) => {
    const el = refPlot.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const k = semaineSous(e.clientX - r.left, r.width, n);
    if (k != null && k !== i) setChoisi(k);
  };
  const clavier = (e) => {
    const k = e.key === 'ArrowLeft' ? i - 1 : e.key === 'ArrowRight' ? i + 1 : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : null;
    if (k == null || k < 0 || k >= n) return;
    e.preventDefault(); setChoisi(k);
    const b = refBarres.current[k]; if (b) b.focus();
  };
  return (
    <section className="vrm-sante" data-stats-carte="semaines-sante" data-stats-semaines={semaines.map((s) => Math.round(s.eur)).join(',')}
      data-sante-choisi={i} data-sante-partiel={partiel ? '1' : '0'} aria-labelledby="vrm-sante-titre">
      <div className="vrm-sante-haut">
        <h2 className="vrm-sante-titre" id="vrm-sante-titre">{titre}</h2>
        <span className="vrm-sante-periode">12 semaines</span>
      </div>
      <div className="vrm-sante-detail" aria-live="polite" data-sante-detail={i}>
        <span className="vrm-sante-lib">{libSemaine}</span>
        <span className="vrm-sante-chiffre" data-sante-montant={Math.round(D.eur * 100)} data-sante-n={D.n}>
          {D.auMoins ? <span className="vrm-sante-aumoins">au moins </span> : null}{euros(D.eur)}
        </span>
        <span className="vrm-sante-sous" data-sante-ecart={D.ecart == null ? '' : Math.round(D.ecart * 100)} data-sante-pct={D.pct == null ? '' : D.pct}>
          {D.n} vente{D.n > 1 ? 's' : ''}{D.enCours ? ' · en cours' : ''}{comparaison ? ` · ${comparaison}` : ''}
        </span>
      </div>
      <div className="vrm-sante-plot" ref={refPlot} onPointerDown={choisirSous} onPointerMove={(e) => { if (e.pointerType !== 'mouse' && e.buttons === 0) return; choisirSous(e); }}>
        <div className="vrm-sante-grille" aria-hidden="true">
          {G.map((g) => (
            <span key={g} className="vrm-sante-ligne" style={{ bottom: `${(g / haut) * 100}%` }}><span>{g === 0 ? '0' : euros(g).replace(/,00(?=\s*€)/, '')}</span></span>
          ))}
        </div>
        <div className="vrm-sante-barres" role="group" aria-label={`${titre}, 12 semaines — flèches gauche et droite pour changer de semaine`} onKeyDown={clavier}>
          {semaines.map((s, k) => {
            const h = haut ? ((Number(s.eur) || 0) / haut) * 100 : 0;
            return (
              <button key={s.debut} type="button" ref={(el) => { refBarres.current[k] = el; }} className={'vrm-sante-col' + (k === i ? ' is-choisi' : '') + (s.enCours ? ' is-encours' : '')}
                aria-pressed={k === i} tabIndex={k === i ? 0 : -1} data-sante-semaine={k} data-eur={Math.round((Number(s.eur) || 0) * 100)}
                aria-label={`${s.enCours ? 'Cette semaine (en cours)' : `Semaine du ${dateLongue(s.debut)}`} : ${euros(Number(s.eur) || 0)}, ${s.n} vente${s.n > 1 ? 's' : ''}`}
                onClick={() => setChoisi(k)} onMouseEnter={() => setChoisi(k)} onFocus={() => setChoisi(k)}>
                <span className="vrm-sante-barre" style={{ height: h > 0 ? `max(3px, ${h}%)` : 0 }}/>
              </button>
            );
          })}
        </div>
      </div>
      <div className="vrm-sante-axe" aria-hidden="true">
        {semaines.map((s, k) => <span key={s.debut}>{(n - 1 - k) % 3 === 0 ? (s.enCours ? 'cette sem.' : dateCourte(s.debut)) : ''}</span>)}
      </div>
      {partiel && manque.length ? <p className="vrm-sante-note">Sans {manque.join(', ')} : au moins.</p> : null}
      <table className="vrm-sr-seul">
        <caption>{titre}, douze semaines, de la plus ancienne à la plus récente</caption>
        <thead><tr><th scope="col">Semaine</th><th scope="col">Vendu</th><th scope="col">Ventes</th></tr></thead>
        <tbody>{semaines.map((s) => (
          <tr key={s.debut}><th scope="row">{s.enCours ? 'Cette semaine (en cours)' : `Semaine du ${dateLongue(s.debut)}`}</th><td>{partiel ? 'au moins ' : ''}{euros(Number(s.eur) || 0)}</td><td>{s.n}</td></tr>
        ))}</tbody>
      </table>
    </section>
  );
}
