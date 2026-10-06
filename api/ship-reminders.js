// api/ship-reminders.js
// ────────────────────────────────────────────────────────────────────────────
// RAPPEL D'EXPÉDITION (cron quotidien).
//
// Vinted pénalise les colis expédiés en retard. Ce job lit les bordereaux reçus
// par email (lignes email_bord_* de Supabase), garde ceux qui NE sont PAS encore
// marqués « imprimés/expédiés » (vinted_bords_printed) et dont la date limite est
// aujourd'hui, demain, ou déjà dépassée, puis envoie UNE notification push
// récapitulative sur tous les appareils abonnés.
//
// Il porte aussi, faute d'un second cron : le rappel URSSAF du 1er du mois, et
// le BILAN DE LA SEMAINE du lundi matin (api/_lib/bilan-semaine.js dit pourquoi
// le lundi et pas le dimanche soir).
//
// ⚠ N'appelle JAMAIS l'API Vinted (aucun risque de blocage) : il ne lit que
//   Supabase et envoie une notification. Déclenché par le cron Vercel (vercel.json).
// ────────────────────────────────────────────────────────────────────────────

import { sendPushToAll, pushCategorieActive } from './_lib/push.js';
import { semainePassee, calculerBilan, bilanAEnvoyer, texteBilan, versementsDeLignes } from './_lib/bilan-semaine.js';
// « À expédier » : la règle du widget (elle-même jugée identique à celle de
// l'app et de l'extension par audit-statuts.cjs). Importée, jamais recopiée.
import { aExpedier } from './widget.js';

import { withOwnerAll, conflictTarget, contexteVendeur, proprietaireCourant } from './_lib/owner.js';
import { sbCle } from './_lib/cle.js';

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
const VENDEURS_EN_PARALLELE = 8;

