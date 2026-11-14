// ── LE PARCOURS D'ARRIVÉE : L'ÉCRAN PLEIN ET LA PETITE CARTE (11 nov. ; 3 étapes le 13 nov.) ──
// La RÈGLE (étapes, preuves, position, « Plus tard ») : src/parcoursArrivee.js.
// Ici, seulement ce qui se dessine — aucune lecture, aucune écriture :
//   · `ParcoursArrivee` : plein écran, UNE étape à la fois — un dessin, un titre,
//     l'état lu en direct (« J'attends… », « Reçu ✓ », « 12 annonces lues »),
//     UN geste, « Pourquoi ? » replié, « Plus tard ». Puis « C'est prêt ».
//   · `CarteParcours` : sur Ma journée, « Démarrer avec VRM · 1 sur 3 », la barre,
//     l'étape courante et SON geste exact (télécharger, ouvrir vinted.fr…), ou
//     « Continuer » ; les trois étapes sous un repli. Les trois faites : plus rien.
// Mouvement : un fondu court entre deux étapes ; rien sous `prefers-reduced-motion`.
import React from 'react';
import { reussite, ligneEtape } from './parcoursArrivee.js';
import './guide-demarrage.css';
import './parcours-arrivee.css';

const Coche = () => <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" /></svg>;

// Un dessin par étape : traits à l'encre grise, l'accent pour l'objet.
function Dessin({ cle }) {
  const p = { className: 'vrm-pa-dessin', viewBox: '0 0 240 120', 'aria-hidden': 'true', 'data-parcours-dessin': cle };
  if (cle === 'extension') return (
    <svg {...p}>
      <rect x="30" y="18" width="180" height="84" rx="14" className="g-carte" />
      <rect x="30" y="18" width="180" height="20" rx="10" className="g-case" />
      <circle cx="44" cy="28" r="3.5" className="g-ligne" /><circle cx="56" cy="28" r="3.5" className="g-ligne" />
      <rect x="176" y="22" width="24" height="12" rx="6" className="g-accent" />
      <rect x="48" y="52" width="96" height="8" rx="4" className="g-ligne-fort" />
      <rect x="48" y="68" width="70" height="7" rx="3.5" className="g-ligne" />
    </svg>
  );
  if (cle === 'vinted') return (
    <svg {...p}>
      {[0, 1, 2].map((i) => <g key={i}><rect x={40 + i * 56} y="22" width="48" height="60" rx="10" className="g-carte" /><rect x={46 + i * 56} y="28" width="36" height="32" rx="7" className="g-case" /><rect x={46 + i * 56} y="66" width={i === 1 ? 24 : 30} height="6" rx="3" className="g-ligne" /></g>)}
      <rect x="84" y="92" width="72" height="14" rx="7" className="g-accent" />
    </svg>
  );
  return (
    <svg {...p}>
      <circle cx="120" cy="60" r="38" className="g-accent" />
      <path d="M102 61l12 12 24-26" className="vrm-pa-coche" />
    </svg>
  );
}

// La phrase d'état d'une étape (lue, jamais supposée). `ton` : attente · ok · passu · neutre.
// Le texte d'une étape bloquée vient de la règle (`ligneEtape`, le même que la carte).
function phraseEtat(e, { ou }) {
  if (!e) return null;
  if (e.etat === 'fait') return { ton: 'ok', texte: reussite(e) };
  if (e.etat === 'encours') return { ton: 'attente', texte: ligneEtape(e, { ou }) };
  if (e.etat === 'passu') return { ton: 'passu', texte: ligneEtape(e, { ou }) };
  // L'extension absente : le guide de ce navigateur (PremiersPas) dit déjà quoi faire (§7, une fois).
  if (e.cle === 'extension' && (e.detail !== 'pasconnectee' && e.detail !== 'autrecompte')) return null;
  return { ton: e.etat === 'attente' ? 'attente' : e.detail === 'autrecompte' ? 'passu' : 'neutre', texte: ligneEtape(e, { ou }) };
}

