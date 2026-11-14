// ═══════════════════════════════════════════════════════════════════════════
//  162 · LE PARTAGE D'UNE PAIRE EN IMAGE (14 nov., idées argent)
// ═══════════════════════════════════════════════════════════════════════════
// Depuis la fiche d'une paire : « Partager en image » ⇒ une carte dessinée DANS le
// navigateur (canvas, polices du Studio : Urbanist pour les chiffres et le titre,
// Inter pour le texte — repli système), en story 1080×1920 ou en carré 1080×1080 ;
// puis la feuille de partage du téléphone (Web Share, un fichier PNG), sinon un
// téléchargement. Rien ne part sur un serveur.
//
// ⚠️ AUCUNE DONNÉE PRIVÉE : `contenuCarte` est une LISTE BLANCHE — photo, modèle,
//    taille, prix affiché, N° (seulement s'il le coche). Jamais l'acheteur, jamais le
//    prix d'achat, jamais le bénéfice, le compte, un code ou une adresse : ces champs
//    ne sont même pas lus. `dessinerCarte` n'écrit QUE ce que `contenuCarte` rend.
// Module PUR (le contexte 2D est passé en paramètre) : scripts/audit-idees-argent.cjs
// le fait dessiner sur un contexte espion et lit chaque texte posé.
// ═══════════════════════════════════════════════════════════════════════════
export const FORMATS = Object.freeze({ story: { l: 1080, h: 1920 }, carre: { l: 1080, h: 1080 } });
const str = (v) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();

// Les jetons du Studio bleu clair (directions/_t25/tokens.cjs) — la carte est TOUJOURS claire
// (une image partagée se voit sur l'écran des autres, pas dans son mode sombre).
export const TEINTES = Object.freeze({ haut: '#EEF6FD', bas: '#C6DDF0', feuille: '#FFFFFF', encre: '#0C1D30', encre2: '#3F5468', accent: '#0060CC', creux: '#E4EEF7' });
export const POLICE_AFFICHE = '"Urbanist", "Inter", -apple-system, "SF Pro Display", system-ui, sans-serif';
export const POLICE_TEXTE = '"Inter", -apple-system, "SF Pro Text", system-ui, sans-serif';

const prixTexte = (v) => {
  const p = v && typeof v === 'object' ? v.amount : v;
  const n = Number(String(p == null ? '' : p).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0 || n >= 100000) return '';
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €';
};

// LA LISTE BLANCHE. `entree` peut porter n'importe quoi (une fiche entière) : seuls ces
// cinq champs en sortent, nettoyés et bornés.
export function contenuCarte(entree, { avecNumero = false } = {}) {
  const e = entree && typeof entree === 'object' ? entree : {};
  const photo = str(e.photo);
  return {
    photo: /^(https:|data:image\/|blob:)/.test(photo) ? photo : '',
    modele: str(e.modele || e.titre || e.title).slice(0, 70),
    taille: str(e.taille || e.size).slice(0, 16),
    prix: prixTexte(e.prix != null ? e.prix : e.price),
    num: avecNumero ? str(e.num || e.numero).slice(0, 8) : '',
  };
}

// Le nom du fichier partagé : rien de privé, juste le modèle.
export const nomFichier = (c, format) => `${(str(c && c.modele) || 'paire').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40).toLowerCase() || 'paire'}-${format === 'carre' ? '1080x1080' : '1080x1920'}.png`;

// Les lignes d'un texte coupé à `largeur` (mesuré par le contexte), `max` lignes, « … » au bout.
export function couper(ctx, texte, largeur, max = 2) {
  const mots = str(texte).split(' ').filter(Boolean);
  const out = []; let l = '';
  for (let i = 0; i < mots.length; i++) {
    const essai = l ? l + ' ' + mots[i] : mots[i];
    if (ctx.measureText(essai).width <= largeur || !l) { l = essai; continue; }
    out.push(l); l = mots[i];
    if (out.length === max - 1) { l = mots.slice(i).join(' '); break; }
  }
  if (l) out.push(l);
  if (out.length > max) out.length = max;
  const k = out.length - 1;
  if (k >= 0 && ctx.measureText(out[k]).width > largeur) {
    let t = out[k];
    while (t.length > 1 && ctx.measureText(t + '…').width > largeur) t = t.slice(0, -1);
    out[k] = t.replace(/\s+$/, '') + '…';
  }
  return out;
}

