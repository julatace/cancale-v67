// ══════════════════════════════════════════════════════════════════════════════
// UNE SEULE LIGNE DE FRAÎCHEUR (9 nov., proposition 47 validée par Julien — lot AG)
// ══════════════════════════════════════════════════════════════════════════════
// « Savoir d'un coup d'œil si ce qu'il voit est sûr. » En haut de l'app
// (téléphone et ordinateur), UNE ligne :
//   · « Tout est à jour · vérifié il y a 3 min » SEULEMENT si toutes les sources
//     lues sont fraîches (comptes reliés — ventes, achats, annonces —, extension,
//     suivi chez le transporteur, e-mails reçus) ;
//   · sinon la source en retard NOMMÉE avec son geste, la plus grave d'abord,
//     « + N autres » dépliable ;
//   · hors ligne, base injoignable : la ligne se tait, l'état existant prime
//     (bandeau hors ligne, `BaseInjoignable`) — jamais « tout est à jour » ;
//   · une source pas lue : « pas pu tout vérifier », jamais « à jour ».
// Ce module ne LIT rien et n'invente AUCUN seuil : il range ce que l'app a lu
// avec les règles qui existaient déjà (une règle par notion, §5 « Les chiffres »).
// ──────────────────────────────────────────────────────────────────────────────
// LES SEUILS, RECENSÉS (tous importés de leur propriétaire) :
//   · compte « à relire »            A_RELIRE_MS = 24 h   src/comptesLies.js
//       (la règle « en ligne » : une lecture de plus de 24 h est « à confirmer »)
//   · ventes en retard sur annonces  RETARD_VENTES_MS = 1 h   src/fraicheurComptes.js
//   · achats d'un compte             FRAICHEUR_ACHATS_J = 2 j (ex-App.jsx, ligne
//       d'Achats du 23 oct. — déplacé ICI, App.jsx l'importe)
//   · compte qui n'arrive plus       PANNE_MS = ACTIF_MS = 12 h   api/_lib/garde-capture.js
//       (pas relu 12 h ALORS QUE l'extension a travaillé : preuve lue)
//   · extension pas vue              ACTIF_MS = 12 h   api/_lib/garde-capture.js
//       (l'extension « active » de la garde et du cron qui notifie)
//   · suivi chez le transporteur     RYTHME_MS[état] (15 min au point relais,
//       1 h en route) + CADENCE_COLIS_MS (15 min, le passage « colis » de GitHub,
//       .github/workflows/colis-frais.yml) + MARGE_RYTHME_MS (1 min), tous trois dans
//       api/_lib/transporteurs.js (lus aussi par api/_lib/colis-frequent.js) : au-delà,
//       le serveur aurait dû relire le colis et ne l'a pas fait.
//   · e-mails reçus                  la règle des comptes MUETS (`etatEmailsComptes`,
//       App.jsx : des ventes sans leur e-mail, au moins CSE_MIN_VENTES depuis
//       CSE_MIN_JOURS) — une PREUVE, pas une durée : un vendeur qui ne vend rien
//       ne reçoit rien, et « rien reçu depuis 2 j » serait faux chez lui.
// La GRAVITÉ (la plus grave d'abord) :
//   1 un compte qui n'arrive plus alors que l'extension travaille (panne prouvée) ;
//   2 l'extension pas vue (cause de tout le reste : un geste règle tous les comptes) ;
//   3 un compte pas relu / jamais relu / délié / ses ventes ou achats en retard
//     (le plus ancien d'abord) ;
//   4 le suivi transporteur pas relu ;
//   5 un compte qui n'envoie plus d'e-mails ;
//   6 une extension trop ancienne sur un appareil actif.
// ══════════════════════════════════════════════════════════════════════════════
import { A_RELIRE_MS, ageLecture } from './comptesLies.js';
import { RETARD_VENTES_MS, gesteCourt } from './fraicheurComptes.js';
import { ACTIF_MS, PANNE_MS, etatVersion, versionCourte } from '../api/_lib/garde-capture.js';
import { RYTHME_MS, CADENCE_COLIS_MS, MARGE_RYTHME_MS } from '../api/_lib/transporteurs.js';

