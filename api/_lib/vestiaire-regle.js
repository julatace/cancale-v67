// ─────────────────────────────────────────────────────────────────────────────
// VESTIAIRE COLLECTIVE PARTOUT — UNE règle, UN propriétaire (1er novembre)
//
// Julien : « fais tout comme un pro, il ne doit y avoir aucune erreur
// possible ». L'audit des parcours (1er nov.) a mesuré que Vestiaire vivait à
// part : une vente Vestiaire ne disait « à retirer » nulle part ailleurs, ne
// sortait pas la paire du Stock, n'entrait dans aucun total (sans que les
// totaux « toutes plateformes » le disent), et ses colis à poster n'étaient
// comptés que dans Colis. Ce module porte, pour l'app (src/App.jsx l'importe),
// le widget (api/widget.js), les rappels (api/ship-reminders.js), le bilan de
// la semaine et l'anti double vente du serveur (api/_lib/double-vente.js),
// les MÊMES règles sur les lignes rangées par l'extension :
//   · `vc_ventes`   = { ventes: { [id]: { productId, ref, etat, date, montant,
//                       aExpedier, limite, suivi, transporteur, etiquette,
//                       compte, … } }, lectures } ;
//   · `vc_listings` = { items: { [id]: { ref, statut, vuAt, … } },
//                       liens: { [id Vestiaire]: N° }, capturedAt, complet }.
//
// ⚠️ L'IDENTITÉ D'UNE PAIRE (§5) : l'annonce créée par VRM (`liens`), sinon la
//    référence « VRM-{n°} » lue sur l'ARTICLE (`ref`). JAMAIS le titre, la
//    marque ou la taille. Pas d'identité ⇒ '' : rien n'est deviné, l'appelant
//    le DIT (« pas reliée à une paire »).
// ⚠️ L'ARGENT (§5 « Les chiffres ») : Vestiaire écrit un chiffre sur chaque
//    vente, mais VRM ne sait pas encore si c'est le prix payé par l'acheteur ou
//    ce que Vestiaire te verse. Un montant ne compte que si le NOM de sa clé
//    dit que c'est ce que le vendeur reçoit, en EUROS (`montantRecuVc`) ; une
//    date de versement que si une clé la porte (`verseLe`). Sinon la vente est
//    NOMMÉE comme manque dans chaque total — jamais comptée à 0, jamais
//    devinée.
// Fonctions PURES : `scripts/audit-vestiaire-partout.cjs` les exécute.
// ─────────────────────────────────────────────────────────────────────────────
import { cleNum } from './numerotation.js';
import { joursAvant } from './ebay-a-expedier.js';

const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);

// ── L'ÉTAPE D'UNE VENTE (le mot que Vestiaire écrit) ────────────────────────
// Rangée dans une étape seulement quand le mot la NOMME ; « paid » seul (payée
// par l'acheteur ? versée à toi ?) n'est PAS rangé. L'ordre compte : une vente
// annulée ou retournée l'est d'abord.
export const VC_VENTE_ETAPES = [
  ['annulee', /cancel|annul|refund|rembours|return|retour|litige|dispute/i, 'Annulée ou retournée'],
  ['versee', /payout|paid.?out|vers[ée]|virement|transferred|credited|cr[ée]dit/i, 'Argent versé'],
  ['terminee', /complet|finali|termin|closed|done|clotur/i, 'Terminée'],
  ['livree', /deliver|livr|received|re[cç]u/i, 'Livrée à l’acheteur'],
  ['controle', /authenti|control|inspect|verif|expertis|check|quality/i, 'Contrôle par Vestiaire'],
  ['en-route', /ship|sent|transit|exp[ée]di|envoy|on.?the.?way|in.?delivery|dispatch/i, 'Envoyée'],
];
// L'étape nommée par le mot, ou '' (aucun mot, ou un mot qu'aucune étape ne nomme).
export function etapeMotVc(v) {
  const brut = String((v && v.etat) || '').trim();
  if (!brut) return '';
  const f = VC_VENTE_ETAPES.find(([, re]) => re.test(brut));
  return f ? f[0] : '';
}
// Annulée, remboursée, retournée ou en litige : la paire n'est pas partie, la
// vente n'est pas de l'argent. Une vente encore « à expédier » n'est jamais
// annulée (la liste « articles à expédier » le prouve).
export const vcVenteAnnulee = (v) => !!v && v.aExpedier !== true && etapeMotVc(v) === 'annulee';
// PARTIE : le colis a quitté le stock, PROUVÉ par le mot de Vestiaire (envoyée,
// en contrôle, livrée, terminée, versée). « Plus dans à expédier » seul ne
// prouve rien (envoyée OU annulée, Vestiaire ne dit pas laquelle).
export const vcVentePartie = (v) => !!v && v.aExpedier !== true && ['en-route', 'controle', 'livree', 'terminee', 'versee'].includes(etapeMotVc(v));

