// ── LE FILM « UNE JOURNÉE AVEC VRM » (`?film`, `?film=court`) ────────────────
// Un vrai film de motion design, muet et lisible sans le son. Trois actes :
//   1. la galère, en typographie (trois sites, des colis sans numéro, une
//      déclaration à faire) ;
//   2. tout est aspiré dans VRM, et la carte « Aujourd'hui » joue sa vente ;
//   3. les trois questions de la journée, qui RESTENT à l'écran (en légende)
//      pendant leur réponse, avec l'horloge qui roule : 8 h 01 → 8 h 02 →
//      8 h 03 → 31 octobre.
// Signature : on ne passe JAMAIS par le noir — chaque plan s'enchaîne au
// suivant par un élément commun (la ligne « Colis à poster », le 128 du
// carton, les 85,00 € de la tuile Vinted). Une seule chose bouge à la fois.
//
// ⚠️ C'est le MÊME code que la page : la carte et les écrans dessinés sont
//    importés tels quels et reçoivent le temps du film (fonction pure : le même
//    `t` donne la même image, dans n'importe quel ordre). `scripts/film-accueil.cjs`
//    le rend image par image en MP4 (60 images/s).
// ⚠️ AUCUN PRIX D'ABONNEMENT, ni « gratuit », ni Vestiaire, ni détourage : une
//    vidéo publiée ne se met pas à jour. Elle renvoie à vrm.center.
// ⚠️ Ce morceau n'est chargé qu'avec `?film` (main.jsx) : un visiteur de la page
//    ne le télécharge jamais.
import React from 'react';
import { K } from './accueil-jetons.js';

// La couleur du fond du film, avec une opacité (pour les voiles en dégradé).
const voileRgba = (a) => {
  const h = String(K.bg || '').replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  return [r, g, b].every(Number.isFinite) ? `rgba(${r},${g},${b},${a})` : `rgba(244,246,250,${a})`;
};
import { DEMO, PLATEFORMES, euros } from './accueil-demo.js';
import { seg, mix, sortie, trajet, clamp01, centreDans } from './accueil-mouvement.js';
import { CarteJourEcran } from './accueil-carte.jsx';
import { EcranColis, EcranAilleurs, EcranMois } from './accueil-scenes.jsx';

const V = DEMO.vente, R = DEMO.reste;
const POLICE_TITRE = "'Space Grotesk','Inter',system-ui,sans-serif";

// ── Les plans ──────────────────────────────────────────────────────────────
const PLANS_LONG = [
  ['ouverture', 0, 2], ['galere', 2, 5.5], ['carte', 5.5, 9], ['q1', 9, 10.5], ['colis', 10.5, 15.5],
  ['q2', 15.5, 17], ['ailleurs', 17, 22], ['q3', 22, 23.5], ['mois', 23.5, 28], ['reste', 28, 30.5], ['fin', 30.5, 35],
];
const PLANS_COURT = [
  ['ouverture', 0, 1.2], ['carte', 1.2, 4.5], ['q1', 4.5, 5.5], ['colis', 5.5, 9.5], ['q2', 9.5, 10.3], ['ailleurs', 10.3, 12.8], ['fin', 12.8, 15],
];
const planDe = (t, plans) => { for (const [n, a, b] of plans) if (t >= a && t < b) return n; return plans[plans.length - 1][0]; };

