// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LE REÇU D'ACHAT VINTED (23 octobre)
//         node scripts/audit-recu-achat.cjs [--mutation=…]
// ═══════════════════════════════════════════════════════════════════════════
// Julien (capture iPhone) : « le reçu s'affiche mal » — Montant payé 24,93 €,
// Article 20,00 €, Frais de port 3,23 €, et rien d'autre : il manquait 1,70 €.
// Mesuré (lecture seule, 117 lignes `email_achat_*`) : 81 vrais reçus, dont le
// bloc « Montant payé » → « Mode de paiement » porte « Article », « Frais de
// port », puis SOIT « Frais Vinted » (55) SOIT « Frais de Protection acheteurs »
// (26), et parfois « Réduction -3,79 € » (8, négative) ; la somme vaut le
// Montant payé sur les 81. L'ancien parseur ne connaissait que « protection
// acheteurs ». Et 36 lignes ne sont PAS des reçus (« Commande mise à jour
// pour … », « … - Confirmation requise », « Retourne ta commande … »).
//
// Cet audit EXÉCUTE la vraie règle (`<recu-achat-regle>` et les champs de la
// feuille, extraits d'App.jsx par Babel, dans un vm) sur des textes INVENTÉS à
// la forme mesurée — aucune vraie donnée n'est dans le dépôt :
//   1. la forme récente (Frais Vinted + Réduction), l'ancienne (Protection
//      acheteurs, lignes vides intercalées), le cas de la capture, un libellé
//      inconnu, un montant à milliers, un Montant payé sur la ligne suivante ;
//   2. une somme fausse ⇒ « ecart » et une phrase ; une ligne illisible ⇒
//      « passu », la ligne GARDÉE ; aucun détail ⇒ « passu » ;
//   3. un non-reçu n'est pas un reçu ; un reçu (même sans sujet) l'est ;
//      « pas su » (null) et « en cours » (undefined) passent tels quels ;
//   4. le n° de transaction est lu dans le texte (une identité) ;
//   5. le mode de paiement ne se lit plus « Visa, 4242 » ;
//   6. la VRAIE route `api/email-inbound.js` (processus à part, fausse base) :
//      « Commande mise à jour », « Confirmation requise », « Retourne ta
//      commande » ne créent AUCUNE ligne `email_achat_*` ; un vrai reçu, une.
//      (Déjà vrai avant ce chantier — mesuré : aucune après le 3 août.)
// `--mutation=…` réaffaiblit la règle : chaque mutation doit faire passer au
// moins un contrôle au rouge.
//   connus · somme · signe · nonrecu · jete · txtexte · mode
//   positif · texte · borne · bornetoutes  (23 oct., revue : la définition
//                     « positive » d'un reçu ; une feuille structurée sans
//                     Montant payé ; une ligne de frais « Transaction … » qui
//                     finit le bloc ; « Mode de paiement … X € » compté) · nbsp
//                     (la carte coupée en deux à 320 px)
const fs = require('fs'), path = require('path'), vm = require('vm');
const { spawnSync } = require('child_process');
const R = path.join(__dirname, '..');

