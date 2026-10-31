// ── LES ÉCRANS DESSINÉS DE LA PAGE D'ACCUEIL (un morceau chargé à part) ───────
// Trois écrans, un par question de la journée, et le tampon « N° 1 » de la fin.
// Chacun est une FONCTION PURE de son temps `s` et des positions mesurées : la
// page le pilote par `useScene` (il joue une fois, quand on le voit), le film
// (`?film`) par son propre temps — le même code pour les deux.
//
// Grammaire : ce que VRM fait arrive sans curseur ; ce que TU fais (imprimer,
// retirer d'eBay, noter le mois comme déclaré) passe par un curseur dessiné.
// Un seul élément bouge à la fois. Données : src/accueil-demo.js (inventées).
// ⚠️ Aucun texte rendu sous 12 px, aucun `transform: scale` sur un écran :
//    chaque écran est mis en page pour sa largeur (variante compacte < 560 px).
import React from 'react';
import { K, OMBRE_CARTE, REFLET, HAUTEURS_SCENES } from './accueil-jetons.js';
import { DEMO, PLATEFORMES, euros, nomCompte } from './accueil-demo.js';
import { seg, mix, sortie, trajet, retombe, volXY, useScene, useTaille, centreDans } from './accueil-mouvement.js';
import { RevoirBouton } from './accueil-carte.jsx';

export const DUREE_COLIS = 3.8;
export const DUREE_AILLEURS = 4.2;
export const DUREE_MOIS = 3.8;
export const DUREE_PREMIER = 0.9;
const V = DEMO.vente, M = DEMO.mois;
// Un écran ne démarre pas tant qu'il n'est que dans le quart bas de la fenêtre.
const MARGE = '0px 0px -25% 0px';

