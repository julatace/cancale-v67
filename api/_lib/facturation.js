// ════════════════════════════════════════════════════════════════════════════
//  LE PROFIL D'ENTREPRISE ET LES FACTURES — UNE SEULE RÈGLE, DEUX LECTEURS
//  (15 octobre 2026)
// ════════════════════════════════════════════════════════════════════════════
// Julien, 15 octobre : « micro-entreprise, société, régime de la marge, à
// adapter à la situation de chaque entrepreneur… que la personne puisse mettre
// son SIREN… pour les factures, il va falloir faire ça parfaitement ».
//
// Ce fichier est importé PAR L'APP (src/App.jsx : profil, écran Factures) ET PAR
// LE SERVEUR (api/email-inbound.js : la facture préparée à l'arrivée d'une vente
// Pro). Pas une copie : le même fichier (§11). Il est PUR — aucune dépendance
// Node — sauf `empreinte`, qui passe par `crypto.subtle` (navigateur et Node 22).
//
// ── CE QUE CE FICHIER NE FAIT JAMAIS ─────────────────────────────────────────
//  · Il ne DÉDUIT aucun régime d'un SIREN. Le SIREN se vérifie (format + clé de
//    Luhn) et rien d'autre : forme, TVA, régime de la marge et versement
//    libératoire sont ce que le vendeur DÉCLARE. L'app applique, elle ne juge
//    pas l'éligibilité.
//  · Il ne présente aucune règle comme certaine : chacune porte sa source et sa
//    date de vérification, et le texte officiel n'a PAS pu être ouvert depuis
//    l'outil de développement (legifrance.gouv.fr, bofip.impots.gouv.fr et
//    urssaf.fr y sont bloqués — mesuré le 15 octobre). Les sources ont été
//    recoupées sur des pages secondaires ; c'est écrit à côté de chaque règle.
//  · Il ne donne jamais deux fois le même numéro : un numéro est une LIGNE de la
//    base (`facture_{année}_{rang}`), insérée sans écrasement — si un autre
//    appareil l'a prise entre-temps, l'insertion est ignorée et on prend la
//    suivante. Une facture émise ne se modifie pas : on la corrige par un avoir.
// ════════════════════════════════════════════════════════════════════════════

export const PROFIL_CLE = 'vrm_profil_entreprise';

// La date à laquelle les règles ci-dessous ont été recoupées, et COMMENT.
export const REGLES_VERIFIEES_LE = '2026-10-15';
export const REGLES_NIVEAU = 'sources secondaires (le texte officiel n\'a pas pu être ouvert)';

export const FORMES = {
  micro: 'Micro-entreprise',
  ei_reel: 'Entreprise individuelle au réel',
  societe: 'Société',
};
export const REGIMES_TVA = {
  franchise: 'Franchise en base (pas de TVA)',
  assujetti: 'Je facture la TVA',
};

// ── SIREN, SIRET, N° DE TVA ────────────────────────────────────────────────
export const chiffresSeuls = (s) => String(s == null ? '' : s).replace(/[\s.\-]/g, '');
export function luhnValide(d) {
  if (!/^\d+$/.test(d)) return false;
  let s = 0;
  for (let i = 0; i < d.length; i++) {
    let n = d.charCodeAt(d.length - 1 - i) - 48;
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    s += n;
  }
  return s % 10 === 0;
}
// 'vide' · 'format' (pas 9 chiffres) · 'cle' (clé de contrôle fausse) · 'ok'
export function etatSiren(s) {
  const d = chiffresSeuls(s);
  if (!d) return 'vide';
  if (!/^\d{9}$/.test(d)) return 'format';
  return luhnValide(d) ? 'ok' : 'cle';
}
// Le SIRET = SIREN + NIC (14 chiffres). Exception connue : La Poste (SIREN
// 356 000 000), dont les établissements ne suivent pas la clé de Luhn — la
// somme des chiffres y est un multiple de 5.
// 'vide' · 'format' · 'cle' · 'autre_siren' · 'ok'
export function etatSiret(siret, siren) {
  const d = chiffresSeuls(siret);
  if (!d) return 'vide';
  if (!/^\d{14}$/.test(d)) return 'format';
  const s9 = chiffresSeuls(siren);
  if (/^\d{9}$/.test(s9) && d.slice(0, 9) !== s9) return 'autre_siren';
  if (d.slice(0, 9) === '356000000') {
    const somme = d.split('').reduce((a, c) => a + Number(c), 0);
    return somme % 5 === 0 ? 'ok' : 'cle';
  }
  return luhnValide(d) ? 'ok' : 'cle';
}
// Le n° de TVA intracommunautaire français se CALCULE à partir du SIREN :
// FR + clé (2 chiffres) + SIREN, clé = (12 + 3 × (SIREN mod 97)) mod 97.
// Ce n'est pas une déduction de régime : être assujetti reste sa déclaration.
export function tvaIntraDuSiren(siren) {
  const d = chiffresSeuls(siren);
  if (!/^\d{9}$/.test(d)) return '';
  const cle = (12 + 3 * (Number(d) % 97)) % 97;
  return 'FR' + String(cle).padStart(2, '0') + d;
}
// 'vide' · 'format' · 'autre_siren' · 'cle' · 'ok' · 'ok_non_verifie' (clé en lettres)
export function etatTvaIntra(tva, siren) {
  const v = String(tva == null ? '' : tva).replace(/[\s.\-]/g, '').toUpperCase();
  if (!v) return 'vide';
  const m = /^FR([0-9A-Z]{2})(\d{9})$/.exec(v);
  if (!m) return 'format';
  const s9 = chiffresSeuls(siren);
  if (/^\d{9}$/.test(s9) && m[2] !== s9) return 'autre_siren';
  if (!/^\d{2}$/.test(m[1])) return 'ok_non_verifie';
  return tvaIntraDuSiren(m[2]) === v ? 'ok' : 'cle';
}
// La page PUBLIQUE de l'État qui montre l'entreprise. Un LIEN, ouvert sur son
// clic : rien n'est lu ni importé dans l'app (le format de la réponse de
// l'annuaire n'a pas pu être mesuré d'ici — on n'écrit pas un analyseur pour
// une forme jamais vue).
export const ANNUAIRE_PUBLIC = 'annuaire-entreprises.data.gouv.fr';
export const lienAnnuaire = (siren) => {
  const d = chiffresSeuls(siren);
  return /^\d{9}$/.test(d) ? `https://${ANNUAIRE_PUBLIC}/rechercher?terme=${d}` : '';
};

