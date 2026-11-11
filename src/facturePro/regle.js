import { gabaritMail } from '../../api/_lib/mail-gabarit.js';
import { traductionContenu, MESSAGE_DEFAUT_EN } from './anglais.js';
// ════════════════════════════════════════════════════════════════════════════
//  LA FACTURE PRO — la règle (2 novembre)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « mettre à disposition la possibilité de créer sa propre facture
// quand on est en compte Pro […] on remplit toutes les informations
// nécessaires, on peut mettre son logo, et à côté de chaque vente
// professionnelle on appuie sur “Envoyer la facture à l'acheteur” et VRM
// l'envoie. Une facture personnalisable, mais une VRAIE facture, parfaite. »
//
// Ce module est PUR (aucun accès réseau, aucun DOM) : l'app l'utilise pour
// l'aperçu et le PDF, le serveur (api/_lib/facture-pro.js) pour émettre et
// envoyer — la MÊME règle des deux côtés (§11), jamais deux copies.
//
// ── CE QU'UNE FACTURE DOIT PORTER (vente de biens à un particulier, France) ──
// Code de commerce L441-9, CGI art. 242 nonies A de l'annexe II :
//   · numéro unique, d'une séquence chronologique continue (aucun trou, aucun
//     doublon) ; date d'émission ; date de la vente (livraison) si différente ;
//   · vendeur : nom ou dénomination, forme (« EI » pour un entrepreneur
//     individuel, obligatoire depuis mai 2022), adresse, SIREN/SIRET,
//     immatriculation (RCS…) pour une société, capital pour une société,
//     n° de TVA intracommunautaire si assujetti ;
//   · acheteur : nom et adresse ;
//   · désignation, quantité, prix unitaire HT, taux et montant de TVA, total
//     HT et TTC — ou la MENTION qui remplace la TVA :
//       - franchise en base : « TVA non applicable, art. 293 B du CGI » ;
//       - régime de la marge (biens d'occasion) : « Régime particulier – Biens
//         d'occasion » (art. 297 A et 242 nonies A, I-13°), et la TVA ne doit
//         JAMAIS apparaître sur la facture (art. 297 E) ;
//   · date du paiement (facture acquittée).
//   Les pénalités de retard et l'indemnité de 40 € ne concernent que les
//   ventes entre professionnels : une vente Vinted est payée d'avance par un
//   particulier, la facture est acquittée.
//   Les nouvelles mentions de la réforme (SIREN du client, nature de
//   l'opération…) visent les factures entre entreprises ; la nature
//   « Livraison de biens » est écrite quand même (elle ne coûte rien).
//
// ── LES GARANTIES ───────────────────────────────────────────────────────────
// · Aucune donnée inventée : un champ obligatoire manquant ⇒ PAS de facture,
//   et la liste de ce qui manque, en mots (`manquantsVendeur`, `manquantsVente`).
// · Le régime de TVA n'est JAMAIS deviné (`tva` absent = pas choisi).
// · Tous les montants en CENTIMES entiers (jamais 0,1 + 0,2).
// · Une facture émise est un INSTANTANÉ (`contenuFacture`) : elle ne change
//   plus jamais, même si la fiche entreprise change ensuite.

export const MENTION_FRANCHISE = 'TVA non applicable, art. 293 B du CGI';
export const MENTION_MARGE = "Régime particulier – Biens d'occasion (art. 297 A du CGI)";
export const NATURE = 'Livraison de biens';
export const TAUX_TVA = [20, 10, 5.5, 2.1];