export function ParcoursArrivee({ etat, montree, succes = '', gestes = {}, details = {}, ou = 'dans ton navigateur', onPlusTard, onFermer, onFin, onReessayer, Pop = null }) {
  if (!etat || !montree) return null;
  const pret = montree === 'pret';
  const e = pret ? null : etat.etapes.find((x) => x.cle === montree);
  const i = pret ? etat.total : etat.etapes.findIndex((x) => x.cle === montree);
  const ok = e && e.etat === 'fait';
  const ph = phraseEtat(e, { ou });
  const geste = e && !ok && e.etat !== 'encours' && e.etat !== 'passu' ? gestes[e.cle] : null;
  return (
    <div className="vrm-pa" role="dialog" aria-modal="true" aria-labelledby="vrm-pa-titre" data-parcours="" data-parcours-etape={montree} data-parcours-etat={e ? e.etat : 'pret'} data-parcours-faites={etat.faites}>
      <div className="vrm-pa-haut">
        <span className="vrm-pa-compte" data-parcours-progres={`${etat.faites}/${etat.total}`}>{pret ? 'Tout est prêt' : `Étape ${i + 1} sur ${etat.total}`}</span>
        <button type="button" className="vrm-pa-fermer" aria-label="Fermer" data-parcours-fermer="" onClick={onFermer}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg></button>
      </div>
      <div className="vrm-guide-barre vrm-pa-barre" role="progressbar" aria-label="Étapes faites" aria-valuemin={0} aria-valuemax={etat.total} aria-valuenow={etat.faites}>
        {etat.etapes.map((x) => <span key={x.cle} data-fait={x.etat === 'fait' ? '1' : '0'} data-ici={x.cle === montree ? '1' : '0'} />)}
      </div>
      <div className="vrm-pa-corps" key={montree}>
        <Dessin cle={pret ? 'pret' : montree} />
        <h1 id="vrm-pa-titre" className="vrm-pa-titre">{pret ? 'C’est prêt' : e.titre}</h1>
        {pret ? (
          <>
            <p className="vrm-pa-sous">Ta boutique est branchée. VRM range tout, seul.</p>
            <ul className="vrm-pa-recap" data-parcours-recap="">
              {etat.etapes.map((x) => <li key={x.cle} data-parcours-recap-etape={x.cle}><span className="vrm-pa-recap-coche"><Coche /></span><span>{x.court}</span><span className="vrm-pa-recap-quoi">{reussite(x)}</span></li>)}
            </ul>
            <button type="button" className="vrm-b vrm-b-primaire vrm-pa-gros" data-parcours-fin="" onClick={onFin}>Aller à Ma journée</button>
          </>
        ) : (
          <>
            {ph ? <p className="vrm-pa-etat" role="status" aria-live="polite" data-parcours-phrase="" data-ton={ph.ton} data-succes={succes === montree ? '1' : '0'}>
              {ph.ton === 'ok' ? <span className="vrm-pa-ok"><Coche /></span> : ph.ton === 'attente' ? <span className="vrm-pa-respire" aria-hidden="true" /> : null}
              <span>{ph.texte}</span>
            </p> : null}
            {Pop ? <Pop nom={'parcours-' + montree} titre={e.titre} resume="Pourquoi ?" style={{ margin: '2px auto 0', maxWidth: 420 }}><p className="vrm-pa-pourquoi">{e.pourquoi}</p></Pop>
              : <details className="vrm-pa-pourquoi-repli"><summary>Pourquoi ?</summary><p className="vrm-pa-pourquoi">{e.pourquoi}</p></details>}
            {!ok && details[montree] ? <div className="vrm-pa-detail" data-parcours-detail={montree}>{details[montree]}</div> : null}
            {e.etat === 'passu' && onReessayer ? <button type="button" className="vrm-b vrm-b-secondaire vrm-pa-gros" data-parcours-reessayer="" onClick={onReessayer}>Réessayer</button> : null}
            {geste ? (geste.href
              ? <a className="vrm-b vrm-b-primaire vrm-pa-gros" data-parcours-geste={e.cle} href={geste.href} target="_blank" rel="noreferrer">{geste.libelle}</a>
              : <button type="button" className="vrm-b vrm-b-primaire vrm-pa-gros" data-parcours-geste={e.cle} {...(geste.attrs || {})} onClick={geste.onClick}>{geste.libelle}</button>) : null}
            {e.attente && !ok ? <button type="button" className="vrm-b vrm-b-secondaire vrm-pa-gros" data-parcours-attendre="" onClick={onFermer}>Aller à Ma journée</button> : null}
            {!ok && !e.attente ? <button type="button" className="vrm-b vrm-b-discret vrm-pa-plus-tard" data-parcours-plus-tard={e.cle} onClick={() => onPlusTard && onPlusTard(e.cle)}>Plus tard</button> : null}
          </>
        )}
      </div>
    </div>
  );
}

