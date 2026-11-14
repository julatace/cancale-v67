// ═══════════════════════════════════════════════════════════════════════════
// L'ACCOMPAGNEMENT D'UN GESTE (14 nov., lot accompagnement) — la règle : src/accompagnement.js §9
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « tout doit être plus accompagné dans l'app, chaque action doit être
// parfaite », « l'utilisateur ne doit pas se sentir seul ».
// UNE façon de dire les quatre moments d'une action, réutilisée partout :
//   <AccAvant geste vars/>      ce qui va se passer (chiffres) + ce qui ne se passera PAS
//   <AccPendant …/>             « 3 / 8 » + « Tout arrêter » quand c'est long
//   <AccApres geste vars/>      « ✓ 8 bordereaux dans le PDF · Ensuite : les déposer › »
//   <AccEchec geste erreur/>    « Pas fait : raison simple. Geste › » (jamais un code)
//   <AccHote/>                  la pilule des gestes courts (monté UNE fois, dans la zone des messages)
//   <AccVide …/>                une liste vide dit pourquoi, et le premier geste
//   <AccPremiereFois ecran/>    une phrase d'aide discrète, la première fois, désactivable
// Les séries longues gardent la feuille « VRM travaille » (src/composants/SuiviTravail.jsx) :
// elle porte data-acc-pendant / data-acc-apres par la sorte du travail (`gesteDeSorte`).
// ⚠️ Décision de Julien (14 nov.) : aucun nouvel « Annuler », aucune nouvelle
//    confirmation, aucun « ? » par action — rien de tout ça ici.
// Le dessin : textes à l'encre et au gris du système, l'accent seulement sur le lien
// d'un geste, l'ambre (point) pour un échec — jamais le rouge (réservé au doublon de N°).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../i18n/index.js';
import { useLangue } from '../i18n/react.js';
import {
  gesteAcc, GESTES_RAISON, lireEchec, abonnerGestes, lireGestes, oublierGeste,
  lirePremieres, ecrirePremieres, premiereAMontrer,
} from '../accompagnement.js';
import './accompagne.css';

// Le chemin d'un lien : dans l'app (`?tab=…`, la route des notifications) ou dehors.
export function allerVers(lien) {
  if (!lien) return;
  try {
    if (String(lien).startsWith('?tab=')) window.dispatchEvent(new CustomEvent('vrm:aller', { detail: lien }));
    else window.open(lien, '_blank', 'noopener');
  } catch (_) {}
}
const vide = (s) => !s || /^acc\./.test(s);
const t2 = (cle, vars) => { const s = tr(cle, vars); return vide(s) ? '' : s; };

// ── AVANT ────────────────────────────────────────────────────────────────────
export function AccAvant({ geste, vars = {}, className = '', sansPas = false }) {
  useLangue();
  const quoi = t2(`acc.${geste}.avant`, vars);
  const pas = sansPas ? '' : t2(`acc.${geste}.pas`, vars);
  if (!quoi) return null;
  return (
    <p className={`vrm-acc-avant ${className}`.trim()} data-acc-avant={geste}>
      <span data-acc-quoi="">{quoi}</span>{pas ? <> <span className="vrm-acc-pas" data-acc-pas="">{pas}</span></> : null}
    </p>
  );
}

// ── PENDANT ──────────────────────────────────────────────────────────────────
export function AccPendant({ geste, fait = 0, total = 0, onArreter = null, arretDemande = false, texte = '' }) {
  useLangue();
  const n = Math.max(0, Number(fait) || 0), m = Math.max(0, Number(total) || 0);
  const pct = m ? Math.round((Math.min(n, m) / m) * 100) : 0;
  const titre = texte || t2(`acc.${geste}.pendant`, { n, m }) || tr('acc.pendant');
  return (
    <div className="vrm-acc vrm-acc-pendant" data-acc-pendant={geste} data-acc-n={`${n}/${m}`} role="status" aria-live="polite">
      <div className="vrm-acc-ligne">
        <span className="vrm-acc-texte">{titre}{m ? <b className="vrm-acc-compte" data-acc-compte=""> · {tr('acc.nSurM', { n, m })}</b> : null}</span>
        {onArreter ? <button type="button" className="vrm-acc-lien" data-acc-arreter="" disabled={arretDemande} onClick={onArreter}>{arretDemande ? tr('acc.arretDemande') : tr('acc.toutArreter')}</button> : null}
      </div>
      {m ? <div className="vrm-acc-barre" role="progressbar" aria-valuemin={0} aria-valuemax={m} aria-valuenow={Math.min(n, m)} aria-label={tr('acc.nSurM', { n, m })}><i style={{ width: `${pct}%` }}/></div> : <div className="vrm-acc-barre is-indetermine" aria-hidden="true"><i/></div>}
    </div>
  );
}

// ── APRÈS ────────────────────────────────────────────────────────────────────
// `texte` : la phrase du résultat que l'écran a déjà écrite (elle remplace la phrase type, jamais les deux).
export function AccApres({ geste, vars = {}, onEnsuite = null, onFermer = null, ensuite = undefined, texte = '' }) {
  useLangue();
  const g = gesteAcc(geste);
  const suite = ensuite !== undefined ? ensuite : (g && g.ensuite) || null;
  const res = texte || t2(`acc.${geste}.apres`, vars) || tr('acc.fait');
  const libSuite = suite ? t2(`acc.${geste}.ensuite`, vars) : '';
  return (
    <div className="vrm-acc vrm-acc-apres" data-acc-apres={geste} role="status">
      <span className="vrm-acc-icone" aria-hidden="true">✓</span>
      <span className="vrm-acc-texte">{res}</span>
      {suite && libSuite ? <button type="button" className="vrm-acc-lien" data-acc-ensuite={suite.lien || ''} onClick={() => { if (onEnsuite) onEnsuite(suite); else allerVers(suite.lien); if (onFermer) onFermer(); }}>{tr('acc.ensuite', { geste: libSuite })}</button> : null}
      {onFermer ? <button type="button" className="vrm-acc-x" aria-label={tr('acc.fermer')} data-acc-fermer="" onClick={onFermer}>×</button> : null}
    </div>
  );
}

