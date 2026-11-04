// ════════════════════════════════════════════════════════════════════════════
//  L'ORDRE PAR TRANSPORTEUR — UNE règle pour l'écran Colis et pour « Tout
//  imprimer » (3 nov., choix de Julien n° 2 : « un PDF trié par transporteur,
//  tous les Mondial Relay, puis Chronopost… — l'ordre des groupes de l'écran »).
//
//  `rangerParTransporteur(items, { trNom, jours })` : le plus pressé d'abord
//  (jours avant la limite ; sans limite à la fin, tri stable), puis les
//  transporteurs dans l'ordre de leur PREMIER colis — c'est exactement le tri de
//  « À envoyer » depuis le 2 nov. (maquette FusionColis).
//  `ordreDesGroupes(rangés, trNom)` : les noms de groupe dans cet ordre.
//  `ordonnerLot(lignes, ordre, trNom)` : les lignes du lot dans l'ordre des
//  groupes de l'écran (un transporteur absent de l'écran passe à la fin), et
//  dans chaque groupe l'ordre de l'écran (index `rang`, sinon l'ordre reçu).
// ════════════════════════════════════════════════════════════════════════════

const joursDe = (j) => (j == null || !Number.isFinite(Number(j))) ? 9999 : Number(j);

export function rangerParTransporteur(items, { trNom, jours }) {
  const L = Array.isArray(items) ? items : [];
  const tous = L.map((x, k) => [x, k]).sort((a, b) => joursDe(jours(a[0])) - joursDe(jours(b[0])) || a[1] - b[1]).map(([x]) => x);
  const ordreT = new Map();
  tous.forEach((x) => { const k = trNom(x); if (!ordreT.has(k)) ordreT.set(k, ordreT.size); });
  return tous.map((x, k) => [x, k]).sort((a, b) => ordreT.get(trNom(a[0])) - ordreT.get(trNom(b[0])) || a[1] - b[1]).map(([x]) => x);
}

export function ordreDesGroupes(ranges, trNom) {
  const out = [];
  for (const x of (ranges || [])) { const k = trNom(x); if (!out.includes(k)) out.push(k); }
  return out;
}

export function ordonnerLot(lignes, ordre, trNom) {
  const L = Array.isArray(lignes) ? lignes : [];
  const pos = new Map((ordre || []).map((k, i) => [k, i]));
  const g = (x) => { const k = trNom(x); return pos.has(k) ? pos.get(k) : 1e6; };
  const r = (x, i) => (Number.isFinite(x && x.rang) ? x.rang : 1e6 + i);
  return L.map((x, i) => [x, i]).sort((a, b) => g(a[0]) - g(b[0]) || r(a[0], a[1]) - r(b[0], b[1]) || a[1] - b[1]).map(([x]) => x);
}
