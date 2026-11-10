// ═══════════════════════════════════════════════════════════════════════════
// « LITIGES EN COURS » ET « RETOURS PAR MODÈLE » (10 novembre, lots BB et BI)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (validé le 10 nov.) : un écran qui rassemble les ventes en litige ou en
// retour, avec la date limite de réponse quand elle est LUE, et les preuves déjà
// rangées pour CETTE vente ; puis, pour chaque modèle, combien de ventes ont fini
// en retour ou en litige. Lecture et ouverture seulement : aucun message, aucune
// action sur un site.
//
// Ce module NE RE-DÉCIDE RIEN (§5, une règle par notion) :
//   · ce qui est « en litige / en retour » est la règle de src/litiges.js
//     (`litigesEnCours`) — ici on garde ses lignes de VENTE ;
//   · un retour d'une vente est la règle de src/retoursStock.js
//     (`etapeRetourVinted`, origine « retour ») ;
//   · le modèle est la règle des Statistiques (src/ceQuiRapporte.js,
//     `modeleSur`) : un REGROUPEMENT d'affichage, jamais une identité — aucun
//     geste n'est posé sur une ligne du tableau.
//
// Formes MESURÉES (lecture seule, 10 nov., sa base) :
//   · transactions Vinted (meta) : 440 « Retour initié » 10 · 430 « Transaction
//     suspendue - en attente de vérification » 2 ; AUCUN champ de date limite
//     (status_updated_at, debit_processed_at, suspending_complaint_id seulement) ;
//   · liste des ventes : « Remboursement effectué » (`failed`) 330 — annulations
//     ET retours mêlés : un remboursement seul ne prouve PAS un retour ;
//   · e-mails Vinted : les trois sujets de src/litiges.js, plus « Bordereau de
//     retour - … » (1, 8 nov., côté ACHAT : non utilisé) ;
//   · Leboncoin (`lbc_ventes`) : stepStatus done/validation/cancelled — aucun
//     litige jamais vu ; Vestiaire (`vc_ventes`) : ACTION_NEEDED seulement ;
//     eBay : aucune commande en base (retours lus chez eBay, Post-Order).
//   ⇒ un litige Leboncoin ou Vestiaire ne SE LIT PAS : l'écran le dit (« pas
//     su ») et nomme ce qui manque, jamais « aucun litige ».
//
// Trois états partout (§5) : `undefined` en cours · `null` pas su · valeur lue.
// Module PUR (aucune lecture, aucune écriture). Exécuté par
// scripts/audit-litiges-ecran.cjs.

import { litigeDEmail, texteLimite, LIBELLE_GENRE } from './litiges.js';
import { etapeRetourVinted, LIBELLE_ETAPE } from './retoursStock.js';
import { modeleSur, AUTRES } from './ceQuiRapporte.js';

const str = (v) => String(v == null ? '' : v);

// ── LES PREUVES D'UNE VENTE (rangées par IDENTITÉ — la transaction) ─────────
// L'appelant passe ce qu'il a trouvé PAR LE N° DE TRANSACTION de la vente :
//   bord   : l'e-mail du bordereau (PDF) { suivi?, receivedAt? } ou null ;
//   label  : le bordereau capté par l'extension { capturedAt? } ou null ;
//   suivi  : le n° de suivi NORMALISÉ de SON bordereau ('' = aucun) ;
//   transp : la Map des lignes du transporteur par n° (undefined en cours ·
//            null pas su) ;
//   photo  : la photo de L'ANNONCE de la vente (identité), '' sinon ;
//   carton : la photo du carton fermé (lot AZ, pas encore livré) : undefined ⇒
//            l'emplacement « à venir » ; { photo, at } ⇒ rangée.
// Rend { photo, suivi, bordereau, carton }, chacun { etat, … } :
//   etat ∈ 'ok' · 'aucun' (rien de rangé) · 'encours' · 'passu' · 'a-venir'.
export function preuvesVente({ bord = null, label = null, suivi = '', transp, photo = '', carton } = {}) {
  const p = {};
  p.photo = photo ? { etat: 'ok', src: str(photo) } : { etat: 'aucun' };
  const atB = (bord && bord.receivedAt) || (label && label.capturedAt) || null;
  p.bordereau = bord || label ? { etat: 'ok', at: atB, source: bord ? 'email' : 'extension' } : { etat: 'aucun' };
  const n = str(suivi).trim();
  if (!n) p.suivi = { etat: 'aucun' };
  else if (transp === undefined) p.suivi = { etat: 'encours', n };
  else if (transp === null) p.suivi = { etat: 'passu', n };
  else {
    const t = transp && typeof transp.get === 'function' ? transp.get(n) : null;
    const statut = t ? str(t.libelle).trim() : '';
    p.suivi = statut ? { etat: 'ok', n, statut, at: t.etatAt || null } : { etat: 'ok', n, statut: '', at: null };
  }
  p.carton = carton && carton.photo ? { etat: 'ok', src: str(carton.photo), at: carton.at || null } : { etat: 'a-venir' };
  return p;
}

