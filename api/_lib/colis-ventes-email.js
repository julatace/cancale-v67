// ─────────────────────────────────────────────────────────────────────────────
// LES COLIS DES VENTES VUES PAR E-MAIL, CÔTÉ SERVEUR (8 nov.) — widget iPhone,
// rappels du matin et du soir, bilan de la semaine.
//
// Julien voyait un colis de moins sur l'iPhone que dans Ma journée : l'app compte
// une vente connue seulement par son e-mail (liste Vinted pas encore relue) dès
// que son bordereau (même n° de transaction, PDF) est arrivé
// (src/bordereauVenteEmail.js, docs/passation/2026-11-08-bordereau-des-email.md) ;
// api/widget.js et api/ship-reminders.js ne lisaient que la liste Vinted.
//
// ⇒ AUCUNE RÈGLE NOUVELLE ICI (§11) : les règles de l'app sont importées TELLES
//   QUELLES (fichiers purs, comme src/commandesFusion.js ailleurs dans api/) :
//   · `ventesEmailFraiches` (src/venteEmailFraiche.js) : un e-mail de VENTE avec
//     un n° de transaction, d'un compte LIÉ et pas écarté, arrivé APRÈS la
//     dernière lecture de la liste de ce compte (`capturedAt`), n° absent de la
//     liste lue ; une liste pas lue ⇒ rien (pas su) ;
//   · `colisVentesEmail` (src/bordereauVenteEmail.js) : seulement si un bordereau
//     avec PDF porte le MÊME n° de transaction, et si aucune preuve de départ ;
//   · les preuves de départ : `ventesPartiesParPreuve` (api/_lib/depart-vente.js,
//     la règle de Colis : Colis fait, expédié, panneau, e-mail du transporteur
//     pour le n° EXACT de SON bordereau, prise en charge `depart_*`) ;
//   · « écarté » : `compteEcarte` (api/_lib/ventes-regle.js, copie refabriquée de
//     l'app par `audit-bilan-semaine.cjs --recopie`).
// Identité = le n° de transaction, jamais le titre. Une vente connue de la liste
// Vinted ⇒ la liste gagne (sa règle `aExpedier` : une annulée sort).
// ─────────────────────────────────────────────────────────────────────────────
import { ventesEmailFraiches, requeteVentesEmail } from '../../src/venteEmailFraiche.js';
import { colisVentesEmail } from '../../src/bordereauVenteEmail.js';
import { ventesPartiesParPreuve } from './depart-vente.js';
import { compteEcarte } from './ventes-regle.js';

// La lecture PROJETÉE de l'app (`requeteVentesEmail` : scalaires `meta->>`,
// 30 derniers jours) — jamais `select=data` (la ligne porte l'adresse de l'acheteur).
export const reqVentesEmail = (maintenant = Date.now()) => `app_data?${requeteVentesEmail(maintenant)}`;

const ensembleDe = (v) => (v instanceof Set ? v : new Set(Array.isArray(v) ? v.map(String) : []));

// `mails`    : les lignes de `reqVentesEmail` (null = pas su ⇒ aucune) ;
// `comptes`  : les uid des comptes Vinted LIÉS (null = pas su ⇒ aucune) ;
// `masques`, `panneau` : le choix « hors des totaux » (`compteEcarte`) ;
// `connues`  : les n° de transaction lus dans les listes Vinted (tous comptes) ;
// `lectures` : uid → ms de la dernière lecture de SA liste (`capturedAt`) ;
// `ko`       : uid dont la liste n'a pas été lue (pas su) ;
// `bordsParTx` : { tx → bordereau } (`bordsParTransaction`, masqués exclus) ;
// le reste : les preuves de départ de `ventesPartiesParPreuve`.
// Rend { txs: [n°…], ventes: { tx → vente e-mail } } — chaque vente porte sa date
// (l'arrivée de l'e-mail : la limite estimée en part, comme dans l'app).
export function colisVentesEmailServeur({ mails = null, comptes = null, masques = null, panneau = null, connues = [], lectures = {}, ko = [],
  bordsParTx = {}, shipDone = {}, bordsShipped = {}, panelBordsDone = {}, lignesEmail = null, departs = null, entrants = null, etiquettes = null } = {}) {
  const vide = { txs: [], ventes: {} };
  if (!Array.isArray(mails) || !Array.isArray(comptes)) return vide;
  const m = ensembleDe(masques);
  const ventes = [...ensembleDe(connues)].map((t) => ({ transaction_id: t }));
  const fraiches = ventesEmailFraiches({
    mails, comptes: comptes.map((u) => ({ vinted_user_id: String(u) })),
    ecarte: (u) => compteEcarte(u, m, panneau || {}), ventes, ko, lectures,
  });
  if (!fraiches.length) return vide;
  const sur = new Set(ventes.map((o) => String(o.transaction_id)));
  const partis = ventesPartiesParPreuve({ txs: fraiches.map((o) => String(o.transaction_id)), bordsParTx, shipDone, bordsShipped, panelBordsDone, lignesEmail, departs, entrants, etiquettes });
  const out = colisVentesEmail({
    ventesEmail: fraiches, bordsParTx,
    connues: (tx) => sur.has(String(tx)),
    cachee: () => false,                                  // (29 oct.) une vente ne se masque plus
    partie: (o) => partis.has(String(o.transaction_id)),
  });
  const ventesOut = {};
  for (const x of out) ventesOut[x.txn] = x.o;
  return { txs: out.map((x) => x.txn), ventes: ventesOut };
}

// Les n° de transaction d'une liste de commandes Vinted.
export const txsDeCommandes = (orders) => (Array.isArray(orders) ? orders : []).filter((o) => o && o.transaction_id != null).map((o) => String(o.transaction_id));
