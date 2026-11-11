// ═══════════════════════════════════════════════════════════════════════════
// MESSAGES AUX FAVORIS — LE PARCOURS CLAIR EN TROIS TEMPS (11 nov., lot
// `favoris-clair`). Julien : « les messages aux favoris, on peut faire en sorte
// que ce soit BEAUCOUP plus beau et plus COMPRÉHENSIBLE ? »
//
// Règle PURE (aucun DOM, `now` passé) de la page : QUI · QUOI · QUAND, le
// récapitulatif avant d'envoyer, le suivi (SuiviTravail) et l'historique.
// Elle ne décide RIEN de l'envoi : la file serveur (api/_lib/favoris-file.js),
// l'autorisation unique, le plafond de 50 actions/h (réserve 5) et la garde de
// l'extension restent les seuls juges. Ici, on COMPTE et on DIT :
//   · QUI : les annonces qui ont des favoris, le NOMBRE de personnes par
//     annonce — jamais leur identité (aucun pseudo ne sort d'ici) ;
//   · au plus 10 messages par envoi (la file serveur refuse au-delà : on ne
//     propose jamais plus, et on dit combien attendront le prochain envoi) ;
//   · l'offre : prix proposé, remise en € et en %, calculés par LA règle
//     (`prixOffreFavori`, src/favorisMessage.js, recopiée dans l'extension) ;
//   · la durée : une ESTIMATION au rythme choisi, dite « environ » ;
//   · les gestes : 2 par message (conversation + message), 3 avec l'offre —
//     comptés comme l'extension les réserve (X3, 1er nov.), comparés aux 45
//     que l'app peut prendre dans l'heure ; jauge pas lue ⇒ « pas su » ;
//   · l'historique « acheté après ton message » : par IDENTITÉ seulement —
//     même annonce (n° d'annonce de la transaction) ET même personne (le
//     destinataire du message = l'autre personne de la conversation de la
//     vente) ET vente APRÈS le message. Jamais par titre ni ressemblance ;
//     acheteur pas su ⇒ la vente n'est pas comptée (et le manque est dit).
// ═══════════════════════════════════════════════════════════════════════════

export const MAX_PAR_ENVOI = 10;          // api/_lib/favoris-file.js (lancerFile) refuse au-delà
export const GESTES_PAR_MESSAGE = 2;      // conversation + message
export const GESTES_AVEC_OFFRE = 3;       // + l'offre Vinted (X3 : réservées d'un coup)
export const RYTHME_VINTEX = { min: 6, max: 10 };   // secondes (delaiFavori, intervalle 0)

// ── QUI ─────────────────────────────────────────────────────────────────────
// Une ligne par annonce (les cartes de `articlesFavoris`, src/favorisEcran.js),
// avec le NOMBRE de personnes et celles à qui on peut écrire — sans pseudo.
//   bloque(id) : la ligne de favori ne peut plus recevoir de message (vendue,
//   déjà dans la file, envoyée, en conversation…) — la règle de FavorisVinted.
export function annoncesQui(cartes = [], bloque = () => false) {
  const liste = [];
  for (const c of Array.isArray(cartes) ? cartes : []) {
    const personnes = Array.isArray(c.personnes) ? c.personnes : [];
    const aEcrire = personnes.filter((p) => p && p.etat === 'a_envoyer' && !bloque(p.id)).map((p) => String(p.id));
    liste.push({
      cle: c.cle, itemId: c.itemId || null, titre: c.titre || '', numero: c.numero || '', photo: c.photo || null,
      prix: Number.isFinite(Number(c.prix)) && Number(c.prix) > 0 ? Number(c.prix) : null,
      personnes: personnes.length, aEcrire, vendu: !!c.vendu, choisissable: !c.vendu && aEcrire.length > 0,
      aVerifier: personnes.filter((p) => p && p.etat === 'a_verifier').length,
      aOuvrir: personnes.filter((p) => p && p.ouvrir).map((p) => String(p.id)),
      envoyes: personnes.filter((p) => p && p.etat === 'envoye').length,
      enCours: personnes.filter((p) => p && p.etat === 'en_cours').length,
    });
  }
  return liste;
}

