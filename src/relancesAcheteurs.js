// ═══════════════════════════════════════════════════════════════════════════
// RELANCER LES ACHETEURS · TRIER LES CONVERSATIONS — LA RÈGLE (21 nov., ext. 5.425)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (21 nov.), « parfait et irréprochable » :
//  46 — « Acheteurs qui ne finalisent pas, ou ne vont pas chercher le colis » : deux listes
//       (a) colis LIVRÉ, commande pas confirmée depuis ≥ 2 jours (réglable) ;
//       (b) colis AU POINT RELAIS, pas retiré depuis ≥ N jours (réglable, 3 par défaut),
//       avec ce qui reste de la garde ; un message poli prêt (modèles éditables, versions au
//       hasard, 5 langues selon la langue de la conversation), envoyé sur SON toucher ; une
//       relance par commande et par motif (une 2ᵉ seulement s'il l'autorise, jamais plus) ;
//       « automatique » éteint par défaut ; statuts PROUVÉS seulement ; litige / retour ⇒ jamais.
//  48 — « Tri des conversations » : À répondre · Offre en attente · Litige / retour · En attente
//       de l'acheteur · Traité, les urgentes d'abord avec la raison ; lecture seule.
//
// MESURÉ sur sa base (lecture seule, 21 nov.) — ce qui PROUVE, et ce qui ne prouve pas :
//  · la liste des ventes (`my_orders[].status`, la plus fraîche) : « Commande livrée ! »
//    (`transaction_user_status` waiting : l'acheteur n'a pas encore confirmé), « La livraison n'a
//    pas encore eu lieu - colis déposé en bureau de Poste ou point relais » (au point : la règle
//    `isAtRelayStatus` / `AT_RELAY`, passée par l'appelant en `auRelais`) ; « finalisée » ⇒ fini ;
//  · le détail de transaction rangé est souvent PLUS ANCIEN que la liste (230 « paiement validé »
//    sur des ventes livrées) : il ne sert qu'à PROUVER un litige (430 / 440) ou une fin (450) ;
//  · la DATE : la liste ne la porte pas (`date` = jour de la vente). Elle vient du fil de la
//    conversation côté vendeur : « Commande livrée ! — L'acheteur a reçu sa commande… » et
//    « Ton colis est arrivé ! — Le colis est arrivé au point relais » (`created_at_ts`) ; sinon
//    le moment où l'extension a VU le statut pour la première fois (`vuLe`, une borne basse :
//    « depuis au moins »). Rien des deux ⇒ « depuis » pas su ⇒ JAMAIS de relance ;
//  · la date limite de garde n'est écrite nulle part pour un colis VENDU (les e-mails « à
//    retirer » vont à l'acheteur) : elle s'ESTIME par la garde mesurée de SON transporteur
//    (api/_lib/retrait-colis.js `GARDE_PAR_TRANSPORTEUR`, recopiée ici et comparée par l'audit),
//    se dit « estimée », et n'entre JAMAIS dans un message (`{date_limite}` exige une date LUE).
//
// Le bloc entre les balises est RECOPIÉ tel quel dans vinted-sync-extension/background.js
// (`node scripts/audit-relances.cjs --recopie`), jamais réécrit à la main là-bas.
// ═══════════════════════════════════════════════════════════════════════════

