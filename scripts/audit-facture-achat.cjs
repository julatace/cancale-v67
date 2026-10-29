#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// audit-facture-achat — LE REÇU D'ACHAT REÇU PAR EMAIL, RELIÉ À SON ACHAT PAR
// IDENTITÉ (29 octobre).
//
// Julien : « Essaie pour les achats de mettre en place les factures si tu les
// reçois par mail. » MESURÉ (lecture seule) : 81 reçus Vinted rangés, AUCUN
// avec un PDF, et le champ `transaction` VIDE sur les 117 lignes `email_achat_*`
// — l'astérisque du gras (« *N° de transaction* 123… ») cassait le motif du
// serveur. L'app relisait le n° dans le texte, mais retombait sur le TITRE quand
// il manquait (§5 l'interdit : 22 % des ventes portent un titre en double).
//
// Ce que cet audit exige :
//   1. la règle partagée (`api/_lib/recu-achat.js`, chargée telle quelle) :
//      le n° se lit ligne par ligne, gras retiré, et seulement quand la ligne ne
//      porte QUE lui ; un nombre au milieu d'une phrase n'est pas un n° ;
//      deux lignes pour le même n° sont le même achat (PDF d'abord, puis la plus
//      détaillée, puis la plus récente) ; « pas su » ne relie rien ;
//      un achat se relie par SON n°, jamais par le titre ;
//   2. le câblage de l'app : `receiptFor` passe par cette règle et rien d'autre,
//      la liste des reçus ne rapatrie jamais `data` ni le PDF (§4.4), le PDF ne
//      se lit qu'au clic, et la pastille « Facture reçue par email » ouvre CE reçu ;
//   3. la VRAIE route `api/email-inbound.js` (processus à part, fausse base) :
//      un reçu au n° en gras est rangé sous `email_achat_{n°}` avec son n° ;
//      le même email reçu deux fois ne fait qu'une ligne ; un nombre dans une
//      phrase ne devient pas un n° ; et ce que la route range, l'app le relie
//      à l'achat de CE n° — pas à un achat au même titre (§11).
//
// `--mutation=X` réaffaiblit une règle (chacune doit rendre l'audit ROUGE) :
//   titre (le module retombe sur le titre) · gras (l'astérisque n'est plus
//   retiré) · phrase (le n° se prend n'importe où dans la ligne) · premier (le
//   premier reçu d'un n° gagne, même sans PDF) · receiptfor (l'app ajoute un
//   repli par titre) · select (la liste rapatrie `data`) · serveur (la route
//   reprend l'ancien motif).
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { spawnSync } = require('child_process');
const R = path.join(__dirname, '..');

// ── 3. La route, dans un processus neuf ───────────────────────────────────
if (process.argv[2] === '--route') {
  const RACINE = process.argv[3] || R;
  const A = '11111111-2222-3333-4444-555555555555';
  process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
  process.env.VRM_OWNER_UID = A;
  process.env.EMAIL_INBOUND_SECRET = 'cle-banc-facture';
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
  // Formes INVENTÉES, au gabarit des reçus mesurés (aucune donnée réelle).
  const RECU = 'E-mail Vinted\n\nBonjour compte_banc,\n\n*Ton paiement a été reçu. *\n\nVoici les détails de ta commande :\n*Vendeur* vendeur_banc\n*Commande*\n\nBasket facture banc\n*Montant payé* 24,93 € \nArticle 20,00 € \nFrais de port 3,23 € \nFrais Vinted 1,70 € \n*Mode de paiement* Visa, **********4242 (24,93 €) \n*Date du paiement* 27/10/2026 10 h 47 \n*N° de transaction* 99990000111 \n';
  const ETAPES = [
    ['recu', mail('Ton reçu pour la commande « Basket facture banc »', RECU)],
    ['double', mail('Ton reçu pour la commande « Basket facture banc »', RECU)],
    ['phrase', mail('Merci pour ton achat !', 'Bonjour,\n\nMerci pour ton achat « Sandale phrase banc ».\nTa transaction 88880000222 est en cours de traitement chez Vinted.\nTotal payé : 31,00 €\n')],
  ];
  (async () => {
    const out = {};
    const inbound = await import('file://' + path.join(RACINE, 'api', 'email-inbound.js'));
    for (const [k, m] of ETAPES) {
      const res = faireRes();
      try { await inbound.default({ method: 'POST', query: {}, headers: { 'x-vrm-email-key': 'cle-banc-facture' }, body: JSON.parse(JSON.stringify(m)) }, res); }
      catch (e) { out[k] = { erreur: String(e && e.message) }; continue; }
      out[k] = { code: res.code, achats: [...base.entries()].filter(([x]) => x.includes('|email_achat_')).map(([x, d]) => ({ id: x.split('|')[1], transaction: d && d.transaction, article: d && d.article, texte: d && d.texte })) };
    }
    console.log('RESULTAT ' + JSON.stringify(out));
    process.exit(0);
  })();
  return;
}

