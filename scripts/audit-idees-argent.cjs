// ════════════════════════════════════════════════════════════════════════════
//  IDÉES ARGENT (14 nov.) — 159 dépense en photo · 160 vente en main propre ·
//  161 « Dis Siri… » · 162 partager en image. Les RÈGLES EXÉCUTÉES :
//   D  la dépense : lue sur le ticket (montant + date), jamais rangée sans son clic
//      (aucune écriture dans la lecture), lecture ratée ⇒ saisie à la main ; elle
//      ENTRE dans les charges du bénéfice (`comptaChargesMois` d'App.jsx, exécutée)
//      et dans AUCUNE règle de CA ; une lecture de `vrm_compta` ratée n'écrit rien ;
//   V  la vente en main propre : identité par le N° EXACT (« 124 » ≠ « 1240 » ≠
//      « B124 »), 50 paires au même titre ⇒ aucune désignée par le titre, un N° porté
//      deux fois ⇒ LA QUESTION (jamais un choix) ; le geste sort la paire du stock
//      (case libérée, N° gardé), « Annuler » rend l'état exact ; vendu ET CA du jour
//      saisi (api/_lib/ventes-regle.js, la règle de l'app recopiée) ; mode de
//      paiement gardé ; reçu sans acheteur ni prix d'achat ;
//   S  la route Siri : la VRAIE fonction `api/widget.js` (`?mode=siri`) EXÉCUTÉE
//      contre une base servie à la vraie forme (§4.10) : jeton aléatoire long, rendu
//      une fois, HACHÉ côté serveur (jamais rangé en clair), mauvais jeton ⇒ 401
//      SANS aucune lecture des données, coupé ⇒ 401, panne ⇒ 503, lectures
//      projetées sur deux petites lignes (jamais `select=data`, jamais `main`) ;
//      « 275 € vendus aujourd'hui, 3 ventes », « Mondial Relay, code 5 8 2 9 1 3 »,
//      « 8 colis à envoyer » ; une publication d'un autre jour ⇒ « pas encore »,
//      jamais « 0 € » ;
//   I  l'image : 1080×1920 et 1080×1080, et AUCUNE donnée privée dessinée (contexte
//      espion : chaque texte posé est relu) ni passée par la fiche ;
//   C  le branchement (points d'entrée, une seule règle, aucune fonction api/ neuve).
//  `--prouve` : chaque mutation réaffaiblit une règle ⇒ l'audit doit ROUGIR.
//  Données inventées seulement (dépôt public). Lancer : node scripts/audit-idees-argent.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), crypto = require('crypto'), vm = require('vm');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver, sansCommentaires } = require('./_mutations-audit.cjs');
const lire = (f) => fs.readFileSync(path.join(R, f), 'utf8');

const MUTATIONS = {
  'dépense rangée dès la lecture': [['src/ideesArgent/Feuilles.jsx', '    setLecture(l);\n  };', "    setLecture(l);\n    save('vrm_compta', comptaAvecDepense(load('vrm_compta', null), { id: 'x', montant: 1 }));\n  };"]],
  'lecture de vrm_compta ratée qui écrit quand même': [['src/ideesArgent/depensePhoto.js', "  if (!compta || typeof compta !== 'object' || Array.isArray(compta) || !depense || !depense.id) return null;", "  if (!depense || !depense.id) return null; compta = compta || {};"]],
  'montant deviné quand rien n’est lu': [['src/ideesArgent/depensePhoto.js', "  if (m == null) return { erreur: 'montant' };", "  if (m == null) return { depense: { id: str(id), date: str(saisie.date), libelle: 'x', cat: saisie.cat, montant: 0 } };"]],
  'N° par préfixe (124 ⇒ 1240)': [['src/ideesArgent/venteMain.js', "&& cle(f.numero) === k);", "&& cle(f.numero).startsWith(k));"]],
  'N° double : la première choisie': [['src/ideesArgent/venteMain.js', "return { etat: cartes.length === 1 ? 'une' : 'plusieurs', cle: k, cartes };", "return { etat: 'une', cle: k, cartes: cartes.slice(0, 1) };"]],
  'paire vendue restée au stock': [['src/venteAilleurs.js', '  if (!dedans) ops.push(', '  if (false) ops.push(']],
  'paiement jamais rangé': [['src/venteAilleurs.js', '...(paiement ? { paiement } : {})', '...{}']],
  'Siri : jeton rangé en clair': [['api/_lib/siri-jeton.js', 'data: { h, at: maint, debut, langue }', 'data: { h, jeton, at: maint, debut, langue }']],
  'Siri : index cru sans re-comparer': [['api/_lib/siri-jeton.js', "if (!ligne || !egal(h, ligne.h)) { await supprimerIndex(ctx, h); return refus(); }", 'if (!ligne) return refus();']],
  'Siri : jeton mal formé lu quand même': [['api/_lib/siri-jeton.js', '  if (!RE_JETON_SIRI.test(k)) return refus();   // aucune lecture pour un jeton mal formé', '']],
  'Siri : lecture lourde (select=data)': [['api/_lib/siri-jeton.js', "lireUne(ctx, `app_data?${o}&id=eq.widget_stats&select=${SELECT_STATS_SIRI}&limit=1`)", "lireUne(ctx, `app_data?${o}&id=eq.widget_stats&select=data&limit=1`).then((x) => (x && x.data) || x)"]],
  'Siri : vieille publication dite comme du jour': [['api/_lib/siri-reponses.js', "if (!s || s.jour !== jourParis(maintenant) ||", 'if (!s ||']],
  'Siri : panne prise pour « rien »': [['api/_lib/siri-jeton.js', '  if (stats === undefined || retrait === undefined) return res.status(503).json(PAS_SU);', '']],
  'Siri : deux codes, un choisi': [['api/_lib/siri-reponses.js', "    if (parId.has(c.id) && parId.get(c.id) !== String(c.code)) { parId.set(c.id, null); continue; }   // deux codes ⇒ aucun\n", '']],
  'Siri : couper sans retirer l’index': [['api/_lib/siri-jeton.js', "    if (hAvant && !(await supprimerIndex(ctx, hAvant))) return res.status(503).json(PAS_SU);\n    // + la ligne", "    // + la ligne"]],
  'image : prix d’achat dessiné': [['src/ideesArgent/carteImage.js', "    num: avecNumero ? str(e.num || e.numero).slice(0, 8) : '',\n  };", "    num: avecNumero ? str(e.num || e.numero).slice(0, 8) : '',\n    achat: str(e.buyPrice),\n  };"], ['src/ideesArgent/carteImage.js', "  if (c.taille) {", "  if (c.achat) texte(c.achat, 0, 0);\n  if (c.taille) {"]],
  'image : N° montré sans la case': [['src/ideesArgent/carteImage.js', "num: avecNumero ? str(e.num || e.numero).slice(0, 8) : '',", "num: str(e.num || e.numero).slice(0, 8),"]],
};
if (process.argv.includes('--prouve')) { prouver(__filename, R, MUTATIONS); return; }

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d != null ? ' — ' + String(d).slice(0, 400) : '')); } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — a levé', String(e && e.stack || e).split('\n').slice(0, 3).join(' ')); } };
const imp = (f) => import('file://' + path.join(R, f));
const NEUTRE = '00000000-0000-0000-0000-000000000000';
const A = '11111111-2222-4333-8444-555555555555', B = '99999999-2222-4333-8444-555555555555';
const sha = (t) => crypto.createHash('sha256').update(t, 'utf8').digest('hex');

