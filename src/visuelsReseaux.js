// ═══════════════════════════════════════════════════════════════════════════
// VISUELS POUR LES RÉSEAUX SOCIAUX (11 nov., lot visuels-reseaux) — LA RÈGLE
// ═══════════════════════════════════════════════════════════════════════════
// Demande validée par Julien : « des visuels pour les réseaux sociaux en un
// geste ». Depuis une annonce (Annonces → « … » → Visuel réseaux) ou plusieurs
// cochées (Annonces → Sélectionner → Actions → « Nouveautés de la semaine »),
// VRM dessine DANS LE NAVIGATEUR une image carrée 1080 × 1080 et une story
// 1080 × 1920 : photo(s), prix, taille, marque, état, et le nom de SA boutique
// (réglage, vide par défaut). Trois modèles sobres, une couleur d'accent au choix.
//
// • SANS IA, SANS SERVEUR (§2.9) : un <canvas>, la police du système. Rien ne part
//   nulle part ; rien n'est publié — le partage du téléphone (ou le téléchargement)
//   est SON geste.
// • CE QUI EST DESSINÉ, et rien d'autre : titre, marque, taille, état, prix en
//   euros, photos, nom de la boutique. JAMAIS le N° de rangement, le prix d'achat,
//   le compte, le pseudo : `articleVisuel` ne les recopie pas (le plan ne peut pas
//   les écrire, audit-visuels-reseaux le vérifie).
// • Une photo pas lisible n'est JAMAIS une image vide : l'article sort du visuel
//   et l'écran le dit (src/composants/VisuelsReseaux.jsx). Le plan ne reçoit que
//   des photos lues ; un article sans photo lue n'a pas de place.
// • Prix : des euros seulement (§3 International), jamais converti ; pas su ⇒
//   pas de prix sur l'image, et l'écran le dit.
//
// Module PUR : `planVisuel` rend une liste d'opérations (fond, rectangles,
// photos, textes) calculée avec une fonction de mesure injectée ; `dessinerVisuel`
// les exécute sur un contexte 2D. Tenu par scripts/audit-visuels-reseaux.cjs.
// ═══════════════════════════════════════════════════════════════════════════

export const FORMATS = Object.freeze({ carre: { w: 1080, h: 1080 }, story: { w: 1080, h: 1920 } });
export const MODELES = Object.freeze(['epure', 'plein', 'carte']);
// Une couleur d'accent, rare (§7) : le prix et un point. Le violet est refusé (§3 Palette).
export const ACCENTS = Object.freeze([
  { k: 'bleu', c: '#0071E3' },
  { k: 'encre', c: '#1D1D1F' },
  { k: 'vert', c: '#1E8E3E' },
  { k: 'orange', c: '#E8590C' },
  { k: 'rose', c: '#D6336C' },
]);
export const PAR_PAGE = Object.freeze({ carre: 4, story: 6 });
export const LOT_MAX = 24;              // 6 images au plus en carré, 4 en story
export const PHOTOS_MAX_SEULE = 3;      // une annonce seule : la photo + 2 petites (story, modèle Épuré)
export const BOUTIQUE_MAX = 40;
export const CLE_REGLAGES = 'vrm_visuels_reglages';
export const POLICE = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif';

const ENCRE = '#1D1D1F', GRIS = '#6E6E73', FOND_GRIS = '#F2F2F7', BLANC = '#FFFFFF';

const propre = (v, max) => {
  const s = String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f​-‏ -‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim();
  return max && s.length > max ? s.slice(0, max).trimEnd() : s;
};

// Les réglages rangés (SYNC_KEYS : les mêmes sur ses appareils). Tout ce qui n'est
// pas reconnu retombe au défaut ; le nom de boutique est vide par défaut.
export function reglagesValides(r) {
  const x = r && typeof r === 'object' ? r : {};
  return {
    format: FORMATS[x.format] ? x.format : 'carre',
    modele: MODELES.includes(x.modele) ? x.modele : 'epure',
    accent: ACCENTS.some((a) => a.k === x.accent) ? x.accent : 'bleu',
    boutique: propre(x.boutique, BOUTIQUE_MAX),
  };
}
export const couleurAccent = (k) => (ACCENTS.find((a) => a.k === k) || ACCENTS[0]).c;

