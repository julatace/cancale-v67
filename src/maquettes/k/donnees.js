// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE K — « C, en parfait » (17 nov., proposition pour Julien, PAS livrée).
//  Lit les MÊMES lignes que l'app (Supabase `app_data`, projections scalaires, pagination
//  par `Range`, §4.4-4.5) et en fait cinq listes : Aujourd'hui, Ventes, Annonces, Achats, Argent.
//  Identités (§5) : une annonce rejoint son N° par SON id (`vinted_annonce_numeros`) ; une vente
//  par son `item_id` ; un bordereau par le n° de transaction ; un versement par l'état 450 de
//  SA transaction. Jamais par titre. Trois états : `undefined` en cours · `null` pas su · valeur.
//  Monté seulement derrière un réglage de BANC (`vrm_banc_maquette` = 'k', src/main.jsx).
// ════════════════════════════════════════════════════════════════════════════
import { centimes } from '../../rechercheUnique.js';

const SUPABASE_URL = (import.meta.env && import.meta.env.VITE_SUPABASE_URL) || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const SUPABASE_KEY = (import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || '';
const str = (v) => String(v == null ? '' : v);
export const J = 86400000;

function session() { try { return JSON.parse(localStorage.getItem('vrm_session') || 'null'); } catch (_) { return null; } }

// Supabase plafonne une réponse à 1 000 lignes sans le dire : on pagine. Une lecture ratée rend `null`.
async function lireTout(chemin) {
  const s = session(); if (!s || !s.access_token) return null;
  const out = [];
  for (let de = 0; de < 20000; de += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${chemin}`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${s.access_token}`, Range: `${de}-${de + 999}`, 'Range-Unit': 'items' } }).catch(() => null);
    if (!r || !r.ok) return null;
    const l = await r.json().catch(() => null);
    if (!Array.isArray(l)) return null;
    out.push(...l);
    if (l.length < 1000) break;
  }
  return out;
}

export async function lireDonnees() {
  const q = lireTout;
  const [comptes, main, listings, vendues, achetees, bords, suivis, txns] = await Promise.all([
    q('vinted_accounts?select=vinted_user_id,login'),
    q('app_data?select=id,nums:data->vinted_annonce_numeros,couts:data->vinted_buyprice_by_num&id=eq.main'),
    q('app_data?select=id,items:data->payload->items,lu:data->>capturedAt&id=like.harvest_*_listings'),
    q('app_data?select=id,o:data->payload->my_orders&id=like.harvest_*_orders_sold'),
    q('app_data?select=id,o:data->payload->my_orders&id=like.harvest_*_orders_purchased'),
    q('app_data?select=id,tx:data->>transaction,suivi:data->>suivi,limite:data->>dateLimite,recu:data->>receivedAt&id=like.email_bord_*'),
    q('app_data?select=id,carrier:data->>carrier,suivi:data->>suivi,status:data->>status,code:data->>code,qr:data->>qrUrl,lieu:data->>lieu,limite:data->>limite,art:data->>artTitle,recu:data->>receivedAt&id=like.email_track_*'),
    q('app_data?select=id,st:data->payload->transaction->>status,at:data->payload->transaction->>status_updated_at&id=like.harvest_*_txn_*'),
  ]);
  return construire({ comptes, main: main && main[0], listings, vendues, achetees, bords, suivis, txns });
}

const uidDe = (id) => { const m = /^harvest_(\d+)_/.exec(str(id)); return m ? m[1] : ''; };
const photoDe = (p) => (!p ? '' : typeof p === 'string' ? p : str(p.url || ''));
// Une commande qui revient (annulée, remboursée, retour) n'est PAS une vente (PAS_UNE_VENTE, §5).
const PAS_UNE_VENTE = /annul|rembours|retour|suspend|échou|echou/i;

