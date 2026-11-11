// (11 nov., temps réel) La veille qui fait arriver ce que l'extension capte SANS
// recharger (src/tempsReel.js), et sa pastille discrète « Mis à jour à hh:mm ».
// La pastille flotte (position fixe) : elle ne pousse rien, aucun écran ne saute.
// Neutre (ni ambre ni rouge : aucun geste à faire) ; elle s'efface seule.
import React from 'react';
import './styles-temps-reel.css';
import { creerVeille, ouvrirCanal, noterNeuf, ecouterNeuf, oublierNeuf, EVENEMENT, PERIODE_MS, PERIODE_REALTIME_MS } from './tempsReel.js';
import { rythme } from './rythmeLectures.js';
import { heureVu } from './copieLignes.js';

const AFFICHAGE_MS = 6000;
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
    let t = null;
    const off = ecouterNeuf((x) => { setAt(x); if (t) clearTimeout(t); t = setTimeout(() => setAt(null), AFFICHAGE_MS); });
    return () => { off(); if (t) clearTimeout(t); };
  }, []);
  const h = at ? heureVu(at) : null;
  return <div className="vrm-neuf-hote" role="status" aria-live="polite">
    {h ? <div className="vrm-neuf" data-temps-reel-neuf={at}><span className="vrm-neuf-point" aria-hidden="true"/><span>Mis à jour à {h}</span></div> : null}
  </div>;
}
