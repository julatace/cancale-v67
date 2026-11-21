// ══ LES COMMANDES À LA FORME ET AU POIDS DE SA BASE (20 nov., lectures-legeres) ══
// Mesuré le 20 nov. sur sa base (lecture seule, projections et tailles seulement,
// aucune valeur recopiée) : 30 lignes `harvest_*_orders_*d`, 1 900 Ko de texte,
// 5 277 commandes (2 588 ventes, 2 689 achats). Chaque commande porte EXACTEMENT
// date (20 ou 25 car., `Z` ou `+02:00`), price `{amount, currency_code}`, title
// (~28 car.), status (~48 car., 12 valeurs), transaction_id (nombre à 11 chiffres),
// conversation_id (surtout une chaîne de 36 car.), transaction_user_status (4
// valeurs) ; photo sur 24 % (`url` de 128 car., `high_resolution` sur un quart,
// l'objet complet sur 5). Les deux plus grosses lignes : 2 012 ventes (688 Ko) et
// 2 024 achats (673 Ko).
//
// `_base-volume` garnit ses commandes de `'x'.repeat(n)` (`_pad`) : un poids juste
// pour le RÉSEAU brut, mais FAUX pour une compression (des « x » se compressent
// mille fois) et pour une liste blanche (le `_pad` n'est pas un champ de Vinted).
// `formeReelle(base)` réécrit les lignes de commandes des comptes LIÉS à la forme
// ci-dessus (mêmes totaux que sa base, valeurs inventées et
// pseudo-aléatoires, graine fixe) — les commandes déjà présentes gardent leur n°,
// titre, prix, statut et date (les écrans montrent les mêmes ventes) ; on ajoute de
// vieilles commandes finalisées jusqu'aux nombres mesurés.
'use strict';
// Les TOTAUX de sa base : les commandes en plus vont au premier compte (le gros, comme chez lui).
const VENTES_TOTAL = 2588, ACHATS_TOTAL = 2689;
const STATUTS_LONGS = [
  'La commande est finalisée. Les fonds ont été transférés sur ton porte-monnaie Vinted.',
  'Commande finalisée',
  "L'acheteur a confirmé la bonne réception de la commande. Merci !",
  'Commande finalisée. Les fonds ont été transférés.',
];
function fabriqueAlea(graine) { let g = graine >>> 0; return () => { g = (Math.imul(g, 1103515245) + 12345) >>> 0; return g / 4294967296; }; }
function formeReelle(base, { graine = 20 } = {}) {
  const alea = fabriqueAlea(graine);
  const hex = (n) => { let s = ''; for (let i = 0; i < n; i++) s += '0123456789abcdef'[Math.floor(alea() * 16)]; return s; };
  const uuid = () => `${hex(8)}-${hex(4)}-${hex(4)}-${hex(4)}-${hex(12)}`;
  const urlPhoto = () => `https://images1.vinted.net/t/0${Math.floor(alea() * 4) + 1}_0${hex(4)}_${hex(26)}/f800/${1700000000 + Math.floor(alea() * 6e7)}.jpeg?s=${hex(40)}`;
  const photo = () => { const p = { url: urlPhoto() }; if (alea() < 0.26) p.high_resolution = { id: hex(8), timestamp: 1700000000 + Math.floor(alea() * 6e7) }; return p; };
  const MOTS = ['Nike', 'Adidas', 'New Balance', 'Asics', 'Salomon', 'Vans', 'Air Max 90', 'Samba OG', 'Gazelle', '550', 'Gel-1130', 'XT-6', 'blanc', 'noir', 'beige', 'gris'];
  const titre = () => { const n = 3 + Math.floor(alea() * 3); const l = []; for (let i = 0; i < n; i++) l.push(MOTS[Math.floor(alea() * MOTS.length)]); return `${l.join(' ')} ${36 + Math.floor(alea() * 10)}`; };
  const uids = (base.accounts || []).map((a) => String(a.vinted_user_id));
  let tx = 25000000000;
  const parId = new Map(base.rows.map((r) => [r.id, r]));
  const total = (cote) => uids.reduce((a, uid) => { const r = parId.get(`harvest_${uid}_orders_${cote}`); return a + ((r && r.data && r.data.payload && Array.isArray(r.data.payload.my_orders)) ? r.data.payload.my_orders.length : 0); }, 0);
  const enPlus = { sold: Math.max(0, VENTES_TOTAL - total('sold')), purchased: Math.max(0, ACHATS_TOTAL - total('purchased')) };
  uids.forEach((uid, i) => {
    for (const cote of ['sold', 'purchased']) {
      const r = parId.get(`harvest_${uid}_orders_${cote}`);
      if (!r || !r.data || !r.data.payload || !Array.isArray(r.data.payload.my_orders)) continue;
      const l = r.data.payload.my_orders.map((o) => {
        const x = { ...o }; delete x._pad;
        if (x.conversation_id == null) x.conversation_id = uuid();
        if (x.transaction_user_status == null) x.transaction_user_status = 'completed';
        if (x.photo && typeof x.photo === 'object') x.photo = { ...photo(), url: urlPhoto() };
        return x;
      });
      const voulus = l.length + (i === 0 ? enPlus[cote] : 0);
      while (l.length < voulus) {
        const j = l.length;
        const o = { transaction_id: tx++, conversation_id: alea() < 0.9 ? uuid() : 18000000000 + Math.floor(alea() * 1e9), title: titre(),
          price: { amount: (15 + Math.floor(alea() * 120)) + (alea() < 0.3 ? '.5' : '.0'), currency_code: 'EUR' },
          status: STATUTS_LONGS[Math.floor(alea() * STATUTS_LONGS.length)],
          date: new Date(Date.parse('2026-08-01T12:00:00Z') - j * 3 * 3600000).toISOString().replace('.000Z', alea() < 0.5 ? 'Z' : '+02:00'),
          transaction_user_status: 'completed' };
        if (alea() < 0.24) o.photo = photo();
        l.push(o);
      }
      r.data.payload.my_orders = l;
      r.data.nItems = l.length;
    }
  });
  return base;
}
module.exports = { formeReelle, VENTES_TOTAL, ACHATS_TOTAL };
