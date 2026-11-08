// ─────────────────────────────────────────────────────────────────────────────
// « CETTE VENTE VINTED ATTEND-ELLE ENCORE MON ENVOI ? » — UNE RÈGLE (8 nov.).
// Pure : aucune lecture réseau, aucune écriture. Importée TELLE QUELLE par l'app
// (Colis, Ma journée, la cloche `vrm_colis_aposter`, Ventes, la loupe) et par le
// serveur (api/widget.js, api/ship-reminders.js : widget, rappels, bilan), §11.
//
// Julien (8 nov.) : « J'ai expédié des colis, c'est encore marqué qu'il faut que
// je les expédie. C'est inadmissible. Chaque donnée doit avoir du sens et être au
// bon endroit. » Ses listes Vinted étaient figées (« Bordereau envoyé ») : les
// AUTRES preuves de départ existaient, mais seul l'écran Colis en lisait une
// partie ; le widget et les rappels n'en lisaient presque aucune.
//
// LA RÈGLE — une vente que Vinted dit « à expédier » (`aExpedier`, la règle qui
// reste celle de chaque côté) N'ATTEND PLUS l'envoi dès qu'UNE preuve SÛRE, PAR
// IDENTITÉ, dit qu'elle est partie :
//   1. « Colis fait » (`vinted_ship_done`, par n° de transaction) ;
//   2. « expédié » à la main sur son bordereau (`vinted_bords_shipped`, clé du
//      bordereau = transaction || n° de suivi || numéro) ;
//   3. « traité » depuis le panneau de l'extension (`panel_bords_done`, même clé) ;
//   4. un e-mail du transporteur (dépôt, en route, arrivé, livré, reparti) pour le
//      n° de suivi EXACT du bordereau de CETTE transaction ;
//   5. la prise en charge lue chez le transporteur (`depart_*`,
//      api/_lib/depart-colis.js).
// Le statut Vinted qui n'attend plus l'envoi est la 6e preuve : il vit dans
// `aExpedier` lui-même (une vente qui n'est pas « à expédier » n'est jamais
// comptée).
//
// CE QUI NE PROUVE RIEN (« pas su » ne vaut pas « parti ») :
//   · un e-mail « info », un e-mail dont le sujet ne parle QUE du bordereau
//     (« Ton bordereau d'envoi » = une étiquette créée, pas un colis déposé) ;
//   · un n° de suivi porté par DEUX ventes, ou aussi par un ACHAT (`entrants`) :
//     ambigu ⇒ rien n'est déduit, ni de l'e-mail ni du transporteur ;
//   · un e-mail marqué ENTRANT (`sens: 'entrant'`) : le colis d'un achat ne fait
//     jamais partir une vente ;
//   · un e-mail daté plus d'un jour AVANT la vente (ou son bordereau) : il
//     contredit l'identité ;
//   · le titre, la marque, la taille : JAMAIS (§5). 50 ventes au même titre ⇒
//     seule celle dont le n° est prouvé sort.
//   · imprimer un bordereau (règle de l'app depuis août) ;
//   · une lecture ratée (lignes `null`) ⇒ cette preuve manque, rien d'autre.
// Une vente annulée / remboursée n'est jamais « à envoyer » : c'est `aExpedier`
// qui le dit, cette règle ne la remet jamais nulle part.
// ─────────────────────────────────────────────────────────────────────────────
import { normaliserSuivi } from './etat-colis-email.js';
import { departProuve, suivisAmbigus, jourCourtParis, TOLERANCE_AVANT_VENTE_MS } from './depart-colis.js';
import { nomTransporteur } from './transporteurs.js';

const msDe = (v) => { if (Number.isFinite(v)) return v; const x = Date.parse(String(v || '')); return Number.isFinite(x) ? x : null; };
const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

// La clé d'un bordereau — la MÊME que `bordKey` de l'app et `bKey` du widget.
export const cleBordereau = (b) => (b ? String(b.transaction || b.suivi || b.numero || '') : '');

// Les états d'un e-mail qui prouvent que le colis est DANS le réseau.
const ETATS_PARTI = new Set(['transit', 'available', 'delivered', 'retour']);
// Un sujet de DÉPÔT (le colis est entre les mains du transporteur)…
const SUJET_DEPOT = /entre de bonnes mains|preuve de d[ée]p[ôo]t|confirmation du d[ée]p[ôo]t|d[ée]p[ôo]t de (?:votre|ton) colis|colis (?:est|a [ée]t[ée]) d[ée]pos[ée]/i;
// … et un sujet qui ne parle QUE de l'étiquette (rien n'est déposé).
const SUJET_ETIQUETTE = /bordereau|[ée]tiquette/i;