// Le prix en euros, > 0, < 100 000 ; autre devise ou pas su ⇒ null (jamais converti, §3).
export function prixEuros(p, devise) {
  const d = String(devise || 'EUR').toUpperCase();
  if (d !== 'EUR') return null;
  const brut = p && typeof p === 'object' ? p.amount : p;
  if (brut == null || brut === '') return null;
  const n = Number(String(brut).replace(',', '.'));
  return Number.isFinite(n) && n > 0 && n < 100000 ? Math.round(n * 100) / 100 : null;
}

// Un article du visuel, depuis une annonce Vinted de l'app (forme de `mapWardrobeItem`).
// `photos` : la galerie connue (src/visionneuse.js `galerieDe`), la photo de l'annonce en tête.
// ⚠️ Rien d'autre n'est recopié (ni N°, ni prix d'achat, ni compte) : le plan ne peut pas l'écrire.
export function articleVisuel(it, photos = []) {
  const a = it && typeof it === 'object' ? it : null;
  if (!a) return null;
  const tete = typeof a.photo === 'string' ? a.photo : (a.photo && a.photo.url) || '';
  const liste = [];
  for (const u of [tete, ...(Array.isArray(photos) ? photos : [])]) {
    const s = typeof u === 'string' ? u.trim() : '';
    if (s && !liste.includes(s) && /^(https:\/\/|data:image\/|blob:)/.test(s)) liste.push(s);
    if (liste.length >= PHOTOS_MAX_SEULE) break;
  }
  return {
    cle: `${String((a._acc && a._acc.vinted_user_id) || a.uid || '')}:${String(a.id == null ? '' : a.id)}`,
    titre: propre(a.title, 120),
    marque: propre(a.brand, 60),
    taille: propre(a.size, 40),
    etat: propre(a.condition, 60),
    prix: prixEuros(a.price, a.currency),
    photos: liste,
  };
}

// Les pages d'un lot : 4 articles par image carrée, 6 par story.
export function pagesLot(articles, format) {
  const n = PAR_PAGE[format] || 4;
  const l = (Array.isArray(articles) ? articles : []).slice(0, LOT_MAX);
  const p = [];
  for (let i = 0; i < l.length; i += n) p.push(l.slice(i, i + n));
  return p;
}

// La découpe « object-fit: cover » d'une image iw × ih dans un cadre w × h.
export function couvrir(iw, ih, w, h) {
  if (!(iw > 0 && ih > 0 && w > 0 && h > 0)) return null;
  const s = Math.max(w / iw, h / ih);
  const sw = w / s, sh = h / s;
  return { sx: (iw - sw) / 2, sy: (ih - sh) / 2, sw, sh };
}

// Une mesure approchée (bancs, audit) quand aucun canvas n'est là.
export const mesureApprochee = (texte, px, graisse = 400) => String(texte || '').length * px * (graisse >= 600 ? 0.58 : 0.54);

// Coupe un texte en `lignes` lignes au plus de largeur `max` ; la dernière finit par « … » si besoin.
export function couper(texte, px, graisse, max, lignes, mesurer = mesureApprochee) {
  const mots = propre(texte).split(' ').filter(Boolean);
  if (!mots.length) return [];
  const res = []; let cour = '';
  for (let i = 0; i < mots.length; i++) {
    const essai = cour ? cour + ' ' + mots[i] : mots[i];
    if (mesurer(essai, px, graisse) <= max || !cour) { cour = essai; continue; }
    res.push(cour); cour = mots[i];
    if (res.length === lignes) { cour = ''; res[lignes - 1] = res[lignes - 1] + ' ' + mots.slice(i).join(' '); break; }
  }
  if (cour) res.push(cour);
  const garde = res.slice(0, lignes);
  const reste = res.length > lignes;
  return garde.map((l, i) => (i === garde.length - 1 ? raccourcir(l + (reste ? ' …' : ''), px, graisse, max, mesurer) : raccourcir(l, px, graisse, max, mesurer)));
}
function raccourcir(l, px, graisse, max, mesurer) {
  if (mesurer(l, px, graisse) <= max) return l;
  let s = l.replace(/\s*…$/, '');
  while (s.length > 1 && mesurer(s + '…', px, graisse) > max) s = s.slice(0, -1);
  return s.trimEnd() + '…';
}

