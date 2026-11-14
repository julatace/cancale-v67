import { jourParis } from './dateParis.js';
// ════════════════════════════════════════════════════════════════════════════
//  L'ACCOMPAGNEMENT — LA RÈGLE (6 nov. 2026)
//  Julien : « Je veux quelque chose de plus beau, simple et visuel ; peut-être un
//  accompagnement à faire telle ou telle action quand tu juges favorable, que l'on
//  peut skip. »
//
//  Une bulle, au plus, pointée sur le VRAI bouton d'un geste utile, quand un
//  chiffre que l'écran affiche déjà le justifie. Ce module ne porte que la règle,
//  sans React : le composant (src/Conseils.jsx) la lit, l'audit
//  (scripts/audit-accompagnement.cjs) l'exécute.
//
//  ⚠️ AUCUN CHIFFRE NEUF. Un conseil se décide sur un nombre PUBLIÉ par l'écran qui
//     l'affiche (`<ChiffreConseil cle valeur/>`, posé à côté du calcul, §11) :
//     `publierChiffre` / `retirerChiffre`. Un écran démonté retire ses chiffres.
//     `undefined` (en cours) ou `null` (pas su) ⇒ AUCUN conseil : « pas su » ne
//     vaut pas « oui ».
//  ⚠️ AUCUN NOMBRE DANS LA BULLE : l'écran l'affiche déjà à côté du bouton pointé
//     (§7 : le même nombre ne s'écrit pas deux fois sur un écran).
//  ⚠️ PEU, ET JAMAIS DEUX FOIS DE SUITE. 2 conseils par jour, 1 par écran et par
//     jour ; « Plus tard », ou le geste fait, ⇒ pas avant 3 jours ; « Ne plus
//     montrer » ⇒ jamais ; un conseil `uneFois` ne paraît qu'une fois.
//  ⚠️ JAMAIS PAR-DESSUS AUTRE CHOSE (`raisonSilence`) : app pas prête, visite en
//     cours, mode exemple, mode stream, écran tombé sur le garde-fou, chargement,
//     feuille ouverte ⇒ rien.
//  ⚠️ LA MÉMOIRE est SA ligne `vrm_accompagnement` (synchronisée : un conseil vu
//     sur l'ordinateur ne revient pas sur le téléphone), écrite en
//     lire-fusionner-réécrire, comparer-et-échanger sur `data.rev` (§5, le motif de
//     `lireLigneInventaire` / `ecrireLigneInventaire`). `modifierMemoire` n'écrit
//     RIEN si la lecture rate. Un conseil ne paraît qu'une fois son « vu » ÉCRIT :
//     un rechargement ne le ramène pas.
//  ⚠️ Refusés par Julien (§3), jamais un conseil : rappel des messages sans
//     réponse, rappel des évaluations, prix conseillé à la mise en ligne, alerte
//     « achat jamais arrivé ». Aucun conseil ne fait un geste à sa place : le bouton
//     de la bulle touche le bouton de l'écran, c'est tout.
// ════════════════════════════════════════════════════════════════════════════

export const LIGNE_ACCOMPAGNEMENT = 'vrm_accompagnement';
// Coupe les conseils sur CET appareil (les bancs : `_porte-banc.cjs`).
export const CLE_APPAREIL = 'vrm_conseils_appareil';
export const PLAFOND_JOUR = 2;
export const PLAFOND_ECRAN = 1;
export const REPOS_JOURS = 3;
const JOUR_MS = 86400000;
const VUS_GARDES = 40;

const fini = (x) => typeof x === 'number' && Number.isFinite(x);
const estObjet = (o) => !!o && typeof o === 'object' && !Array.isArray(o);

// ── 1. LES CHIFFRES PUBLIÉS ──────────────────────────────────────────────────
// Un tableau noir partagé : l'écran écrit, la bulle lit. `undefined` retire.
const CHIFFRES = new Map();
const ABONNES = new Set();
const pareil = (a, b) => { try { return JSON.stringify(a) === JSON.stringify(b); } catch (_) { return false; } };
const prevenir = () => { for (const f of [...ABONNES]) { try { f(); } catch (_) {} } };
export function publierChiffre(cle, valeur) {
  if (!cle) return;
  if (valeur === undefined) { retirerChiffre(cle); return; }
  if (CHIFFRES.has(cle) && pareil(CHIFFRES.get(cle), valeur)) return;
  CHIFFRES.set(cle, valeur);
  prevenir();
}
export function retirerChiffre(cle) {
  if (!CHIFFRES.has(cle)) return;
  CHIFFRES.delete(cle);
  prevenir();
}
export const lireChiffres = () => Object.fromEntries(CHIFFRES);
export function ecouterChiffres(f) { ABONNES.add(f); return () => ABONNES.delete(f); }

