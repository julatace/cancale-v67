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
//   · la panne d'un compte est dite en haut de l'app par la ligne de fraîcheur
//     unique (src/LigneFraicheur.jsx), qui mène à la page.
// Lectures : les lignes d'appareils (petites, projetées) d'abord ; les comptes
// seulement sur la page, ou quand un appareil actif porte une preuve.
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { GroupeIos, RangeeIos } from './composants/Ios.jsx';
import { lignesFraicheur, quandRelu } from './fraicheurComptes.js';
import { nomPlateforme } from './plateformes.js';
import { ageLecture } from './comptesLies.js';
import { SELECT_APPAREILS, PREFIXE_APPAREIL, ACTIF_MS, lireAppareils, pannesCapture, etatVersion, versionCourte, gestesMiseAJour, LIENS_PAQUET } from '../api/_lib/garde-capture.js';
import { SUPABASE_URL, sbAuth, lireTout, lireCapturesDetail, fetchVintedAccounts, useComptesAutresSites, EXT_ATTENDUE, load, DEMANDE_REGLAGE_SOUS, useEstProprietaire, enTeteSession, faitsExtensionApp, brancherExtensionApp, ouvrirPageExtension, useSansSouris, useExtVivante } from './App.jsx';
import { lireEtatsComptes } from './etatsComptesLecture.js';
import { AlertesProduction } from './composants/AlertesProduction.jsx';
import { aVoirCapture } from './santeDonnees.js';
import { LigneSante, useSanteDonnees } from './SanteDonnees.jsx';
import { useAlertesForme, LignesForme } from './AlerteFormeVinted.jsx';   // (11 nov., ext. 5.357) Vinted a changé une page
import { BoutonRapportExtension, RapportsExtensionProprio } from './RapportExtension.jsx';   // (12 nov., ext. 5.371)
import './styles-tout-va-bien.css';
// (15 nov., lot fiabilite-auto) L'extension de CE navigateur, le contrôle de cette nuit, la santé de
// chaque compte (une feuille), le rapport de plantages du propriétaire (src/fiabilite/Fiabilite.jsx).
import { FiabiliteToutVaBien, RapportPlantages, usePointsToutVaBien } from './fiabilite/Fiabilite.jsx';
import { LIENS_BOUTIQUES } from './navigateursServis.js';
import { tr } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import { Groupe, Rangee } from './natif/index.js';
import { pointsEcran, gestePoint } from './toutVaBienPoints.js';   // (20 nov.) les points, dans l'ordre d'importance
import { etatNavigateur } from './extension/peutFaire.js';
import { CONTROLES } from './controleNuit.js';
import { installerExtensionIci } from './navigateurExtension.js';

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
// (11 nov., intégration) La lecture partagée avec « Santé des comptes » (une seule requête en vol).
const lireEtatsVinted = () => lireEtatsComptes();
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
        <span className="vrm-tvb-detail"><span className="vrm-tvb-ligne" data-tvb-version-phrase={ev === 'ancienne' ? '' : undefined}>{ev === 'ancienne' ? `${tr('fiab.ext.appareil', { nav: a.nom, v: v || '?', attendue: versionCourte(EXT_ATTENDUE) })} · ${vu}` : `Extension ${v || '?'} · ${vu}`}</span>
          {refus ? <span className="vrm-tvb-ligne" data-tvb-refus="">Dernier envoi {nomPlateforme(refus.p)} refusé {quandRelu(refus.r.at)}</span> : null}
          {secours ? <span className="vrm-tvb-ligne" data-tvb-secours={secours.etat}>{secours.etat === 'trop_lourd' ? 'vrm.center muet et liste trop lourde pour la voie directe : rien envoyé' : 'vrm.center muet : ventes envoyées par la voie directe'}</span> : null}
        </span>
        {ev === 'ancienne' && ouvert ? (
          <div className="vrm-tvb-maj" data-tvb-maj={a.paquet}>
            <ol>{m.gestes.map((g, i) => <li key={i}>{g}</li>)}</ol>
            {m.lien ? <a className="vrm-b vrm-b-primaire vrm-tvb-lien" href={m.lien} download data-tvb-lien={m.lien}>Télécharger {m.nomLien}</a> : null}
            {/* (15 nov.) La fiche du Chrome Web Store, SEULEMENT si elle est publiée (`LIENS_BOUTIQUES`). */}
            {a.paquet !== 'orion' && a.paquet !== 'firefox' && LIENS_BOUTIQUES.chrome ? <a className="vrm-b vrm-b-secondaire vrm-tvb-lien" href={LIENS_BOUTIQUES.chrome} target="_blank" rel="noreferrer" data-tvb-boutique="chrome">{tr('fiab.ext.boutique', { boutique: 'Chrome Web Store' })}</a> : null}
          </div>
        ) : null}
      </div>
      {ev === 'ancienne'
        ? <button type="button" className="vrm-tvb-valeur vrm-tvb-bouton" data-ton="geste" aria-expanded={ouvert ? 'true' : 'false'} onClick={onOuvrir}>{ouvert ? 'Fermer' : `Installer la ${versionCourte(EXT_ATTENDUE)}`}</button>
        : <span className="vrm-tvb-valeur">{ev === 'a-jour' ? 'À jour' : 'Version ?'}</span>}
    </div>
  );
}