// ── BB : LES LITIGES EN COURS DES VENTES ────────────────────────────────────
// res      : le résultat de `litigesEnCours` (src/litiges.js) ;
// preuves  : (ligne) → les preuves (`preuvesVente`) de sa vente, ou null ;
// retourDe : (tx) → l'étape du retour (src/retoursStock.js) ou null ;
// sites    : Set des plateformes qu'il utilise (null = pas su : Vinted seul dit) ;
// ebay     : les retours eBay lus (`undefined` en cours · null pas su · liste).
// Rend { etat, cartes, anciennes, plateformes, manques }.
//   · cartes      : les litiges/retours de VENTE en cours (pas « ancien »),
//                   les plus pressés d'abord (l'ordre de src/litiges.js) ;
//   · anciennes   : échéance passée ou e-mail sans commande de plus de 30 j
//                   (repliées, jamais cachées) ;
//   · plateformes : [{ site, etat: 'lu'|'encours'|'passu'|'jamais-vu', raison }] —
//                   ce que VRM sait lire, plateforme par plateforme ;
//   · manques     : ce qui n'a pas pu être lu (nommé).
export const SITES_LITIGE = ['vinted', 'ebay', 'leboncoin', 'vestiaire'];
export const NOM_SITE = { vinted: 'Vinted', ebay: 'eBay', leboncoin: 'Leboncoin', vestiaire: 'Vestiaire' };
export function litigesDesVentes({ res, preuves = null, retourDe = null, sites = null, ebay, maintenant } = {}) {
  const now = isFinite(maintenant) ? maintenant : Date.now();
  const utilise = (s) => (sites && typeof sites.has === 'function' ? sites.has(s) : s === 'vinted');
  const plateformes = [];
  const etatV = !res ? 'encours' : res.etat;
  const manquesV = res && Array.isArray(res.manques) ? res.manques.filter((m) => !/eBay/.test(m)) : [];
  plateformes.push({ site: 'vinted', etat: etatV === 'lu' ? (manquesV.length ? 'passu' : 'lu') : etatV,
    raison: etatV === 'encours' ? 'lecture…' : manquesV.length ? `pas lu : ${manquesV.join(', ')}` : '' });
  if (utilise('ebay')) {
    plateformes.push({ site: 'ebay', etat: ebay === undefined ? 'encours' : ebay === null ? 'passu' : 'lu',
      raison: ebay === undefined ? 'lecture…' : ebay === null ? 'les retours eBay n’ont pas pu être lus' : '' });
  }
  // Mesuré le 10 nov. : aucun litige jamais vu sur ces deux sites — sa forme
  // n'est pas connue, donc VRM ne sait pas le reconnaître (jamais « aucun »).
  for (const s of ['leboncoin', 'vestiaire']) {
    if (utilise(s)) plateformes.push({ site: s, etat: 'jamais-vu', raison: `un litige ${NOM_SITE[s]} ne se lit pas encore : regarde sur ${NOM_SITE[s]}` });
  }
  const manques = plateformes.filter((p) => p.etat === 'passu' || p.etat === 'jamais-vu').map((p) => NOM_SITE[p.site]);
  if (!res || res.etat !== 'lu') return { etat: etatV, cartes: [], anciennes: [], plateformes, manques };
  const cartes = [], anciennes = [];
  for (const l of res.lignes || []) {
    if (!l || l.sens !== 'vente') continue;
    const tx = str(l.tx);
    const etape = tx && typeof retourDe === 'function' ? retourDe(tx) : null;
    const lim = texteLimite(l);
    const c = {
      cle: l.cle, plateforme: l.plateforme || 'vinted', genre: l.genre, libelle: LIBELLE_GENRE[l.genre] || 'Litige',
      tx, num: l.num ? str(l.num) : '', titre: str(l.titre || l.article), compte: l.compte || null,
      limite: l.limite || null, limiteTexte: lim, presse: !!l.presse, depassee: !!l.depassee,
      // L'étape du retour (src/retoursStock.js), seulement quand elle AJOUTE quelque chose (« Retour initié » redirait « Retour »).
      etape: etape && etape.etape && etape.etape !== 'initie' ? LIBELLE_ETAPE[etape.etape] || '' : '',
      geste: l.geste, depuis: l.recuLe || null,
      preuves: (typeof preuves === 'function' ? preuves(l) : null) || preuvesVente({}),
    };
    (l.ancien ? anciennes : cartes).push(c);
  }
  void now;
  return { etat: 'lu', cartes, anciennes, plateformes, manques };
}

