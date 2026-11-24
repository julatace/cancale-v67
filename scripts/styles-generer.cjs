// ════════════════════════════════════════════════════════════════════════════
//  LES DIX STYLES À ESSAYER (24 nov. 2026, Julien : « propose un design un peu plus foncé en gris pour l'iPhone et
//  améliore tous les boutons […] essaye un peu de changer de style » ; puis : dix styles à essayer DANS l'app).
//  docs/passation/2026-11-24-style-graphite.md
//
//  UNE source : la table PRESETS ci-dessous. Ce script FABRIQUE `src/natif/styles-choix-jetons.css` (les jetons de
//  chaque style, clair ET sombre) et vérifie, AVANT d'écrire, chaque paire texte/fond qui compte (≥ 4,5:1) et
//  qu'aucune couleur n'est orange ou ambre. Un style ne change QUE des jetons (`--n-*` du contrat natif et `--g-*` de
//  la famille de boutons, src/natif/styles-choix.css) : aucune ligne de JavaScript par style.
//
//    node scripts/styles-generer.cjs            écrit le fichier (refuse s'il y a un contraste sous 4,5:1)
//    node scripts/styles-generer.cjs --verifier rouge si le fichier n'est pas celui que la table fabrique
//    node scripts/styles-generer.cjs --prouve   chaque garde rougit sur une table abîmée (mutation)
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const SORTIE = path.join(__dirname, '..', 'src', 'natif', 'styles-choix-jetons.css');

