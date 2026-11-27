// ══════════════════════════════════════════════════════════════════════════════
// « VESTIAIRE PAS LU DEPUIS 5 JOURS » — UNE LIGNE, UNE FOIS (27 nov., Julien : « Vas-y fais tout »)
// ══════════════════════════════════════════════════════════════════════════════
// Sur Aujourd'hui, une ligne claire quand un site / un compte n'a pas été relu depuis trop longtemps, et le geste
// (l'ouvrir dans le Chrome de l'extension). AUCUNE règle neuve de fraîcheur : la ligne de fraîcheur de la coque
// (src/fraicheur.js `fraicheurUnique`, propriétaire de « quels comptes ne sont pas relus », §5) PUBLIE son résultat
// (`publierFraicheur`) ; on n'en garde que les comptes NOMMÉS (pas relu depuis plus de 24 h — `A_RELIRE_MS`, la règle
// « en ligne » : au-delà, une lecture est « à confirmer » — ou qui n'arrivent plus alors que l'extension travaille), avec
// la date de LEUR dernière lecture (`harvestTs` côté capture : `data.capturedAt`, jamais `updated_at`).
// §2.10 « pas de carte de reproche récurrente » : « Compris » la range POUR CE COMPTE ET CETTE LECTURE (la date lue) ;
// elle ne revient que si la situation change (le compte est relu puis vieillit à nouveau, ou un autre compte vieillit).
// PUR : aucune lecture, aucune écriture, aucune horloge (l'écran passe `maintenant` et ce qui est rangé).
export const JOUR_MS = 864e5;

// `f` : la publication de la ligne de fraîcheur (undefined = pas encore publiée ⇒ rien n'est affirmé).
// Rend la liste des comptes en retard, le plus ancien d'abord :
//   [{ cle: 'vinted:123', plateforme, id, nom, depuisMs, jours }] — `jours` ≥ 1 (sinon : pas « trop longtemps »).
export function lecturesAnciennes(f, maintenant) {
  if (!f || f.etat !== 'retard' || !Array.isArray(f.retards) || !Number.isFinite(maintenant)) return [];
  const parCompte = new Map();
  for (const r of f.retards) {
    if (!r || (r.source !== 'compte' && r.source !== 'panne') || !r.plateforme || r.id == null || r.id === '') continue;
    const d = Number(r.depuisMs);
    if (!Number.isFinite(d) || d <= 0 || d > maintenant) continue;   // « jamais relu » (0) n'est pas « pas relu depuis »
    const jours = Math.floor((maintenant - d) / JOUR_MS);
    if (jours < 1) continue;
    const cle = `${r.plateforme}:${r.id}`;
    const deja = parCompte.get(cle);
    if (!deja || d < deja.depuisMs) parCompte.set(cle, { cle, plateforme: String(r.plateforme), id: String(r.id), nom: String(r.nom || ''), depuisMs: d, jours });
  }
  return [...parCompte.values()].sort((a, b) => a.depuisMs - b.depuisMs || a.cle.localeCompare(b.cle));
}

// Ce qui a été rangé : { [cle du compte]: depuisMs rangé }. Un compte reste rangé tant que SA dernière lecture est la
// même ; relu (autre date) ⇒ la ligne peut revenir quand il vieillit de nouveau.
export function aMontrer(liste, ranges) {
  const r = ranges && typeof ranges === 'object' ? ranges : {};
  return (Array.isArray(liste) ? liste : []).filter((x) => Number(r[x.cle]) !== x.depuisMs);
}
export function ranger(ranges, x) {
  const r = { ...(ranges && typeof ranges === 'object' ? ranges : {}) };
  if (x && x.cle) r[x.cle] = x.depuisMs;
  return r;
}
