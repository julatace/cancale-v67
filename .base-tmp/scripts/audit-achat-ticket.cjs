// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LA PHOTO DU TICKET PROPOSE L'ACHAT (11 nov., lot achat-photo)
//         node scripts/audit-achat-ticket.cjs [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// `lireTicketAchat` (src/depensesTicket.js) et `ticketVersBrouillon`
// (src/achatTicket.js). Tickets INVENTÉS (aucune donnée réelle).
// Ce qui est jugé : le TOTAL payé (jamais le sous-total, le HT, la TVA, le
// rendu, une remise), la date d'achat (jamais une date « valable jusqu'au »),
// l'enseigne écrite, le nombre d'articles écrit ; rien lu ⇒ null ; un champ
// qu'il a tapé n'est jamais écrasé ; le prix lu attend SON clic.
// `--prouve` rejoue l'audit sur des copies réaffaiblies : chacune doit rougir.
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';

const MUTATIONS = {
  'plus-grand': ['depensesTicket.js', '  return null;\n}\nconst lignesDe', '  { const tous = lignes.flatMap(montantsDe); return tous.length ? Math.max(...tous) : null; }\n}\nconst lignesDe'],
  'tva-incluse': ['depensesTicket.js', '\\btva\\b(?!\\s*(?:incluse|comprise))|rendu', '\\btva\\b|rendu'],
  'remise-negative': ['depensesTicket.js', '    if (negatif(l, m.index)) continue;\n    const c = parseInt(m[1].replace(/[ .', '    const c = parseInt(m[1].replace(/[ .'],
  'date-future': ['depensesTicket.js', "return vues.find((d) => d <= fin && d >= debut) || null;", 'return vues[0] || null;'],
  'ecrase-prix': ['achatTicket.js', "if (lu.montant != null && !String(d.price || '').trim())", 'if (lu.montant != null)'],
  'prix-sans-clic': ['achatTicket.js', "export const prixEncoreLu = (form) => champEncoreLu(form, 'price');", 'export const prixEncoreLu = () => false;'],
  'lieu-invente': ['depensesTicket.js', "  return null;\n}\n// Le nombre d'articles", "  return lignes[0] || null;\n}\n// Le nombre d'articles"],
  'lieu-sans-ticket': ['depensesTicket.js', '  if (connueSeulement) return null;\n', ''],
  'bouton-muet': ['ecrans/Achats.jsx', "(prixEncoreLu(form) ? `Valider ${form.price}\\u00a0€ et ajouter` : \"Ajouter l'achat\")", "\"Ajouter l'achat\""],
};

if (process.argv.includes('--prouve')) {
  let rouges = 0;
  for (const [nom, [fic, a, b]] of Object.entries(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + nom], { encoding: 'utf8', env: process.env });
    const rouge = r.status === 1;
    if (rouge) rouges++;
    console.log((rouge ? '  ✅ ' : '  ❌ ') + `mutation ${nom} (${fic}) ⇒ ${rouge ? 'rouge' : 'VERT (le contrôle ne la voit pas)'}`);
    if (r.status === 2) console.log(r.stdout);
  }
  const n = Object.keys(MUTATIONS).length;
  console.log(`\n${rouges}/${n} mutations rouges`);
  process.exit(rouges === n ? 0 : 1);
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d != null ? ' — ' + d : '')); };
const lire = (f) => { try { return fs.readFileSync(path.join(R, 'src', f), 'utf8'); } catch (_) { return ''; } };
const SRC = { 'depensesTicket.js': lire('depensesTicket.js'), 'achatTicket.js': lire('achatTicket.js'), 'ecrans/Achats.jsx': lire('ecrans/Achats.jsx') };
if (MUT) {
  const m = MUTATIONS[MUT]; if (!m) { console.log('mutation inconnue'); process.exit(2); }
  if (!SRC[m[0]].includes(m[1])) { console.log('❌ motif absent : ' + m[1].slice(0, 70)); process.exit(2); }
  SRC[m[0]] = SRC[m[0]].replace(m[1], m[2]);
}