// ── Les pièces ─────────────────────────────────────────────────────────────
// Un titre qui entre MOT PAR MOT (45 ms d'écart, 420 ms, flou 6 → 0) et sort
// d'un bloc (220 ms, plus rapide que l'entrée).
function Mots({ texte, t, t0, tSortie, style, couleur = K.text }) {
  if (t < t0) return null;
  const ps = tSortie != null ? seg(t, tSortie, tSortie + 0.22) : 0;
  if (ps >= 1) return null;
  const mots = texte.split(' ');
  return (
    <div style={{ ...style, color: couleur, opacity: 1 - ps, transform: ps > 0 ? `translateY(${(-8 * sortie(ps)).toFixed(2)}px)` : undefined }}>
      {mots.map((m, i) => {
        const p = sortie(seg(t, t0 + 0.045 * i, t0 + 0.045 * i + 0.42));
        return (
          <span key={i} style={{ display: 'inline-block', whiteSpace: 'pre', opacity: p, transform: p < 1 ? `translateY(${mix(18, 0, p).toFixed(2)}px)` : undefined, filter: p < 1 ? `blur(${(6 * (1 - p)).toFixed(2)}px)` : undefined }}>
            {m}{i < mots.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </div>
  );
}

// L'horloge : un chiffre qui change monte et s'efface (200 ms), le nouveau
// arrive d'en bas (220 ms). Le passage à la date : fondu enchaîné avec flou.
function Horloge({ t, avant, apres, tRoule, style }) {
  const memeForme = avant.length === apres.length;
  if (!memeForme) {
    const a = seg(t, tRoule, tRoule + 0.3);
    return (
      <div style={{ ...style, display: 'grid', justifyItems: 'center' }}>
        <span style={{ gridArea: '1 / 1', opacity: 1 - a, filter: a > 0 && a < 1 ? `blur(${(2 * a).toFixed(2)}px)` : undefined }}>{avant}</span>
        <span style={{ gridArea: '1 / 1', opacity: a, filter: a > 0 && a < 1 ? `blur(${(2 * (1 - a)).toFixed(2)}px)` : undefined }}>{apres}</span>
      </div>
    );
  }
  const pa = seg(t, tRoule, tRoule + 0.2), pb = sortie(seg(t, tRoule, tRoule + 0.22));
  return (
    <div style={{ ...style, display: 'flex', justifyContent: 'center' }}>
      {[...apres].map((c, i) => (avant[i] === c
        ? <span key={i} style={{ whiteSpace: 'pre' }}>{c}</span>
        : (
          <span key={i} style={{ position: 'relative', display: 'inline-block', whiteSpace: 'pre' }}>
            <span style={{ visibility: 'hidden' }}>{c}</span>
            <span style={{ position: 'absolute', left: 0, top: 0, opacity: 1 - pa, transform: `translateY(${(-40 * pa).toFixed(1)}%)` }}>{avant[i]}</span>
            <span style={{ position: 'absolute', left: 0, top: 0, opacity: pb, transform: `translateY(${(40 * (1 - pb)).toFixed(1)}%)` }}>{c}</span>
          </span>
        )))}
    </div>
  );
}

const ONGLETS_FANTOMES = ['Vinted · Perso', 'Vinted · Boutique', 'Leboncoin', 'eBay', 'Suivi colis', 'Messages', 'Tableur compta'];
const ROTATIONS = [-8, 5, -3, 7, -6, 2];

// ── Le film ────────────────────────────────────────────────────────────────
export default function Film() {
  const court = /[?&]film=court(&|$)/.test(window.location.search || '');
  const DUREE = court ? 15 : 35;
  const PLANS = court ? PLANS_COURT : PLANS_LONG;
  const [t, setT] = React.useState(0);
  const [vue, setVue] = React.useState({ w: window.innerWidth, h: window.innerHeight });
  React.useEffect(() => {
    window.__filmT = (s) => { const x = Number(s); setT(isFinite(x) ? Math.max(0, Math.min(DUREE, x)) : 0); };
    window.__filmDuree = DUREE;
    const f = () => setVue({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', f);
    document.body.style.background = K.bg;
    document.documentElement.style.overflow = 'hidden';
    document.title = 'VRM — une journée avec VRM';
    return () => window.removeEventListener('resize', f);
  }, [DUREE]);
  const plan = planDe(t, PLANS);
  React.useEffect(() => { window.__filmPlan = plan; }, [plan]);

  const portrait = vue.h > vue.w;
  const W = portrait ? 1080 : 1920, H = portrait ? 1920 : 1080;
  const echelle = Math.min(vue.w / W, vue.h / H);
  return (
    <div data-film-plan={plan} style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: K.bg, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <style>{'[data-film-plan] *{box-sizing:border-box}'}</style>
      <div style={{ position: 'absolute', left: (vue.w - W * echelle) / 2, top: (vue.h - H * echelle) / 2, width: W, height: H, transform: `scale(${echelle})`, transformOrigin: '0 0', overflow: 'hidden',
        background: `radial-gradient(${portrait ? '1100px 1300px at 50% 46%' : '1300px 800px at 50% 50%'}, rgba(61,123,255,0.14), transparent 70%), ${K.bg}` }}>
        <Plateau t={t} W={W} H={H} portrait={portrait} court={court} />
      </div>
    </div>
  );
}

function Plateau({ t, W, H, portrait, court }) {
  // ── La mise en page, paysage et portrait ──
  const k = portrait ? 2.2 : 1.7;
  const lw = portrait ? 350 : 500;        // largeur de mise en page de la carte
  const L = portrait ? {
    carte: { x: (W - 350 * k) / 2, y: 590, w: 350 },
    colis: { x: (W - 350 * k) / 2, y: 610, w: 350 },
    ailleurs: { x: (W - 350 * k) / 2, y: 640, w: 350 },
    mois: { x: (W - 350 * k) / 2, y: 620, w: 350 },
    titreY: 300, horlogeY: 250, questionY: 430, legende: { x: 86, y: 154 }, taille: 72, ligneY: [760, 860, 960],
  } : {
    carte: { x: (W - lw * k) / 2, y: 300, w: lw },
    colis: { x: (W - 600 * k) / 2, y: 255, w: 600 },
    ailleurs: { x: (W - 1060 * k) / 2, y: 380, w: 1060 },
    mois: { x: (W - 560 * k) / 2, y: 250, w: 560 },
    titreY: 96, horlogeY: 390, questionY: 530, legende: { x: 80, y: 64 }, taille: 64, ligneY: [400, 490, 580],
  };
  const compact = portrait;
  const T = L.taille;

  // ── Les cibles de la caméra, mesurées sur les écrans posés (§10.2) ──
  const plateau = React.useRef(null);
  const [cibles, setCibles] = React.useState({});
  React.useLayoutEffect(() => {
    const p = plateau.current; if (!p) return;
    const nv = {};
    p.querySelectorAll('[data-cible]').forEach((el) => {
      const ecran = el.closest('[data-ecran]'); if (!ecran) return;
      const inner = ecran.firstElementChild; if (!inner) return;
      const c = centreDans(el, inner); if (!c) return;
      const x = Number(ecran.getAttribute('data-x')), y = Number(ecran.getAttribute('data-y'));
      nv[el.getAttribute('data-cible')] = { x: x + c.x * k, y: y + c.y * k, w: c.w * k, h: c.h * k };
    });
    const id = ecranIdent(p);
    if (id) nv.ident = id;
    const changed = Object.keys(nv).some((n) => !cibles[n] || Math.abs(cibles[n].x - nv[n].x) > 0.5 || Math.abs(cibles[n].y - nv[n].y) > 0.5);
    if (changed) setCibles((v) => ({ ...v, ...nv }));
  });
  const ecranIdent = (p) => {
    const el = p.querySelector('[data-scene="ailleurs"] [data-ident]'); if (!el) return null;
    const ecran = el.closest('[data-ecran]'); const inner = ecran && ecran.firstElementChild; if (!inner) return null;
    const c = centreDans(el, inner); if (!c) return null;
    return { x: Number(ecran.getAttribute('data-x')) + c.x * k, y: Number(ecran.getAttribute('data-y')) + c.y * k, w: c.w * k, h: c.h * k };
  };
  const centre = { x: W / 2, y: H / 2 };
  const C = (n, repli) => cibles[n] || repli || centre;

  // ── La caméra : un point du plateau ramené au centre, et une échelle ──
  const cam = (() => {
    const kf = (pts) => { // [[t, point, échelle], …] — interpolées en `trajet`
      if (t <= pts[0][0]) return { p: pts[0][1], s: pts[0][2] };
      for (let i = 1; i < pts.length; i++) {
        const [ta, pa, sa] = pts[i - 1], [tb, pb, sb] = pts[i];
        if (t <= tb) { const x = trajet(seg(t, ta, tb)); return { p: { x: mix(pa.x, pb.x, x), y: mix(pa.y, pb.y, x) }, s: mix(sa, sb, x) }; }
      }
      const z = pts[pts.length - 1]; return { p: z[1], s: z[2] };
    };
    if (court) {
      if (t >= 5.5 && t < 9.5) return kf([[8.2, centre, 1], [8.7, C('tampon'), 1.7]]);
      return { p: centre, s: 1 };
    }
    if (t >= 9 && t < 10.5) return kf([[9.0, centre, 1], [9.6, C('ligne-colis'), 2.2]]);
    if (t >= 10.5 && t < 15.5) return kf([[13.9, centre, 1], [14.5, C('tampon'), 1.7], [14.8, C('tampon'), 1.7], [15.4, C('carton'), 1.4]]);
    if (t >= 15.5 && t < 17) return kf([[15.5, C('carton'), 1.4], [15.9, C('carton'), 2.4]]);
    if (t >= 17 && t < 23.5) {
      const base = 1 + 0.04 * clamp01((t - 17) / 5);
      const c = kf([[18.75, centre, 1], [19.35, C('trait'), 1.25], [19.6, C('trait'), 1.25], [20.1, centre, 1], [20.5, C('ebay'), 1.2], [21.7, C('ebay'), 1.2], [22.05, centre, 1]]);
      return { p: c.p, s: c.s * base };
    }
    if (t >= 23.5 && t < 28) return kf([[24.6, centre, 1], [25.2, C('total'), 1.5], [25.8, C('total'), 1.5], [26.3, centre, 1]]);
    return { p: centre, s: 1 };
  })();
  // En portrait, les écrans sont déjà posés à ×2,2 : les avancées de caméra y
  // sont adoucies de moitié (sinon la légende passe sous un écran géant).
  if (portrait) cam.s = 1 + (cam.s - 1) * 0.55;
  const camTransform = `translate(${W / 2}px, ${H / 2}px) scale(${cam.s.toFixed(4)}) translate(${(-cam.p.x).toFixed(2)}px, ${(-cam.p.y).toFixed(2)}px)`;
  // Un point du plateau → l'écran (pour poser un élément libre sur une cible).
  const versEcran = (p) => ({ x: W / 2 + (p.x - cam.p.x) * cam.s, y: H / 2 + (p.y - cam.p.y) * cam.s });

  // ── Les écrans posés sur le plateau ──
  const ecran = (nom, pos, contenu, style) => (
    <div key={nom} data-ecran={nom} data-x={pos.x} data-y={pos.y} style={{ position: 'absolute', left: pos.x, top: pos.y, width: pos.w, transformOrigin: '0 0', ...style, transform: `${style && style.transform ? style.transform + ' ' : ''}scale(${k})` }}>
      <div style={{ width: pos.w }}>{contenu}</div>
    </div>
  );
  const entreeBas = (a, b) => { const p = sortie(seg(t, a, b)); return { opacity: p, transform: `translateY(${mix(40, 0, p).toFixed(2)}px)` }; };
  const flouSortie = (a, b) => { const p = seg(t, a, b); return { opacity: 1 - p, filter: p > 0 ? `blur(${(8 * p).toFixed(2)}px)` : undefined }; };
  const fusion = (a, b) => ({ ...a, ...b, transform: [a.transform, b.transform].filter(Boolean).join(' ') || undefined, filter: [a.filter, b.filter].filter(Boolean).join(' ') || undefined, opacity: (a.opacity == null ? 1 : a.opacity) * (b.opacity == null ? 1 : b.opacity) });

  const ecrans = [];
  // La carte « Aujourd'hui ».
  const carteDe = court ? [1.2, 4.8] : [5.8, 9.8];
  if (t >= carteDe[0] && t < carteDe[1]) {
    const m0 = carteDe[0], m1 = m0 + 0.6, j = court ? 1.7 : 6.4;
    const p = sortie(seg(t, m0, m1));
    const sCarte = t < j ? 1.1 : 1.1 + (t - j);
    const sortieC = court ? flouSortie(4.5, 4.8) : flouSortie(9.4, 9.8);
    ecrans.push(ecran('carte', L.carte, <CarteJourEcran s={Math.min(4.5, sCarte)} etatScene="joue" />,
      fusion({ opacity: p, transform: `translateY(0px)`, filter: p < 1 ? `blur(${(10 * (1 - p)).toFixed(2)}px)` : undefined }, fusion(sortieC, { transform: `scale(${mix(0.94, 1, p).toFixed(4)})` }))));
  }
  // Colis.
  const colisDe = court ? [5.5, 9.8] : [10.6, 16.1];
  if (t >= colisDe[0] && t < colisDe[1]) {
    let s;
    if (court) s = Math.max(0, (t - 5.9) * 1.2);
    else s = t < 11.2 ? 0 : t < 14.0 ? t - 11.2 : t < 14.8 ? 2.8 : 2.8 + (t - 14.8);
    const ent = court ? entreeBas(5.5, 5.9) : entreeBas(10.6, 11.2);
    const sor = court ? flouSortie(9.5, 9.8) : flouSortie(15.7, 16.1);
    ecrans.push(ecran('colis', L.colis, <EcranColis s={Math.min(3.8, s)} compact={compact} cible libelle="" />, fusion(ent, sor)));
  }
  // Ailleurs.
  const ailleursDe = court ? [10.3, 12.8] : [17.1, 22.5];
  if (t >= ailleursDe[0] && t < ailleursDe[1]) {
    const s = court ? 0.5 + (t - 10.3) * 1.5 : (t < 18.2 ? 0.45 : 0.45 + (t - 18.2));
    const ent = court ? entreeBas(10.3, 10.7) : entreeBas(17.1, 17.7);
    const sor = court ? {} : flouSortie(22.1, 22.5);
    ecrans.push(ecran('ailleurs', L.ailleurs, <EcranAilleurs s={Math.min(4.2, s)} compact={compact} cible libelle="" identExterne={!court && t < 18.2} />, fusion(ent, sor)));
  }
  // Le mois.
  if (!court && t >= 23.6 && t < 28.3) {
    const s = t < 24.4 ? Math.min(0.5, t - 23.6) : 0.9 + (t - 24.4);
    const ent = entreeBas(23.6, 24.2);
    const rec = seg(t, 28.0, 28.3);
    ecrans.push(ecran('mois', L.mois, <EcranMois s={Math.min(3.8, s)} compact={compact} cible libelle="" pastilleExterne />,
      fusion(ent, { opacity: 1 - rec, transform: rec > 0 ? `scale(${mix(1, 0.96, sortie(rec)).toFixed(4)})` : undefined })));
  }

  // ── Les éléments libres (hors caméra) ──
  const libres = [];
  const centreX = { left: 0, right: 0, textAlign: 'center' };
  const titreStyle = (y, taille = T, extra) => ({ position: 'absolute', top: y, ...centreX, fontFamily: POLICE_TITRE, fontSize: taille, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.12, ...extra });

  // P0 — un trait se dessine, le logo apparaît là où il était.
  const tTrait = court ? [0.1, 0.5] : [0.2, 0.9], tLogo = court ? [0.5, 1.0] : [0.9, 1.5];
  if (t < (court ? 1.6 : 2.6)) {
    const tr = trajet(seg(t, tTrait[0], tTrait[1])), trOut = seg(t, tLogo[0], tLogo[0] + 0.4);
    if (tr > 0 && trOut < 1) libres.push(<div key="trait" style={{ position: 'absolute', left: W * 0.2, width: W * 0.6, top: H / 2, height: 1, background: K.accent, transform: `scaleX(${tr.toFixed(4)})`, opacity: 1 - trOut }} />);
  }
  // Le logo : centre (P0) → en haut, petit (P1) → s'efface quand tout est aspiré.
  {
    const lp = sortie(seg(t, tLogo[0], tLogo[1]));
    const monte = court ? 0 : trajet(seg(t, 2.0, 2.5));
    const part = court ? seg(t, 1.2, 1.5) : seg(t, 5.5, 5.8);
    const taille = mix(180, 56, monte);
    const y = mix(H / 2 - 90, portrait ? 150 : 72, monte);
    if (lp > 0 && part < 1) {
      libres.push(<img key="logo" src="/vrm-logo-v3-192.png" alt="" width="180" height="180" style={{ position: 'absolute', left: W / 2 - taille / 2, top: y, width: taille, height: taille, borderRadius: taille * 0.2,
        opacity: lp * (1 - part), transform: `scale(${mix(0.96, 1, lp).toFixed(4)})`, filter: lp < 1 ? `blur(${(8 * (1 - lp)).toFixed(2)}px)` : undefined }} />);
    }
  }

  // P1 — la galère, puis tout est aspiré au centre (P2).
  if (!court && t >= 2 && t < 6.3) {
    const asp = (i) => seg(t, 5.5 + 0.03 * i, 5.5 + 0.03 * i + 0.6);
    const vers = (x, y, i) => { const a = trajet(asp(i)); return { dx: (W / 2 - x) * a, dy: (H / 2 - y) * a, s: mix(1, 0.3, a), o: 1 - a }; };
    // Les onglets fantômes, à 35 %, qui dérivent.
    const posO = portrait
      ? [[80, 380], [640, 320], [90, 1180], [760, 1120], [60, 660], [730, 580], [430, 1660]]
      : [[150, 200], [1480, 170], [110, 650], [1580, 380], [80, 430], [1610, 560], [800, 140]];
    ONGLETS_FANTOMES.forEach((o, i) => {
      const ap = sortie(seg(t, 2.0 + 0.06 * i, 2.0 + 0.06 * i + 0.4));
      if (ap <= 0) return;
      const [x, y] = posO[i], v = vers(x, y, 7 + i), der = 4 * (t - 2) * (i % 2 ? 1 : -1);
      libres.push(<div key={`o${i}`} style={{ position: 'absolute', left: x, top: y, height: 44, padding: '0 18px', display: 'flex', alignItems: 'center', gap: 10, borderRadius: '10px 10px 0 0',
        background: K.card2, border: `1px solid ${K.line2}`, color: K.muted, fontSize: 22, fontWeight: 500, whiteSpace: 'nowrap',
        opacity: 0.35 * ap * v.o, transform: `translate(${(v.dx + der).toFixed(1)}px, ${v.dy.toFixed(1)}px) scale(${v.s.toFixed(3)})` }}>
        <i style={{ width: 9, height: 9, borderRadius: 3, background: i < 2 ? PLATEFORMES.vinted.point : i === 2 ? PLATEFORMES.leboncoin.point : i === 3 ? PLATEFORMES.ebay.point : K.faint }} />{o}
      </div>);
    });
    // Six cartons SANS numéro, un peu de travers.
    const baseC = portrait ? [150, 1430] : [360, 800];
    for (let i = 0; i < 6; i++) {
      const ap = sortie(seg(t, 3.0 + 0.05 * i, 3.0 + 0.05 * i + 0.4));
      if (ap <= 0) continue;
      const x = baseC[0] + (i % 3) * 112 + (i >= 3 ? 50 : 0), y = baseC[1] + (i >= 3 ? -88 : 0);
      const v = vers(x + 48, y + 40, i);
      libres.push(<div key={`c${i}`} style={{ position: 'absolute', left: x, top: y, width: 96, height: 80, borderRadius: 8, background: K.card2, border: `1px solid ${K.line2}`,
        opacity: ap * v.o, transform: `translate(${v.dx.toFixed(1)}px, ${(v.dy + mix(-30, 0, ap)).toFixed(1)}px) rotate(${ROTATIONS[i]}deg) scale(${v.s.toFixed(3)})` }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 22, height: 9, background: 'rgba(255,255,255,.06)' }} />
        <div style={{ position: 'absolute', left: '50%', top: 0, width: 16, height: 31, marginLeft: -8, background: 'rgba(255,255,255,.07)' }} />
      </div>);
    }
    // Une feuille aux lignes vides : « à déclarer : ? € ».
    {
      const ap = sortie(seg(t, 4.0, 4.45));
      if (ap > 0) {
        const x = portrait ? 680 : 1400, y = portrait ? 1340 : 690;
        const v = vers(x + 140, y + 110, 6);
        libres.push(<div key="feuille" style={{ position: 'absolute', left: x, top: y, width: 280, height: 220, borderRadius: 8, background: K.paper, color: K.ink, padding: 24,
          opacity: 0.9 * ap * v.o, transform: `translate(${v.dx.toFixed(1)}px, ${(v.dy + mix(20, 0, ap)).toFixed(1)}px) rotate(4deg) scale(${v.s.toFixed(3)})` }}>
          {[78, 56, 70, 44].map((w, i) => <div key={i} style={{ height: 10, width: `${w}%`, background: '#D9DEE6', borderRadius: 3, marginTop: i ? 14 : 0 }} />)}
          <div style={{ marginTop: 26, fontSize: 24, fontWeight: 600 }}>à déclarer : ? €</div>
        </div>);
      }
    }
    // Les trois lignes : la précédente baisse à 35 % quand la suivante arrive.
    const lignes = [['Vinted, Leboncoin, eBay.', 2.0], ['Des colis à poster.', 3.0], ['Une déclaration à faire.', 4.0]];
    const sortieL = seg(t, 5.0, 5.25);
    lignes.forEach(([txt, t0], i) => {
      const suivante = lignes[i + 1];
      const baisse = suivante ? mix(1, 0.35, sortie(seg(t, suivante[1], suivante[1] + 0.3))) : 1;
      if (sortieL >= 1) return;
      libres.push(<div key={`l${i}`} style={{ opacity: baisse * (1 - sortieL), transform: sortieL > 0 ? `scale(${mix(1, 0.98, sortieL).toFixed(4)})` : undefined, position: 'absolute', left: 0, right: 0, top: 0 }}>
        <Mots texte={txt} t={t} t0={t0} style={titreStyle(L.ligneY[i])} />
      </div>);
    });
  }

  // P2 — « Tu ouvres VRM. » au-dessus de la carte, « Tu sais quoi faire. » dessous.
  {
    const a = court ? [1.2, 3.7, 4.5] : [6.0, 8.4, 9.0];
    if (t >= a[0] && t < a[2] + 0.25) {
      const y1 = portrait ? L.titreY : L.titreY;
      libres.push(<Mots key="tu1" texte="Tu ouvres VRM." t={t} t0={a[0]} tSortie={a[2]} couleur={K.muted} style={titreStyle(y1)} />);
      libres.push(<Mots key="tu2" texte="Tu sais quoi faire." t={t} t0={a[1]} tSortie={a[2]} style={titreStyle(y1 + T * 1.12)} />);
    }
  }

  // Les questions, l'horloge, et la légende.
  const Q = court ? [
    { q: 'Quels colis je poste ce matin ?', tq: 4.6, legende: 5.5, efface: 9.5, h: ['8 h 02', '8 h 02', 4.5], tIn: 4.5 },
    { q: 'Vendu sur Vinted… encore en ligne sur Leboncoin ?', tq: 9.6, legende: 10.3, efface: 12.8, h: ['8 h 03', '8 h 03', 9.5], tIn: 9.5 },
  ] : [
    { q: 'Quels colis je poste ce matin ?', tq: 9.85, legende: 10.5, efface: 15.5, h: ['8 h 01', '8 h 02', 9.75], tIn: 9.5 },
    { q: 'Vendu sur Vinted… encore en ligne sur Leboncoin ?', tq: 16.1, legende: 17.0, efface: 22.0, h: ['8 h 02', '8 h 03', 15.9], tIn: 15.7 },
    { q: 'Combien je déclare à l’URSSAF ?', tq: 22.7, legende: 23.5, efface: 28.0, h: ['8 h 03', '31 octobre', 22.4], tIn: 22.2 },
  ];
  // ⚠️ (18 octobre) Le voile est fait de la couleur du FOND du film (`K.bg`). Il
  // était écrit en noir fixe (rgba(7,9,13) — le fond de l'ancienne famille
  // sombre) : depuis le passage du film au clair, une bande noire dégradée
  // barrait le haut de l'image derrière chaque question.
  // Un voile en haut de l'image, sous la légende : quand la caméra avance, un
  // écran agrandi passait SOUS la question rétrécie et les deux textes se
  // mêlaient (vu image par image à 15,3 s, aux deux formats). Le voile suit la
  // légende — il arrive avec elle et part avec elle.
  {
    // Il reste plein jusque sous la légende, puis s'estompe ; il part APRÈS
    // elle (0,25 s de plus) : la caméra pousse encore quand la légende s'efface.
    const v = Math.max(0, ...Q.map((x) => trajet(seg(t, x.legende, x.legende + 0.6)) * (1 - seg(t, x.efface + 0.2, x.efface + 0.45))));
    if (v > 0) {
      const plein = portrait ? 250 : 140, bas = portrait ? 400 : 230;
      libres.push(<div key="voile" aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, width: W, height: bas, pointerEvents: 'none', opacity: v,
        background: `linear-gradient(to bottom, ${K.bg} 0px, ${voileRgba(0.96)} ${plein}px, ${voileRgba(0)} ${bas}px)` }} />);
    }
  }
  Q.forEach((x, i) => {
    // L'horloge : apparaît, roule, puis s'efface quand la question devient légende.
    if (t >= x.tIn && t < x.legende + 0.2) {
      const o = sortie(seg(t, x.tIn, x.tIn + 0.2)) * (1 - seg(t, x.legende, x.legende + 0.2));
      libres.push(<div key={`h${i}`} style={{ position: 'absolute', left: 0, right: 0, top: L.horlogeY - (portrait ? 40 : 90), opacity: o }}>
        <Horloge t={t} avant={x.h[0]} apres={x.h[1]} tRoule={x.h[2]} style={{ fontFamily: POLICE_TITRE, fontSize: 120, fontWeight: 700, letterSpacing: '-0.03em', color: K.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }} />
      </div>);
    }
    // La question, puis la légende en haut à gauche (600 ms, trajet), à 60 %.
    if (t >= x.tq && t < x.efface + 0.2) {
      libres.push(<Question key={`q${i}`} texte={x.q} t={t} t0={x.tq} legende={x.legende} efface={x.efface} W={W} y0={L.questionY - (portrait ? 0 : 60)}
        cible={L.legende} taille={T} largeurMax={portrait ? 920 : 1560} />);
    }
  });

  // P5 — le « N°128 » sort du carton, grossit en une puce, puis se pose dans
  // l'identité de la tuile Vinted (P6) : c'est le raccord entre les deux plans.
  if (!court && t >= 15.7 && t < 18.2) {
    const nait = sortie(seg(t, 15.7, 16.1));
    const carton = cibles.carton ? versEcran(cibles.carton) : { x: W / 2, y: H / 2 };
    const depart = { x: W / 2 - (portrait ? 0 : 260), y: portrait ? 1080 : 760 };
    const pose = seg(t, 17.6, 18.2);
    const cible = cibles.ident ? versEcran(cibles.ident) : depart;
    const a = { x: mix(carton.x, depart.x, trajet(nait)), y: mix(carton.y, depart.y, sortie(nait)) };
    const x = mix(a.x, cible.x, trajet(pose)), y = mix(a.y, cible.y, sortie(pose));
    const hFin = cibles.ident ? cibles.ident.h * cam.s : 37;
    const sc = mix(mix(0.5, 1, nait), hFin / 72, sortie(pose));
    libres.push(<div key="n128" style={{ position: 'absolute', left: x, top: y, height: 72, padding: '0 26px', display: 'flex', alignItems: 'center', borderRadius: 14,
      background: 'rgba(61,123,255,.16)', border: `2px solid ${K.accent}`, color: K.text, fontSize: 38, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
      opacity: Math.min(1, nait * 1.6), transform: `translate(-50%, -50%) scale(${sc.toFixed(4)})` }}>N°{V.n}</div>);
  }

  // P7 — les 85,00 € de la tuile Vinted filent au centre ; P8 — ils deviennent
  // la pastille « +85,00 € · N°128 · versé » de l'écran du mois, qui la reprend
  // à l'identique à 24,4 s (même place, même style).
  if (!court && t >= 22.0 && t < 24.4) {
    libres.push(<PrixVole key="prix" t={t} cibles={cibles} versEcran={versEcran} W={W} H={H} portrait={portrait} k={k} mois={L.mois} compact={compact} />);
  }

  // P9 — « Et tout le reste. » et quatre cartes.
  if (!court && t >= 28.0 && t < 30.85) {
    const out = seg(t, 30.5, 30.8);
    libres.push(<div key="reste-t" style={{ opacity: 1 - out }}><Mots texte="Et tout le reste." t={t} t0={28.1} style={titreStyle(portrait ? 300 : 150)} /></div>);
    const cartes = [
      ['Code de retrait', R.code, R.lieu, PLATEFORMES.vinted.point],
      ['Messages', `${DEMO.jour.messages.n} non lus`, DEMO.jour.messages.comptes.join(', '), null],
      ['Chez Vinted', `${euros(R.attente)} en attente`, `${euros(R.dispo)} disponibles`, PLATEFORMES.vinted.point],
      [`Nouvelle vente · Vinted · ${R.vente.compte}`, `${euros(R.vente.prix)}`, R.vente.titre, PLATEFORMES.vinted.point],
    ];
    const cw = portrait ? 440 : 620, ch = portrait ? 230 : 190, g = portrait ? 24 : 28;
    const gx = (W - 2 * cw - g) / 2, gy = portrait ? 560 : 320;
    cartes.forEach(([a, b, c, point], i) => {
      const p = sortie(seg(t, 28.2 + 0.15 * i, 28.2 + 0.15 * i + 0.5));
      libres.push(<div key={`r${i}`} style={{ position: 'absolute', left: gx + (i % 2) * (cw + g), top: gy + Math.floor(i / 2) * (ch + g), width: cw, height: ch, borderRadius: 18,
        background: K.card, border: `1px solid ${K.line2}`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 2px 4px rgba(0,0,0,.5), 0 40px 90px rgba(0,0,0,.45)', padding: portrait ? '30px 32px' : '30px 34px',
        opacity: p * (1 - out), transform: `translateY(${(mix(16, 0, p) - 0).toFixed(1)}px) scale(${mix(1, 0.96, out).toFixed(4)})` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 22, fontWeight: 500, color: K.muted, whiteSpace: 'nowrap' }}>{point && <i style={{ width: 11, height: 11, borderRadius: 3, background: point }} />}{a}</div>
        <div style={{ fontFamily: POLICE_TITRE, fontSize: portrait ? 40 : 42, fontWeight: 700, color: K.text, marginTop: 16, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{b}</div>
        <div style={{ fontSize: 22, color: K.muted, marginTop: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c}</div>
      </div>);
    });
  }

  // P10 — la fin : le logo, les deux tons du titre, l'adresse.
  {
    const tf = court ? [12.8, 13.1, 13.4, 13.6] : [30.8, 31.3, 31.6, 32.2];
    if (t >= tf[0]) {
      const lp = sortie(seg(t, tf[0], tf[0] + 0.5));
      const y = portrait ? 640 : 230;
      libres.push(<img key="logo-fin" src="/vrm-logo-v3-192.png" alt="" width="120" height="120" style={{ position: 'absolute', left: W / 2 - 60, top: y, width: 120, height: 120, borderRadius: 24,
        opacity: lp, transform: `scale(${mix(0.96, 1, lp).toFixed(4)})`, filter: lp < 1 ? `blur(${(6 * (1 - lp)).toFixed(2)}px)` : undefined }} />);
      libres.push(<Mots key="f1" texte="Tu ouvres VRM." t={t} t0={tf[1]} couleur={K.muted} style={titreStyle(y + 170)} />);
      libres.push(<Mots key="f2" texte="Tu sais quoi faire." t={t} t0={tf[2]} style={titreStyle(y + 170 + T * 1.12)} />);
      libres.push(<Mots key="f3" texte="vrm.center" t={t} t0={tf[3]} style={titreStyle(y + 170 + T * 2.24 + 70, 40, { fontWeight: 600 })} />);
      libres.push(<Mots key="f4" texte="Crée ton compte" t={t} t0={tf[3] + 0.15} couleur={K.muted} style={{ ...titreStyle(y + 170 + T * 2.24 + 130, 24), fontFamily: "'Inter',sans-serif", fontWeight: 500, letterSpacing: 0 }} />);
    }
  }

  return (
    <>
      <div ref={plateau} style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '0 0', transform: camTransform }}>{ecrans}</div>
      {libres}
    </>
  );
}

// Une question : centrée, puis elle rétrécit (×0,45) et file en haut à gauche
// en légende, où elle reste à 60 % pendant la réponse. Sa largeur est MESURÉE
// (le bloc épouse son texte) : le centrage et la légende partent du même bord.
function Question({ texte, t, t0, legende, efface, W, y0, cible, taille, largeurMax }) {
  const bloc = React.useRef(null);
  const [w, setW] = React.useState(0);
  React.useLayoutEffect(() => { const el = bloc.current; if (el && Math.abs(el.offsetWidth - w) > 0.5) setW(el.offsetWidth); });
  const lg = trajet(seg(t, legende, legende + 0.6)), ef = seg(t, efface, efface + 0.2);
  const tx = mix((W - w) / 2, cible.x, lg), ty = mix(y0, cible.y, lg);
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${mix(1, 0.45, lg).toFixed(4)})`, opacity: mix(1, 0.6, lg) * (1 - ef) }}>
      <div ref={bloc} style={{ display: 'inline-block', maxWidth: largeurMax, textAlign: 'center', textWrap: 'balance' }}>
        <Mots texte={texte} t={t} t0={t0} style={{ fontFamily: POLICE_TITRE, fontSize: taille, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.12 }} />
      </div>
    </div>
  );
}

// Le prix qui voyage (P7 → P8). Deux pièces : le montant « 85,00 € », qui part
// de la tuile Vinted, grossit au centre puis file vers la pastille ; et la
// pastille du mois, qui s'ouvre par `clip-path` depuis la gauche pendant que le
// montant s'y fond. Sa place et son style sont ceux de l'écran du mois.
function PrixVole({ t, cibles, versEcran, W, H, portrait, k, mois, compact }) {
  const m = React.useRef(null);
  const [w85, setW85] = React.useState(0);
  React.useLayoutEffect(() => { const el = m.current; if (el && Math.abs(el.offsetWidth - w85) > 0.5) setW85(el.offsetWidth); });
  const BASE = 48;
  const part = seg(t, 22.0, 22.5), devient = seg(t, 24.0, 24.4);
  const dep = cibles.prix ? versEcran(cibles.prix) : { x: W / 2, y: H / 2 };
  const milieu = { x: W / 2, y: portrait ? 1080 : 720 };
  // La pastille de l'écran du mois (identique à `EcranMois`) : gauche à 24 px
  // (18 en compact), centre 21 px au-dessus du haut du total.
  const totalHaut = cibles.total ? cibles.total.y - cibles.total.h / 2 : mois.y + 100 * k;
  const pL = mois.x + (compact ? 18 : 24) * k, pY = totalHaut - 21 * k;
  const sDep = (15 * k) / BASE, sFin = (12 * k) / BASE;
  const fin = { x: pL + 10 * k + 1 + (w85 * sFin) / 2, y: pY };
  let c, s;
  if (devient > 0) { c = { x: mix(milieu.x, fin.x, trajet(devient)), y: mix(milieu.y, fin.y, sortie(devient)) }; s = mix(1, sFin, sortie(devient)); }
  else { c = { x: mix(dep.x, milieu.x, trajet(part)), y: mix(dep.y, milieu.y, sortie(part)) }; s = mix(sDep, 1, sortie(part)); }
  const fondA = seg(t, 24.12, 24.36);
  const ouvre = sortie(seg(t, 24.05, 24.4));
  const texte = `+${euros(V.prix)} · N°${V.n} · ${compact ? 'versé' : `${V.titre} · versé`}`;
  return (
    <>
      <span ref={m} style={{ position: 'absolute', left: c.x, top: c.y, transform: `translate(-50%, -50%) scale(${s.toFixed(4)})`, fontFamily: POLICE_TITRE, fontSize: BASE, fontWeight: 600,
        color: K.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', opacity: 1 - fondA, filter: fondA > 0 && fondA < 1 ? `blur(${(2 * fondA).toFixed(2)}px)` : undefined }}>{euros(V.prix)}</span>
      {devient > 0 && (
        <span style={{ position: 'absolute', left: pL, top: pY - 13 * k, height: 26 * k, padding: `0 ${10 * k}px`, display: 'inline-flex', alignItems: 'center', borderRadius: 8 * k,
          background: 'rgba(61,123,255,.12)', border: `1px solid ${K.accent}`, fontSize: 12 * k, fontWeight: 600, color: K.text, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
          clipPath: `inset(0 ${(100 * (1 - ouvre)).toFixed(2)}% 0 0 round ${8 * k}px)`, opacity: Math.min(1, devient * 2) }}>{texte}</span>
      )}
    </>
  );
}

