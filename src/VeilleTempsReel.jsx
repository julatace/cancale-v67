// (11 nov., temps réel) La veille qui fait arriver ce que l'extension capte SANS
// recharger (src/tempsReel.js), et sa pastille discrète « Mis à jour à hh:mm ».
// La pastille flotte (position fixe) : elle ne pousse rien, aucun écran ne saute.
// Neutre (ni ambre ni rouge : aucun geste à faire) ; elle s'efface seule.
import React from 'react';
import './styles-temps-reel.css';
import { creerVeille, ouvrirCanal, noterNeuf, ecouterNeuf, oublierNeuf, EVENEMENT, PERIODE_MS, PERIODE_REALTIME_MS } from './tempsReel.js';
import { rythme } from './rythmeLectures.js';
import { heureVu } from './copieLignes.js';
import { trj } from './i18n/react.js';

// ⚠️ (14 nov., refonte de la coque — Julien, capture : « Mis à jour à 08:19 » posé EN PERMANENCE sur la
// liste) La veille relit toutes les 5 à 30 s ; chaque lecture qui trouvait du neuf rallumait la pastille
// pour 6 s : elle ne quittait plus l'écran. Désormais elle se montre 2 s, puis se TAIT au moins une
// minute (l'heure affichée change à la minute : la redire plus tôt n'apprend rien). Le neuf arrive
// quand même à l'écran à chaque lecture : seule la pastille se tait.
const AFFICHAGE_MS = 2000;
const SILENCE_MS = 60000;
// Les lignes qui ne font que compter (jauge, journal) ne disent pas « mis à jour ».
const VISIBLES = new Set(['ventes', 'achats', 'annonces', 'suivi', 'import', 'transp']);

export default function VeilleTempsReel({ uid, lireDepuis, urlBase, cleApi, jeton, cache, realtimePret }) {
  const lire = React.useRef(lireDepuis); lire.current = lireDepuis;
  const jt = React.useRef(jeton); jt.current = jeton;
  const estCache = React.useRef(cache); estCache.current = cache;
  const pret = React.useRef(realtimePret); pret.current = realtimePret;
  React.useEffect(() => {
    if (!uid || typeof window === 'undefined') return undefined;
    const veille = creerVeille({
      uid,
      lireDepuis: (x) => lire.current(x),
      diffuser: (d) => {
        try { window.dispatchEvent(new CustomEvent(EVENEMENT, { detail: d })); } catch (_) {}
        if ((d.quoi || []).some((q) => VISIBLES.has(q.quoi))) noterNeuf(d.at);
      },
    });
    try { window.__vrmVeille = veille; } catch (_) {}
    // Realtime seulement si la base le dit prête (`vrm_temps_reel()`, migration 040) : avant
    // la migration, ou dans un banc, aucune prise n'est ouverte — le sondage suffit.
    let canal = { fermer() {} }, mort = false;
    Promise.resolve().then(() => (pret.current ? pret.current() : false)).then((oui) => {
      if (mort || oui !== true) return;
      try {
        canal = ouvrirCanal({ url: urlBase, cleApi, uid, jeton: () => (jt.current ? jt.current() : null), surLigne: (r) => veille.recu(r),
          surEtat: (e) => { try { document.documentElement.setAttribute('data-temps-reel', e); } catch (_) {} } });
      } catch (_) {}
    }).catch(() => {});
    const R = rythme();
    const tic = () => {
      if (estCache.current && estCache.current()) return;
      const periode = veille.realtimeProuve() ? PERIODE_REALTIME_MS : PERIODE_MS;
      if (R.doitLire('veille-temps-reel', periode)) veille.sonder();
    };
    // La première lecture laisse d'abord les écrans faire la leur (rien à comparer avant).
    const premier = setTimeout(() => { R.noter('veille-temps-reel'); veille.sonder(); }, 4000);
    const t = setInterval(tic, 5000);
    const reveil = R.surReveil(() => { R.noter('veille-temps-reel'); veille.sonder(); });
    return () => { mort = true; clearTimeout(premier); clearInterval(t); reveil(); veille.arreter(); try { canal.fermer(); } catch (_) {} oublierNeuf(); try { if (window.__vrmVeille === veille) delete window.__vrmVeille; } catch (_) {} };
  }, [uid, urlBase, cleApi]);
  return <PastilleNeuf/>;
}

function PastilleNeuf() {
  const [at, setAt] = React.useState(null);
  React.useEffect(() => {
    let t = null, dernier = 0;
    const off = ecouterNeuf((x) => {
      const maintenant = Date.now();
      if (maintenant - dernier < SILENCE_MS) return;
      dernier = maintenant;
      setAt(x); if (t) clearTimeout(t); t = setTimeout(() => setAt(null), AFFICHAGE_MS);
    });
    return () => { off(); if (t) clearTimeout(t); };
  }, []);
  const h = at ? heureVu(at) : null;
  return <div className="vrm-neuf-hote" role="status" aria-live="polite">
    {h ? <div className="vrm-neuf" data-temps-reel-neuf={at}><span className="vrm-neuf-point" aria-hidden="true"/><span>{trj('coque.misAJour', { h })}</span></div> : null}
  </div>;
}
