// ════════════════════════════════════════════════════════════════════════════
//  L'INVENTAIRE DE FIN D'ANNÉE (10 nov. 2026, lot W, validé par Julien)
//  Stock → « Inventaire au 31 décembre » : la liste des paires PRÉSENTES avec leur
//  prix d'achat SAISI et la valeur totale, la vérification carton par carton, et
//  l'export daté (PDF, CSV) — ce qu'un pro déclare comme stock final.
//
//  Module PUR (aucun accès à la base) ; l'écran (src/InventaireAnnuel.jsx) et
//  `scripts/audit-inventaire-annuel.cjs` exécutent les MÊMES fonctions.
//
//  ⚠️ LA LISTE N'EST PAS UNE NOUVELLE DÉFINITION : ce sont les paires de
//     `annoncesPresentes` (§5 : en ligne + à confirmer + masquées encore sur
//     l'étagère), celles-là mêmes que `valeurStock` somme. Le TOTAL est celui de
//     `valeurStock` (src/coutVente.js), jamais une seconde somme ; le prix d'une
//     ligne se lit par la même règle (`beneficePaire(...).achat`). L'audit
//     vérifie que la somme des lignes est le total, et que « sans prix » est la
//     même liste des deux côtés.
//  ⚠️ PAS SU ≠ 0 : un prix absent ou illisible est « — » (jamais 0, jamais
//     deviné) ; la couverture est dite (« au moins … · sur N paires · M sans prix »).
//  ⚠️ L'IDENTITÉ EST LE N° SEUL (§5) : la vérification compare `cleNum` du N°
//     écrit sur le carton à `cleNum` du N° de la fiche — jamais le titre. Une
//     paire sans N° ne peut pas être cochée : elle est NOMMÉE à part.
//  ⚠️ RIEN N'EST CHANGÉ : les écarts sont listés, aucun numéro, aucune fiche,
//     aucune annonce n'est touché. Les N° vus sont ceux du mode inventaire du
//     Stock (`vrm_inventaire`, src/inventaire.js) — une seule saisie.
//  ⚠️ LA DATE : la liste est celle de la dernière lecture des annonces ; une date
//     choisie qui n'est pas aujourd'hui est DITE (« liste lue le … »), jamais
//     présentée comme l'état de ce jour-là.
// ════════════════════════════════════════════════════════════════════════════
import { valeurStock, texteValeurStock, eurosStock } from './coutVente.js';
import { beneficePaire } from './beneficePaire.js';
import { saisiesVivantes, NUM_OK } from './inventaire.js';
import { cleNum as cleNumServeur } from '../api/_lib/numerotation.js';

const plur = (n, m) => `${n} ${m}${n > 1 ? 's' : ''}`;
const objet = (o) => !!o && typeof o === 'object' && !Array.isArray(o);