// Les régimes de TVA proposés, dans l'ordre de l'écran.
export const REGIMES_TVA = [
  { v: 'franchise', l: 'Franchise de TVA', d: 'Micro-entreprise sous le seuil : pas de TVA, la mention « art. 293 B » est écrite.' },
  { v: 'marge', l: 'TVA sur la marge', d: "Revente de biens d'occasion : le prix est écrit sans TVA, avec la mention « Biens d'occasion »." },
  { v: 'normal', l: 'TVA classique', d: 'La TVA est calculée sur le prix et écrite sur la facture.' },
];
export const FORMES = [
  { v: 'EI', l: 'Entrepreneur individuel (EI)', societe: false },
  { v: 'EURL', l: 'EURL', societe: true },
  { v: 'SASU', l: 'SASU', societe: true },
  { v: 'SARL', l: 'SARL', societe: true },
  { v: 'SAS', l: 'SAS', societe: true },
];
export const estSociete = (forme) => !!(FORMES.find((f) => f.v === forme) || {}).societe;

// Les couleurs proposées pour personnaliser la facture (une seule, discrète :
// le filet du tableau et le numéro). Jamais une couleur libre qui rendrait le
// texte illisible à l'impression.
export const COULEURS = ['#1d1d1f', '#0071e3', '#1f6f4a', '#8a3b12', '#48484a', '#b0103a'];

const txt = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : v == null ? '' : String(v).replace(/\s+/g, ' ').trim());
const lignes = (v) => String(v == null ? '' : v).split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);

// ── SIREN / SIRET : clé de Luhn (La Poste à part) ───────────────────────────
const luhnOk = (ch) => { let s = 0; for (let i = 0; i < ch.length; i++) { let n = Number(ch[ch.length - 1 - i]); if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; } s += n; } return s % 10 === 0; };
export function verifierSiret(brut) {
  const ch = String(brut || '').replace(/[\s.-]/g, '');
  if (!ch) return { etat: 'vide' };
  if (!/^\d+$/.test(ch)) return { etat: 'invalide', raison: 'il ne doit contenir que des chiffres' };
  if (ch.length !== 9 && ch.length !== 14) return { etat: 'invalide', raison: `${ch.length} chiffres — un SIREN en a 9, un SIRET 14` };
  const siren = ch.slice(0, 9);
  if (!luhnOk(siren)) return { etat: 'invalide', raison: 'la clé de contrôle ne correspond pas (faute de frappe ?)' };
  if (ch.length === 14 && !(siren === '356000000' ? ch.split('').reduce((s, c) => s + Number(c), 0) % 5 === 0 : luhnOk(ch))) return { etat: 'invalide', raison: 'la clé de contrôle du SIRET ne correspond pas (faute de frappe ?)' };
  return { etat: 'ok', siren, siret: ch.length === 14 ? ch : '' };
}
// N° de TVA intracommunautaire français : FR + 2 caractères + SIREN.
export const tvaIntraValide = (v) => /^FR[0-9A-Z]{2}\d{9}$/.test(String(v || '').replace(/\s/g, '').toUpperCase());
export const emailValide = (v) => /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[a-z]{2,}$/i.test(String(v || '').trim());
export const prefixeValide = (v) => /^[A-Z0-9]{1,6}$/.test(String(v || ''));

