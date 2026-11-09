// ─────────────────────────────────────────────────────────────────────────────
// LES SMS QUI NE SONT PAS DE MONDIAL RELAY (9 nov.) — l'aiguillage et le rangement.
// La route reste UNE (POST /api/widget?mode=sms, api/_lib/sms-mondialrelay.js `routeSms`) :
// même jeton, même vendeur (celui du JETON), même plafond horaire, même mode essai,
// mêmes trois états (lecture ratée ⇒ 503 sans écrire ; écriture ratée ⇒ 503).
// Un lecteur par expéditeur, chacun avec son en-tête de règles :
//   · api/_lib/sms-chronopost.js  — n° de forme propre, sinon « à vérifier » (forme pas mesurée)
//   · api/_lib/sms-vintedgo.js    — le CODE de retrait est l'identité ; date limite lue
//   · api/_lib/sms-pickup.js      — aucun n°, aucun code : une information par jeton de Pass
//   · api/_lib/sms-vestiaire.js   — marque + date limite : une information, jamais rattachée seule
// L'expéditeur (quand Raccourcis l'envoie) ne choisit que la LECTURE, jamais le vendeur.
// ─────────────────────────────────────────────────────────────────────────────
import { lireSmsChronopost, ligneSmsChronopost, idLigneSmsChrono } from './sms-chronopost.js';
import { lireSmsVintedGo, ligneSmsVintedGo, idLigneSmsVgo } from './sms-vintedgo.js';
import { lireSmsPickup, cleInfoPickup } from './sms-pickup.js';
import { lireSmsVestiaire, estSmsVestiaire, cleInfoVestiaire } from './sms-vestiaire.js';
import { fusionInfo, ID_SMS_INFOS } from './sms-infos.js';

// Rend { famille, lu } ou null (aucun de ces expéditeurs).
export function lireAutreSms(corps, smsAt) {
  const c = corps || {};
  const vg = lireSmsVintedGo(c); if (vg.type !== 'ignore') return { famille: 'vintedgo', lu: vg };
  const pk = lireSmsPickup(c); if (pk.type !== 'ignore') return { famille: 'pickup', lu: pk };
  const ch = lireSmsChronopost(c); if (ch.type !== 'ignore') return { famille: 'chronopost', lu: ch };
  if (estSmsVestiaire(c.texte, c.expediteur)) return { famille: 'vestiaire', lu: lireSmsVestiaire({ texte: c.texte, smsAt }) };
  return null;
}

const fin4 = (s) => `…${String(s || '').slice(-4)}`;
const jourFr = (iso) => { const d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z'); return Number.isFinite(d.getTime()) ? d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Paris' }) : ''; };
export function messageAutre(a, action) {
  const { famille, lu } = a;
  if (famille === 'vestiaire') return lu.type === 'vestiaire' ? `Vestiaire : article ${lu.marque} à expédier avant le ${jourFr(lu.jour)} · ${action === 'mis-a-jour' ? 'information mise à jour' : 'information rangée'}` : 'SMS Vestiaire pas reconnu : rien rangé (aucune identité)';
  if (famille === 'pickup') return lu.type === 'pickup' ? `Pickup : colis au relais ${lu.relais} · Pass ${action === 'mis-a-jour' ? 'déjà connu' : 'rangé'}` : 'SMS Pickup pas reconnu : rien rangé';
  if (famille === 'vintedgo') {
    if (lu.type !== 'vintedgo') return 'SMS Vinted Go pas reconnu : rien rangé';
    if (action === 'deja-retire') return `Code ${lu.code} : colis déjà retiré, rien changé`;
    return action === 'a-verifier' ? `Code ${lu.code} rangé · à vérifier (aucun colis connu avec ce code)` : `Code ${lu.code} · avant le ${jourFr(lu.limite)} · ${action === 'deja-connu' ? 'déjà connu' : 'rangé'}`;
  }
  if (famille === 'chronopost') {
    if (!lu.suivi) return 'SMS Chronopost sans n° de colis : rien rangé';
    if (action === 'deja-retire') return `Colis ${fin4(lu.suivi)} déjà retiré : rien changé`;
    if (action === 'deja-connu') return `Colis ${fin4(lu.suivi)} déjà connu : rien changé`;
    return lu.type === 'disponible' ? `Colis ${fin4(lu.suivi)} rangé · code ✓` : `Colis ${fin4(lu.suivi)} rangé · à vérifier (SMS Chronopost pas reconnu)`;
  }
  return 'rien rangé';
}

