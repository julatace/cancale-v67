// ═══════════════════════════════════════════════════════════════════════════
// TAUX D'ACCEPTATION DES OFFRES, COMPTE PAR COMPTE (14 nov., lot argent-prix —
// proposition 113 validée par Julien : « reçues, acceptées, payées »)
// ═══════════════════════════════════════════════════════════════════════════
// MESURÉ d'abord : `statsOffres` (src/statsOffres.js, carte « Les offres ») compte
// déjà, par compte, les offres REÇUES et ACCEPTÉES (conversations captées,
// `offer_request_message`, une offre par `offer_request_id`). Ce qui manquait :
// « payée » (l'acheteur a-t-il payé l'offre acceptée ?) et les deux TAUX.
// Aucune règle neuve sur les offres : `offresDeConversation` est celle de la carte.
//
// PAYÉE se PROUVE par IDENTITÉ (§5), jamais par titre ni par prix :
//   la conversation porte SA transaction (`transaction.id`, projeté avec les
//   messages) ; cette transaction est une VENTE prouvée (une ligne Vinted de
//   `ventesFaites` portant ce `tx` — la règle du « vendu »). Une conversation =
//   une transaction : si plusieurs offres y ont été acceptées, seule la DERNIÈRE
//   peut être celle qui a été payée ; les précédentes ne l'ont pas été.
// Trois états (§5) pour chaque offre acceptée :
//   · 'payee'     — sa transaction est une vente prouvée ;
//   · 'nonPayee'  — ventes lues, aucune vente pour cette transaction, acceptée il
//                   y a plus de ATTENTE_PAIEMENT_H (l'acheteur n'a pas payé) ;
//   · 'attente'   — acceptée depuis moins de ATTENTE_PAIEMENT_H : pas encore jugée ;
//   · 'passu'     — la conversation ne porte pas de transaction, ou les ventes ne
//                   sont pas lues : ni payée ni non payée — comptée à part, dite.
// Les taux :
//   · acceptation = acceptées / reçues (sur la période, par la date de l'offre) ;
//   · paiement    = payées / (payées + non payées) — les offres « en attente » et
//                   « pas su » n'entrent ni au numérateur ni au dénominateur ;
//                   la couverture est dite (« sur 12 acceptées jugées »).
// Une période qui dépasse la dernière lecture des conversations d'un compte :
// « au moins » sur les nombres (la carte des offres a la même règle) ; aucune
// conversation lue ⇒ `null` partout (« — »), jamais 0.
// Module PUR. Exécuté par scripts/audit-argent-prix.cjs (section 113).
// ═══════════════════════════════════════════════════════════════════════════
import { offresDeConversation } from './statsOffres.js';

export const ATTENTE_PAIEMENT_H = 48;
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);

// convs  : [{ compte, side, opp, tx, messages }] | null (pas lu) | undefined (en cours)
// ventes : les lignes Vinted de `ventesFaites` ({ tx, uid, plateforme }) — TOUTES (une
//          offre acceptée le 30 peut être payée le 1er) | null | undefined
// lectures : { [uid]: dernière lecture des conversations (ms) }
export function tauxOffresComptes({ convs, ventes, lectures = {}, de = -Infinity, a = Infinity, maintenant = Date.now() } = {}) {
  if (convs === undefined || ventes === undefined) return { etat: 'encours', comptes: [], total: null };
  if (!Array.isArray(convs)) return { etat: 'passu', comptes: [], total: null };
  const ventesLues = Array.isArray(ventes);
  const vendus = new Set();
  if (ventesLues) for (const l of ventes) if (l && (!l.plateforme || l.plateforme === 'Vinted') && l.tx != null && String(l.tx) !== '') vendus.add(String(l.tx));
  const attenteMs = ATTENTE_PAIEMENT_H * 3600000;
  const par = new Map();
  const g = (k) => { if (!par.has(k)) par.set(k, { compte: k, recues: 0, acceptees: 0, payees: 0, nonPayees: 0, attente: 0, passu: 0 }); return par.get(k); };
  for (const k of Object.keys(lectures || {})) g(String(k));
  for (const c of convs) {
    if (!c) continue;
    const k = String(c.compte || '');
    const offres = offresDeConversation(c).filter((o) => o.ts != null).sort((x, y) => x.ts - y.ts);
    if (!offres.length) continue;
    const tx = c.tx != null && String(c.tx) !== '' ? String(c.tx) : '';
    const acceptees = offres.filter((o) => o.etat === 'acceptee');
    const derniere = acceptees.length ? acceptees[acceptees.length - 1] : null;
    for (const o of offres) {
      if (!(o.ts >= de && o.ts < a)) continue;
      const G = g(k);
      G.recues += 1;
      if (o.etat !== 'acceptee') continue;
      G.acceptees += 1;
      let e;
      if (!tx || !ventesLues) e = 'passu';
      else if (o === derniere && vendus.has(tx)) e = 'payee';
      else if (o === derniere && maintenant - o.ts < attenteMs) e = 'attente';
      else e = 'nonPayee';
      if (e === 'payee') G.payees += 1; else if (e === 'nonPayee') G.nonPayees += 1; else if (e === 'attente') G.attente += 1; else G.passu += 1;
    }
  }
  const fin = Math.min(a, maintenant);
  const finir = (G, lu) => {
    const partiel = !(Number.isFinite(lu) && lu >= fin);
    const rien = partiel && G.recues === 0;
    const juges = G.payees + G.nonPayees;
    return {
      compte: G.compte, luJusqua: Number.isFinite(lu) ? lu : null, partiel: !rien && partiel,
      recues: rien ? null : G.recues, acceptees: rien ? null : G.acceptees,
      payees: rien || !ventesLues ? null : G.payees, nonPayees: rien || !ventesLues ? null : G.nonPayees,
      attente: rien ? null : G.attente, passu: rien ? null : G.passu, juges: rien || !ventesLues ? null : juges,
      tauxAcceptation: rien ? null : pct(G.acceptees, G.recues),
      tauxPaiement: rien || !ventesLues ? null : pct(G.payees, juges),
    };
  };
  const comptes = [...par.values()].map((G) => finir(G, Number(lectures && lectures[G.compte])))
    .sort((x, y) => (y.recues || 0) - (x.recues || 0) || (x.compte < y.compte ? -1 : 1));
  const T = { compte: '', recues: 0, acceptees: 0, payees: 0, nonPayees: 0, attente: 0, passu: 0 };
  for (const G of par.values()) for (const k of Object.keys(T)) if (k !== 'compte') T[k] += G[k];
  const lus = Object.values(lectures || {}).map(Number).filter(Number.isFinite);
  const total = finir(T, lus.length && par.size ? Math.min(...lus) : NaN);
  if (comptes.some((c) => c.partiel || c.recues == null)) total.partiel = total.recues != null;
  return { etat: 'lu', comptes, total, ventesLues };
}