// Date du jour (et de demain) dans le fuseau de Paris, en 'YYYY-MM-DD'.
function parisDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }); // 'YYYY-MM-DD'
}
// « JJ/MM/AAAA … » → 'YYYY-MM-DD' (ou null si illisible).
function frToIso(s) {
  const m = String(s || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}
// Trois états, jamais deux : la ligne (objet) · `null` = elle n'existe pas ·
// `undefined` = la base n'a pas répondu (« rien lu » ne vaut pas « rien »).
async function getRow(id) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${scoped(`app_data?id=eq.${encodeURIComponent(id)}&select=data`)}`, { headers: HEADERS });
    if (!r.ok) return undefined;
    const rows = await r.json();
    if (!Array.isArray(rows)) return undefined;
    return (rows[0] && rows[0].data) || null;
  } catch (_) { return undefined; }
}
// ── MULTI-VENDEURS ────────────────────────────────────────────────────────────
// Ce cron tourne SANS vendeur connecté. Tant que la base n'était pas cloisonnée,
// il calculait UN total global et le poussait à tout le monde (`sendPushToAll`) :
// juste tant qu'il n'y a qu'un vendeur, faux dès qu'il y en a deux (le résumé de
// l'un part sur le téléphone de l'autre). On tourne donc une fois PAR vendeur,
// dans son contexte (`contexteVendeur`), et toutes les lectures/écritures se
// filtrent sur `owner` — exactement l'infra que le pipeline email utilise déjà.
//
// `scoped(path)` ajoute `owner=eq.<vendeur du tour>` ; vide hors boucle (base non
// cloisonnée) → URL inchangée, comportement d'aujourd'hui À L'IDENTIQUE.
function scoped(path) {
  const o = proprietaireCourant();
  return o ? path + (path.includes('?') ? '&' : '?') + `owner=eq.${encodeURIComponent(o)}` : path;
}
// La base sait-elle séparer les vendeurs ? 200 = oui · 400 (colonne absente) =
// non · tout le reste = PAS SU (`null`). ⚠️ Une panne prise pour « non » faisait
// basculer le cron en passe GLOBALE sur une base cloisonnée : les bordereaux de
// tous les vendeurs comptés ensemble, et le résumé poussé sans vendeur — le
// mélange que la boucle par vendeur existe pour empêcher. (push.js avait le même
// défaut, corrigé le 4 octobre.)
async function cloisonnee() {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?select=owner&limit=1`, { headers: HEADERS });
    if (r.ok) return true;
    if (r.status === 400) return false;
    return null;
  } catch (_) { return null; }
}
// Les vendeurs actifs = un `main` par vendeur (clé (owner,id)). La clé de service
// contourne RLS → on les voit tous. `null` si on ne peut pas énumérer (lecture en
// panne) → on ne devine pas, on ne pousse rien plutôt qu'un résumé mélangé.
async function ownersActifs() {
  const rows = await fetchPaginated('app_data?id=eq.main&select=owner');
  if (!rows) return null;
  const s = new Set();
  for (const r of rows) if (r && r.owner) s.add(String(r.owner));
  return [...s];
}
// Écrit un mémo de dédoublonnage POUR LE VENDEUR DU TOUR (clé (owner,id) quand on
// est cloisonné, `id` seul sinon). Sans ça, deux vendeurs partageraient le même
// `ship_reminder_dedup` et l'un ferait taire l'autre.
async function ecrireDedup(id, data) {
  const o = proprietaireCourant();
  const row = o ? { owner: o, id, data } : withOwnerAll([{ id, data }])[0];
  const conflict = o ? 'owner,id' : conflictTarget('id');
  // Rend VRAI seulement si la base a confirmé : le bilan de la semaine ne part
  // QUE si son mémo est rangé (sinon il repartirait le lendemain — deux bilans).
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=${conflict}`, {
      method: 'POST',
      headers: { ...HEADERS, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([row]),
    });
    return !!(r && r.ok);
  } catch (_) { return false; /* un mémo raté n'empêche pas le rappel suivant */ }
}
// ⚠️ §4.5 — Supabase tronque à 1000 lignes SANS LE DIRE. Ce cron balaie
// `email_bord_*` et `harvest_%25_orders_sold` de TOUS les utilisateurs : à
// l'échelle, au-delà de 1000 lignes il en perdrait en silence → des vendeurs
// sans rappel d'expédition. On pagine, et `null` si une page échoue (jamais une
// demi-liste prise pour complète — même règle que `sbGetTout` côté app).
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

// ── LE BILAN DE LA SEMAINE (api/_lib/bilan-semaine.js) ───────────────────────
// Une ligne de la base, projetée sur les seules clés voulues (§4.4 : `main`
// pèse ~200 Ko). Trois états : objet · `null` (absente) · `undefined` (pas su).
async function getRowProjete(id, cles) {
  try {
    const sel = cles.map((k) => `${k}:data->${k}`).join(',');
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${scoped(`app_data?id=eq.${encodeURIComponent(id)}&select=${sel}`)}`, { headers: HEADERS });
    if (!r.ok) return undefined;
    const rows = await r.json();
    if (!Array.isArray(rows)) return undefined;
    return rows[0] || null;
  } catch (_) { return undefined; }
}
const MAIN_BILAN = ['vinted_sales_hidden', 'vinted_accounts_hidden', 'vinted_ship_done', 'vinted_bords_shipped', 'vrm_paires_dorment'];
const ensemble = (v) => new Set(Array.isArray(v) ? v.map(String) : []);
const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