// ── 6. La route, dans un processus neuf ───────────────────────────────────
if (process.argv[2] === '--route') {
  const A = '11111111-2222-3333-4444-555555555555';
  process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
  process.env.VRM_OWNER_UID = A;
  process.env.EMAIL_INBOUND_SECRET = 'cle-banc-recu';
  delete process.env.VAPID_PRIVATE_KEY;
  const base = new Map([[`${A}|vrm_email_owners`, { adresses: { 'boite@banc.test': { owner: A } } }]]);
  const rep = (c, s = 200) => new Response(typeof c === 'string' ? c : JSON.stringify(c), { status: s, headers: { 'content-type': 'application/json' } });
  global.fetch = async (url, opts = {}) => {
    const u = new URL(String(url));
    const m = (opts.method || 'GET').toUpperCase();
    if (u.pathname === '/rest/v1/rpc/vrm_acces_pour') return rep(true);
    if (u.pathname !== '/rest/v1/app_data') return rep([]);
    if (m === 'POST') { for (const r of JSON.parse(opts.body || '[]')) base.set(`${r.owner || A}|${r.id}`, r.data); return new Response('', { status: 201 }); }
    if (m !== 'GET') return rep([]);
    const sel = u.searchParams.get('select') || '';
    if (sel === 'owner' && u.searchParams.get('limit') === '1') return rep([]);
    const idp = u.searchParams.get('id') || '';
    const own = (u.searchParams.get('owner') || '').replace(/^eq\./, '') || null;
    const exact = idp.startsWith('eq.') ? idp.slice(3) : null;
    const like = idp.startsWith('like.') ? new RegExp('^' + idp.slice(5).replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$') : null;
    const lignes = [...base.entries()].map(([k, d]) => { const [o, id] = k.split('|'); return { owner: o, id, data: d }; })
      .filter((l) => (!own || l.owner === own) && (exact ? l.id === exact : like ? like.test(l.id) : true));
    if (sel && sel !== 'data' && sel !== 'id,data' && sel !== 'owner,data') {
      return rep(lignes.map((l) => { const o = {}; for (const part of sel.split(',')) { const [alias, chemin] = part.includes(':') ? part.split(':') : [part.replace(/^data->>?/, ''), part]; if (chemin === 'id' || chemin === 'owner') { o[alias] = l[chemin]; continue; } o[alias] = l.data ? l.data[chemin.replace(/^data->>?/, '')] : undefined; } return o; }));
    }
    return rep(lignes);
  };
  const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.send = () => r; r.end = () => r; return r; };
  const mail = (subject, text) => ({ from: 'no-reply@vinted.fr', to: 'boite@banc.test', subject, text, html: '', attachments: [] });
  const EMAILS = {
    maj: mail('Commande mise à jour pour Basket banc taille 42', 'Bonjour,\n\nIl te reste 48 heures pour confirmer que tout est en ordre avec ta commande\n\nAller sur la commande\n\nRejoins la communauté Vinted :\n'),
    conf: mail('Basket banc taille 42 - Confirmation requise', 'Bonjour compte_banc,\n\nIl a été indiqué que ta commande a été livrée.\n\nSi tu as bien reçu ta commande et que l’article est conforme à sa\ndescription, confirme-le en appuyant sur sur le bouton Tout est OK dans ta\nconversation avec le vendeur.\n'),
    retour: mail("Retourne ta commande d'ici le 24 oct. : Basket banc", "Assure-toi que le ou les articles sont dans leur état d'origine lorsque tu\nles retournes.\n\nRetourne la commande d'ici le 24 oct.. Sinon, tu devras la garder et ton\npaiement sera transféré au vendeur.\n"),
    // (23 oct., revue) Des formes que la route range AUSSI comme achat (« tu as
    // acheté », « merci pour ton achat ») sans « Montant payé » : l'app doit les
    // garder dans la liste — ce n'est pas un email de statut.
    merci: mail('Merci pour ton achat !', 'Bonjour,\n\nMerci pour ton achat « Basket banc taille 42 ».\n\nTotal payé : 24,93 €\nArticle : Basket banc taille 42\nTransaction : 23400000009\n'),
    achete: mail('Tu as acheté « Basket banc »', 'Bonjour,\n\nTu as acheté Basket banc.\nTotal : 24,93 €\nN° de transaction : 23400000010\n'),
    recu: mail('Ton reçu pour la commande « Basket banc taille 42 »', 'E-mail Vinted\n\nBonjour compte_banc,\n\n*Ton paiement a été reçu. *\n\nVoici les détails de ta commande :\n*Vendeur* vendeur_banc\n*Commande*\n\nBasket banc taille 42\n*Montant payé* 24,93 € \nArticle 20,00 € \nFrais de port 3,23 € \nFrais Vinted 1,70 € \n*Mode de paiement* Visa, **********4242 (24,93 €) \n*Date du paiement* 21/10/2026 10 h 47 \n*N° de transaction* 99990000111 \n'),
  };
  (async () => {
    const out = {};
    const inbound = await import('file://' + path.join(R, 'api', 'email-inbound.js'));
    for (const [k, m] of Object.entries(EMAILS)) {
      const avant = new Set([...base.keys()].filter((x) => x.includes('|email_achat_')));
      const res = faireRes();
      try { await inbound.default({ method: 'POST', query: {}, headers: { 'x-vrm-email-key': 'cle-banc-recu' }, body: JSON.parse(JSON.stringify(m)) }, res); } catch (e) { out[k] = { erreur: String(e && e.message) }; continue; }
      const neuves = [...base.keys()].filter((x) => x.includes('|email_achat_') && !avant.has(x));
      out[k] = { achats: neuves.length, code: res.code, lignes: neuves.map((x) => base.get(x)) };
    }
    console.log('RESULTAT ' + JSON.stringify(out));
    process.exit(0);
  })();
  return;
}

