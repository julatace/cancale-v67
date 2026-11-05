// api/_lib/comptes-a-relire.js
// ────────────────────────────────────────────────────────────────────────────
// (5 nov.) « COMPTE VINTED PAS RELU » — UNE notification par jour au plus.
//
// Un compte Vinted gardé dans les totaux qui n'a pas été relu depuis plus de
// 24 h : ses ventes, ses colis et ses messages s'arrêtent à la dernière lecture,
// sans que rien ne le dise hors de l'app. Le passage du MATIN du cron
// (api/ship-reminders.js) nomme ces comptes et LE geste : ouvrir vinted.fr
// connecté sur ce compte, dans le navigateur où est l'extension VRM.
//
// Les règles sont celles de l'app, importées, jamais recopiées (§11) :
//   · « à relire » = `etatCompteLie` (src/comptesLies.js : plus de 24 h,
//     `A_RELIRE_MS`) — la même que Comptes liés et le panneau de l'indicateur ;
//   · la fraîcheur d'un compte = la plus récente de ses lignes `harvest_{uid}_*`
//     captées AVEC SA SESSION (pas `_enligne`, la lecture publique faite depuis un
//     autre compte), datée par `capturedAt` (`harvestTs` : `updated_at` ment, il
//     n'est qu'un repli) — la lecture `lireDernieresCaptures` de l'app, en
//     projection seule (jamais `select=data`, §4.4), lignes vidées écartées ;
//   · « hors des totaux » = `compteEcarte` (api/_lib/ventes-regle.js : masqué
//     dans l'app, ou depuis le panneau de l'extension, `false` = rallumé).
// Jamais nommé : un compte supprimé (absent de `vinted_accounts`, ou dans
// `vrm_blocked_accounts`), banni (relevé dans `panel_comptes_etat`) ou hors des
// totaux. Compte lu ⇒ rien. « Pas su » ⇒ rien : une lecture ratée, ou un compte
// qui n'a AUCUNE lecture datée (« jamais relu » n'est pas « plus de 24 h » —
// l'app le dit, la notification se tait).
// Pur : aucune lecture, aucune écriture (le cron lit, ce module décide).
// ────────────────────────────────────────────────────────────────────────────
import { compteEcarte } from './ventes-regle.js';
import { etatCompteLie, ageLecture } from '../../src/comptesLies.js';

// La catégorie de notification (famille « Rappels », api/_lib/notif-textes.js).
export const CAT_RELECTURE = 'relecture';
// Le mémo du jour (une notification par jour au plus).
export const ID_MEMO_RELECTURE = 'relecture_rappel_dedup';
// Ce que le cron lit des lignes captées : trois scalaires, jamais `data`.
export const SELECT_CAPTURES = 'id,updated_at,cap:meta->>capturedAt';

// Une ligne `harvest_{uid}_*` captée AVEC LA SESSION de ce compte (la règle de
// l'app, `ligneDeSaSession`) : `harvest_{uid}_enligne` ne dit rien de lui.
export const ligneDeSaSession = (id) => /^harvest_(\d+)_(?!enligne$)/.exec(String(id || ''));
// La date d'une ligne : `capturedAt`, sinon `updated_at` (la règle `harvestTs`).
export const dateCapture = (row) => {
  const c = Date.parse((row && row.cap) || '');
  if (!isNaN(c)) return c;
  const u = Date.parse((row && row.updated_at) || '');
  return isNaN(u) ? NaN : u;
};
// uid → la plus récente de ses lectures (ms). `null` = pas su (rien lu).
export function dernieresCaptures(rows) {
  if (!Array.isArray(rows)) return null;
  const by = {};
  for (const r of rows) {
    const m = ligneDeSaSession(r && r.id); if (!m) continue;
    const t = dateCapture(r);
    if (t > 0 && (!by[m[1]] || t > by[m[1]])) by[m[1]] = t;
  }
  return by;
}

