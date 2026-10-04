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
// ⚠ N'appelle JAMAIS l'API Vinted (aucun risque de blocage) : il ne lit que
//   Supabase et envoie une notification. Déclenché par le cron Vercel (vercel.json).
// ────────────────────────────────────────────────────────────────────────────

import { sendPushToAll, pushCategorieActive } from './_lib/push.js';

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
async function getRow(id) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${scoped(`app_data?id=eq.${encodeURIComponent(id)}&select=data`)}`, { headers: HEADERS });
    if (!r.ok) return null;
    const rows = await r.json();
    return (rows[0] && rows[0].data) || null;
  } catch (_) { return null; }
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
// La base sait-elle séparer les vendeurs ? Un `select=owner` répond 400 sinon.
async function cloisonnee() {
  try { return (await fetch(`${SUPABASE_URL}/rest/v1/app_data?select=owner&limit=1`, { headers: HEADERS })).ok; }
  catch (_) { return false; }
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
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=${conflict}`, {
      method: 'POST',
      headers: { ...HEADERS, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([row]),
    });
  } catch (_) { /* un mémo raté n'empêche pas le rappel suivant */ }
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
    const m = (await getRow('main')) || {};
    const printed = m.vinted_bords_printed || {};
    const shippedManual = m.vinted_bords_shipped || {};
    const hidden = m.vinted_bords_hidden || {};
    const panelDone = (await getRow('panel_bords_done')) || {};
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

    // Transactions encore en attente d'expédition, d'après la moisson.
    let attente = null;
    // Seuls les comptes encore liés comptent (comme l'app et le widget) : la
    // moisson d'un compte retiré reste en base. `null` = pas su → on ne filtre pas.
    let vivants = null;
    try {
      const va = await fetchPaginated(scoped('vinted_accounts?select=vinted_user_id'));
      if (va) vivants = new Set(va.map((r) => String(r.vinted_user_id || '')).filter(Boolean));
    } catch (_) { vivants = null; }
    try {
      const lignes = await fetchPaginated(scoped(`app_data?id=like.harvest_%25_orders_sold&select=id,txns:data->resume->txns`));
      if (lignes) {
        for (const l of lignes) {
          const um = String(l.id || '').match(/^harvest_(.+?)_orders_/);
          if (vivants && !(um && vivants.has(um[1]))) continue;
          if (!Array.isArray(l.txns)) continue;
          if (!attente) attente = new Set();
          for (const t of l.txns) attente.add(String(t));
        }
      }
    } catch (_) { attente = null; }
    // ⚠️ Aucune ligne ne porte encore de résumé (extension pas rechargée) : on
    // se TAIT. Une notification fausse est pire que pas de notification — c'est
    // très exactement le « 51 bordereaux » qu'on corrige ici.
    if (!attente) return { urssaf, skipped: 'resume absent — aucune notification envoyee' };

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
    if (dedup.date === today && dedup.total === total) return { urssaf, skipped: 'déjà notifié', total };

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
    return { urssaf, overdue, dueToday, dueTomorrow, total };
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
    // ── Base NON cloisonnée (comportement d'aujourd'hui, à l'identique) ───────
    //    Un seul jeu de données, aucune colonne `owner` : une passe, sans filtre.
    if (!(await cloisonnee())) {
      const out = await traiterVendeur();
      res.status(200).json({ ok: true, ...out });
      return;
    }
    // ── Base cloisonnée : UNE passe PAR vendeur, chacun dans son contexte ─────
    //    (ses bordereaux, son dédoublonnage, ses appareils). On ne pousse JAMAIS
    //    hors contexte : si on ne peut pas énumérer, on ne devine pas.
    const owners = await ownersActifs();
    if (!owners) { res.status(200).json({ ok: true, skipped: 'vendeurs non énumérables (lecture en panne)' }); return; }
    const bilans = [];
    for (const o of owners) {
      const out = await contexteVendeur.run({ owner: o }, () => traiterVendeur());
      bilans.push({ owner: o, ...out });
    }
    res.status(200).json({ ok: true, vendeurs: owners.length, bilans });
  } catch (e) {
    // Une tâche planifiée qui répond 200 sur une panne n'apparaît nulle part :
    // le tableau de bord la compte réussie, et les rappels d'expédition
    // cessent en silence. 500 = visible.
    res.status(500).json({ ok: false, erreur: 'panne', message: String(e) });
  }
}
