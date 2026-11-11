// api/_lib/journal-notifs.js
// ────────────────────────────────────────────────────────────────────────────
// LE CENTRE DE NOTIFICATIONS (5 nov., Julien : « une meilleure interface, plus
// pro, personnalisable comme on veut ; cliquer une notification amène
// directement sur ce qui est arrivé »).
//
// Jusqu'ici une notification n'avait aucune trace lisible : seulement sa clé de
// dédoublonnage (`push_dedup`). Chaque notification qui PASSE le réglage du
// vendeur est maintenant rangée, AU NOM DE CE VENDEUR, dans la ligne
// `push_journal` — juste avant d'être envoyée (api/_lib/push.js) :
//   { n: <dernier numéro>, depuis: <plus petit numéro gardé>, entrees: [{ seq, at, famille, cat, titre, texte, url, etat }], rev }
//   etat : 'envoyee'        partie vers ses appareils
//          'calme'          pendant ses heures calmes : rien n'a sonné
//          'sans-appareil'  aucun appareil abonné
//          'serveur'        le serveur n'a pas sa clé d'envoi
//          'echec'          aucun appareil ne l'a acceptée
// Un type ÉTEINT n'est ni envoyé ni rangé (il a dit qu'il n'en voulait pas).
//
// ⚠️ UNE RÈGLE, UN PROPRIÉTAIRE : le SERVEUR seul écrit `push_journal`
//    (comparer-et-échanger sur `rev`, comme `push_subs`). L'app n'y écrit
//    jamais : ce qu'il a LU vit dans une autre ligne, `push_journal_lu`
//    (`{ luJusqua: <seq>, lus: [seq…] }`), écrite par l'app seule. Le serveur la
//    lit pour regrouper ; elle ne la touche pas.
// ⚠️ Un journal qu'on n'arrive pas à écrire n'empêche JAMAIS l'envoi : un
//    message manqué ne se rattrape pas (même règle que `push_dedup`).
// ⚠️ Borné : 150 entrées, 30 jours. Le numéro (`seq`) ne redescend jamais : le
//    compte des non-lues se lit en deux scalaires (`n` et `luJusqua`), sans
//    jamais charger la liste pour poser une pastille.
// ────────────────────────────────────────────────────────────────────────────
import crypto from 'node:crypto';
import { sbCle } from './cle.js';
import { proprietaireCourant } from './owner.js';
import { familleDe } from './notif-textes.js';

export const ID_JOURNAL = 'push_journal';
export const ID_LU = 'push_journal_lu';
export const MAX_ENTREES = 150;
export const DUREE_MS = 30 * 86400e3;
// (8 nov.) `discret` : rangée dans la cloche sans sonner (une information sans geste).
export const ETATS = ['envoyee', 'calme', 'sans-appareil', 'serveur', 'echec', 'discret', 'attente', 'groupee'];
// (11 nov., lot `notifs-groupees`) `attente` : arrivée dans la fenêtre de regroupement,
// elle partira dans le prochain résumé ; `groupee` : elle est partie DANS un résumé
// (`dans` : le moment du résumé). Clé d'idempotence `cle` (objet + jour, api/_lib/notif-groupe.js).

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const cle = () => process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';

// Un texte court, sans balise ni caractère de contrôle (ce que l'écran montre).
const propre = (s, n) => String(s == null ? '' : s).replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
// L'adresse ouverte au toucher : seulement un chemin de l'app (`/?…`), jamais
// une adresse extérieure.
export const urlSure = (u) => { const s = String(u || ''); return /^\/(\?[A-Za-z0-9_=&%.-]{0,600})?$/.test(s) ? s : '/'; };

