// ══════════════════════════════════════════════════════════════════════════════
// LA LIGNE DE FRAÎCHEUR UNIQUE, EN HAUT DE L'APP (9 nov., lot AG, proposition 47)
// ══════════════════════════════════════════════════════════════════════════════
// La FORME seulement : la règle (sources, seuils, gravité) est src/fraicheur.js.
// Les lectures sont celles qui existaient déjà (§11) :
//   · comptes, appareils, pannes : `useEtatCapture({ complet: true })`
//     (src/ToutVaBien.jsx — la page « Tout va bien ? ») ;
//   · e-mails : `useEtatEmailsComptes` (la règle des comptes muets, App.jsx) ;
//   · suivi transporteur : `fetchTranspLignes` (les lignes `transp_`, projetées).
// Elle remplace la ligne ambre « compte qui n'arrive plus » (`AlerteCapture`),
// dont elle garde les attributs (`data-alerte-capture`, `data-alerte-voir`).
// Hors ligne, base injoignable : elle se tait (l'état existant prime). Pas su :
// « Pas pu tout vérifier », jamais « tout est à jour ».
// La place est tenue dès le premier rendu (« Vérification… », même hauteur) :
// la page ne saute pas quand la réponse arrive (CLS).
// ══════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { useEtatCapture } from './ToutVaBien.jsx';
import { fraicheurUnique, phraseRetard } from './fraicheur.js';
import { quandRelu } from './fraicheurComptes.js';
import { nomPlateforme } from './plateformes.js';
import { estExclu } from '../api/_lib/comptes-exclus.js';
import { horsLigneActif, suivreHorsLigne } from './porteHorsLigne.js';
import { EXT_ATTENDUE, DEMANDE_REGLAGE_SOUS, useEtatEmailsComptes, useComptesExclus, fetchTranspLignes, relireTransporteursSiVieux } from './App.jsx';

const RELECTURE_MS = 5 * 60 * 1000;   // la ligne se revérifie toutes les 5 min, page visible
const DEPART_MS = 1800;               // jamais pendant l'ouverture (src/AttenteEcran : ~2,5 s)
const DEPART_MAX_MS = 15000;          // au plus tard, même si l'écran attend encore une lecture
// Ses lectures ne doivent JAMAIS retarder celles de l'écran (mesuré au banc `chargement`, réseau lent :
// parties à 1,8 s, elles faisaient arriver le contenu de Ventes, Colis, Achats APRÈS le plafond d'attente
// ⇒ décalages de 0,02 à 0,07). Elles partent quand l'écran a reçu ses données essentielles
// (`data-attente="pret"`, src/AttenteEcran.jsx) — ou qu'il n'en attend pas —, au repos du navigateur.
function useDepart() {
  const [actif, setActif] = React.useState(false);
  React.useEffect(() => {
    let fini = false, t = null;
    const debut = Date.now();
    const partir = () => { if (fini) return; fini = true; const f = () => setActif(true); if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(f, { timeout: 2000 }); else setTimeout(f, 0); };
    const voir = () => {
      if (fini) return;
      const ecran = document.querySelector('[data-attente-ecran]');
      const pret = !ecran || ecran.getAttribute('data-attente') === 'pret';
      if ((Date.now() - debut >= DEPART_MS && pret) || Date.now() - debut >= DEPART_MAX_MS) partir();
      else t = setTimeout(voir, 400);
    };
    t = setTimeout(voir, DEPART_MS);
    return () => { fini = true; if (t) clearTimeout(t); };
  }, []);
  return actif;
}

function useHorsLigneLigne() {
  const lire = () => { try { return horsLigneActif() || (typeof navigator !== 'undefined' && navigator.onLine === false); } catch (_) { return false; } };
  const [h, setH] = React.useState(lire);
  React.useEffect(() => {
    const f = () => setH(lire());
    window.addEventListener('online', f); window.addEventListener('offline', f);
    const off = suivreHorsLigne(f);
    return () => { window.removeEventListener('online', f); window.removeEventListener('offline', f); if (typeof off === 'function') off(); };
  }, []);
  return h;
}

