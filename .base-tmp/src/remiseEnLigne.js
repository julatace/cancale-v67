// ── « JE L'AI REMISE EN LIGNE » : LE N° DE L'ANCIENNE ANNONCE (9 nov.) ──────────
// Julien : « l'application détecte quand on supprime un article ; mets aussi que je
// le remets en ligne, et suggère le numéro de l'ancien colis ».
//
// La suppression est déjà PROUVÉE par l'extension (`noterSuppression`, capacité
// `supprimees`, ligne `harvest_{uid}_supprimees` = { [id]: atISO }). Quand une
// NOUVELLE annonce du même compte apparaît après, VRM PROPOSE : « C'est la même
// paire que N°X ? ». Ce n'est qu'une proposition (§5) : rien n'est écrit sans SON
// clic, et le clic passe par le même chemin que le champ N° (`poserNumero`, ses
// garde-fous). JS pur, sans React : `scripts/audit-numero-etiquette.cjs` l'EXÉCUTE.
//
// LA FORCE de la proposition :
//   · 'forte'  : le MÊME fichier photo (identité, `photoK`) — l'ancienne photo
//                réutilisée. Une forte cache les simples (elle désigne LA paire) ;
//   · 'simple' : même marque, même taille, et un même modèle (ou un mot de modèle
//                commun) — une RESSEMBLANCE : l'écran dit « vérifie l'étiquette ».
//                Plusieurs anciennes ressemblent ⇒ au plus `max` choix, et
//                `plusieurs` le dit ; jamais une seule désignée au hasard.
//   Marque différente, taille différente, deux modèles différents, aucun mot de
//   modèle commun ⇒ rien.
//
// JAMAIS PROPOSÉ :
//   · un N° d'archive (« B… », 013 : `reprenable`) ;
//   · un N° qu'une paire PRÉSENTE porte encore (`portesPresents`) — ce serait deux
//     paires sous un numéro, le seul risque irréversible ;
//   · à une annonce dont le N° a été posé à la main (`manuel`) ou qui porte déjà ce N° ;
//   · à une annonce dont le N° est ÉCRIT dans le texte (`ecrit`, src/numeroEcrit.js) :
//     c'est une identité qu'il a écrite — si c'est l'ancien N°, la reprise se fait
//     sans question par la règle du N° écrit ; sinon son N° écrit fait foi ;
//   · une ancienne d'un AUTRE compte, supprimée il y a plus de `fenetreJours`, ou
//     une nouvelle mise en ligne plus d'un jour AVANT la suppression ;
//   · ce qu'il a déjà écarté (« Non, une autre paire » : `refus[nouvelle] = [anciennes]`).

import { tailleNorm, tailleDuTitre } from './suggestionsAchat.js';

const JOUR = 86400000;
const MARGE_MS = JOUR;           // il peut remettre en ligne juste AVANT de supprimer l'ancienne
const cleN = (v) => { let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };
const ms = (v) => {
  if (v == null || v === '') return NaN;
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v;
  const n = Date.parse(String(v)); return Number.isFinite(n) ? n : NaN;
};
const bas = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Les mots qui ne disent rien du modèle.
const VIDES = new Set(['taille', 'pointure', 'size', 'homme', 'femme', 'enfant', 'mixte', 'neuf', 'neuve', 'neuves', 'tres', 'bon', 'bonne', 'etat', 'paire', 'chaussures', 'chaussure', 'baskets', 'basket', 'sneakers', 'sneaker', 'avec', 'sans', 'pour', 'les', 'des', 'une', 'eur']);
const mots = (t, marque) => new Set(bas(t).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !/^\d+$/.test(w) && !VIDES.has(w) && w !== bas(marque)));
const tailleDe = (x) => (x && x.taille ? tailleNorm(x.taille) : '') || tailleDuTitre((x && x.titre) || '');

