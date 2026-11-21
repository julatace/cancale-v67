// ════════════════════════════════════════════════════════════════════════════
//  LA PHRASE DU JOUR (8 nov. 2026, « beauté ») — en tête de Ma journée
//  « Premier colis à envoyer avant 18 h, puis les retraits »
//
//  ⚠️ AUCUN NOMBRE N'EST RECALCULÉ ICI, ET AUCUN COMPTE N'EST REDIT. Les entrées
//  sont les cases que l'écran publie déjà (`T` de Ma journée : « À envoyer » =
//  `vrm_colis_aposter`, « À retirer » = `vrm_colis_retirer`, leur `presses` — la
//  règle de la limite d'envoi, api/_lib/limite-envoi.js). Les COMPTES sont écrits
//  juste dessous (la grande carte, les petites) : §7 « le même nombre ne s'écrit
//  jamais deux fois sur un écran » (banc journee-mieux, J) — la phrase dit donc
//  ce que les cartes ne disent pas : l'HEURE du plus pressé (lue dans l'e-mail du
//  bordereau, jamais devinée) et ce qui reste à faire, en mots.
//  « Pas su » ne vaut pas zéro : une case pas lue ne se dit pas, et si aucune
//  n'est lue la phrase se tait (`null` ⇒ la phrase fixe de l'écran revient).
//  « Aucun colis » seulement si TOUT ce qu'on dit est LU et à zéro.
//  L'heure de la journée ne change que le TON (« ce matin », « ce soir »).
//  Module pur : `scripts/audit-phrase-jour.cjs` l'exécute (--prouve).
// ════════════════════════════════════════════════════════════════════════════

// « 18:00 » → « 18 h », « 09:30 » → « 9 h 30 » (heure de Paris lue dans l'e-mail).
export function heureEnMots(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return '';
  const h = Number(m[1]), mn = Number(m[2]);
  if (!(h >= 0 && h < 24 && mn >= 0 && mn < 60)) return '';
  return mn ? `${h} h ${String(mn).padStart(2, '0')}` : `${h} h`;
}

const nb = (c) => (c && !c.pasSu && Number.isFinite(Number(c.n)) ? Number(c.n) : null);

// cases : { envoyer: { n, pasSu, presses: { n, nAuj, urgent, heure } }, retirer: { n, pasSu } }
// heure : l'heure locale (0–23), pour le ton seulement.
export function phraseDuJour(cases, heure) {
  const env = cases && cases.envoyer, ret = cases && cases.retirer;
  const nEnv = nb(env), nRet = nb(ret);
  if (nEnv == null && nRet == null) return null;
  const h = Number(heure);
  const tonJour = h >= 18 || h < 5 ? 'ce soir' : h < 12 ? 'ce matin' : 'aujourd’hui';
  if (nEnv > 0) {
    const p = env.presses;
    const aujourdhui = !!(p && Number(p.nAuj) > 0);
    const lim = p && !p.urgent && aujourdhui ? heureEnMots(p.heure) : '';
    const tete = lim ? `Premier colis à envoyer avant ${lim}` : aujourdhui ? 'Des colis à envoyer aujourd’hui' : 'Des colis à envoyer';
    return nRet > 0 ? `${tete}, puis les retraits` : tete;
  }
  if (nRet > 0) return 'Des colis t’attendent au point relais';
  if (nEnv === 0 && nRet === 0) return `Aucun colis ${tonJour}.`;
  return null;
}
