// ═══════════════════════════════════════════════════════════════════════════
// « TOUT VA BIEN ? » ET L'ALERTE « COMPTE PAS RELU » (8 nov., extension 5.327)
// ═══════════════════════════════════════════════════════════════════════════
// Julien, après deux jours sans rien de son iPhone (Orion) : « ce problème ne
// doit plus jamais se produire ». Ici, la FORME seulement : la règle (pannes,
// versions, causes, gestes) est `api/_lib/garde-capture.js` — la même que le
// cron qui notifie (§11). La relecture d'un compte et son geste sans panne :
// `lignesFraicheur` (src/fraicheurComptes.js), celle de l'indicateur.
//   · `ToutVaBien` — Paramètres → « Tout va bien ? » : une rangée par compte
//     (Vinted, Leboncoin, Vestiaire, eBay) façon Réglages d'iOS, puis une par
//     appareil où l'extension tourne (version, « à jour » ou la version à
//     installer, le bon paquet, trois gestes). « Tout est à jour » ne se dit que
//     si TOUT a été lu et que rien n'attend un geste — jamais sur un « pas su ».
//   · `AlerteCapture` — la ligne ambre en haut de l'app tant qu'une panne dure
//     (fermable pour CETTE panne, sur cet appareil), qui mène à la page.
// Lectures : les lignes d'appareils (petites, projetées) d'abord ; les comptes
// seulement sur la page, ou quand un appareil actif porte une preuve.
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { GroupeIos, RangeeIos } from './composants/Ios.jsx';
import { lignesFraicheur, quandRelu } from './fraicheurComptes.js';
import { nomPlateforme } from './plateformes.js';
import { ageLecture } from './comptesLies.js';
import { SELECT_APPAREILS, PREFIXE_APPAREIL, ACTIF_MS, lireAppareils, pannesCapture, etatVersion, versionCourte, gestesMiseAJour, LIENS_PAQUET } from '../api/_lib/garde-capture.js';
import { SUPABASE_URL, sbAuth, lireTout, lireCapturesDetail, fetchVintedAccounts, useComptesAutresSites, EXT_ATTENDUE, load, DEMANDE_REGLAGE_SOUS } from './App.jsx';
import './styles-tout-va-bien.css';

const CLE_FERMEES = 'vrm_alerte_capture_fermees';

// La dernière version qui a écrit, n'importe où (les extensions d'avant la 5.327
// ne publient pas leur appareil) : `panel_diag_capture`. Trois états.
async function lireDerniereVersion() {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.panel_diag_capture&select=ver:data->>ver,code:data->>verCode,at:data->>majAt`, { headers: sbAuth(), cache: 'no-store' });
    if (!r.ok) return null;
    const rows = await r.json();
    if (!Array.isArray(rows)) return null;
    const d = rows[0] || {};
    return { ver: d.ver ? String(d.ver) : '', code: d.code ? String(d.code) : '', at: Date.parse(d.at || '') || 0 };
  } catch (_) { return null; }
}
async function lireEtatsVinted() {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.panel_comptes_etat&select=c:data->comptes`, { headers: sbAuth() });
    if (!r.ok) return null;
    const rows = await r.json();
    return Array.isArray(rows) ? ((rows[0] && rows[0].c && typeof rows[0].c === 'object') ? rows[0].c : {}) : null;
  } catch (_) { return null; }
}
// Un appareil actif qui porte une preuve (un refus courant, un compte vu) : seul
// cas où la ligne ambre a besoin de lire les comptes.
const aUnePreuve = (apps, maintenant) => (apps || []).some((a) => maintenant - a.at <= ACTIF_MS && Object.values(a.flux).some((f) => f && f.koAt && !(f.okAt > f.koAt))
  || Object.values(a.vus).some((m) => Object.keys(m || {}).length));

