// ── L'ACCUEIL DES NOUVEAUX, LE RESTE (14 nov.) — ce qui se dessine ──────────
// Les RÈGLES vivent à côté (JS pur, exécutées par scripts/audit-accueil-reste.cjs) :
//   cartonsNumeros.js (134) · trouveChezToi.js (133) · visiteEcrans.js (136) ·
//   glossaire.js (139) · conseilDuJour.js (140) · essaiBilan.js (145) ·
//   appelBienvenue.js (147) · aides.js (les interrupteurs, par compte).
// Ici : aucune règle, aucun chiffre calculé — des cartes qui lisent ces règles.
// Direction (skill vrm-design) : titre de section HORS de la carte, carte = contenu,
// une ligne courte au plus, le détail replié ; un seul bouton plein par carte ;
// ambre = un geste, ROUGE = deux paires sous un N° seulement ; montants à l'encre.
// Tout texte par `tr()` (5 langues, src/i18n/langues/*/accueilReste.js).
import React from 'react';
import { createPortal } from 'react-dom';
import { tr } from '../i18n/index.js';
import { trj } from '../i18n/react.js';
import { OUTILS, useAides, useCle } from './deps.js';
import { aideActive, basculerAide, noterVisiteVue, oublierVisites, noterTrouveVu, fermerConseil, lireAides } from './aides.js';
import { propositionCartons, reponseCartons } from './cartonsNumeros.js';
import { lignesTrouve, carteTrouve, lireSansNumero, importPret } from './trouveChezToi.js';
import { conseilDuJour, jourLocal } from './conseilDuJour.js';
import { estMot, cleMot, cleDef, entreesGlossaire } from './glossaire.js';
import { bilanEssai, SECONDES_PAR } from './essaiBilan.js';
import { appelVisible, CLE_APPEL, lireAppel, ecritureAppel, lienReservation } from './appelBienvenue.js';
import { ONGLET_VERS_ECRAN, etapesVisite, visiteAuto, gesteUrgent, ECRANS_VISITE } from './visiteEcrans.js';
import { CLE_NUMERO_ECRIT } from '../numeroEcrit.js';
import VisiteBulles from '../VisiteBulles.jsx';
import { lireImportDepart } from '../importDepart.js';
import './accueil-reste.css';

const FEUILLES = '[aria-modal="true"], .vrm-visite, .vrm-bienvenue, .vrm-menu-voile, .vrm-garde-feuille, .vrm-conseil-bulle, [data-parcours], [data-configuration-ouverte]';
const feuilleOuverte = () => { try { return !!document.querySelector(FEUILLES); } catch (_) { return false; } };
const Chevron = () => <svg className="vrm-ar-chev" viewBox="0 0 8 14" aria-hidden="true"><path d="M1.5 1.5L6.5 7l-5 5.5" /></svg>;
const Croix = () => <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>;

// ── 139 · LE MOT QU'ON TOUCHE ───────────────────────────────────────────────
// Coupé (Paramètres → Aide) : le mot reste écrit, sans soulignement ni bulle.
export function Mot({ k, children }) {
  const [aides] = useAides();
  const [ouvert, setOuvert] = React.useState(null);   // { x, y, haut } · null
  const ref = React.useRef(null);
  const texte = children != null ? children : tr(cleMot(k));
  React.useEffect(() => {
    if (!ouvert) return undefined;
    const fermer = (e) => { if (e.type === 'keydown' && e.key !== 'Escape') return; if (e.type !== 'keydown' && ref.current && ref.current.contains(e.target)) return; setOuvert(null); };
    const t = setTimeout(() => { document.addEventListener('pointerdown', fermer, true); document.addEventListener('keydown', fermer, true); window.addEventListener('scroll', fermer, true); }, 0);
    return () => { clearTimeout(t); document.removeEventListener('pointerdown', fermer, true); document.removeEventListener('keydown', fermer, true); window.removeEventListener('scroll', fermer, true); };
  }, [ouvert]);
  if (!estMot(k) || !aideActive(aides, 'glossaire')) return <>{texte}</>;
  const ouvrir = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (ouvert) { setOuvert(null); return; }
    const r = e.currentTarget.getBoundingClientRect();
    const W = window.innerWidth, l = Math.min(300, W - 32);
    setOuvert({ x: Math.max(16, Math.min(W - l - 16, r.left + r.width / 2 - l / 2)), y: r.bottom + 8, haut: r.top, l, bas: r.bottom > window.innerHeight - 160 });
  };
  return (
    <>
      <button type="button" ref={ref} className="vrm-mot" data-glossaire={k} aria-expanded={ouvert ? 'true' : 'false'} aria-label={tr('glo.toucher', { mot: tr(cleMot(k)) })} onClick={ouvrir}>{texte}</button>
      {ouvert ? createPortal(
        <div className="vrm-mot-bulle" role="tooltip" data-glossaire-bulle={k} style={ouvert.bas ? { left: ouvert.x, bottom: window.innerHeight - ouvert.haut + 8, width: ouvert.l } : { left: ouvert.x, top: ouvert.y, width: ouvert.l }}>
          <b>{tr(cleMot(k))}</b><span>{tr(cleDef(k))}</span>
        </div>, document.body) : null}
    </>
  );
}

