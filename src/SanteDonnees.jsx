// ═══════════════════════════════════════════════════════════════════════════
// « SANTÉ DE TES DONNÉES » (11 nov., lot sante-donnees) — la FORME seulement.
// Les règles, l'ordre, les phrases et les gestes : src/santeDonnees.js, qui ne
// compte rien lui-même (il range les nombres des écrans propriétaires).
//   · `useSanteDonnees({ capture })` — les lectures (publications de l'appareil,
//     `vrm_colis_retirer`, `vinted_urssaf_mois`, `vrm_sources_ventes`, e-mails mis
//     de côté, compteur « à vérifier » du journal) ; `capture` = l'état de
//     `useEtatCapture` (« Tout va bien ? »), une seule lecture pour les deux.
//   · `SanteDonnees` — Paramètres → Santé de tes données : une rangée par
//     vérification, la plus grave d'abord ; une rangée = un nombre, une phrase,
//     UN bouton qui ouvre le parcours (événement `vrm:sante-aller`, la coque).
//   · `LigneSante` — la ligne compacte au pied de « Tout va bien ? ».
// Rien n'est écrit ici, rien n'est corrigé : chaque correction reste SON clic.
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { GroupeIos } from './composants/Ios.jsx';
import { lignesSante, resumeSante, aVoirCapture, lirePubsSante, CLE_SANTE } from './santeDonnees.js';
import { lignesATrancher, lirePublications as lirePubsTrancher, CLE_A_TRANCHER } from './aTrancher.js';
import { lireSources, EVT_SOURCES } from './sourceAchats.js';
import { lireAVerifierEmails } from './JournalEmails.jsx';
import { etatVersion } from '../api/_lib/garde-capture.js';
import { useEtatCapture } from './ToutVaBien.jsx';
import { AUTH, EXT_ATTENDUE, DEMANDE_REGLAGE_SOUS, load, sbAuth, useLigneSynchro, useMisDeCote, lireMisDeCote } from './App.jsx';
import './styles-sante-donnees.css';

const lireObjetLocal = (cle) => () => { try { const v = load(cle, null); return v && typeof v === 'object' ? v : null; } catch (_) { return null; } };
const lireRetirer = lireObjetLocal('vrm_colis_retirer');
const lireUrssaf = lireObjetLocal('vinted_urssaf_mois');
const uidVrm = () => (AUTH && AUTH.user && AUTH.user.id) || '';

