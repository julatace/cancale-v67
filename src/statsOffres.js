// ═══════════════════════════════════════════════════════════════════════════
// LES STATISTIQUES DES OFFRES (4 novembre) — ce que VRM sait VRAIMENT
// ═══════════════════════════════════════════════════════════════════════════
// Julien : par compte, les offres reçues, acceptées (par lui ou par le moteur),
// refusées, les contre-offres, la remise moyenne accordée et ce que les offres
// ont « coûté » sur la période.
//
// MESURÉ (lecture seule, 4 nov., sa base) — deux sources, deux populations :
//  A. LES CONVERSATIONS captées (`harvest_{uid}_conv_{id}`, 1 411 lignes, 807
//     avec une offre) : chaque offre de l'acheteur est un message
//     `offer_request_message` (`offer_request_id`, `status` 10 attente · 20
//     acceptée · 30 refusée · 40 annulée, `price`, `original_price`,
//     `created_at_ts`) — 918 offres, toutes reçues (côté vendeur, de
//     l'acheteur). Une CONTRE-OFFRE de Vinted = la demande refusée (30) PUIS
//     un `offer_message` de LUI à un prix plus haut, dans la même conversation :
//     553 + 15 mesurées, toutes après une demande au statut 30.
//     ⚠️ La capture des conversations s'est ARRÊTÉE (dernière lecture le 29 oct.
//     sur un compte, le 18 oct. sur les autres) : une période après la
//     dernière lecture d'un compte n'est pas lue — « au moins », et « — » si
//     rien n'est lu (jamais « au moins 0 »).
//     Qui a accepté (lui ou le moteur `autoAccepterOffres`, ALLUMÉ chez lui) :
//     le moteur ne garde AUCUN journal en base (seulement l'activité locale de
//     l'extension) ⇒ « — », toujours. Jamais deviné.
//  B. LES TRANSACTIONS des ventes (`harvest_{uid}_txn_{tx}`, fraîches) : la
//     transaction porte `offer` (`price` = le prix conclu, `is_system` faux
//     quand il a été négocié) et `order.items[].price` (le prix affiché de
//     l'annonce). Une vente CONCLUE PAR OFFRE = `is_system` faux, une seule
//     paire, prix conclu < prix affiché, même devise. Sa remise = prix affiché
//     − prix conclu. Mesuré : octobre 56 ventes par offre sur 80, 618,15 € de
//     remises. Un lot (plusieurs paires) n'est pas jugé (remise de lot ≠
//     offre) : il sort de la couverture, nommé.
//     La population des ventes est CELLE du « vendu » (`ventesFaites`, lignes
//     Vinted portant `tx`) : même périmètre, mêmes comptes écartés.
// Trois états partout (§5) : un nombre lu · `null` pas su (« — ») · partiel
// (« au moins », le manque nommé). Exécuté par scripts/audit-stats-offres.cjs.

const num = (v) => {
  if (v == null || v === '') return null;
  const n = Number(typeof v === 'object' ? v.amount : v);
  return Number.isFinite(n) ? n : null;
};
const cents = (v) => Math.round(v * 100);
const tsDe = (m) => { const t = Date.parse((m && m.created_at_ts) || ''); return Number.isFinite(t) ? t : null; };