export function construire(src, maintenant = Date.now()) {
  const comptes = Array.isArray(src.comptes) ? src.comptes.map((a) => ({ uid: str(a.vinted_user_id), login: str(a.login) })) : null;
  const loginDe = (uid) => { const a = (comptes || []).find((x) => x.uid === str(uid)); return a ? a.login : ''; };
  const nums = (src.main && src.main.nums) || null;
  const couts = (src.main && src.main.couts) || {};
  const numDe = new Map();
  for (const [id, f] of Object.entries(nums || {})) { const n = str(f && (f.numero || f.num)).trim(); if (n) numDe.set(str(id), { n, f }); }
  const coutDe = (n, f) => { const c = f && centimes(f.buyPrice); if (c != null) return c; return n && couts[n] != null ? centimes(couts[n]) : null; };

  // ── Annonces : les ouvertes, non masquées (la lecture complète fait foi). ──
  const annonces = src.listings ? [] : null; const items = new Map();
  for (const r of src.listings || []) {
    const uid = uidDe(r.id);
    for (const it of Array.isArray(r.items) ? r.items : []) {
      const id = str(it.id); const nf = numDe.get(id);
      const a = { id, uid, compte: loginDe(uid), titre: str(it.title), taille: str(it.size_title), prix: centimes(it.price), photo: photoDe(it.photo),
        fav: Number(it.favourite_count) || 0, vues: Number(it.view_count) || 0, cree: Date.parse(it.created_at_ts || '') || null,
        numero: nf ? nf.n : '', cout: nf ? coutDe(nf.n, nf.f) : null, ouverte: !it.is_closed && !it.is_draft, masquee: !!it.is_hidden };
      items.set(id, a);
      if (a.ouverte && !a.masquee) annonces.push(a);
    }
  }
  // Deux annonces présentes sous un même N° : le seul rouge (§5).
  const parNum = new Map(); for (const a of annonces || []) if (a.numero) parNum.set(a.numero, (parNum.get(a.numero) || 0) + 1);
  for (const a of annonces || []) a.double = !!a.numero && parNum.get(a.numero) > 1;
  if (annonces) annonces.sort((a, b) => (b.cree || 0) - (a.cree || 0));

  // ── Ventes ──
  const txSt = new Map(); for (const t of src.txns || []) { const m = /_txn_(\d+)$/.exec(str(t.id)); if (m) txSt.set(m[1], { st: Number(t.st), at: Date.parse(t.at || '') || null }); }
  const bordDe = new Map(); for (const b of src.bords || []) if (b.tx) bordDe.set(str(b.tx), { suivi: str(b.suivi), limite: Date.parse(b.limite || '') || null });
  const ventes = src.vendues ? [] : null;
  for (const r of src.vendues || []) for (const o of Array.isArray(r.o) ? r.o : []) {
    if (PAS_UNE_VENTE.test(str(o.status))) continue;
    const tx = str(o.transaction_id); const item = str(o.item_id || ''); const nf = numDe.get(item);
    const bord = bordDe.get(tx) || null; const t = txSt.get(tx) || null;
    const st = str(o.transaction_user_status);
    const v = { tx, item, uid: uidDe(r.id), titre: str(o.title), prix: centimes(o.price), date: Date.parse(o.date || '') || null, photo: photoDe(o.photo),
      numero: nf ? nf.n : '', cout: nf ? coutDe(nf.n, nf.f) : null, bord,
      etat: st === 'needs_action' ? 'envoyer' : (t && t.st === 450) || /finalis/i.test(str(o.status)) ? 'finie' : 'route',
      verseLe: t && t.st === 450 ? t.at : null };
    v.compte = loginDe(v.uid);
    // La date limite LUE (e-mail du bordereau) ; sinon vente + 7 j, une estimation.
    v.limite = bord && bord.limite ? bord.limite : null;
    v.estimee = !v.limite && v.date ? v.date + 7 * J : null;
    ventes.push(v);
  }
  if (ventes) ventes.sort((a, b) => (b.date || 0) - (a.date || 0));
  const aEnvoyer = ventes ? ventes.filter((v) => v.etat === 'envoyer').sort((a, b) => (a.limite || a.estimee || 9e15) - (b.limite || b.estimee || 9e15)) : null;
  const enRoute = ventes ? ventes.filter((v) => v.etat === 'route') : null;

  // ── Achats ──
  const achats = src.achetees ? [] : null;
  for (const r of src.achetees || []) for (const o of Array.isArray(r.o) ? r.o : []) {
    if (PAS_UNE_VENTE.test(str(o.status))) continue;
    achats.push({ tx: str(o.transaction_id), uid: uidDe(r.id), compte: loginDe(uidDe(r.id)), titre: str(o.title), prix: centimes(o.price), date: Date.parse(o.date || '') || null, photo: photoDe(o.photo),
      fini: /finalis/i.test(str(o.status)) || str(o.transaction_user_status) === 'completed' });
  }
  if (achats) achats.sort((a, b) => (b.date || 0) - (a.date || 0));
  const achatsRoute = achats ? achats.filter((a) => !a.fini) : null;
  // À retirer : un colis ARRIVÉ (statut lu) ; un point = une carte (par lieu lu dans l'e-mail).
  const colis = src.suivis ? src.suivis.filter((c) => c.status === 'available').map((c) => ({ suivi: str(c.suivi), code: str(c.code), qr: str(c.qr), carrier: str(c.carrier), titre: str(c.art), limite: Date.parse(c.limite || '') || null, lieu: str(c.lieu) })) : null;
  const points = colis ? [] : null;
  for (const c of colis || []) {
    const [nom, ...adr] = c.lieu.split('\n'); const cle = c.lieu || ('?' + c.suivi);
    let p = points.find((x) => x.cle === cle);
    if (!p) { p = { cle, nom: nom || '', adresse: adr.join(', '), colis: [] }; points.push(p); }
    p.colis.push(c);
  }
  for (const p of points || []) { p.colis.sort((a, b) => (a.limite || 9e15) - (b.limite || 9e15)); p.limite = p.colis[0].limite; }
  if (points) points.sort((a, b) => (a.limite || 9e15) - (b.limite || 9e15));

  // ── Argent : VENDU par date de vente, REÇU par date de versement (450), bénéfice sur ce qui est connu. ──
  const d = new Date(maintenant); const debutMois = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const debutPrec = new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime();
  const argent = ventes ? (() => {
    const duMois = ventes.filter((v) => v.date && v.date >= debutMois);
    const vendu = duMois.reduce((s, v) => s + (v.prix || 0), 0);
    const recu = src.txns ? ventes.filter((v) => v.verseLe && v.verseLe >= debutMois).reduce((s, v) => s + (v.prix || 0), 0) : null;
    const connus = duMois.filter((v) => v.prix != null && v.cout != null);
    const benefice = connus.length ? connus.reduce((s, v) => s + v.prix - v.cout, 0) : null;
    // La courbe : le vendu cumulé jour par jour, ce mois et le mois d'avant (même source que « Vendu »).
    const jours = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const joursPrec = new Date(d.getFullYear(), d.getMonth(), 0).getDate();
    const cumul = (deb, n, fin) => { const t = Array(n).fill(0); for (const v of ventes) if (v.date >= deb && v.date < fin) t[new Date(v.date).getDate() - 1] += v.prix || 0; let s = 0; return t.map((x) => (s += x)); };
    const ceMois = cumul(debutMois, jours, maintenant + 1).slice(0, d.getDate());
    const moisPrec = cumul(debutPrec, joursPrec, debutMois);
    return { vendu, recu, benefice, couverts: connus.length, nVentes: duMois.length, ceMois, moisPrec, jours, aujourdhui: d.getDate() };
  })() : null;

  const venduAujourdhui = ventes ? ventes.filter((v) => v.date && v.date >= new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) : null;
  return { comptes, annonces, ventes, aEnvoyer, enRoute, achats, achatsRoute, points, colis, argent, venduAujourdhui, maintenant };
}