// ── ÉCHEC ────────────────────────────────────────────────────────────────────
// `erreur` : ce que le geste a rendu (Error, `{ ok:false, error }`, phrase…) ; ou déjà lu : `{ code, texte }`.
export function AccEchec({ geste, erreur, onReessayer = null, onFermer = null, lu = null }) {
  useLangue();
  const e = lu || lireEchec(erreur);
  const reparer = GESTES_RAISON[e.code] || GESTES_RAISON.inconnu;
  const raison = e.texte || tr(`acc.raison.${e.code}`);
  const peutReessayer = reparer.reessayer && typeof onReessayer === 'function';
  const libGeste = peutReessayer ? tr('acc.reessayer') : tr(`acc.geste.${e.code}`);
  return (
    <div className="vrm-acc vrm-acc-echec" data-acc-echec={geste} data-acc-raison={e.code} role="alert">
      <span className="vrm-acc-point" aria-hidden="true"/>
      <span className="vrm-acc-texte">{tr('acc.pasFait', { raison })}</span>
      {peutReessayer ? <button type="button" className="vrm-acc-lien" data-acc-reparer="reessayer" onClick={() => { if (onFermer) onFermer(); onReessayer(); }}>{libGeste}</button>
        : reparer.lien ? <button type="button" className="vrm-acc-lien" data-acc-reparer={reparer.lien} onClick={() => { allerVers(reparer.lien); if (onFermer) onFermer(); }}>{libGeste}</button>
        : <span className="vrm-acc-geste" data-acc-reparer="">{libGeste}</span>}
      {onFermer ? <button type="button" className="vrm-acc-x" aria-label={tr('acc.fermer')} data-acc-fermer="" onClick={onFermer}>×</button> : null}
    </div>
  );
}

// ── L'HÔTE : les gestes courts (générer, déposer, relier, déclarer…) ─────────
// Posé DANS la zone des messages de la coque (même place, même `aria-live`) : il
// s'en va tout seul (le résultat 7 s, l'échec 12 s), jamais un bandeau qui reste.
export function AccHote() {
  const [liste, setListe] = React.useState(() => lireGestes());
  React.useEffect(() => abonnerGestes(setListe), []);
  if (!liste.length) return null;
  return (
    <div className="vrm-acc-hote" data-acc-hote={liste.length}>
      {liste.map((g) => g.phase === 'pendant'
        ? <AccPendant key={g.id} geste={g.geste} fait={g.fait} total={g.total} onArreter={g.arretable ? g.arreter : null} texte={g.texte || ''}/>
        : g.phase === 'apres'
          ? <AccApres key={g.id} geste={g.geste} vars={g.vars} onFermer={() => oublierGeste(g.id)}/>
          : <AccEchec key={g.id} geste={g.geste} lu={{ code: g.raison, texte: g.texte }} onReessayer={g.reessayer} onFermer={() => oublierGeste(g.id)}/>)}
    </div>
  );
}

// ── LISTE VIDE : pourquoi, et le premier geste ───────────────────────────────
// `cle` : `vide.<cle>.pourquoi` (et `.geste` si `onGeste`/`lien`). Rendu DANS l'état vide
// de l'écran (EmptyState), jamais une seconde carte.
// `sansPourquoi` : l'écran dit déjà pourquoi (sa phrase) ; seul le premier geste s'ajoute.
export function AccVide({ cle, onGeste = null, lien = '', vars = {}, sansPourquoi = false }) {
  useLangue();
  const pourquoi = t2(`vide.${cle}.pourquoi`, vars);
  const geste = t2(`vide.${cle}.geste`, vars);
  if (!pourquoi || (sansPourquoi && !(geste && (onGeste || lien)))) return null;
  return (
    <div className="vrm-acc-vide" data-acc-vide={cle}>
      {sansPourquoi ? null : <p data-acc-vide-pourquoi="">{pourquoi}</p>}
      {geste && (onGeste || lien) ? <button type="button" className="vrm-acc-lien" data-acc-vide-geste="" onClick={() => (onGeste ? onGeste() : allerVers(lien))}>{geste}</button> : null}
    </div>
  );
}

// ── LA PREMIÈRE FOIS SUR UN ÉCRAN ────────────────────────────────────────────
// Une phrase, sous le titre, la première fois seulement. « Compris » la range ;
// « Ne plus afficher ces aides » les coupe toutes (sur cet appareil). Jamais au-dessus du titre.
export function AccPremiereFois({ ecran }) {
  useLangue();
  const [m, setM] = React.useState(() => lirePremieres());
  const texte = t2(`premiere.${ecran}`);
  if (!texte || !premiereAMontrer(ecran, m)) return null;
  const poser = (n) => { ecrirePremieres(n); setM(n); };
  return (
    <div className="vrm-acc-premiere" data-acc-premiere={ecran} role="note">
      <p>{texte}</p>
      <div className="vrm-acc-premiere-gestes">
        <button type="button" className="vrm-acc-lien" data-acc-premiere-vu="" onClick={() => poser({ ...m, vus: [...m.vus, ecran] })}>{tr('premiere.compris')}</button>
        <button type="button" className="vrm-acc-lien is-discret" data-acc-premiere-couper="" onClick={() => poser({ ...m, coupe: true })}>{tr('premiere.couper')}</button>
      </div>
    </div>
  );
}

export default AccAvant;
