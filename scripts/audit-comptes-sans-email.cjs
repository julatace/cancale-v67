// ════════════════════════════════════════════════════════════════════════════
//  « QUELS COMPTES N'ENVOIENT AUCUN EMAIL À VRM, ET DEPUIS QUAND » (11 octobre)
//     node scripts/audit-comptes-sans-email.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
//  Mesuré (plaintes-11oct/notifications.md + relectures) : `angeled92` et
//  `tomj606` n'ont JAMAIS envoyé un email à VRM, `arthuror2` plus aucun depuis
//  le 23 septembre — donc ni leurs ventes ni leurs messages ne peuvent sonner.
//  L'app le savait à moitié, et se trompait dans les deux sens :
//    · elle ne lisait pas le JOURNAL : `jujuf38`, dont 9 messages sont arrivés,
//      était annoncé « aucun email », en ROUGE ;
//    · « aucun email » ne prouve rien pour un compte qui n'a rien vendu.
//  La règle (`etatEmailsComptes`, bloc <comptes-sans-email> d'App.jsx) ne dit
//  « muet » que sur une PREUVE : des ventes captées (identité : le compte qui
//  les a moissonnées) sans email de bordereau (identité : la transaction)
//  depuis le dernier signe de vie du compte.
//  On EXÉCUTE le vrai bloc dans un `vm`, sur des données inventées à la forme
//  des siennes. `--prouve` réaffaiblit la règle à l'ancienne (« aucun email ⇒
//  muet ») et doit sortir ROUGE (§6.1 : « la fonction n'existait pas » n'est
//  pas une preuve).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), vm = require('vm'), path = require('path');
const APP = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');
const PROUVE = process.argv.includes('--prouve');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${d ? ' — ' + d : ''}`); };
const essaie = (m, f) => { try { f(); } catch (e) { ko++; console.log(`❌ ${m} — a levé : ${e && e.message}`); } };

const m = /\/\/ <comptes-sans-email>[^\n]*\n([\s\S]*?)\/\/ <\/comptes-sans-email>/.exec(APP);
if (!m) { console.log('❌ bloc <comptes-sans-email> introuvable dans App.jsx'); process.exit(1); }
let bloc = m[1];
if (PROUVE) {
  // L'ancienne règle : un compte sans le moindre email (dans les 6 familles) est muet.
  bloc = bloc.replace(/const muet = ventesLues[\s\S]*?;\n/, 'const muet = n === 0;\n');
}
const ctx = { Date, Number, Math, Set, String, Array, Object, isNaN, console };
vm.createContext(ctx);
vm.runInContext(bloc + '\nthis.etatEmailsComptes = etatEmailsComptes; this.estRelaisApple = estRelaisApple;', ctx);
const { etatEmailsComptes } = ctx;

const NOW = Date.UTC(2026, 9, 11, 10, 0, 0);
const jour = (j) => new Date(NOW - j * 86400000).toISOString();
const vente = (uid, tx, j, status = "Commande finalisée - l'acheteur a validé la commande") => ({ transaction_id: tx, date: jour(j), status, _acc: { vinted_user_id: uid } });
const annulee = (o) => /annul|rembours/i.test(String(o.status || ''));

const COMPTES = [
  { vinted_user_id: '3175765377', login: 'angeled92' },
  { vinted_user_id: '3170801262', login: 'tomj606' },
  { vinted_user_id: '3179807757', login: 'arthuror2' },
  { vinted_user_id: '3999000001', login: 'jujuf38' },
  { vinted_user_id: '3156028798', login: 'julatace35260' },
  { vinted_user_id: '3999000002', login: 'compte_neuf' },
];
const ADRESSES = { '3175765377': 'a1b2@privaterelay.appleid.com', '3170801262': 'c3d4@privaterelay.appleid.com', '3179807757': 'e5f6@privaterelay.appleid.com', '3156028798': 'vendeur@icloud.com' };
const VENTES = [
  // angeled92 : 5 ventes, aucune n'a eu son email (jamais)
  ...[40, 30, 20, 12, 8].map((j, i) => vente('3175765377', 9100 + i, j)),
  // tomj606 : 3 ventes, aucune
  ...[25, 15, 9].map((j, i) => vente('3170801262', 9200 + i, j)),
  // arthuror2 : bordereau reçu pour la vente du 23 sept. (18 j), puis 16 j et 7 j sans
  vente('3179807757', 9301, 18), vente('3179807757', 9302, 16), vente('3179807757', 9303, 7),
  // julatace35260 : 10 ventes, 8 avec bordereau, 2 sans — intercalées
  ...[30, 27, 24, 21, 18, 15, 12, 9, 6, 4].map((j, i) => vente('3156028798', 9400 + i, j)),
  // une vente ANNULÉE d'angeled92 : jamais comptée
  vente('3175765377', 9199, 10, 'Commande annulée'),
];
const BORD = new Set(['9301', '9400', '9401', '9403', '9404', '9405', '9406', '9408', '9409']);   // 9402 et 9407 sans
const RECEPTION = {
  parCompte: {
    arthuror2: { n: 3, last: jour(18) },
    jujuf38: { n: 9, last: jour(1) },                  // 9 messages arrivés (le journal)
    julatace35260: { n: 120, last: jour(1) },
  },
  bordTx: BORD,
};
const etat = (o = {}) => etatEmailsComptes(Object.assign({ comptes: COMPTES, reception: RECEPTION, ventes: VENTES, ventesKO: [], adresses: ADRESSES, exclus: [], maintenant: NOW, annulee }, o));
const ligne = (e, login) => e.lignes.find((l) => l.login === login) || {};

essaie('les trois comptes muets', () => {
  const e = etat();
  const muets = e.muets.map((l) => l.login).sort();
  dit(JSON.stringify(muets) === JSON.stringify(['angeled92', 'arthuror2', 'tomj606']),
    'angeled92, tomj606 et arthuror2 sont dits muets — et eux seuls', JSON.stringify(muets));
  const a = ligne(e, 'angeled92');
  dit(a.jamais === true && a.nSansEmail === 5 && a.premiereSansEmail === jour(40),
    'angeled92 : « jamais », 5 ventes sans email (l’annulée n’est pas comptée), depuis la plus ancienne', JSON.stringify(a));
  const t = ligne(e, 'arthuror2');
  dit(t.jamais === false && t.depuis === jour(18) && t.nSansEmail === 2,
    'arthuror2 : « plus rien depuis » son dernier signe de vie (le 23 sept. ici), 2 ventes depuis', JSON.stringify(t));
  dit(e.muets.every((l) => l.relaisApple), 'leurs adresses « Masquer mon adresse » d’Apple sont reconnues (pour dire le geste)', JSON.stringify(e.muets.map((l) => l.relaisApple)));
});
essaie('les comptes qui ne sont PAS muets', () => {
  const e = etat();
  dit(ligne(e, 'jujuf38').statut === 'recoit', 'jujuf38 (ses 9 messages arrivent, pas une ligne d’email à lui) n’est pas « aucun email »', JSON.stringify(ligne(e, 'jujuf38')));
  dit(ligne(e, 'julatace35260').statut === 'recoit', 'julatace35260 (2 bordereaux manquants sur 10, intercalés, des emails récents) n’est pas muet', ligne(e, 'julatace35260').statut);
  dit(ligne(e, 'compte_neuf').statut === 'calme', 'un compte qui n’a rien vendu et rien reçu est « calme », jamais accusé', ligne(e, 'compte_neuf').statut);
  dit(ligne(e, 'julatace35260').relaisApple === false, 'une adresse iCloud n’est pas une adresse « Masquer mon adresse »');
});
essaie('les bornes', () => {
  // Une seule vente sans email : pas un motif.
  const une = etat({ ventes: [vente('3170801262', 1, 20)], reception: { parCompte: {}, bordTx: new Set() } });
  dit(ligne(une, 'tomj606').statut !== 'muet', 'une seule vente sans email ne suffit pas', ligne(une, 'tomj606').statut);
  // Deux ventes, mais la plus ancienne n'a que 5 jours : l'email peut traîner.
  const recentes = etat({ ventes: [vente('3170801262', 1, 5), vente('3170801262', 2, 4)], reception: { parCompte: {}, bordTx: new Set() } });
  dit(ligne(recentes, 'tomj606').statut !== 'muet', 'deux ventes de moins de 7 jours : pas encore un motif', ligne(recentes, 'tomj606').statut);
  // Ventes de moins de 3 jours : jamais comptées.
  const fraiches = etat({ ventes: [vente('3170801262', 1, 2), vente('3170801262', 2, 1), vente('3170801262', 3, 0.5)], reception: { parCompte: {}, bordTx: new Set() } });
  dit(ligne(fraiches, 'tomj606').statut !== 'muet', 'des ventes de moins de 3 jours ne prouvent rien', ligne(fraiches, 'tomj606').statut);
});
essaie('pas su', () => {
  const p = etat({ reception: null });
  dit(p.etat === 'pasSu' && p.muets.length === 0, 'emails illisibles : aucun compte accusé', JSON.stringify({ etat: p.etat, n: p.muets.length }));
  const k = etat({ ventesKO: ['3175765377'] });
  dit(ligne(k, 'angeled92').statut === 'pasSu' && !k.muets.some((l) => l.login === 'angeled92'),
    'ventes d’angeled92 illisibles : on ne le juge pas (« pas su »)', ligne(k, 'angeled92').statut);
  const enCours = etat({ ventes: undefined });
  dit(enCours.muets.length === 0 && ligne(enCours, 'angeled92').statut === 'encours', 'ventes pas encore lues : rien n’est jugé', ligne(enCours, 'angeled92').statut);
  const ex = etat({ exclus: ['3170801262'] });
  dit(!ex.muets.some((l) => l.login === 'tomj606'), 'un compte exclu (son choix) n’est pas réclamé');
});
essaie('l’autre sens', () => {
  // Le compte se remet à envoyer : un bordereau arrive pour sa dernière vente.
  const r = etat({ reception: { parCompte: RECEPTION.parCompte, bordTx: new Set([...BORD, '9104']) } });
  dit(ligne(r, 'angeled92').statut === 'recoit', 'dès qu’un email arrive pour une de ses ventes (par transaction), il n’est plus muet', ligne(r, 'angeled92').statut);
});

console.log(`\n${ko ? '❌' : '✅'} ${ok} contrôle(s) au vert, ${ko} au rouge.${PROUVE ? ' (règle RÉAFFAIBLIE : doit être rouge)' : ''}`);
process.exit(ko ? 1 : 0);
