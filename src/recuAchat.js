// ════════════════════════════════════════════════════════════════════════════
//  LE REÇU D'ACHAT GÉNÉRÉ (sans e-mail Vinted) — 16 nov., lot factures-mieux
// ════════════════════════════════════════════════════════════════════════════
// Julien (capture de la feuille « Reçu d'achat » reconstruite depuis l'e-mail
// Vinted) : « Je veux que ça soit comme ça » — pour TOUS les reçus d'achat. Le
// reçu fabriqué d'après la COMMANDE (aucun e-mail reçu) prend donc la même forme,
// dans l'app (src/ecrans/Achats.jsx, `FeuilleRecuAchat`) et en PDF (ci-dessous) :
//   bandeau à la couleur de Vinted · « Reçu d'achat Vinted » + l'article en grand ·
//   « Montant payé » en très grand · les lignes du détail · Vendeur, Mode de
//   paiement, Date, N° de transaction, Compte · le pied.
// ⚠️ Rien d'inventé : la commande ne dit ni le port, ni les frais Vinted, ni le
//    moyen de paiement — ces lignes ne s'écrivent PAS (une phrase dit pourquoi) ;
//    un vendeur inconnu s'écrit « — ». Un vrai reçu e-mail reste prioritaire
//    (règle de l'appelant : `receiptFor` / `recuDeLAchat`).
// ⚠️ Le pied ne dit jamais « reconstruit depuis l'e-mail » : « Récapitulatif établi
//    par VRM d'après la commande Vinted — ce n'est pas une facture émise par Vinted. »
// ⚠️ Les accents : Helvetica de pdf-lib écrit le WinAnsi (é, è, ç, à, ô, —, •, €) ;
//    l'ancien reçu écrivait « Recu », « deductible » parce que le TEXTE était tapé
//    sans accents. Ce qui n'est pas WinAnsi (espace fine d'Intl, emoji) est remplacé.
// Module PUR (aucun DOM, aucune base) : l'app et les audits l'exécutent tels quels.

export const COULEUR_VINTED = '#007782';
export const PIED_RECU_GENERE = "Récapitulatif établi par VRM d'après la commande Vinted — ce n'est pas une facture émise par Vinted.";
export const PHRASE_SANS_DETAIL = "Le détail (article, port, frais Vinted) n'est pas dans les données de la commande.";

// « 11,95 € » — format français, espace insécable avant l'euro, espace fine des milliers.
export function eurosFr(n) {
  if (n == null || n === '' || !Number.isFinite(Number(n))) return '—';
  try { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n)); } catch (_) { return `${Number(n).toFixed(2).replace('.', ',')} €`; }
}

// Les champs du reçu, dans la forme de `champsRecuAchat` (src/ecrans/Achats.jsx) :
// la feuille de l'app et le PDF lisent les MÊMES.
//   o    : la commande Vinted (achat) — title, price{amount,currency_code}, date,
//          transaction_id, seller / user_login / opposite_user.login
//   opts : { account, numero, maintenant }
export function champsRecuGenere(o, opts = {}) {
  const x = o || {};
  const devise = x.price && x.price.currency_code ? String(x.price.currency_code) : 'EUR';
  const brut = x.price && x.price.amount != null && x.price.amount !== '' ? Number(x.price.amount) : null;
  // Une autre devise n'est jamais convertie (§3) : le montant s'écrit « — ».
  const paye = brut != null && Number.isFinite(brut) && devise === 'EUR' ? Math.round(brut * 100) : null;
  const vendeur = String(x.seller || x.user_login || (x.opposite_user && x.opposite_user.login) || '').trim();
  const t = Date.parse(x.date || '');
  const datePaie = Number.isFinite(t) ? new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' }).format(new Date(t)) : '';
  return {
    genere: true,
    article: String(x.title || '').trim() || 'Article',
    paye,
    lignes: [],                              // la commande ne porte pas le détail
    somme: paye == null ? 'inconnu' : 'sans-detail',
    phrase: PHRASE_SANS_DETAIL,
    vendeur: vendeur || '—',
    mode: '',                                // jamais deviné
    datePaie,
    trans: x.transaction_id != null ? String(x.transaction_id) : '',
    compte: String(opts.account || ''),
    numero: opts.numero ? String(opts.numero) : '',
    hasStructured: true,
    pied: PIED_RECU_GENERE,
  };
}

const hexRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '')); const n = m ? parseInt(m[1], 16) : 0x007782; return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