const champ = (l, long, court) => (l[long] != null ? l[long] : l[court]);
// Une ligne d'e-mail (forme de l'app — `status`, `suivi`, `subject`… — ou les
// scalaires du serveur — `s`, `su`, `sj`…) ⇒ { suivi, status, sujet, sens,
// carrier, at } ou null.
export function preuveDeLigne(l) {
  if (!l || typeof l !== 'object') return null;
  const suivi = normaliserSuivi(champ(l, 'suivi', 'su'));
  if (!suivi) return null;
  const status = String(champ(l, 'status', 's') || '');
  if (!ETATS_PARTI.has(status)) return null;
  const sens = champ(l, 'sens', 'se');
  if (sens === 'entrant') return null;
  const sujet = String(champ(l, 'subject', 'sj') || '');
  // « Ton bordereau d'envoi » seul : une étiquette, pas un départ.
  if (SUJET_ETIQUETTE.test(sujet) && !SUJET_DEPOT.test(sujet) && status === 'transit') return null;
  const at = msDe(champ(l, 'emailAt', 'ea')) ?? msDe(champ(l, 'receivedAt', 'r'));
  return { suivi, status, sujet, depot: SUJET_DEPOT.test(sujet), carrier: String(champ(l, 'carrier', 'c') || ''), at };
}
// n° → la PREMIÈRE preuve (la plus ancienne) : le jour où le colis a été vu
// partir. `lignes` null ⇒ null (pas su).
export function preuvesEmailParSuivi(lignes) {
  if (!Array.isArray(lignes)) return null;
  const m = new Map();
  for (const l of lignes) {
    const p = preuveDeLigne(l);
    if (!p) continue;
    const a = m.get(p.suivi);
    if (!a || (p.at != null && (a.at == null || p.at < a.at))) m.set(p.suivi, p);
  }
  return m;
}

const NOM_EMAIL = { mondialrelay: 'Mondial Relay', chronopost: 'Chronopost', vinted: 'Vinted Go', colissimo: 'Colissimo', relaiscolis: 'Relais Colis', ups: 'UPS', dpd: 'DPD', dhl: 'DHL', gls: 'GLS' };
const MOT_ETAT = { transit: 'en route', available: 'arrivé au point relais', delivered: 'livré', retour: 'reparti' };
// LA PHRASE vient de la même preuve que la décision (§5, « Les chiffres »).
export function phraseRaison(r) {
  if (!r) return '';
  const jour = r.at != null ? jourCourtParis(r.at) : '';
  const le = jour ? ` le ${jour}` : '';
  const du = jour ? ` du ${jour}` : '';
  if (r.type === 'colis-fait') return `Colis fait${le}`;
  if (r.type === 'expedie-main') return 'Marqué expédié à la main';
  if (r.type === 'panneau') return 'Traité depuis le panneau de l’extension';
  if (r.type === 'transporteur') return r.phrase || `Pris en charge${le}`;
  if (r.type === 'email') {
    const nom = NOM_EMAIL[String(r.carrier || '').toLowerCase()] || '';
    if (r.depot) return `E-mail de dépôt${nom ? ' ' + nom : ''}${du}`;
    return `E-mail${nom ? ' ' + nom : ''} « ${MOT_ETAT[r.status] || 'en route'} »${du}`;
  }
  return '';
}

// ── LA RAISON D'UNE VENTE ───────────────────────────────────────────────────
// `tx` : son n° de transaction ; `bord` : SON bordereau (ou null) ; `ctx` :
//   shipDone {tx → horodatage}, bordsShipped {clé → 1}, panelBordsDone {clé → …},
//   preuvesEmail (Map n° → preuve, `preuvesEmailParSuivi`, null = pas su),
//   departs (Map n° → ligne `depart_`, null = pas su),
//   ambigus (Set des n° ambigus), venteMs (date de la vente, ms).
// Rend { type, at, phrase, … } ou null (rien de prouvé : elle attend toujours).
export function raisonDepartVente(tx, bord, ctx = {}) {
  const t = tx == null ? '' : String(tx);
  const shipDone = objet(ctx.shipDone), bordsShipped = objet(ctx.bordsShipped), panel = objet(ctx.panelBordsDone);
  const out = (r) => ({ ...r, tx: t, phrase: phraseRaison(r) });
  if (t && shipDone[t]) return out({ type: 'colis-fait', at: msDe(shipDone[t]) });
  const kb = bord ? cleBordereau(bord) : '';
  if (t && bordsShipped[t]) return out({ type: 'expedie-main', at: null });
  if (kb && bordsShipped[kb]) return out({ type: 'expedie-main', at: null });
  if (t && panel[t]) return out({ type: 'panneau', at: msDe(panel[t]) });
  if (kb && panel[kb]) return out({ type: 'panneau', at: msDe(panel[kb]) });
  // Les preuves par n° de suivi : le n° EXACT du bordereau de CETTE transaction.
  const k = normaliserSuivi(bord && bord.suivi);
  if (!k) return null;
  const amb = ctx.ambigus;
  if (amb && (amb instanceof Set ? amb.has(k) : Array.isArray(amb) && amb.includes(k))) return null;
  const v = msDe(ctx.venteMs) ?? msDe(bord && bord.receivedAt);
  const pe = ctx.preuvesEmail instanceof Map ? ctx.preuvesEmail.get(k) : null;
  if (pe && !(v != null && pe.at != null && pe.at < v - TOLERANCE_AVANT_VENTE_MS)) {
    return out({ type: 'email', at: pe.at, suivi: k, carrier: pe.carrier, status: pe.status, depot: pe.depot });
  }
  const dp = ctx.departs ? departProuve(k, ctx.departs, { venteMs: v, ambigus: amb || null }) : null;
  if (dp) return out({ type: 'transporteur', at: dp.at, suivi: k, carrier: dp.carrier, phrase: dp.phrase });
  return null;
}

