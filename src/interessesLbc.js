// ════════════════════════════════════════════════════════════════════════════
//  LEBONCOIN : LES INTÉRESSÉS D'UNE ANNONCE (20 nov., lot lbc-vc-interesses, extension 5.410)
//
//  Julien (20 nov.) : « on reçoit quand une personne est intéressée sur Leboncoin ». MESURÉ (lecture seule,
//  sa base, 20 nov.) : aucun e-mail « intéressé » n'arrive dans VRM ; Leboncoin ne dit jamais QUI a mis une
//  annonce en favori (des nombres seulement) ; la personne qui ÉCRIT est identifiée par sa conversation, et la
//  conversation dit l'annonce (`conversationContext.itemId`, lue par l'extension 5.410, `annonce` du fil).
//  « Intéressé » = une conversation de CE compte sur CETTE annonce où la personne a écrit au moins une fois.
//  Jamais un nom. L'app MONTRE ; « Leur écrire » est un geste du panneau de l'extension sur leboncoin.fr
//  (`ecrireInteressesLbc`, décision du 20 nov. : les actions sur les plateformes passent par le panneau).
//
//  Le bloc ci-dessous est le MÊME que dans vinted-sync-extension/background.js (audit-lbc-vc-interesses).
// ════════════════════════════════════════════════════════════════════════════
// <interesses-lbc-regle>
const INTERESSES_PAR_TOUCHER = 10;
const INTERESSES_ECART_S = [40, 90];       // l'écart entre deux messages : le rythme des favoris (19 nov., « on garde toujours le temps aléatoire »)
const INTERESSES_TEXTES_MAX = 5;
// Les intéressés d'une annonce (ou de toutes) d'UN compte : une ligne par conversation où la personne a écrit, la
// plus récente d'abord. `fils` : [{ conv, compte, annonce, deLuiN, premierDeLuiAt, dernierAt, dernierDeMoi }].
function interessesLbcDe(fils, { compte = '', annonce = '' } = {}) {
  const out = [];
  for (const f of Array.isArray(fils) ? fils : []) {
    if (!f || typeof f !== 'object') continue;
    const conv = String(f.conv == null ? '' : f.conv);
    const a = String(f.annonce == null ? '' : f.annonce);
    if (!/^[\w-]{3,64}$/.test(conv) || !/^\d{6,12}$/.test(a)) continue;          // l'annonce pas lue : pas un intéressé de CETTE annonce
    if (compte && String(f.compte || '') !== String(compte)) continue;           // jamais un autre compte
    if (annonce && a !== String(annonce)) continue;
    const n = Number(f.deLuiN);
    if (!(Number.isInteger(n) && n >= 1)) continue;                              // la personne n'a jamais écrit : pas un intéressé
    const dm = f.dernierDeMoi === true || f.dernierDeMoi === 'true' ? true : f.dernierDeMoi === false || f.dernierDeMoi === 'false' ? false : null;
    out.push({ conv, annonce: a, compte: String(f.compte || ''), messagesDeLui: n, depuis: String(f.premierDeLuiAt || ''), dernierAt: String(f.dernierAt || ''), attendTaReponse: dm === false, canal: 'message' });
  }
  return out.sort((x, y) => (y.dernierAt || '').localeCompare(x.dernierAt || ''));
}
// Les textes d'une série : 1 à 5, non vides, 2 000 caractères au plus — sinon null (rien ne part).
function textesInteresses(textes) {
  const l = (Array.isArray(textes) ? textes : []).map((t) => (typeof t === 'string' ? t.replace(/\r\n?/g, '\n').trim() : '')).filter(Boolean);
  if (!l.length || l.length > INTERESSES_TEXTES_MAX || l.some((t) => t.length > 2000)) return null;
  return l;
}
// </interesses-lbc-regle>

export { INTERESSES_PAR_TOUCHER, INTERESSES_ECART_S, INTERESSES_TEXTES_MAX, interessesLbcDe, textesInteresses };

// Les intéressés regroupés par annonce : { [annonce]: { n, attendent, dernierAt } }.
export function interessesParAnnonce(fils, compte = '') {
  const out = {};
  for (const x of interessesLbcDe(fils, { compte })) {
    const e = out[x.annonce] = out[x.annonce] || { n: 0, attendent: 0, dernierAt: '' };
    e.n++; if (x.attendTaReponse) e.attendent++; if (x.dernierAt > e.dernierAt) e.dernierAt = x.dernierAt;
  }
  return out;
}