// ── 2. LES CONSEILS ─────────────────────────────────────────────────────────
// cle · chiffre (la clé publiée) · quand(valeur) → true seulement sur un nombre lu ·
// cibles (le premier sélecteur VISIBLE est pointé ; `data-*` stables, jamais une
// classe de mise en page) · titre · texte (une phrase) · geste (le mot du bouton) ·
// action? (un chemin que l'app sait ouvrir ; sinon le bouton touche la cible) ·
// appareil? ('telephone' | 'ordinateur') · ecrans? (sinon : là où le chiffre est
// publié) · uneFois?
export const CONSEILS = [
  {
    cle: 'colis-imprimer', chiffre: 'colis.imprimer',
    // La règle de « Prochain geste » de Colis (`gesteEnvoi`, src/prochainGesteColis.js) :
    // un bordereau à imprimer pour aujourd'hui ou demain.
    quand: (v) => estObjet(v) && fini(v.nLot) && v.nLot >= 1 && v.presse === true,
    cibles: ['[data-colis-barre-btn="imprimer"]'],
    titre: 'Un envoi presse',
    texte: (v) => `${v.nLot > 1 ? 'Ils partent' : 'Il part'} en un seul PDF, rangé par transporteur.`,
    geste: 'Tout imprimer',
  },
  {
    cle: 'comptes-muets', chiffre: 'colis.comptesMuets',
    quand: (v) => fini(v) && v >= 1,
    // (11 nov.) La phrase de Colis est partie (10 nov., Julien : « déjà marqué au-dessus ») : le conseil
    // pointe le geste de la ligne de fraîcheur du haut (src/LigneFraicheur.jsx), source « emails ».
    cibles: ['[data-fraicheur-geste="emails"]', '[data-fraicheur-rangee="emails"]'],
    titre: (v) => (v > 1 ? 'Des comptes sans e-mail' : 'Un compte sans e-mail'),
    texte: (v) => `${v > 1 ? 'Leurs' : 'Ses'} codes de retrait et bordereaux n’arrivent pas jusqu’ici.`,
    geste: 'Relier maintenant',
  },
  {
    cle: 'ebay-relier', chiffre: 'ebay.aRelier',
    quand: (v) => fini(v) && v >= 1,
    cibles: ['[data-ebay-filtre="relier"]'],
    titre: (v) => (v > 1 ? 'Des annonces eBay à relier' : 'Une annonce eBay à relier'),
    texte: (v) => (v > 1 ? 'Reliées à leur article, VRM les retire d’eBay quand elles se vendent ailleurs.' : 'Reliée à son article, VRM la retire d’eBay quand elle se vend ailleurs.'),
    geste: 'Voir lesquelles',
  },
  {
    cle: 'prix-achat', chiffre: 'annonces.prixAchat',
    quand: (v) => estObjet(v) && fini(v.n) && fini(v.m) && v.m >= 5 && v.m - v.n >= 5,
    cibles: ['[data-ann-achats-completer]', '[data-ann-prochain-geste="prix"] [data-ann-prochain-geste-bouton]'],
    titre: 'Des prix d’achat manquent',
    texte: 'Sans eux, ton bénéfice reste incomplet : saisis-les d’un coup.',
    geste: 'Saisie en série',
  },
  {
    cle: 'dorment', chiffre: 'annonces.dorment',
    quand: (v) => fini(v) && v >= 1,
    cibles: ['[data-vue-relancer]'],
    // (8 nov.) « paire » pour un vendeur de sneakers, « article » sinon (`contexte.vend`, src/profilVendeur.js).
    titre: (v, ctx) => (ctx && ctx.vend !== 'sneakers' ? (v > 1 ? 'Des articles dorment' : 'Un article dort') : (v > 1 ? 'Des paires dorment' : 'Une paire dort')),
    texte: (v, ctx) => `En ligne depuis plus de 30 jours : ${v > 1 ? 'regarde-les' : (ctx && ctx.vend !== 'sneakers' ? 'regarde-le' : 'regarde-la')}, tu choisis quoi faire.`,
    geste: (v, ctx) => (ctx && ctx.vend !== 'sneakers' ? 'Voir les articles' : 'Voir les paires'),
  },
  {
    cle: 'prix-mini', chiffre: 'annonces.prixMini',
    quand: (v) => estObjet(v) && v.offresAuto === true && fini(v.total) && fini(v.nbMini) && v.total >= 5 && v.nbMini < 0.2 * v.total,
    cibles: ['[data-vue-selection]'],
    titre: 'Offres automatiques sans seuil',
    texte: 'Coche tes annonces, puis Actions → Prix mini : sans seuil, rien n’est accepté.',
    geste: 'Sélectionner',
  },
  {
    cle: 'inventaire', chiffre: 'stock.inventaire', uneFois: true,
    quand: (v) => estObjet(v) && v.jamais === true && fini(v.numeros) && v.numeros >= 10,
    cibles: ['[data-stock-inventaire-ouvrir]'],
    titre: 'Ton premier inventaire',
    texte: 'Tape les N° de tes articles rangés : VRM te dit ce qui manque.',
    geste: 'Commencer',
  },
  {
    cle: 'extension', chiffre: 'coque.extension', appareil: 'ordinateur', ecrans: ['journee'],
    quand: (v) => v === 'retard',
    cibles: ['[data-nav-entree="settings"]'],
    titre: 'Ton extension est en retard',
    texte: 'Elle lit moins que ce que VRM attend, sans rien dire.',
    geste: 'Voir comment', action: 'reglages:connexions',
  },
  {
    cle: 'ecran-accueil', chiffre: 'coque.iphone', appareil: 'telephone', ecrans: ['journee'],
    quand: (v) => v === 'a-installer',
    cibles: ['.vrm-nav-more'],
    titre: 'VRM sur ton écran d’accueil',
    texte: 'C’est là que l’iPhone laisse passer tes notifications.',
    geste: 'Voir comment', action: 'reglages:push',
  },
];

