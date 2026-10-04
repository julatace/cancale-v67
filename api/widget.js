import { sbCle } from './_lib/cle.js';
import { contexteVendeur, proprietaireCourant } from './_lib/owner.js';
import { accesVendeur } from './_lib/abonnement.js';
// api/widget.js
// ────────────────────────────────────────────────────────────────────────────
// DONNÉES DU WIDGET écran d'accueil (app Scriptable sur iPhone).
// Renvoie un petit JSON avec les chiffres « coup d'œil » du jour, calculés
// UNIQUEMENT depuis Supabase (données arrivées par email) → marche même app
// fermée / iPhone pas connecté à Vinted. Aucun appel Vinted.
//
// Chiffres : colis à expédier (aujourd'hui/en retard/total), colis à retirer,
// encaissé ce mois, ventes ce mois.
// ────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
// ⚠️ CLÉ DE SERVICE QUAND ELLE EXISTE. Ces routes tournent sur le serveur, sans
// vendeur connecté : à la seconde où la base est cloisonnée (RLS), la clé
// publique ne peut plus rien lire ni écrire et l'endpoint devient muet — c'est
// LE blocage qui empêchait d'activer le multi-vendeurs. On prend donc
// `SUPABASE_SERVICE_KEY` (variable d'environnement Vercel, jamais dans le
// dépôt) si elle est définie, et on retombe sur la clé publique tant qu'elle ne
// l'est pas : le comportement d'aujourd'hui reste identique.
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxnb254enJ6amNxdGhqdGJkcHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODIyMjYsImV4cCI6MjA5NTE1ODIyNn0.QJQSKILJLEpbDvBP4w7xD-olxoUjX1H2rxrYdo63GWQ';
const HEADERS = { ...sbCle(SUPABASE_KEY) };

const parisDate = (off = 0) => new Date(Date.now() + off * 86400000).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
const frToIso = (s) => { const m = String(s || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };

// ⚠️ §4.5 — SUPABASE PLAFONNE UNE RÉPONSE À 1000 LIGNES SANS LE DIRE. À
// 1000 utilisateurs, un balayage `email_bord_*` / `harvest_%25_*` dépasse le
// millier et serait TRONQUÉ en silence → des colis/ventes invisibles sur le
// widget, sans aucune erreur. On pagine par en-tête Range, et on rend `null`
// si UNE page échoue : une demi-liste a l'air d'une réponse complète, c'est
// pire qu'une lecture ratée (même règle que `sbGetTout` côté app).
async function fetchPaginated(path) {
  const out = []; const page = 1000;
  for (let from = 0; from < 500000; from += page) {
    let r;
    try { r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { ...HEADERS, 'Range-Unit': 'items', Range: `${from}-${from + page - 1}` } }); }
    catch (_) { return null; }
    if (!r.ok) return null;
    let j; try { j = await r.json(); } catch (_) { return null; }
    if (!Array.isArray(j)) return null;
    out.push(...j);
    if (j.length < page) break;
  }
  return out;
}

