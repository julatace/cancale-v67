// ═══════════════════════════════════════════════════════════════════════════
// « RAPPORT DU MOIS » EN PDF, EN UN CLIC (11 novembre, lot rapport-mois)
// ═══════════════════════════════════════════════════════════════════════════
// Argent → « Rapport du mois » : un mois (par défaut le dernier BOUCLÉ) ⇒ un
// PDF A4 de 2 à 4 pages, fabriqué dans le navigateur (pdf-lib, chargé à la
// demande), partagé par la feuille native du téléphone, sinon téléchargé.
//
// AUCUNE RÈGLE D'ARGENT NEUVE ICI (§5 « une seule règle par notion ») : ce
// module RANGE et MET EN PAGE ce que les propriétaires ont déjà calculé, passé
// par l'écran (src/RapportMois.jsx) :
//   · les chiffres clés  = `bilanDuMois` (src/bilanMois.js : vendu au jour de la
//                          VENTE = `bilanLignes` sur `ventesFaites` ; reçu au
//                          VERSEMENT = `recuPublieEntre` + `recuAvecADater` ;
//                          dépensé = `comptaChargesMois` ; bénéfice =
//                          `chiffreBenefice(beneficeDuMoisPub)` et sa couverture) ;
//   · le panier moyen    = ce vendu ÷ ces ventes (les mêmes lignes) ;
//   · la marge           = le bénéfice ÷ les ventes qu'il compte (`B.ca`), la
//                          règle de Statistiques (« jamais un brut ») ;
//   · le bénéfice brut   = `chiffreBrut` (les seules ventes au prix d'achat
//                          connu, « N sur M ») — dit quand le bénéfice ne l'est pas ;
//                          JAMAIS « au moins » devant un bénéfice (src/beneficeNoms.js) ;
//   · par jour           = les MÊMES lignes de vendu, rangées par jour local ; le
//                          reçu par jour = `recuJours` de la ligne publiée, dessiné
//                          seulement si sa somme est le reçu du mois au centime ;
//   · par plateforme     = `margeParPlateforme` (src/margePlateforme.js) ;
//   · par compte         = les mêmes lignes, groupées par le compte qu'elles PORTENT ;
//   · catégories         = `statsParCategorie` (src/statsCategories.js) ;
//   · top 10             = les mêmes lignes, triées par montant ; le titre et le N°
//                          viennent du relevé de Ventes PAR IDENTITÉ (`cleVente`),
//                          sinon blanc (« mieux vaut un blanc qu'un faux », §5) ;
//   · stock              = `lireValeurStock` (src/coutVente.js, publiée par Annonces) ;
//   · achats du mois     = `registreDesAchats` (src/registres.js) ;
//   · URSSAF             = `montantPeriodeUrssaf` / `aPayerUrssaf`, pour le régime
//                          CHOISI seulement : pas choisi (`null`) ⇒ section ABSENTE ;
//                          choisi mais pas micro ⇒ la raison, aucun montant.
// « Pas su » s'écrit « — » (jamais 0) ; un total incomplet dit « au moins » et
// la couverture « sur N » ; les manques sont NOMMÉS en fin de rapport ; jamais
// « encaissé » ; aucun pseudo d'acheteur (aucune ligne n'en porte).
// Exécuté par scripts/audit-rapport-mois.cjs (génère le PDF et le RELIT).
// ═══════════════════════════════════════════════════════════════════════════
import { eurosTexte, jourFr } from './registres.js';
import { cleVente } from './statsCategories.js';
import { eurosStock } from './coutVente.js';
import { periodesExport } from './exportComptable.js';
import { periodeBouclee } from './exportComptableZip.js';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const libelleMoisRapport = (ym) => { const [y, m] = String(ym || '').split('-').map(Number); return y && m ? `${MOIS[m - 1]} ${y}` : String(ym || ''); };
export const nomFichierRapport = (ym) => `Rapport-${ym}.pdf`;
export const YM_OK = /^\d{4}-(0[1-9]|1[0-2])$/;
// Le mois proposé : le dernier BOUCLÉ (la règle de « Pour mon comptable ») ; les choix : 13 mois.
export const moisRapportParDefaut = (maintenant = Date.now()) => periodeBouclee('mois', maintenant);
export const moisRapportChoix = (maintenant = Date.now()) => periodesExport('mois', maintenant);