// La liste du « ? » : tous les mots, une phrase chacun (repli).
export function GlossaireListe({ groupe = false }) {
  const [aides] = useAides();
  if (!aideActive(aides, 'glossaire')) return null;
  const l = entreesGlossaire(tr);
  if (groupe) return <ul className="vrm-aide-groupe" data-aide-glossaire=""><li><GlossaireListe /></li></ul>;
  return (
    <details className="vrm-aide-q vrm-ar-glossaire" data-glossaire-liste={l.length}>
      <summary><span>{tr('glo.titre')}</span><Chevron /></summary>
      <dl>{l.map((e) => <div key={e.cle} data-glossaire-entree={e.cle}><dt>{e.mot}</dt><dd>{e.def}</dd></div>)}</dl>
    </details>
  );
}

// ── 136 · LA VISITE D'UN ÉCRAN ──────────────────────────────────────────────
// Montée une fois par la coque ; `tab` : l'écran ouvert. Elle part seule la première
// fois (règle `visiteAuto`), ou sur SON geste (`vrm:visite-ecran` { ecran }).
export function VisiteEcranHote({ tab, z = 20000, arrivee = false }) {
  const [aides, ecrire] = useAides();
  const [enCours, setEnCours] = React.useState(null);   // { ecran, etapes, cle }
  const ecran = ONGLET_VERS_ECRAN[tab] || null;
  React.useEffect(() => {
    if (!ecran || enCours) return undefined;
    const ctx = { creeLe: OUTILS.creeLe(), exemple: OUTILS.exemple(), arrivee };
    if (!visiteAuto(aides, ecran, ctx)) return undefined;
    // Laisser l'écran se poser (ses données, ses boutons), puis revérifier : aucune
    // feuille, aucun geste urgent, au moins un bouton présent.
    const t = setTimeout(() => {
      if (!visiteAuto(lireAides(OUTILS.load('vrm_aides_accueil', null)), ecran, { ...ctx, feuilleOuverte: feuilleOuverte(), urgent: gesteUrgent() })) return;
      setEnCours({ ecran, etapes: etapesVisite(ecran, tr), cle: Date.now() });
    }, 2200);
    return () => clearTimeout(t);
  }, [ecran, aides, enCours, arrivee]);
  React.useEffect(() => {
    const f = (e) => {
      const d = (e && e.detail) || {};
      const ec = ECRANS_VISITE.includes(d.ecran) ? d.ecran : ecran;
      if (!ec) return;
      setTimeout(() => { if (!feuilleOuverte()) setEnCours({ ecran: ec, etapes: etapesVisite(ec, tr), cle: Date.now() }); }, 450);
    };
    window.addEventListener('vrm:visite-ecran', f);
    return () => window.removeEventListener('vrm:visite-ecran', f);
  }, [ecran]);
  if (!enCours) return null;
  return <VisiteBulles key={enCours.cle} ecran={enCours.ecran} etapes={enCours.etapes} z={z}
    onTerminer={(raison) => { const ec = enCours.ecran; setEnCours(null); if (raison !== 'rien') ecrire((r) => noterVisiteVue(r, ec)); }} />;
}
// « Revoir la visite » (le « ? » d'un écran, Paramètres → Aide).
export const rejouerVisite = (ecran) => { try { window.dispatchEvent(new CustomEvent('vrm:visite-ecran', { detail: { ecran } })); } catch (_) {} };