// ── L'IDENTITÉ (§5) ─────────────────────────────────────────────────────────
export const numVcVente = (v, liens) => cleNum((v && v.productId && objet(liens) && liens[v.productId]) || (v && v.ref) || '');
export const numVcAnnonce = (id, it, liens) => cleNum((id != null && objet(liens) && liens[String(id)]) || (it && it.ref) || '');

// ── L'ARGENT ────────────────────────────────────────────────────────────────
// Le NOM de la clé dit que c'est ce que le vendeur reçoit (versement, gain,
// net vendeur…). « price », « amount », « total » seuls ne le disent pas.
export const CLE_RECU_VC = /payout|earning|net.?(amount|price|seller|vendeur)|seller.?(amount|net|payout|revenue|earning|price)|amount.?to.?(seller|receive|pay)|you.?(get|receive|earn)|to.?receive|versement|vers[ée]|gain/i;
export function montantRecuVc(v) {
  const m = v && objet(v.montant);
  if (!m || typeof m.valeur !== 'number' || !isFinite(m.valeur) || m.valeur < 0) return { eur: null, raison: 'montant pas lu' };
  if (!CLE_RECU_VC.test(String(m.cle || ''))) return { eur: null, raison: 'montant pas sûr' };
  if (String(m.devise || '').toUpperCase() !== 'EUR') return { eur: null, raison: m.devise ? 'autre devise' : 'devise non dite' };
  return { eur: Math.round(m.valeur * 100) / 100, raison: '' };
}
// La date de versement : seulement une clé qui la PORTE (jamais la date de la
// vente, jamais l'heure de lecture). 0 = pas su.
export const dateVersementVc = (v) => { const t = Date.parse((v && v.verseLe) || ''); return Number.isFinite(t) && t > 0 ? t : 0; };
export const dateVenteVc = (v) => { const t = Date.parse((v && v.date) || ''); return Number.isFinite(t) && t > 0 ? t : 0; };

// Les ventes rangées, en liste, avec leur N° (identité seule). `null` = pas su.
export function ventesVcDe(d) {
  if (d === undefined) return undefined;
  if (!d) return null;
  const ventes = objet(d.ventes);
  if (!ventes) return d.ventes == null ? [] : null;
  const liens = objet(d.liens) || {};
  return Object.entries(ventes).filter(([, v]) => objet(v)).map(([id, v]) => ({ ...v, id: String(id), num: numVcVente(v, liens) }));
}

