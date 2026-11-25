// ═══════════════════════════════════════════════════════════════════════════
// LE PARRAINAGE À 20 % — LECTURES, ÉCRITURES, RÈGLEMENTS (25 nov. 2026)
// ═══════════════════════════════════════════════════════════════════════════
// La règle (pure) : api/_lib/parrainage-regle.js. Les tables :
// supabase/migrations/049-parrainage-20.sql (clé de service seule, RLS fermée).
// Portes, toutes dans api/compte.js (aucune fonction `api/` de plus) :
//   · webhook `invoice.paid` d'un filleul ⇒ un gain de 20 % (`gainFacturePayee`) ;
//   · webhook remboursement / litige / avoir ⇒ annulé ou réduit (`annulerGains`) ;
//   · webhook `invoice.created` (une heure avant la facture d'un abonné), la route
//     `mode=parrainage` (à l'ouverture de l'écran) ⇒ les gains DUS d'un parrain en
//     mode crédit partent sur son solde Stripe (`reglerGains`) ;
//   · `mode=parrainage` POST `choix` / `iban` ; `mode=partenaires` (Julien seul) :
//     « Parrains à verser » et « Versé ».
// Tables absentes (049 pas passée) ⇒ « pas installé » : le webhook acquitte sans
// rien écrire, l'écran le dit, le reste de VRM ne change pas.
// « Pas su » ne vaut jamais « oui » : une lecture ratée ⇒ { ok:false } (503, Stripe rejoue).
// ⚠️ L'IBAN : lu et écrit par la clé de service SEULE ; rendu au parrain MASQUÉ
//    (FR76 •••• 1234), en clair seulement à Julien (pour verser) — jamais ailleurs.
// ═══════════════════════════════════════════════════════════════════════════
import { sbCle } from './cle.js';
import { stripeApi, stripePret } from './stripe.js';
import { fetchAvecDelai } from './fetch-delai.js';
import { parrainageOuvert, crediter, clientDe, emailDe, nomDe } from './parrainage.js';
import { paiementsDeFacture, annulationDeLEvenement, remboursementDe } from './partenaires-regle.js';
import {
  decisionGain, chiffresParrain, gainsACrediter, gainsAAnnulerAntiAbus, modeActuel, aVerserAdmin,
  ibanPropre, ibanMasque, titulairePropre, MODES_REGLEMENT, COUPON_FILLEUL, POURCENT_PARRAIN,
  REMISE_FILLEUL_POURCENT, JOURS_OFFERTS, SEUIL_VIREMENT_CENTIMES, DELAI_DUE_JOURS,
} from './parrainage-regle.js';

const SUPABASE_URL = () => process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const service = () => process.env.SUPABASE_SERVICE_KEY || '';
const h = () => ({ ...sbCle(service()), 'Content-Type': 'application/json' });
const enc = encodeURIComponent;
const ABSENT = /PGRST205|PGRST204|42P01|42703|does not exist|schema cache/i;

async function lireT(chemin) {
  if (!service()) return { ok: false, absent: false };
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL()}/rest/v1/${chemin}`, { headers: sbCle(service()) });
    if (!r.ok) { const t = await r.text().catch(() => ''); return { ok: false, absent: r.status === 404 || (r.status === 400 && ABSENT.test(t)) }; }
    const j = await r.json().catch(() => null);
    return Array.isArray(j) ? { ok: true, lignes: j } : { ok: false, absent: false };
  } catch (_) { return { ok: false, absent: false }; }
}
async function lireTout(chemin, ordre) {
  const tout = [];
  for (let page = 0; page < 200; page++) {
    const r = await lireT(`${chemin}&order=${ordre}&limit=1000&offset=${page * 1000}`);
    if (!r.ok) return r;
    tout.push(...r.lignes);
    if (r.lignes.length < 1000) return { ok: true, lignes: tout };
  }
  return { ok: false, absent: false };
}
async function ecrire(methode, chemin, corps, prefer) {
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL()}/rest/v1/${chemin}`, { method: methode, headers: { ...h(), Prefer: prefer || 'return=minimal' }, body: JSON.stringify(corps) });
    const t = await r.text().catch(() => '');
    let j = null; try { j = t ? JSON.parse(t) : null; } catch (_) {}
    return { ok: r.ok, status: r.status, texte: t, json: j, absent: r.status === 404 || ABSENT.test(t) };
  } catch (_) { return { ok: false, status: 0, texte: '', json: null, absent: false }; }
}
const CHAMPS_GAIN = 'facture,parrain,filleul,montant_centimes,facture_centimes,paye_le,mois,due_le,charge,payment_intent,annulee_le,annulee_raison,rembourse_centimes,credite_le';

