// ══════════════════════════════════════════════════════════════════════════════
//  LES INFOS À PARTAGER D'UNE PAIRE (14 nov., lot messages-achats-plus, n° 108)
//  docs/passation/2026-11-14-messages-achats-plus.md
// ══════════════════════════════════════════════════════════════════════════════
// Trois champs QU'IL remplit sur la fiche de la paire, faits pour être dits à un
// acheteur (à l'inverse de la note privée, src/notePaire.js, que lui seul voit) :
//   · `taille`  — la taille réelle, dans SES mots (« taille petit, prendre ½ au-dessus ») ;
//   · `defauts` — les défauts, dans ses mots (« petite tache semelle gauche ») ;
//   · `semelle` — la longueur de semelle intérieure, en cm (10 à 40, ½ mm près).
// Rattachés à la paire par son IDENTITÉ, avec les MÊMES clés que la note (§5) :
// `n:<cleNum>` (le N° de rangement) puis `a:<id d'annonce Vinted>` — jamais un titre.
// Un N° porté par deux paires présentes ⇒ aucune info montrée (elle pourrait
// décrire l'autre). Rien n'est deviné : un champ vide reste vide, et la réponse
// qui en aurait besoin n'est pas proposée (src/questionsFrequentes.js).
// Rangées dans `vrm_infos_paires` (ligne `main`, synchronisée, fusionnée sous-clé
// par sous-clé comme `vrm_notes_paires`). Un toucher les INSÈRE dans le champ de
// réponse ; RIEN ne part sans son clic « Envoyer ».
// Module PUR : exécuté par scripts/audit-messages-achats-plus.cjs.
// ══════════════════════════════════════════════════════════════════════════════
import { clesPaire, cleEcriture, cleNumNote } from './notePaire.js';

export const CLE_INFOS_PAIRES = 'vrm_infos_paires';
export const INFO_MAX = 160;
export const CHAMPS_INFOS = ['taille', 'defauts', 'semelle'];

const ligne = (t) => Array.from(String(t == null ? '' : t).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, INFO_MAX).join('').trim();
// « 28,5 » · « 28.5 cm » · 28.5 ⇒ 28.5 ; hors 10–40 cm ou illisible ⇒ null.
export function semelleCm(v) {
  if (v == null || v === '') return null;
  const s = typeof v === 'number' ? String(v) : String(v).trim().toLowerCase().replace(/\s*cm$/, '').replace(',', '.');
  if (!/^\d{2}(\.\d{1,2})?$/.test(s)) return null;
  const n = Math.round(Number(s) * 10) / 10;
  return n >= 10 && n <= 40 ? n : null;
}
// Ce qui se garde d'une saisie : seulement les champs lisibles. Rien ⇒ null.
export function infosNettes(x) {
  const o = x && typeof x === 'object' ? x : {};
  const r = {};
  const t = ligne(o.taille); if (t) r.taille = t;
  const d = ligne(o.defauts); if (d) r.defauts = d;
  const s = semelleCm(o.semelle); if (s != null) r.semelle = s;
  return Object.keys(r).length ? r : null;
}
// La carte telle qu'elle se garde : seules les clés n:/a: et des infos valides.
export function infosPropres(v) {
  const out = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [k, x] of Object.entries(v)) {
    if (!/^(n:[0-9A-Z]{1,12}|a:\d{3,})$/.test(k)) continue;
    const i = infosNettes(x); if (!i) continue;
    out[k] = { ...i, at: x && typeof x.at === 'string' ? x.at : '' };
  }
  return out;
}
// Les infos d'une paire : { taille?, defauts?, semelle?, cle } · { cachee: true } · null.
export function infosDe(carte, paire, { cleNum = cleNumNote, ambigu = null } = {}) {
  if (!carte || typeof carte !== 'object') return null;
  const cles = clesPaire(paire, cleNum);
  if (!cles.length) return null;
  const n = cles[0].startsWith('n:') ? cles[0].slice(2) : '';
  if (n && typeof ambigu === 'function' && ambigu(n)) return infosNettes(carte['n:' + n]) ? { cachee: true } : null;
  for (const k of cles) { const i = infosNettes(carte[k]); if (i) return { ...i, cle: k }; }
  return null;
}
// Les opérations pour ÉCRIRE ces infos (tout vide = effacer), au format des gestes
// annulables (src/gesteAnnulable.js) : { k, type: 'cle', id, apres, avant }.
export function opsInfos(carte, paire, saisie, { cleNum = cleNumNote, maintenant = new Date().toISOString() } = {}) {
  const cur = carte && typeof carte === 'object' ? carte : {};
  const cle = cleEcriture(paire, cleNum);
  if (!cle) return [];
  const i = infosNettes(saisie);
  const avant = cur[cle];
  const ops = [];
  const pareil = (a, b) => JSON.stringify(infosNettes(a)) === JSON.stringify(b);
  if (i) { if (!pareil(avant, i)) ops.push({ k: CLE_INFOS_PAIRES, type: 'cle', id: cle, apres: { ...i, at: maintenant }, avant }); }
  else if (avant !== undefined) ops.push({ k: CLE_INFOS_PAIRES, type: 'cle', id: cle, apres: undefined, avant });
  if (cle.startsWith('n:')) for (const k of clesPaire(paire, cleNum).filter((x) => x.startsWith('a:'))) {
    if (cur[k] !== undefined) ops.push({ k: CLE_INFOS_PAIRES, type: 'cle', id: k, apres: undefined, avant: cur[k] });
  }
  return ops;
}