// Ce que l'essai montre (rien n'est écrit).
export function resumeEssaiAutre(a) {
  const { famille, lu } = a;
  const l = { famille, type: lu.type };
  if (lu.type === 'vestiaire') Object.assign(l, { marque: lu.marque, limite: lu.jour, forme: lu.forme });
  if (lu.type === 'pickup') Object.assign(l, { relais: lu.relais, pass: '✓' });
  if (lu.type === 'vintedgo') Object.assign(l, { code: '✓', limite: lu.limite });
  if (famille === 'chronopost' && lu.suivi) Object.assign(l, { suivi: lu.suivi, code: lu.code ? '✓' : '' });
  return l;
}

// Le rangement. `lireLigne(id)` → { lu, data } ; `lireListe(path)` → tableau | null ;
// `ecrire(id, data)` → bool. Rend { code, corps } (la réponse HTTP).
export async function rangerAutreSms(a, { lireLigne, lireListe, ecrire, smsAt, maintenant }) {
  const { famille, lu } = a;
  const now = new Date(maintenant).toISOString();
  const ok = (range, action, extra = {}) => ({ code: 200, corps: { ok: true, range, famille, type: lu.type, action, message: messageAutre(a, action), ...extra } });
  const ko503 = (erreur) => ({ code: 503, corps: { ok: false, erreur, message: 'Pas rangé : réessaie' } });

  if (famille === 'vestiaire' || famille === 'pickup') {
    if (lu.type !== 'vestiaire' && lu.type !== 'pickup') return ok(false, 'pas-reconnu');
    const cle = famille === 'vestiaire' ? cleInfoVestiaire(lu) : cleInfoPickup(lu);
    const entree = famille === 'vestiaire'
      ? { source: 'vestiaire', marque: lu.marque, limite: lu.limite, jour: lu.jour, forme: lu.forme, ...(lu.forme === 'vendu' ? { vendueLe: smsAt } : {}) }
      : { source: 'pickup', relais: lu.relais, pass: lu.pass, plateforme: lu.plateforme, forme: lu.rappel ? 'rappel' : 'arrive' };
    const cur = await lireLigne(ID_SMS_INFOS);
    if (!cur.lu) return ko503('base-injoignable');
    const f = fusionInfo(cur.data, cle, entree, { at: smsAt, maintenant: Date.parse(now) });
    if (!(await ecrire(ID_SMS_INFOS, f.data))) return ko503('ecriture-ratee');
    return ok(true, f.action, { ligne: ID_SMS_INFOS });
  }

  if (famille === 'chronopost') {
    if (!lu.suivi) return ok(false, 'sans-numero');
    const id = idLigneSmsChrono(lu.suivi);
    const avant = await lireLigne(id);
    if (!avant.lu) return ko503('base-injoignable');
    const l = ligneSmsChronopost(lu, avant.data, { smsAt, maintenant: now });
    if (!l.data) return ok(false, l.action);
    if (!(await ecrire(id, l.data))) return ko503('ecriture-ratee');
    return ok(true, l.action, { ligne: id });
  }

  if (famille === 'vintedgo') {
    if (lu.type !== 'vintedgo') return ok(false, 'pas-reconnu');
    // 1) Une ligne de colis qui porte DÉJÀ ce code (e-mail, ou un SMS d'avant) : la même.
    const porteurs = await lireListe(`app_data?id=like.email_track_*&meta->>code=eq.${encodeURIComponent(lu.code)}&select=id`);
    if (!Array.isArray(porteurs)) return ko503('base-injoignable');
    const ids = [...new Set(porteurs.map((r) => r && r.id).filter(Boolean))];
    const propre = idLigneSmsVgo(lu.code);
    // Deux lignes d'e-mail au même code : on ne choisit pas — le SMS garde SA ligne.
    const id = ids.length === 1 ? ids[0] : (ids.includes(propre) ? propre : propre);
    const avant = await lireLigne(id);
    if (!avant.lu) return ko503('base-injoignable');
    // 2) Le code lu dans une conversation Vinted par l'extension (`panel_colis_relais`, par transaction).
    let connu = ids.some((x) => x !== propre);
    if (!connu) {
      const pr = await lireLigne('panel_colis_relais');
      if (!pr.lu) return ko503('base-injoignable');
      const par = pr.data && typeof pr.data === 'object' ? pr.data : {};   // { tx: { code, lieu, … } } (extension)
      connu = Object.values(par || {}).some((x) => x && typeof x === 'object' && [x.code, x.code2, x.codeRetrait].some((c) => String(c || '').toUpperCase().replace(/\s+/g, '') === lu.code));
    }
    const l = ligneSmsVintedGo(lu, avant.data, { smsAt, maintenant: now, connu });
    if (!l.data || l.action === 'deja-connu') return ok(false, l.action);
    if (!(await ecrire(id, l.data))) return ko503('ecriture-ratee');
    return ok(true, l.action, { ligne: id });
  }
  return ok(false, 'ignore');
}
