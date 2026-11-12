// ═══════════════════════════════════════════════════════════════════════════
// LE LIVRE DES RECETTES ET LE REGISTRE DES ACHATS, CONFORMES (11 nov., lot
// `livre-registre`) — Argent → Déclarer → « Registres »
// ═══════════════════════════════════════════════════════════════════════════
// Julien (validé) : les deux registres d'un micro-entrepreneur en achat-revente,
// chaque mention obligatoire présente, à l'écran (par mois, filtrable) et en
// PDF + CSV + XLSX horodatés pour un contrôle.
//
// AUCUNE RÈGLE DE VENTE NI D'ACHAT ICI (§5 « une seule règle par notion ») :
// ce module COMPLÈTE les lignes de `livreDesRecettes` / `registreDesAchats`
// (src/registres.js, elles-mêmes les lignes de `ventesDeclarables` : datées au
// VERSEMENT, comptes exclus dehors, « à dater » à part). Il ajoute à chaque
// ligne les mentions que la loi demande, LUES par identité, jamais devinées :
//   · client     : le nom d'une FACTURE PRO émise pour CETTE vente (n° de
//                  transaction / référence) ; sinon le PSEUDO de l'acheteur
//                  (sa transaction lue côté vendeur) ; sinon « Particulier »
//                  (la demande de Julien : « identité du client si connue sinon
//                  particulier »). Jamais un nom hors facture Pro (données
//                  personnelles minimales).
//   · fournisseur: le pseudo du vendeur Vinted (sa transaction lue côté
//                  acheteur) ; sinon « Particulier (Vinted) » ; hors plateforme
//                  et en gros : ce qu'IL a saisi.
//   · nature     : « Vente » / « Achat » + l'article (son titre lu), jamais
//                  inventé ; sans titre, la nature reste (« vente de
//                  marchandise ») et le manque est compté.
//   · règlement  : « Paiement via <plateforme> » quand l'argent est passé par
//                  la plateforme (jamais des espèces) ; sinon VIDE et nommé
//                  (« mode de paiement à écrire »).
//   · pièce      : facture Pro · facture d'achat jointe (PDF ou photo du
//                  ticket) · reçu Vinted (e-mail relié par SON n° de
//                  transaction) · la référence de la transaction ; rien ⇒ vide
//                  et nommé.
// Un manque est NOMMÉ avec son geste (« 12 achats sans prix ⇒ compléter ») ;
// une ligne incomplète reste dans le registre (on ne jette rien).
// Jamais « encaissé » (§5), jamais « conforme » affirmé : les sources n'ont pas
// pu être ouvertes depuis la session ⇒ « à vérifier ».
// ─────────────────────────────────────────────────────────────────────────────
import { libellePeriode, jourFr, eurosTexte, moisDePeriode } from './registres.js';
import { cleFactureLigne } from './factureAchat.js';
import { especesDe } from './modePaiement.js';
import { motsVendeur } from './profilVendeur.js';   // (intégration g1) « paire » seulement pour un vendeur Sneakers

// ── LES SOURCES OFFICIELLES ─────────────────────────────────────────────────
// ⚠️ Le 11 nov. 2026, AUCUNE de ces pages n'a pu être ouverte depuis la session
// (Légifrance, BOFiP, service-public : réseau fermé, 403 / nom introuvable).
// Les mentions viennent des extraits rendus par une recherche (fiche F36018,
// décret 2008-1405 créant D. 123-205-1, BOFiP sur l'art. 50-0) — donc
// `verifie: false` : l'écran et les fichiers disent « à vérifier » à côté de
// chaque source. Une source ouverte et relue ⇒ `verifie: 'AAAA-MM-JJ'`.
export const SOURCES = Object.freeze({
  cgi: Object.freeze({ id: 'cgi', nom: 'CGI, art. 50-0, 5', texte: 'livre-journal servi au jour le jour, détail des recettes, appuyé des factures et pièces justificatives ; registre récapitulé par année du détail des achats (vente de marchandises)', url: 'https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006069577', verifie: false }),
  l123: Object.freeze({ id: 'l123', nom: 'Code de commerce, art. L. 123-28', texte: 'livre des recettes ; registre récapitulé par année des achats pour la vente de marchandises', url: 'https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000005634379', verifie: false }),
  d123: Object.freeze({ id: 'd123', nom: 'Code de commerce, art. D. 123-205-1 (décret 2008-1405)', texte: 'chronologique ; montant et origine ; règlements en espèces distingués ; références des pièces justificatives', url: 'https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000005634379', verifie: false }),
  bofip: Object.freeze({ id: 'bofip', nom: 'BOFiP, micro-entreprises : obligations comptables', texte: 'livre présenté sur demande ; montants totalisés à la fin du trimestre et de l’année', url: 'https://bofip.impots.gouv.fr/doctrine/pgp/2834-PGP', verifie: false }),
  sp: Object.freeze({ id: 'sp', nom: 'Service-public, fiche F36018', texte: 'recettes : date, référence de la pièce, client, nature, montant, mode de paiement ; achats : date, pièce, fournisseur, nature, montant, mode de paiement', url: 'https://entreprendre.service-public.gouv.fr/vosdroits/F36018', verifie: false }),
});
export const etatSource = (s) => (s && s.verifie ? `vérifiée le ${s.verifie}` : 'à vérifier');

