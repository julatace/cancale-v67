// api/_lib/prix-achat-demande.js
// ────────────────────────────────────────────────────────────────────────────
// (11 nov., saisie rapide) « VENDU 80 € · N°124 : COMBIEN TU L'AVAIS PAYÉE ? »
// La règle (quelles ventes, le texte, la nuit, la mémoire) est src/prixAchatVente.js,
// la même que l'app. Ici, au nom du vendeur du `contexteVendeur` courant :
//   1. le corps ne fait que NOMMER des ventes (n° de transaction, compte, N°,
//      prix lu par l'app) : chaque transaction est RELUE ici, dans SA ligne
//      `harvest_{uid}_txn_{tx}` (méta, jamais `select=data`) — état de commande
//      présent et qui ne la fait pas revenir (`classifyOrderStatus`, la règle
//      « pas une vente » recopiée de l'app), sinon elle est écartée : jamais
//      pour une vente non prouvée ;
//   2. la nuit (Paris, 22 h – 8 h) ⇒ rien n'est réservé ni envoyé : l'app
//      redemandera le jour ;
//   3. famille « Ventes » éteinte ⇒ rien ;
//   4. SA ligne `vrm_prix_achat_demandes` (comparer-et-échanger sur `rev`) :
//      réserve les ventes jamais demandées — l'écriture confirmée AVANT l'envoi :
//      deux appareils en même temps n'envoient qu'une fois ;
//   5. UNE notification pour toutes (heures calmes et cloche de `sendPushToAll`).
// Rend { status, envoye, n, raison } — jamais d'exception. Aucune nouvelle
// fonction serverless (12 au plus) : la route est /api/push, action `prixachat`.
// ────────────────────────────────────────────────────────────────────────────
import { proprietaireCourant } from './owner.js';
import { sbCle } from './cle.js';
import { sendPushToAll, pushCategorieActive } from './push.js';
import { classifyOrderStatus } from './ventes-regle.js';
import { prixAchatDe } from './prix-achat-regle.js';
import { CLE_DEMANDES, estNuitParis, texteDemande, lienDemande, aDemander, reserver, MAX_GROUPE, ventesSansPrix, corpsDemande } from '../../src/prixAchatVente.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const cle = () => process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';
const ID = /^\d{1,20}$/;
const NUM = /^[A-Za-z0-9 ]{1,12}$/;
// (bancs) L'heure du test, jamais posée en production : l'heure réelle décide.
const instant = () => { const v = process.env.VRM_NOTIF_HORLOGE; const t = v ? Date.parse(v) : NaN; return Number.isFinite(t) ? t : Date.now(); };