// ── LA FICHE DU VENDEUR (ligne `vrm_pro_facture`) ───────────────────────────
// Rend la liste de ce qui manque pour émettre une facture conforme, en mots,
// chacun avec le nom du champ (l'écran met le doigt dessus). Vide = prête.
export function manquantsVendeur(cfg) {
  const c = cfg && typeof cfg === 'object' ? cfg : {};
  const m = [];
  if (!txt(c.nom)) m.push({ champ: 'nom', l: c.forme === 'EI' || !c.forme ? 'ton nom et prénom (ou ton nom commercial)' : 'la raison sociale' });
  if (!FORMES.some((f) => f.v === c.forme)) m.push({ champ: 'forme', l: 'la forme de ton entreprise (EI, SASU…)' });
  const s = verifierSiret(c.siret);
  if (s.etat === 'vide') m.push({ champ: 'siret', l: 'ton SIRET' });
  else if (s.etat !== 'ok') m.push({ champ: 'siret', l: `un SIRET valide (${s.raison})` });
  if (!txt(c.adresse)) m.push({ champ: 'adresse', l: "l'adresse de ton entreprise" });
  if (!/^\d{5}$/.test(txt(c.codePostal))) m.push({ champ: 'codePostal', l: 'le code postal (5 chiffres)' });
  if (!txt(c.ville)) m.push({ champ: 'ville', l: 'la ville' });
  if (!REGIMES_TVA.some((r) => r.v === c.tva_regime)) m.push({ champ: 'tva_regime', l: 'ton régime de TVA' });
  if (c.tva_regime === 'normal' && !TAUX_TVA.includes(Number(c.tva_taux))) m.push({ champ: 'tva_taux', l: 'le taux de TVA' });
  if ((c.tva_regime === 'normal' || c.tva_regime === 'marge') && !tvaIntraValide(c.tva)) m.push({ champ: 'tva', l: 'ton n° de TVA intracommunautaire (FR + 11 caractères)' });
  if (estSociete(c.forme)) {
    if (!txt(c.rcs)) m.push({ champ: 'rcs', l: "l'immatriculation (ex. RCS Rennes)" });
    if (!txt(c.capital)) m.push({ champ: 'capital', l: 'le capital social' });
  }
  if (c.prefixe != null && c.prefixe !== '' && !prefixeValide(c.prefixe)) m.push({ champ: 'prefixe', l: 'un préfixe de numéro en lettres majuscules et chiffres (6 au plus)' });
  return m;
}

// ── LA VENTE ────────────────────────────────────────────────────────────────
// `v` = { acheteur: {nom, adresse, email}, designation, centimes, venteLe,
//         reference, plateforme }.
export function manquantsVente(v, { pourEnvoi = false } = {}) {
  const x = v && typeof v === 'object' ? v : {};
  const a = x.acheteur || {};
  const m = [];
  if (!txt(a.nom)) m.push({ champ: 'acheteurNom', l: "le nom de l'acheteur" });
  if (!lignes(a.adresse).length) m.push({ champ: 'acheteurAdresse', l: "l'adresse de l'acheteur" });
  if (pourEnvoi && !emailValide(a.email)) m.push({ champ: 'acheteurEmail', l: "l'adresse e-mail de l'acheteur" });
  if (!txt(x.designation)) m.push({ champ: 'designation', l: "la désignation de l'article" });
  if (!(Number.isInteger(x.centimes) && x.centimes > 0)) m.push({ champ: 'prix', l: 'le prix' });
  if (!Number.isFinite(Date.parse(x.venteLe || ''))) m.push({ champ: 'venteLe', l: 'la date de la vente' });
  return m;
}

// ── LES MONTANTS ────────────────────────────────────────────────────────────
// Le prix payé par l'acheteur pour l'article est un prix TTC. Rend des
// centimes entiers : { ht, tva, ttc, taux } — `tva` null quand elle ne doit
// pas apparaître (franchise : il n'y en a pas ; marge : elle est interdite
// sur la facture, art. 297 E).
export function montants(centimesTTC, regime, taux) {
  const ttc = Math.round(Number(centimesTTC));
  if (!Number.isInteger(ttc) || ttc <= 0) return null;
  if (regime === 'normal') {
    const t = Number(taux);
    if (!TAUX_TVA.includes(t)) return null;
    const ht = Math.round(ttc * 1000 / (1000 + t * 10));
    return { ht, tva: ttc - ht, ttc, taux: t };
  }
  if (regime === 'franchise' || regime === 'marge') return { ht: ttc, tva: null, ttc, taux: null };
  return null;
}

export const numeroFacture = (prefixe, annee, n, type = 'facture') =>
  `${type === 'avoir' ? 'AV' : (prefixeValide(prefixe) ? prefixe : 'FA')}-${annee}-${String(n).padStart(4, '0')}`;

