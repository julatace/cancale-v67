// ════════════════════════════════════════════════════════════════════════════
//  LE BON DE RETOUR D'UNE VENTE PRO (11 nov., lot DJ1)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « il doit y avoir à côté de chaque vente le bon de retour pour toutes
// les ventes sur un compte professionnel ».
//
// 1. Vinted joint à chaque e-mail de vente Pro SON formulaire de retour (PDF,
//    rangé avec le brouillon de facture `email_invoice_tx{n°}` : `retourB64`,
//    `retourNom` ; mesuré le 11 nov. : 20 ventes Pro sur 20 l'ont). C'est le
//    document de CETTE commande (identité = le n° de transaction, §5) : on
//    l'ouvre tel quel.
// 2. Sans lui, VRM dessine un bon de retour simple pour CETTE vente : le vendeur
//    et l'adresse de retour (celle de « Ma facture »), le n° de transaction,
//    l'article, la date de la vente, le droit de rétractation de 14 jours d'un
//    vendeur professionnel (Code de la consommation, art. L221-18 ; délai qui
//    court à la réception du bien, L221-18 2°) et le modèle de formulaire de
//    rétractation (annexe à l'article R221-1). Rien n'est inventé : un champ
//    absent du vendeur ⇒ pas de bon (la raison dite), une date pas lue ⇒ « — ».
// Module PUR pour le contenu (l'audit l'exécute) ; le PDF passe par pdf-lib.

const txt = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
const lignes = (v) => String(v == null ? '' : v).split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
const jour = (t) => { const d = new Date(typeof t === 'number' ? t : Date.parse(t || '')); if (!Number.isFinite(d.getTime())) return ''; try { return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d); } catch (_) { return d.toISOString().slice(0, 10); } };

export const DELAI_RETRACTATION_J = 14;
export const MENTION_RETRACTATION = `Droit de rétractation : ${DELAI_RETRACTATION_J} jours à compter de la réception de l’article (Code de la consommation, art. L221-18). Les frais de retour sont à la charge de l’acheteur, sauf accord contraire.`;
export const MODELE_FORMULAIRE = [
  'Je vous notifie par la présente ma rétractation du contrat portant sur la vente du bien ci-dessous :',
  'Commandé le : ………………   Reçu le : ………………',
  'Nom de l’acheteur : …………………………………………',
  'Adresse de l’acheteur : …………………………………………',
  'Date : ………………   Signature : ………………',
];

// Ce qui manque au vendeur pour un bon de retour (l'adresse où renvoyer, son nom).
export function manquantsBonRetour(cfg) {
  const c = cfg && typeof cfg === 'object' ? cfg : {};
  const m = [];
  if (!txt(c.nom)) m.push('ton nom');
  if (!txt(c.adresse) || !/^\d{5}$/.test(txt(c.codePostal)) || !txt(c.ville)) m.push('ton adresse de retour');
  return m;
}

// `vente` = { tx, designation|titre, venteLe }.
export function contenuBonRetour(cfg, vente) {
  const c = cfg && typeof cfg === 'object' ? cfg : {};
  const v = vente && typeof vente === 'object' ? vente : {};
  const manque = manquantsBonRetour(c);
  const tx = txt(v.tx);
  if (!/^\d{4,20}$/.test(tx)) manque.push('le n° de la vente');
  if (manque.length) return { ok: false, manque };
  const nom = txt(c.nom) + (c.forme === 'EI' && !/\bEI$/.test(txt(c.nom)) ? ' EI' : '');
  return {
    ok: true,
    titre: 'Bon de retour',
    vendeur: { nom, adresse: [...lignes(c.adresse), `${txt(c.codePostal)} ${txt(c.ville)}`], email: txt(c.email), siret: txt(c.siret).replace(/\D/g, '') },
    vente: { tx, article: txt(v.designation || v.titre) || '—', le: jour(v.venteLe) || '—' },
    mention: MENTION_RETRACTATION,
    formulaire: MODELE_FORMULAIRE,
  };
}
export const nomFichierBonRetour = (c) => `Bon-de-retour-${String((c && c.vente && c.vente.tx) || '').replace(/\D/g, '')}.pdf`;