export default function LigneFraicheur({ baseKO = false, comptes, onNav }) {
  const horsLigne = useHorsLigneLigne();
  const actif = useDepart();
  const { etat: capture, relire } = useEtatCapture({ complet: true, actif: actif && !baseKO && !horsLigne });
  // La dernière réponse COMPLÈTE reste affichée pendant une relecture (pas de « Vérification… » toutes les 5 min).
  const derniere = React.useRef(undefined);
  if (capture && capture.comptesPrets) derniere.current = capture;
  const emails = useEtatEmailsComptes(comptes, actif && !baseKO && !horsLigne);
  const [transp, setTransp] = React.useState(undefined);
  const [exclus] = useComptesExclus();
  const [ouvert, setOuvert] = React.useState(false);
  const [, tic] = React.useReducer((x) => x + 1, 0);
  const lireTransp = React.useCallback((force) => { fetchTranspLignes(force ? { force: true } : {}).then((t) => setTransp(t === undefined ? null : t), () => setTransp(null)); }, []);
  React.useEffect(() => {
    if (!actif || baseKO || horsLigne) return undefined;
    lireTransp(false);
    let attente = null;
    const plusTard = () => { if (attente) return; attente = setTimeout(() => { attente = null; relire(); }, 4000); };
    const ext = (e) => { const d = e && e.detail; if (d && d.type === 'maj') plusTard(); };
    const tr = () => lireTransp(true);
    const vis = () => { if (document.visibilityState === 'visible') tic(); };
    const t = setInterval(() => { if (document.visibilityState === 'hidden') return; relire(); lireTransp(true); }, RELECTURE_MS);
    const m = setInterval(tic, 60000);   // « vérifié il y a N min » avance
    window.addEventListener('vrm:ext', ext); window.addEventListener('vrm:transp-lu', tr); window.addEventListener('vrm:transp-maj', tr);
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); clearInterval(m); if (attente) clearTimeout(attente); window.removeEventListener('vrm:ext', ext); window.removeEventListener('vrm:transp-lu', tr); window.removeEventListener('vrm:transp-maj', tr); document.removeEventListener('visibilitychange', vis); };
  }, [actif, baseKO, horsLigne, relire, lireTransp]);

  const maintenant = Date.now();
  const cap = derniere.current;
  const f = fraicheurUnique({ baseKO, horsLigne, capture: cap, achats: cap ? cap.achats : undefined, emails, transp,
    exclu: (p, id) => estExclu(exclus, p, id), attendue: EXT_ATTENDUE, verifieAt: cap ? cap.at : null, maintenant });
  if (f.etat === 'cache') return null;

  const voirToutVaBien = () => { DEMANDE_REGLAGE_SOUS.id = 'toutvabien'; try { window.dispatchEvent(new Event('vrm:reglage-sous')); } catch (_) {} if (onNav) onNav('settings'); };
  const geste = (r) => {
    if (r.action === 'relire-suivi') return { libelle: 'Relire', faire: () => { relireTransporteursSiVieux({ force: true }).then(() => lireTransp(true)); } };
    if (r.vers === 'toutvabien') return { libelle: 'Voir', faire: voirToutVaBien };
    if (r.vers === 'settings') return { libelle: 'Réglages', faire: () => onNav && onNav('settings') };
    if (r.vers === 'vintedaccounts') return { libelle: 'Comptes', faire: () => onNav && onNav('vintedaccounts') };
    return null;
  };
  const premier = f.retards[0] || null;
  const autres = f.retards.length - 1;
  const panne = premier && premier.source === 'panne';
  const g = premier ? geste(premier) : null;
  const ton = f.etat === 'retard' ? 'geste' : f.etat === 'a-jour' ? 'ok' : 'passu';
  const quand = f.verifieAt ? quandReluCourt(f.verifieAt, maintenant) : '';
  const texte = f.etat === 'encours' ? 'Vérification de tes données…'
    : f.etat === 'a-jour' ? <>Tout est à jour{quand ? <span className="vrm-fraicheur-quand"> · vérifié {quand}</span> : null}</>
    : f.etat === 'passu' ? <>Pas pu tout vérifier : {f.passu.join(', ')} — rien n’est affirmé pour {f.passu.length > 1 ? 'eux' : 'ça'}.</>
    : <><b className={premier.plateforme ? 'vrm-sensible' : undefined}>{premier.nom}</b>{premier.plateforme && premier.source !== 'emails' ? <span className="vrm-fraicheur-site"> ({nomPlateforme(premier.plateforme)})</span> : null} {premier.texte}{premier.gesteCourt ? ` — ${premier.gesteCourt}` : ''}</>;
  const depliable = f.etat === 'retard' || (f.etat === 'passu');
  return (
    <div className="vrm-fraicheur-hote">
      <div className="vrm-bandeau-abo vrm-fraicheur" role="status" data-fraicheur-unique={f.etat} data-fraicheur-ton={ton}
        data-fraicheur-source={premier ? premier.source : undefined} data-fraicheur-cle={premier ? premier.cle : undefined}
        data-fraicheur-n={f.retards.length} data-fraicheur-passu={f.passu.length ? f.passu.join(',') : undefined}
        data-fraicheur-verifie={f.etat === 'a-jour' && f.verifieAt ? Math.max(0, Math.round((maintenant - f.verifieAt) / 60000)) : undefined}
        data-alerte-capture={panne ? f.retards.filter((r) => r.source === 'panne').length : undefined} data-alerte-cle={panne ? premier.cleAlerte : undefined}>
        <span className="vrm-bandeau-abo-point vrm-fraicheur-point" data-ton={ton} aria-hidden="true"/>
        {depliable
          ? <button type="button" className="vrm-bandeau-abo-texte vrm-fraicheur-texte" aria-expanded={ouvert ? 'true' : 'false'} data-fraicheur-deplier="" onClick={() => setOuvert((o) => !o)}>
              <span className="vrm-fraicheur-phrase">{texte}</span>
              {autres > 0 ? <span className="vrm-fraicheur-autres" data-fraicheur-autres={autres}>+ {autres} autre{autres > 1 ? 's' : ''}</span> : null}
            </button>
          : <span className="vrm-bandeau-abo-texte vrm-fraicheur-texte"><span className="vrm-fraicheur-phrase">{texte}</span></span>}
        {g ? <button type="button" className="vrm-lien-action vrm-bandeau-abo-geste" data-fraicheur-geste={premier.source} data-alerte-voir={panne ? '' : undefined} onClick={g.faire}>{g.libelle}</button> : null}
        {f.etat === 'passu' ? <button type="button" className="vrm-lien-action vrm-bandeau-abo-geste" data-fraicheur-reessayer="" onClick={() => { relire(); lireTransp(true); }}>Réessayer</button> : null}
      </div>
      {ouvert && depliable ? (
        <div className="vrm-fraicheur-detail" data-fraicheur-detail={f.retards.length}>
          {f.retards.map((r) => { const gg = geste(r); return (
            <div key={r.cle} className="vrm-fraicheur-rangee" data-fraicheur-rangee={r.source} data-fraicheur-rangee-cle={r.cle}>
              <div className="vrm-fraicheur-rangee-texte">
                <span><b className={r.plateforme ? 'vrm-sensible' : undefined}>{r.nom}</b>{r.plateforme && r.source !== 'emails' ? ` (${nomPlateforme(r.plateforme)})` : ''} {r.texte}</span>
                {r.geste ? <span className="vrm-fraicheur-rangee-geste">{r.geste.charAt(0).toUpperCase() + r.geste.slice(1)}.</span> : null}
              </div>
              {gg ? <button type="button" className="vrm-lien-action vrm-fraicheur-rangee-bouton" onClick={gg.faire}>{gg.libelle}</button> : null}
            </div>); })}
          {f.etat === 'retard' && f.passu.length ? <div className="vrm-fraicheur-rangee" data-fraicheur-rangee="passu"><div className="vrm-fraicheur-rangee-texte"><span>Pas pu vérifier : {f.passu.join(', ')} — rien n’est affirmé pour {f.passu.length > 1 ? 'eux' : 'ça'}.</span></div></div> : null}
          {f.verifieAt ? <div className="vrm-fraicheur-pied">Vérifié {quandReluCourt(f.verifieAt, maintenant)}{f.passu.length ? '.' : ' · le reste est à jour.'}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
export { phraseRetard };

// « à l'instant », « il y a 3 min », puis l'heure de Paris (quandRelu).
function quandReluCourt(t, maintenant) {
  const m = Math.max(0, Math.round((maintenant - t) / 60000));
  if (m < 1) return 'à l’instant';
  if (m < 60) return `il y a ${m} min`;
  return quandRelu(t, maintenant);
}
