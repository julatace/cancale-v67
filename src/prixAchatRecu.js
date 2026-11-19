// ═══════════════════════════════════════════════════════════════════════════
// LE PRIX D'ACHAT SE POSE SEUL, DEPUIS LE REÇU (19 nov. 2026, décision de Julien)
// ═══════════════════════════════════════════════════════════════════════════
// Julien, 19 nov. (« 2 oui », texte exact : docs/passation/2026-11-19-demandes-julien.md,
// « DÉCISIONS DE JULIEN » §2) : « Le montant du REÇU de CET achat (son n° de transaction)
// est posé quand l'achat reçoit son N° (ou quand il est relié par identité) ; jamais
// deviné ; un LOT n'est jamais divisé (demandé) ; une saisie de Julien n'est jamais
// écrasée ; dit une fois (« prix d'achat repris du reçu »). » — remplace §2.5.
//
// LA RÈGLE (une seule, ici ; l'app, l'atelier « Compléter » la consomment) :
//   • l'article (fiche `vinted_annonce_numeros` ou vente `vinted_sale_overrides`) porte
//     `buyFromId` : l'achat qui lui est RELIÉ par identité (son toucher, l'atelier
//     d'arrivée qui lui a donné son N°) — jamais un titre, jamais une ressemblance ;
//   • son prix d'achat est VIDE (une saisie, même « 0 », n'est jamais touchée — et
//     l'écriture le revérifie sur la valeur relue : `champsSiVide`) ;
//   • l'achat est LU (dans la liste des achats, au même n° de transaction) ;
//   • ce n'est PAS un lot — dit tel quel par l'appelant (`estLot(achat)` : true / false ;
//     `null` = pas su ⇒ rien), et aucun autre article ne porte le même achat sous un
//     autre N° (deux paires sur un achat = un lot, même si personne ne l'a dit) ;
//   • son REÇU est lu, relié par SON n° de transaction, et tombe juste au centime
//     (« Montant payé » = la somme de ses lignes) : c'est ce qu'il a payé. Le prix de
//     l'article seul (sans port ni frais) N'EST PAS posé : ce n'est pas le reçu.
//   • autre devise, achat remboursé / annulé ⇒ rien.
// Une lecture ratée (fiches, ventes, achats, reçus, lots : `undefined` / `null`) ⇒ rien.
// ─────────────────────────────────────────────────────────────────────────────
import { ACHAT_SANS_COUT, texteCentimes } from './prixAchatPropose.js';

export const SOURCE_RECU = 'recu';
const txDe = (v) => { const t = String(v == null ? '' : v).trim(); return /^\d{6,}$/.test(t) ? t : ''; };
const vide = (v) => v == null || String(v).trim() === '';
const estObjet = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// Le montant du reçu de CET achat, ou null. `lot` : true / false / null (pas su).
export function prixDuRecu({ achat = null, ventilation = null, lot = null } = {}) {
  const tx = txDe(achat && achat.transaction_id);
  if (!tx || lot !== false) return null;
  if (ACHAT_SANS_COUT.test(String((achat && achat.status) || ''))) return null;
  const devise = String((achat.price && achat.price.currency_code) || 'EUR').toUpperCase();
  if (devise !== 'EUR') return null;
  const v = ventilation;
  if (!v || !v.trouve || v.somme !== 'juste' || !Number.isSafeInteger(v.paye) || v.paye <= 0) return null;
  return { tx, centimes: v.paye, valeur: (v.paye / 100).toFixed(2).replace('.', ','), texte: texteCentimes(v.paye), source: SOURCE_RECU };
}