// Lit tout ce que le bilan d'UN vendeur demande. Chaque source vaut `null`
// quand sa lecture a échoué — jamais `[]` à sa place (« rien lu » ≠ « rien »).
async function lireDonneesBilan() {
  const [comptesL, m, panneau, lignes, lbcL, ebayL, txn] = await Promise.all([
    fetchPaginated(scoped('vinted_accounts?select=vinted_user_id,login')),
    getRowProjete('main', MAIN_BILAN),
    getRow('panel_accounts_off'),
    // Les ventes de chaque compte : la liste, le résumé « à expédier » posé par
    // l'extension, et QUAND elle a été lue (data.capturedAt — `updated_at` ment).
    fetchPaginated(scoped('app_data?id=like.harvest_%25_orders_sold&select=id,orders:data->payload->my_orders,txns:data->resume->txns,cap:data->>capturedAt')),
    getRowProjete('lbc_ventes', ['ventes']),
    getRowProjete('ebay_orders', ['orders']),
    // Les dates de versement : trois scalaires par transaction (§4.4), paginé (§4.5).
    fetchPaginated(scoped('app_data?id=like.harvest_%25_txn_%25&select=tx:meta->>id,s:meta->>status,su:meta->>status_updated_at')),
  ]);
  const comptes = Array.isArray(comptesL)
    ? comptesL.map((c) => ({ uid: String((c && c.vinted_user_id) || ''), login: String((c && c.login) || '') })).filter((c) => c.uid)
    : null;
  let commandes = null;
  if (Array.isArray(lignes)) {
    commandes = {};
    for (const l of lignes) {
      const um = String((l && l.id) || '').match(/^harvest_(.+?)_orders_sold$/);
      if (um) commandes[um[1]] = { orders: Array.isArray(l.orders) ? l.orders : [], txns: Array.isArray(l.txns) ? l.txns : null, cap: l.cap || null };
    }
  }
  const mm = m === undefined ? null : objet(m);
  return {
    comptes, commandes,
    masquesTx: mm ? ensemble(mm.vinted_sales_hidden) : null,
    masquesComptes: mm ? ensemble(mm.vinted_accounts_hidden) : null,
    panneau: panneau === undefined ? null : objet(panneau),
    lbc: lbcL === undefined ? null : Object.values(objet(lbcL && lbcL.ventes)),
    ebay: ebayL === undefined ? null : (Array.isArray(ebayL && ebayL.orders) ? ebayL.orders : []),
    versements: versementsDeLignes(txn),
    main: mm,
  };
}

// « À expédier maintenant » : EXACTEMENT la composition du widget
// (api/widget.js) — le résumé posé par l'extension, sinon `aExpedier` sur les
// ventes, moins ce qu'il a coché « posté » ou masqué. Le banc
// `bancs/bilan-semaine.cjs` exécute les DEUX routes et exige le même nombre.
function colisAExpedier(d) {
  if (!d.commandes || !d.main || !Array.isArray(d.comptes)) return null;
  const vivants = new Set(d.comptes.map((c) => c.uid));
  const shipDone = objet(d.main.vinted_ship_done), bordsShipped = objet(d.main.vinted_bords_shipped);
  const masquees = ensemble(d.main.vinted_sales_hidden);
  const pasPartie = (t) => !shipDone[t] && !bordsShipped[t] && !masquees.has(t);
  const resume = new Set(); let resumeTrouve = false;
  const parTx = {};
  for (const [uid, l] of Object.entries(d.commandes)) {
    if (vivants.size && !vivants.has(uid)) continue;            // compte retiré : sa moisson reste en base
    if (Array.isArray(l.txns)) { resumeTrouve = true; for (const t of l.txns) resume.add(String(t)); }
    for (const o of l.orders) if (o && o.transaction_id != null) parTx[o.transaction_id] = o;
  }
  const txs = resumeTrouve ? [...resume] : Object.values(parTx).filter((o) => aExpedier(o)).map((o) => String(o.transaction_id));
  return new Set(txs.map(String).filter(pasPartie)).size;
}

