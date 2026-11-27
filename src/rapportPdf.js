// ════════════════════════════════════════════════════════════════════════════
//  LE PDF DU RAPPORT COMPTABLE — 16 nov., lot factures-mieux
// ════════════════════════════════════════════════════════════════════════════
// Julien : « améliore le visuel du reste ». Même charte que la facture et le reçu
// d'achat : un bandeau sobre (encre), le titre et le mois en blanc ; les chiffres en
// rangées étiquette | montant ; les deux registres en tableaux aux montants alignés
// à droite ; le format FRANÇAIS partout (« 1 234,50 € », jamais « 1234.50 EUR ») ;
// les accents écrits (« finalisées », « déclaré ») ; un pied sur chaque page.
// Ce module ne CALCULE rien : il dessine l'objet `report` de l'app (src/App.jsx,
// `report`), tel quel. Une ligne illisible pour Helvetica (emoji) est nettoyée,
// jamais l'export entier qui échoue.

const NBSP = ' ';
// « 1 234,50 € » — Intl fr-FR, ses espaces fines remplacées par l'insécable (WinAnsi).
export function eurosPdf(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  let t;
  try { t = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n)); } catch (_) { t = `${Number(n).toFixed(2).replace('.', ',')} €`; }
  return t.replace(/[    ]/g, NBSP);
}