// L'état : undefined (on lit) · objet { appareils, comptes, lignes, pannes, ancien, passu[] }.
export function useEtatCapture({ complet = false, actif = true } = {}) {
  const [tour, setTour] = React.useState(0);
  const [base, setBase] = React.useState(undefined);
  const [lireComptes, setLireComptes] = React.useState(complet);
  const [autres] = useComptesAutresSites(actif && lireComptes);
  React.useEffect(() => {
    if (!actif) return undefined;
    let mort = false;
    setBase(undefined);
    (async () => {
      const maintenant = Date.now();
      const [rows, ancien] = await Promise.all([lireTout(`id=like.${PREFIXE_APPAREIL}*&select=${SELECT_APPAREILS}`), complet ? lireDerniereVersion() : Promise.resolve(undefined)]);
      const appareils = lireAppareils(rows, maintenant);
      const besoin = complet || aUnePreuve(appareils, maintenant);
      if (mort) return;
      if (!besoin) { setBase({ appareils, ancien, vinted: [], lu: true, at: Date.now() }); return; }
      setLireComptes(true);
      const [comptes, caps, etats] = await Promise.all([fetchVintedAccounts(), lireCapturesDetail(), lireEtatsVinted()]);
      if (mort) return;
      const masques = new Set((load('vinted_accounts_hidden', []) || []).map(String));
      const vinted = Array.isArray(comptes) && caps && etats ? comptes.map((a) => {
        const uid = String((a && a.vinted_user_id) || '');
        return uid ? { plateforme: 'vinted', id: uid, nom: a.login || '', lu: caps.by[uid] || null, banni: !!(etats[uid] && etats[uid].etat === 'banni'), masque: masques.has(uid),
          ventesLu: caps.ventes[uid] || null, annoncesLu: caps.annonces[uid] || null } : null;
      }).filter(Boolean) : null;
      // (9 nov.) La date des ACHATS de chaque compte, pour la ligne de fraîcheur (src/fraicheur.js) ; null = pas su.
      setBase({ appareils, ancien, vinted, achats: caps ? (caps.achats || {}) : null, lu: true, at: Date.now() });
    })();
    return () => { mort = true; };
  }, [tour, actif, complet]);
  const relire = React.useCallback(() => setTour((t) => t + 1), []);
  return React.useMemo(() => {
    if (base === undefined) return { etat: undefined, relire };
    const maintenant = Date.now();
    const autresPrets = lireComptes && autres && ['leboncoin', 'vestiaire', 'ebay'].every((p) => autres[p] !== undefined);
    const passu = [];
    if (base.appareils === null) passu.push('tes appareils');
    if (base.vinted === null) passu.push('Vinted');
    const tous = [...(base.vinted || [])];
    if (autresPrets) for (const p of ['leboncoin', 'vestiaire', 'ebay']) { if (autres[p] === null) passu.push(nomPlateforme(p)); else tous.push(...autres[p]); }
    const pannes = base.appareils ? (pannesCapture({ comptes: tous.map((c) => ({ ...c, ecarte: !!(c.masque || c.banni || c.delie || c.nonIdentifie) })), appareils: base.appareils, attendue: EXT_ATTENDUE, maintenant }) || []) : [];
    const lignes = lignesFraicheur(tous, { maintenant, dans: 'dans le navigateur où est l’extension VRM' });
    return { etat: { ...base, pannes, lignes, passu, comptesPrets: !lireComptes || (base.vinted !== undefined && (!complet || autresPrets)), maintenant }, relire };
  }, [base, autres, lireComptes, complet, relire]);
}

// ── La pastille d'état : neutre (rien à faire) · ambre (un geste) · creuse (pas su) ──
const Pastille = ({ ton }) => <span className="vrm-tvb-pastille" data-ton={ton} aria-hidden="true"/>;

