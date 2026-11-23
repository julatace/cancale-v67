// ════════════════════════════════════════════════════════════════════════════
//  MESSAGES AUX FAVORIS → VENTES OBTENUES (21 nov., ext. 5.420 — `favorisreponses`)
//  Julien : « intègre aussi les statistiques sur les ventes qui ont abouti avec un message, une offre, etc. ; tout doit
//  être parfait ». UNE règle, pure (aucune lecture), utilisée par l'app (Statistiques › Pilotage) et, recopiée telle
//  quelle, par l'extension (panneau → Favoris → Statistiques) : `node scripts/audit-favoris-ventes.cjs --recopie`.
//
//  Entrées (rien d'autre n'est lu) :
//    envois : les messages PARTIS à des favoris (ligne `favoris_reponses_{uid}_{nav}`, une entrée par envoi) :
//             { t (heure), k (version), o (offre faite), i (annonce), a (acheteur, si lu), r (1re réponse), oa (NOTRE offre
//             acceptée), ob (l'acheteur a fait SON offre après), au (envoi automatique), l (fil relu), compte } ;
//    ventes : les ventes PROUVÉES (Vinted) : { tx, item, ts (date de vente, ms), dateSure, acheteur, montant (€),
//             benefice (€, la règle Compta du propriétaire, null si l'achat n'est pas connu), prixAnnonce (€), compte }.
//  Attribution PAR IDENTITÉ SEULEMENT (§5) : une vente est attribuée à l'envoi le plus récent qui porte LA MÊME annonce,
//  parti avant la vente et au plus 14 jours avant ; si l'acheteur est lu des DEUX côtés, il doit être le même (sinon la
//  vente n'est pas attribuée : « sans contact »). Jamais un titre, jamais une ressemblance.
//  Une vente sans date sûre n'entre dans AUCUNE fenêtre : si une annonce contactée la porte, elle est comptée à part
//  (`incertaines`, le « au moins » de l'écran). Une moyenne ou un taux sur moins de 3 cas vaut `null` (l'écran dit « — »).
//  Répartition des ventes de la fenêtre : « message seul » · « message + offre acceptée » (notre offre acceptée) ·
//  « offre de l'acheteur après message » · « vente sans contact » (pour comparer).
// ════════════════════════════════════════════════════════════════════════════
// <favoris-ventes-regle>
const FV_JOURS = 14;
const FV_MIN_CAS = 3;
const FV_CATEGORIES = ['message_seul', 'message_offre', 'offre_acheteur', 'sans_contact'];
function fvEntonnoir() { return { contactes: 0, relues: 0, reponses: 0, offresAcceptees: 0, ventes: 0, auto: 0 }; }
function fvTaux(n, d) { return d >= FV_MIN_CAS ? Math.round((n * 100) / d) : null; }
function fvNum(v) { const n = Number(v); return v != null && v !== '' && Number.isFinite(n) ? n : null; }
// L'envoi auquel une vente revient (identité), ou null.
function fvEnvoiDeVente(v, envois) {
  const item = v && v.item != null ? String(v.item) : '';
  const ts = fvNum(v && v.ts);
  if (!item || ts == null || !(v.dateSure !== false)) return null;
  let best = null;
  for (const e of envois) {
    if (!e || String(e.i || '') !== item) continue;
    const t = fvNum(e.t);
    if (t == null || t > ts || ts - t > FV_JOURS * 864e5) continue;
    if (v.compte && e.compte && String(v.compte) !== String(e.compte)) continue;
    if (v.acheteur && e.a && String(v.acheteur) !== String(e.a)) continue;
    if (!best || t > fvNum(best.t)) best = e;
  }
  return best;
}
function fvCategorie(e) { return !e ? 'sans_contact' : e.oa ? 'message_offre' : e.ob ? 'offre_acheteur' : 'message_seul'; }
function attribuerVentesFavoris({ envois, ventes, de, a }) {
  const E = (Array.isArray(envois) ? envois : []).filter((e) => e && fvNum(e.t) != null);
  const V = Array.isArray(ventes) ? ventes.filter((v) => v && v.item != null) : null;
  const dans = (t) => t != null && t >= de && t < a;
  const total = fvEntonnoir(), parCompte = {}, parVersion = {};
  const ajouter = (o, champ) => { o[champ] += 1; };
  const groupes = (e) => [total, parCompte[String(e.compte || '')] = parCompte[String(e.compte || '')] || fvEntonnoir(), parVersion[String(e.k || '')] = parVersion[String(e.k || '')] || fvEntonnoir()];
  for (const e of E) {
    if (!dans(fvNum(e.t))) continue;
    for (const g of groupes(e)) {
      ajouter(g, 'contactes');
      if (fvNum(e.r) > 0 || fvNum(e.l) > 0) ajouter(g, 'relues');
      if (fvNum(e.r) > 0) ajouter(g, 'reponses');
      if (e.oa) ajouter(g, 'offresAcceptees');
      if (e.au) ajouter(g, 'auto');
    }
  }
  if (!V) return { total, parCompte, parVersion, repartition: null, incertaines: null, attribuees: null, tauxReponse: fvTaux(total.reponses, total.relues) };
  const repartition = { message_seul: 0, message_offre: 0, offre_acheteur: 0, sans_contact: 0 };
  let incertaines = 0;
  const att = { n: 0, ca: 0, caN: 0, benefice: 0, beneficeN: 0, delais: [], remises: [], auto: 0 };
  const contactees = new Set(E.map((e) => String(e.i || '')).filter(Boolean));
  for (const v of V) {
    const ts = fvNum(v.ts);
    if (ts == null || v.dateSure === false) { if (contactees.has(String(v.item))) incertaines += 1; continue; }
    if (!dans(ts)) continue;
    const e = fvEnvoiDeVente(v, E);
    repartition[fvCategorie(e)] += 1;
    if (!e) continue;
    for (const g of groupes(e)) ajouter(g, 'ventes');
    att.n += 1; if (e.au) att.auto += 1;
    const m = fvNum(v.montant); if (m != null) { att.ca += Math.round(m * 100); att.caN += 1; }
    const b = fvNum(v.benefice); if (b != null) { att.benefice += Math.round(b * 100); att.beneficeN += 1; }
    att.delais.push(ts - fvNum(e.t));
    const p = fvNum(v.prixAnnonce); if (m != null && p != null && p > 0 && m <= p) att.remises.push(((p - m) * 100) / p);
  }
  const moyenne = (l) => (l.length >= FV_MIN_CAS ? l.reduce((s, x) => s + x, 0) / l.length : null);
  const dm = moyenne(att.delais);
  const rm = moyenne(att.remises);
  return {
    total, parCompte, parVersion, repartition, incertaines,
    tauxReponse: fvTaux(total.reponses, total.relues),
    tauxVente: fvTaux(total.ventes, total.contactes),
    attribuees: {
      n: att.n, auto: att.auto,
      ca: att.caN ? att.ca / 100 : null, caPartiel: att.caN < att.n,
      benefice: att.beneficeN ? att.benefice / 100 : null, beneficePartiel: att.beneficeN < att.n, beneficeN: att.beneficeN,
      delaiMoyenJours: dm == null ? null : Math.round((dm / 864e5) * 10) / 10,
      remiseMoyennePct: rm == null ? null : Math.round(rm * 10) / 10,
    },
  };
}
// </favoris-ventes-regle>
export { FV_JOURS, FV_MIN_CAS, FV_CATEGORIES, attribuerVentesFavoris, fvEnvoiDeVente, fvCategorie };
