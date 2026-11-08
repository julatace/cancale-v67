// ── LE GUIDE DE DÉMARRAGE (6 nov., VRM ouvert à des clients) ──────────────────
// Quatre étapes, dans l'ordre où elles servent. Chacune dit POURQUOI, et se
// coche TOUTE SEULE sur une PREUVE LUE — jamais sur une case « j'ai fini » ni
// sur une supposition (§8 : « pas su » ne vaut pas « oui »).
//   1. installer l'extension — preuve : elle répond dans CE navigateur (le pont),
//      ou un compte Vinted est déjà rangé dans SA base (seule l'extension en écrit) ;
//   2. ouvrir Vinted pour relier son compte — preuve : un compte Vinted lu dans
//      SA base (`vinted_accounts`) ;
//   3. relier sa boîte e-mail — preuve : au moins un e-mail rangé chez lui
//      (`email_reception_*` : c'est l'adresse de RÉCEPTION qui l'a donné à lui) ;
//   4. numéroter ses paires — preuve : au moins une paire porte un N° (Vinted ou
//      Vestiaire), lu dans SES données synchronisées.
// Trois états partout : `undefined` lecture en cours · `null` pas su · valeur.
// Une étape « pas su » n'est ni cochée ni proposée comme « à faire » : l'écran
// dit qu'elle n'a pas pu être vérifiée.
// JS pur, sans React : l'audit `scripts/audit-guide-demarrage.cjs` l'exécute.

export const ETAPES_GUIDE = [
  { cle: 'extension', titre: 'Installer l’extension', pourquoi: 'C’est elle qui lit tes ventes, tes colis et tes bordereaux sur Vinted, depuis ton navigateur.' },
  { cle: 'vinted', titre: 'Ouvrir Vinted pour relier ton compte', pourquoi: 'Passe une fois sur vinted.fr, connecté : tes annonces et tes ventes se rangent sous ton compte.' },
  { cle: 'emails', titre: 'Relier ta boîte e-mail', pourquoi: 'Bordereaux, codes de retrait et suivis arrivent par e-mail : VRM les range avec la bonne vente.' },
  { cle: 'numeros', titre: 'Numéroter tes paires', pourquoi: 'Un numéro sur chaque boîte : tu retrouves la paire d’un coup d’œil, et il est imprimé sur le bordereau. Tu l’écris déjà dans tes annonces ? Paramètres → Numéros de rangement : VRM lit le tien.' },
];

// L'étape « extension » : `etapePont` est l'état du pont (`useEtapePont`) :
// 'absente' · 'demande' · 'muette' · 'pasconnectee' · 'autrecompte' · 'connectee'.
export function preuveExtension(etapePont, comptes) {
  if (Array.isArray(comptes) && comptes.length > 0) return 'fait';
  if (etapePont === 'demande') return 'encours';
  if (etapePont === 'absente' || etapePont == null) return 'afaire';
  return 'fait';   // elle a répondu : elle est installée (la suite est l'étape 2)
}
// Une liste lue : `undefined` en cours · `null` pas su · tableau.
export function preuveListe(liste) {
  if (liste === undefined) return 'encours';
  if (!Array.isArray(liste)) return 'passu';
  return liste.length > 0 ? 'fait' : 'afaire';
}
// Un nombre lu : `undefined` en cours · `null` pas su · nombre.
export function preuveNombre(n) {
  if (n === undefined) return 'encours';
  if (typeof n !== 'number' || !Number.isFinite(n)) return 'passu';
  return n > 0 ? 'fait' : 'afaire';
}
// Combien de paires portent un N° dans une table { [id]: { numero } | numero }.
export function compterNumeros(...tables) {
  let n = 0, lu = false;
  for (const t of tables) {
    if (t === undefined) continue;
    if (t === null || typeof t !== 'object') return null;
    lu = true;
    for (const v of Object.values(t)) {
      const num = v && typeof v === 'object' ? v.numero : v;
      if (num != null && String(num).trim()) n++;
    }
  }
  return lu ? n : undefined;
}

// `preuves` : { extension, vinted, emails, numeros } — chacune 'fait' · 'afaire'
// · 'encours' · 'passu'. Rend les étapes avec leur état, le nombre FAIT, l'étape
// courante (la première étape non confirmée, sans sauter une lecture incertaine) et `fini`.
export function etatGuide(preuves = {}) {
  const ok = new Set(['fait', 'afaire', 'encours', 'passu']);
  const etapes = ETAPES_GUIDE.map((e) => ({ ...e, etat: ok.has(preuves[e.cle]) ? preuves[e.cle] : 'passu' }));
  // Relier Vinted suppose l'extension : tant qu'elle manque, l'étape 2 attend.
  const faites = etapes.filter((e) => e.etat === 'fait').length;
  const courante = (etapes.find((e) => e.etat !== 'fait') || {}).cle || null;
  return { etapes, faites, total: etapes.length, courante, fini: faites === etapes.length };
}
