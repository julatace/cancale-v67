// ═══════════════════════════════════════════════════════════════════════════
//  LE PRIX D'ACHAT DEMANDÉ LE JOUR DE LA VENTE (11 nov., saisie rapide)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (validé le 11 nov.) : quand une vente est PROUVÉE (CLAUDE.md §5) sur une
// paire SANS prix d'achat, une notification « Vendu 80 € · N°124 : combien tu
// l'avais payée ? » ; le toucher ouvre une petite feuille avec le champ prix, rien
// d'autre ; le prix s'écrit sur la fiche PAR IDENTITÉ (l'annonce de la vente).
//   · une fois par vente (le serveur réserve avant d'envoyer, `api/_lib/prix-achat-demande.js`) ;
//   · jamais la nuit (heure de Paris, 22 h – 8 h) ; les réglages de notifications
//     existants décident ensuite (famille « Ventes », heures calmes) ;
//   · plusieurs ventes en même temps ⇒ UNE notification ;
//   · une carte dans Ma journée tant que le prix est vide.
// ⚠️ §2.5 : c'est LUI qui saisit le prix ; rien n'est deviné ici, jamais.
// ⚠️ §5 : la vente vient de la PREUVE de l'app (`lirePreuvesVenteVinted`, ses
//    `paires` transaction → annonce) ; une vente non prouvée n'est jamais demandée.
// Module PUR : la coque (src/DemandePrixAchat.jsx), le serveur et
// `scripts/audit-prix-achat-vente.cjs` l'exécutent tel quel.

// Une vente de moins de 3 jours seulement : « le jour de la vente », pas l'arriéré
// (l'arriéré a déjà sa porte : « Coût d'achat · 1/184 renseigné »).
export const FENETRE_MS = 3 * 86400000;
export const MAX_GROUPE = 5;                  // ventes nommées dans une même demande
export const CLE_DEMANDES = 'vrm_prix_achat_demandes';   // la mémoire du serveur (une ligne par vendeur)
const TX = /^\d{1,20}$/;
const str = (v) => String(v == null ? '' : v).trim();

// La nuit, à Paris : de 22 h à 8 h (les bornes de `CALME_DEFAUT`, api/_lib/notif-textes.js).
export function estNuitParis(ms = Date.now()) {
  let h;
  // `formatToParts` : « 23 h » (fr-FR) n'est pas un nombre, la part `hour` l'est.
  try { const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)).find((x) => x.type === 'hour'); h = Number(p && p.value); } catch (_) { h = (new Date(ms).getUTCHours() + 1) % 24; }
  if (!Number.isFinite(h)) return false;
  return h >= 22 || h < 8;
}

// Un prix d'achat CONNU (la règle de l'app : `prixAchatDe`, passée en argument),
// ou un achat relié : on ne demande pas.
const prixConnu = (fiche, prixDe) => {
  const f = fiche && typeof fiche === 'object' ? fiche : {};
  if (f.buyFromId != null && str(f.buyFromId) !== '') return true;
  const p = typeof prixDe === 'function' ? prixDe(f) : null;
  return p != null && Number.isFinite(Number(p));
};

// Les ventes à demander.
//   paires   [{ tx, uid, item }] — les ventes PROUVÉES (transaction → annonce)
//   ventes   les commandes vendues lues (`transaction_id`, `price`, `date`, `status`)
//   fiches   `vinted_annonce_numeros` ({ [idAnnonce]: fiche })
//   prixDe   (fiche) ⇒ nombre | null : la règle du prix d'achat de l'app
//   annulee  (commande) ⇒ bool : la règle « pas une vente » de l'app
//   montant  (commande) ⇒ nombre | null : la lecture du prix de l'app
// Rend [{ tx, uid, item, num, eur, ts }] — triées de la plus récente à la plus
// ancienne. Une paire sans N° n'est pas demandée (le N° est ce qu'il écrit sur le
// carton : la phrase en a besoin) ; une vente sans date ou de plus de 3 jours non plus.
export function ventesSansPrix({ paires, ventes, fiches, prixDe, annulee, montant, maintenant = Date.now() } = {}) {
  if (!Array.isArray(paires) || !Array.isArray(ventes) || !fiches || typeof fiches !== 'object') return [];
  const parTx = new Map();
  for (const o of ventes) if (o && o.transaction_id != null) parTx.set(str(o.transaction_id), o);
  const out = [], vus = new Set();
  for (const p of paires) {
    const tx = str(p && p.tx), item = str(p && p.item);
    if (!TX.test(tx) || !item || vus.has(tx)) continue;
    const o = parTx.get(tx);
    if (!o) continue;                                         // pas lue : pas de prix de vente à dire
    if (typeof annulee === 'function' && annulee(o)) continue;
    const ts = Date.parse(o.date || '');
    if (!Number.isFinite(ts) || maintenant - ts > FENETRE_MS || ts - maintenant > 86400000) continue;
    const f = fiches[item];
    if (!f || !str(f.numero)) continue;
    if (prixConnu(f, prixDe)) continue;
    const eur = typeof montant === 'function' ? montant(o) : null;
    vus.add(tx);
    out.push({ tx, uid: str(p.uid), item, num: str(f.numero), eur: eur != null && Number.isFinite(Number(eur)) ? Number(eur) : null, ts });
  }
  return out.sort((a, b) => b.ts - a.ts);
}

