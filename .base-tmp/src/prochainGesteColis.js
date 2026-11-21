// ════════════════════════════════════════════════════════════════════════════
//  LE PROCHAIN GESTE DE COLIS, EN UNE PHRASE (6 nov. 2026)
//  Julien : « on doit être beaucoup plus accompagné par l'app ». En tête de Colis,
//  UNE phrase dit quoi faire maintenant (« Maison de la Presse : 10 colis à retirer
//  — codes prêts », « 3 bordereaux à imprimer — à envoyer avant demain
//  10 h ») et UN bouton y mène. Aucune règle neuve : la phrase est fabriquée à
//  partir des MÊMES listes que les nombres de l'écran (§5, « la phrase qui
//  explique un chiffre vient de la même source que lui ») :
//    · retrait : les points de « À retirer » (`parPoint`, les colis COMPTÉS —
//      jamais un « à vérifier » ni un « peut-être en double ») ;
//    · envoi : les colis de « À envoyer » (`vrm_colis_aposter`) et les lignes du
//      lot « Tout imprimer » (`lignesLot`), chacune avec SA limite lue.
//  « Pas su » n'est pas « rien » : un total inconnu (null) ne fait jamais dire
//  « rien à faire » ; un total partiel le dit (« au moins »).
//  Pur : aucune lecture, aucun React. Testé par scripts/audit-colis-prochain.cjs.
// ════════════════════════════════════════════════════════════════════════════

const plur = (n, s, p) => `${n} ${n > 1 ? p : s}`;
const fini = (x) => typeof x === 'number' && Number.isFinite(x);

// « À imprimer » = les bordereaux reçus PAS ENCORE imprimés. (6 nov., mesuré sur sa
// base : la case disait 9 « à imprimer » quand 6 l'avaient été la veille — l'aperçu
// de « Tout imprimer » les décoche déjà, « déjà imprimé ».) Une ligne sans `imprime`
// lu compte comme à imprimer.
export function bordereauxAImprimer(lignes) {
  return (Array.isArray(lignes) ? lignes : []).filter((l) => l && !l.imprime);
}

// (6 nov., audit des chiffres) « À IMPRIMER » HORS DE COLIS, LA MÊME NOTION. Ma journée disait
// « 5 prêts à imprimer » quand Colis disait « 4 à imprimer » (mesuré sur sa base) : elle comptait
// les bordereaux PRÊTS (imprimés compris) et seulement ceux reçus par e-mail (les bordereaux captés
// par l'extension ne sont lus que par Colis), sans le dire « au moins ». La règle est celle de la
// case de Colis (`bordereauxAImprimer`) ; Colis la publie (`vrm_colis_prets.aImprimer`) et un autre
// écran la lit quand elle parle du MÊME lot (`total` = ses colis Vinted à envoyer) — sinon il dit
// « au moins » ce qu'il sait.
//   local : le nombre que l'écran sait compter lui-même (minorant) ; complet : il a TOUT lu ;
//   pub : la publication de Colis ; totalAPoster : ses colis Vinted à envoyer.
export function compteAImprimer({ local = 0, complet = false, pub = null, totalAPoster = null } = {}) {
  const n0 = fini(local) ? local : 0;
  if (complet) return { n: n0, exact: true };
  if (pub && fini(pub.aImprimer) && fini(pub.total) && pub.total === totalAPoster) return { n: Math.max(pub.aImprimer, n0), exact: true };
  return { n: n0, exact: false };
}

// Le geste d'aller chercher : la phrase d'un point.
function phrasePoint(p, { urgent = false } = {}) {
  const n = p.colis.length;
  const nCode = p.colis.filter((c) => c.code).length;
  const fin = nCode === n ? (n > 1 ? 'codes prêts' : 'code prêt')
    : nCode === 0 ? (n > 1 ? 'codes pas encore arrivés' : 'code pas encore arrivé')
      : `${plur(nCode, 'code prêt', 'codes prêts')}, ${n - nCode} à venir`;
  const quand = urgent ? (p.colis.some((c) => fini(c.jours) && c.jours <= 0) ? ' aujourd’hui' : ' d’ici demain') : '';
  // Le nom du point en tête (« Maison de la Presse : … ») : jamais un article deviné (« à la », « au »).
  return p.nom ? `${p.nom} : ${plur(n, 'colis', 'colis')} à retirer${quand} — ${fin}` : `${plur(n, 'colis', 'colis')} à retirer${quand} au point relais — ${fin}`;
}