// ── LE PLAN ─────────────────────────────────────────────────────────────────
// opts = { format, modele, accent, boutique, articles (avec `lues` : les indices de
//          photos LUES, la première d'abord), lot (bool), page, pages,
//          textes: { taille(t), lot }, prixTexte(n) }
// Rend { w, h, ops } ; chaque op : fond · rect · degrade · photo · texte · point.
export function planVisuel(opts, mesurer = mesureApprochee) {
  const o = opts || {};
  const format = FORMATS[o.format] ? o.format : 'carre';
  const modele = MODELES.includes(o.modele) ? o.modele : 'epure';
  const accent = couleurAccent(o.accent);
  const { w, h } = FORMATS[format];
  const boutique = propre(o.boutique, BOUTIQUE_MAX);
  const textes = o.textes || {};
  const tTaille = typeof textes.taille === 'function' ? textes.taille : (t) => `Taille ${t}`;
  const prixT = typeof o.prixTexte === 'function' ? o.prixTexte : (n) => `${String(n).replace('.', ',')} €`;
  const articles = (Array.isArray(o.articles) ? o.articles : []).filter((a) => a && Array.isArray(a.lues) && a.lues.length);
  const ops = [];
  const T = (texte, x, y, px, graisse, couleur, align = 'left', max = w) => { if (texte) ops.push({ t: 'texte', texte, x, y, px, graisse, couleur, align, max }); };
  const details = (a) => [a.taille ? tTaille(a.taille) : '', a.etat].filter(Boolean).join(' · ');
  const surAccent = o.accent === 'encre' ? BLANC : BLANC;
  if (!articles.length) return { w, h, ops, vide: true };

  if (o.lot || articles.length > 1) return planLot({ w, h, format, modele, accent, boutique, articles, ops, T, tTaille, prixT, mesurer, titre: propre(textes.lot || '', 60), page: o.page, pages: o.pages, accentK: o.accent });

  const a = articles[0];
  const M = 64;
  const prix = a.prix != null ? prixT(a.prix) : '';
  if (modele === 'plein') {
    ops.push({ t: 'fond', couleur: ENCRE });
    ops.push({ t: 'photo', a: 0, p: a.lues[0], x: 0, y: 0, w, h, r: 0 });
    ops.push({ t: 'degrade', x: 0, y: Math.round(h * 0.45), w, h: h - Math.round(h * 0.45), de: 'rgba(0,0,0,0)', a: 'rgba(0,0,0,0.78)' });
    if (boutique) {
      const px = format === 'story' ? 36 : 30; const lw = Math.min(w - 2 * M, mesurer(boutique, px, 600) + 2 * 24);
      const y0 = format === 'story' ? 120 : M;
      ops.push({ t: 'rect', x: M, y: y0, w: lw, h: px + 32, r: (px + 32) / 2, couleur: 'rgba(0,0,0,0.5)' });
      T(boutique, M + 24, y0 + 16, px, 600, BLANC, 'left', lw - 48);
    }
    const big = format === 'story' ? 64 : 54;
    const pPx = format === 'story' ? 76 : 62;
    const bas = h - (format === 'story' ? 180 : M);
    // le prix dans une pastille d'accent, en bas à droite (encre ⇒ pastille blanche, texte encre)
    let pw = 0;
    if (prix) {
      pw = mesurer(prix, pPx, 700) + 2 * 32; const ph = pPx + 36;
      ops.push({ t: 'rect', x: w - M - pw, y: bas - ph, w: pw, h: ph, r: ph / 2, couleur: o.accent === 'encre' ? BLANC : accent });
      T(prix, w - M - pw / 2, bas - ph + 18, pPx, 700, o.accent === 'encre' ? ENCRE : surAccent, 'center', pw);
    }
    const max = w - 2 * M - (pw ? pw + 32 : 0);
    const dt = details(a); const dPx = format === 'story' ? 40 : 34;
    let y = bas - (dt ? dPx + 4 : 0);
    if (dt) T(couper(dt, dPx, 400, max, 1, mesurer)[0], M, y, dPx, 400, 'rgba(255,255,255,0.86)', 'left', max);
    const lt = couper(a.titre, big, 700, max, 2, mesurer);
    y -= lt.length * Math.round(big * 1.14) + 10;
    lt.forEach((l, i) => T(l, M, y + i * Math.round(big * 1.14), big, 700, BLANC, 'left', max));
    if (a.marque) T(couper(a.marque.toUpperCase(), 30, 600, max, 1, mesurer)[0], M, y - 46, 30, 600, 'rgba(255,255,255,0.72)', 'left', max);
    return { w, h, ops };
  }

  if (modele === 'carte') {
    ops.push({ t: 'fond', couleur: FOND_GRIS });
    const story = format === 'story';
    const cx = story ? 72 : 96, cy = story ? 250 : 72, cw = w - 2 * cx, ch = story ? 1480 : 896;
    if (boutique) T(boutique, w / 2, story ? 140 : h - 60, story ? 40 : 30, 600, story ? ENCRE : GRIS, 'center', w - 2 * M);
    ops.push({ t: 'rect', x: cx, y: cy, w: cw, h: ch, r: 48, couleur: BLANC, ombre: true });
    const pin = story ? 28 : 24, phH = story ? 1060 : 590;
    ops.push({ t: 'photo', a: 0, p: a.lues[0], x: cx + pin, y: cy + pin, w: cw - 2 * pin, h: phH, r: 32 });
    if (prix) {
      const pPx = story ? 60 : 48; const pw = mesurer(prix, pPx, 700) + 56; const ph = pPx + 30;
      ops.push({ t: 'rect', x: cx + pin + 24, y: cy + pin + phH - 24 - ph, w: pw, h: ph, r: ph / 2, couleur: accent });
      T(prix, cx + pin + 24 + pw / 2, cy + pin + phH - 24 - ph + 15, pPx, 700, BLANC, 'center', pw);
    }
    const tx = cx + pin + 8, max = cw - 2 * pin - 16;
    let y = cy + pin + phH + (story ? 48 : 34);
    if (a.marque) { T(couper(a.marque.toUpperCase(), story ? 32 : 26, 600, max, 1, mesurer)[0], tx, y, story ? 32 : 26, 600, GRIS, 'left', max); y += story ? 48 : 40; }
    const big = story ? 58 : 44;
    const lt = couper(a.titre, big, 700, max, story ? 2 : 1, mesurer);
    lt.forEach((l, i) => T(l, tx, y + i * Math.round(big * 1.16), big, 700, ENCRE, 'left', max));
    y += lt.length * Math.round(big * 1.16) + (story ? 18 : 12);
    const dt = details(a); if (dt) T(couper(dt, story ? 38 : 32, 400, max, 1, mesurer)[0], tx, y, story ? 38 : 32, 400, GRIS, 'left', max);
    return { w, h, ops };
  }

  // Épuré
  ops.push({ t: 'fond', couleur: BLANC });
  const story = format === 'story';
  const extras = story ? a.lues.slice(1, PHOTOS_MAX_SEULE) : [];
  let y = M;
  if (story) {
    if (boutique) { ops.push({ t: 'point', x: w / 2 - mesurer(boutique, 40, 600) / 2 - 26, y: 142, r: 9, couleur: accent }); T(boutique, w / 2 + 0, 120, 40, 600, ENCRE, 'center', w - 2 * M - 60); }
    y = boutique ? 210 : 120;
  }
  const phH = story ? (extras.length ? 1000 : 1240) : 640;
  ops.push({ t: 'photo', a: 0, p: a.lues[0], x: M, y, w: w - 2 * M, h: phH, r: story ? 48 : 40 });
  y += phH;
  if (extras.length) {
    const g = 24; const ew = (w - 2 * M - g * (PHOTOS_MAX_SEULE - 2)) / (PHOTOS_MAX_SEULE - 1);
    y += g;
    extras.forEach((p, i) => ops.push({ t: 'photo', a: 0, p, x: M + i * (ew + g), y, w: ew, h: 300, r: 32 }));
    y += 300;
  }
  y += story ? 56 : 40;
  const pPx = story ? 96 : 80;
  const pw = prix ? mesurer(prix, pPx, 700) : 0;
  const max = w - 2 * M - (pw ? pw + 40 : 0);
  if (prix) T(prix, w - M, y + (story ? 40 : 30), pPx, 700, accent, 'right', pw + 4);
  if (a.marque) { const px = story ? 34 : 28; T(couper(a.marque.toUpperCase(), px, 600, max, 1, mesurer)[0], M, y, px, 600, GRIS, 'left', max); y += story ? 50 : 42; }
  const big = story ? 56 : 46;
  const lt = couper(a.titre, big, 700, max, story && !extras.length ? 2 : 1, mesurer);
  lt.forEach((l, i) => T(l, M, y + i * Math.round(big * 1.16), big, 700, ENCRE, 'left', max));
  y += lt.length * Math.round(big * 1.16) + 14;
  const dt = details(a); if (dt) T(couper(dt, story ? 38 : 32, 400, max, 1, mesurer)[0], M, y, story ? 38 : 32, 400, GRIS, 'left', max);
  if (!story && boutique) {
    const px = 28; ops.push({ t: 'point', x: M + 9, y: h - M - px / 2 + 2, r: 8, couleur: accent });
    T(boutique, M + 30, h - M - px, px, 600, ENCRE, 'left', w - 2 * M - 30);
  }
  return { w, h, ops };
}

