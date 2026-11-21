#!/usr/bin/env node
// audit-agent-vrm (21 nov., ext. 5.421, `agentvrm`) — L'AGENT VRM : NÉGOCIER PAR PALIERS ET RÉPONDRE, EN AUTONOMIE.
// Exécute la politique <agent-vrm-regle> TELLE QU'ELLE EST DANS background.js, puis `agentTick` lui-même :
//  A1. copies identiques (src/agentVrm.js ⇄ background.js ; --recopie) ;
//  A2. corpus de MESSAGES inventés (5 langues) : il ne répond QU'aux catégories sûres (dispo, taille, envoi, lot, photos
//      si l'annonce en a), une question à la fois ; litige, retour, réclamation, insulte, hors plateforme, paiement,
//      échange, prix, état, authenticité, plusieurs questions, question ambiguë ⇒ « à toi » ; ZÉRO réponse non sûre ;
//      jamais deux messages d'affilée ; jamais le prix mini ; une réponse par question ; heures calmes ;
//  A3. corpus d'OFFRES : 3 000 offres au hasard — jamais une acceptation ni une contre-offre sous le plancher ; sans
//      plancher ⇒ « à toi » ; acceptation seulement prouvée en vente, sans double vente, compte non bloqué ;
//  A4. le FOND (vrai background.js, fausse base, gestes comptés) : éteint ⇒ rien ; mode ESSAI ⇒ décisions au journal,
//      AUCUN geste ; négociation complète (offre 70 → contre-offre 93 € au palier 1 → offre 86 → acceptée) ; une réponse
//      sûre envoyée, jamais deux ; « à toi » sur un litige ; chaque décision écrite AVANT le geste ; un frein (403/429,
//      vérification) ARRÊTE l'agent ;
// --prouve : chaque garde affaiblie dans une copie ⇒ au moins un rouge.
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os'), cp = require('child_process');
const R = path.join(__dirname, '..');
const F_SRC = path.join(R, 'src/agentVrm.js'), F_BG = path.join(R, 'vinted-sync-extension/background.js');
const DEB = '// <agent-vrm-regle>', FIN = '// </agent-vrm-regle>';
const bloc = (t, a = DEB, b = FIN) => { const i = t.indexOf(a), j = t.indexOf(b); return i < 0 || j < 0 ? null : t.slice(i, j + b.length); };
if (process.argv.includes('--recopie')) {
  const b = bloc(fs.readFileSync(F_SRC, 'utf8')); let bg = fs.readFileSync(F_BG, 'utf8'); const vieux = bloc(bg);
  if (!b || !vieux) { console.log('❌ bloc introuvable'); process.exit(1); }
  fs.writeFileSync(F_BG, bg.replace(vieux, () => b)); console.log('✅ bloc <agent-vrm-regle> recopié dans background.js'); process.exit(0);
}
const argSrc = (() => { const i = process.argv.indexOf('--src'); return i > 0 ? path.resolve(process.argv[i + 1]) : F_BG; })();
const BG = fs.readFileSync(argSrc, 'utf8');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d ? '  → ' + d : '')); } };
const ctx0 = {};
try {
  vm.runInNewContext([bloc(BG, '// <reponses-rapides-regle>', '// </reponses-rapides-regle>'), bloc(BG, '// <lot-relance-regle>', '// </lot-relance-regle>'), bloc(BG),
    'function palierContreOffre' + BG.split('function palierContreOffre')[1].split('\n}\n')[0] + '\n}', 'function reglagesPaliersExt' + BG.split('function reglagesPaliersExt')[1].split('\n}\n')[0] + '\n}',
    'const PALIERS_DEFAUT_EXT = { paliers: [50, 80, 100] };', 'function plancherAbsoluPalier' + BG.split('function plancherAbsoluPalier')[1].split('\n}\n')[0] + '\n}',
    'function plancherPalier' + BG.split('function plancherPalier')[1].split('\n}\n')[0] + '\n}', 'function prixPaliersExt' + BG.split('function prixPaliersExt')[1].split('\n}\n')[0] + '\n}',
    ';globalThis.__f = { agReglage, agDecisionMessage, agDecisionOffre, agTableau, agEmpreinte, lrPlancher, palierContreOffre };'].join('\n'), ctx0);
} catch (e) { console.log('❌ A0 bloc absent ou cassé : ' + e.message); process.exit(1); }
const F = ctx0.__f;
dit(argSrc !== F_BG || bloc(fs.readFileSync(F_SRC, 'utf8')) === bloc(BG), 'A1 les deux copies du bloc sont identiques');

