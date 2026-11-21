// (14 nov., soir — Julien : « je n'ai plus les retraits d'achat, je ne comprends pas »)
// LE REPLI « À RETIRER » D'ACHATS : quand il est ouvert, quand il est fermé. Une règle pure, lue par
// `RepliRetirerAchats` (src/App.jsx) et exécutée par scripts/audit-repli-retirer.cjs.
//
// Mesuré sur sa base le 14 nov. : la règle des retraits (`pickupUnion`) comptait 3 colis à retirer, chacun
// avec son code (publication `vrm_colis_retirer`) ; la refonte d'Achats du même jour rangeait toute la
// section (points, codes, QR) dans un repli FERMÉ par défaut, et sur Achats · Vinted la ligne du repli
// était cachée quand il est fermé : il ne restait qu'un « 3 · À retirer » dans la bande de chiffres.
// §5 : un colis caché est un colis perdu. Donc :
//   · au moins un colis à retirer ⇒ OUVERT (en tête d'Achats, codes visibles) ;
//   · il peut le refermer, mais ce choix ne vaut que pour la liste de colis qu'il avait sous les yeux :
//     un colis de plus (ou un autre) ⇒ rouvert ; l'ancien « fermé » ('0', d'avant ce correctif) ne cache
//     jamais un colis à retirer ;
//   · il l'a ouvert lui-même ('1') ou il vient pour un retrait (Ma journée, notification) ⇒ ouvert ;
//   · rien à retirer ⇒ fermé (la liste des achats d'abord) ; les colis « à vérifier » restent nommés
//     sur la ligne (`nVerif`), jamais cachés.
// Publication pas encore lue (`total` absent) ⇒ rien n'est décidé sur un nombre inconnu : fermé, sauf
// choix ou demande (« pas su » ne vaut pas « rien à retirer », mais ne vaut pas non plus « ouvrir »).

const nombre = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

// L'identité de chaque colis publié (4e champ d'une ligne de `colis`, ex. « e:{n° de suivi} »), triée.
export function signatureColis(pub) {
  const L = pub && Array.isArray(pub.colis) ? pub.colis : [];
  const ids = L.map((x) => (Array.isArray(x) ? x[3] : (x && (x.id || x.cle))) || '').map(String).filter(Boolean).sort();
  const brut = ids.length ? ids.join('|') : `n${nombre(pub && pub.total) ?? ''}`;
  let h = 5381; for (let i = 0; i < brut.length; i++) h = ((h * 33) ^ brut.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function etatRepliRetirer(pub, { choix = null, demande = false } = {}) {
  const n = pub ? nombre(pub.total) : null;
  const nVerif = pub ? (nombre(pub.aVerifier) || 0) + (nombre(pub.enVerification) || 0) : 0;
  const presse = !!(pub && nombre(pub.urgents) > 0);
  const ferme = typeof choix === 'string' && choix.startsWith('f:') ? choix.slice(2) : null;
  let ouvert;
  if (demande || choix === '1') ouvert = true;
  else if (n != null && n > 0) ouvert = ferme !== signatureColis(pub);
  else ouvert = false;
  return { ouvert, n, nVerif, presse };
}

// Ce que retient un toucher sur la ligne : fermer une liste de colis la ferme POUR CETTE LISTE seulement.
export function choixApresBascule(pub, { ouvert }) {
  if (!ouvert) return '1';
  const n = pub ? nombre(pub.total) : null;
  return n != null && n > 0 ? 'f:' + signatureColis(pub) : '0';
}