// ── LE PROFIL ──────────────────────────────────────────────────────────────
export const PROFIL_VIDE = Object.freeze({
  v: 1, forme: '', tva: '', marge: null, vl: null,
  siren: '', siret: '', nom: '', adresse: '', cp: '', ville: '',
  tvaIntra: '', formeJuridique: '', capital: '', rcs: '',
});
const CHAMPS_TEXTE = ['siren', 'siret', 'nom', 'adresse', 'cp', 'ville', 'tvaIntra', 'formeJuridique', 'capital', 'rcs'];
const texte = (v) => (typeof v === 'string' ? v.trim() : (typeof v === 'number' ? String(v) : ''));

// `brut` = la valeur de `vrm_profil_entreprise` (ou rien).
// `ancien` = ce que l'app savait AVANT le profil, pour ne rien perdre de ce
// qu'il a déjà tapé : { regime ('micro'|'marge'), pro (ligne vrm_pro_facture),
// entite (entité active des anciennes factures) }.
// ⚠️ L'ancien réglage « Micro-entrepreneur » disait aussi « pas de TVA » — mais
//    c'était la phrase de l'APP, pas sa déclaration : la TVA reste « à préciser ».
// ⚠️ L'ancien « Société — régime de la marge », lui, était un choix explicite de
//    sa part : il se traduit tel quel (société, TVA facturée, marge).
export function normProfil(brut, ancien = {}) {
  const b = (brut && typeof brut === 'object' && !Array.isArray(brut)) ? brut : {};
  const p = { ...PROFIL_VIDE };
  p.forme = FORMES[b.forme] ? b.forme : '';
  p.tva = REGIMES_TVA[b.tva] ? b.tva : '';
  p.marge = typeof b.marge === 'boolean' ? b.marge : null;
  p.vl = typeof b.vl === 'boolean' ? b.vl : null;
  for (const k of CHAMPS_TEXTE) p[k] = texte(b[k]);
  p.siren = chiffresSeuls(p.siren);
  p.siret = chiffresSeuls(p.siret);
  p.tvaIntra = p.tvaIntra.replace(/\s/g, '').toUpperCase();
  const reprises = [];
  if (!p.forme && ancien.regime === 'marge') {
    p.forme = 'societe'; if (!p.tva) p.tva = 'assujetti'; if (p.marge === null) p.marge = true;
    reprises.push('regime');
  } else if (!p.forme && ancien.regime === 'micro') { p.forme = 'micro'; reprises.push('regime'); }
  // L'identité déjà saisie ailleurs (Facturation Pro, anciennes factures).
  const pro = (ancien.pro && typeof ancien.pro === 'object') ? ancien.pro : {};
  const ent = (ancien.entite && typeof ancien.entite === 'object') ? ancien.entite : {};
  const repris = (k, v) => { if (!p[k] && texte(v)) { p[k] = texte(v); reprises.push(k); } };
  repris('nom', pro.nom || ent.companyName);
  repris('adresse', pro.adresse || ent.companyAddress);
  repris('cp', pro.codePostal);
  repris('ville', pro.ville);
  if (!p.siret) { const s = chiffresSeuls(pro.siret || ent.siret); if (/^\d{14}$/.test(s)) { p.siret = s; reprises.push('siret'); } }
  if (!p.siren) {
    const s = chiffresSeuls(pro.siret || ent.siret);
    if (/^\d{9}$/.test(s) || /^\d{14}$/.test(s)) { p.siren = s.slice(0, 9); reprises.push('siren'); }
  }
  if (!p.tvaIntra && texte(pro.tva)) { p.tvaIntra = texte(pro.tva).replace(/\s/g, '').toUpperCase(); reprises.push('tvaIntra'); }
  p.reprises = reprises;
  return p;
}
// Ce qu'on range (sans les marques de lecture).
export function profilARanger(p) {
  const out = { v: 1 };
  for (const k of Object.keys(PROFIL_VIDE)) if (k !== 'v') out[k] = p[k] == null ? PROFIL_VIDE[k] : p[k];
  return out;
}

