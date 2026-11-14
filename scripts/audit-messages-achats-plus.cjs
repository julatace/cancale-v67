// ═════════════════════════════════════════════════════════════════════════════
// AUDIT : MESSAGES ET ACHATS, EN PLUS (14 nov., lot messages-achats-plus)
//        node scripts/audit-messages-achats-plus.cjs
// EXÉCUTE les règles (src/*.js, api/_lib/catalogue-prive.js, le vrai background.js),
// puis lit l'app. Données INVENTÉES.
//  108 · les infos d'une paire se rangent sous son IDENTITÉ (N°, sinon annonce) ; un
//        toucher les INSÈRE dans le champ (jamais d'envoi) ; un N° sur deux paires les cache ;
//  109 · 40 messages, 5 langues : la question et la langue repérées par des mots FERMÉS ;
//        la réponse proposée ne dit que ce qui est su (sans info ⇒ rien, le manque dit) ;
//        « dispo » jamais sous une annonce partie ; aucune IA, aucun réseau dans la règle ;
//  110 · le catalogue : la projection publique n'a ni prix d'achat, ni pseudo, ni compte,
//        ni lien ; un article d'un autre vendeur n'y entre pas ; expiré ⇒ 404 ; révoqué ⇒
//        404 ; jeton inconnu ⇒ 404 ; un autre vendeur ne révoque rien ; route dans compte.js ;
//  111 · la liste de recherche : critères structurés (marque, modèle, taille, prix ≤ max) ;
//        pas su ⇒ pas de signal ; l'extension n'ajoute AUCUNE requête Vinted (appels de
//        `requeteVinted` comptés dans le vrai background.js) ;
//  125 · le carnet : vendeur = identifiant lu sur la TRANSACTION (jamais un pseudo) ; deux
//        sources qui se contredisent ⇒ personne ; sommes « au moins » avec couverture ;
//  131 · même item_id ⇒ signal ; même titre, autre id ⇒ rien ; annulé ⇒ pas un achat.
// `AUDIT_RACINE=<dossier>` : juger un autre arbre (preuve sur le code d'avant / mutation).
// ═════════════════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const RACINE = process.env.AUDIT_RACINE || path.join(__dirname, '..');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const lire = (rel) => { try { return fs.readFileSync(path.join(RACINE, rel), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const charger = async (rel) => { try { return await import(path.join(RACINE, rel)); } catch (e) { dit(false, `${rel} existe et se charge`, String(e && e.message).slice(0, 140)); return null; } };

// ── 109 : les 40 messages (8 par langue) — [texte, sujets attendus, langue attendue] ──
const MESSAGES = [
  ['Bonjour, est-elle toujours dispo ?', ['dispo'], 'fr'],
  ['Bonjour, quelle taille réelle ? elle taille grand ?', ['taille'], 'fr'],
  ['Est-ce qu’il y a des défauts ou des taches ?', ['etat'], 'fr'],
  ['Vous pouvez me donner la longueur de la semelle en cm svp', ['mesures'], 'fr'],
  ['Le prix est négociable ? dernier prix ?', ['prix'], 'fr'],
  ['Vous envoyez sous combien de temps ? délai de livraison', ['envoi'], 'fr'],
  ['On peut faire une remise en main propre sur Paris ?', ['mainpropre'], 'fr'],
  ['Merci beaucoup, bonne journée !', [], 'fr'],
  ['Hi, is this still available?', ['dispo'], 'en'],
  ['Hello, does it fit true to size or run small?', ['taille'], 'en'],
  ['Any flaws or stains on the shoes?', ['etat'], 'en'],
  ['Can you tell me the insole length please', ['mesures'], 'en'],
  ['What is your lowest price?', ['prix'], 'en'],
  ['How fast do you ship?', ['envoi'], 'en'],
  ['Could we meet up in person?', ['mainpropre'], 'en'],
  ['Thanks a lot, have a nice day', [], 'en'],
  ['Hola, ¿sigue disponible?', ['dispo'], 'es'],
  ['Hola, ¿qué tal la talla? ¿la horma es grande?', ['taille'], 'es'],
  ['¿Tiene algún defecto o mancha?', ['etat'], 'es'],
  ['¿Cuál es el largo de la plantilla en cm?', ['mesures'], 'es'],
  ['¿Es negociable el precio?', ['prix'], 'es'],
  ['¿Cuándo haces el envío?', ['envoi'], 'es'],
  ['¿Podemos quedar para la entrega en mano?', ['mainpropre'], 'es'],
  ['Muchas gracias por todo', [], 'es'],
  ['Ciao, è ancora disponibile?', ['dispo'], 'it'],
  ['Ciao, che taglia è? la calzata è regolare?', ['taille'], 'it'],
  ['Ci sono difetti o macchie?', ['etat'], 'it'],
  ['Qual è la lunghezza della soletta?', ['mesures'], 'it'],
  ['Il prezzo è trattabile?', ['prix'], 'it'],
  ['Quando fai la spedizione?', ['envoi'], 'it'],
  ['Possiamo vederci di persona per il ritiro?', ['mainpropre'], 'it'],
  ['Grazie mille, buona giornata', [], 'it'],
  ['Hallo, ist der Schuh noch verfügbar?', ['dispo'], 'de'],
  ['Hallo, wie ist die Passform, fällt er klein aus?', ['taille'], 'de'],
  ['Gibt es Mängel oder Flecken?', ['etat'], 'de'],
  ['Wie lang ist die Innensohle in cm?', ['mesures'], 'de'],
  ['Ist der Preis verhandelbar?', ['prix'], 'de'],
  ['Wann ist der Versand?', ['envoi'], 'de'],
  ['Kann ich ihn persönlich abholen?', ['mainpropre'], 'de'],
  ['Danke schön und schönen Tag', [], 'de'],
];