function ressemblance(n, s, { marqueDe, modeleDe }) {
  const ma = typeof marqueDe === 'function' ? bas(marqueDe(String(n.titre || ''))) : '';
  const mb = typeof marqueDe === 'function' ? bas(marqueDe(String(s.titre || ''))) : '';
  if (!ma || !mb || ma !== mb) return null;
  const ta = tailleDe(n), tb = tailleDe(s);
  if (!ta || !tb || ta !== tb) return null;
  const oa = typeof modeleDe === 'function' ? modeleDe(String(n.titre || '')) : null;
  const ob = typeof modeleDe === 'function' ? modeleDe(String(s.titre || '')) : null;
  if (oa && ob) return bas(oa) === bas(ob) ? 'simple' : null;
  const wa = mots(n.titre, ma), wb = mots(s.titre, mb);
  for (const w of wa) if (wb.has(w)) return 'simple';
  return null;
}

// nouvelles : [{ id, compte, titre, taille?, photoK?, createdTs?, numero?, manuel?, ecrit? }]
// supprimees : [{ id, compte, titre, taille?, photoK?, supprimeeAt, numero }]
// Rend [{ nouvelle, titre, options: [{ ancienne, numero, force, titre, supprimeeAt }],
//         plusieurs, concurrence }].
export function suggestionsRemiseEnLigne({ nouvelles, supprimees, portesPresents = [], refus = {}, reprenable = () => true,
  marqueDe = null, modeleDe = null, maintenant = Date.now(), fenetreJours = 30, max = 3 } = {}) {
  if (!Array.isArray(nouvelles) || !Array.isArray(supprimees) || !nouvelles.length || !supprimees.length) return [];
  const presents = new Set((portesPresents || []).map(cleN).filter(Boolean));
  const out = [];
  for (const n of nouvelles) {
    if (!n || n.id == null) continue;
    if (n.manuel) continue;
    if (cleN(n.ecrit)) continue;
    const ecartees = new Set(((refus && refus[String(n.id)]) || []).map(String));
    const cree = ms(n.createdTs);
    // Les N° portés par une paire présente — sauf le sien (il peut en changer).
    const portesPresents = new Set([...presents].filter((k) => k !== cleN(n.numero)));
    const options = [];
    for (const s of supprimees) {
      if (!s || s.id == null || String(s.id) === String(n.id)) continue;
      if (String(s.compte) !== String(n.compte)) continue;
      if (ecartees.has(String(s.id))) continue;
      const cle = cleN(s.numero);
      if (!cle) continue;
      if (!reprenable(cle)) continue;
      if (portesPresents.has(cle)) continue;
      if (cleN(n.numero) === cle) continue;
      const at = ms(s.supprimeeAt);
      if (!Number.isFinite(at) || maintenant - at > fenetreJours * JOUR) continue;
      if (Number.isFinite(cree) && Number.isFinite(at) && cree < at - MARGE_MS) continue;
      const force = n.photoK && s.photoK && String(n.photoK) === String(s.photoK) ? 'forte' : ressemblance(n, s, { marqueDe, modeleDe });
      if (!force) continue;
      options.push({ ancienne: String(s.id), numero: String(s.numero).trim(), force, titre: String(s.titre || ''), supprimeeAt: at });
    }
    if (!options.length) continue;
    const fortes = options.filter((o) => o.force === 'forte');
    const garde = (fortes.length ? fortes : options).sort((a, b) => b.supprimeeAt - a.supprimeeAt);
    out.push({ nouvelle: String(n.id), titre: String(n.titre || ''), options: garde.slice(0, max), plusieurs: garde.length > 1 });
  }
  // Une même ancienne proposée à deux nouvelles : chacune le dit (son clic choisit).
  const vues = new Map();
  for (const x of out) for (const o of x.options) vues.set(o.ancienne, (vues.get(o.ancienne) || 0) + 1);
  return out.map((x) => ({ ...x, concurrence: x.options.some((o) => vues.get(o.ancienne) > 1) }));
}

// La phrase d'une proposition, pour un non-développeur (§2.7).
export const PHRASE_FORCE = {
  forte: 'Même photo que l’ancienne annonce.',
  simple: 'Même marque, même taille : vérifie l’étiquette avant de dire oui.',
};