// ── A. Les offres reçues d'UNE conversation ─────────────────────────────────
// → [{ id, ts, etat: 'acceptee'|'refusee'|'contre'|'attente'|'annulee'|'inconnu' }]
// Seulement les offres DE L'ACHETEUR (user_id = opposite_user), côté vendeur ;
// une offre se compte une fois (par `offer_request_id`, l'état le plus frais
// — le dernier message — gagne).
export const offresDeConversation = (conv) => {
  if (!conv || conv.side !== 'seller' || conv.opp == null || !Array.isArray(conv.messages)) return [];
  const opp = String(conv.opp);
  const msgs = conv.messages;
  const parId = new Map();
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    if (!m || m.entity_type !== 'offer_request_message' || !m.entity) continue;
    const e = m.entity;
    if (e.user_id == null || String(e.user_id) !== opp || e.offer_request_id == null) continue;
    parId.set(String(e.offer_request_id), { i, m });
  }
  const out = [];
  for (const [id, { i, m }] of parId) {
    const st = Number(m.entity.status);
    let etat = st === 20 ? 'acceptee' : st === 30 ? 'refusee' : st === 10 ? 'attente' : st === 40 ? 'annulee' : 'inconnu';
    if (etat === 'refusee') {
      // Une contre-offre : un `offer_message` de LUI après cette demande, avant la demande suivante.
      for (let k = i + 1; k < msgs.length; k++) {
        const x = msgs[k];
        if (!x) continue;
        if (x.entity_type === 'offer_request_message') break;
        if (x.entity_type === 'offer_message' && x.entity && x.entity.user_id != null && String(x.entity.user_id) !== opp) { etat = 'contre'; break; }
      }
    }
    out.push({ id, ts: tsDe(m), etat });
  }
  return out;
};

// ── B. Une vente : conclue par offre ? ──────────────────────────────────────
// `t` = la transaction projetée { sys, op, oc, ic, ip, icur } (ou absente).
// → { etat: 'offre'|'sans'|'lot'|'illisible'|'pasLue', remise }
export const venteParOffre = (t) => {
  if (!t || typeof t !== 'object') return { etat: 'pasLue', remise: null };
  const sys = t.sys === true || t.sys === 'true' ? true : t.sys === false || t.sys === 'false' ? false : null;
  const ic = Number(t.ic);
  const op = num(t.op), ip = num(t.ip);
  if (sys === null || !Number.isInteger(ic) || ic < 1) return { etat: 'illisible', remise: null };
  if (ic > 1) return { etat: 'lot', remise: null };
  if (op == null || ip == null || op <= 0 || ip <= 0) return { etat: 'illisible', remise: null };
  if ((t.oc || 'EUR') !== (t.icur || 'EUR') || (t.oc && t.oc !== 'EUR')) return { etat: 'illisible', remise: null };
  if (op > ip) return { etat: 'illisible', remise: null };
  if (sys || cents(op) === cents(ip)) return { etat: 'sans', remise: 0 };
  return { etat: 'offre', remise: (cents(ip) - cents(op)) / 100 };
};

const vide = () => ({ recues: 0, acceptees: 0, refusees: 0, contre: 0, attente: 0, annulees: 0, ventes: 0, lues: 0, lots: 0, illisibles: 0, parOffre: 0, cout: 0 });

