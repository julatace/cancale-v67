// ════════════════════════════════════════════════════════════════════════════
//  L'OUVERTURE INSTANTANÉE — LE RENDU AVANT L'APP (14 nov.)
//  La décision est src/ouvertureInstantanee.js. Ici : peindre l'instantané de Ma
//  journée DANS l'écran de démarrage d'index.html (`#vrm-demarrage`), avant que les
//  5 Mo de l'app soient analysés et exécutés, puis rendre la main à src/main.jsx.
//
//    · le MÊME composant que la coque (src/JourneeInstantanee.jsx) : inerte, daté
//      (« Mis à jour il y a 7 min »), « Vérification… » sur le geste, attributs
//      `data-ji-*` (rien ne le lit comme frais) ;
//    · à la MÊME place que l'écran vrai : le cadre relevé à la capture (boîte, classes
//      et variables de couleur de la coque) — seulement à la même largeur de fenêtre
//      et dans le même thème, sinon rien n'est peint (l'ouverture d'avant) ;
//    · la feuille de l'app (déjà préchargée par public/demarrage-app.js) est chargée
//      d'abord, 1,5 s au plus — sans elle, rien n'est peint (jamais un écran sans style) ;
//    · il part AVEC l'écran de démarrage (src/demarrage.js : quand la page montre autre
//      chose qu'une attente — la coque et SON instantané, une connexion, une porte) ;
//    · AUCUNE écriture, aucune requête vers la base : il ne fait que lire l'appareil.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { JourneeInstantanee } from './JourneeInstantanee.jsx';
import { fmt } from './format.js';
import { apercuOuverture, cadreUtilisable, apercuCopie } from './ouvertureInstantanee.js';
// (20 nov., affichage instantané) La COPIE de l'écran qui s'ouvre (src/copieEcran.js) : sa coque copiée, peinte telle
// quelle (inerte, datée) avant l'app. Lue d'IndexedDB (400 ms au plus) ; gardée en mémoire pour la coque de l'app,
// qui la montre à la même place dès son premier rendu.
import { prechargerCopie, lireIndexCopies } from './copieEcran.js';
import { CoqueCopie } from './CopieEcran.jsx';

const DELAI_FEUILLE_MS = 1500;

// La feuille de l'app, comme le chargeur de Vite la poserait (même `href`, `crossOrigin` vide) :
// il la trouvera posée et ne la redemandera pas.
function chargerFeuille(href) {
  return new Promise((ok, ko) => {
    const deja = document.querySelector(`link[href="${href}"][rel="stylesheet"]`);
    if (deja) { if (deja.sheet) ok(); else { deja.addEventListener('load', ok); deja.addEventListener('error', ko); } return; }
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.crossOrigin = ''; l.href = href;
    l.addEventListener('load', ok); l.addEventListener('error', ko);
    document.head.appendChild(l);
  });
}
const feuillesApp = () => {
  const s = document.querySelector('script[data-css]');
  return String((s && s.getAttribute('data-css')) || '').split(',').map((x) => x.trim()).filter((x) => /^\/assets\/[\w.-]+\.css$/.test(x));
};

function Apercu({ snap, cadre }) {
  return (
    <div className={cadre.shell} style={cadre.vars} data-espace="journee" data-ouverture-instantanee="">   {/* (16 nov.) l'espace de la coque : les règles du verre (fond, cartes, encres) s'y appliquent comme dans l'app */}
      {/* La barre fixe du haut de la coque : sa place et sa couleur seulement (ses boutons arrivent avec l'app). */}
      {cadre.haut > 0 && cadre.barre ? <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: cadre.haut, background: cadre.barre }}/> : null}
      <main className={cadre.main} data-ecran="journee" style={{ top: cadre.haut }}>
        <div style={{ position: 'absolute', top: 0, left: cadre.gauche, width: cadre.large }}>
          <JourneeInstantanee snap={snap} fmt={fmt}/>
        </div>
      </main>
    </div>
  );
}

