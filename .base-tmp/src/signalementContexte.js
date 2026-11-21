// ── CE QUE « SIGNALER UN PROBLÈME » LIT DE L'ÉCRAN (8 nov.) ───────────────────
// Julien (8 nov.) : « une capture de l'écran, la version, l'appareil, les
// dernières erreurs, l'état des lectures — JAMAIS de données personnelles ».
//
// ⚠️ POURQUOI UNE CAPTURE SCHÉMATIQUE ET PAS UNE PHOTO DE L'ÉCRAN. Une vraie
//    capture (pixels) porte tout ce que l'écran montre : pseudos des acheteurs,
//    prix, adresses, codes de retrait. La masquer après coup ne se prouve pas (un
//    pseudo dans une photo ne se cherche pas), et la dessiner dans le navigateur
//    sans bibliothèque lourde ne marche pas avec les images des autres sites.
//    ⇒ On envoie le PLAN de l'écran : un rectangle par bloc visible, avec sa
//    sorte (bloc, texte, bouton, champ, image, masqué) — des NOMBRES, aucun
//    texte, aucune image. Il montre où est chaque chose (un écran vide, une
//    feuille coincée, un bouton sous un autre) sans rien de lui. Ce qui est
//    marqué sensible par le mode stream (`.vrm-sensible`) est un bloc « masqué ».
// Et l'ÉTAT de l'écran : des comptes (boutons, champs, feuilles ouvertes,
// squelettes de chargement, pannes affichées, garde-fou tombé, défilement).
import { typeAppareil } from './mesuresTerrain.js';
import { SORTES_PLAN, PLAN_MAX } from '../api/_lib/signalement.js';

const K = Object.fromEntries(SORTES_PLAN.map((s, i) => [s, i]));
const IMAGES = new Set(['IMG', 'SVG', 'CANVAS', 'VIDEO', 'PICTURE', 'IFRAME']);
const CHAMPS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const SAUTER = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'META', 'LINK', 'BR']);

const fond = (cs) => {
  const b = cs.backgroundColor;
  const visible = b && b !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(b);
  return visible || (cs.borderTopWidth !== '0px' && cs.borderTopStyle !== 'none') || (cs.boxShadow && cs.boxShadow !== 'none');
};

// Le plan de l'écran : { l, h, b: [[x, y, largeur, hauteur, sorte], …] }.
export function planEcran(doc = document, win = window) {
  try {
    const l = Math.round(win.innerWidth), h = Math.round(win.innerHeight);
    if (!l || !h) return null;
    const b = [];
    const ajouter = (r, k) => {
      if (b.length >= PLAN_MAX) return;
      const x = Math.max(0, Math.round(r.left)), y = Math.max(0, Math.round(r.top));
      const w = Math.round(Math.min(l, r.right) - x), hh = Math.round(Math.min(h, r.bottom) - y);
      if (w < 2 || hh < 2 || x >= l || y >= h) return;
      b.push([x, y, w, hh, k]);
    };
    const visite = (el, profondeur) => {
      if (b.length >= PLAN_MAX || profondeur > 60 || SAUTER.has(el.tagName)) return;
      const r = el.getBoundingClientRect();
      const cs = win.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return;
      const dedans = r.bottom > 0 && r.right > 0 && r.top < h && r.left < l;
      // Une boîte entièrement hors de l'écran (une longue liste défilée) : ses
      // enfants aussi — on n'y descend pas (le plan se prend en quelques ms).
      if (!dedans && r.height > 0 && cs.position !== 'fixed' && cs.position !== 'sticky' && cs.display !== 'contents') return;
      const tag = el.tagName.toUpperCase();
      // Rien de ce qui est sensible ne se détaille : un bloc « masqué », et on ne descend pas.
      if (el.classList && el.classList.contains('vrm-sensible')) { if (dedans) ajouter(r, K.masque); return; }
      if (CHAMPS.has(tag)) { if (dedans) ajouter(r, K.champ); return; }
      if (IMAGES.has(tag)) { if (dedans && r.width >= 8 && r.height >= 8) ajouter(r, K.image); return; }
      const bouton = tag === 'BUTTON' || tag === 'SUMMARY' || el.getAttribute('role') === 'button' || (tag === 'A' && el.hasAttribute('href'));
      if (dedans && r.width * r.height > 0) {
        if (bouton) ajouter(r, K.bouton);
        else if (fond(cs) && r.width >= 24 && r.height >= 16) ajouter(r, K.bloc);
      }
      // Le TEXTE : la boîte de chaque nœud texte (jamais son contenu).
      for (const n of el.childNodes) {
        if (b.length >= PLAN_MAX) return;
        if (n.nodeType === 3) {
          if (!/\S/.test(n.nodeValue || '') || !dedans) continue;
          try { const rg = doc.createRange(); rg.selectNodeContents(n); for (const rr of rg.getClientRects()) ajouter(rr, K.texte); } catch (_) {}
        } else if (n.nodeType === 1) visite(n, profondeur + 1);
      }
    };
    visite(doc.body, 0);
    return b.length ? { l, h, b } : null;
  } catch (_) { return null; }
}

export function etatEcranDom(doc = document, win = window) {
  try {
    const q = (s) => doc.querySelectorAll(s).length;
    const max = Math.max(1, (doc.documentElement.scrollHeight || 0) - win.innerHeight);
    return {
      boutons: q('button, [role="button"], a[href]'), champs: q('input:not([type="hidden"]), textarea, select'),
      feuilles: q('[role="dialog"]'), squelettes: q('.vrm-skeleton'), pannes: q('.vrm-etat-panne'),
      gardeFou: q('[data-garde-ecran]') > 0, defilement: Math.round(Math.min(100, Math.max(0, (win.scrollY || 0) / max * 100))),
    };
  } catch (_) { return null; }
}

export function systemeIci(nav = (typeof navigator !== 'undefined' ? navigator : {})) {
  const u = String(nav.userAgent || '');
  if (/iPad/.test(u) || (/Macintosh/.test(u) && Number(nav.maxTouchPoints) > 1)) return 'iPadOS';
  if (/iPhone|iPod/.test(u)) return 'iOS';
  if (/Android/.test(u)) return 'Android';
  if (/CrOS/.test(u)) return 'ChromeOS';
  if (/Mac OS X|Macintosh/.test(u)) return 'macOS';
  if (/Windows/.test(u)) return 'Windows';
  if (/Linux/.test(u)) return 'Linux';
  return 'autre';
}

// L'instantané de l'écran, pris AVANT que la feuille ne s'ouvre par-dessus.
export function instantaneEcran(doc = document, win = window) {
  let appareil = null, theme = null, enLigne = null;
  try { appareil = typeAppareil({ largeur: win.innerWidth, tactile: win.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 }); } catch (_) {}
  try { const t = doc.documentElement.getAttribute('data-theme'); theme = t === 'dark' ? 'sombre' : t === 'light' ? 'clair' : (win.matchMedia('(prefers-color-scheme: dark)').matches ? 'sombre' : 'clair'); } catch (_) {}
  try { enLigne = typeof navigator.onLine === 'boolean' ? navigator.onLine : null; } catch (_) {}
  return { appareil, systeme: systemeIci(), theme, enLigne, etatEcran: etatEcranDom(doc, win), plan: planEcran(doc, win) };
}