export const FRAICHEUR_ACHATS_J = 2;
export { CADENCE_COLIS_MS };
export const SEUILS = Object.freeze({
  compte: A_RELIRE_MS, ventesSurAnnonces: RETARD_VENTES_MS, achats: FRAICHEUR_ACHATS_J * 864e5,
  panne: PANNE_MS, extension: ACTIF_MS, suiviCadence: CADENCE_COLIS_MS, suiviMarge: MARGE_RYTHME_MS,
});
export const GRAVITE = Object.freeze({ panne: 1, extension: 2, compte: 3, suivi: 4, emails: 5, version: 6 });

const ts = (v) => { const t = typeof v === 'number' ? v : Date.parse(String(v || '')); return Number.isFinite(t) && t > 0 ? t : null; };
const depuis = (t, maintenant) => String(ageLecture(t, maintenant) || '').replace(/^il y a /, '');

// Le suivi d'un colis ACTIF (au point relais, en route, pas fini) que le serveur
// aurait dû relire et n'a pas relu. `lignes` : les `transp_` lues (tableau), ou
// null/undefined (pas su / en cours). Rend { etat:'lu', retard:{…}|null, at } ou
// { etat:'passu' } / { etat:'encours' }.
export function suiviTransporteur(lignes, maintenant = Date.now()) {
  if (lignes === undefined) return { etat: 'encours' };
  if (!Array.isArray(lignes)) return { etat: 'passu' };
  let pire = null, n = 0, dernier = null;
  for (const t of lignes) {
    const lu = ts(t && t.lu);
    if (lu != null && lu <= maintenant + 60000 && (dernier == null || lu > dernier)) dernier = lu;
    if (!t || t.fini || !(t.etat === 'disponible' || t.etat === 'en_route')) continue;
    const base = lu != null ? lu : ts(t.essai);
    if (base == null) continue;
    const limite = RYTHME_MS[t.etat] + CADENCE_COLIS_MS + MARGE_RYTHME_MS;
    if (maintenant - base > limite) { n++; if (!pire || base < pire) pire = base; }
  }
  return { etat: 'lu', at: dernier, retard: n ? { n, lu: pire } : null };
}

// Le dernier signe de vie de l'extension, toutes extensions confondues : les
// lignes d'appareil (5.327+) et, pour une plus ancienne, `panel_diag_capture`.
export function signeExtension(appareils, ancien) {
  if (appareils === null && (ancien === null || ancien === undefined)) return { etat: 'passu' };
  let at = null;
  for (const a of (appareils || [])) if (a && a.at && (at == null || a.at > at)) at = a.at;
  if (ancien && ancien.at && (at == null || ancien.at > at)) at = ancien.at;
  return { etat: 'lu', at };
}

