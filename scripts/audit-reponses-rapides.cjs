#!/usr/bin/env node
// audit-reponses-rapides (21 nov., ext. 5.421, `reponsesrapides`) — RÉPONSES RAPIDES SANS IA.
// Exécute la règle <reponses-rapides-regle> TELLE QU'ELLE EST DANS background.js (le fichier livré) :
//  R1. les deux copies (src/reponsesRapides.js et background.js) sont identiques (--recopie la refait) ;
//  R2. un CORPUS de phrases inventées (5 langues) : chaque catégorie attendue est repérée, et les FAUX POSITIFS sont
//      COMPTÉS (phrases sans question, catégories en trop) — plafond : 5 % des catégories rendues ;
//  R3. variables : posées quand SUES ; pas sue ⇒ version SAUTÉE (jamais un trou) ; {prix_mini} jamais sans SON accord ;
//  R4. « toujours disponible » jamais sous une annonce partie ; un texte que la règle des mots refuse n'est pas proposé ;
//  R5. SES modèles gagnent sur les défauts ; la langue de la réponse par défaut est celle du message ;
//  R6. `rrReglage` : bornes (5 versions, 1 000 caractères, variable inconnue refusée), `revelerMini` éteint par défaut ;
//  R7. le FOND : `reponsesRapidesCarte` sur le vrai background.js (fausse base) remplit {taille} et {prix} par l'IDENTITÉ
//      de l'annonce de la conversation (`transaction.item_id`) parmi 50 annonces au MÊME titre ; fil pas rangé ⇒ « pas lu »,
//      jamais une réponse ; il n'envoie RIEN (aucune requête Vinted).
// --prouve : chaque règle affaiblie (mutation du bloc dans une copie de background.js) ⇒ au moins un rouge.
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os'), cp = require('child_process');
const R = path.join(__dirname, '..');
const F_SRC = path.join(R, 'src/reponsesRapides.js'), F_BG = path.join(R, 'vinted-sync-extension/background.js');
const DEB = '// <reponses-rapides-regle>', FIN = '// </reponses-rapides-regle>';
const bloc = (t, a = DEB, b = FIN) => { const i = t.indexOf(a), j = t.indexOf(b); return i < 0 || j < 0 ? null : t.slice(i, j + b.length); };
if (process.argv.includes('--recopie')) {
  const b = bloc(fs.readFileSync(F_SRC, 'utf8')); let bg = fs.readFileSync(F_BG, 'utf8'); const vieux = bloc(bg);
  if (!b || !vieux) { console.log('❌ bloc introuvable'); process.exit(1); }
  fs.writeFileSync(F_BG, bg.replace(vieux, () => b)); console.log('✅ bloc <reponses-rapides-regle> recopié dans background.js'); process.exit(0);
}
const argSrc = (() => { const i = process.argv.indexOf('--src'); return i > 0 ? path.resolve(process.argv[i + 1]) : F_BG; })();
const BG = fs.readFileSync(argSrc, 'utf8');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d ? '  → ' + d : '')); } };

function charger() {
  const b = bloc(BG); if (!b) throw new Error('bloc absent de background.js');
  const ctx = {}; vm.runInNewContext(b + '\n;globalThis.__f = { rrQuestions, rrLangue, rrRemplir, rrReglage, rrPropositions, rrQuestionEnAttente, rrErreurTexte, RR_DEFAUTS };', ctx);
  return ctx.__f;
}
let F; try { F = charger(); } catch (e) { console.log('❌ R0 le bloc ne s’exécute pas : ' + e.message); process.exit(1); }
dit(argSrc !== F_BG || bloc(fs.readFileSync(F_SRC, 'utf8')) === bloc(BG), 'R1 les deux copies du bloc sont identiques (src ⇄ background.js)');