// Les destinataires d'un envoi : les personnes à écrire des annonces CHOISIES,
// dans l'ordre des annonces, au plus `max`. Le reste attend le prochain envoi.
export function destinatairesChoisis(annonces = [], choisis = [], max = MAX_PAR_ENVOI) {
  const voulu = new Set((Array.isArray(choisis) ? choisis : []).map(String));
  const ids = [], parAnnonce = new Map();
  let reste = 0;
  for (const a of Array.isArray(annonces) ? annonces : []) {
    if (!a || !a.choisissable || !voulu.has(String(a.cle))) continue;
    for (const id of a.aEcrire) {
      if (ids.length < max) { ids.push(id); parAnnonce.set(a.cle, (parAnnonce.get(a.cle) || 0) + 1); } else reste++;
    }
  }
  return { ids, annonces: [...parAnnonce.keys()], parAnnonce, reste };
}

// ── QUOI : l'offre en clair ────────────────────────────────────────────────
// `prixOffre(prix, offre)` = prixOffreFavori (« 45.00 » ou null). Rien de
// calculé sans prix connu : `null` ⇒ l'écran dit « — » et la raison.
export function detailOffre(prix, offre, prixOffre) {
  const p = Number(prix);
  if (!offre || !offre.mode) return { sans: true };
  if (!(Number.isFinite(p) && p > 0) || typeof prixOffre !== 'function') return { inconnu: true };
  const apres = Number(prixOffre(p, offre));
  if (!(Number.isFinite(apres) && apres > 0)) return { sansOffre: true, prix: p };   // ≥ prix ou < 1 € : message seul
  const remise = Math.round((p - apres) * 100) / 100;
  return { prix: p, apres, remise, pct: Math.round((remise / p) * 100) };
}

// Le message découpé pour l'aperçu : {username} rendu comme une pastille
// (« son pseudo »), jamais un pseudo réel ni inventé ; une variante {a|b}
// montre son premier choix (comme l'extension avec un hasard à 0).
//   personnaliser = personnaliserMessageFavori.
export const JETON_PSEUDO = '\u0001';
export function morceauxApercu(message, personnaliser) {
  if (typeof personnaliser !== 'function') return [];
  const texte = personnaliser(String(message || ''), JETON_PSEUDO, () => 0);
  const out = [];
  texte.split(JETON_PSEUDO).forEach((t, i) => { if (i) out.push({ pseudo: true }); if (t) out.push({ texte: t }); });
  return out;
}

// ── QUAND : la durée, une estimation ───────────────────────────────────────
// rythme : 'vintex' (6 à 10 s au hasard) · 'fixe' (intervalle min) · 'aleatoire'
// (entre intervalle et intervalleMax min). Le premier message part tout de
// suite : n messages = n − 1 attentes. → secondes, ou null si les réglages
// ne sont pas lisibles (jamais un chiffre inventé).
export function estimationSecondes({ n = 0, rythme = 'vintex', intervalle = 0, intervalleMax = null } = {}) {
  const k = Math.max(0, Math.floor(Number(n) || 0));
  if (!k) return 0;
  let ecart;
  if (rythme === 'vintex') ecart = (RYTHME_VINTEX.min + RYTHME_VINTEX.max) / 2;
  else {
    const a = Number(intervalle), b = rythme === 'aleatoire' ? Number(intervalleMax) : a;
    if (!(Number.isFinite(a) && a >= 0 && Number.isFinite(b) && b >= a)) return null;
    ecart = ((a + b) / 2) * 60;
  }
  return Math.round((k - 1) * ecart);
}

// ── LE RÉCAPITULATIF ───────────────────────────────────────────────────────
//   jauge : { n, pourApp } (src/jaugeActions.js) ou null (pas lue).
export function recapEnvoi({ ids = [], annonces = [], reste = 0, avecOffre = false, rythme = 'vintex', intervalle = 0, intervalleMax = null, jauge } = {}) {
  const messages = ids.length;
  const gestes = messages * (avecOffre ? GESTES_AVEC_OFFRE : GESTES_PAR_MESSAGE);
  const secondes = estimationSecondes({ n: messages, rythme, intervalle, intervalleMax });
  let limite = 'passu';
  let libres = null;
  if (jauge && Number.isFinite(Number(jauge.n)) && Number.isFinite(Number(jauge.pourApp))) {
    libres = Math.max(0, Number(jauge.pourApp) - Number(jauge.n));
    limite = gestes <= libres ? 'dedans' : 'depasse';
  }
  return { messages, annonces: annonces.length, reste, gestes, secondes, limite, libres };
}