// Ce qui s'APPLIQUE, à partir de ce qu'il a déclaré (aucune déduction) :
// la marge n'a de sens que pour qui facture la TVA ; le versement libératoire
// n'existe qu'en micro-entreprise.
export const margeAppliquee = (p) => !!p && p.tva === 'assujetti' && p.marge === true;
export const vlApplique = (p) => !!p && p.forme === 'micro' && p.vl === true;
export const estEI = (p) => !!p && (p.forme === 'micro' || p.forme === 'ei_reel');

// La valeur publiée pour les lecteurs d'avant (`vinted_regime`) : 'micro' ·
// 'marge' · 'reel' (entreprise individuelle au réel ou société hors marge) ·
// '' (pas encore dit). Une micro-entreprise reste 'micro' même au régime de la
// marge : ses cotisations URSSAF sont l'obligation que les rapports chiffrent.
export function regimeDe(p) {
  if (!p || !p.forme) return '';
  if (p.forme === 'micro') return 'micro';
  return margeAppliquee(p) ? 'marge' : 'reel';
}
// Le régime EFFECTIF d'un vendeur, pour les écrans et le serveur qui n'ont que
// le profil brut + le réglage publié : le profil déclaré d'abord, sinon le
// `vinted_regime` publié ('reel'/'marge' : posés uniquement par le profil, mais
// gardés si le profil ne se lit pas), sinon **'micro'** — le comportement
// d'avant le profil, rien ne change en silence pour qui n'a rien déclaré.
// (16 octobre : le tableau de bord disait « À payer (13,5 %) · Déclarer sur
// l'URSSAF » à une société au réel, et le rappel du 1er partait chez elle.)
export function regimeEffectif(profilBrut, regimePub) {
  const r = regimeDe(normProfil(profilBrut, { regime: regimePub }));
  if (r) return r;
  return regimePub === 'reel' || regimePub === 'marge' ? regimePub : 'micro';
}
export function libelleProfil(p) {
  if (!p || !p.forme) return 'Profil à préciser';
  const parts = [FORMES[p.forme]];
  if (margeAppliquee(p)) parts.push('régime de la marge');
  else if (p.tva === 'franchise') parts.push('franchise de TVA');
  else if (p.tva === 'assujetti') parts.push('TVA facturée');
  if (vlApplique(p)) parts.push('versement libératoire');
  return parts.join(' · ');
}
// Le libellé d'un régime publié (`vinted_regime`) — pour les rapports qui ne
// lisent que lui.
export const libelleRegime = (r) => (r === 'marge' ? 'Société — régime de la marge'
  : r === 'reel' ? 'Au réel (hors micro-entreprise)'
    : 'Micro-entrepreneur');

