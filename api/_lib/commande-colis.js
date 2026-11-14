// ── LA COMMANDE D'UN COLIS, PAR IDENTITÉ — UNE RÈGLE POUR L'ÉCRAN ET LE SERVEUR (13 nov.) ──
// Julien : « avec le n° de suivi on va voir quelle paire est à l'intérieur de chaque colis ».
// L'écran (src/App.jsx, `commandeDuColis`) relie un colis à SON achat Vinted par trois
// identités, dans cet ordre, et JAMAIS par le titre, la date, le lieu ou l'adresse (§5) :
//   1. la CONVERSATION de sa commande (`t.conv`, e-mail Vinted « Commande mise à jour ») ;
//   2. le N° DE SUIVI (ligne de suivi Vinted relevée par l'extension — panneau « Détails »
//      depuis la 5.372 —, ou un n° relié à la main par SON clic) : `achatDuColis`
//      (src/liensColis.js), un seul achat candidat sinon personne ;
//   3. le CODE DE RETRAIT lu dans la conversation (`panel_colis_relais`) : deux
//      transactions au même code ⇒ personne.
// Ce module EST cette règle : l'app l'appelle, et le serveur (rappels « Demain dernier
// jour », « Dernier jour », arrivée « t'attend ») l'appelle aussi pour mettre le NOM DE LA
// PAIRE dans la notification — une règle, deux lecteurs (§11), aucune copie à la main.
// Pur : aucune lecture ici. Le serveur lui donne des lignes PROJETÉES (jamais `select=data`).
import { achatDuColis } from '../../src/liensColis.js';
import { achatParConversation } from './achat-arrive-relais.js';
import { normaliserSuivi } from './etat-colis-email.js';

// Le code de retrait comparable (la forme de `codeRetrait` de l'app : lettres puis chiffres).
export const codeColisNorm = (c) => { const x = String(c == null ? '' : c).toUpperCase().replace(/\s+/g, ''); return /^[A-Z]{0,2}\d{3,10}$/.test(x) ? x : ''; };

// Code de retrait → transaction (null si deux transactions portent le même code).
export function txParCodeDe(relais) {
  const m = new Map();
  for (const [tx, r] of Object.entries(relais || {})) { const c = r ? codeColisNorm(r.code) : ''; if (c) m.set(c, m.has(c) ? null : String(tx)); }
  return m;
}

// LA JONCTION. `t` : la ligne du colis ({ suivi, code, conv }). `achats` : les commandes
// d'achat ({ transaction_id, conversation_id, title, _acc }). `index` : les n° de suivi des
// achats (forme `indexSuivisAchats` de l'app). `txParCode` : `txParCodeDe(relais)`.
// `achatParTx` (facultatif) : Map(transaction → commande), sinon fabriquée ici.
export function commandeDuColisRegle(t, { achats = [], index = {}, txParCode = new Map(), achatParTx = null } = {}) {
  if (!t) return null;
  if (t.conv) { const ac = achatParConversation(t.conv, achats); if (ac) return ac; }
  const a = achatDuColis(t, achats, index); if (a) return a;
  const c = codeColisNorm(t.code); const tx = c && txParCode ? txParCode.get(c) : null;
  if (!tx) return null;
  const parTx = achatParTx || new Map((achats || []).map((o) => [String(o && o.transaction_id), o]));
  return parTx.get(tx) || null;
}

// ── Les formes du serveur (lignes projetées) ────────────────────────────────
// `liens` : la sortie de `liensDesLignes` (api/_lib/suivi-colis.js) — { uid, tx, suivi }.
// Rend l'index de l'app : « compte:transaction » (ou la transaction seule, sans compte).
export function indexDesLiens(liens) {
  const out = {};
  for (const l of (Array.isArray(liens) ? liens : [])) {
    if (!l || !l.tx) continue;
    const k = normaliserSuivi(l.suivi); if (!k) continue;
    const cle = l.uid ? `${l.uid}:${l.tx}` : String(l.tx);
    const e = out[cle] || (out[cle] = l.uid ? { uid: String(l.uid) } : {});
    e.suivis = [...new Set([...(e.suivis || []), k])];
  }
  return out;
}
// Les commandes d'achat des lignes `harvest_{uid}_orders_purchased` projetées ({ id, orders }),
// chacune marquée de SON compte (l'identité de la ligne).
export function achatsDesLignes(rows) {
  const out = [];
  for (const r of (Array.isArray(rows) ? rows : [])) {
    const m = /^harvest_(\w+?)_orders_purchased$/.exec(String((r && r.id) || '')); if (!m) continue;
    for (const o of (Array.isArray(r.orders) ? r.orders : [])) if (o && o.transaction_id != null) out.push({ ...o, _acc: m[1] });
  }
  return out;
}
// Le nom de la paire pour une notification : celui de l'achat relié par identité, sinon
// celui que l'e-mail de CE colis donne, sinon '' (le texte dit alors « Colis {transporteur} »).
export const titreDuColis = (commande, article = '') =>
  String((commande && commande.title) || article || '').replace(/\s+/g, ' ').trim().slice(0, 60);

// ── (13 nov., lot 7) LE NOM D'UN COLIS À RETIRER, PARTOUT LE MÊME ─────────────
// Julien : « chaque colis à retirer porte le nom de la paire qui est dedans ». Deux chemins
// d'identité cherchent la commande d'une ligne (le n° de suivi seul, `achatDuColis`, et la
// jonction complète conversation / n° / code, `commandeDuColisRegle`) : ils doivent DIRE LA
// MÊME commande. Deux commandes différentes ⇒ personne (mieux vaut « Colis {transporteur} »
// qu'un faux nom, §5). Les absents ne comptent pas.
export function commandeUnique(...cands) {
  const vus = cands.filter((o) => o && o.transaction_id != null);
  if (!vus.length) return null;
  const tx = String(vus[0].transaction_id);
  return vus.every((o) => String(o.transaction_id) === tx) ? vus[0] : null;
}