// Les chiffres à l'écran et sur le PDF : « 1 234,50 € » (espace fine insécable
// remplacée par une espace simple : la police standard du PDF ne l'a pas).
export const euros = (c) => {
  const neg = c < 0; const a = Math.abs(Math.round(c));
  const e = String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${neg ? '-' : ''}${e},${String(a % 100).padStart(2, '0')}\u00a0€`;
};
const pad = (n) => String(n).padStart(2, '0');
// Une date « jj/mm/aaaa » à l'heure de Paris (une vente à 23 h 30 le 31 ne
// devient pas le 1er sur un serveur réglé en UTC).
export function jourParis(t) {
  const d = new Date(typeof t === 'number' ? t : Date.parse(t || ''));
  if (isNaN(d)) return '';
  try {
    const p = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(d);
    const g = (k) => (p.find((x) => x.type === k) || {}).value;
    return `${g('day')}/${g('month')}/${g('year')}`;
  } catch (_) { return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; }
}
export const anneeParis = (t) => Number(jourParis(t).slice(-4)) || new Date(t).getFullYear();

// ── L'INSTANTANÉ D'UNE FACTURE ──────────────────────────────────────────────
// Tout ce que le PDF dessine, et rien d'autre : il se refait à l'identique des
// années plus tard. Lève une erreur (avec la liste) si quelque chose manque —
// l'appelant vérifie AVANT avec `manquantsVendeur` / `manquantsVente`.
export function contenuFacture(cfg, vente, { numero, emiseLe, type = 'facture', origine = null, langue = 'fr' }) {
  const mv = manquantsVendeur(cfg); const mvt = manquantsVente(vente);
  if (mv.length || mvt.length) { const e = new Error('incomplet'); e.manquants = [...mv, ...mvt]; throw e; }
  const c = cfg;
  const signe = type === 'avoir' ? -1 : 1;
  const mt = montants(vente.centimes, c.tva_regime, c.tva_taux);
  const s = verifierSiret(c.siret);
  const forme = c.forme;
  const nomVendeur = txt(c.nom);
  // « EI » accolé au nom pour un entrepreneur individuel (sauf s'il y est déjà).
  const nomAffiche = forme === 'EI' && !/(^|\s)(EI|Entrepreneur individuel)(\s|$)/i.test(nomVendeur) ? `${nomVendeur} EI` : nomVendeur;
  const legal = [];
  if (forme && forme !== 'EI') legal.push(`${forme}${txt(c.capital) ? ` au capital de ${txt(c.capital).replace(/\s*€?$/, '')}\u00a0€` : ''}`);
  legal.push(s.siret ? `SIRET ${s.siret.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, '$1 $2 $3 $4')}` : `SIREN ${s.siren.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')}`);
  if (txt(c.rcs)) legal.push(txt(c.rcs));
  if (tvaIntraValide(c.tva)) legal.push(`TVA ${String(c.tva).replace(/\s/g, '').toUpperCase()}`);
  const mentions = [];
  if (c.tva_regime === 'franchise') mentions.push(MENTION_FRANCHISE);
  if (c.tva_regime === 'marge') mentions.push(MENTION_MARGE);
  const venteLe = Date.parse(vente.venteLe);
  // (10 nov., lot T) « Facture en anglais » : la traduction est FIGÉE dans
  // l'instantané (./anglais.js) ; le français reste, mot pour mot.
  const anglais = langue === 'en' ? { anglais: traductionContenu({ mentions, venteJour: jourParis(venteLe), plateforme: txt(vente.plateforme) }) } : {};
  return {
    v: 1,
    type,
    numero: String(numero),
    origine: origine ? String(origine) : null,             // la facture qu'un avoir annule
    emiseLe: new Date(emiseLe).toISOString(),
    emiseJour: jourParis(emiseLe),
    venteJour: jourParis(venteLe),
    vendeur: {
      nom: nomAffiche,
      adresse: [txt(c.adresse), `${txt(c.codePostal)} ${txt(c.ville)}`.trim()],
      legal,
      email: emailValide(c.email) ? txt(c.email) : '',
      telephone: txt(c.telephone),
    },
    acheteur: {
      nom: txt(vente.acheteur.nom),
      adresse: lignes(vente.acheteur.adresse),
      email: emailValide(vente.acheteur.email) ? txt(vente.acheteur.email) : '',
    },
    lignes: [{ designation: txt(vente.designation), quantite: 1, unite: signe * mt.ht, total: signe * mt.ht }],
    regime: c.tva_regime,
    taux: mt.taux,
    totaux: { ht: signe * mt.ht, tva: mt.tva == null ? null : signe * mt.tva, ttc: signe * mt.ttc },
    nature: NATURE,
    paiement: type === 'avoir'
      ? 'Montant remboursé à l\'acheteur.'
      : `Facture acquittée — payée le ${jourParis(venteLe)}${txt(vente.plateforme) ? ` via ${txt(vente.plateforme)}` : ''}.${txt(c.mentionPaiement) ? ` ${txt(c.mentionPaiement).slice(0, 200)}` : ''}`,
    reference: txt(vente.reference) ? `${txt(vente.plateforme) || 'Vente'} n° ${txt(vente.reference)}` : '',
    mentions,
    note: String(c.note || '').slice(0, 600).trim(),
    couleur: COULEURS.includes(c.couleur) ? c.couleur : COULEURS[0],
    logo: typeof c.logo === 'string' && /^data:image\/(png|jpeg);base64,/.test(c.logo) && c.logo.length <= LOGO_MAX ? c.logo : '',
    ...anglais,
  };
}
// Le logo : une image PNG ou JPEG, réduite par l'app avant d'être rangée.
export const LOGO_MAX = 200 * 1024;