// La ligne de parrainage d'un filleul (avec `refus` si la 037 est passée).
async function ligneFilleul(owner) {
  const a = await lireT(`parrainages?filleul=eq.${enc(owner)}&select=filleul,parrain,inscrit,refus&limit=1`);
  if (a.ok) return a;
  const b = await lireT(`parrainages?filleul=eq.${enc(owner)}&select=filleul,parrain,inscrit&limit=1`);
  return b;
}
// Les filleuls d'un parrain prouvés « pas soi-même » (semaine créditée, aucun refus) et les refusés.
async function verificationsDe(parrain) {
  let r = await lireT(`parrainages?parrain=eq.${enc(parrain)}&select=filleul,credit_filleul_le,refus&limit=1000`);
  if (!r.ok) r = await lireT(`parrainages?parrain=eq.${enc(parrain)}&select=filleul,credit_filleul_le&limit=1000`);
  if (!r.ok) return null;
  const verifies = new Set(), refuses = new Set();
  for (const x of r.lignes) {
    if (x.refus) refuses.add(String(x.filleul));
    else if (x.credit_filleul_le) verifies.add(String(x.filleul));
  }
  return { verifies, refuses };
}
const lireSignaux = (cles) => lireT(`parrainage_annulations?cle=in.(${cles.filter(Boolean).map((c) => '%22' + enc(c) + '%22').join(',')})&select=cle,signal,raison,centimes,le`);

// ── LE WEBHOOK : UNE FACTURE PAYÉE D'UN FILLEUL ⇒ 20 % AU PARRAIN ───────────
export async function gainFacturePayee(owner, facture, maintenant = Date.now()) {
  if (!service() || !UUID.test(String(owner || ''))) return { ok: true, rien: 'sans-config' };
  const ouvert = await parrainageOuvert();
  if (ouvert === null) return { ok: false };
  if (!ouvert) return { ok: true, rien: 'ferme' };
  const l = await ligneFilleul(owner);
  if (!l.ok) return l.absent ? { ok: true, rien: 'non-installe' } : { ok: false };
  const parrainage = l.lignes[0] || null;
  if (!parrainage) return { ok: true, rien: 'pas-parraine' };
  const ex = await lireT(`parrainage_gains?filleul=eq.${enc(owner)}&select=facture`);
  if (!ex.ok) return ex.absent ? { ok: true, rien: 'non-installe' } : { ok: false };
  let fac = facture;
  const p0 = paiementsDeFacture(facture);
  if (!p0.charge && !p0.payment_intent && stripePret() && facture && /^in_/.test(String(facture.id || ''))) {
    const r = await stripeApi('GET', 'invoice_payments', { invoice: facture.id, limit: 10 });
    if (r.ok && r.data && Array.isArray(r.data.data)) fac = { ...facture, payments: { data: r.data.data } };
  }
  const p = paiementsDeFacture(fac);
  const sg = await lireSignaux([facture && facture.id, p.charge, p.payment_intent]);
  if (!sg.ok && !sg.absent) return { ok: false };
  const d = decisionGain({ facture: fac, parrainage, existantes: ex.lignes, signaux: sg.ok ? sg.lignes : [] });
  if (!d.creer) return { ok: true, rien: d.rien };
  const w = await ecrire('POST', 'parrainage_gains?on_conflict=facture', [d.creer], 'resolution=ignore-duplicates,return=minimal');
  if (w.ok) return { ok: true, cree: d.creer };
  if (w.absent) return { ok: true, rien: 'non-installe' };
  return { ok: false };
}