// La phrase de la date limite, d'une seule source : LUE ⇒ « Réponds avant le 14 nov. » ;
// sinon « Date limite non lue » (jamais une date inventée).
export const phraseLimite = (c) => (c && c.limiteTexte ? `Avant le ${c.limiteTexte}` : 'Date limite non lue');

// ── BI : RETOURS ET LITIGES PAR MODÈLE ─────────────────────────────────────
// ventes : la liste des ventes Vinted (`undefined` en cours · `null` pas su) ;
// etats  : (tx) → { s, ss } de la transaction, ou null (pas captée) ; `null`
//          entier = les états n'ont pas pu être lus ;
// emails : les lignes d'e-mail de litige (même forme que src/litiges.js) ou
//          undefined/null ;
// modeleDe : (vente) → { cle, nom } | null (par défaut `modeleSur('', titre)`).
// Une vente compte au dénominateur si elle est PROUVÉE (une commande de « Mes
// ventes » qui n'est ni annulée ni en échec de paiement), ou si elle a fini en
// retour / litige PROUVÉ :
//   · retour : `etapeRetourVinted` d'origine « retour » (transaction 440 ou
//     statut « Retour initié ») — pas une colis non réclamé ;
//   · litige : transaction 430, statut « suspendue / litige / réclamation », ou
//     e-mail « Action requise : problème avec la commande » relié par SA
//     conversation (une seule commande, sinon aucune) — jamais par le titre.
// Une vente « Remboursement effectué » dont la transaction n'est pas lue : la
// cause (annulation ou retour) n'est pas sue ⇒ comptée à part (`inconnues`),
// ni au numérateur ni au dénominateur ; le groupe dit alors « au moins ».
const RE_SUSP = /suspendu|litige|r[ée]clamation/i;
const RE_ANNULE = /annul|cancel|refus|[ée]chou|[ée]chec\s+du\s+paiement/i;
const RE_REMB = /rembours/i;
const RE_NON_RECL = /non\s*r[ée]clam/i;
export function retoursParModele({ ventes, etats, emails, modeleDe = null } = {}) {
  if (ventes === undefined) return { etat: 'encours', lignes: [], inconnues: 0, manques: [] };
  if (ventes === null) return { etat: 'passu', lignes: [], inconnues: 0, manques: ['tes ventes Vinted'] };
  const manques = [];
  if (etats === null) manques.push('l’état des transactions Vinted');
  if (emails === null) manques.push('tes e-mails Vinted');
  const md = typeof modeleDe === 'function' ? modeleDe : (o) => modeleSur(o && o.brand_title ? o.brand_title : '', o && o.title);
  // Les e-mails « problème avec la commande » → la conversation (une seule commande).
  const convProbleme = new Set();
  for (const row of (Array.isArray(emails) ? emails : [])) {
    const e = litigeDEmail(row);
    if (e && e.genre === 'probleme' && e.conv) convProbleme.add(e.conv.toLowerCase());
  }
  const parConv = new Map();
  for (const o of ventes) {
    const c = o && o.conversation_id != null ? str(o.conversation_id).toLowerCase() : '';
    if (c) parConv.set(c, (parConv.get(c) || 0) + 1);
  }
  const groupes = new Map();
  let inconnues = 0;
  const vus = new Set();
  for (const o of ventes) {
    const tx = o && o.transaction_id != null ? str(o.transaction_id) : '';
    if (!tx || vus.has(tx)) continue;
    vus.add(tx);
    const st = str(o.status), tus = str(o.transaction_user_status).toLowerCase();
    const et = typeof etats === 'function' ? etats(tx) : null;
    const s = et && isFinite(Number(et.s)) ? Number(et.s) : null;
    const er = etapeRetourVinted(o, et);
    const retour = !!(er && er.origine === 'retour');
    const conv = o.conversation_id != null ? str(o.conversation_id).toLowerCase() : '';
    const litige = !retour && (s === 430 || RE_SUSP.test(st) || (conv && convProbleme.has(conv) && parConv.get(conv) === 1));
    let compte = 'vente';
    if (retour) compte = 'retour';
    else if (litige) compte = 'litige';
    else if (RE_NON_RECL.test(st) || (et && RE_NON_RECL.test(str(et.ss)))) continue;   // colis non réclamé : ni vente, ni retour
    else if (s === 220 || (s != null && s >= 500)) continue;                           // annulée / paiement échoué : pas une vente
    else if (RE_REMB.test(st) || tus === 'failed') { inconnues++; compte = 'inconnue'; }
    else if (RE_ANNULE.test(st)) continue;
    else if (!str(st).trim()) continue;                                                // une conversation n'est pas une vente
    const m = md(o);
    const k = m && m.cle ? m.cle : '';
    const g = groupes.get(k) || { cle: k, nom: m && m.nom ? m.nom : AUTRES, ventes: 0, retours: 0, litiges: 0, inconnues: 0 };
    if (compte === 'inconnue') g.inconnues++;
    else { g.ventes++; if (compte === 'retour') g.retours++; if (compte === 'litige') g.litiges++; }
    groupes.set(k, g);
  }
  const lignes = [...groupes.values()].filter((g) => g.ventes > 0 || g.inconnues > 0).map((g) => ({
    ...g, total: g.retours + g.litiges, auMoins: g.inconnues > 0,
    taux: g.ventes > 0 ? (g.retours + g.litiges) / g.ventes : null,
  }));
  // Les modèles qui reviennent le plus d'abord ; « Autres » toujours en dernier.
  lignes.sort((a, b) => (a.cle === '' ? 1 : 0) - (b.cle === '' ? 1 : 0) || b.total - a.total || (b.taux || 0) - (a.taux || 0) || b.ventes - a.ventes || a.nom.localeCompare(b.nom));
  return { etat: 'lu', lignes, inconnues, manques };
}

// Le texte d'une ligne du tableau, d'une seule source : « 2 sur 15 » (« au moins 2 sur 15 »).
export const texteRetours = (l) => (l ? `${l.auMoins && l.total > 0 ? 'au moins ' : ''}${l.total} sur ${l.ventes}` : '');

// ── LA SOURCE D'« À TRANCHER » (src/aTrancher.js, `litiges-en-cours`) ───────
// Le nombre que l'écran PUBLIE : les cartes en cours. `null` quand ce n'est pas
// su (ventes ou e-mails pas lus, retours eBay pas lus) — rien n'est publié alors.
export function nombreLitigesPublie(r) {
  if (!r || r.etat !== 'lu') return null;
  if (r.plateformes.some((p) => (p.site === 'vinted' || p.site === 'ebay') && (p.etat === 'passu' || p.etat === 'encours'))) return null;
  return r.cartes.length;
}
