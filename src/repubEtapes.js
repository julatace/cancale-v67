// ════════════════════════════════════════════════════════════════════════════
//  REPUBLIER, ÉTAPE PAR ÉTAPE (17 nov., extension 5.408 — `repubetapes`, `repubreprise`)
//
//  Julien : « tout doit être parfait […] occupe-toi de la republication, de annonce à
//  brouillon et de brouillon à en ligne ».
//  Mesuré en base (lecture seule, 17 nov.) : 10 republications parties (28 oct. → 1er nov.),
//  10 brouillons créés, 10 anciennes supprimées, AUCUNE mise en ligne du premier coup
//  (mise en ligne refusée par Vinted, photos) ; 5 sont restées « brouillon prêt, ancienne
//  supprimée » 16 jours sans que l'écran ne propose le bon geste.
//
//  Règle PURE (exécutée par scripts/audit-republication-parfaite.cjs) :
//   · `chaineRepub` — où en est UNE paire, dans l'ordre réel (celui de l'extension,
//     « comme Vintex », 29 oct.) : coffre → brouillon → supprimée → en ligne. Une étape
//     n'est « faite » que si l'extension l'a ANNONCÉE ou RENDUE (jamais déduite d'un délai) ;
//   · `planRepub` — « 12 paires · environ 40 min · fin vers 15:10 » : SES attentes (le plan
//     tiré à l'écran) + le temps d'une paire chez Vinted + la mise en ligne (1 à 3 min) ;
//   · `resumeRepub` — après : combien en ligne, combien prévues, et UN geste par problème
//     (choisir la valeur manquante · reprendre · recréer depuis le coffre · réessayer ·
//     vérifier sur Vinted). Une paire « pas su » n'est jamais comptée en ligne.
// ════════════════════════════════════════════════════════════════════════════

export const CHAINE = ['coffre', 'brouillon', 'supprimee', 'enligne'];
export const CHAINE_VERS_BROUILLON = ['coffre', 'brouillon', 'supprimee'];
// L'étape annoncée par l'extension (`maj · repub · etape`) ⇒ combien d'étapes de la chaîne
// sont FAITES quand elle commence (« brouillon » annoncé = le coffre est fait).
const AVANT = { lecture: 0, photos: 0, enregistrement: 0, complete: 0, brouillon: 1, suppression: 2, attente: 3, 'en-ligne': 3 };
// Temps d'une paire chez Vinted (lecture 1,5–4 s, photos 2–4,5 s chacune, brouillon,
// suppression, réseau) — une MOYENNE dite « environ », jamais promise.
export const PAIRE_S = 45;
export const MISE_EN_LIGNE_S = 120;   // la mise en ligne planifiée : 1 à 3 min après le brouillon

const fini = (n) => Number.isFinite(Number(n)) && Number(n) > 0;

// s = résultat rendu par l'extension pour la paire ({ etat, jusqua, question… }) ; p = sa
// dernière étape annoncée ({ etape }). Rend { etapes:[{ k, etat }], faites, enLigneA, probleme }.
// etat d'une étape : 'faite' · 'encours' · 'attente' · 'probleme'.
export function chaineRepub(s, p, { action = 'recreer' } = {}) {
  const liste = action === 'versBrouillon' ? CHAINE_VERS_BROUILLON : CHAINE;
  const x = s && typeof s === 'object' ? s : {};
  const e = p && typeof p === 'object' && typeof p.etape === 'string' ? p.etape : '';
  const annoncees = e in AVANT ? AVANT[e] : null;
  let faites = 0, encours = null, probleme = null, enLigneA = null;
  if (x.etat === 'fait') faites = liste.length;
  else if (x.etat === 'planifiee') { faites = 3; encours = 3; enLigneA = fini(x.jusqua) ? Number(x.jusqua) : null; }
  else if (x.etat === 'encours') { faites = annoncees || 0; encours = Math.min(faites, liste.length - 1); }
  else if (x.etat === 'a-refaire') { faites = 3; probleme = 3; }
  else if (x.etat === 'echec' || x.etat === 'incertain' || x.etat === 'double') {
    // Rien d'annoncé ⇒ rien n'a bougé chez Vinted (la paire n'est pas partie).
    faites = annoncees || 0;
    probleme = annoncees == null ? null : Math.min(faites, liste.length - 1);
  }
  faites = Math.max(0, Math.min(liste.length, faites));
  const etapes = liste.map((k, i) => ({ k, etat: i < faites ? 'faite' : i === probleme ? 'probleme' : i === encours ? 'encours' : 'attente' }));
  return { etapes, faites, enLigneA, probleme: probleme == null ? null : liste[probleme], partie: faites > 0 || encours != null };
}