// ── LA RÈGLE ─────────────────────────────────────────────────────────────────
// Entrées (toutes LUES par l'écran, trois états chacune : undefined en cours ·
// null pas su · valeur) :
//   · `baseKO`, `horsLigne` : l'état de la coque — ils priment ;
//   · `capture` : l'état de `useEtatCapture({ complet: true })` (src/ToutVaBien.jsx) :
//     { lignes (lignesFraicheur), pannes, appareils, ancien, passu[], comptesPrets } ;
//   · `achats` : { [uid Vinted]: date de la dernière lecture des achats } ou null ;
//   · `emails` : le résultat de `etatEmailsComptes` ({ etat, muets }) ;
//   · `transp` : les lignes `transp_` ;
//   · `exclu(plateforme, id)` : un compte retiré des totaux (son choix) — jamais nommé.
// Sortie : { etat: 'cache'|'encours'|'a-jour'|'retard'|'passu', retards[], passu[], verifieAt }.
export function fraicheurUnique({ baseKO = false, horsLigne = false, capture, achats, emails, transp, exclu, attendue = '', verifieAt = null, maintenant = Date.now() } = {}) {
  if (horsLigne) return { etat: 'cache', raison: 'hors-ligne', retards: [], passu: [] };
  if (baseKO) return { etat: 'cache', raison: 'base', retards: [], passu: [] };
  // Tant qu'une source est EN COURS de lecture, rien n'est affirmé (ni « à jour », ni un retard partiel).
  if (capture === undefined || !capture || !capture.comptesPrets || transp === undefined || (emails && emails.etat === 'encours') || emails === undefined) return { etat: 'encours', retards: [], passu: [] };
  const estExclu = typeof exclu === 'function' ? exclu : () => false;
  const retards = [];
  const passu = [...(Array.isArray(capture.passu) ? capture.passu : [])];
  const lignes = (Array.isArray(capture.lignes) ? capture.lignes : []).filter((l) => !estExclu(l.plateforme, l.id));
  const comptesActifs = lignes.filter((l) => !String(l.bloque || '').startsWith('masqué') && l.etat !== 'banni');

  // 1. Pannes prouvées (garde-capture).
  const enPanne = new Set();
  for (const p of (Array.isArray(capture.pannes) ? capture.pannes : [])) {
    if (estExclu(p.plateforme, p.id)) continue;
    enPanne.add(`${p.plateforme}:${p.id}`);
    retards.push({ cle: `panne:${p.plateforme}:${p.id}`, source: 'panne', plateforme: p.plateforme, id: String(p.id), gravite: GRAVITE.panne, depuisMs: ts(p.lu) || 0,
      nom: p.nom, texte: `n’arrive plus dans VRM — ${p.refus ? String(p.cause || '').split(' · ')[0] : String(p.cause || '')}${p.appareil ? ` (${p.appareil.nom})` : ''}`,
      depuisTexte: p.age ? `pas relu depuis ${String(p.age).replace(/^il y a /, '')}` : '',
      geste: String(p.geste || ''), gesteCourt: '', vers: 'toutvabien', cleAlerte: p.cle });
  }

  // 2. L'extension, toutes extensions confondues.
  const sig = signeExtension(capture.appareils, capture.ancien);
  if (sig.etat === 'passu') passu.push('l’extension');
  else if (sig.at == null) {
    if (comptesActifs.length) retards.push({ cle: 'extension:jamais', source: 'extension', gravite: GRAVITE.extension, depuisMs: 0, nom: 'Extension', texte: 'jamais vue sur tes comptes',
      geste: 'installe l’extension VRM dans le navigateur où tu ouvres Vinted (Réglages → État des connexions)', gesteCourt: 'installe-la (Réglages)', vers: 'settings' });
  } else if (maintenant - sig.at > ACTIF_MS) {
    retards.push({ cle: 'extension:muette', source: 'extension', gravite: GRAVITE.extension, depuisMs: sig.at, nom: 'Extension', texte: `pas vue depuis ${depuis(sig.at, maintenant)}`,
      geste: 'ouvre, sur ton ordinateur, le navigateur où est l’extension VRM : elle se réveille toute seule et relit tes comptes', gesteCourt: 'ouvre le navigateur où elle est', vers: 'toutvabien' });
  }

  // 3. Les comptes (lignesFraicheur : 24 h, ventes > 1 h derrière les annonces, délié, jamais).
  for (const l of comptesActifs) {
    if (!l.geste || enPanne.has(`${l.plateforme}:${l.id}`)) continue;
    const lu = l.ventesRetard ? l.ventesRetard.lu : null;
    const texte = l.etat === 'delie' ? 'délié' : l.etat === 'jamais' ? 'jamais relu'
      : l.etat === 'a-relire' ? `pas relu depuis ${String(l.age || '').replace(/^il y a /, '')}`
      : l.ventesRetard ? `ventes pas relues depuis ${depuis(lu, maintenant)}` : 'à relire';
    retards.push({ cle: `compte:${l.plateforme}:${l.id}`, source: 'compte', plateforme: l.plateforme, id: l.id, gravite: GRAVITE.compte,
      depuisMs: l.etat === 'jamais' ? 0 : (ts(l.lu) || lu || 0), nom: l.nom, texte, geste: l.bloque, gesteCourt: gesteCourt(l.plateforme, l.etat === 'delie' ? 'delie' : l.ventesRetard && l.etat !== 'a-relire' ? 'ventes' : 'relire'), vers: 'vintedaccounts' });
  }
  // 3 bis. Les achats d'un compte Vinted (actif, pas déjà nommé). Par défaut, ceux que la capture a lus.
  if (achats === undefined) achats = capture.achats;
  if (achats === null) passu.push('tes achats');
  else if (achats && typeof achats === 'object') {
    const deja = new Set(retards.map((r) => `${r.plateforme}:${r.id}`));
    for (const l of comptesActifs) {
      if (l.plateforme !== 'vinted' || deja.has(`vinted:${l.id}`)) continue;
      const a = ts(achats[l.id]);
      if (a == null || maintenant - a <= SEUILS.achats) continue;
      retards.push({ cle: `achats:vinted:${l.id}`, source: 'compte', plateforme: 'vinted', id: l.id, gravite: GRAVITE.compte, depuisMs: a, nom: l.nom,
        texte: `achats pas relus depuis ${depuis(a, maintenant)}`, geste: `ouvre Vinted › Mes commandes › Achats sur ce compte, dans le navigateur où est l’extension VRM`, gesteCourt: gesteCourt('vinted', 'achats'), vers: 'vintedaccounts' });
    }
  }

  // 4. Le suivi chez le transporteur.
  const sv = suiviTransporteur(transp, maintenant);
  if (sv.etat === 'passu') passu.push('le suivi des colis');
  else if (sv.etat === 'lu' && sv.retard) retards.push({ cle: 'suivi', source: 'suivi', gravite: GRAVITE.suivi, depuisMs: sv.retard.lu, nom: 'Suivi des colis',
    texte: `pas relu chez le transporteur depuis ${depuis(sv.retard.lu, maintenant)}${sv.retard.n > 1 ? ` (${sv.retard.n} colis)` : ''}`,
    geste: 'VRM le relit tout seul ; touche « Relire » pour le demander maintenant (Colis → À retirer dit quand il a été vérifié)', gesteCourt: 'touche Relire', action: 'relire-suivi' });

  // 5. Les e-mails (comptes muets, prouvés).
  if (emails && emails.etat === 'pasSu') passu.push('les e-mails');
  else if (emails && emails.etat === 'lu') for (const m of (emails.muets || [])) {
    if (estExclu('vinted', m.uid)) continue;
    const d = ts(m.depuis);
    retards.push({ cle: `emails:${m.uid}`, source: 'emails', plateforme: 'vinted', id: String(m.uid), gravite: GRAVITE.emails, depuisMs: d || 0, nom: m.login,
      texte: m.jamais ? 'aucun e-mail reçu' : `e-mails : rien reçu depuis ${depuis(d, maintenant)}`,
      geste: 'sur Vinted, connecté sur ce compte : Paramètres → Notifications, active les e-mails ; puis vérifie que sa boîte les fait suivre (Comptes liés → E-mails)', gesteCourt: 'relie sa boîte', vers: 'vintedaccounts' });
  }

  // 6. Une extension trop ancienne sur un appareil actif.
  for (const a of (Array.isArray(capture.appareils) ? capture.appareils : [])) {
    if (!a || maintenant - a.at > ACTIF_MS || etatVersion(a, attendue) !== 'ancienne') continue;
    retards.push({ cle: `version:${a.id}`, source: 'version', gravite: GRAVITE.version, depuisMs: a.at, nom: `Extension ${versionCourte(a.code || a.ver)}`,
      texte: `sur ${a.nom}`, geste: `installe la ${versionCourte(attendue)} sur ${a.nom} (Réglages → Tout va bien ?)`, gesteCourt: `installe la ${versionCourte(attendue)}`, vers: 'toutvabien' });
  }

  // La plus grave d'abord ; à gravité égale, la plus ancienne (jamais = 0 en tête).
  retards.sort((x, y) => (x.gravite - y.gravite) || ((x.depuisMs || 0) - (y.depuisMs || 0)) || String(x.nom).localeCompare(String(y.nom), 'fr'));
  if (retards.length) return { etat: 'retard', retards, passu, verifieAt };
  if (passu.length) return { etat: 'passu', retards, passu, verifieAt };
  // Rien relié du tout : rien à affirmer (le guide de démarrage parle à sa place).
  if (!comptesActifs.length && sig.at == null) return { etat: 'cache', raison: 'rien', retards, passu };
  return { etat: 'a-jour', retards, passu, verifieAt };
}

// La phrase d'une source en retard, telle qu'écrite sur la ligne (une fois).
export const phraseRetard = (r) => `${r.nom} ${r.texte}`;