// ── LE WEBHOOK : REMBOURSEMENT, LITIGE, AVOIR ⇒ ANNULÉ OU RÉDUIT ────────────
// La même règle que les partenaires (`remboursementDe`), sur les signaux de SA table.
export async function annulerGains(type, obj, maintenant = Date.now()) {
  const a = annulationDeLEvenement(type, obj);
  if (!a || !service()) return { ok: true, rien: 'sans-objet' };
  const le = new Date(maintenant).toISOString();
  const cles = Object.values(a.cles).filter(Boolean);
  const m = await ecrire('POST', 'parrainage_annulations?on_conflict=cle,signal', cles.map((cle) => ({ cle, signal: a.signal, raison: a.raison, centimes: a.centimes, le })), 'resolution=ignore-duplicates,return=minimal');
  if (!m.ok) return m.absent ? { ok: true, rien: 'non-installe' } : { ok: false };
  const touches = new Map();
  for (const [col, val] of Object.entries(a.cles)) {
    if (!val) continue;
    const r = await lireT(`parrainage_gains?${col}=eq.${enc(val)}&annulee_le=is.null&select=facture,facture_centimes,rembourse_centimes,charge,payment_intent`);
    if (!r.ok) return { ok: false };
    for (const g of r.lignes) if (g && g.facture) touches.set(g.facture, g);
  }
  let annules = 0, reduits = 0;
  for (const g of touches.values()) {
    const sg = await lireSignaux([g.facture, g.charge, g.payment_intent]);
    if (!sg.ok) return { ok: false };
    const rb = remboursementDe(sg.lignes, g.facture_centimes);
    if (rb.total) {
      const w = await ecrire('PATCH', `parrainage_gains?facture=eq.${enc(g.facture)}&annulee_le=is.null`, { annulee_le: le, annulee_raison: rb.raison }, 'return=representation');
      if (!w.ok) return { ok: false };
      annules += Array.isArray(w.json) ? w.json.length : 0;
    } else if (rb.centimes > (Number(g.rembourse_centimes) || 0)) {
      const w = await ecrire('PATCH', `parrainage_gains?facture=eq.${enc(g.facture)}&annulee_le=is.null&rembourse_centimes=lt.${rb.centimes}`, { rembourse_centimes: rb.centimes }, 'return=representation');
      if (!w.ok) return { ok: false };
      reduits += Array.isArray(w.json) ? w.json.length : 0;
    }
  }
  return { ok: true, annules, reduits };
}

// ── LE RÈGLEMENT : LES GAINS DUS D'UN PARRAIN EN MODE CRÉDIT ⇒ SOLDE STRIPE ──
// Chaque gain : un crédit marqué `vrm_parrainage = gain:<facture>` (relu avant d'en créer un,
// plus une clé d'idempotence), puis `credite_le` noté. Jamais deux fois le même gain.
export async function reglerGains(parrain, maintenant = Date.now()) {
  if (!service() || !UUID.test(String(parrain || ''))) return { ok: true, rien: 'sans-config' };
  const [g, c, v] = await Promise.all([
    lireT(`parrainage_gains?parrain=eq.${enc(parrain)}&annulee_le=is.null&credite_le=is.null&select=${CHAMPS_GAIN}&limit=1000`),
    lireT(`parrainage_choix?parrain=eq.${enc(parrain)}&select=mode,le&order=le.asc&limit=1000`),
    verificationsDe(parrain),
  ]);
  if (!g.ok) return g.absent ? { ok: true, rien: 'non-installe' } : { ok: false };
  if (!c.ok || !v) return { ok: false };
  let annules = 0, credites = 0, ok = true;
  // La règle anti-abus a refusé ce filleul : ses gains sont annulés (gardés, dits).
  for (const x of gainsAAnnulerAntiAbus(g.lignes, v.refuses)) {
    const w = await ecrire('PATCH', `parrainage_gains?facture=eq.${enc(x.facture)}&annulee_le=is.null`, { annulee_le: new Date(maintenant).toISOString(), annulee_raison: 'anti-abus' }, 'return=representation');
    if (w.ok) annules++; else ok = false;
  }
  const vivants = g.lignes.filter((x) => !v.refuses.has(String(x.filleul)));
  const aCrediter = gainsACrediter({ gains: vivants, choix: c.lignes, verifies: v.verifies, maintenant });
  if (!aCrediter.length || !stripePret()) return { ok, annules, credites };
  const client = await clientDe(parrain);
  if (client === undefined) return { ok: false };
  if (!client) return { ok, annules, credites, attente: 'sans-client' };
  for (const x of aCrediter) {
    if (!(await crediter(client, `gain:${x.facture}`, x.net, `VRM — parrainage : ${POURCENT_PARRAIN} % d'un abonnement payé`))) { ok = false; continue; }
    const w = await ecrire('PATCH', `parrainage_gains?facture=eq.${enc(x.facture)}&credite_le=is.null`, { credite_le: new Date(maintenant).toISOString(), credit_centimes: x.net }, 'return=minimal');
    if (w.ok) credites++; else ok = false;   // crédit fait mais pas noté : le rejeu le retrouve par sa marque
  }
  return { ok, annules, credites };
}
// Le parrain d'un filleul (pour régler ce qui le concerne) · '' aucun · undefined pas su.
export async function parrainDe(filleul) {
  const r = await lireT(`parrainages?filleul=eq.${enc(filleul)}&select=parrain&limit=1`);
  if (!r.ok) return r.absent ? '' : undefined;
  return (r.lignes[0] && r.lignes[0].parrain) || '';
}