// ── LES RÈGLES QUE L'APP APPLIQUE — DATÉES, SOURCÉES, JAMAIS CERTAINES ─────
// Une règle = une phrase courte + sa source. `verif` dit COMMENT elle a été
// recoupée ; aucune n'est un conseil. Le bloc qui les affiche finit toujours
// par « à faire valider par ton comptable ».
const R = (id, texte, source) => ({ id, texte, source, verifieLe: REGLES_VERIFIEES_LE, verif: REGLES_NIVEAU });
export function reglesDuProfil(p, { tauxUrssaf } = {}) {
  const out = [];
  if (!p) return out;
  out.push(R('numerotation', 'Chaque facture a un numéro unique, dans une suite chronologique continue, sans trou.',
    'CGI, annexe II, art. 242 nonies A'));
  out.push(R('avoir', 'Une facture émise ne se modifie ni ne se supprime : une erreur se corrige par un avoir qui la cite.',
    'CGI, annexe II, art. 242 nonies A (document rectificatif) — formulation de VRM'));
  if (p.tva === 'franchise') {
    out.push(R('franchise', 'Tu ne factures pas de TVA. Tes factures portent « TVA non applicable, art. 293 B du CGI ».',
      'CGI, art. 293 B'));
  }
  if (p.tva === 'assujetti' && !margeAppliquee(p)) {
    out.push(R('tva_normale', 'Tes factures détaillent le prix hors taxe, le taux et le montant de TVA, le total TTC et ton n° de TVA intracommunautaire.',
      'CGI, annexe II, art. 242 nonies A'));
  }
  if (margeAppliquee(p)) {
    out.push(R('marge', 'TVA due sur ta marge (prix de vente − prix d\'achat), pas sur le prix de vente.',
      'CGI, art. 297 A'));
    out.push(R('marge_facture', 'Tes factures n\'affichent pas la TVA et portent « Régime particulier – Biens d\'occasion ».',
      'CGI, art. 297 E ; annexe II, art. 242 nonies A'));
    if (p.forme === 'micro') {
      out.push(R('marge_micro', 'La TVA sur la marge se déclare à part : VRM ne la calcule pas pour une micro-entreprise.',
        'limite de VRM'));
    }
  }
  if (p.forme === 'micro') {
    const t = Number(tauxUrssaf);
    out.push(R('urssaf', `Tu déclares ton chiffre d'affaires (pas ton bénéfice) à l'URSSAF ; VRM applique ton taux${isFinite(t) && t > 0 ? ` de ${String(t).replace('.', ',')} %` : ''}.`,
      'autoentrepreneur.urssaf.fr'));
    out.push(R('urssaf_repere', 'Repère 2026, vente de marchandises : 12,3 % de cotisations, + 1 % avec le versement libératoire.',
      'autoentrepreneur.urssaf.fr ; CGI, art. 151-0'));
    if (p.vl === true) {
      out.push(R('vl', 'L\'impôt sur le revenu de cette activité est payé avec tes cotisations, en % du chiffre d\'affaires.',
        'CGI, art. 151-0'));
    } else if (p.vl === false) {
      out.push(R('sans_vl', 'Sans versement libératoire, ce revenu s\'ajoute à ta déclaration de revenus annuelle.',
        'CGI, art. 50-0'));
    }
  }
  if (p.forme === 'ei_reel' || p.forme === 'societe') {
    out.push(R('reel', 'Tes cotisations et ton impôt ne sont pas un % du chiffre d\'affaires : VRM ne les estime pas.',
      'limite de VRM'));
  }
  if (estEI(p)) {
    out.push(R('ei', 'Ton nom est suivi de « EI » sur tes factures.',
      'loi n° 2022-172 du 14 février 2022 ; décret n° 2022-725'));
  }
  if (p.forme === 'societe') {
    out.push(R('societe', 'Tes factures portent ta forme (SAS, SARL…), ton capital et la ville de ton RCS.',
      'code de commerce, art. R123-237'));
  }
  return out;
}

// ── CE QU'IL MANQUE POUR ÉMETTRE UNE FACTURE ───────────────────────────────
// Une facture se fait PARFAITEMENT ou pas du tout : sans régime de TVA, l'app ne
// saurait pas quelle mention écrire, et une mention fausse sur un document légal
// est pire qu'un bouton grisé avec sa raison.
// Chaque manque dit AUSSI s'il est une COORDONNÉE (nom, adresse, numéros…) ou
// un choix de régime : l'en-tête « Coordonnées sur tes factures · N à
// compléter » ne compte que les coordonnées (16 octobre : il comptait « ton
// régime de TVA », qui n'en est pas une).
export function manquePourFacturerDetaille(p, { tauxTva } = {}) {
  const m = [];
  const M = (texte, coord) => m.push({ texte, coord: !!coord });
  if (!p) { M('ton profil d\'entreprise', false); return m; }
  if (!p.forme) M('ta forme d\'entreprise', false);
  if (!p.tva) M('ton régime de TVA', false);
  if (!p.nom) M(p.forme === 'societe' ? 'ta raison sociale' : 'ton nom', true);
  if (!p.adresse || !p.cp || !p.ville) M('ton adresse complète', true);
  if (etatSiren(p.siren) !== 'ok') M('ton SIREN', true);
  if (p.siret && etatSiret(p.siret, p.siren) !== 'ok') M('un SIRET valide (ou laisse-le vide)', true);
  if (p.tva === 'assujetti') {
    const e = etatTvaIntra(p.tvaIntra, p.siren);
    if (e !== 'ok' && e !== 'ok_non_verifie') M('ton n° de TVA intracommunautaire', true);
    if (p.marge === null) M('si tu appliques le régime de la marge', false);
    if (p.marge === false) { const t = Number(tauxTva); if (!(isFinite(t) && t > 0 && t <= 30)) M('ton taux de TVA', false); }
  }
  if (p.forme === 'societe') {
    if (!p.formeJuridique) M('ta forme juridique (SAS, SARL…)', true);
    if (!p.capital) M('ton capital social', true);
    if (!p.rcs) M('la ville de ton RCS', true);
  }
  return m;
}
export function manquePourFacturer(p, opts) {
  return manquePourFacturerDetaille(p, opts).map((x) => x.texte);
}