// ── PUR ────────────────────────────────────────────────────────────────────
// Ajoute une entrée à un journal LU (ou `null` : la ligne n'existe pas encore).
// Rend le nouveau journal (sans `rev`, posé à l'écriture) et le numéro donné.
export function ajouterEntree(journal, e, maintenant = Date.now()) {
  const j = journal && typeof journal === 'object' ? journal : {};
  const avant = Array.isArray(j.entrees) ? j.entrees.filter((x) => x && Number.isSafeInteger(x.seq)) : [];
  const n0 = Number.isSafeInteger(j.n) && j.n >= 0 ? j.n : avant.reduce((m, x) => Math.max(m, x.seq), 0);
  const seq = n0 + 1;
  const entree = {
    seq,
    at: new Date(maintenant).toISOString(),
    famille: e.cat === 'test' ? 'test' : (familleDe(e.cat) || null),
    cat: propre(e.cat, 20) || null,
    titre: propre(e.titre, 120),
    texte: propre(e.texte, 240),
    url: urlSure(e.url),
    ...(e.genre && /^[a-z]{1,20}$/.test(e.genre) ? { genre: e.genre } : {}),
    ...(typeof e.cle === 'string' && e.cle ? { cle: e.cle.slice(0, 160) } : {}),
    etat: ETATS.includes(e.etat) ? e.etat : 'envoyee',
  };
  const garde = [entree, ...avant].filter((x) => !(Date.parse(x.at) < maintenant - DUREE_MS)).slice(0, MAX_ENTREES);
  // `depuis` : le plus petit numéro encore gardé. La pastille de l'app compte
  // les non-lues entre `depuis` et `n` (deux scalaires) : une entrée purgée
  // (plus de 30 jours, au-delà de 150) ne compte plus — la cloche ne dit
  // jamais « 4 » sur une liste qui en montre une.
  const depuis = garde.reduce((m, x) => Math.min(m, x.seq), seq);
  // Les scalaires du regroupement (dernière sonnerie, fin de la fenêtre en cours) sont gardés.
  const scal = {};
  if (typeof j.dernierSon === 'string') scal.dernierSon = j.dernierSon;
  if (typeof j.attenteJusqua === 'string') scal.attenteJusqua = j.attenteJusqua;
  return { journal: { n: seq, depuis, entrees: garde, ...scal }, seq, entree };
}

// ── (11 nov.) LA DÉCISION DU REGROUPEMENT, DANS LE COMPARER-ET-ÉCHANGER ─────
// Pure. Prise sur le journal LU, écrite en une fois : deux e-mails arrivés à la
// même seconde ne peuvent pas « sonner les premiers » tous les deux.
//   e        : { cat, titre, texte, url, etat, genre, cle }
//   fenetre  : minutes (0 = aucune) ; `attendre` : l'objet peut attendre (un
//              événement, pas urgent) ; `maintenant` : ms.
// Rend :
//   { doublon: true }                     même objet, même jour : rien
//   { journal, seq, entree, etat, groupe } sinon ; `groupe` = les entrées en
//   attente qui partent AVEC celle-ci (fenêtre libre), marquées `groupee`.
const ETATS_DOUBLON = new Set(['envoyee', 'calme', 'discret', 'attente', 'groupee', 'sans-appareil', 'serveur']);
export function deciderEntree(journal, e, { fenetre = 0, attendre = false, maintenant = Date.now() } = {}) {
  const j = journal && typeof journal === 'object' ? journal : {};
  const avant = Array.isArray(j.entrees) ? j.entrees : [];
  if (e.cle && avant.some((x) => x && x.cle === e.cle && ETATS_DOUBLON.has(x.etat))) return { doublon: true };
  const son = Date.parse(j.dernierSon || '');
  const occupee = fenetre > 0 && Number.isFinite(son) && maintenant - son < fenetre * 60e3 && maintenant >= son;
  let etat = e.etat;
  if (etat === 'envoyee' && attendre && occupee) etat = 'attente';
  const r = ajouterEntree(j, { ...e, etat }, maintenant);
  const jr = r.journal;
  let groupe = [];
  if (etat === 'attente') {
    // La fenêtre se ferme à `dernierSon + fenetre` : le résumé part alors (jamais repoussé).
    const fin = new Date(son + fenetre * 60e3).toISOString();
    if (!(typeof jr.attenteJusqua === 'string' && jr.attenteJusqua <= fin)) jr.attenteJusqua = fin;
  } else if (etat === 'envoyee') {
    // Elle sonne. Fenêtre libre ⇒ ce qui attendait part AVEC elle (un seul résumé).
    if (!occupee) {
      const at = new Date(maintenant).toISOString();
      jr.entrees = jr.entrees.map((x) => {
        if (!x || x.etat !== 'attente') return x;
        groupe.push(x);
        return { ...x, etat: 'groupee', dans: at };
      });
      delete jr.attenteJusqua;
    }
    jr.dernierSon = new Date(maintenant).toISOString();
  }
  return { journal: jr, seq: r.seq, entree: r.entree, etat, groupe };
}
// La fin d'une fenêtre (passage de 15 min, ou prochain envoi) : ce qui attend
// part en UN résumé. Pure. `etatPour(entrée)` dit ce que devient chacune :
// 'groupee' (elle part dans le résumé) ; 'calme' (heures calmes en cours : le
// récapitulatif du réveil la dira) ; 'sans-appareil' / 'serveur' (rien ne peut
// sonner). Défaut : 'groupee'. Rend `null` (rien d'échu) ou `{ journal, groupe }`
// — `groupe` : les entrées qui partent dans le résumé.
export function vidangerEntrees(journal, { maintenant = Date.now(), etatPour = null } = {}) {
  const j = journal && typeof journal === 'object' ? journal : null;
  if (!j || !Array.isArray(j.entrees)) return null;
  const fin = Date.parse(j.attenteJusqua || '');
  if (!Number.isFinite(fin) || fin > maintenant) return null;
  const at = new Date(maintenant).toISOString();
  const groupe = [];
  const entrees = j.entrees.map((x) => {
    if (!x || x.etat !== 'attente') return x;
    const e = typeof etatPour === 'function' ? etatPour(x) : 'groupee';
    if (e === 'groupee') { groupe.push(x); return { ...x, etat: 'groupee', dans: at }; }
    return { ...x, etat: ETATS.includes(e) ? e : 'groupee' };
  });
  const { attenteJusqua: _a, rev: _r, ...reste } = j;
  const out = { ...reste, entrees };
  if (groupe.length) out.dernierSon = at;
  return { journal: out, groupe };
}