const rond = (ctx, x, y, l, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + l - r, y); ctx.quadraticCurveTo(x + l, y, x + l, y + r);
  ctx.lineTo(x + l, y + h - r); ctx.quadraticCurveTo(x + l, y + h, x + l - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
};

// Dessine la carte. `img` : l'image de la photo déjà chargée (ou null : une silhouette).
// `marque` : le petit texte du bas (« vrm.center » par défaut ; '' pour rien).
// Rend la liste des textes posés (ce que l'audit relit).
export function dessinerCarte(ctx, contenu, format = 'story', img = null, { marque = 'vrm.center', libelleTaille = 'Taille' } = {}) {
  const F = FORMATS[format] || FORMATS.story;
  const c = contenuCarte(contenu, { avecNumero: !!(contenu && contenu.num) });
  const L = F.l, H = F.h, ecrits = [];
  const texte = (t, x, y) => { ctx.fillText(t, x, y); ecrits.push(t); };
  // Le fond : la lumière du Studio (haut → bas).
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, TEINTES.haut); g.addColorStop(1, TEINTES.bas);
  ctx.fillStyle = g; ctx.fillRect(0, 0, L, H);
  // La tuile de porcelaine, une seule lumière (ombre douce).
  const m = 64, story = format !== 'carre';
  const tx = m, ty = story ? 150 : m, tl = L - 2 * m, th = story ? H - 300 : H - 2 * m;
  ctx.save();
  ctx.shadowColor = 'rgba(18,52,96,0.18)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24;
  ctx.fillStyle = TEINTES.feuille; rond(ctx, tx, ty, tl, th, 44); ctx.fill();
  ctx.restore();
  // La photo, posée dans la tuile (recadrée au centre, jamais déformée).
  const pm = 36, px = tx + pm, py = ty + pm, pl = tl - 2 * pm;
  const ph = story ? Math.round(pl * 1.08) : Math.round(th * 0.62);
  ctx.save(); rond(ctx, px, py, pl, ph, 30); ctx.clip();
  ctx.fillStyle = TEINTES.creux; ctx.fillRect(px, py, pl, ph);
  if (img && img.width && img.height) {
    const k = Math.max(pl / img.width, ph / img.height);
    const w = img.width * k, h = img.height * k;
    ctx.drawImage(img, px + (pl - w) / 2, py + (ph - h) / 2, w, h);
  } else {
    // Silhouette d'une chaussure (aucun texte).
    ctx.fillStyle = 'rgba(63,84,104,0.22)';
    ctx.beginPath(); ctx.ellipse(px + pl / 2, py + ph * 0.58, pl * 0.32, ph * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // Le N° gravé (plaque) — seulement s'il l'a coché.
  if (c.num) {
    ctx.font = `700 44px ${POLICE_AFFICHE}`;
    const t = 'N°' + c.num, w = ctx.measureText(t).width + 44;
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; rond(ctx, px + 24, py + 24, w, 72, 14); ctx.fill();
    ctx.fillStyle = TEINTES.encre; ctx.textBaseline = 'middle'; texte(t, px + 46, py + 61);
  }
  // Le modèle, la taille, le prix.
  ctx.textBaseline = 'alphabetic';
  let y = py + ph + (story ? 120 : 84);
  ctx.fillStyle = TEINTES.encre; ctx.font = `600 ${story ? 68 : 56}px ${POLICE_AFFICHE}`;
  for (const l of couper(ctx, c.modele || ' ', pl, 2)) { if (l.trim()) texte(l, px, y); y += story ? 82 : 66; }
  const bas = ty + th - (story ? 70 : 52);
  if (c.taille) {
    ctx.font = `500 ${story ? 40 : 34}px ${POLICE_TEXTE}`; ctx.fillStyle = TEINTES.encre2;
    texte(`${libelleTaille} ${c.taille}`, px, bas);
  }
  if (c.prix) {
    ctx.font = `300 ${story ? 132 : 104}px ${POLICE_AFFICHE}`; ctx.fillStyle = TEINTES.encre;
    const w = ctx.measureText(c.prix).width;
    texte(c.prix, px + pl - w, bas);
  }
  if (marque) {
    ctx.font = `600 32px ${POLICE_TEXTE}`; ctx.fillStyle = TEINTES.encre2;
    const w = ctx.measureText(marque).width;
    texte(marque, (L - w) / 2, story ? H - 70 : H - 18);
  }
  return ecrits;
}