// Chaque obligation : la mention, le champ de la ligne, ses sources.
export const OBLIGATIONS = Object.freeze({
  recettes: Object.freeze([
    { cle: 'date', nom: 'Date (ordre chronologique)', sources: ['cgi', 'd123', 'sp'] },
    { cle: 'client', nom: 'Client (identité, sinon « particulier »)', sources: ['sp'] },
    { cle: 'nature', nom: 'Nature de la vente', sources: ['sp'] },
    { cle: 'montant', nom: 'Montant', sources: ['cgi', 'd123', 'sp'] },
    { cle: 'reglement', nom: 'Mode de règlement (espèces distinguées)', sources: ['d123', 'sp'] },
    { cle: 'piece', nom: 'Référence de la pièce justificative', sources: ['cgi', 'd123', 'sp'] },
    { cle: 'totaux', nom: 'Totaux par trimestre et par année', sources: ['bofip'] },
  ].map(Object.freeze)),
  achats: Object.freeze([
    { cle: 'date', nom: 'Date', sources: ['d123', 'sp'] },
    { cle: 'fournisseur', nom: 'Fournisseur', sources: ['sp'] },
    { cle: 'nature', nom: 'Nature de l’achat', sources: ['sp'] },
    { cle: 'montant', nom: 'Montant', sources: ['cgi', 'l123', 'd123', 'sp'] },
    { cle: 'reglement', nom: 'Mode de paiement (espèces distinguées)', sources: ['d123', 'sp'] },
    { cle: 'piece', nom: 'Référence de la pièce justificative', sources: ['d123', 'sp'] },
    { cle: 'totaux', nom: 'Récapitulé par année', sources: ['cgi', 'l123'] },
  ].map(Object.freeze)),
});

// ── LES PSEUDOS (transaction Vinted lue en projection) ──────────────────────
// r = { side, vendeur, acheteur } ; le pseudo de l'AUTRE partie seulement quand
// la transaction est lue du bon côté (un achat entre ses propres comptes lu côté
// vendeur porterait son propre pseudo).
const pseudoPropre = (p) => { const s = String(p == null ? '' : p).trim(); return s && s.length <= 80 ? s : ''; };
export const pseudoClientTx = (r) => (r && r.side === 'seller' ? pseudoPropre(r.acheteur) : '');
export const pseudoFournisseurTx = (r) => (r && r.side === 'buyer' ? pseudoPropre(r.vendeur) : '');
export const SELECT_PSEUDOS = 'id,tx:data->payload->transaction->>id,side:data->payload->transaction->>user_side,vendeur:data->payload->transaction->seller->>login,acheteur:data->payload->transaction->buyer->>login';
// Les ids `harvest_{uid}_txn_{tx}` des lignes Vinted (uid et n° en chiffres seulement).
export const idsTxLignes = (lignes) => {
  const out = new Set();
  for (const l of (Array.isArray(lignes) ? lignes : [])) {
    if (!l || l.plateforme !== 'Vinted') continue;
    const tx = String(l.reference || ''), u = String(l.uid || '');
    if (/^\d+$/.test(tx) && /^\d+$/.test(u)) out.add(`harvest_${u}_txn_${tx}`);
  }
  return [...out];
};
// Lit les pseudos par lots de 100 (projection, jamais `select=data`). Map tx → { client, fournisseur } ; null = pas lu.
export async function lirePseudosTx(ids, { lireTout }) {
  const out = new Map();
  const liste = [...new Set(Array.isArray(ids) ? ids : [])];
  for (let i = 0; i < liste.length; i += 100) {
    const lot = liste.slice(i, i + 100);
    let rows = null;
    try { rows = await lireTout(`id=in.(${lot.join(',')})&select=${SELECT_PSEUDOS}`, { strict: true }); } catch (_) { rows = null; }
    if (!Array.isArray(rows)) return null;
    for (const r of rows) {
      if (!r || !lot.includes(r.id)) continue;
      const tx = String(r.tx || String(r.id).split('_txn_')[1] || '');
      if (!tx) continue;
      const c = pseudoClientTx(r), f = pseudoFournisseurTx(r);
      if (c || f) out.set(tx, { client: c, fournisseur: f });
    }
  }
  return out;
}