const CSS = `
.sc{position:relative;width:100%;color:${K.text};font-variant-numeric:normal;font-feature-settings:normal;font-family:'Bricolage Grotesque','Inter',system-ui,sans-serif;text-align:left;-webkit-user-select:none;user-select:none}
.sc *{box-sizing:border-box}
.sc-tuile{position:absolute;background:${K.card};border:1px solid ${K.line2};border-radius:12px;box-shadow:${REFLET},${OMBRE_CARTE};overflow:hidden}
.sc-tete{display:flex;align-items:center;justify-content:space-between;gap:10px;height:44px;padding:0 14px 0 16px;border-bottom:1px solid ${K.line}}
.sc-tete b{font-family:'Bricolage Grotesque','Inter',sans-serif;font-size:15px;font-weight:600;letter-spacing:-.01em;white-space:nowrap}
.sc-tete b span{font-family:'Bricolage Grotesque','Inter',system-ui,sans-serif;color:${K.muted};font-weight:500}
.sc-bp{display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 12px;border-radius:8px;background:${K.cta};color:#FFF;font-size:13px;font-weight:600;white-space:nowrap;box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 1px 2px rgba(0,0,0,.4)}
.sc-bs{display:inline-flex;align-items:center;justify-content:center;height:30px;padding:0 11px;border-radius:8px;border:1px solid ${K.line2};background:${K.card2};color:${K.text};font-size:12px;font-weight:600;white-space:nowrap}
.sc-groupe{height:26px;display:flex;align-items:flex-end;padding:0 16px 5px;font-size:12px;font-weight:600;color:${K.muted}}
.sc-ligne{height:48px;display:flex;align-items:center;gap:12px;padding:0 14px 0 16px}
.sc-ligne + .sc-ligne{border-top:1px solid ${K.line}}
.sc-ligne .t{flex:1;min-width:0}
.sc-ligne .t b{display:block;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:18px}
.sc-meta{display:flex;align-items:center;gap:6px;font-size:12px;color:${K.muted};white-space:nowrap;line-height:16px;margin-top:2px}
.sc-badge{display:inline-flex;align-items:center;height:18px;padding:0 6px;border-radius:8px;background:${K.card2};border:1px solid ${K.line2};font-size:12px;font-weight:600;color:${K.text};font-variant-numeric:tabular-nums;white-space:nowrap}
.sc-delai{font-size:12px;color:${K.muted};white-space:nowrap}
.sc-vign{width:32px;height:32px;border-radius:8px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border:1px solid ${K.line}}
.sc-feuille{position:absolute;display:flex;flex-direction:column;background:${K.paper};color:${K.ink};border-radius:5px;box-shadow:0 1px 2px rgba(0,0,0,.4),0 16px 40px rgba(0,0,0,.45);padding:12px 14px;overflow:hidden}
.sc-feuille .masque{display:flex;flex-direction:column;gap:5px;margin-top:10px}
.sc-feuille .masque i{display:block;height:5px;border-radius:2px;background:#D9DEE6}
.sc-feuille .hd{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:12px;line-height:16px}
.sc-feuille .hd b{font-weight:700}
.sc-feuille .hd span{color:#4A5363}
.sc-feuille .rel{font-size:12px;line-height:16px;color:#4A5363;margin-top:2px;white-space:nowrap}
.sc-cb{display:flex;align-items:stretch;gap:2px;margin-top:8px}
.sc-cb i{display:block;background:${K.ink}}
.sc-tampon{position:relative;display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 8px;border:1.5px solid ${K.cta};border-radius:5px;background:rgba(36,88,230,.06);font-size:12px;font-weight:600;color:${K.ink};white-space:nowrap;font-variant-numeric:tabular-nums}
.sc-encre{position:absolute;inset:-3px;border:2px solid ${K.accent};border-radius:7px;pointer-events:none}
.sc-carton{position:absolute;border-radius:5px;background:${K.card2};border:1px solid ${K.line2};display:flex;align-items:flex-end;justify-content:center;padding-bottom:7px;font-size:12px;font-weight:600;color:${K.muted};font-variant-numeric:tabular-nums}
.sc-carton:before{content:"";position:absolute;left:0;right:0;top:14px;height:6px;background:rgba(255,255,255,.06)}
.sc-carton:after{content:"";position:absolute;left:50%;top:0;width:10px;height:20px;margin-left:-5px;background:rgba(255,255,255,.07)}
.sc-carton .contour{position:absolute;inset:-1px;border:1.5px solid ${K.accent};border-radius:5px}
.sc-etiq{position:absolute;font-size:12px;font-weight:500;color:${K.text};white-space:nowrap;line-height:16px}
.sc-curseur{position:absolute;left:0;top:0;width:18px;height:22px;z-index:20;pointer-events:none;transform-origin:2px 2px}
.sc-anneau{position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;border:1.5px solid rgba(255,255,255,.85);z-index:19;pointer-events:none}
.sc-vol{position:absolute;left:0;top:0;z-index:15;pointer-events:none;display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:8px;background:rgba(36,66,184,.18);border:1px solid ${K.accent};font-size:12px;font-weight:600;color:${K.text};font-variant-numeric:tabular-nums;white-space:nowrap}
.sc-plat{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;color:${K.muted};line-height:16px}
.sc-plat i{display:inline-block;width:7px;height:7px;border-radius:2px;margin-right:7px;vertical-align:1px}
.sc-plat strong{font-family:'Bricolage Grotesque','Inter',sans-serif;font-size:15px;font-weight:600;color:${K.text};font-variant-numeric:tabular-nums}
.sc-ident{position:relative;display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:8px;background:${K.card2};border:1px solid ${K.line2};font-size:12px;font-weight:600;color:${K.text};font-variant-numeric:tabular-nums;white-space:nowrap}
.sc-ident .lum{position:absolute;inset:-1px;border-radius:8px;background:${K.accentSoft};border:1px solid rgba(36,66,184,.6)}
.sc-ident span{position:relative}
.sc-etat{position:relative;height:22px;flex:1;min-width:0}
.sc-etat > span{position:absolute;right:0;top:0;height:22px;display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;white-space:nowrap}
.sc-vendue{padding:0 8px;border-radius:8px;background:${K.text};color:${K.bg}}
.sc-point{width:7px;height:7px;border-radius:50%;background:${K.warn};display:inline-block}
.sc-bulle{position:absolute;z-index:12;width:260px;padding:14px;border-radius:10px;background:${K.card2};border:1px solid ${K.line2};box-shadow:0 1px 2px rgba(0,0,0,.5),0 16px 40px rgba(0,0,0,.55)}
.sc-bulle b{display:block;font-size:13px;font-weight:600;line-height:18px}
.sc-bulle p{margin:3px 0 0;font-size:12px;color:${K.muted};line-height:16px}
.sc-bulle .acts{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}
.sc-mois{position:absolute;left:0;top:0;right:0;background:${K.card};border:1px solid ${K.line2};border-radius:12px;box-shadow:${REFLET},${OMBRE_CARTE};padding:22px 24px 24px}
.sc-mois .t1{font-size:13px;font-weight:600;color:${K.muted}}
.sc-pastille{position:absolute;display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:8px;background:rgba(36,66,184,.12);border:1px solid ${K.accent};font-size:12px;font-weight:600;color:${K.text};white-space:nowrap;font-variant-numeric:tabular-nums}
.sc-total{font-family:'Bricolage Grotesque','Inter',sans-serif;font-size:40px;font-weight:700;letter-spacing:-.02em;line-height:1.05;font-variant-numeric:tabular-nums;white-space:nowrap}
.sc-n{position:relative;height:20px;font-size:14px;color:${K.muted};margin-top:6px}
.sc-n span{position:absolute;left:0;top:0;white-space:nowrap}
.sc-barre{position:relative;display:flex;gap:2px;height:10px;border-radius:5px;overflow:hidden;margin-top:20px}
.sc-barre i{display:block;height:100%}
.sc-leg{display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:14px;font-size:13px;color:${K.muted}}
.sc-leg span{display:inline-flex;align-items:center;gap:7px;white-space:nowrap}
.sc-leg i{width:7px;height:7px;border-radius:2px;display:inline-block}
.sc-leg b{color:${K.text};font-weight:600;font-variant-numeric:tabular-nums}
.sc-adater{font-size:13px;color:${K.faint};margin-top:12px;line-height:1.45}
.sc-dec{position:relative;display:inline-grid;align-items:center;justify-items:center;height:40px;padding:0 16px;margin-top:18px;border-radius:10px;border:1px solid ${K.line2};background:${K.card2};font-size:14px;font-weight:600;color:${K.text};white-space:nowrap}
.sc-dec > span{grid-area:1 / 1}
.sc-joue{position:relative}
.sc-revoir-l{position:absolute;left:0;right:0;top:100%;height:34px;display:flex;justify-content:flex-end;align-items:center}
.sc.compact .sc-total{font-size:32px}
.sc.compact .sc-mois{padding:18px 18px 20px}
`;
// Une seule feuille de style pour les quatre écrans (et le film), posée une fois.
if (typeof document !== 'undefined' && !document.getElementById('acc-scenes-css')) {
  try { const st = document.createElement('style'); st.id = 'acc-scenes-css'; st.textContent = CSS; document.head.appendChild(st); } catch (_) {}
}