// ── MENTIONS ET MONTANTS ───────────────────────────────────────────────────
export const MENTION_FRANCHISE = 'TVA non applicable, art. 293 B du CGI';
export const MENTION_MARGE = 'Régime particulier – Biens d\'occasion';
export function modeTva(p) {
  if (!p || !p.tva) return '';
  if (p.tva === 'franchise') return 'franchise';
  return margeAppliquee(p) ? 'marge' : 'normale';
}
export function mentionsLegales(p) {
  const mode = modeTva(p);
  if (mode === 'franchise') return [MENTION_FRANCHISE];
  if (mode === 'marge') return [MENTION_MARGE];
  return [];
}
// Le nom tel qu'il doit apparaître : « … EI » pour un entrepreneur individuel,
// sauf s'il l'a déjà écrit.
export function nomVendeur(p) {
  const n = String((p && p.nom) || '').trim();
  if (!n) return '';
  // « EI » déjà écrit, sous n'importe quelle ponctuation — « (EI) », « EI. »,
  // « EI, » : la regex d'avant n'acceptait que l'espace, et doublait le
  // suffixe (« Julie Exemple (EI) EI », vu sur l'aperçu ET figé sur la facture).
  if (estEI(p) && !/(^|[\s(,;:])EI([\s),;:.!]|$)|entrepreneur individuel/i.test(n)) return `${n} EI`;
  return n;
}
// Montants en CENTIMES ENTIERS, à partir du prix payé (TTC). Un seul arrondi.
//  · franchise : pas de TVA, HT = TTC ;
//  · marge     : la TVA n'apparaît pas (art. 297 E) — seul le TTC est écrit ;
//  · normale   : HT = TTC × 100 / (100 + taux), TVA = TTC − HT.
export function montantsDocument(ttcC, p, tauxTva) {
  const ttc = Math.round(Number(ttcC));
  if (!isFinite(ttc) || ttc <= 0) return null;
  const mode = modeTva(p);
  if (mode === 'franchise') return { mode, htC: ttc, tvaC: 0, ttcC: ttc, tauxTva: null };
  if (mode === 'marge') return { mode, htC: null, tvaC: null, ttcC: ttc, tauxTva: null };
  if (mode === 'normale') {
    const t = Number(tauxTva);
    if (!(isFinite(t) && t > 0 && t <= 30)) return null;
    const ht = Math.round(ttc * 100 / (100 + t));
    return { mode, htC: ht, tvaC: ttc - ht, ttcC: ttc, tauxTva: t };
  }
  return null;
}
export const eurosDe = (c) => (c == null || !isFinite(Number(c)) ? '' : (Number(c) / 100).toFixed(2).replace('.', ',') + ' €');
export const centimesDe = (v) => {
  const n = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.'));
  return isFinite(n) ? Math.round(n * 100) : NaN;
};

// ── LA NUMÉROTATION ────────────────────────────────────────────────────────
// Un document = une ligne `facture_{année}_{rang sur 6 chiffres}`. Factures et
// avoirs partagent LA MÊME suite (un avoir est une facture rectificative) : la
// continuité se lit d'un seul coup d'œil, et il n'y a qu'un compteur.
export const pad6 = (n) => String(n).padStart(6, '0');
export const idDocument = (annee, rang) => `facture_${annee}_${pad6(rang)}`;
export const numeroDocument = (annee, rang) => `${annee}-${pad6(rang)}`;
export function lireIdDocument(id) {
  const m = /^facture_(\d{4})_(\d{6})$/.exec(String(id || ''));
  return m ? { annee: Number(m[1]), rang: Number(m[2]) } : null;
}
// `reserves` : des rangs que la suite ne doit JAMAIS redonner — ceux des
// anciennes factures (`vinted_invoices`, numéros « AAAA-NNNNNN » d'avant la
// suite). Sans eux, la nouvelle suite repartait à 2026-000001 alors qu'une
// ancienne facture portait déjà ce numéro : deux factures, un numéro, la même
// année (16 octobre).
export function prochainRang(ids, annee, reserves) {
  let max = 0;
  for (const id of ids || []) { const l = lireIdDocument(id); if (l && l.annee === annee && l.rang > max) max = l.rang; }
  for (const r of reserves || []) { const n = Number(r); if (isFinite(n) && n > max) max = n; }
  return max + 1;
}
// Les rangs portés par les anciennes factures d'une année. On ne lit que la
// FORME « AAAA-NNN… » : un ancien numéro libre (« FA-2026-0007 », vide…) ne
// réserve rien — mieux vaut un rang de trop que deviner.
export function rangsReserves(anciennes, annee) {
  const out = [];
  for (const i of anciennes || []) {
    const m = /^(\d{4})\s*-\s*(\d{1,6})$/.exec(String((i && i.number) || '').trim());
    if (m && Number(m[1]) === annee) out.push(Number(m[2]));
  }
  return out;
}
// La continuité, année par année : { annee, n, max, manquants:[rangs] }.
export function continuite(ids) {
  const parAn = new Map();
  for (const id of ids || []) {
    const l = lireIdDocument(id); if (!l) continue;
    if (!parAn.has(l.annee)) parAn.set(l.annee, new Set());
    parAn.get(l.annee).add(l.rang);
  }
  return [...parAn.entries()].sort((a, b) => a[0] - b[0]).map(([annee, set]) => {
    const max = Math.max(...set);
    const manquants = []; for (let r = 1; r <= max; r++) if (!set.has(r)) manquants.push(r);
    return { annee, n: set.size, max, manquants };
  });
}
const _anFmt = typeof Intl !== 'undefined' ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }) : null;
// La date du jour À PARIS (une facture émise à 00 h 30 le 1er janvier est de la
// nouvelle année, même sur un serveur en UTC).
export function jourParis(d = new Date()) {
  try { return _anFmt.format(d); } catch (_) { return new Date(d).toISOString().slice(0, 10); }
}
export const anneeParis = (d = new Date()) => Number(jourParis(d).slice(0, 4));