// ── la couleur ──
const hex = (h) => { const x = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)); };
const lum = (h) => { const t = hex(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * t[0] + 0.7152 * t[1] + 0.0722 * t[2]; };
const rapport = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const melange = (a, b, t) => { const p = hex(a), q = hex(b); return '#' + p.map((v, i) => Math.round(v * (1 - t) + q[i] * t).toString(16).padStart(2, '0')).join('').toUpperCase(); };
const rgba = (h, a) => `rgb(${hex(h).join(' ')} / ${a})`;
// Orange ou ambre : teinte 18–55°, saturation > 0,40, ni presque noir ni presque blanc (la règle de Julien du 23 nov.).
const hsl = (h) => { const [r, g, b] = hex(h).map((v) => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return { h: 0, s: 0, l }; const s = d / (1 - Math.abs(2 * l - 1)); let t = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; t *= 60; if (t < 0) t += 360; return { h: t, s, l }; };
const estAmbre = (h) => { const c = hsl(h); return c.h >= 18 && c.h <= 55 && c.s > 0.40 && c.l > 0.12 && c.l < 0.92; };

// ── LA TABLE ── (clair, sombre) : fond, latérale, carte, carte2 (zone, champ), bord, encre, texte, encre2, encre3,
// accent (lien, actif, rare), plein (LE bouton), surPlein, vert (fait), et la forme (rayons, hauteur, profondeur, police).
const SANS = '-apple-system, "SF Pro Text", "Inter", system-ui, sans-serif';
const SERIF = '"New York", "Iowan Old Style", "Charter", Georgia, serif';
const PRESETS = {
  graphite: { forme: { rCarte: 20, rBouton: 14, hPlein: 50, rChip: 999, profondeur: 'doux', appui: 0.97 },
    clair: { fond: '#DADCE0', laterale: '#CFD2D7', carte: '#F4F5F7', carte2: '#E7E9EC', bord: '#C3C7CD', encre: '#1D1D1F', texte: '#2A2C31', encre2: '#4D5159', encre3: '#868A92', accent: '#3A4654', plein: '#2A2E35', surPlein: '#FFFFFF', vert: '#17653F' },
    sombre: { fond: '#232428', laterale: '#1B1C1F', carte: '#2E3035', carte2: '#383A40', bord: '#474A51', encre: '#F5F5F7', texte: '#E6E7EA', encre2: '#B2B5BC', encre3: '#8A8D94', accent: '#B4BFCC', plein: '#E9EBEE', surPlein: '#1B1C1F', vert: '#80D9A9' } },
  ardoise: { forme: { rCarte: 20, rBouton: 14, hPlein: 50, rChip: 999, profondeur: 'doux', appui: 0.97 },
    clair: { fond: '#D6DDE5', laterale: '#CAD3DD', carte: '#F3F6F9', carte2: '#E2E8EE', bord: '#B9C5D1', encre: '#162231', texte: '#25313F', encre2: '#45556A', encre3: '#7D8B9C', accent: '#365372', plein: '#2C425A', surPlein: '#FFFFFF', vert: '#15603F' },
    sombre: { fond: '#19212B', laterale: '#141B23', carte: '#232E3B', carte2: '#2C3847', bord: '#3C4A5C', encre: '#EEF3F8', texte: '#DDE5EE', encre2: '#A6B5C6', encre3: '#7F8FA2', accent: '#A3BAD3', plein: '#C8D6E6', surPlein: '#14202E', vert: '#7DD3A6' } },
  pierre: { forme: { rCarte: 20, rBouton: 14, hPlein: 50, rChip: 999, profondeur: 'doux', appui: 0.97 },
    clair: { fond: '#DEDBD6', laterale: '#D3CFC9', carte: '#F7F5F2', carte2: '#EAE7E2', bord: '#C9C3BB', encre: '#221F1C', texte: '#2F2B27', encre2: '#555049', encre3: '#8C867E', accent: '#55504A', plein: '#3A3631', surPlein: '#FFFFFF', vert: '#1F6140' },
    sombre: { fond: '#23211F', laterale: '#1B1A18', carte: '#2F2C29', carte2: '#3A3733', bord: '#4B4742', encre: '#F5F2EE', texte: '#E9E5DF', encre2: '#BBB4AB', encre3: '#8F8981', accent: '#CEC6BB', plein: '#EAE5DE', surPlein: '#23201C', vert: '#86D2A6' } },
  encre: { forme: { rCarte: 18, rBouton: 12, hPlein: 50, rChip: 999, profondeur: 'aucune', appui: 0.97 },
    clair: { fond: '#E6E6E6', laterale: '#DADADA', carte: '#FFFFFF', carte2: '#F0F0F0', bord: '#BDBDBD', encre: '#000000', texte: '#0D0D0D', encre2: '#3A3A3A', encre3: '#767676', accent: '#000000', plein: '#000000', surPlein: '#FFFFFF', vert: '#0B5A33' },
    sombre: { fond: '#0A0A0B', laterale: '#000000', carte: '#161618', carte2: '#202023', bord: '#38383D', encre: '#FFFFFF', texte: '#F5F5F5', encre2: '#C9C9CE', encre3: '#8E8E94', accent: '#FFFFFF', plein: '#FFFFFF', surPlein: '#000000', vert: '#8BE3B3' } },
  papier: { forme: { rCarte: 16, rBouton: 12, hPlein: 48, rChip: 6, profondeur: 'doux', appui: 0.97, titre: SERIF, plaque: 'kraft' },
    clair: { fond: '#ECE8E0', laterale: '#E2DDD3', carte: '#FBF9F5', carte2: '#F0ECE4', bord: '#D6CFC2', encre: '#1F1B16', texte: '#2B261F', encre2: '#544C41', encre3: '#8D8578', accent: '#2E3A4B', plein: '#24201A', surPlein: '#FFFFFF', vert: '#1E5E3C' },
    sombre: { fond: '#1E1C19', laterale: '#171513', carte: '#2A2723', carte2: '#34302B', bord: '#47423B', encre: '#F4EFE7', texte: '#E8E2D8', encre2: '#BEB5A7', encre3: '#918879', accent: '#C6D0DD', plein: '#EFE9DF', surPlein: '#1E1B17', vert: '#8DD0A8' } },
  verre: { forme: { rCarte: 22, rBouton: 16, hPlein: 50, rChip: 999, profondeur: 'verre', appui: 0.97, verre: true },
    clair: { fond: '#DDE1E7', fond2: '#CDD3DC', laterale: '#D2D7DE', carte: '#F6F8FA', carteA: 0.70, carte2: '#E7EAEF', bord: '#C5CBD4', encre: '#1A1D22', texte: '#272B31', encre2: '#4A5059', encre3: '#848A94', accent: '#3C4B60', plein: '#28303C', surPlein: '#FFFFFF', vert: '#17623E' },
    sombre: { fond: '#1D2027', fond2: '#13151A', laterale: '#171A20', carte: '#2A2E36', carteA: 0.78, carte2: '#343943', bord: '#454B56', encre: '#F4F6F9', texte: '#E4E7EC', encre2: '#AFB5BF', encre3: '#868C97', accent: '#B5C3D6', plein: '#E6EAF0', surPlein: '#181B21', vert: '#82D6AA' } },
  nuit: { forme: { rCarte: 20, rBouton: 14, hPlein: 50, rChip: 999, profondeur: 'doux', appui: 0.97 },
    clair: { fond: '#DCE2EC', laterale: '#D0D8E5', carte: '#F5F8FC', carte2: '#E5EBF3', bord: '#BCC7D8', encre: '#0F1B2D', texte: '#1D2A3D', encre2: '#405069', encre3: '#7A879B', accent: '#2C5794', plein: '#1C3050', surPlein: '#FFFFFF', vert: '#15613E' },
    sombre: { fond: '#0E1626', laterale: '#0A1120', carte: '#172238', carte2: '#1F2C46', bord: '#2E3D5C', encre: '#EEF3FB', texte: '#DCE5F3', encre2: '#A5B5CF', encre3: '#7C8CA8', accent: '#93B6EE', plein: '#93B6EE', surPlein: '#0C1424', vert: '#83D8AD' } },
  menthe: { forme: { rCarte: 20, rBouton: 14, hPlein: 50, rChip: 999, profondeur: 'doux', appui: 0.97 },
    clair: { fond: '#DCE1E1', laterale: '#D0D6D6', carte: '#F5F8F8', carte2: '#E5EAEA', bord: '#BEC8C7', encre: '#182020', texte: '#252E2E', encre2: '#47524F', encre3: '#7F8A88', accent: '#1C6B59', plein: '#1F2928', surPlein: '#FFFFFF', vert: '#17623E' },
    sombre: { fond: '#1B2020', laterale: '#151919', carte: '#252C2C', carte2: '#2F3737', bord: '#404A4A', encre: '#F1F6F5', texte: '#E0E8E7', encre2: '#ABB8B6', encre3: '#83908E', accent: '#86DEC5', plein: '#E3EBEA', surPlein: '#161C1C', vert: '#86DEC5' } },
  studio: { forme: { rCarte: 4, rBouton: 4, hPlein: 48, rChip: 3, profondeur: 'aucune', appui: 0.98, poidsTitre: 800 },
    clair: { fond: '#EFEFEF', laterale: '#E4E4E4', carte: '#FFFFFF', carte2: '#F4F4F4', bord: '#CFCFCF', encre: '#000000', texte: '#0A0A0A', encre2: '#3D3D3D', encre3: '#7A7A7A', accent: '#000000', plein: '#000000', surPlein: '#FFFFFF', vert: '#0E5A34' },
    sombre: { fond: '#000000', laterale: '#000000', carte: '#111111', carte2: '#1B1B1B', bord: '#3A3A3A', encre: '#FFFFFF', texte: '#F2F2F2', encre2: '#C4C4C4', encre3: '#8A8A8A', accent: '#FFFFFF', plein: '#FFFFFF', surPlein: '#000000', vert: '#8FE0B5' } },
  arcade: { forme: { rCarte: 24, rBouton: 18, hPlein: 52, rChip: 999, profondeur: 'arcade', appui: 0.94 },
    clair: { fond: '#D9DEE6', laterale: '#CDD3DD', carte: '#F7F8FA', carte2: '#E6EAF0', bord: '#BEC6D2', encre: '#151B26', texte: '#232B38', encre2: '#465163', encre3: '#7E899A', accent: '#34507A', plein: '#2A3E61', surPlein: '#FFFFFF', vert: '#14613D' },
    sombre: { fond: '#161A22', laterale: '#11141B', carte: '#222833', carte2: '#2C3340', bord: '#3D4555', encre: '#F2F5FA', texte: '#E1E6EF', encre2: '#AAB4C5', encre3: '#7F8A9D', accent: '#A6BFE6', plein: '#A6BFE6', surPlein: '#111622', vert: '#86D9AE' } },
};
const ORDRE = Object.keys(PRESETS);

// ── les jetons dérivés d'une palette ──
function jetons(p, f, sombre) {
  const v = p.vert;
  const vertFond = sombre ? rgba(v, 0.16) : melange(p.carte, v, 0.12);
  const ardoiseFond = sombre ? rgba(p.accent, 0.16) : melange(p.carte, p.accent, 0.11);
  const encreFond = sombre ? rgba(p.encre, 0.10) : melange(p.carte, p.encre, 0.07);
  const appui = melange(p.carte, p.encre, sombre ? 0.10 : 0.09);
  const carte = p.carteA ? rgba(p.carte, p.carteA) : p.carte;
  const j = {
    '--n-fond': p.fond, '--n-laterale': p.laterale, '--n-carte': carte, '--n-carte-2': p.carte2, '--n-bord': p.bord,
    '--n-trait': melange(p.carte, p.bord, 0.55), '--n-encre': p.encre, '--n-texte': p.texte, '--n-encre-2': p.encre2, '--n-encre-3': p.encre3,
    '--n-accent': p.accent, '--n-plein': p.plein, '--n-sur-plein': p.surPlein,
    '--n-teinte': ardoiseFond, '--n-sur-teinte': p.encre,
    '--n-ambre': p.accent, '--n-ambre-fond': ardoiseFond, '--n-ambre-bord': 'transparent', '--n-sur-ambre': rapport(p.accent, '#FFFFFF') >= 4.5 ? '#FFFFFF' : '#000000',
    '--n-vert': v, '--n-vert-fond': vertFond, '--n-vert-bord': 'transparent',
    '--n-teal': p.accent, '--n-teal-fond': ardoiseFond, '--n-teal-bord': 'transparent',
    '--n-gris': p.encre2, '--n-gris-fond': encreFond, '--n-gris-bord': 'transparent',
    '--n-inactif': p.carte2, '--n-sur-inactif': p.encre2, '--n-inverse': p.plein, '--n-sur-inverse': p.surPlein,
    '--n-appui': appui, '--n-curseur': sombre ? melange(p.carte2, p.encre, 0.12) : p.carte, '--n-pouce': '#FFFFFF',
    '--n-barre': rgba(p.fond, sombre ? 0.80 : 0.78),
    '--n-heros': p.carte2, '--n-heros-2': p.carte, '--n-sur-heros': p.encre, '--n-sur-heros-2': p.encre2, '--n-heros-trait': rgba(p.encre, 0.10),
    '--n-graphe-barre': melange(p.carte, p.encre3, 0.45), '--n-graphe-barre-fort': p.encre3,
    '--n-r-carte': f.rCarte + 'px', '--n-r-vignette': Math.max(3, Math.round(f.rCarte * 0.6)) + 'px', '--n-r-plaque': Math.min(f.rChip, 8) + 'px',
    // la famille de boutons (src/natif/styles-choix.css)
    '--g-r-bouton': f.rBouton + 'px', '--g-h-plein': f.hPlein + 'px', '--g-r-chip': f.rChip === 999 ? '999px' : f.rChip + 'px',
    '--g-appui': String(f.appui),
    // enfoncé : plus foncé ; un plein déjà (presque) noir s'éclaircit (il ne peut pas foncer)
    '--g-plein-appui': lum(p.plein) < 0.02 ? melange(p.plein, '#FFFFFF', 0.22) : melange(p.plein, '#000000', sombre ? 0.18 : 0.28),
    '--g-second-fond': ardoiseFond, '--g-second-texte': sombre ? p.encre : p.encre,
    '--g-second-appui': sombre ? rgba(p.accent, 0.26) : melange(p.carte, p.accent, 0.20),
    '--g-champ-fond': sombre ? melange(p.fond, '#000000', 0.18) : melange(p.carte2, p.fond, 0.35),
    '--g-champ-ombre': sombre ? 'inset 0 1px 2px rgb(0 0 0 / .45)' : 'inset 0 1px 2px rgb(0 0 0 / .08)',
    '--g-anneau': `0 0 0 3px ${rgba(p.accent, sombre ? 0.45 : 0.30)}`,
    '--g-titre-police': f.titre || 'var(--n-police)', '--g-titre-poids': String(f.poidsTitre || 700),
    '--g-chip-ardoise': p.accent, '--g-chip-encre': p.encre2,
  };
  const prof = f.profondeur;
  j['--g-plein-relief'] = prof === 'aucune' ? 'none'
    : prof === 'arcade' ? `inset 0 1px 0 ${rgba('#FFFFFF', sombre ? 0.35 : 0.22)}, 0 4px 0 ${melange(p.plein, '#000000', sombre ? 0.45 : 0.40)}, 0 6px 14px ${rgba('#000000', sombre ? 0.40 : 0.18)}`
    : `inset 0 1px 0 ${rgba('#FFFFFF', sombre ? 0.30 : 0.16)}, 0 1px 2px ${rgba('#000000', sombre ? 0.40 : 0.18)}, 0 2px 8px -2px ${rgba('#000000', sombre ? 0.35 : 0.16)}`;
  j['--g-plein-relief-appui'] = prof === 'arcade' ? `inset 0 1px 0 ${rgba('#FFFFFF', 0.12)}, 0 1px 0 ${melange(p.plein, '#000000', 0.40)}` : (prof === 'aucune' ? 'none' : `inset 0 1px 2px ${rgba('#000000', 0.25)}`);
  j['--g-descente'] = prof === 'arcade' ? '3px' : '0px';
  j['--g-carte-ombre'] = prof === 'aucune' ? 'none' : prof === 'arcade' ? `0 2px 0 ${rgba(p.bord, sombre ? 0.6 : 0.9)}, 0 8px 24px -12px ${rgba('#000000', sombre ? 0.6 : 0.20)}`
    : `0 1px 2px ${rgba('#000000', sombre ? 0.30 : 0.05)}, 0 8px 24px -14px ${rgba('#000000', sombre ? 0.55 : 0.18)}`;
  j['--g-plaque-fond'] = f.plaque === 'kraft' ? (sombre ? '#4A4236' : '#D8CDB9') : p.carte2;
  j['--g-plaque-texte'] = f.plaque === 'kraft' ? (sombre ? '#EEEAE3' : '#2E261A') : p.encre;
  j['--n-ombre-carte'] = j['--g-carte-ombre'];
  if (sombre) j['--n-fond-degrade'] = f.verre ? `linear-gradient(180deg, ${p.fond} 0%, ${p.fond2} 100%)` : `linear-gradient(180deg, ${p.fond} 0%, ${p.fond} 45%, ${melange(p.fond, '#000000', 0.22)} 100%)`;
  if (f.verre) { j['--g-fond-image'] = `linear-gradient(180deg, ${p.fond} 0%, ${p.fond2} 100%)`; j['--g-verre'] = 'saturate(160%) blur(18px)'; }
  else { j['--g-fond-image'] = 'none'; j['--g-verre'] = 'none'; }
  return j;
}

// ── les paires qui doivent tenir 4,5:1 (texte sur fond), et la chasse à l'orange ──
function controler(table) {
  const ko = [];
  for (const [id, s] of Object.entries(table)) for (const t of ['clair', 'sombre']) {
    const p = s[t], sombre = t === 'sombre';
    const carte = p.carteA ? melange(p.fond2 || p.fond, p.carte, p.carteA) : p.carte;   // la carte translucide, posée sur le fond le plus contrasté
    const fonds = { fond: p.fond, carte, carte2: p.carte2, appui: melange(p.carte, p.encre, sombre ? 0.10 : 0.09) };
    if (p.fond2) fonds.fond2 = p.fond2;
    const vFond = sombre ? melange(carte, p.vert, 0.16) : melange(p.carte, p.vert, 0.12);
    const aFond = sombre ? melange(carte, p.accent, 0.16) : melange(p.carte, p.accent, 0.11);
    const eFond = sombre ? melange(carte, p.encre, 0.10) : melange(p.carte, p.encre, 0.07);
    const paires = [];
    for (const [n, f] of Object.entries(fonds)) { paires.push(['encre/' + n, p.encre, f], ['texte/' + n, p.texte, f], ['encre2/' + n, p.encre2, f]); }
    paires.push(['accent/fond', p.accent, p.fond], ['accent/carte', p.accent, carte], ['surPlein/plein', p.surPlein, p.plein],
      ['vert/carte', p.vert, carte], ['vert/vertFond', p.vert, vFond], ['accent/chip', p.accent, aFond], ['encre/chip', p.encre, aFond],
      ['encre2/chipEncre', p.encre2, eFond], ['surPlein/pleinAppui', p.surPlein, lum(p.plein) < 0.02 ? melange(p.plein, '#FFFFFF', 0.22) : melange(p.plein, '#000000', sombre ? 0.18 : 0.28)],
      ['encre2/champ', p.encre2, sombre ? melange(p.fond, '#000000', 0.18) : melange(p.carte2, p.fond, 0.35)]);
    if (s.forme.plaque === 'kraft') paires.push(['plaque', sombre ? '#EEEAE3' : '#2E261A', sombre ? '#4A4236' : '#D8CDB9']);
    for (const [n, a, b] of paires) { const k = rapport(a, b); if (k < 4.5) ko.push(`${id} ${t} ${n} ${k.toFixed(2)}:1`); }
    const kraft = s.forme.plaque === 'kraft' ? { kraftFond: sombre ? '#4A4236' : '#D8CDB9', kraftTexte: sombre ? '#EEEAE3' : '#2E261A' } : {};
    for (const [n, c] of Object.entries({ ...p, ...kraft })) if (typeof c === 'string' && /^#/.test(c) && estAmbre(c)) ko.push(`${id} ${t} ${n} ${c} est orange/ambre`);
  }
  return ko;
}

function css(table) {
  const lignes = ['/* ══════ FABRIQUÉ par scripts/styles-generer.cjs — ne pas modifier à la main (la table est dans le script). ══════',
    '   Les jetons des dix styles à essayer (Paramètres → Apparence → Style). Clair : [data-style="x"] ; sombre : la racine en',
    '   data-theme="dark". Le style « Actuel » (aucun attribut) garde src/natif/jetons.css tel quel. */'];
  const decl = (j) => Object.entries(j).map(([k, v]) => `  ${k}: ${v};`).join('\n');
  for (const id of Object.keys(table)) {
    const s = table[id];
    lignes.push(`[data-style="${id}"] {\n${decl(jetons(s.clair, s.forme, false))}\n}`);
    lignes.push(`:root[data-theme="dark"][data-style="${id}"], :root[data-theme="dark"] [data-style="${id}"] {\n${decl(jetons(s.sombre, s.forme, true))}\n}`);
  }
  return lignes.join('\n') + '\n';
}

module.exports = { PRESETS, ORDRE, controler, css, rapport, estAmbre, jetons };

if (require.main === module) {
  const arg = process.argv[2] || '';
  if (arg === '--prouve') {
    let bon = 0;
    const t1 = JSON.parse(JSON.stringify(PRESETS)); t1.graphite.clair.encre2 = '#9A9EA6';
    if (controler(t1).some((x) => /graphite clair encre2/.test(x))) bon++; else console.log('❌ un gris trop pâle passe');
    const t2 = JSON.parse(JSON.stringify(PRESETS)); t2.pierre.clair.accent = '#C8781E';
    if (controler(t2).some((x) => /orange/.test(x))) bon++; else console.log('❌ un accent orange passe');
    const t3 = JSON.parse(JSON.stringify(PRESETS)); t3.nuit.sombre.surPlein = '#8899BB';
    if (controler(t3).some((x) => /nuit sombre surPlein/.test(x))) bon++; else console.log('❌ un texte de plein illisible passe');
    console.log(bon === 3 ? '✅ styles-generer --prouve : les 3 mutations rougissent' : '❌ styles-generer --prouve');
    process.exit(bon === 3 ? 0 : 1);
  }
  const ko = controler(PRESETS);
  if (ko.length) { console.log('❌ contraste ou orange :\n  ' + ko.join('\n  ')); process.exit(1); }
  const voulu = css(PRESETS);
  if (arg === '--verifier') {
    const lu = fs.existsSync(SORTIE) ? fs.readFileSync(SORTIE, 'utf8') : '';
    if (lu !== voulu) { console.log('❌ src/natif/styles-choix-jetons.css n\'est pas celui que la table fabrique (node scripts/styles-generer.cjs)'); process.exit(1); }
    console.log(`✅ styles-generer : ${ORDRE.length} styles × clair/sombre, chaque paire ≥ 4,5:1, aucun orange, fichier à jour`); process.exit(0);
  }
  fs.writeFileSync(SORTIE, voulu);
  console.log(`✅ ${ORDRE.length} styles écrits dans ${path.relative(process.cwd(), SORTIE)} (${voulu.length} octets)`);
}