function planLot({ w, h, format, modele, accent, boutique, articles, ops, T, tTaille, prixT, mesurer, titre, page, pages, accentK }) {
  const story = format === 'story';
  const M = story ? 64 : 56;
  const sombre = modele === 'plein';
  const fond = modele === 'plein' ? '#111113' : modele === 'carte' ? FOND_GRIS : BLANC;
  const encre = sombre ? BLANC : ENCRE, gris = sombre ? 'rgba(255,255,255,0.7)' : GRIS;
  ops.push({ t: 'fond', couleur: fond });
  let y = story ? 120 : M;
  const tPx = story ? 72 : 56;
  if (titre) T(couper(titre, tPx, 700, w - 2 * M - 120, 1, mesurer)[0], M, y, tPx, 700, encre, 'left', w - 2 * M - 120);
  if (pages > 1) T(`${page}/${pages}`, w - M, y + (tPx - 30) / 2, 30, 600, gris, 'right', 120);
  y += Math.round(tPx * 1.2);
  if (boutique) {
    const px = story ? 36 : 28;
    ops.push({ t: 'point', x: M + 8, y: y + px / 2 + 2, r: 8, couleur: accentK === 'encre' && sombre ? BLANC : accent });
    T(boutique, M + 28, y, px, 600, gris, 'left', w - 2 * M - 28);
    y += Math.round(px * 1.5);
  }
  y += story ? 40 : 24;
  const n = articles.length;
  const cols = n === 1 ? 1 : 2;
  const rows = Math.ceil(n / cols);
  const g = story ? 28 : 24;
  const bas = h - M;
  const cw = (w - 2 * M - g * (cols - 1)) / cols;
  const chMax = (bas - y - g * (rows - 1)) / rows;
  const texteH = modele === 'plein' ? 0 : (story ? 112 : 92);
  const ch = chMax;
  articles.forEach((a, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    // la dernière rangée incomplète est centrée
    const surRangee = r === rows - 1 ? n - r * cols : cols;
    const decal = surRangee < cols ? (cw + g) * (cols - surRangee) / 2 : 0;
    const x = M + decal + c * (cw + g), yy = y + r * (ch + g);
    const prix = a.prix != null ? prixT(a.prix) : '';
    const pPx = story ? 44 : 36;
    if (modele === 'carte') ops.push({ t: 'rect', x, y: yy, w: cw, h: ch, r: 32, couleur: BLANC, ombre: true });
    const pin = modele === 'carte' ? 16 : 0;
    const phH = ch - texteH - pin * (modele === 'carte' ? 1 : 0) - (modele === 'carte' ? pin : 0);
    ops.push({ t: 'photo', a: i, p: a.lues[0], x: x + pin, y: yy + pin, w: cw - 2 * pin, h: modele === 'plein' ? ch : phH, r: modele === 'carte' ? 22 : 28 });
    const ligne2 = [a.taille ? tTaille(a.taille) : '', a.marque].filter(Boolean).join(' · ');
    if (modele === 'plein') {
      if (prix) {
        const pw = mesurer(prix, pPx, 700) + 40, ph = pPx + 24;
        ops.push({ t: 'rect', x: x + 16, y: yy + ch - 16 - ph, w: pw, h: ph, r: ph / 2, couleur: accentK === 'encre' ? BLANC : accent });
        T(prix, x + 16 + pw / 2, yy + ch - 16 - ph + 12, pPx, 700, accentK === 'encre' ? ENCRE : BLANC, 'center', pw);
      }
      if (a.taille) {
        const s = tTaille(a.taille); const sp = story ? 28 : 24; const sw = Math.min(cw - 32, mesurer(s, sp, 600) + 32), sh = sp + 18;
        ops.push({ t: 'rect', x: x + 16, y: yy + 16, w: sw, h: sh, r: sh / 2, couleur: 'rgba(0,0,0,0.55)' });
        T(couper(s, sp, 600, sw - 32, 1, mesurer)[0], x + 16 + sw / 2, yy + 16 + 9, sp, 600, BLANC, 'center', sw - 32);
      }
      return;
    }
    const tx = x + (modele === 'carte' ? 24 : 4), max = cw - (modele === 'carte' ? 48 : 8);
    const ty = yy + pin + phH + (story ? 18 : 14);
    if (prix) T(prix, tx, ty, pPx, 700, accent, 'left', max);
    if (ligne2) T(couper(ligne2, story ? 30 : 26, 400, max, 1, mesurer)[0], tx, ty + pPx + (story ? 12 : 8), story ? 30 : 26, 400, gris, 'left', max);
    else if (a.titre) T(couper(a.titre, story ? 30 : 26, 400, max, 1, mesurer)[0], tx, ty + pPx + 8, story ? 30 : 26, 400, gris, 'left', max);
  });
  return { w, h, ops };
}