// ── LES FACTURES PRO (identité de la vente) ─────────────────────────────────
// Lecture PROJETÉE : le n°, le nom du client, l'identité de la vente. Une facture
// annulée par un avoir, ou un avoir, n'est jamais la pièce d'une recette.
export const SELECT_FACTURES_REGISTRE = 'id,numero:data->>number,type:data->>type,annuleePar:data->>annuleePar,transaction:data->>transaction,plateforme:data->>plateforme,reference:data->>reference,acheteur:data->contenu->acheteur->>nom';
const PREFIXE_VENTE = { leboncoin: 'lbc:', ebay: 'ebay:', vestiaire: 'vestiaire:' };
export function facturesParVente(rows) {
  if (!Array.isArray(rows)) return null;
  const m = new Map();
  for (const x of rows) {
    if (!x || !String(x.numero || '').trim()) continue;
    if (x.type === 'avoir_pro' || /^email_invoice_av/.test(String(x.id || '')) || String(x.annuleePar || '').trim()) continue;
    const p = String(x.plateforme || '').toLowerCase();
    const id = PREFIXE_VENTE[p] && String(x.reference || '').trim() ? PREFIXE_VENTE[p] + String(x.reference).trim()
      : (!p && /^\d+$/.test(String(x.transaction || '')) ? 'vinted:' + x.transaction : '');
    if (!id) continue;
    if (m.has(id)) { m.set(id, { ...m.get(id), double: true }); continue; }   // deux factures pour une vente : aucune n'est choisie
    m.set(id, { numero: String(x.numero).trim(), client: String(x.acheteur || '').trim() });
  }
  for (const [k, v] of m) if (v.double) m.delete(k);
  return m;
}

// ── LES MENTIONS D'UNE LIGNE ────────────────────────────────────────────────
const NOM_PIECE_VENTE = { Vinted: 'Transaction Vinted', Leboncoin: 'Vente Leboncoin', eBay: 'Commande eBay', Vestiaire: 'Vente Vestiaire' };
const PLATEFORMES_PAIEMENT = new Set(['Vinted', 'Leboncoin', 'eBay', 'Vestiaire']);
const reglementPlateforme = (p) => (PLATEFORMES_PAIEMENT.has(p) ? `Paiement via ${p}` : '');

// recettes : la sortie de `livreDesRecettes` ; null ⇒ null.
// pseudos : Map tx → { client } | null (pas lu) ; factures : `facturesParVente` | null
export function completerRecettes(R, { pseudos = null, factures = null } = {}) {
  if (!R || R.type !== 'recettes') return null;
  const une = (l) => {
    const f = factures && factures.get(String(l.id));
    const ps = pseudos && l.plateforme === 'Vinted' ? pseudos.get(String(l.reference)) : null;
    const client = f && f.client ? f.client : ps && ps.client ? ps.client : 'Particulier';
    const clientSource = f && f.client ? 'facture' : ps && ps.client ? 'pseudo' : 'defaut';
    const titre = String(l.titre || '').trim();
    const nature = titre ? `Vente · ${titre}` : 'Vente de marchandise';
    const reglement = reglementPlateforme(l.plateforme);
    const piece = f ? `Facture ${f.numero}` : (NOM_PIECE_VENTE[l.plateforme] && String(l.reference || '').trim() ? `${NOM_PIECE_VENTE[l.plateforme]} ${l.reference}` : '');
    const pieceType = f ? 'facture' : piece ? 'reference' : '';
    const especes = reglement ? 'Non' : '';
    const datee = DATEE.get(l.plateforme) || (l.date ? 'versement' : '');
    const manques = [];
    if (l.montant == null) manques.push('montant');
    if (!reglement) manques.push('reglement');
    if (!piece) manques.push('piece');
    if (!titre) manques.push('article');
    // Une recette DÉCLARÉE sans date de versement : dans le mois de sa déclaration, la date manque (dite).
    if (!l.date) manques.push('date');
    return { ...l, client, clientSource, nature, reglement, especes, piece, pieceType, datee, manques };
  };
  const lignes = R.lignes.map(une);
  const horsPeriode = R.horsPeriode.map((l) => { const x = une(l); return { ...x, manques: [...new Set(['date', ...x.manques])] }; });
  return { ...R, lignes, horsPeriode, pseudosLus: pseudos != null, facturesLues: factures != null };
}
// Ce que la date d'une recette EST (la règle de `ventesDeclarables`).
const DATEE = new Map([['Vinted', 'versement'], ['Vestiaire', 'versement'], ['Leboncoin', 'vente'], ['eBay', 'commande']]);