// ── 3. LA MÉMOIRE ───────────────────────────────────────────────────────────
//   { v: 1, rev, coupe: bool, etats: { [cle]: { vu?, plusTard?, fait?, jamais? } (ms) },
//     vus: [{ c: cle, e: ecran, at }] (les derniers, pour les plafonds du jour) }
export const memoireVide = () => ({ v: 1, coupe: false, etats: {}, vus: [] });
export function normaliserMemoire(d) {
  const m = memoireVide();
  if (!estObjet(d)) return m;
  if (d.rev != null) m.rev = d.rev;
  m.coupe = d.coupe === true;
  if (estObjet(d.etats)) for (const [k, e] of Object.entries(d.etats)) {
    if (!estObjet(e)) continue;
    const x = {};
    for (const f of ['vu', 'plusTard', 'fait', 'jamais']) if (fini(e[f])) x[f] = e[f];
    m.etats[k] = x;
  }
  if (Array.isArray(d.vus)) m.vus = d.vus.filter((x) => estObjet(x) && typeof x.c === 'string' && fini(x.at)).map((x) => ({ c: x.c, e: String(x.e || ''), at: x.at })).slice(-VUS_GARDES);
  return m;
}

// Le jour, à l'heure de Paris (« 2 par jour » = 2 par jour de Julien).
const FMT_JOUR = (() => { try { return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }); } catch (_) { return null; } })();
export const jourDe = (ts) => { const d = new Date(ts); return FMT_JOUR ? FMT_JOUR.format(d) : jourParis(d); };

export const vusDuJour = (memoire, maintenant = Date.now()) => {
  const j = jourDe(maintenant);
  return (memoire && Array.isArray(memoire.vus) ? memoire.vus : []).filter((x) => jourDe(x.at) === j);
};

// Le conseil peut-il reparaître (mémoire lue) ?
export function conseilLibre(c, memoire, maintenant = Date.now()) {
  const e = (memoire && memoire.etats && memoire.etats[c.cle]) || {};
  if (fini(e.jamais)) return false;
  if (c.uneFois && (fini(e.vu) || fini(e.fait) || fini(e.plusTard))) return false;
  const dernier = Math.max(...['vu', 'plusTard', 'fait'].map((f) => (fini(e[f]) ? e[f] : 0)));
  if (dernier > 0 && maintenant - dernier < REPOS_JOURS * JOUR_MS) return false;
  return true;
}