async function bilanDeLaSemaine(maintenant = Date.now()) {
  const sem = semainePassee(maintenant);
  if (sem.jour > 3) return null;                                  // lundi, ou rattrapage mardi/mercredi
  const deja = await getRow('bilan_semaine_dedup');
  if (deja === undefined) return 'mémo illisible — rien envoyé';   // pas su ⇒ on ne risque pas un doublon
  if (deja && deja.semaine === sem.lundi) return 'déjà envoyé';
  if (!(await pushCategorieActive('bilan'))) return 'désactivé par le vendeur';
  const d = await lireDonneesBilan();
  if (Array.isArray(d.comptes) && !d.comptes.length) return 'aucun compte Vinted lié';
  const b = calculerBilan({
    ...d, colis: colisAExpedier(d),
    dorment: d.main ? d.main.vrm_paires_dorment : null,
    debut: sem.debut, fin: sem.fin, maintenant,
  });
  if (!bilanAEnvoyer(b)) return 'données illisibles — réessai demain';
  // Le mémo AVANT l'envoi, et CONFIRMÉ : un bilan par semaine, jamais deux.
  if (!(await ecrireDedup('bilan_semaine_dedup', { semaine: sem.lundi, at: new Date(maintenant).toISOString() }))) return 'mémo non écrit — rien envoyé';
  const t = texteBilan(b, sem);
  const envoi = await sendPushToAll({ title: t.titre, body: t.corps, tag: 'bilan-' + sem.lundi, url: '/?tab=journee' });
  // Le bilan rendu ne porte AUCUN montant (la réponse d'un cron se lit dans un
  // tableau de bord) : seulement les états, et le nombre de colis.
  return { semaine: sem.lundi, vendu: b.vendu.etat, recu: b.recu.etat, colis: b.colis.n, envoi: envoi && (envoi.coupe || envoi.erreur || envoi.sent) };
}

