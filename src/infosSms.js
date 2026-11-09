// ════════════════════════════════════════════════════════════════════════════
//  LES INFORMATIONS REÇUES PAR SMS SANS IDENTITÉ (9 nov.) — la règle de l'écran.
//  Le serveur range dans `vrm_sms_infos` (api/_lib/sms-infos.js) :
//    · Vestiaire : « un article Gucci vendu, à expédier avant le lun. 9 nov. » ;
//    · Pickup : « un colis Vinted au relais X », avec son Pass (lien de retrait).
//  ⚠️ JAMAIS RATTACHÉES SEULES (§5) : une marque n'est pas une identité.
//    · `suggestionVente` ne propose « c'est cette vente ? » que si UNE SEULE vente
//      Vestiaire à envoyer porte cette marque (en tête de son titre) ; deux ⇒ rien ;
//    · la liaison n'existe que par SON clic (`vrm_sms_liens`, écrite par l'app) ;
//    · une limite dépassée sans preuve d'envoi ⇒ « à vérifier », jamais « annulée ».
// ════════════════════════════════════════════════════════════════════════════
const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Les ventes Vestiaire à envoyer ({ pid, titre }) dont le titre COMMENCE par la marque (mot entier).
export function ventesDeLaMarque(marque, ventes) {
  const m = norm(marque);
  if (!m) return [];
  return (Array.isArray(ventes) ? ventes : []).filter((v) => v && v.pid && (norm(v.titre) === m || norm(v.titre).startsWith(m + ' ')));
}
export function suggestionVente(info, ventes) {
  if (!info || info.source !== 'vestiaire') return null;
  const l = ventesDeLaMarque(info.marque, ventes);
  return l.length === 1 ? l[0] : null;
}

// Les lignes à montrer, la plus proche d'abord. `infos` : { cle: entrée } ; `liens` : { cle: pid } ;
// `aujourdhui` : 'AAAA-MM-JJ' (Paris). Une information Vestiaire liée par son clic à une vente qui
// n'est plus à envoyer (partie) sort de la liste ; une limite passée ⇒ `aVerifier`.
export function lignesInfosSms(infos, { liens = {}, ventes = [], aujourdhui = '', source = null } = {}) {
  const out = [];
  for (const [cle, e] of Object.entries(infos && typeof infos === 'object' ? infos : {})) {
    if (!e || (source && e.source !== source)) continue;
    if (e.source === 'vestiaire') {
      const lie = liens && liens[cle] ? String(liens[cle]) : '';
      const encore = !lie || (ventes || []).some((v) => v && String(v.pid) === lie);
      if (!encore) continue;
      out.push({ cle, source: 'vestiaire', marque: e.marque || '', jour: e.jour || '', lie, n: e.n || 1,
        aVerifier: !!(aujourdhui && e.jour && e.jour < aujourdhui), suggestion: lie ? null : suggestionVente(e, ventes) });
    } else if (e.source === 'pickup') {
      out.push({ cle, source: 'pickup', relais: e.relais || '', pass: /^https?:\/\/[a-z0-9.-]*pkup\.fr\//i.test(String(e.pass || '')) ? e.pass : '', plateforme: e.plateforme || '', derniere: e.derniere || '', n: e.n || 1 });
    }
  }
  return out.sort((a, b) => String(a.jour || a.derniere).localeCompare(String(b.jour || b.derniere)));
}
