// ═══════════════════════════════════════════════════════════════════════════
// LA PAGE « EXTENSION » (19 nov., demande H) — le SEUL endroit qui parle de l'extension et des comptes
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « on ne sait pas quand ton compte Vinted est ouvert, quelles actions on peut faire, on ne sait
// rien […] le vendeur doit comprendre, pour que je n'aie pas trop de questions de leur part ».
// Une page de « Plus » ; la pastille de la coque y mène. Composée en « VRM natif » (src/natif/), textes
// par tr() (src/i18n/langues/*/extension.js). La RÈGLE est ailleurs : src/extension/peutFaire.js (pure,
// exécutée par scripts/audit-extension-claire.cjs). Ici : lire les faits, appeler la règle, dessiner.
// Lectures (rien n'est écrit, sauf SA reprise / « Reprendre » sur son toucher) :
//   · ce que l'extension de CE navigateur a répondu (src/App.jsx `faitsExtensionApp`) ;
//   · `ext_appareil_*` (ses autres navigateurs, ce qu'ils ont lu) — projection scalaire + `vus` ;
//   · `actions_compte_*` (le plafond, la prudence, la vérification, « Tout arrêter ») — src/JaugeActions.jsx ;
//   · les comptes reliés (Vinted, Leboncoin, Vestiaire) et la fraîcheur des lectures (`harvest_*`).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, heure as heureLoc, dateRelative } from '../i18n/index.js';
import { Page, Groupe, Rangee, Bouton, Attente, poserIcone, iconePosee } from '../natif/index.js';
import { pageExtension } from './peutFaire.js';
import { useLignesActions } from '../JaugeActions.jsx';
import { jaugeDuCompte, toutArreteDe } from '../jaugeActions.js';
import { useReglageDiscretion } from '../Discretion.jsx';
import { avecReprise, avecToutArrete, CLE_DISCRETION } from '../discretion.js';
import { installerExtensionIci, pageExtensionsIci } from '../navigateurExtension.js';
import { Icon, SUPABASE_URL, sbAuth, load, vmrCmd, lireCapturesDetail, useComptesAutresSites, faitsExtensionApp, useExtVivante, useSansSouris, brancherExtensionApp } from '../App.jsx';
import { nomCompteLie } from '../comptesLies.js';

const NOMS_NAV = { chrome: 'Chrome', edge: 'Edge', opera: 'Opera', firefox: 'Firefox', orion: 'Orion' };
const NOMS_SYS = { mac: 'Mac', windows: 'Windows', linux: 'Linux', iphone: 'iPhone', ipad: 'iPad', android: 'Android', chromeos: 'Chromebook' };
const NOMS_SITES = { vinted: 'Vinted', leboncoin: 'Leboncoin', vestiaire: 'Vestiaire Collective' };

// « il y a 3 min » dans la langue (Intl), jamais une date inventée.
export function ilYa(ms, maintenant = Date.now()) {
  const t = Number(ms); if (!Number.isFinite(t) || t <= 0) return '';
  const min = Math.round((t - maintenant) / 60000);
  if (Math.abs(min) < 60) return dateRelative(Math.min(0, min), 'minute');
  const h = Math.round(min / 60);
  if (Math.abs(h) < 48) return dateRelative(h, 'hour');
  return dateRelative(Math.round(h / 24), 'day');
}
// Les variables d'une phrase : une heure (ms) devient « 21:40 » dans la langue.
const avecHeures = (vars) => { const o = { ...(vars || {}) }; if (typeof o.heure === 'number') o.heure = heureLoc(o.heure); return o; };
const dire = (cle, vars) => tr(cle, avecHeures(vars));

