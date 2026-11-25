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
  // Monochrome (24 nov., la direction préférée de Julien ; maquette du coordinateur « style-mono ») : page gris #ECEDF0,
  // cartes blanches à filet #E5E7EB et ombre douce, plein NOIR, vert #22C55E en point ou en aplat seulement (jamais un texte
  // vert sur clair : `vert` = l'encre, `point` = le vert), cartes 24, boutons 12 ; chaque sorte de bouton se voit : plein
  // noir, secondaire à contour d'encre (`second: 'contour'`), liens soulignés, icônes sur un rond à contour (`rond`) ;
  // la nuit l'inverse (plein blanc). Champs optionnels de la table (aucun autre style ne les porte, son bloc ne change pas) :
  // `contour` (bord du secondaire, ≥ 3:1), `limite` (bord d'un champ et d'un rond, ≥ 3:1), `douce` (aplat d'un rond, d'une
  // puce, de l'onglet actif), `point` + `surPoint` (le vert et le texte posé dessus), `bordCarte` (filet des cartes).
  monochrome: { forme: { rCarte: 24, rBouton: 12, hPlein: 48, rChip: 999, profondeur: 'mono', appui: 0.97, plaque: 'encre', second: 'contour', liens: 'souligne', rond: 'plaque', champ: 'contour' },
    // (25 nov., Julien : « je veux que le gris de fond soit un peu foncé ») #ECEDF0 → #E2E4E8 : les cartes blanches ressortent
    clair: { fond: '#E2E4E8', laterale: '#D9DBE0', carte: '#FFFFFF', carte2: '#F9FAFB', bord: '#E5E7EB', encre: '#111111', texte: '#111111', encre2: '#575D67', encre3: '#6B7280', accent: '#111111', plein: '#000000', surPlein: '#FFFFFF', vert: '#111111',
      point: '#22C55E', surPoint: '#052E16', contour: '#111111', limite: '#6B7280', douce: '#F3F4F6', bordCarte: '#E5E7EB' },
    sombre: { fond: '#0B0B0C', laterale: '#050506', carte: '#161618', carte2: '#202023', bord: '#2E2E33', encre: '#F5F5F6', texte: '#F5F5F6', encre2: '#A1A1AA', encre3: '#7A7A82', accent: '#F5F5F6', plein: '#FFFFFF', surPlein: '#000000', vert: '#F5F5F6',
      point: '#22C55E', surPoint: '#052E16', contour: '#F5F5F6', limite: '#7A7A82', douce: '#2A2A2E', bordCarte: '#2E2E33' } },
  // C3 Vintex (25 nov., Julien : « fait un mélange c3 vintex ») : de C3, le fond gris clair un peu foncé, la sobriété, la plaque
  // du N° gravée, les chaussures sur plaque, la barre du bas en capsule flottante ; de Vintex (NATIF.md §0), les cartes BLANCHES à
  // ombre très douce, l'échelle réduite, les étiquettes pastel franches (`etiquettes`), les logos en couleur, le plein à l'ENCRE.
  // Accent : l'ARDOISE, rare (jamais un bleu vif : audit-style-vintex S1). Chaque sorte de bouton se voit par sa FORME (plein
  // encre · contour ≥ 3:1 · lien souligné · rond à contour). Ses règles de forme sont dans src/natif/styles-c3vintex.css,
  // chargé SEULEMENT quand ce style est choisi (src/natif/styleChoix.js).
  c3vintex: { forme: { rCarte: 16, rBouton: 10, hPlein: 46, rChip: 999, profondeur: 'c3', appui: 0.97, plaque: 'grave', second: 'contour', liens: 'souligne', rond: 'plaque', champ: 'contour' },
    clair: { fond: '#DFE2E6', laterale: '#D4D8DD', carte: '#FFFFFF', carte2: '#F5F6F8', bord: '#E4E4E7', encre: '#16181D', texte: '#30343B', encre2: '#555A63', encre3: '#6B7079', accent: '#34506E', plein: '#16181D', surPlein: '#FFFFFF', vert: '#17744A',
      point: '#34506E', surPoint: '#FFFFFF', contour: '#6B717D', limite: '#767C86', douce: '#EEF0F3', bordCarte: '#E4E4E7',
      etiquettes: { vert: ['#17744A', '#DDF4E6'], teal: ['#0D6A6B', '#DAF0F0'], gris: ['#4C525B', '#ECEEF1'] } },
    sombre: { fond: '#121316', laterale: '#0C0D0F', carte: '#1C1D21', carte2: '#24252A', bord: '#303238', encre: '#F4F4F5', texte: '#E4E4E7', encre2: '#A1A1AA', encre3: '#8A8A93', accent: '#A9BCD3', plein: '#F4F4F5', surPlein: '#18181B', vert: '#6FE3B5',
      point: '#A9BCD3', surPoint: '#121316', contour: '#A1A1AA', limite: '#7C7C85', douce: '#2A2B30', bordCarte: '#2A2B30',
      etiquettes: { vert: ['#6FE3B5', '#1E3A2F'], teal: ['#6ED6D6', '#1B3638'], gris: ['#C4C4CC', '#2A2B30'] } } },
};
const ORDRE = Object.keys(PRESETS);
// la plaque du N° : kraft (Papier), encre (Monochrome : noire au jour, gris anthracite la nuit), sinon le ton de la carte
const PLAQUES = { kraft: { clair: ['#D8CDB9', '#2E261A'], sombre: ['#4A4236', '#EEEAE3'] }, encre: { clair: ['#111111', '#FFFFFF'], sombre: ['#3A3A40', '#F5F5F6'] },
  // gravée (C3 Vintex) : un gris clair creusé, l'encre dessus (le creux est dessiné par styles-c3vintex.css)
  grave: { clair: ['#E6E8EC', '#16181D'], sombre: ['#2C2E34', '#F4F4F5'] } };

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
  j['--g-plein-relief'] = prof === 'aucune' || prof === 'mono' ? 'none'
    : prof === 'c3' ? `inset 0 1px 0 ${rgba('#FFFFFF', sombre ? 0.40 : 0.14)}, 0 1px 2px ${rgba('#000000', sombre ? 0.40 : 0.14)}, 0 6px 14px -8px ${rgba('#000000', sombre ? 0.50 : 0.30)}`
    : prof === 'arcade' ? `inset 0 1px 0 ${rgba('#FFFFFF', sombre ? 0.35 : 0.22)}, 0 4px 0 ${melange(p.plein, '#000000', sombre ? 0.45 : 0.40)}, 0 6px 14px ${rgba('#000000', sombre ? 0.40 : 0.18)}`
    : `inset 0 1px 0 ${rgba('#FFFFFF', sombre ? 0.30 : 0.16)}, 0 1px 2px ${rgba('#000000', sombre ? 0.40 : 0.18)}, 0 2px 8px -2px ${rgba('#000000', sombre ? 0.35 : 0.16)}`;
  j['--g-plein-relief-appui'] = prof === 'arcade' ? `inset 0 1px 0 ${rgba('#FFFFFF', 0.12)}, 0 1px 0 ${melange(p.plein, '#000000', 0.40)}` : (prof === 'aucune' || prof === 'mono' ? 'none' : `inset 0 1px 2px ${rgba('#000000', 0.25)}`);
  j['--g-descente'] = prof === 'arcade' ? '3px' : '0px';
  j['--g-carte-ombre'] = prof === 'c3' ? `0 0 0 1px ${sombre ? p.bordCarte : rgba('#101828', 0.05)}, 0 1px 2px ${rgba('#101828', sombre ? 0.30 : 0.05)}, 0 10px 24px -16px ${rgba('#101828', sombre ? 0.60 : 0.20)}`
    : prof === 'mono' ? `0 0 0 1px ${p.bordCarte}` + (sombre ? '' : `, 0 1px 2px ${rgba('#000000', 0.05)}, 0 4px 12px -6px ${rgba('#000000', 0.08)}`)
    : prof === 'aucune' ? 'none' : prof === 'arcade' ? `0 2px 0 ${rgba(p.bord, sombre ? 0.6 : 0.9)}, 0 8px 24px -12px ${rgba('#000000', sombre ? 0.6 : 0.20)}`
    : `0 1px 2px ${rgba('#000000', sombre ? 0.30 : 0.05)}, 0 8px 24px -14px ${rgba('#000000', sombre ? 0.55 : 0.18)}`;
  const pq = PLAQUES[f.plaque] && PLAQUES[f.plaque][sombre ? 'sombre' : 'clair'];
  j['--g-plaque-fond'] = pq ? pq[0] : p.carte2;
  j['--g-plaque-texte'] = pq ? pq[1] : p.encre;
  j['--n-ombre-carte'] = j['--g-carte-ombre'];
  if (sombre) j['--n-fond-degrade'] = f.verre ? `linear-gradient(180deg, ${p.fond} 0%, ${p.fond2} 100%)` : `linear-gradient(180deg, ${p.fond} 0%, ${p.fond} 45%, ${melange(p.fond, '#000000', 0.22)} 100%)`;
  if (f.verre) { j['--g-fond-image'] = `linear-gradient(180deg, ${p.fond} 0%, ${p.fond2} 100%)`; j['--g-verre'] = 'saturate(160%) blur(18px)'; }
  else { j['--g-fond-image'] = 'none'; j['--g-verre'] = 'none'; }
  // les champs optionnels (Monochrome) : chaque sorte de bouton se distingue ; les autres styles n'émettent rien de plus
  if (f.second === 'contour') Object.assign(j, { '--g-second-fond': p.carte, '--g-second-texte': p.encre, '--g-second-appui': p.douce,
    '--g-second-contour': `inset 0 0 0 1.5px ${p.contour}`, '--g-onglet-fond': p.douce, '--g-puce-fond': p.douce });
  if (f.rond === 'plaque') Object.assign(j, { '--g-rond-fond': p.douce, '--g-rond-contour': `inset 0 0 0 1px ${p.limite}` });
  if (f.champ === 'contour') Object.assign(j, { '--g-champ-fond': p.carte, '--g-champ-ombre': `inset 0 0 0 1px ${p.limite}`, '--n-curseur': p.douce,
    '--g-anneau': `0 0 0 2px ${p.carte}, 0 0 0 4px ${p.encre}` });
  if (f.liens === 'souligne') j['--g-lien-deco'] = 'underline';
  if (p.point) Object.assign(j, { '--g-point': p.point, '--g-sur-point': p.surPoint });
  // les étiquettes pastel franches (C3 Vintex, comme le défaut Vintex) : texte franc sur un aplat pâle
  if (p.etiquettes) for (const [n, [t, f]] of Object.entries(p.etiquettes)) Object.assign(j, { [`--n-${n}`]: t, [`--n-${n}-fond`]: f });
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
      ['encre2/champ', p.encre2, s.forme.champ === 'contour' ? p.carte : sombre ? melange(p.fond, '#000000', 0.18) : melange(p.carte2, p.fond, 0.35)]);
    const pq = PLAQUES[s.forme.plaque] && PLAQUES[s.forme.plaque][t];
    if (pq) paires.push(['plaque', pq[1], pq[0]]);
    if (p.douce) paires.push(['encre/douce', p.encre, p.douce], ['encre2/douce', p.encre2, p.douce]);
    if (p.point) paires.push(['surPoint/point', p.surPoint, p.point]);
    if (p.etiquettes) for (const [n, [tx, fd]] of Object.entries(p.etiquettes)) {
      paires.push(['etiquette-' + n, tx, fd]);
      for (const c of [tx, fd]) if (estAmbre(c)) ko.push(`${id} ${t} etiquette-${n} ${c} est orange/ambre`);
    }
    // un contour qui DÉSIGNE un contrôle (secondaire, champ, rond) : ≥ 3:1 sur ce qui l'entoure (WCAG 1.4.11)
    const contours = [];
    if (p.contour) contours.push(['contour/carte', p.contour, carte], ['contour/fond', p.contour, p.fond]);
    if (p.limite) contours.push(['limite/carte', p.limite, carte], ['limite/fond', p.limite, p.fond], ['limite/douce', p.limite, p.douce || carte]);
    for (const [n, a, b] of contours) { const k = rapport(a, b); if (k < 3) ko.push(`${id} ${t} ${n} ${k.toFixed(2)}:1 (< 3:1)`); }
    // le vert de Monochrome n'est jamais un TEXTE sur clair : `vert` (le texte « fait ») reste l'encre
    if (p.point && !p.etiquettes && !sombre && rapport(p.vert, p.carte) < 7) ko.push(`${id} ${t} vert ${p.vert} : un texte vert sur clair (le vert est un point, pas un texte)`);
    for (const [n, a, b] of paires) { const k = rapport(a, b); if (k < 4.5) ko.push(`${id} ${t} ${n} ${k.toFixed(2)}:1`); }
    const kraft = pq ? { plaqueFond: pq[0], plaqueTexte: pq[1] } : {};
    for (const [n, c] of Object.entries({ ...p, ...kraft })) if (typeof c === 'string' && /^#/.test(c) && estAmbre(c)) ko.push(`${id} ${t} ${n} ${c} est orange/ambre`);
  }
  return ko;
}

function css(table) {
  const lignes = ['/* ══════ FABRIQUÉ par scripts/styles-generer.cjs — ne pas modifier à la main (la table est dans le script). ══════',
    '   Les jetons des styles à essayer (Paramètres → Apparence → Style). Clair : [data-style="x"] ; sombre : la racine en',
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
    const t4 = JSON.parse(JSON.stringify(PRESETS)); t4.monochrome.clair.contour = '#D1D5DB';
    if (controler(t4).some((x) => /monochrome clair contour\/carte/.test(x))) bon++; else console.log('❌ un contour de secondaire invisible passe');
    const t5 = JSON.parse(JSON.stringify(PRESETS)); t5.monochrome.clair.vert = '#22C55E';
    if (controler(t5).some((x) => /monochrome clair vert/.test(x))) bon++; else console.log('❌ un texte vert sur clair passe');
    console.log(bon === 5 ? '✅ styles-generer --prouve : les 5 mutations rougissent' : '❌ styles-generer --prouve');
    process.exit(bon === 5 ? 0 : 1);
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