// ── LE DOCUMENT, FIGÉ À L'ÉMISSION ─────────────────────────────────────────
// Tout ce qu'il faut pour le réimprimer à l'identique, des années plus tard,
// même si le profil a changé depuis : le vendeur, le régime, les mentions et
// les montants sont COPIÉS dedans. Rien n'est relu ailleurs à l'impression.
export function construireDocument(o) {
  const p = o.profil || {};
  const erreurs = [];
  const type = o.type === 'avoir' ? 'avoir' : 'facture';
  const mt = montantsDocument(o.ttcC, p, o.tauxTva);
  if (!mt) erreurs.push('montant');
  const designation = String((o.designation || '')).trim().slice(0, 200);
  if (!designation) erreurs.push('designation');
  if (type === 'avoir' && !o.origineNumero) erreurs.push('origine');
  // L'identité du CLIENT fait partie des mentions d'une facture (art. 242
  // nonies A : nom du client — texte non ouvert d'ici, recoupé en secondaire).
  // Sans nom ni email, le document imprimait « Client » à la place du nom
  // (16 octobre) : une facture se fait parfaitement ou pas du tout.
  const cNom = String((o.client && o.client.nom) || '').trim();
  const cEmail = String((o.client && o.client.email) || '').trim();
  if (type === 'facture' && !cNom && !cEmail) erreurs.push('client');
  const manque = manquePourFacturer(p, { tauxTva: o.tauxTva });
  if (manque.length) erreurs.push('profil');
  if (erreurs.length) return { doc: null, erreurs, manque };
  const doc = {
    v: 1, type,
    numero: numeroDocument(o.annee, o.rang), annee: o.annee, rang: o.rang,
    emiseLe: o.emiseLe, jour: jourParis(new Date(o.emiseLe)),
    dateVente: String(o.dateVente || '').slice(0, 10),
    mode: mt.mode, htC: mt.htC, tvaC: mt.tvaC, ttcC: mt.ttcC, tauxTva: mt.tauxTva,
    vendeur: {
      nom: nomVendeur(p), forme: p.forme, formeLibelle: FORMES[p.forme] || '',
      formeJuridique: p.formeJuridique || '', capital: p.capital || '', rcs: p.rcs || '',
      adresse: p.adresse, cp: p.cp, ville: p.ville,
      siren: p.siren, siret: p.siret || '', tvaIntra: p.tva === 'assujetti' ? (p.tvaIntra || '') : '',
    },
    client: {
      nom: String((o.client && o.client.nom) || '').trim().slice(0, 160),
      email: String((o.client && o.client.email) || '').trim().slice(0, 200),
      adresse: String((o.client && o.client.adresse) || '').trim().slice(0, 300),
    },
    lignes: [{ designation, quantite: 1, ttcC: mt.ttcC, refPaire: String(o.refPaire || '').slice(0, 40), transaction: String(o.transaction || '').slice(0, 40) }],
    mentions: mentionsLegales(p),
    origineNumero: type === 'avoir' ? String(o.origineNumero) : '',
    origineJour: type === 'avoir' ? String(o.origineJour || '') : '',
    motif: type === 'avoir' ? String(o.motif || '').trim().slice(0, 200) : '',
    sourceId: String(o.sourceId || '').slice(0, 120),
    jeton: String(o.jeton || '').slice(0, 64),
    creeVia: o.creeVia === 'serveur' ? 'serveur' : 'app',
    piedDePage: String(o.piedDePage || '').trim().slice(0, 300),
  };
  return { doc, erreurs: [], manque: [] };
}

