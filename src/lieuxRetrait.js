// ════════════════════════════════════════════════════════════════════════════
//  LE LIEU D'UN COLIS À RETIRER DÉJÀ RANGÉ, RELU DANS LE TEXTE GARDÉ DE SON
//  E-MAIL (2 nov., 23 h).
//  Julien : « j'ai un colis arrivé à Cancale, je veux qu'il soit affiché même
//  s'il n'est pas dans la même ville ». Mesuré (lecture seule) : l'e-mail d'un
//  locker Mondial Relay écrit une ligne vide entre chaque ligne ; le serveur
//  avait rangé le seul nom (« LOCKER 24/7 <ENSEIGNE> »), sans rue, code postal
//  ni ville — le point n'allait jamais sur la carte. La règle du serveur est
//  corrigée (`lieuSousEnTete`, api/_lib/retrait-colis.js) ; ce module relit avec
//  la MÊME règle les lignes déjà rangées.
//  Par IDENTITÉ seulement : le n° de suivi écrit dans le résumé de l'e-mail
//  (`email_reception_{clé}` → `resume.s`) mène à SON texte (`email_texte_{clé}`).
//  Un seul lieu lu, qui COMMENCE par le lieu déjà rangé (le même point) ⇒ il le
//  complète ; deux lieux différents, rien de lu, une lecture ratée ⇒ la ligne
//  reste telle quelle (jamais un lieu deviné, jamais un colis écarté).
// ════════════════════════════════════════════════════════════════════════════
import { lieuSousEnTete, sansSuggestions, nouveauPointDansTexte } from '../api/_lib/retrait-colis.js';

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
// Un colis au point relais dont le lieu rangé n'a pas de code postal.
export const lieuIncomplet = (t) => !!t && t.status === 'available' && !!String(t.suivi || '').trim() && !/\b\d{5}\b/.test(String(t.lieu || ''));
// (12 nov.) Un colis REDIRIGÉ (« Votre colis a changé de plan », `relaisChange`, en route) dont le nouveau point
// n'a pas été lu à la réception : son point est relu dans le texte gardé de l'e-mail (`nouveauPointDansTexte`, la
// règle du serveur), par l'identité du n° de suivi. Rien de lu ⇒ rien de changé (l'écran dit « pas encore lu »).
export const pointChangeIncomplet = (t) => !!t && !!t.relaisChange && t.status === 'transit' && !!String(t.suivi || '').trim() && !/\b\d{5}\b/.test(String(t.lieu || ''));
const aRelire = (t) => lieuIncomplet(t) || pointChangeIncomplet(t);
export const MAX_RELUS = 40;
// (11 nov., retraits fiables) Une ligne rangée AVANT la règle des suggestions peut porter pour lieu un point
// d'une liste « Points de proximité » de SON e-mail (le même supermarché pour tous ses colis). Elle est relue
// aussi : le lieu rangé n'est remplacé que si son nom n'apparaît, dans le texte gardé de CET e-mail, QUE dans
// une liste de suggestions — et que la règle lit un autre point, seul, dans le même texte.
const disponibleAvecSuivi = (t) => !!t && t.status === 'available' && !!String(t.suivi || '').trim();
const nomRange = (t) => norm(String((t && t.lieu) || '').split(',')[0]);
export function lieuDeSuggestion(t, texte) {
  const n = nomRange(t); if (!n || n.length < 3 || !texte) return false;
  return norm(texte).includes(n) && !norm(sansSuggestions(texte)).includes(n);
}

// lire(query) → tableau de lignes, ou lève (lecture ratée ⇒ rien de changé).
export async function lieuxRelusDansTextes(lignes, lire) {
  if (!Array.isArray(lignes) || typeof lire !== 'function') return lignes;
  const cibles = [...lignes.filter(aRelire), ...lignes.filter((t) => disponibleAvecSuivi(t) && !lieuIncomplet(t))].slice(0, MAX_RELUS);
  if (!cibles.length) return lignes;
  try {
    const sus = [...new Set(cibles.map((t) => String(t.suivi).trim()))];
    const recs = await lire(`id=like.email_reception_*&data->resume->>s=in.(${sus.map((s) => `"${encodeURIComponent(s)}"`).join(',')})&select=id,s:data->resume->>s&limit=200`);
    if (!Array.isArray(recs) || !recs.length) return lignes;
    const parSuivi = new Map();
    for (const r of recs) {
      const m = /^email_reception_([0-9a-f]{16,64})$/.exec(String(r && r.id || ''));
      const s = String(r && r.s || '').trim();
      if (!m || !sus.includes(s)) continue;
      if (!parSuivi.has(s)) parSuivi.set(s, []);
      parSuivi.get(s).push(m[1]);
    }
    const cles = [...new Set([...parSuivi.values()].flat())];
    if (!cles.length) return lignes;
    const textes = await lire(`id=in.(${cles.map((c) => `email_texte_${c}`).join(',')})&select=id,texte:data->>texte&limit=${cles.length}`);
    if (!Array.isArray(textes)) return lignes;
    const texteDe = new Map(textes.map((x) => [String(x && x.id || '').replace(/^email_texte_/, ''), typeof (x && x.texte) === 'string' ? x.texte : '']));
    const lus = new Map(), nouveaux = new Map(); const suggeres = new Map();
    for (const [s, cl] of parSuivi) {
      const l = [...new Set(cl.map((c) => lieuSousEnTete(texteDe.get(c) || '')).filter((x) => x && /\b\d{5}\b/.test(x)))];
      if (l.length === 1) lus.set(s, l[0]);
      suggeres.set(s, cl.map((c) => texteDe.get(c) || ''));
      const n = [...new Set(cl.map((c) => nouveauPointDansTexte(texteDe.get(c) || '')).filter((x) => x && /\b\d{5}\b/.test(x)))];
      if (n.length === 1) nouveaux.set(s, n[0]);   // deux nouveaux points différents ⇒ on ne choisit pas
    }
    if (!lus.size && !nouveaux.size) return lignes;
    return lignes.map((t) => {
      if (pointChangeIncomplet(t)) { const n = nouveaux.get(String(t.suivi).trim()); return n ? { ...t, lieu: n, lieuLuDansTexte: true } : t; }
      if (!lieuIncomplet(t)) {
        if (!disponibleAvecSuivi(t)) return t;
        const su = String(t.suivi).trim(); const l = lus.get(su); const tx = suggeres.get(su) || [];
        if (!l || norm(l) === norm(t.lieu) || !tx.length || !tx.every((x) => lieuDeSuggestion(t, x))) return t;
        return { ...t, lieu: l, lieuLuDansTexte: true, lieuSuggestionEcarte: String(t.lieu || '') };
      }
      const l = lus.get(String(t.suivi).trim());
      if (!l) return t;
      if (t.lieu && !norm(l).startsWith(norm(t.lieu))) return t;   // un autre point : on ne choisit pas
      return { ...t, lieu: l, lieuLuDansTexte: true };
    });
  } catch (_) { return lignes; }
}
