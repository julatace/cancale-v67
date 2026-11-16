// api/_lib/soir-colis.js
// ────────────────────────────────────────────────────────────────────────────
// L'ALERTE DU SOIR, COLIS PAR COLIS (16 nov., lot alerte-soir-colis — mission
// validée par Julien : « une alerte le soir, UNE seule fois, s'il reste un colis
// à poster avant sa date limite »). Le résumé du soir (api/_lib/resume-soir.js,
// 10 nov.) comptait ses colis en NOMBRES : un colis en retard revenait chaque
// soir. Ici, la règle qui les prend UN PAR UN, par identité :
//   · Vinted : le n° de transaction (`v:<tx>`) ; eBay : le n° de commande (`e:<id>`) ;
//   · la classe : `demain` (date limite LUE demain), `retard` (lue, déjà passée ou
//     aujourd'hui), `verifier` (date ESTIMÉE — vente + 7 j — passée : un plancher,
//     jamais « en retard ») ; le reste (plus tard, estimée demain, sans date) n'est
//     pas dit — api/_lib/limite-envoi.js, la règle de l'app ;
//   · PAS DE RELANCE le lendemain pour le même colis, SAUF si sa date limite est
//     le lendemain : un colis déjà dit un soir précédent n'est redit que s'il
//     est `demain` (mémo `colis` de `soir_reminder_dedup`, { cle: jour }, 21 j) ;
//   · son N° (pour « N°215, N°193 ») : par l'identifiant d'annonce de SA
//     transaction (`item_id` du détail lu) → `vinted_annonce_numeros` — jamais par
//     le titre. Pas su ⇒ pas de N° (un blanc vaut mieux qu'un faux, §5).
// Pur : aucune lecture, aucune écriture (api/ship-reminders.js lit et écrit).
// ────────────────────────────────────────────────────────────────────────────
import { limiteExpedition, echeanceLimite } from './limite-envoi.js';

export const MEMO_JOURS = 21;

// Les colis Vinted du soir, un par transaction.
export function colisVintedDuSoir({ txs, ventes, bords, maintenant = Date.now() }) {
  const out = [];
  for (const tx of (txs || [])) {
    const k = String(tx);
    const l = limiteExpedition((ventes && ventes[k]) || null, (bords && bords[k]) || null, maintenant);
    if (l.at == null) continue;
    const c = echeanceLimite(l, maintenant).classe;
    const lue = l.limite !== 'estimee';
    let classe = null;
    if (c === 'demain' && lue) classe = 'demain';
    else if (c === 'retard' || (c === 'aujourdhui' && lue)) classe = 'retard';
    else if (c === 'estimeeDepassee' || (c === 'aujourdhui' && !lue)) classe = 'verifier';
    if (classe) out.push({ cle: 'v:' + k, tx: k, classe, at: l.at, heure: classe === 'demain' ? l.heure : null });
  }
  return out;
}

// Les colis eBay du soir (`colisEbay(...).aPoster`, la règle de Colis) : `jours` 1 ⇒ demain,
// 0 ou moins ⇒ en retard ; sans date ⇒ rien.
export function colisEbayDuSoir(aPoster) {
  const out = [];
  for (const x of (aPoster || [])) {
    if (!x || x.jours == null || !x.orderId) continue;
    const classe = x.jours === 1 ? 'demain' : x.jours <= 0 ? 'retard' : null;
    if (classe) out.push({ cle: 'e:' + String(x.orderId), classe });
  }
  return out;
}

const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

// Ce qui se dit ce soir : un colis déjà dit un AUTRE jour ne revient que si sa limite est demain.
export function aDireCeSoir(colis, memo, today) {
  const dits = objet(memo);
  return (colis || []).filter((c) => c.classe === 'demain' || !dits[c.cle] || dits[c.cle] === today);
}

// Le mémo après l'envoi : chaque colis dit, daté de ce soir ; les entrées de plus de 21 jours partent.
export function memoColisApres(memo, dits, today) {
  const out = {};
  const limite = Date.parse(today + 'T12:00:00Z') - MEMO_JOURS * 86400000;
  for (const [k, j] of Object.entries(objet(memo))) if (typeof j === 'string' && Date.parse(j + 'T12:00:00Z') >= limite) out[k] = j;
  for (const c of (dits || [])) out[c.cle] = today;
  return out;
}

// Les N° des colis Vinted (par identité) : `itemDeTx` { tx: item_id } (détail de la transaction),
// `numeroDItem` { item_id: numero } (`vinted_annonce_numeros`). Rend { tx: 'N°' } ; inconnu ⇒ absent.
export function numerosDesColis(colis, itemDeTx, numeroDItem) {
  const out = {};
  for (const c of (colis || [])) {
    if (!c.tx) continue;
    const it = objet(itemDeTx)[c.tx];
    const n = it != null ? objet(numeroDItem)[String(it)] : null;
    if (typeof n === 'string' && n.trim() && n.length <= 12) out[c.tx] = n.trim();
  }
  return out;
}