// Le PDF : la même mise en page que la feuille.
//   champs : `champsRecuGenere`
//   opts   : { PDFLib, acheteur, acheteurDetail, notes:[…], image:{octets,png} }
export async function pdfRecuAchat(champs, opts = {}) {
  const PL = opts.PDFLib || await import('pdf-lib');
  const { PDFDocument, StandardFonts, rgb } = PL;
  const doc = await PDFDocument.create();
  doc.setTitle(`Reçu d'achat ${champs.trans || ''}`.trim());
  const W = 420, H = 595, M = 30;
  const page = doc.addPage([W, H]);
  const f = await doc.embedFont(StandardFonts.Helvetica);
  const fb = await doc.embedFont(StandardFonts.HelveticaBold);
  const c = (a) => rgb(a[0], a[1], a[2]);
  const ENCRE = [0.07, 0.07, 0.08], GRIS = [0.4, 0.4, 0.44], FILET = [0.9, 0.9, 0.92], BLANC = [1, 1, 1];
  const propre = (s) => {
    const t = String(s == null ? '' : s).normalize('NFC').replace(/[   ]/g, ' ').replace(/[‘’ʼ]/g, "'").replace(/[\r\n\t]+/g, ' ');
    let out = ''; for (const ch of t) { try { f.encodeText(ch); fb.encodeText(ch); out += ch; } catch (_) { const d = ch.normalize('NFD').replace(/[̀-ͯ]/g, ''); try { f.encodeText(d); out += d; } catch (__) { out += ''; } } }
    return out;
  };
  const larg = (s, font, t) => font.widthOfTextAtSize(s, t);
  const couper = (s, font, t, max) => { const mots = propre(s).split(' ').filter(Boolean); const r = []; let l = ''; for (let m of mots) { while (larg(m, font, t) > max) { let i = m.length; while (i > 1 && larg(m.slice(0, i), font, t) > max) i--; if (l) { r.push(l); l = ''; } r.push(m.slice(0, i)); m = m.slice(i); } const e = l ? `${l} ${m}` : m; if (larg(e, font, t) <= max) l = e; else { if (l) r.push(l); l = m; } } if (l) r.push(l); return r.length ? r : ['']; };
  const ecrire = (s, x, y, { font = f, t = 10, couleur = ENCRE, droite = false } = {}) => { const p = propre(s); page.drawText(p, { x: droite ? x - larg(p, font, t) : x, y, size: t, font, color: c(couleur) }); };

  // La carte : un fond blanc, le bandeau à la couleur de Vinted en haut. Une marge en
  // haut (la pastille « 1 sur 1 » d'une visionneuse ne recouvre plus le titre).
  const haut = H - 40;
  let y = haut;
  const titre = couper(champs.article, fb, 17, W - 2 * M - 24).slice(0, 3);
  const hBande = 46 + titre.length * 21;
  page.drawRectangle({ x: M, y: haut - hBande, width: W - 2 * M, height: hBande, color: c(hexRgb(opts.couleur || COULEUR_VINTED)) });
  ecrire("REÇU D'ACHAT VINTED", M + 14, y - 22, { font: fb, t: 8.5, couleur: BLANC });
  titre.forEach((l, i) => ecrire(l, M + 14, y - 44 - i * 21, { font: fb, t: 17, couleur: BLANC }));
  y = haut - hBande - 34;
  const xD = W - M - 14, xG = M + 14;

  // Le montant payé, en très grand.
  ecrire('Montant payé', xG, y + 3, { font: fb, t: 11, couleur: GRIS });
  ecrire(champs.paye == null ? '—' : eurosFr(champs.paye / 100), xD, y, { font: fb, t: 26, droite: true });
  y -= 18;
  const filet = () => { page.drawLine({ start: { x: xG, y }, end: { x: xD, y }, thickness: 0.6, color: c(FILET) }); };
  filet(); y -= 20;
  const ligne = (k, v, gras = false) => {
    if (v == null || v === '') return;
    const largK = Math.min(larg(propre(k), f, 10.5) + 16, 150);
    ecrire(k, xG, y, { t: 10.5, couleur: GRIS });
    const ls = couper(v, gras ? fb : f, 10.5, xD - xG - largK);
    ls.forEach((l, i) => ecrire(l, xD, y - i * 13, { font: gras ? fb : f, t: 10.5, droite: true }));
    y -= 13 * (ls.length - 1) + 10; filet(); y -= 18;
  };
  for (const l of champs.lignes || []) ligne(l.libelle, l.centimes == null ? '—' : eurosFr(l.centimes / 100));
  if (champs.phrase) { for (const l of couper(champs.phrase, f, 9.5, xD - xG)) { ecrire(l, xG, y, { t: 9.5, couleur: GRIS }); y -= 12.5; } y -= 12; }
  if (champs.numero) ligne('N° de rangement', `N°${champs.numero}`, true);
  ligne('Vendeur', champs.vendeur || '—');
  ligne('Mode de paiement', champs.mode);
  ligne('Date du paiement', champs.datePaie || '—');
  ligne('N° de transaction', champs.trans || '—');
  ligne('Compte acheteur', champs.compte || '—');
  if (opts.acheteur) ligne('Acheteur', [opts.acheteur, opts.acheteurDetail].filter(Boolean).join(' · '));

  // Les mentions, puis le pied.
  y -= 6;
  for (const n of opts.notes || []) { for (const l of couper(n, f, 8.5, xD - xG)) { ecrire(l, xG, y, { t: 8.5, couleur: GRIS }); y -= 11; } y -= 5; }
  const pied = couper(champs.pied || PIED_RECU_GENERE, f, 8, W - 2 * M);
  pied.forEach((l, i) => { const p = propre(l); page.drawText(p, { x: (W - larg(p, f, 8)) / 2, y: 34 + (pied.length - 1 - i) * 10, size: 8, font: f, color: c(GRIS) }); });
  return doc.save({ useObjectStreams: false });
}