// ── R2 : le corpus (inventé) ──
const C = [
  ['Bonjour, est-ce toujours disponible ?', ['dispo']], ['Salut, c’est encore dispo ?', ['dispo']], ['Hi, is this still available?', ['dispo']],
  ['Hola, ¿sigue disponible?', ['dispo']], ['Ciao, è ancora disponibile?', ['dispo']], ['Hallo, ist das noch verfügbar?', ['dispo']],
  ['Elles taillent normalement ? Je chausse du 43', ['taille']], ['Quelle pointure exactement ?', ['taille']], ['Do they run small or true to size?', ['taille']],
  ['¿Qué talla es?', ['taille']], ['Che taglia è? La calzata?', ['taille']], ['Welche Größe ist das?', ['taille']],
  ['Tu envoies sous combien de temps ?', ['envoi', 'prix']], ['Quel délai de livraison ?', ['envoi']], ['When can you ship?', ['envoi']],
  ['¿Cuándo haces el envío?', ['envoi']], ['Quando spedisci?', ['envoi']], ['Wann ist der Versand?', ['envoi']],
  ['Tu fais un lot si je prends les deux ?', ['lot']], ['Can I buy both together as a bundle?', ['lot']], ['¿Me haces un lote con los dos?', ['lot']],
  ['Faresti un lotto con entrambi?', ['lot']], ['Kann ich beide zusammen als Paket haben?', ['lot']],
  ['C’est quoi ton dernier prix ?', ['prix']], ['Le prix est négociable ?', ['prix']], ['What’s your lowest price?', ['prix']],
  ['¿Cuál es el último precio?', ['prix']], ['Ultimo prezzo?', ['prix']], ['Was ist der letzte Preis?', ['prix']],
  ['Il y a des défauts ?', ['etat']], ['Elles sont dans quel état ?', ['etat']], ['Any flaws or stains?', ['etat']],
  ['¿Tiene algún defecto?', ['etat']], ['Ci sono difetti?', ['etat']], ['Gibt es Mängel oder Flecken?', ['etat']],
  ['Elles sont authentiques ?', ['authenticite']], ['Tu as la facture ?', ['authenticite']], ['Are they authentic or fake?', ['authenticite']],
  ['¿Son originales o falsas?', ['authenticite']], ['Sono autentiche?', ['authenticite']], ['Hast du die Rechnung?', ['authenticite']],
  ['Tu peux m’envoyer plus de photos ?', ['photos']], ['Can you send more pictures of the sole?', ['photos']], ['¿Me mandas más fotos?', ['photos']],
  ['Puoi mandarmi altre foto?', ['photos']], ['Kannst du mir mehr Bilder schicken?', ['photos']],
  ['Tu ferais un échange ?', ['echange']], ['Would you trade for my Jordans?', ['echange']], ['¿Harías un intercambio?', ['echange']],
  ['Faresti uno scambio?', ['echange']], ['Würdest du tauschen?', ['echange']],
  ['Dispo ? Et quelle taille ?', ['dispo', 'taille']], ['Still available? What size?', ['dispo', 'taille']],
];
// Des phrases SANS question qu'il faudrait reconnaître : aucune catégorie n'est attendue (faux positifs comptés).
const NEUTRES = ['Merci beaucoup, bonne journée !', 'Super, merci !', 'Thanks a lot, have a nice day', 'Gracias, buen día', 'Grazie mille!', 'Danke schön!',
  'J’ai bien reçu, tout est parfait', 'Ok parfait', 'Received, all good, thanks', 'Je vais réfléchir', 'Top merci', 'Bonne soirée à toi', 'Ça marche', 'Vale perfecto', 'Va bene', 'Alles klar', 'Profite bien de ton week-end', 'Typique de moi, j’avais oublié', 'Je repasse plus tard, je suis pilote de ligne'];
let attendues = 0, trouvees = 0, rendues = 0, fauxPositifs = 0, fpNeutres = 0; const rates = [], fp = [];
for (const [t, exp] of C) {
  const got = F.rrQuestions(t).map((x) => x.cat); rendues += got.length;
  for (const e of exp) { attendues++; if (got.includes(e)) trouvees++; else rates.push(t + ' (' + e + ')'); }
  for (const g of got) if (!exp.includes(g)) { fauxPositifs++; fp.push(t + ' (+' + g + ')'); }
}
for (const t of NEUTRES) { const got = F.rrQuestions(t).map((x) => x.cat); rendues += got.length; fauxPositifs += got.length; fpNeutres += got.length; if (got.length) fp.push(t + ' (+' + got.join(',') + ')'); }
console.log(`   corpus : ${C.length} questions + ${NEUTRES.length} phrases neutres · ${trouvees}/${attendues} catégories repérées · ${fauxPositifs} faux positifs sur ${rendues} rendues`);
if (fp.length) console.log('   faux positifs : ' + fp.join(' · '));
dit(trouvees === attendues, `R2 chaque catégorie attendue est repérée (${trouvees}/${attendues})`, rates.join(' · '));
dit(fauxPositifs / Math.max(1, rendues) <= 0.05, `R2 faux positifs ≤ 5 % (${fauxPositifs}/${rendues})`, fp.join(' · '));
dit(fpNeutres === 0, `R2 aucune phrase sans question ne reçoit de catégorie (${fpNeutres})`, fp.join(' · '));
dit(F.rrLangue('Hola, ¿sigue disponible?') === 'es' && F.rrLangue('Hallo, ist das noch verfügbar?') === 'de' && F.rrLangue('Hi, is this still available?') === 'en' && F.rrLangue('Ciao, è ancora disponibile?') === 'it', 'R2 la langue du message est reconnue (es, de, en, it)');