// Le traitement d'UN vendeur (celui du `contexteVendeur` courant, ou l'unique
// vendeur d'une base non cloisonnée). Rend un bilan, n'écrit jamais dans `res`.
async function traiterVendeur() {
    // ⚠️ ÉGRESS : surtout PAS `select=data` — chaque bordereau embarque son PDF
    // en base64 (deux fois), ~6 Mo au total pour ~50 lignes, alors qu'on ne lit
    // que la date limite + les clés. On projette donc ces 4 champs scalaires
    // (même correctif que dans api/widget.js et §23 côté app).
    const BORD_SELECT = 'dateLimite:data->>dateLimite,transaction:data->>transaction,suivi:data->>suivi,numero:data->>numero';
    const rows = (await fetchPaginated(scoped(`app_data?id=like.email_bord_*&select=${BORD_SELECT}`))) || [];
    // ⚠️⚠️ CE COMPTE ÉTAIT FAUX, ET LA NOTIFICATION MENTAIT EN GRAND.
    // Il ne regardait QUE `vinted_bords_printed`. Or depuis §24 imprimer ne
    // marque plus rien comme fait : cette liste est donc quasi vide, et le cron
    // annonçait « 51 bordereaux à envoyer » (plainte de Julien) alors que
    // **3 colis** attendaient réellement — mesuré sur les 72 bordereaux réels :
    // 68 déjà partis selon Vinted, 1 vente inconnue, 3 en attente.
    // La seule question qui compte : **cette vente attend-elle encore MON
    // envoi ?** C'est exactement ce que l'extension écrit à la capture
    // (`data.resume.txns`, §5.14) — même règle que l'app, lu en scalaire.
    const today = parisDate(0);
    const mLu = await getRow('main');
    const panelLu = await getRow('panel_bords_done');
    const m = mLu || {};
    const printed = m.vinted_bords_printed || {};
    const shippedManual = m.vinted_bords_shipped || {};
    const hidden = m.vinted_bords_hidden || {};
    const panelDone = panelLu || {};
    // Colis cochés « posté » dans l'app (par transaction) : ils ne sont plus à
    // expédier — l'app les sort, la notification les comptait encore (4 oct.).
    const shipDone = (m.vinted_ship_done && typeof m.vinted_ship_done === 'object') ? m.vinted_ship_done : {};
    const key = (b) => String(b.transaction || b.suivi || b.numero || '');

    // RAPPEL URSSAF — le 1er de chaque mois (Julien, 30 sept. : « envoie
    // simplement une notification le premier de chaque mois pour la faire »).
    // Posé AVANT le calcul des colis : ce dernier se tait quand le résumé
    // manque, le rappel mensuel ne doit pas se taire avec lui. Une seule fois
    // par mois (ligne `urssaf_reminder_dedup`), et une écriture ratée du mémo
    // n'empêche pas le reste du rappel.
    let urssaf = null;
    try {
      const mois = today.slice(0, 7);
      if (today.endsWith('-01')) {
        const deja = (await getRow('urssaf_reminder_dedup')) || {};
        if (deja.mois !== mois && await pushCategorieActive('urssaf')) {
          await sendPushToAll({
            title: '🧾 Déclaration URSSAF',
            body: 'Nouveau mois : pense à déclarer ton chiffre d\'affaires sur autoentrepreneur.urssaf.fr.',
            tag: 'urssaf-' + mois,
            url: '/?tab=dashboard',
          });
          await ecrireDedup('urssaf_reminder_dedup', { mois });
          urssaf = 'envoyé';
        }
      }
    } catch (_) { urssaf = 'échec'; }

    // BILAN DE LA SEMAINE — le lundi (rattrapage mardi et mercredi). Posé ici,
    // AVANT le calcul des colis du jour : celui-ci se tait quand le résumé
    // manque, le bilan ne doit pas se taire avec lui. Un échec du bilan
    // n'empêche jamais le rappel d'expédition.
    let bilan = null;
    try { bilan = await bilanDeLaSemaine(); } catch (e) { bilan = 'échec : ' + String((e && e.message) || e).slice(0, 120); }

    // Transactions encore en attente d'expédition, d'après la moisson.
    let attente = null;
    // Seuls les comptes encore liés comptent (comme l'app et le widget) : la
    // moisson d'un compte retiré reste en base. `null` = pas su → on ne filtre pas.
    let vivants = null;
    try {
      const va = await fetchPaginated(scoped('vinted_accounts?select=vinted_user_id'));
      if (va) { const s = new Set(va.map((r) => String(r.vinted_user_id || '')).filter(Boolean)); vivants = s.size ? s : null; } // vide n'est pas une réponse (§4.1)
    } catch (_) { vivants = null; }
    try {
      const lignes = await fetchPaginated(scoped(`app_data?id=like.harvest_%25_orders_sold&select=id,txns:data->resume->txns`));
      if (lignes) {
        for (const l of lignes) {
          const um = String(l.id || '').match(/^harvest_(.+?)_orders_/);
          if (vivants && um && !vivants.has(um[1])) continue;            // on n'écarte que ce qu'on SAIT retiré
          if (!Array.isArray(l.txns)) continue;
          if (!attente) attente = new Set();
          for (const t of l.txns) attente.add(String(t));
        }
      }
    } catch (_) { attente = null; }
    // ⚠️ Aucune ligne ne porte encore de résumé (extension pas rechargée) : on
    // se TAIT. Une notification fausse est pire que pas de notification — c'est
    // très exactement le « 51 bordereaux » qu'on corrige ici.
    if (!attente) return { urssaf, bilan, skipped: 'resume absent — aucune notification envoyee' };
    // ⚠️ Ses colis cochés « posté », imprimés ou masqués vivent dans `main` et
    //    `panel_bords_done` : lus en échec, ils compteraient comme « à expédier »
    //    et la notification annoncerait des colis déjà partis. On se tait.
    if (mLu === undefined || panelLu === undefined) return { urssaf, bilan, skipped: 'réglages illisibles — aucune notification envoyée' };

    const tomorrow = parisDate(1);
    let overdue = 0, dueToday = 0, dueTomorrow = 0;
    for (const b of rows) {
      if (!b) continue;
      const k = key(b);
      if (printed[k] || shippedManual[k] || hidden[k] || panelDone[k]) continue;   // déjà traité, ici ou depuis le panneau
      if (!b.transaction || !attente.has(String(b.transaction))) continue;         // Vinted n'attend plus ce colis
      if (shipDone[String(b.transaction)]) continue;                               // coché « posté » dans l'app
      const iso = frToIso(b.dateLimite); if (!iso) continue;
      if (iso < today) overdue += 1;
      else if (iso === today) dueToday += 1;
      else if (iso === tomorrow) dueTomorrow += 1;
    }
    const total = overdue + dueToday + dueTomorrow;

    // Anti-doublon : une seule notification par jour pour un même total.
    const dedup = (await getRow('ship_reminder_dedup')) || {};
    if (dedup.date === today && dedup.total === total) return { urssaf, bilan, skipped: 'déjà notifié', total };

    if (total > 0 && await pushCategorieActive('expedier')) {
      const parts = [];
      if (overdue) parts.push(`${overdue} en retard`);
      if (dueToday) parts.push(`${dueToday} aujourd'hui`);
      if (dueTomorrow) parts.push(`${dueTomorrow} demain`);
      await sendPushToAll({
        title: overdue ? '⏰ Colis à expédier — du retard !' : '📮 Colis à expédier',
        body: `${total} bordereau${total > 1 ? 'x' : ''} à envoyer (${parts.join(' · ')}). Ouvre l'app pour les imprimer.`,
        tag: 'ship-reminder',
        url: '/?tab=cat_bord',
      });
    }
    await ecrireDedup('ship_reminder_dedup', { date: today, total });
    return { urssaf, bilan, overdue, dueToday, dueTomorrow, total };
}