// ── 4. LE SILENCE ───────────────────────────────────────────────────────────
// contexte : { pret, appareilCoupe, tour, exemple, stream, garde, chargement, feuille, telephone }
// Rend la raison de se taire, ou `null`.
export function raisonSilence({ contexte = {}, memoire, enCours = null, ecran = '', maintenant = Date.now() } = {}) {
  const c = contexte || {};
  if (c.pret !== true) return 'pas-pret';
  if (c.appareilCoupe) return 'appareil';
  if (c.tour) return 'tour';
  if (c.exemple) return 'exemple';
  if (c.stream) return 'stream';
  if (c.garde) return 'garde-fou';
  if (c.chargement) return 'chargement';
  if (c.feuille) return 'feuille';
  if (memoire === undefined) return 'memoire-en-cours';
  if (memoire === null || !estObjet(memoire)) return 'memoire-pas-su';
  if (memoire.coupe) return 'coupe';
  if (enCours) return 'en-cours';
  const jour = vusDuJour(memoire, maintenant);
  if (jour.length >= PLAFOND_JOUR) return 'plafond-jour';
  if (jour.filter((x) => x.e === String(ecran || '')).length >= PLAFOND_ECRAN) return 'plafond-ecran';
  return null;
}

// ── 5. LE CHOIX ─────────────────────────────────────────────────────────────
// chiffres : { [cle]: valeur } (`lireChiffres()`). `cibleVisible(cibles)` (facultatif) :
// rend l'élément pointé ou null — un conseil sans cible à l'écran n'est pas choisi.
// Rend { cle, titre, texte, geste, action, cibles, valeur, cible? } ou null.
export function choisirConseil({ ecran = '', chiffres = {}, memoire, contexte = {}, enCours = null, maintenant = Date.now(), catalogue = CONSEILS, cibleVisible = null } = {}) {
  if (raisonSilence({ contexte, memoire, enCours, ecran, maintenant })) return null;
  const appareil = contexte.telephone ? 'telephone' : 'ordinateur';
  for (const c of catalogue) {
    if (c.appareil && c.appareil !== appareil) continue;
    if (Array.isArray(c.ecrans) && !c.ecrans.includes(ecran)) continue;
    const v = chiffres ? chiffres[c.chiffre] : undefined;
    if (v === undefined || v === null) continue;           // en cours · pas su ⇒ rien
    let oui = false;
    try { oui = c.quand(v) === true; } catch (_) { oui = false; }
    if (!oui) continue;
    if (!conseilLibre(c, memoire, maintenant)) continue;
    let cible = null;
    if (typeof cibleVisible === 'function') { cible = cibleVisible(c.cibles); if (!cible) continue; }
    const dire = (x) => (typeof x === 'function' ? x(v, contexte) : x);
    return { cle: c.cle, titre: dire(c.titre), texte: dire(c.texte), geste: dire(c.geste), action: c.action || null, cibles: c.cibles, valeur: v, uneFois: !!c.uneFois, ...(cible ? { cible } : {}) };
  }
  return null;
}

// ── 6. LES GESTES SUR LA MÉMOIRE (purs : rendent une copie) ──────────────────
export function noterVu(memoire, cle, ecran, at = Date.now()) {
  const m = normaliserMemoire(memoire);
  m.etats[cle] = { ...(m.etats[cle] || {}), vu: at };
  m.vus = [...m.vus, { c: cle, e: String(ecran || ''), at }].slice(-VUS_GARDES);
  return m;
}
// reponse : 'plusTard' · 'fait' · 'jamais'
export function noterReponse(memoire, cle, reponse, at = Date.now()) {
  if (!['plusTard', 'fait', 'jamais'].includes(reponse)) return normaliserMemoire(memoire);
  const m = normaliserMemoire(memoire);
  m.etats[cle] = { ...(m.etats[cle] || {}), [reponse]: at };
  return m;
}
export function couperConseils(memoire, coupe) { const m = normaliserMemoire(memoire); m.coupe = !!coupe; return m; }
// « Revoir les conseils » : tout revient (les « Ne plus montrer » aussi), allumé.
export function revoirConseils(memoire) { const m = normaliserMemoire(memoire); m.etats = {}; m.vus = []; m.coupe = false; return m; }

// ── 7. L'ÉCRITURE : lire-fusionner-réécrire, comparer-et-échanger sur `rev` ──
// lire()  → null (lecture ratée) | { existe, data }
// ecrire({ existe, rev, data }) → 'ok' | 'conflit' | 'ko'
// transformer(memoire) → la nouvelle mémoire (ou null : rien à écrire).
// Rend { etat: 'ok' | 'ko' | 'rien', data? }. Une lecture ratée n'écrit RIEN.
export async function modifierMemoire(lire, ecrire, transformer, essais = 3) {
  for (let i = 0; i < essais; i++) {
    let l = null;
    try { l = await lire(); } catch (_) { l = null; }
    if (!l || !estObjet(l)) return { etat: 'ko' };
    const avant = normaliserMemoire(l.data);
    const apres = transformer(avant);
    if (!apres) return { etat: 'rien', data: avant };
    const revLue = l.existe && estObjet(l.data) && l.data.rev != null ? l.data.rev : null;
    const data = { ...normaliserMemoire(apres), rev: (Number(revLue) || 0) + 1 };
    let r = 'ko';
    try { r = await ecrire({ existe: !!l.existe, rev: revLue, data }); } catch (_) { r = 'ko'; }
    if (r === 'ok') return { etat: 'ok', data };
    if (r !== 'conflit') return { etat: 'ko' };
  }
  return { etat: 'ko' };
}