// ── R3 : variables ──
const V = { pseudo: 'marie_75', article: 'Nike Air Max 90', taille: '42', prix: 60, prix_mini: 50 };
dit(F.rrRemplir('Salut {pseudo}, {article} en {taille} à {prix}', V).texte === 'Salut marie_75, Nike Air Max 90 en 42 à 60 €', 'R3 les variables sues sont posées');
dit(F.rrRemplir('Taille {taille}', { pseudo: 'x' }).manque === 'taille', 'R3 une taille pas sue saute la version (jamais un trou)');
dit(F.rrRemplir('Mini {prix_mini}', V).manque === 'prix_mini_cache' && F.rrRemplir('Mini {prix_mini}', V, { revelerMini: true }).texte === 'Mini 50 €', 'R3 {prix_mini} n’est posé QUE s’il l’a choisi');
let P = F.rrPropositions({ texte: 'Dernier prix ?', vars: V, hasard: () => 0 });
dit(P.propositions.length === 1 && !/50/.test(P.propositions[0].texte) && /60 €/.test(P.propositions[0].texte), 'R3 « dernier prix ? » sans son accord : la version au prix mini est sautée, le prix de l’annonce est dit', JSON.stringify(P.propositions));
P = F.rrPropositions({ texte: 'Dernier prix ?', vars: V, reglage: { revelerMini: true }, hasard: () => 0 });
dit(P.propositions[0] && /50 €/.test(P.propositions[0].texte), 'R3 avec son accord, le prix mini peut être proposé', JSON.stringify(P.propositions));
P = F.rrPropositions({ texte: 'Quelle taille ?', vars: { pseudo: 'x', article: 'y' } });
dit(P.propositions[0] && !P.propositions[0].texte && P.propositions[0].manque === 'taille', 'R3 taille demandée mais pas sue ⇒ rien de proposé, le manque est dit', JSON.stringify(P.propositions));
// ── R4 ──
P = F.rrPropositions({ texte: 'Toujours dispo ?', vars: V, partie: true });
dit(P.propositions[0] && P.propositions[0].manque === 'partie' && !P.propositions[0].texte, 'R4 « toujours disponible » jamais sous une annonce partie');
P = F.rrPropositions({ texte: 'Toujours dispo ?', vars: V, sur: () => false });
dit(P.propositions[0] && !P.propositions[0].texte && P.propositions[0].manque === 'texte_interdit', 'R4 un texte refusé par la règle des mots n’est pas proposé');
// ── R5 ──
P = F.rrPropositions({ texte: 'Toujours dispo ?', vars: V, reglage: { modeles: { dispo: ['Oui {pseudo} !'] } } });
dit(P.propositions[0] && P.propositions[0].texte === 'Oui marie_75 !' && P.propositions[0].sienne === true, 'R5 SON modèle gagne sur le défaut');
P = F.rrPropositions({ texte: 'Hola, ¿sigue disponible?', vars: V, langueUi: 'fr' });
dit(P.propositions[0] && /^Hola marie_75/.test(P.propositions[0].texte), 'R5 la réponse par défaut suit la langue du message', JSON.stringify(P.propositions));
dit(F.rrQuestionEnAttente([{ deMoi: false, texte: 'Dispo ?' }, { deMoi: true, texte: 'Oui' }]) === '' && F.rrQuestionEnAttente([{ deMoi: true, texte: 'Oui' }, { deMoi: false, texte: 'Taille ?' }]) === 'Taille ?', 'R5 seule la question APRÈS sa dernière réponse est lue');
// ── R6 ──
const RG = F.rrReglage({ modeles: { dispo: ['a', 'b', 'c', 'd', 'e', 'f'], taille: ['Salut {nom}', 'x'.repeat(1001), 'ok {taille}'], inconnu: ['z'] }, revelerMini: 'oui' });
dit(RG.modeles.dispo.length === 5 && RG.modeles.taille.length === 1 && RG.modeles.taille[0] === 'ok {taille}' && !RG.modeles.inconnu && RG.revelerMini === false, 'R6 bornes du réglage (5 versions, 1 000 car., variable inconnue refusée, prix mini caché par défaut)', JSON.stringify(RG));
for (const cat of Object.keys(F.RR_DEFAUTS)) for (const l of ['fr', 'en', 'es', 'it', 'de']) if (!F.RR_DEFAUTS[cat][l] || F.RR_DEFAUTS[cat][l].some((t) => F.rrErreurTexte(t))) dit(false, `R6 défaut ${cat}/${l} absent ou mal écrit`);

