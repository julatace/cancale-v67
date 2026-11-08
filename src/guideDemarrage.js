// ── LE PARCOURS DES PREMIÈRES MINUTES (6 nov., refait le 8 nov.) ──────────────
// Julien, 8 nov. : « des vendeurs vont payer » — un vendeur qui crée son compte
// doit réussir SEUL en dix minutes. Cinq étapes, dans l'ordre où elles servent.
// Chacune se coche TOUTE SEULE sur une PREUVE LUE — jamais sur une case « j'ai
// fini » ni sur une supposition (§8 : « pas su » ne vaut pas « oui ») :
//   1. créer son compte — preuve : la session de CE compte VRM (son identifiant) ;
//   2. installer l'extension — preuve : elle répond dans CE navigateur (le pont),
//      ou un compte Vinted est déjà rangé dans SA base (seule l'extension en écrit) ;
//   3. ouvrir Vinted pour relier son compte — preuve : un compte Vinted lu dans
//      SA base (`vinted_accounts`) ;
//   4. relier sa boîte e-mail — preuve : au moins un e-mail rangé chez lui
//      (`email_reception_*` : c'est l'adresse de RÉCEPTION qui l'a donné à lui) ;
//   5. sa première vente — preuve : une vente Vinted LUE (le compteur `nItems`
//      de `harvest_{uid}_orders_sold`, un scalaire). Une étape d'ATTENTE : rien à
//      faire, elle arrive toute seule.
// Trois états partout : `undefined` lecture en cours · `null` pas su · valeur.
// Une étape « pas su » n'est ni cochée ni proposée comme « à faire » : l'écran
// dit qu'elle n'a pas pu être vérifiée.
// « Plus tard » met UNE étape de côté pendant 7 jours (jamais bloquant) : l'étape
// suivante devient la courante. Relier Vinted suppose l'extension : mettre
// l'extension de côté met aussi Vinted de côté (sur un téléphone, on passe à la
// boîte e-mail, faisable d'ici).
// La numérotation se CHOISIT au départ (« VRM numérote » / « Je numérote moi-même »,
// le réglage `vrm_numero_ecrit` de src/numeroEcrit.js) : la question n'est posée
// qu'à un compte qui n'a jamais choisi ET dont on a LU qu'aucune paire ne porte
// de N° (un vendeur installé n'est jamais interrogé).
// « Vérifier mon installation » (`verifierInstallation`) : extension (présente,
// version, connectée à CE compte), comptes liés, boîte e-mail, dernière relecture
// — chacun lu, avec LE geste qui manque.
// JS pur, sans React : `scripts/audit-premieres-minutes.cjs` l'exécute.

export const ETAPES_GUIDE = [
  { cle: 'compte', titre: 'Créer ton compte', pourquoi: 'C’est fait : tout ce que VRM range est à toi, et à personne d’autre.' },
  { cle: 'extension', titre: 'Installer l’extension', pourquoi: 'C’est elle qui lit tes ventes, tes colis et tes bordereaux sur Vinted, depuis ton navigateur.' },
  { cle: 'vinted', titre: 'Ouvrir Vinted pour relier ton compte', pourquoi: 'Passe une fois sur vinted.fr, connecté : tes annonces et tes ventes se rangent sous ton compte.' },
  { cle: 'emails', titre: 'Relier ta boîte e-mail', pourquoi: 'Bordereaux, codes de retrait et suivis arrivent par e-mail : VRM les range avec la bonne vente.' },
  { cle: 'vente', titre: 'Voir ta première vente arriver', pourquoi: 'Rien à faire : dès qu’un acheteur paie, la vente arrive ici avec son bordereau.', attente: true },
];
export const JOURS_PLUS_TARD = 7;
export const CLE_PLUS_TARD = 'vrm_parcours_plus_tard';