// (20 nov., Julien : « Tout va bien ? qui dit exactement quoi faire ») LA PAGE : en haut, l'état en une rangée ;
// puis « À régler » — chaque point une rangée (ce qui ne va pas, et LE geste qui le règle, la rangée entière se
// touche), dans l'ordre d'importance (src/toutVaBienPoints.js) ; puis « Détails » : tout le technique d'avant
// (comptes un par un, appareils, contrôle de nuit, rapports), replié.
const LIENS_SITE_TVB = { vinted: 'https://www.vinted.fr', leboncoin: 'https://www.leboncoin.fr/compte/part/mes-annonces', vestiaire: 'https://www.vestiairecollective.com/' };
const allerTvb = (u) => { try { window.dispatchEvent(new CustomEvent('vrm:aller', { detail: String(u || '').replace(/^\//, '') })); } catch (_) {} };
const allerControleTvb = (cle) => { const C = CONTROLES.find((c) => c.cle === cle); return C && C.geste ? C.geste.aller : ''; };
function textesPoint(pt) {
  const site = pt.plateforme ? nomPlateforme(pt.plateforme) : '';
  if (pt.type === 'controle') return { titre: tr(`fiab.ctl.l.${pt.controle}`, { n: pt.n }), sous: tr(`fiab.ctl.d.${pt.controle}`), geste: tr(`fiab.ctl.g.${pt.controle}`) };
  if (pt.type === 'extension') return { titre: tr('tvb.p.extension'), sous: tr(pt.phrase, pt.vars), geste: tr('tvb.g.' + (pt.geste === 'installer' ? 'installer' : pt.geste === 'mettre-a-jour' ? 'maj' : pt.geste === 'brancher' ? 'brancher' : 'voir')) };
  if (pt.type === 'panne') return { titre: tr('tvb.p.panne', { site, compte: pt.nom || pt.id }), sous: pt.cause || pt.conseil, geste: tr('tvb.g.voir') };
  if (pt.type === 'compte') return { titre: tr(pt.jamais ? 'tvb.p.compteJamais' : 'tvb.p.compte', { site, compte: pt.nom || pt.id }), sous: pt.jamais ? tr('tvb.p.compte.jamais') : tr('tvb.p.compte.ancien', { quand: pt.age }), geste: pt.plateforme === 'ebay' ? tr('tvb.g.ebay') : tr('tvb.g.ouvrir', { site }) };
  if (pt.type === 'appareil') return { titre: pt.inconnu ? tr('tvb.p.appareilInconnu') : tr('tvb.p.appareil', { nav: pt.nom }), sous: tr('tvb.p.appareil.sous', { v: versionCourte(pt.version) || '?', attendue: versionCourte(EXT_ATTENDUE) }), geste: tr('tvb.g.installerV', { v: versionCourte(EXT_ATTENDUE) }) };
  if (pt.type === 'donnees') return { titre: tr('tvb.p.donnees', { n: pt.n }), sous: tr('tvb.p.donnees.sous'), geste: tr('tvb.g.voir') };
  if (pt.type === 'passu') return { titre: tr('tvb.p.passu'), sous: tr('tvb.p.passu.sous', { quoi: pt.quoi.join(', ') }), geste: tr('tvb.g.relire') };
  return { titre: tr('tvb.p.forme'), sous: tr('tvb.p.forme.sous'), geste: '' };
}
export function ToutVaBien({ onComptes }) {
  useLangue();
  const { etat, relire } = useEtatCapture({ complet: true });
  // (11 nov., ext. 5.357) Une page de Vinted lue d'une forme inconnue : rien n'est rangé, on le dit.
  const formes = useAlertesForme();
  const sansSouris = useSansSouris();
  useExtVivante();
  const fiab = usePointsToutVaBien();
  const sante = useSanteDonnees({ capture: etat });
  const [details, setDetails] = React.useState(false);
  if (etat === undefined || !etat.comptesPrets) return <div className="vrm-tvb" data-tout-va-bien="lecture"><Groupe><Rangee titre={tr('tvb.verif')} attrs={{ 'data-tvb-resume': '' }}/></Groupe></div>;
  const { appareils, pannes, lignes, passu, maintenant } = etat;
  const av = aVoirCapture(etat, { etatVersion, attendue: EXT_ATTENDUE });
  const nav = (() => { try { return etatNavigateur(faitsExtensionApp(sansSouris)); } catch (_) { return null; } })();
  const noms = new Map((lignes || []).map((l) => [`${l.plateforme}:${l.id}`, l.nom]));
  const r = pointsEcran({
    nav, pannes: (pannes || []).map((x) => ({ ...x, nom: noms.get(`${x.plateforme}:${x.id}`) || '' })), lignes, appareils: appareils || [], versionDe: (a) => etatVersion(a, EXT_ATTENDUE),
    ancienInconnu: !!av.ancienInconnu, controle: (fiab && fiab.points ? fiab.points : []).filter((x) => x.source === 'controle'),
    donnees: sante && Number.isFinite(sante.nAFaire) ? sante.nAFaire : null, passu, formes: formes ? formes.length : 0,
  });
  const inst = installerExtensionIci();
  const faire = (g) => {
    if (!g) return;
    if (g.code === 'brancher') { brancherExtensionApp(); setTimeout(relire, 1500); return; }
    if (g.code === 'page-extension') { ouvrirPageExtension(); return; }
    if (g.code === 'aller') { allerTvb(g.aller); return; }
    if (g.code === 'sante') { DEMANDE_REGLAGE_SOUS.id = 'sante'; try { window.dispatchEvent(new Event('vrm:reglage-sous')); } catch (_) {} return; }
    if (g.code === 'relire') { relire(); return; }
    if (g.lien) { try { if (g.telecharger) { const a = document.createElement('a'); a.href = g.lien; a.download = ''; document.body.appendChild(a); a.click(); a.remove(); } else window.open(g.lien, '_blank', 'noopener'); } catch (_) {} }
  };
  const ton = r.etat === 'points' ? 'geste' : r.etat === 'passu' ? 'passu' : 'ok';
  const resume = r.n ? tr('tvb.resume.points', { n: r.n }) : r.etat === 'passu' ? tr('tvb.resume.passu') : !lignes.length ? tr('tvb.resume.aucun') : tr('tvb.resume.ok');
  return (
    <div className="vrm-tvb" data-tout-va-bien={ton} data-tvb-a-faire={r.n}>
      <Groupe>
        <Rangee titre={resume} sousTitre={tr('tvb.verifie', { quand: quandRelu(maintenant) })} valeur={tr('tvb.g.relire')} onClick={relire} className="vrm-tvb-point"
          attrs={{ 'data-tvb-resume': '', 'data-tvb-relire': '' }}/>
      </Groupe>
      {r.points.length ? (
        <Groupe titre={tr(r.n ? 'tvb.groupe.regler' : 'tvb.groupe.savoir')} attrs={{ 'data-tvb-points': r.points.length }}>
          {r.points.map((pt, i) => {
            const t = textesPoint(pt);
            const g = gestePoint(pt, { inst, liensSite: LIENS_SITE_TVB, lienPaquet: (x) => gestesMiseAJour({ paquet: x.paquet }, EXT_ATTENDUE).lien || '', allerControle: allerControleTvb });
            return <Rangee key={pt.cle} titre={t.titre} sousTitre={t.sous} sousLignes={2} valeur={g ? t.geste : ''} ton={pt.ton === 'geste' ? 'ambre' : 'neutre'}
              onClick={g ? () => faire(g) : null} className={pt.ton === 'rouge' ? 'vrm-tvb-point vrm-tvb-point-doublon' : 'vrm-tvb-point'}
              attrs={{ 'data-tvb-point': pt.cle, 'data-tvb-rang': i, 'data-tvb-type': pt.type, 'data-tvb-geste-code': g ? g.code : '' }}/>;
          })}
        </Groupe>
      ) : null}
      <Groupe>
        <Rangee titre={tr('tvb.details')} fin={details ? <span className="vrm-tvb-replier" aria-hidden="true">{tr('tvb.replier')}</span> : 'chevron'} onClick={() => setDetails((d) => !d)}
          attrs={{ 'data-tvb-details': details ? 'ouvert' : 'ferme', 'aria-expanded': details ? 'true' : 'false' }}/>
      </Groupe>
      {details ? <DetailsToutVaBien onComptes={onComptes} etat={etat} relire={relire} formes={formes}/> : null}
    </div>
  );
}

function DetailsToutVaBien({ onComptes, etat, relire, formes }) {
  const [ouvert, setOuvert] = React.useState(null);
  // (11 nov.) Les alertes de production : au propriétaire seul (la route le revérifie).
  const proprio = useEstProprietaire();
  const { appareils, pannes, lignes, passu, ancien, maintenant } = etat;
  const panneDe = new Map(pannes.map((p) => [`${p.plateforme}:${p.id}`, p]));
  // (11 nov., lot sante-donnees) LA règle des « choses à voir » : `aVoirCapture`
  // (src/santeDonnees.js) — la même que les lignes « Comptes pas relus » et
  // « Extension en retard » de la Santé de tes données.
  const av = aVoirCapture(etat, { etatVersion, attendue: EXT_ATTENDUE });
  const ancienInconnu = av.ancienInconnu;
  const aFaire = (av.comptes || 0) + (av.extensions || 0);
  const sansAppareil = Array.isArray(appareils) && !appareils.length;
  const nFormes = formes ? formes.length : 0;
  const resume = aFaire ? (aFaire === 1 ? '1 chose à voir' : `${aFaire} choses à voir`)
    : nFormes ? 'Vinted a changé une page'
    : passu.length ? 'Je n’ai pas pu tout vérifier'
    : !lignes.length ? 'Aucun compte relié'
    : sansAppareil ? 'Tes comptes sont à jour' : 'Tout est à jour';
  const sous = aFaire ? 'Le geste est écrit sous chaque ligne ambre.'
    : nFormes ? 'Rien à faire de ton côté : VRM corrige sa lecture.'
    : passu.length ? `Pas lu : ${passu.join(', ')}. Rien n’est affirmé pour eux.`
    : sansAppareil ? 'Aucune extension 5.327 ou plus récente n’a encore donné son appareil.' : `Vérifié ${quandRelu(maintenant)}.`;
  const ton = aFaire || nFormes ? 'geste' : passu.length ? 'passu' : 'ok';
  const parSite = ['vinted', 'leboncoin', 'vestiaire', 'ebay'].map((p) => [p, lignes.filter((l) => l.plateforme === p)]).filter(([, l]) => l.length);
  return (
    <div className="vrm-tvb-details" data-tvb-details-contenu={ton} data-tvb-detail-a-faire={aFaire}>
      <div className="vrm-tvb-tete">
        <Pastille ton={ton}/>
        <div className="vrm-tvb-tete-texte">
          <b className="vrm-tvb-resume" data-tvb-resume-detail="">{resume}</b>
          <span className="vrm-tvb-sous">{sous}</span>
        </div>
        <button type="button" className="vrm-lien-action vrm-tvb-revoir" data-tvb-relire-detail="" onClick={relire}>Revérifier</button>
      </div>
      <LignesForme alertes={formes} lieu="tvb"/>
      <FiabiliteToutVaBien etat={etat}/>
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
      {/* (11 nov., lot sante-donnees) La ligne compacte : le nombre de choses à corriger dans tes données, et la porte. */}
      <LigneSante capture={etat}/>
      {/* (12 nov., ext. 5.371) « Envoyer un rapport » : l'état technique de l'extension, sans tes données. */}
      <BoutonRapportExtension/>
      {proprio ? <AlertesProduction entetes={enTeteSession}/> : null}
      {proprio ? <RapportPlantages entetes={enTeteSession}/> : null}
      {proprio ? <RapportsExtensionProprio/> : null}
      {onComptes ? <div className="vrm-tvb-pied"><button type="button" className="vrm-lien-action" onClick={onComptes}>Gérer mes comptes liés</button></div> : null}
    </div>
  );
}

// ── LA LIGNE AMBRE ───────────────────────────────────────────────────────────
// (9 nov., lot AG) FONDUE dans la ligne de fraîcheur unique du haut de l'app
// (src/LigneFraicheur.jsx, règle src/fraicheur.js) : une panne prouvée y est la
// source la plus grave, nommée avec sa cause, son appareil et « Voir » (cette
// page). Les attributs `data-alerte-capture` / `data-alerte-voir` y sont gardés.