// ── LES STATISTIQUES D'UNE PÉRIODE ──────────────────────────────────────────
// convs   : [{ compte (uid Vinted), side, opp, messages }] | null (pas lu)
// lectures: { [uid]: dernière lecture des conversations (ms) }
// ventes  : les lignes Vinted de `ventesFaites` ({ ts, uid, tx }) | null —
//           le compte est l'IDENTITÉ du compte Vinted (uid), jamais un nom
// txn     : { [tx]: transaction projetée } | null (pas lu)
// de, a   : bornes [de, a) ; maintenant : pour une période en cours.
// → { comptes: [...], total, offresLues, ventesLues } — chaque compte :
//   { compte, recues, acceptees, refusees, contre, attente, annulees,
//     parMoteur: null, partielOffres, luJusqua, ventes, lues, lots,
//     illisibles, parOffre, cout, remiseMoy, partielVentes }
export const statsOffres = ({ convs, lectures = {}, ventes, txn, de, a, maintenant = Date.now() }) => {
  const fin = Math.min(a, maintenant);
  const par = new Map();
  const de_ = (k) => { if (!par.has(k)) par.set(k, { compte: k, ...vide() }); return par.get(k); };
  const offresLues = Array.isArray(convs);
  const ventesLues = Array.isArray(ventes) && txn != null && typeof txn === 'object';
  if (offresLues) {
    for (const c of convs) {
      if (!c) continue;
      const k = String(c.compte || '');
      for (const o of offresDeConversation(c)) {
        if (o.ts == null || o.ts < de || o.ts >= a) continue;
        const g = de_(k);
        g.recues += 1;
        if (o.etat === 'acceptee') g.acceptees += 1;
        else if (o.etat === 'refusee') g.refusees += 1;
        else if (o.etat === 'contre') g.contre += 1;
        else if (o.etat === 'attente') g.attente += 1;
        else if (o.etat === 'annulee') g.annulees += 1;
      }
    }
    for (const k of Object.keys(lectures || {})) de_(k);
  }
  if (ventesLues) {
    for (const l of ventes) {
      if (!l || l.plateforme && l.plateforme !== 'Vinted') continue;
      if (!(l.ts >= de && l.ts < a)) continue;
      const g = de_(String(l.uid || l.compte || ''));
      g.ventes += 1;
      const v = venteParOffre(l.tx ? txn[String(l.tx)] : null);
      if (v.etat === 'lot') { g.lots += 1; continue; }
      if (v.etat === 'illisible' || v.etat === 'pasLue') { g.illisibles += 1; continue; }
      g.lues += 1;
      if (v.etat === 'offre') { g.parOffre += 1; g.cout = (cents(g.cout) + cents(v.remise)) / 100; }
    }
  }
  const finir = (g, lu) => {
    // Offres : partielles dès que la dernière lecture des conversations de ce
    // compte précède la fin de la période (rien n'est lu après elle).
    const partielOffres = !offresLues ? false : !(Number.isFinite(lu) && lu >= fin);
    const rienOffres = !offresLues || (partielOffres && g.recues === 0);
    const partielVentes = ventesLues && g.lues < g.ventes;
    const rienVentes = !ventesLues || (g.lues === 0 && g.ventes > 0);
    const o = (v) => (rienOffres ? null : v);
    return {
      compte: g.compte, luJusqua: Number.isFinite(lu) ? lu : null,
      recues: o(g.recues), acceptees: o(g.acceptees), refusees: o(g.refusees), contre: o(g.contre), attente: o(g.attente), annulees: o(g.annulees),
      parMoteur: null,
      partielOffres: !rienOffres && partielOffres,
      ventes: ventesLues ? g.ventes : null, lues: ventesLues ? g.lues : null, lots: ventesLues ? g.lots : null, illisibles: ventesLues ? g.illisibles : null,
      parOffre: rienVentes ? null : g.parOffre,
      cout: rienVentes ? null : g.cout,
      remiseMoy: rienVentes || !g.parOffre ? null : Math.round((g.cout / g.parOffre) * 100) / 100,
      partielVentes: !rienVentes && partielVentes,
    };
  };
  const comptes = [...par.values()].map((g) => finir(g, lectures ? Number(lectures[g.compte]) : NaN))
    .sort((x, y) => (y.ventes || 0) - (x.ventes || 0) || (y.recues || 0) - (x.recues || 0) || (x.compte < y.compte ? -1 : 1));
  // Le total : la somme des comptes ; partiel si UN compte l'est. La dernière
  // lecture du total est la plus ANCIENNE des comptes (ce qui est sûr pour tous).
  const T = vide();
  for (const g of par.values()) for (const k of Object.keys(T)) T[k] = k === 'cout' ? (cents(T.cout) + cents(g.cout)) / 100 : T[k] + g[k];
  T.compte = '';
  const lus = Object.values(lectures || {}).map(Number).filter(Number.isFinite);
  const total = finir(T, lus.length && par.size ? Math.min(...lus) : NaN);
  if (offresLues && comptes.some((c) => c.partielOffres || c.recues == null) && total.recues != null) total.partielOffres = true;
  return { comptes, total, offresLues, ventesLues };
};