// ── CE QUE VOIT LE PARRAIN (des nombres, jamais qui) ────────────────────────
async function abonnementsVivants(owners) {
  const vivants = new Set();
  for (let i = 0; i < owners.length; i += 100) {
    const lot = owners.slice(i, i + 100);
    const r = await lireT(`abonnements?owner=in.(${lot.map(enc).join(',')})&select=owner,statut`);
    if (!r.ok) return null;
    for (const x of r.lignes) if (x && ['active', 'past_due'].includes(String(x.statut))) vivants.add(String(x.owner));
  }
  return vivants;
}
export const regleAffichee = () => ({ pourcent: POURCENT_PARRAIN, remise: REMISE_FILLEUL_POURCENT, joursOfferts: JOURS_OFFERTS, seuilCentimes: SEUIL_VIREMENT_CENTIMES, delaiJours: DELAI_DUE_JOURS });
// { installe:false } · { installe:true, mode, iban, titulaire?, chiffres } · undefined pas su.
export async function vueGains(owner, maintenant = Date.now()) {
  if (!service() || !UUID.test(String(owner || ''))) return undefined;
  const [g, c, ve, ib, v] = await Promise.all([
    lireT(`parrainage_gains?parrain=eq.${enc(owner)}&select=${CHAMPS_GAIN}&limit=2000`),
    lireT(`parrainage_choix?parrain=eq.${enc(owner)}&select=mode,le&order=le.asc&limit=1000`),
    lireT(`parrainage_versements?parrain=eq.${enc(owner)}&select=montant_centimes,verse_le&limit=1000`),
    lireT(`parrainage_iban?parrain=eq.${enc(owner)}&select=iban,titulaire&limit=1`),
    verificationsDe(owner),
  ]);
  if ([g, c, ve, ib].some((x) => !x.ok && x.absent)) return { installe: false };
  if (!g.ok || !c.ok || !ve.ok || !ib.ok || !v) return undefined;
  const owners = [...new Set(g.lignes.map((x) => x.filleul).filter((x) => UUID.test(String(x || ''))))];
  const actifs = owners.length ? await abonnementsVivants(owners) : new Set();
  const i = ib.lignes[0];
  return {
    installe: true, mode: modeActuel(c.lignes, maintenant), iban: i && i.iban ? ibanMasque(i.iban) : null,
    chiffres: chiffresParrain({ gains: g.lignes, choix: c.lignes, verifies: v.verifies, versements: ve.lignes, actifs, maintenant }),
  };
}