export async function pdfRapport(R, { PDFLib, libelleRegime = (x) => String(x || '') } = {}) {
  const PL = PDFLib || await import('pdf-lib');
  const { PDFDocument, StandardFonts, rgb } = PL;
  const doc = await PDFDocument.create();
  doc.setTitle(`Rapport comptable ${R.monthLabel || ''}`.trim());
  const W = 595, H = 842, M = 40;
  const f = await doc.embedFont(StandardFonts.Helvetica);
  const fb = await doc.embedFont(StandardFonts.HelveticaBold);
  const c = (a) => rgb(a[0], a[1], a[2]);
  const ENCRE = [0.11, 0.11, 0.12], GRIS = [0.4, 0.4, 0.44], FILET = [0.88, 0.88, 0.9], BLANC = [1, 1, 1], AMBRE = [0.6, 0.32, 0];
  const propre = (s) => {
    const t = String(s == null ? '' : s).normalize('NFC').replace(/[   ]/g, NBSP).replace(/[‘’ʼ]/g, "'").replace(/[\r\n\t]+/g, ' ');
    let out = ''; for (const ch of t) { try { f.encodeText(ch); fb.encodeText(ch); out += ch; } catch (_) { const d = ch.normalize('NFD').replace(/[̀-ͯ]/g, ''); try { f.encodeText(d); out += d; } catch (__) { /* retiré */ } } }
    return out.replace(/ {2,}/g, ' ').trim();
  };
  const larg = (s, font, t) => font.widthOfTextAtSize(s, t);
  const coupe = (s, font, t, max) => { let x = propre(s); if (larg(x, font, t) <= max) return x; while (x.length > 1 && larg(`${x}…`, font, t) > max) x = x.slice(0, -1); return `${x.trimEnd()}…`; };
  let page, y, n = 0;
  const pied = () => { const t = `Rapport comptable · ${propre(R.monthLabel)} · page ${n} · document indicatif établi par VRM, il ne remplace pas un conseil comptable.`; page.drawText(propre(t), { x: M, y: 24, size: 7.5, font: f, color: c(GRIS) }); };
  const nouvellePage = () => { page = doc.addPage([W, H]); n++; y = H - M; pied(); };
  const ecrire = (s, x, yy, { font = f, t = 9, couleur = ENCRE, droite = false } = {}) => { const p = propre(s); page.drawText(p, { x: droite ? x - larg(p, font, t) : x, y: yy, size: t, font, color: c(couleur) }); };
  const place = (h) => { if (y - h < 48) nouvellePage(); };

  // Le bandeau.
  nouvellePage();
  const hB = 84;
  page.drawRectangle({ x: 0, y: H - hB, width: W, height: hB, color: c(ENCRE) });
  ecrire('RAPPORT COMPTABLE', M, H - 32, { font: fb, t: 8.5, couleur: BLANC });
  ecrire(R.monthLabel ? R.monthLabel.charAt(0).toUpperCase() + R.monthLabel.slice(1) : '', M, H - 56, { font: fb, t: 20, couleur: BLANC });
  ecrire(libelleRegime(R.regime), W - M, H - 32, { t: 9.5, couleur: BLANC, droite: true });
  y = H - hB - 34;

  // Le chiffre principal en grand, puis les rangées.
  ecrire("Chiffre d'affaires des ventes finalisées", M, y + 3, { font: fb, t: 11, couleur: GRIS });
  ecrire(eurosPdf(R.ca), W - M, y, { font: fb, t: 22, droite: true });
  y -= 18; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: c(FILET) }); y -= 20;
  const rangee = (k, v, { gras = false, alerte = false } = {}) => {
    place(22);
    ecrire(k, M, y, { t: 10, couleur: alerte ? AMBRE : GRIS });
    ecrire(v, W - M, y, { font: gras ? fb : f, t: 10, couleur: alerte ? AMBRE : ENCRE, droite: true });
    y -= 10; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.4, color: c(FILET) }); y -= 14;
  };
  rangee("Coût d'achat", `${eurosPdf(R.cout)} (${R.nbCout}/${R.nb} renseignés)`);
  if (R.frais > 0) rangee('Boosts / mises en avant', eurosPdf(R.frais));
  if (R.regime === 'marge') { rangee('Marge TTC', eurosPdf(R.marge), { gras: true }); rangee(`TVA sur la marge (${String(R.tvaRate).replace('.', ',')}${NBSP}%)`, eurosPdf(R.tvaMarge)); rangee('Marge HT', eurosPdf(R.margeHT)); }
  else {
    rangee('Bénéfice net', (R.nbCout === 0 && R.nb > 0) ? "inconnu — aucun prix d'achat saisi" : `${eurosPdf(R.benefNet)}${R.nbCout < R.nb ? ` (sur ${R.nbCout}/${R.nb} ventes au coût connu)` : ''}`, { gras: true });
    if (R.urssaf != null) rangee(`Estimation des cotisations (${String(R.taux).replace('.', ',')}${NBSP}%)`, eurosPdf(R.urssaf));
  }
  if (R.nMasq > 0) rangee("Dont ventes masquées dans l'app (comptées)", `${R.nMasq} — ${eurosPdf(R.caMasq)}`);
  if (R.nAttente > 0) rangee('Ventes du mois pas encore finalisées (hors CA)', `${R.nAttente} — ${R.caAttentePasLu ? 'au moins ' : ''}${eurosPdf(R.caAttente)}`);
  if (R.vinted === 'passu') rangee('Attention', 'dates de versement Vinted illisibles : ventes Vinted absentes', { alerte: true });
  rangee('Nombre de ventes', String(R.nb));
  rangee('Achats du mois (registre)', `${(R.buyLines || []).length} — ${R.achatsPasLu ? 'au moins ' : ''}${eurosPdf(R.achatsTotal)}`);

  // Les registres : un tableau chacun, montants alignés à droite.
  const tableau = (titre, cols, lignes, total) => {
    place(60); y -= 12;
    ecrire(titre, M, y, { font: fb, t: 12 }); y -= 18;
    const entete = () => {
      page.drawRectangle({ x: M, y: y - 5, width: W - 2 * M, height: 17, color: c([0.95, 0.95, 0.96]) });
      cols.forEach((k) => ecrire(k.t, k.droite ? k.x : k.x, y, { font: fb, t: 8, couleur: GRIS, droite: !!k.droite }));
      y -= 18;
    };
    entete();
    for (const l of lignes) {
      if (y - 14 < 48) { nouvellePage(); entete(); }
      cols.forEach((k, i) => { const v = l[i] == null ? '' : String(l[i]); ecrire(k.max ? coupe(v, f, 8.5, k.max) : v, k.x, y, { t: 8.5, droite: !!k.droite }); });
      y -= 7; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.3, color: c(FILET) }); y -= 9;
    }
    if (total) { place(18); cols.forEach((k, i) => { if (total[i] != null) ecrire(String(total[i]), k.x, y, { font: fb, t: 8.5, droite: !!k.droite }); }); y -= 20; }
  };
  const jour = (d) => { const t = Date.parse(d || ''); return Number.isFinite(t) ? new Date(t).toLocaleDateString('fr-FR') : ''; };
  const sales = R.saleLines || [];
  tableau(`Registre des ventes (${sales.length})`,
    [{ t: 'Date', x: M + 4 }, { t: 'N°', x: M + 56 }, { t: 'Article', x: M + 92, max: 200 }, { t: 'Vente', x: W - M - 186, droite: true }, { t: 'Achat', x: W - M - 124, droite: true }, { t: 'Boost', x: W - M - 66, droite: true }, { t: 'Bénéfice', x: W - M - 4, droite: true }],
    sales.map((v) => [jour(v.date), v.num || '', `${v.plateforme && v.plateforme !== 'Vinted' ? `[${v.plateforme}] ` : ''}${v.title || ''}`, eurosPdf(v.sell), v.buy != null ? eurosPdf(v.buy) : '—', v.fee ? eurosPdf(v.fee) : '', v.buy != null ? eurosPdf(v.sell - v.buy - v.fee) : '—']),
    [null, null, 'Total', eurosPdf(R.ca), eurosPdf(R.cout), R.frais ? eurosPdf(R.frais) : '', null]);
  const buys = R.buyLines || [];
  tableau(`Registre des achats (${buys.length})`,
    [{ t: 'Date', x: M + 4 }, { t: 'Vendeur', x: M + 56, max: 100 }, { t: 'Article', x: M + 166, max: 250 }, { t: 'Montant', x: W - M - 4, droite: true }],
    buys.map((b) => [jour(b.date), b.seller || '—', b.title || '—', b.montant == null ? '—' : eurosPdf(b.montant)]),
    [null, null, R.achatsPasLu ? 'Total (au moins)' : 'Total', eurosPdf(R.achatsTotal)]);
  return doc.save({ useObjectStreams: false });
}