// <relances-regle>
const RL_MOTIFS = ['livre', 'relais'];
const RL_LANGUES = ['fr', 'en', 'es', 'it', 'de'];
const RL_GARDE = { mondialrelay: 5, vinted: 6, chronopost: 4 };   // = GARDE_PAR_TRANSPORTEUR (api/_lib/retrait-colis.js)
const RL_JOUR = 86400000;
const RL_MAX_ENVOIS = 2;            // une relance, puis une 2ᵉ s'il l'autorise : JAMAIS plus
const RL_TEXTE_MAX = 2000, RL_VERSIONS_MAX = 5;
// Les modèles proposés (il les remplace par les siens) : polis, courts, sans reproche.
const RL_MODELES_DEFAUT = {
  livre: {
    fr: ['Bonjour {pseudo}, j’espère que {article} te plaît ! Si tout est en ordre, pense à confirmer la commande sur Vinted (« Tout est OK »). Merci beaucoup et bonne journée !',
      'Coucou {pseudo} 🙂 Le colis est bien arrivé d’après Vinted. Quand tu as un moment, peux-tu confirmer la réception ? Merci, et n’hésite pas si tu as la moindre question.',
      'Bonjour {pseudo}, merci encore pour ton achat ! Si {article} te convient, il ne reste plus qu’à confirmer la commande sur Vinted. Belle journée !'],
    en: ['Hi {pseudo}, I hope you like {article}! If everything is fine, could you confirm the order on Vinted (“Everything is OK”)? Thanks a lot and have a nice day!',
      'Hello {pseudo} 🙂 Vinted says the parcel was delivered. When you have a moment, could you confirm you received it? Thanks, and let me know if you have any question.'],
    es: ['¡Hola {pseudo}! Espero que te guste {article}. Si todo está bien, ¿podrías confirmar el pedido en Vinted («Todo está bien»)? ¡Muchas gracias y buen día!',
      'Hola {pseudo} 🙂 Según Vinted el paquete ya se entregó. Cuando puedas, ¿confirmas la recepción? Gracias, y dime si tienes cualquier duda.'],
    it: ['Ciao {pseudo}, spero che {article} ti piaccia! Se è tutto a posto, potresti confermare l’ordine su Vinted («È tutto ok»)? Grazie mille e buona giornata!',
      'Ciao {pseudo} 🙂 Secondo Vinted il pacco è stato consegnato. Quando hai un momento, puoi confermare la ricezione? Grazie, e scrivimi per qualsiasi domanda.'],
    de: ['Hallo {pseudo}, ich hoffe, {article} gefällt dir! Wenn alles in Ordnung ist, bestätige bitte die Bestellung auf Vinted („Alles in Ordnung“). Vielen Dank und einen schönen Tag!',
      'Hallo {pseudo} 🙂 Laut Vinted wurde das Paket zugestellt. Wenn du kurz Zeit hast, bestätige bitte den Empfang. Danke, und melde dich gern bei Fragen.'],
  },
  relais: {
    fr: ['Bonjour {pseudo}, ton colis ({article}) t’attend au point relais. Pense à aller le chercher avant qu’il ne reparte. Merci et bonne journée !',
      'Coucou {pseudo} 🙂 Petit rappel : ta commande est arrivée au point relais{point}. N’oublie pas d’aller la récupérer, sinon elle me sera renvoyée. Merci !',
      'Bonjour {pseudo}, ta commande est disponible au point relais{point} avant le {date_limite}. Bonne journée !'],
    en: ['Hi {pseudo}, your parcel ({article}) is waiting for you at the pick-up point. Please collect it before it is sent back. Thanks and have a nice day!',
      'Hello {pseudo} 🙂 Just a reminder: your order has arrived at the pick-up point{point}. Don’t forget to collect it, otherwise it will be returned to me. Thanks!'],
    es: ['¡Hola {pseudo}! Tu paquete ({article}) te espera en el punto de recogida. Recuerda ir a buscarlo antes de que lo devuelvan. ¡Gracias y buen día!',
      'Hola {pseudo} 🙂 Un pequeño recordatorio: tu pedido ya está en el punto de recogida{point}. No olvides recogerlo, si no me lo devolverán. ¡Gracias!'],
    it: ['Ciao {pseudo}, il tuo pacco ({article}) ti aspetta al punto di ritiro. Ricordati di ritirarlo prima che venga rispedito. Grazie e buona giornata!',
      'Ciao {pseudo} 🙂 Un piccolo promemoria: il tuo ordine è arrivato al punto di ritiro{point}. Non dimenticare di ritirarlo, altrimenti tornerà a me. Grazie!'],
    de: ['Hallo {pseudo}, dein Paket ({article}) wartet im Paketshop auf dich. Bitte hol es ab, bevor es zurückgeschickt wird. Danke und einen schönen Tag!',
      'Hallo {pseudo} 🙂 Kleine Erinnerung: deine Bestellung ist im Paketshop{point} angekommen. Bitte vergiss nicht, sie abzuholen, sonst geht sie an mich zurück. Danke!'],
  },
};
// Ce qui PROUVE un litige / un retour : le statut lu de Vinted (liste ou transaction 430 / 440),
// un message d'état de Vinted dans le fil (« Problème après la livraison », « Retour… »), ou les
// mots de l'ACHETEUR dans ses derniers messages (5 langues). Un doute penche vers « litige » :
// une relance de trop sur un litige est la pire erreur ; une relance manquée ne coûte rien.
const RL_STATUT_LITIGE = /litige|r[ée]clamation|probl[èe]me|retour|retourn|rembours|annul|suspend|non\s+r[ée]clam|[ée]chou|[ée]chec|refus|issue|dispute|complaint|return/i;
const RL_MOTS_LITIGE = /probl[èe]me|abim|abîm|cass[ée]|d[ée]chir|tach[ée]|faux|fake|contrefa|pas\s+(?:la\s+bonne|conforme|re[çc]u|authentique)|jamais\s+re[çc]u|rembours|retour|litige|arnaque|escroc|damaged|broken|refund|not\s+(?:received|as\s+described)|scam|counterfeit|problema|reembolso|devoluci[óo]n|rimborso|reso|falso|rotto|kaputt|besch[äa]digt|r[üu]ckerstattung|zur[üu]ck|f[äa]lschung/i;
const RL_MOTS_LANGUE = {
  fr: /\b(bonjour|bonsoir|merci|je|vous|est|pour|avec|pas|colis|oui|salut|bien)\b/gi,
  en: /\b(hello|hi|thanks|thank|the|you|is|my|please|yes|got|parcel|item)\b/gi,
  es: /\b(hola|gracias|el|que|por|para|es|muy|s[ií]|pedido|paquete|buenas)\b/gi,
  it: /\b(ciao|grazie|il|che|per|sono|buongiorno|molto|pacco|ordine|s[ìi])\b/gi,
  de: /\b(hallo|danke|ich|und|ist|nicht|das|bitte|paket|ja|gut)\b/gi,
};
// Un instant de Vinted : chaîne ISO (« 2026-10-16T16:59:37+02:00 ») ou secondes / millisecondes.
function rlTs(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) return n < 1e12 ? n * 1000 : n;
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : null;
}
const rlTitre = (m) => String((m && m.entity && (m.entity.title || m.entity.body)) || (m && m.title) || '');
const rlSous = (m) => String((m && m.entity && (m.entity.subtitle || m.entity.body)) || '');
const rlQuand = (m) => rlTs(m && (m.created_at_ts != null ? m.created_at_ts : m.entity && m.entity.created_at_ts));
// Les messages ÉCRITS (pas les messages d'état), du plus ancien au plus récent.
function rlEcrits(msgs) {
  return (Array.isArray(msgs) ? msgs : []).filter((m) => m && m.entity_type === 'message' && m.entity && m.entity.user_id != null)
    .map((m) => ({ de: String(m.entity.user_id), texte: String(m.entity.body || ''), at: rlQuand(m) }))
    .sort((a, b) => (a.at || 0) - (b.at || 0));
}
// LITIGE / RETOUR PROUVÉ (jamais déduit d'une absence) : { oui, raison }.
function rlLitige({ statut, txStatus, msgs, opp } = {}) {
  if (RL_STATUT_LITIGE.test(String(statut || ''))) return { oui: true, raison: 'statut' };
  if ([430, 440].includes(Number(txStatus))) return { oui: true, raison: 'transaction' };
  for (const m of Array.isArray(msgs) ? msgs : []) {
    if (!m || m.entity_type !== 'status_message') continue;
    if (/probl[èe]me|litige|retour|retourn|rembours|annul|issue|dispute|return|refund/i.test(rlTitre(m))) return { oui: true, raison: 'vinted' };
  }
  const o = opp == null ? '' : String(opp);
  const siens = rlEcrits(msgs).filter((m) => o && m.de === o).slice(-3);
  if (siens.some((m) => RL_MOTS_LITIGE.test(m.texte))) return { oui: true, raison: 'mots' };
  return { oui: false, raison: '' };
}
// OÙ EN EST LA VENTE (prouvé) : { motif: 'livre' | 'relais' | null, depuis, preuve, litige, fini, raison }.
// `v` = { statut (liste des ventes), tus, txStatus, complete, auRelais (règle `isAtRelayStatus` sur
// `statut`), msgs (fil), opp, vu: { livre, relais } (1re fois vu par l'extension, ms) }.
function rlEtatVente(v) {
  const x = v && typeof v === 'object' ? v : {};
  const st = String(x.statut || ''), tus = String(x.tus || '').toLowerCase();
  const out = { motif: null, depuis: null, preuve: '', litige: false, fini: false, raison: '' };
  if (!st) { out.raison = 'pas-une-vente'; return out; }   // une conversation n'est pas une vente (§5)
  const l = rlLitige({ statut: st, txStatus: x.txStatus, msgs: x.msgs, opp: x.opp });
  if (l.oui) { out.litige = true; out.raison = 'litige-' + l.raison; return out; }
  if (/finalis/i.test(st) || tus === 'completed' || tus === 'failed' || Number(x.txStatus) === 450 || x.complete === true) { out.fini = true; out.raison = 'finie'; return out; }
  const msgs = Array.isArray(x.msgs) ? x.msgs : [];
  const dernier = (re, sous) => { let t = null; for (const m of msgs) { if (!m || m.entity_type !== 'action_message') continue; if (!re.test(rlTitre(m)) || (sous && !sous.test(rlSous(m)))) continue; const q = rlQuand(m); if (q != null && (t == null || q > t)) t = q; } return t; };
  const tLivre = dernier(/^\s*commande\s+livr[ée]e/i, null);
  const tRelais = dernier(/colis\s+est\s+arriv/i, /point\s+relais|bureau\s+de\s+poste|casier|consigne|locker|point\s+de\s+retrait/i);
  const vu = x.vu && typeof x.vu === 'object' ? x.vu : {};
  if (/commande\s+livr[ée]e/i.test(st)) {
    out.motif = 'livre';
    if (tLivre != null) { out.depuis = tLivre; out.preuve = 'fil'; } else if (rlTs(vu.livre) != null) { out.depuis = rlTs(vu.livre); out.preuve = 'vu'; }
    return out;
  }
  if (x.auRelais === true) {
    out.motif = 'relais';
    if (tRelais != null && !(tLivre != null && tLivre >= tRelais)) { out.depuis = tRelais; out.preuve = 'fil'; } else if (rlTs(vu.relais) != null) { out.depuis = rlTs(vu.relais); out.preuve = 'vu'; }
    return out;
  }
  out.raison = 'ni-livree-ni-au-point';
  return out;
}
// Le réglage des relances, toujours complet (la section `relances` de <reglages-auto-ligne>).
function rlReglage(r) {
  const o = r && typeof r === 'object' ? r : {};
  const ent = (v, a, b, d) => { const n = Number(v); return Number.isInteger(n) && n >= a && n <= b ? n : d; };
  return { actif: o.actif === true, livreJours: ent(o.livreJours, 1, 14, 2), relaisJours: ent(o.relaisJours, 1, 14, 3), deuxieme: o.deuxieme === true, modeles: o.modeles && typeof o.modeles === 'object' ? o.modeles : {} };
}
// ÉLIGIBLE ? `envois` = les instants des relances DÉJÀ parties (ou notées « en vol ») pour CETTE commande et CE motif,
// le rappel « 24 h après l'arrivée au relais » de l'après-vente compris (sans doublon). Rend { ok, rang, raison, jours, seuil }.
function rlEligible({ etat, reglage, envois, maintenant } = {}) {
  const t = Number.isFinite(maintenant) ? maintenant : Date.now();
  const R = rlReglage(reglage);
  const e = etat || {};
  const res = (ok, raison, plus) => Object.assign({ ok, raison, rang: 0, jours: null, seuil: null }, plus || {});
  if (e.litige) return res(false, 'litige');
  if (e.fini) return res(false, 'finie');
  if (!RL_MOTIFS.includes(e.motif)) return res(false, 'pas-de-motif');
  const seuil = e.motif === 'livre' ? R.livreJours : R.relaisJours;
  if (!Number.isFinite(e.depuis) || e.depuis <= 0 || e.depuis > t) return res(false, 'depuis-pas-su', { seuil });
  const jours = Math.floor((t - e.depuis) / RL_JOUR);
  const l = (Array.isArray(envois) ? envois : []).map(Number).filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (l.length >= RL_MAX_ENVOIS) return res(false, 'deja-deux', { jours, seuil });
  if (t - e.depuis < seuil * RL_JOUR) return res(false, 'trop-tot', { jours, seuil });
  if (l.length === 0) return res(true, '', { rang: 1, jours, seuil });
  if (!R.deuxieme) return res(false, 'deja', { jours, seuil });
  if (t - l[l.length - 1] < seuil * RL_JOUR) return res(false, 'trop-tot-2', { jours, seuil });
  return res(true, '', { rang: 2, jours, seuil });
}
// CE QUI RESTE DE LA GARDE : une date LUE gagne ; sinon l'arrivée + la garde mesurée de SON transporteur (estimée) ;
// transporteur inconnu ou arrivée inconnue ⇒ null (« pas su », jamais la garde d'un autre).
function rlLimite({ depuis, transporteur, limiteLue, maintenant } = {}) {
  const t = Number.isFinite(maintenant) ? maintenant : Date.now();
  const lue = rlTs(limiteLue);
  if (lue != null) return { at: lue, reste: Math.ceil((lue - t) / RL_JOUR), estimee: false };
  const g = RL_GARDE[String(transporteur || '').toLowerCase().trim()];
  if (!Number.isFinite(g) || !Number.isFinite(depuis) || depuis <= 0) return null;
  const at = depuis + g * RL_JOUR;
  return { at, reste: Math.ceil((at - t) / RL_JOUR), estimee: true, garde: g };
}
// La langue de la conversation : les messages de L'ACHETEUR (mots courants des 5 langues). Pas assez ⇒ null.
function rlLangue(msgs, opp) {
  const o = opp == null ? '' : String(opp);
  const texte = rlEcrits(msgs).filter((m) => o && m.de === o).map((m) => m.texte).join(' ').slice(0, 4000);
  if (!texte.trim()) return null;
  const sc = RL_LANGUES.map((k) => [k, (texte.match(RL_MOTS_LANGUE[k]) || []).length]).sort((a, b) => b[1] - a[1]);
  return sc[0][1] >= 2 && sc[0][1] > sc[1][1] ? sc[0][0] : null;
}
// Les versions de SES modèles pour un motif et une langue (les siennes d'abord, sinon celles proposées).
function rlVersions(modeles, motif, langue) {
  const m = modeles && typeof modeles === 'object' ? modeles[motif] : null;
  const siennes = m && typeof m === 'object' && Array.isArray(m[langue]) ? m[langue].filter((x) => typeof x === 'string' && x.trim() && x.length <= RL_TEXTE_MAX).slice(0, RL_VERSIONS_MAX) : [];
  if (siennes.length) return { versions: siennes, siennes: true };
  return { versions: ((RL_MODELES_DEFAUT[motif] || {})[langue] || []).slice(), siennes: false };
}
// LE MESSAGE PRÊT : une version tirée au hasard (jamais la même que la dernière fois), variables remplacées par ce
// qui est SU. Une version qui demande une variable pas sue est écartée ({pseudo} : retiré poliment ; {point} : retiré
// avec sa virgule ; {date_limite} : seulement une date LUE). Rend { texte, n, langue } ou { texte: null, raison }.
function rlTexte({ modeles, motif, langue, vars, derniere, hasard } = {}) {
  const L = RL_LANGUES.includes(langue) ? langue : 'fr';
  const { versions } = rlVersions(modeles, motif, L);
  const V = vars && typeof vars === 'object' ? vars : {};
  const su = (k) => typeof V[k] === 'string' && V[k].trim() !== '';
  const possibles = versions.map((x, i) => ({ x, n: i + 1 })).filter(({ x }) => !/\{date_limite\}/.test(x) || su('date_limite')).filter(({ x }) => !/\{article\}/.test(x) || su('article'));
  if (!possibles.length) return { texte: null, raison: 'variable-pas-sue' };
  const h = typeof hasard === 'function' ? hasard : Math.random;
  const autres = possibles.length > 1 ? possibles.filter((p) => p.n !== Number(derniere)) : possibles;
  const p = autres[Math.min(autres.length - 1, Math.floor(h() * autres.length))];
  let s = p.x;
  s = s.replace(/\{pseudo\}/g, su('pseudo') ? V.pseudo.trim() : '').replace(/\{article\}/g, su('article') ? V.article.trim() : '')
    .replace(/\{point\}/g, su('point') ? ' ' + V.point.trim() : '').replace(/\{date_limite\}/g, su('date_limite') ? V.date_limite.trim() : '');
  s = s.replace(/\s+([,.])/g, '$1').replace(/^(Bonjour|Coucou|Hi|Hello|Hola|Ciao|Hallo)\s*,/i, '$1,').replace(/\s{2,}/g, ' ').trim().slice(0, RL_TEXTE_MAX);
  return s ? { texte: s, n: p.n, langue: L } : { texte: null, raison: 'vide' };
}
// ══ 48 — LE TRI D'UNE CONVERSATION (lecture seule) ══════════════════════════
// `c` = { conv, msgs (fil rangé ; absent ⇒ pas lu), opp, uid, txStatus, complete, offre (règle
// `derniereOffreEnAttente`, calculée par l'appelant), venteStatut, auRelais }.
// Rend { groupe: 'repondre'|'offre'|'litige'|'attente'|'traite'|'passu', urgent, raison, at }.
// Les urgentes : litige, offre en attente, colis au point relais (la raison le dit).
const RL_GROUPES = ['repondre', 'offre', 'litige', 'attente', 'traite', 'passu'];
function rlClasser(c, maintenant) {
  const x = c && typeof c === 'object' ? c : {};
  const t = Number.isFinite(maintenant) ? maintenant : Date.now();
  if (!Array.isArray(x.msgs)) return { groupe: 'passu', urgent: false, raison: 'pas-lu', at: null };
  const opp = x.opp == null ? '' : String(x.opp), moi = x.uid == null ? '' : String(x.uid);
  const ecrits = rlEcrits(x.msgs);
  const der = ecrits.length ? ecrits[ecrits.length - 1] : null;
  const l = rlLitige({ statut: x.venteStatut, txStatus: x.txStatus, msgs: x.msgs, opp });
  const fini = Number(x.txStatus) === 450 || x.complete === true || /finalis/i.test(String(x.venteStatut || ''));
  const auPoint = x.auRelais === true && !fini;
  if (l.oui && !(fini && l.raison === 'mots')) return { groupe: 'litige', urgent: true, raison: 'litige-' + l.raison, at: der ? der.at : null };
  if (x.offre && x.offre.oid) {
    let at = null; for (const m of x.msgs) if (m && m.entity_type === 'offer_request_message' && m.entity && String(m.entity.offer_request_id) === String(x.offre.oid)) at = rlQuand(m);
    return { groupe: 'offre', urgent: true, raison: 'offre', prix: Number(x.offre.prix) || null, at, heures: at != null ? Math.max(0, Math.floor((t - at) / 3600000)) : null };
  }
  if (der && opp && der.de === opp) return { groupe: 'repondre', urgent: auPoint, raison: auPoint ? 'colis-point' : 'message', at: der.at };
  if (fini) return { groupe: 'traite', urgent: false, raison: 'finie', at: der ? der.at : null };
  if (der && moi && der.de === moi) return { groupe: 'attente', urgent: auPoint, raison: auPoint ? 'colis-point' : 'ta-reponse', at: der.at };
  if (auPoint) return { groupe: 'attente', urgent: true, raison: 'colis-point', at: null };
  return { groupe: 'traite', urgent: false, raison: 'rien-a-faire', at: der ? der.at : null };
}
// Ordre : urgentes d'abord, puis du plus récent ; compteur par groupe.
function rlTrier(lignes) {
  const l = (Array.isArray(lignes) ? lignes : []).slice().sort((a, b) => (b.urgent === true) - (a.urgent === true) || (Number(b.at) || 0) - (Number(a.at) || 0));
  const compte = Object.fromEntries(RL_GROUPES.map((g) => [g, 0]));
  for (const x of l) if (compte[x.groupe] != null) compte[x.groupe]++;
  return { lignes: l, compte };
}
// </relances-regle>

export { RL_MOTIFS, RL_LANGUES, RL_GARDE, RL_MAX_ENVOIS, RL_MODELES_DEFAUT, RL_GROUPES, rlTs, rlLitige, rlEtatVente, rlReglage, rlEligible, rlLimite, rlLangue, rlVersions, rlTexte, rlClasser, rlTrier };