// ── A2 : messages ──
const A = F.agReglage({ actif: true });
const V = { pseudo: 'lea_33', article: 'Nike Dunk', taille: '42', prix: 80, prix_mini: 65 };
const dm = (t, x = {}) => F.agDecisionMessage(Object.assign({ agent: A, conv: '87001', messages: [{ deMoi: false, texte: t }], vars: V, partie: false, photos: 4, heure: 14 }, x));
const SURS = [['Bonjour, toujours disponible ?', 'dispo'], ['Hi, is it still available?', 'dispo'], ['Hola, ¿sigue disponible?', 'dispo'], ['Elles taillent comment ?', 'taille'],
  ['What size is it exactly?', 'taille'], ['Che taglia è?', 'taille'], ['Tu envoies sous combien de temps ?', 'envoi'], ['Wann ist der Versand?', 'envoi'],
  ['Tu fais un lot ?', 'lot'], ['Can I bundle?', 'lot'], ['Tu peux m’envoyer d’autres photos ?', 'photos'], ['Kannst du mir mehr Bilder schicken?', 'photos']];
const PAS_SURS = ['Je n’ai pas reçu le colis, je veux un remboursement', 'C’est une arnaque, je vais signaler', 'Je veux faire un retour', 'Connard, réponds !', 'Tu as WhatsApp ? on s’arrange',
  'Je te paie par PayPal en direct', 'Tu ferais un échange ?', 'Dernier prix ?', 'Il y a des défauts ?', 'C’est authentique ?', 'Dispo ? et quelle taille ?', 'Hmm ok', 'Ça me va, on fait comment',
  'Not received, I want a refund', 'Es una estafa', 'Voglio il rimborso', 'Ich will mein Geld zurück', 'Send me your phone number', 'Is it legit or fake?', 'Can we meet in person?', 'Tu fais en main propre ?',
  'Toujours dispo ? sinon je veux être remboursé', 'Pas reçu le colis : tu l’as envoyé quand ?', 'Dispo ? donne-moi ton WhatsApp', 'Still available? I pay cash'];
let mauvais = [];
for (const [t, cat] of SURS) { const d = dm(t); if (d.geste !== 'repondre' || d.cat !== cat || /65/.test(d.texte)) mauvais.push(t + ' → ' + JSON.stringify(d)); }
dit(!mauvais.length, `A2 ${SURS.length} questions sûres : réponse de SA catégorie, jamais le prix mini`, mauvais.join(' · '));
mauvais = [];
for (const t of PAS_SURS) { const d = dm(t); if (d.geste === 'repondre' || d.geste === 'attendre') mauvais.push(t + ' → ' + JSON.stringify(d)); }
dit(!mauvais.length, `A2 ${PAS_SURS.length} messages non sûrs : AUCUNE réponse automatique (« à toi »)`, mauvais.join(' · '));
dit(dm('Toujours dispo ?', { messages: [{ deMoi: false, texte: 'Toujours dispo ?' }, { deMoi: true, texte: 'Oui !' }] }).geste === 'rien', 'A2 jamais deux messages d’affilée (dernier message = le sien)');
dit(dm('Toujours dispo ?', { messages: [{ deMoi: null, texte: 'Toujours dispo ?' }] }).geste === 'rien', 'A2 auteur pas sûr ⇒ rien');
const d1 = dm('Toujours dispo ?');
dit(dm('Toujours dispo ?', { repondues: new Set([d1.cle]) }).geste === 'rien', 'A2 une seule réponse par question');
dit(dm('Toujours dispo ?', { partie: true }).geste === 'a_toi' && dm('Toujours dispo ?', { partie: null }).geste === 'a_toi', 'A2 « disponible » jamais sur une annonce partie ou pas sue');
dit(dm('Tu peux m’envoyer d’autres photos ?', { photos: 1 }).geste === 'a_toi', 'A2 « photos en plus » seulement si l’annonce en a plusieurs');
dit(dm('Quelle taille ?', { vars: { pseudo: 'x', article: 'y' } }).geste === 'a_toi', 'A2 taille pas sue ⇒ à toi (jamais devinée)');
dit(dm('Tu fais un lot ?', { reglageRr: { revelerMini: true, modeles: { lot: ['Lot à {prix_mini}'] } } }).geste === 'a_toi', 'A2 jamais le prix mini, même si SA réponse à la main le permet');
dit(dm('Toujours dispo ?', { heure: 23 }).geste === 'attendre' && dm('Toujours dispo ?', { heure: 3 }).geste === 'attendre', 'A2 heures calmes (22 h – 8 h par défaut) ⇒ il attend');
dit(F.agDecisionMessage({ agent: F.agReglage({ actif: true, repondre: false }), messages: [{ deMoi: false, texte: 'Dispo ?' }] }).geste === 'rien', 'A2 « répondre » éteint ⇒ rien');