// Le nom de fichier : « Facture-FA-2026-0006.pdf ».
export const nomFichier = (contenu) => `${contenu.type === 'avoir' ? 'Avoir' : 'Facture'}-${String(contenu.numero).replace(/[^\w-]/g, '')}.pdf`;

// ── L'E-MAIL À L'ACHETEUR ───────────────────────────────────────────────────
// Le texte par défaut ; le vendeur peut le réécrire (`cfg.message`). Les seuls
// remplacements : {numero}, {acheteur}, {article}, {boutique}.
export const MESSAGE_DEFAUT = 'Bonjour {acheteur},\n\nVous trouverez ci-joint la facture {numero} pour votre achat « {article} ».\n\nMerci pour votre confiance,\n{boutique}';
export function messageEmail(cfg, contenu) {
  // (10 nov.) Facture en anglais : le message par défaut est anglais PUIS français ;
  // un message écrit par le vendeur reste le sien, jamais traduit.
  const modele = String((cfg && cfg.message) || '').trim() || (contenu.anglais ? `${MESSAGE_DEFAUT_EN}\n\n—\n\n${MESSAGE_DEFAUT}` : MESSAGE_DEFAUT);
  const r = { numero: contenu.numero, acheteur: contenu.acheteur.nom, article: (contenu.lignes[0] || {}).designation || '', boutique: contenu.vendeur.nom };
  const corps = modele.replace(/\{(numero|acheteur|article|boutique)\}/g, (_, k) => r[k] || '').slice(0, 3000);
  const libDoc = contenu.type === 'avoir' ? 'Avoir' : 'Facture';
  const sujet = `${contenu.anglais ? `${libDoc} / ${contenu.type === 'avoir' ? 'Credit note' : 'Invoice'}` : libDoc} ${contenu.numero} — ${contenu.vendeur.nom}`.slice(0, 200);
  return { sujet, corps };
}

