// ════════════════════════════════════════════════════════════════════════════
//  FIABILITÉ AUTOMATIQUE — LES MORCEAUX D'ÉCRAN (15 nov., lot fiabilite-auto)
// ════════════════════════════════════════════════════════════════════════════
// De PETITS composants posés dans Paramètres → « Tout va bien ? » (src/ToutVaBien.jsx,
// une ligne chacun) — jamais une carte de plus dans Ma journée (Julien : « Ma journée
// encombrée de cases au hasard ») ; Ma journée ne lit que `usePointsToutVaBien()` pour sa
// ligne discrète « Tout va bien ? · N points » (chantier `refonte-journee`).
//   · `AlerteExtensionIci` — « Ce Chrome a la 5.329 : installe la 5.385 », le paquet et,
//      si la fiche est publiée, la boutique ;
//   · `ControleNuitLignes` — le contrôle de cette nuit : chaque écart, son geste ;
//   · `LigneSanteComptes`  — « Santé de chaque compte › » ⇒ `FeuilleSanteComptes` : un
//      compte par carte, un état en mots, un geste ;
//   · `RapportPlantages`   — au PROPRIÉTAIRE (la route le revérifie, 403 sinon) : les
//      plantages des autres vendeurs, agrégés et anonymes.
// Les règles : src/fiabilite/regles.js. Les mots : `tr('fiab.…')`, 5 langues.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { createPortal } from 'react-dom';
import { retardIci, santeDesComptes, pointsToutVaBien, comptesEnVerification } from './regles.js';
import { etatControle, CONTROLES } from '../controleNuit.js';
import { lireControleNuit, lireControleInstallation } from '../veilleLigne.js';
import { nomPlateforme } from '../plateformes.js';
import { lireLignesActions } from '../JaugeActions.jsx';
import { CLE_DISCRETION, reglageDiscretion } from '../discretion.js';
import { installerExtensionIci, nomNavigateurIci, navigateurIci } from '../navigateurExtension.js';
import { EXT_ATTENDUE, vmrExtPresent, vmrExtVersion, onVmrExt, load, FermeAuRetour, enTeteSession } from '../App.jsx';
import { tr, dateRelative, localeCourante } from '../i18n/index.js';
import { useLangue } from '../i18n/react.js';
import './fiabilite.css';

