// ── CACHER LES MONTANTS (4 nov.) ─────────────────────────────────────────────
// Julien : un œil dans la tête qui remplace TOUS les montants en € par « ••• »,
// partout à l'écran (cartes, listes, feuilles), mémorisé sur l'appareil. Les
// nombres d'articles restent. Les PDF et les exports ne changent pas (ils ne
// passent pas par l'écran).
//
// ⚠️ UN SEUL POINT, PAS ÉCRAN PAR ÉCRAN. Les montants sont écrits par une
//    dizaine de formatteurs (`fmt`, `fmtE`, `euros`, `toLocaleString`, « {n} € »
//    en JSX…) : en changer un en oublierait neuf. La règle ci-dessous lit le
//    TEXTE RENDU : un montant est un nombre suivi de « € » (ou « k€ »), y compris
//    quand React l'a coupé en deux nœuds (« 45 » puis « € »). La racine porte
//    `data-montants-caches="1"` et un observateur repasse sur ce qui change.
//    Ce que tape Julien (champs de saisie) n'est jamais touché.

export const CLE_MONTANTS_CACHES = 'vrm_montants_caches';
export const MASQUE = '•••';

// Un nombre : « 45 », « 45,90 », « 1 234,56 » (espace, insécable, fine
// insécable), « 1234.5 ». Les milliers ne se groupent que par 3 chiffres :
// « N°12 45 € » ne devient jamais « 12 45 ».
const NUM = String.raw`(?:\d{1,3}(?:[   ]\d{3})+|\d+)(?:[.,]\d+)?`;
const SIGNE = String.raw`(?:[+\-−]\s?)?`;
const EURO = String.raw`(?:[   ]?[kM])?[   ]?€`;
const RE_MONTANT = new RegExp(SIGNE + NUM + EURO, 'g');
const RE_EURO_DEVANT = new RegExp(String.raw`€[   ]?` + SIGNE + NUM, 'g');
const RE_FIN_NOMBRE = new RegExp(SIGNE + NUM + String.raw`(?:[   ]?[kM])?[   ]*$`);
const RE_DEBUT_EURO = /^[   ]*(?:[kM][   ]?)?€/;

// Un texte seul : chaque montant devient « ••• ».
export function masquerTexte(t) {
  const s = String(t == null ? '' : t);
  if (!s.includes('€')) return s;
  return s.replace(RE_MONTANT, MASQUE).replace(RE_EURO_DEVANT, MASQUE);
}

// Une SUITE de textes voisins (les nœuds de texte d'un même bloc, dans l'ordre) :
// un nombre à la fin d'un texte suivi d'un texte qui commence par « € » est un
// montant coupé en deux — le nombre devient « ••• », le « € » s'en va.
// `voisins[i]` (facultatif) : faux si le texte i+1 n'est pas dans le même bloc.
export function masquerSuite(textes, voisins) {
  const t = (Array.isArray(textes) ? textes : []).map((x) => String(x == null ? '' : x));
  const out = t.map(masquerTexte);
  for (let i = 0; i + 1 < t.length; i++) {
    if (voisins && voisins[i] === false) continue;
    if (!RE_DEBUT_EURO.test(t[i + 1])) continue;
    if (!RE_FIN_NOMBRE.test(out[i])) continue;
    out[i] = out[i].replace(RE_FIN_NOMBRE, MASQUE);
    out[i + 1] = out[i + 1].replace(RE_DEBUT_EURO, '');
  }
  return out;
}

// Reste-t-il un montant lisible dans ce texte ? (l'audit et le banc s'en servent)
export function montantVisible(t) {
  const s = String(t == null ? '' : t);
  RE_MONTANT.lastIndex = 0; RE_EURO_DEVANT.lastIndex = 0;
  const a = RE_MONTANT.test(s); RE_MONTANT.lastIndex = 0;
  const b = RE_EURO_DEVANT.test(s); RE_EURO_DEVANT.lastIndex = 0;
  return a || b;
}

export function lireMontantsCaches(brut) { return brut === '1' || brut === 'true' || brut === true; }

// ── LA COUCHE DOM ───────────────────────────────────────────────────────────
// Les nœuds jamais touchés : ce qu'on tape, le code, et ce qui s'en exclut.
const EXCLUS = new Set(['TEXTAREA', 'SCRIPT', 'STYLE', 'NOSCRIPT', 'INPUT', 'TITLE']);
const exclu = (n) => {
  for (let e = n.parentElement; e; e = e.parentElement) {
    if (EXCLUS.has(e.tagName)) return true;
    if (e.isContentEditable) return true;
    if (e.hasAttribute && e.hasAttribute('data-montant-visible')) return true;
  }
  return false;
};
const memeBloc = (a, b) => {
  const pa = a.parentNode, pb = b.parentNode;
  if (!pa || !pb) return false;
  return pa === pb || pa.parentNode === pb || pa === pb.parentNode || (pa.parentNode && pa.parentNode === pb.parentNode);
};

// Pose le masque sur `racine` (document.body) tant qu'il est allumé ; rend une
// fonction qui l'enlève et rend à chaque texte sa valeur d'origine.
export function installerMasque(racine) {
  const doc = racine && racine.ownerDocument;
  if (!doc || typeof MutationObserver === 'undefined') return () => {};
  const origine = new Map();   // nœud → { o: texte d'origine, m: texte masqué posé }
  let arrete = false;
  // ⚠️ Repassé DANS le rappel de l'observateur (une micro-tâche, après le rendu de
  //    React et AVANT que l'image soit peinte) : jamais une image où le vrai
  //    montant apparaît avant d'être caché.
  const obs = new MutationObserver(() => passer());
  const brancher = () => obs.observe(racine, { subtree: true, childList: true, characterData: true });
  const passer = () => {
    if (arrete) return;
    obs.disconnect();
    try {
      const w = doc.createTreeWalker(racine, 4 /* NodeFilter.SHOW_TEXT */);
      const noeuds = []; const textes = [];
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (!n.nodeValue || exclu(n)) continue;
        const d = origine.get(n);
        // React a réécrit le nœud ⇒ sa nouvelle valeur est la vraie.
        const o = d && n.nodeValue === d.m ? d.o : n.nodeValue;
        noeuds.push(n); textes.push(o);
      }
      const voisins = noeuds.map((n, i) => i + 1 < noeuds.length && memeBloc(n, noeuds[i + 1]));
      const m = masquerSuite(textes, voisins);
      for (let i = 0; i < noeuds.length; i++) {
        const n = noeuds[i];
        if (m[i] !== textes[i]) { origine.set(n, { o: textes[i], m: m[i] }); if (n.nodeValue !== m[i]) n.nodeValue = m[i]; }
        else if (origine.has(n)) { if (n.nodeValue !== textes[i]) n.nodeValue = textes[i]; origine.delete(n); }
      }
      for (const n of origine.keys()) if (!n.isConnected) origine.delete(n);
    } finally { if (!arrete) brancher(); }
  };
  passer();
  return () => {
    arrete = true; obs.disconnect();
    for (const [n, d] of origine) if (n.isConnected && n.nodeValue === d.m) n.nodeValue = d.o;
    origine.clear();
  };
}