// Fondu enchaîné, un léger flou au milieu.
const fondu = (a) => ({
  ancien: { opacity: 1 - a, filter: a > 0 && a < 1 ? `blur(${(2 * a).toFixed(2)}px)` : undefined },
  nouveau: { opacity: a, filter: a > 0 && a < 1 ? `blur(${(2 * (1 - a)).toFixed(2)}px)` : undefined },
});
// Un appui : le bouton descend à .97 (100 ms) puis remonte (160 ms).
const appui = (s, t) => (s < t ? 1 : s < t + 0.1 ? mix(1, 0.97, sortie(seg(s, t, t + 0.1))) : mix(0.97, 1, sortie(seg(s, t + 0.1, t + 0.26))));

// ── Le curseur dessiné : il n'apparaît QUE pour un geste de l'utilisateur ──
export function Curseur({ x, y, k = 1, opacite = 1 }) {
  return (
    <svg className="sc-curseur" data-curseur="" viewBox="0 0 18 22" aria-hidden="true"
      style={{ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${k.toFixed(3)})`, opacity: opacite }}>
      <path d="M2 2 L2 17.5 L6.2 13.6 L9 20 L11.8 18.8 L9.1 12.6 L14.8 12.4 Z" fill="#FFFFFF" stroke="#0B0E13" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
// L'anneau neutre d'un appui (300 ms).
const Anneau = ({ c, s, t }) => {
  if (!c || s < t || s > t + 0.3) return null;
  const p = seg(s, t, t + 0.3);
  return <span className="sc-anneau" aria-hidden="true" style={{ left: c.x, top: c.y, opacity: 0.85 * (1 - p), transform: `scale(${mix(1, 2.2, sortie(p)).toFixed(3)})` }} />;
};
// Le trajet du curseur entre deux points (X et Y en `trajet`).
const glisse = (a, b, p) => ({ x: mix(a.x, b.x, trajet(p)), y: mix(a.y, b.y, trajet(p)) });
const pointe = (c) => (c ? { x: c.x - 3, y: c.y - 2 } : null);

// ── Les vignettes dessinées (jamais une vraie photo) ───────────────────────
const TONS = { '131': ['#2B323E', '#1A2029'], '128': ['#26303A', '#171E25'], '97': ['#2A2E3A', '#191C25'] };
export function Vignette({ n, taille = 32 }) {
  const [a, b] = TONS[n] || TONS['128'];
  const veste = n === '97';
  return (
    <span className="sc-vign" style={{ width: taille, height: taille, background: a }} aria-hidden="true">
      <svg width={taille * 0.74} height={taille * 0.74} viewBox="0 0 32 32">
        {veste
          ? <path d="M11 6l5 3 5-3 6 4-2 6h-3v11H10V16H7l-2-6zM16 9v18" fill="#FFFFFF" fillOpacity="0.08" stroke="#FFFFFF" strokeOpacity="0.36" strokeWidth="1.5" strokeLinejoin="round" />
          : <><path d="M3 21c0-2 1-3 3-3.4l5-1.1 3.2-5.3c.4-.7 1.3-.9 2-.4l1.6 1.1c.6.4 1.4.5 2.1.2l1.2-.5c.8-.3 1.6.1 1.9.9l1.6 4.4c.3.8 1 1.4 1.8 1.6l1.4.3c1.2.3 2.2 1.4 2.2 2.7V23c0 .6-.4 1-1 1H4c-.6 0-1-.4-1-1z" fill="#FFFFFF" fillOpacity="0.08" stroke="#FFFFFF" strokeOpacity="0.36" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M3.5 21.5h25" stroke="#FFFFFF" strokeOpacity="0.24" strokeWidth="1.2" /></>}
      </svg>
    </span>
  );
}

// ── La feuille du bordereau (papier, encre, code-barres illisible) ─────────
const BARRES = [3, 1, 2, 1, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2, 1, 1, 3, 2, 1, 2, 1, 3, 1, 1, 2, 3, 1, 2];
export function Feuille({ largeur, hauteur, style, transporteur, relais, tampon, tamponRef, encre, tamponStyle, cible, cb = 34, nbBarres = BARRES.length, masque = false }) {
  return (
    <div className="sc-feuille" data-bordereau="" style={{ width: largeur, height: hauteur, ...style }}>
      <div className="hd"><b>{transporteur}</b>{relais === undefined ? <span>1 / 1</span> : null}</div>
      {relais ? <div className="rel">{relais}</div> : null}
      <div className="sc-cb" style={{ height: cb }}>{BARRES.slice(0, nbBarres).map((b, i) => <i key={i} style={{ width: b }} />)}</div>
      {masque ? <div className="masque"><i style={{ width: '62%' }} /><i style={{ width: '44%' }} /></div> : null}
      <div style={{ marginTop: 'auto', paddingTop: 8 }}>
        <span ref={tamponRef} className="sc-tampon" data-tampon="" data-cible={cible ? 'tampon' : undefined} style={tamponStyle}>
          {encre}
          <span style={{ position: 'relative' }}>{tampon}</span>
        </span>
      </div>
    </div>
  );
}

// Atterrissage d'un tampon à l'instant `t` : élan (retombe), cadre révélé
// depuis le centre, anneau d'encre qui s'efface.
function tamponPose(s, t, depart = 1.1) {
  const p = seg(s, t, t + 0.28);
  const style = s < t
    ? { opacity: 0, clipPath: 'inset(50% 50%)' }
    : {
      transform: p < 1 ? `scale(${mix(depart, 1, retombe(p)).toFixed(4)})` : undefined,
      clipPath: s < t + 0.18 ? `inset(${(50 * (1 - sortie(seg(s, t, t + 0.18)))).toFixed(2)}% ${(50 * (1 - sortie(seg(s, t, t + 0.18)))).toFixed(2)}%)` : undefined,
    };
  const e = seg(s, t, t + 0.42);
  const encre = s >= t && e < 1 ? <span className="sc-encre" aria-hidden="true" style={{ opacity: 0.35 * (1 - e), transform: `scale(${mix(1, 1.6, sortie(e)).toFixed(3)})` }} /> : null;
  return { style, encre };
}

// Le conteneur commun d'un écran : `data-scene`, `data-etat`, hauteur réservée.
function Cadre({ nom, etat, compact, libelle, racine, children, pret = true }) {
  const h = HAUTEURS_SCENES[nom][compact ? 1 : 0];
  return (
    <div ref={racine} className={`sc${compact ? ' compact' : ''}`} data-scene={nom} data-etat={etat} data-pret={pret ? '' : undefined}
      role="img" aria-label={libelle} style={{ height: h }}>
      {children}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// 1. COLIS — « Quels colis je poste ce matin ? »
// ════════════════════════════════════════════════════════════════════════
export function EcranColis({ s, etat = 'joue', compact, libelle, cible }) {
  const racine = React.useRef(null);
  const bouton = React.useRef(null), badge = React.useRef(null), tamponRef = React.useRef(null), carton = React.useRef(null);
  const { w } = useTaille(racine);
  const [pos, setPos] = React.useState(null);
  React.useLayoutEffect(() => {
    const r = racine.current; if (!r) return;
    const b = centreDans(bouton.current, r), g = centreDans(badge.current, r), t = centreDans(tamponRef.current, r), c = centreDans(carton.current, r);
    if (b && g && t && c) setPos({ b, g, t, c, w: r.offsetWidth, h: r.offsetHeight });
  }, [w, compact]);

  const H = HAUTEURS_SCENES.colis[compact ? 1 : 0];
  const tuileL = compact ? '100%' : Math.min(560, w || 560);
  const tuileH = 248;
  // Ordinateur : la tuile, puis dessous la feuille qui sort (à gauche) et
  // l'étagère des cartons sur deux rangées (à droite) — rien ne recouvre la
  // tuile. Compact : la feuille à gauche, trois cartons à droite.
  const fW = compact ? 196 : 240, fH = compact ? 120 : 160;
  const fX = 0, fY = tuileH + (compact ? 12 : 18);
  const cW = compact ? 42 : 56, cH = compact ? 46 : 52, cG = 8;
  const stock = compact ? DEMO.stock.filter((n) => ['127', '128', '129'].includes(n)) : DEMO.stock;
  const parRangee = compact ? 3 : 4;
  const sX = compact ? (w || 350) - (3 * cW + 2 * cG) : fW + 28, sY = compact ? tuileH + 12 + 20 : fY + 4;
  const placeCarton = (i) => ({ x: sX + (i % parRangee) * (cW + cG), y: sY + Math.floor(i / parRangee) * (cH + cG) });
  // ⚠️ Les lignes sont là dès le départ : sur ordinateur cet écran affleure en
  //    bas du premier écran AVANT de jouer, et une tuile vide se lisait comme
  //    une page cassée. Le premier geste est donc le curseur (0,55 s).
  const ligne = () => undefined;
  // 1,25 → 1,75 : la feuille sort.
  const fp = sortie(seg(s, 1.25, 1.75));
  const feuilleStyle = { left: fX, top: fY, opacity: fp, zIndex: 4, transform: `translateY(${mix(28, 0, fp).toFixed(2)}px) rotate(${mix(-2, -1, fp).toFixed(3)}deg)` };
  // 2,50 → 2,78 : le tampon se pose.
  const tp = tamponPose(s, 2.5);
  // 3,10 → 3,46 : le carton 128 sort de la rangée.
  const cp = sortie(seg(s, 3.1, 3.46));
  const sorti = s >= 3.1;
  // Le curseur : 0,55 → 1,05 vers « Tout imprimer », appui à 1,10, s'efface 1,30 → 1,50.
  let curseur = null;
  if (pos && s >= 0.55 && s < 1.5) {
    const dep = { x: pos.w - 14, y: pos.h - 18 }, arr = pointe(pos.b);
    const c = glisse(dep, arr, seg(s, 0.55, 1.05));
    const k = s < 1.1 ? 1 : s < 1.2 ? mix(1, 0.9, seg(s, 1.1, 1.2)) : mix(0.9, 1, seg(s, 1.2, 1.3));
    curseur = <Curseur x={c.x} y={c.y} k={k} opacite={Math.min(seg(s, 0.55, 0.7), 1 - seg(s, 1.3, 1.5))} />;
  }
  // 1,90 → 2,50 : le geste signature — le N°128 vole jusqu'au tampon.
  let vol = null;
  if (pos && s >= 1.9 && s < 2.5) {
    const p = seg(s, 1.9, 2.5), c = volXY(pos.g, pos.t, p);
    const k = p < 0.5 ? mix(1, 1.25, sortie(p / 0.5)) : mix(1.25, 1.1, (p - 0.5) / 0.5);
    vol = <span className="sc-vol" data-vol="" aria-hidden="true" style={{ transform: `translate(${c.x.toFixed(2)}px, ${c.y.toFixed(2)}px) translate(-50%, -50%) scale(${k.toFixed(3)}) rotate(${mix(0, -4, sortie(p)).toFixed(2)}deg)` }}>N°{V.n}</span>;
  }
  const colis = DEMO.colis;
  const prets = colis.filter((c) => c.pret), attente = colis.filter((c) => !c.pret);
  const ligneColis = (c, i) => (
    <div key={c.n} className="sc-ligne" style={ligne(i)}>
      <Vignette n={c.n} />
      <div className="t">
        <b>{c.titre} · {c.taille}</b>
        <div className="sc-meta"><span className="sc-badge" ref={c.n === V.n ? badge : undefined}>N°{c.n}</span>{compact ? nomCompte(c.compte) : `${c.transporteur} · ${nomCompte(c.compte)}`}</div>
      </div>
      {c.pret
        ? <span className="sc-delai" style={c.urgent ? { color: K.warn, fontWeight: 600 } : undefined}>{compact ? c.court : c.delai}</span>
        : <span className="sc-bs">{compact ? 'Générer' : 'Générer le bordereau'}</span>}
    </div>
  );
  return (
    <Cadre nom="colis" etat={etat} compact={compact} libelle={libelle} racine={racine}>
      <div aria-hidden="true">
        <div className="sc-tuile" style={{ left: 0, top: 0, width: tuileL, height: tuileH }}>
          <div className="sc-tete">
            <b>Colis <span>· {colis.length} à poster</span></b>
            <span ref={bouton} className="sc-bp" style={{ transform: `scale(${appui(s, 1.1).toFixed(4)})` }}>
              <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 6V2.5h7V6M4.5 11.5h-2v-5h11v5h-2M4.5 9.5h7v4h-7z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
              Tout imprimer ({prets.length})
            </span>
          </div>
          <div className="sc-groupe">Prêts à imprimer · {prets.length}</div>
          {prets.map((c, i) => ligneColis(c, i))}
          <div className="sc-groupe">En attente du bordereau · {attente.length}</div>
          {attente.map((c, i) => ligneColis(c, prets.length + i))}
        </div>
        <Feuille largeur={fW} hauteur={fH} style={feuilleStyle} transporteur={V.transporteur}
          relais={compact ? null : `Point relais : ${DEMO.jour.relais.lieu}`} cb={compact ? 26 : 30} nbBarres={compact ? 30 : 36} masque={!compact}
          tamponRef={tamponRef} cible={cible} tamponStyle={tp.style} encre={tp.encre}
          tampon={compact ? `N°${V.n} · ${V.titre}` : `N°${V.n} · ${V.titre} · ${V.taille}`} />
        {stock.map((n, i) => {
          const est = n === V.n;
          const { x, y } = placeCarton(i);
          return (
            <div key={n} ref={est ? carton : undefined} className="sc-carton" data-carton={n} data-sorti={est && sorti ? '1' : undefined} data-cible={est && cible ? 'carton' : undefined}
              style={{ left: x, top: y, width: cW, height: cH, zIndex: est ? 3 : 1, color: est && cp > 0 ? K.text : undefined,
                transform: est && cp > 0 ? `translateY(${(-6 * cp).toFixed(2)}px)` : undefined,
                boxShadow: est && cp > 0 ? `0 ${(2 + 10 * cp).toFixed(1)}px ${(4 + 18 * cp).toFixed(1)}px rgba(0,0,0,${(0.3 + 0.25 * cp).toFixed(2)})` : undefined }}>
              {est && cp > 0 && <span className="contour" style={{ opacity: cp }} />}
              <span style={{ position: 'relative' }}>{n}</span>
            </div>
          );
        })}
        <div className="sc-etiq" style={{ opacity: sortie(seg(s, 3.1, 3.3)),
          ...(compact ? { right: 0, top: sY + cH + 6, textAlign: 'right' } : { left: sX, top: sY + 2 * cH + cG + 10 }) }}>
          {compact ? `Carton ${V.n}` : `Carton ${V.n} · ${V.titre} · ${V.taille}`}
        </div>
        {vol}
        {curseur}
        {pos && <Anneau c={pos.b} s={s} t={1.1} />}
      </div>
    </Cadre>
  );
}

// ════════════════════════════════════════════════════════════════════════
// 2. AILLEURS — « Vendu sur Vinted… encore en ligne sur Leboncoin ? »
// ════════════════════════════════════════════════════════════════════════
export function EcranAilleurs({ s, etat = 'joue', compact, libelle, cible, identExterne = false, identRef }) {
  const racine = React.useRef(null);
  const i0 = React.useRef(null), i1 = React.useRef(null), i2 = React.useRef(null);
  const idents = [i0, i1, i2];
  const btnEbay = React.useRef(null), btnOui = React.useRef(null);
  const { w } = useTaille(racine);
  const [pos, setPos] = React.useState(null);
  React.useLayoutEffect(() => {
    const r = racine.current; if (!r) return;
    const ids = idents.map((x) => centreDans(x.current, r));
    const e = centreDans(btnEbay.current, r), o = centreDans(btnOui.current, r);
    if (ids.every(Boolean) && e && o) setPos({ ids, e, o, w: r.offsetWidth, h: r.offsetHeight });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, compact]);

  const tuiles = [
    { cle: 'vinted', titre: `${V.titre} · ${V.taille}`, prix: V.prix, ident: `N°${V.n}`, compte: nomCompte(V.compte) },
    ...V.ailleurs.map((a) => ({ cle: a.plateforme, titre: a.titre, prix: a.prix, ident: a.ident })),
  ];
  // Ordinateur : trois tuiles côte à côte, le trait court d'une identité à la
  // suivante dans le vide à droite de chacune. Compact : tuiles empilées, le
  // trait descend dans la gouttière de gauche — il ne barre jamais un texte.
  const gap = compact ? 8 : 20, gout = compact ? 16 : 0;
  const hauteurs = compact ? [88, 112, 128] : [190, 190, 190];
  const largeur = compact ? (w || 350) - gout : ((w || 1100) - 2 * gap) / 3;
  const place = (i) => (compact
    ? { left: gout, top: hauteurs.slice(0, i).reduce((a, b) => a + b + gap, 0), width: largeur, height: hauteurs[i] }
    : { left: i * (largeur + gap), top: 0, width: largeur, height: hauteurs[i] });

  // Entrées des tuiles (0 → 0,45).
  const entre = (i) => { const p = sortie(seg(s, 0.06 * i, 0.06 * i + 0.3)); return { opacity: p, transform: p < 1 ? `translateY(${mix(8, 0, p).toFixed(2)}px)` : undefined }; };
  const vendue = sortie(seg(s, 0.7, 0.9));
  // Le trait relie les trois identités (1,00 → 1,60) ; chacune s'éclaire à son passage.
  const tr = trajet(seg(s, 1.0, 1.6));
  const lum = (i) => { const passe = 1.0 + 0.27 * i; return seg(s, passe, passe + 0.15); };
  const aRetirer = (i) => sortie(seg(s, 1.8 + 0.08 * (i - 1), 1.8 + 0.08 * (i - 1) + 0.26));
  const pieds = sortie(seg(s, 1.8, 2.06));
  // La bulle (3,00 → 3,20 ; se ferme à 3,75), puis « Retirée d'eBay ✓ ».
  const bulleIn = sortie(seg(s, 3.0, 3.2)), bulleOut = seg(s, 3.75, 3.9);
  const bulleVis = s >= 3.0 && s < 3.9;
  const retiree = fondu(seg(s, 3.75, 3.97));

  let chemin = '';
  if (pos) {
    const [a, b, c] = pos.ids;
    const f = (n) => n.toFixed(1);
    if (compact) {
      const g = 7, r = 6;
      const coude = (p, q) => `M ${f(p.x - p.w / 2)} ${f(p.y)} H ${g + r} Q ${g} ${f(p.y)} ${g} ${f(p.y + r)} V ${f(q.y - r)} Q ${g} ${f(q.y)} ${g + r} ${f(q.y)} H ${f(q.x - q.w / 2)}`;
      chemin = `${coude(a, b)} ${coude(b, c)}`;
    } else {
      chemin = `M ${f(a.x + a.w / 2)} ${f(a.y)} H ${f(b.x - b.w / 2)} M ${f(b.x + b.w / 2)} ${f(b.y)} H ${f(c.x - c.w / 2)}`;
    }
  }

  // Le curseur : 2,40 → 2,85 vers « Retirer d'eBay », appui 2,90 ; 3,30 → 3,60
  // vers « Oui, retirer d'eBay », appui 3,65 ; s'efface 3,75 → 3,95.
  let curseur = null;
  if (pos && s >= 2.4 && s < 3.95) {
    const dep = { x: pos.w - 14, y: pos.h - 18 };
    const c = s < 3.3 ? glisse(dep, pointe(pos.e), seg(s, 2.4, 2.85)) : glisse(pointe(pos.e), pointe(pos.o), seg(s, 3.3, 3.6));
    const k = (s >= 2.9 && s < 3.06) || (s >= 3.65 && s < 3.81) ? 0.9 : 1;
    curseur = <Curseur x={c.x} y={c.y} k={k} opacite={Math.min(seg(s, 2.4, 2.55), 1 - seg(s, 3.75, 3.95))} />;
  }
  // La bulle part du bouton (origine sur le bouton) et chevauche la tuile du dessus.
  const bulleW = 260, bulleH = 112;
  const bulleBase = pos ? { left: Math.max(0, Math.min(pos.w - bulleW, pos.e.x - bulleW + pos.e.w / 2 + 6)), top: pos.e.y - pos.e.h / 2 - 8 - bulleH } : { left: 0, top: 0 };
  let bulleStyle = { opacity: 0, visibility: 'hidden' };
  if (pos && bulleVis) {
    bulleStyle = { opacity: bulleIn * (1 - bulleOut), transform: `scale(${mix(0.96, 1, bulleIn).toFixed(4)})`, transformOrigin: `${(pos.e.x - bulleBase.left).toFixed(1)}px ${(pos.e.y - bulleBase.top).toFixed(1)}px` };
  }

  const etatTuile = (i) => (
    <span className="sc-etat">
      {i === 0 && <>
        <span style={{ color: K.faint, opacity: 1 - vendue }}>En ligne</span>
        <span className="sc-vendue" style={{ opacity: vendue, transform: `scale(${mix(0.96, 1, vendue).toFixed(4)})`, transformOrigin: 'right center' }}>Vendue</span>
      </>}
      {i === 1 && <>
        <span style={{ color: K.faint, opacity: 1 - aRetirer(1) }}>En ligne</span>
        <span style={{ color: K.text, opacity: aRetirer(1), transform: `translateY(${mix(-6, 0, aRetirer(1)).toFixed(2)}px)` }}><i className="sc-point" />À retirer</span>
      </>}
      {i === 2 && <>
        <span style={{ color: K.faint, opacity: 1 - aRetirer(2) }}>En ligne</span>
        <span style={{ color: K.text, opacity: aRetirer(2) * (1 - retiree.nouveau.opacity), filter: retiree.ancien.filter, transform: `translateY(${mix(-6, 0, aRetirer(2)).toFixed(2)}px)` }}><i className="sc-point" />À retirer</span>
        <span style={{ color: K.text, ...retiree.nouveau }}>Retirée d’eBay ✓</span>
      </>}
    </span>
  );

  return (
    <Cadre nom="ailleurs" etat={etat} compact={compact} libelle={libelle} racine={racine}>
      <div aria-hidden="true">
        {tuiles.map((t, i) => {
          const plat = PLATEFORMES[t.cle];
          const attenue = i === 0 ? mix(1, 0.6, vendue) : i === 2 ? mix(1, 0.5, retiree.nouveau.opacity) : 1;
          const ident = (
            <span ref={(e) => { idents[i].current = e; if (i === 0 && identRef) identRef.current = e; }} className="sc-ident" data-ident="" style={{ visibility: i === 0 && identExterne ? 'hidden' : undefined }}>
              {s >= 1.0 + 0.27 * i && <span className="lum" style={{ opacity: lum(i) }} />}
              <span>{t.ident}</span>
            </span>
          );
          return (
            <div key={t.cle} className="sc-tuile" data-cible={i === 2 && cible ? 'ebay' : undefined} style={{ ...place(i), ...entre(i), padding: compact ? '10px 14px' : '16px 18px' }}>
              {compact ? <>
                <div className="sc-plat" style={{ opacity: attenue }}><span><i style={{ background: plat.point }} />{plat.nom}{t.compte ? ` · ${t.compte}` : ''}</span><strong data-cible={i === 0 && cible ? 'prix' : undefined}>{euros(t.prix)}</strong></div>
                <div style={{ fontSize: 14, fontWeight: 600, lineHeight: '18px', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: attenue }}>{t.titre}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>{ident}{etatTuile(i)}</div>
              </> : <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 22 }}>
                  <span className="sc-plat" style={{ opacity: attenue }}><span><i style={{ background: plat.point }} />{plat.nom}{t.compte ? ` · ${t.compte}` : ''}</span></span>
                  {etatTuile(i)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, opacity: attenue }}>
                  <Vignette n={V.n} taille={40} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, lineHeight: '18px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.titre}</div>
                    <div data-cible={i === 0 && cible ? 'prix' : undefined} style={{ display: 'inline-block', fontFamily: "'Bricolage Grotesque','Inter',sans-serif", fontSize: 15, fontWeight: 600, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{euros(t.prix)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', marginTop: 14 }}>{ident}</div>
              </>}
              {i === 1 && <div style={{ fontSize: 12, color: K.muted, marginTop: compact ? 8 : 14, lineHeight: '16px', opacity: pieds }}>Tu la retires sur Leboncoin.</div>}
              {i === 2 && <div style={{ marginTop: compact ? 8 : 12, opacity: pieds * (1 - retiree.nouveau.opacity) }}>
                <span ref={btnEbay} className="sc-bs" style={{ transform: `scale(${appui(s, 2.9).toFixed(4)})` }}>Retirer d’eBay</span>
              </div>}
            </div>
          );
        })}
        {pos && chemin && (
          <svg data-cible={cible ? 'trait' : undefined} width={pos.w} height={pos.h} style={{ position: 'absolute', left: 0, top: 0, zIndex: 6, pointerEvents: 'none', overflow: 'visible' }} aria-hidden="true">
            <path d={chemin} fill="none" stroke={K.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" pathLength="1"
              strokeDasharray="1 1" strokeDashoffset={(1 - tr).toFixed(4)} style={{ opacity: s >= 1.0 ? 1 : 0 }} />
          </svg>
        )}
        <div className="sc-bulle" style={{ ...bulleBase, width: bulleW, ...bulleStyle }}>
          <b>Retirer « {V.titre} » d’eBay ?</b>
          <p>C’est sans retour côté eBay.</p>
          <div className="acts">
            <span className="sc-bs" style={{ background: 'transparent' }}>Annuler</span>
            <span ref={btnOui} className="sc-bp" style={{ height: 30, transform: `scale(${appui(s, 3.65).toFixed(4)})` }}>Oui, retirer d’eBay</span>
          </div>
        </div>
        {curseur}
        {pos && <Anneau c={pos.e} s={s} t={2.9} />}
        {pos && <Anneau c={pos.o} s={s} t={3.65} />}
      </div>
    </Cadre>
  );
}

// ════════════════════════════════════════════════════════════════════════
// 3. LE MOIS — « Combien je déclare à l'URSSAF ? »
// ════════════════════════════════════════════════════════════════════════
export function EcranMois({ s, etat = 'joue', compact, libelle, cible, pastilleExterne = false }) {
  const racine = React.useRef(null), total = React.useRef(null), bouton = React.useRef(null), pastilleRef = React.useRef(null);
  const { w } = useTaille(racine);
  const [pos, setPos] = React.useState(null);
  React.useLayoutEffect(() => {
    const r = racine.current; if (!r) return;
    const t = centreDans(total.current, r), b = centreDans(bouton.current, r);
    if (t && b) setPos({ t, b, w: r.offsetWidth, h: r.offsetHeight });
  }, [w, compact]);

  const carte = sortie(seg(s, 0, 0.35));
  // La pastille de la N°128 glisse au-dessus du total (0,55 → 0,90) puis y plonge (1,05 → 1,45).
  const pIn = sortie(seg(s, 0.55, 0.9)), pOut = seg(s, 1.05, 1.45);
  // Le total roule (1,25 → 2,05), depuis un socle non nul : jamais de « 0 € ».
  const r = sortie(seg(s, 1.25, 2.05));
  const arrondi = (x) => Math.round(x * 100) / 100;
  const tot = arrondi(mix(M.avant, M.apres, r)), vin = arrondi(mix(M.vintedAvant, M.vinted, r));
  const nb = fondu(seg(s, 1.65, 1.85));
  const barre = (i) => sortie(seg(s, 2.0 + 0.08 * i, 2.0 + 0.08 * i + 0.44));
  const dec = fondu(seg(s, 3.35, 3.57));
  let curseur = null;
  if (pos && s >= 2.8 && s < 3.55) {
    const dep = { x: pos.w - 14, y: pos.h - 18 };
    const c = glisse(dep, pointe(pos.b), seg(s, 2.8, 3.2));
    const k = s >= 3.25 && s < 3.41 ? 0.9 : 1;
    curseur = <Curseur x={c.x} y={c.y} k={k} opacite={Math.min(seg(s, 2.8, 2.95), 1 - seg(s, 3.35, 3.55))} />;
  }
  const parts = [[M.vinted, 0.7], [M.leboncoin, 0.4], [M.ebay, 0.22]];
  const somme = M.vinted + M.leboncoin + M.ebay;
  const leg = [['vinted', vin], ['leboncoin', M.leboncoin], ['ebay', M.ebay]];
  const pastille = `+${euros(V.prix)} · N°${V.n} · ${compact ? 'versé' : `${V.titre} · versé`}`;
  let pastilleStyle = null;
  // Dans le film, la pastille ARRIVE d'ailleurs (le prix de la tuile Vinted) :
  // l'écran ne dessine pas sa propre entrée, seulement la plongée (s ≥ 0,9).
  if (!(pastilleExterne && s < 0.9) && s >= 0.55 && s < 1.45 && pos) {
    pastilleStyle = {
      left: compact ? 18 : 24, top: pos.t.y - pos.t.h / 2 - 34,
      opacity: pIn * (1 - pOut),
      transform: pOut > 0
        ? `translateY(${(trajet(pOut) * 32).toFixed(2)}px) scale(${mix(1, 0.9, trajet(pOut)).toFixed(4)})`
        : `translateX(${mix(-16, 0, pIn).toFixed(2)}px)`,
    };
  }
  return (
    <Cadre nom="urssaf" etat={etat} compact={compact} libelle={libelle} racine={racine}>
      <div aria-hidden="true">
        <div className="sc-mois" style={{ opacity: carte, transform: carte < 1 ? `translateY(${mix(8, 0, carte).toFixed(2)}px)` : undefined }}>
          <div className="t1">Ce mois-ci · à déclarer</div>
          <div style={{ height: 34 }} />
          <div ref={total} className="sc-total" data-total="" data-cible={cible ? 'total' : undefined}>{euros(tot)}</div>
          <div className="sc-n">
            <span style={nb.ancien}>{M.ventesAvant} ventes finalisées</span>
            <span style={nb.nouveau}>{M.ventesApres} ventes finalisées</span>
          </div>
          <div className="sc-barre">
            {parts.map(([v, a], i) => <i key={i} style={{ width: `${(100 * v) / somme}%`, background: `rgba(238,241,246,${a})`, clipPath: `inset(0 ${(100 * (1 - barre(i))).toFixed(2)}% 0 0)` }} />)}
          </div>
          <div className="sc-leg">
            {leg.map(([p, v]) => <span key={p}><i style={{ background: PLATEFORMES[p].point }} />{PLATEFORMES[p].nom} <b>{euros(v)}</b></span>)}
          </div>
          <div className="sc-adater">{M.aDater.n} ventes pas encore datées · {euros(M.aDater.total)} — comptées à part</div>
          <span ref={bouton} className="sc-dec" style={{ transform: `scale(${appui(s, 3.25).toFixed(4)})` }}>
            <span style={dec.ancien}>J’ai déclaré ce mois</span>
            <span style={dec.nouveau}>✓ Noté comme déclaré</span>
          </span>
        </div>
        {pastilleStyle && <span ref={pastilleRef} className="sc-pastille" style={pastilleStyle}>{pastille}</span>}
        {curseur}
        {pos && <Anneau c={pos.b} s={s} t={3.25} />}
      </div>
    </Cadre>
  );
}

// ════════════════════════════════════════════════════════════════════════
// 4. LA FIN — le tampon « N° 1 » se pose (une fois, 0,9 s)
// ════════════════════════════════════════════════════════════════════════
export function EcranPremier({ s, etat = 'joue', compact, libelle }) {
  const tp = tamponPose(s, 0.15, 1.12);
  return (
    <Cadre nom="premier" etat={etat} compact={compact} libelle={libelle}>
      <div aria-hidden="true">
        <Feuille largeur={compact ? 180 : 220} hauteur={compact ? 108 : 132} style={{ left: 0, top: 0, transform: 'rotate(-1deg)' }}
          transporteur="Ton premier colis" cb={compact ? 22 : 30} nbBarres={compact ? 26 : 32}
          tamponStyle={tp.style} encre={tp.encre} tampon="N° 1" />
      </div>
    </Cadre>
  );
}

// ── Les écrans de la page : ils jouent une fois, quand on les voit ──────────
function Joue({ Ecran, duree, compact, libelle, seuil = 0.35, revoir = true }) {
  const boite = React.useRef(null);
  const { s, etat, rejouer, reduit } = useScene(boite, duree, { seuil, marge: MARGE });
  return (
    <div ref={boite} className="sc-joue">
      <Ecran s={s} etat={etat} compact={compact} libelle={libelle} />
      {revoir && <div className="sc-revoir-l">{etat === 'fin' && !reduit && <RevoirBouton onClick={rejouer} libelle="Revoir l’exemple" />}</div>}
    </div>
  );
}
export const SceneColis = (p) => <Joue Ecran={EcranColis} duree={DUREE_COLIS} {...p} />;
export const SceneAilleurs = (p) => <Joue Ecran={EcranAilleurs} duree={DUREE_AILLEURS} {...p} />;
export const SceneMois = (p) => <Joue Ecran={EcranMois} duree={DUREE_MOIS} {...p} />;
export const ScenePremier = (p) => <Joue Ecran={EcranPremier} duree={DUREE_PREMIER} seuil={0.5} revoir={false} {...p} />;