// ── LE CHOIX DU PARRAIN (crédit / virement) ET SON IBAN ─────────────────────
// Le choix est AJOUTÉ (jamais réécrit) : l'historique dit le mode de chaque gain à son échéance.
export async function poserChoix(owner, mode, maintenant = Date.now()) {
  if (!MODES_REGLEMENT.includes(mode)) return { ok: false, http: 400, raison: 'mode' };
  if (!service() || !UUID.test(String(owner || ''))) return { ok: false, http: 503, raison: 'pas-su' };
  const c = await lireT(`parrainage_choix?parrain=eq.${enc(owner)}&select=mode,le&order=le.asc&limit=1000`);
  if (!c.ok) return c.absent ? { ok: false, http: 409, raison: 'non-installe' } : { ok: false, http: 503, raison: 'pas-su' };
  if (modeActuel(c.lignes, maintenant) === mode && c.lignes.length) return { ok: true, http: 200, mode };
  const w = await ecrire('POST', 'parrainage_choix', [{ parrain: owner, mode, le: new Date(maintenant).toISOString() }]);
  return w.ok ? { ok: true, http: 200, mode } : { ok: false, http: w.absent ? 409 : 503, raison: w.absent ? 'non-installe' : 'ecriture' };
}
export async function poserIban(owner, brutIban, brutTitulaire, maintenant = Date.now()) {
  if (!service() || !UUID.test(String(owner || ''))) return { ok: false, http: 503, raison: 'pas-su' };
  const iban = ibanPropre(brutIban);
  if (!iban) return { ok: false, http: 400, raison: 'iban', message: 'IBAN incomplet ou faux.' };
  const titulaire = titulairePropre(brutTitulaire);
  if (!titulaire) return { ok: false, http: 400, raison: 'titulaire', message: 'Le nom du titulaire du compte.' };
  const at = new Date(maintenant).toISOString();
  const w = await ecrire('POST', 'parrainage_iban?on_conflict=parrain', [{ parrain: owner, iban, titulaire, le: at }], 'resolution=merge-duplicates,return=minimal');
  if (!w.ok) return { ok: false, http: w.absent ? 409 : 503, raison: w.absent ? 'non-installe' : 'ecriture', message: 'Pas enregistré. Réessaie dans un instant.' };
  return { ok: true, http: 200, iban: ibanMasque(iban) };
}

// ── L'ADMINISTRATION (Julien seul) : « Parrains à verser » et « Versé » ──────
export async function listeAVerser(maintenant = Date.now()) {
  const [g, c, ve, ib, pr] = await Promise.all([
    lireTout(`parrainage_gains?facture=not.is.null&select=${CHAMPS_GAIN}`, 'facture.asc'),
    lireTout('parrainage_choix?parrain=not.is.null&select=parrain,mode,le', 'le.asc'),
    lireTout('parrainage_versements?parrain=not.is.null&select=parrain,montant_centimes,verse_le', 'verse_le.asc'),
    lireTout('parrainage_iban?parrain=not.is.null&select=parrain,iban,titulaire', 'parrain.asc'),
    lireTout('parrainages?filleul=not.is.null&select=filleul,parrain,credit_filleul_le,refus', 'filleul.asc'),
  ]);
  if ([g, c, ve, ib].some((x) => !x.ok && x.absent)) return { http: 200, corps: { ok: true, installe: false } };
  if (!g.ok || !c.ok || !ve.ok || !ib.ok || !pr.ok) return { http: 503, corps: { ok: false, raison: 'pas-su' } };
  const par = new Map();
  const de = (p) => { const k = String(p); if (!par.has(k)) par.set(k, { parrain: k, gains: [], choix: [], versements: [], verifies: new Set() }); return par.get(k); };
  for (const x of g.lignes) de(x.parrain).gains.push(x);
  for (const x of c.lignes) de(x.parrain).choix.push(x);
  for (const x of ve.lignes) de(x.parrain).versements.push(x);
  for (const x of pr.lignes) if (x.credit_filleul_le && !x.refus) de(x.parrain).verifies.add(String(x.filleul));
  const a = aVerserAdmin([...par.values()], maintenant);
  const ibans = new Map(ib.lignes.map((x) => [String(x.parrain), x]));
  const lignes = [];
  for (const x of a.parrains) {
    const [email, nom] = await Promise.all([emailDe(x.parrain), nomDe(x.parrain)]);
    const i = ibans.get(String(x.parrain));
    lignes.push({ ...x, email: email || null, nom: nom || null, iban: i ? i.iban : null, titulaire: i ? i.titulaire : null });
  }
  return { http: 200, corps: { ok: true, installe: true, totalCentimes: a.totalCentimes, seuilCentimes: a.seuilCentimes, parrains: lignes } };
}
const jourValide = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) && Number.isFinite(Date.parse(d + 'T12:00:00Z')) ? String(d) : '');
export async function noterVerseParrain(corps, maintenant = Date.now()) {
  const parrain = String(corps && corps.parrain || ''), le = jourValide(corps && corps.le), cts = Number(corps && corps.centimes);
  if (!UUID.test(parrain)) return { http: 400, corps: { ok: false, raison: 'parrain' } };
  if (!le || Date.parse(le + 'T00:00:00Z') > maintenant + 86400000) return { http: 400, corps: { ok: false, raison: 'date' } };
  if (!Number.isInteger(cts) || cts <= 0 || cts > 10000000) return { http: 400, corps: { ok: false, raison: 'montant' } };
  const w = await ecrire('POST', 'parrainage_versements', [{ parrain, montant_centimes: cts, verse_le: le, cree: new Date(maintenant).toISOString() }]);
  return w.ok ? { http: 200, corps: { ok: true } } : { http: w.absent ? 409 : 503, corps: { ok: false, raison: w.absent ? 'non-installe' : 'ecriture' } };
}