(async () => {
  if (!SRC['achatTicket.js'] || !/lireTicketAchat/.test(SRC['depensesTicket.js'])) { dit(false, 'src/achatTicket.js et lireTicketAchat existent'); return fin(); }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'at-'));
  fs.writeFileSync(path.join(dir, 'd.mjs'), SRC['depensesTicket.js']);
  fs.writeFileSync(path.join(dir, 'a.mjs'), SRC['achatTicket.js']);
  const D = await import('file://' + path.join(dir, 'd.mjs'));
  const A = await import('file://' + path.join(dir, 'a.mjs'));
  const AUJ = new Date('2026-11-11T12:00:00');
  const L = (t) => D.lireTicketAchat(t, AUJ);

  console.log('— Le montant TOTAL —');
  const cas = [
    ['total ≠ sous-total, remise négative ignorée', 'FRIPERIE DU PORT\nSOUS-TOTAL 50,00\nREMISE -5,00\nTOTAL TTC 45,00', 4500],
    ['espèces et rendu monnaie : le total, jamais le rendu', 'TOTAL 7,30\nESPECES 10,00\nRENDU MONNAIE 2,70', 730],
    ['« à rendre » n’est pas le total', 'NET A PAYER 18,00\nESPECES 20,00\nA RENDRE 2,00', 1800],
    ['point décimal : 12.50', 'TOTAL 12.50 EUR', 1250],
    ['capture d’écran : « Total (TVA incluse) 45,00 € »', 'Récapitulatif\nSous-total 41,00 €\nLivraison 4,00 €\nTotal (TVA incluse) 45,00 €', 4500],
    ['capture d’écran sans centimes : « Total 60 € »', 'Commande n° 8812\nArticle 55 €\nTotal 60 €', 6000],
    ['TOTAL HT et TVA écartés', 'TOTAL HT 37,50\nTVA 20% 7,50\nTOTAL TTC 45,00', 4500],
    ['« TOTAL ARTICLES 3 » ne prend pas la ligne d’après', 'TOTAL ARTICLES 3\nCB 30,00', 3000],
    ['« -5,00 » seul n’est pas un total', 'TOTAL -5,00', null],
    ['sans mot de total : rien (jamais le plus grand)', 'Nike 40,00\nSac 9,00\n120,00', null],
    ['texte vide : rien', '', null],
  ];
  for (const [nom, t, attendu] of cas) { const v = L(t).montant; dit(v === attendu, nom, String(v)); }

  console.log('— La date d’achat —');
  const dates = [
    ['JJ/MM/AAAA', 'Le 09/11/2026 à 14:32\nTOTAL 3,00', '2026-11-09'],
    ['JJ-MM-AA', '08-11-26 10:02\nTOTAL 3,00', '2026-11-08'],
    ['JJ.MM.AAAA', 'DATE 07.11.2026', '2026-11-07'],
    ['« 5 nov. 2026 »', 'Commande du 5 nov. 2026', '2026-11-05'],
    ['« valable jusqu’au » écarté, la vraie date prise', 'Avoir valable jusqu’au 09/12/2026\n10/11/2026 11:00', '2026-11-10'],
    ['date future seule : rien', '12/12/2026', null],
    ['31/02 n’existe pas : rien', '31/02/2026', null],
    ['aucune date : rien', 'TOTAL 3,00', null],
  ];
  for (const [nom, t, attendu] of dates) { const v = L(t).date; dit(v === attendu, nom, String(v)); }

  console.log('— L’enseigne et les articles —');
  dit(L('EMMAUS SOLIDARITE\nTOTAL 3,00').lieu === 'Emmaüs', 'enseigne connue écrite ⇒ son nom', L('EMMAUS SOLIDARITE').lieu);
  dit(L('FRIPERIE DU PORT\n12 rue Inventée\nTOTAL 3,00').lieu === 'Friperie Du Port', 'nom en tête du ticket ⇒ lu (mis en forme)', L('FRIPERIE DU PORT').lieu);
  dit(L('12 rue Inventée\n35000 RENNES\nTOTAL 3,00').lieu === null, 'une adresse n’est pas un lieu : rien', String(L('12 rue Inventée\n35000 RENNES').lieu));
  dit(L('TICKET DE CAISSE\n0123456789\nTOTAL 3,00').lieu === null, '« ticket de caisse » n’est pas un lieu : rien', String(L('TICKET DE CAISSE').lieu));
  dit(L('Xkqw Lmnr Ztbv').lieu === null, 'sans total ni date : un texte quelconque n’est pas un lieu', String(L('Xkqw Lmnr Ztbv').lieu));
  dit(L('DECATHLON').lieu === 'Decathlon', 'sans total ni date : une enseigne connue reste lue', String(L('DECATHLON').lieu));
  dit(L('3 ARTICLES\nTOTAL 9,00').articles === 3, '« 3 ARTICLES » ⇒ 3');
  dit(L("Nombre d'articles : 4").articles === 4, '« Nombre d’articles : 4 » ⇒ 4');
  dit(L('TOTAL 9,00').articles === null, 'pas écrit ⇒ rien');

  console.log('— Le brouillon : proposé, jamais imposé —');
  const vide = { title: '', price: '', date: '2026-11-11', source: '', facture: null };
  const lu = L('FRIPERIE DU PORT\n09/11/2026\nTOTAL 45,00\n2 ARTICLES');
  const fic = { name: 'ticket.jpg' };
  const b = A.ticketVersBrouillon(vide, { lu, fichier: fic, aujourdhui: '2026-11-11', enMontant: D.texteMontantSaisie });
  dit(b.price === '45,00' && b.date === '2026-11-09' && b.source === 'Friperie Du Port', 'champs vides ⇒ prix, date, lieu proposés', `${b.price} · ${b.date} · ${b.source}`);
  dit(A.prixEncoreLu(b) === true, 'le prix lu attend SA validation (le bouton le dit)');
  dit(b.facture === fic && b.factureDuTicket === true, 'le ticket devient la facture jointe (écrite à « Ajouter » seulement)');
  dit(b.ticket.etat === 'lu' && b.ticket.articles === 2, 'état « lu », 2 articles dits');
  const retouche = { ...b, price: '40' };
  dit(A.prixEncoreLu(retouche) === false, 'il retape le prix ⇒ plus marqué « lu »');
  const tape = A.ticketVersBrouillon({ ...vide, price: '30', date: '2026-11-01', source: 'Brocante' }, { lu, aujourdhui: '2026-11-11', enMontant: D.texteMontantSaisie });
  dit(tape.price === '30' && tape.date === '2026-11-01' && tape.source === 'Brocante', 'ce qu’il a tapé n’est JAMAIS écrasé', `${tape.price} · ${tape.date} · ${tape.source}`);
  dit(A.prixEncoreLu(tape) === false, 'son prix tapé n’est pas « lu sur le ticket »');
  const rien = A.ticketVersBrouillon(vide, { lu: L('xx yy'), aujourdhui: '2026-11-11', enMontant: D.texteMontantSaisie });
  dit(rien.price === '' && rien.ticket.etat === 'rien', 'rien lu ⇒ champ prix vide, « Tape le prix »', A.resumeTicket(rien.ticket));
  const panne = A.ticketVersBrouillon(vide, { lu: L(''), raison: 'hors-ligne', aujourdhui: '2026-11-11', enMontant: D.texteMontantSaisie });
  dit(panne.ticket.etat === 'impossible' && /connexion/.test(A.resumeTicket(panne.ticket)), 'lecture impossible ⇒ on dit pourquoi', A.resumeTicket(panne.ticket));
  const phrases = Object.values(A.RAISON_TICKET).concat(['Rien de lisible sur ce ticket. Tape le prix.']);
  dit(phrases.every((p) => p.split(/[.!?]\s+/).every((x) => x.trim().split(/\s+/).length <= 12)), 'phrases de 12 mots au plus');

  console.log('— Le formulaire —');
  const ach = SRC['ecrans/Achats.jsx'];
  // (11 nov., traduction) La phrase vit dans src/i18n/langues/fr/achats.js ; le bouton l'appelle avec LE montant du formulaire.
  const frAch = (() => { try { return fs.readFileSync(path.join(R, 'src', 'i18n', 'langues', 'fr', 'achats.js'), 'utf8'); } catch (_) { return ''; } })();
  dit(/Valider \$\{form\.price\}\\u00a0€ et ajouter/.test(ach) || (/tr\('achats\.validerAjouter', \{ price: String\(form\.price\) \}\)/.test(ach) && /"achats\.validerAjouter": "Valider \{price\}\u00a0€ et ajouter"/.test(frAch)), 'le bouton dit le montant à valider');
  dit(/data-achat-ticket-bouton/.test(ach) && /lireTexteTicket\(/.test(ach), 'le bouton « Photo du ticket » lit par la lecture locale');
  const code = (s) => s.replace(/\/\/[^\n]*/g, '');
  dit(!/\/api\/|anthropic|openai|photoroom/i.test(code(SRC['depensesTicket.js']) + code(SRC['achatTicket.js'])), 'aucun service distant ni payant (§2.9)');
  fin();
})();
function fin() { console.log(`\n${ok} verts, ${ko} rouges${MUT ? ' (mutation ' + MUT + ')' : ''}`); process.exit(ko ? 1 : 0); }
