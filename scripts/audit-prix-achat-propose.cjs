// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LE PRIX D'ACHAT PROPOSÉ PAR IDENTITÉ (3 novembre)
//         node scripts/audit-prix-achat-propose.cjs [--mutation=titre|sans-tap|dossier|recu|unique]
// ═══════════════════════════════════════════════════════════════════════════
// Julien (3 nov.) : un article relié PAR IDENTITÉ à un achat, prix d'achat vide
// ⇒ VRM propose le montant payé (« Utiliser 42,90 € ») ; rien n'est écrit sans
// son tap ; jamais proposé par ressemblance de titre (§2.4, §2.5, §5).
// Exécute le VRAI module `src/prixAchatPropose.js` (copie, mutable) sur des
// données INVENTÉES, puis lit le branchement d'App.jsx (commentaires retirés) :
//   A. 50 articles au même titre, 50 achats au même titre : seul l'article relié
//      par n° (son lien) reçoit une proposition — et l'achat au titre identique
//      n'est proposé à aucun autre ;
//   B. photo : fichier exact = identité ; même dossier seul, deux achats au même
//      fichier, achat remboursé, achat de la même transaction, achat postérieur
//      à la vente ⇒ rien ;
//   C. le montant : reçu juste ⇒ « Montant payé » + détail ; reçu faux ⇒ article
//      seul ; autre devise ⇒ rien ; prix déjà saisi / vente annulée ⇒ rien ;
//   D. un achat n'est proposé qu'à UN article ;
//   E. App.jsx : la proposition n'écrit que sur SON tap (`onClick`/`onUtiliser`,
//      ou la confirmation groupée qui liste chaque N° et montant), jamais dans un
//      calcul ; la clé photo est `photoKey` (fichier exact), jamais `photoDir`.
// `--mutation=…` réaffaiblit une règle dans une copie : rouge exigé.
const fs = require('fs'), path = require('path'), os = require('os');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
let MOD = lire('src/prixAchatPropose.js');
let APP = lire('src/App.jsx');
const muter = (quoi, avant, apres) => {
  const s = quoi === 'module' ? MOD : APP;
  if (!s.includes(avant)) { console.log('❌ mutation impossible : motif absent — ' + avant.slice(0, 80)); process.exit(2); }
  if (quoi === 'module') MOD = s.replace(avant, apres); else APP = s.replace(avant, apres);
};
// « par titre » : l'achat dont le titre est celui de l'article (la ressemblance).
if (MUT === 'titre') { muter('module', "if (lie && txDe(lie)) return { achat: lie, par: 'lien' };", "if (lie && txDe(lie)) return { achat: lie, par: 'lien' };\n  const titre = arguments[0].titre; const t = Array.isArray(achats) ? achats.filter((a) => a && titre && a.title === titre && !ACHAT_SANS_COUT.test(String(a.status || ''))) : [];\n  if (t.length) return { achat: t[0], par: 'photo' };"); }
else if (MUT === 'sans-tap') muter('app', 'const m = propositionsUniques(lignes);', 'const m = propositionsUniques(lignes); for (const [c, p] of m) appliquerProposition(c, p);');
else if (MUT === 'dossier') muter('app', 'const cleDePhoto = (a) => photoKey(orderPhoto(a));', 'const cleDePhoto = (a) => photoDir(orderPhoto(a));');
else if (MUT === 'recu') muter('module', "v.somme === 'juste' && ", '');
else if (MUT === 'unique') muter('module', 'if (!proposition || !proposition.tx || vus.has(proposition.tx)) continue;', 'if (!proposition) continue;');
else if (MUT) { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }

const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