// ── TOUTES LES VENTES VINTED PARTIES PAR PREUVE ─────────────────────────────
// `txs` : les transactions que Vinted dit « à expédier » (ou toutes : une vente
// déjà partie chez Vinted n'est simplement pas consultée) ; `bordsParTx` :
// { tx → bordereau } (`bordsParTransaction`) ; `lignesEmail` : les lignes
// `email_track_*` (null = pas su) ; `departs` : Map n° → `depart_` ; `ventesMs` :
// { tx → ms } ; `entrants` : Set des n° d'ACHATS (ambigus).
// Rend Map tx → raison.
export function ventesPartiesParPreuve({ txs = null, bordsParTx = {}, shipDone = {}, bordsShipped = {}, panelBordsDone = {}, lignesEmail = null, departs = null, ventesMs = null, entrants = null } = {}) {
  const bp = objet(bordsParTx);
  const liste = Object.entries(bp).map(([tx, b]) => ({ cle: tx, suivi: b && b.suivi }));
  const ambigus = suivisAmbigus(liste, entrants instanceof Set ? new Set([...entrants].map(normaliserSuivi).filter(Boolean)) : null);
  const preuvesEmail = preuvesEmailParSuivi(lignesEmail);
  const ctx = { shipDone, bordsShipped, panelBordsDone, preuvesEmail, departs, ambigus };
  const tous = txs == null ? new Set([...Object.keys(objet(shipDone)), ...Object.keys(objet(bordsShipped)), ...Object.keys(objet(panelBordsDone)), ...Object.keys(bp)]) : new Set([...txs].map(String));
  const out = new Map();
  for (const tx of tous) {
    const r = raisonDepartVente(tx, bp[tx] || null, { ...ctx, venteMs: ventesMs && ventesMs[tx] != null ? ventesMs[tx] : null });
    if (r) out.set(String(tx), r);
  }
  return out;
}
// La question elle-même, pour qui a la vente en main : « à expédier » chez Vinted
// (la règle de son côté, passée en booléen) ET aucune preuve de départ.
export const attendEnvoi = (aExpedierVinted, raison) => aExpedierVinted === true && !raison;

// ── LE SERVEUR : CE QU'IL LIT POUR CETTE RÈGLE (scalaires, §4.4) ────────────
// Les lignes d'e-mail qui peuvent prouver un départ (jamais `select=data`), la
// ligne du panneau de l'extension, et les n° d'ACHATS (les lignes `transp_`
// n'existent que pour des achats : `suivisAInterroger`) — par leur id seul.
export const SELECT_PREUVE_EMAIL = 'id,s:meta->>status,r:meta->>receivedAt,ea:meta->>emailAt,su:meta->>suivi,sj:meta->>subject,se:meta->>sens,c:meta->>carrier';
export const REQ_PREUVES_EMAIL = `app_data?id=like.email_track_*&meta->>status=in.(transit,available,delivered,retour,info)&select=${SELECT_PREUVE_EMAIL}`;
export const REQ_PANNEAU = 'app_data?id=eq.panel_bords_done&select=data';
export const REQ_ENTRANTS = 'app_data?id=like.transp_*&select=id';
// `lireToutes(chemin)` : la lecture paginée du serveur (null = ratée) ;
// `relire(ligne)` : la relecture d'une ligne d'e-mail par la règle de l'app (le
// n° lu dans le sujet, api/_lib/suivi-colis.js `relireLigneMeta`).
// Rend { lignesEmail, panelBordsDone, entrants } — chaque source `null` si sa
// lecture a raté : la preuve correspondante manque, le colis RESTE à envoyer.
export async function lirePreuvesDepart(lireToutes, relire = (x) => x) {
  const sur = async (p) => { try { const r = await lireToutes(p); return Array.isArray(r) ? r : null; } catch (_) { return null; } };
  const [em, pa, en] = await Promise.all([sur(REQ_PREUVES_EMAIL), sur(REQ_PANNEAU), sur(REQ_ENTRANTS)]);
  const lignesEmail = em ? em.map((x) => { try { return relire(x) || x; } catch (_) { return x; } }).filter(Boolean) : null;
  const panelBordsDone = pa ? objet(pa[0] && pa[0].data) : null;
  const entrants = en ? new Set(en.map((r) => { const m = /^transp_[a-z]+_([A-Z0-9]+)$/.exec(String((r && r.id) || '')); return m ? m[1] : ''; }).filter(Boolean)) : null;
  return { lignesEmail, panelBordsDone, entrants };
}