// ── Lectures ────────────────────────────────────────────────────────────────
// Les navigateurs du compte : `undefined` on lit · `null` pas su · liste.
function useAppareils(actif) {
  const [v, setV] = React.useState(undefined);
  React.useEffect(() => {
    if (!actif) return undefined;
    let mort = false;
    const lire = () => fetch(`${SUPABASE_URL}/rest/v1/app_data?id=like.ext_appareil_*&select=id,ver:data->>ver,atMs:data->>atMs,nav:data->appareil->>nav,sys:data->appareil->>systeme,vus:data->vus&limit=30`, { headers: sbAuth(), cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((rows) => { if (mort) return; setV(Array.isArray(rows) ? rows.map((x) => ({ id: String(x.id || '').replace(/^ext_appareil_/, ''), ver: String(x.ver || ''), atMs: Number(x.atMs) || 0,
        nom: [NOMS_NAV[x.nav] || '', NOMS_SYS[x.sys] || ''].filter(Boolean).join(' · '), vus: x.vus && typeof x.vus === 'object' ? x.vus : {} })).filter((x) => x.atMs > 0) : null); });
    lire();
    const m = setInterval(lire, 120000);
    return () => { mort = true; clearInterval(m); };
  }, [actif]);
  return v;
}
function useLectures(actif) {
  const [v, setV] = React.useState(undefined);
  React.useEffect(() => { if (!actif) return undefined; let mort = false; lireCapturesDetail().then((d) => { if (!mort) setV(d ? d.by : null); }).catch(() => { if (!mort) setV(null); }); return () => { mort = true; }; }, [actif]);
  return v;
}
function useMaintenant(ms = 20000) {
  const [t, setT] = React.useState(() => Date.now());
  React.useEffect(() => { const m = setInterval(() => setT(Date.now()), ms); return () => clearInterval(m); }, [ms]);
  return t;
}

// ── Morceaux ────────────────────────────────────────────────────────────────
// « Pourquoi ? » : une ligne repliée par état (rien d'affiché tant qu'on ne la touche pas).
function Pourquoi({ cle, id }) {
  const [ouvert, setOuvert] = React.useState(false);
  if (!cle) return null;
  return (
    <>
      <Rangee titre={tr('ext.pourquoi')} fin={ouvert ? null : 'chevron'} onClick={() => setOuvert((o) => !o)} attrs={{ 'data-ext-pourquoi': id, 'aria-expanded': ouvert ? 'true' : 'false' }}/>
      {ouvert ? <Rangee titre={tr(cle)} lignes={2} attrs={{ 'data-ext-pourquoi-texte': id }}/> : null}
    </>
  );
}

function RangeeGeste({ g }) {
  const raison = g.oui ? (g.note ? dire('ext.note.' + g.note, g.vars) : '') : dire('ext.raison.' + g.raison, g.vars);
  return <Rangee titre={tr('ext.g.' + g.cle)} sousTitre={raison} valeur={g.oui ? tr('ext.oui') : tr('ext.non')} valeurForte={g.oui}
    ton={!g.oui && GESTE_ICI.has(g.raison) ? 'ambre' : 'neutre'}
    attrs={{ 'data-ext-geste': g.cle, 'data-ext-oui': g.oui ? '1' : '0', 'data-ext-raison': g.raison || undefined, 'data-ext-note': g.note || undefined }}/>;
}
// Les « non » qui demandent un geste ICI (ambre) — les autres (pause, plafond, attente) repartent seuls (gris).
const GESTE_ICI = new Set(['pas-ouvert', 'autre-ouvert', 'tout-arrete', 'verification', 'deconnecte', 'moderation', 'retard', 'site-ferme', 'site-passu-ferme',
  'nav-absente', 'nav-ailleurs', 'nav-muette', 'nav-plusieurs', 'nav-perime', 'nav-vrm', 'nav-autre-vrm', 'nav-retard', 'nav-vrm-passu']);

function texteJauge(j, maintenant) {
  if (j === undefined) return '…';
  if (!j) return tr('ext.jauge.passu');
  const base = tr('ext.jauge', { n: j.n, max: j.max });
  return j.n && j.repartA && j.repartA > maintenant ? `${base} · ${tr('ext.jauge.repart', { heure: heureLoc(j.repartA) })}` : base;
}

function CompteGroupe({ c, ouvert, onBascule, maintenant, onReprendre }) {
  const sous = [dire(c.etat.cle, c.etat.vars), c.lu ? tr('ext.lu', { age: ilYa(c.lu.at, maintenant) }) : (c.etat.cle === 'ext.compte.jamaisLu' ? '' : tr('ext.jamais'))].filter(Boolean).join(' · ');
  const total = c.gestes.length;
  return (
    <Groupe titre={`${NOMS_SITES[c.site]} · ${c.nom || '—'}`} repli={{ ouvert, onBascule, n: null }} attrs={{ 'data-ext-compte': `${c.site}:${c.id}`, 'data-ext-ouverture': c.ouverture, 'data-ext-etat': c.etat.code, 'data-ext-peut': c.peut }}>
      <Rangee titre={sous} lignes={2} ton={c.etat.ton === 'geste' ? 'ambre' : 'neutre'} valeur={tr('ext.peut.n', { n: c.peut, total })}
        href={c.etat.geste === 'ouvrir-vinted' ? 'https://www.vinted.fr' : ''} fin={c.etat.geste === 'ouvrir-vinted' ? 'chevron' : null}
        attrs={{ 'data-ext-compte-etat': c.etat.code }}/>
      {c.etat.geste === 'reprendre' ? <Rangee titre={tr('ext.geste.reprendre')} fin="chevron" onClick={() => onReprendre(c.id)} attrs={{ 'data-ext-reprendre': c.id }}/> : null}
      {c.site === 'vinted' ? <Rangee titre={texteJauge(c.jauge, maintenant)} attrs={{ 'data-ext-jauge': c.jauge ? `${c.jauge.n}/${c.jauge.max}` : (c.jauge === null ? 'pas-su' : 'lecture') }}/> : null}
      {c.gestes.map((g) => <RangeeGeste key={g.cle} g={g}/>)}
      {c.etat.code === 'verification' || c.etat.code === 'captcha' ? <Pourquoi cle="ext.pourquoi.verification" id={'verif-' + c.id}/>
        : c.gestes.some((g) => g.raison === 'pause') ? <Pourquoi cle="ext.pourquoi.pause" id={'pause-' + c.id}/>
        : c.gestes.some((g) => g.raison === 'plafond' || g.raison === 'places') ? <Pourquoi cle="ext.pourquoi.plafond" id={'plafond-' + c.id}/>
        : c.gestes.some((g) => g.note === 'prudence') ? <Pourquoi cle="ext.pourquoi.prudence" id={'prudence-' + c.id}/>
        : c.gestes.some((g) => g.raison === 'autre-ouvert' || g.raison === 'pas-ouvert') ? <Pourquoi cle="ext.pourquoi.compteOnglet" id={'onglet-' + c.id}/> : null}
    </Groupe>
  );
}

// ── La page ─────────────────────────────────────────────────────────────────
// `comptesVinted` : la table `vinted_accounts` du vendeur (undefined = on lit) ; `ecarte(uid)` : un compte
// retiré de ses totaux n'est pas montré (« ne plus lui parler des comptes retirés »).
export default function EcranExtension({ comptesVinted, ecarte = () => false, faits: faitsForces = null }) {
  if (!iconePosee()) poserIcone(Icon);
  useExtVivante();
  const sansSouris = useSansSouris();
  const maintenant = useMaintenant();
  const appareils = useAppareils(true);
  const lus = useLectures(true);
  const [rows] = useLignesActions('', true);
  const [autresSites] = useComptesAutresSites(true);
  const [reg, ecrire] = useReglageDiscretion();
  const [ouverts, setOuverts] = React.useState({});

  const liste = Array.isArray(comptesVinted) ? comptesVinted.filter((a) => a && a.vinted_user_id != null && !ecarte(String(a.vinted_user_id))) : [];
  const vinted = liste.map((a) => ({ id: String(a.vinted_user_id), nom: String(a.login || '') }));
  const lbc = Array.isArray(autresSites && autresSites.leboncoin) ? autresSites.leboncoin.map((c) => ({ id: c.id, nom: nomCompteLie(c), ouvert: !!c.ouvert, lu: c.lu })) : [];
  const vc = Array.isArray(autresSites && autresSites.vestiaire) ? autresSites.vestiaire.map((c) => ({ id: c.id, nom: nomCompteLie(c), ouvert: !!c.ouvert, lu: c.lu, nonIdentifie: !!c.nonIdentifie })) : [];
  const jauges = {};
  for (const c of vinted) jauges[c.id] = rows === undefined ? undefined : jaugeDuCompte(rows, c.id, maintenant);
  const brut = load(CLE_DISCRETION, null);
  const faits = faitsForces || {
    ...faitsExtensionApp(sansSouris),
    maintenant,
    appareils: Array.isArray(appareils) ? appareils : [],
    comptes: { vinted, leboncoin: lbc, vestiaire: vc },
    lus: { vinted: lus || {} },
    jauges,
    reprises: reg.reprises || {},
    toutArrete: toutArreteDe(Array.isArray(rows) ? rows : [], brut && brut.tout),
  };
  const vm = pageExtension(faits);
  const nav = vm.navigateur;

  const reprendre = (uid) => ecrire(avecReprise(brut && typeof brut === 'object' ? brut : {}, uid));
  const reprendreTout = () => { ecrire(avecToutArrete(brut && typeof brut === 'object' ? brut : {}, false, Date.now())); try { vmrCmd({ cmd: 'toutArreter', on: false }); } catch (_) {} };
  const inst = installerExtensionIci();
  const plein = nav.geste === 'installer' || nav.geste === 'mettre-a-jour'
    ? <Bouton variante="plein" onClick={() => { try { window.open(inst.lien, inst.boutique ? '_blank' : '_self', 'noopener'); } catch (_) {} }} attrs={{ 'data-ext-plein': nav.geste }}>{tr('ext.geste.' + nav.geste)}</Bouton>
    : nav.geste === 'recharger' ? <Bouton variante="plein" onClick={() => { try { window.location.reload(); } catch (_) {} }} attrs={{ 'data-ext-plein': 'recharger' }}>{tr('ext.geste.recharger')}</Bouton>
    : nav.geste === 'brancher' ? <Bouton variante="plein" onClick={() => { try { brancherExtensionApp(); } catch (_) {} }} attrs={{ 'data-ext-plein': 'brancher' }}>{tr('ext.geste.brancher')}</Bouton>
    : null;
  const consigne = nav.geste === 'extensions' ? tr(nav.code === 'plusieurs' ? 'ext.geste.extensionsDeux' : 'ext.geste.extensions', { page: pageExtensionsIci() })
    : nav.geste === 'ordinateur' ? tr('ext.geste.ordinateur') : '';
  const etapesFaites = vm.etapes.every((e) => e.fait === true);
  // Le compte ouvert ICI est déplié d'office ; les autres sur son toucher.
  const deplie = (c) => (ouverts[`${c.site}:${c.id}`] != null ? ouverts[`${c.site}:${c.id}`] : c.ouverture === 'ici' || c.ouverture === 'relais' || c.etat.ton === 'geste');
  const chargement = comptesVinted === undefined;

  return (
    <Page titre={tr('ext.titre')} plein={plein} attrs={{ 'data-ecran-extension': '', 'data-ext-nav': nav.code, 'data-ext-pastille': vm.pastille.code }}>
      <Groupe titre={tr('ext.groupe.navigateur')} attrs={{ 'data-ext-groupe': 'navigateur' }}>
        <Rangee titre={dire(nav.cle, nav.vars)} lignes={2} ton={nav.ton === 'geste' ? 'ambre' : 'neutre'} sousTitre={consigne} attrs={{ 'data-ext-nav-phrase': nav.code }}/>
        {vm.avertissements.map((a) => <Rangee key={a.code} titre={dire(a.cle, a.vars)} lignes={2} ton="ambre" fin={a.geste ? 'chevron' : null} onClick={a.geste === 'reprendre-tout' ? reprendreTout : null} attrs={{ 'data-ext-avert': a.code }}/>)}
        <Pourquoi cle={nav.pourquoi || (vm.avertissements[0] && vm.avertissements[0].pourquoi)} id={'nav-' + nav.code}/>
      </Groupe>

      {!etapesFaites ? (
        <Groupe titre={tr('ext.groupe.premier')} attrs={{ 'data-ext-groupe': 'premier' }}>
          {vm.etapes.map((e) => <Rangee key={e.cle} titre={tr('ext.etape.' + e.cle)} valeur={e.fait === true ? tr('ext.etape.vu') : e.fait === null ? tr('ext.etape.encours') : tr('ext.etape.attente')} valeurForte={e.fait === true}
            fin={e.fait === true ? 'coche' : null} attrs={{ 'data-ext-etape': e.cle, 'data-ext-fait': e.fait === true ? '1' : e.fait === null ? '?' : '0' }}/>)}
        </Groupe>
      ) : null}

      {chargement ? <Attente forme="rangees" n={4}/> : vm.sites.map((s) => s.comptes.map((c) => (
        <CompteGroupe key={`${s.site}:${c.id}`} c={c} maintenant={maintenant} ouvert={deplie(c)} onReprendre={reprendre}
          onBascule={() => setOuverts((o) => ({ ...o, [`${c.site}:${c.id}`]: !deplie(c) }))}/>
      )))}

      {vm.autres.length ? (
        <Groupe titre={tr('ext.groupe.autres')} attrs={{ 'data-ext-groupe': 'autres' }}>
          {vm.autres.slice(0, 6).map((a) => <Rangee key={a.id} titre={a.nom || '—'} sousTitre={[tr('ext.vivante', { age: ilYa(a.atMs, maintenant) }), a.ver].filter(Boolean).join(' · ')}
            valeur={a.aJour ? tr('ext.aJour') : tr('ext.enRetard')} attrs={{ 'data-ext-appareil': a.id, 'data-ext-a-jour': a.aJour ? '1' : '0' }}/>)}
        </Groupe>
      ) : null}
    </Page>
  );
}