// ── L'ADRESSE DE L'ACHETEUR, TELLE QUE VINTED L'ÉCRIT DANS L'E-MAIL PRO ─────
// Mesuré (2 nov., 5 ventes Pro réelles, formes seulement) : « rue, [n°], ville,
// code postal, code pays, pays » sur une ligne. On la remet en lignes postales :
// « 12 rue X » / « 75011 Paris » / (pays s'il n'est pas la France). Rien n'est
// inventé : une forme inattendue est rendue telle quelle, virgules comprises.
export function adresseVintedLisible(brut) {
  const parts = String(brut || '').split(/\s*,\s*/).map((x) => x.trim()).filter(Boolean);
  if (parts.length < 3) return parts.join(', ');
  let pays = '';
  if (/^[A-Z]{2}$/.test(parts[parts.length - 2] || '') && /^[^\d]+$/.test(parts[parts.length - 1])) { pays = parts.pop(); parts.pop(); }
  let iCp = -1;
  for (let i = parts.length - 1; i >= 1; i--) if (/^(?=(?:\D*\d){3})[A-Z0-9 -]{3,10}$/i.test(parts[i])) { iCp = i; break; }
  if (iCp < 2) return [parts.join(', '), pays && !/^france$/i.test(pays) ? pays : ''].filter(Boolean).join('\n');
  const ville = parts[iCp - 1];
  const rue = parts.slice(0, iCp - 1);
  if (rue.length === 2 && /^\d+\s?[a-z]?$/i.test(rue[1])) rue.splice(0, 2, `${rue[1]} ${rue[0]}`);
  const fin = parts.slice(iCp + 1);
  return [rue.join(', '), `${parts[iCp]} ${ville}`, ...fin, pays && !/^france$/i.test(pays) ? pays : ''].filter(Boolean).join('\n');
}

// ════════════════════════════════════════════════════════════════════════════
//  (6 nov.) « MA FACTURE » : L'APERÇU QUI SUIT LA FRAPPE, MÊME INCOMPLET
// ════════════════════════════════════════════════════════════════════════════
// Julien : « un endroit où on met toutes ses infos et on peut visuellement voir
// à quoi elle va ressembler pour tous les futurs acheteurs ».
// `contenuFacture` refuse une fiche incomplète (il fabrique une PIÈCE
// comptable). L'aperçu, lui, doit se dessiner dès la première lettre : là où une
// mention obligatoire manque, il écrit un TROU — `{ trou: champ, t: '… : à
// compléter' }` — que l'écran montre en ambre. Le reste est le MÊME instantané
// que le PDF (on part de `contenuFacture` sur une fiche rendue complète par des
// valeurs témoins, puis chaque valeur témoin est remplacée par son trou : aucune
// n'est jamais montrée).
export const A_COMPLETER = 'à compléter';
const trou = (champ, libelle) => ({ trou: champ, t: `${libelle} : ${A_COMPLETER}` });
export const estTrou = (x) => !!(x && typeof x === 'object' && x.trou);
const SIRET_TEMOIN = '73282932000074';
export function contenuApercu(cfg, vente, { numero, emiseLe }) {
  const c = { ...(cfg && typeof cfg === 'object' ? cfg : {}) };
  const manque = manquantsVendeur(c);
  const champs = new Set(manque.map((m) => m.champ));
  const temoin = { ...c };
  if (champs.has('nom')) temoin.nom = 'X';
  if (champs.has('forme')) temoin.forme = 'EI';
  if (champs.has('siret')) temoin.siret = SIRET_TEMOIN;
  if (champs.has('adresse')) temoin.adresse = 'X';
  if (champs.has('codePostal')) temoin.codePostal = '00000';
  if (champs.has('ville')) temoin.ville = 'X';
  if (champs.has('tva_regime')) temoin.tva_regime = 'franchise';
  if (champs.has('tva_taux')) temoin.tva_taux = 20;
  if (champs.has('tva')) temoin.tva = 'FR00' + SIRET_TEMOIN.slice(0, 9);
  if (champs.has('rcs')) temoin.rcs = '§RCS§';
  if (champs.has('capital')) temoin.capital = '§CAP§';
  if (champs.has('prefixe')) temoin.prefixe = 'FA';
  const contenu = contenuFacture(temoin, vente, { numero, emiseLe });
  const v = contenu.vendeur;
  if (champs.has('nom')) v.nom = trou('nom', estSociete(c.forme) ? 'Raison sociale' : 'Ton nom et prénom');
  else if (champs.has('forme')) v.nom = txt(c.nom);
  const ligneCp = `${txt(c.codePostal)} ${txt(c.ville)}`.trim();
  v.adresse = [
    champs.has('adresse') ? trou('adresse', 'Adresse') : txt(c.adresse),
    champs.has('codePostal') || champs.has('ville') ? trou(champs.has('codePostal') ? 'codePostal' : 'ville', 'Code postal et ville') : ligneCp,
  ];
  v.legal = v.legal.map((l) => {
    if (champs.has('siret') && /^SIRE[NT] /.test(l)) return trou('siret', 'SIRET');
    if (champs.has('tva') && /^TVA FR/.test(l)) return trou('tva', 'N° de TVA intracommunautaire');
    if (champs.has('rcs') && l === '§RCS§') return trou('rcs', 'Immatriculation (RCS ou RM)');
    if (champs.has('capital') && /§CAP§/.test(l)) return String(c.forme || '');
    return l;
  });
  if (champs.has('capital')) v.legal.push(trou('capital', 'Capital social'));
  if (champs.has('forme')) v.legal.unshift(trou('forme', 'Forme de l’entreprise (EI, SASU…)'));
  if (champs.has('tva_regime')) contenu.mentions = [trou('tva_regime', 'Mention de TVA (choisis ton régime)')];
  if (champs.has('tva_taux')) contenu.mentions = [...contenu.mentions, trou('tva_taux', 'Taux de TVA')];
  if (champs.has('prefixe')) contenu.numeroTrou = trou('prefixe', 'Début des numéros');
  return { contenu, manque };
}