const cts = (x) => (x == null || String(x).trim() === '' || !Number.isFinite(Number(x)) ? null : Math.round(Number(x) * 100));
const pl = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
const pct = (x) => `${String(Math.round(x * 10) / 10).replace('.', ',')} %`;
const jourCle = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// Les bornes LOCALES d'un mois [de, a) ; un mois en cours s'arrête à maintenant.
export function bornesMois(ym, maintenant = Date.now()) {
  if (!YM_OK.test(String(ym || ''))) return null;
  const [y, m] = ym.split('-').map(Number);
  const de = new Date(y, m - 1, 1).getTime(), fin = new Date(y, m, 1).getTime();
  return { de, fin, a: Math.min(fin, maintenant), enCours: maintenant < fin, nJours: new Date(y, m, 0).getDate() };
}

// Le nom du groupe « compte » d'une ligne de vendu (celui que `meilleurCompte` lit au Bilan).
export const nomGroupeVente = (l) => (l.plateforme === 'Vinted' ? (l.compte || 'Vinted') : (l.compte ? `${l.compte} (${l.plateforme})` : l.plateforme));

// ── LES DONNÉES ────────────────────────────────────────────────────────────
// Entrées (chacune déjà calculée par SA règle ; `null` = pas su, jamais 0) :
//   ym, maintenant, boutique : { nom, sous } (sa fiche de facturation, sinon ses comptes)
//   bilan      : `bilanDuMois(...)` du même mois (les chiffres clés)
//   vendu      : { lignes, manque, nonComptees } — la population de `bilan.vendu` | null
//   B, benefice, brut : `beneficeDuMoisPub`, `chiffreBenefice(B)`, `chiffreBrut(B)`
//   recuJours  : `vinted_urssaf_mois.recuJours` | null
//   plateformes: `margeParPlateforme(...)` | null
//   categories : `statsParCategorie(...)` | null (pas su) | undefined (pas lue)
//   titres     : { cleVente → { titre, num } } (le relevé de Ventes)
//   stock      : `lireValeurStock()` | null
//   achats     : `registreDesAchats(...)` pour CE mois | null
//   urssaf     : { regime, regimeTexte, taux, ca, apayer, partiel, raison } | null
export function donneesRapportMois({ ym, maintenant = Date.now(), boutique = null, bilan = null, vendu = null, B = null, benefice = null, brut = null,
  recuJours = null, plateformes = null, categories = undefined, titres = null, stock = null, achats = null, urssaf = null } = {}) {
  const b = bornesMois(ym, maintenant);
  if (!b || !bilan) return null;
  const L = (cle) => (bilan.lignes || []).find((l) => l.cle === cle) || { valeur: null, auMoins: false, note: '' };
  const lv = L('vendu'), lr = L('recu'), lp = L('paires'), lb = L('benefice'), ld = L('depense');
  const manques = [];
  const ajoute = (m) => { if (m && !manques.includes(m)) manques.push(m); };

  // Les lignes du mois : la population EXACTE de « Vendu » (bilanLignes, [de, a)).
  const lignes = vendu && Array.isArray(vendu.lignes) ? vendu.lignes.filter((l) => l && Number.isFinite(l.ts) && l.ts >= b.de && l.ts < b.a && cts(l.eur) != null) : null;
  const nonComptees = vendu && Array.isArray(vendu.nonComptees) ? vendu.nonComptees.filter((x) => x && x.ts != null && x.ts >= b.de && x.ts < b.a) : [];
  if (!lignes) ajoute('Ventes pas encore lues : ouvre Ventes une fois');
  for (const m of ((vendu && vendu.manque) || [])) ajoute(m === 'lecture en cours' ? 'Une lecture des ventes était encore en cours : le vendu est un minimum' : `Ventes ${m} pas lues : le vendu est un minimum`);
  if (nonComptees.length) {
    const par = {}; for (const x of nonComptees) { const k = `${x.plateforme} (${x.raison || 'montant pas lu'})`; par[k] = (par[k] || 0) + 1; }
    for (const [k, n] of Object.entries(par)) ajoute(`${pl(n, 'vente')} ${k} : vendue${n > 1 ? 's' : ''}, montant hors du total`);
  }

  // ── Chiffres clés ──
  const panier = lv.valeur != null && lp.valeur > 0 ? Math.round(lv.valeur / lp.valeur * 100) / 100 : null;
  const marge = benefice && benefice.valeur != null && B && Number(B.ca) > 0 ? Math.round(benefice.valeur / Number(B.ca) * 1000) / 10 : null;
  const nCout = B && Number.isFinite(B.n) ? `${B.nCout} sur ${B.n}` : '';
  const ecrit = (l, t = 'eur') => (l.valeur == null ? '—' : `${l.auMoins ? 'au moins ' : ''}${t === 'eur' ? eurosTexte(l.valeur) : String(l.valeur)}`);
  const cles = [
    { cle: 'vendu', nom: 'Vendu', valeur: lv.valeur, texte: ecrit(lv), note: lv.note || '' },
    { cle: 'recu', nom: 'Reçu au versement', valeur: lr.valeur, texte: ecrit(lr), note: lr.note || '' },
    { cle: 'ventes', nom: 'Ventes', valeur: lp.valeur, texte: ecrit(lp, 'n'), note: nonComptees.length ? `dont ${nonComptees.length} au montant pas lu en plus` : 'au jour de la vente' },
    { cle: 'panier', nom: 'Panier moyen', valeur: panier, texte: panier == null ? '—' : eurosTexte(panier), note: panier == null ? 'aucune vente au montant lu' : `sur ${pl(lp.valeur, 'vente')} au montant lu` },
    { cle: 'benefice', nom: 'Bénéfice', valeur: lb.valeur, texte: lb.valeur == null ? '—' : eurosTexte(lb.valeur),
      note: lb.valeur != null ? `prix d’achat connus ${nCout}` : brut && brut.valeur != null && brut.partiel ? `brut au prix connu ${eurosTexte(brut.valeur)} · ${nCout}` : (lb.note || 'pas encore calculé') },
    { cle: 'marge', nom: 'Marge', valeur: marge, texte: marge == null ? '—' : pct(marge), note: marge == null ? (lb.valeur == null ? 'attend le bénéfice' : 'aucune vente comptée') : 'bénéfice ÷ ventes qu’il compte' },
  ];
  if (lr.valeur == null || lr.auMoins) ajoute(`Reçu : ${lr.note || 'pas encore calculé'}`);
  if (lb.valeur == null) ajoute(B && B.nCout < B.n ? `Bénéfice : prix d’achat manquant pour ${B.n - B.nCout} vente${B.n - B.nCout > 1 ? 's' : ''} (saisis-les dans Ventes)` : `Bénéfice : ${lb.note || 'pas encore calculé'}`);

  // ── Par jour ──
  let jours = null, recuDessine = false;
  if (lignes) {
    const v = {}; for (const l of lignes) { const k = jourCle(l.ts); v[k] = (v[k] || 0) + cts(l.eur); }
    const rj = recuJours && typeof recuJours === 'object' && !Array.isArray(recuJours) ? recuJours : null;
    // Le reçu par jour n'est dessiné que s'il est LE reçu du mois (même ligne, même somme au centime).
    let somme = 0; const r = {};
    if (rj) for (const [k, x] of Object.entries(rj)) if (k.slice(0, 7) === ym && cts(x) != null) { r[k] = cts(x); somme += cts(x); }
    recuDessine = !!rj && lr.valeur != null && somme === cts(lr.valeur);
    jours = [];
    for (let i = 1; i <= b.nJours; i++) { const k = `${ym}-${String(i).padStart(2, '0')}`; jours.push({ j: i, cle: k, vendu: v[k] || 0, recu: recuDessine ? (r[k] || 0) : null }); }
  }

  // ── Par plateforme ── (la marge par plateforme, son vendu et son bénéfice)
  const plats = plateformes && Array.isArray(plateformes.plateformes)
    ? plateformes.plateformes.filter((p) => p.etat !== 'lu' || p.n > 0).map((p) => ({ plat: p.plat, etat: p.etat, n: p.n, vendu: p.vendu, partiel: !!p.venduPartiel, raison: p.raison || '',
      benef: p.total, nConnu: p.nConnu, nFin: p.nFin })) : null;
  // (un site déjà nommé parmi les ventes pas lues ne l'est pas deux fois)
  if (plats) for (const p of plats) if (p.etat !== 'lu' && !((vendu && vendu.manque) || []).includes(p.plat)) ajoute(`${p.plat} : ${p.raison || 'pas lu'}`);

  // ── Par compte ── (les comptes qu'elles PORTENT ; « au moins » si le vendu l'est)
  let comptes = null;
  if (lignes) {
    const g = new Map();
    for (const l of lignes) { const k = nomGroupeVente(l); const x = g.get(k) || { nom: k, n: 0, c: 0 }; x.n += 1; x.c += cts(l.eur); g.set(k, x); }
    const tot = [...g.values()].reduce((s, x) => s + x.c, 0);
    comptes = [...g.values()].sort((a, c) => c.c - a.c || c.n - a.n || (a.nom < c.nom ? -1 : 1)).map((x) => ({ nom: x.nom, n: x.n, eur: x.c / 100, part: tot > 0 ? x.c / tot : 0 }));
  }

  // ── Catégories ── (2 familles connues au moins, sinon rien à répartir)
  const cats = categories === undefined ? { etat: 'absent' } : categories === null ? { etat: 'passu' }
    : { etat: 'lu', groupes: categories.groupes.map((x) => ({ titre: x.titre || x.v, n: x.n, eur: x.eur })), sans: categories.sans ? { n: categories.sans.n, eur: categories.sans.eur } : { n: 0, eur: 0 } };
  if (cats.etat === 'passu') ajoute('Catégories : le catalogue Vinted n’a pas pu être lu');
  if (cats.etat === 'lu' && cats.sans.n) ajoute(`${pl(cats.sans.n, 'vente')} sans catégorie (pose-la dans Statistiques, carte « Par catégorie »)`);

  // ── Top 10 ──
  const top = lignes ? lignes.slice().sort((x, y) => cts(y.eur) - cts(x.eur) || x.ts - y.ts).slice(0, 10).map((l, i) => {
    const t = titres && titres[cleVente(l.plateforme, l.tx)] || null;
    return { rang: i + 1, date: jourFr(l.ts), plateforme: l.plateforme, compte: l.compte || '', num: t && t.num ? String(t.num) : '', titre: t && t.titre ? String(t.titre) : '', eur: cts(l.eur) / 100 };
  }) : null;
  if (top && top.some((x) => !x.titre)) ajoute(`${pl(top.filter((x) => !x.titre).length, 'vente')} du top 10 sans titre (vente pas encore dans le relevé de Ventes)`);

  // ── Stock ──
  const stk = !stock ? { etat: 'passu' } : {
    etat: 'lu', n: stock.n, nPrix: stock.nPrix, nSans: stock.nSans, valeur: stock.centimes == null ? null : stock.centimes / 100,
    auMoins: stock.centimes != null && (stock.nSans > 0 || !!stock.partiel), partiel: !!stock.partiel, le: stock.at ? jourFr(stock.at) : '',
  };
  if (stk.etat === 'passu') ajoute('Stock : ouvre Annonces une fois pour le compter');
  else { if (stk.nSans) ajoute(`Stock : ${pl(stk.nSans, 'article')} sans prix d’achat (valeur « au moins »)`); if (stk.partiel) ajoute('Stock : un compte n’a pas été lu en entier'); }

  // ── Achats du mois ──
  const ach = !achats ? { etat: 'passu' } : { etat: 'lu', n: achats.n, total: achats.total, complet: !!achats.complet, sansMontant: achats.sansMontant || 0, articleSeul: achats.articleSeul || 0, nGros: achats.nGros || 0, manque: achats.manque || [] };
  if (ach.etat === 'passu') ajoute('Achats : pas pu être lus');
  else {
    if (ach.sansMontant) ajoute(`Achats : ${pl(ach.sansMontant, 'achat')} au montant pas lu`);
    if (ach.articleSeul) ajoute(`Achats : ${pl(ach.articleSeul, 'achat')} compté${ach.articleSeul > 1 ? 's' : ''} à l’article seul (sans port ni frais : reçu pas lu)`);
    for (const m of ach.manque) ajoute(`Achats : ${m} pas lus`);
  }

  // ── URSSAF ── (absente tant que le régime n'est pas CHOISI)
  let urs = null;
  if (urssaf && urssaf.regime != null) {
    urs = { regime: urssaf.regime, regimeTexte: urssaf.regimeTexte || '', micro: urssaf.regime === 'micro', taux: urssaf.taux, ca: urssaf.ca == null ? null : urssaf.ca, apayer: urssaf.apayer == null ? null : urssaf.apayer, partiel: !!urssaf.partiel, raison: urssaf.raison || '' };
    if (urs.micro && urs.ca == null) ajoute('URSSAF : CA déclaré pas encore calculé (ouvre Ventes une fois)');
    if (urs.micro && urs.partiel) ajoute('URSSAF : des ventes ne sont pas encore datées ou comptées — le montant est un minimum');
  }
  if (ld.valeur == null) ajoute('Dépenses : pas lues');

  return {
    ym, mois: libelleMoisRapport(ym), enCours: b.enCours, etabliLe: jourFr(maintenant),
    boutique: boutique && String(boutique.nom || '').trim() ? { nom: String(boutique.nom).trim(), sous: String(boutique.sous || '').trim() } : null,
    cles, depense: ld.valeur, depenseTexte: ld.valeur == null ? '—' : eurosTexte(ld.valeur),
    meilleur: bilan.meilleur || null,
    jours, recuDessine, venduPartiel: !!lv.auMoins,
    plateformes: plats, comptes, categories: cats, top, stock: stk, achats: ach, urssaf: urs, manques,
  };
}