// La petite carte de Ma journée. `mode` : 'etape' · 'reprendre' (src/parcoursArrivee.js).
// `geste` : le geste exact de l'étape bloquée ({ libelle, href, telecharger, cible }) —
// un lien qui fait la chose ET ouvre l'écran plein (`onContinuer`) ; sinon « Continuer ».
export function CarteParcours({ etat, mode, onContinuer, onPlusTard, onMasquer = null, onExemple = null, onImporter = null, geste = null, ou = 'dans ton navigateur' }) {
  if (!etat || !mode || mode === 'cachee') return null;
  const c = etat.etapes.find((x) => x.cle === etat.courante) || null;
  const i = c ? etat.etapes.indexOf(c) : -1;
  return (
    <section className="vrm-guide vrm-pa-carte" data-guide-demarrage="" data-parcours-carte={mode} data-guide-faites={etat.faites} data-guide-courante={etat.courante || ''} aria-labelledby="vrm-pa-carte-titre">
      <div className="vrm-guide-tete">
        <h2 id="vrm-pa-carte-titre" className="vrm-guide-titre">Démarrer avec VRM</h2>
        <span className="vrm-guide-compte" data-guide-progres={`${etat.faites}/${etat.total}`}>{etat.faites} sur {etat.total}</span>
      </div>
      <div className="vrm-guide-barre" role="progressbar" aria-label="Étapes faites" aria-valuemin={0} aria-valuemax={etat.total} aria-valuenow={etat.faites}>
        {etat.etapes.map((x) => <span key={x.cle} data-fait={x.etat === 'fait' ? '1' : '0'} data-ici={x.cle === etat.courante ? '1' : '0'} />)}
      </div>
      {mode === 'etape' && c ? (
        <div className="vrm-pa-carte-etape" data-guide-etape={c.cle} data-etat={c.etat} data-courante="1">
          <span className="vrm-guide-marque vrm-pa-carte-marque" aria-hidden="true">{i + 1}</span>
          <div className="vrm-pa-carte-texte">
            <b>{c.titre}</b>
            <span data-guide-ligne="">{ligneEtape(c, { ou }) || c.pourquoi}</span>
          </div>
        </div>
      ) : null}
      {mode === 'reprendre' ? <p className="vrm-pa-carte-note" data-parcours-reste="">Le reste attend. Reprends quand tu veux.</p> : null}
      <div className="vrm-pa-carte-gestes">
        {mode === 'etape' && c && geste && geste.href
          ? <a className="vrm-b vrm-b-primaire" data-parcours-continuer="" data-guide-geste={c.cle} href={geste.href} {...(geste.telecharger ? { download: '' } : { target: '_blank', rel: 'noreferrer' })} onClick={onContinuer}>{geste.libelle}</a>
          : <button type="button" className="vrm-b vrm-b-primaire" data-parcours-continuer="" onClick={onContinuer}>{mode === 'reprendre' ? 'Reprendre' : 'Continuer'}</button>}
        {mode === 'etape' && c && !c.attente && onPlusTard ? <button type="button" className="vrm-b vrm-b-discret" data-guide-plus-tard={c.cle} onClick={() => onPlusTard(c.cle)}>Plus tard</button> : null}
      </div>
      <details className="vrm-pa-carte-repli">
        <summary>Les {etat.total} étapes</summary>
        <ol className="vrm-pa-carte-liste">
          {etat.etapes.map((x, k) => (
            <li key={x.cle} data-parcours-rang={x.cle} data-etat={x.etat} data-reportee={x.reportee ? '1' : '0'}>
              <span className="vrm-pa-carte-puce" aria-hidden="true">{x.etat === 'fait' ? <Coche /> : k + 1}</span>
              <span>{x.court}</span>
              <span className="vrm-pa-carte-quoi">{x.etat === 'fait' ? reussite(x) : x.reportee ? 'Plus tard' : x.etat === 'passu' ? 'Pas su' : ''}</span>
            </li>
          ))}
        </ol>
      </details>
      {/* (11 nov.) FACULTATIF, hors des étapes comptées : il arrive d'un tableur ou d'un autre logiciel. */}
      {onImporter ? (
        <p className="vrm-pa-carte-note" data-guide-importer="">Tu arrives d’un tableur ou d’un autre logiciel&nbsp;?{' '}
          <button type="button" className="vrm-b vrm-b-discret" data-guide-importer-geste="" onClick={onImporter}>Importer mon stock</button></p>
      ) : null}
      {onExemple || onMasquer ? (
        <div className="vrm-pa-carte-pied">
          {onExemple ? <button type="button" className="vrm-b vrm-b-discret" data-exemple-entrer="" onClick={onExemple}>Voir VRM avec des exemples</button> : null}
          {onMasquer ? <button type="button" className="vrm-b vrm-b-discret" data-guide-masquer="" onClick={onMasquer}>Masquer le guide</button> : null}
        </div>
      ) : null}
    </section>
  );
}
