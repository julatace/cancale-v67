// Codes observés dans les conversations Vinted : 10 attente, 20 acceptée, 30 refusée.
const texte = (v) => (typeof v === "string" ? v.trim() : "");
export function etatOffreVinted(e = {}) {
  const titre = texte(e.status_title),
    lisible = titre && !/^[a-z]+(?:_[a-z]+)+$/.test(titre);
  if (e.status === 20) return { etat: "acceptee", libelle: "Offre acceptée" };
  if (e.status === 30) return { etat: "refusee", libelle: "Offre refusée" };
  if (/expir|annul|cancel|retir/i.test(titre))
    return { etat: "terminee", libelle: lisible ? titre : "Offre terminée" };
  if (e.current === false)
    return { etat: "precedente", libelle: "Offre précédente" };
  if (e.status === 10) return { etat: "attente", libelle: "En attente" };
  // Never infer acceptance from « en attente d'acceptation » or « non acceptée ».
  if (
    /^(?:offre\s+)?accept[ée]e?[.!]?$/i.test(titre) ||
    /^accepted$/i.test(titre)
  )
    return { etat: "acceptee", libelle: lisible ? titre : "Offre acceptée" };
  if (
    /^(?:offre\s+)?refus[ée]e?[.!]?$/i.test(titre) ||
    /^(?:rejected|declined)$/i.test(titre)
  )
    return { etat: "refusee", libelle: lisible ? titre : "Offre refusée" };
  return { etat: "inconnu", libelle: lisible ? titre : "Statut à vérifier" };
}
export function offreVintedEnAttente(c = {}) {
  const opp = c.opposite_user?.id;
  if (opp == null) return null;
  const index = new Map();
  for (const m of Array.isArray(c.messages) ? c.messages : []) {
    if (m?.entity_type !== "offer_request_message") continue;
    const e = m.entity || {};
    if (e.transaction_id == null || e.offer_request_id == null) continue;
    const cle = String(e.transaction_id) + ":" + String(e.offer_request_id),
      avant = index.get(cle);
    // Une capture plus pauvre ne réouvre pas une offre dont la fin est connue.
    if (
      avant &&
      ["acceptee", "refusee", "terminee", "precedente"].includes(
        etatOffreVinted(avant.entity).etat,
      ) &&
      e.status === 10
    )
      continue;
    index.set(cle, m);
  }
  const offres = [];
  for (const m of index.values()) {
    const e = m.entity;
    if (
      e.user_id == null ||
      String(e.user_id) !== String(opp) ||
      e.status !== 10 ||
      etatOffreVinted(e).etat !== "attente"
    )
      continue;
    if (
      !/^\d+$/.test(String(e.transaction_id)) ||
      !/^\d+$/.test(String(e.offer_request_id))
    )
      continue;
    if (
      c.transaction?.id != null &&
      String(c.transaction.id) !== String(e.transaction_id)
    )
      continue;
    const brut =
      e.price && typeof e.price === "object" ? e.price.amount : e.price;
    if (!/^\d+(?:[,.]\d{1,2})?$/.test(String(brut ?? "").trim())) continue;
    const prix = Number(String(brut).replace(",", "."));
    if (!(prix > 0) || !Number.isFinite(prix)) continue;
    const devise = e.price?.currency_code || e.price?.currency;
    if (devise && devise !== "EUR") continue;
    const date =
        m.created_at_ts ?? e.created_at_ts ?? m.created_at ?? e.created_at,
      nb = Number(date);
    const ts =
      date == null || date === ""
        ? null
        : Number.isFinite(nb)
          ? nb < 1e12
            ? nb * 1000
            : nb
          : Date.parse(date) || null;
    offres.push({
      prix,
      tx: String(e.transaction_id),
      oid: String(e.offer_request_id),
      ts,
    });
  }
  // Deux offres prétendument courantes : aucune identité choisie arbitrairement.
  return offres.length === 1 ? offres[0] : null;
}
export const cleOffreVinted = (uid, off) => `${uid}:${off.tx}:${off.oid}`;
export function appliquerOffresConfirmees(c, uid, preuves) {
  if (!Array.isArray(c?.messages)) return c;
  return {
    ...c,
    messages: c.messages.map((m) => {
      const e = m?.entity;
      if (m?.entity_type !== "offer_request_message" || !e || e.status !== 10)
        return m;
      const statut = preuves.get(
        cleOffreVinted(uid, { tx: e.transaction_id, oid: e.offer_request_id }),
      );
      return statut === 20 || statut === 30
        ? {
            ...m,
            entity: {
              ...e,
              status: statut,
              status_title: statut === 20 ? "Offre acceptée" : "Offre refusée",
            },
          }
        : m;
    }),
  };
}
// ── UNE OFFRE N'ATTEND PLUS QUAND SON ANNONCE N'EST PLUS EN VENTE (29 oct.) ──
// Julien : « il y a un message d'une XT-6 qui ne veut pas s'enlever, je veux que
// ça dégage ». MESURÉ (lecture seule) : une conversation d'un de ses comptes,
// « salomon XT-6 blanc taille 40 », une offre de 60 € captée « En attente » le
// 16 septembre et jamais recapturée ; son annonce n'est plus dans
// AUCUN dressing — celui du compte est lu en entier le 29 octobre. La capture
// d'il y a six semaines gardait sa pastille « Offre 60 € en attente », passait
// EN TÊTE de la liste (une offre en attente passe devant) et proposait
// Accepter / Refuser sur une annonce qui n'existe plus.
// La règle, par IDENTITÉ (l'annonce de la transaction, jamais le titre, §5) : une
// offre se fait sur une annonce ; si une lecture COMPLÈTE du dressing de CE compte,
// faite APRÈS l'offre, ne montre plus l'annonce (ni en ligne, ni « à confirmer »,
// ni masquée par Vinted, ni en brouillon), l'offre ne peut plus être acceptée.
// `lecture` = { enLigne, aConfirmer, masquees, brouillons : Set d'id d'annonce,
// lues : { [uid]: ms }, ko : Set d'uid } — tirée de la MÊME lecture que l'écran
// Annonces (§11). Rend 'oui' (en ligne) · 'non' (prouvée plus en vente) · null
// (pas su : dressing pas lu, lu avant l'offre, offre sans date, annonce inconnue).
// « Pas su » ne cache rien : une offre cachée à tort fait rater une vente.
// ⚠️ (29 oct., revue) Seulement quand il est le VENDEUR (`side === 'seller'`) :
// la contre-offre d'un vendeur à qui IL achète porte l'annonce de ce vendeur, qui
// n'est jamais dans SES dressings — la juger « plus en vente » cachait Accepter et
// affirmait un faux. Côté inconnu ou acheteur ⇒ `null` (pas su, l'offre reste).
export function annonceOffreEnVente(off, uid, lecture) {
 if (!off || !lecture || typeof lecture !== 'object') return null;
 if (off.side !== 'seller') return null;
 const item = off.item != null ? String(off.item).trim() : '';
 if (!/^\d+$/.test(item)) return null;
 const a = (s) => !!(s && typeof s.has === 'function' && s.has(item));
 if (a(lecture.enLigne)) return 'oui';
 if (a(lecture.aConfirmer) || a(lecture.masquees) || a(lecture.brouillons)) return null;
 const u = String(uid == null ? '' : uid);
 if (!u || (lecture.ko && typeof lecture.ko.has === 'function' && lecture.ko.has(u))) return null;
 // ⚠️ `Number(null)` vaut 0 : une offre SANS date passerait pour « plus ancienne
 // que tout » et serait cachée. Absent ⇒ NaN ⇒ pas su.
 const nb = (v) => (v == null || v === '' ? NaN : Number(v));
 const lu = nb(lecture.lues && lecture.lues[u]), ts = nb(off.ts);
 if (!Number.isFinite(lu) || !Number.isFinite(ts) || !(lu > ts)) return null;
 return 'non';
}
// L'offre telle que l'écran la montre : `null` quand son annonce est prouvée
// partie, sinon l'offre inchangée (« pas su » la garde).
export const offreOuverte = (off, uid, lecture) => (off && annonceOffreEnVente(off, uid, lecture) === 'non' ? null : off || null);