function LigneCompte({ l, panne }) {
  const ton = panne || l.geste ? 'geste' : l.etat === 'banni' || l.bloque.startsWith('masqué') ? 'neutre' : 'ok';
  const valeur = panne ? 'Bloqué' : l.geste ? (l.etat === 'jamais' ? 'Jamais relu' : 'À relire') : l.etat === 'banni' ? 'Banni' : l.bloque.startsWith('masqué') ? 'Masqué' : 'À jour';
  const quand = l.etat === 'ouvert' ? 'ouvert dans ce navigateur' : l.age ? `relu ${l.age.replace(/^il y a /, 'il y a ')}` : 'jamais relu';
  const detail = panne
    ? <><span className="vrm-tvb-ligne">{quand}{panne.appareil ? ` · ${panne.appareil.nom}` : ''}</span><span className="vrm-tvb-ligne" data-tvb-cause="">{panne.refus ? `Dernier envoi refusé ${quandRelu(panne.refus.at)} — ${panne.cause}` : `Vu ${quandRelu(panne.vuAt)} — ${panne.cause}`}</span></>
    : <span className="vrm-tvb-ligne">{quand}{l.ventesRetard ? ` · ${l.ventesRetard.texte}` : ''}</span>;
  const geste = panne ? panne.geste : l.geste ? l.bloque : '';
  return (
    <div className="vrm-tvb-rangee" data-tvb-compte={`${l.plateforme}:${l.id}`} data-tvb-etat={panne ? 'panne' : l.geste ? 'geste' : 'ok'}>
      <Pastille ton={ton}/>
      <div className="vrm-tvb-texte">
        <span className="vrm-tvb-titre vrm-sensible">{l.nom}</span>
        <span className="vrm-tvb-detail">{detail}</span>
        {geste ? <span className="vrm-tvb-geste" data-tvb-geste="">{geste.charAt(0).toUpperCase() + geste.slice(1)}</span> : null}
      </div>
      <span className="vrm-tvb-valeur" data-ton={ton === 'geste' ? 'geste' : undefined}>{valeur}</span>
    </div>
  );
}

function LigneAppareil({ a, maintenant, ouvert, onOuvrir }) {
  const ev = etatVersion(a, EXT_ATTENDUE);
  const v = versionCourte(a.code || a.ver);
  const vu = maintenant - a.at < 120000 ? 'vu à l’instant' : `vu ${ageLecture(a.at, maintenant)}`;
  const refus = Object.entries(a.flux).map(([p, f]) => (f && f.koAt && !(f.okAt > f.koAt) && f.refus.length ? { p, r: f.refus[f.refus.length - 1] } : null)).filter(Boolean)[0];
  const secours = a.flux.vinted && a.flux.vinted.secours;
  const m = gestesMiseAJour(a, EXT_ATTENDUE);
  return (
    <div className="vrm-tvb-rangee vrm-tvb-appareil" data-tvb-appareil={a.paquet} data-tvb-version={ev}>
      <Pastille ton={ev === 'ancienne' ? 'geste' : ev === 'pas-su' ? 'passu' : 'ok'}/>
      <div className="vrm-tvb-texte">
        <span className="vrm-tvb-titre">{a.nom}</span>
        <span className="vrm-tvb-detail"><span className="vrm-tvb-ligne">Extension {v || '?'} · {vu}</span>
          {refus ? <span className="vrm-tvb-ligne" data-tvb-refus="">Dernier envoi {nomPlateforme(refus.p)} refusé {quandRelu(refus.r.at)}</span> : null}
          {secours ? <span className="vrm-tvb-ligne" data-tvb-secours={secours.etat}>{secours.etat === 'trop_lourd' ? 'vrm.center muet et liste trop lourde pour la voie directe : rien envoyé' : 'vrm.center muet : ventes envoyées par la voie directe'}</span> : null}
        </span>
        {ev === 'ancienne' && ouvert ? (
          <div className="vrm-tvb-maj" data-tvb-maj={a.paquet}>
            <ol>{m.gestes.map((g, i) => <li key={i}>{g}</li>)}</ol>
            {m.lien ? <a className="vrm-b vrm-b-primaire vrm-tvb-lien" href={m.lien} download data-tvb-lien={m.lien}>Télécharger {m.nomLien}</a> : null}
          </div>
        ) : null}
      </div>
      {ev === 'ancienne'
        ? <button type="button" className="vrm-tvb-valeur vrm-tvb-bouton" data-ton="geste" aria-expanded={ouvert ? 'true' : 'false'} onClick={onOuvrir}>{ouvert ? 'Fermer' : `Installer la ${versionCourte(EXT_ATTENDUE)}`}</button>
        : <span className="vrm-tvb-valeur">{ev === 'a-jour' ? 'À jour' : 'Version ?'}</span>}
    </div>
  );
}