// ── LES MENTIONS OBLIGATOIRES, une par une (l'audit et l'écran les comptent) ─
// Vente de biens par un micro-entrepreneur à un particulier (Code de commerce
// L441-9 ; CGI art. 242 nonies A de l'annexe II ; art. 293 B ; art. L526-22 du
// Code de commerce et décret 2022-725 pour « EI ») — sources citées dans
// docs/passation/2026-11-06-facture-pro.md.
const plein = (x) => (estTrou(x) ? false : !!txt(x));
const trouDe = (liste, champ) => liste.some((l) => estTrou(l) && l.trou === champ);
export const MENTIONS_OBLIGATOIRES = [
  { cle: 'numero', l: 'Numéro unique de la facture', ok: (c) => !c.numeroTrou && /^[A-Z0-9]{1,6}-\d{4}-\d{4,}$/.test(String(c.numero)) },
  { cle: 'emise', l: "Date d'émission", ok: (c) => /^\d{2}\/\d{2}\/\d{4}$/.test(c.emiseJour) },
  { cle: 'vente', l: 'Date de la vente (livraison)', ok: (c) => /^\d{2}\/\d{2}\/\d{4}$/.test(c.venteJour) },
  { cle: 'vendeur', l: 'Nom du vendeur (avec « EI » pour un entrepreneur individuel)', ok: (c) => plein(c.vendeur.nom) && (c.vendeur.legal.some((l) => typeof l === 'string' && /^(SAS|SASU|SARL|EURL)\b/.test(l)) || /(^|\s)(EI|Entrepreneur individuel)$/i.test(String(c.vendeur.nom))) },
  { cle: 'forme', l: 'Forme juridique', ok: (c) => !trouDe(c.vendeur.legal, 'forme') },
  { cle: 'adresse', l: 'Adresse du vendeur', ok: (c) => c.vendeur.adresse.length === 2 && c.vendeur.adresse.every(plein) },
  { cle: 'siret', l: 'SIREN ou SIRET', ok: (c) => c.vendeur.legal.some((l) => typeof l === 'string' && /^SIRE[NT] \d/.test(l)) },
  { cle: 'societe', l: 'Immatriculation et capital (société)', ok: (c) => !trouDe(c.vendeur.legal, 'rcs') && !trouDe(c.vendeur.legal, 'capital') },
  { cle: 'tvaintra', l: 'N° de TVA intracommunautaire (si assujetti)', ok: (c) => !trouDe(c.vendeur.legal, 'tva') && (c.regime === 'franchise' || c.vendeur.legal.some((l) => typeof l === 'string' && /^TVA FR/.test(l))) },
  { cle: 'acheteur', l: "Nom et adresse de l'acheteur", ok: (c) => plein(c.acheteur.nom) && c.acheteur.adresse.length > 0 },
  { cle: 'designation', l: 'Désignation, quantité et prix unitaire', ok: (c) => c.lignes.length > 0 && c.lignes.every((x) => txt(x.designation) && x.quantite > 0 && Number.isInteger(x.unite)) },
  { cle: 'totaux', l: 'Total à payer', ok: (c) => Number.isInteger(c.totaux.ttc) },
  { cle: 'tva', l: 'TVA (taux et montant) ou la mention qui la remplace', ok: (c) => (c.regime === 'normal' ? Number.isInteger(c.totaux.tva) && c.taux != null && !trouDe(c.mentions, 'tva_taux') : c.mentions.some((m) => m === MENTION_FRANCHISE || m === MENTION_MARGE)) },
  { cle: 'paiement', l: 'Date du paiement (facture acquittée)', ok: (c) => c.type === 'avoir' || /payée le \d{2}\/\d{2}\/\d{4}/.test(c.paiement) },
];
export const mentionsManquantes = (contenu) => MENTIONS_OBLIGATOIRES.filter((m) => { try { return !m.ok(contenu); } catch (_) { return true; } }).map((m) => m.cle);

