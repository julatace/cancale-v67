// ═══════════════════════════════════════════════════════════════════════════
// « NOUVEAUX FAVORIS » DANS MA JOURNÉE (11 nov., lot favoris-clair, ajout
// validé par Julien) : « 5 annonces ont de nouveaux favoris depuis hier ·
// Envoyer une offre » ⇒ ouvre Messages → Favoris avec ces annonces choisies ;
// rien ne part sans SON clic (récapitulatif puis « Envoyer »). La carte se
// range dans « Modifier ma journée » (id `favoris`, src/journeePerso.js).
// Règle PURE + un petit lecteur : les favoris lus par la MÊME lecture que
// l'écran (`lireFavorisVinted`), l'annonce par l'identifiant /items/<id> du
// lien (jamais le texte), « depuis hier » = les 24 dernières heures.
// Lecture ratée ⇒ null (« pas su ») : la carte ne s'affiche pas, rien n'est inventé.
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { lireFavorisVinted } from './favorisVinted.js';

export const CLE_PREPARE = 'vrm_favoris_prepare';
const JOUR = 86400000;
const itemDe = (l) => { const m = /\/items\/([1-9]\d{0,19})(?:[/?#]|$)/.exec(String(l?.lien || '')); return m ? m[1] : null; };

// lignes : favoris lus ; vendus : Set des n° d'annonces prouvées vendues.
// → { annonces, favoris } arrivés depuis `depuis` (annonces vendues écartées).
export function nouveauxFavoris(lignes, { maintenant = Date.now(), depuis = maintenant - JOUR, vendus = new Set() } = {}) {
  if (!Array.isArray(lignes)) return null;
  const items = new Set();
  let favoris = 0;
  for (const l of lignes) {
    const t = Date.parse(l?.date || '');
    const it = itemDe(l);
    if (!it || !Number.isFinite(t) || t < depuis || t > maintenant + 60000 || vendus.has(it)) continue;
    items.add(it); favoris++;
  }
  return { annonces: items.size, favoris };
}

// Le lecteur : un compte (celui que Messages ouvrirait), relu toutes les 30 min
// tant que Ma journée est à l'écran. undefined = on lit · null = pas su.
export function useNouveauxFavoris({ uid, owner, ownerActuel, base, headers, actif = true, vendus }) {
  const [res, setRes] = React.useState(undefined);
  React.useEffect(() => {
    if (!actif || !uid || !owner) { setRes(undefined); return undefined; }
    let mort = false;
    const lire = () => lireFavorisVinted({ uid, owner, ownerActuel, base, headers: headers() })
      .then((d) => { if (!mort) setRes(d && Array.isArray(d.lignes) ? d.lignes : null); })
      .catch(() => { if (!mort) setRes(null); });
    lire();
    const t = setInterval(lire, 30 * 60000);
    return () => { mort = true; clearInterval(t); };
  }, [uid, owner, actif]);
  return React.useMemo(() => (res === undefined ? undefined : res === null ? null : nouveauxFavoris(res, { vendus: vendus || new Set() })), [res, vendus]);
}

// Le geste de la carte : marquer l'envoi « préparé » (lu par FavorisVinted, 10 min).
export function preparerEnvoiFavoris(uid, stockage = (typeof sessionStorage !== 'undefined' ? sessionStorage : null)) {
  try { stockage && stockage.setItem(CLE_PREPARE, JSON.stringify({ uid: String(uid), at: Date.now() })); } catch (_) {}
}