let parser;
try { parser = require(path.join(R, 'node_modules', '@babel', 'parser')); }
catch (e) { console.log('❌ l\'analyseur Babel est disponible — ' + e.message); process.exit(1); }
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let src = fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8');
const muter = (avant, apres) => { if (!src.includes(avant)) { console.log('❌ mutation impossible : motif absent — ' + avant.slice(0, 60)); process.exit(2); } src = src.replace(avant, apres); };
// Chaque mutation remet un défaut mesuré ou plausible.
if (MUT === 'connus') muter("if (m && c != null && /\\p{L}/u.test(m[1])) lignes.push(", "if (m && c != null && /^(article|frais de port|.*protection)/i.test(m[1])) lignes.push(");
else if (MUT === 'somme') muter("else if (total === paye) somme = 'juste';", "else if (true) somme = 'juste';");
else if (MUT === 'signe') muter("return m[1] === '-' ? -v : v;", 'return v;');
else if (MUT === 'nonrecu') muter('const estRecuAchat = (a) => !!a && !(', 'const estRecuAchat = (a) => !!a || !(');
// (23 oct., revue) la définition « positive » d'avant : un reçu DOIT porter un
// Montant payé, un sujet de reçu ou un PDF — tout le reste disparaissait.
else if (MUT === 'positif') muter('const estRecuAchat = (a) => !!a && !(', "const estRecuAchat = (a) => !!a && (ventilationRecuAchat(a.texte).trouve || /re[çc]u\\s+pour/i.test(String(a.subject || '')) || !!a.pdfB64) && !(");
// (23 oct., revue) une ligne de frais au libellé « Transaction … » finit le bloc.
else if (MUT === 'borne') muter('(FIN_SI_SANS_MONTANT_RECU.test(l) && !RE_LIGNE_RECU.test(l))', 'FIN_SI_SANS_MONTANT_RECU.test(l)');
// …ou toutes les bornes deviennent « sans montant » (« Mode de paiement … 23,23 € » compté).
else if (MUT === 'bornetoutes') muter('FIN_VENTILATION_RECU.test(l) || (FIN_SI_SANS_MONTANT_RECU.test(l) && !RE_LIGNE_RECU.test(l))', '(FIN_VENTILATION_RECU.test(l) || FIN_SI_SANS_MONTANT_RECU.test(l)) && !RE_LIGNE_RECU.test(l)');
// (23 oct., revue) la carte coupée à 320 px (« MasterCard •••• » / « 9999 »).
else if (MUT === 'nbsp') muter("m = m.replace(/•••• (?=\\d)/g, '••••\\u00a0');", '');
else if (MUT === 'texte') muter('hasStructured: v.trouve };', 'hasStructured: v.trouve || !!(vendeur || mode || trans) };');
else if (MUT === 'jete') muter('else lignes.push({ libelle: l, centimes: null });', 'else continue;');
else if (MUT === 'txtexte') muter("for (const l of lignesRecu(a && a.texte)) {\n    const m = l.match(", "for (const l of []) {\n    const m = l.match(");
else if (MUT === 'mode') muter(".replace(/\\*{3,}\\s*(\\d{2,4})\\b/g, '•••• $1')", '');
else if (MUT) { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = (nom, f) => { try { f(); } catch (e) { dit(false, nom, String(e && e.message || e).slice(0, 200)); } };

// Les déclarations de premier niveau d'App.jsx, par nom.
const decl = new Map();
{
  const ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true });
  for (const n of ast.program.body) {
    const d0 = n.type === 'ExportNamedDeclaration' ? n.declaration : n;
    if (!d0) continue;
    if (d0.type === 'FunctionDeclaration' && d0.id) decl.set(d0.id.name, src.slice(d0.start, d0.end));
    if (d0.type !== 'VariableDeclaration') continue;
    for (const v of d0.declarations) if (v.id && v.id.name && !decl.has(v.id.name)) decl.set(v.id.name, `${d0.kind} ${src.slice(v.start, v.end)};`);
  }
}
const NOMS = ['centimesRecu', 'texteCentimesRecu', 'lignesRecu', 'MONTANT_RECU', 'RE_MONTANT_SEUL_RECU', 'RE_LIGNE_RECU', 'RE_MONTANT_PAYE_RECU', 'FIN_VENTILATION_RECU', 'FIN_SI_SANS_MONTANT_RECU', 'SUJET_STATUT_ACHAT',
  'ventilationRecuAchat', 'txRecuAchat', 'estRecuAchat', 'recusAchatDe', 'modePaiementRecu', 'phraseSommeRecu', 'champsRecuAchat'];
