// ═══════════════════════════════════════════════════════════════════════════
// LE BILAN DU MOIS EN UNE PAGE (5 novembre, chantier F)
// ═══════════════════════════════════════════════════════════════════════════
// Vendu, reçu, dépensé, bénéfice (et sa couverture), paires vendues, meilleur
// compte — un mois, une page, téléchargeable en PDF (pdf-lib, le générateur des
// registres et du récap).
//
// AUCUN CALCUL D'ARGENT ICI (§5 « une seule règle par notion ») : chaque valeur
// arrive déjà calculée par sa règle propriétaire, passée par l'écran —
//   · vendu, paires    = `bilanLignes` sur les lignes de `ventesFaites` (date de
//                        la VENTE, toutes plateformes) ; `manque` = ce qui n'a pas
//                        été lu (« au moins ») ;
//   · reçu             = `recuPublieEntre` (la ligne publiée par Ventes, datée au
//                        VERSEMENT), « au moins » s'il reste des ventes à dater ;
//   · dépensé          = `comptaChargesMois` (dépenses, abonnements, packs du mois) ;
//   · bénéfice         = `chiffreBenefice(beneficeDuMoisPub(…))`, sa couverture
//                        « prix d'achat connus N/M » ;
//   · meilleur compte  = le groupe de `ventesFaites` qui a VENDU le plus (euros) ;
//                        une égalité ou un vendu partiel ⇒ aucun (on ne désigne
//                        pas sur une lecture incomplète).
// « Pas su » s'écrit « — » (jamais 0) ; « au moins 0 » ne se dit jamais ; jamais
// « encaissé ». Exécuté par scripts/audit-chantier-f.cjs.

import { motsVendeur } from './profilVendeur.js';
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const libelleMoisBilan = (ym) => { const [y, m] = String(ym || '').split('-').map(Number); return y && m ? `${MOIS[m - 1]} ${y}` : String(ym || ''); };
export const nomFichierBilan = (ym) => `Bilan-${ym}.pdf`;

const un = (v) => (v == null || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 100) / 100);

// Le compte qui a vendu le plus, sur les lignes du mois. `nomDe(l)` nomme le
// groupe d'une ligne (le compte Vinted, ou le site). Égalité ⇒ null.
export const meilleurCompte = (lignes, nomDe) => {
  const g = new Map();
  for (const l of (lignes || [])) {
    if (!l) continue;
    const k = nomDe(l);
    if (!k) continue;
    const x = g.get(k) || { nom: k, n: 0, eur: 0 };
    x.n += 1; x.eur += Number(l.eur) || 0;
    g.set(k, x);
  }
  const tri = [...g.values()].sort((a, b) => b.eur - a.eur || b.n - a.n);
  if (!tri.length) return null;
  if (tri.length > 1 && Math.round(tri[0].eur * 100) === Math.round(tri[1].eur * 100) && tri[0].n === tri[1].n) return null;
  return { nom: tri[0].nom, n: tri[0].n, eur: un(tri[0].eur), parmi: tri.length };
};

// Entrées (déjà calculées) :
//   vendu    : { n, eur, manque: [] } | null (pas su)
//   recu     : { valeur, partiel, manque: [], raison } (forme de `recuPublieEntre`)
//   depense  : nombre | null
//   benefice : { valeur, raison } | null ; B : { n, nCout } | null
//   meilleur : sortie de `meilleurCompte` | null
export function bilanDuMois({ ym, vendu = null, recu = null, depense = null, benefice = null, B = null, meilleur = null, maintenant = Date.now(), enCours = false } = {}) {
  const partielVendu = !!(vendu && vendu.manque && vendu.manque.length);
  const venduOk = vendu && Number.isFinite(Number(vendu.eur)) && !(partielVendu && !(vendu.eur > 0));
  const lignes = [
    { cle: 'vendu', nom: 'Vendu', valeur: venduOk ? un(vendu.eur) : null, auMoins: venduOk && partielVendu, note: vendu ? (partielVendu ? `sans ${vendu.manque.join(', ')}` : 'au jour de la vente, toutes plateformes') : 'ventes pas encore lues', type: 'eur' },
    { cle: 'recu', nom: 'Reçu', valeur: recu && recu.valeur != null ? un(recu.valeur) : null, auMoins: !!(recu && recu.valeur != null && recu.partiel), note: recu && recu.valeur != null ? (recu.partiel && recu.manque && recu.manque.length ? `${recu.manque.join(', ')} : pas dedans` : 'au jour du versement') : (recu && recu.manque && recu.manque.length ? recu.manque.join(', ') : 'pas encore calculé : ouvre l’écran Ventes une fois'), type: 'eur' },
    { cle: 'depense', nom: 'Dépensé', valeur: depense == null ? null : un(depense), auMoins: false, note: 'dépenses, abonnements et packs notés', type: 'eur' },
    { cle: 'benefice', nom: 'Bénéfice', valeur: benefice && benefice.valeur != null ? un(benefice.valeur) : null, auMoins: false,
      note: B && Number.isFinite(B.n) && B.n > 0 ? `prix d’achat connus ${B.nCout}/${B.n}` : (benefice && benefice.raison === 'rien' ? 'aucune vente finalisée ni dépense' : benefice && benefice.raison === 'achats' ? 'il manque des prix d’achat' : 'pas encore calculé'), type: 'eur' },
    { cle: 'paires', nom: `${motsVendeur().Noms} vendu${motsVendeur().e}s`, valeur: venduOk ? Number(vendu.n) : null, auMoins: venduOk && partielVendu, note: '', type: 'n' },
  ];
  return {
    ym, mois: libelleMoisBilan(ym), enCours: !!enCours,
    etabliLe: new Date(maintenant).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    lignes,
    meilleur: venduOk && !partielVendu ? meilleur : null,
    couverture: B && Number.isFinite(B.n) ? { nCout: B.nCout, n: B.n } : null,
  };
}