(async () => {
  const IP = await charger('src/infosPaire.js');
  const Q = await charger('src/questionsFrequentes.js');
  const LR = await charger('src/listeRecherche.js');
  const AM = await charger('src/achatMemeAnnonce.js');
  const CV = await charger('src/carnetVendeurs.js');
  const CP = await charger('api/_lib/catalogue-prive.js');

  // ── 108 ────────────────────────────────────────────────────────────────────
  if (IP) {
    const ops = IP.opsInfos({}, { numero: '007', itemId: '123456' }, { taille: ' taille petit,  prendre ½ au-dessus ', defauts: 'petite tache semelle gauche', semelle: '28,5' }, { maintenant: '2026-11-14T10:00:00Z' });
    dit(ops.length === 1 && ops[0].id === 'n:7' && ops[0].k === 'vrm_infos_paires' && ops[0].apres.semelle === 28.5 && ops[0].apres.taille === 'taille petit, prendre ½ au-dessus',
      '108 · les infos se rangent sous le N° (« 007 » = « 7 »), nettoyées, semelle en cm', JSON.stringify(ops));
    const carte = { 'n:7': ops[0].apres, 'a:999999': { defauts: 'autre paire' } };
    const i = IP.infosDe(carte, { numero: '7', itemId: '123456' });
    dit(i && i.semelle === 28.5 && i.defauts === 'petite tache semelle gauche', '108 · relues par identité');
    const titre50 = Array.from({ length: 50 }, (_, k) => ({ numero: String(100 + k), itemId: String(500000 + k), titre: 'Nike Air Max 90 blanche 43' }));
    dit(titre50.every((p) => IP.infosDe(carte, p) === null), '108 · 50 paires au même titre : aucune ne reçoit les infos du N°7 (le titre n’entre pas)');
    dit(IP.infosDe(carte, { titre: 'Nike Air Max 90 blanche 43' }) === null, '108 · sans identité : rien');
    const c2 = IP.infosDe(carte, { numero: '7' }, { ambigu: (k) => k === '7' });
    dit(c2 && c2.cachee === true && !('semelle' in c2), '108 · un N° porté par deux paires présentes : infos cachées');
    dit(IP.semelleCm('9') === null && IP.semelleCm('41') === null && IP.semelleCm('abc') === null && IP.semelleCm('27.5 cm') === 27.5, '108 · semelle hors 10–40 cm ou illisible : rien (jamais deviné)');
    const m = IP.morceauxInfos(i, 'fr');
    dit(m.map((x) => x.texte).join(' | ') === 'Taille réelle : taille petit, prendre ½ au-dessus. | Défauts : petite tache semelle gauche. | Longueur de semelle : 28,5 cm.', '108 · les phrases à insérer (fr)', m.map((x) => x.texte).join(' | '));
    dit(IP.morceauxInfos(i, 'en')[2].texte === 'Insole length: 28.5 cm.', '108 · dans la langue du message (en)');
    const t1 = IP.insererDansReponse('', m[2].texte), t2 = IP.insererDansReponse('Bonjour,', m[2].texte), t3 = IP.insererDansReponse(t2, m[2].texte);
    dit(t1 === m[2].texte && t2 === 'Bonjour, ' + m[2].texte && t3 === t2, '108 · insérer : vide ⇒ la phrase ; sinon ajoutée ; jamais deux fois');
    const effacer = IP.opsInfos(carte, { numero: '7' }, { taille: '', defauts: '', semelle: '' });
    dit(effacer.length === 1 && effacer[0].apres === undefined, '108 · tout vide ⇒ effacé');
  }

  // ── 109 ────────────────────────────────────────────────────────────────────
  if (Q) {
    let bons = 0, langues = 0;
    const rates = [];
    for (const [t, sujets, l] of MESSAGES) {
      const s = Q.questionsDe(t).map((x) => x.sujet);
      const okS = JSON.stringify(s) === JSON.stringify(sujets);
      const okL = sujets.length === 0 || Q.langueDuMessage(t) === l;
      if (okS) bons++; else rates.push(`« ${t} » ⇒ ${JSON.stringify(s)}`);
      if (okL) langues++; else rates.push(`« ${t} » langue ${Q.langueDuMessage(t)} ≠ ${l}`);
    }
    dit(MESSAGES.length === 40 && new Set(MESSAGES.map((x) => x[2])).size === 5, '109 · le banc : 40 messages, 5 langues');
    dit(bons === 40, `109 · sujet repéré juste sur ${bons}/40 (aucun faux sur « merci »)`, rates.slice(0, 4).join(' · '));
    dit(langues === 40, `109 · langue juste sur ${langues}/40`);
    const infos = { taille: 'taille un peu petit', defauts: 'aucun', semelle: 28.5 };
    const pSans = Q.propositionsPour('Quelle taille ?', { infos: null, tailleFiche: '43' });
    dit(pSans.length === 1 && pSans[0].texte === '' && pSans[0].manque === 'taille', '109 · sans taille réelle écrite : RIEN de proposé, le manque est dit (jamais deviné)', JSON.stringify(pSans));
    const pAvec = Q.propositionsPour('Quelle taille ?', { infos, tailleFiche: '43' });
    dit(pAvec[0].texte === 'Taille 43. Taille réelle : taille un peu petit.', '109 · avec la fiche : la taille de la fiche + SES mots', pAvec[0].texte);
    const pEn = Q.propositionsPour('Hi, is it still available? what size?', { infos, tailleFiche: '43' });
    dit(pEn.length === 2 && pEn[0].texte === 'Hi, yes, it’s still available.' && pEn[1].texte.startsWith('Size 43.'), '109 · un message à deux questions, en anglais : deux propositions en anglais', JSON.stringify(pEn.map((x) => x.texte)));
    const pPartie = Q.propositionsPour('Toujours dispo ?', { partie: true });
    dit(pPartie[0].texte === '' && pPartie[0].manque === 'partie', '109 · annonce prouvée partie : « toujours disponible » n’est jamais proposé');
    const pSem = Q.propositionsPour('Wie lang ist die Innensohle?', { infos });
    dit(pSem[0].texte === 'Innensohle: 28,5 cm.', '109 · semelle en allemand, la valeur de la fiche', pSem[0] && pSem[0].texte);
    dit(Q.questionEnAttente([{ deMoi: false, texte: 'dispo ?' }, { deMoi: true, texte: 'oui' }, { deMoi: false, texte: 'quelle taille ?' }]) === 'quelle taille ?', '109 · seule la question APRÈS sa dernière réponse est lue');
    const src = sansCommentaires(lire('src/questionsFrequentes.js'));
    dit(!/\bfetch\s*\(|XMLHttpRequest|\/api\/ai|anthropic|openai|import\s*\(/.test(src) && !/from\s+['"](?!\.\/infosPaire\.js)/.test(src), '109 · la règle n’appelle rien : ni réseau, ni IA, ni clé (§2.9)');
  }

  // ── 111 ────────────────────────────────────────────────────────────────────
  if (LR) {
    const liste = [
      { id: 'r1', marque: 'Nike', modele: 'air max 90', tailles: ['42,5', '43'], prixMax: 80 },
      { id: 'r2', marque: 'Adidas', modele: 'samba', tailles: [], prixMax: null },
      { id: 'r3', marque: '', modele: '', tailles: ['43'], prixMax: 50 },   // trop large : écartée
    ];
    dit(LR.listePropre(liste).length === 2, '111 · une ligne sans marque ni modèle est écartée (trop large)');
    const a = { marque: 'Nike', titre: 'Nike Air Max 90 blanche', taille: '43', prix: '60,00 €' };
    dit(LR.correspondances(liste, a).map((x) => x.id).join() === 'r1', '111 · marque + modèle + taille + prix ≤ max ⇒ dans ta liste');
    dit(LR.correspondances(liste, { ...a, prix: '81 €' }).length === 0, '111 · prix au-dessus du max ⇒ rien');
    dit(LR.correspondances(liste, { ...a, taille: '44' }).length === 0, '111 · autre taille ⇒ rien');
    dit(LR.correspondances(liste, { ...a, prix: '' }).length === 0 && LR.correspond(liste[0], { ...a, prix: '' }).pasSu === true, '111 · prix pas lu sur la page ⇒ pas de signal (pas su ≠ oui)');
    dit(LR.correspondances(liste, { ...a, titre: 'Nike Air Max 1' }).length === 0, '111 · tous les mots du modèle doivent être dans le titre');
    dit(LR.correspondances(liste, { marque: '', titre: 'adidas samba og', taille: '40' }, { marqueDe: (t) => (/adidas/i.test(t) ? 'Adidas' : '') }).map((x) => x.id).join() === 'r2', '111 · page sans marque : la marque lue dans le titre par la règle de l’app');
    dit(LR.tailleCle('44 2/3') === '44.67' && LR.tailleCle('EU 42,5') === '42.5' && LR.tailleCle('xl') === 'XL' && LR.tailleCle('') === '', '111 · tailles : 44 2/3, EU 42,5, XL');
  }
  // 111 · l'extension : aucune requête Vinted ajoutée (le vrai background.js).
  {
    const bg = lire('vinted-sync-extension/background.js');
    const vi = lire('vinted-sync-extension/vinted-infos.js');
    const compter = (s) => (sansCommentaires(s).match(/\brequeteVinted\s*\(/g) || []).length;
    let base = null;
    try { const { execFileSync } = require('child_process'); base = execFileSync('git', ['-C', path.join(__dirname, '..'), 'show', 'origin/main:vinted-sync-extension/background.js'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); } catch (_) {}
    if (base != null) dit(compter(bg) === compter(base), `111 · appels de requeteVinted dans background.js : ${compter(bg)} (origin/main : ${compter(base)}) — aucun ajouté`);
    // Le chemin de l'encart, EXÉCUTÉ dans le vrai fond (`_fond-vm.cjs`) : la page d'une
    // annonce d'un AUTRE vendeur, sa liste de recherche et ses achats dans la base VRM.
    let FV = null; try { FV = require(path.join(RACINE, 'scripts', '_fond-vm.cjs')); } catch (_) {}
    if (FV && bg) {
      const UID = '111', PID = '9001', VENDEUR = '5555', ITEM = '4440001';
      const lignes = {
        main: { vinted_annonce_numeros: {}, vrm_liste_recherche: [{ id: 'r1', marque: 'Nike', modele: 'dunk low', tailles: ['42'], prixMax: 90 }],
          vrm_annonces_achetees: { v: 1, total: 2, connus: 2, ids: { [ITEM]: [{ tx: '9000001', c: '222', d: '2026-10-01' }] } } },
        vinted_listing_dates: {},
        [`harvest_${UID}_profile`]: { payload: { user: { id: Number(PID) } } },
        [`harvest_${UID}_listings`]: { capturedAt: new Date().toISOString(), payload: { items: [] } },
      };
      const f = FV.faireFond({ src: path.join(RACINE, 'vinted-sync-extension', 'background.js'), lignes, connecte: UID });
      const r = await f.envoyer({ from: 'cancale-vinfos', action: 'infos', items: [ITEM], membres: [PID, VENDEUR] }, { tab: { id: 7, url: `https://www.vinted.fr/items/${ITEM}-nike-dunk-low` } });
      dit(r && r.ok && r.achat === true && Array.isArray(r.recherche) && r.recherche.length === 1 && Array.isArray(r.achete) && r.achete.length === 1 && r.achete[0].tx === '9000001',
        '111/131 · le vrai fond rend à l’encart SA liste et les achats de CETTE annonce (identifiant exact)', JSON.stringify(r).slice(0, 200));
      dit(f.j.vinted.length === 0, `111/131 · aucune requête Vinted pour cela (${f.j.vinted.length})`);
      const r2 = await f.envoyer({ from: 'cancale-vinfos', action: 'infos', items: ['4440002'], membres: [PID, VENDEUR] }, { tab: { id: 7, url: 'https://www.vinted.fr/items/4440002-nike-dunk-low' } });
      dit(r2 && r2.ok && Array.isArray(r2.achete) && r2.achete.length === 0, '131 · une autre annonce (même titre) : aucun achat rendu');
      dit(f.j.vinted.length === 0, '111/131 · toujours aucune requête Vinted');
    }
    const fn = (nom) => { const i = bg.indexOf('async function ' + nom); return i < 0 ? '' : bg.slice(i, bg.indexOf('\n}\n', i)); };
    const dip = fn('donneesInfosPage');
    dit(/vrm_liste_recherche/.test(dip) && /vrm_annonces_achetees/.test(dip) && !/requeteVinted|vintedPage|avecVinted/.test(dip), '111/131 · l’encart lit la liste et les achats dans la base VRM (lireMain), sans requête Vinted');
    dit(/correspondances\s*\(/.test(vi) && /achatsDeLAnnonce\s*\(/.test(vi) && !/fetch\s*\(/.test(sansCommentaires(vi)), '111/131 · la page compare l’annonce DÉJÀ ouverte (règles recopiées), sans fetch');
    const R = lire('vinted-sync-extension/vrm-regles-achat.js');
    dit(/correspondances/.test(R) && /achatsDeLAnnonce/.test(R), '111/131 · les règles sont la copie refabriquée de src/ (regles-achat-extension.cjs)');
  }

  // ── 131 ────────────────────────────────────────────────────────────────────
  if (AM) {
    const achats = [
      { transaction_id: '9000001', date: '2026-10-01T10:00:00Z', title: 'Nike Dunk Low panda 42', _acc: { vinted_user_id: '11' } },
      { transaction_id: '9000002', date: '2026-11-02T10:00:00Z', title: 'Dunk panda (même annonce)', _acc: { vinted_user_id: '22' } },
      { transaction_id: '9000003', date: '2026-11-03T10:00:00Z', title: 'Nike Dunk Low panda 42', _acc: { vinted_user_id: '11' } },
      { transaction_id: '9000004', date: '2026-11-04T10:00:00Z', title: 'Nike Dunk Low panda 42', status: 'Annulée', _acc: { vinted_user_id: '11' } },
      { transaction_id: '9000005', date: '2026-11-05T10:00:00Z', title: 'sans détail', _acc: { vinted_user_id: '11' } },
    ];
    const itemDeTx = { 9000001: '4440001', 9000002: '4440001', 9000003: '4440009', 9000004: '4440009' };
    const carte = AM.annoncesAchetees({ achats, itemDeTx, estAnnule: (o) => /annul/i.test(o.status || ''), maintenant: Date.parse('2026-11-14T00:00:00Z') });
    dit(AM.achatsDeLAnnonce(carte, '4440001').length === 2 && AM.groupesMemeAnnonce(carte).map((g) => g.item).join() === '4440001', '131 · même item_id sur deux comptes ⇒ signal (titres différents)');
    dit(AM.achatsDeLAnnonce(carte, '4440009').length === 1 && AM.groupesMemeAnnonce(carte).length === 1, '131 · même TITRE, autre identifiant ⇒ rien ; achat annulé ⇒ pas un achat');
    dit(AM.dejaAchete(carte, '4440009') === true && AM.dejaAchete(carte, '4440010') === false && AM.dejaAchete(carte, '') === false, '131 · « déjà achetée » par l’identifiant exact seulement');
    dit(carte.total === 4 && carte.connus === 3, '131 · couverture : annonce connue pour 3 achats sur 4', `${carte.connus}/${carte.total}`);
    const json = JSON.stringify(carte);
    dit(!/Nike|panda|price|login/.test(json), '131 · la carte publiée n’a ni titre, ni prix, ni pseudo');
    const cinquante = Array.from({ length: 50 }, (_, k) => ({ transaction_id: String(8000000 + k), title: 'Nike Dunk Low panda 42', date: '2026-11-01' }));
    dit(AM.groupesMemeAnnonce(AM.annoncesAchetees({ achats: cinquante, itemDeTx: {} })).length === 0, '131 · 50 achats identiques sans identifiant ⇒ aucun signal');
  }

  // ── 125 ────────────────────────────────────────────────────────────────────
  if (CV) {
    const v = CV.vendeursDesAchats({
      txns: [{ tx: '7000001', side: 'buyer', sid: '501', login: 'shop_a' }, { tx: '7000002', side: 'buyer', sid: '502', login: 'shop_a' }, { tx: '7000009', side: 'seller', sid: '1', login: 'moi' }, { tx: '7000004', side: 'buyer', sid: '501' }],
      convs: [{ tx: '7000003', side: 'buyer', opp: '501', login: 'shop_a' }, { tx: '7000004', side: 'buyer', opp: '777' }, { tx: '7000005', side: 'seller', opp: '501' }],
    });
    dit(v.get('7000001').id === '501' && v.get('7000002').id === '502', '125 · deux vendeurs au MÊME pseudo restent deux (identifiant lu sur la transaction)');
    dit(!v.has('7000009') && !v.has('7000005'), '125 · une VENTE n’entre pas dans le carnet (côté acheteur seulement)');
    dit(!v.has('7000004'), '125 · transaction et conversation qui se contredisent ⇒ personne (mieux vaut un blanc qu’un faux)');
    dit(v.get('7000003').id === '501', '125 · la conversation de CETTE transaction, côté acheteur, donne le vendeur');
    const achats = ['7000001', '7000002', '7000003', '7000006', '7000007'].map((tx, k) => ({ transaction_id: tx, date: `2026-10-0${k + 1}T10:00:00Z`, prix: k === 2 ? null : 40 }));
    const bilan = { sources: [{ cle: 'vinted', liste: [{ genre: 'vinted', id: '7000001', revendus: 1, benefice: 3500, partiel: false }, { genre: 'vinted', id: '7000003', revendus: 1, benefice: 1200, partiel: true }] }] };
    const etats = { 7000001: { s: 450, su: '2026-10-05T10:00:00Z' }, 7000003: { s: 440 } };
    const c = CV.carnetVendeurs({ achats, vendeurs: v, etats, bilan, montant: (o) => o.prix });
    const a = c.vendeurs.find((x) => x.id === '501');
    dit(c.total === 5 && c.avecVendeur === 3 && c.sansVendeur === 2, '125 · couverture : vendeur connu pour 3 achats sur 5 (les 2 autres chez personne)');
    dit(a && a.achats === 2 && a.benefice === 4700 && a.partiel === true && a.revendus === 2, '125 · ce que ses paires ont rapporté = le bénéfice de « Tes meilleures sources », relu ; frais pas confirmés ⇒ « au plus »', JSON.stringify(a && { b: a.benefice, p: a.partiel }));
    dit(a && a.investi === 4000 && a.auMoins === true && a.sansPrix === 1, '125 · investi « au moins » 40 € : un prix illisible est dit, jamais 0');
    dit(a && a.delaiJours === 4 && a.soucis.retour === 1, '125 · délai (achat → commande finalisée) et soucis (retour) par transaction');
  }

  // ── 110 ────────────────────────────────────────────────────────────────────
  if (CP) {
    const NEUTRE = '00000000-0000-0000-0000-000000000000';
    const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const base = 'https://base.test';
    const lignes = new Map();   // `${owner}|${id}` → data
    const fauxFetch = async (url, opts = {}) => {
      const u = new URL(url);
      const q = u.searchParams;
      const meth = (opts.method || 'GET').toUpperCase();
      const owner = (q.get('owner') || '').replace(/^eq\./, '');
      const idf = q.get('id') || '';
      if (meth === 'POST') { for (const l of JSON.parse(opts.body)) lignes.set(`${l.owner}|${l.id}`, l.data); return { ok: true, json: async () => [] }; }
      if (meth === 'DELETE') { lignes.delete(`${owner}|${idf.replace(/^eq\./, '')}`); return { ok: true, json: async () => [] }; }
      const out = [];
      for (const [k, d] of lignes) {
        const [o, id] = k.split('|');
        if (owner && o !== owner) continue;
        if (idf.startsWith('eq.') && id !== idf.slice(3)) continue;
        if (idf.startsWith('like.') && !new RegExp('^' + idf.slice(5).replace(/\*/g, '.*') + '$').test(id)) continue;
        const sel = q.get('select') || '';
        const r = {};
        for (const part of sel.split(',')) {
          const [alias, chemin] = part.includes(':') ? part.split(':') : [part, part];
          if (chemin === 'id') { r[alias] = id; continue; }
          const m = /^data(->>|->)(\w+)$/.exec(chemin); if (!m) continue;
          const v = d[m[2]]; r[alias] = m[1] === '->>' ? (v == null ? null : typeof v === 'object' ? JSON.stringify(v) : String(v)) : (v === undefined ? null : v);
        }
        out.push(r);
      }
      return { ok: true, json: async () => out };
    };
    // SES dressings (lus avec SA session : RLS) — un autre vendeur a aussi les siens.
    const dressings = {
      [A]: [{ id: 'harvest_11_listings', items: [
        { id: 3330001, title: 'Nike Air Max 90 blanche', brand: 'Nike', size: '43', price: { amount: '95.0', currency_code: 'EUR' }, photo: { url: 'https://images1.vinted.net/t/a/f800/1.jpeg' }, user: { login: 'shop_secret' }, url: 'https://www.vinted.fr/items/3330001', buyPrice: '41' },
        { id: 3330002, title: 'Adidas Samba OG', brand: 'Adidas', size: '42', price: { amount: '80.0', currency_code: 'EUR' }, photo: { url: 'https://images1.vinted.net/t/a/f800/2.jpeg' } }] }],
      [B]: [{ id: 'harvest_22_listings', items: [{ id: 3339999, title: 'Annonce de B', brand: 'Puma', size: '40', price: { amount: '30.0' }, photo: { url: 'https://images1.vinted.net/b.jpeg' } }] }],
    };
    const mainDe = { [A]: { n3330001: '124', n3330002: null } };
    const lireVendeurDe = (owner) => async (chemin) => (/harvest_\*_listings/.test(chemin) ? dressings[owner] : /id=eq\.main/.test(chemin) ? [mainDe[owner] || {}] : null);
    let horloge = Date.parse('2026-11-14T10:00:00Z');
    let nId = 0; const aleatoireId = () => (++nId).toString(16).padStart(16, 'a');
    const route = (x) => CP.traiterCatalogue({ base, cle: 'service', fetch: fauxFetch, maintenant: horloge, aleatoireId, ...x });
    const cree = await route({ methode: 'POST', user: { id: A }, corps: { action: 'creer', items: ['3330001', '3330002', '3339999'], jours: 7, numero: true }, lireVendeur: lireVendeurDe(A) });
    dit(cree.status === 200 && cree.body.n === 2 && cree.body.absentes === 1, '110 · créé : 2 articles, celui d’un AUTRE vendeur absent (jamais sa donnée)', JSON.stringify(cree.body).slice(0, 160));
    const jeton = cree.body.url ? cree.body.url.split('/').pop() : '';
    const page = await route({ methode: 'GET', jeton });
    const html = String(page.body || '');
    dit(page.status === 200 && /Nike Air Max 90 blanche/.test(html) && /N°124/.test(html) && /95/.test(html), '110 · la page publique : photo, titre, taille, prix, N° (coché)');
    dit(!/shop_secret|41\s*€|buyPrice|3330001|vinted\.fr\/items|harvest_|Annonce de B/.test(html), '110 · la projection publique n’a ni prix d’achat, ni pseudo, ni compte, ni identifiant, ni lien Vinted, ni article d’un autre');
    dit(!/<script/i.test(html) && CP.CSP_CATALOGUE.includes("default-src 'none'"), '110 · page sans script, CSP fermée');
    const ligne = [...lignes.entries()].find(([k]) => k.startsWith(A + '|vrm_catalogue_'));
    dit(ligne && !/shop_secret|buyPrice|"url"/.test(JSON.stringify(ligne[1].paires)), '110 · ce qui est rangé est déjà la projection (rien de plus)');
    // Sans N° coché.
    const sansN = await route({ methode: 'POST', user: { id: A }, corps: { action: 'creer', items: ['3330001'], numero: false }, lireVendeur: lireVendeurDe(A) });
    const pageSansN = await route({ methode: 'GET', jeton: sansN.body.url.split('/').pop() });
    dit(!/N°124/.test(String(pageSansN.body)), '110 · N° décoché ⇒ aucun N° sur la page');
    // Une ligne retouchée à la main par le vendeur (RLS le lui permet) : la sortie refiltre.
    ligne[1].paires[0].prixAchat = 41; ligne[1].paires[0].login = 'shop_secret';
    const page2 = await route({ methode: 'GET', jeton });
    dit(!/shop_secret|prixAchat/.test(String(page2.body)), '110 · une ligne retouchée n’ajoute rien à la page (liste blanche à la sortie)');
    // Un autre vendeur ne révoque rien.
    const cid = cree.body.cid;
    const rB = await route({ methode: 'POST', user: { id: B }, corps: { action: 'revoquer', cid } });
    const encore = await route({ methode: 'GET', jeton });
    dit(rB.status === 404 && encore.status === 200, '110 · un autre vendeur ne révoque pas ce lien (rien chez lui)');
    const listeB = await route({ methode: 'GET', user: { id: B } });
    dit(listeB.status === 200 && listeB.body.catalogues.length === 0, '110 · un autre vendeur ne voit aucun des liens');
    const listeA = await route({ methode: 'GET', user: { id: A } });
    dit(listeA.body.catalogues.length === 2 && listeA.body.catalogues.every((c) => c.etat === 'actif'), '110 · ses liens, actifs');
    // Révoqué ⇒ 404.
    const rA = await route({ methode: 'POST', user: { id: A }, corps: { action: 'revoquer', cid } });
    const apres = await route({ methode: 'GET', jeton });
    dit(rA.status === 200 && apres.status === 404, '110 · révoqué ⇒ 404');
    // L'index encore là (sa suppression a raté) mais la ligne marquée retirée ⇒ 404 quand même.
    const c3 = await route({ methode: 'POST', user: { id: A }, corps: { action: 'creer', items: ['3330002'] }, lireVendeur: lireVendeurDe(A) });
    const j3 = c3.body.url.split('/').pop();
    const l3 = lignes.get(`${A}|vrm_catalogue_${c3.body.cid}`); l3.revoque = true;
    dit((await route({ methode: 'GET', jeton: j3 })).status === 404, '110 · ligne marquée retirée (index resté) ⇒ 404 quand même');
    // La sortie publique : seulement la liste blanche.
    const pp = CP.projectionPublique([{ titre: 'T', marque: 'M', taille: '42', prix: 10, photo: 'https://images1.vinted.net/x.jpeg', numero: '12', prixAchat: 41, buyPrice: '41', login: 'shop', accountId: '11', id: 3330001, url: 'https://www.vinted.fr/items/1' }], true);
    dit(pp.length === 1 && Object.keys(pp[0]).sort().join() === 'marque,numero,photo,prix,taille,titre', '110 · la projection publique : liste blanche seulement', Object.keys(pp[0] || {}).join());
    // Expiré ⇒ 404.
    const j2 = sansN.body.url.split('/').pop();
    horloge += 7 * 86400000 + 1000;
    const exp = await route({ methode: 'GET', jeton: j2 });
    dit(exp.status === 404, '110 · expiré (7 j par défaut) ⇒ 404');
    dit((await route({ methode: 'GET', jeton: 'x'.repeat(43) })).status === 404, '110 · jeton inconnu ⇒ 404');
    // La base ne répond pas ⇒ 503, jamais une page vide.
    const panne = await CP.traiterCatalogue({ base, cle: 'service', fetch: async () => ({ ok: false }), methode: 'GET', jeton: j2 });
    dit(panne.status === 503, '110 · lecture ratée ⇒ 503');
    const cmp = sansCommentaires(lire('api/compte.js'));
    dit(/mode === 'catalogue'/.test(cmp) && /traiterCatalogue\(/.test(cmp) && /lireCommeVendeur\(req, c\)/.test(cmp), '110 · la route vit dans api/compte.js (aucune 13e fonction), dressings lus avec SA session');
    dit(/"\/catalogue\/:jeton"/.test(lire('vercel.json')), '110 · vercel.json réécrit /catalogue/<jeton>');
    dit(fs.readdirSync(path.join(RACINE, 'api')).filter((f) => f.endsWith('.js')).length <= 12, '110 · 12 fonctions api/ au plus');
  }

  // ── L'APP : les points d'entrée et les clés ─────────────────────────────────
  const app = sansCommentaires(lire('src/App.jsx'));
  const n2954 = /const SYNC_KEYS = \[[\s\S]*?\];/.exec(app);
  const sync = n2954 ? n2954[0] : '';
  dit(/'vrm_infos_paires'/.test(sync) && /'vrm_liste_recherche'/.test(sync) && /'vrm_annonces_achetees'/.test(sync), 'app · vrm_infos_paires, vrm_liste_recherche et vrm_annonces_achetees sont synchronisées (ligne main)');
  dit(/<AideReponse\b/.test(app), '108/109 · la rangée d’aide est montée au-dessus du champ de réponse Vinted');
  const ar = sansCommentaires(lire('src/AideReponse.jsx'));
  dit(ar && /onInserer\(/.test(ar) && !/onEnvoyer|sendReply|vmrCmd|fetch\s*\(/.test(ar), '108/109 · un toucher INSÈRE dans le champ ; la rangée n’envoie rien elle-même');
  dit(/publierAnnoncesAchetees|annoncesAchetees\(/.test(app), '131 · l’écran Achats publie les annonces achetées');
  const ap = sansCommentaires(lire('src/AchatsPlus.jsx'));
  dit(/<AchatsPlus\b[\s\S]{0,900}?lireVendeurs=\{lireVendeursAchats\}/.test(app) && /carnetVendeurs\(/.test(ap), '125 · le carnet des vendeurs est joignable depuis Achats (lu à l’ouverture)');
  dit(/sid:data->payload->transaction->>seller_id/.test(app) && !/login.*vendeursDesAchats|vendeursDesAchats\([^)]*titre/.test(app), '125 · le vendeur vient de `seller_id` de la transaction (jamais d’un pseudo)');
  dit(/<CataloguePrive\b/.test(app) && /k:'catalogue'/.test(app), '110 · le catalogue privé est joignable depuis l’app (Annonces → Outils)');
  const cpj = sansCommentaires(lire('src/CataloguePrive.jsx'));
  dit(cpj && /items: \[\.\.\.choix\]/.test(cpj) && !/prixAchat|buyPrice/.test(cpj), '110 · le navigateur n’envoie que des identifiants d’annonces (aucun prix d’achat)');
  dit(/onChangerListe=\{changerListeRecherche\}/.test(app) && /save\(CLE_LISTE_RECHERCHE/.test(app), '111 · la liste de recherche se règle dans l’app (rangée chez VRM)');

  console.log(ko ? `\n${ko} contrôle(s) rouge(s).` : '\nTout est vert.');
  process.exit(ko ? 1 : 0);
})();