// Une écriture JSON STABLE (clés triées) : la même donnée donne toujours le
// même texte, donc la même empreinte.
export function canonique(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return '[' + v.map(canonique).join(',') + ']';
  return '{' + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + canonique(v[k])).join(',') + '}';
}
// L'empreinte SHA-256 du document (sans le champ `empreinte`). Elle est rangée
// avec lui : si quelqu'un réécrit la ligne en base, elle ne correspond plus, et
// l'écran le dit. Rend '' si l'environnement n'a pas `crypto.subtle`.
// ⚠️ Les marques posées par un LECTEUR (`_id`, et tout champ qui commence par
//    « _ ») ne font pas partie du document : vu au rendu le 15 octobre, l'écran
//    ajoutait `_id` à la lecture et chaque facture se disait « modifiée depuis
//    l'émission » — une fausse alerte sur un document légal.
export async function empreinte(doc) {
  try {
    const reste = {};
    for (const [k, v] of Object.entries(doc || {})) if (k !== 'empreinte' && !k.startsWith('_')) reste[k] = v;
    const octets = new TextEncoder().encode(canonique(reste));
    const h = await globalThis.crypto.subtle.digest('SHA-256', octets);
    return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (_) { return ''; }
}
export async function empreinteIntacte(doc) {
  if (!doc || !doc.empreinte) return null;
  const e = await empreinte(doc);
  return e ? e === doc.empreinte : null;
}

// Ce qu'il reste à créditer sur chaque facture : { [numero]: { ttcC, avoirsC, resteC, avoirs:[numeros] } }.
export function etatAvoirs(docs) {
  const out = {};
  for (const d of docs || []) if (d && d.type === 'facture') out[d.numero] = { ttcC: d.ttcC, avoirsC: 0, resteC: d.ttcC, avoirs: [] };
  for (const d of docs || []) {
    if (!d || d.type !== 'avoir' || !out[d.origineNumero]) continue;
    const e = out[d.origineNumero];
    e.avoirsC += d.ttcC; e.resteC = e.ttcC - e.avoirsC; e.avoirs.push(d.numero);
  }
  return out;
}

// ── L'ÉMISSION : UN NUMÉRO, UNE LIGNE, JAMAIS DEUX FOIS ────────────────────
// La même boucle pour l'app et le serveur ; seules les lectures/écritures
// changent (on les lui passe). `inserer` rend :
//   'ok'        la ligne est créée ;
//   'pris'      un autre appareil a pris ce numéro (insertion ignorée) ;
//   'incertain' pas de réponse : on cherche le jeton avant de réessayer ;
//   'refus'     la base a refusé (droits, panne) : on s'arrête.
// `lireIds` rend la liste des identifiants de l'année, ou `null` = pas su (on
// n'émet RIEN sur une lecture ratée : un rang calculé sur une liste incomplète
// donnerait un numéro déjà émis).
// `jeton` (16 octobre) : un jeton STABLE posé par l'appelant — le même d'un
// clic à l'autre du même formulaire, le même entre deux traitements du même
// email. Un document déjà écrit sous ce jeton EST cette émission : on le rend
// (`deja: true`), on ne réémet jamais. Avant, chaque clic tirait un jeton
// neuf : après « la base n'a pas confirmé l'écriture », un second clic créait
// une 2e facture pour la même vente. `null` au jeton = pas su ⇒ rien n'est
// émis (raison `lecture`). Le contrôle tourne à CHAQUE tour de boucle : deux
// porteurs du même jeton (deux traitements simultanés du même email) ne
// peuvent pas écrire deux documents.
// `reserves` : rangs interdits (anciennes factures) — voir `prochainRang`.
export async function emettre({ annee, jeton, reserves, preparer, lireIds, inserer, trouverParJeton, essais = 5 }) {
  for (let i = 0; i < essais; i++) {
    if (jeton && trouverParJeton) {
      const t = await trouverParJeton(jeton);
      if (t === null || t === undefined) return { ok: false, raison: 'lecture' };
      if (t) return { ok: true, doc: t, deja: true };
    }
    const ids = await lireIds(annee);
    if (ids === null || ids === undefined) return { ok: false, raison: 'lecture' };
    const rang = prochainRang(ids, annee, reserves);
    const doc = await preparer(rang);
    if (!doc) return { ok: false, raison: 'document' };
    const r = await inserer(idDocument(annee, rang), doc);
    if (r === 'ok') return { ok: true, doc };
    if (r === 'pris') continue;
    if (r === 'incertain') {
      const trouve = trouverParJeton ? await trouverParJeton(doc.jeton) : null;
      if (trouve === null || trouve === undefined) return { ok: false, raison: 'incertain', doc };
      if (trouve) return { ok: true, doc: trouve };
      continue;   // lu, absent : rien n'a été écrit, on peut réessayer
    }
    return { ok: false, raison: 'refus' };
  }
  return { ok: false, raison: 'concurrence' };
}

// ── LE DOCUMENT IMPRIMABLE ─────────────────────────────────────────────────
// Un fragment HTML (sans <html>) : l'app l'enveloppe dans une page imprimable
// (avec sa politique de sécurité), le serveur l'envoie tel quel par email.
// Tout ce qui vient de l'acheteur ou du vendeur est ÉCHAPPÉ.
const h = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const jourFr = (j) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(j || '')); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
export function corpsHtmlDocument(doc, { logoSrc } = {}) {
  if (!doc) return '';
  const v = doc.vendeur || {}, c = doc.client || {};
  const avoir = doc.type === 'avoir';
  const signe = avoir ? '−' : '';
  const ligne = (doc.lignes && doc.lignes[0]) || {};
  const adresseV = [v.adresse, [v.cp, v.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const identite = [];
  if (v.forme === 'societe') {
    const cap = v.capital ? ` au capital de ${h(v.capital)}${/€|eur/i.test(v.capital) ? '' : ' €'}` : '';
    identite.push(`${h(v.formeJuridique)}${cap}`);
    if (v.rcs) identite.push(`RCS ${h(v.rcs)} ${h(v.siren)}`);
  }
  identite.push(`SIREN ${h(v.siren)}${v.siret ? ` · SIRET ${h(v.siret)}` : ''}`);
  if (v.tvaIntra) identite.push(`N° TVA ${h(v.tvaIntra)}`);
  const lignesTotaux = [];
  if (doc.mode === 'normale') {
    lignesTotaux.push(['Total HT', signe + eurosDe(doc.htC)]);
    lignesTotaux.push([`TVA ${String(doc.tauxTva).replace('.', ',')} %`, signe + eurosDe(doc.tvaC)]);
    lignesTotaux.push(['Total TTC', signe + eurosDe(doc.ttcC)]);
  } else {
    lignesTotaux.push([avoir ? 'Montant de l\'avoir' : 'Total', signe + eurosDe(doc.ttcC)]);
  }
  const puLibelle = doc.mode === 'normale' ? 'Prix unitaire TTC' : 'Prix';
  return `<div class="vrm-doc" style="font-family:Arial,Helvetica,sans-serif;color:#1b1f24;max-width:760px;margin:0 auto;padding:28px;background:#fff">`
    + `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:26px">`
    + `<div>${logoSrc ? `<img src="${h(logoSrc)}" alt="" style="max-height:70px;max-width:160px;margin-bottom:10px;display:block"/>` : ''}`
    + `<div style="font-size:15px;font-weight:700">${h(v.nom)}</div>`
    + `<div style="font-size:12px;color:#555;line-height:1.5">${h(adresseV)}<br>${identite.join('<br>')}</div></div>`
    + `<div style="text-align:right"><div style="font-size:26px;font-weight:800;letter-spacing:.5px">${avoir ? 'AVOIR' : 'FACTURE'}</div>`
    + `<div style="font-size:13px;color:#555;margin-top:4px">N° ${h(doc.numero)}</div>`
    + `<div style="font-size:13px;color:#555">Émise le ${h(jourFr(doc.jour))}</div>`
    + (doc.dateVente ? `<div style="font-size:13px;color:#555">Date de la vente : ${h(jourFr(doc.dateVente))}</div>` : '')
    + (avoir ? `<div style="font-size:13px;color:#555">Sur la facture N° ${h(doc.origineNumero)}${doc.origineJour ? ` du ${h(jourFr(doc.origineJour))}` : ''}</div>` : '')
    + `</div></div>`
    + `<div style="margin-bottom:22px;font-size:13px;line-height:1.5"><div style="font-size:11px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:.06em">Client</div>`
    // Un document d'AVANT l'exigence du client peut n'avoir ni nom ni email :
    // « (non renseigné) », jamais le mot « Client » répété sous son titre de
    // rubrique (« Client Client », vu sur un avoir le 16 octobre).
    + `<b>${h(c.nom || c.email || '(non renseigné)')}</b>${c.adresse ? '<br>' + h(c.adresse) : ''}${c.email && c.nom ? '<br>' + h(c.email) : ''}</div>`
    + `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px"><thead><tr style="background:#f3f4f6">`
    + `<th style="text-align:left;padding:9px">Désignation</th><th style="text-align:right;padding:9px">Qté</th><th style="text-align:right;padding:9px">${puLibelle}</th></tr></thead>`
    + `<tbody><tr><td style="padding:9px;border-bottom:1px solid #e5e7eb">${h(ligne.designation)}${ligne.refPaire ? `<div style="font-size:11px;color:#777">Réf. ${h(ligne.refPaire)}</div>` : ''}${ligne.transaction ? `<div style="font-size:11px;color:#777">Transaction ${h(ligne.transaction)}</div>` : ''}</td>`
    + `<td style="padding:9px;text-align:right;border-bottom:1px solid #e5e7eb">1</td><td style="padding:9px;text-align:right;border-bottom:1px solid #e5e7eb">${signe}${eurosDe(ligne.ttcC)}</td></tr></tbody></table>`
    + `<table style="margin-left:auto;font-size:13px;min-width:240px">${lignesTotaux.map(([k, val], i) => `<tr><td style="padding:4px 10px;${i === lignesTotaux.length - 1 ? 'font-weight:700;border-top:1px solid #d1d5db' : ''}">${h(k)}</td><td style="padding:4px 10px;text-align:right;${i === lignesTotaux.length - 1 ? 'font-weight:700;border-top:1px solid #d1d5db' : ''}">${h(val)}</td></tr>`).join('')}</table>`
    + (doc.mentions && doc.mentions.length ? `<div style="margin-top:14px;font-size:12px;color:#444">${doc.mentions.map(h).join('<br>')}</div>` : '')
    + (avoir && doc.motif ? `<div style="margin-top:10px;font-size:12px;color:#444">Motif : ${h(doc.motif)}</div>` : '')
    + (!avoir ? `<div style="margin-top:10px;font-size:12px;color:#444">Facture acquittée.</div>` : '')
    + (doc.piedDePage ? `<div style="margin-top:22px;font-size:11px;color:#777">${h(doc.piedDePage)}</div>` : '')
    + `</div>`;
}