// L'écriture d'une valeur : « — » pour pas su, « au moins » devant un minimum.
export const texteBilan = (l, fmt) => (l.valeur == null ? '—' : `${l.auMoins ? 'au moins ' : ''}${l.type === 'eur' ? fmt(l.valeur) : String(l.valeur)}`);

const A4 = [595.28, 841.89];
export async function pdfBilanMois(d, { PDFLib = null, fmt } = {}) {
  const PL = PDFLib || await import('pdf-lib');
  const { PDFDocument, StandardFonts, rgb } = PL;
  const doc = await PDFDocument.create();
  doc.setTitle(`Bilan de ${d.mois}`);
  const f = await doc.embedFont(StandardFonts.Helvetica), fb = await doc.embedFont(StandardFonts.HelveticaBold);
  const ENCRE = rgb(0.11, 0.11, 0.12), GRIS = rgb(0.42, 0.42, 0.45), FILET = rgb(0.86, 0.86, 0.88);
  const M = 56, [W, H] = A4;
  const dessinable = (ch) => { try { f.encodeText(ch); return true; } catch (_) { return false; } };
  const propre = (s) => { let o = ''; for (const ch of String(s == null ? '' : s).replace(/[‘’]/g, "'").replace(/[   ]/g, ' ').replace(/−/g, '-').replace(/—/g, '-').replace(/[\r\n\t]+/g, ' ')) o += dessinable(ch) ? ch : (dessinable(ch.normalize('NFD')[0]) ? ch.normalize('NFD')[0] : ''); return o; };
  const page = doc.addPage(A4);
  const txt = (s, x, y, { font = f, t = 10, c = ENCRE, droite = false } = {}) => { const v = propre(s); page.drawText(v, { x: droite ? x - font.widthOfTextAtSize(v, t) : x, y, size: t, font, color: c }); };
  let y = H - M - 10;
  txt(`Bilan de ${d.mois}`, M, y, { font: fb, t: 22 }); y -= 18;
  txt(`${d.enCours ? 'Mois en cours · ' : ''}établi le ${d.etabliLe}`, M, y, { t: 9.5, c: GRIS }); y -= 36;
  const ecrit = (l) => (l.valeur == null ? '-' : `${l.auMoins ? 'au moins ' : ''}${l.type === 'eur' ? fmt(l.valeur) : String(l.valeur)}`);
  for (const l of d.lignes) {
    const fort = l.cle === 'benefice';
    txt(l.nom, M, y, { font: fort ? fb : f, t: 13 });
    txt(ecrit(l), W - M, y, { font: fb, t: 13, droite: true });
    if (l.note) { y -= 14; txt(l.note, M, y, { t: 9, c: GRIS }); }
    y -= 12; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: FILET }); y -= 22;
  }
  if (d.meilleur) {
    txt('Meilleur compte', M, y, { t: 13 });
    txt(d.meilleur.nom, W - M, y, { font: fb, t: 13, droite: true }); y -= 14;
    txt(`${d.meilleur.n} vente${d.meilleur.n > 1 ? 's' : ''} · ${fmt(d.meilleur.eur)} vendus · sur ${d.meilleur.parmi} compte${d.meilleur.parmi > 1 ? 's' : ''}`, M, y, { t: 9, c: GRIS }); y -= 26;
  }
  txt('Vendu : au jour de la vente. Reçu : au jour du versement. Un tiret veut dire « pas su ».', M, M, { t: 8, c: GRIS });
  return doc.save();
}