// Une déclaration `const nom = … ;` d'App.jsx (le texte exact, recollé par _source-app).
function declaration(src, nom) {
  const i = src.indexOf(`const ${nom} = `);
  if (i < 0) throw new Error(nom + ' absent d’App.jsx');
  return src.slice(i, src.indexOf('\n};\n', i) + 3);
}

(async () => {
  const G = await imp('src/gesteAnnulable.js');

  // ── D · la dépense en photo ─────────────────────────────────────────────
  await essaie('D', async () => {
    const D = await imp('src/ideesArgent/depensePhoto.js');
    const ticket = 'BRICO DEPOT\nRUE DES LILAS\n12/11/2026 14:32\nCARTONS X10   8,90\nSCOTCH        3,60\nTOTAL TTC    12,50 EUR\nCB           12,50\nTVA 20%       2,08';
    const l = D.lectureTicket({ texte: ticket }, new Date('2026-11-14T10:00:00'));
    dit(l.etat === 'lu' && l.montant === 1250 && l.date === '2026-11-12', 'D1 un ticket : montant (12,50 €) et date (12/11) LUS', JSON.stringify(l));
    const rate = D.lectureTicket({ texte: '', raison: 'hors-ligne' });
    dit(rate.etat === 'rate' && rate.montant == null && rate.date == null, 'D2 lecture ratée ⇒ rien de lu (la saisie à la main est proposée, rien n’est deviné)', JSON.stringify(rate));
    const rien = D.lectureTicket({ texte: 'MERCI DE VOTRE VISITE\nA BIENTOT' });
    dit(rien.etat === 'rien' && rien.montant == null, 'D3 un ticket sans total ⇒ aucun montant (jamais « le plus grand nombre »)', JSON.stringify(rien));
    dit(D.depenseAEnregistrer({ saisie: { montant: '', date: '2026-11-12', cat: 'Emballage' }, id: 'dabc123' }).erreur === 'montant'
      && D.depenseAEnregistrer({ saisie: { montant: '12,50', date: '2027-05-01', cat: 'Emballage' }, id: 'dabc123', maintenant: Date.parse('2026-11-14T10:00:00') }).erreur === 'date'
      && D.depenseAEnregistrer({ saisie: { montant: '12,50', date: '2026-11-12', cat: 'Essence' }, id: 'dabc123' }).erreur === 'cat', 'D4 montant vide, date future, catégorie inconnue ⇒ rien n’est rangé');
    const v = D.depenseAEnregistrer({ saisie: { montant: '12,50', date: '2026-11-12', cat: 'Emballage', libelle: '' }, id: 'dabc123', ticket: true, maintenant: Date.parse('2026-11-14T10:00:00') });
    dit(v.depense && v.depense.montant === 12.5 && v.depense.cat === 'Emballage' && v.depense.libelle === 'Emballage' && v.depense.ticket === true && v.depense.date === '2026-11-12'
      && Object.keys(v.depense).sort().join() === 'cat,date,id,libelle,montant,ticket', 'D5 la dépense a LA forme de la boîte à dépenses de Compta ({ id, date, libelle, cat, montant, ticket })', JSON.stringify(v));
    const avant = { depenses: [{ id: 'd0', date: '2026-11-02', libelle: 'Scotch', cat: 'Emballage', montant: 4 }], fixes: [{ id: 'f', montant: 10 }], packs: [], abonnements: [] };
    const apres = D.comptaAvecDepense(avant, v.depense);
    dit(apres.depenses.length === 2 && apres.depenses[0].id === 'dabc123' && apres.fixes.length === 1 && D.comptaAvecDepense(apres, v.depense) === apres, 'D6 ajoutée en tête, rien d’autre perdu, jamais deux fois');
    dit(D.comptaAvecDepense(null, v.depense) === null && D.comptaAvecDepense([], v.depense) === null, 'D7 `vrm_compta` illisible ⇒ null : rien n’est écrit');
    // Le BÉNÉFICE : la règle de l'app, exécutée.
    const app = require('./_source-app.cjs').sourceApp(R);
    const ctx = vm.createContext({ chargeAbonnement: () => 0, Number, String });
    vm.runInContext(declaration(app, 'comptaChargesMois') + '\nthis.CM = comptaChargesMois;', ctx);
    const c0 = ctx.CM(avant, '2026-11').total, c1 = ctx.CM(apres, '2026-11').total, c10 = ctx.CM(apres, '2026-10').total;
    dit(c1 - c0 === 12.5 && c10 === 10, 'D8 elle entre dans les charges du bénéfice de SON mois (comptaChargesMois d’App.jsx), pas dans un autre', `${c0} → ${c1} ; octobre ${c10}`);
    const regles = sansCommentaires(lire('api/_lib/ventes-regle.js')) + sansCommentaires(declaration(app, 'ventesFaites'));
    dit(!/vrm_compta|depenses?\b|comptaCharges/.test(regles), 'D9 aucune règle de CA (ventesFaites, ventesDeclarables) ne lit les dépenses : jamais dans le CA');
    // « jamais sans son clic » : dans la feuille, la seule écriture de `vrm_compta` est dans `enregistrer` (le submit du formulaire).
    const f = sansCommentaires(lire('src/ideesArgent/Feuilles.jsx'));
    const corps = (nom) => { const i = f.indexOf(`const ${nom} = async`); return i < 0 ? '' : f.slice(i, f.indexOf('\n  };\n', i)); };
    dit(corps('choisir') && !/save\(|ecrireTicket\(|fetch\(/.test(corps('choisir')) && /lireTexteTicket\(/.test(corps('choisir')), 'D10 la LECTURE du ticket n’écrit rien (ni dépense, ni photo)');
    dit((f.match(/save\('vrm_compta'/g) || []).length === 1 && /save\('vrm_compta'/.test(corps('enregistrer')) && /onSubmit=\{enregistrer\}/.test(f), 'D11 une seule écriture, dans « Enregistrer » (son clic)');
    dit(D.sortDeLaPhoto('data:image/jpeg;base64,' + 'A'.repeat(4 * 200 * 1024 / 3)) === 'garder' && D.sortDeLaPhoto('data:image/jpeg;base64,' + 'A'.repeat(Math.ceil(4 * 600 * 1024 / 3))) === 'trop-lourde', 'D12 photo réduite gardée ≤ 450 Ko ; au-delà rangée SANS photo (et dit)');
    dit(/idTicket\(id\)/.test(f) && /data: \{ b64, at:/.test(f), 'D13 la photo dans SA ligne `depense_ticket_{id}` (la forme que Compta relit), jamais dans `main`');
  });

  // ── V · la vente en main propre ─────────────────────────────────────────
  await essaie('V', async () => {
    const M = await imp('src/ideesArgent/venteMain.js');
    const RG = await imp('api/_lib/ventes-regle.js');
    const Va = await imp('src/venteAilleurs.js');
    const fiches = { '9001': { numero: '124', title: 'Nike Dunk Low Panda', size: '42', price: { amount: '80.0' }, buyPrice: '37', buyFrom: 'vendeur_x' }, '9002': { numero: '1240', title: 'Nike Dunk Low Panda', size: '42' }, '9003': { numero: 'B124', title: 'Nike Dunk Low Panda', size: '42' } };
    const r1 = M.trouverParNumero('124', fiches), r2 = M.trouverParNumero('0124', fiches), r3 = M.trouverParNumero('b124', fiches);
    dit(r1.etat === 'une' && r1.cartes[0].id === '9001' && r2.etat === 'une' && r2.cartes[0].id === '9001' && r3.etat === 'une' && r3.cartes[0].id === '9003', 'V1 identité par le N° EXACT : 124 = 0124 ≠ 1240 ≠ B124', JSON.stringify([r1.cartes.map((c) => c.id), r3.cartes.map((c) => c.id)]));
    dit(!('buyPrice' in r1.cartes[0]) && !JSON.stringify(r1.cartes[0]).includes('vendeur_x') && !JSON.stringify(r1.cartes[0]).includes('"37"'), 'V2 une ligne de choix ne porte ni le prix d’achat ni le fournisseur');
    const cinquante = {}; for (let i = 1; i <= 50; i++) cinquante['8' + String(i).padStart(3, '0')] = { numero: String(i), title: 'Nike Dunk Low Panda', size: '42' };
    const r37 = M.trouverParNumero('37', cinquante);
    dit(r37.etat === 'une' && r37.cartes[0].id === '8037', 'V3 50 paires au MÊME titre : le N° 37 désigne la n°37, et elle seule');
    const parMots = M.chercherParMots('dunk 42', cinquante);
    dit(parMots.length === 8 && !M.estUnNumero('dunk 42') && M.estUnNumero('N°37') && M.estUnNumero('b 125'), 'V4 le titre ne fait que PROPOSER (8 lignes, son toucher choisit) — jamais une identité');
    const deux = { '7001': { numero: '88', title: 'Air Max 90' }, '7002': { numero: '88', title: 'Air Max 90' } };
    const rd = M.trouverParNumero('88', deux);
    dit(rd.etat === 'plusieurs' && rd.cartes.length === 2, 'V5 un N° porté par deux paires ⇒ LA QUESTION (les deux montrées, aucune choisie)', JSON.stringify(rd));
    const fs2 = sansCommentaires(lire('src/ideesArgent/Feuilles.jsx'));
    dit(/res\.etat === 'une' \? res\.cartes\[0\] : null/.test(fs2) && /res\.etat === 'plusieurs' && !choisie/.test(fs2) && /sb-plaque' \+ \(double \? ' is-double'/.test(fs2), 'V6 la feuille ne prend une paire d’elle-même QUE si une seule porte le N° ; deux ⇒ le rouge du doublon et son toucher');
    // Le geste.
    const carte = r1.cartes[0];
    const D0 = { '5000': { choix: 'chez-moi' } }, V0 = ['4000'], S0 = { '124': { meuble: 'm1', i: 3 } };
    const MAINT = Date.parse('2026-11-14T15:00:00');
    dit(M.opsVenteMain({ carte, montant: 45, date: '2026-11-14', paiement: 'cheque', maintenant: MAINT }) === null && M.opsVenteMain({ carte, montant: 0, date: '2026-11-14', paiement: 'especes', maintenant: MAINT }) === null
      && M.opsVenteMain({ carte, montant: 45, date: '2026-12-01', paiement: 'especes', maintenant: MAINT }) === null, 'V7 paiement inconnu, prix nul, date future ⇒ rien n’est écrit');
    const op = M.opsVenteMain({ carte, montant: 45, date: '2026-11-14', paiement: 'especes', decisions: D0, vendues: V0, slots: S0, maintenant: MAINT });
    const d = { vrm_cycle_decisions: D0, vinted_annonces_vendues: V0, vrm_slots: S0 };
    const ap = {}; for (const k of Object.keys(d)) ap[k] = G.appliquerOps(d[k], op.ops.filter((o) => o.k === k), 'apres');
    const dec = ap.vrm_cycle_decisions['9001'];
    dit(dec && dec.choix === 'vendu-main' && dec.montant === 45 && dec.date === '2026-11-14' && dec.paiement === 'especes' && dec.numero === '124', 'V8 la décision « vendu en main propre » (la règle de « Vendu ailleurs ») : 45 €, le 14/11, espèces, N° gardé', JSON.stringify(dec));
    dit(ap.vinted_annonces_vendues.includes('9001') && !ap.vrm_slots['124'] && !op.ops.some((o) => o.k === 'vinted_annonce_numeros' || o.k === 'vinted_used_numeros'), 'V9 sortie du stock (marquée vendue, case libérée) ; le N° de la fiche n’est pas touché');
    dit(M.trouverParNumero('124', fiches, { vendues: ap.vinted_annonces_vendues, decisions: ap.vrm_cycle_decisions }).etat === 'deja', 'V10 vendue ⇒ le N° ne la propose plus (« déjà sortie du stock »)');
    const df = {}; for (const k of Object.keys(d)) df[k] = G.appliquerOps(ap[k], op.ops.filter((o) => o.k === k), 'avant');
    dit(JSON.stringify(df) === JSON.stringify(d), 'V11 « Annuler » (5 s) rend l’état d’avant, exact');
    // Les totaux (la règle de l'app recopiée côté serveur).
    const main = Va.ventesMainPropre(ap.vrm_cycle_decisions);
    const vf = RG.ventesFaites({ vinted: [], main });
    const jour = vf.lignes.filter((l) => l.plateforme === 'Ailleurs' && new Date(l.ts).toDateString() === new Date('2026-11-14T12:00:00').toDateString());
    dit(jour.length === 1 && jour[0].eur === 45, 'V12 comptée dans « vendu » au jour saisi (le 14/11)', JSON.stringify(vf.lignes));
    const decl = RG.ventesDeclarables({ vinted: [], versements: {}, declare: {}, main });
    const nov = decl.lignes.filter((l) => l.ym === '2026-11' && l.plateforme === 'Ailleurs');
    dit(nov.length === 1 && nov[0].eur === 45 && !decl.aDater.length, 'V13 CA déclaré : encaissée le jour saisi (aucun versement de plateforme), jamais « à dater »', JSON.stringify(decl.lignes));
    const vinted = [{ transaction_id: 900, status: 'Commande finalisée', price: { amount: '70.0' }, date: '2026-11-14T10:00:00Z', _acc: { vinted_user_id: '1' } }];
    dit(Va.ventesAilleursPour(ap.vrm_cycle_decisions, vinted, { '900': '9001' }, RG.classifyOrderStatus).length === 0, 'V14 la même annonce vendue sur Vinted : la main propre n’est pas comptée une seconde fois');
    const an = M.opsAnnulerVenteMain({ id: '9001', decisions: ap.vrm_cycle_decisions, vendues: ap.vinted_annonces_vendues });
    const re = G.appliquerOps(ap.vrm_cycle_decisions, an.ops.filter((o) => o.k === 'vrm_cycle_decisions'), 'apres');
    dit(!re['9001'] && Va.ventesMainPropre(re).length === 0 && M.opsAnnulerVenteMain({ id: '5000', decisions: ap.vrm_cycle_decisions }) === null, 'V15 « Remettre en stock » plus tard : la vente sort des totaux ; seule une vente en main propre se défait');
    const recu = M.lignesRecu({ carte, montant: 45, date: '2026-11-14', paiement: 'virement', vendeur: 'Boutique test', numeroRecu: 'MP-20261114-124' });
    dit(recu && recu.date === '14/11/2026' && recu.montant === 45 && recu.paiement === 'virement' && !JSON.stringify(recu).includes('37') && Object.keys(recu).sort().join() === 'article,date,montant,numero,numeroRecu,paiement,vendeur', 'V16 le reçu : date, vendeur, article, N°, paiement, montant — ni acheteur, ni prix d’achat', JSON.stringify(recu));
    const { recuPdf } = await imp('src/ideesArgent/recuPdf.js');
    const modes = { especes: 'Espèces', virement: 'Virement', autre: 'Autre' };
    const pdf = await recuPdf(recu, { titre: 'Reçu de vente', sousTitre: 's', numero: 'Reçu n°', date: 'Date', vendeur: 'Vendu par', article: 'Article', rangement: 'Réf', paiement: 'Paiement', montant: 'Montant', pied: 'a\nb', signature: 'Signature :', modes });
    dit(pdf && Buffer.from(pdf.slice(0, 5)).toString() === '%PDF-' && pdf.length > 800, 'V17 le reçu PDF se dessine (pdf-lib, dans le navigateur)', pdf && pdf.length);
  });

  // ── S · la route Siri (la vraie fonction serverless, EXÉCUTÉE) ─────────
  await essaie('S', async () => {
    process.env.SUPABASE_URL = 'https://base.test';
    process.env.SUPABASE_SERVICE_KEY = 'cle-service-test';
    const lignes = new Map(); const journal = []; const pannes = { lecture: null };
    const J = (status, x) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => x, text: async () => JSON.stringify(x) });
    const fetchFaux = async (url, o = {}) => {
      const u = decodeURIComponent(String(url)); const methode = (o.method || 'GET').toUpperCase();
      const e = { methode, url: u, corps: o.body || '' }; journal.push(e);
      if (/\/auth\/v1\/user/.test(u)) { const a = String((o.headers || {}).Authorization || ''); return a === 'Bearer x.session-a.y' ? J(200, { id: A, email: 'a@test' }) : a === 'Bearer x.session-b.y' ? J(200, { id: B, email: 'b@test' }) : J(401, {}); }
      if (/\/rest\/v1\/rpc\/vrm_acces_pour/.test(u)) return J(200, true);
      if (!/\/rest\/v1\/app_data\?/.test(u)) return J(200, []);
      const q = u.slice(u.indexOf('?') + 1);
      if (methode === 'POST') { if (!/on_conflict=owner,id/.test(q)) return J(400, {}); for (const r of JSON.parse(o.body)) lignes.set(`${r.owner}|${r.id}`, JSON.parse(JSON.stringify(r.data))); return J(201, null); }
      if (pannes.lecture && pannes.lecture(u)) return J(503, {});
      let sel = ''; const filtres = [];
      for (const part of q.split('&')) { const i = part.indexOf('='); const k = part.slice(0, i), v = part.slice(i + 1); if (k === 'select') sel = v; else if (k !== 'limit' && k !== 'order') filtres.push([k, v]); }
      const choisies = [...lignes].filter(([k]) => { const [o2, ...r] = k.split('|'); const id2 = r.join('|'); return filtres.every(([fk, v]) => (fk === 'owner' ? o2 : fk === 'id' ? id2 : null) === v.replace(/^eq\./, '')); });
      if (methode === 'DELETE') { for (const [k] of choisies) lignes.delete(k); return J(204, null); }
      e.sel = sel;
      return J(200, choisies.map(([, d]) => { if (sel === 'data' || !sel) return { data: d }; const p = {}; for (const c of sel.split(',')) { const m = /^(\w+):data->>?(\w+)$/.exec(c); if (m) p[m[1]] = d && d[m[2]] !== undefined ? (c.includes('->>') && d[m[2]] != null && typeof d[m[2]] !== 'string' ? String(d[m[2]]) : d[m[2]]) : null; } return p; }));
    };
    global.fetch = fetchFaux;
    const widget = (await imp('api/widget.js')).default;
    const SR = await imp('api/_lib/siri-reponses.js');
    const res = () => { const r = { code: 0, corps: null, entetes: {} }; r.status = (c) => { r.code = c; return r; }; r.json = (x) => { r.corps = x; return r; }; r.send = (x) => { r.corps = x; return r; }; r.setHeader = (k, v) => { r.entetes[k.toLowerCase()] = v; }; r.end = () => r; return r; };
    const poster = async (action, jwt) => { const r = res(); await widget({ method: 'POST', query: { mode: 'siri' }, headers: jwt ? { authorization: 'Bearer ' + jwt } : {}, body: { action, langue: 'fr' } }, r); return r; };
    const demander = async (k, q, extra = {}) => { const r = res(); const n0 = journal.length; await widget({ method: 'GET', query: { mode: 'siri', q, k, ...extra }, headers: {} }, r); r.j = journal.slice(n0); return r; };

    const sans = await poster('creer', null);
    dit(sans.code === 401 && ![...lignes.keys()].length, 'S1 créer sans session ⇒ 401, rien d’écrit');
    const c1 = await poster('creer', 'x.session-a.y');
    const jeton = c1.corps && c1.corps.jeton;
    dit(c1.code === 200 && /^vs1_[A-Za-z0-9_-]{43}$/.test(jeton || ''), 'S2 un jeton ALÉATOIRE long (32 octets, 43 signes) rendu une fois', c1.code + ' ' + JSON.stringify(c1.corps));
    const tout = JSON.stringify([...lignes]);
    dit(!tout.includes(jeton) && lignes.get(`${A}|vrm_siri`).h === sha(jeton) && lignes.get(`${NEUTRE}|jeton_siri_${sha(jeton)}`).owner === A, 'S3 HACHÉ côté serveur : la ligne du vendeur et l’index ne portent que son empreinte SHA-256', tout.slice(0, 300));
    // Les publications de l'app (forme réelle : `widget_stats` + `siri_retrait`).
    const maint = Date.now();
    lignes.set(`${A}|widget_stats`, { caMois: 900, ventesMois: 20, ...SR.vendusDuJourPublies({ caJour: 275, ventesJour: 3, nonComptees: 0, maintenant: maint }), aExpedier: { n: 8, auMoins: false, at: maint - 3600000 }, updatedAt: new Date(maint - 600000).toISOString(), online: 120 });
    const pub = { at: maint - 900000, colis: [['', maint - 86400000, 'chronopost', 'e:LOIN', 1, '', '', 'Air Force 1'], [SR.jourParis(maint + 86400000), maint - 86400000, 'mondialrelay', 'e:MR123', 1, '', '', 'Nike Dunk']] };
    lignes.set(`${A}|siri_retrait`, SR.publicationSiriRetrait({ pubRetirer: pub, codes: [{ id: 'e:MR123', code: '582913', compte: true }, { id: 'e:LOIN', code: '111111', compte: true }], uid: A, maintenant: maint }));
    lignes.set(`${B}|widget_stats`, { ...SR.vendusDuJourPublies({ caJour: 999, ventesJour: 9, maintenant: maint }), updatedAt: new Date(maint).toISOString() });
    const v = await demander(jeton, 'vendu');
    dit(v.code === 200 && /^275 € vendus aujourd’hui, 3 ventes \(d’après VRM à \d\d h \d\d\)\.$/.test(String(v.corps)) && /text\/plain/.test(v.entetes['content-type'] || ''), 'S4 « combien j’ai vendu aujourd’hui ? » ⇒ « 275 € vendus aujourd’hui, 3 ventes » (texte que Siri lit)', JSON.stringify(v.corps));
    const rt = await demander(jeton, 'retirer');
    dit(rt.code === 200 && /^Prochain colis à retirer : Mondial Relay, code 5 8 2 9 1 3, dernier jour demain/.test(String(rt.corps)), 'S5 « prochain colis à retirer » ⇒ Mondial Relay, son code (le plus pressé d’abord)', JSON.stringify(rt.corps));
    const en = await demander(jeton, 'envoyer');
    dit(en.code === 200 && /^8 colis à envoyer/.test(String(en.corps)), 'S6 « 8 colis à envoyer »', JSON.stringify(en.corps));
    const vb = await demander(jeton, 'vendu');
    dit(!String(vb.corps).includes('999'), 'S7 chaque vendeur ses chiffres : le jeton de A ne lit jamais B');
    const toutes = [v, rt, en].flatMap((x) => x.j).filter((e) => e.methode === 'GET' && /app_data/.test(e.url));
    dit(toutes.length && toutes.every((e) => /select=/.test(e.url) && !/select=data(&|$)/.test(e.url) && !/select=\*/.test(e.url)), 'S8 aucune lecture lourde : chaque lecture est une projection (jamais `select=data`)', toutes.map((e) => e.url).join(' | '));
    dit(toutes.every((e) => /id=eq\.(jeton_siri_[0-9a-f]{64}|vrm_siri|widget_stats|siri_retrait)&/.test(e.url) && !/id=eq\.main|like\./.test(e.url)), 'S9 portée : quatre petites lignes par leur clé exacte — jamais `main`, jamais un balayage');
    dit(toutes.filter((e) => !/owner=eq\.00000000-/.test(e.url)).every((e) => e.url.includes('owner=eq.' + A)), 'S10 chaque lecture des données est filtrée sur le vendeur du jeton');
    // Mauvais jetons.
    const faux = 'vs1_' + crypto.randomBytes(32).toString('base64url');
    const f1 = await demander(faux, 'vendu');
    dit(f1.code === 401 && f1.j.length === 1 && /jeton_siri_/.test(f1.j[0].url), 'S11 mauvais jeton (bien formé) ⇒ 401 ; seule la recherche de l’index, AUCUNE donnée lue', f1.j.map((e) => e.url).join(' | '));
    const f2 = await demander('abc', 'vendu'); const f3 = await demander(jeton + 'x', 'vendu');
    dit(f2.code === 401 && f3.code === 401 && f2.j.length === 0 && f3.j.length === 0, 'S12 jeton mal formé ⇒ 401 sans la moindre requête');
    // L'index ne fait pas foi seul.
    lignes.set(`${NEUTRE}|jeton_siri_${sha(faux)}`, { owner: A, genre: 'siri' });
    const f4 = await demander(faux, 'vendu');
    dit(f4.code === 401 && !lignes.has(`${NEUTRE}|jeton_siri_${sha(faux)}`) && !f4.j.some((e) => /widget_stats|siri_retrait/.test(e.url)), 'S13 un index forgé qui désigne A ⇒ 401 (empreinte RE-COMPARÉE à durée constante), index retiré');
    // Publications périmées : jamais « 0 € ».
    const vieux = lignes.get(`${A}|widget_stats`); lignes.set(`${A}|widget_stats`, { ...vieux, jour: SR.jourParis(maint - 86400000), aExpedier: { n: 8, at: maint - 13 * 3600000 } });
    const p1 = await demander(jeton, 'tout', { format: 'json' });
    dit(p1.code === 200 && p1.corps.etat === 'pasSu' && /Je n’ai pas encore les ventes d’aujourd’hui/.test(p1.corps.texte) && /Je ne sais pas combien de colis/.test(p1.corps.texte) && !/0 €/.test(p1.corps.texte), 'S14 une publication d’hier ⇒ « pas encore, ouvre VRM » — jamais « 0 € »', JSON.stringify(p1.corps));
    lignes.set(`${A}|widget_stats`, vieux);
    // Pannes.
    pannes.lecture = (u) => /widget_stats/.test(u);
    const p2 = await demander(jeton, 'vendu');
    pannes.lecture = (u) => /jeton_siri_/.test(u);
    const p3 = await demander(jeton, 'vendu');
    pannes.lecture = null;
    dit(p2.code === 503 && p3.code === 503, 'S15 une lecture ratée ⇒ 503 (« pas su »), jamais une réponse');
    // Deux codes pour un colis ⇒ aucun.
    const dbl = SR.publicationSiriRetrait({ pubRetirer: pub, codes: [{ id: 'e:MR123', code: '582913', compte: true }, { id: 'e:MR123', code: '777777', compte: true }], maintenant: maint });
    dit(dbl.prochains[0].code === '' && /pas de code noté/.test(SR.reponseRetirer(dbl, { maintenant: maint }).texte), 'S16 deux codes différents pour un colis ⇒ aucun dit (jamais choisi en silence)');
    // Remplacer, couper.
    const c2 = await poster('creer', 'x.session-a.y'); const jeton2 = c2.corps.jeton;
    const vieuxJ = await demander(jeton, 'vendu'), neufJ = await demander(jeton2, 'vendu');
    dit(c2.code === 200 && vieuxJ.code === 401 && neufJ.code === 200 && !lignes.has(`${NEUTRE}|jeton_siri_${sha(jeton)}`), 'S17 un nouveau jeton coupe l’ancien (401), son index retiré');
    const cb = await poster('revoquer', 'x.session-b.y');
    dit(cb.code === 200 && lignes.has(`${NEUTRE}|jeton_siri_${sha(jeton2)}`), 'S18 couper avec la session de B ne touche pas au jeton de A');
    const cp = await poster('revoquer', 'x.session-a.y');
    const apresCoupe = await demander(jeton2, 'vendu');
    dit(cp.code === 200 && apresCoupe.code === 401 && !lignes.has(`${NEUTRE}|jeton_siri_${sha(jeton2)}`) && lignes.get(`${A}|vrm_siri`).h === null && lignes.get(`${A}|siri_retrait`).prochains.length === 0, 'S19 coupé ⇒ 401, index retiré, ligne vidée, codes publiés pour Siri effacés');
    const lib = sansCommentaires(lire('api/_lib/siri-jeton.js'));
    dit(/crypto\.timingSafeEqual/.test(lib) && /crypto\.randomBytes\(32\)/.test(lib), 'S20 comparaison à durée constante (`timingSafeEqual`), jeton de 32 octets aléatoires');
  });

  // ── I · l'image partagée ────────────────────────────────────────────────
  await essaie('I', async () => {
    const I = await imp('src/ideesArgent/carteImage.js');
    dit(I.FORMATS.story.l === 1080 && I.FORMATS.story.h === 1920 && I.FORMATS.carre.l === 1080 && I.FORMATS.carre.h === 1080, 'I1 story 1080×1920, carré 1080×1080');
    const fiche = { photo: 'https://images.test/p.jpg', titre: 'Nike Dunk Low Panda', taille: '42', prix: 80, num: '124', buyPrice: '37,40', acheteur: 'acheteur_secret', benefice: '42,60', compte: 'shop_secret', code: '582913', adresse: '12 rue Secrète' };
    const c = I.contenuCarte(fiche);
    dit(Object.keys(c).sort().join() === 'modele,num,photo,prix,taille' && c.num === '' && c.prix === '80 €', 'I2 liste BLANCHE : photo, modèle, taille, prix ; le N° seulement s’il le coche', JSON.stringify(c));
    const espion = () => { const t = []; const ctx = new Proxy({}, { get: (o, k) => k === 'fillText' ? (s) => t.push(String(s)) : k === 'measureText' ? (s) => ({ width: String(s).length * 30 }) : k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : (k in o ? o[k] : () => {}), set: (o, k, v) => { o[k] = v; return true; } }); return { ctx, t }; };
    for (const fmt of ['story', 'carre']) {
      const { ctx, t } = espion();
      I.dessinerCarte(ctx, { ...fiche, ...I.contenuCarte(fiche, { avecNumero: true }) }, fmt, null);
      const tout = t.join(' | ');
      dit(['37', 'acheteur_secret', '42,60', 'shop_secret', '582913', 'Secrète'].every((x) => !tout.includes(x)) && tout.includes('Nike Dunk') && tout.includes('80') && tout.includes('N°124'), `I3 ${fmt} : chaque texte dessiné relu — ni prix d’achat, ni acheteur, ni bénéfice, ni compte, ni code, ni adresse`, tout);
    }
    const fp = sansCommentaires(lire('src/FichePaire.jsx'));
    const appel = (fp.match(/ouvrirIdee\('partage-image', \{ paire: \{[^}]*\} \}\)/) || [''])[0];
    dit(appel && !/achat|buy|benef|acheteur|compte|code/i.test(appel) && /photo: photoHeros, titre: titreHeros, taille: tailleHeros, prix:/.test(appel), 'I4 la fiche ne passe que photo, modèle, taille, prix affiché, N°', appel);
    dit(/!double && !p\.ancienNumero/.test(fp), 'I5 deux paires sous ce N° : aucune image (on ne choisit pas)');
    dit(I.nomFichier({ modele: 'Nike Dunk Low « Panda »' }, 'carre') === 'nike-dunk-low-panda-1080x1080.png', 'I6 le nom du fichier : le modèle seul');
  });

  // ── C · le branchement ──────────────────────────────────────────────────
  await essaie('C', async () => {
    const app = lire('src/App.jsx'), compta = lire('src/ecrans/Compta.jsx'), w = lire('api/widget.js'), ac = lire('src/annulerCommandes.js');
    const fonctions = fs.readdirSync(path.join(R, 'api')).filter((f) => /\.js$/.test(f));
    dit(fonctions.length <= 12 && /mode\) \|\| ''\) === 'siri'\) return routeSiri\(/.test(w), 'C1 aucune fonction api/ neuve : `api/widget.js?mode=siri`', fonctions.length);
    dit(/\{AUTH\.user && <IdeesArgentRacine\/>\}/.test(app) && /ouvrirIdee\(d\.feuille/.test(app) && /id: 'vente-main-num', num: true/.test(ac) && /case 'depense-photo': return \{ feuille: 'depense-photo' \}/.test(ac), 'C2 les portes : la coque (après la session), ⌘K (vente en main propre, N° vendu, dépense en photo)');
    dit(/ouvrirIdee\('depense-photo'\)/.test(compta) && /vrm:depense-ajoutee/.test(compta), 'C3 Compta : « Dépense en photo » et sa liste relue après l’ajout');
    dit(/vendusDuJourPublies\(\{ caJour: liveStatsVus\.caJour, ventesJour: liveStatsVus\.ventesJour/.test(app), 'C4 « vendu aujourd’hui » PUBLIÉ par la coque dans `widget_stats` (la règle `ventesFaites`, jamais recalculée par le serveur)');
    const vm2 = sansCommentaires(lire('src/ideesArgent/venteMain.js'));
    dit(/opsVenduAilleurs\(/.test(vm2) && !/vrm_cycle_decisions'\s*,\s*type/.test(vm2.replace(/CLE_DECISIONS/g, '')) && /CHOIX_MAIN/.test(vm2), 'C5 une seule règle : la vente en main propre EST « Vendu ailleurs » (`opsVenduAilleurs`), aucune seconde écriture');
    const dp = sansCommentaires(lire('src/ideesArgent/depensePhoto.js'));
    dit(!/vrm_depenses/.test(dp + sansCommentaires(lire('src/ideesArgent/Feuilles.jsx'))) && /save\('vrm_compta'/.test(lire('src/ideesArgent/Feuilles.jsx')), 'C6 une seule liste de dépenses : `vrm_compta.depenses` (pas de seconde liste `vrm_depenses`)');
  });

  console.log(`\n${ko ? '❌' : '✅'} audit-idees-argent : ${ok} verts, ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