export default async function handler(req, res) {
  // Sécurité optionnelle : si CRON_SECRET est défini sur Vercel, on l'exige
  // (Vercel envoie « Authorization: Bearer <CRON_SECRET> » sur les crons).
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.authorization || '';
    const qk = (req.query && req.query.key) || '';
    if (auth !== `Bearer ${secret}` && qk !== secret) { res.status(401).json({ error: 'clé invalide' }); return; }
  }

  try {
    const cl = await cloisonnee();
    // Pas su : on ne devine pas (ni passe globale, ni passe par vendeur). 503 =
    // visible dans le tableau de bord des crons ; demain le cron repassera.
    if (cl === null) { res.status(503).json({ ok: false, skipped: 'base injoignable — aucun rappel envoyé' }); return; }
    // ── Base NON cloisonnée (comportement d'aujourd'hui, à l'identique) ───────
    //    Un seul jeu de données, aucune colonne `owner` : une passe, sans filtre.
    if (!cl) {
      const out = await traiterVendeur();
      res.status(200).json({ ok: true, ...out });
      return;
    }
    // ── Base cloisonnée : UNE passe PAR vendeur, chacun dans son contexte ─────
    //    (ses bordereaux, son dédoublonnage, ses appareils). On ne pousse JAMAIS
    //    hors contexte : si on ne peut pas énumérer, on ne devine pas.
    const owners = await ownersActifs();
    if (!owners) { res.status(200).json({ ok: true, skipped: 'vendeurs non énumérables (lecture en panne)' }); return; }
    // ⚠️ À L'ÉCHELLE : un vendeur coûte ~6 lectures. À la queue leu leu, mille
    //    vendeurs dépassent les 300 s d'une fonction Vercel et les derniers n'ont
    //    jamais leur rappel. On en traite VENDEURS_EN_PARALLELE à la fois — chacun
    //    dans SON contexte (AsyncLocalStorage : deux vendeurs simultanés ne
    //    partagent ni filtre, ni mémo, ni appareils). Ce sont NOS lectures, pas
    //    des requêtes à Vinted (le garde-fou « une à la fois » du §3 n'est pas ici).
    // ⚠️ Et un vendeur qui plante n'arrête plus les autres : son bilan porte
    //    l'erreur, les suivants reçoivent leur rappel, et la réponse est 500 pour
    //    que l'échec reste visible.
    const bilans = new Array(owners.length);
    let suivant = 0, echecs = 0;
    const ouvrier = async () => {
      while (suivant < owners.length) {
        const i = suivant++; const o = owners[i];
        try {
          const out = await contexteVendeur.run({ owner: o }, () => traiterVendeur());
          bilans[i] = { owner: o, ...out };
        } catch (e) { echecs++; bilans[i] = { owner: o, erreur: String((e && e.message) || e).slice(0, 200) }; }
      }
    };
    await Promise.all(Array.from({ length: Math.min(VENDEURS_EN_PARALLELE, owners.length) }, ouvrier));
    res.status(echecs ? 500 : 200).json({ ok: !echecs, vendeurs: owners.length, echecs, bilans });
  } catch (e) {
    // Une tâche planifiée qui répond 200 sur une panne n'apparaît nulle part :
    // le tableau de bord la compte réussie, et les rappels d'expédition
    // cessent en silence. 500 = visible.
    res.status(500).json({ ok: false, erreur: 'panne', message: String(e) });
  }
}