// ── R7 : le fond (vrai background.js, fausse base) ──
(async () => {
  const { faireFond } = require('./_fond-vm.cjs');
  const UID = '111', CONV = '87001', ITEM = '7777025';
  const items = Array.from({ length: 50 }, (_, i) => ({ id: String(7777000 + i), title: 'Nike Dunk Low Panda', size_title: String(36 + (i % 12)), price: { amount: String(50 + i) }, photos: [{}, {}] }));
  const lignes = {
    main: { vinted_annonce_numeros: { [ITEM]: { min: '61' } } },
    vinted_listing_dates: {},
    ['harvest_' + UID + '_listings']: { payload: { items } },
    ['harvest_' + UID + '_conv_' + CONV]: { capturedAt: new Date().toISOString(), payload: { conversation: { id: Number(CONV), opposite_user: { id: 999, login: 'acheteuse_42' }, transaction: { id: 5501, item_id: Number(ITEM), item_title: 'Nike Dunk Low Panda' },
      messages: [{ entity_type: 'message', entity: { user_id: 999, body: 'Bonjour, quelle taille exactement ? et le dernier prix ?' } }] } } },
  };
  const F2 = faireFond({ src: argSrc, lignes, connecte: UID, onglets: [{ id: 7, url: 'https://www.vinted.fr/inbox/' + CONV, status: 'complete' }] });
  const sender = { tab: { id: 7, url: 'https://www.vinted.fr/inbox/' + CONV }, url: 'https://www.vinted.fr/inbox/' + CONV };
  F2.ctx.compteConnecte = async () => UID;
  let r; try { r = await F2.ctx.reponsesRapidesCarte({ conv: CONV, langue: 'fr' }, sender); } catch (e) { r = { ok: false, raison: String(e && e.message) }; }
  const pt = r && r.propositions ? r.propositions.find((p) => p.cat === 'taille') : null, pp = r && r.propositions ? r.propositions.find((p) => p.cat === 'prix') : null;
  if (process.env.DBG) console.log(JSON.stringify(r));
  dit(r && r.ok && pt && /taille 37/.test(pt.texte) && /acheteuse_42/.test(pt.texte), 'R7 {taille} vient de L’annonce de la conversation (item_id), parmi 50 au même titre', JSON.stringify(r && r.propositions));
  dit(pp && /75 €/.test(pp.texte) && !/61/.test(pp.texte), 'R7 {prix} = le prix de CETTE annonce ; son prix mini (61) n’est pas révélé', JSON.stringify(pp));
  dit(r && r.ia && r.ia.dispo === false, 'R7 « avec ma clé IA » absent et dit (aucune clé de vendeur côté serveur)');
  let r2; try { r2 = await F2.ctx.reponsesRapidesCarte({ conv: '87002' }, sender); } catch (e) { r2 = null; }
  dit(r2 && r2.ok && r2.fil === 'pas_lu' && !r2.propositions.length, 'R7 fil pas rangé ⇒ « pas lu », aucune réponse inventée');
  dit(!F2.j.vinted.some((q) => q && q.method && q.method !== 'GET'), 'R7 aucune écriture chez Vinted (le panneau n’envoie que sur SON toucher)');
  console.log(`\n${ko ? '❌' : '✅'} audit-reponses-rapides : ${ok} verts, ${ko} rouges`);
  if (process.argv.includes('--prouve')) prouver();
  process.exitCode = ko ? 1 : 0;
})();

function prouver() {
  const M = {
    partie: ["if (cat === 'dispo' && c.partie === true)", "if (cat === 'dispo' && false)"],
    mini: ["if (nom === 'prix_mini' && o.revelerMini !== true)", "if (false)"],
    trou: ["if (!brut) { manque = nom; return x; }", "if (!brut) { return ''; }"],
    sur: ["if (!sur(r.texte))", "if (false)"],
    mot: ["const rrContient = (n, m) => rrMotRe(m).test(n);", "const rrContient = (n, m) => n.includes(rrNormaliser(m.replace('*', '')).trim());"],
    langue: ["const langue = rrLangue(question) ||", "const langue = null ||"],
  };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-mut-'));
  let rouges = 0;
  for (const [k, [a, b]] of Object.entries(M)) {
    const t = BG.replace(a, b); if (t === BG) { console.log('❌ mutation ' + k + ' : motif introuvable'); continue; }
    const f = path.join(dir, k + '.js'); fs.writeFileSync(f, t);
    let code = 0; try { cp.execFileSync(process.execPath, [__filename, '--src', f], { stdio: 'pipe' }); } catch (e) { code = e.status || 1; }
    console.log((code ? '✅' : '❌') + ` mutation « ${k} » ⇒ ${code ? 'rouge' : 'reste vert'}`); if (code) rouges++;
  }
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`--prouve : ${rouges}/${Object.keys(M).length} mutations rouges`);
  if (rouges !== Object.keys(M).length) process.exitCode = 1;
}