export function ToutVaBien({ onComptes }) {
  const { etat, relire } = useEtatCapture({ complet: true });
  const [ouvert, setOuvert] = React.useState(null);
  if (etat === undefined || !etat.comptesPrets) return <div className="vrm-tvb" data-tout-va-bien="lecture"><div className="vrm-tvb-tete"><Pastille ton="passu"/><div><b className="vrm-tvb-resume">Je vérifie…</b></div></div></div>;
  const { appareils, pannes, lignes, passu, ancien, maintenant } = etat;
  const panneDe = new Map(pannes.map((p) => [`${p.plateforme}:${p.id}`, p]));
  const anciens = (appareils || []).filter((a) => etatVersion(a, EXT_ATTENDUE) === 'ancienne');
  // Une extension d'avant la 5.327 qui a écrit en dernier, sans dire son appareil.
  const ancienInconnu = ancien && ancien.ver && etatVersion({ ver: ancien.ver, code: ancien.code }, EXT_ATTENDUE) === 'ancienne'
    && !(appareils || []).some((a) => a.at >= ancien.at - 60000) ? ancien : null;
  const aFaire = lignes.filter((l) => l.geste || panneDe.has(`${l.plateforme}:${l.id}`)).length + anciens.length + (ancienInconnu ? 1 : 0);
  const sansAppareil = Array.isArray(appareils) && !appareils.length;
  const resume = aFaire ? (aFaire === 1 ? '1 chose à voir' : `${aFaire} choses à voir`)
    : passu.length ? 'Je n’ai pas pu tout vérifier'
    : !lignes.length ? 'Aucun compte relié'
    : sansAppareil ? 'Tes comptes sont à jour' : 'Tout est à jour';
  const sous = aFaire ? 'Le geste est écrit sous chaque ligne ambre.'
    : passu.length ? `Pas lu : ${passu.join(', ')}. Rien n’est affirmé pour eux.`
    : sansAppareil ? 'Aucune extension 5.327 ou plus récente n’a encore donné son appareil.' : `Vérifié ${quandRelu(maintenant)}.`;
  const ton = aFaire ? 'geste' : passu.length ? 'passu' : 'ok';
  const parSite = ['vinted', 'leboncoin', 'vestiaire', 'ebay'].map((p) => [p, lignes.filter((l) => l.plateforme === p)]).filter(([, l]) => l.length);
  return (
    <div className="vrm-tvb" data-tout-va-bien={ton} data-tvb-a-faire={aFaire}>
      <div className="vrm-tvb-tete">
        <Pastille ton={ton}/>
        <div className="vrm-tvb-tete-texte">
          <b className="vrm-tvb-resume" data-tvb-resume="">{resume}</b>
          <span className="vrm-tvb-sous">{sous}</span>
        </div>
        <button type="button" className="vrm-lien-action vrm-tvb-revoir" data-tvb-relire="" onClick={relire}>Revérifier</button>
      </div>
      {parSite.map(([p, l]) => (
        <GroupeIos key={p} titre={nomPlateforme(p)} data-tvb-site={p}>
          {l.map((x) => <LigneCompte key={x.id} l={x} panne={panneDe.get(`${x.plateforme}:${x.id}`)}/>)}
        </GroupeIos>
      ))}
      <GroupeIos titre="Où tourne l’extension" data-tvb-appareils={appareils ? appareils.length : 'pas-su'}
        pied={appareils === null ? 'Liste des appareils pas lue — touche « Revérifier ».' : sansAppareil ? `Chaque navigateur s’inscrit ici dès l’extension ${versionCourte(EXT_ATTENDUE)}.` : null}>
        {(appareils || []).map((a) => <LigneAppareil key={a.id} a={a} maintenant={maintenant} ouvert={ouvert === a.id} onOuvrir={() => setOuvert((o) => (o === a.id ? null : a.id))}/>)}
        {ancienInconnu ? (
          <div className="vrm-tvb-rangee" data-tvb-appareil="inconnu" data-tvb-version="ancienne">
            <Pastille ton="geste"/>
            <div className="vrm-tvb-texte">
              <span className="vrm-tvb-titre">Un navigateur pas encore inscrit</span>
              <span className="vrm-tvb-detail"><span className="vrm-tvb-ligne">Extension {versionCourte(ancien.code || ancien.ver)} · a écrit {ageLecture(ancien.at, maintenant) || 'il y a un moment'}</span></span>
              {ouvert === 'inconnu' ? (
                <div className="vrm-tvb-maj">
                  <p className="vrm-tvb-maj-titre">Sur un ordinateur</p><ol>{gestesMiseAJour({ paquet: 'chromium' }, EXT_ATTENDUE).gestes.map((g, i) => <li key={i}>{g}</li>)}</ol>
                  <p className="vrm-tvb-maj-titre">Sur l’iPhone, dans Orion</p><ol>{gestesMiseAJour({ paquet: 'orion' }, EXT_ATTENDUE).gestes.map((g, i) => <li key={i}>{g}</li>)}</ol>
                  <div className="vrm-tvb-liens"><a className="vrm-b vrm-b-primaire vrm-tvb-lien" href={LIENS_PAQUET.chromium} download>VRM-extension.zip</a><a className="vrm-b vrm-b-secondaire vrm-tvb-lien" href={LIENS_PAQUET.orion} download>VRM-Orion.xpi</a></div>
                </div>
              ) : null}
            </div>
            <button type="button" className="vrm-tvb-valeur vrm-tvb-bouton" data-ton="geste" aria-expanded={ouvert === 'inconnu' ? 'true' : 'false'} onClick={() => setOuvert((o) => (o === 'inconnu' ? null : 'inconnu'))}>{ouvert === 'inconnu' ? 'Fermer' : `Installer la ${versionCourte(EXT_ATTENDUE)}`}</button>
          </div>
        ) : null}
      </GroupeIos>
      {onComptes ? <div className="vrm-tvb-pied"><button type="button" className="vrm-lien-action" onClick={onComptes}>Gérer mes comptes liés</button></div> : null}
    </div>
  );
}