// ── 8. LA PLACE DE LA BULLE ─────────────────────────────────────────────────
// r : le rectangle de la cible ; W × H la fenêtre ; bw × bh la bulle ; `bas` : la
// hauteur réservée en bas (la barre du téléphone). Dessous si ça tient au-dessus de
// la barre, sinon dessus, sinon le côté le plus large (bornée dans l'écran). La
// pointe tombe DANS la cible (son milieu, borné à la bulle et à la cible).
export function placerConseil(r, W, H, bw, bh, { bas = 0, marge = 16, ecart = 12 } = {}) {
  const borne = (v, a, b) => Math.max(a, Math.min(b, v));
  const limite = H - Math.max(0, bas);
  let cote;
  if (r.bottom + ecart + bh + marge <= limite) cote = 'dessous';
  else if (r.top - ecart - bh >= marge) cote = 'dessus';
  else cote = (limite - r.bottom) >= r.top ? 'dessous' : 'dessus';
  const y = cote === 'dessous'
    ? borne(r.bottom + ecart, marge, Math.max(marge, limite - bh - marge))
    : borne(r.top - ecart - bh, marge, Math.max(marge, limite - bh - marge));
  const cx = (r.left + r.right) / 2;
  const x = borne(cx - bw / 2, marge, Math.max(marge, W - bw - marge));
  // La pointe : le milieu de la cible, ramené dans la bulle (14 px des coins) et
  // dans la cible elle-même (une cible collée au bord garde la pointe sur elle).
  const dansBulle = borne(cx - x, 14, bw - 14);
  const flecheX = borne(dansBulle, Math.min(r.right, r.left + 6) - x, Math.max(r.left, r.right - 6) - x);
  return { cote, x: Math.round(x), y: Math.round(y), flecheX: Math.round(flecheX) };
}

// ════════════════════════════════════════════════════════════════════════════
//  9. LES GESTES ACCOMPAGNÉS (14 nov., lot accompagnement) — Julien : « tout doit
//  être plus accompagné dans l'app, chaque action doit être parfaite »,
//  « l'utilisateur ne doit pas se sentir seul ».
//
//  QUATRE MOMENTS pour chaque action qui FAIT quelque chose (pas la navigation) :
//    · AVANT    — ce qui va se passer (avec ses chiffres) ET ce qui ne se passera
//                 PAS (« rien n'est mis en ligne », « rien ne part sans ton clic ») ;
//    · PENDANT  — la progression « 3 / 8 », et « Tout arrêter » quand c'est long
//                 (la feuille « VRM travaille », src/suiviTravail.js, pour les séries) ;
//    · APRÈS    — le résultat en mots (« 8 bordereaux dans le PDF ») et le geste
//                 suivant (« Ensuite : les déposer › ») ;
//    · ÉCHEC    — « Pas fait : <raison simple>. <geste> › », jamais un code ni
//                 « erreur » tout court.
//  ⚠️ Décision de Julien (14 nov.) : AUCUN nouvel « Annuler 5 s », AUCUNE nouvelle
//     confirmation, AUCUN « ? » ni vidéo par action. Ce qui existe (la pilule de
//     src/gesteAnnulable.js, askConfirm, le « ? » de l'écran) ne change pas.
//  ⚠️ Aucune règle métier ici : ce module NOMME les gestes, leur suite et la raison
//     d'un échec ; il ne décide rien, ne fait aucun geste, n'écrit rien en base.
//  Les TEXTES sont des clés (`acc.<geste>.avant|pas|apres|ensuite`, `acc.raison.*`,
//  `acc.geste.*`) traduites par tr() dans src/ui/Accompagne.jsx
//  (src/i18n/langues/<langue>/accompagnement.js).
//  Le banc : scripts/bancs/accompagnement.cjs (data-acc-avant / -pendant / -apres / -echec).
// ════════════════════════════════════════════════════════════════════════════

