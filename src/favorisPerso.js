// ════════════════════════════════════════════════════════════════════════
// LE TEXTE D'UN MESSAGE AUX FAVORIS, PERSONNALISÉ (21 nov., ext. 5.417, `favorisperso2`)
// ════════════════════════════════════════════════════════════════════════
// Julien (21 nov.) : « pour les messages aux favoris ça doit être beaucoup mieux, on n'a pas la possibilité de
// personnaliser, améliore ça » (modèle : Bleam — versions tirées au hasard, message « lot », messages conditionnels,
// variables insérables, compteur d'envois par version).
// Le réglage (normalisé par `fpReglage`, bloc <reglages-auto-ligne>) vit dans `vrm_reglages_auto`,
// `vinted_bleam.comptes[uid].favMessages`. Ce bloc est la SEULE règle qui choisit le texte : le moteur d'envoi de
// l'extension (background.js, `executerMessageFavori`) l'appelle une fois par favori, l'aperçu du panneau aussi.
//
// LES RÈGLES (chacune tenue par scripts/audit-favoris-perso.cjs, mutations comprises) :
//  1. Variables : {prénom} {article} {marque} {taille} {prix} {prix_offre} {remise} (+ {pseudo}, {username}, {a|b}
//     d'avant). Une variable dont la valeur n'est PAS SUE pour ce favori rend la version inutilisable : jamais un trou,
//     jamais une valeur devinée. {prénom} : Vinted ne donne aucun prénom sûr dans le fil ⇒ le PSEUDO (lu dans le fil),
//     jamais un prénom tiré du pseudo. {article} garde « cet article » quand le titre manque (règle d'avant).
//     {prix} = l'offre faite, sinon le prix de l'annonce (règle d'avant) ; {prix_offre} et {remise} exigent une offre.
//  2. Cas, dans l'ordre : « lot » (la personne a aimé au moins 2 articles du compte, une fois par personne — `lotPermis`),
//     puis UNE règle conditionnelle (la plus PRÉCISE : le plus de conditions ; à égalité, la plus HAUTE dans sa liste),
//     puis « 1 article ». Une règle ne s'applique que si TOUTES ses conditions sont vraies, et une condition sur une
//     valeur pas sue (prix, marque) est FAUSSE (« pas su » ne vaut pas « oui »). Si aucune version du cas retenu ne
//     peut partir, on passe au cas suivant (le « 1 article » reste toujours possible : l'enregistrement exige une
//     version sans {marque} {taille} {prix_offre} {remise}).
//  3. Une version qui ferait refuser le compte (`sur` = la règle des mots interdits, texteSurVinted) ou que Vinted a
//     déjà refusée (`refusee`) n'est jamais tirée.
//  4. Au hasard parmi les versions possibles, jamais celle du dernier message à CET acheteur, puis jamais celle du
//     dernier message du compte (quand une autre est possible).
//  5. Les textes d'avant (`vrm_favoris_reglages_{uid}` : message + variantes, et le message lot de « comme Bleam »)
//     restent la source tant qu'il n'a pas écrit de version « 1 article » ici : « Message 1 » = son ancien texte.
// Le bloc est RECOPIÉ tel quel dans vinted-sync-extension/background.js (node scripts/audit-favoris-perso.cjs --recopie).
// Il lit `fpReglage` (bloc <reglages-auto-ligne>, présent dans les deux fichiers).
import { fpReglage, FP_TEXTE_MAX } from './reglagesAutoLigne.js';
// <favoris-perso-regle>
const FP_VARS = { 'prénom': 'prenom', prenom: 'prenom', pseudo: 'pseudo', username: 'pseudo', article: 'article', marque: 'marque', taille: 'taille', prix: 'prix', prix_offre: 'prix_offre', remise: 'remise' };
// Variables qui peuvent manquer pour un favori (la version qui les porte est alors sautée).
const FP_INCERTAINES = ['marque', 'taille', 'prix_offre', 'remise'];
const FP_SEUIL_MESURE = 10;              // moins d'envois ⇒ « non mesuré »
const FP_VENDU_JOURS = 14;               // vendu dans les 14 j après le message (annonce du message = annonce vendue)
// Les variables d'un texte : { vars: Set des noms canoniques, inconnue: '{x}' ou '', accolade: bool }.
function fpLireVariables(modele) {
  const vars = new Set(); let inconnue = '';
  const reste = String(modele == null ? '' : modele).replace(/\{([^{}]*)\}/g, (tout, d) => {
    const k = Object.prototype.hasOwnProperty.call(FP_VARS, d) ? FP_VARS[d] : '';
    if (k) { vars.add(k); return ''; }
    const o = d.split('|'); if (o.length >= 2 && o.every((x) => x.length <= 200)) return '';
    if (!inconnue) inconnue = tout.slice(0, 40); return '';
  });
  return { vars, inconnue, accolade: /[{}]/.test(reste) };
}
// L'erreur d'écriture d'un texte (rien = '') : vide, trop long, variable inconnue, accolade pas fermée.
function fpErreurTexte(modele) {
  const t = String(modele == null ? '' : modele);
  if (!t.trim()) return 'vide';
  if (t.trim().length > FP_TEXTE_MAX) return 'long';
  const v = fpLireVariables(t);
  if (v.inconnue) return 'variable';
  if (v.accolade) return 'accolade';
  return '';
}
// Une version « sûre » : n'utilise que des variables toujours connues (l'enregistrement en exige une en « 1 article »).
const fpVersionSure = (t) => !fpErreurTexte(t) && !FP_INCERTAINES.some((k) => fpLireVariables(t).vars.has(k));
const fpEuros = (v) => { const n = Number(v); if (!(isFinite(n) && n > 0)) return ''; const c = Math.round(n * 100); return (c % 100 ? (c / 100).toFixed(2).replace('.', ',') : String(c / 100)) + ' €'; };
const fpPropre = (s, n) => (typeof s === 'string' ? s.replace(/[{}\s]+/g, ' ').trim().slice(0, n) : '');
// Les valeurs SUES pour ce favori ('' = pas su). `fav` : { pseudo, article, marque, taille, prix } ; `offre` : { prix } ou null.
function fpValeurs(fav, offre) {
  const f = fav && typeof fav === 'object' ? fav : {};
  const pseudo = fpPropre(f.pseudo, 80);
  const prix = Number(f.prix) > 0 ? Number(f.prix) : null, po = offre && Number(offre.prix) > 0 ? Number(offre.prix) : null;
  const remise = prix && po && po < prix ? Math.round((1 - po / prix) * 100) : 0;
  return { prenom: pseudo, pseudo, article: fpPropre(f.article, 80) || 'cet article', marque: fpPropre(f.marque, 40), taille: fpPropre(f.taille, 30),
    prix: fpEuros(po != null ? po : prix), prix_offre: po != null ? fpEuros(po) : '', remise: remise > 0 ? remise + ' %' : '' };
}
// Les variables d'un texte dont la valeur n'est pas sue pour ce favori.
function fpManque(modele, val) { return [...fpLireVariables(modele).vars].filter((k) => !val[k]); }
// Pose les variables NOUVELLES ({prénom} {marque} {taille} {prix_offre} {remise}) ; laisse {pseudo} {username}
// {article} {prix} {a|b} à `personnaliserMessageFavori` (la règle d'avant, inchangée, qui les pose à l'envoi).
function fpPreremplir(modele, val) {
  return String(modele == null ? '' : modele).replace(/\{([^{}]*)\}/g, (tout, d) => {
    const k = Object.prototype.hasOwnProperty.call(FP_VARS, d) ? FP_VARS[d] : '';
    if (k === 'prenom' || k === 'marque' || k === 'taille' || k === 'prix_offre' || k === 'remise') return val[k] || tout;
    return tout;
  });
}
// L'heure et le jour de Paris (0 = dimanche) au moment `t`.
function fpContexteParis(t) {
  const d = new Date(Number.isFinite(Number(t)) ? Number(t) : Date.now());
  try {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', hour: 'numeric', hourCycle: 'h23', weekday: 'short' }).formatToParts(d);
    const h = Number((p.find((x) => x.type === 'hour') || {}).value), w = (p.find((x) => x.type === 'weekday') || {}).value;
    const j = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(w);
    if (Number.isInteger(h) && j >= 0) return { heure: h % 24, jour: j };
  } catch (_) { /* Intl absent */ }
  return { heure: d.getHours(), jour: d.getDay() };
}
const fpNormMarque = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// Le nombre de conditions d'une règle (sa PRÉCISION).
const fpPrecision = (r) => (r.heures ? 1 : 0) + (r.jours ? 1 : 0) + (r.prix ? 1 : 0) + (r.marques ? 1 : 0);
// Une règle s'applique-t-elle ? Toutes ses conditions vraies ; une valeur pas sue rend sa condition FAUSSE.
function fpRegleVraie(r, ctx, fav) {
  if (!r || !fpPrecision(r)) return false;
  if (r.heures) { const h = Number(ctx && ctx.heure); if (!Number.isInteger(h)) return false; const { de, a } = r.heures; if (!(de < a ? h >= de && h < a : h >= de || h < a)) return false; }
  if (r.jours) { const j = Number(ctx && ctx.jour); if (!r.jours.includes(j)) return false; }
  if (r.prix) { const p = Number(fav && fav.prix); if (!(p > 0)) return false; if (r.prix.min != null && p < r.prix.min) return false; if (r.prix.max != null && p > r.prix.max) return false; }
  if (r.marques) { const m = fpNormMarque(fav && fav.marque); if (!m || !r.marques.some((x) => fpNormMarque(x) === m)) return false; }
  return true;
}
// Les règles qui s'appliquent, dans l'ordre où elles sont essayées : la plus précise, puis la plus haute.
function fpReglesApplicables(regles, ctx, fav) {
  return (Array.isArray(regles) ? regles : []).map((r, i) => ({ r, i })).filter((x) => fpRegleVraie(x.r, ctx, fav))
    .sort((x, y) => fpPrecision(y.r) - fpPrecision(x.r) || x.i - y.i).map((x) => x.r);
}
// Les groupes de versions essayés, dans l'ordre. `ancien` : { message, variantes, lot } (les textes d'avant).
function fpGroupes(reglage, ancien, ctx, fav, lotPermis) {
  const R = reglage && typeof reglage === 'object' ? fpReglage(reglage) : null;
  const g = [];
  if (R && R.un.length) {
    if (lotPermis && R.lot.length) g.push({ cas: 'lot', regle: null, versions: R.lot.map((v) => ({ cle: v.id, n: null, lot: true, modele: v.texte })) });
    for (const r of fpReglesApplicables(R.regles, ctx, fav)) g.push({ cas: 'regle', regle: r.id, versions: r.textes.map((v) => ({ cle: v.id, n: null, modele: v.texte })) });
    g.push({ cas: 'un', regle: null, versions: R.un.map((v, i) => ({ cle: v.id, n: i < 5 ? i + 1 : null, modele: v.texte })) });
    return { source: 'perso', groupes: g };
  }
  const a = ancien && typeof ancien === 'object' ? ancien : {};
  if (lotPermis && typeof a.lot === 'string' && a.lot.trim() && a.lot.length <= FP_TEXTE_MAX) g.push({ cas: 'lot', regle: null, versions: [{ cle: 'lot', n: 0, lot: true, modele: a.lot.trim() }] });
  const l = [a.message].concat(Array.isArray(a.variantes) ? a.variantes : []).slice(0, 5);
  g.push({ cas: 'un', regle: null, versions: l.map((t, i) => ({ cle: 'a' + (i + 1), n: i + 1, modele: typeof t === 'string' ? t.trim() : '' })).filter((v) => v.modele) });
  return { source: 'ancien', groupes: g };
}
// ── LE CHOIX ──────────────────────────────────────────────────────────────
// x = { reglage, ancien, fav, offre ({ prix } ou null), ctx ({ heure, jour }), lotPermis, sur(texte)→bool,
//       refusee(modele)→bool, derniere: { acheteur, compte } (clés de version), hasard,
//       deja(modele)→bool (5.441 : ce texte a DÉJÀ été envoyé à CETTE personne pour CET article) }
// → { ok: true, source, cas, regle, version: { cle, n, lot, modele, texte }, possibles }  (`texte` = variables nouvelles posées)
//   { ok: false, source, raison: 'aucun_message' | 'texte_interdit' | 'variable' | 'deja_envoye', manque: [...] }
// 5.441 (Julien, 23 nov.) : les RELANCES sont permises — une personne peut recevoir un nouveau message plus tard — mais
//   JAMAIS deux fois le même texte à la même personne pour le même article : un texte déjà envoyé est écarté pour de bon
//   (pas seulement « pas le dernier ») ; tous déjà envoyés ⇒ `deja_envoye`, rien ne part (le favori est sauté).
function choisirMessageFavori(x) {
  const o = x && typeof x === 'object' ? x : {};
  const val = fpValeurs(o.fav, o.offre);
  const { source, groupes } = fpGroupes(o.reglage, o.ancien, o.ctx || {}, o.fav || {}, o.lotPermis === true);
  const sur = typeof o.sur === 'function' ? o.sur : () => true, refusee = typeof o.refusee === 'function' ? o.refusee : () => false;
  const deja = typeof o.deja === 'function' ? o.deja : () => false;
  let vuDeja = false;
  const d = o.derniere && typeof o.derniere === 'object' ? o.derniere : {};
  const tirer = typeof o.hasard === 'function' ? o.hasard : Math.random;
  let vuInterdit = false; const manques = new Set();
  for (const g of groupes) {
    const possibles = [];
    for (const v of g.versions) {
      if (fpErreurTexte(v.modele)) continue;
      const m = fpManque(v.modele, val);
      if (m.length) { m.forEach((k) => manques.add(k)); continue; }
      const texte = fpPreremplir(v.modele, val);
      if (!sur(texte) || refusee(v.modele)) { vuInterdit = true; continue; }
      if (deja(v.modele)) { vuDeja = true; continue; }
      possibles.push(Object.assign({}, v, { texte }));
    }
    if (!possibles.length) continue;
    let cands = possibles;
    for (const k of [d.acheteur, d.compte]) { if (k == null || k === '') continue; const c = cands.filter((v) => v.cle !== String(k)); if (c.length) cands = c; }
    const h = Number(tirer());
    const v = cands[Math.min(cands.length - 1, Math.max(0, Math.floor((Number.isFinite(h) ? h : 0) * cands.length)))];
    return { ok: true, source, cas: g.cas, regle: g.regle, version: v, possibles: possibles.length };
  }
  // 5.450 : le SEUL manque est le pseudo (la nouvelle messagerie ne l'a pas dit) ⇒ la version NEUTRE : la même, sans
  //    {pseudo} / {username} / {prénom} (« Bonjour {pseudo}, … » ⇒ « Bonjour, … ») — jamais un autre nom, jamais refusé pour ça.
  if (manques.size && [...manques].every((k) => k === 'pseudo' || k === 'prenom') && !val.pseudo) {
    const neutre = (m) => String(m).replace(/[ \t]*\{(?:pseudo|username|prénom|prenom)\}/g, '').replace(/ +([,.!?])/g, '$1');
    for (const g of groupes) {
      const possibles = [];
      for (const v of g.versions) {
        const mod = neutre(v.modele);
        if (fpErreurTexte(mod) || fpManque(mod, val).length) continue;
        if (deja(v.modele) || deja(mod)) { vuDeja = true; continue; }   // 5.454 : la règle 5.441 vaut aussi pour la version neutre
        const texte = fpPreremplir(mod, val);
        if (!texte.trim() || !sur(texte) || refusee(v.modele)) continue;
        possibles.push(Object.assign({}, v, { modele: mod, texte, neutre: true }));
      }
      if (!possibles.length) continue;
      const h = Number(tirer());
      const v = possibles[Math.min(possibles.length - 1, Math.max(0, Math.floor((Number.isFinite(h) ? h : 0) * possibles.length)))];
      return { ok: true, source, cas: g.cas, regle: g.regle, version: v, possibles: possibles.length, neutre: true };
    }
  }
  if (vuDeja && !vuInterdit) return { ok: false, source, raison: 'deja_envoye', manque: [] };
  if (manques.size && !vuInterdit) return { ok: false, source, raison: 'variable', manque: [...manques] };
  return { ok: false, source, raison: groupes.some((g) => g.versions.length) ? 'texte_interdit' : 'aucun_message', manque: [...manques] };
}
// Au moins une version qui pourrait partir (vérifiée AVANT toute écriture chez Vinted) : un texte sûr, jamais refusé.
function fpUneEnvoyable(reglage, ancien, sur, refusee) {
  const { groupes } = fpGroupes(reglage, ancien, {}, {}, true);
  const s = typeof sur === 'function' ? sur : () => true, r = typeof refusee === 'function' ? refusee : () => false;
  return groupes.some((g) => g.versions.some((v) => !fpErreurTexte(v.modele) && s(v.modele) && !r(v.modele)));
}
// Ce que le réglage a besoin de lire pour un favori (la marque / la taille ne sont lues que si un texte ou une règle les demande).
function fpBesoins(reglage) {
  const R = reglage && typeof reglage === 'object' ? fpReglage(reglage) : null;
  if (!R) return { marque: false, taille: false };
  const textes = R.un.concat(R.lot, ...R.regles.map((r) => r.textes)).map((v) => fpLireVariables(v.texte).vars);
  return { marque: textes.some((s) => s.has('marque')) || R.regles.some((r) => !!r.marques), taille: textes.some((s) => s.has('taille')) };
}
// ── LES STATISTIQUES PAR VERSION ──────────────────────────────────────────
// envois : [{ k (clé de version) | v (n° d'avant), t, i (annonce), o (offre faite) }] ;
// ventes : Map annonce → date de la vente (ms) ou null (vendue, date pas sue) — annonces PROUVÉES vendues seulement.
// → { [cle]: { envoyes, avecOffre, vendus, vendusSansDate, relues, reponses, offresAcceptees, mesure } } ; `vendus` =
//   annonce du message vendue dans les 14 j qui suivent l'envoi ; une vente sans date n'est comptée nulle part (dite à
//   part : « au moins »). (5.420, `favorisreponses`) `reponses` = envois dont l'acheteur a RÉPONDU dans la conversation
//   (`r`, la 1re réponse notée par identité) ; `relues` = envois dont le fil a été revu après l'envoi (`l` ou `r`) : le
//   taux se calcule sur `relues` — « pas relu » n'est pas « pas de réponse » ; `offresAcceptees` = notre offre acceptée (`oa`).
function statsVersionsFavoris(envois, ventes) {
  const out = {};
  const V = ventes instanceof Map ? ventes : new Map();
  for (const e of Array.isArray(envois) ? envois : []) {
    if (!e || typeof e !== 'object') continue;
    const k = typeof e.k === 'string' && e.k ? e.k : Number(e.v) > 0 ? 'a' + Number(e.v) : Number(e.v) === 0 && e.v != null ? 'lot' : '';
    if (!k) continue;
    const s = out[k] = out[k] || { envoyes: 0, avecOffre: 0, vendus: 0, vendusSansDate: 0, relues: 0, reponses: 0, offresAcceptees: 0, mesure: false };
    s.envoyes++;
    if (e.o === true || e.o === 1) s.avecOffre++;
    if (Number(e.r) > 0) { s.reponses++; s.relues++; } else if (Number(e.l) > 0) s.relues++;
    if (e.oa === true || e.oa === 1) s.offresAcceptees++;
    const i = e.i != null ? String(e.i) : '';
    if (i && V.has(i)) {
      const dv = V.get(i), t = Number(e.t);
      if (dv == null) s.vendusSansDate++;
      else if (Number.isFinite(t) && dv >= t && dv - t <= FP_VENDU_JOURS * 864e5) s.vendus++;
    }
  }
  for (const s of Object.values(out)) s.mesure = s.envoyes >= FP_SEUIL_MESURE;
  return out;
}
// </favoris-perso-regle>

export { FP_VARS, FP_INCERTAINES, FP_SEUIL_MESURE, FP_VENDU_JOURS, fpLireVariables, fpErreurTexte, fpVersionSure, fpValeurs, fpManque, fpPreremplir, fpContexteParis, fpPrecision, fpRegleVraie, fpReglesApplicables, fpGroupes, choisirMessageFavori, fpUneEnvoyable, fpBesoins, statsVersionsFavoris };
