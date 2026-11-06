// ════════════════════════════════════════════════════════════════════════════
//  Les « photos » des films : des baskets DESSINÉES (SVG), aucune photo d'un
//  vrai vendeur, aucun logo déposé (pas de virgule, pas de bandes : un simple
//  pan de cuir et des coutures). Une clé dit tout : `<silhouette>_<teinte>_<vue>`
//  (ex. `basse_blanc_1`), servie à l'adresse d'une photo Vinted
//  (`https://images1.vinted.net/t/<clé>.jpg`) que le tournage intercepte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const TEINTES = {
  blanc: { tige: '#f6f5f2', bout: '#ecebe6', pan: '#dcdad3', talon: '#d9d6cf', sem: '#ffffff', sous: '#d8d4cb', lacet: '#ffffff', fond: ['#efece7', '#e2ded6'] },
  noir: { tige: '#2b2b2d', bout: '#232325', pan: '#3a3a3d', talon: '#19191a', sem: '#f3f2ee', sous: '#1b1b1c', lacet: '#2f2f31', fond: ['#eceae6', '#dedad3'] },
  creme: { tige: '#efe6d4', bout: '#e6dcc6', pan: '#c9b48e', talon: '#b89d72', sem: '#f7f1e3', sous: '#a98a5c', lacet: '#f4ecdc', fond: ['#f1ede6', '#e4ded3'] },
  gris: { tige: '#c9ccd0', bout: '#b9bdc2', pan: '#8d939b', talon: '#6f757d', sem: '#eef0f2', sous: '#5d636b', lacet: '#d9dce0', fond: ['#eeeff0', '#dfe1e3'] },
  vert: { tige: '#f2f1ec', bout: '#e8e7e1', pan: '#2f6b4f', talon: '#2f6b4f', sem: '#fbfaf6', sous: '#c6a676', lacet: '#ffffff', fond: ['#eef0ec', '#dfe3dc'] },
  bleu: { tige: '#f3f4f6', bout: '#e7e9ec', pan: '#27467a', talon: '#27467a', sem: '#ffffff', sous: '#c2c6cc', lacet: '#ffffff', fond: ['#eceff3', '#dde2e9'] },
  rouge: { tige: '#f4f2ef', bout: '#e9e6e1', pan: '#a8343a', talon: '#a8343a', sem: '#ffffff', sous: '#2b2b2d', lacet: '#ffffff', fond: ['#f1ecea', '#e4dcd9'] },
  sable: { tige: '#d8c3a0', bout: '#cdb690', pan: '#b39a72', talon: '#9c835e', sem: '#efe6d6', sous: '#7d6747', lacet: '#d8c3a0', fond: ['#f0ebe3', '#e2dace'] },
  argent: { tige: '#e3e5e8', bout: '#d2d5d9', pan: '#a7adb5', talon: '#b9bec5', sem: '#f5f6f7', sous: '#9aa0a8', lacet: '#eef0f2', fond: ['#edeef0', '#dcdfe3'] },
  rose: { tige: '#f4e4e1', bout: '#ecd7d3', pan: '#d7a49c', talon: '#cf968d', sem: '#fffaf8', sous: '#e0c4bf', lacet: '#fbefed', fond: ['#f3eeec', '#e7dfdc'] },
};

