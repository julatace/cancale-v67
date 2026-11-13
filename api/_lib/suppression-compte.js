// api/_lib/suppression-compte.js
// ════════════════════════════════════════════════════════════════════════════
// « SUPPRIMER MON COMPTE » — les règles de la confirmation, de l'inventaire, du
// journal et de l'e-mail (9 novembre, RGPD art. 17 : des vendeurs payants
// arrivent). La route elle-même vit dans api/compte.js (`?mode=supprimer`,
// l'ancien `?mode=fermer` y mène aussi) : elle seule efface.
// ════════════════════════════════════════════════════════════════════════════
// ⚠️ CONFIRMATION FORTE, VÉRIFIÉE PAR LE SERVEUR (l'écran ne suffit jamais) :
//    1. le mot « SUPPRIMER », tapé ;
//    2. ET une preuve que c'est bien lui, maintenant :
//       · son MOT DE PASSE, vérifié par le service de connexion (Supabase), pour
//         le compte du jeton et lui seul ;
//       · OU une CONNEXION RÉCENTE (≤ 10 min) : la date de sa dernière preuve
//         d'identité (mot de passe, Google/Discord, lien, code de double
//         vérification) lue dans le jeton déjà validé par Supabase (`amr`).
//         C'est le chemin d'un compte créé par Google/Discord, sans mot de passe.
//    « Pas su » (service muet, captcha) ⇒ rien n'est effacé.
// ⚠️ INVENTAIRE AVANT TOUT : chaque comptage est une LECTURE ; une seule ratée ⇒
//    rien n'est effacé (§5 : « lecture KO, écriture OK » est le cas qui détruit).
// ⚠️ JOURNAL MINIMAL, SANS CONTENU : une ligne sous le propriétaire NEUTRE
//    (qu'aucune session ne lit), nommée par une EMPREINTE de l'identifiant (jamais
//    l'identifiant, jamais l'e-mail) : la date, l'issue, des nombres. Elle prouve
//    qu'une demande d'effacement a été exécutée (RGPD art. 5.2) ; elle part
//    au bout de JOURNAL_ANS ans (purge à chaque nouvelle suppression).
import crypto from 'crypto';
import { gabaritMail, SITE } from './mail-gabarit.js';
import { sbCle } from './cle.js';
import { PROPRIETAIRE_NEUTRE } from './proprietaire-email.js';
import { derniereConnexion, connexionRecente, fournisseursDu, aMotDePasseSelon, nomFournisseur, FOURNISSEURS_RECONNEXION, FENETRE_RECENTE_MS as FENETRE } from './preuve-connexion.js';
import { fetchAvecDelai } from './fetch-delai.js';   // (11 nov.) chaque appel sortant a un délai

export const MOT_CONFIRMATION = 'SUPPRIMER';
export const FENETRE_RECENTE_MS = FENETRE;
export const JOURNAL_ANS = 3;
export const PREFIXE_JOURNAL = 'vrm_suppression_';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NON_TOUCHE = "Rien n'a été effacé.";

// La dernière preuve d'identité de la session, en millisecondes, lue dans le
// jeton (`amr` : [{ method, timestamp }]). Le jeton a DÉJÀ été validé par
// Supabase (utilisateurDe) avant que cette lecture compte. `null` = pas dit.
// (11 nov.) Le calcul vit dans ./preuve-connexion.js : l'écran fait le MÊME.
export { derniereConnexion };

// Le mot de passe du compte DU JETON, vérifié par Supabase : true · false (faux)
// · undefined (pas su : service muet, captcha, trop d'essais).
export async function verifierMotDePasse({ url, anon, email, motDePasse, id, fetcher = fetchAvecDelai }) {
  if (!email || !motDePasse) return false;
  try {
    const r = await fetcher(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anon, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: String(motDePasse) }),
    });
    if (r.ok) {
      const j = await r.json().catch(() => null);
      return !!(j && j.user && j.user.id === id);
    }
    if (r.status === 400 || r.status === 401 || r.status === 422) {
      const j = await r.json().catch(() => ({}));
      const code = String((j && (j.error_code || j.code || j.error)) || '');
      if (/captcha/i.test(code) || /captcha/i.test(String(j && (j.msg || j.message || j.error_description) || ''))) return undefined;
      return false;
    }
    return undefined;
  } catch (_) { return undefined; }
}

