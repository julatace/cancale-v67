// ════════════════════════════════════════════════════════════════════════════
//  LA RÈGLE « ORANGE / AMBRE » (24 nov., lot sauts-orange) — partagée par l'audit des sources
//  (scripts/audit-sans-orange.cjs) et le banc rendu (scripts/bancs/sans-orange.cjs, sa copie dans la page).
//  Décision de Julien du 23 nov. : aucun orange ni ambre, le jour et la nuit ; le rouge au seul doublon de N°.
//  Orange = teinte 15°–55°, saturation ≥ 40 %, clarté 15 %–96 % (les teintes pâles comme #FFF4E5 comptent).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const hsl = (r, g, b) => { r /= 255; g /= 255; b /= 255; const M = Math.max(r, g, b), m = Math.min(r, g, b); const l = (M + m) / 2; if (M === m) return { h: 0, s: 0, l }; const d = M - m; const s = l > 0.5 ? d / (2 - M - m) : d / (M + m); let h = M === r ? (g - b) / d + (g < b ? 6 : 0) : M === g ? (b - r) / d + 2 : (r - g) / d + 4; return { h: h * 60, s, l }; };
const estOrange = (c) => { if (!c || (c.a != null && c.a < 0.1)) return false; const x = hsl(c.r, c.g, c.b); return x.h >= 15 && x.h <= 55 && x.s >= 0.4 && x.l >= 0.15 && x.l <= 0.96; };
// Un littéral de couleur dans un texte source : #rgb, #rrggbb, #rrggbbaa, rgb()/rgba() (virgules ou espaces, « / a »).
const RE_COULEUR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F\w])|rgba?\(\s*\d{1,3}(?:\.\d+)?\s*[, ]\s*\d{1,3}(?:\.\d+)?\s*[, ]\s*\d{1,3}(?:\.\d+)?\s*(?:[,/]\s*[\d.]+%?\s*)?\)/g;
const lire = (t) => {
  if (t[0] === '#') {
    let h = t.slice(1); if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
  }
  const p = t.replace(/rgba?\(|\)/g, '').split(/[\s,/]+/).filter(Boolean);
  const a = p[3] == null ? 1 : /%$/.test(p[3]) ? parseFloat(p[3]) / 100 : parseFloat(p[3]);
  return { r: +p[0], g: +p[1], b: +p[2], a };
};
// Le marqueur d'une exception (une MARQUE : logo d'un transporteur, d'un site ; un objet réel dessiné) : sur la ligne.
const PERMIS = /orange-permis/;
module.exports = { hsl, estOrange, RE_COULEUR, lire, PERMIS };
