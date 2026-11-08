// ════════════════════════════════════════════════════════════════════════════
//  PLUSIEURS LIGNES NOMMÉES, UNE SEULE LECTURE (8 nov., démarrage)
// ════════════════════════════════════════════════════════════════════════════
//  Mesuré au démarrage (banc `_mesure-demarrage.cjs`, 7 comptes, Ma journée) :
//  le dressing et la boîte de réception se lisaient COMPTE PAR COMPTE —
//  `id=eq.harvest_{uid}_listings` ×7 + `id=eq.harvest_{uid}_inbox` ×7, quatorze
//  allers-retours lancés dans la même milliseconde, la même projection. Pour
//  mille vendeurs de neuf comptes, c'est 18 requêtes par ouverture au lieu d'une.
//  ⇒ Les demandes d'une ligne faites dans le même tour (`setTimeout 0`), avec la
//  même session, partent ensemble en `id=in.(…)` (au plus `MAX_LOT` lignes) et
//  chaque appelant reçoit SES lignes — exactement ce que sa lecture `id=eq.`
//  aurait rendu : `[ligne]`, `[]` (la ligne n'existe pas), ou `null` (pas su).
//
//  ⚠️ CE QUI NE DOIT JAMAIS ARRIVER, et ce que la règle fait à la place :
//   · une ligne d'un autre appelant donnée à quelqu'un : chaque ligne est rendue
//     à l'appelant de SON `id` (égalité stricte, jamais un préfixe) ;
//   · « pas su » pris pour « rien » (§4.1) : une lecture groupée RATÉE (réseau,
//     5xx, JSON illisible) rend `null` à TOUS — jamais `[]` ;
//   · une réponse qu'on ne sait pas attribuer (une ligne sans `id`, un `id` qui
//     n'était pas demandé, deux fois le même) ⇒ on ne devine pas : chaque ligne
//     est relue SEULE (comme avant) ;
//   · une réponse groupée VIDE (aucune des lignes) ⇒ relue ligne par ligne :
//     « vide » d'un `in.(…)` ne se distingue pas d'un serveur qui ne le comprend
//     pas, et c'est le seul cas où l'on paie l'ancien prix ;
//   · un refus 4xx (requête pas comprise) ⇒ relue ligne par ligne aussi ;
//   · deux sessions ne partagent jamais un lot (la clé de lot porte la session).
// ════════════════════════════════════════════════════════════════════════════

export const MAX_LOT = 40;

// `lireLot(ids, cle)` : lit ces lignes ENSEMBLE, rend `{ ok:true, rows }`, ou
//   `{ ok:false, statut }` (statut HTTP, 0 = réseau / illisible).
// `lireUne(id, cle)` : la lecture d'avant, rend `Array` (ses lignes) ou `null`.
// Rend `charger(id, cle)` → Promise<Array|null>, et des compteurs.
export function creerLectureGroupee(lireLot, lireUne, opts = {}) {
  const maxLot = Number.isInteger(opts.maxLot) && opts.maxLot > 0 ? opts.maxLot : MAX_LOT;
  const planifier = opts.planifier || ((f) => setTimeout(f, 0));
  const lots = new Map();   // cle de session -> Map(id -> [resolve])
  const stats = { lots: 0, lignes: 0, unParUn: 0 };

  const seul = (ids, attente, cle) => Promise.all(ids.map(async (id) => {
    stats.unParUn++;
    let r = null;
    try { r = await lireUne(id, cle); } catch (_) { r = null; }
    for (const ok of attente.get(id)) ok(Array.isArray(r) ? r.slice() : null);
  }));

  const partir = async (cle, attente) => {
    const ids = [...attente.keys()];
    if (ids.length === 1) return seul(ids, attente, cle);
    stats.lots++; stats.lignes += ids.length;
    let r;
    try { r = await lireLot(ids, cle); } catch (_) { r = { ok: false, statut: 0 }; }
    if (!r || !r.ok) {
      const st = r ? Number(r.statut) || 0 : 0;
      // Pas compris (400, 404, 405…) : relu ligne par ligne. Panne : « pas su » pour tous.
      if (st >= 400 && st < 500 && st !== 401 && st !== 403 && st !== 408 && st !== 429) return seul(ids, attente, cle);
      for (const id of ids) for (const ok of attente.get(id)) ok(null);
      return undefined;
    }
    const rows = r.rows;
    if (!Array.isArray(rows)) { for (const id of ids) for (const ok of attente.get(id)) ok(null); return undefined; }
    const demandes = new Set(ids);
    const parId = new Map();
    let attribuable = rows.length > 0;
    for (const row of rows) {
      const id = row && typeof row.id === 'string' ? row.id : null;
      if (!id || !demandes.has(id) || parId.has(id)) { attribuable = false; break; }
      parId.set(id, row);
    }
    if (!attribuable) return seul(ids, attente, cle);
    for (const id of ids) {
      const row = parId.get(id);
      // Chaque appelant reçoit SA copie de tableau (la ligne elle-même n'est
      // donnée qu'aux appelants de son id).
      for (const ok of attente.get(id)) ok(row ? [row] : []);
    }
    return undefined;
  };

  const charger = (id, cle = '') => new Promise((ok) => {
    const k = String(cle);
    let attente = lots.get(k);
    if (!attente) {
      attente = new Map();
      lots.set(k, attente);
      planifier(() => {
        if (lots.get(k) === attente) lots.delete(k);
        const ids = [...attente.keys()];
        for (let i = 0; i < ids.length; i += maxLot) {
          const part = new Map(ids.slice(i, i + maxLot).map((x) => [x, attente.get(x)]));
          partir(k, part);
        }
      });
    }
    const s = String(id);
    if (!attente.has(s)) attente.set(s, []);
    attente.get(s).push(ok);
  });
  return { charger, stats };
}

// Un identifiant de ligne qu'on peut écrire tel quel dans `in.(…)` (pas de
// virgule, parenthèse, guillemet, espace ni `%`) — sinon : la lecture seule.
export const idGroupable = (id) => typeof id === 'string' && /^[A-Za-z0-9_.:-]+$/.test(id);