// `{ ok:true, par }` ou `{ ok:false, code, erreur, message }`.
export async function verifierConfirmation({ corps, utilisateur, jeton, maintenant = Date.now(), verifier }) {
  const c = corps && typeof corps === 'object' ? corps : {};
  if (String(c.confirmation || '').trim() !== MOT_CONFIRMATION) {
    return { ok: false, code: 400, erreur: 'confirmation', message: `Tape « ${MOT_CONFIRMATION} » en majuscules pour confirmer. ${NON_TOUCHE}` };
  }
  const mdp = typeof c.motDePasse === 'string' ? c.motDePasse : '';
  if (mdp) {
    const v = await verifier(utilisateur.email, mdp);
    if (v === true) return { ok: true, par: 'mot-de-passe' };
    if (v === false) return { ok: false, code: 403, erreur: 'mot-de-passe', message: `Mot de passe incorrect. ${NON_TOUCHE}` };
    return { ok: false, code: 503, erreur: 'mot-de-passe-pas-su', message: `Je n'ai pas pu vérifier ton mot de passe. ${NON_TOUCHE} Réessaie dans un instant, ou reconnecte-toi et reviens ici dans les 10 minutes.` };
  }
  const t = derniereConnexion(jeton);
  if (connexionRecente(t, maintenant)) return { ok: true, par: 'connexion-recente' };
  // (11 nov.) Un compte SANS mot de passe : la phrase nomme le seul geste possible.
  const f = fournisseursDu({ jeton });
  const oauth = (f || []).filter((p) => FOURNISSEURS_RECONNEXION.includes(p)).map(nomFournisseur);
  if (aMotDePasseSelon(f) === false && oauth.length) {
    return { ok: false, code: 403, erreur: 'reconnexion', message: `Ta connexion date de plus de 10 minutes. Reconnecte-toi avec ${oauth.join(' ou ')}, puis reviens ici. ${NON_TOUCHE}` };
  }
  return { ok: false, code: 403, erreur: 'reconnexion', message: `Confirme que c'est toi : entre ton mot de passe, ou déconnecte-toi, reconnecte-toi, puis reviens ici dans les 10 minutes. ${NON_TOUCHE}` };
}

// Un comptage : le nombre de lignes, ou `null` (pas su). `limit=1` + `count=exact`
// : la base rend `0-0/N` (ou `*/0`), une seule ligne voyage (§4.4).
async function compter(url, service, chemin, fetcher) {
  try {
    const r = await fetcher(`${url}/rest/v1/${chemin}&limit=1`, { headers: { ...sbCle(service), Prefer: 'count=exact' } });
    if (r.status === 404) return 0;                 // table absente ici (comme `effacer`)
    if (!r.ok) return null;
    const m = /\/(\d+)\s*$/.exec((r.headers && r.headers.get && r.headers.get('content-range')) || '');
    return m ? Number(m[1]) : null;
  } catch (_) { return null; }
}

// Les requêtes de chaque famille — les MÊMES pour compter et pour effacer.
// `owner` : le vendeur (UUID vérifié) ; `proprio` : le propriétaire de
// l'installation ('' = aucun déclaré : il n'y a alors aucun signalement).
export function requetes(owner, proprio) {
  const o = encodeURIComponent(owner);
  const q = {
    donnees: `app_data?owner=eq.${o}`,
    facturesPro: `app_data?owner=eq.${o}&id=like.email_invoice_*`,
    comptesVinted: `vinted_accounts?owner=eq.${o}`,
    preuvesAdresse: `app_data?owner=eq.${PROPRIETAIRE_NEUTRE}&id=like.vrm_email_preuve_*&data->>owner=eq.${o}`,
    // Les index de jetons (adresse de réception, widget, SMS) : sous le neutre,
    // ils nomment le vendeur dans `data.owner`.
    indexJetons: `app_data?owner=eq.${PROPRIETAIRE_NEUTRE}&id=like.jeton_*&data->>owner=eq.${o}`,
  };
  if (proprio) q.signalements = `app_data?owner=eq.${encodeURIComponent(proprio)}&id=like.signalement_*&data->>de=eq.${o}`;
  return q;
}

// Tout compter. `null` si UNE lecture rate (rien ne sera effacé).
export async function inventaire({ url, service, owner, proprio, fetcher = fetchAvecDelai }) {
  if (!UUID.test(String(owner || ''))) return null;
  const q = requetes(owner, proprio);
  const sel = { donnees: 'select=id', facturesPro: 'select=id', comptesVinted: 'select=owner', preuvesAdresse: 'select=id', indexJetons: 'select=id', signalements: 'select=id' };
  const out = {};
  for (const [k, chemin] of Object.entries(q)) {
    const n = await compter(url, service, `${chemin}&${sel[k]}`, fetcher);
    if (n === null) return null;
    out[k] = n;
  }
  if (!('signalements' in out)) out.signalements = 0;
  return out;
}

