// (11 nov., temps réel) La veille qui fait arriver ce que l'extension capte SANS
// recharger (src/tempsReel.js), et sa pastille discrète « Mis à jour à hh:mm ».
// La pastille flotte (position fixe) : elle ne pousse rien, aucun écran ne saute.
// Neutre (ni ambre ni rouge : aucun geste à faire) ; elle s'efface seule.
import React from 'react';
import './styles-temps-reel.css';
import { creerVeille, ouvrirCanal, noterNeuf, noterLue, ecouterNeuf, oublierNeuf, EVENEMENT, PERIODE_MS, PERIODE_REALTIME_MS, REPRISE_FORCEE_MS, REVEIL_MIN_MS } from './tempsReel.js';
import { rythme } from './rythmeLectures.js';
import { heureVu } from './copieLignes.js';
import { trj } from './i18n/react.js';
import { installerPasserelleVeille } from './passerelleVeille.js';

// ⚠️ (14 nov., refonte de la coque — Julien, capture : « Mis à jour à 08:19 » posé EN PERMANENCE sur la
// liste) La veille relit toutes les 5 à 30 s ; chaque lecture qui trouvait du neuf rallumait la pastille
// pour 6 s : elle ne quittait plus l'écran. Désormais elle se montre 2 s, puis se TAIT au moins une
// minute (l'heure affichée change à la minute : la redire plus tôt n'apprend rien). Le neuf arrive
// quand même à l'écran à chaque lecture : seule la pastille se tait.
const AFFICHAGE_MS = 2000;
const SILENCE_MS = 60000;
// Les lignes qui ne font que compter (jauge, journal) ne disent pas « mis à jour ».
// (16 nov.) Messages, Leboncoin, Vestiaire : leurs écrans relisent (src/passerelleVeille.js) ; un e-mail
// rangé ne fait que montrer « Actualiser » (rien n'est relu sans son geste) : pas de pastille.
const VISIBLES = new Set(['ventes', 'achats', 'annonces', 'suivi', 'import', 'transp', 'messages', 'lbc', 'vestiaire']);

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
      surLue: (at) => noterLue(at),
      diffuser: (d) => {
        try { window.dispatchEvent(new CustomEvent(EVENEMENT, { detail: d })); } catch (_) {}
        if ((d.quoi || []).some((q) => VISIBLES.has(q.quoi))) noterNeuf(d.at);
      },
    });
    try { window.__vrmVeille = veille; } catch (_) {}
    // Leboncoin et Vestiaire : le signal de l'extension rejoué pour leurs écrans (src/passerelleVeille.js).
    const offPasserelle = installerPasserelleVeille(window);
    // Realtime seulement si la base le dit prête (`vrm_temps_reel()`, migration 040) : avant
    // la migration, ou dans un banc, aucune prise n'est ouverte — le sondage suffit.
    let canal = { fermer() {}, reprendre() {}, etat: () => 'absent' }, mort = false, dejaJoint = false;
    Promise.resolve().then(() => (pret.current ? pret.current() : false)).then((oui) => {
      if (mort || oui !== true) return;
      try {
        canal = ouvrirCanal({ url: urlBase, cleApi, uid, jeton: () => (jt.current ? jt.current() : null), surLigne: (r) => { veille.recu(r); try { window.dispatchEvent(new CustomEvent('vrm:ligne', { detail: { id: String(r.id || '') } })); } catch (_) {} },   // (22 nov., à distance) l'identifiant seul, tout de suite (sans le budget de la veille)
          surEtat: (e) => {
            try { document.documentElement.setAttribute('data-temps-reel', e); } catch (_) {}
            // (25 nov.) Une prise qui se RE-joint (coupée, rouverte) n'a rien reçu pendant la coupure : une sonde rattrape.
            if (e === 'joint') { if (dejaJoint) reveil(); dejaJoint = true; }
          } });
      } catch (_) {}
    }).catch(() => {});
    const R = rythme();
    // (25 nov., Julien : « je dois fermer l'app et la rouvrir pour avoir les nouvelles infos ») Le sondage ne ralentit
    // à 2 min que si Realtime a prouvé qu'il apporte ET que sa prise est jointe MAINTENANT : une prise coupée (iPhone en
    // arrière-plan, réseau changé) remet la sonde à 15 s.
    const tic = () => {
      if (estCache.current && estCache.current()) return;
      const periode = veille.realtimeProuve() && canal.etat() === 'joint' ? PERIODE_REALTIME_MS : PERIODE_MS;
      if (R.doitLire('veille-temps-reel', periode)) veille.sonder();
    };
    // La première lecture laisse d'abord les écrans faire la leur (rien à comparer avant).
    const premier = setTimeout(() => { R.noter('veille-temps-reel'); veille.sonder(); }, 4000);
    const t = setInterval(tic, 5000);
    // AU RÉVEIL, TOUT DE SUITE (25 nov.) : retour au premier plan (`visibilitychange`, `pageshow` d'une page gardée en
    // mémoire — l'app de l'écran d'accueil de l'iPhone ne se recharge pas), focus, réseau revenu, prise Realtime rejointe,
    // ou signal du service worker (une notification push vient d'arriver : vente, offre, message, e-mail). Une sonde des
    // VERSIONS (jamais une ligne entière), au plus une toutes les `REVEIL_MIN_MS` ; ce qui a changé est relu par l'écran
    // qui le montre (`vrm:neuf`). Rien pour une page cachée : elle sondera à son retour.
    let dernierReveil = 0, cacheDepuis = null;
    const reveil = () => {
      if (mort || (estCache.current && estCache.current())) return;
      try { if (document.visibilityState === 'hidden') return; } catch (_) {}
      const at = Date.now();
      if (at - dernierReveil < REVEIL_MIN_MS) return;
      dernierReveil = at;
      R.noter('veille-temps-reel'); veille.sonder();
    };
    const vis = () => {
      let cachee = false; try { cachee = document.visibilityState === 'hidden'; } catch (_) {}
      if (cachee) { if (cacheDepuis == null) cacheDepuis = Date.now(); return; }
      const longtemps = cacheDepuis != null && Date.now() - cacheDepuis >= REPRISE_FORCEE_MS;
      cacheDepuis = null;
      try { canal.reprendre({ force: longtemps }); } catch (_) {}
      reveil();
    };
    const pageshow = (e) => { if (e && e.persisted) { try { canal.reprendre({ force: true }); } catch (_) {} } reveil(); };
    const enLigne = () => { try { canal.reprendre(); } catch (_) {} reveil(); };
    const sw = (m) => { const d = m && m.data; if (d && (d.type === 'vrm-signal' || d.type === 'vrm-evenement')) reveil(); };
    try {
      document.addEventListener('visibilitychange', vis); window.addEventListener('pageshow', pageshow);
      window.addEventListener('focus', reveil); window.addEventListener('online', enLigne);
      if (navigator.serviceWorker && navigator.serviceWorker.addEventListener) navigator.serviceWorker.addEventListener('message', sw);
    } catch (_) {}
    const offReveil = R.surReveil(() => { R.noter('veille-temps-reel'); veille.sonder(); });
    return () => {
      mort = true; try { offPasserelle(); } catch (_) {} clearTimeout(premier); clearInterval(t); offReveil(); veille.arreter(); try { canal.fermer(); } catch (_) {} oublierNeuf(); try { if (window.__vrmVeille === veille) delete window.__vrmVeille; } catch (_) {}
      try {
        document.removeEventListener('visibilitychange', vis); window.removeEventListener('pageshow', pageshow);
        window.removeEventListener('focus', reveil); window.removeEventListener('online', enLigne);
        if (navigator.serviceWorker && navigator.serviceWorker.removeEventListener) navigator.serviceWorker.removeEventListener('message', sw);
      } catch (_) {}
    };
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
