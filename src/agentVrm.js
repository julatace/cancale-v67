// ══════════════════════════════════════════════════════════════════════════════
//  L'AGENT VRM — NÉGOCIER PAR PALIERS ET RÉPONDRE, EN AUTONOMIE (21 nov. 2026, ext. 5.421.0, `agentvrm`)
//  docs/passation/2026-11-21-ext-5421.md
// ══════════════════════════════════════════════════════════════════════════════
// Julien (21 nov.) : « crée un agent autonome qui négocie par paliers, qui répond aux personnes, en autonomie et de
// façon fiable ». Ce module est SA POLITIQUE DE DÉCISION, pure (aucun réseau, aucune horloge implicite) : il ne fait
// que décider ; le fond (background.js) écrit chaque décision au journal AVANT le geste, puis fait le geste par
// l'INTERFACE de la page, dans ses plafonds. Il n'invente AUCUNE règle de prix : la négociation est celle de SES
// tranches (`palierContreOffre`, src/negociationPaliers.js), passée en paramètre ; les réponses sont celles de SES
// modèles (<reponses-rapides-regle>) ; le plancher est celui de <lot-relance-regle> (prix mini, sinon achat + 10 %).
//   · ÉTEINT par défaut ; allumer = SA confirmation ; au premier allumage, le mode ESSAI (il montre ce qu'il AURAIT
//     fait pendant N jours, rien ne part) est proposé par défaut ;
//   · NÉGOCIER : accepter au-dessus de SON seuil (prix mini), contre-offre au palier suivant, refuser sous SON seuil de
//     refus ; jamais sous le plancher ; sans plancher ⇒ il ne négocie PAS cette paire et le dit ; l'acceptation (elle
//     vend la paire) seulement si la paire est PROUVÉE encore en vente, sans double vente, compte non bloqué ;
//   · RÉPONDRE : seulement aux catégories SÛRES (disponibilité, taille, envoi, lot, photos si l'annonce en a), UNE
//     question à la fois, aucun signal de risque (litige, retour, réclamation, insulte, hors plateforme, paiement
//     extérieur) ; tout le reste ⇒ « à toi » (il ne répond pas, il le dit) ; jamais le prix mini ; une réponse par
//     question ; jamais deux messages d'affilée sans réponse de l'acheteur ; heures calmes.
// Le bloc <agent-vrm-regle> est recopié TEL QUEL dans vinted-sync-extension/background.js
// (node scripts/audit-agent-vrm.cjs --recopie) ; il appelle rrQuestions, rrQuestionEnAttente, rrPropositions,
// rrNormaliser, rrContient (bloc <reponses-rapides-regle>) et lrPlancher (bloc <lot-relance-regle>).
import { rrQuestions, rrQuestionEnAttente, rrPropositions, rrNormaliser, rrContient } from './reponsesRapides.js';
import { lrPlancher } from './lotRelance.js';
// <agent-vrm-regle> — la RÈGLE, recopiée telle quelle dans background.js (node scripts/audit-agent-vrm.cjs --recopie).
const AG_CATS_SURES = ['dispo', 'taille', 'envoi', 'lot', 'photos'];
const AG_ESSAI_JOURS_DEFAUT = 3, AG_ESSAI_JOURS_MAX = 14;
const agEnt = (v, a, b, d) => { const n = Number(v); return Number.isInteger(n) && n >= a && n <= b ? n : d; };
// SON réglage. `essaiJusqua` (ms) : tant que maintenant < essaiJusqua, RIEN ne part (mode Essai).
function agReglage(o) {
  const x = o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  const hc = x.heuresCalmes && typeof x.heuresCalmes === 'object' ? x.heuresCalmes : null;
  const de = hc ? agEnt(hc.de, 0, 23, null) : null, a = hc ? agEnt(hc.a, 0, 23, null) : null;
  return {
    actif: x.actif === true,
    negocier: x.negocier !== false,
    repondre: x.repondre !== false,
    essaiJours: agEnt(x.essaiJours, 0, AG_ESSAI_JOURS_MAX, AG_ESSAI_JOURS_DEFAUT),
    essaiJusqua: Number.isFinite(Number(x.essaiJusqua)) && Number(x.essaiJusqua) > 0 ? Number(x.essaiJusqua) : null,
    heuresCalmes: de != null && a != null && de !== a ? { de, a } : { de: 22, a: 8 },
    // l'heure de SON dernier allumage : un arrêt sur un frein d'avant ne compte plus.
    allumeAt: Number.isFinite(Number(x.allumeAt)) && Number(x.allumeAt) > 0 ? Number(x.allumeAt) : null,
  };
}
const agEnEssai = (R, maintenant) => !!(R && R.essaiJusqua && Number(maintenant) < R.essaiJusqua);
// Heure de Paris h ∈ [de, a[ (par-dessus minuit permis).
const agHeureCalme = (hc, h) => !!hc && (hc.de < hc.a ? h >= hc.de && h < hc.a : h >= hc.de || h < hc.a);
// LES SIGNAUX DE RISQUE : un message qui en porte un n'est JAMAIS répondu seul (« à toi »). Liste FERMÉE, 5 langues.
const AG_RISQUES = {
  litige: ['litige', 'probleme', 'arnaque', 'escroc*', 'plainte', 'signaler', 'signale', 'dispute', 'scam', 'scammer', 'problem', 'complaint', 'report', 'estafa', 'reclamacion', 'truffa', 'reclamo', 'betrug', 'beschwerde', 'problema'],
  retour: ['retour', 'rembours*', 'renvoyer', 'annuler', 'annulation', 'refund', 'return', 'cancel', 'devolucion', 'reembolso', 'cancelar', 'reso', 'rimborso', 'annullare', 'ruckgabe', 'erstattung', 'stornieren', 'zuruck'],
  reclamation: ['pas recu', 'jamais recu', 'colis perdu', 'pas conforme', 'casse', 'cassee', 'not received', 'never arrived', 'not as described', 'broken', 'no recibido', 'roto', 'non ricevuto', 'rotto', 'nicht erhalten', 'kaputt'],
  insulte: ['connard', 'connasse', 'conne', 'salope', 'encule', 'merde', 'idiot', 'debile', 'abruti', 'fuck', 'idiot', 'stupid', 'asshole', 'bitch', 'gilipollas', 'idiota', 'puta', 'cazzo', 'stronzo', 'arschloch', 'scheisse', 'idiot'],
  hors_plateforme: ['whatsapp', 'whats app', 'telegram', 'snapchat', 'snap', 'instagram', 'insta', 'messenger', 'sms', 'mon numero', 'ton numero', 'telephone', 'phone number', 'numero de telefono', 'numero di telefono', 'telefonnummer', 'mail', 'email', 'e mail', 'gmail', 'main propre', 'in person', 'en mano', 'di persona', 'personlich'],
  paiement: ['paypal', 'lydia', 'virement', 'iban', 'western union', 'cash', 'especes', 'liquide', 'bank transfer', 'transferencia', 'bonifico', 'uberweisung', 'barzahlung', 'revolut', 'wise'],
};
function agRisque(texte) {
  const n = rrNormaliser(texte);
  for (const k of Object.keys(AG_RISQUES)) for (const m of AG_RISQUES[k]) if (rrContient(n, m)) return k;
  return '';
}
// Une empreinte courte d'un texte (une réponse par QUESTION : la même question n'est jamais répondue deux fois).
function agEmpreinte(t) { let h = 2166136261; const s = rrNormaliser(t); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); }
// LA DÉCISION SUR UN MESSAGE.
//  ctx : { conv, messages ([{deMoi, texte}] dans l'ordre), reglageRr (SES modèles), vars ({ pseudo, article, taille, prix }),
//        partie, photos (nombre de photos de l'annonce, null = pas su), repondues (Set d'empreintes « conv:question »),
//        heure (heure de Paris), agent (agReglage), sur (texte → bool) }
// Rend { geste: 'repondre', cat, texte, cle } · { geste: 'a_toi', raison, cat? } · { geste: 'rien', raison } ·
//       { geste: 'attendre', raison: 'heures_calmes' }.
function agDecisionMessage(ctx) {
  const c = ctx && typeof ctx === 'object' ? ctx : {};
  const R = c.agent || agReglage(null);
  if (!R.repondre) return { geste: 'rien', raison: 'repondre_eteint' };
  const l = Array.isArray(c.messages) ? c.messages.filter((m) => m && String(m.texte || '').trim()) : [];
  if (!l.length) return { geste: 'rien', raison: 'vide' };
  const der = l[l.length - 1];
  // Jamais deux messages d'affilée sans réponse de l'acheteur ; un auteur pas sûr ⇒ rien (pas su ≠ acheteur).
  if (der.deMoi === true) return { geste: 'rien', raison: 'dernier_de_moi' };
  if (der.deMoi !== false) return { geste: 'rien', raison: 'auteur_pas_su' };
  const question = rrQuestionEnAttente(l);
  if (!question) return { geste: 'rien', raison: 'vide' };
  const cle = String(c.conv || '') + ':' + agEmpreinte(question);
  const rep = c.repondues && typeof c.repondues.has === 'function' ? c.repondues : new Set(Array.isArray(c.repondues) ? c.repondues : []);
  if (rep.has(cle)) return { geste: 'rien', raison: 'deja_repondu' };
  const risque = agRisque(question);
  if (risque) return { geste: 'a_toi', raison: 'risque_' + risque, cle };
  const qs = rrQuestions(question);
  if (!qs.length) return { geste: 'a_toi', raison: 'question_ambigue', cle };
  if (qs.length > 1) return { geste: 'a_toi', raison: 'plusieurs_questions', cle };
  const cat = qs[0].cat;
  if (!AG_CATS_SURES.includes(cat)) return { geste: 'a_toi', raison: 'categorie_' + cat, cat, cle };
  if (cat === 'photos' && !(Number(c.photos) > 1)) return { geste: 'a_toi', raison: 'photos_absentes', cat, cle };
  if (cat === 'dispo' && c.partie !== false) return { geste: 'a_toi', raison: c.partie === true ? 'annonce_partie' : 'dispo_pas_su', cat, cle };
  // SES modèles, mais JAMAIS le prix mini (l'agent ne le révèle pas, même si SA réponse à la main le peut).
  const rr = Object.assign({}, c.reglageRr || {}, { revelerMini: false });
  const vars = Object.assign({}, c.vars || {}); delete vars.prix_mini;
  const p = rrPropositions({ texte: question, reglage: rr, vars, partie: c.partie === true, sur: c.sur, hasard: () => 0 }).propositions[0];
  if (!p || !p.texte) return { geste: 'a_toi', raison: 'info_manquante' + (p && p.manque ? '_' + p.manque : ''), cat, cle };
  if (/\{prix_mini\}/.test(p.texte)) return { geste: 'a_toi', raison: 'prix_mini', cat, cle };
  if (agHeureCalme(R.heuresCalmes, Number(c.heure))) return { geste: 'attendre', raison: 'heures_calmes', cat, texte: p.texte, cle };
  return { geste: 'repondre', cat, texte: p.texte, cle };
}
// LA DÉCISION SUR UNE OFFRE REÇUE.
//  ctx : { offre (euros), prix (de l'annonce), mini, refuse (SON seuil de refus), achat, nArticles, joues (paliers déjà
//        joués dans CETTE négociation), paliers (SES réglages de tranches), palier (fonction = palierContreOffre),
//        enVente (true = prouvée en vente), gardeOk (true = aucune double vente), compteBloque, faite (déjà traitée),
//        agent (agReglage), note (5.430 : la décision de <note-acheteur-regle> sur CET acheteur — 'ok' · 'neuf' ·
//        'basse' · 'neuf-refuse' · 'pas-su' ; absente = 'pas-su') }
// Rend { geste: 'accepter'|'contre'|'refuser', prix?, palier?, raison } · { geste: 'a_toi'|'rien', raison }.
// ⚠️ 5.430 (Julien, 21 nov. : « tu n'acceptes pas les comptes 1 étoile ») : une acceptation ou une contre-offre ne part
//    que si la note de l'acheteur est LUE et au-dessus de SON seuil (ou compte neuf qu'il accepte) ; note ≤ seuil ⇒
//    « à toi » ; note pas lue ⇒ rien (ni décision écrite : l'agent relit la note au passage suivant). Le refus reste permis.
function agDecisionOffre(ctx) {
  const r = agDecisionOffreBrute(ctx);
  if (r.geste !== 'accepter' && r.geste !== 'contre') return r;
  const n = ctx && typeof ctx === 'object' ? ctx.note : null;
  if (n === 'ok' || n === 'neuf') return r;
  if (n === 'basse') return { geste: 'a_toi', raison: 'note_basse' };
  if (n === 'neuf-refuse') return { geste: 'a_toi', raison: 'compte_neuf' };
  return { geste: 'rien', raison: 'note_pas_lue' };
}
function agDecisionOffreBrute(ctx) {
  const c = ctx && typeof ctx === 'object' ? ctx : {};
  const R = c.agent || agReglage(null);
  if (!R.negocier) return { geste: 'rien', raison: 'negocier_eteint' };
  if (c.faite) return { geste: 'rien', raison: 'deja_traitee' };
  if (c.compteBloque) return { geste: 'rien', raison: 'compte_bloque' };
  const o = Number(c.offre), p = Number(c.prix);
  if (!(o > 0) || !(p > 0)) return { geste: 'a_toi', raison: 'prix_inconnu' };
  const pl = lrPlancher(c.mini, c.achat);
  if (!pl) return { geste: 'a_toi', raison: 'plancher_inconnu' };
  const plancher = pl.c / 100;
  const mini = Number(c.mini) > 0 ? Number(c.mini) : null;
  const refuse = Number(c.refuse) > 0 ? Number(c.refuse) : null;
  const accepter = () => {
    if (c.enVente !== true) return { geste: 'a_toi', raison: 'pas_prouvee_en_vente' };
    if (c.gardeOk !== true) return { geste: 'a_toi', raison: 'double_vente_pas_exclue' };
    if (o < plancher) return { geste: 'a_toi', raison: 'sous_plancher' };
    return { geste: 'accepter', prix: o, raison: 'au_dessus_du_seuil' };
  };
  // 1. Au-dessus de SON seuil (le prix mini) : accepter (jamais sous le plancher).
  if (mini != null && o >= mini) return accepter();
  // 2. Sous SON seuil de refus : refuser (son message, s'il en a écrit un, part avec ; jamais inventé).
  if (refuse != null && o < refuse) return { geste: 'refuser', raison: 'sous_le_refus' };
  // 3. Entre les deux : SES tranches (palier suivant ; « rester flexible » peut accepter, au-dessus du plancher).
  const pal = typeof c.palier === 'function' ? c.palier({ prix: p, mini: c.mini, achat: c.achat, nArticles: c.nArticles, offre: o, joues: c.joues || [], reglages: Object.assign({}, c.paliers || {}, { actif: true }) }) : null;
  if (pal && pal.accepter) { const a = accepter(); return a.geste === 'accepter' ? Object.assign(a, { raison: 'flexible', palier: pal.i }) : a; }
  if (pal && Number(pal.prix) > 0) {
    const px = Math.round(Number(pal.prix) * 100) / 100;
    if (px < plancher || px <= o || px >= p) return { geste: 'a_toi', raison: 'palier_hors_bornes' };
    return { geste: 'contre', prix: px, palier: pal.i, finale: !!pal.finale, raison: 'palier' };
  }
  return { geste: 'a_toi', raison: 'paliers_epuises' };
}
// Le tableau de bord : décisions du jour, en attente, « à toi », taux d'acceptation (sur les offres TRANCHÉES).
function agTableau(journal, maintenant, jourDe) {
  const l = Array.isArray(journal) ? journal : [];
  const jour = typeof jourDe === 'function' ? jourDe : (t) => new Date(t).toISOString().slice(0, 10);
  const auj = jour(Number(maintenant) || 0);
  const t = { jour: 0, essai: 0, attente: 0, aToi: 0, acceptees: 0, tranchees: 0, envoyes: 0 };
  for (const e of l) {
    if (!e) continue;
    if (jour(Number(e.at) || 0) === auj) { t.jour++; if (e.essai) t.essai++; }
    if (e.etat === 'prevu') t.attente++;
    if (e.geste === 'a_toi' && !e.vu) t.aToi++;
    if (!e.essai && e.etat === 'fait' && ['accepter', 'contre', 'refuser'].includes(e.geste)) { t.tranchees++; if (e.geste === 'accepter') t.acceptees++; }
    if (!e.essai && e.etat === 'fait') t.envoyes++;
  }
  t.taux = t.tranchees ? Math.round(100 * t.acceptees / t.tranchees) : null;
  return t;
}
// </agent-vrm-regle>
export { AG_CATS_SURES, AG_RISQUES, agReglage, agEnEssai, agHeureCalme, agRisque, agEmpreinte, agDecisionMessage, agDecisionOffre, agTableau };