// Le catalogue : un geste = son écran, la sorte de la feuille « VRM travaille » qui le
// suit quand c'est une série (`sorte`), et sa SUITE (le lien du geste d'après, ou rien).
// `ensuite.lien` passe par le chemin des notifications (`?tab=…`, comme l'aide).
export const GESTES_ACC = {
  'colis.imprimer':   { ecran: 'colis',     sorte: 'bordereaux',            ensuite: { lien: '?tab=cat_bord' } },
  'colis.generer':    { ecran: 'colis',     ensuite: { lien: '?tab=cat_bord' } },
  'colis.depose':     { ecran: 'colis',     ensuite: { lien: '?tab=cat_bord' } },
  'colis.retire':     { ecran: 'colis',     sorte: 'retirer-ailleurs',      ensuite: { lien: '?tab=garage' } },
  'achat.relier':     { ecran: 'achats',    ensuite: { lien: '?tab=argent' } },
  'prix.achat':       { ecran: 'annonces',  ensuite: { lien: '?tab=argent' } },
  'offre.vinted':     { ecran: 'messages',  ensuite: { lien: '?tab=messages' } },
  'offre.vestiaire':  { ecran: 'vestiaire', ensuite: { lien: '?tab=plat_vestiaire' } },
  'offre.ebay':       { ecran: 'ebay',      ensuite: { lien: '?tab=plat_ebay' } },
  'favoris.messages': { ecran: 'messages',  sorte: 'favoris',               ensuite: { lien: '?tab=messages' } },
  'prix.baisser':     { ecran: 'annonces',  sorte: 'baisse-prix',           ensuite: { lien: '?tab=annonces' } },
  'prix.baisserLbc':  { ecran: 'leboncoin', ensuite: { lien: '?tab=plat_leboncoin' } },
  'prix.baisserVc':   { ecran: 'vestiaire', sorte: 'baisse-prix-vestiaire', ensuite: { lien: '?tab=plat_vestiaire' } },
  'republier':        { ecran: 'annonces',  ensuite: { lien: '?tab=annonces' } },
  'republier.lbc':    { ecran: 'leboncoin', sorte: 'republier-lbc',         ensuite: { lien: '?tab=plat_leboncoin' } },
  'publier.lbc':      { ecran: 'leboncoin', sorte: 'publier-lbc',           ensuite: { lien: '?tab=plat_leboncoin' } },
  'publier.vinted':   { ecran: 'annonces',  sorte: 'publier-fiche-vinted',  ensuite: { lien: '?tab=annonces' } },
  'creer.vinted':     { ecran: 'annonces',  sorte: 'creer-vinted',          ensuite: { lien: 'https://www.vinted.fr/items/drafts', dehors: true } },
  'publier.partout':  { ecran: 'annonces',  sorte: 'publier-partout',       ensuite: { lien: '?tab=annonces' } },
  'publier.ebay':     { ecran: 'ebay',      sorte: 'publier-ebay',          ensuite: { lien: '?tab=plat_ebay' } },
  'lbc.supprimer':    { ecran: 'leboncoin', ensuite: { lien: '?tab=plat_leboncoin' } },
  'vacances':         { ecran: 'settings',  sorte: 'vacances',              ensuite: { lien: '?tab=settings&reglage=vacances' } },
  'urssaf.declarer':  { ecran: 'compta',    ensuite: { lien: '?tab=argent_declarer' } },
  'facture.pro':      { ecran: 'compta',    ensuite: { lien: '?tab=invoices' } },
  'lien.partage':     { ecran: 'settings',  ensuite: null },
  'connexion.qr':     { ecran: 'settings',  ensuite: { lien: '?tab=journee' } },
  'fiches.fusion':    { ecran: 'garage',    ensuite: { lien: '?tab=garage' } },
  'export.donnees':   { ecran: 'settings',  ensuite: null },
  'export.comptable': { ecran: 'compta',    ensuite: null },
  'compte.supprimer': { ecran: 'settings',  ensuite: null },
};
export const IDS_GESTES_ACC = Object.keys(GESTES_ACC);
export const gesteAcc = (id) => GESTES_ACC[id] || null;
// La sorte d'un travail suivi ⇒ son geste (la feuille « VRM travaille » porte `data-acc-pendant`).
const PAR_SORTE = { bordereaux: 'colis.imprimer', 'retirer-ailleurs': 'colis.retire', 'baisse-prix': 'prix.baisser', 'baisse-lbc': 'prix.baisserLbc', 'baisse-prix-vestiaire': 'prix.baisserVc',
  'republier-lbc': 'republier.lbc', 'publier-lbc': 'publier.lbc', 'publier-partout': 'publier.partout', 'publier-ebay': 'publier.ebay', 'creer-vinted': 'creer.vinted', 'publier-fiche-vinted': 'publier.vinted', vacances: 'vacances', favoris: 'favoris.messages' };