// ── 134 · « J'AI DÉJÀ MES N° SUR MES CARTONS » ──────────────────────────────
function CarteCartons({ p, onRepondre, enCours }) {
  const [tout, setTout] = React.useState(false);
  const montres = tout ? p.lus : p.lus.slice(0, 5);
  return (
    <section className="vrm-ar-section" data-cartons="" data-cartons-a-adopter={p.aAdopter} data-cartons-doublons={p.doublons.length} aria-labelledby="vrm-ar-cartons-t">
      <h2 id="vrm-ar-cartons-t" className="vrm-ar-titre">{tr('cartons.titre')}</h2>
      <div className="vrm-ar-carte">
        <p className="vrm-ar-ligne1">{p.aAdopter ? tr('cartons.lus', { n: p.aAdopter }) : tr('cartons.lusAucun')}</p>
        {p.doublons.length ? (
          <ul className="vrm-ar-doublons" data-cartons-rouge="">
            {p.doublons.map((d) => <li key={d.cle} data-cartons-doublon={d.cle}><span className="vrm-ar-num is-double"><Mot k="numero" />{d.cle}</span><span>{tr('cartons.double', { n: d.ids.length })}</span></li>)}
          </ul>
        ) : null}
        {montres.length ? (
          <ul className="vrm-ar-liste" data-cartons-lus={p.lus.length}>
            {montres.map((l) => <li key={l.id} data-cartons-lu={l.id} data-cartons-num={l.cle}><span className="vrm-ar-num">{tr('glo.numero.mot')}{l.cle}</span><span className="vrm-ar-quoi">{l.titre}</span></li>)}
          </ul>
        ) : null}
        {p.lus.length > 5 && !tout ? <button type="button" className="vrm-b vrm-b-discret vrm-ar-plus" data-cartons-tout="" onClick={() => setTout(true)}>{tr('cartons.voirTout', { n: p.lus.length })}</button> : null}
        {p.archives.length || p.ambigus ? <p className="vrm-ar-note" data-cartons-ecartes="">{tr('cartons.ecartes', { n: p.archives.length + p.ambigus })}</p> : null}
        <p className="vrm-ar-note" data-cartons-attente="">{tr('cartons.attente')}</p>
        <div className="vrm-ar-gestes">
          <button type="button" className="vrm-b vrm-b-primaire" data-cartons-oui="" disabled={enCours} onClick={() => onRepondre(true)}>{tr('cartons.oui')}</button>
          <button type="button" className="vrm-b vrm-b-discret" data-cartons-non="" disabled={enCours} onClick={() => onRepondre(false)}>{tr('cartons.non')}</button>
        </div>
      </div>
    </section>
  );
}

// ── 133 · CE QUE VRM A TROUVÉ CHEZ TOI ──────────────────────────────────────
const MOT_LIGNE = { 'colis-retard': 'aexpedier', 'ventes-a-dater': 'versement', 'sans-numero': 'numero' };
function CarteTrouve({ r, mode, onAller, onNoter }) {
  return (
    <section className="vrm-ar-section" data-trouve={mode} data-trouve-total={r.total} data-trouve-partiel={r.partiel ? '1' : '0'} aria-labelledby="vrm-ar-trouve-t">
      <h2 id="vrm-ar-trouve-t" className="vrm-ar-titre">{tr('trouve.titre')}</h2>
      <div className="vrm-ar-carte vrm-ar-carte-liste">
        {mode === 'rien' ? <p className="vrm-ar-ligne1" data-trouve-rien="">{tr('trouve.rien')}</p> : (
          <ul className="vrm-ar-rangs">
            {r.lignes.map((l) => (
              <li key={l.cle} data-trouve-ligne={l.cle} data-trouve-n={Number.isInteger(l.n) ? String(l.n) : l.n === null ? 'pas-su' : 'attente'}>
                <span className={'vrm-ar-pastille' + (l.n > 0 ? ' is-geste' : '')} aria-hidden="true" />
                <span className="vrm-ar-rang-texte">
                  <b>{Number.isInteger(l.n) ? (l.n > 0 ? trj(`trouve.${l.cle}`, { n: l.n, mot: <Mot k={MOT_LIGNE[l.cle]} /> }) : trj(`trouve.${l.cle}.zero`, { mot: <Mot k={MOT_LIGNE[l.cle]} /> })) : '—'}</b>
                  {Number.isInteger(l.n) ? null : <small>{tr(`trouve.${l.cle}.nom`)} · {tr(l.n === null ? 'trouve.ancien' : 'trouve.pasCompte')}</small>}
                </span>
                {l.n > 0 ? <button type="button" className="vrm-b vrm-b-secondaire vrm-ar-geste" data-trouve-geste={l.geste.cle} onClick={() => onAller(l.geste)}>{tr(`trouve.geste.${l.geste.cle}`)}</button> : null}
              </li>
            ))}
          </ul>
        )}
        {r.partiel && mode !== 'rien' ? <p className="vrm-ar-note" data-trouve-au-moins="">{tr('trouve.auMoins')}</p> : null}
        <div className="vrm-ar-gestes"><button type="button" className="vrm-b vrm-b-discret" data-trouve-noter="" onClick={onNoter}>{tr('trouve.noter')}</button></div>
      </div>
    </section>
  );
}

