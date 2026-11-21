// ═══════════════════════════════════════════════════════════════════════════
// LA FEUILLE « VRM TRAVAILLE » (11 nov., demande de Julien : « je veux que VRM
// reste FIGÉ et qu'il y ait un DÉTAIL de toutes les infos que VRM fait, avec une
// BARRE DE PROGRESSION »). La règle : src/suiviTravail.js (magasin `suivi`).
//
// • Plein écran, portail sur <body>, au-dessus de toutes les feuilles (15000) mais
//   SOUS les confirmations (20000) : une question posée pendant le travail (couleur
//   d'un brouillon, champ manquant) reste répondable.
// • Tout ce qui était à l'écran avant passe en `inert` (rien de cliquable, rien au
//   clavier) ; le retour du navigateur et Échap ne ferment rien ; fermer l'onglet
//   demande confirmation (`beforeunload`) tant que ça tourne.
// • Deux gestes seulement pendant le travail : « Mettre en pause » (l'étape en cours
//   finit, puis VRM s'arrête) et « Arrêter » (confirmé ici même).
// • À la fin : le récapitulatif, puis « Fermer » ⇒ VRM se dégèle et le travail part
//   dans « Ce que VRM a fait » (`TravauxPasses`).
// API pour les écrans (et le chantier « Publier partout ») :
//   import { suivi } from '../suiviTravail.js';
//   const t = suivi.demarrer({ sorte, titre, etapes, articles, uid, surGeste });
//   t.debut(id) · t.etape(id, cle, detail) · t.noter(texte, id, ton) · t.pause({ ms, raison })
//   t.fin(id, { etat: 'ok'|'main'|'refus'|'saute', raison, lien, geste }) · t.doitSArreter() · t.terminer()
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { createPortal } from 'react-dom';
import { suivi, progression, recap, texteJournal, heureJournal, duree, lireTravaux, repriseDepuisExtension } from '../suiviTravail.js';
import JaugeActions from '../JaugeActions.jsx';
import { tr, date } from '../i18n/index.js';
import { useLangue } from '../i18n/react.js';
import './suivi-travail.css';
// (14 nov., lot accompagnement) La feuille porte les moments du geste qu'elle suit (src/accompagnement.js §9).
import { gesteDeSorte } from '../accompagnement.js';
import { AccApres, AccEchec } from '../ui/Accompagne.jsx';

export const Z_SUIVI = 15000;

export function useSuivi() {
  return React.useSyncExternalStore(suivi.abonner, suivi.lire, suivi.lire);
}

// Tout ce qui est déjà dans <body> passe en `inert` (sauf la feuille) ; rendu à la fin.
function useFiger(actif, noeud) {
  React.useEffect(() => {
    if (!actif || typeof document === 'undefined') return undefined;
    const poses = [];
    for (const el of Array.from(document.body.children)) {
      if (el === noeud || el.contains(noeud) || el.tagName === 'SCRIPT' || el.hasAttribute('inert')) continue;
      el.setAttribute('inert', ''); el.setAttribute('data-suivi-fige', ''); poses.push(el);
    }
    const garde = (e) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); } };
    window.addEventListener('keydown', garde, true);
    // Une question posée PENDANT le travail (confirmation, placement du tampon, couleur d'un
    // brouillon…) arrive comme un nouveau nœud de <body> : elle n'est pas figée, et elle passe
    // AU-DESSUS de la feuille (sinon l'action attendrait une réponse qu'on ne peut pas donner).
    const releves = [];
    const relever = (el) => {
      if (!(el instanceof HTMLElement) || el === noeud || el.contains(noeud) || el.tagName === 'SCRIPT' || el.hasAttribute('data-suivi-fige')) return;
      let z = 0, pos = 'static';
      try { const cs = getComputedStyle(el); z = Number(cs.zIndex) || 0; pos = cs.position; } catch (_) {}
      if (z > Z_SUIVI) return;
      releves.push([el, el.style.zIndex, el.style.position]);
      if (pos === 'static') el.style.position = 'relative';
      el.style.zIndex = String(Z_SUIVI + 1); el.setAttribute('data-suivi-releve', '');
    };
    let obs = null;
    try { obs = new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach(relever))); obs.observe(document.body, { childList: true }); } catch (_) { obs = null; }
    return () => {
      window.removeEventListener('keydown', garde, true);
      if (obs) obs.disconnect();
      releves.forEach(([el, z, p]) => { el.style.zIndex = z; el.style.position = p; el.removeAttribute('data-suivi-releve'); });
      poses.forEach((el) => { el.removeAttribute('inert'); el.removeAttribute('data-suivi-fige'); });
    };
  }, [actif, noeud]);
}
// Le retour du navigateur ne ferme rien tant que ça tourne : l'entrée est reposée.
function useRetourBloque(actif) {
  React.useEffect(() => {
    if (!actif || typeof window === 'undefined') return undefined;
    try { window.history.pushState({ ...(window.history.state || {}), vrmSuivi: 1 }, ''); } catch (_) {}
    const f = (e) => { try { e.stopImmediatePropagation(); window.history.pushState({ ...(window.history.state || {}), vrmSuivi: 1 }, ''); } catch (_) {} };
    window.addEventListener('popstate', f, true);
    const avant = (e) => { e.preventDefault(); e.returnValue = ''; return ''; };
    window.addEventListener('beforeunload', avant);
    return () => { window.removeEventListener('popstate', f, true); window.removeEventListener('beforeunload', avant); };
  }, [actif]);
}
function useTic(actif) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => { if (!actif) return undefined; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [actif]);
  return now;
}

