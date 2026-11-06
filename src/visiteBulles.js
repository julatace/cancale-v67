// ── LA VISITE EN BULLES (2 nov., Julien : « une démo visuelle un peu comme
// Vinteer : des petits nuages qui montrent les fonctionnalités quand tu crées
// ton compte, mais il ne doit pas y avoir des écritures partout à côté des
// onglets, c'est vraiment dégueulasse »).
//
// Ce module ne porte que la RÈGLE, sans React : quelles bulles, dans quel ordre,
// sur quel élément réel, et la clé qui dit « vue ». Le composant
// (src/VisiteBulles.jsx) et le banc (scripts/bancs/demo-bulles.cjs) la lisent.
//
//   · UNE bulle à la fois, pointée sur l'élément RÉEL de la navigation (la barre
//     du bas au téléphone, la colonne sur ordinateur) ; rien n'est écrit en
//     permanence à côté des onglets : la bulle part, l'onglet reste nu.
//   · Une phrase de 12 mots au plus, qui dit ce qu'on y FAIT.
//   · Un élément absent ou caché (pas de compte sur ce site, écran pas monté) ⇒
//     sa bulle est SAUTÉE, jamais une bulle qui pointe dans le vide.
//   · « Vue » se range dans la ligne `main` (clé synchronisée `vrm_visite_vue`) :
//     elle ne revient ni après un rechargement ni sur un autre appareil.

export const CLE_VISITE = 'vrm_visite_vue';

// `cible` : sélecteur de l'élément réel ; `ou` : 'telephone' | 'ordinateur' | les deux.
// (6 nov., Julien : « quelque chose de plus beau, simple et visuel ») QUATRE bulles :
// la navigation entière (une fois, pas onglet par onglet), puis les deux étapes du
// guide de démarrage qui comptent le plus (l'extension, la boîte e-mail), puis
// « Découvrir avec des exemples ». Ce que la visite ne trouve pas est sauté.
export const ETAPES_VISITE = [
  { cle: 'navigation', cible: '.vrm-mobile-nav', titre: 'Tout est en bas', texte: 'Ta journée, tes annonces, tes ventes et tes colis, d’un toucher.', ou: 'telephone' },
  { cle: 'navigation', cible: '.vrm-atelier-rail', titre: 'Tout est à gauche', texte: 'Ta journée, tes annonces, tes ventes et tes colis, d’un clic.', ou: 'ordinateur' },
  { cle: 'extension', cible: '[data-guide-demarrage] [data-guide-etape="extension"]', titre: 'D’abord, l’extension', texte: 'Elle lit tes ventes et tes colis sur Vinted, pour toi.' },
  { cle: 'emails', cible: '[data-guide-demarrage] [data-guide-etape="emails"]', titre: 'Puis ta boîte e-mail', texte: 'Bordereaux et codes de retrait arrivent alors tout seuls ici.' },
  { cle: 'exemple', cible: '[data-exemple-entrer]', titre: 'Envie de voir avant ?', texte: 'VRM rempli de données inventées : rien n’est enregistré.' },
];

export const MOTS_MAX = 12;
export const nombreDeMots = (t) => String(t || '').trim().split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length;

// Les étapes pour CET appareil (téléphone : barre du bas ; ordinateur : colonne).
export const etapesPour = (telephone) => ETAPES_VISITE.filter((e) => !e.ou || e.ou === (telephone ? 'telephone' : 'ordinateur'));

// L'élément visible qui porte une étape, ou `null` (⇒ l'étape est sautée).
// Visible = dans le document, une boîte non nulle, pas caché, pas `inert`.
export function elementVisible(sel, doc = typeof document !== 'undefined' ? document : null) {
  if (!doc) return null;
  let liste = [];
  try { liste = [...doc.querySelectorAll(sel)]; } catch (_) { return null; }
  for (const el of liste) {
    if (!el.getClientRects || !el.getClientRects().length) continue;
    if (el.closest('[hidden], [inert], [aria-hidden="true"]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const vue = doc.defaultView;
    const cs = vue ? vue.getComputedStyle(el) : null;
    if (cs && (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0)) continue;
    if (vue && (r.bottom < 0 || r.right < 0 || r.top > vue.innerHeight || r.left > vue.innerWidth)) {
      // Hors de la fenêtre (colonne qui défile) : on le ramène, puis on remesure.
      try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) {}
      const r2 = el.getBoundingClientRect();
      if (r2.bottom < 0 || r2.top > vue.innerHeight) continue;
    }
    return el;
  }
  return null;
}

// La prochaine étape montrable à partir de `i` (incluse) dans `sens` (+1 / -1) ;
// -1 si aucune. Une étape sans élément visible est sautée.
export function etapeMontrable(etapes, i, sens = 1, trouver = elementVisible) {
  for (let k = i; k >= 0 && k < etapes.length; k += sens) if (trouver(etapes[k].cible)) return k;
  return -1;
}

// Où poser la bulle autour de la cible (rectangle), dans une fenêtre W × H,
// avec 16 px de marge : à droite d'une cible collée au bord gauche (colonne de
// l'ordinateur), au-dessus d'une cible du bas (barre du téléphone), sinon dessous.
// Rend { cote, x, y, flecheX, flecheY } : (x, y) le coin haut-gauche de la bulle.
export function placerBulle(r, W, H, bw, bh, marge = 16, ecart = 14) {
  const borne = (v, a, b) => Math.max(a, Math.min(b, v));
  let cote;
  if (r.right + ecart + bw + marge <= W && r.left < W * 0.35) cote = 'droite';
  else if (r.top - ecart - bh >= marge && (r.top + r.bottom) / 2 > H / 2) cote = 'dessus';
  else cote = 'dessous';
  let x, y;
  if (cote === 'droite') { x = r.right + ecart; y = borne((r.top + r.bottom) / 2 - bh / 2, marge, H - bh - marge); }
  else { x = borne((r.left + r.right) / 2 - bw / 2, marge, W - bw - marge); y = cote === 'dessus' ? r.top - ecart - bh : borne(r.bottom + ecart, marge, H - bh - marge); }
  const flecheX = cote === 'droite' ? 0 : borne((r.left + r.right) / 2 - x, 18, bw - 18);
  const flecheY = cote === 'droite' ? borne((r.top + r.bottom) / 2 - y, 18, bh - 18) : 0;
  return { cote, x: Math.round(x), y: Math.round(y), flecheX: Math.round(flecheX), flecheY: Math.round(flecheY) };
}