// ── A3 : offres ──
const P = { tranches: [], paliers: [50, 80, 100] };
const dof = (x) => F.agDecisionOffre(Object.assign({ agent: A, offre: 70, prix: 100, mini: 85, refuse: 60, paliers: P, palier: F.palierContreOffre, enVente: true, gardeOk: true, compteBloque: false, joues: [], note: 'ok' }, x));
let d = dof({});
dit(d.geste === 'contre' && d.prix === 93 && d.palier === 0, 'A3 offre 70 (mini 85) ⇒ contre-offre au 1er palier, 93 €', JSON.stringify(d));
d = dof({ joues: [0] }); dit(d.geste === 'contre' && d.prix === 88 && d.palier === 1, 'A3 palier déjà joué ⇒ le suivant (88 €), une par palier', JSON.stringify(d));
dit(dof({ offre: 86 }).geste === 'accepter' && dof({ offre: 55 }).geste === 'refuser', 'A3 au-dessus du seuil ⇒ accepter ; sous le refus ⇒ refuser');
dit(dof({ offre: 90, enVente: false }).geste === 'a_toi' && dof({ offre: 90, gardeOk: false }).geste === 'a_toi', 'A3 acceptation seulement prouvée en vente et sans double vente');
// 5.430 (Julien : « tu n'acceptes pas les comptes 1 étoile ») : la note de l'acheteur, décidée par <note-acheteur-regle>.
dit(dof({ offre: 90, note: 'basse' }).geste === 'a_toi' && dof({ offre: 90, note: 'basse' }).raison === 'note_basse' && dof({ note: 'basse' }).geste === 'a_toi', 'A3 acheteur noté ≤ son seuil ⇒ ni acceptation ni contre-offre : « à toi »');
dit(dof({ offre: 90, note: 'pas-su' }).geste === 'rien' && dof({ note: undefined }).geste === 'rien' && dof({ offre: 90, note: 'neuf-refuse' }).geste === 'a_toi', 'A3 note pas lue (ou absente) ⇒ rien (relue plus tard) ; compte neuf refusé par son réglage ⇒ à toi');
dit(dof({ offre: 90, note: 'neuf' }).geste === 'accepter' && dof({ offre: 55, note: 'basse' }).geste === 'refuser', 'A3 compte neuf qu’il accepte ⇒ accepté ; le refus sous son seuil reste permis quelle que soit la note');
dit(dof({ compteBloque: true }).geste === 'rien' && dof({ faite: true }).geste === 'rien', 'A3 compte bloqué ou offre déjà traitée ⇒ rien');
dit(dof({ mini: null, achat: null }).geste === 'a_toi' && dof({ mini: null, achat: null }).raison === 'plancher_inconnu', 'A3 sans prix mini ni achat ⇒ il ne négocie pas cette paire, et le dit');
let viole = 0, ex = '';
for (let k = 0; k < 3000; k++) {
  const prix = 10 + Math.round(Math.random() * 30000) / 100, mini = Math.random() < 0.6 ? Math.round(prix * (0.4 + Math.random() * 0.7) * 100) / 100 : null;
  const achat = Math.random() < 0.7 ? Math.round(prix * Math.random() * 100) / 100 + 0.01 : null, offre = Math.round(prix * Math.random() * 120) / 100 + 0.5;
  const pal = { tranches: Math.random() < 0.5 ? [{ de: 0, a: 400, baisse: Math.round(Math.random() * 40) + 1 }] : [], paliers: [30, 60, 100], flexible: Math.random() < 0.3 ? { actif: true, ecart: 3 } : undefined, remiseMax: Math.random() < 0.3 ? 40 : undefined };
  const x = dof({ prix, mini, achat, offre, refuse: Math.random() < 0.5 ? Math.round(prix * 0.3) : null, paliers: pal, joues: Math.random() < 0.3 ? [0] : [] });
  const pl = F.lrPlancher(mini, achat);
  if ((x.geste === 'accepter' || x.geste === 'contre') && (!pl || x.prix * 100 < pl.c - 1e-6)) { viole++; ex = JSON.stringify({ prix, mini, achat, offre, x }); }
  if (x.geste === 'contre' && (x.prix <= offre || x.prix >= prix)) { viole++; ex = JSON.stringify({ prix, mini, offre, x }); }
}
dit(viole === 0, 'A3 3 000 offres au hasard : jamais d’acceptation ni de contre-offre sous le plancher (ni ≤ l’offre, ni ≥ le prix)', ex);
const tb = F.agTableau([{ at: 5, geste: 'accepter', etat: 'fait' }, { at: 5, geste: 'contre', etat: 'fait' }, { at: 5, geste: 'a_toi', etat: 'a_toi' }, { at: 5, geste: 'repondre', etat: 'prevu' }, { at: 5, geste: 'accepter', etat: 'essai', essai: true }], 5, () => 'j');
dit(tb.jour === 5 && tb.attente === 1 && tb.aToi === 1 && tb.taux === 50 && tb.essai === 1, 'A3 tableau de bord : décisions du jour, en attente, à toi, taux d’acceptation (hors essai)', JSON.stringify(tb));

