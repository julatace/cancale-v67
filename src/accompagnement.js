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
const plur = (n, s, p) => `${n} ${n > 1 ? p : s}`;

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
    texte: (v) => `${plur(v.nLot, 'bordereau est prêt', 'bordereaux sont prêts')} : un seul PDF, rangé par transporteur.`,
    geste: 'Tout imprimer',
  },
  {
    cle: 'comptes-muets', chiffre: 'colis.comptesMuets',
    quand: (v) => fini(v) && v >= 1,
    cibles: ['[data-colis-comptes-muets-ouvrir]'],
    titre: (v) => (v > 1 ? 'Des comptes sans e-mail' : 'Un compte sans e-mail'),
    texte: (v) => `${v > 1 ? 'Leurs' : 'Ses'} codes de retrait et bordereaux n’arrivent pas jusqu’ici.`,
    geste: 'Relier maintenant',
  },
  {
    cle: 'ebay-relier', chiffre: 'ebay.aRelier',
    quand: (v) => fini(v) && v >= 1,
    cibles: ['[data-ebay-filtre="relier"]'],
    titre: (v) => (v > 1 ? `${v} annonces eBay à relier` : 'Une annonce eBay à relier'),
    texte: 'Reliée à son article, VRM la retire d’eBay quand elle se vend ailleurs.',
    geste: 'Voir lesquelles',
  },
  {
    cle: 'prix-achat', chiffre: 'annonces.prixAchat',
    quand: (v) => estObjet(v) && fini(v.n) && fini(v.m) && v.m >= 5 && v.m - v.n >= 5,
    cibles: ['[data-ann-achats-completer]', '[data-ann-prochain-geste="prix"] [data-ann-prochain-geste-bouton]'],
    titre: 'Des prix d’achat manquent',
    texte: (v) => `${v.m - v.n} sur ${v.m} : sans eux, ton bénéfice reste incomplet.`,
    geste: 'Saisie en série',
  },
  {
    cle: 'dorment', chiffre: 'annonces.dorment',
    quand: (v) => fini(v) && v >= 1,
    cibles: ['[data-vue-relancer]'],
    titre: (v) => (v > 1 ? `${v} paires dorment` : 'Une paire dort'),
    texte: 'En ligne depuis plus de 30 jours : regarde-les, tu choisis quoi faire.',
    geste: 'Voir les paires',
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
    texte: 'Tape les N° de tes cartons : VRM te dit ce qui manque.',
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
export const jourDe = (ts) => { const d = new Date(ts); return FMT_JOUR ? FMT_JOUR.format(d) : d.toISOString().slice(0, 10); };

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
    const dire = (x) => (typeof x === 'function' ? x(v) : x);
    return { cle: c.cle, titre: dire(c.titre), texte: dire(c.texte), geste: c.geste, action: c.action || null, cibles: c.cibles, valeur: v, uneFois: !!c.uneFois, ...(cible ? { cible } : {}) };
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