// ── LE DESSIN ───────────────────────────────────────────────────────────────
const cheminArrondi = (ctx, x, y, w, h, r) => {
  const rr = Math.max(0, Math.min(r || 0, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y); ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr); ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr); ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
};
export const policeCanvas = (px, graisse) => `${graisse || 400} ${Math.round(px)}px ${POLICE}`;
export const mesureCanvas = (ctx) => (texte, px, graisse) => { ctx.font = policeCanvas(px, graisse); return ctx.measureText(String(texte || '')).width; };

// `images` : (a, p) => image dessinable LUE (jamais null ici : le plan n'a que des photos lues).
// Rend false si une photo attendue manque (le visuel ne doit pas partir avec un trou).
export function dessinerVisuel(ctx, plan, images) {
  let complet = true;
  for (const op of plan.ops) {
    if (op.t === 'fond') { ctx.fillStyle = op.couleur; ctx.fillRect(0, 0, plan.w, plan.h); }
    else if (op.t === 'rect') {
      ctx.save();
      if (op.ombre) { ctx.shadowColor = 'rgba(0,0,0,0.10)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12; }
      ctx.fillStyle = op.couleur; cheminArrondi(ctx, op.x, op.y, op.w, op.h, op.r); ctx.fill();
      ctx.restore();
    } else if (op.t === 'degrade') {
      const gr = ctx.createLinearGradient(0, op.y, 0, op.y + op.h); gr.addColorStop(0, op.de); gr.addColorStop(1, op.a);
      ctx.fillStyle = gr; ctx.fillRect(op.x, op.y, op.w, op.h);
    } else if (op.t === 'point') {
      ctx.fillStyle = op.couleur; ctx.beginPath(); ctx.arc(op.x, op.y, op.r, 0, Math.PI * 2); ctx.fill();
    } else if (op.t === 'photo') {
      const im = images(op.a, op.p);
      const iw = im && (im.naturalWidth || im.width), ih = im && (im.naturalHeight || im.height);
      const c = couvrir(iw, ih, op.w, op.h);
      if (!c) { complet = false; continue; }
      ctx.save(); cheminArrondi(ctx, op.x, op.y, op.w, op.h, op.r); ctx.clip();
      ctx.drawImage(im, c.sx, c.sy, c.sw, c.sh, op.x, op.y, op.w, op.h);
      ctx.restore();
    } else if (op.t === 'texte') {
      ctx.font = policeCanvas(op.px, op.graisse); ctx.fillStyle = op.couleur; ctx.textAlign = op.align; ctx.textBaseline = 'top';
      ctx.fillText(op.texte, op.x, op.y, op.max > 0 ? op.max : undefined);
    }
  }
  return complet;
}

// Le nom du fichier : « vrm-carre-1.png » (rien de personnel dans le nom).
export const nomFichier = (format, i, n) => `vrm-${format === 'story' ? 'story' : 'carre'}${n > 1 ? '-' + (i + 1) : ''}.png`;