// ── MULTI-VENDEURS ────────────────────────────────────────────────────────────
// Le widget est appelé par UN vendeur (sa clé `?k=`). Mais `main()` prenait le
// PREMIER `main` venu et toutes les lectures balayaient TOUS les vendeurs → le
// vendeur B aurait vu les chiffres de A. On résout d'abord SON `owner` par le
// token, puis toutes les lectures se filtrent sur lui (`scoped`). Vide hors
// cloisonnement → URL inchangée, comportement d'aujourd'hui À L'IDENTIQUE.
function scoped(path) {
  const o = proprietaireCourant();
  return o ? path + (path.includes('?') ? '&' : '?') + `owner=eq.${encodeURIComponent(o)}` : path;
}
async function cloisonnee() {
  try { return (await fetch(`${SUPABASE_URL}/rest/v1/app_data?select=owner&limit=1`, { headers: HEADERS })).ok; }
  catch (_) { return false; }
}
// Comparaison à durée constante (évite de deviner la clé au temps de réponse).
function memeToken(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// Résout le vendeur à partir de la clé du widget (?k=). C'est le SEUL endroit où
// l'on regarde tous les vendeurs à la fois — et on n'en lit que DEUX scalaires
// (l'owner + sa clé), jamais leurs données. Ensuite chaque lecture se filtre sur
// l'owner rendu (`scoped`), donc le vendeur B ne peut plus voir les chiffres de A.
//   • base NON cloisonnée → '' : une seule boutique, comportement d'aujourd'hui
//     (la clé reste vérifiée plus bas, sur la ligne `main` globale) ;
//   • cloisonnée → la clé DOIT correspondre à celle d'un vendeur ; sinon fermé.
// Transition : un vendeur unique qui n'a pas encore de clé (avant d'avoir rouvert
// l'app) est servi, sinon son widget tomberait avant qu'il récupère l'adresse.
// Rend `null` APRÈS avoir répondu lui-même (503/401) quand il faut s'arrêter.
async function ownerDuToken(req, res) {
  if (!(await cloisonnee())) return ''; // une seule boutique : rien ne change
  let mains;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.main&select=owner,vrm_widget_token:data->>vrm_widget_token`, { headers: HEADERS });
    mains = r.ok ? await r.json() : null;
  } catch (_) { mains = null; }
  // « Pas su lire » ne vaut pas « aucun vendeur » : on ne devine pas, on le dit.
  if (!Array.isArray(mains)) {
    res.status(503).json({ erreur: 'base-injoignable', message: "Je n'ai pas pu lire tes données — rien n'est perdu, c'est la lecture qui échoue." });
    return null;
  }
  const given = String((req.query && (req.query.k || req.query.key)) || req.headers['x-vrm-key'] || '');
  // Un vendeur dont la clé est posée : elle doit correspondre à LA SIENNE.
  const parCle = mains.find((m) => m.vrm_widget_token && memeToken(given, m.vrm_widget_token));
  if (parCle) return parCle.owner || '';
  // Aucune correspondance. Un seul vendeur, pas encore de clé → on le sert
  // (transition) ; sinon (clé fausse, ou plusieurs vendeurs) → fermé.
  if (mains.length === 1 && !mains[0].vrm_widget_token) return mains[0].owner || '';
  res.status(401).json({ error: 'cle invalide' });
  return null;
}

// ⚠️⚠️ `[]` SUR UNE LECTURE RATÉE = « RIEN À FAIRE » SUR SON ÉCRAN D'ACCUEIL.
// Ces lectures rendaient une liste vide aussi bien quand la base disait « rien »
// que quand elle ne répondait pas — et le widget affichait alors `0 à expédier ·
// 0 à retirer · 0 €` avec 14 colis à poster. C'est le mensonge que l'app a
// appris à ne plus faire (§ baseKO), jamais reporté ici. `null` = « pas su ».
async function rows(like) {
  const j = await fetchPaginated(scoped(`app_data?id=like.${like}&select=data`));
  return j ? j.map(x => x.data).filter(Boolean) : null;
}
// ⚠️ ÉGRESS SUPABASE — NE JAMAIS faire `select=data` sur `email_bord_*` : chaque
// ligne embarque le PDF du bordereau en base64 (brut + tamponné = deux fois),
// soit ~6 Mo au total pour ~50 bordereaux. Or ce widget se rafraîchit TOUT SEUL
// 24h/24 → ces 6 Mo repartaient à CHAQUE rafraîchissement et faisaient exploser
// le quota de bande passante Supabase (la même leçon qu'en §23 côté app, jamais
// reportée ici). On ne projette que les 4 champs scalaires réellement lus plus
// bas (date limite + clés d'identification) → l'appel passe de ~6 Mo à ~1 Ko.
const BORD_SELECT = 'dateLimite:data->>dateLimite,transaction:data->>transaction,suivi:data->>suivi,numero:data->>numero';
async function bordRows() {
  return await fetchPaginated(scoped(`app_data?id=like.email_bord_*&select=${BORD_SELECT}`));
}
// Commandes Vinted moissonnées par l'extension (statut RÉEL, à jour) : c'est la
// source AUTOMATIQUE — Vinted change le statut quand tu expédies / récupères.
// ⚠️ ÉGRESS — CE POINT ÉTAIT LE DERNIER GROS ROBINET OUVERT (§34).
// Un `select=data` ici ramenait **791 Ko à chaque rafraîchissement** (mesuré :
// 609 Ko de ventes + 181 Ko d'achats), et un widget d'écran d'accueil se
// rafraîchit tout seul jour et nuit → plusieurs gigas par mois pour afficher
// deux nombres. L'extension écrit maintenant le compte utile DANS la ligne
// (`data.resume`, posé à la capture) : on le lit en scalaire.
// La propriété qui compte est conservée — ça se met à jour **même app fermée**,
// puisque c'est l'extension qui capture.
// ⚠️ UN COMPTE SUPPRIMÉ NE FAIT PAS DE COLIS (4 octobre). Les lignes de moisson
// d'un compte retiré de VRM restent en base : le widget les comptait — mesuré,
// 2 « à expédier » et 1 « à retirer » sur un compte qui n'existe plus, sur
// l'écran d'accueil de son iPhone. Seuls les comptes encore liés
// (`vinted_accounts`) comptent, comme dans l'app. `null` = pas su lire la liste :
// on ne filtre RIEN (sous-filtrer rend le chiffre d'avant ; sur-filtrer ferait
// disparaître les colis d'un compte vivant sur un hoquet).
// ⚠️ ET UNE LISTE VIDE N'EST PAS UNE RÉPONSE (§4.1) : la même lecture faite avec
// la clé publique sur une base cloisonnée rend `[]` SANS erreur. La prendre pour
// « aucun compte » viderait le widget de tous ses colis — le zéro inventé que
// cette route a appris à ne plus afficher. Vide ⇒ on ne filtre pas.
async function comptesVivants() {
  try {
    const j = await fetchPaginated(scoped('vinted_accounts?select=vinted_user_id'));
    if (!j) return null;
    const s = new Set(j.map((r) => String(r.vinted_user_id || '')).filter(Boolean));
    return s.size ? s : null;
  } catch (_) { return null; }
}
const uidDeLigne = (id) => { const m = String(id || '').match(/^harvest_(.+?)_orders_/); return m ? m[1] : ''; };
// On n'écarte une ligne que si on SAIT qu'elle est d'un compte retiré : liste des
// comptes lue ET identifiant de ligne lisible. Un doute ne fait rien disparaître.
const ligneDunCompteRetire = (vivants, id) => { const u = uidDeLigne(id); return !!(vivants && u && !vivants.has(u)); };
async function comptesAExpedierOuRetirer(kind, vivants) {
  try {
    const sel = 'id,txns:data->resume->txns';
    const rows = await fetchPaginated(scoped(`app_data?id=like.harvest_%25_orders_${kind}&select=${sel}`));
    if (!rows) return null;
    const vus = new Set(); let resumeTrouve = false;
    for (const row of rows) {
      if (ligneDunCompteRetire(vivants, row.id)) continue;
      if (!Array.isArray(row.txns)) continue;
      resumeTrouve = true;
      for (const t of row.txns) vus.add(String(t));
    }
    // Aucune ligne n'a encore de résumé (extension pas rechargée) → on le dit à
    // l'appelant, qui retombera sur la lecture complète. Une seule fois : dès la
    // première capture avec la nouvelle extension, on ne lit plus que ~1 Ko.
    return resumeTrouve ? [...vus] : null;
  } catch (_) { return null; }
}
async function harvestOrders(kind, vivants) {
  try {
    const j = await fetchPaginated(scoped(`app_data?id=like.harvest_%25_orders_${kind}&select=id,data`));
    if (!j) return null;
    const out = {};
    for (const row of j) {
      if (ligneDunCompteRetire(vivants, row.id)) continue;
      const items = (row.data && row.data.payload && row.data.payload.my_orders) || [];
      for (const o of items) if (o && o.transaction_id != null) out[o.transaction_id] = o; // dédoublonne par transaction
    }
    return Object.values(out);
  } catch (_) { return null; }
}
// À expédier : la vente attend que TU postes le colis. MÊME RÈGLE que l'app
// (`aExpedier`) et l'extension (`A_EXPEDIER`) : le champ machine de Vinted
// d'abord, le texte seulement pour une vieille capture (§11, comparées par
// `scripts/audit-statuts.cjs`). Ne sert qu'en repli : d'habitude le widget lit
// le résumé que l'extension a posé avec cette même règle.
const awaitingShip = (s) => /bordereau\s+envoy[ée]\s+au\s+vendeur|bordereau\s+d.envoi\s+command|commande\s+du\s+bordereau/i.test(s || '') || /paiement.*valid/i.test(s || '');
const PAS_UN_ENVOI = /annul|cancel|refus|rembours|retour|suspend|finalis|paiement\s+a\s+[ée]chou|[ée]chec\s+du\s+paiement/i;
function besoinBordereauTexte(status) {
  const s = String(status || '').toLowerCase();
  if (!s) return true;
  if (/annul|refus|rembours|cancel|retour|suspend/.test(s)) return false;
  if (/paiement\s+a\s+[ée]chou|[ée]chec\s+du\s+paiement/.test(s)) return false;
  if (/finalis|termin|complet|cl[oô]tur/.test(s)) return false;
  if (awaitingShip(s)) return true;
  if (/exp[eé]di|envoy|transit|achemin|en route|livr|remis|r[ée]ception/.test(s)) return false;
  return true;
}
export function aExpedier(o) {
  if (!o) return false;
  const s = String(o.status || '');
  if (PAS_UN_ENVOI.test(s)) return false;
  const t = String(o.transaction_user_status || '').toLowerCase();
  if (t === 'needs_action') return true;
  if (t === 'waiting' || t === 'completed' || t === 'failed') return false;
  return besoinBordereauTexte(s);
}
// À retirer : l'achat est déposé au point relais, en attente que tu le récupères.
const atRelay = (s) => /d[ée]pos[ée]/i.test(s || '') && /point\s+relais|bureau\s+de\s+poste/i.test(s || '');
// ⚠️⚠️ CETTE ROUTE RAPATRIAIT 197 Ko POUR EN LIRE 1. Mesuré le 15 septembre sur
// sa vraie base : la ligne `main` pèse **197 Ko** (127 Ko rien que pour
// `vinted_annonce_numeros`) et cette fonction la lisait ENTIÈRE, à chaque
// rafraîchissement du widget de son iPhone — alors qu'elle n'en utilise que
// **trois clés**, qui pèsent **1 Ko à elles trois**.
// C'est §4.4 mot pour mot, et sur la route qui a DÉJÀ crevé le quota d'égress
// (5,7 Go) avec un `select=data`. *La leçon avait été apprise pour les
// commandes, jamais pour `main`.* Mesuré après : **197 Ko / 1 070 ms →
// 1 Ko / 494 ms**, valeurs identiques.
// ⚠️ L'alias porte le nom de la clé : la ligne rendue se lit exactement comme
//    avant (`m.vrm_widget_token`), donc aucun appelant à renommer.
// ⚠️ Et les colis qu'il a COCHÉS « posté » (`vinted_ship_done`, par transaction)
// ou marqués expédiés sur leur bordereau (`vinted_bords_shipped`), et les ventes
// qu'il a masquées : l'app les sort de « à expédier », le widget les comptait
// encore — et les annonçait « en retard » une fois la date limite passée
// (2 colis déjà postés, le 4 octobre).
const MAIN_WIDGET = ['vrm_widget_token', 'vinted_pickup_done', 'vinted_bords_printed', 'vinted_ship_done', 'vinted_bords_shipped', 'vinted_sales_hidden'];
async function main() {
  try {
    const sel = MAIN_WIDGET.map((k) => `${k}:data->${k}`).join(',');
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${scoped(`app_data?id=eq.main&select=${sel}`)}`, { headers: HEADERS });
    if (!r.ok) return null;
    const j = await r.json();
    if (!Array.isArray(j)) return null;
    return j[0] || {};
  } catch (_) { return null; }
}
// Photo des chiffres publiée par l'app elle-même (ligne widget_stats) → source
// PRIORITAIRE pour l'encaissé/ventes du mois, pour coller EXACTEMENT à l'app.
async function snapshot() {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${scoped(`app_data?id=eq.widget_stats&select=data`)}`, { headers: HEADERS });
    if (!r.ok) return null;
    const j = await r.json(); return (j[0] && j[0].data) || null;
  } catch (_) { return null; }
}

export default async function handler(req, res) {
  // ⚠️ CETTE ROUTE ÉTAIT PUBLIQUE. N'importe qui connaissant l'adresse lisait le
  // chiffre d'affaires du mois, le nombre de ventes, l'argent en attente et le
  // nombre d'annonces en ligne. Il n'y avait ni clé, ni compte, ni restriction
  // d'origine — et l'en-tête « Access-Control-Allow-Origin: * » permettait même
  // à n'importe quel site web de la lire depuis le navigateur d'un visiteur.
  //
  // Elle exige désormais une CLÉ personnelle (?k=…), générée par l'app et
  // rangée dans tes données. Le widget iPhone la porte dans son URL.
  //
  // Transition : tant qu'aucune clé n'existe dans la base (donc avant que tu
  // aies rouvert l'app une fois), la route continue de répondre — sinon ton
  // widget tomberait en panne avant même que tu aies pu récupérer la nouvelle
  // adresse. Dès que la clé existe, la route est fermée sans clé valide.
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  try {
    // ⚠️ MULTI-VENDEURS : on résout SON owner par la clé AVANT toute lecture, et
    //    on enveloppe tout le calcul dans son contexte → chaque `scoped(…)` se
    //    filtre sur lui. Sans ça, `main()` prenait le premier `main` venu et les
    //    balayages voyaient TOUS les vendeurs : B aurait lu les chiffres de A.
    const owner = await ownerDuToken(req, res);
    if (owner === null) return; // ownerDuToken a déjà répondu (503/401)
    // ⚠️ QUI NE PAIE PLUS NE VOIT PLUS SES CHIFFRES (Julien, 4 octobre) : la
    //    même règle que la base (`vrm_acces_pour`). Aucun nombre, comme une
    //    lecture ratée — un widget sans `ship` affiche un tiret, jamais « 0 ».
    //    « Pas su » ne coupe pas (un hoquet ne doit pas vider l'écran d'un payeur).
    if (owner && (await accesVendeur(owner)) === false) {
      res.status(402).json({ erreur: 'abonnement', message: "Ton abonnement VRM n'est plus actif." });
      return;
    }
    await contexteVendeur.run({ owner }, async () => {
    // On tente D'ABORD les résumés scalaires (~1 Ko). La lecture complète des
    // commandes (791 Ko) ne repart que si aucune ligne n'a encore de résumé,
    // c'est-à-dire tant que l'extension n'a pas recapté une fois.
    const vivants = await comptesVivants();
    const [bords, txSold, txBuy, finals, sales, m, snap] = await Promise.all([
      bordRows(), comptesAExpedierOuRetirer('sold', vivants), comptesAExpedierOuRetirer('purchased', vivants),
      rows('email_final_*'), rows('email_sale_*'), main(), snapshot(),
    ]);
    const sold = txSold ? [] : await harvestOrders('sold', vivants);
    const purchased = txBuy ? [] : await harvestOrders('purchased', vivants);

    // ⚠️ AVANT TOUT LE RESTE : a-t-on seulement pu LIRE ? Un chiffre absent est
    //    honnête, un zéro inventé ne l'est pas — et c'est lui qu'il regarde le
    //    matin sur son écran d'accueil. On ne renvoie AUCUN nombre : un widget
    //    qui ne trouve pas `ship` affiche un tiret, jamais « 0 ».
    //    ⚠️ Et la clé du widget vit dans `main` : sans elle, `expected` valait
    //    '' et la route répondait SANS clé. Se taire referme aussi ça.
    if (m === null || bords === null || finals === null || sales === null
        || sold === null || purchased === null) {
      res.status(503).json({
        erreur: 'base-injoignable',
        message: "Je n'ai pas pu lire tes données — ce n'est pas « rien à faire ». Rien n'est perdu, c'est la lecture qui échoue.",
      });
      return;
    }

    const expected = m && m.vrm_widget_token ? String(m.vrm_widget_token) : '';
    if (expected) {
      const given = String((req.query && (req.query.k || req.query.key)) || req.headers['x-vrm-key'] || '');
      // Comparaison à durée constante : une comparaison classique s'arrête au
      // premier caractère différent, ce qui laisse deviner la clé lettre par
      // lettre en mesurant le temps de réponse.
      const ok = given.length === expected.length
        && given.split('').reduce((acc, ch, i) => acc | (ch.charCodeAt(0) ^ expected.charCodeAt(i)), 0) === 0;
      if (!ok) { res.status(401).json({ error: 'cle invalide' }); return; }
    }
    const today = parisDate(0), tomorrow = parisDate(1), ym = today.slice(0, 7);

    // À expédier + à retirer = STATUT VINTED (automatique, à jour). Fini les
    // emails imprécis : Vinted sait quand c'est expédié / récupéré.
    const pickupDone = m.vinted_pickup_done || {};
    const shipDone = (m.vinted_ship_done && typeof m.vinted_ship_done === 'object') ? m.vinted_ship_done : {};
    const bordsShipped = (m.vinted_bords_shipped && typeof m.vinted_bords_shipped === 'object') ? m.vinted_bords_shipped : {};
    const ventesMasquees = new Set(Array.isArray(m.vinted_sales_hidden) ? m.vinted_sales_hidden.map(String) : []);
    const pasPartie = (t) => !shipDone[t] && !bordsShipped[t] && !ventesMasquees.has(t);
    const shipTxns = new Set((txSold ? txSold : sold.filter(o => aExpedier(o)).map(o => String(o.transaction_id))).map(String).filter(pasPartie));
    const shipTotal = shipTxns.size;
    const pickup = txBuy
      ? txBuy.filter(t => !pickupDone[String(t)]).length
      : purchased.filter(o => atRelay(o.status) && !pickupDone[String(o.transaction_id)]).length;
    // Urgence d'expédition : on croise avec les bordereaux (date limite) pour les
    // ventes réellement en attente d'envoi.
    const printed = m.vinted_bords_printed || {};
    const bKey = (b) => String(b.transaction || b.suivi || b.numero || '');
    let shipOverdue = 0, shipToday = 0, shipTomorrow = 0;
    for (const b of bords) {
      if (printed[bKey(b)] || bordsShipped[bKey(b)] || (b.transaction && !shipTxns.has(String(b.transaction)))) continue;
      const iso = frToIso(b.dateLimite); if (!iso) continue;
      if (iso < today) shipOverdue += 1; else if (iso === today) shipToday += 1; else if (iso === tomorrow) shipTomorrow += 1;
    }

    // ── CA + VENTES DU MOIS : LA MÊME SOURCE QUE L'APP ────────────────────────
    // ⚠️ Ce bloc lisait les emails de vente, alors que l'app calcule désormais
    // sur la moisson Vinted (§33 : les emails classaient mal achats et ventes,
    // et voyaient 12 ventes / 308 € là où la moisson en voit 17 / 437 €).
    // Deux chiffres pour la même chose sur le même écran d'accueil, c'est le
    // genre d'écart qui fait douter de tout l'outil.
    // ➡️ RÉFÉRENCE = la photo publiée par l'app (`widget_stats`), donc le widget
    //    affiche EXACTEMENT ce que montre l'app. Repli sur les emails uniquement
    //    si cette photo manque ou date d'un autre mois — sinon le widget
    //    resterait bloqué sur le mois précédent tant que l'app n'est pas ouverte.
    //    `moneySource` dit laquelle a servi (le widget peut l'afficher).
    let moneyMonth = 0, salesMonth = 0;
    for (const s of sales) {
      if (String(s.receivedAt || '').slice(0, 7) !== ym) continue;
      salesMonth += 1;
      const p = parseFloat(String(s.prix || '').replace(',', '.'));
      if (!isNaN(p) && p > 0) moneyMonth += p;
    }
    let moneySource = 'emails';
    const snapMois = snap && snap.updatedAt ? String(snap.updatedAt).slice(0, 7) : null;
    if (snap && snapMois === ym && snap.caMois != null) {
      moneyMonth = Number(snap.caMois) || 0;
      salesMonth = snap.ventesMois != null ? Number(snap.ventesMois) || 0 : salesMonth;
      moneySource = 'app';
    }
    // Argent réellement viré ce mois (emails de finalisation) — info secondaire.
    let receivedMonth = 0;
    for (const f of finals) { if (String(f.receivedAt || '').slice(0, 7) === ym) { const n = parseFloat(String(f.montant || '').replace(',', '.')); if (!isNaN(n)) receivedMonth += n; } }

    res.status(200).json({
      ship: { total: shipTotal, overdue: shipOverdue, today: shipToday, tomorrow: shipTomorrow },
      pickup,
      moneyMonth: Math.round(moneyMonth),
      salesMonth,
      moneySource, // 'app' = identique à l'écran de l'app · 'emails' = repli

      received: Math.round(receivedMonth),
      pending: snap && snap.enAttente != null ? snap.enAttente : null,
      online: snap && snap.online != null ? snap.online : null,
      unread: snap && snap.unread != null ? snap.unread : null,
      appSyncedAt: snap ? snap.updatedAt : null,
      updatedAt: new Date().toISOString(),
    });
    }); // fin contexteVendeur.run
  } catch (e) {
    // Une exception n'est pas « aucun colis » : on ne renvoie aucun chiffre.
    res.status(500).json({ erreur: 'panne', message: "Je n'ai pas pu calculer tes chiffres — ce n'est pas « rien à faire »." });
  }
}