export const gesteDeSorte = (sorte) => PAR_SORTE[String(sorte || '')] || '';

// ── LA RAISON D'UN ÉCHEC, EN MOTS SIMPLES ────────────────────────────────────
// Un échec arrive sous mille formes : une Error, une réponse `{ ok:false, error }`,
// `{ status: 429 }`, `{ envoye:false }` (aucune extension ici), une phrase déjà écrite
// par l'écran. On en tire UNE raison connue (sa phrase et son geste sont traduits),
// et on garde la phrase de l'écran quand elle est déjà lisible (jamais un code).
export const RAISONS_ACC = ['horsligne', 'reseau', 'limite', 'session', 'refus', 'extension', 'onglet', 'serveur', 'pasSu', 'inconnu'];
// Le geste qui répare chaque raison : `lien` (chemin de l'app ou site) ou `reessayer`.
export const GESTES_RAISON = {
  horsligne: { reessayer: true },
  reseau:    { reessayer: true },
  limite:    { lien: '?tab=settings&reglage=toutvabien' },
  session:   { lien: '?tab=settings&reglage=connexions' },
  refus:     { lien: '?tab=settings&reglage=toutvabien' },
  extension: { lien: '?tab=settings&reglage=verifier' },
  onglet:    { lien: 'https://www.vinted.fr', dehors: true },
  serveur:   { reessayer: true },
  pasSu:     { lien: '?tab=settings&reglage=toutvabien' },
  inconnu:   { lien: '?tab=settings&reglage=depannage' },
};
const texteDe = (x) => {
  if (x == null) return '';
  if (typeof x === 'string') return x;
  if (x instanceof Error) return String(x.message || '');
  if (typeof x === 'object') return String(x.raison || x.error || x.erreur || x.message || x.msg || '');
  return String(x);
};
// Une phrase « technique » ne se montre pas telle quelle (§2.7) : un code HTTP, un nom
// d'exception, du JSON, « undefined », un chemin d'API, de l'anglais de navigateur.
export function phraseTechnique(t) {
  const s = String(t || '').trim();
  if (!s) return true;
  return /\b(?:TypeError|ReferenceError|SyntaxError|AbortError|Error|undefined|null|NaN|stack|fetch|JSON|HTTP|status|ECONN\w*|ERR_\w*)\b|\b[1-5]\d\d\b|[{}<>]|\/api\/|\/rest\/|Failed to|NetworkError|Load failed|timed? ?out/i.test(s);
}
export function raisonEchec(x, { enLigne = (typeof navigator !== 'undefined' ? navigator.onLine !== false : true) } = {}) {
  if (x && typeof x === 'object' && x.horsLigne) return 'horsligne';
  if (!enLigne) return 'horsligne';
  const st = x && typeof x === 'object' ? Number(x.status || x.statut || x.code) : NaN;
  const t = texteDe(x);
  if (st === 429 || /\b429\b|trop de requ|ralenti|freine|rate.?limit/i.test(t)) return 'limite';
  if (st === 401 || /\b401\b|session|reconnect|jwt|expir/i.test(t)) return 'session';
  if (x && typeof x === 'object' && x.envoye === false) return 'extension';
  if (/extension/i.test(t)) return 'extension';
  if (/onglet|vinted\.fr ouvert|ouvre vinted|ouvre leboncoin|ouvre vestiaire/i.test(t)) return 'onglet';
  if (st === 403 || /\b403\b|refus|interdit|captcha|forbidden/i.test(t)) return 'refus';
  if (x && typeof x === 'object' && x.sansReponse) return 'pasSu';
  if (/pas su\b|pas de réponse à temps|n'a pas répondu|n’a pas répondu/i.test(t)) return 'pasSu';
  if (x instanceof TypeError || /failed to fetch|networkerror|load failed|réseau|reseau|network|hors ligne|offline|timed? ?out/i.test(t)) return 'reseau';
  if (st >= 500 || /\b5\d\d\b|serveur|indisponible|unavailable/i.test(t)) return 'serveur';
  return 'inconnu';
}
// { code, texte } : la raison connue, et la phrase de l'écran si elle est lisible (sinon '').
export function lireEchec(x, opts) {
  const code = raisonEchec(x, opts);
  const t = texteDe(x).trim().replace(/^[⚠️❌✗\s]+/u, '').replace(/^(?:erreur|échec|echec)\s*[:·—-]\s*/i, '');
  return { code, texte: phraseTechnique(t) ? '' : t.replace(/[.\s]+$/, '') };
}

// ── LE MAGASIN DES GESTES EN COURS (l'hôte de la coque le dessine) ────────────
// Un geste à la fois par sorte de geste ; l'hôte montre les plus récents. Pur :
// minuterie en paramètre (l'audit l'exécute). `phase` : 'pendant' | 'apres' | 'echec'.
let _gestes = [];
const _abonnesGestes = new Set();
let _idGeste = 0;
const _emettreGestes = () => { const v = _gestes.slice(); for (const f of [..._abonnesGestes]) { try { f(v); } catch (_) {} } };
export const lireGestes = () => _gestes;
export function abonnerGestes(f) { _abonnesGestes.add(f); return () => _abonnesGestes.delete(f); }
export const DUREE_APRES = 7000;     // ms : le résultat se lit, puis s'en va (jamais un bandeau qui reste)
export const DUREE_ECHEC_ACC = 12000; // ms : un échec reste plus longtemps (il demande un geste)
export const SEUIL_LONG = 3;         // à partir de 3 éléments, « Tout arrêter » est proposé
const _minuteurs = new Map();
function _poser(g, minuterie) {
  _gestes = [..._gestes.filter((x) => x.id !== g.id && x.geste !== g.geste).slice(-2), g];
  _emettreGestes();
  clearTimeout(_minuteurs.get(g.id));
  const ms = g.phase === 'apres' ? DUREE_APRES : g.phase === 'echec' ? DUREE_ECHEC_ACC : 0;
  if (ms && minuterie) _minuteurs.set(g.id, minuterie(() => oublierGeste(g.id), ms));
}
export function oublierGeste(id) {
  clearTimeout(_minuteurs.get(id)); _minuteurs.delete(id);
  const n = _gestes.length; _gestes = _gestes.filter((x) => x.id !== id);
  if (_gestes.length !== n) _emettreGestes();
}
// const g = accompagner('colis.generer', { total: 8 }) ⇒ g.pendant(3) · g.fini({ n: 8 }) ·
// g.echec(err, { reessayer }) · g.arretDemande() (« Tout arrêter » touché).
export function accompagner(geste, { total = 0, vars = {}, minuterie = (typeof setTimeout !== 'undefined' ? setTimeout : null), arretable = null } = {}) {
  const id = ++_idGeste;
  let arret = false;
  const base = { id, geste, total: Number(total) || 0, vars: vars || {} };
  const long = (Number(total) || 0) >= SEUIL_LONG;
  const g = {
    id, geste,
    pendant(fait = 0, extra = {}) { _poser({ ...base, ...extra, phase: 'pendant', fait: Number(fait) || 0, arretable: arretable != null ? !!arretable : long, arreter: () => { arret = true; } }, null); return g; },
    fini(v = {}) { _poser({ ...base, phase: 'apres', vars: { ...base.vars, ...v }, at: Date.now() }, minuterie); return g; },
    echec(err, { reessayer = null } = {}) { const e = lireEchec(err); _poser({ ...base, phase: 'echec', raison: e.code, texte: e.texte, reessayer, at: Date.now() }, minuterie); return g; },
    arretDemande: () => arret,
    oublier: () => oublierGeste(id),
  };
  return g;
}

// ── LES PREMIÈRES FOIS (une phrase d'aide discrète par écran, désactivable) ────
// Mémoire de CET appareil (un confort : `{ coupe, vus:[ecran] }`). Lecture ratée ⇒ rien
// n'est montré deux fois de force : on suppose « déjà vu » seulement si la lecture a réussi.
export const CLE_PREMIERES = 'vrm_premieres_fois';
export const ECRANS_PREMIERE = ['journee', 'ventes', 'colis', 'annonces', 'achats', 'garage', 'messages', 'emails', 'compta', 'settings'];
export function lirePremieres(stockage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  try {
    const v = JSON.parse((stockage && stockage.getItem(CLE_PREMIERES)) || 'null');
    if (v && typeof v === 'object') return { coupe: !!v.coupe, vus: Array.isArray(v.vus) ? v.vus.map(String) : [] };
  } catch (_) {}
  return { coupe: false, vus: [] };
}
export function ecrirePremieres(m, stockage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  try { if (!stockage) return false; stockage.setItem(CLE_PREMIERES, JSON.stringify({ coupe: !!(m && m.coupe), vus: [...new Set((m && m.vus) || [])].slice(-40) })); return true; } catch (_) { return false; }
}
export const premiereAMontrer = (ecran, m) => !!ecran && ECRANS_PREMIERE.includes(ecran) && !(m && m.coupe) && !((m && m.vus) || []).includes(ecran);