export function useSanteDonnees({ capture } = {}) {
  const [colisRetirer] = useLigneSynchro('vrm_colis_retirer', lireRetirer);
  const [urssafMois] = useLigneSynchro('vinted_urssaf_mois', lireUrssaf);
  const lireLocal = () => {
    try { return { tr: lirePubsTrancher(localStorage, uidVrm()), sa: lirePubsSante(localStorage, uidVrm()), so: lireSources(uidVrm()) }; }
    catch (_) { return { tr: {}, sa: {}, so: null }; }
  };
  const [local, setLocal] = React.useState(lireLocal);
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const relire = () => setLocal(lireLocal());
    const f = (e) => { const k = e && e.detail && e.detail.k; if (k === CLE_A_TRANCHER || k === CLE_SANTE) relire(); };
    const g = (e) => { if (e && (e.key === CLE_A_TRANCHER || e.key === CLE_SANTE || e.key === 'vrm_sources_ventes')) relire(); };
    // Une publication vieillit : relue toutes les 5 min (comme À trancher).
    const t = setInterval(() => { relire(); setTick((x) => x + 1); }, 5 * 60000);
    window.addEventListener('vrm:save', f); window.addEventListener('storage', g); window.addEventListener(EVT_SOURCES, relire);
    return () => { clearInterval(t); window.removeEventListener('vrm:save', f); window.removeEventListener('storage', g); window.removeEventListener(EVT_SOURCES, relire); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Les e-mails mis de côté : UNE lecture partagée (`useMisDeCote`) ; demandée si personne ne l'a faite.
  const misDeCote = useMisDeCote();
  React.useEffect(() => { if (misDeCote === undefined) { try { lireMisDeCote(); } catch (_) {} } /* eslint-disable-next-line */ }, []);
  const [aVerifier, setAVerifier] = React.useState(undefined);
  React.useEffect(() => { let vivant = true; lireAVerifierEmails(sbAuth).then((v) => { if (vivant) setAVerifier(v); }); return () => { vivant = false; }; }, [tick]);
  return React.useMemo(() => {
    const maintenant = Date.now();
    // `comptes: undefined` : la ligne « comptes à relire » d'À trancher n'est pas lue ici
    // (la Santé prend celle de « Tout va bien ? », `aVoirCapture`).
    const trancher = lignesATrancher({ pubs: local.tr, colisRetirer, urssafMois, comptes: undefined, maintenant });
    return lignesSante({ trancher, pubsSante: local.sa, sources: local.so, capture: aVoirCapture(capture, { etatVersion, attendue: EXT_ATTENDUE }),
      misDeCote, aVerifier, maintenant });
  }, [local, colisRetirer, urssafMois, capture, misDeCote, aVerifier, tick]);
}

const aller = (geste) => { try { window.dispatchEvent(new CustomEvent('vrm:sante-aller', { detail: geste })); } catch (_) {} };
const Pastille = ({ ton }) => <span className="vrm-sd-pastille" data-ton={ton} aria-hidden="true"/>;

function Ligne({ l }) {
  const valeur = l.etat === 'passu' ? '—' : l.etat === 'lecture' ? '…' : String(l.n);
  const detail = l.etat === 'rouge' || l.etat === 'geste' ? l.phrase : l.etat === 'passu' ? `pas lu · ${l.raison}` : l.etat === 'lecture' ? 'lecture…' : 'rien à corriger';
  return (
    <div className="vrm-sd-rangee" data-sante-ligne={l.cle} data-sante-etat={l.etat} data-n={Number.isInteger(l.n) ? l.n : ''}>
      <Pastille ton={l.etat}/>
      <div className="vrm-sd-texte">
        <span className="vrm-sd-titre">{l.nom}</span>
        <span className="vrm-sd-detail">{detail}</span>
      </div>
      <span className="vrm-sd-valeur" data-ton={l.etat}>{valeur}</span>
      {l.etat === 'rouge' || l.etat === 'geste'
        ? <button type="button" className="vrm-sd-geste" data-ton={l.etat} data-sante-geste={l.cle} onClick={() => aller(l.geste)}>{l.geste.libelle}</button>
        : null}
    </div>
  );
}

export function SanteDonnees() {
  const { etat: capture, relire } = useEtatCapture({ complet: true });
  const r = useSanteDonnees({ capture });
  const res = resumeSante(r);
  const aFaire = r.lignes.filter((l) => l.etat === 'rouge' || l.etat === 'geste');
  const passu = r.lignes.filter((l) => l.etat === 'passu' || l.etat === 'lecture');
  const ok = r.lignes.filter((l) => l.etat === 'ok');
  return (
    <div className="vrm-sd" data-sante={res.ton} data-sante-a-faire={r.nAFaire} data-sante-total={r.total} data-sante-a-jour={r.toutAJour ? '1' : '0'}>
      <div className="vrm-sd-tete">
        <Pastille ton={res.ton}/>
        <div className="vrm-sd-tete-texte">
          <b className="vrm-sd-resume" data-sante-resume="">{res.titre}</b>
          {res.sous ? <span className="vrm-sd-sous">{res.sous}</span> : null}
        </div>
        <button type="button" className="vrm-lien-action vrm-sd-revoir" data-sante-relire="" onClick={relire}>Revérifier</button>
      </div>
      {aFaire.length ? <GroupeIos titre="À corriger" data-sante-groupe="a-faire">{aFaire.map((l) => <Ligne key={l.cle} l={l}/>)}</GroupeIos> : null}
      {passu.length ? <GroupeIos titre="Pas lu" data-sante-groupe="passu" pied="Rien n’est affirmé pour ces lignes : ouvre l’écran nommé, puis reviens.">{passu.map((l) => <Ligne key={l.cle} l={l}/>)}</GroupeIos> : null}
      {ok.length ? <GroupeIos titre="À jour" data-sante-groupe="ok">{ok.map((l) => <Ligne key={l.cle} l={l}/>)}</GroupeIos> : null}
    </div>
  );
}

// La ligne compacte de « Tout va bien ? » : le résumé et la porte vers l'écran.
export function LigneSante({ capture }) {
  const r = useSanteDonnees({ capture });
  const res = resumeSante(r);
  const ouvrir = () => { DEMANDE_REGLAGE_SOUS.id = 'sante'; try { window.dispatchEvent(new Event('vrm:reglage-sous')); } catch (_) {} };
  const valeur = r.nAFaire ? `${r.nAFaire} à corriger` : r.toutAJour ? 'À jour ✓' : r.passu.length ? '— · pas tout lu' : '…';
  return (
    <button type="button" className="vrm-sd-compacte" data-sante-compacte={res.ton} data-sante-a-faire={r.nAFaire} onClick={ouvrir}>
      <Pastille ton={res.ton}/>
      <span className="vrm-sd-compacte-titre">Santé de tes données</span>
      <span className="vrm-sd-valeur" data-ton={res.ton}>{valeur}</span>
      <span className="vrm-sd-chevron" aria-hidden="true"><svg width="8" height="13" viewBox="0 0 8 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m1.5 1.5 5 5-5 5"/></svg></span>
    </button>
  );
}