// points : [{ cle, nom, colis: [{ code: bool, jours: number|null }] }] (colis COMPTÉS seulement)
function gesteRetrait(points, { urgentSeul = false } = {}) {
  const ps = (Array.isArray(points) ? points : []).map((p) => ({ ...p, colis: (p.colis || []).filter(Boolean) })).filter((p) => p.colis.length);
  if (!ps.length) return null;
  const urgents = ps.map((p) => ({ ...p, colis: p.colis.filter((c) => fini(c.jours) && c.jours <= 1) })).filter((p) => p.colis.length);
  if (urgents.length) {
    // Le point au colis le plus pressé, puis le plus chargé.
    const minJ = (p) => Math.min(...p.colis.map((c) => c.jours));
    urgents.sort((a, b) => minJ(a) - minJ(b) || b.colis.length - a.colis.length);
    const p = urgents[0];
    const autres = urgents.slice(1).reduce((s, q) => s + q.colis.length, 0);
    return { cle: 'retirer-urgent', onglet: 'retirer', point: p.cle || '', ambre: true, texte: phrasePoint(p, { urgent: true }),
      sous: autres ? `et ${plur(autres, 'autre colis pressé', 'autres colis pressés')} ailleurs` : '' };
  }
  if (urgentSeul) return null;
  const tri = [...ps].sort((a, b) => b.colis.length - a.colis.length || String(a.nom || '').localeCompare(String(b.nom || '')));
  const p = tri[0];
  const reste = tri.slice(1); const nReste = reste.reduce((s, q) => s + q.colis.length, 0);
  return { cle: 'retirer', onglet: 'retirer', point: p.cle || '', ambre: false, texte: phrasePoint(p),
    sous: nReste ? `et ${plur(nReste, 'colis', 'colis')} dans ${plur(reste.length, 'autre point', 'autres points')}` : '' };
}

// aImprimer : [{ jours, limite }] — `limite` est la phrase de limite de la ligne (déjà dite sur sa carte).
export function gesteEnvoi(envoi, { urgentSeul = false } = {}) {
  const e = envoi || {};
  const imp = (Array.isArray(e.aImprimer) ? e.aImprimer : []).filter(Boolean);
  const plusPresse = [...imp].sort((a, b) => (fini(a.jours) ? a.jours : 1e9) - (fini(b.jours) ? b.jours : 1e9))[0] || null;
  const presse = !!(plusPresse && fini(plusPresse.jours) && plusPresse.jours <= 1);
  if (imp.length && (presse || !urgentSeul)) {
    return { cle: presse ? 'imprimer-urgent' : 'imprimer', onglet: 'envoyer', action: 'imprimer', ambre: presse,
      texte: `${plur(imp.length, 'bordereau', 'bordereaux')} à imprimer${plusPresse && plusPresse.limite ? ` — ${plusPresse.limite}` : ''}`,
      sous: imp.length > 1 && plusPresse && plusPresse.limite ? 'le plus pressé d’abord' : '' };
  }
  if (urgentSeul) return null;
  const aDeposer = fini(e.aDeposer) ? e.aDeposer : 0;
  if (aDeposer > 0) return { cle: 'deposer', onglet: 'envoyer', action: 'tournee', ambre: false, texte: `${plur(aDeposer, 'colis imprimé', 'colis imprimés')} à déposer`, sous: 'la tournée te dit où, dans l’ordre' };
  const sans = fini(e.sansBordereau) ? e.sansBordereau : 0;
  if (sans > 0) return { cle: 'attente', onglet: 'envoyer', ambre: false, texte: `${plur(sans, 'vente attend', 'ventes attendent')} ${sans > 1 ? 'leur' : 'son'} bordereau`, sous: 'il arrive tout seul quand tu passes sur Vinted' };
  return null;
}

// onglet : l'onglet montré ('envoyer' · 'envoyes' · 'retirer').
// envoi : { total: number|null, partiel, aImprimer: [{ jours, limite }], aDeposer, sansBordereau }
// retrait : { total: number|null, partiel, points }
// Rend { cle, texte, sous, ambre, onglet, action?, point? } ou null (rien à dire : en cours, pas su).
export function prochainGesteColis({ onglet = 'envoyer', envoi = null, retrait = null } = {}) {
  const env = envoi || {}, ret = retrait || {};
  const nEnv = fini(env.total) ? env.total : null, nRet = fini(ret.total) ? ret.total : null;
  // 1. Ce qui ne peut pas attendre, quel que soit l'onglet : un retrait au dernier jour
  //    (le colis repart), puis un envoi pour aujourd'hui ou demain.
  const urgent = gesteRetrait(ret.points, { urgentSeul: true }) || gesteEnvoi(env, { urgentSeul: true });
  if (urgent) return urgent;
  // 2. L'onglet regardé d'abord, puis l'autre.
  const ici = onglet === 'retirer' ? gesteRetrait(ret.points) : gesteEnvoi(env);
  if (ici) return { ...ici, partiel: onglet === 'retirer' ? !!ret.partiel : !!env.partiel };
  const ailleurs = onglet === 'retirer' ? gesteEnvoi(env) : gesteRetrait(ret.points);
  if (ailleurs) return { ...ailleurs, partiel: ailleurs.onglet === 'retirer' ? !!ret.partiel : !!env.partiel };
  // 3. Rien à faire — seulement quand les DEUX nombres sont lus, complets, et nuls.
  if (nEnv === 0 && nRet === 0 && !env.partiel && !ret.partiel) return { cle: 'rien', ambre: false, texte: 'Rien à envoyer ni à retirer', sous: 'un colis vendu ou arrivé apparaît ici tout seul' };
  return null;
}