const manque = NOMS.filter((n) => !decl.has(n));
dit(!manque.length, 'la règle du reçu existe dans App.jsx (une règle pour la feuille et la fenêtre PDF)', manque.length ? 'absent : ' + manque.join(', ') : '');
const ctx = vm.createContext({ console });
let F = {};
essaie('la règle se charge', () => {
  vm.runInContext(NOMS.filter((n) => decl.has(n)).map((n) => decl.get(n)).join('\n') + `\n;this.__F = { ${NOMS.filter((n) => decl.has(n)).join(', ')} };`, ctx);
  F = ctx.__F || {};
});
// Le marqueur de la règle partagée (§11).
dit(/\/\/ <recu-achat-regle>[\s\S]*const ventilationRecuAchat[\s\S]*const estRecuAchat[\s\S]*\/\/ <\/recu-achat-regle>/.test(src), 'la règle vit dans un bloc <recu-achat-regle>');
// La feuille et la fenêtre PDF lisent LA MÊME règle — aucune ne garde sa liste de libellés.
const corps = (nom) => decl.get(nom) || '';
dit(/champsRecuAchat\(/.test(corps('openReceipt')) && /champsRecuAchat\(/.test(corps('FeuilleRecuAchat')), 'la fenêtre PDF et la feuille passent toutes deux par champsRecuAchat (§11)');
dit(!/protection\s*acheteurs\?|Protection acheteurs['"]/.test(corps('openReceipt') + corps('FeuilleRecuAchat')), 'aucune des deux n’écrit sa propre liste de libellés (« Protection acheteurs » en dur)');
dit(!/parseReceiptFields/.test(src), 'l’ancien parseur (trois libellés en dur) n’existe plus');

// ── 1. Les formes mesurées (inventées) ────────────────────────────────────
const RECENT = '*Montant payé* 13,30 € \nArticle 12,00 € \nFrais de port 3,79 € \nFrais Vinted 1,30 € \nRéduction -3,79 € \n*Mode de paiement* MasterCard, **********0275 (13,30 €) \n*Date du paiement* 21/10/2026 10 h 47 \n*N° de transaction* 23420615969 \n';
const ANCIENNE = '*Montant payé* 12,10 € \nArticle 9,00 € \nFrais de port 3,23 € \n\nFrais de Protection acheteurs 1,15 € \n\nRéduction -1,28 € \n\n*Mode de paiement* le porte-monnaie Vinted (12,10 €) \n*Date du paiement* 02/08/2026 09 h 12 \n*N° de transaction* 11112222333 \n';
const CAPTURE = 'Voici les détails de ta commande :\n*Vendeur* vendeur_banc\n*Commande*\n\nBasket banc taille 42\n*Montant payé* 24,93 € \nArticle 20,00 € \nFrais de port 3,23 € \nFrais Vinted 1,70 € \n*Mode de paiement* Visa, **********4242 (24,93 €) \n*Date du paiement* 21/10/2026 10 h 47 \n*N° de transaction* 23400000001 \n';
const v = (t) => F.ventilationRecuAchat(t);
const dump = (r) => r ? `${r.somme} paye=${r.paye} lignes=${JSON.stringify(r.lignes.map((l) => [l.libelle, l.centimes]))}` : 'rien';
essaie('forme récente', () => {
  const r = v(RECENT);
  dit(r.paye === 1330, 'forme récente : Montant payé 13,30 € lu en centimes', String(r.paye));
  dit(JSON.stringify(r.lignes.map((l) => l.libelle)) === JSON.stringify(['Article', 'Frais de port', 'Frais Vinted', 'Réduction']), 'forme récente : les 4 lignes, libellés tels que Vinted les écrit', dump(r));
  dit(JSON.stringify(r.lignes.map((l) => l.centimes)) === JSON.stringify([1200, 379, 130, -379]), 'forme récente : la réduction est NÉGATIVE (−3,79 €)', dump(r));
  dit(r.somme === 'juste' && r.total === 1330, 'forme récente : les lignes font le Montant payé (juste)', dump(r));
});
essaie('forme ancienne', () => {
  const r = v(ANCIENNE);
  dit(JSON.stringify(r.lignes.map((l) => [l.libelle, l.centimes])) === JSON.stringify([['Article', 900], ['Frais de port', 323], ['Frais de Protection acheteurs', 115], ['Réduction', -128]]), 'forme ancienne (lignes vides intercalées) : 4 lignes, Protection acheteurs et Réduction comprises', dump(r));
  dit(r.somme === 'juste', 'forme ancienne : juste', dump(r));
});
essaie('cas de la capture', () => {
  const r = v(CAPTURE);
  dit(r.lignes.some((l) => l.libelle === 'Frais Vinted' && l.centimes === 170), 'cas de la capture : la ligne « Frais Vinted 1,70 € » n’est plus perdue', dump(r));
  dit(r.somme === 'juste' && r.total === 2493, 'cas de la capture : 20,00 + 3,23 + 1,70 = 24,93 €', dump(r));
});
essaie('libellé inconnu', () => {
  const r = v('*Montant payé* 25,43 €\nArticle 20,00 €\nFrais de port 3,23 €\nFrais de traitement 0,50 €\nFrais Vinted 1,70 €\n*Mode de paiement* Visa\n');
  dit(r.lignes.some((l) => l.libelle === 'Frais de traitement' && l.centimes === 50) && r.somme === 'juste', 'un libellé inconnu est GARDÉ et compté', dump(r));
});
// (23 oct., revue) Une ligne de MONTANT dont le libellé commence comme une
// borne (« Transaction sécurisée 0,50 € », « Vendeur pro 2,00 € ») n'est pas la
// fin du bloc : elle est gardée et comptée. Les vraies bornes ne finissent
// jamais par « € » (mesuré : 81/81 « Mode de paiement … (X €) », « Date du
// paiement … », « N° de transaction … ») et restent des bornes.
essaie('libellé qui ressemble à une borne', () => {
  const r = v('*Montant payé* 25,43 € \nArticle 20,00 € \nFrais de port 3,23 € \nTransaction sécurisée 0,50 € \nFrais Vinted 1,70 € \n*Mode de paiement* Visa, **********1111 (25,43 €) \n*Date du paiement* 21/10/2026 10 h 47 \n*N° de transaction* 23400000001 \n');
  dit(r.lignes.length === 4 && r.lignes[2].libelle === 'Transaction sécurisée' && r.lignes[2].centimes === 50 && r.somme === 'juste' && r.total === 2543,
    'une ligne de montant « Transaction sécurisée 0,50 € » est GARDÉE et comptée — le bloc ne finit pas sur elle', dump(r));
  const r2 = v('*Montant payé* 22,00 € \nArticle 20,00 € \nVendeur pro 2,00 € \n*Mode de paiement* Visa\n');
  dit(r2.lignes.length === 2 && r2.somme === 'juste', 'une ligne de montant « Vendeur pro 2,00 € » est gardée et comptée', dump(r2));
  const r3 = v('*Montant payé* 23,23 € \nArticle 20,00 € \nFrais de port 3,23 € \nTransaction : 23400000001\nVendeur vendeur_banc\nArticle 99,00 €\n');
  dit(r3.lignes.length === 2 && r3.somme === 'juste', '« Transaction : 2340… » (sans montant) reste une borne : rien après elle n’entre dans le bloc', dump(r3));
  const r4 = v('*Montant payé* 23,23 € \nArticle 20,00 € \nFrais de port 3,23 € \n*Mode de paiement* porte-monnaie Vinted 23,23 €\nArticle 99,00 €\n');
  dit(r4.lignes.length === 2 && r4.somme === 'juste', '« Mode de paiement » reste une borne, même suivi d’un montant (jamais compté comme une ligne)', dump(r4));
});
essaie('milliers et ligne suivante', () => {
  const r = v('Montant payé :\n1 234,56 €\nArticle 1 200,00 €\nFrais de port 34,56 €\nMode de paiement : Visa\n');
  dit(r.paye === 123456 && r.somme === 'juste', 'Montant payé sur la ligne suivante, montants à milliers', dump(r));
  const r2 = v('*Montant payé* 9,00 €\nArticle 10,00 €\nRéduction −1,00 €\n*Mode de paiement* x\n');
  dit(r2.somme === 'juste' && r2.lignes[1].centimes === -100, 'le signe moins typographique (−) est lu', dump(r2));
});

// ── 2. Ce qui ne fait pas le total ────────────────────────────────────────
essaie('somme fausse', () => {
  const r = v('*Montant payé* 30,00 €\nArticle 20,00 €\nFrais de port 3,23 €\n*Mode de paiement* Visa\n');
  dit(r.somme === 'ecart' && r.ecart === 677, 'une somme fausse ⇒ « ecart » (jamais présentée comme juste)', dump(r));
  const c = F.champsRecuAchat({ texte: '*Montant payé* 30,00 €\nArticle 20,00 €\nFrais de port 3,23 €\n*Mode de paiement* Visa\n' });
  dit(/regarde l'email de Vinted/.test(c.phrase) && /23,23/.test(c.phrase) && /30,00/.test(c.phrase), 'la feuille DIT l’écart, avec les deux nombres', JSON.stringify(c.phrase));
  const ok = F.champsRecuAchat({ texte: RECENT });
  dit(ok.phrase === '', 'aucune phrase quand les lignes font le total', JSON.stringify(ok.phrase));
});
essaie('ligne illisible', () => {
  const r = v('*Montant payé* 24,93 €\nArticle 20,00 €\nFrais de port 3,23 €\nFrais Vinted voir l’email\n*Mode de paiement* Visa\n');
  dit(r.somme === 'passu', 'une ligne au montant illisible ⇒ « passu »', dump(r));
  dit(r.lignes.length === 3 && r.lignes[2].centimes === null && /Frais Vinted/.test(r.lignes[2].libelle), 'la ligne illisible est GARDÉE (jamais jetée)', dump(r));
});
essaie('aucun détail', () => {
  const r = v('Reçu pour la commande X\nMontant payé : 125,00 EUR\nTransaction : 7654321');
  dit(r.paye === 12500 && r.lignes.length === 0 && r.somme === 'passu', 'Montant payé sans aucune ligne ⇒ « passu », aucun total inventé', dump(r));
});

// ── 3. Reçu ou pas ────────────────────────────────────────────────────────
essaie('reçu ou pas', () => {
  const nonRecus = [
    { subject: 'Commande mise à jour pour Basket banc', article: 'Basket banc', texte: 'Bonjour,\n\nIl te reste 48 heures pour confirmer que tout est en ordre avec ta commande\n\nAller sur la commande\n', pdfB64: '' },
    { subject: 'Basket banc - Confirmation requise', article: 'est conforme à sa', texte: 'Il a été indiqué que ta commande a été livrée.\nSi tu as bien reçu ta commande et que l’article est conforme à sa\n', pdfB64: null },
    { subject: "Retourne ta commande d'ici le 24 oct. : Basket banc", texte: "Retourne la commande d'ici le 24 oct.. Sinon, tu devras la garder.\n" },
  ];
  dit(nonRecus.every((r) => !F.estRecuAchat(r)), 'un email « Commande mise à jour », « Confirmation requise » ou « Retourne ta commande » n’est PAS un reçu', nonRecus.map((r) => F.estRecuAchat(r)).join(','));
  dit(F.estRecuAchat({ subject: 'Ton reçu pour la commande « Basket banc »', texte: CAPTURE, pdfB64: '' }), 'un vrai reçu est un reçu');
  dit(F.estRecuAchat({ texte: 'Reçu pour la commande X\nMontant payé : 125,00 EUR\nTransaction : 7654321' }), 'un reçu sans sujet mais avec son Montant payé est un reçu');
  dit(F.estRecuAchat({ subject: 'Ton reçu pour la commande « X »', texte: 'format inconnu' }), 'un reçu dont le texte a changé de forme reste un reçu (par son sujet) — il ne disparaît pas');
  // (23 oct., revue) « Pas un reçu » = les trois formes de STATUT mesurées (36
  // lignes, aucune avec un Montant payé ni un PDF) — jamais « tout ce qui n'a
  // pas la forme d'aujourd'hui ».
  dit(F.estRecuAchat({ subject: 'Merci pour ton achat !', texte: 'Merci pour ton achat.\nTotal payé : 24,93 €\nTransaction : 23400000009\n' }), 'un email « Merci pour ton achat » sans « Montant payé » reste un reçu (la route l’a rangé comme achat)');
  dit(F.estRecuAchat({ subject: 'Ton paiement a été reçu', texte: 'Ton paiement a été reçu.\nArticle : X\n' }), 'un sujet inconnu de Vinted (forme changée) reste un reçu — il ne disparaît pas de la liste');
  dit(F.estRecuAchat({ subject: 'Commande mise à jour pour X', texte: CAPTURE }), 'un sujet de statut qui PORTE un Montant payé reste un reçu');
  dit(F.estRecuAchat({ subject: 'X - Confirmation requise', texte: 'rien', pdfB64: 'JVBERi0' }), 'un sujet de statut avec un PDF joint reste un reçu');
  const liste = F.recusAchatDe([...nonRecus, { subject: 'Ton reçu pour la commande « Basket banc »', texte: CAPTURE, transaction: '' }]);
  dit(Array.isArray(liste) && liste.length === 1, 'recusAchatDe ne garde que les vrais reçus', Array.isArray(liste) ? String(liste.length) : String(liste));
  dit(F.recusAchatDe(null) === null && F.recusAchatDe(undefined) === undefined, '« pas su » (null) et « en cours » (undefined) passent tels quels — jamais une liste vide');
});

// ── 4. Le n° de transaction, lu dans le texte ─────────────────────────────
essaie('transaction', () => {
  dit(F.txRecuAchat({ transaction: '', texte: CAPTURE }) === '23400000001', 'le n° de transaction est lu dans le texte quand le serveur ne l’a pas rangé', F.txRecuAchat({ transaction: '', texte: CAPTURE }));
  dit(F.txRecuAchat({ transaction: '55554444333', texte: CAPTURE }) === '55554444333', 'un n° rangé par le serveur reste le sien');
  dit(F.txRecuAchat({ texte: 'Le vendeur a 5 jours. Ta transaction 123456789 est en cours.' }) === '', 'un nombre au milieu d’une phrase n’est pas un n° de transaction');
  const l = F.recusAchatDe([{ subject: 'Ton reçu pour la commande « X »', texte: CAPTURE, transaction: '' }]);
  dit(l && l[0] && l[0].transaction === '23400000001', 'recusAchatDe pose le n° lu sur le reçu (la voie certaine de receiptFor)');
});
// receiptFor : la voie par titre ne prend plus un reçu qui porte un AUTRE n°.
dit(/!a\.transaction && a\.article && normTitle\(a\.article\) === ot/.test(src) && /const list = Array\.isArray\(recusAchat\) \? recusAchat : \[\]/.test(src), 'receiptFor ne lit que les vrais reçus, et le titre ne relie qu’un reçu SANS n° de transaction (§5)');

// ── 5. Le mode de paiement ────────────────────────────────────────────────
essaie('mode de paiement', () => {
  const c = F.champsRecuAchat({ texte: CAPTURE });
  dit(c.mode === 'Visa ••••\u00a04242', 'le mode de paiement se lit « Visa •••• 4242 » (plus « Visa, 4242 »), une espace INSÉCABLE avant les chiffres (jamais « Visa •••• » / « 4242 » sur un petit écran)', JSON.stringify(c.mode));
  const d = F.champsRecuAchat({ texte: '*Montant payé* 15,00 €\nArticle 15,00 €\n*Mode de paiement* porte-monnaie Vinted (12,00 €) Apple Pay (3,00 €)\n' });
  dit(/12,00/.test(d.mode) && /3,00/.test(d.mode), 'deux moyens de paiement : leurs montants restent', JSON.stringify(d.mode));
  dit(c.vendeur === 'vendeur_banc' && c.trans === '23400000001' && c.datePaie === '21/10/2026 10\u00a0h\u00a047', 'vendeur, n° de transaction et date du paiement lus sur LEUR ligne (« 10 h 47 » insécable)', JSON.stringify([c.vendeur, c.trans, c.datePaie]));
  const e = F.champsRecuAchat({ texte: 'Bonjour\n*Vendeur* vendeur_banc\nLe vendeur a jusqu’à 5 jours pour envoyer le colis.\n' });
  dit(e.vendeur === 'vendeur_banc', 'le vendeur n’est pas une phrase (« a jusqu’à 5 jours… »)', JSON.stringify(e.vendeur));
});
essaie('format des montants', () => {
  dit(F.texteCentimesRecu(-379) === '−3,79\u00a0€' && F.texteCentimesRecu(123456) === '1\u202f234,56\u00a0€', 'les montants s’écrivent en centimes, signe moins typographique', JSON.stringify([F.texteCentimesRecu(-379), F.texteCentimesRecu(123456)]));
});

// ── 6. La route ───────────────────────────────────────────────────────────
{
  const r = spawnSync(process.execPath, [__filename, '--route'], { encoding: 'utf8', timeout: 60000, cwd: R });
  const ligne = (r.stdout || '').split('\n').find((l) => l.startsWith('RESULTAT '));
  let o = null; try { o = ligne ? JSON.parse(ligne.slice(9)) : null; } catch (_) {}
  dit(!!o, 'la vraie route email-inbound a été exécutée', o ? '' : (r.stderr || r.stdout || '').split('\n').slice(-4).join(' | ').slice(0, 300));
  if (o) {
    dit(o.maj && o.maj.achats === 0, 'route : « Commande mise à jour pour … » ne crée AUCUNE ligne email_achat_*', JSON.stringify(o.maj));
    dit(o.conf && o.conf.achats === 0, 'route : « … - Confirmation requise » ne crée AUCUNE ligne email_achat_*', JSON.stringify(o.conf));
    dit(o.retour && o.retour.achats === 0, 'route : « Retourne ta commande … » ne crée AUCUNE ligne email_achat_*', JSON.stringify(o.retour));
    dit(o.recu && o.recu.achats === 1, 'route : un vrai reçu crée sa ligne (l’autre sens)', JSON.stringify({ achats: o.recu && o.recu.achats }));
    // §11 — la route et l'app disent la même chose : ce que la route range comme
    // achat, l'app le LISTE (jamais compté parmi « les autres emails » en
    // silence), y compris sans « Montant payé ».
    for (const k of ['merci', 'achete', 'recu']) {
      const lignes = (o[k] && o[k].lignes) || [];
      let liste = null; try { liste = F.recusAchatDe(lignes); } catch (_) {}
      dit(lignes.length === 1 && Array.isArray(liste) && liste.length === 1, `route → app : l’email « ${k} » rangé comme achat par la route est LISTÉ comme reçu par l’app`, JSON.stringify({ rangees: lignes.length, listes: Array.isArray(liste) ? liste.length : String(liste) }));
    }
    const merci = o.merci && o.merci.lignes && o.merci.lignes[0];
    if (merci) {
      let c = null; try { c = F.champsRecuAchat(merci); } catch (_) {}
      dit(c && c.hasStructured === false && /Total payé : 24,93 €/.test(c.cleaned || ''), 'sans « Montant payé », la feuille montre le TEXTE de l’email (rien d’inventé, rien de perdu)', c ? JSON.stringify({ hasStructured: c.hasStructured, phrase: c.phrase }) : 'rien');
    }
  }
}

console.log(`\n${ko ? '❌ ' + ko + ' contrôle(s) au rouge' : '✅ tout est vert'}${MUT ? ' (mutation ' + MUT + ')' : ''}`);
process.exit(ko ? 1 : 0);
