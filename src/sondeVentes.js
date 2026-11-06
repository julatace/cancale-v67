// ═══════════════════════════════════════════════════════════════════════════
//  LA SONDE DES VENTES DE LA COQUE (6 nov., onglets A — panne « 0 € aujourd'hui »)
// ═══════════════════════════════════════════════════════════════════════════
// Julien, 6 nov. : une vente faite à 08 h 49, rangée par l'extension dans
// `harvest_{uid}_orders_sold` (ligne RÉÉCRITE à 10 h 22 pendant que VRM était
// ouvert), apparaissait dans la liste de Ventes mais Ma journée disait « 0 €
// aujourd'hui ». Cause : l'écran Ventes a sa sonde (il relit SES ventes quand la
// capture d'un compte bouge), la COQUE — qui porte LE « vendu » de toute l'app
// (`liveStats` : Ma journée, la carte de Ventes, Statistiques, le widget) — ne
// relisait ses ventes que sur un signal de l'extension, qui n'arrive que dans
// le navigateur où elle tourne (jamais sur le téléphone). Deux nombres pour
// une même notion, jusqu'au rechargement.
//
// La règle, pure : un compte est à relire quand la date de capture de sa ligne
// `orders_sold` (lue en scalaire, `meta->>capturedAt`) est PLUS RÉCENTE que
// celle de la lecture que la coque a faite (`vus` : uid → ms, la date de la
// ligne lue). Un compte jamais lu par la coque (pas dans `vus`) n'est pas
// relu ici : la lecture principale s'en charge. Une date illisible ne relit
// rien (jamais « pas su » pris pour « nouveau »).
export function comptesARelire(rows, vus, comptes = null) {
  const out = [];
  if (!Array.isArray(rows) || !vus || typeof vus !== 'object') return out;
  const permis = comptes ? new Set([...comptes].map(String)) : null;
  for (const x of rows) {
    const m = /^harvest_(\d+)_orders_sold$/.exec(String((x && x.id) || ''));
    if (!m) continue;
    const uid = m[1];
    if (permis && !permis.has(uid)) continue;
    const cap = Date.parse((x && x.cap) || '');
    const deja = Number(vus[uid]);
    if (!Number.isFinite(cap) || !Number.isFinite(deja)) continue;
    if (cap > deja) out.push(uid);
  }
  return out;
}
