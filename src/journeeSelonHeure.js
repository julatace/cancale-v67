// ── MA JOURNÉE CHANGE SELON L'HEURE (14 nov., lot 117) ─────────────────────────
// Julien : « Ma journée change selon l'heure : les colis le matin, le bilan le soir. »
// Une règle PURE (aucun React, aucun import) : l'écran (Ma journée, refaite par
// `claude/refonte-listes`) n'a qu'à faire passer l'ordre de ses cartes par
// `ordreSelonHeure` — c'est le seul point d'entrée.
//   · matin (5 h – 12 h, heure de Paris) : colis à envoyer, puis à retirer, en tête
//     de « À faire » ; en haut, la phrase des colis avant les 7 derniers jours ;
//   · journée (12 h – 18 h) : l'ordre d'origine, inchangé ;
//   · soir (18 h – 5 h) : en haut, les 7 derniers jours (le bilan) d'abord ; dans
//     « À faire », messages, favoris, prix et republier avant le reste.
// ⚠️ SON ordre gagne toujours : s'il a rangé ses cartes (« Modifier ma journée »,
//    `ordre` non vide), rien ne bouge. ⚠️ Une carte FIXE garde sa place. ⚠️ Un colis
//    PRESSÉ reste en tête quoi qu'il arrive : Ma journée pose les cartes forcées
//    (urgentes) avant les autres — cette règle ne touche que l'ordre des autres.
// ⚠️ Rien n'est caché, rien n'est ajouté : la même liste, dans un autre ordre.
export const MOMENTS = ['matin', 'journee', 'soir'];
export const FIXES_JOURNEE = ['chiffres', 'trancher'];
export const PRIORITES_HEURE = {
  matin: { tete: ['phrase', 'prochain'], afaire: ['envoyer', 'retirer'] },
  journee: { tete: [], afaire: [] },
  soir: { tete: ['frise'], afaire: ['messages', 'favoris', 'prix', 'republier'] },
};

// L'heure de Paris (0–23) d'un instant ; null si on ne sait pas la lire.
export function heureParis(maintenant = Date.now()) {
  try {
    const h = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(new Date(maintenant));
    const n = Number(String(h).replace(/\D/g, ''));
    return Number.isInteger(n) && n >= 0 && n <= 23 ? n : null;
  } catch (_) { return null; }
}

// 'matin' · 'journee' · 'soir'. Heure pas sue ⇒ 'journee' (l'ordre d'origine).
export function momentDuJour(maintenant = Date.now()) {
  const h = heureParis(maintenant);
  if (h == null) return 'journee';
  if (h >= 5 && h < 12) return 'matin';
  if (h >= 12 && h < 18) return 'journee';
  return 'soir';
}

// `ordre` : l'ordre effectif de la zone (`ordreJournee`), cartes fixes comprises.
// `sienOrdre` : il a rangé ses cartes lui-même ⇒ on ne touche à rien.
export function ordreSelonHeure(ordre, zone, { moment = 'journee', sienOrdre = false, fixes = FIXES_JOURNEE } = {}) {
  const liste = Array.isArray(ordre) ? ordre.slice() : [];
  if (sienOrdre) return liste;
  const prio = ((PRIORITES_HEURE[moment] || {})[zone]) || [];
  if (!prio.length) return liste;
  const estFixe = (id) => fixes.includes(id);
  const mobiles = liste.filter((id) => !estFixe(id));
  const devant = prio.filter((id) => mobiles.includes(id));
  const range = [...devant, ...mobiles.filter((id) => !devant.includes(id))];
  // Les fixes reprennent EXACTEMENT leur indice d'origine.
  liste.forEach((id, i) => { if (estFixe(id)) range.splice(Math.min(i, range.length), 0, id); });
  return range;
}