// ── 145 · TON ESSAI · 147 · L'APPEL DE BIENVENUE ────────────────────────────
const fmtN = (n) => (Number.isInteger(n) ? String(n) : '—');
export function CarteEssai({ bilan, appel, compact = false }) {
  if (!bilan && !appel) return null;
  return (
    <section className="vrm-ar-section" data-essai={bilan ? 'oui' : 'non'} aria-labelledby="vrm-ar-essai-t">
      {bilan ? <h2 id="vrm-ar-essai-t" className="vrm-ar-titre">{tr('essai.titre')}</h2> : <h2 id="vrm-ar-essai-t" className="vrm-ar-titre">{tr('appel.titre')}</h2>}
      <div className="vrm-ar-carte">
        {bilan ? <>
          <div className="vrm-ar-tuiles" role="list">
            <div role="listitem" data-essai-colis={fmtN(bilan.colis)}><b>{fmtN(bilan.colis)}</b><span>{tr('essai.colis')}</span></div>
            <div role="listitem" data-essai-bordereaux={fmtN(bilan.bordereaux)}><b>{fmtN(bilan.bordereaux)}</b><span>{tr('essai.bordereaux')}</span></div>
            <div role="listitem" data-essai-minutes={bilan.minutes}><b>{tr('essai.minutesV', { n: bilan.minutes })}</b><span>{tr('essai.estime')}</span></div>
          </div>
          <p className="vrm-ar-ligne1" data-essai-restants={bilan.restants}>{bilan.restants > 0 ? tr('essai.restants', { n: bilan.restants }) : tr('essai.dernierJour')}{bilan.partiel ? ' · ' + tr('essai.auMoins') : ''}</p>
          {!compact ? (
            <details className="vrm-ar-repli" data-essai-regle="">
              <summary>{tr('essai.comment')}<Chevron /></summary>
              <p>{tr('essai.regle', { b: Math.round(SECONDES_PAR.bordereau), c: Math.round(SECONDES_PAR.colis) })}</p>
            </details>
          ) : null}
        </> : null}
        {appel ? (
          <a className="vrm-ar-appel" href={appel} target="_blank" rel="noopener noreferrer" data-appel-bienvenue="">
            <span className="vrm-ar-rang-texte"><b>{tr('appel.ligne')}</b><small>{tr('appel.sous')}</small></span>
            <span className="vrm-ar-appel-geste">{tr('appel.reserver')}</span>
          </a>
        ) : null}
      </div>
    </section>
  );
}
// Le bilan lu : l'abonnement (le serveur), les bordereaux imprimés (la ligne `main`),
// les colis suivis (les n° lus dans les e-mails, PROJETÉS — jamais `select=data`).
export function useEssai() {
  const imprimes = useCle('vinted_bords_printed', null);
  const [abo, setAbo] = React.useState(undefined);
  const [suivis, setSuivis] = React.useState(undefined);
  React.useEffect(() => {
    let vivant = true;
    Promise.resolve(OUTILS.lireAbonnement ? OUTILS.lireAbonnement() : null).then((a) => { if (vivant) setAbo(a || null); }).catch(() => { if (vivant) setAbo(null); });
    return () => { vivant = false; };
  }, []);
  React.useEffect(() => {
    if (!abo || abo.statut !== 'trialing' || !abo.finEssai) return undefined;
    let vivant = true;
    const debut = new Date(Date.parse(abo.finEssai) - 7 * 86400000).toISOString();
    Promise.resolve(OUTILS.lireTout(`id=like.email_track_*&meta->>receivedAt=gte.${encodeURIComponent(debut)}&select=suivi:meta->>suivi,at:meta->>receivedAt`))
      .then((l) => { if (vivant) setSuivis(Array.isArray(l) ? l : null); }).catch(() => { if (vivant) setSuivis(null); });
    return () => { vivant = false; };
  }, [abo]);
  const bilan = abo && suivis !== undefined ? bilanEssai({ abo, imprimes, suivis }) : null;
  return { bilan, appel: appelVisible(abo), abo };
}