// Les comptes à nommer, le plus ancien d'abord : [{ uid, nom, lu, age }].
// `null` = pas su (une des lectures a échoué) ⇒ l'appelant n'envoie rien.
//   comptes  : lignes `vinted_accounts` ({ vinted_user_id, login }) ;
//   captures : `dernieresCaptures(...)` ;
//   masques  : Set des uid masqués dans l'app (`vinted_accounts_hidden`) ;
//   panneau  : `panel_accounts_off` (uid → true masqué · false rallumé) ;
//   etats    : `panel_comptes_etat.comptes` (uid → { etat: 'banni' | … }) ;
//   supprimes: Set des uid de `vrm_blocked_accounts`.
export function comptesARelire({ comptes, captures, masques, panneau, etats, supprimes, maintenant = Date.now() } = {}) {
  if (!Array.isArray(comptes) || !captures || typeof captures !== 'object' || !(masques instanceof Set)
    || !panneau || typeof panneau !== 'object' || !etats || typeof etats !== 'object' || !(supprimes instanceof Set)) return null;
  const out = [], vus = new Set();
  for (const c of comptes) {
    const uid = String((c && c.vinted_user_id) || '');
    if (!/^\d+$/.test(uid) || vus.has(uid)) continue;
    vus.add(uid);
    if (supprimes.has(uid)) continue;                         // supprimé pour de bon
    if (compteEcarte(uid, masques, panneau)) continue;        // hors des totaux (son choix)
    const banni = !!(etats[uid] && etats[uid].etat === 'banni');
    if (banni) continue;                                      // banni : aucun geste ne le relit
    const lu = Number.isFinite(captures[uid]) ? captures[uid] : null;
    if (etatCompteLie({ banni, lu, maintenant }) !== 'a-relire') continue;   // lu, ou jamais daté (pas su)
    const login = String((c && c.login) || '').trim();
    out.push({ uid, nom: login || `n° ${uid}`, lu, age: ageLecture(lu, maintenant) });
  }
  return out.sort((a, b) => a.lu - b.lu || a.nom.localeCompare(b.nom, 'fr'));
}

// Le texte : le(s) compte(s) nommé(s) et LE geste. Au plus quatre noms, le reste
// compté. ⚠️ Jamais « Chrome » : le navigateur où est l'extension peut être
// Edge, Brave, Opera, Orion… (audit-chrome-en-dur).
const NOMS_MAX = 4;
export function texteComptesARelire(liste) {
  const l = Array.isArray(liste) ? liste.filter((x) => x && x.nom) : [];
  if (!l.length) return null;
  const geste = 'dans le navigateur où est l’extension VRM';
  if (l.length === 1) {
    const c = l[0];
    return {
      title: `🔄 Compte Vinted pas relu : ${c.nom}`,
      body: `Dernière lecture ${c.age || 'il y a plus de 24 h'}. Ouvre vinted.fr connecté sur ce compte, ${geste}.`,
    };
  }
  const montres = l.slice(0, NOMS_MAX).map((c) => (c.age ? `${c.nom} (${c.age.replace(/^il y a /, '')})` : c.nom));
  const reste = l.length - montres.length;
  return {
    title: `🔄 ${l.length} comptes Vinted pas relus`,
    body: `${montres.join(', ')}${reste > 0 ? ` et ${reste} autre${reste > 1 ? 's' : ''}` : ''} : ouvre vinted.fr connecté sur chacun, ${geste}.`,
  };
}

// Une notification par jour au plus : `memo` lu en trois états (`undefined` =
// pas su ⇒ rien), le jour de Paris `jour` ('AAAA-MM-JJ').
export function decisionRelecture({ liste, memo, jour }) {
  if (liste === null || liste === undefined) return { envoyer: false, raison: 'lecture ratée — rien envoyé' };
  if (!liste.length) return { envoyer: false, raison: 'tous les comptes sont relus' };
  if (memo === undefined) return { envoyer: false, raison: 'mémo illisible — rien envoyé' };
  if (memo && memo.jour === jour) return { envoyer: false, raison: 'déjà envoyé aujourd’hui' };
  return { envoyer: true, raison: 'à relire' };
}
