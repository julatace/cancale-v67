// ══════════════════════════════════════════════════════════════════════════════
//  LA VEILLE — CE QUE L'APP LIT ET ÉCRIT (11 nov. 2026, lot agent2-veille)
//  Branché une fois par la coque (`brancherVeille`, le motif de la photo du carton) :
//  l'adresse de la base, l'en-tête de session, le propriétaire. Trois lignes à SON nom :
//    · `vrm_veille_chiffres` (src/veilleChiffres.js) : LUE et ÉCRITE ici, en
//      lire-fusionner-réécrire, comparer-et-échanger sur `data.rev` ; une lecture
//      ratée n'écrit RIEN ;
//    · `vrm_controle_nuit` et `vrm_controle_installation` (src/controleNuit.js) :
//      LUES seulement — le contrôle de nuit (api/ship-reminders.js) les écrit.
//  Petites lignes (nombres et identifiants) : lues entières, projetées sur `data`.
// ══════════════════════════════════════════════════════════════════════════════
import { CLE_VEILLE, pointDuJour, ajouterPoint, marquerVue, alertesDe } from './veilleChiffres.js';
import { CLE_CONTROLE, CLE_CONTROLE_INSTALLATION } from './controleNuit.js';

const B = { url: '', auth: () => ({}), withOwner: (r) => r, owner: () => '', session: () => ({}), fetcher: null };
export function brancherVeille(o = {}) { Object.assign(B, o); }
const f = (...a) => (B.fetcher || fetch)(...a);
const filtre = () => (B.owner() ? `&owner=eq.${encodeURIComponent(B.owner())}` : '');

// `undefined` = pas su · `null` = absente · l'objet `data`.
export async function lireLigneVeille(id) {
  if (!B.url) return undefined;
  try {
    const r = await f(`${B.url}/rest/v1/app_data?id=eq.${encodeURIComponent(id)}${filtre()}&select=data`, { headers: B.auth(), cache: 'no-store' });
    if (!r.ok) return undefined;
    const j = await r.json();
    if (!Array.isArray(j) || j.length > 1) return undefined;
    if (!j[0]) return null;
    const d = j[0].data;
    return d && typeof d === 'object' && !Array.isArray(d) ? d : {};
  } catch (_) { return undefined; }
}

// Comparer-et-échanger sur `data.rev`. `transformer(d | null)` rend la nouvelle donnée ou `null` (rien).
// Rend { etat: 'ok' | 'rien' | 'ko', avant, data }.
export async function modifierVeille(transformer, essais = 4) {
  for (let i = 0; i < essais; i++) {
    const d = await lireLigneVeille(CLE_VEILLE);
    if (d === undefined) return { etat: 'ko' };                       // pas su : rien n'est écrit
    const apres = transformer(d);
    if (!apres) return { etat: 'rien', avant: d, data: d };
    const rev0 = d && Number.isSafeInteger(d.rev) && d.rev >= 0 ? d.rev : null;
    const data = { ...apres, rev: (rev0 || 0) + 1 };
    try {
      let r;
      if (d === null) {
        r = await f(`${B.url}/rest/v1/app_data`, { method: 'POST', headers: { ...B.auth(), 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify([B.withOwner({ id: CLE_VEILLE, data })]) });
        if (r.ok) return { etat: 'ok', avant: d, data };
        if (r.status !== 409) return { etat: 'ko' };
        continue;
      }
      const garde = rev0 == null ? 'data->>rev=is.null' : `data->>rev=eq.${rev0}`;
      r = await f(`${B.url}/rest/v1/app_data?id=eq.${CLE_VEILLE}${filtre()}&${garde}&select=id`, { method: 'PATCH', headers: { ...B.auth(), 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ data, updated_at: new Date().toISOString() }) });
      if (!r.ok) return { etat: 'ko' };
      const j = await r.json().catch(() => null);
      if (Array.isArray(j) && j.length === 1) return { etat: 'ok', avant: d, data };
      if (!Array.isArray(j)) return { etat: 'ko' };
    } catch (_) { return { etat: 'ko' }; }
  }
  return { etat: 'ko' };
}

// Les suppressions CONSTATÉES (dates), tous comptes : `harvest_{uid}_supprimees`,
// projetées sur `ids` (petites, 500 au plus par compte). `null` = pas su.
export async function lireDatesSuppressions() {
  if (!B.url) return null;
  try {
    const r = await f(`${B.url}/rest/v1/app_data?id=like.harvest_%25_supprimees${filtre()}&select=id,ids:data->ids&order=id.asc`, { headers: B.auth(), cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    if (!Array.isArray(j)) return null;
    const out = [];
    for (const x of j) if (x && x.ids && typeof x.ids === 'object') for (const t of Object.values(x.ids)) out.push(t);
    return out;
  } catch (_) { return null; }
}

// ── LE RELEVÉ (appelé par la coque, sur un calcul COMPLET du stock) ──────────────
// Au plus un relevé par 30 min et par appareil (rien de neuf ⇒ rien n'est écrit).
// Une alerte NEUVE ⇒ le serveur est prévenu (`/api/push`, action `veille`) : il
// RELIT la ligne lui-même et sonne une fois (api/_lib/veille-chiffres.js).
const PAS_MS = 30 * 60e3;
let dernier = { at: 0, cle: '' };
let enCours = false;
export async function noterReleveVeille(entree = {}, { maintenant = Date.now(), forcer = false } = {}) {
  if (enCours || !B.url) return { etat: 'occupe' };
  const cle = JSON.stringify([entree.stock, (entree.comptes || []).length, entree.urssaf && entree.urssaf.at, (entree.ventes || []).length]);
  if (!forcer && cle === dernier.cle && maintenant - dernier.at < PAS_MS) return { etat: 'rien' };
  enCours = true;
  try {
    const suppressions = entree.stock == null ? null : await lireDatesSuppressions();
    const r = await modifierVeille((d) => {
      const points = d && Array.isArray(d.points) ? d.points : [];
      const jour = pointDuJour({ maintenant, ...entree, suppressions }).j;
      const avant = [...points].reverse().find((x) => x && x.j < jour) || null;
      const p = pointDuJour({ maintenant, ...entree, suppressions }, avant);
      return ajouterPoint(d, p);
    });
    if (r.etat === 'ok' || r.etat === 'rien') dernier = { at: maintenant, cle };
    if (r.etat === 'ok') {
      const avantK = new Set(((r.avant && r.avant.alertes) || []).map((a) => a.k));
      const neuves = (r.data.alertes || []).filter((a) => !avantK.has(a.k));
      if (neuves.length) {
        try { await f('/api/push', { method: 'POST', headers: { ...B.session(), 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'veille' }) }); } catch (_) {}
        try { window.dispatchEvent(new CustomEvent('vrm:veille')); } catch (_) {}
      }
      return { etat: 'ok', neuves: neuves.length };
    }
    return { etat: r.etat };
  } finally { enCours = false; }
}

export async function marquerAlerteVue(k, maintenant = Date.now()) {
  const r = await modifierVeille((d) => (d ? marquerVue(d, k, maintenant) : null));
  return r.etat === 'ok' || r.etat === 'rien';
}

export const lireControleNuit = () => lireLigneVeille(CLE_CONTROLE);
export const lireControleInstallation = () => lireLigneVeille(CLE_CONTROLE_INSTALLATION);
export { alertesDe };