function Journal({ s }) {
  const ref = React.useRef(null);
  const [copie, setCopie] = React.useState('');
  React.useEffect(() => { const el = ref.current; if (el) el.scrollTop = el.scrollHeight; }, [s.journal.length]);
  const copier = async () => {
    const txt = texteJournal(s);
    let ok = false;
    try { await navigator.clipboard.writeText(txt); ok = true; } catch (_) { ok = false; }
    setCopie(ok ? 'ok' : 'ko');
    setTimeout(() => setCopie(''), 2500);
  };
  return (
    <section className="vrm-st-journal" aria-label={tr('suivi.journal.titre')}>
      <div className="vrm-st-journal-tete">
        <h3>{tr('suivi.journal.titre')}</h3>
        <button type="button" className="vrm-st-lien" data-suivi-copier="" onClick={copier}>{copie === 'ok' ? tr('suivi.journal.copie') : copie === 'ko' ? tr('suivi.journal.pasCopie') : tr('suivi.journal.copier')}</button>
      </div>
      <ol ref={ref} className="vrm-st-lignes" data-suivi-journal={s.journal.length} aria-live="polite" aria-relevant="additions">
        {s.journal.map((l, i) => (
          <li key={i} data-ton={l.ton} data-suivi-ligne="">
            <time>{heureJournal(l.at)}</time>{l.qui ? <b>{l.qui}</b> : null}<span>{l.texte}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Recap({ s, jobs }) {
  const r = recap(s);
  const nom = (a) => `${a.num ? `N°${a.num} · ` : ''}${a.titre || tr('suivi.sansTitre')}`;
  const bloc = (cle, liste, rendu) => (liste.length ? (
    <div className="vrm-st-recap-bloc" data-suivi-recap={cle} data-n={liste.length}>
      <h4>{tr(`suivi.recap.${cle}`, { n: liste.length })}</h4>
      <ul>{liste.map((a) => <li key={a.id} data-suivi-article={a.id}>{rendu(a)}</li>)}</ul>
    </div>
  ) : null);
  return (
    <section className="vrm-st-recap" aria-label={tr('suivi.recap.titre')}>
      {bloc('reussies', r.reussies, (a) => <span>{nom(a)}</span>)}
      {bloc('aLaMain', r.aLaMain, (a) => <><span>{nom(a)}</span>{a.raison ? <small>{a.raison}</small> : null}{a.lien ? <a href={a.lien} target="_blank" rel="noopener noreferrer" className="vrm-st-lien">{tr('suivi.ouvrir')} ↗</a> : null}</>)}
      {bloc('refusees', r.refusees, (a) => <><span>{nom(a)}</span>{a.raison ? <small>{a.raison}</small> : null}{a.geste ? <small className="vrm-st-geste">{a.geste}</small> : null}{a.lien ? <a href={a.lien} target="_blank" rel="noopener noreferrer" className="vrm-st-lien">{tr('suivi.ouvrir')} ↗</a> : null}</>)}
      {bloc('pasCommencees', r.pasCommencees, (a) => {
        if (a.etat !== 'encours') return <span>{nom(a)}</span>;
        const lu = repriseDepuisExtension(a.id, jobs);
        return <><span>{nom(a)}</span><small className="vrm-st-geste" data-suivi-a-verifier="">{lu ? tr('suivi.recap.extDit', { etape: lu.etape }) : tr('suivi.recap.aVerifier')}</small></>;
      })}
    </section>
  );
}

// La feuille elle-même, pour un travail donné (exportée pour les bancs).
export function SuiviTravailFeuille({ s, jobs = null }) {
  useLangue();
  const [noeud, setNoeud] = React.useState(null);
  const [confArret, setConfArret] = React.useState(false);
  const tourne = s.statut === 'cours';
  const enPause = s.statut === 'pause';
  const fini = !tourne && !enPause;
  const now = useTic(!fini || !!s.pause);
  useFiger(true, noeud);
  useRetourBloque(tourne || enPause);
  const p = progression(s, now);
  const a = p.enCours;
  const titreEtat = tourne ? (s.demande === 'pause' ? tr('suivi.statut.pauseDemandee') : s.demande === 'arret' ? tr('suivi.statut.arretDemande') : tr('suivi.statut.cours'))
    : tr(`suivi.statut.${s.statut}`);
  const pct = Math.round(p.part * 100);
  const geste = gesteDeSorte(s.sorte);
  // La première raison d'un refus (le récapitulatif les détaille toutes, une par article).
  const refus1 = fini && !p.nOk && p.nRefus ? (s.articles || []).find((x) => x.etat === 'refus') : null;
  return createPortal(
    <div ref={setNoeud} className="vrm-st" role="dialog" aria-modal="true" aria-labelledby="vrm-st-titre" style={{ zIndex: Z_SUIVI }}
      data-suivi-travail={s.sorte} data-suivi-statut={s.statut} data-suivi-demande={s.demande || ''} data-suivi-n={`${p.nFinis}/${p.total}`}
      data-acc-pendant={!fini && geste ? geste : undefined}>
      <div className="vrm-st-feuille">
        <header className="vrm-st-tete">
          <p className="vrm-st-etat" data-suivi-etat-texte="">{titreEtat}</p>
          <h2 id="vrm-st-titre">{s.titre}</h2>
          {tourne ? <p className="vrm-st-fige">{tr('suivi.fige')}</p> : null}
        </header>

        <div className="vrm-st-avancee">
          <div className="vrm-st-compte">
            <b data-suivi-compte="">{tr('suivi.nSurM', { n: p.nFinis, m: p.total })}</b>
            <span>{[p.nOk ? tr('suivi.nReussies', { n: p.nOk }) : '', p.nMain ? tr('suivi.nMain', { n: p.nMain }) : '', p.nRefus ? tr('suivi.nRefus', { n: p.nRefus }) : ''].filter(Boolean).join(' · ')}</span>
          </div>
          <div className="vrm-st-barre" role="progressbar" aria-valuemin={0} aria-valuemax={p.total} aria-valuenow={p.nFinis} aria-valuetext={tr('suivi.nSurM', { n: p.nFinis, m: p.total })} data-suivi-part={pct}>
            <i style={{ width: `${pct}%` }}/>
          </div>
          <dl className="vrm-st-temps">
            <div><dt>{tr('suivi.temps.ecoule')}</dt><dd data-suivi-ecoule={Math.round(p.ecoule)}>{duree(p.ecoule)}</dd></div>
            <div><dt>{tr('suivi.temps.restant')}</dt><dd data-suivi-restant={p.restant == null ? '' : Math.round(p.restant)}>{fini ? '—' : p.restant == null ? '—' : p.restant === 0 ? tr('suivi.temps.presque') : tr('suivi.temps.environ', { duree: duree(p.restant) })}</dd></div>
          </dl>
          {p.pause ? <p className="vrm-st-pause" role="status" data-suivi-pause={Math.round(p.pause.sec)}>{p.pause.raison} · <b>{duree(p.pause.sec)}</b></p> : null}
          {s.uid && !fini ? <div className="vrm-st-jauge"><JaugeActions uid={s.uid}/></div> : null}
        </div>

        {a && !fini ? (
          <section className="vrm-st-article" data-suivi-en-cours={a.id} data-suivi-etape={a.etape || ''}>
            <p className="vrm-st-article-nom"><span>{tr('suivi.annonceRang', { n: p.rang, m: p.total })}</span><b>{a.num ? `N°${a.num} · ` : ''}{a.titre || tr('suivi.sansTitre')}</b></p>
            {s.etapes.length ? (
              <ol className="vrm-st-etapes">
                {s.etapes.map(([k, lib], i) => {
                  const e = i < p.iEtape ? 'fait' : i === p.iEtape ? 'ici' : 'apres';
                  return <li key={k} data-suivi-etape-cle={k} data-etat={e} aria-current={e === 'ici' ? 'step' : undefined}><span aria-hidden="true">{e === 'fait' ? '✓' : i + 1}</span>{lib}</li>;
                })}
              </ol>
            ) : null}
          </section>
        ) : null}

        {fini && geste && p.nOk ? <AccApres geste={geste} vars={{ n: p.nOk }} onEnsuite={(suite) => { suivi.fermer(); setTimeout(() => { try { window.dispatchEvent(new CustomEvent('vrm:aller', { detail: suite.lien })); } catch (_) {} }, 60); }}/> : null}
        {refus1 && geste ? <AccEchec geste={geste} erreur={refus1.raison || ''} gesteTexte={refus1.geste || ''}/> : null}
        {fini || (enPause && !tourne) ? <Recap s={s} jobs={jobs}/> : null}

        <Journal s={s}/>

        <footer className="vrm-st-pied">
          {confArret && (tourne || enPause) ? (
            <div className="vrm-st-conf" role="alertdialog" aria-label={tr('suivi.arreter.question')} data-suivi-conf-arret="">
              <p>{tr('suivi.arreter.question')}</p>
              <small>{tr('suivi.arreter.desc')}</small>
              <div className="vrm-st-boutons">
                <button type="button" className="vrm-st-b is-second" data-suivi-continuer="" onClick={() => setConfArret(false)}>{tr('suivi.arreter.non')}</button>
                <button type="button" className="vrm-st-b is-danger" data-suivi-arreter-oui="" onClick={() => { setConfArret(false); if (enPause) suivi.arreterEnPause(); else suivi.demander('arret'); }}>{tr('suivi.arreter.oui')}</button>
              </div>
            </div>
          ) : tourne ? (
            <div className="vrm-st-boutons">
              <button type="button" className="vrm-st-b is-second" data-suivi-pause-bouton="" disabled={!!s.demande} onClick={() => suivi.demander('pause')}>{tr('suivi.pause')}</button>
              <button type="button" className="vrm-st-b is-second" data-suivi-arreter="" disabled={s.demande === 'arret'} onClick={() => setConfArret(true)}>{tr('suivi.arreter')}</button>
            </div>
          ) : enPause ? (
            <div className="vrm-st-boutons">
              <button type="button" className="vrm-st-b is-premier" data-suivi-reprendre="" disabled={!suivi.pilote()} onClick={() => suivi.reprendre()}>{tr('suivi.reprendre')}</button>
              <button type="button" className="vrm-st-b is-second" data-suivi-arreter="" onClick={() => setConfArret(true)}>{tr('suivi.arreter')}</button>
              {!suivi.pilote() ? <small className="vrm-st-note" data-suivi-sans-ecran="">{tr('suivi.reprise.sansEcran')}</small> : null}
            </div>
          ) : (
            <div className="vrm-st-boutons">
              <button type="button" className="vrm-st-b is-premier" data-suivi-fermer="" onClick={() => suivi.fermer()}>{tr('suivi.fermer')}</button>
            </div>
          )}
          {fini ? <small className="vrm-st-note">{tr('suivi.garde')}</small> : null}
        </footer>
      </div>
    </div>, document.body);
}

// L'hôte, monté UNE fois avec la session : relit un travail laissé (rechargement,
// veille) et dessine la feuille tant qu'un travail existe. `lireJobs` rend les étapes
// que l'extension dit elle-même (relues à son battement), `abonnerExt` y abonne.
export function SuiviTravailHote({ lireJobs = () => null, abonnerExt = null }) {
  const s = useSuivi();
  const [, force] = React.useReducer((n) => n + 1, 0);
  React.useEffect(() => { suivi.relire(lireJobs()); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => (typeof abonnerExt === 'function' ? abonnerExt(force) : undefined), [abonnerExt]);
  const attente = s && s.visibleDes ? s.visibleDes - Date.now() : 0;
  React.useEffect(() => { if (!(attente > 0)) return undefined; const t = setTimeout(force, attente + 20); return () => clearTimeout(t); }, [attente > 0, s && s.id]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!s || typeof document === 'undefined' || attente > 0) return null;
  return <SuiviTravailFeuille s={s} jobs={lireJobs()}/>;
}

// « Ce que VRM a fait » : les derniers travaux suivis, gardés sur cet appareil.
export function TravauxPasses() {
  const [liste] = React.useState(() => lireTravaux());
  if (!liste.length) return null;
  return (
    <section className="vrm-st-passes" data-suivi-passes={liste.length} aria-label={tr('suivi.passes.titre')}>
      <h3>{tr('suivi.passes.titre')}</h3>
      {liste.map((s) => {
        const r = recap(s);
        return (
          <details key={s.id} className="vrm-repli vrm-st-passe" data-suivi-passe={s.sorte}>
            <summary>
              <b>{s.titre}</b>
              <small>{date(s.debut, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {[tr('suivi.nReussies', { n: r.reussies.length }), r.aLaMain.length ? tr('suivi.nMain', { n: r.aLaMain.length }) : '', r.refusees.length ? tr('suivi.nRefus', { n: r.refusees.length }) : ''].filter(Boolean).join(' · ')}</small>
            </summary>
            <ol className="vrm-st-lignes is-passe">
              {s.journal.map((l, i) => <li key={i} data-ton={l.ton}><time>{heureJournal(l.at)}</time>{l.qui ? <b>{l.qui}</b> : null}<span>{l.texte}</span></li>)}
            </ol>
          </details>
        );
      })}
    </section>
  );
}

export default SuiviTravailHote;