// Le propriétaire de l'installation : son UUID · '' (aucun déclaré) · undefined (pas su).
export async function lireProprietaire({ url, service, env = process.env, fetcher = fetchAvecDelai }) {
  const e = String(env.VRM_OWNER_UID || '').trim().toLowerCase();
  if (UUID.test(e) && e !== PROPRIETAIRE_NEUTRE) return e;
  try {
    const r = await fetcher(`${url}/rest/v1/vrm_reglages?cle=eq.proprietaire&select=valeur&limit=1`, { headers: sbCle(service) });
    if (r.status === 404) return '';
    if (!r.ok) return undefined;
    const j = await r.json().catch(() => null);
    if (!Array.isArray(j)) return undefined;
    const v = j[0] ? String(j[0].valeur || '').trim().toLowerCase() : '';
    return UUID.test(v) && v !== PROPRIETAIRE_NEUTRE ? v : '';
  } catch (_) { return undefined; }
}

// ── Le journal minimal ──────────────────────────────────────────────────────
export const idJournal = (owner) => PREFIXE_JOURNAL + crypto.createHash('sha256').update(String(owner).toLowerCase()).digest('hex').slice(0, 32);
// Que des nombres et une date : ni e-mail, ni identifiant, ni contenu.
export function ligneJournal({ ok, nombres, maintenant = Date.now() }) {
  const n = {};
  for (const [k, v] of Object.entries(nombres || {})) if (Number.isInteger(v) && v >= 0) n[k] = v;
  return { at: new Date(maintenant).toISOString(), issue: ok ? 'supprime' : 'incomplet', nombres: n };
}
export async function noterJournal({ url, service, owner, ok, nombres, maintenant = Date.now(), fetcher = fetchAvecDelai }) {
  const at = new Date(maintenant).toISOString();
  let ecrit = false;
  try {
    const r = await fetcher(`${url}/rest/v1/app_data?on_conflict=owner,id`, {
      method: 'POST',
      headers: { ...sbCle(service), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ owner: PROPRIETAIRE_NEUTRE, id: idJournal(owner), data: ligneJournal({ ok, nombres, maintenant }), updated_at: at }]),
    });
    ecrit = r.ok;
  } catch (_) { ecrit = false; }
  // La purge : les lignes de plus de JOURNAL_ANS ans (jamais une autre famille).
  try {
    const limite = new Date(maintenant - JOURNAL_ANS * 365.25 * 864e5).toISOString();
    await fetcher(`${url}/rest/v1/app_data?owner=eq.${PROPRIETAIRE_NEUTRE}&id=like.${PREFIXE_JOURNAL}*&data->>at=lt.${encodeURIComponent(limite)}`, { method: 'DELETE', headers: { ...sbCle(service), Prefer: 'return=minimal' } });
  } catch (_) {}
  return ecrit;
}

// ── L'e-mail de confirmation (gabarit commun ; rien de ses données dedans) ──
export function mailSuppression({ fait = [], contact = '', motif = 'demande', maintenant = Date.now() } = {}) {
  const jour = new Date(maintenant).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', year: 'numeric' });
  const { texte, html } = gabaritMail({
    titre: 'Ton compte VRM est supprimé',
    preentete: `Ton compte et tes données ont été effacés le ${jour}.`,
    paras: [
      motif === 'depart'
        ? `Ton abonnement VRM s’est terminé il y a 12 mois : comme annoncé, ton compte et tes données ont été effacés le ${jour}. Ce qui a été fait :`
        : `Tu as supprimé ton compte VRM le ${jour}. Ce qui a été fait :`,
    ],
    liste: fait.slice(0, 12),
    suite: [
      'Ce qui reste, et pourquoi : les factures Pro que tu as émises avec VRM sont gardées 10 ans, sans accès, parce que la loi l’exige (art. L123-22 du Code de commerce), puis effacées ; les factures de ton abonnement VRM restent chez Stripe, notre prestataire de paiement (même obligation). VRM garde aussi une ligne sans contenu — la date et des nombres — qui prouve que l’effacement a été fait ; elle part au bout de 3 ans.',
      `Pense à retirer l’extension VRM de ton navigateur.${contact ? ` Ce n’est pas toi ? Écris à ${contact}.` : ''}`,
    ],
    pied: { texte: 'Tu reçois ce message parce que ton compte VRM vient d’être supprimé. C’est le dernier : tu ne recevras plus rien de VRM.' },
  });
  return { sujet: 'Ton compte VRM est supprimé', texte, html, lien: SITE };
}
