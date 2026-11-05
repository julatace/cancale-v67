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
//   { n: <dernier numéro>, entrees: [{ seq, at, famille, cat, titre, texte, url, etat }], rev }
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
export const ETATS = ['envoyee', 'calme', 'sans-appareil', 'serveur', 'echec'];

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
    etat: ETATS.includes(e.etat) ? e.etat : 'envoyee',
  };
  const garde = [entree, ...avant].filter((x) => !(Date.parse(x.at) < maintenant - DUREE_MS)).slice(0, MAX_ENTREES);
  return { journal: { n: seq, entrees: garde }, seq, entree };
}
// Combien d'entrées NON LUES de cette famille dans les dernières 24 h (celle qui
// part comprise) — pour la notification regroupée. `lu` absent ⇒ on ne compte
// rien de plus que celle-ci (« pas su » n'invente pas un « +3 »).
export function nonLuesDeFamille(entrees, famille, lu, maintenant = Date.now()) {
  if (!lu || typeof lu !== 'object') return 1;
  const jusqua = Number.isSafeInteger(lu.luJusqua) ? lu.luJusqua : 0;
  const lus = new Set(Array.isArray(lu.lus) ? lu.lus.filter(Number.isSafeInteger) : []);
  return Math.max(1, (entrees || []).filter((x) => x && x.famille === famille && x.seq > jusqua && !lus.has(x.seq) && Date.parse(x.at) >= maintenant - 86400e3).length);
}

// ── LECTURE / ÉCRITURE, AU NOM DU VENDEUR DE LA REQUÊTE ────────────────────
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
export async function rangerNotif({ cat, titre, texte, url, etat }) {
  const r = await modifierJournal((d) => ajouterEntree(d, { cat, titre, texte, url, etat }));
  return r ? { seq: r.seq, entrees: r.journal.entrees } : null;
}
// Corrige l'état d'une entrée déjà rangée (l'envoi a échoué sur tous les appareils).
export async function corrigerEtat(seq, etat) {
  if (!Number.isSafeInteger(seq) || !ETATS.includes(etat)) return false;
  const r = await modifierJournal((d) => {
    if (!d || !Array.isArray(d.entrees)) return undefined;
    const i = d.entrees.findIndex((x) => x && x.seq === seq);
    if (i < 0 || d.entrees[i].etat === etat) return undefined;
    const entrees = d.entrees.slice(); entrees[i] = { ...entrees[i], etat };
    return { journal: { n: d.n, entrees } };
  });
  return !!r;
}