async function lire(chemin) {
  const owner = proprietaireCourant();
  if (!owner || !cle()) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${chemin}&owner=eq.${encodeURIComponent(owner)}`, { headers: { ...sbCle(cle()) } });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) ? j : null;
  } catch (_) { return null; }
}

// Le corps nettoyé : au plus 20 ventes, identités seulement.
export function ventesDuCorps(body) {
  const l = Array.isArray(body && body.ventes) ? body.ventes.slice(0, 20) : [];
  const out = [], vus = new Set();
  for (const v of l) {
    const tx = String((v && v.tx) || '').trim(), uid = String((v && v.uid) || '').trim(), num = String((v && v.num) || '').trim();
    if (!ID.test(tx) || !ID.test(uid) || !NUM.test(num) || vus.has(tx)) continue;
    const e = v && v.eur != null && Number.isFinite(Number(v.eur)) && Number(v.eur) > 0 && Number(v.eur) < 100000 ? Math.round(Number(v.eur) * 100) / 100 : null;
    vus.add(tx); out.push({ tx, uid, num, eur: e });
  }
  return out;
}

// Les transactions relues : Set des n° PROUVÉS vendus (état présent, pas revenue), ou null (pas su).
async function prouvees(ventes) {
  if (!ventes.length) return new Set();
  const ids = ventes.map((v) => `harvest_${v.uid}_txn_${v.tx}`);
  const rows = await lire(`app_data?id=in.(${ids.join(',')})&select=id,ti:meta->>status_title`);
  if (rows === null) return null;
  const ok = new Set();
  for (const r of rows) {
    const m = /^harvest_\d+_txn_(\d+)$/.exec(String((r && r.id) || ''));
    const etat = String((r && r.ti) || '').trim();
    if (m && etat && classifyOrderStatus(etat) !== 'cancelled') ok.add(m[1]);
  }
  return ok;
}

// Comparer-et-échanger sur `data.rev` de SA ligne (la forme de compte-relie.js).
async function modifierLigne(modifier, essais = 5) {
  const owner = proprietaireCourant();
  if (!owner || !cle()) return null;
  const tete = { ...sbCle(cle()), 'Content-Type': 'application/json' };
  for (let n = 0; n < essais; n++) {
    const rows = await lire(`app_data?id=eq.${CLE_DEMANDES}&select=data`);
    if (rows === null) return null;
    const present = !!rows[0];
    const d = present ? (rows[0].data || {}) : null;
    const nouveau = modifier(d);
    if (nouveau === undefined) return false;
    const rev0 = (d && Number.isSafeInteger(d.rev) && d.rev >= 0) ? d.rev : null;
    const data = { ...nouveau, rev: (rev0 || 0) + 1 };
    try {
      if (!present) {
        const w = await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=owner,id`, {
          method: 'POST', headers: { ...tete, Prefer: 'resolution=ignore-duplicates,return=representation' },
          body: JSON.stringify([{ owner, id: CLE_DEMANDES, data }]),
        });
        if (!w.ok) return null;
        const out = await w.json().catch(() => null);
        if (!Array.isArray(out)) return null;
        if (out.length >= 1) return true;
        continue;
      }
      const garde = rev0 == null ? 'data->>rev=is.null' : `data->>rev=eq.${rev0}`;
      const w = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${CLE_DEMANDES}&owner=eq.${encodeURIComponent(owner)}&${garde}&select=id`, {
        method: 'PATCH', headers: { ...tete, Prefer: 'return=representation' }, body: JSON.stringify({ data, updated_at: new Date().toISOString() }),
      });
      if (!w.ok) return null;
      const out = await w.json().catch(() => null);
      if (!Array.isArray(out)) return null;
      if (out.length >= 1) return true;
      await new Promise((ok) => setTimeout(ok, 25 * (n + 1)));
    } catch (_) { return null; }
  }
  return null;
}

export async function notifierPrixAchat(body) {
  if (!proprietaireCourant()) return { status: 401, envoye: false, n: 0, raison: 'vendeur inconnu' };
  const demandees = ventesDuCorps(body);
  if (!demandees.length) return { status: 200, envoye: false, n: 0, raison: 'aucune vente' };
  if (estNuitParis(instant())) return { status: 200, envoye: false, n: 0, raison: 'nuit' };
  if (!(await pushCategorieActive('vente'))) return { status: 200, envoye: false, n: 0, raison: 'désactivé par le vendeur' };
  const ok = await prouvees(demandees);
  if (ok === null) return { status: 503, envoye: false, n: 0, raison: 'transactions illisibles — rien envoyé' };
  const vraies = demandees.filter((v) => ok.has(v.tx));
  if (!vraies.length) return { status: 200, envoye: false, n: 0, raison: 'aucune vente prouvée' };
  let reservees = [];
  const r = await modifierLigne((d) => {
    reservees = aDemander(d || {}, vraies).slice(0, MAX_GROUPE);
    if (!reservees.length) return undefined;
    return reserver(d || {}, reservees.map((v) => v.tx), instant());
  });
  if (r === null) return { status: 503, envoye: false, n: 0, raison: 'mémoire illisible ou pas écrite — rien envoyé' };
  if (r !== true || !reservees.length) return { status: 200, envoye: false, n: 0, raison: 'déjà demandé' };
  const t = texteDemande(reservees);
  const envoi = await sendPushToAll({ cat: 'vente', ...t, tag: 'prix-achat-' + reservees.map((v) => v.tx).join('-').slice(0, 60), url: lienDemande(reservees.map((v) => v.tx)) });
  return { status: 200, envoye: !!(envoi && envoi.sent), n: reservees.length, raison: (envoi && (envoi.coupe || envoi.erreur || (envoi.calme ? 'heures calmes' : ''))) || '' };
}

// ── LE FILET DU CRON (matin et soir, api/ship-reminders.js) : aucune app ouverte ──
// Les MÊMES règles (`ventesSansPrix`, puis `notifierPrixAchat` : transaction relue, une
// fois, jamais la nuit). Lectures projetées (§4.4), paginées (§4.5). Une lecture ratée
// ⇒ rien n'est demandé (« pas su » ≠ « rien »).
async function lireTout(chemin) {
  const owner = proprietaireCourant();
  if (!owner || !cle()) return null;
  const out = [];
  for (let de = 0; de < 50000; de += 1000) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${chemin}&owner=eq.${encodeURIComponent(owner)}`, { headers: { ...sbCle(cle()), Range: `${de}-${de + 999}`, 'Range-Unit': 'items' } });
      if (!r.ok) return null;
      const j = await r.json();
      if (!Array.isArray(j)) return null;
      out.push(...j);
      if (j.length < 1000) break;
    } catch (_) { return null; }
  }
  return out;
}
export async function demandesDuCron({ maintenant = instant() } = {}) {
  if (!proprietaireCourant()) return { status: 401, envoye: false, n: 0, raison: 'vendeur inconnu' };
  if (estNuitParis(maintenant)) return { status: 200, envoye: false, n: 0, raison: 'nuit' };
  const [main, txn, ventesL] = await Promise.all([
    lire('app_data?id=eq.main&select=f:data->vinted_annonce_numeros,b:data->vinted_buyprice_by_num'),
    lireTout('app_data?id=like.harvest_%25_txn_%25&select=id,it:meta->>item_id,ti:meta->>status_title'),
    lireTout('app_data?id=like.harvest_%25_orders_sold&select=id,orders:data->payload->my_orders'),
  ]);
  if (main === null || txn === null || ventesL === null) return { status: 503, envoye: false, n: 0, raison: 'lecture ratée — rien demandé' };
  const fiches = (main[0] && main[0].f && typeof main[0].f === 'object') ? main[0].f : {};
  const buy = (main[0] && main[0].b && typeof main[0].b === 'object') ? main[0].b : {};
  const paires = [];
  for (const r of txn) {
    const m = /^harvest_(\d+)_txn_(\d+)$/.exec(String((r && r.id) || '')); const etat = String((r && r.ti) || '').trim();
    if (m && r.it && etat && classifyOrderStatus(etat) !== 'cancelled') paires.push({ tx: m[2], uid: m[1], item: String(r.it) });
  }
  const ventes = [];
  for (const l of ventesL) for (const o of (Array.isArray(l && l.orders) ? l.orders : [])) ventes.push(o);
  const prixDe = (f) => prixAchatDe(f, buy);   // la règle de l'app, copie FABRIQUÉE (scripts/audit-prix-achat-regle.cjs)
  const montant = (o) => { const p = o && o.price; const v = p && typeof p === 'object' ? (p.amount ?? p.value) : p; const x = Number(String(v == null ? '' : v).replace(',', '.')); return v != null && String(v).trim() !== '' && Number.isFinite(x) ? x : null; };
  const liste = ventesSansPrix({ paires, ventes, fiches, prixDe, annulee: (o) => classifyOrderStatus(o && o.status) === 'cancelled', montant, maintenant });
  if (!liste.length) return { status: 200, envoye: false, n: 0, raison: 'aucune vente à demander' };
  return notifierPrixAchat(corpsDemande(liste));
}