const eurTexte = (n) => {
  if (n == null || !Number.isFinite(Number(n))) return '';
  const c = Math.round(Number(n) * 100);
  return (c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2).replace('.', ',')) + ' €';
};

// Le texte de la notification (et de la carte) : une vente, ou plusieurs.
export function texteDemande(liste) {
  const l = Array.isArray(liste) ? liste.filter(Boolean) : [];
  if (!l.length) return null;
  if (l.length === 1) {
    const v = l[0]; const e = eurTexte(v.eur);
    return { title: `${e ? `Vendu ${e}` : 'Vendu'} · N°${v.num}`, body: 'Combien tu l’avais payée ?' };
  }
  const nums = l.slice(0, 3).map((v) => `N°${v.num}`).join(', ') + (l.length > 3 ? '…' : '');
  return { title: `${l.length} ventes sans prix d’achat`, body: `${nums} : combien tu les avais payées ?` };
}

// L'adresse ouverte par le toucher : Ma journée, la feuille des prix de CES ventes
// (identités : les n° de transaction, au plus `MAX_GROUPE`).
export function lienDemande(txs) {
  const l = (Array.isArray(txs) ? txs : []).map(str).filter((t) => TX.test(t)).slice(0, MAX_GROUPE);
  return '/?tab=journee&cible=prixachat' + (l.length ? '&tx=' + l.join('_') : '');
}
// Les ventes demandées par une adresse (`?cible=prixachat&tx=1_2`) — [] sinon.
export function txsDuLien(search) {
  let p; try { p = new URLSearchParams(String(search || '')); } catch (_) { return null; }
  if (p.get('cible') !== 'prixachat') return null;
  return str(p.get('tx')).split('_').filter((t) => TX.test(t)).slice(0, MAX_GROUPE);
}

// Ce que l'app envoie au serveur (rien d'autre : le serveur relit la transaction).
export function corpsDemande(liste) {
  return { action: 'prixachat', ventes: (Array.isArray(liste) ? liste : []).slice(0, 20).map((v) => ({ tx: str(v.tx), uid: str(v.uid), num: str(v.num).slice(0, 12), eur: v.eur != null && Number.isFinite(Number(v.eur)) ? Math.round(Number(v.eur) * 100) / 100 : null })) };
}

// La mémoire « déjà demandée » : { demandes: { [tx]: iso } }. Ce qui reste à demander.
export function aDemander(memo, liste) {
  const d = memo && typeof memo === 'object' && memo.demandes && typeof memo.demandes === 'object' ? memo.demandes : {};
  return (Array.isArray(liste) ? liste : []).filter((v) => v && TX.test(str(v.tx)) && !d[str(v.tx)]);
}
// La mémoire après la réservation (les plus vieilles oubliées au-delà de 500 : une vente a 3 jours).
export function reserver(memo, txs, maintenant = Date.now()) {
  const d = { ...((memo && memo.demandes && typeof memo.demandes === 'object') ? memo.demandes : {}) };
  const at = new Date(maintenant).toISOString();
  for (const t of txs) d[str(t)] = at;
  const cles = Object.keys(d).sort((a, b) => String(d[b]).localeCompare(String(d[a]))).slice(0, 500);
  const out = {}; for (const k of cles) out[k] = d[k];
  return { ...(memo && typeof memo === 'object' ? memo : {}), demandes: out };
}