// ── LE PAIEMENT : −10 % SUR LE 1er MOIS DU FILLEUL ──────────────────────────
// Rend l'id du coupon · '' rien (pas filleul, refusé, fermé, 049/027 pas passées) · undefined pas su.
// Jamais avec un code partenaire (l'appelant ne le demande que sans coupon partenaire, et un compte
// n'est rattaché qu'à l'un OU l'autre).
export async function remiseFilleul(owner) {
  if (!service() || !UUID.test(String(owner || '')) || !stripePret()) return '';
  const ouvert = await parrainageOuvert();
  if (ouvert === null) return undefined;
  if (!ouvert) return '';
  const l = await ligneFilleul(owner);
  if (!l.ok) return l.absent ? '' : undefined;
  const x = l.lignes[0];
  if (!x || x.refus) return '';
  const lu = await stripeApi('GET', `coupons/${enc(COUPON_FILLEUL.id)}`);
  if (lu.ok && lu.data && lu.data.id === COUPON_FILLEUL.id) {
    const d = lu.data;
    const conforme = Number(d.percent_off) === COUPON_FILLEUL.percent_off && d.duration === COUPON_FILLEUL.duration && Number(d.duration_in_months) === COUPON_FILLEUL.duration_in_months && d.valid !== false;
    if (!conforme) { console.warn('[stripe] coupon', COUPON_FILLEUL.id, 'non conforme (attendu −10 % sur 1 mois) : aucune remise posée'); return undefined; }
    return COUPON_FILLEUL.id;
  }
  if (lu.status !== 404) return undefined;
  const cree = await stripeApi('POST', 'coupons', { ...COUPON_FILLEUL }, `vrm-coupon-${COUPON_FILLEUL.id}`);
  return cree.ok && cree.data && cree.data.id === COUPON_FILLEUL.id ? COUPON_FILLEUL.id : undefined;
}

// ── L'EXPORT RGPD DU PARRAIN : ses gains (nombres) et son choix ─────────────
export async function donneesRgpd(owner) {
  const v = await vueGains(owner);
  if (v === undefined) return { lu: false };
  if (!v.installe) return { lu: true, installe: false };
  const c = v.chiffres;
  return { lu: true, installe: true, mode: v.mode, iban: v.iban, totalCentimes: c.totalCentimes, attenteCentimes: c.attenteCentimes, crediteCentimes: c.crediteCentimes, verseCentimes: c.verseCentimes, aVerserCentimes: c.aVerserCentimes, gains: c.historique };
}
