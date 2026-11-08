// ════════════════════════════════════════════════════════════════════════════
//  LA PHRASE DU JOUR (8 nov. 2026, « beauté ») — en tête de Ma journée
//  « 3 colis à envoyer aujourd’hui, le premier avant 18 h · 2 à retirer »
//
//  ⚠️ AUCUN NOMBRE N'EST RECALCULÉ ICI. Les entrées sont les cases que l'écran
//  publie déjà (`T` de Ma journée : « À envoyer » = `vrm_colis_aposter`, « À
//  retirer » = `vrm_colis_retirer`, leur `presses` — la règle de la limite
//  d'envoi, api/_lib/limite-envoi.js) ; la phrase les MET EN MOTS, c'est tout.
//  « Pas su » ne vaut pas zéro : une case pas lue ne se dit pas, et si aucune
//  n'est lue la phrase se tait (`null` ⇒ la phrase fixe de l'écran revient).
//  « Rien » ne se dit que si TOUT ce qu'on dit est LU et à zéro.
//  L'heure ne change que le TON (« ce matin », « ce soir ») — jamais un chiffre.
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
  const morceaux = [];
  if (nEnv > 0) {
    const p = env.presses;
    const nAuj = p && Number(p.nAuj) > 0 ? Number(p.nAuj) : 0;
    const h = p && !p.urgent ? heureEnMots(p.heure) : '';
    // Le nombre dit est TOUJOURS celui de la case (`nEnv`) ; l'heure est celle du plus pressé.
    if (nAuj > 0 && h) morceaux.push(nEnv === 1 ? `1 colis à envoyer avant ${h}` : nAuj >= nEnv ? `${nEnv} colis à envoyer aujourd’hui, le premier avant ${h}` : `${nEnv} colis à envoyer, le plus pressé avant ${h}`);
    else if (nAuj > 0) morceaux.push(nAuj >= nEnv ? `${nEnv} colis à envoyer aujourd’hui` : `${nEnv} colis à envoyer, ${nAuj} aujourd’hui`);
    else morceaux.push(`${nEnv} colis à envoyer`);
  }
  if (nRet > 0) morceaux.push(nEnv > 0 ? `${nRet} à retirer` : `${nRet} colis à retirer`);
  if (morceaux.length) return morceaux.join(' · ');
  // Plus rien : seulement si les DEUX cases sont lues (une case pas lue n'est pas « rien »).
  if (nEnv === 0 && nRet === 0) {
    const h = Number(heure);
    return h >= 18 || h < 5 ? 'Aucun colis ce soir.' : h < 12 ? 'Aucun colis ce matin.' : 'Aucun colis pour aujourd’hui.';
  }
  return null;
}