// ── 1. LA LISTE ─────────────────────────────────────────────────────────────
// `paires` : `annoncesPresentes` ; `ficheDe(it)` : la fiche résolue comme pour
// `valeurStock` ; `numeroDe(it)`, `compteDe(it)` : ce que l'écran sait déjà.
// Rend { v (valeurStock), lignes: [{ id, numero, cle, titre, compte, achat }] }.
export function listeInventaire(paires, { ficheDe, numeroDe = () => '', compteDe = () => '', cle = cleNumServeur } = {}) {
  const ps = (Array.isArray(paires) ? paires : []).filter((it) => it && it.id != null);
  const v = valeurStock(ps, ficheDe);
  const vus = new Set(), lignes = [];
  for (const it of ps) {
    const id = String(it.id); if (vus.has(id)) continue; vus.add(id);
    const numero = String(numeroDe(it) || '').trim();
    const k = numero ? cle(numero) : '';
    lignes.push({ id, numero, cle: k && NUM_OK.test(k) ? k : '', titre: String(it.title || '').trim(), compte: String(compteDe(it) || ''),
      achat: beneficePaire(null, (ficheDe && ficheDe(it)) || {}).achat });
  }
  lignes.sort(ordreLignes);
  return { v, lignes };
}
// Par N° (les chiffres dans l'ordre des nombres, l'archive « B » après), sans N° à la fin.
export function ordreLignes(a, b) {
  if (!a.cle !== !b.cle) return a.cle ? -1 : 1;
  const la = (/^[A-Z]+/.exec(a.cle) || [''])[0], lb = (/^[A-Z]+/.exec(b.cle) || [''])[0];
  if (la !== lb) return la < lb ? -1 : 1;
  const na = parseInt(a.cle.slice(la.length), 10) || 0, nb = parseInt(b.cle.slice(lb.length), 10) || 0;
  return (na - nb) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

// ── 2. LA PUBLICATION (un propriétaire : le composant qui tient `annoncesPresentes`) ──
export const CLE_INVENTAIRE_ANNUEL = 'vrm_inventaire_annuel';
// (11 nov.) « Clôturer l'année » → « Inventaire au 31 décembre » : le Stock s'ouvre sur la feuille.
export const DEMANDE_INVENTAIRE_ANNUEL = { at: 0 };
export const EVT_INVENTAIRE_ANNUEL = 'vrm:inventaire-annuel';
export function publierInventaireAnnuel(inv, { owner = '', partiel = false, maintenant = Date.now() } = {}) {
  if (!inv || !inv.v) return;
  const corps = { owner: String(owner || ''), partiel: !!partiel,
    v: { c: inv.v.centimes, n: inv.v.n, nPrix: inv.v.nPrix, nSans: inv.v.nSans },
    l: inv.lignes.map((x) => [x.id, x.numero, x.titre.slice(0, 120), x.compte, x.achat]) };
  try {
    const avant = JSON.parse(localStorage.getItem(CLE_INVENTAIRE_ANNUEL) || 'null');
    if (avant && JSON.stringify({ ...avant, at: 0 }) === JSON.stringify({ ...corps, at: 0 })) return;
    localStorage.setItem(CLE_INVENTAIRE_ANNUEL, JSON.stringify({ ...corps, at: maintenant }));
  } catch (_) { /* stockage refusé : l'écran dit « — » */ }
  try { window.dispatchEvent(new Event(EVT_INVENTAIRE_ANNUEL)); } catch (_) {}
}
// null = jamais publiée pour CE compte VRM (pas su ⇒ « — »).
export function lireInventaireAnnuel(owner = '', cle = cleNumServeur) {
  try {
    const p = JSON.parse(localStorage.getItem(CLE_INVENTAIRE_ANNUEL) || 'null');
    return depublier(p, owner, cle);
  } catch (_) { return null; }
}
export function depublier(p, owner = '', cle = cleNumServeur) {
  if (!objet(p) || String(p.owner || '') !== String(owner || '') || !objet(p.v) || !Array.isArray(p.l)) return null;
  const lignes = p.l.filter(Array.isArray).map(([id, numero, titre, compte, achat]) => {
    const n = String(numero || ''); const k = n ? cle(n) : '';
    return { id: String(id), numero: n, cle: k && NUM_OK.test(k) ? k : '', titre: String(titre || ''), compte: String(compte || ''),
      achat: Number.isFinite(achat) ? achat : null };
  });
  return { v: { centimes: p.v.c == null ? null : Number(p.v.c), n: Number(p.v.n) || 0, nPrix: Number(p.v.nPrix) || 0, nSans: Number(p.v.nSans) || 0 },
    lignes, partiel: !!p.partiel, at: Number(p.at) || 0 };
}

// ── 3. LA VÉRIFICATION : les N° vus dans les cartons contre la liste ─────────
// `session` : la session du mode inventaire (src/inventaire.js), ou null (pas
// encore vérifié ⇒ null : on ne dit RIEN de ce qui manque).
// Rend { trouvees, pasTrouvees, horsListe, sansNumero, doublons, vus }.
export function ecartsInventaire(lignes, session, cle = cleNumServeur) {
  if (!objet(session)) return null;
  const vus = new Set(saisiesVivantes(session).map((x) => cle(x.k)).filter((k) => k && NUM_OK.test(k)));
  const ls = Array.isArray(lignes) ? lignes : [];
  const parCle = new Map();
  for (const l of ls) if (l.cle) parCle.set(l.cle, (parCle.get(l.cle) || 0) + 1);
  const trouvees = [], pasTrouvees = [], sansNumero = [];
  for (const l of ls) {
    if (!l.cle) sansNumero.push(l);
    else if (vus.has(l.cle)) trouvees.push(l);
    else pasTrouvees.push(l);
  }
  const horsListe = [...vus].filter((k) => !parCle.has(k)).sort((a, b) => ordreLignes({ cle: a, id: '' }, { cle: b, id: '' }));
  const doublons = [...parCle].filter(([, n]) => n > 1).map(([k]) => k);
  return { trouvees, pasTrouvees, horsListe, sansNumero, doublons, vus: vus.size };
}
// La session à comparer : celle en cours (ou la dernière terminée), sinon la plus récente gardée.
export function sessionAComparer(inv) {
  if (!objet(inv)) return null;
  if (objet(inv.courant)) return inv.courant;
  const a = Array.isArray(inv.anciens) ? inv.anciens.filter(objet) : [];
  return a.length ? a[0] : null;
}

// ── 4. UN N° LU PAR LA CAMÉRA ───────────────────────────────────────────────
// Le code lu sur un carton : un N° (« 125 », « B125 », « N°125 »), ou le SKU
// eBay « VRM-125 ». Tout autre code (bordereau, code-barres de la boîte) ⇒ null :
// « Pas un N° », rien n'est compté.
export function numeroDuScan(brut, cle = cleNumServeur) {
  let t = String(brut == null ? '' : brut).trim();
  if (!t || t.length > 24) return null;
  t = t.replace(/^VRM[-\s_]*/i, '').replace(/^(?:n°|no|n|#)\s*(?=[a-z]*\d)/i, '');
  const k = cle(t);
  return k && NUM_OK.test(k) ? k : null;
}

// ── 5. LA DATE ──────────────────────────────────────────────────────────────
const deux = (n) => String(n).padStart(2, '0');
export const isoJour = (t) => { const d = new Date(t); return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`; };
// Par défaut le 31 décembre de l'année ; du 1er au 15 janvier, celui qui vient de passer.
export function dateParDefaut(maintenant = Date.now()) {
  const d = new Date(maintenant);
  const an = d.getMonth() === 0 && d.getDate() <= 15 ? d.getFullYear() - 1 : d.getFullYear();
  return `${an}-12-31`;
}
export const dateFr = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
const heureFr = (t) => { const d = new Date(t); return `${deux(d.getDate())}/${deux(d.getMonth() + 1)}/${d.getFullYear()} à ${deux(d.getHours())}h${deux(d.getMinutes())}`; };
// La phrase qui date la liste : dite dès que la date choisie n'est pas le jour de la lecture.
export function phraseDate(iso, at) {
  if (!at) return 'Liste pas encore lue';
  return isoJour(at) === iso ? `Liste lue le ${heureFr(at)}` : `Liste lue le ${heureFr(at)}, pas le ${dateFr(iso)}`;
}

// ── 6. LES EXPORTS ──────────────────────────────────────────────────────────
const prixCsv = (c) => (c == null ? '' : (c / 100).toFixed(2).replace('.', ','));
// Une cellule qui commencerait une formule dans un tableur est neutralisée.
const cellule = (s) => { let t = String(s == null ? '' : s).replace(/[\r\n]+/g, ' '); if (/^[=+\-@\t]/.test(t)) t = "'" + t; return /[;"]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
const verifTexte = (l, ec) => (!ec ? '' : (!l.cle ? 'sans N°' : (ec.vusSet.has(l.cle) ? 'trouvée' : 'pas trouvée')));
const avecSet = (ec) => (ec ? { ...ec, vusSet: new Set(ec.trouvees.map((l) => l.cle)) } : null);

export function enTeteExport(inv, { date, ecarts = null } = {}) {
  const t = texteValeurStock(inv.v, { partiel: inv.partiel });
  const valeur = inv.v.centimes == null ? '-' : `${t.auMoins ? 'au moins ' : ''}${t.montant}`;
  return {
    titre: `Inventaire au ${dateFr(date)}`,
    lue: phraseDate(date, inv.at),
    valeur, sur: t.sur, sans: t.sans, partiel: !!inv.partiel,
    verif: ecarts ? `${plur(ecarts.trouvees.length, 'trouvée')} · ${ecarts.pasTrouvees.length} pas trouvée${ecarts.pasTrouvees.length > 1 ? 's' : ''} · ${ecarts.horsListe.length} hors liste` : 'Pas vérifié',
  };
}
export function csvInventaire(inv, { date, ecarts = null } = {}) {
  const e = enTeteExport(inv, { date, ecarts }); const ec = avecSet(ecarts);
  const L = [];
  L.push([e.titre].map(cellule).join(';'));
  L.push([e.lue].map(cellule).join(';'));
  L.push(['Valeur (prix d’achat saisis)', e.valeur.replace(/[\u00A0\u202F]/g, ' '), e.sur, e.sans].map(cellule).join(';'));
  if (e.partiel) L.push([cellule('Une lecture des annonces manque : liste partielle')].join(';'));
  L.push([cellule('Vérification'), cellule(e.verif)].join(';'));
  L.push('');
  L.push(['N°', 'Titre', 'Compte', 'Prix d’achat (€)', 'Vérification'].map(cellule).join(';'));
  for (const l of inv.lignes) L.push([l.numero || '', l.titre, l.compte, prixCsv(l.achat), verifTexte(l, ec)].map(cellule).join(';'));
  if (ec && ec.horsListe.length) {
    L.push(''); L.push(cellule('Trouvées dans les rangements, pas dans la liste'));
    for (const k of ec.horsListe) L.push([k, '', '', '', 'hors liste'].map(cellule).join(';'));
  }
  return '﻿' + L.join('\r\n') + '\r\n';
}
export const nomFichier = (date, ext) => `inventaire-${/^\d{4}-\d{2}-\d{2}$/.test(String(date)) ? date : 'stock'}.${ext}`;

const A4 = [595.28, 841.89];
export async function pdfInventaire(inv, { date, ecarts = null, PDFLib = null } = {}) {
  const PL = PDFLib || await import('pdf-lib');
  const { PDFDocument, StandardFonts, rgb } = PL;
  const e = enTeteExport(inv, { date, ecarts }); const ec = avecSet(ecarts);
  const doc = await PDFDocument.create();
  doc.setTitle(e.titre);
  const f = await doc.embedFont(StandardFonts.Helvetica), fb = await doc.embedFont(StandardFonts.HelveticaBold);
  const ENCRE = rgb(0.11, 0.11, 0.12), GRIS = rgb(0.42, 0.42, 0.45), FILET = rgb(0.86, 0.86, 0.88);
  const M = 48, [W, H] = A4;
  const dessinable = (ch) => { try { f.encodeText(ch); return true; } catch (_) { return false; } };
  const propre = (s) => { let o = ''; for (const ch of String(s == null ? '' : s).replace(/[‘’]/g, "'").replace(/[   ]/g, ' ').replace(/[−—–]/g, '-').replace(/[\r\n\t]+/g, ' ')) o += dessinable(ch) ? ch : (dessinable(ch.normalize('NFD')[0]) ? ch.normalize('NFD')[0] : ''); return o; };
  const coupe = (s, font, t, w) => { let v = propre(s); if (font.widthOfTextAtSize(v, t) <= w) return v; while (v && font.widthOfTextAtSize(v + '…', t) > w) v = v.slice(0, -1); return v + '…'; };
  let page = null, y = 0, nPage = 0;
  const txt = (s, x, yy, { font = f, t = 9.5, c = ENCRE, droite = false, w = 0 } = {}) => { const v = w ? coupe(s, font, t, w) : propre(s); page.drawText(v, { x: droite ? x - font.widthOfTextAtSize(v, t) : x, y: yy, size: t, font, color: c }); };
  const COL = { n: M, titre: M + 52, compte: M + 300, prix: W - M - 80, verif: W - M };
  const tete = () => {
    txt('N°', COL.n, y, { font: fb, t: 9, c: GRIS }); txt('Titre', COL.titre, y, { font: fb, t: 9, c: GRIS }); txt('Compte', COL.compte, y, { font: fb, t: 9, c: GRIS });
    txt('Prix d’achat', COL.prix, y, { font: fb, t: 9, c: GRIS, droite: true }); if (ec) txt('Vérif.', COL.verif, y, { font: fb, t: 9, c: GRIS, droite: true });
    y -= 6; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: FILET }); y -= 14;
  };
  const nouvelle = () => { page = doc.addPage(A4); nPage += 1; y = H - M; if (nPage > 1) { txt(`${e.titre} · suite`, M, y, { t: 9, c: GRIS }); y -= 22; tete(); } };
  nouvelle();
  txt(e.titre, M, y - 10, { font: fb, t: 22 }); y -= 30;
  txt(e.lue, M, y, { t: 9.5, c: GRIS }); y -= 30;
  txt('Valeur du stock (prix d’achat saisis)', M, y, { t: 12 }); txt(e.valeur, W - M, y, { font: fb, t: 14, droite: true }); y -= 15;
  txt([e.sur, e.sans].filter(Boolean).join(' · ') + (e.partiel ? ' · une lecture des annonces manque' : ''), M, y, { t: 9, c: GRIS }); y -= 22;
  txt('Vérification des rangements', M, y, { t: 12 }); txt(e.verif, W - M, y, { t: 9.5, droite: true }); y -= 28;
  tete();
  for (const l of inv.lignes) {
    if (y < M + 30) nouvelle();
    txt(l.numero || '-', COL.n, y, { font: fb, w: 48 });
    txt(l.titre || 'Sans titre', COL.titre, y, { w: COL.compte - COL.titre - 8 });
    txt(l.compte, COL.compte, y, { c: GRIS, w: COL.prix - 70 - COL.compte });
    txt(l.achat == null ? '-' : eurosStock(l.achat), COL.prix, y, { droite: true });
    if (ec) txt(verifTexte(l, ec), COL.verif, y, { droite: true, c: GRIS, t: 8.5 });
    y -= 15;
  }
  if (ec && ec.horsListe.length) {
    y -= 10; if (y < M + 40) nouvelle();
    txt('Trouvées dans les rangements, pas dans la liste', M, y, { font: fb, t: 11 }); y -= 16;
    txt(ec.horsListe.join(', '), M, y, { t: 9.5, w: W - 2 * M }); y -= 16;
  }
  const pages = doc.getPages();
  pages.forEach((p, i) => { page = p; txt(`Prix d’achat saisis par toi. Un tiret : pas de prix. Rien n’a été changé. · ${i + 1}/${pages.length}`, M, M - 20, { t: 8, c: GRIS }); });
  return doc.save();
}