// ── 140 · LE CONSEIL DU JOUR ────────────────────────────────────────────────
function ConseilJour({ c, onFermer }) {
  return (
    <div className="vrm-ar-conseil" data-conseil-jour={c.n} role="note">
      <span className="vrm-ar-conseil-tete">{tr('cj.tete', { n: c.jour, total: 30 })}</span>
      <p>{tr(c.cle)}</p>
      <div className="vrm-ar-conseil-gestes">
        {c.tab ? <button type="button" className="vrm-lien-action" data-conseil-voir={c.tab} onClick={() => OUTILS.aller(c.tab)}>{tr('cj.voir')}</button> : null}
      </div>
      <button type="button" className="vrm-ar-fermer" aria-label={tr('cj.fermer')} data-conseil-fermer="" onClick={onFermer}><Croix /></button>
    </div>
  );
}

// ── MA JOURNÉE : les cartes de l'accueil, EN BAS (sous tout geste à faire) ────
// `apercu` : l'aperçu des N° écrits (src/numeroEcrit.js, calculé par Annonces) ;
// `poolVide` : aucun N° donné ; `reprenable`, `porteurs` : les garde-fous de l'app ;
// `uid` : le compte VRM ; `comptes` : les comptes Vinted lus ; `dressingLu` : une liste
// d'annonces lue ; `onAller(geste)` : la navigation d'« À trancher » (tab, onglet, cible, vue).
export function AccueilResteJournee({ apercu, poolVide, reprenable, porteurs, uid, comptes, dressingLu, onAller, exemple = false }) {
  const [aides, ecrire] = useAides();
  const reglageEcrit = useCle(CLE_NUMERO_ECRIT, null);
  const colisAposter = useCle('vrm_colis_aposter', null);
  const urssafMois = useCle('vinted_urssaf_mois', null);
  const [, setTic] = React.useState(0);
  React.useEffect(() => { const f = () => setTic((t) => t + 1); window.addEventListener('vrm:save', f); return () => window.removeEventListener('vrm:save', f); }, []);
  const [imp, setImp] = React.useState(undefined);
  const uids = (Array.isArray(comptes) ? comptes : []).map((c) => String((c && c.vinted_user_id) || '')).filter(Boolean).join(',');
  React.useEffect(() => { let v = true; if (!uids) { setImp({}); return undefined; } lireImportDepart(uids.split(','), OUTILS.lireTout).then((x) => { if (v) setImp(x); }).catch(() => { if (v) setImp(null); }); return () => { v = false; }; }, [uids]);
  const [enCours, setEnCours] = React.useState(false);
  const { bilan, appel } = useEssai();
  const creeLe = OUTILS.creeLe();
  const p = propositionCartons({ apercu, reglage: reglageEcrit, poolVide, reprenable, porteurs, exemple });
  const r = lignesTrouve({ sansNumero: lireSansNumero(localStorage, uid), colisAposter, urssafMois, cartons: p.etat === 'question' });
  const modeTrouve = carteTrouve(r, { reglage: aides, creeLe, pret: imp !== undefined && importPret(imp, dressingLu), exemple });
  const c = conseilDuJour(aides, { creeLe, exemple });
  const repondre = (oui) => {
    setEnCours(true);
    try { OUTILS.save(CLE_NUMERO_ECRIT, reponseCartons(oui, new Date().toISOString(), OUTILS.load(CLE_NUMERO_ECRIT, null))); } catch (_) {}
    try { window.dispatchEvent(new Event('vrm-numero-ecrit')); window.dispatchEvent(new Event('vrm-cartons')); } catch (_) {}
    setTimeout(() => setEnCours(false), 600);
  };
  const aller = (g) => { if (g && g.cible && !g.tab) { try { const el = document.querySelector(g.cible); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (_) {} return; } if (onAller) onAller(g); };
  return (
    <div className="vrm-ar-journee" data-accueil-reste="">
      {p.etat === 'question' ? <CarteCartons p={p} onRepondre={repondre} enCours={enCours} /> : null}
      {modeTrouve === 'liste' || modeTrouve === 'rien' ? <CarteTrouve r={r} mode={modeTrouve} onAller={aller} onNoter={() => ecrire((x) => noterTrouveVu(x))} /> : null}
      {!exemple ? <CarteEssai bilan={bilan} appel={appel} /> : null}
      {c ? <ConseilJour c={c} onFermer={() => ecrire((x) => fermerConseil(x, jourLocal()))} /> : null}
    </div>
  );
}

// ── PARAMÈTRES → AIDE : les trois interrupteurs, « Revoir la visite », et (au
// propriétaire seul) le lien de réservation de l'appel de bienvenue ─────────────
export function ReglagesAidesAccueil({ proprietaire = false }) {
  const [aides, ecrire] = useAides();
  const r = lireAides(aides);
  const lienRange = useCle(CLE_APPEL, null);
  const [lien, setLien] = React.useState(() => lireAppel(lienRange));
  const [dit, setDit] = React.useState('');
  const { appel } = useEssai();
  const Interrupteur = ({ a }) => {
    const on = !r.off[a];
    return (
      <div className="vrm-ar-reglage" data-aide-reglage={a} data-on={on ? '1' : '0'}>
        <span className="vrm-ar-rang-texte"><b>{tr(`aides.${a}`)}</b><small>{tr(`aides.${a}.desc`)}</small></span>
        <button type="button" role="switch" aria-checked={on} className="vrm-ar-switch" data-aide-bascule={a} aria-label={tr(`aides.${a}`)} onClick={() => ecrire((x) => basculerAide(x, a, !on))}><span /></button>
      </div>
    );
  };
  const enregistrer = () => {
    const v = lien.trim();
    if (v && !lienReservation(v)) { setDit(tr('appel.invalide')); return; }
    try { OUTILS.save(CLE_APPEL, ecritureAppel(v)); setDit(v ? tr('appel.enregistre') : tr('appel.retire')); } catch (_) { setDit(tr('commun.pasPuEnregistrer')); }
  };
  return (
    <div className="vrm-ar-reglages" data-reglages-aides-accueil="">
      <Interrupteur a="visite" />
      <Interrupteur a="glossaire" />
      <Interrupteur a="conseil" />
      <div className="vrm-ar-reglage">
        <span className="vrm-ar-rang-texte"><b>{tr('aides.revoir')}</b><small>{tr('aides.revoir.desc')}</small></span>
        <button type="button" className="vrm-b vrm-b-secondaire" data-aide-revoir-visites="" onClick={() => { ecrire((x) => oublierVisites(x)); setDit(tr('aides.revoir.ok')); }}>{tr('aides.revoir.geste')}</button>
      </div>
      <GlossaireListe />
      {appel ? <CarteEssai bilan={null} appel={appel} /> : null}
      {proprietaire ? (
        <div className="vrm-ar-reglage vrm-ar-reglage-col" data-appel-reglage="">
          <label htmlFor="vrm-ar-appel-lien" className="vrm-ar-rang-texte"><b>{tr('appel.reglage')}</b><small>{tr('appel.reglage.desc')}</small></label>
          <div className="vrm-ar-champ">
            <input id="vrm-ar-appel-lien" type="url" inputMode="url" autoComplete="off" spellCheck={false} placeholder="https://" value={lien} onChange={(e) => { setLien(e.target.value); setDit(''); }} data-appel-champ="" />
            <button type="button" className="vrm-b vrm-b-secondaire" data-appel-enregistrer="" onClick={enregistrer}>{tr('appel.enregistrer')}</button>
          </div>
        </div>
      ) : null}
      {dit ? <p className="vrm-ar-note" role="status" data-aides-dit="">{dit}</p> : null}
    </div>
  );
}

// Le bouton « Revoir la visite » du « ? » d'un écran (seulement les 4 écrans visités).
export function RevoirVisite({ cle, onAvant }) {
  const [aides] = useAides();
  if (!ECRANS_VISITE.includes(cle) || lireAides(aides).off.visite) return null;
  return <button type="button" className="vrm-b vrm-b-secondaire vrm-ar-revoir" data-visite-revoir={cle} onClick={() => { if (onAvant) onAvant(); rejouerVisite(cle); }}>{tr('aides.revoirEcran')}</button>;
}