// achats : la sortie de `registreDesAchats` ; pseudos : Map tx → { fournisseur } | null ;
// recuDe(tx) : vrai si un reçu e-mail est relié à CETTE transaction ; facturesJointes : liste `lireFactures` | null
export function completerAchats(A, { pseudos = null, recuDe = () => false, facturesJointes = null } = {}) {
  if (!A || A.type !== 'achats') return null;
  const une = (l) => {
    const vinted = l.plateforme === 'Vinted';
    const ps = vinted && pseudos ? pseudos.get(String(l.reference)) : null;
    const fournisseur = vinted ? (ps && ps.fournisseur ? ps.fournisseur : 'Particulier (Vinted)') : String(l.fournisseur || '').trim();
    const fournisseurSource = vinted ? (ps && ps.fournisseur ? 'pseudo' : 'defaut') : (fournisseur ? 'saisi' : '');
    const titre = String(l.titre || '').trim();
    const nature = l.gros ? `Achat de marchandise · ${l.paires} ${Number(l.paires) > 1 ? motsVendeur().noms : motsVendeur().nom} en gros` : titre ? `Achat · ${titre}` : 'Achat de marchandise';
    // Hors plateforme et en gros : ce qu'IL a choisi (« Payé en »), sinon vide et nommé — jamais deviné.
    const reglement = vinted ? 'Paiement via Vinted' : String(l.reglement || '');
    const cf = cleFactureLigne(l);
    const fj = cf && facturesJointes ? facturesJointes[cf] : null;
    let piece = '', pieceType = '';
    if (fj) { pieceType = fj.type === 'image' ? 'ticket' : 'facture'; piece = `${fj.type === 'image' ? 'Photo du ticket' : 'Facture jointe'}${fj.nom ? ` (${fj.nom})` : ''}`; }
    else if (vinted && l.reference && recuDe(String(l.reference))) { pieceType = 'recu'; piece = `Reçu Vinted · transaction ${l.reference}`; }
    else if (vinted && l.reference) { pieceType = 'reference'; piece = `Transaction Vinted ${l.reference}`; }
    const manques = [];
    if (l.montant == null) manques.push('montant');
    if (!fournisseur) manques.push('fournisseur');
    if (!reglement) manques.push('reglement');
    if (!piece) manques.push('piece');
    return { ...l, fournisseur, fournisseurSource, nature, reglement, especes: vinted ? 'Non' : especesDe(l.paiement), piece, pieceType, manques };
  };
  const lignes = A.lignes.map(une);
  const horsPeriode = A.horsPeriode.map((l) => ({ ...une(l), manques: [...new Set(['date', ...une(l).manques])] }));
  return { ...A, lignes, horsPeriode, pseudosLus: pseudos != null, facturesLues: facturesJointes != null };
}

// ── LES MANQUES NOMMÉS (avec leur geste) ────────────────────────────────────
// geste : 'achats' (écran Achats) · 'vinted' (ouvrir vinted.fr : dates de versement)
//         · 'fichier' (VRM ne le connaît pas : à écrire sur le registre exporté)
const pl = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
export function manquesNommes(R) {
  if (!R) return [];
  const out = [];
  const compte = (cle) => R.lignes.filter((l) => (l.manques || []).includes(cle)).length;
  if (R.type === 'recettes') {
    const aDater = R.horsPeriode.filter((l) => l.raison === 'à dater').length;
    const sansMontantHors = R.horsPeriode.length - aDater;
    if (aDater) out.push({ cle: 'a-dater', n: aDater, texte: `${pl(aDater, 'recette', 'recettes')} sans date de versement : dans aucun mois`, geste: 'vinted' });
    if (R.sansMontant + sansMontantHors) out.push({ cle: 'montant', n: R.sansMontant + sansMontantHors, texte: `${pl(R.sansMontant + sansMontantHors, 'recette', 'recettes')} sans montant lu`, geste: 'fichier' });
    const sd = compte('date'); if (sd) out.push({ cle: 'date', n: sd, texte: `${pl(sd, 'recette déclarée', 'recettes déclarées')} sans date de versement`, geste: 'vinted' });
    const reg = compte('reglement'); if (reg) out.push({ cle: 'reglement', n: reg, texte: `${pl(reg, 'recette', 'recettes')} sans mode de règlement`, geste: 'fichier' });
    const pc = compte('piece'); if (pc) out.push({ cle: 'piece', n: pc, texte: `${pl(pc, 'recette', 'recettes')} sans pièce justificative`, geste: 'fichier' });
    const ar = compte('article'); if (ar) out.push({ cle: 'article', n: ar, texte: `${pl(ar, 'recette', 'recettes')} sans le nom de l’article`, geste: '' });
    if (R.pseudosLus === false) out.push({ cle: 'pseudos', n: 0, texte: 'Pseudos des acheteurs pas lus : « Particulier » partout', geste: '' });
  } else {
    const sm = R.sansMontant; if (sm) out.push({ cle: 'montant', n: sm, texte: `${pl(sm, 'achat', 'achats')} sans prix`, geste: 'achats' });
    if (R.articleSeul) out.push({ cle: 'article-seul', n: R.articleSeul, texte: `${pl(R.articleSeul, 'achat', 'achats')} sans port ni frais lus`, geste: 'achats' });
    const fo = compte('fournisseur'); if (fo) out.push({ cle: 'fournisseur', n: fo, texte: `${pl(fo, 'achat', 'achats')} sans fournisseur`, geste: 'achats' });
    const reg = compte('reglement'); if (reg) out.push({ cle: 'reglement', n: reg, texte: `${pl(reg, 'achat', 'achats')} sans mode de paiement`, geste: 'achats' });
    const pc = compte('piece'); if (pc) out.push({ cle: 'piece', n: pc, texte: `${pl(pc, 'achat', 'achats')} sans pièce justificative`, geste: 'achats' });
    if (R.horsPeriode.length) out.push({ cle: 'sans-date', n: R.horsPeriode.length, texte: `${pl(R.horsPeriode.length, 'achat', 'achats')} sans date : dans aucun mois`, geste: 'achats' });
    if (R.pseudosLus === false) out.push({ cle: 'pseudos', n: 0, texte: 'Pseudos des vendeurs pas lus : « Particulier (Vinted) » partout', geste: '' });
  }
  for (const m of (R.manque || [])) out.push({ cle: 'pas-lu', n: 0, texte: `Pas lu : ${m}`, geste: '' });
  return out;
}