// ── LECTURE / ÉCRITURE, AU NOM DU VENDEUR DE LA REQUÊTE ────────────────────
// (8 nov.) Les non-lues d'un même GENRE (api/_lib/notif-belle.js) des dernières
// 24 h, celle-ci comprise. `lu` pas su ⇒ 1 : aucun nombre inventé.
export function nonLuesDeGenre(entrees, genre, lu, maintenant = Date.now()) {
  if (!genre || !lu || typeof lu !== 'object') return 1;
  const jusqua = Number.isSafeInteger(lu.luJusqua) ? lu.luJusqua : 0;
  const lus = new Set(Array.isArray(lu.lus) ? lu.lus.filter(Number.isSafeInteger) : []);
  return Math.max(1, (entrees || []).filter((x) => x && x.genre === genre && x.seq > jusqua && !lus.has(x.seq) && Date.parse(x.at) >= maintenant - 86400e3).length);
}

async function lireLigne(id, select = 'data') {
  const o = proprietaireCourant();
  if (!o || !cle()) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${id}&owner=eq.${encodeURIComponent(o)}&select=${select}`, { headers: { ...sbCle(cle()) } });
    if (!r.ok) return null;
    const j = await r.json();
    if (!Array.isArray(j)) return null;
    return { existe: !!j[0], ligne: j[0] || null };
  } catch (_) { return null; }
}
// La liste rangée (au plus 150 entrées, petite) : `{}` si rien, `null` pas su.
export async function lireJournal() {
  const l = await lireLigne(ID_JOURNAL);
  if (!l) return null;
  const d = l.ligne && l.ligne.data;
  return d && typeof d === 'object' ? d : {};
}
// Ce qu'il a lu (écrit par l'app) : `{ luJusqua, lus }`, `{}` si rien, `null` pas su.
export async function lireLu() {
  const l = await lireLigne(ID_LU);
  if (!l) return null;
  const d = l.ligne && l.ligne.data;
  return d && typeof d === 'object' ? d : {};
}
const nouvelleRev = () => { try { return crypto.randomUUID(); } catch (_) { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; } };
// Comparer-et-échanger : `modifier(journalLu|null)` rend `{ journal, … }` ou
// `undefined` (rien à écrire). Rend ce que `modifier` a rendu, ou `null` (pas su).
async function modifierJournal(modifier, essais = 5) {
  const o = proprietaireCourant();
  if (!o || !cle()) return null;
  const tete = { ...sbCle(cle()), 'Content-Type': 'application/json' };
  for (let i = 0; i < essais; i++) {
    const l = await lireLigne(ID_JOURNAL);
    if (!l) return null;
    const d = l.ligne && l.ligne.data && typeof l.ligne.data === 'object' ? l.ligne.data : null;
    const res = modifier(d);
    if (!res) return null;
    const data = { ...res.journal, rev: nouvelleRev() };
    try {
      if (!l.existe) {
        const w = await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=owner,id`, {
          method: 'POST', headers: { ...tete, Prefer: 'resolution=ignore-duplicates,return=representation' },
          body: JSON.stringify([{ owner: o, id: ID_JOURNAL, data }]),
        });
        if (!w.ok) return null;
        const out = await w.json().catch(() => null);
        if (!Array.isArray(out)) return null;
        if (out.length) return res;
        continue;
      }
      const cond = d && d.rev != null ? `data->>rev=eq.${encodeURIComponent(String(d.rev))}` : 'data->>rev=is.null';
      const w = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${ID_JOURNAL}&owner=eq.${encodeURIComponent(o)}&${cond}&select=id`, {
        method: 'PATCH', headers: { ...tete, Prefer: 'return=representation' }, body: JSON.stringify({ data }),
      });
      if (!w.ok) return null;
      const out = await w.json().catch(() => null);
      if (!Array.isArray(out)) return null;
      if (out.length) return res;
    } catch (_) { return null; }
  }
  return null;
}
// Range une notification. Rend `{ seq, entrees }` ou `null` (pas su : rien rangé).
export async function rangerNotif({ cat, titre, texte, url, etat, genre = null }) {
  const r = await modifierJournal((d) => ajouterEntree(d, { cat, titre, texte, url, etat, genre }));
  return r ? { seq: r.seq, entrees: r.journal.entrees } : null;
}
// (11 nov.) Range ET décide (idempotence, fenêtre), en une écriture.
// Rend `{ doublon: true }`, `{ seq, entrees, etat, groupe }`, ou `null` (pas su).
export async function rangerNotifGroupe(e, opts = {}) {
  let doublon = false;
  const r = await modifierJournal((d) => {
    const x = deciderEntree(d, e, { ...opts, maintenant: opts.maintenant || Date.now() });
    if (x.doublon) { doublon = true; return undefined; }
    return x;
  });
  if (doublon) return { doublon: true };
  return r ? { seq: r.seq, entrees: r.journal.entrees, etat: r.etat, groupe: r.groupe || [] } : null;
}
// (11 nov.) Vide la fenêtre échue (rien d'échu ⇒ `{ groupe: [] }` ; `null` pas su).
export async function vidangerAttente({ maintenant = Date.now(), etatPour = null } = {}) {
  let rien = false;
  const r = await modifierJournal((d) => { const x = vidangerEntrees(d, { maintenant, etatPour }); if (!x) { rien = true; return undefined; } return x; });
  if (rien) return { groupe: [], rien: true };
  return r ? { groupe: r.groupe, entrees: r.journal.entrees } : null;
}
// Corrige l'état d'une entrée déjà rangée (l'envoi a échoué sur tous les appareils).
export async function corrigerEtat(seq, etat) {
  if (!Number.isSafeInteger(seq) || !ETATS.includes(etat)) return false;
  const r = await modifierJournal((d) => {
    if (!d || !Array.isArray(d.entrees)) return undefined;
    const i = d.entrees.findIndex((x) => x && x.seq === seq);
    if (i < 0 || d.entrees[i].etat === etat) return undefined;
    const entrees = d.entrees.slice(); entrees[i] = { ...entrees[i], etat };
    const { rev: _r, ...reste } = d;
    return { journal: { ...reste, entrees } };
  });
  return !!r;
}
