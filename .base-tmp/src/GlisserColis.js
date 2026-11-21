// ════════════════════════════════════════════════════════════════════════════
//  « COLIS FAIT » AU GLISSER (8 nov. 2026, « beauté ») — Colis, au doigt
//  Glisser la carte d'un colis VERS LA DROITE = « Déposé » (le geste existant
//  `gesteColisFait`, annulable 5 s par la pilule « Annuler », src/gesteAnnulable.js).
//  Le bouton « Déposé » de la carte reste : jamais un geste caché seul.
//
//   · au doigt (ou au stylet) seulement : la souris sélectionne du texte ;
//   · la direction se décide après 10 px : franchement horizontal (|dx| > 1,4 |dy|)
//     ET vers la droite, sinon c'est un défilement et la carte ne bouge plus de
//     tout le geste (`touch-action: pan-y` laisse le défilement au navigateur) ;
//   · la carte suit le doigt 1:1 jusqu'au seuil (35 % de la largeur, 96 px au
//     moins), puis résiste (élastique) ; au seuil, la coche se pose, une courte
//     vibration si l'appareil sait le faire (`navigator.vibrate`) ;
//   · relâchée avant le seuil : elle revient (retour élastique) — rien n'est écrit ;
//     relâchée après : `onFait()`, la carte revient en place et l'écran fait le
//     reste (elle passe dans « Envoyés », la pilule propose « Annuler ») ;
//   · le clic qui suit un glisser est avalé (on ne déclenche pas « Imprimer ») ;
//   · mouvement réduit : la carte suit le doigt (manipulation directe) mais ne
//     rebondit pas ; elle revient sans animation.
//  Aucun crochet React : l'état vit sur l'élément (la carte est rendue dans une
//  boucle) et le déplacement passe par `style.translate` (aucun rendu par image).
// ════════════════════════════════════════════════════════════════════════════

export const SEUIL_PART = 0.35;
export const SEUIL_MIN = 96;
export const AMORCE = 10;

// La position affichée pour un déplacement du doigt `dx` (px, vers la droite).
// Linéaire jusqu'au seuil, puis élastique (la formule d'iOS), jamais vers la gauche.
export function positionGlisse(dx, largeur) {
  const w = Math.max(1, largeur || 360);
  const seuil = Math.max(SEUIL_MIN, w * SEUIL_PART);
  if (!(dx > 0)) return 0;
  if (dx <= seuil) return dx;
  const au = dx - seuil, c = 0.55;
  return seuil + (au * w * c) / (w + c * au);
}
export const seuilGlisse = (largeur) => Math.max(SEUIL_MIN, Math.max(1, largeur || 360) * SEUIL_PART);

// Le sens d'un geste après l'amorce : 'h' (glisser vers la droite) ou 'v' (le reste).
export function sensGeste(dx, dy) {
  if (Math.abs(dx) < AMORCE && Math.abs(dy) < AMORCE) return null;
  return dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.4 ? 'h' : 'v';
}

const reduit = () => { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (_) { return false; } };
const vibrer = (ms) => { try { if (navigator && typeof navigator.vibrate === 'function') navigator.vibrate(ms); } catch (_) {} };

function poser(el, x, anime) {
  if (!el) return;
  el.style.transition = anime ? (reduit() ? 'none' : 'translate 380ms cubic-bezier(.34,1.32,.64,1)') : 'none';
  el.style.translate = x ? `${x}px 0` : '';
  el.style.setProperty('--glisse', `${Math.max(0, x)}px`);
  if (x) el.setAttribute('data-glisse-actif', '1'); else el.removeAttribute('data-glisse-actif');
}

// Les propriétés à poser sur la carte. `actif` faux ⇒ rien (la carte ne glisse pas).
export function propsGlisserFait({ actif, onFait }) {
  if (!actif) return {};
  return {
    'data-glisse-fait': '',
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse' || !e.isPrimary) return;
      if (e.target && e.target.closest && e.target.closest('input,textarea,select,[data-sans-glisse]')) return;
      const el = e.currentTarget;
      el.__glisse = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: 0, sens: null, w: el.offsetWidth || 360, pret: false };
    },
    onPointerMove: (e) => {
      const el = e.currentTarget, s = el.__glisse;
      if (!s || e.pointerId !== s.id) return;
      const dx = e.clientX - s.x0, dy = e.clientY - s.y0;
      if (!s.sens) {
        s.sens = sensGeste(dx, dy);
        if (!s.sens) return;
        if (s.sens === 'h') { try { el.setPointerCapture(e.pointerId); } catch (_) {} }
      }
      if (s.sens !== 'h') return;
      s.x = positionGlisse(dx, s.w);
      const pret = dx >= seuilGlisse(s.w);
      if (pret !== s.pret) { s.pret = pret; if (pret) { el.setAttribute('data-glisse-pret', '1'); vibrer(10); } else el.removeAttribute('data-glisse-pret'); }
      poser(el, s.x, false);
    },
    onPointerUp: (e) => {
      const el = e.currentTarget, s = el.__glisse;
      if (!s || e.pointerId !== s.id) return;
      el.__glisse = null;
      if (s.sens !== 'h') return;
      el.__avale = Date.now();
      el.removeAttribute('data-glisse-pret');
      poser(el, 0, true);
      if (s.pret && onFait) { vibrer(18); onFait(); }
    },
    onPointerCancel: (e) => {
      const el = e.currentTarget, s = el.__glisse;
      el.__glisse = null;
      if (s && s.sens === 'h') { el.removeAttribute('data-glisse-pret'); poser(el, 0, true); }
    },
    onClickCapture: (e) => {
      const el = e.currentTarget;
      if (el.__avale && Date.now() - el.__avale < 400) { e.preventDefault(); e.stopPropagation(); }
    },
  };
}