const aller = (u) => { try { window.dispatchEvent(new CustomEvent('vrm:aller', { detail: String(u || '').replace(/^\//, '') })); } catch (_) {} };
export function ilYa(t, maintenant = Date.now()) {
  if (!Number.isFinite(t)) return '';
  const m = Math.max(0, Math.round((maintenant - t) / 60000));
  if (m < 60) return dateRelative(-Math.max(1, m), 'minute');
  const h = Math.round(m / 60);
  return h < 48 ? dateRelative(-h, 'hour') : dateRelative(-Math.round(h / 24), 'day');
}
const heureParis = (t) => { try { return new Intl.DateTimeFormat(localeCourante(), { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).format(new Date(t)); } catch (_) { return ''; } };
const Pastille = ({ ton }) => <span className="vrm-fia-pastille" data-ton={ton} aria-hidden="true"/>;

// ── L'EXTENSION DE CE NAVIGATEUR ──────────────────────────────────────────────
export function useRetardIci() {
  const [ext, setExt] = React.useState(() => ({ on: vmrExtPresent(), v: vmrExtVersion() }));
  React.useEffect(() => onVmrExt(() => setExt({ on: vmrExtPresent(), v: vmrExtVersion() })), []);
  return React.useMemo(() => {
    let nav = '', nomNav = '', inst = null;
    try { nav = navigateurIci(); nomNav = nomNavigateurIci(); inst = installerExtensionIci(); } catch (_) {}
    return retardIci({ on: ext.on, v: ext.v, attendue: EXT_ATTENDUE, nav, nomNav, inst });
  }, [ext.on, ext.v]);
}
// La phrase, une fois (la ligne de fraîcheur et « Tout va bien ? » la disent pareil).
export function phraseRetardIci(r) {
  if (!r) return '';
  const k = r.version ? (r.nomNav ? 'fiab.ext.ici' : 'fiab.ext.iciSansNom') : (r.nomNav ? 'fiab.ext.iciMuette' : 'fiab.ext.iciMuetteSansNom');
  return tr(k, { nav: r.nomNav, v: r.version, attendue: r.attendue });
}
export function AlerteExtensionIci({ r: rDonne }) {
  useLangue();
  const rIci = useRetardIci();
  const r = rDonne === undefined ? rIci : rDonne;
  if (!r) return null;
  return (
    <div className="vrm-fia-carte vrm-fia-ext" role="status" data-fia-ext-ici={r.version || 'muette'} data-fia-ext-attendue={r.attendue}>
      <Pastille ton="geste"/>
      <div className="vrm-fia-texte">
        <b className="vrm-fia-titre">{phraseRetardIci(r)}</b>
        {r.boutique ? null : <span className="vrm-fia-detail">{tr('fiab.ext.gestes')}</span>}
        <span className="vrm-fia-gestes">
          {r.boutique ? <a className="sb-touche vrm-fia-bouton" href={r.boutique} target="_blank" rel="noreferrer" data-fia-ext-boutique="">{tr('fiab.ext.boutique', { boutique: r.nomBoutique })}</a> : null}
          <a className={(r.boutique ? 'sb-lien' : 'sb-touche') + ' vrm-fia-bouton'} href={r.lien} download data-fia-ext-lien={r.lien}>{tr('fiab.ext.telecharger', { fichier: r.nomLien })}</a>
        </span>
      </div>
    </div>
  );
}

// ── LE CONTRÔLE DE CETTE NUIT ────────────────────────────────────────────────
// Lecture partagée (une requête en vol) : « Tout va bien ? » et la ligne de Ma journée.
let memoCtl = null, promesseCtl = null;
const abonnesCtl = new Set();
function lireControles(force = false) {
  if (!force && memoCtl && Date.now() - memoCtl.at < 60000) return Promise.resolve(memoCtl);
  if (promesseCtl) return promesseCtl;
  promesseCtl = Promise.all([lireControleNuit(force), lireControleInstallation(force)]).then(([v, i]) => {
    memoCtl = { vendeur: v, installation: i, at: Date.now() }; promesseCtl = null;
    abonnesCtl.forEach((f) => { try { f(); } catch (_) {} });
    return memoCtl;
  }, () => { promesseCtl = null; return { vendeur: null, installation: null, at: Date.now() }; });
  return promesseCtl;
}
export function useControleNuit() {
  const [, tic] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => { abonnesCtl.add(tic); lireControles(); return () => { abonnesCtl.delete(tic); }; }, []);
  return memoCtl ? { vendeur: memoCtl.vendeur, installation: memoCtl.installation } : { vendeur: undefined, installation: undefined };
}
export function ControleNuitLignes({ vendeur: vDonne, installation: iDonne, maintenant = Date.now() }) {
  useLangue();
  const lu = useControleNuit();
  const vendeur = vDonne === undefined ? lu.vendeur : vDonne;
  const installation = iDonne === undefined ? lu.installation : iDonne;
  const ctl = etatControle(vendeur, installation === undefined ? null : installation, maintenant);
  if (ctl.etat === 'lecture' || ctl.etat === 'absent' || ctl.etat === 'vieux') return null;
  const p = pointsToutVaBien({ controle: vendeur, installation, maintenant });
  const lignes = p.points.filter((x) => x.source === 'controle');
  const passu = ctl.passu;
  const nom = (cle) => { const C = CONTROLES.find((c) => c.cle === cle); return C ? C.nom : cle; };
  return (
    <section className="vrm-fia-groupe" data-fia-controle={lignes.length ? 'probleme' : passu.length ? 'passu' : 'ok'} data-fia-controle-n={lignes.length}>
      <h3 className="vrm-fia-groupe-titre">{tr('fiab.ctl.titre')}</h3>
      <div className="vrm-fia-carte vrm-fia-liste">
        {!lignes.length && !passu.length ? (
          <div className="vrm-fia-rangee" data-fia-controle-ok=""><Pastille ton="ok"/><span className="vrm-fia-titre">{tr('fiab.ctl.ok')}</span></div>
        ) : null}
        {lignes.map((l) => {
          const C = CONTROLES.find((c) => c.cle === l.controle);
          const nums = l.controle === 'numeros-double' || l.controle === 'pool-retreci' ? l.ids.filter((x) => !/^moins-/.test(x)).slice(0, 4) : [];
          return (
            <div key={l.cle} className="vrm-fia-rangee" data-fia-controle-ligne={l.controle} data-ton={l.ton}>
              <Pastille ton={l.ton}/>
              <div className="vrm-fia-texte">
                <b className="vrm-fia-titre">{tr(`fiab.ctl.l.${l.controle}`, { n: l.n })}{nums.length ? <span className="vrm-fia-nums"> · N°{nums.join(', N°')}</span> : null}</b>
                <span className="vrm-fia-detail">{tr(`fiab.ctl.d.${l.controle}`)}</span>
              </div>
              {C && C.geste ? <button type="button" className="sb-touche vrm-fia-bouton" data-fia-controle-geste={l.controle} onClick={() => aller(C.geste.aller)}>{tr(`fiab.ctl.g.${l.controle}`)}</button> : null}
            </div>
          );
        })}
        {passu.length ? <p className="vrm-fia-passu" data-fia-controle-passu={passu.length}>{tr('fiab.ctl.passu', { x: passu.map((x) => nom(x.cle).toLowerCase()).join(', ') })}</p> : null}
      </div>
    </section>
  );
}

// ── LA SANTÉ DE CHAQUE COMPTE ────────────────────────────────────────────────
function useActions(actif) {
  const [rows, setRows] = React.useState(undefined);
  React.useEffect(() => {
    if (!actif) return undefined;
    let mort = false;
    lireLignesActions('').then((r) => { if (!mort) setRows(r == null ? null : r); }, () => { if (!mort) setRows(null); });
    return () => { mort = true; };
  }, [actif]);
  return rows;
}
const reprises = () => { try { return reglageDiscretion(load(CLE_DISCRETION, null)).reprises || {}; } catch (_) { return {}; } };
export function cartesDeCapture(etat, actions, maintenant = Date.now()) {
  if (!etat) return null;
  return santeDesComptes({ lignes: etat.lignes, comptes: etat.vinted || [], appareils: etat.appareils || [], pannes: etat.pannes || [], actions: actions === undefined ? null : actions, reprises: reprises(), attendue: EXT_ATTENDUE, maintenant });
}
function texteGeste(c) {
  const site = nomPlateforme(c.plateforme);
  switch (c.etat) {
    case 'arret': return tr(`fiab.sante.g.${c.arret ? c.arret.quoi : 'captcha'}`);
    case 'panne': return tr('fiab.sante.g.panne', { site });
    case 'delie': return tr('fiab.sante.g.delie');
    case 'jamais': case 'a-relire': return tr('fiab.sante.g.relire', { site });
    case 'ventes': return tr('fiab.sante.g.ventes');
    case 'prudence': return tr('fiab.sante.g.prudence');
    case 'banni': return tr('fiab.sante.g.banni');
    case 'masque': return tr('fiab.sante.g.masque');
    default: return '';
  }
}
export function CarteSante({ c, maintenant = Date.now() }) {
  const ton = c.ton === 'geste' ? 'geste' : c.ton === 'ok' ? 'ok' : 'neutre';
  const geste = c.etat === 'extension' ? tr('fiab.sante.g.extension', { v: EXT_ATTENDUE.replace(/\.0$/, ''), appareil: c.appareil ? c.appareil.nom : '' }) : texteGeste(c);
  return (
    <article className="vrm-fia-carte vrm-fia-compte" data-fia-sante={`${c.plateforme}:${c.id}`} data-fia-sante-etat={c.etat} data-ton={ton}>
      <header className="vrm-fia-compte-tete">
        <Pastille ton={ton}/>
        <span className="vrm-fia-compte-nom"><b className="vrm-sensible">{c.nom}</b><span className="vrm-fia-site">{nomPlateforme(c.plateforme)}</span></span>
        <span className="vrm-fia-etat" data-ton={ton}>{tr(`fiab.sante.e.${c.etat}`)}</span>
      </header>
      <ul className="vrm-fia-faits">
        <li data-fia-sante-lu={c.lu || ''}>{c.lu ? tr('fiab.sante.lu', { quand: ilYa(c.lu, maintenant) }) : tr('fiab.sante.jamais')}</li>
        <li data-fia-sante-appareil={c.appareil ? c.appareil.version : ''}>{c.appareil ? tr('fiab.sante.lecteur', { appareil: c.appareil.nom, v: c.appareil.version || '?' }) : tr('fiab.sante.lecteurInconnu')}</li>
        {c.prudence ? <li data-fia-sante-prudence="">{tr('fiab.sante.prudence', { heure: heureParis(c.prudence) })}</li> : null}
        {c.panne && c.panne.cause ? <li className="vrm-fia-cause">{c.panne.cause}</li> : null}
      </ul>
      {geste ? <p className="vrm-fia-geste" data-fia-sante-geste="">{geste}</p> : null}
    </article>
  );
}
export function FeuilleSanteComptes({ cartes, passu = [], onFermer, maintenant = Date.now() }) {
  useLangue();
  if (typeof document === 'undefined') return null;
  const n = (cartes || []).filter((c) => c.ton === 'geste').length;
  return createPortal(
    <div className="vrm-fia-voile" data-fia-feuille="sante" onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }}>
      {FermeAuRetour ? <FermeAuRetour fermer={onFermer}/> : null}
      <div className="vrm-fia-feuille" role="dialog" aria-modal="true" aria-label={tr('fiab.sante.titre')}>
        <header className="vrm-fia-feuille-tete">
          <h2>{tr('fiab.sante.titre')}</h2>
          <button type="button" className="sb-rond vrm-fia-x" aria-label={tr('commun.fermer')} data-fia-fermer="" onClick={onFermer}>×</button>
        </header>
        <p className="vrm-fia-resume" data-fia-sante-n={n}>{cartes === null ? tr('fiab.sante.lecture') : !cartes.length ? tr('fiab.sante.aucun') : n ? tr('fiab.sante.resume', { n }) : tr('fiab.sante.toutBon')}</p>
        {passu.length ? <p className="vrm-fia-passu" data-fia-sante-passu="">{tr('fiab.sante.passu', { x: passu.join(', ') })}</p> : null}
        <div className="vrm-fia-cartes">{(cartes || []).map((c) => <CarteSante key={`${c.plateforme}:${c.id}`} c={c} maintenant={maintenant}/>)}</div>
      </div>
    </div>,
    document.body,
  );
}
// La rangée de « Tout va bien ? » qui ouvre la feuille. `etat` : `useEtatCapture({ complet: true })`.
export function LigneSanteComptes({ etat }) {
  useLangue();
  const [ouvert, setOuvert] = React.useState(false);
  const actions = useActions(!!etat);
  const maintenant = etat && etat.maintenant ? etat.maintenant : Date.now();
  const cartes = etat ? cartesDeCapture(etat, actions, maintenant) : null;
  if (!cartes || !cartes.length) return null;
  const n = cartes.filter((c) => c.ton === 'geste').length;
  return (
    <>
      <button type="button" className="vrm-fia-carte vrm-fia-rangee vrm-fia-ouvrir" data-fia-sante-ouvrir={n} aria-haspopup="dialog" onClick={() => setOuvert(true)}>
        <Pastille ton={n ? 'geste' : 'ok'}/>
        <span className="vrm-fia-texte"><b className="vrm-fia-titre">{tr('fiab.sante.ouvrir')}</b><span className="vrm-fia-detail">{n ? tr('fiab.sante.resume', { n }) : tr('fiab.sante.toutBon')}</span></span>
        <span className="vrm-fia-chevron" aria-hidden="true">›</span>
      </button>
      {ouvert ? <FeuilleSanteComptes cartes={cartes} passu={etat.passu || []} onFermer={() => setOuvert(false)} maintenant={maintenant}/> : null}
    </>
  );
}

// ── « TOUT VA BIEN ? · N POINTS » POUR MA JOURNÉE ────────────────────────────
// Léger : le contrôle de nuit (une ligne), l'extension d'ici (rien à lire), les arrêts
// des comptes (les lignes `actions_compte_*`, déjà partagées par la jauge).
export function usePointsToutVaBien() {
  const ctl = useControleNuit();
  const ici = useRetardIci();
  return React.useMemo(() => pointsToutVaBien({ controle: ctl.vendeur, installation: ctl.installation, ici }), [ctl.vendeur, ctl.installation, ici]);
}
// (27 nov., lot scan-ce-matin) « Ce matin » : combien de SES comptes Vinted attendent une vérification (la règle de la carte de
// santé, `arretDeJauge`). `uids` : les comptes retenus. undefined = on lit · null = pas su · nombre.
export function useComptesEnVerification(uids, actif = true) {
  const [rows, setRows] = React.useState(undefined);
  React.useEffect(() => {
    if (!actif) return undefined;
    let mort = false;
    const lire = () => lireLignesActions('').then((r) => { if (!mort) setRows(Array.isArray(r) ? r : null); }, () => { if (!mort) setRows(null); });
    lire();
    const m = setInterval(lire, 5 * 60000);
    return () => { mort = true; clearInterval(m); };
  }, [actif]);
  const cle = (Array.isArray(uids) ? uids : []).join(',');
  return React.useMemo(() => (rows === undefined ? undefined : comptesEnVerification({ actions: rows, uids, reprises: reprises() })), [rows, cle]);   // eslint-disable-line react-hooks/exhaustive-deps
}
export const textePoints = (p) => (p && p.n ? tr('fiab.points', { n: p.n }) : '');

// ── LE RAPPORT DE PLANTAGES (propriétaire) ───────────────────────────────────
export function RapportPlantages({ entetes = enTeteSession, fetcher = (typeof fetch === 'function' ? fetch : null) }) {
  useLangue();
  const [r, setR] = React.useState(undefined);
  React.useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const rep = await fetcher('/api/compte?mode=mesures&quoi=rapport-plantages', { headers: entetes ? entetes() : {} });
        const j = await rep.json().catch(() => null);
        if (vivant) setR(rep.ok && j && j.ok === true ? j : null);
      } catch (_) { if (vivant) setR(null); }
    })();
    return () => { vivant = false; };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const tete = <><h3 className="vrm-fia-groupe-titre">{tr('fiab.pl.titre')}</h3><p className="vrm-fia-sous">{tr('fiab.pl.sous', { n: (r && r.seuil) || 3 })}</p></>;
  if (r === undefined) return <section className="vrm-fia-groupe" data-fia-plantages="lecture">{tete}<p className="vrm-fia-passu">{tr('fiab.pl.lecture')}</p></section>;
  if (r === null) return <section className="vrm-fia-groupe" data-fia-plantages="pas-su">{tete}<p className="vrm-fia-passu">{tr('fiab.pl.passu')}</p></section>;
  const types = Array.isArray(r.types) ? r.types : null;
  const m = r.morceaux;
  return (
    <section className="vrm-fia-groupe" data-fia-plantages={types ? types.length : 'pas-su'}>
      {tete}
      <div className="vrm-fia-carte vrm-fia-liste">
        {types === null ? <p className="vrm-fia-passu">{tr('fiab.pl.passu')}</p> : !types.length ? <p className="vrm-fia-passu" data-fia-plantages-aucun="">{tr('fiab.pl.aucun')}</p> : types.map((t) => (
          <div key={t.cle} className="vrm-fia-rangee vrm-fia-plantage" data-fia-plantage={t.cle} data-fia-plantage-personnes={t.personnes} data-fia-plantage-bloque={t.bloque || 0} data-ton={t.aDire ? 'geste' : 'neutre'}>
            <Pastille ton={t.aDire ? 'geste' : 'neutre'}/>
            <div className="vrm-fia-texte">
              <b className="vrm-fia-titre">{t.ecrans.length ? t.ecrans.join(', ') : tr('fiab.pl.app')}</b>
              <code className="vrm-fia-message">{t.message}</code>
              <span className="vrm-fia-detail">{[tr('fiab.pl.fois', { n: t.fois }), t.bloque ? tr('fiab.pl.bloque') : '', t.versions && t.versions.length ? tr('fiab.pl.version', { v: t.versions[0] }) : '', (t.appareils || []).join(', '), t.aDire ? tr('fiab.pl.aDire') : ''].filter(Boolean).join(' · ')}</span>
            </div>
            <span className="vrm-fia-valeur">{tr('fiab.pl.personnes', { n: t.personnes })}</span>
          </div>
        ))}
        <p className="vrm-fia-passu" data-fia-morceaux={m ? m.n : 'pas-su'}>{!m ? tr('fiab.pl.morceauxPassu') : m.n ? tr('fiab.pl.morceaux', { n: m.n }) : tr('fiab.pl.morceaux0')}</p>
      </div>
    </section>
  );
}

// ── CE QUE « TOUT VA BIEN ? » POSE, EN UNE LIGNE ─────────────────────────────
export function FiabiliteToutVaBien({ etat }) {
  return (
    <div className="vrm-fia" data-fiabilite="">
      <AlerteExtensionIci/>
      <ControleNuitLignes/>
      <LigneSanteComptes etat={etat}/>
    </div>
  );
}
export default FiabiliteToutVaBien;