(async () => {
  if (!MOD) { dit(false, 'src/prixAchatPropose.js existe'); return fin(); }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pap-'));
  const f = path.join(tmp, 'm.mjs'); fs.writeFileSync(f, MOD);
  const M = await import('file://' + f);
  const { achatParIdentite, propositionPrixAchat, propositionsUniques } = M;
  // Une clé photo « fichier exact » comme `photoKey` : dossier/fichier.
  const photoKey = (u) => { const s = String(u || '').split('?')[0].split('/').filter((x) => x && !/^(f\d+|\d+x\d+)$/.test(x)); return s.length >= 2 ? s.slice(-2).join('/').replace(/\.jpe?g$/, '') : null; };
  const cleDePhoto = (a) => photoKey(a && a.photo && a.photo.url);
  const achat = (i, extra = {}) => ({ transaction_id: 900000000 + i, title: 'Nike Air Max 90 blanche 42', date: '2026-09-01T10:00:00Z', status: 'Transaction finalisée', price: { amount: '30.00', currency_code: 'EUR' }, photo: { url: `https://images1.vinted.net/t/0${i}_dossier${i}/f800/17000000${i}.jpeg?s=x` }, ...extra });
  const RECUS = new Map();
  const ventil = (tx) => RECUS.get(String(tx)) || null;

  console.log('── A. 50 articles au même titre, un seul relié par son n°');
  const achats = Array.from({ length: 50 }, (_, i) => achat(i + 1));
  const articles = Array.from({ length: 50 }, (_, i) => ({ cle: 'f:' + (i + 1), titre: 'Nike Air Max 90 blanche 42', e: { numero: String(i + 1), title: 'Nike Air Max 90 blanche 42', photo: `https://images1.vinted.net/t/0${i + 1}_autre${i + 1}/f800/18000000${i + 1}.jpeg` } }));
  // Le relié est le DERNIER de la liste : une ressemblance le donnerait au premier.
  articles[49].e.buyFromId = String(achats[36].transaction_id);
  const lignes = articles.map((a) => {
    const lie = a.e.buyFromId ? achats.find((x) => String(x.transaction_id) === a.e.buyFromId) : null;
    const identite = achatParIdentite({ lie, photo: photoKey(a.e.photo), venteTx: '', achats, cleDePhoto, pris: new Set(), titre: a.titre });
    return { cle: a.cle, proposition: propositionPrixAchat({ prixConnu: false, identite, ventilationDe: ventil }) };
  });
  const m = propositionsUniques(lignes);
  dit(m.size === 1, 'une seule proposition sur 50 articles identiques', `${m.size}`);
  dit(m.has('f:50') && m.get('f:50').tx === String(achats[36].transaction_id), 'elle va à l’article relié, avec SON achat');
  dit(!m.has('f:1'), 'le premier article au même titre n’a rien');
  dit(m.get('f:50') && m.get('f:50').par === 'lien', 'l’identité dite : le lien qu’il a posé');

  console.log('── B. Photo : fichier exact seulement');
  const ach = [achat(1), achat(2), achat(3, { status: 'Remboursement validé' }), achat(4, { date: '2026-10-20T10:00:00Z' }), achat(5), achat(6)];
  ach[5].photo = { url: ach[4].photo.url };                      // deux achats au MÊME fichier
  const ident = (photo, o = {}) => achatParIdentite({ photo, venteTx: o.tx || '777', venteDate: o.date || '2026-10-01T10:00:00Z', achats: ach, cleDePhoto, pris: o.pris || new Set() });
  const b1 = ident(cleDePhoto(ach[0]));
  dit(b1 && b1.achat === ach[0] && b1.par === 'photo', 'fichier exact ⇒ cet achat');
  dit(ident('01_dossier1/17999999') === null, 'même dossier, autre fichier ⇒ rien');
  dit(ident(cleDePhoto(ach[4])) === null, 'deux achats au même fichier ⇒ rien (ambigu)');
  dit(ident(cleDePhoto(ach[2])) === null, 'achat remboursé ⇒ rien');
  dit(ident(cleDePhoto(ach[3])) === null, 'achat postérieur à la vente ⇒ rien');
  dit(ident(cleDePhoto(ach[1]), { tx: String(ach[1].transaction_id) }) === null, 'achat de la même transaction que la vente ⇒ rien');
  dit(ident(cleDePhoto(ach[0]), { pris: new Set([String(ach[0].transaction_id)]) }) === null, 'achat déjà relié à un autre article ⇒ rien');
  dit(achatParIdentite({ photo: null, achats: ach, cleDePhoto }) === null, 'sans photo ni lien ⇒ rien');

  console.log('── C. Le montant');
  RECUS.set(String(ach[0].transaction_id), { trouve: true, paye: 3463, somme: 'juste', lignes: [{ libelle: 'Article', centimes: 3000 }, { libelle: 'Frais de port', centimes: 263 }, { libelle: 'Frais Vinted', centimes: 200 }] });
  const c1 = propositionPrixAchat({ identite: b1, ventilationDe: ventil });
  dit(c1 && c1.centimes === 3463 && c1.source === 'recu', 'reçu juste ⇒ le montant payé', c1 && c1.texte);
  dit(c1 && c1.detail === 'Article 30,00 € · Frais de port 2,63 € · Frais Vinted 2,00 €', 'détail en une ligne', c1 && c1.detail);
  dit(c1 && c1.texte === '34,63 €' && c1.valeur === '34,63', 'texte et valeur écrite');
  RECUS.set(String(ach[0].transaction_id), { trouve: true, paye: 3500, somme: 'ecart', lignes: [{ libelle: 'Article', centimes: 3000 }] });
  const c2 = propositionPrixAchat({ identite: b1, ventilationDe: ventil });
  dit(c2 && c2.centimes === 3000 && c2.detail === 'Article seul', 'reçu qui ne tombe pas juste ⇒ article seul', c2 && c2.texte);
  dit(propositionPrixAchat({ identite: { achat: achat(9, { price: { amount: '30', currency_code: 'GBP' } }), par: 'lien' } }) === null, 'autre devise ⇒ rien');
  dit(propositionPrixAchat({ prixConnu: true, identite: b1 }) === null, 'prix déjà saisi ⇒ rien');
  dit(propositionPrixAchat({ annulee: true, identite: b1 }) === null, 'vente annulée ⇒ rien');

  console.log('── D. Un achat, un article');
  const p = propositionPrixAchat({ identite: b1, ventilationDe: () => null });
  const u = propositionsUniques([{ cle: 'v:1', proposition: p }, { cle: 'f:9', proposition: p }]);
  dit(u.size === 1 && u.has('v:1'), 'le même achat n’est proposé qu’au premier');

  console.log('── E. App.jsx : écrit sur SON tap seulement');
  const A = sansCommentaires(APP);
  const appels = [...A.matchAll(/appliquerProposition\(/g)].map((x) => x.index);
  const def = A.indexOf('const appliquerProposition = ');
  dit(def > 0, 'la fonction d’écriture existe');
  const horsDef = appels.filter((i) => i !== def + 'const '.length);
  let mauvais = 0;
  for (const i of horsDef) {
    const avant = A.slice(Math.max(0, i - 140), i);
    const dansTap = /(onClick|onUtiliser)=\{(propPrix \? )?\(\)\s*=>\s*$/.test(avant);
    const dansGroupe = /for \(const \[c, p\] of choix\) $/.test(avant);
    if (!dansTap && !dansGroupe) { mauvais++; console.log('     appel hors tap : …' + avant.slice(-90).replace(/\n/g, ' ')); }
  }
  dit(horsDef.length >= 3 && mauvais === 0, 'chaque appel est un tap ou la confirmation groupée', `${horsDef.length} appels, ${mauvais} hors tap`);
  const valider = A.slice(A.indexOf('const validerPropositions = '), A.indexOf('const validerPropositions = ') + 900);
  dit(/askConfirm\(/.test(valider) && valider.indexOf('askConfirm(') < valider.indexOf('appliquerProposition(') && /if \(!ok\) return;/.test(valider), 'le groupe passe par une confirmation, Annuler n’écrit rien');
  dit(/listeConfirmation\(/.test(valider) && /'N°' \+ l\.numero/.test(valider) && /l\.texte/.test(valider), 'la confirmation liste chaque N° et son montant');
  const memo = A.slice(A.indexOf('const propositionsPrix = useMemo('), A.indexOf('const propositionVente = '));
  dit(memo.length > 0 && !/setSaleOverride|setNumeros|save\(|appliquerProposition/.test(memo), 'le calcul des propositions n’écrit rien');
  dit(/const cleDePhoto = \(a\) => photoKey\(orderPhoto\(a\)\);/.test(memo) && /photoKey\(orderPhoto\(o\)\)/.test(memo) && !/photoDir/.test(memo), 'clé photo = fichier exact (photoKey), jamais le dossier');
  dit(!/titre|\.title/.test(memo), 'aucun titre lu par le calcul');
  fin();
})().catch((e) => { console.log('❌ ' + e.stack); ko++; fin(); });
function fin() { console.log(`\n${ok} verts, ${ko} rouges${MUT ? ' (mutation ' + MUT + ')' : ''}`); process.exit(ko ? 1 : 0); }