// ── LA LIGNE AMBRE ───────────────────────────────────────────────────────────
function lireFermees() { try { const v = JSON.parse(localStorage.getItem(CLE_FERMEES) || '[]'); return Array.isArray(v) ? v.map(String) : []; } catch (_) { return []; } }
export function AlerteCapture({ onVoir }) {
  const { etat } = useEtatCapture({ complet: false });
  const [fermees, setFermees] = React.useState(lireFermees);
  if (!etat || !etat.pannes) return null;
  const visibles = etat.pannes.filter((p) => !fermees.includes(p.cle));
  if (!visibles.length) return null;
  const p = visibles[0];
  const voir = () => {
    DEMANDE_REGLAGE_SOUS.id = 'toutvabien';
    try { window.dispatchEvent(new Event('vrm:reglage-sous')); } catch (_) {}
    if (onVoir) onVoir();
  };
  const fermer = () => { const n = [...new Set([...fermees, ...visibles.map((x) => x.cle)])].slice(-50); setFermees(n); try { localStorage.setItem(CLE_FERMEES, JSON.stringify(n)); } catch (_) {} };
  return (
    <div className="vrm-tvb-alerte" role="status" data-alerte-capture={visibles.length} data-alerte-cle={p.cle}>
      <Pastille ton="geste"/>
      <div className="vrm-tvb-alerte-texte">
        <b><span className="vrm-sensible">{p.nom}</span> ({nomPlateforme(p.plateforme)}) n’arrive plus dans VRM{visibles.length > 1 ? ` · et ${visibles.length - 1} autre${visibles.length > 2 ? 's' : ''}` : ''}</b>
        <span>Pas relu depuis {String(p.age || 'plus de 12 h').replace(/^il y a /, '')} — {p.refus ? `${p.cause.split(' · ')[0]}` : p.cause}{p.appareil ? ` (${p.appareil.nom})` : ''}.</span>
        <span className="vrm-tvb-alerte-geste">{p.geste.charAt(0).toUpperCase() + p.geste.slice(1)}.</span>
      </div>
      <div className="vrm-tvb-alerte-gestes">
        <button type="button" className="vrm-lien-action" data-alerte-voir="" onClick={voir}>Voir</button>
        <button type="button" className="vrm-tvb-fermer" aria-label="Masquer cette alerte" data-alerte-fermer="" onClick={fermer}>×</button>
      </div>
    </div>
  );
}
export default AlerteCapture;