// ── Formats ──
export const euros = (c) => {
  if (c == null) return '—';
  const s = (Math.abs(c) / 100).toLocaleString('fr-FR', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
  return (c < 0 ? '−' : '') + s + ' €';
};
export const eurosNu = (c) => (c == null ? '—' : (Math.abs(c) / 100).toLocaleString('fr-FR', { maximumFractionDigits: 0 }));
const TZ = { timeZone: 'Europe/Paris' };
export function quand(t, maintenant = Date.now()) {
  if (!t) return '';
  const a = new Date(t), n = new Date(maintenant);
  const j0 = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  const dj = Math.floor((new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime() - j0) / J);
  const h = a.toLocaleTimeString('fr-FR', { hour: 'numeric', ...TZ }).replace(/\s?h$/, ' h');
  if (dj === 0) return 'aujourd’hui ' + h;
  if (dj === 1) return 'demain ' + h;
  if (dj === -1) return 'hier';
  if (dj > 1 && dj < 7) return a.toLocaleDateString('fr-FR', { weekday: 'short', ...TZ }).replace('.', '') + ' ' + h;
  return a.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...TZ }).replace('.', '');
}
export const jourCourt = (t) => (t ? new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...TZ }).replace('.', '') : '');
export const depuis = (t, maintenant = Date.now()) => (t ? Math.max(0, Math.floor((maintenant - t) / J)) : null);
// Un titre propre pour une ligne : sans « taille NN » (la taille a sa place), sans espaces doubles.
export const titreCourt = (t) => str(t).replace(/\s+taille\s+\d+([.,]5)?$/i, '').replace(/\s+T\d{2}$/, '').replace(/\s+/g, ' ').trim();