function chaussure(sil, c) {
  // Côté, bout à gauche. Repère : 600 × 800, sol à y = 530.
  const SOL = 530;
  const bas = sil === 'course' ? 50 : 32;            // hauteur de la semelle
  const sy = SOL - bas;                               // haut de la semelle
  // La ligne du laçage (du premier œillet au col) et le col.
  const L0 = sil === 'course' ? [262, sy - 80] : [266, sy - 92];
  const L1 = sil === 'montante' ? [392, sy - 262] : sil === 'course' ? [384, sy - 140] : [382, sy - 146];
  const colY = sil === 'montante' ? sy - 268 : sil === 'course' ? sy - 138 : sy - 146;
  const talonY = sil === 'montante' ? sy - 250 : sil === 'course' ? sy - 128 : sy - 138;
  const tige = `M90 ${sy} C82 ${sy - 30} 98 ${sy - 56} 150 ${sy - 60} C196 ${sy - 64} 236 ${sy - 72} ${L0[0]} ${L0[1]}`
    + ` L${L1[0]} ${L1[1]} C${L1[0] + 10} ${L1[1] - 6} ${L1[0] + 22} ${L1[1] - 12} ${L1[0] + 32} ${L1[1] - 14}`
    + ` C${L1[0] + 36} ${L1[1] - 34} ${L1[0] + 56} ${L1[1] - 40} ${L1[0] + 66} ${L1[1] - 26}`
    + ` C${L1[0] + 70} ${L1[1] - 16} ${L1[0] + 68} ${colY + 6} ${L1[0] + 74} ${colY + 4}`
    + ` C${L1[0] + 100} ${colY + 6} ${L1[0] + 120} ${talonY + 2} ${L1[0] + 134} ${talonY + 10}`
    + ` C${L1[0] + 146} ${talonY + 40} ${L1[0] + 148} ${sy - 50} ${L1[0] + 144} ${sy} Z`;
  const xT = L1[0] + 144;
  const bout = `M90 ${sy} C82 ${sy - 30} 98 ${sy - 56} 150 ${sy - 60} L196 ${sy - 64} C188 ${sy - 42} 186 ${sy - 20} 190 ${sy} Z`;
  const talon = `M${xT - 52} ${sy} C${xT - 48} ${sy - 50} ${xT - 30} ${talonY + 40} ${xT - 12} ${talonY + 8} C${xT - 2} ${talonY + 30} ${xT + 4} ${sy - 50} ${xT} ${sy} Z`;
  const pan = `M196 ${sy} C204 ${sy - 30} 228 ${sy - 50} 276 ${sy - 58} L${xT - 120} ${sy - 72} C${xT - 92} ${sy - 76} ${xT - 66} ${sy - 66} ${xT - 54} ${sy - 46} C${xT - 48} ${sy - 30} ${xT - 48} ${sy - 12} ${xT - 50} ${sy} Z`;
  const n = sil === 'montante' ? 8 : 5;
  let lacets = '';
  for (let i = 0; i < n; i++) {
    const k = (i + 0.3) / (n - 0.4), x = L0[0] + (L1[0] - L0[0]) * k, y = L0[1] + (L1[1] - L0[1]) * k;
    const d = `M${(x - 16).toFixed(1)} ${(y + 6).toFixed(1)} L${(x + 14).toFixed(1)} ${(y - 18).toFixed(1)}`;
    lacets += `<path d="${d}" stroke="rgba(0,0,0,.28)" stroke-width="11" stroke-linecap="round"/><path d="${d}" stroke="${c.lacet}" stroke-width="7.5" stroke-linecap="round"/>`;
  }
  const semelle = sil === 'course'
    ? `<path d="M82 ${sy + 10} C82 ${sy - 2} 94 ${sy} 118 ${sy} L${xT + 2} ${sy - 6} C${xT + 16} ${sy - 6} ${xT + 22} ${sy + 12} ${xT + 18} ${sy + 26} C${xT + 14} ${sy + 40} ${xT + 2} ${SOL} ${xT - 12} ${SOL} L116 ${SOL} C94 ${SOL} 80 ${sy + 32} 82 ${sy + 10} Z" fill="${c.sem}" stroke="rgba(0,0,0,.14)" stroke-width="2"/>
       <path d="M116 ${SOL - 2} L${xT - 12} ${SOL - 2} C${xT} ${SOL - 2} ${xT + 10} ${SOL - 8} ${xT + 14} ${SOL - 14} L${xT + 14} ${SOL + 4} C${xT + 8} ${SOL + 12} ${xT - 2} ${SOL + 14} ${xT - 14} ${SOL + 14} L116 ${SOL + 14} C98 ${SOL + 14} 86 ${SOL + 6} 82 ${SOL - 8} Z" fill="${c.sous}"/>
       <path d="M150 ${sy + 24} C230 ${sy + 14} 330 ${sy + 32} 420 ${sy + 18} C460 ${sy + 12} 490 ${sy + 20} 512 ${sy + 14}" fill="none" stroke="rgba(0,0,0,.10)" stroke-width="3"/>`
    : `<path d="M84 ${sy + 8} C84 ${sy} 92 ${sy - 2} 102 ${sy - 2} L${xT - 6} ${sy - 2} C${xT + 4} ${sy - 2} ${xT + 8} ${sy + 6} ${xT + 8} ${sy + 14} L${xT + 8} ${SOL - 2} L82 ${SOL - 2} Z" fill="${c.sem}" stroke="rgba(0,0,0,.14)" stroke-width="2"/>
       <path d="M82 ${SOL - 4} L${xT + 8} ${SOL - 4} L${xT + 8} ${SOL + 6} C${xT + 8} ${SOL + 12} ${xT + 2} ${SOL + 14} ${xT - 6} ${SOL + 14} L98 ${SOL + 14} C88 ${SOL + 14} 82 ${SOL + 8} 82 ${SOL + 2} Z" fill="${c.sous}"/>
       <path d="M96 ${sy + 13} L${xT - 2} ${sy + 13}" stroke="rgba(0,0,0,.09)" stroke-width="2.5" stroke-dasharray="7 6"/>`;
  return `<g>
    <path d="${tige}" fill="${c.tige}"/>
    <path d="${bout}" fill="${c.bout}"/>
    <path d="${pan}" fill="${c.pan}"/>
    <path d="${pan}" fill="none" stroke="rgba(0,0,0,.16)" stroke-width="2" stroke-dasharray="6 5" transform="translate(0,-7)"/>
    <path d="${talon}" fill="${c.talon}"/>
    <path d="${tige}" fill="none" stroke="rgba(0,0,0,.2)" stroke-width="2.5" stroke-linejoin="round"/>
    ${lacets}
    ${semelle}
  </g>`;
}

function photoSvg(cle) {
  const m = /^([a-z]+)_([a-z]+)(?:_(\d+))?/.exec(String(cle || '').replace(/\.(jpe?g|webp|png)$/i, ''));
  const sil = m && ['basse', 'course', 'montante'].includes(m[1]) ? m[1] : 'basse';
  const c = (m && TEINTES[m[2]]) || TEINTES.blanc;
  const vue = m && m[3] ? Number(m[3]) : 1;
  const tr = 'translate(0,-60) ' + (vue === 2 ? 'translate(600,0) scale(-1,1)' : vue === 3 ? 'translate(300,470) rotate(-7) scale(1.04) translate(-300,-470)' : '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="600" height="800">
  <defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.fond[0]}"/><stop offset=".62" stop-color="${c.fond[0]}"/><stop offset="1" stop-color="${c.fond[1]}"/></linearGradient>
  <radialGradient id="o" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="rgba(0,0,0,.22)"/><stop offset="1" stop-color="rgba(0,0,0,0)"/></radialGradient></defs>
  <rect width="600" height="800" fill="url(#f)"/>
  <ellipse cx="306" cy="488" rx="250" ry="20" fill="url(#o)"/>
  <g transform="${tr}">${chaussure(sil, c)}</g>
</svg>`;
}

module.exports = { photoSvg, TEINTES };
