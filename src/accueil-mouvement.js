// ── LE MOTEUR DE MOUVEMENT DE LA PAGE D'ACCUEIL ──────────────────────────────
// Toutes les durées et les courbes viennent des compétences du dépôt
// (.claude/skills : emil-design-eng, apple-design, animate). Trois règles :
//   1. chaque écran dessiné est une FONCTION PURE de son temps `s` (et des
//      positions mesurées) : même temps, même image — c'est ce qui permet de
//      filmer image par image (`?film`) avec le même code que la page ;
//   2. RIEN NE BOUCLE : un écran démarre une fois, quand on le voit, dure moins
//      de 5 s et s'arrête. Ensuite, plus aucune image n'est calculée ;
//   3. « réduire les animations » donne l'état FINAL dès le premier rendu.
import React from 'react';

export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
// Avancée bornée à [0, 1] de `s` entre `a` et `b` (en secondes).
export const seg = (s, a, b) => (b <= a ? (s >= b ? 1 : 0) : clamp01((s - a) / (b - a)));
export const mix = (a, b, x) => a + (b - a) * x;

// Évaluateur d'une courbe CSS `cubic-bezier(x1, y1, x2, y2)` : Newton
// (8 itérations), repli par dichotomie quand la pente s'écrase.
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t;
  const Y = (t) => ((ay * t + by) * t + cy) * t;
  const dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    x = clamp01(x);
    if (x === 0 || x === 1) return x;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = X(t) - x;
      if (Math.abs(e) < 1e-6) return Y(t);
      const d = dX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1; t = x;
    for (let i = 0; i < 40; i++) {
      const v = X(t);
      if (Math.abs(v - x) < 1e-6) break;
      if (v < x) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return Y(t);
  };
}
// Toute entrée, tout appui, tout changement d'état.
export const sortie = bezier(0.23, 1, 0.32, 1);
// Ce qui se DÉPLACE à l'écran (vols en X, curseur, caméra du film).
export const trajet = bezier(0.77, 0, 0.175, 1);
// UNIQUEMENT l'atterrissage d'un tampon : il arrive avec de l'élan, après un vol.
export const retombe = (x) => { x = clamp01(x); const u = x - 1; return 1 + 2.2 * u * u * u + 1.2 * u * u; };
export const lineaire = (x) => clamp01(x);

// ── L'HORLOGE PARTAGÉE ─────────────────────────────────────────────────────
// Une seule boucle `requestAnimationFrame` pour toute la page, qui ne tourne
// que tant qu'un écran joue. Le pas suit l'HORLOGE (pas le nombre d'images),
// borné à 0,25 s pour un vrai trou ; un pas négatif vaut 0 (vu au banc : le
// premier horodatage d'une image peut précéder le `performance.now()` pris
// juste avant — la leçon de l'ancien `dansBoucle`).
const lecteurs = new Set();
let raf = 0, prec = 0;
function tic(now) {
  const dt = Math.min(0.25, Math.max(0, (now - prec) / 1000));
  prec = now;
  [...lecteurs].forEach((f) => { try { f(dt); } catch (_) { lecteurs.delete(f); } });
  raf = lecteurs.size ? requestAnimationFrame(tic) : 0;
}
export function ecouterHorloge(f) {
  lecteurs.add(f);
  if (!raf) { prec = performance.now(); raf = requestAnimationFrame(tic); }
  return () => { lecteurs.delete(f); };
}