// ── LES PHRASES INSÉRÉES (dans la langue du MESSAGE, sinon celle de l'app) ──────
// Ce sont des mots ENVOYÉS à un acheteur, pas l'interface : ils suivent la langue
// de l'acheteur. Le contenu (ses mots) n'est jamais traduit.
const PHRASES = {
  fr: { taille: 'Taille réelle : {v}.', defauts: 'Défauts : {v}.', semelle: 'Longueur de semelle : {v} cm.', tailleVinted: 'Taille {v}.' },
  en: { taille: 'True fit: {v}.', defauts: 'Flaws: {v}.', semelle: 'Insole length: {v} cm.', tailleVinted: 'Size {v}.' },
  es: { taille: 'Talla real: {v}.', defauts: 'Defectos: {v}.', semelle: 'Largo de plantilla: {v} cm.', tailleVinted: 'Talla {v}.' },
  it: { taille: 'Vestibilità: {v}.', defauts: 'Difetti: {v}.', semelle: 'Lunghezza soletta: {v} cm.', tailleVinted: 'Taglia {v}.' },
  de: { taille: 'Passform: {v}.', defauts: 'Mängel: {v}.', semelle: 'Innensohle: {v} cm.', tailleVinted: 'Größe {v}.' },
};
export const cmTexte = (n, langue = 'fr') => (langue === 'en' ? String(n) : String(n).replace('.', ','));
export function phraseInfo(champ, valeur, langue = 'fr') {
  const p = PHRASES[langue] || PHRASES.fr;
  if (valeur == null || valeur === '' || !p[champ]) return '';
  const v = champ === 'semelle' ? (semelleCm(valeur) == null ? '' : cmTexte(semelleCm(valeur), langue)) : ligne(valeur);
  return v ? p[champ].replace('{v}', v) : '';
}
// Les « morceaux » prêts à insérer, dans l'ordre de la fiche : [{ champ, texte }].
export function morceauxInfos(infos, langue = 'fr') {
  if (!infos || infos.cachee) return [];
  return CHAMPS_INFOS.map((c) => ({ champ: c, texte: phraseInfo(c, infos[c], langue) })).filter((x) => x.texte);
}
// Insérer dans le champ de réponse : vide ⇒ la phrase ; sinon ajoutée après un espace
// (jamais deux fois la même phrase). Rend le nouveau texte (2 000 signes au plus).
export function insererDansReponse(actuel, morceau) {
  const a = String(actuel == null ? '' : actuel), m = String(morceau == null ? '' : morceau).trim();
  if (!m) return a.slice(0, 2000);
  if (a.includes(m)) return a.slice(0, 2000);
  const base = a.replace(/\s+$/, '');
  return (base ? base + ' ' + m : m).slice(0, 2000);
}
