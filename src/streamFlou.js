// ── LE MODE STREAM FLOUTE PARTOUT, PAS SEULEMENT LÀ OÙ ON A PENSÉ À L'ÉCRIRE ──
// (17 oct., Julien : « le mode stream ne marche pas très bien : les pseudos des
// comptes Vinted sur lesquels sont connectées les extensions ne sont pas
// floutés, et les données sensibles non plus »).
//
// Le 16 octobre, le flou ne touchait que les éléments marqués `.vrm-sensible` —
// une douzaine d'endroits. Mais un pseudo s'écrit dans des dizaines de phrases
// (« Actions possibles · julatace3535 », « Ils sont tous sur … », le panneau de
// l'extension, les listes de comptes, les alertes…) : une classe posée à la main
// ne couvre que ce qu'on a pensé à écrire (la leçon des raccords qui énumèrent).
//
// ⇒ En mode stream, un observateur relit le TEXTE affiché et floute tout élément
//    qui contient :
//      · un JETON connu — les pseudos de ses comptes (Vinted, eBay, Leboncoin),
//        leurs adresses, son adresse VRM, le nom et le SIRET de son entreprise,
//        le compte Vinted ouvert dans Chrome ;
//      · une adresse email, un numéro de téléphone français, un IBAN.
//    Il marque l'élément `data-stream-flou` (index.html le floute) ; il ne
//    change jamais le texte (un appui sur le bouton fonctionne toujours).
// ⚠️ Rien ne tourne hors mode stream : aucun coût pour l'usage normal.
// ⚠️ Les montants ne sont PAS floutés : le mode sert à filmer l'app en marche,
//    et un écran entièrement flou ne montre plus rien.

const _groupes = new Map();          // nom → [jetons]
let _re = null;
let _obs = null;
let _actif = false;
let _attente = 0;
let _ecouteSaisie = false;

const EMAIL = '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}';
const TEL = '(?:\\+33\\s?|0)[1-9](?:[\\s.-]?\\d{2}){4}';
const IBAN = 'FR\\d{2}(?:\\s?[A-Z0-9]{4}){5}\\s?[A-Z0-9]{1,3}';
const echap = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function recompose() {
  const jetons = new Set();
  for (const l of _groupes.values()) for (const j of l) {
    const t = String(j == null ? '' : j).trim();
    if (t.length >= 3) jetons.add(t);
  }
  // Les plus longs d'abord : « julatace35260 » avant « julatace3535 ».
  const parts = [...jetons].sort((a, b) => b.length - a.length).map(echap);
  parts.push(EMAIL, TEL, IBAN);
  try { _re = new RegExp(parts.join('|'), 'i'); } catch (_) { _re = new RegExp([EMAIL, TEL, IBAN].join('|'), 'i'); }
}

// Pure : ce texte contient-il quelque chose à flouter ? (exporté pour l'audit)
export function sensible(texte) {
  if (!_re) recompose();
  return !!(texte && _re.test(String(texte)));
}

export function jetonsStream(nom, liste) {
  const l = Array.isArray(liste) ? liste.filter(Boolean).map(String) : [];
  const avant = _groupes.get(nom);
  if (avant && avant.length === l.length && avant.every((x, i) => x === l[i])) return;
  _groupes.set(nom, l);
  recompose();
  if (_actif) planifier(document.body);
}

const NOTRE = 'data-stream-flou';
function marquer(el) { if (el && el.nodeType === 1 && !el.hasAttribute(NOTRE)) el.setAttribute(NOTRE, ''); }

function balayer(racine) {
  if (!racine || !_re) return;
  try {
    const w = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const v = n.nodeValue;
      if (v && v.length >= 3 && _re.test(v)) marquer(n.parentElement);
    }
    // Les champs : la VALEUR n'est pas un nœud de texte.
    const champs = racine.querySelectorAll ? racine.querySelectorAll('input, textarea') : [];
    for (const c of champs) { if (c.value && _re.test(c.value)) marquer(c); }
  } catch (_) {}
}

function planifier(racine) {
  if (_attente) return;
  _attente = requestAnimationFrame(() => { _attente = 0; balayer(racine || document.body); });
}

export function demarrerStream(on) {
  _actif = !!on;
  if (!_re) recompose();
  if (_actif) {
    if (!_obs && typeof MutationObserver !== 'undefined') {
      _obs = new MutationObserver(() => planifier(document.body));
      try { _obs.observe(document.body, { childList: true, subtree: true, characterData: true }); } catch (_) {}
    }
    if (!_ecouteSaisie) { _ecouteSaisie = true; document.addEventListener('input', () => { if (_actif) planifier(document.body); }, true); }
    planifier(document.body);
  } else {
    if (_obs) { _obs.disconnect(); _obs = null; }
    try { document.querySelectorAll('[' + NOTRE + ']').forEach((e) => e.removeAttribute(NOTRE)); } catch (_) {}
  }
}