// ── LES PRÉFÉRENCES DU SYSTÈME, ÉCOUTÉES EN DIRECT ──────────────────────────
const lireMedia = (requetes) => { try { return requetes.every((q) => window.matchMedia(q).matches); } catch (_) { return false; } };
function useMedia(requetes) {
  const [v, setV] = React.useState(() => lireMedia(requetes));
  React.useEffect(() => {
    const maj = () => setV(lireMedia(requetes));
    const mqs = [];
    requetes.forEach((q) => { try { const m = window.matchMedia(q); m.addEventListener('change', maj); mqs.push(m); } catch (_) {} });
    maj();
    return () => mqs.forEach((m) => { try { m.removeEventListener('change', maj); } catch (_) {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return v;
}
const MOINS = ['(prefers-reduced-motion: reduce)'];
const SANS_SOURIS = ['(pointer: coarse)', '(hover: none)'];
// « Réduire les animations » : une erreur vaut `false`.
export const useMoinsDeMouvement = () => useMedia(MOINS);
// ⚠️ LE MÊME TEST QUE `useSansSouris` D'App.jsx : `(pointer: coarse)` ET
//    `(hover: none)` — aucune souris du tout. Ne pas les laisser diverger : la
//    page et l'app doivent dire la même chose au même appareil.
export const useSansSouris = () => useMedia(SANS_SOURIS);

// ── UNE SCÈNE QUI JOUE UNE FOIS, QUAND ON LA VOIT ───────────────────────────
// Rend `{ s, etat, rejouer }` :
//   • `etat` vaut 'debut' tant que rien n'a commencé, 'joue', puis 'fin' ;
//   • démarre UNE fois, quand l'élément est visible à `seuil` (mesuré dans la
//     fenêtre réduite par `marge`) ET que les polices sont chargées, après
//     `attente` ms ;
//   • se met en pause onglet caché ou élément hors de l'écran (seuil 0,05), et
//     reprend où il en était ;
//   • moins de mouvement : `s = duree`, `etat = 'fin'` dès le premier rendu, et
//     tout de suite si le réglage change pendant la lecture.
// ⚠️ `marge` : un écran dessiné ne démarre pas tant qu'il n'est que dans le
//    quart BAS de la fenêtre — sinon, en lisant la section du dessus, on lance
//    celle d'en dessous sans la regarder (et elle a fini quand on y arrive).
export function useScene(ref, duree, { seuil = 0.35, attente = 0, marge = '0px' } = {}) {
  const reduit = useMoinsDeMouvement();
  const [s, setS] = React.useState(reduit ? duree : 0);
  const [etat, setEtat] = React.useState(reduit ? 'fin' : 'debut');
  const r = React.useRef(null);
  if (!r.current) r.current = { t: reduit ? duree : 0, joue: false, vu: false, visible: false, polices: false, minuterie: 0, stop: null, reduit };
  const x = r.current;
  x.reduit = reduit;

  const maj = React.useCallback(() => {
    const doit = x.joue && x.visible && !document.hidden && !x.reduit;
    if (doit && !x.stop) {
      x.stop = ecouterHorloge((dt) => {
        x.t = Math.min(duree, x.t + dt);
        setS(x.t);
        if (x.t >= duree) { x.joue = false; if (x.stop) { x.stop(); x.stop = null; } setEtat('fin'); }
      });
    } else if (!doit && x.stop) { x.stop(); x.stop = null; }
  }, [duree, x]);

  const demarrer = React.useCallback(() => {
    if (x.reduit) return;
    x.t = 0; x.joue = true; setS(0); setEtat('joue'); maj();
  }, [maj, x]);

  const planifier = React.useCallback(() => {
    if (x.vu && x.polices && !x.lance && !x.reduit) {
      x.lance = true;
      x.minuterie = setTimeout(() => { x.minuterie = 0; demarrer(); }, attente);
    }
  }, [attente, demarrer, x]);

  React.useEffect(() => {
    if (reduit) {
      x.joue = false; if (x.stop) { x.stop(); x.stop = null; }
      if (x.minuterie) { clearTimeout(x.minuterie); x.minuterie = 0; }
      x.t = duree; x.lance = true; setS(duree); setEtat('fin');
    }
  }, [reduit, duree, x]);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let fini = false;
    const polices = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    polices.then(() => { if (!fini) { x.polices = true; planifier(); } }, () => { if (!fini) { x.polices = true; planifier(); } });
    let ioDepart = null, ioPause = null;
    try {
      ioDepart = new IntersectionObserver((es) => {
        const e = es[es.length - 1];
        if (e && e.isIntersecting && e.intersectionRatio >= seuil - 0.001) { x.vu = true; planifier(); }
      }, { threshold: [0, seuil], rootMargin: marge });
      ioDepart.observe(el);
      ioPause = new IntersectionObserver((es) => {
        const e = es[es.length - 1];
        x.visible = !!(e && e.isIntersecting && e.intersectionRatio >= 0.05);
        maj();
      }, { threshold: [0, 0.05] });
      ioPause.observe(el);
    } catch (_) { x.vu = true; x.visible = true; planifier(); maj(); }
    const vis = () => maj();
    document.addEventListener('visibilitychange', vis);
    return () => {
      fini = true;
      document.removeEventListener('visibilitychange', vis);
      try { ioDepart && ioDepart.disconnect(); ioPause && ioPause.disconnect(); } catch (_) {}
      if (x.minuterie) { clearTimeout(x.minuterie); x.minuterie = 0; }
      if (x.stop) { x.stop(); x.stop = null; }
    };
  }, [ref, seuil, marge, planifier, maj, x]);

  const rejouer = React.useCallback(() => {
    if (x.reduit) return;
    x.lance = true; x.vu = true;
    if (x.minuterie) { clearTimeout(x.minuterie); x.minuterie = 0; }
    demarrer();
  }, [demarrer, x]);

  return { s, etat, rejouer, reduit };
}

// ── MESURER UNE POSITION DANS UN ÉCRAN DESSINÉ ──────────────────────────────
// Le centre de `el`, dans le repère de `conteneur`, en pixels de MISE EN PAGE :
// on divise par l'échelle rendue, sinon un écran agrandi (le film le pose à
// ×1,6) placerait ses vols au mauvais endroit.
export function centreDans(el, conteneur) {
  if (!el || !conteneur) return null;
  const c = conteneur.getBoundingClientRect(), e = el.getBoundingClientRect();
  const k = conteneur.offsetWidth ? c.width / conteneur.offsetWidth : 1;
  if (!k) return null;
  return { x: (e.left + e.width / 2 - c.left) / k, y: (e.top + e.height / 2 - c.top) / k, w: e.width / k, h: e.height / k };
}

// Relance une mesure quand le conteneur change de taille (rotation, fenêtre).
export function useTaille(ref) {
  const [taille, setTaille] = React.useState({ w: 0, h: 0 });
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const lire = () => setTaille((v) => (v.w === el.offsetWidth && v.h === el.offsetHeight ? v : { w: el.offsetWidth, h: el.offsetHeight }));
    lire();
    let ro = null;
    try { ro = new ResizeObserver(lire); ro.observe(el); } catch (_) {}
    return () => { try { ro && ro.disconnect(); } catch (_) {} };
  }, [ref]);
  return taille;
}

// Un vol : X en `trajet`, Y en `sortie` — ça dessine un arc. `p` ∈ [0, 1].
export const volXY = (a, b, p) => ({ x: mix(a.x, b.x, trajet(p)), y: mix(a.y, b.y, sortie(p)) });