// Les prix à poser. fiches / ventes : les objets LUS (sinon rien) ; achatDe(tx) → l'achat lu
// ou null ; ventilationDe(tx) → la ventilation de SON reçu ou null ; estLot(achat) → true / false / null.
export function prixAPoser({ fiches, ventes, achatDe, ventilationDe, estLot } = {}) {
  if (!estObjet(fiches) || !estObjet(ventes)) return [];
  if (typeof achatDe !== 'function' || typeof ventilationDe !== 'function' || typeof estLot !== 'function') return [];
  const lignes = [
    ...Object.entries(fiches).map(([cle, e]) => ({ ou: 'fiche', cle, e })),
    ...Object.entries(ventes).map(([cle, e]) => ({ ou: 'vente', cle, e })),
  ].filter((x) => estObjet(x.e) && txDe(x.e.buyFromId));
  // Les N° qui portent chaque achat : plus d'un N° (ou un article sans N° à côté d'un autre) ⇒ un lot.
  const parTx = new Map();
  for (const x of lignes) {
    const tx = txDe(x.e.buyFromId), n = String(x.e.numero == null ? '' : x.e.numero).trim();
    if (!parTx.has(tx)) parTx.set(tx, []);
    parTx.get(tx).push(n || '∅' + x.ou + ':' + x.cle);
  }
  const plusieurs = (tx) => new Set(parTx.get(tx) || []).size > 1;
  const out = [];
  for (const x of lignes) {
    const e = x.e, tx = txDe(e.buyFromId);
    if (!vide(e.buyPrice)) continue;                                  // sa saisie : jamais touchée
    if (e.buyFrom && e.buyFrom.aSaisir) continue;                     // un article de lot : à saisir
    if (plusieurs(tx)) continue;                                      // un achat, plusieurs paires : un lot
    const a = achatDe(tx);
    if (!a || txDe(a.transaction_id) !== tx) continue;                // l'achat pas lu (ou un autre) : rien
    const p = prixDuRecu({ achat: a, ventilation: ventilationDe(tx), lot: estLot(a) });
    if (!p) continue;
    out.push({ ou: x.ou, cle: String(x.cle), numero: String(e.numero == null ? '' : e.numero).trim(), tx, buyPrice: p.valeur, centimes: p.centimes });
  }
  return out;
}

// Les écritures (moteur src/gesteAnnulable.js, chemin comparer-et-échanger des gestes) :
// `champsSiVide` / `cleSiVide` revérifient sur la valeur RELUE au moment d'écrire que le prix est
// toujours vide — une saisie posée entre-temps gagne.
export function opsPrixRecu(aPoser) {
  const ops = [];
  for (const c of (Array.isArray(aPoser) ? aPoser : [])) {
    if (!c || vide(c.buyPrice)) continue;
    const k = c.ou === 'fiche' ? 'vinted_annonce_numeros' : c.ou === 'vente' ? 'vinted_sale_overrides' : null;
    if (!k) continue;
    ops.push({ k, type: 'champsSiVide', garde: 'buyPrice', id: String(c.cle), apres: { buyPrice: String(c.buyPrice), buyPriceSource: SOURCE_RECU, buyPriceRecuTx: c.tx } });
    if (c.ou === 'fiche' && c.numero) ops.push({ k: 'vinted_buyprice_by_num', type: 'cleSiVide', id: c.numero, apres: String(c.buyPrice) });
  }
  return ops;
}

// Ce qui est DIT, une fois, à l'écriture (seul l'appareil dont l'écriture a pris le dit : la valeur relue
// porte déjà le prix ailleurs) : « 1 prix d'achat repris du reçu · N°12 · 41,50 € » ; plusieurs : leurs N°.
export function texteRepris(aPoser) {
  const l = (Array.isArray(aPoser) ? aPoser : []).filter(Boolean);
  if (!l.length) return '';
  if (l.length === 1) return [l[0].numero ? 'N°' + l[0].numero : '', texteCentimes(l[0].centimes)].filter(Boolean).join(' · ');
  const nums = l.map((c) => c.numero).filter(Boolean).map((n) => 'N°' + n);
  return nums.slice(0, 5).join(', ') + (nums.length > 5 ? '…' : '');
}