// ── LES COLIS À ENVOYER ─────────────────────────────────────────────────────
// Lus dans la liste « articles à expédier » (`aExpedier`). La date limite est
// celle que Vestiaire écrit (`limite`) ; sans elle, à poster sans date — jamais
// « en retard ». Les jours se comptent à l'heure de PARIS (même règle qu'eBay).
export function colisVcAPoster(d, maintenant = Date.now()) {
  if (d === undefined) return undefined;
  if (!d) return null;
  const ventes = objet(d.ventes);
  if (!ventes) return d.ventes == null ? [] : null;
  const liens = objet(d.liens) || {};
  return Object.entries(ventes).filter(([, v]) => objet(v) && v.aExpedier === true).map(([id, v]) => {
    const t = Date.parse(v.limite || '');
    return {
      id: String(id), num: numVcVente(v, liens), limite: v.limite || '', suivi: v.suivi || '', transporteur: v.transporteur || '',
      etiquette: v.etiquette === true ? true : v.etiquette === false ? false : null, date: v.date || '',
      jours: Number.isFinite(t) ? joursAvant(t, maintenant) : null,
      // (2 nov., 5.316) pour l'affichage seulement — jamais une identité (§5).
      titre: typeof v.titre === 'string' ? v.titre : '', photo: typeof v.photo === 'string' ? v.photo : '',
      bordereau: v.bordereau && typeof v.bordereau === 'object' && typeof v.bordereau.id === 'string' ? v.bordereau : null,
    };
  }).sort((a, z) => String(a.limite || '9999').localeCompare(String(z.limite || '9999')));
}
// Les nombres du widget et des rappels : total · en retard · aujourd'hui ·
// demain · sans date limite. `null`/`undefined` restent ce qu'ils sont.
export function resumeColisVc(liste) {
  if (!Array.isArray(liste)) return liste;
  let overdue = 0, today = 0, tomorrow = 0, sansLimite = 0;
  for (const x of liste) { if (x.jours == null) { sansLimite++; continue; } if (x.jours < 0) overdue++; else if (x.jours === 0) today++; else if (x.jours === 1) tomorrow++; }
  return { total: liste.length, overdue, today, tomorrow, sansLimite };
}

// ── L'ÉTAT D'UNE ANNONCE ────────────────────────────────────────────────────
// Le mot que Vestiaire écrit, rangé dans une famille qu'on sait dire. Un mot
// qu'aucune famille ne reconnaît reste « autre » (jamais deviné) ; une VENTE
// lue (même identifiant d'article) prouve « vendue ». Une annonce plus vue
// depuis plus de 24 h dans une liste relue ⇒ « à confirmer » (rien retiré).
export const VC_ANNONCE_ETATS = [
  ['vendue', /sold|vendu/i, 'Vendue'],
  ['retiree', /invalid|reject|refus|withdraw|retir|delet|supprim|archiv|expir|inactiv|unpublish|deactiv|cancel|annul/i, 'Retirée'],
  ['attente', /pending|review|moderat|waiting|attente|submitted|soumis|draft|brouillon|incomplet|to.?validate|validation/i, 'En attente de validation'],
  ['en-ligne', /on.?sale|online|en.?ligne|published|publi[ée]|active|live|en.?vente|for.?sale|selling|approved|valid/i, 'En ligne'],
];
export function etatAnnonceVcBrut(it, vendueParVente, capturedAt) {
  if (vendueParVente) return 'vendue';
  const brut = String((it && it.statut) || '').trim();
  const vu = Date.parse((it && it.vuAt) || ''), lu = Date.parse(capturedAt || '');
  if (isFinite(vu) && isFinite(lu) && lu - vu > 24 * 3600e3 && !(brut && VC_ANNONCE_ETATS.slice(0, 2).some(([, re]) => re.test(brut)))) return 'a-confirmer';
  if (!brut) return 'pas-dit';
  const f = VC_ANNONCE_ETATS.find(([, re]) => re.test(brut));
  return f ? f[0] : 'autre';
}
// Les annonces Vestiaire PROUVÉES en ligne, par N° (identité seule) : Map N° →
// [{ id, titre }]. Une lecture de plus de 24 h n'est pas une preuve (« à
// confirmer », §5 « En ligne ») : la carte est alors vide et `vieille` le dit.
export function annoncesVcEnLigne(lst, ventes, maintenant = Date.now()) {
  const out = new Map();
  const d = objet(lst);
  if (!d || !objet(d.items)) return { parNum: out, vieille: false, lue: false };
  const lu = Date.parse(d.capturedAt || '');
  const vieille = !(Number.isFinite(lu) && maintenant - lu <= 24 * 3600e3);
  const vendus = new Set();
  for (const v of Object.values(objet(ventes) || {})) if (v && v.productId && !vcVenteAnnulee(v)) vendus.add(String(v.productId));
  if (vieille) return { parNum: out, vieille: true, lue: true };
  for (const [id, it] of Object.entries(d.items)) {
    if (!objet(it)) continue;
    const num = numVcAnnonce(id, it, d.liens);
    if (!num || etatAnnonceVcBrut(it, vendus.has(String(id)), d.capturedAt) !== 'en-ligne') continue;
    if (!out.has(num)) out.set(num, []);
    out.get(num).push({ id: String(id), titre: String(it.titre || '') });
  }
  return { parNum: out, vieille: false, lue: true };
}