// ── À L'ÉCRAN : PAR MOIS, FILTRABLE ─────────────────────────────────────────
const ymDe = (t) => { const d = new Date(t); return t == null || isNaN(d) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const sommeCts = (ls) => ls.reduce((s, l) => s + (l.montant == null ? 0 : Math.round(l.montant * 100)), 0);
// Une recette « déclarée » sans date garde le mois de sa déclaration (`l.ym` de la règle) ; sinon le mois de sa date.
export function parMois(R) {
  if (!R) return [];
  const yms = moisDePeriode(R.periode);
  const g = new Map(yms.map((ym) => [ym, []]));
  for (const l of R.lignes) { const ym = l.ym || ymDe(l.ts) || ''; if (g.has(ym)) g.get(ym).push(l); }
  return yms.map((ym) => { const ls = g.get(ym); return { ym, libelle: libellePeriode(ym), lignes: ls, n: ls.length, total: sommeCts(ls) / 100, sansMontant: ls.filter((l) => l.montant == null).length }; });
}
// Totaux par trimestre et pour la période (BOFiP : totalisés fin de trimestre et d'année).
export function totauxPeriodes(R) {
  if (!R) return [];
  const mois = parMois(R);
  const out = [];
  const tri = new Map();
  for (const m of mois) { const t = `${m.ym.slice(0, 4)}-T${Math.floor((Number(m.ym.slice(5, 7)) - 1) / 3) + 1}`; const x = tri.get(t) || { n: 0, cts: 0, sansMontant: 0 }; x.n += m.n; x.cts += Math.round(m.total * 100); x.sansMontant += m.sansMontant; tri.set(t, x); }
  if (tri.size > 1 || /^\d{4}(-T[1-4])?$/.test(R.periode)) for (const [t, x] of tri) out.push({ cle: t, libelle: libellePeriode(t), n: x.n, total: x.cts / 100, partiel: x.sansMontant > 0 || !R.complet });
  out.push({ cle: R.periode, libelle: `Total ${libellePeriode(R.periode)}`, n: R.n, total: R.total, partiel: !R.complet });
  return out;
}
export const plateformesDe = (R) => (R ? [...new Set(R.lignes.map((l) => l.plateforme).filter(Boolean))].sort() : []);
const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function filtrerLignes(lignes, { plateforme = '', q = '', aCompleter = false } = {}) {
  const nq = norm(q).trim();
  return (Array.isArray(lignes) ? lignes : []).filter((l) => (!plateforme || l.plateforme === plateforme)
    && (!aCompleter || (l.manques || []).some((m) => m !== 'article'))
    && (!nq || [l.titre, l.num, l.piece, l.client, l.fournisseur, l.compte, l.reference].some((v) => norm(v).includes(nq))));
}

// ── L'HORODATAGE ────────────────────────────────────────────────────────────
const deux = (n) => String(n).padStart(2, '0');
export const horodatage = (maintenant = Date.now()) => { const d = new Date(maintenant); return `${jourFr(d)} à ${deux(d.getHours())}:${deux(d.getMinutes())}`; };
export const nomFichierConforme = (R, ext, maintenant = Date.now()) => {
  const d = new Date(maintenant);
  return `${R.type === 'recettes' ? 'Livre-des-recettes' : 'Registre-des-achats'}-${R.periode}-etabli-${d.getFullYear()}${deux(d.getMonth() + 1)}${deux(d.getDate())}-${deux(d.getHours())}${deux(d.getMinutes())}.${ext}`;
};
export const titreConforme = (R) => `${R.type === 'recettes' ? 'Livre des recettes' : 'Registre des achats'} — ${libellePeriode(R.periode)}`;

// ── LES COLONNES (une seule mise en page : écran, CSV, XLSX, PDF) ───────────
const DATEE_TXT = { versement: 'versement', vente: 'vente', commande: 'commande' };
export const COLONNES_CONFORMES = Object.freeze({
  recettes: [['date', 'Date', 52], ['datee', 'Datée au', 50], ['client', 'Client', 92], ['nature', 'Nature', 0], ['montant', 'Montant', 62, 1], ['reglement', 'Règlement', 92], ['especes', 'Espèces', 40], ['piece', 'Pièce justificative', 128], ['num', 'N°', 36], ['compte', 'Compte', 70]],
  // (intégration g1) l'en-tête suit le vocabulaire du vendeur (« Paires » pour Sneakers, sinon « Articles »).
  get achats() { return [['date', 'Date', 52], ['fournisseur', 'Fournisseur', 96], ['nature', 'Nature', 0], ['paires', motsVendeur().Noms, 34, 1], ['montant', 'Montant', 62, 1], ['frais', 'Dont frais', 50, 1], ['source', 'Montant lu', 58], ['reglement', 'Règlement', 88], ['especes', 'Espèces', 40], ['piece', 'Pièce justificative', 128], ['num', 'N°', 40]]; },
});
const SOURCE_MONTANT = { recu: 'Reçu', saisi: 'Saisi', article: 'Article seul' };
const MANQUE_TXT = { montant: 'montant', reglement: 'mode de règlement', piece: 'pièce', fournisseur: 'fournisseur', date: 'date', article: 'article' };
export const noteLigne = (l) => {
  const m = (l.manques || []).filter((x) => x !== 'article' && x !== 'date').map((x) => MANQUE_TXT[x]);
  return [l.raison || (!l.date && l.ym ? 'déclarée, date de versement pas lue' : ''), m.length ? `à compléter : ${m.join(', ')}` : ''].filter(Boolean).join(' · ');
};
const nb2 = (x) => (x == null || !Number.isFinite(Number(x)) ? '' : (Math.round(Number(x) * 100) / 100).toFixed(2).replace('.', ','));
export function valeurCellule(l, k, forme = 'texte') {
  if (k === 'montant' || k === 'frais') {
    const v = l[k];
    if (v == null) return forme === 'texte' ? (k === 'montant' ? '—' : '') : (forme === 'xlsx' ? null : '');
    return forme === 'xlsx' ? { n: Math.round(Number(v) * 100) / 100 } : forme === 'csv' ? nb2(v) : eurosTexte(v);
  }
  if (k === 'paires') return l.paires ? (forme === 'xlsx' ? { n: Number(l.paires) } : String(l.paires)) : '';
  if (k === 'source') return SOURCE_MONTANT[l.source] || '';
  if (k === 'datee') return DATEE_TXT[l.datee] || '';
  return String(l[k] == null ? '' : l[k]);
}

// L'en-tête d'un fichier : titre, entreprise, horodatage, totaux, manques, sources.
function enTete(R, { entreprise, maintenant }) {
  const L = [[titreConforme(R)]];
  if (entreprise && entreprise.nom) { L.push([entreprise.nom]); if (entreprise.siret) L.push([`SIRET ${entreprise.siret}`]); }
  L.push([`Établi le ${horodatage(maintenant)}`]);
  L.push([R.type === 'recettes' ? 'Recettes datées au versement (Vinted, Vestiaire), à la vente (Leboncoin), à la commande payée (eBay).' : 'Achats de marchandise, hors annulés et remboursés.']);
  return L;
}
const lignesTotaux = (R) => totauxPeriodes(R).map((t) => [t.libelle, `${t.partiel ? 'au moins ' : ''}${nb2(t.total)}`, `${t.n} ligne${t.n > 1 ? 's' : ''}`]);
const lignesSources = (R) => OBLIGATIONS[R.type].map((o) => [o.nom, o.sources.map((s) => `${SOURCES[s].nom} (${etatSource(SOURCES[s])})`).join(' ; ')]);

export function csvConforme(R, { entreprise = null, maintenant = Date.now() } = {}) {
  const e = (v) => { const s = String(v == null ? '' : v); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const cols = COLONNES_CONFORMES[R.type];
  const L = [...enTete(R, { entreprise, maintenant }), []];
  L.push(['Totaux']); for (const t of lignesTotaux(R)) L.push(t);
  const mq = manquesNommes(R); if (mq.length) { L.push([]); L.push(['À compléter']); for (const m of mq) L.push([m.texte]); }
  L.push([]);
  L.push([...cols.map((c) => c[1]), 'Note']);
  for (const l of R.lignes) L.push([...cols.map(([k]) => valeurCellule(l, k, 'csv')), noteLigne(l)]);
  L.push(['Total', ...cols.slice(1).map(([k]) => (k === 'montant' ? nb2(R.total) : '')), R.complet ? '' : 'au moins']);
  if (R.horsPeriode.length) {
    L.push([]); L.push([R.type === 'recettes' ? 'Dans aucun mois (à dater)' : 'Sans date']);
    L.push([...cols.map((c) => c[1]), 'Note']);
    for (const l of R.horsPeriode) L.push([...cols.map(([k]) => valeurCellule(l, k, 'csv')), noteLigne(l)]);
  }
  L.push([]); L.push(['Mentions obligatoires', 'Sources']); for (const s of lignesSources(R)) L.push(s);
  return '﻿' + L.map((r) => r.map(e).join(';')).join('\r\n') + '\r\n';
}

// Les feuilles du classeur (src/xlsxSimple.js) : Registre · À dater/Sans date · Totaux · Sources.
export function feuillesConformes(R, { entreprise = null, maintenant = Date.now() } = {}) {
  const cols = COLONNES_CONFORMES[R.type];
  const tete = [...cols.map((c) => ({ t: c[1], gras: true })), { t: 'Note', gras: true }];
  const corps = (ls) => ls.map((l) => [...cols.map(([k]) => valeurCellule(l, k, 'xlsx')), noteLigne(l)]);
  const iM = cols.findIndex((c) => c[0] === 'montant');
  const tot = cols.map((c, i) => (i === 0 ? { t: 'Total', gras: true } : i === iM ? { n: R.total } : ''));
  const F = [{ nom: R.type === 'recettes' ? 'Recettes' : 'Achats', entete: true, lignes: [tete, ...corps(R.lignes), [...tot, R.complet ? '' : 'au moins']], largeurs: cols.map((c) => (c[0] === 'nature' || c[0] === 'piece' ? 40 : c[0] === 'date' ? 12 : 16)) }];
  if (R.horsPeriode.length) F.push({ nom: R.type === 'recettes' ? 'À dater' : 'Sans date', entete: true, lignes: [tete, ...corps(R.horsPeriode)] });
  F.push({ nom: 'Totaux', lignes: [...enTete(R, { entreprise, maintenant }), [], [{ t: 'Période', gras: true }, { t: 'Total', gras: true }, { t: 'Lignes', gras: true }, { t: 'Note', gras: true }],
    ...totauxPeriodes(R).map((t) => [t.libelle, { n: t.total }, { n: t.n }, t.partiel ? 'au moins' : '']), [], [{ t: 'À compléter', gras: true }], ...manquesNommes(R).map((m) => [m.texte])], largeurs: [40, 14, 10, 12] });
  F.push({ nom: 'Sources', entete: true, lignes: [[{ t: 'Mention obligatoire', gras: true }, { t: 'Sources', gras: true }], ...lignesSources(R)], largeurs: [44, 120] });
  return F;
}

const A4P = [841.89, 595.28];
export async function pdfConforme(R, { PDFLib = null, entreprise = null, maintenant = Date.now() } = {}) {
  const PL = PDFLib || await import('pdf-lib');
  const { PDFDocument, StandardFonts, rgb } = PL;
  const doc = await PDFDocument.create();
  doc.setTitle(titreConforme(R));
  if (entreprise && entreprise.nom) doc.setAuthor(entreprise.nom);
  doc.setCreationDate(new Date(maintenant));
  const f = await doc.embedFont(StandardFonts.Helvetica), fb = await doc.embedFont(StandardFonts.HelveticaBold);
  const ENCRE = rgb(0.11, 0.11, 0.12), GRIS = rgb(0.42, 0.42, 0.45), FILET = rgb(0.86, 0.86, 0.88), AMBRE = rgb(0.62, 0.38, 0.02);
  const M = 32, [W, H] = A4P;
  const dessinable = (ch) => { try { f.encodeText(ch); return true; } catch (_) { return false; } };
  const propre = (s) => { let o = ''; for (const ch of String(s == null ? '' : s).replace(/[‘’]/g, "'").replace(/[   ]/g, ' ').replace(/−/g, '-').replace(/[—–]/g, '-').replace(/[\r\n\t]+/g, ' ')) o += dessinable(ch) ? ch : (dessinable(ch.normalize('NFD')[0]) ? ch.normalize('NFD')[0] : ''); return o; };
  const borne = (s, font, t, max) => { let x = propre(s); if (font.widthOfTextAtSize(x, t) <= max) return x; while (x.length > 1 && font.widthOfTextAtSize(x + '...', t) > max) x = x.slice(0, -1); return x + '...'; };
  let page = doc.addPage(A4P); let y = H - M; let nPage = 1;
  const pied = () => page.drawText(propre(`${titreConforme(R)} · établi le ${horodatage(maintenant)} · page ${nPage}`), { x: M, y: 16, size: 7, font: f, color: GRIS });
  pied();
  const txt = (s, x, yy, { font = f, t = 8, c = ENCRE, droite = false, max = null } = {}) => {
    const v = max ? borne(s, font, t, max) : propre(s);
    page.drawText(v, { x: droite ? x - font.widthOfTextAtSize(v, t) : x, y: yy, size: t, font, color: c });
  };
  const nouvellePage = (tete) => { page = doc.addPage(A4P); nPage += 1; y = H - M; pied(); if (tete) tete(); };
  const place = (h, tete) => { if (y - h < M + 14) nouvellePage(tete); };
  // En-tête
  if (entreprise && entreprise.nom) { txt(entreprise.nom, M, y, { font: fb, t: 11 }); if (entreprise.siret) txt(`SIRET ${entreprise.siret}`, M, y - 13, { t: 8.5, c: GRIS }); y -= 30; }
  txt(titreConforme(R), M, y - 6, { font: fb, t: 18 }); y -= 22;
  txt(`Établi le ${horodatage(maintenant)}`, M, y, { t: 9, c: GRIS }); y -= 12;
  txt(enTete(R, { entreprise: null, maintenant })[2][0], M, y, { t: 8.5, c: GRIS, max: W - 2 * M }); y -= 18;
  for (const t of totauxPeriodes(R)) {
    const fort = t.cle === R.periode;
    txt(t.libelle, M, y, { t: 9.5, font: fort ? fb : f }); txt(`${t.n} ligne${t.n > 1 ? 's' : ''}`, M + 220, y, { t: 9.5, c: GRIS, droite: true });
    txt(`${t.partiel ? 'au moins ' : ''}${eurosTexte(t.total)}`, M + 330, y, { t: 9.5, font: fort ? fb : f, droite: true });
    y -= 5; page.drawLine({ start: { x: M, y }, end: { x: M + 330, y }, thickness: 0.5, color: FILET }); y -= 11;
  }
  const mq = manquesNommes(R);
  if (mq.length) { y -= 4; txt('À compléter', M, y, { font: fb, t: 9.5 }); y -= 13; for (const m of mq) { place(12); txt(`· ${m.texte}`, M, y, { t: 8.5, c: AMBRE, max: W - 2 * M }); y -= 11; } }
  y -= 10;
  // Les colonnes
  const cols = COLONNES_CONFORMES[R.type];
  const fixe = cols.reduce((s, c) => s + (c[2] || 0), 0);
  const largeurNature = Math.max(80, W - 2 * M - fixe);
  const xs = []; let x = M; for (const c of cols) { xs.push(x); x += c[2] || largeurNature; }
  const lar = (i) => (cols[i][2] || largeurNature) - 6;
  const entete = () => { cols.forEach(([, h, , dr], i) => txt(h, dr ? xs[i] + lar(i) : xs[i], y, { font: fb, t: 7.5, c: GRIS, droite: !!dr, max: lar(i) })); y -= 5; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: FILET }); y -= 10; };
  const rangee = (l) => {
    place(12, entete);
    cols.forEach(([k, , , dr], i) => { const v = valeurCellule(l, k, 'texte'); const manque = (k === 'reglement' || k === 'piece' || k === 'fournisseur') && !v; txt(manque ? 'à compléter' : v, dr ? xs[i] + lar(i) : xs[i], y, { t: 7.5, droite: !!dr, max: lar(i), c: manque ? AMBRE : (l.montant == null && k === 'montant' ? GRIS : ENCRE) }); });
    y -= 11;
  };
  // Par mois : un intertitre et son sous-total.
  const iM = cols.findIndex((c) => c[0] === 'montant');
  place(30); entete();
  if (!R.lignes.length) { txt('Aucune ligne sur la période.', M, y, { c: GRIS }); y -= 14; }
  for (const m of parMois(R)) {
    if (!m.n) continue;
    place(26, entete); txt(m.libelle.charAt(0).toUpperCase() + m.libelle.slice(1), M, y, { font: fb, t: 8.5 }); y -= 12;
    for (const l of m.lignes) rangee(l);
    place(12, entete); txt(`Sous-total ${m.libelle}`, M, y, { t: 7.5, c: GRIS }); txt(`${m.sansMontant ? 'au moins ' : ''}${eurosTexte(m.total)}`, xs[iM] + lar(iM), y, { font: fb, t: 7.5, droite: true }); y -= 14;
  }
  place(16); txt('Total', M, y, { font: fb, t: 8.5 }); txt(`${R.complet ? '' : 'au moins '}${eurosTexte(R.total)}`, xs[iM] + lar(iM), y, { font: fb, t: 8.5, droite: true }); y -= 22;
  if (R.horsPeriode.length) {
    place(40); txt(R.type === 'recettes' ? `Dans aucun mois — à dater (${R.horsPeriode.length})` : `Sans date (${R.horsPeriode.length})`, M, y, { font: fb, t: 10.5 }); y -= 15;
    entete(); for (const l of R.horsPeriode) rangee(l); y -= 10;
  }
  // Les mentions et leurs sources
  place(80); txt('Mentions obligatoires et sources', M, y, { font: fb, t: 10.5 }); y -= 13;
  txt('Sources pas ouvertes au moment de la rédaction : à vérifier sur Légifrance, le BOFiP et service-public.fr.', M, y, { t: 7.5, c: GRIS, max: W - 2 * M }); y -= 14;
  for (const [nom, src] of lignesSources(R)) { place(24); txt(nom, M, y, { font: fb, t: 8 }); y -= 10; txt(src, M + 10, y, { t: 7.5, c: GRIS, max: W - 2 * M - 10 }); y -= 13; }
  return doc.save();
}