// ── A4 : le fond ──
(async () => {
  const { faireFond } = require('./_fond-vm.cjs');
  const UID = '111', T = Date.now();
  const offreMsg = (oid, prix, st = 10) => ({ entity_type: 'offer_request_message', created_at_ts: Math.floor(T / 1000), entity: { user_id: 999, status: st, status_title: st === 10 ? 'En attente' : 'Refusée', current: true, price: { amount: String(prix) }, transaction_id: 55, offer_request_id: oid } });
  const msgA = (t) => ({ entity_type: 'message', entity: { user_id: 999, body: t } });
  const lignes = (agent, convs) => {
    const L = { main: { vinted_annonce_numeros: { '7001': { min: '85', refuse: '60' }, '7002': { min: '40' } }, vinted_offres_paliers: { actif: false, paliers: [50, 80, 100] } }, vinted_listing_dates: {},
      ['harvest_' + UID + '_listings']: { payload: { items: [{ id: 7001, title: 'Nike Dunk', size_title: '42', price: { amount: '100.0' }, photos: [{}, {}] }, { id: 7002, title: 'Adidas Samba', size_title: '40', price: { amount: '60.0' }, photos: [{}, {}] }] } },
      ['harvest_' + UID + '_inbox']: { payload: { conversations: Object.keys(convs).map((c) => ({ id: Number(c) })) } },
      vrm_reglages_auto: { v: 1, cles: { vinted_bleam: { v: 1, comptes: { [UID]: { agent } } } } } };
    for (const [c, x] of Object.entries(convs)) L['harvest_' + UID + '_conv_' + c] = { capturedAt: new Date(T).toISOString(), payload: { conversation: { id: Number(c), opposite_user: { id: 999, login: 'lea_33', feedback_reputation: 0.96, review_count: 40 }, transaction: { id: x.tx || 55, item_id: x.item }, messages: x.msgs } } };
    return L;
  };
  const monter = (agent, convs, opts = {}) => {
    const Fd = faireFond({ src: argSrc, lignes: lignes(agent, convs), connecte: UID });
    const gestes = [], ordre = [];
    const c = Fd.ctx;
    c.garde = async () => opts.frein || null; c.lireFreinRepub = async () => null; c.delaiOffreMs = () => 0; c.facteurPrudence = async () => 1;
    c.annonceIndisponibleLue = async () => ''; c.pauseCompteBloqueDit = async () => null; c.offreGardeDit = () => ''; c.relireOffre = async () => ({ etat: 'attend' });
    c.compterAction = async () => ({ ok: true }); c.secuGeste = async () => opts.secu || null;
    const noter0 = c.agentNoter; c.agentNoter = async (u, e) => { ordre.push('journal:' + (e.etat || '')); return noter0(u, e); };
    c.contreOffreAuto = async (x) => { ordre.push('geste'); gestes.push({ g: 'contre', prix: x.prix, conv: x.o.conv }); return opts.repGeste || { ok: true }; };
    c.repondreOffre = async (x) => { ordre.push('geste'); gestes.push({ g: x.quoi, oid: x.oid }); return opts.repGeste || { ok: true }; };
    c.interfaceVinted = async (acc, g, dd) => { ordre.push('geste'); gestes.push({ g, conv: dd.conv, texte: dd.texte }); return opts.repGeste || { ok: true, status: 200, data: { code: 0 }, vu: true }; };
    return { Fd, gestes, ordre };
  };
  const tick = async (m, n = 1) => { for (let i = 0; i < n; i++) await m.Fd.ctx.agentTick(UID); };
  // éteint
  let m = monter({ actif: false }, { 87001: { item: 7001, msgs: [offreMsg(66, 70)] } });
  await tick(m, 3);
  dit(m.gestes.length === 0 && !((await m.Fd.ctx.agentJournal(UID)) || []).length, 'A4 éteint (par défaut) ⇒ aucune décision, aucun geste');
  // essai
  m = monter({ actif: true, allumeAt: 1, essaiJusqua: T + 3 * 86400000 }, { 87001: { item: 7001, msgs: [offreMsg(66, 70)] }, 87002: { item: 7002, msgs: [msgA('Toujours disponible ?')] } });
  await tick(m, 3);
  let J = (await m.Fd.ctx.agentJournal(UID)) || [];
  dit(m.gestes.length === 0 && J.length === 2 && J.every((e) => e.essai && e.etat === 'essai') && J.some((e) => e.geste === 'contre' && e.prix === 93), 'A4 mode ESSAI : il écrit ce qu’il AURAIT fait (contre-offre 93 €, réponse), RIEN ne part', JSON.stringify({ g: m.gestes, J }));
  // négociation complète
  const convs = { 87001: { item: 7001, msgs: [offreMsg(66, 70)] } };
  m = monter({ actif: true, allumeAt: 1 }, convs);
  await tick(m, 2);
  const lgn = m.Fd.lignes['harvest_' + UID + '_conv_87001'];
  lgn.payload.conversation.messages = [offreMsg(66, 70, 30), { entity_type: 'offer_message', entity: { user_id: 111, price: { amount: '93' } } }, offreMsg(67, 86)];
  await tick(m, 2);
  dit(m.gestes.length === 2 && m.gestes[0].g === 'contre' && m.gestes[0].prix === 93 && m.gestes[1].g === 'accept' && m.gestes[1].oid === '67', 'A4 négociation complète : 70 → contre-offre 93 € → 86 acceptée (une fois chacune)', JSON.stringify(m.gestes));
  dit(m.ordre.indexOf('geste') > m.ordre.indexOf('journal:prevu') && m.ordre[m.ordre.indexOf('geste') - 1] === 'journal:envol', 'A4 chaque décision est au journal AVANT le geste (prévue, puis en vol)', m.ordre.join(','));
  // réponse sûre, jamais deux
  m = monter({ actif: true, allumeAt: 1 }, { 87002: { item: 7002, msgs: [msgA('Bonjour, toujours disponible ?')] }, 87003: { item: 7002, msgs: [msgA('Je n’ai pas reçu le colis, remboursement svp')] } });
  m.Fd.ctx.heureParisAgent = () => 14;
  await tick(m, 4);
  J = (await m.Fd.ctx.agentJournal(UID)) || [];
  const rep = m.gestes.filter((x) => x.g === 'message');
  dit(rep.length === 1 && rep[0].conv === '87002' && /lea_33/.test(rep[0].texte) && /Adidas Samba/.test(rep[0].texte), 'A4 une réponse sûre envoyée, remplie par identité, JAMAIS deux', JSON.stringify(m.gestes));
  dit(J.some((e) => e.conv === '87003' && e.geste === 'a_toi') && !m.gestes.some((x) => x.conv === '87003'), 'A4 la réclamation est « à toi » : rien n’est envoyé');
  // frein ⇒ arrêt
  m = monter({ actif: true, allumeAt: 1 }, { 87001: { item: 7001, msgs: [offreMsg(66, 70)] } }, { frein: { ok: false, code: 'pause', pause: true } });
  await tick(m, 2);
  const st = await m.Fd.ctx.agentArrete(UID);
  dit(m.gestes.length === 0 && st && st.raison === 'pause', 'A4 un frein de Vinted (pause 403/429) ARRÊTE l’agent, et c’est dit', JSON.stringify(st));
  m = monter({ actif: true, allumeAt: 1 }, { 87001: { item: 7001, msgs: [offreMsg(66, 70)] } }, { repGeste: { ok: false, status: 429, pause: true } });
  await tick(m, 3);
  dit(m.gestes.length === 1 && (await m.Fd.ctx.agentArrete(UID)) && (await m.Fd.ctx.agentArrete(UID)).raison === 'pause', 'A4 un 429 sur un geste arrête l’agent (plus aucun geste ensuite)', JSON.stringify(m.gestes));
  m = monter({ actif: true, allumeAt: 1 }, { 87001: { item: 7001, msgs: [offreMsg(66, 70)] } }, { secu: { ok: false, code: 'robot', secu: 'robot' } });
  await tick(m, 2);
  dit(m.gestes.length === 0 && (await m.Fd.ctx.agentArrete(UID)) && (await m.Fd.ctx.agentArrete(UID)).raison === 'robot', 'A4 une vérification (captcha) avant le geste ⇒ aucun geste, agent arrêté');
  console.log(`\n${ko ? '❌' : '✅'} audit-agent-vrm : ${ok} verts, ${ko} rouges`);
  if (process.argv.includes('--prouve')) prouver();
  process.exitCode = ko ? 1 : 0;
})().catch((e) => { console.log('❌ A4 ' + (e && e.stack)); process.exitCode = 1; });