// ── LE SUIVI : un état de la file serveur → une issue de SuiviTravail ───────
// `raisonTexte(code)` : la phrase courte et le geste (RAISONS_ECRAN, via etatFavori).
// → null tant que rien n'est fini (attente, réserve).
export function issueSuivi(job, raisonTexte = () => ({})) {
  if (!job) return null;
  const e = job.etat;
  if (e === 'envoye') return { etat: 'ok' };
  if (e === 'attente' || e === 'reserve') return null;
  if (e === 'incertain') { const r = raisonTexte('incertain'); return { etat: 'main', raison: r.texte || '', geste: r.geste || '' }; }
  if (e === 'verifie') { const r = raisonTexte('verifie'); return { etat: 'main', raison: r.texte || '', geste: r.geste || '' }; }
  if (e === 'ignore' || e === 'annule') { const r = raisonTexte(e === 'ignore' ? 'ignore' : (job.raison || 'annule')); return { etat: 'saute', raison: r.texte || '', geste: r.geste || '' }; }
  const r = raisonTexte(job.raison || 'refuse');
  return { etat: 'refus', raison: r.texte || '', geste: r.geste || '' };
}

// ── L'HISTORIQUE : qui a acheté après un message ───────────────────────────
// jobs   : la vue de la file (`id` = « <n° d'annonce>:<n° de la personne> »,
//          posé par le SERVEUR qui a prouvé le destinataire), état « envoye ».
// ventes : [{ tx, itemId, acheteur, at }] — itemId lu de la transaction
//          (txnItem), acheteur = l'autre personne de la conversation de la
//          vente (null si la conversation n'est pas lue), at = date de vente.
// → { lignes:[{ itemId, envoyeLe, achatLe, tx }], envoyes, achats, ventesSansAcheteur }
export function achatsApresMessage(jobs = [], ventes = []) {
  const envoyes = [];
  for (const j of Array.isArray(jobs) ? jobs : []) {
    if (!j || j.etat !== 'envoye') continue;
    const m = /^([1-9]\d{0,19}):([1-9]\d{0,19})$/.exec(String(j.id || ''));
    if (!m) continue;
    const at = Number(j.envoyeLe || j.traiteLe);
    envoyes.push({ itemId: m[1], personne: m[2], envoyeLe: Number.isFinite(at) ? at : null, notificationId: j.notificationId != null ? String(j.notificationId) : '' });
  }
  const items = new Set(envoyes.map((e) => e.itemId));
  const lignes = [], vus = new Set();
  let ventesSansAcheteur = 0;
  for (const v of Array.isArray(ventes) ? ventes : []) {
    if (!v || !v.itemId || !items.has(String(v.itemId))) continue;
    if (!v.acheteur) { ventesSansAcheteur++; continue; }
    const at = Number(v.at);
    const e = envoyes.find((x) => x.itemId === String(v.itemId) && x.personne === String(v.acheteur));
    if (!e || !Number.isFinite(at) || e.envoyeLe == null || at < e.envoyeLe) continue;
    const k = String(v.tx || '') + ':' + e.itemId;
    if (vus.has(k)) continue;
    vus.add(k);
    lignes.push({ itemId: e.itemId, notificationId: e.notificationId, envoyeLe: e.envoyeLe, achatLe: at, tx: String(v.tx || '') });
  }
  lignes.sort((a, b) => b.achatLe - a.achatLe);
  return { lignes, envoyes: envoyes.length, achats: lignes.length, ventesSansAcheteur };
}

// Les ventes du compte, réduites aux identités utiles à l'historique (appelée par
// l'app, qui seule connaît ventes, transactions et conversations). Une vente
// annulée ne compte pas ; une conversation pas lue ⇒ acheteur null.
//   annulee(vente) → booléen ; txnItem : { tx: itemId } ; conversations : boîte lue.
export function ventesPourHistorique({ ventes = [], txnItem = {}, conversations = [], uid = '', annulee = () => false } = {}) {
  const u = String(uid || '');
  if (!u) return [];
  const autre = new Map();
  for (const c of Array.isArray(conversations) ? conversations : []) {
    if (!c || c.id == null || String(c._acc?.vinted_user_id || '') !== u) continue;
    const id = c.opposite_user && c.opposite_user.id;
    autre.set(String(c.id), id != null && /^[1-9]\d{0,19}$/.test(String(id)) ? String(id) : null);
  }
  const out = [];
  for (const v of Array.isArray(ventes) ? ventes : []) {
    if (!v || String(v._acc?.vinted_user_id || '') !== u || annulee(v)) continue;
    const tx = v.transaction_id != null ? String(v.transaction_id) : '';
    const itemId = tx && txnItem ? txnItem[tx] : null;
    if (!itemId) continue;
    const at = Date.parse(v.date || '');
    out.push({ tx, itemId: String(itemId), acheteur: v.conversation_id != null ? (autre.get(String(v.conversation_id)) || null) : null, at: Number.isFinite(at) ? at : null });
  }
  return out;
}