// Helvetica (WinAnsi) : un caractère hors de la police est remplacé, jamais une erreur.
const propre = (t) => String(t == null ? '' : t).replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/[^\x20-\x7E -ÿ€–—]/g, '?');
export async function pdfBonRetour(contenu, { PDFLib } = {}) {
  const PL = PDFLib || await import('pdf-lib');
  const { PDFDocument, StandardFonts, rgb } = PL;
  const doc = await PDFDocument.create();
  doc.setTitle(`${contenu.titre} ${contenu.vente.tx}`);
  doc.setAuthor(propre(contenu.vendeur.nom));
  const page = doc.addPage([595.28, 841.89]);
  const f = await doc.embedFont(StandardFonts.Helvetica);
  const fb = await doc.embedFont(StandardFonts.HelveticaBold);
  const M = 48; const L = 595.28 - 2 * M;
  const encre = rgb(0.11, 0.11, 0.12); const gris = rgb(0.42, 0.42, 0.45);
  let y = 841.89 - M;
  const ecrire = (t, { taille = 11, gras = false, couleur = encre, avant = 0 } = {}) => {
    y -= avant;
    const police = gras ? fb : f;
    const mots = propre(t).split(' ');
    let l = '';
    const sortir = () => { y -= taille * 1.4; page.drawText(l, { x: M, y, size: taille, font: police, color: couleur }); l = ''; };
    for (const m of mots) { const essai = l ? `${l} ${m}` : m; if (police.widthOfTextAtSize(essai, taille) > L && l) { sortir(); l = m; } else l = essai; }
    if (l) sortir();
  };
  ecrire(contenu.titre, { taille: 22, gras: true });
  ecrire(`Vente n° ${contenu.vente.tx}`, { taille: 11, couleur: gris, avant: 2 });
  ecrire('Renvoyer l’article à', { taille: 10, couleur: gris, avant: 22 });
  ecrire(contenu.vendeur.nom, { taille: 13, gras: true, avant: 2 });
  for (const l of contenu.vendeur.adresse) ecrire(l, { taille: 12 });
  if (contenu.vendeur.email) ecrire(contenu.vendeur.email, { taille: 11, couleur: gris });
  if (contenu.vendeur.siret) ecrire(`SIRET ${contenu.vendeur.siret}`, { taille: 10, couleur: gris });
  ecrire('L’article', { taille: 10, couleur: gris, avant: 20 });
  ecrire(contenu.vente.article, { taille: 12, gras: true, avant: 2 });
  ecrire(`Vendu le ${contenu.vente.le}`, { taille: 11 });
  page.drawLine({ start: { x: M, y: y - 16 }, end: { x: M + L, y: y - 16 }, thickness: 0.5, color: rgb(0.86, 0.86, 0.88) });
  y -= 16;
  ecrire(contenu.mention, { taille: 10.5, avant: 14 });
  ecrire('Formulaire de rétractation', { taille: 13, gras: true, avant: 20 });
  ecrire('(à compléter et renvoyer seulement si vous souhaitez vous rétracter)', { taille: 9.5, couleur: gris });
  ecrire(`À l’attention de ${contenu.vendeur.nom}, ${contenu.vendeur.adresse.join(', ')}${contenu.vendeur.email ? `, ${contenu.vendeur.email}` : ''} :`, { taille: 10.5, avant: 10 });
  for (const l of contenu.formulaire) ecrire(l, { taille: 10.5, avant: 8 });
  ecrire(`Article : ${contenu.vente.article} · vente n° ${contenu.vente.tx}`, { taille: 10.5, avant: 8 });
  return doc.save();
}