const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
// Un audit ne meurt pas, il rapporte : un fichier absent (le code d'avant n'a
// pas la règle partagée) devient un contrôle ROUGE, pas une pile d'appels.
const lire = (...p) => { try { return fs.readFileSync(path.join(R, ...p), 'utf8'); } catch (_) { return null; } };
const regleLue = lire('api', '_lib', 'recu-achat.js');
let regle = regleLue || '';
let app = lire('src', 'App.jsx') || '';
let route = lire('api', 'email-inbound.js') || '';
const muter = (quoi, avant, apres) => {
  const t = quoi === 'regle' ? regle : quoi === 'app' ? app : route;
  if (!t.includes(avant)) { console.log('❌ mutation impossible : motif absent — ' + avant.slice(0, 70)); process.exit(2); }
  const n = t.replace(avant, apres);
  if (quoi === 'regle') regle = n; else if (quoi === 'app') app = n; else route = n;
};
if (MUT === 'titre') {
  // Le module retombe sur le titre — et, pour que ce repli puisse désigner un
  // reçu SANS n°, l'index garde aussi ces lignes sous leur identifiant.
  muter('regle', 'return index.get(tx) || null;\n}', "return index.get(tx) || [...index.values()].find((r) => r && r.article && r.article === achat.title) || null;\n}");
  muter('regle', "if (!tx) continue;                       // sans n°, un reçu ne désigne AUCUN achat", "if (!tx) { index.set('sans:' + (r && r.id), r); continue; }");
}
else if (MUT === 'gras') muter('regle', ".map((l) => l.replace(/\\*+/g, ' ')", '.map((l) => l');
else if (MUT === 'phrase') muter('regle', 'export const TX_RECU = /^(?:n[°º]?\\s*de\\s+)?transaction\\s*:?\\s*#?\\s*(\\d{6,})$/i;', 'export const TX_RECU = /transaction\\s*:?\\s*#?\\s*(\\d{6,})/i;');
else if (MUT === 'premier') muter('regle', 'if (!deja || score(r) > score(deja) || (score(r) === score(deja) && quand(r) > quand(deja))) index.set(tx, r);', 'if (!deja) index.set(tx, r);');
else if (MUT === 'receiptfor') muter('app', 'const receiptFor = (o) => recuDeLAchat(o, indexRecusAchat);', "const receiptFor = (o) => recuDeLAchat(o, indexRecusAchat) || (recusAchat || []).find((r) => normTitle(r.article || '') === normTitle(o.title || '')) || null;");
else if (MUT === 'select') muter('app', "const SELECT_RECUS_ACHAT = 'id,", "const SELECT_RECUS_ACHAT = 'id,data,");
else if (MUT === 'serveur') muter('route', 'const transaction = transactionDuRecu(corpsTexte);', "const transaction = (achText.match(/transaction\\s*:?\\s*#?(\\d{6,})/i) || [])[1] || '';");
else if (MUT) { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = (nom, f) => { try { f(); } catch (e) { dit(false, nom, String(e && e.message || e).slice(0, 200)); } };

// ── 1. La règle partagée ──────────────────────────────────────────────────
dit(regleLue != null, 'la règle partagée api/_lib/recu-achat.js existe (une règle pour le serveur et l’app, §11)');
const ctx = vm.createContext({ console });
let F = {};
essaie('la règle partagée api/_lib/recu-achat.js se charge', () => {
  vm.runInContext(regle.replace(/^export\s+/gm, '') + '\n;this.__F = { transactionDuRecu, transactionDeLaLigne, indexRecusParTransaction, recuDeLAchat };', ctx);
  F = ctx.__F || {};
});
const GRAS = 'Basket facture banc\n*Montant payé* 24,93 € \n*Date du paiement* 27/10/2026 10 h 47 \n*N° de transaction* 99990000111 \n';
essaie('lecture du n°', () => {
  dit(F.transactionDuRecu(GRAS) === '99990000111', 'le n° en gras « *N° de transaction* 99990000111 » est lu', JSON.stringify(F.transactionDuRecu(GRAS)));
  dit(F.transactionDuRecu('Transaction : 23400000009\n') === '23400000009', 'la forme « Transaction : 23400000009 » est lue');
  dit(F.transactionDuRecu('N° de transaction\u00a0: 23400000010') === '23400000010', 'une espace insécable n’empêche pas la lecture');
  dit(F.transactionDuRecu('Ta transaction 88880000222 est en cours de traitement.') === '', 'un nombre AU MILIEU d’une phrase n’est pas un n° de transaction', JSON.stringify(F.transactionDuRecu('Ta transaction 88880000222 est en cours de traitement.')));
  dit(F.transactionDuRecu('*N° de transaction* 12345 \n') === '', 'moins de 6 chiffres : rien (jamais deviné)');
  dit(F.transactionDuRecu(null) === '' && F.transactionDuRecu(undefined) === '', 'pas de texte : rien, sans lever');
  dit(F.transactionDeLaLigne({ transaction: '99990000333', texte: GRAS }) === '99990000333', 'le n° rangé par le serveur prime sur le texte');
  dit(F.transactionDeLaLigne({ transaction: '', texte: GRAS }) === '99990000111', 'une ligne d’avant le 29 octobre (champ vide) se lit dans son texte');
  dit(F.transactionDeLaLigne({ transaction: 'abc', texte: 'rien' }) === '', 'un champ illisible et un texte sans n° : rien');
});
const r1 = { id: 'email_achat_a', transaction: '', texte: GRAS, receivedAt: '2026-10-27T10:00:00Z' };
const r1b = { id: 'email_achat_99990000111', transaction: '99990000111', texte: GRAS, receivedAt: '2026-10-28T10:00:00Z' };
const rPdf = { id: 'email_achat_b', transaction: '99990000333', _pdf: true, receivedAt: '2026-10-20T10:00:00Z' };
const rPdfNeuf = { id: 'email_achat_c', transaction: '99990000333', _pdf: false, receivedAt: '2026-10-29T10:00:00Z' };
const rSansTx = { id: 'email_achat_d', transaction: '', article: 'Sandale jumelle banc', texte: 'Sandale jumelle banc\n*Montant payé* 31,00 €\n', receivedAt: '2026-10-26T10:00:00Z' };
const rAutreTx = { id: 'email_achat_e', transaction: '99990000999', article: 'Sandale jumelle banc', receivedAt: '2026-10-26T11:00:00Z' };
essaie('index des reçus', () => {
  const ix = F.indexRecusParTransaction([r1, rPdf, rPdfNeuf, rSansTx, rAutreTx, r1b], () => false);
  dit(ix.get('99990000333') === rPdf, 'deux lignes du même n° : celle qui porte le PDF gagne, même plus ancienne', ix.get('99990000333') && ix.get('99990000333').id);
  dit(ix.get('99990000111') === r1b, 'deux lignes du même n°, à égalité : la plus récente gagne', ix.get('99990000111') && ix.get('99990000111').id);
  dit(![...ix.values()].includes(rSansTx), 'un reçu SANS n° n’entre pas dans l’index (il ne désigne aucun achat)');
  dit(F.indexRecusParTransaction(null).size === 0 && F.indexRecusParTransaction(undefined).size === 0, '« pas su » (null) et « en cours » (undefined) : index vide, rien n’est relié');
  const det = F.indexRecusParTransaction([{ id: 'x1', transaction: '99990000444', receivedAt: '2026-10-29T00:00:00Z' }, { id: 'x2', transaction: '99990000444', receivedAt: '2026-10-01T00:00:00Z', detail: true }], (r) => !!r.detail);
  dit(det.get('99990000444') && det.get('99990000444').id === 'x2', 'sans PDF : celle dont le texte a son « Montant payé » gagne sur une plus récente');
});
essaie('rattachement à l’achat', () => {
  const ix = F.indexRecusParTransaction([r1, rPdf, rSansTx, rAutreTx], () => false);
  dit(F.recuDeLAchat({ transaction_id: 99990000111, title: 'Basket facture banc' }, ix) === r1, 'un achat se relie au reçu de SON n° (même donné en nombre)');
  dit(F.recuDeLAchat({ transaction_id: '99990000222', title: 'Sandale jumelle banc' }, ix) === null, 'un achat AU MÊME TITRE qu’un reçu, sans le même n° : AUCUN reçu (§5)', String(F.recuDeLAchat({ transaction_id: '99990000222', title: 'Sandale jumelle banc' }, ix) && F.recuDeLAchat({ transaction_id: '99990000222', title: 'Sandale jumelle banc' }, ix).id));
  dit(F.recuDeLAchat({ transaction_id: 'mail:abc', title: 'Basket facture banc' }, ix) === null, 'une commande reconstituée d’un email (« mail:… ») n’a pas de n° : rien');
  dit(F.recuDeLAchat({ transaction_id: '99990000111' }, null) === null, 'sans index : rien, sans lever');
});

// ── 2. Le câblage de l'app ────────────────────────────────────────────────
dit(/import\s*\{[^}]*\brecuDeLAchat\b[^}]*\bindexRecusParTransaction\b[^}]*\}\s*from\s*'\.\.\/api\/_lib\/recu-achat\.js'|import\s*\{[^}]*\bindexRecusParTransaction\b[^}]*\brecuDeLAchat\b[^}]*\}\s*from\s*'\.\.\/api\/_lib\/recu-achat\.js'/.test(app), 'l’app importe la règle partagée (une règle pour le serveur et l’app, §11)');
const rf = (app.match(/const receiptFor = \(o\) => ([^\n]*)/) || [])[1] || '';
dit(/^recuDeLAchat\(o, indexRecusAchat\);/.test(rf), 'receiptFor = la règle partagée, et RIEN d’autre (aucun repli)', rf.slice(0, 160));
dit(!/normTitle|\.title|article/.test(rf), 'receiptFor ne lit aucun titre', rf.slice(0, 160));
dit(/const indexRecusAchat = useMemo\(\(\) => indexRecusParTransaction\(recusAchat/.test(app), 'l’index se calcule sur la liste des reçus (une fois par lecture)');
// La constante peut s'écrire en plusieurs morceaux (« '…' + '…' ») : on recolle.
const selBloc = (app.match(/const SELECT_RECUS_ACHAT = ((?:'[^']*'\s*\+?\s*)+);/) || [])[1];
const sel = selBloc ? [...selBloc.matchAll(/'([^']*)'/g)].map((m) => m[1]).join('') : null;
dit(!!sel, 'la liste des reçus a sa projection (SELECT_RECUS_ACHAT)');
if (sel) {
  const parts = sel.split(',');
  dit(!parts.includes('data') && !/pdfB64/.test(sel), 'la liste ne rapatrie jamais `data` entier ni le PDF (§4.4)', sel);
  dit(parts.includes('pdf:meta->>_pdf'), 'la présence d’un PDF se lit en scalaire (meta->>_pdf)', sel);
  dit(parts.includes('texte:data->>texte') && parts.includes('transaction:meta->>transaction'), 'le texte et le n° rangé sont projetés (la règle lit l’un puis l’autre)', sel);
}
dit(/data-achat-facture=\{rc\._pdf \|\| rc\.pdfB64 \? 'pdf' : 'email'\}[\s\S]{0,400}onClick=\{\(\)=>setReceiptView\(rc\)\}[\s\S]{0,700}Facture reçue par email/.test(app), 'la pastille « Facture reçue par email » ouvre CE reçu (setReceiptView(rc))');
dit(/const rc = receiptFor\(o\);/.test(app) && /\{rc && \(\s*<div className="vrm-buy-facture">/.test(app), 'la pastille n’existe que quand receiptFor a relié un reçu');
dit(/lirePdfLigne\(recu\._emailId\)/.test(app), 'le PDF joint ne se lit qu’au clic, par le lecteur unique (lirePdfLigne)');
dit(!/receiptFor[\s\S]{0,300}normTitle\(r\.article/.test(app), 'aucun repli par titre ne subsiste autour de receiptFor');

// ── 2 bis. Le serveur ─────────────────────────────────────────────────────
dit(/import \{ transactionDuRecu \} from '\.\/_lib\/recu-achat\.js';/.test(route), 'la route importe la règle partagée');
dit(/const transaction = transactionDuRecu\(corpsTexte\);/.test(route), 'la route lit le n° par cette règle, sur le texte entier');
dit(!/achText\.match\(\/transaction/.test(route), 'l’ancien motif (sans le gras) n’existe plus dans la route');

// ── 3. La vraie route ─────────────────────────────────────────────────────
let racine = R, tmp = null;
if (MUT === 'serveur' || MUT === 'gras' || MUT === 'phrase') {
  // La route mutée tourne dans une COPIE (api + src), jamais dans le dépôt.
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-facture-achat-'));
  fs.cpSync(path.join(R, 'api'), path.join(tmp, 'api'), { recursive: true });
  fs.cpSync(path.join(R, 'src'), path.join(tmp, 'src'), { recursive: true });
  fs.copyFileSync(path.join(R, 'package.json'), path.join(tmp, 'package.json'));
  fs.symlinkSync(path.join(R, 'node_modules'), path.join(tmp, 'node_modules'));
  fs.writeFileSync(path.join(tmp, 'api', 'email-inbound.js'), route);
  if (regleLue != null) fs.writeFileSync(path.join(tmp, 'api', '_lib', 'recu-achat.js'), regle);
  racine = tmp;
}
const r = spawnSync(process.execPath, [__filename, '--route', racine], { encoding: 'utf8', timeout: 90000, cwd: R });
if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
const ligne = (r.stdout || '').split('\n').find((l) => l.startsWith('RESULTAT '));
const o = ligne ? JSON.parse(ligne.slice(9)) : null;
dit(!!o, 'la vraie route email-inbound a été exécutée', o ? '' : (r.stderr || r.stdout || '').split('\n').slice(-4).join(' | ').slice(0, 300));
if (o) {
  const recu = (o.recu && o.recu.achats) || [];
  dit(recu.length === 1 && recu[0].id === 'email_achat_99990000111', 'route : le reçu au n° en gras est rangé sous email_achat_{n°}', JSON.stringify(recu.map((x) => x.id)));
  dit(recu.length === 1 && recu[0].transaction === '99990000111', 'route : la ligne porte son n° de transaction (il était vide sur les 117 lignes)', JSON.stringify(recu.map((x) => x.transaction)));
  const dbl = (o.double && o.double.achats) || [];
  dit(dbl.length === 1, 'route : le même reçu reçu deux fois ne fait qu’UNE ligne (la clé est le n°)', JSON.stringify(dbl.map((x) => x.id)));
  const ph = ((o.phrase && o.phrase.achats) || []).filter((x) => /Sandale phrase banc/.test(x.texte || ''));
  dit(ph.length === 1 && ph[0].transaction === '', 'route : « Ta transaction 88880000222 est en cours » ne devient PAS un n°', JSON.stringify(ph.map((x) => [x.id, x.transaction])));
  // §11 — ce que la route range, l'app le relie à l'achat de CE n°, et à aucun autre.
  essaie('route → app', () => {
    const lignes = ((o.phrase && o.phrase.achats) || []).map((x) => ({ id: x.id, transaction: x.transaction, texte: x.texte, article: x.article }));
    const ix = F.indexRecusParTransaction(lignes, () => false);
    const bon = F.recuDeLAchat({ transaction_id: '99990000111', title: 'Basket facture banc' }, ix);
    dit(!!bon && bon.id === 'email_achat_99990000111', 'route → app : le reçu rangé par la route se relie à l’achat de son n°', bon ? bon.id : 'aucun');
    const jumeau = F.recuDeLAchat({ transaction_id: '99990000777', title: 'Basket facture banc' }, ix);
    dit(jumeau === null, 'route → app : un AUTRE achat au même titre ne reçoit aucun reçu', jumeau ? jumeau.id : 'aucun');
    const phrase = F.recuDeLAchat({ transaction_id: '88880000222', title: 'Sandale phrase banc' }, ix);
    dit(phrase === null, 'route → app : le nombre lu dans une phrase ne relie rien', phrase ? phrase.id : 'aucun');
  });
}

console.log(`\n${ko ? '❌' : '✅'} audit-facture-achat${MUT ? ' (mutation ' + MUT + ')' : ''} : ${ko} rouge(s)`);
process.exit(ko ? 1 : 0);