// ── LE STOCK : CE QUI EST PARTI, CE QUI RESTE À POSTER ─────────────────────
// Par IDENTITÉ seulement (`num` de `ventesVcDe`). Partie = PROUVÉE par le mot
// de Vestiaire (`vcVentePartie`) ; « à expédier » = encore à poster (la paire
// reste) ; annulée, mot inconnu, sans identité ⇒ rien. `null` ⇒ rien (pas su).
export function stockVestiaire(liste) {
  const aPoster = new Set(), sorties = [];
  if (!Array.isArray(liste)) return { aPoster, sorties };
  for (const v of liste) {
    const cle = cleNum((v && v.num) || '');
    if (!cle || vcVenteAnnulee(v)) continue;
    if (v.aExpedier === true) aPoster.add(cle);
    else if (vcVentePartie(v)) sorties.push({ v, num: v.num, cle });
  }
  return { aPoster, sorties };
}

// ── « VENDUS AILLEURS · ANNONCES À RETIRER », LA PART DE VESTIAIRE ──────────
// Les annonces Vestiaire (actives seulement si PROUVÉES en ligne par une lecture
// de moins de 24 h ; vendue/retirée ⇒ inactives ; le reste ⇒ `null`, « non
// confirmé », nommé) et les ventes Vestiaire engagées, par identité. Une vente
// sans identité n'est jamais rapprochée : elle est NOMMÉE dans `manques`.
// Entrées : `lst` = `vc_listings` ({ items, liens, capturedAt }) ou null ;
// `ventes` = `vc_ventes.ventes`. Rend { annonces, ventes, manques } dans la
// forme de `articlesVendusAilleurs` (src/bilanSynchronisation.js).
export function retraitsVestiaire({ lst, ventes, maintenant = Date.now() } = {}) {
  const annonces = [], vs = [], manques = [];
  const vv = objet(ventes) || {};
  const liens = (objet(lst) && objet(lst.liens)) || {};
  const vendus = new Set(Object.values(vv).filter((v) => v && v.productId && !vcVenteAnnulee(v)).map((v) => String(v.productId)));
  const lu = Date.parse((lst && lst.capturedAt) || '');
  const vieille = !(Number.isFinite(lu) && maintenant - lu <= 24 * 3600e3);
  let inconnu = 0;
  for (const [id, it] of Object.entries((objet(lst) && objet(lst.items)) || {})) {
    if (!objet(it)) continue;
    const num = numVcAnnonce(id, it, liens);
    if (!num) continue;
    const etat = etatAnnonceVcBrut(it, vendus.has(String(id)), lst.capturedAt);
    const active = (etat === 'vendue' || etat === 'retiree') ? false : (etat === 'en-ligne' && !vieille) ? true : null;
    if (active === null) inconnu++;
    annonces.push({ id: String(id), numero: num, plateforme: 'Vestiaire', compte: String(it.compte || ''), compteNom: 'Vestiaire', titre: String(it.titre || ''), photo: it.photo || null,
      capture: lst.capturedAt || null, active, lien: null, onglet: 'plat_vestiaire' });
  }
  if (inconnu) manques.push(`état de ${inconnu} annonce${inconnu > 1 ? 's' : ''} Vestiaire non confirmé${vieille ? ' (lecture de plus de 24 h)' : ''}`);
  let sansIdentite = 0;
  for (const [id, v] of Object.entries(vv)) {
    if (!objet(v) || vcVenteAnnulee(v)) continue;
    const num = numVcVente(v, liens);
    if (!num) { sansIdentite++; continue; }
    vs.push({ id: 'vc:' + String(id), numero: num, plateforme: 'Vestiaire', engagee: true });
  }
  if (sansIdentite) manques.push(`${sansIdentite} vente${sansIdentite > 1 ? 's' : ''} Vestiaire sans référence VRM-n° (VRM ne devine pas la paire)`);
  return { annonces, ventes: vs, manques };
}