// ── LE PDF ─────────────────────────────────────────────────────────────────
// A4, Helvetica (aucune police à charger), encre et gris, UNE couleur d'accent
// (le bleu de l'app) pour les barres du vendu — rare (§7). Pages : 1 · chiffres
// clés et graphique ; 2 · répartitions et top 10 ; 3 · stock, achats, URSSAF et
// ce qui manque (une 4e si la liste déborde). Chaque page porte son pied.
export async function pdfRapportMois(d, { PDFLib = null } = {}) {
  const PL = PDFLib || await import('pdf-lib');
  const { PDFDocument, StandardFonts, rgb } = PL;
  const doc = await PDFDocument.create();
  const titreDoc = `Rapport du mois — ${d.mois}`;
  doc.setTitle(titreDoc); doc.setCreator('VRM'); doc.setProducer('VRM');
  if (d.boutique) doc.setAuthor(d.boutique.nom);
  const f = await doc.embedFont(StandardFonts.Helvetica), fb = await doc.embedFont(StandardFonts.HelveticaBold);
  const ENCRE = rgb(0.11, 0.11, 0.12), GRIS = rgb(0.43, 0.43, 0.46), PALE = rgb(0.6, 0.6, 0.63), FILET = rgb(0.87, 0.87, 0.89), FOND = rgb(0.965, 0.965, 0.97);
  const ACCENT = rgb(0, 0.443, 0.89), ACCENT_PALE = rgb(0.78, 0.86, 0.96);
  const W = 595.28, H = 841.89, M = 48, LARG = W - 2 * M;
  const dessinable = (ch) => { try { f.encodeText(ch); return true; } catch (_) { return false; } };
  const propre = (s) => {
    let o = '';
    for (const ch of String(s == null ? '' : s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[    ]/g, ' ').replace(/−/g, '-').replace(/[\r\n\t]+/g, ' ')) {
      o += dessinable(ch) ? ch : (dessinable(ch.normalize('NFD')[0]) ? ch.normalize('NFD')[0] : '');
    }
    return o;
  };
  // Coupe aux mots en `n` lignes au plus ; la dernière garde le reste (`borne` la termine par « ... »).
  const lignesDe = (s, font, t, max, n = 2) => {
    const mots = propre(s).split(' '); const out = []; let cur = '', pris = 0;
    for (const m of mots) { const essai = cur ? cur + ' ' + m : m; if (font.widthOfTextAtSize(essai, t) <= max || !cur) { cur = essai; } else { out.push(cur); cur = m; if (out.length === n - 1) { cur = mots.slice(pris).join(' '); break; } } pris += 1; }
    if (cur) out.push(cur);
    return out;
  };
  const borne = (s, font, t, max) => { let x = propre(s); if (font.widthOfTextAtSize(x, t) <= max) return x; while (x.length > 1 && font.widthOfTextAtSize(x + '...', t) > max) x = x.slice(0, -1); return x + '...'; };
  let page, y, nPage = 0;
  const txt = (s, x, yy, { font = f, t = 9, c = ENCRE, droite = false, centre = false, max = LARG } = {}) => {
    const v = borne(s, font, t, max); const w = font.widthOfTextAtSize(v, t);
    page.drawText(v, { x: droite ? x - w : centre ? x - w / 2 : x, y: yy, size: t, font, color: c });
  };
  const filet = (yy, x0 = M, x1 = W - M) => page.drawLine({ start: { x: x0, y: yy }, end: { x: x1, y: yy }, thickness: 0.5, color: FILET });
  const nouvellePage = () => {
    page = doc.addPage([W, H]); nPage += 1; y = H - M;
    if (nPage > 1) { txt(d.boutique ? d.boutique.nom : 'Rapport du mois', M, y, { t: 8.5, c: GRIS, max: LARG / 2 }); txt(d.mois, W - M, y, { t: 8.5, c: GRIS, droite: true }); y -= 10; filet(y); y -= 26; }
  };
  const place = (h) => { if (y - h < M + 24) nouvellePage(); };
  const section = (titre, sous = '') => { place(60); txt(titre, M, y, { font: fb, t: 13 }); if (sous) txt(sous, W - M, y, { t: 8.5, c: GRIS, droite: true, max: LARG * 0.55 }); y -= 9; filet(y); y -= 16; };
  const e = (x) => (x == null ? '—' : eurosTexte(x));

  // ── PAGE 1 · en-tête ──
  nouvellePage();
  if (d.boutique) { txt(d.boutique.nom, M, y - 4, { font: fb, t: 12 }); if (d.boutique.sous) txt(d.boutique.sous, M, y - 18, { t: 8.5, c: GRIS }); }
  txt(`Établi le ${d.etabliLe}`, W - M, y - 4, { t: 8.5, c: GRIS, droite: true });
  y -= d.boutique && d.boutique.sous ? 54 : 44;
  txt('Rapport du mois', M, y, { font: fb, t: 26 }); y -= 22;
  const maj = d.mois.charAt(0).toUpperCase() + d.mois.slice(1);
  txt(`${maj}${d.enCours ? ' · mois en cours, arrêté au ' + d.etabliLe : ' · du 1er au dernier jour du mois'}`, M, y, { t: 11, c: GRIS }); y -= 30;

  // Chiffres clés : 3 × 2 cases.
  const cw = (LARG - 2 * 10) / 3, ch = 74;
  d.cles.forEach((k, i) => {
    const col = i % 3, lig = Math.floor(i / 3);
    const x = M + col * (cw + 10), yy = y - lig * (ch + 10);
    page.drawRectangle({ x, y: yy - ch, width: cw, height: ch, color: FOND });
    txt(k.nom, x + 12, yy - 18, { t: 8.5, c: GRIS, max: cw - 24 });
    const grand = k.texte.length > 16 ? 14 : 18;
    txt(k.texte, x + 12, yy - 42, { font: fb, t: grand, max: cw - 24 });
    lignesDe(k.note, f, 7, cw - 24).forEach((l, i) => txt(l, x + 12, yy - 54 - i * 8.5, { t: 7, c: GRIS, max: cw - 24 }));
  });
  y -= 2 * ch + 10 + 26;
  txt(`Dépensé ce mois : ${d.depenseTexte} (dépenses, abonnements et packs notés)${d.meilleur ? ` · meilleur compte : ${d.meilleur.nom}` : ''}`, M, y, { t: 8.5, c: GRIS }); y -= 30;

  // Graphique : vendu (accent) et reçu (pâle) par jour.
  section('Vendu et reçu, jour par jour', d.recuDessine ? 'vendu au jour de la vente · reçu au jour du versement' : 'vendu au jour de la vente');
  if (!d.jours) { txt('Ventes pas encore lues : ouvre Ventes une fois.', M, y, { c: GRIS }); y -= 20; }
  else {
    const hG = 150, base = y - hG, n = d.jours.length;
    const max = Math.max(1, ...d.jours.map((j) => Math.max(j.vendu, j.recu || 0)));
    // L'échelle « ronde » au-dessus du max.
    const pas = [1, 2, 5]; let ech = 100; outer: for (let p = 100; p < 1e12; p *= 10) for (const q of pas) { if (q * p >= max) { ech = q * p; break outer; } }
    const xG = M + 40, wG = LARG - 40, slot = wG / n;
    for (const fr of [0, 0.5, 1]) { const yy = base + hG * fr; filet(yy, xG, W - M); txt(eurosTexte(ech * fr / 100).replace(',00', ''), xG - 6, yy - 3, { t: 7, c: PALE, droite: true, max: 38 }); }
    for (const j of d.jours) {
      const x0 = xG + (j.j - 1) * slot;
      const bw = d.recuDessine ? slot * 0.36 : slot * 0.6;
      if (j.vendu > 0) page.drawRectangle({ x: x0 + slot * 0.14, y: base, width: bw, height: Math.max(0.8, hG * j.vendu / ech), color: ACCENT });
      if (d.recuDessine && j.recu > 0) page.drawRectangle({ x: x0 + slot * 0.14 + bw + 1, y: base, width: bw, height: Math.max(0.8, hG * j.recu / ech), color: ACCENT_PALE });
      if (j.j === 1 || j.j % 5 === 0) txt(String(j.j), x0 + slot / 2, base - 11, { t: 7, c: GRIS, centre: true });
    }
    y = base - 28;
    page.drawRectangle({ x: M, y: y - 1, width: 8, height: 8, color: ACCENT }); txt(`Vendu${d.venduPartiel ? ' (au moins)' : ''}`, M + 12, y, { t: 8, c: GRIS });
    if (d.recuDessine) { page.drawRectangle({ x: M + 90, y: y - 1, width: 8, height: 8, color: ACCENT_PALE }); txt('Reçu au versement', M + 102, y, { t: 8, c: GRIS }); }
    else txt('Reçu par jour : pas publié par Ventes pour ce mois (le total est dans les chiffres clés).', M + 90, y, { t: 8, c: GRIS });
    y -= 24;
  }

  // ── PAGE 2 · répartitions ──
  nouvellePage();
  const barre = (x, yy, w, part) => { page.drawRectangle({ x, y: yy, width: w, height: 5, color: FOND }); if (part > 0) page.drawRectangle({ x, y: yy, width: Math.max(1, w * Math.min(1, part)), height: 5, color: ACCENT }); };
  section('Par plateforme', 'ventes · vendu · bénéfice des ventes finalisées au prix connu');
  if (!d.plateformes) { txt('Pas encore calculé : ouvre Ventes une fois.', M, y, { c: GRIS }); y -= 22; }
  else if (!d.plateformes.length) { txt('Aucune vente sur le mois.', M, y, { c: GRIS }); y -= 22; }
  else {
    const totV = d.plateformes.reduce((s, p) => s + (cts(p.vendu) || 0), 0);
    for (const p of d.plateformes) {
      place(30);
      txt(p.plat, M, y, { font: fb, t: 10, max: 90 });
      if (p.etat !== 'lu') { txt(p.raison || 'pas lu', M + 100, y, { t: 9, c: GRIS }); y -= 22; continue; }
      txt(pl(p.n, 'vente'), M + 100, y, { t: 9, max: 70 });
      txt(p.vendu == null ? '—' : `${p.partiel ? 'au moins ' : ''}${eurosTexte(p.vendu / 100)}`, M + 270, y, { t: 9, droite: true, max: 100 });
      txt(p.benef == null ? '—' : eurosTexte(p.benef / 100), W - M, y, { t: 9, droite: true, max: 90 });
      txt(p.nFin ? `bénéfice sur ${p.nConnu}/${p.nFin} finalisées` : 'aucune finalisée', W - M - 96, y, { t: 7.5, c: GRIS, droite: true, max: 130 });
      barre(M + 100, y - 9, 170, totV > 0 ? (cts(p.vendu) || 0) / totV : 0);
      y -= 24;
    }
    y -= 6;
  }
  section('Par compte', 'le compte qui a vendu');
  if (!d.comptes) { txt('Ventes pas encore lues.', M, y, { c: GRIS }); y -= 22; }
  else if (!d.comptes.length) { txt('Aucune vente sur le mois.', M, y, { c: GRIS }); y -= 22; }
  else {
    for (const c of d.comptes.slice(0, 8)) {
      place(24);
      txt(c.nom, M, y, { t: 9.5, max: 150 }); txt(pl(c.n, 'vente'), M + 160, y, { t: 9, c: GRIS, max: 60 });
      barre(M + 225, y + 1, 150, c.part);
      txt(pct(c.part * 100), M + 410, y, { t: 8.5, c: GRIS, droite: true });
      txt(eurosTexte(c.eur), W - M, y, { t: 9.5, droite: true, max: 90 });
      y -= 18;
    }
    if (d.comptes.length > 8) { txt(`et ${pl(d.comptes.length - 8, 'autre compte')}`, M, y, { t: 8, c: GRIS }); y -= 14; }
    y -= 10;
  }
  if (d.categories.etat !== 'absent') {
    section('Par catégorie', 'catégorie lue sur Vinted, ou posée par toi');
    if (d.categories.etat === 'passu') { txt('Catégories pas lues : le catalogue Vinted n’a pas pu être lu.', M, y, { c: GRIS }); y -= 22; }
    else {
      const totC = d.categories.groupes.reduce((s, g) => s + g.n, 0) + d.categories.sans.n;
      for (const g of d.categories.groupes.slice(0, 8)) {
        place(22);
        txt(g.titre, M, y, { t: 9.5, max: 150 }); txt(pl(g.n, 'vente'), M + 160, y, { t: 9, c: GRIS, max: 60 });
        barre(M + 225, y + 1, 150, totC ? g.n / totC : 0); txt(eurosTexte(g.eur), W - M, y, { t: 9.5, droite: true, max: 90 }); y -= 18;
      }
      if (d.categories.sans.n) { txt(`Sans catégorie : ${pl(d.categories.sans.n, 'vente')} · ${eurosTexte(d.categories.sans.eur)}`, M, y, { t: 8.5, c: GRIS }); y -= 14; }
      y -= 10;
    }
  }
  section('Les 10 meilleures ventes', 'au montant compté dans le vendu');
  if (!d.top) { txt('Ventes pas encore lues.', M, y, { c: GRIS }); y -= 22; }
  else if (!d.top.length) { txt('Aucune vente sur le mois.', M, y, { c: GRIS }); y -= 22; }
  else {
    txt('Date', M + 18, y, { t: 7.5, c: GRIS }); txt('Article', M + 82, y, { t: 7.5, c: GRIS }); txt('Plateforme · compte', M + 330, y, { t: 7.5, c: GRIS }); txt('Montant', W - M, y, { t: 7.5, c: GRIS, droite: true }); y -= 13;
    for (const t of d.top) {
      place(18);
      txt(String(t.rang), M, y, { font: fb, t: 9 }); txt(t.date, M + 18, y, { t: 8.5, c: GRIS, max: 60 });
      txt([t.num ? `N°${t.num}` : '', t.titre || '—'].filter(Boolean).join(' · '), M + 82, y, { t: 9, max: 240 });
      txt([t.plateforme, t.compte].filter(Boolean).join(' · '), M + 330, y, { t: 8.5, c: GRIS, max: 120 });
      txt(eurosTexte(t.eur), W - M, y, { font: fb, t: 9, droite: true, max: 70 });
      y -= 5; filet(y); y -= 12;
    }
  }

  // ── PAGE 3 · stock, achats, URSSAF, ce qui manque ──
  nouvellePage();
  const ligneKV = (k, v, note = '') => { place(30); txt(k, M, y, { t: 10, max: 260 }); txt(v, W - M, y, { font: fb, t: 10, droite: true, max: 200 }); if (note) { y -= 12; txt(note, M, y, { t: 7.5, c: GRIS }); } y -= 7; filet(y); y -= 15; };
  section('Stock', d.stock.etat === 'lu' && d.stock.le ? `compté le ${d.stock.le} (écran Annonces)` : '');
  if (d.stock.etat !== 'lu') { txt('Pas encore compté : ouvre Annonces une fois.', M, y, { c: GRIS }); y -= 22; }
  else {
    ligneKV('Articles en stock', String(d.stock.n), 'en ligne ou masqués : encore chez toi');
    ligneKV('Valeur d’achat du stock', d.stock.valeur == null ? '—' : `${d.stock.auMoins ? 'au moins ' : ''}${eurosStock(cts(d.stock.valeur))}`,
      d.stock.valeur == null ? 'aucun prix d’achat saisi' : `sur ${pl(d.stock.n, 'article')}${d.stock.nSans ? ` · ${d.stock.nSans} sans prix` : ''}`);
    y -= 6;
  }
  section('Achats du mois', 'registre des achats');
  if (d.achats.etat !== 'lu') { txt('Achats pas lus.', M, y, { c: GRIS }); y -= 22; }
  else {
    ligneKV('Achats', String(d.achats.n), d.achats.nGros ? `dont ${pl(d.achats.nGros, 'achat')} en gros` : '');
    ligneKV('Montant des achats', d.achats.n === 0 ? eurosTexte(0) : `${d.achats.complet ? '' : 'au moins '}${eurosTexte(d.achats.total)}`, d.achats.complet ? '' : 'certains montants ne sont pas lus : voir plus bas');
    y -= 6;
  }
  if (d.urssaf) {
    section('URSSAF', d.urssaf.regimeTexte);
    if (!d.urssaf.micro) { txt(d.urssaf.raison || 'URSSAF non calculée pour ce statut.', M, y, { c: GRIS }); y -= 22; }
    else {
      ligneKV('CA déclaré du mois (daté au versement)', d.urssaf.ca == null ? '—' : `${d.urssaf.partiel ? 'au moins ' : ''}${eurosTexte(d.urssaf.ca)}`);
      ligneKV(`Cotisations estimées (${String(d.urssaf.taux).replace('.', ',')} %)`, d.urssaf.apayer == null ? '—' : `${d.urssaf.partiel ? 'au moins ' : ''}${eurosTexte(d.urssaf.apayer)}`, 'une estimation : vérifie sur autoentrepreneur.urssaf.fr');
      y -= 6;
    }
  }
  section('Ce qui manque', d.manques.length ? pl(d.manques.length, 'point') : '');
  if (!d.manques.length) { txt('Rien : tout ce que ce rapport montre a été lu.', M, y, { c: GRIS }); y -= 20; }
  for (const m of d.manques) { place(16); txt(`· ${m}`, M, y, { t: 9 }); y -= 14; }
  y -= 10; place(40);
  txt('Vendu : au jour de la vente, toutes plateformes. Reçu : au jour où la plateforme a versé l’argent.', M, y, { t: 7.5, c: GRIS }); y -= 10;
  txt('Un tiret veut dire « pas su » (jamais zéro). « Au moins » : un minimum, ce qui manque est nommé ci-dessus.', M, y, { t: 7.5, c: GRIS }); y -= 10;
  txt('Comptes écartés par toi : hors de tous les totaux. VRM ne remplace pas un comptable.', M, y, { t: 7.5, c: GRIS });

  // Pieds de page : « VRM · page n sur N ».
  const pages = doc.getPages();
  pages.forEach((p, i) => { page = p; txt(`${titreDoc} · page ${i + 1} sur ${pages.length}`, W / 2, 24, { t: 7.5, c: PALE, centre: true }); });
  return doc.save();
}