// attentes = secondes AVANT chaque paire sauf la première (le plan affiché), dans l'ordre.
export function planRepub({ n, attentes = [], maintenant = Date.now(), action = 'recreer' } = {}) {
  const k = Math.max(0, Math.floor(Number(n) || 0));
  if (!k) return null;
  const att = (Array.isArray(attentes) ? attentes : []).slice(0, Math.max(0, k - 1)).reduce((t, v) => t + (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0), 0);
  const sec = Math.round(att + k * PAIRE_S + (action === 'recreer' ? MISE_EN_LIGNE_S : 0));
  return { n: k, sec, fin: maintenant + sec * 1000 };
}

// La durée en clair (« 40 min », « 1 h 05 », « 45 s ») — chiffres seulement, la langue met l'unité.
export function dureeCourte(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  if (s < 60) return { u: 's', s };
  if (s < 3600) return { u: 'min', min: Math.max(1, Math.round(s / 60)) };
  return { u: 'h', h: Math.floor(s / 3600), min: String(Math.round((s % 3600) / 60)).padStart(2, '0') };
}

// Le geste d'UNE paire qui n'est pas allée au bout (un seul). `peut` = { reprendre, refaire, reessayer }.
export function gesteProbleme(s, p, peut = {}) {
  const x = s && typeof s === 'object' ? s : {};
  if (x.etat === 'fait' || x.etat === 'planifiee' || x.etat === 'encours' || !x.etat) return null;
  const ch = chaineRepub(x, p);
  if (x.question && x.question.champ) return { probleme: 'champ', nom: x.question.nom || '', geste: 'choisir' };
  // Supprimée et SANS brouillon connu : la paire se recrée depuis le coffre (VRM a tout gardé).
  if (x.etat === 'a-refaire' && !x.draftId) return { probleme: 'pas-en-ligne', geste: peut.reprendre || peut.refaire ? 'refaire' : 'verifier' };
  if (x.etat === 'a-refaire') return { probleme: 'pas-en-ligne', geste: peut.reprendre ? 'reprendre' : peut.refaire ? 'refaire' : 'verifier' };
  if (x.etat === 'incertain' || x.etat === 'double') return { probleme: 'pas-su', geste: peut.reprendre && ch.partie ? 'reprendre' : 'verifier' };
  // Un échec APRÈS des gestes chez Vinted (brouillon fait, suppression refusée…) : reprendre d'où c'est.
  if (ch.partie || x.draftId) return { probleme: 'arretee', geste: peut.reprendre ? 'reprendre' : 'verifier' };
  return { probleme: 'pas-partie', geste: peut.reessayer ? 'reessayer' : null };
}

// paires = [{ id, titre, numero }] dans l'ordre ; st = { [id]: s } ; prog = { [id]: p }.
export function resumeRepub(paires, st, prog, peut = {}) {
  const l = Array.isArray(paires) ? paires : [];
  let enLigne = 0, prevues = 0;
  const aFinir = [];
  for (const a of l) {
    const s = (st && st[a.id]) || {};
    if (s.etat === 'fait') { enLigne++; continue; }
    if (s.etat === 'planifiee') { prevues++; continue; }
    const g = gesteProbleme(s, prog && prog[String(a.id)], peut);
    if (g) aFinir.push({ id: a.id, titre: a.titre || '', numero: a.numero || '', ...g });
  }
  return { total: l.length, enLigne, prevues, aFinir };
}
