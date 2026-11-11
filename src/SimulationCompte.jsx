// ── SIMULER UNE CRÉATION DE COMPTE — l'écran du PROPRIÉTAIRE (11 nov.) ──────
// Réglages → « Simuler une création de compte » (monté seulement pour le
// propriétaire de l'installation, comme « Ton entreprise »).
// La règle et les scénarios : src/simulationCompte.js (comptes FICTIFS, base
// simulée en mémoire, aucune requête, aucun e-mail, aucun compte Supabase).
// Ici : un bouton, puis une carte par scénario — ses choix, son verdict, et ses
// six étapes en miniatures (le VRAI écran du parcours, réduit), ✓ ou ✗ avec ce
// qui a accroché. Toucher une miniature l'agrandit.
import React from 'react';
import { jouerTout, SCENARIOS } from './simulationCompte.js';
import { ParcoursArrivee } from './ParcoursArrivee.jsx';
import './simulation-compte.css';

const OFFRE = { solo: 'Solo', pro: 'Pro' };
const EXT = { connectee: 'Extension connectée', absente: 'Sans extension', pasconnectee: 'Extension pas connectée', autrecompte: 'Extension d’un autre compte' };

function Miniature({ apercu, grand = false }) {
  if (!apercu) return null;
  return (
    <div className={grand ? 'vrm-sim-ecran vrm-sim-ecran-grand' : 'vrm-sim-ecran'} aria-hidden="true" inert="">
      <div className="vrm-sim-ecran-dedans">
        <ParcoursArrivee etat={apercu.etat} montree={apercu.montree} gestes={{}} onFermer={() => {}} onPlusTard={() => {}} onFin={() => {}} />
      </div>
    </div>
  );
}

function CarteScenario({ r, onAgrandir }) {
  const sc = r.sc;
  const choix = [r.mots.categories.join(', '), OFFRE[sc.offre], EXT[sc.extension], sc.emails ? null : 'Sans e-mails', sc.panne ? 'Panne de lecture' : null].filter(Boolean);
  return (
    <section className="vrm-sim-carte" data-sim-scenario={sc.id} data-sim-conforme={r.conforme ? '1' : '0'}>
      <div className="vrm-sim-tete">
        <span className="vrm-sim-verdict" data-ok={r.conforme ? '1' : '0'} aria-hidden="true">{r.conforme ? '✓' : '✗'}</span>
        <div className="vrm-sim-titres">
          <h3 className="vrm-sim-nom">{sc.nom}</h3>
          <p className="vrm-sim-choix">{choix.join(' · ')}</p>
        </div>
      </div>
      <ol className="vrm-sim-etapes">
        {r.etapes.map((e) => (
          <li key={e.cle} className="vrm-sim-etape" data-sim-etape={e.cle} data-sim-ok={e.ok ? '1' : '0'} data-sim-conforme={e.conforme ? '1' : '0'}>
            <button type="button" className="vrm-sim-vignette" aria-label={`${e.court} : ${e.ok ? 'franchie' : 'bloquée'} — agrandir`} onClick={() => onAgrandir({ r, e })}>
              <Miniature apercu={e.apercu} />
            </button>
            <span className="vrm-sim-etape-nom"><b data-ok={e.ok ? '1' : '0'}>{e.ok ? '✓' : '✗'}</b> {e.court}</span>
            <span className="vrm-sim-etape-quoi">{e.ok ? (e.reussite || 'Fait') : e.accroche}</span>
          </li>
        ))}
      </ol>
      <p className="vrm-sim-pied">
        Mot : « {r.mots.nom} »{sc.offre === 'solo' && r.horsOffre ? ' · vente du 2e compte hors offre Solo' : ''}
        {r.conforme ? '' : ' · ⚠️ différent de l’attendu'}
      </p>
    </section>
  );
}

export function SimulationCompte() {
  const [res, setRes] = React.useState(null);
  const [grand, setGrand] = React.useState(null);
  const lancer = () => { try { setRes(jouerTout()); } catch (e) { setRes({ erreur: String(e && e.message || e) }); } };
  const ok = Array.isArray(res) ? res.filter((r) => r.conforme).length : 0;
  return (
    <div className="vrm-sim" data-simulation-compte="">
      <p className="vrm-sim-intro">Des comptes fictifs, dans ce navigateur. Rien n’est écrit, aucun e-mail.</p>
      <button type="button" className="vrm-b vrm-b-primaire vrm-sim-lancer" data-sim-lancer="" onClick={lancer}>
        {res ? 'Rejouer' : `Lancer les ${SCENARIOS.length} simulations`}
      </button>
      {res && res.erreur ? <p className="vrm-sim-erreur" role="alert">La simulation a planté : {res.erreur}</p> : null}
      {Array.isArray(res) ? (
        <>
          <p className="vrm-sim-bilan" data-sim-bilan={`${ok}/${res.length}`} role="status">{ok === res.length ? `${ok} sur ${res.length} : comme prévu` : `${ok} sur ${res.length} comme prévu`}</p>
          {res.map((r) => <CarteScenario key={r.sc.id} r={r} onAgrandir={setGrand} />)}
        </>
      ) : null}
      {grand ? (
        <div className="vrm-sim-loupe" role="dialog" aria-modal="true" aria-label={`${grand.e.court} — ${grand.r.sc.nom}`} onClick={() => setGrand(null)}>
          <div className="vrm-sim-loupe-cadre" onClick={(ev) => ev.stopPropagation()}>
            <div className="vrm-sim-loupe-haut">
              <span><b data-ok={grand.e.ok ? '1' : '0'}>{grand.e.ok ? '✓' : '✗'}</b> {grand.e.court} · {grand.e.ok ? (grand.e.reussite || 'Fait') : grand.e.accroche}</span>
              <button type="button" className="vrm-sim-loupe-fermer" aria-label="Fermer" onClick={() => setGrand(null)}>✕</button>
            </div>
            <Miniature apercu={grand.e.apercu} grand />
          </div>
        </div>
      ) : null}
    </div>
  );
}
export default SimulationCompte;