// L'étape « compte » : la session de CE compte. Sans identifiant : pas su.
export function preuveCompte(uid) {
  if (uid === undefined) return 'encours';
  return uid && String(uid).trim() ? 'fait' : 'passu';
}
// L'étape « extension » : `etapePont` est l'état du pont (`useEtapePont`) :
// 'absente' · 'demande' · 'muette' · 'pasconnectee' · 'autrecompte' · 'connectee'.
export function preuveExtension(etapePont, comptes) {
  if (Array.isArray(comptes) && comptes.length > 0) return 'fait';
  if (etapePont === 'demande') return 'encours';
  if (etapePont === 'absente' || etapePont == null) return 'afaire';
  return 'fait';   // elle a répondu : elle est installée (la suite est l'étape 3)
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
// Combien de ventes Vinted lues : des lignes `[{ id, n }]` (`n` = `data->>nItems`).
// Une vente lue sur un compte suffit à prouver l'étape ; sinon, une ligne au compteur
// illisible ⇒ pas su (jamais compté comme 0).
export function compterVentes(lignes) {
  if (lignes === undefined) return undefined;
  if (!Array.isArray(lignes)) return null;
  let n = 0, illisible = false;
  for (const l of lignes) {
    const v = l && l.n != null && l.n !== '' ? Number(l.n) : NaN;
    if (Number.isFinite(v) && v >= 0) n += v;
    else illisible = true;
  }
  return n > 0 ? n : illisible ? null : 0;
}

// « Plus tard » : { [cle]: iso } — une étape de côté pendant JOURS_PLUS_TARD.
export function reporteeActive(plusTard, cle, maintenant = Date.now()) {
  const t = Date.parse((plusTard && typeof plusTard === 'object' && plusTard[cle]) || '');
  return Number.isFinite(t) && t <= maintenant + 60000 && maintenant - t < JOURS_PLUS_TARD * 86400000;
}

// `preuves` : { compte, extension, vinted, emails, vente } — chacune 'fait' ·
// 'afaire' · 'encours' · 'passu'. Rend les étapes avec leur état, le nombre FAIT,
// l'étape courante (la première non confirmée et pas mise de côté, sans sauter une
// lecture incertaine) et `fini`. `courante` est `null` quand tout ce qui reste est
// mis de côté (l'écran se tait jusqu'au retour de l'étape).
export function etatGuide(preuves = {}, { plusTard = null, maintenant = Date.now() } = {}) {
  const ok = new Set(['fait', 'afaire', 'encours', 'passu']);
  const reporte = (cle) => reporteeActive(plusTard, cle, maintenant) || (cle === 'vinted' && reporteeActive(plusTard, 'extension', maintenant));
  const etapes = ETAPES_GUIDE.map((e) => {
    const etat = ok.has(preuves[e.cle]) ? preuves[e.cle] : 'passu';
    return { ...e, etat, reportee: etat !== 'fait' && reporte(e.cle) };
  });
  const faites = etapes.filter((e) => e.etat === 'fait').length;
  const courante = (etapes.find((e) => e.etat !== 'fait' && !e.reportee) || {}).cle || null;
  return { etapes, faites, total: etapes.length, courante, fini: faites === etapes.length };
}

// ── LE CHOIX DE LA NUMÉROTATION ───────────────────────────────────────────────
export const CHOIX_NUMEROTATION = [
  { cle: 'vrm', titre: 'VRM numérote mes paires', texte: 'Chaque nouvelle annonce reçoit un numéro à écrire sur sa boîte.' },
  { cle: 'moi', titre: 'Je numérote moi-même', texte: 'Tu termines ta description par « N° 123 » : VRM lit le tien.' },
];
// Posée seulement si : le réglage n'a jamais été choisi (ni `depuis` ni `choisi`)
// ET on a LU qu'aucune paire ne porte de N° (`nNum === 0`). Pas su ⇒ on ne demande pas.
export function numerotationAChoisir(brut, nNum) {
  const o = brut && typeof brut === 'object' ? brut : null;
  if (o && (typeof o.depuis === 'string' || typeof o.choisi === 'string')) return false;
  return nNum === 0;
}
// Ce que le choix écrit dans `vrm_numero_ecrit` (la forme lue par `lireReglageNumeroEcrit`).
export function reglageDuChoix(cle, at = new Date().toISOString()) {
  return { actif: cle === 'moi', depuis: at, choisi: at };
}

// ── « VÉRIFIER MON INSTALLATION » ─────────────────────────────────────────────
// Entrées (trois états chacune) :
//   · `pont` : { etape, version, enRetard, telephone } — `etape` comme `useEtapePont` ;
//   · `comptes` : liste Vinted lue ;
//   · `emails` : lignes `email_reception_*` lues ;
//   · `relu` : { [uid]: ts } de la dernière relecture par compte (`lireCapturesDetail().by`).
// Rend { lignes: [{ cle, etat: 'ok'|'action'|'passu'|'encours', titre, detail, geste }], aFaire, passu, toutVaBien }.
// `geste` : { cle, libelle } — l'écran sait le faire (installer, maj, vinted, emails, relire, reessayer).
const VINGT_QUATRE_H = 24 * 3600e3;
export function verifierInstallation({ pont = {}, comptes, emails, relu, maintenant = Date.now() } = {}) {
  const lignes = [];
  const aDesComptes = Array.isArray(comptes) && comptes.length > 0;
  // 1. L'extension, ici.
  const e = pont.etape;
  if (e === 'demande' || e === undefined) lignes.push({ cle: 'extension', etat: 'encours', titre: 'Extension', detail: 'Je lui pose la question…' });
  else if (e === 'absente' || e == null) {
    if (pont.telephone) lignes.push({ cle: 'extension', etat: aDesComptes ? 'ok' : 'action', titre: 'Extension', detail: aDesComptes ? 'Elle vit sur ton ordinateur : tes comptes arrivent bien.' : 'Elle s’installe sur ton ordinateur : ouvre vrm.center dans son navigateur.' });
    else lignes.push({ cle: 'extension', etat: 'action', titre: 'Extension', detail: 'Pas trouvée dans ce navigateur.', geste: { cle: 'installer', libelle: 'Installer l’extension' } });
  } else if (e === 'muette') lignes.push({ cle: 'extension', etat: 'passu', titre: 'Extension', detail: 'Elle est là, mais n’a pas répondu. Recharge la page.', geste: { cle: 'reessayer', libelle: 'Réessayer' } });
  else if (pont.enRetard) lignes.push({ cle: 'extension', etat: 'action', titre: 'Extension', detail: `Version ${pont.version || '?'} : une mise à jour est prête.`, geste: { cle: 'maj', libelle: 'Mettre à jour' } });
  else if (e === 'pasconnectee') lignes.push({ cle: 'extension', etat: 'action', titre: 'Extension', detail: 'Installée, pas encore connectée à ton compte VRM : clique son icône, puis connecte-la.' });
  else if (e === 'autrecompte') lignes.push({ cle: 'extension', etat: 'action', titre: 'Extension', detail: 'Connectée à un AUTRE compte VRM : ce qu’elle lit part ailleurs. Clique son icône et connecte-la à celui-ci.' });
  else lignes.push({ cle: 'extension', etat: 'ok', titre: 'Extension', detail: `Version ${pont.version || '?'} · connectée à ce compte.` });
  // 2. Les comptes liés.
  if (comptes === undefined) lignes.push({ cle: 'comptes', etat: 'encours', titre: 'Comptes Vinted', detail: 'Lecture…' });
  else if (!Array.isArray(comptes)) lignes.push({ cle: 'comptes', etat: 'passu', titre: 'Comptes Vinted', detail: 'Pas pu lire tes comptes.', geste: { cle: 'reessayer', libelle: 'Réessayer' } });
  else if (!comptes.length) lignes.push({ cle: 'comptes', etat: 'action', titre: 'Comptes Vinted', detail: 'Aucun compte relié : passe une fois sur vinted.fr, connecté.', geste: { cle: 'vinted', libelle: 'Ouvrir vinted.fr' } });
  else lignes.push({ cle: 'comptes', etat: 'ok', titre: 'Comptes Vinted', detail: comptes.length === 1 ? `1 compte relié${comptes[0] && comptes[0].login ? ` (${comptes[0].login})` : ''}.` : `${comptes.length} comptes reliés.` });
  // 3. La boîte e-mail.
  if (emails === undefined) lignes.push({ cle: 'emails', etat: 'encours', titre: 'Boîte e-mail', detail: 'Lecture…' });
  else if (!Array.isArray(emails)) lignes.push({ cle: 'emails', etat: 'passu', titre: 'Boîte e-mail', detail: 'Pas pu vérifier.', geste: { cle: 'reessayer', libelle: 'Réessayer' } });
  else if (!emails.length) lignes.push({ cle: 'emails', etat: 'action', titre: 'Boîte e-mail', detail: 'Aucun e-mail reçu pour l’instant.', geste: { cle: 'emails', libelle: 'Relier ma boîte' } });
  else lignes.push({ cle: 'emails', etat: 'ok', titre: 'Boîte e-mail', detail: 'Reliée : tes e-mails arrivent.' });
  // 4. La dernière relecture, compte par compte (seulement s'il y a des comptes).
  if (aDesComptes) {
    if (relu === undefined) lignes.push({ cle: 'relecture', etat: 'encours', titre: 'Dernière relecture', detail: 'Lecture…' });
    else if (!relu || typeof relu !== 'object') lignes.push({ cle: 'relecture', etat: 'passu', titre: 'Dernière relecture', detail: 'Pas pu lire la date.', geste: { cle: 'reessayer', libelle: 'Réessayer' } });
    else {
      const vieux = comptes.filter((a) => { const t = Number(relu[String((a && a.vinted_user_id) || '')]); return !(Number.isFinite(t) && t > 0 && maintenant - t < VINGT_QUATRE_H); });
      const ts = comptes.map((a) => Number(relu[String((a && a.vinted_user_id) || '')])).filter((t) => Number.isFinite(t) && t > 0);
      const dernier = ts.length ? Math.max(...ts) : null;
      if (!vieux.length) lignes.push({ cle: 'relecture', etat: 'ok', titre: 'Dernière relecture', detail: 'Moins de 24 h pour chaque compte.', quand: dernier });
      else {
        const noms = vieux.map((a) => (a && a.login) || 'un compte').slice(0, 3).join(', ');
        lignes.push({ cle: 'relecture', etat: 'action', titre: 'Dernière relecture', detail: `Plus de 24 h pour ${noms}${vieux.length > 3 ? '…' : ''} : repasse sur Vinted, connecté à ce compte.`, geste: { cle: 'relire', libelle: 'Ouvrir vinted.fr' }, quand: dernier });
      }
    }
  }
  const aFaire = lignes.filter((l) => l.etat === 'action').length;
  const passu = lignes.filter((l) => l.etat === 'passu' || l.etat === 'encours').length;
  return { lignes, aFaire, passu, toutVaBien: aFaire === 0 && passu === 0 };
}