// Peint l'instantané et rend `true` une fois l'image À L'ÉCRAN (la frame suivante), ou `false`
// (rien de peint : l'ouverture d'avant). Ne lève jamais.
export async function peindreApercu(decision) {
  try {
    if (!decision || !decision.snap || typeof document === 'undefined') return false;
    const boot = document.getElementById('vrm-demarrage');
    if (!boot || boot.hasAttribute('data-sortie')) return false;
    const cadre = cadreUtilisable(decision.snap.cadre, { largeur: Math.round(window.innerWidth || 0), theme: document.documentElement.getAttribute('data-theme') || '' });
    if (!cadre) return false;
    const feuilles = feuillesApp();
    if (!feuilles.length) return false;
    let minuteur = 0;
    const charge = await Promise.race([
      Promise.all(feuilles.map(chargerFeuille)).then(() => true, () => false),
      new Promise((r) => { minuteur = setTimeout(() => r(false), DELAI_FEUILLE_MS); }),
    ]);
    clearTimeout(minuteur);
    // L'écran de démarrage a pu partir pendant ce temps (une porte, la connexion) : rien à peindre.
    if (!charge || !document.getElementById('vrm-demarrage') || boot.hasAttribute('data-sortie')) return false;
    const hote = document.createElement('div');
    hote.id = 'vrm-apercu';
    boot.setAttribute('data-apercu', '');
    boot.appendChild(hote);
    const racine = createRoot(hote);
    flushSync(() => racine.render(<Apercu snap={decision.snap} cadre={cadre}/>));
    try { performance.mark('vrm:apercu'); } catch (_) {}
    window.addEventListener('vrm:demarrage-fin', () => { setTimeout(() => { try { racine.unmount(); } catch (_) {} }, 400); }, { once: true });
    // La main revient à main.jsx APRÈS la peinture : l'analyse de l'app (une longue tâche) ne la retarde pas.
    await new Promise((r) => {
      let fait = false; const fin = () => { if (!fait) { fait = true; r(); } };
      try { requestAnimationFrame(() => setTimeout(fin, 0)); } catch (_) {}
      setTimeout(fin, 120);   // onglet caché : pas de frame, on n'attend pas
    });
    return true;
  } catch (_) { return false; }
}

const DELAI_COPIE_MS = 400;
// Peint la copie de la coque d'un écran. `true` = peinte (l'image est à l'écran).
export async function peindreCopie(copie) {
  try {
    if (!copie || !copie.coque || !copie.coque.html || typeof document === 'undefined') return false;
    const boot = document.getElementById('vrm-demarrage');
    if (!boot || boot.hasAttribute('data-sortie')) return false;
    const feuilles = feuillesApp();
    if (!feuilles.length) return false;
    let minuteur = 0;
    const charge = await Promise.race([
      Promise.all(feuilles.map(chargerFeuille)).then(() => true, () => false),
      new Promise((r) => { minuteur = setTimeout(() => r(false), DELAI_FEUILLE_MS); }),
    ]);
    clearTimeout(minuteur);
    if (!charge || !document.getElementById('vrm-demarrage') || boot.hasAttribute('data-sortie')) return false;
    const hote = document.createElement('div');
    hote.id = 'vrm-apercu';
    hote.setAttribute('style', 'position:absolute;inset:0;overflow:hidden;text-align:left;display:block');
    boot.setAttribute('data-apercu', '');
    boot.appendChild(hote);
    const racine = createRoot(hote);
    flushSync(() => racine.render(<CoqueCopie copie={copie}/>));
    try { performance.mark('vrm:apercu-copie'); } catch (_) {}
    window.addEventListener('vrm:demarrage-fin', () => { setTimeout(() => { try { racine.unmount(); } catch (_) {} }, 400); }, { once: true });
    await new Promise((r) => {
      let fait = false; const fin = () => { if (!fait) { fait = true; r(); } };
      try { requestAnimationFrame(() => setTimeout(fin, 0)); } catch (_) {}
      setTimeout(fin, 120);
    });
    return true;
  } catch (_) { return false; }
}
async function ouvrirAvecCopie({ stock, search }) {
  let d = null;
  try {
    const s0 = JSON.parse(stock.getItem('vrm_session') || 'null');
    const uid0 = s0 && s0.user && s0.user.id;
    d = apercuCopie({ stock, search, largeur: Math.round(window.innerWidth || 0), theme: document.documentElement.getAttribute('data-theme') || '', index: uid0 ? lireIndexCopies(uid0, stock) : {} });
  } catch (_) { d = null; }
  if (!d || !d.uid) { try { window.__vrmApercuCopie = (d && d.raison) || 'non'; } catch (_) {} return false; }
  let minuteur = 0;
  const copie = await Promise.race([
    prechargerCopie(d.uid, d.ecran, { largeur: Math.round(window.innerWidth || 0) }).catch(() => null),
    new Promise((r) => { minuteur = setTimeout(() => r(null), DELAI_COPIE_MS); }),
  ]);
  clearTimeout(minuteur);
  if (!copie || !copie.coque) { try { window.__vrmApercuCopie = 'pas-lue'; } catch (_) {} return false; }
  const peint = await peindreCopie(copie);
  try { window.__vrmApercuCopie = peint ? 'oui:' + d.ecran : 'pas-peinte'; } catch (_) {}
  return peint;
}

// Ce que src/main.jsx appelle : décider (src/ouvertureInstantanee.js), puis peindre. `true` = peint.
// (20 nov.) La copie de l'écran qui s'ouvre d'abord ; sinon l'instantané de Ma journée, comme avant.
export async function ouvrirAvecInstantane({ stock, search }) {
  try { if (await ouvrirAvecCopie({ stock, search })) return true; } catch (_) {}
  let d = null;
  try { d = apercuOuverture({ stock, search }); } catch (_) { d = null; }
  try { window.__vrmApercu = d ? (d.snap ? 'oui' : d.raison || 'non') : 'non'; } catch (_) {}
  if (!d || !d.snap) return false;
  const peint = await peindreApercu(d);
  try { if (!peint) window.__vrmApercu = 'pas-peint'; } catch (_) {}
  return peint;
}