function prouver() {
  const M = {
    sures: ["if (!AG_CATS_SURES.includes(cat)) return", "if (false) return"],
    risque: ["if (risque) return { geste: 'a_toi', raison: 'risque_' + risque, cle };", ''],
    plusieurs: ["if (qs.length > 1) return { geste: 'a_toi', raison: 'plusieurs_questions', cle };", ''],
    affilee: [["if (der.deMoi === true) return { geste: 'rien', raison: 'dernier_de_moi' };", ''], ['    if (m.deMoi !== false) break;\n', '    if (m.deMoi === true) continue;\n'], ["if (der.deMoi !== false) return { geste: 'rien', raison: 'auteur_pas_su' };", '']],
    mini: [["const rr = Object.assign({}, c.reglageRr || {}, { revelerMini: false });", "const rr = Object.assign({}, c.reglageRr || {});"], ['const vars = Object.assign({}, c.vars || {}); delete vars.prix_mini;', 'const vars = Object.assign({}, c.vars || {});'], ["if (/\\{prix_mini\\}/.test(p.texte)) return", "if (false) return"]],
    deuxFois: ["if (rep.has(cle)) return { geste: 'rien', raison: 'deja_repondu' };", ''],
    plancher: ["if (!pl) return { geste: 'a_toi', raison: 'plancher_inconnu' };", "if (!pl) return { geste: 'contre', prix: o + 1, raison: 'x' };"],
    enVente: ["if (c.enVente !== true) return { geste: 'a_toi', raison: 'pas_prouvee_en_vente' };", ''],
    essai: [['    if (essai) return 0;\n', '\n'], ["essai ? 'essai' : 'prevu'", "'prevu'"], ["essai ? 'essai' : 'prevu'", "'prevu'"], ["e.etat === 'prevu' && !e.essai &&", "e.etat === 'prevu' &&"]],
    journalAvant: ["for (const e of nouvelles) if (!(await agentNoter(uid, e))) return 0;", ''],
    eteint: ["if (!B || !B.agent || B.agent.actif !== true) return 0;", 'if (!B) return 0;'],
    arret: ["{ const f2 = freinArret(r); if (f2) await agentArreter(uid, f2); }", ''],
  };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-mut-'));
  let rouges = 0;
  for (const [k, v] of Object.entries(M)) {
    const paires = Array.isArray(v[0]) ? v : [v]; let t = BG, manque = false;
    for (const [a, b] of paires) { const t2 = t.replace(a, b); if (t2 === t) manque = true; t = t2; }
    if (manque) { console.log('❌ mutation ' + k + ' : motif introuvable'); continue; }
    if (t === BG) { console.log('❌ mutation ' + k + ' : motif introuvable'); continue; }
    const f = path.join(dir, k + '.js'); fs.writeFileSync(f, t);
    let code = 0; try { cp.execFileSync(process.execPath, [__filename, '--src', f], { stdio: 'pipe' }); } catch (e) { code = e.status || 1; }
    console.log((code ? '✅' : '❌') + ` mutation « ${k} » ⇒ ${code ? 'rouge' : 'reste vert'}`); if (code) rouges++;
  }
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`--prouve : ${rouges}/${Object.keys(M).length} mutations rouges`);
  if (rouges !== Object.keys(M).length) process.exitCode = 1;
}
