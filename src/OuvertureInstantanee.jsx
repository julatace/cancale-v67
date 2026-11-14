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

// Le cadre relevé à la capture, s'il vaut pour CETTE fenêtre et CE thème.
export function cadreUtilisable(cadre, { largeur, theme }) {
  if (!cadre || typeof cadre !== 'object') return null;
  if (!(Math.abs((Number(cadre.vw) || 0) - largeur) < 2)) return null;
  if ((cadre.theme || '') !== (theme || '')) return null;
  const n = (x) => (Number.isFinite(Number(x)) ? Math.round(Number(x)) : null);
  const haut = n(cadre.haut), gauche = n(cadre.gauche), large = n(cadre.large);
  if (haut == null || gauche == null || !large || haut < 0 || haut > 600 || gauche < 0 || large > largeur + 2) return null;
  const propre = (c) => String(c || '').split(/\s+/).filter((x) => /^[a-z][\w-]{0,60}$/i.test(x)).slice(0, 12).join(' ');
  const vars = {};
  for (const [k, v] of Object.entries(cadre.vars || {})) if (/^--[\w-]{1,60}$/.test(k) && typeof v === 'string' && v.length <= 160 && !/url\s*\(|expression|[<>{};]/i.test(v)) vars[k] = v;
  return { haut, gauche, large, shell: propre(cadre.shell) || 'vrm-app-shell', main: propre(cadre.main) || 'vrm-main', vars };
}

function Apercu({ snap, cadre }) {
  return (
    <div className={cadre.shell} style={cadre.vars} data-ouverture-instantanee="">
      <main className={cadre.main} data-ecran="journee">
        <div style={{ position: 'absolute', top: cadre.haut, left: cadre.gauche, width: cadre.large }}>
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