// ── L'E-MAIL DE LA FACTURE (6 nov., décision de Julien : « ça peut être VRM qui
// envoie et met en copie le vendeur ») ───────────────────────────────────────
// Le texte du vendeur (`messageEmail`) et une version HTML qui dit la même chose
// (tout est échappé : aucune valeur n'écrit du HTML), sans pied (11 nov.). Jamais de lien de désinscription : c'est un e-mail
// transactionnel (la facture d'un achat), pas une lettre d'information.
export function emailFacture(cfg, contenu, { via = 'vrm' } = {}) {
  const { sujet, corps } = messageEmail(cfg, contenu);
  const nom = contenu.vendeur.nom;
  // (11 nov., lot DJ1 — Julien : « Cette facture vous est envoyée par VRM pour le compte
  // de … Pour toute question, répondez simplement à cet e-mail … Je veux pas de ce
  // message. ») PLUS AUCUN PIED : l'e-mail ne garde que SON texte (signé de sa boutique)
  // et la pièce jointe. La réponse de l'acheteur arrive toujours chez lui, sans le dire :
  // c'est l'en-tête Reply-To (= l'e-mail du vendeur, api/_lib/facture-pro.js) qui le tient.
  const texte = corps;
  // (8 nov.) Le HTML passe par le gabarit commun des e-mails (api/_lib/mail-gabarit.js) :
  // le NOM du vendeur en tête (c'est SA facture, pas un e-mail de VRM), son texte
  // échappé, la pièce jointe dite, aucun bouton, aucun pied (`marque` : pas de mentions de VRM).
  const doc = contenu.type === 'avoir' ? (contenu.anglais ? 'Avoir / Credit note' : 'Avoir') : (contenu.anglais ? 'Facture / Invoice' : 'Facture');
  const { html } = gabaritMail({
    titre: `${doc} ${contenu.numero}`,
    preentete: `${doc} ${contenu.numero} en pièce jointe (PDF)${contenu.anglais ? ' / attached (PDF)' : ''}.`,
    paras: corps.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean),
    apres: `${doc} ${contenu.numero} en pièce jointe (PDF)${contenu.anglais ? ' / attached (PDF)' : ''}.`,
    pied: null,
    marque: { nom },
  });
  return { sujet, texte, html, nomExpediteur: via === 'vrm' ? `${nom} via VRM`.slice(0, 120) : nom };
}
