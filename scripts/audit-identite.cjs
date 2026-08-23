#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// « Même si j'ai 50 fois le même article avec la même couleur, la même taille et
//   la même description, tu ne dois pas pouvoir te tromper. » — Julien
//
// Ce script pose exactement ce scénario : 50 paires RIGOUREUSEMENT identiques
// (même titre, même taille, même couleur, même description), et vérifie que
// AUCUNE règle de rapprochement ne désigne l'une d'elles. La bonne réponse est
// toujours « rien » : mieux vaut un blanc qu'un faux.
//
// Lecture seule, aucune donnée réelle, aucun appel réseau. À relancer après
// toute modification d'une règle qui relie deux choses entre elles.
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');

const TITRE = 'adidas spezial noir taille 38';
const N = 50;

let ko = 0;
const ok  = (nom, d) => console.log(`✅ ${nom}${d ? ' — ' + d : ''}`);
const nok = (nom, d) => { ko++; console.log(`❌ ${nom}${d ? ' — ' + d : ''}`); };

// ── 1) Aucun helper de rapprochement par titre ne doit SUBSISTER dans le code.
//      Un helper inutilisé est un piège : la session suivante le rebranche.
{
  const interdits = ['entryByTitleLoose', 'entryByTitle', 'entryKeyByTitle', 'keyOfEntry'];
  const vus = interdits.filter(n => new RegExp(`(const|function)\\s+${n}\\b`).test(SRC));
  vus.length ? nok('aucun helper « trouve la paire par son titre »', 'encore présent : ' + vus.join(', '))
             : ok('aucun helper « trouve la paire par son titre »');
}

// ── 2) Le rapprochement colis ↔ achat doit rendre NULL quand le titre est partagé.
{
  const bout = (nom) => {
    const d = SRC.indexOf(`const ${nom} = (`);
    if (d < 0) return null;
    const f = SRC.indexOf('\n  };', d) + 4;
    return SRC.slice(d, f);
  };
  const uniq = SRC.slice(SRC.indexOf('const unique = ('), SRC.indexOf('const buyForTrack'));
  const code = `const normTitle = (t) => (t || '').toLowerCase().replace(/\\s+/g, ' ').trim();
    ${uniq}
    const buysBase = ACHATS, tracking = COLIS;
    ${bout('buyForTrack')}
    ${bout('trackForBuy')}
    return { buyForTrack, trackForBuy };`;
  const faire = new Function('ACHATS', 'COLIS', code);

  // 50 achats identiques + 50 colis identiques
  const ACHATS = Array.from({ length: N }, (_, i) => ({ transaction_id: 1000 + i, title: TITRE }));
  const COLIS  = Array.from({ length: N }, (_, i) => ({ suivi: 'S' + i, artTitle: TITRE, code: String(100000 + i) }));
  const f = faire(ACHATS, COLIS);
  f.buyForTrack(COLIS[0]) === null
    ? ok(`achat d'un colis parmi ${N} identiques`, 'aucun choix (correct)')
    : nok(`achat d'un colis parmi ${N} identiques`, 'une paire a été désignée AU HASARD');
  f.trackForBuy(ACHATS[0]) === null
    ? ok(`colis d'un achat parmi ${N} identiques`, 'aucun choix (correct)')
    : nok(`colis d'un achat parmi ${N} identiques`, 'un colis a été désigné AU HASARD');

  // Contrôle inverse : avec UN SEUL exemplaire, le rapprochement doit marcher —
  // un garde-fou qui bloque tout serait pire que le défaut qu'il corrige.
  const g = faire([{ transaction_id: 7, title: TITRE }], [{ suivi: 'X', artTitle: TITRE }]);
  const seul = g.buyForTrack({ artTitle: TITRE });
  seul && seul.transaction_id === 7
    ? ok('paire UNIQUE : le rapprochement fonctionne encore')
    : nok('paire UNIQUE : le rapprochement fonctionne encore', 'il ne trouve plus rien');
}

// ── 3) Les fonctions d'identité ne doivent JAMAIS retomber sur le titre.
{
  const zone = (nom) => {
    const d = SRC.indexOf(`const ${nom} = (`);
    if (d < 0) return '';
    return SRC.slice(d, d + 1400);
  };
  for (const nom of ['identiteAnnonce', 'resolvedEntry']) {
    const z = zone(nom);
    if (!z) { nok(`${nom} présente`); continue; }
    // On ignore les commentaires : ils PARLENT du titre pour expliquer le refus.
    const code = z.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
    /normTitle|byTitle|ByTitle/.test(code)
      ? nok(`${nom} n'utilise aucun titre`, 'un rapprochement par titre a été réintroduit')
      : ok(`${nom} n'utilise aucun titre`);
  }
}

// ── 4) La reprise de numéro après republication doit refuser l'ambiguïté.
{
  const d = SRC.indexOf('const cands = orphans.filter');
  const bloc = d < 0 ? '' : SRC.slice(d, d + 1200);
  /cands\.length === 1/.test(SRC.slice(d, d + 2000))
    ? ok('reprise de N° : refuse dès qu\'il y a plusieurs candidats')
    : nok('reprise de N° : refuse dès qu\'il y a plusieurs candidats');
  /photoDir\(/.test(bloc)
    ? ok('reprise de N° : la photo (identité) passe avant le titre')
    : nok('reprise de N° : la photo (identité) passe avant le titre');
}

// ── 5) LES QUATRE CHEMINS QUE JULIEN A NOMMÉS ────────────────────────────────
//     « une vente, un litige, une mise en ligne, une annulation de commande ».
//     Pour chacun : d'où vient l'identité de la paire, et est-ce une identité ?
{
  // VENTE + LITIGE + ANNULATION passent tous par la MÊME porte : `effEntry(o)`
  // → `resolvedEntry(o)` → `identiteAnnonce(o)` (id Vinted, sinon photo).
  // Le contrôle 3 ci-dessus a déjà prouvé qu'aucune n'utilise de titre. Ici on
  // vérifie que les écrans litige/annulation ne rouvrent pas une autre porte.
  const zoneLitige = SRC.slice(SRC.indexOf('const saleOutcome'), SRC.indexOf('const saleOutcome') + 900);
  /normTitle|ByTitle/.test(zoneLitige.split('\n').filter(l => !l.trim().startsWith('//')).join('\n'))
    ? nok('litige / annulation : aucune identification par titre')
    : ok('litige / annulation : aucune identification par titre', 'passe par effEntry');

  // Le numéro affiché sur une vente annulée/en litige vient de `effEntry`, pas
  // d'un rapprochement local : on vérifie qu'aucun `entryBy...(o.title)` ne
  // subsiste dans l'écran Ventes.
  /entryBy\w*\(\s*o\.title/.test(SRC)
    ? nok('écran Ventes : aucun « retrouve la paire par o.title »')
    : ok('écran Ventes : aucun « retrouve la paire par o.title »');

  // MISE EN LIGNE : la numérotation s'écrit dans `vinted_annonce_numeros`, qui
  // est indexé par ID D'ANNONCE — `updatePair(item, …)` utilise `item.id`.
  /const u = \{ \.\.\.prev \}; const c = u\[item\.id\]/.test(SRC)
    ? ok('mise en ligne : le numéro est écrit par ID d\'annonce', 'pas par titre')
    : nok('mise en ligne : le numéro est écrit par ID d\'annonce');

  // AUTO-RETRAIT d'une annonce en ligne d'après un email de vente : c'est le
  // SEUL chemin qui utilise encore titre+taille (un email ne porte pas d'id).
  // Il DOIT refuser dès que deux paires partagent la clé.
  /ambiguousKey\.has\(k\)\) continue;/.test(SRC)
    ? ok('auto-retrait d\'une annonce (email) : refuse titre+taille en double')
    : nok('auto-retrait d\'une annonce (email) : refuse titre+taille en double');

  // BORDEREAU ↔ annonce par titre : doit refuser un titre ambigu.
  /if \(!n \|\| titleAmbiguous\(title\)\) return null;/.test(SRC)
    ? ok('bordereau ↔ annonce : refuse un titre porté par plusieurs paires')
    : nok('bordereau ↔ annonce : refuse un titre porté par plusieurs paires');

  // AUDIT DU STOCK : ne doit plus masquer une paire parce qu'une VENTE porte le
  // même titre (sinon une paire perdue passe inaperçue).
  /vendus\.has\('t:'/.test(SRC)
    ? nok('audit du stock : aucune paire masquée à cause d\'un titre identique')
    : ok('audit du stock : aucune paire masquée à cause d\'un titre identique');

  // VINTED NE SUPPRIME PAS UNE ANNONCE VENDUE : il la ferme en « sold ». C'est la
  // preuve PAR IDENTIFIANT qu'une paire est partie — elle doit remplacer le titre.
  /venduChezVinted = \(it\) =>/.test(SRC) && /item_closing_action/.test(SRC)
    ? ok('« vendue » lue chez Vinted (item_closing_action), pas devinée')
    : nok('« vendue » lue chez Vinted (item_closing_action), pas devinée');
  /venduesVinted\.has\(String\(k\)\)\) continue;/.test(SRC)
    ? ok('audit du stock : une paire vendue est écartée PAR IDENTIFIANT')
    : nok('audit du stock : une paire vendue est écartée PAR IDENTIFIANT');
}

// ── 6) UN NUMÉRO N'EST JAMAIS RÉATTRIBUÉ ─────────────────────────────────────
//     « Il faut que les chaussures vendues gardent quand même leur numéro pour
//      ne pas qu'il y ait d'erreur… si je me prends un retour en litige, je
//      pourrai attribuer le numéro à la paire. » — Julien
//     Rendre un numéro au pot, c'est risquer que deux paires le portent : la
//     première peut revenir. Mesuré : 13 numéros portés par plusieurs paires,
//     le N°4 par quatre.
{
  /const freedNums = useMemo/.test(SRC)
    ? nok('aucun numéro n\'est rendu au pot', '`freedNums` est de retour')
    : ok('aucun numéro n\'est rendu au pot');
  // Personne ne doit RETIRER d'entrée de la mémoire des numéros utilisés.
  const retraits = SRC.split('\n').filter(l =>
    /vinted_used_numeros/.test(l) && /\.filter\(/.test(l) && !l.trim().startsWith('//'));
  retraits.length
    ? nok('la mémoire des numéros ne perd jamais d\'entrée', retraits.length + ' filtre(s) la réduisent encore')
    : ok('la mémoire des numéros ne perd jamais d\'entrée');
}

// ── 7) UNE PAIRE VENDUE NE REPREND JAMAIS SON NUMÉRO TOUTE SEULE ─────────────
//     « Si c'est une annulation et qu'on appuie sur republier dans Vinted [le
//      numéro reste] ; et si c'est un litige, qu'on reçoit la paire et qu'on la
//      reposte nous-mêmes, là il faut prendre un nouveau numéro. » — Julien
//     Les deux se ressemblent (l'annonce redevient en ligne) ; ce qui les sépare,
//     c'est qu'une VENTE existe. Mesuré le 22 août : lire `vinted_txn_link` ne
//     suffit pas — le verrou ne se pose que sur les ventes FINALISÉES, donc les
//     3 paires en litige (N°115, N°169, N°167) et 18 des 58 paires vendues
//     auraient repris leur ancien numéro.
{
  /const pairesVendues = useMemo/.test(SRC) && /identiteAnnonce\(o\); if \(k\) set\.add/.test(SRC)
    ? ok('une paire vendue est écartée de la reprise auto (identité certaine)')
    : nok('une paire vendue est écartée de la reprise auto (identité certaine)');
  // Le drapeau vient de `pairesVendues` (toutes les ventes), et l'effet
  // automatique doit le SAUTER : une paire vendue ne reprend jamais son numéro
  // sans un geste de l'utilisateur.
  /vendue: pairesVendues\.has\(String\(k\)\)/.test(SRC)
    ? ok('la reprise marque les paires vendues (toutes les ventes, pas que les finalisées)')
    : nok('la reprise marque les paires vendues (toutes les ventes, pas que les finalisées)',
          'elle repart de `txnLink`, qui ignore litiges et remboursements');
  // ⚠️ Ce contrôle a changé de forme le 23 août : la reprise n'est PLUS
  // automatique du tout (§9 ci-dessous), donc « elle saute les paires vendues »
  // n'a plus d'objet — la garantie est plus forte. Ce qui doit rester vrai,
  // c'est que le drapeau `vendue` est toujours calculé et affiché à Julien
  // avant qu'il ne tape (avertissement du bandeau ♻️).
  /r\.vendue/.test(SRC) && /a été VENDUE sous le N°/.test(SRC)
    ? ok('une paire vendue est signalée avant toute reprise de son numéro')
    : nok('une paire vendue est signalée avant toute reprise de son numéro');
  // Saisie manuelle : un numéro déjà porté par une paire PRÉSENTE doit être refusé.
  /const poserNumero = async/.test(SRC) && /porteursNum\[n\] \|\| \[\]/.test(SRC)
    ? ok('changer un N° à la main : refus si une paire le porte encore')
    : nok('changer un N° à la main : refus si une paire le porte encore');
}

// ── 8) UN NUMÉRO POSÉ NE BOUGE PLUS TOUT SEUL ───────────────────────────────
//     Julien : « sois sûr que les numéros attribués aux paires de chaussures ne
//     bougent plus jamais parce que je vais commencer à les mettre dans les
//     boîtes. » Deux garanties, et elles doivent tenir dans le code :
//     a) la reprise automatique ne touche jamais une paire RANGÉE AU GARAGE
//        (le numéro y est écrit sur un carton réel) ;
//     b) le champ N° ne valide qu'à la SORTIE du champ, jamais à chaque frappe —
//        sinon taper « 20 » posait d'abord le N°2 sur la paire (et brûlait ce
//        numéro au passage).
{
  /\(porteursNum\[String\(cur\.numero\)\] \|\| \[\]\)\.some\(x => x\.type === 'garage'\)/.test(SRC)
    ? ok('la reprise auto ne touche jamais une paire rangée au garage')
    : nok('la reprise auto ne touche jamais une paire rangée au garage',
          'une paire déjà dans sa boîte peut encore changer de numéro toute seule');
  // Le champ N° / prix d'achat / boost doit passer par `ChampSaisie` (validation
  // à la sortie). Un `onChange` qui appelle `updatePair` ou `poserNumero`
  // écrirait à chaque caractère.
  const frappe = SRC.split('\n').filter(l =>
    /<input /.test(l) && /onChange=\{ev=>(updatePair|poserNumero|setSaleOverride)\(/.test(l));
  frappe.length
    ? nok('aucun champ N°/prix n\'écrit à chaque frappe', frappe.length + ' champ(s) écrivent encore lettre par lettre')
    : ok('aucun champ N°/prix n\'écrit à chaque frappe');
  /function ChampSaisie\(/.test(SRC) && /onKeyDown=\{ev => \{[\s\S]{0,400}?ev\.key === 'Enter'[\s\S]{0,120}?blur\(\)/.test(SRC)
    ? ok('la saisie se valide sur Entrée ou à la sortie du champ')
    : nok('la saisie se valide sur Entrée ou à la sortie du champ');
  // Et c'est `poserNumero` — donc après les contrôles — qui écrit le numéro.
  /if \(!autres\.length\) \{ updatePair\(item, \{ numero: n \}\); recordUsed\(n\); return; \}/.test(SRC)
    ? ok('le numéro n\'est écrit qu\'après les contrôles de collision')
    : nok('le numéro n\'est écrit qu\'après les contrôles de collision');
}

// ── 9) UN NUMÉRO NE BOUGE PLUS JAMAIS TOUT SEUL, ET AUCUNE PAIRE N'EN MANQUE ──
//     Julien, 23 août : « es-tu sûr que les numéros attribués aux chaussures ne
//     changeront jamais, même si on modifie des choses dans le site ? Et je veux
//     forcément qu'elle ait un numéro : dès qu'elle est postée, elle doit en
//     avoir un. »
//     Mesuré ce jour-là : 194 des 209 paires portaient un numéro posé
//     automatiquement et AUCUNE n'était rangée au garage — la reprise
//     automatique pouvait donc encore toutes les changer.
{
  // a) la reprise de numéro ne s'exécute plus toute seule
  /LA REPRISE DE NUMÉRO N'EST PLUS AUTOMATIQUE/.test(SRC) && !/for \(const r of numeroReprises\) \{/.test(SRC)
    ? ok('aucun effet ne réécrit un numéro tout seul (la reprise est proposée, pas appliquée)')
    : nok('aucun effet ne réécrit un numéro tout seul',
          'un effet applique encore `numeroReprises` sans geste de l\'utilisateur');
  // b) plus aucun bouton n'ouvre la renumérotation EN MASSE
  /setRenumOpen\(true\)/.test(SRC)
    ? nok('aucun bouton ne lance une renumérotation en masse', 'le menu ⋯ Outils ouvre encore la modale')
    : ok('aucun bouton ne lance une renumérotation en masse');
  // c) toute annonce EN LIGNE reçoit un numéro — comptes masqués compris
  // ⚠️ On ancre sur le commentaire + la ligne : `const items = (listings.items…)`
  // existe ailleurs dans le fichier, donc le tester seul donnait un faux vert.
  /TOUTE ANNONCE EN LIGNE DOIT AVOIR UN NUMÉRO[\s\S]{0,900}?const items = \(listings\.items \|\| \[\]\);/.test(SRC)
    ? ok('la numérotation couvre TOUTES les annonces en ligne (comptes masqués compris)')
    : nok('la numérotation couvre TOUTES les annonces en ligne',
          'elle part encore d\'`annBase`, qui écarte les comptes masqués');
  // d) elle n'est pas désactivable
  /const autoNum = true;/.test(SRC) && !/setAutoNum\(/.test(SRC)
    ? ok('la numérotation ne peut pas être désactivée')
    : nok('la numérotation ne peut pas être désactivée', 'un interrupteur peut encore la couper');
}

// ─────────────────────────────────────────────────────────────────────────────
// 9) LE SÉLECTEUR D'ACHAT ET LES PAIRES BICOLORES
//    Mesuré le 23 août sur les 212 paires numérotées et 318 achats : une paire
//    dont le titre porte DEUX couleurs (« noir et violet ») rendait
//    `extractColor` nul, ce qui neutralisait le test de couleur — bonus ET
//    pénalité. Deux paires sur les dix premières recevaient donc la pastille
//    « suggéré » pour un achat d'une AUTRE couleur, pile au seuil de 12 :
//      « Nike zoom fly 5 noir violet 41 » ← « Nike zoom fly 5 maat 41 ORANJE »
//      « Adidas Spezial noir et vert 38 » ← « Adidas Spezial BLU n. 38 »
//    Un prix d'achat faux ne se voit jamais : il produit une marge crédible.
{
  // a) la lecture « toutes les couleurs » existe
  /function extractColors\(text\)\{/.test(SRC)
    ? ok('les couleurs d\'un titre sont lues en ENSEMBLE (paires bicolores)')
    : nok('les couleurs d\'un titre sont lues en ensemble',
          'seule `extractColor` existe : un titre bicolore ne rend rien, donc plus aucun test de couleur');
  // b) le score du sélecteur compare des ensembles, plus une couleur unique
  /const couleursRef = extractColors\(item\?\.title\)/.test(SRC)
    && /const cs = extractColors\(t\);[\s\S]{0,260}?couleursRef\.includes\(c\)/.test(SRC)
    ? ok('le sélecteur d\'achat compare des ensembles de couleurs')
    : nok('le sélecteur d\'achat compare des ensembles de couleurs',
          'il compare encore une couleur unique : une paire bicolore désactive le test');
  // c) l'ancienne comparaison une-couleur-contre-une-couleur a bien disparu du score
  /couleurRef && co && co !== couleurRef/.test(SRC)
    ? nok('l\'ancien test de couleur unique a disparu du score', 'il est encore là')
    : ok('l\'ancien test de couleur unique a disparu du score');
}

// ─────────────────────────────────────────────────────────────────────────────
// 10) L'APP LIT TOUTES LES LIGNES, PAS LES 1 000 PREMIÈRES
//     Supabase (PostgREST) plafonne SILENCIEUSEMENT une réponse à 1 000 lignes.
//     Mesuré le 23 août : 2 447 lignes en base, dont 1 127 `harvest_*` et
//     1 211 `email_*`. Les lectures par préfixe qui les dépassent doivent
//     paginer, sinon c'est toujours la même fin de liste qui manque —
//     pour `email_*`, ce sont les `email_track_*`, donc les COLIS.
{
  const capables = [
    ["id=like.harvest_*&select=id,updated_at,cap:data->>capturedAt", 'fraîcheur des comptes'],
    ["id=like.${motif}&select=id,updated_at,cap:data->>capturedAt", 'dernier email / dernière capture'],
  ];
  let mauvais = [];
  for (const [q, nom] of capables) {
    const i = SRC.indexOf(q);
    if (i < 0) { mauvais.push(nom + ' (requête introuvable)'); continue; }
    // la ligne doit passer par lireTout, pas par un fetch nu
    const ligne = SRC.slice(Math.max(0, i - 260), i + q.length + 40);
    if (!/lireTout\(/.test(ligne)) mauvais.push(nom);
  }
  mauvais.length
    ? nok('les lectures de plus de 1 000 lignes paginent', 'sans pagination : ' + mauvais.join(', '))
    : ok('les lectures de plus de 1 000 lignes paginent');
  /const lireTout = async \(query, opts = \{\}\)/.test(SRC) && /Range: `\$\{from\}-\$\{from \+ PAGE_SB - 1\}`/.test(SRC)
    ? ok('le helper de pagination existe et utilise l\'en-tête Range')
    : nok('le helper de pagination existe', '`lireTout` absent ou ne pagine pas');
}

// ─────────────────────────────────────────────────────────────────────────────
// 11) `updated_at` NE MENT PLUS
//     `app_data` n'a aucun trigger : sans estampille explicite, la colonne garde
//     la date de CRÉATION. Mesuré : 9 des 10 écritures de l'app l'omettaient,
//     et `widget_stats` affichait « 21 juillet » pour une donnée du jour même.
{
  /const withOwner = \(row\) => \{[\s\S]{0,400}?updated_at: new Date\(\)\.toISOString\(\)/.test(SRC)
    ? ok('toute ligne écrite est estampillée `updated_at`')
    : nok('toute ligne écrite est estampillée `updated_at`',
          '`withOwner` ne pose pas la date : la colonne gardera la date de création');
}

console.log(ko ? `\n${ko} règle(s) peuvent se tromper.` : '\nAucune règle ne peut désigner la mauvaise paire.');
process.exit(ko ? 1 : 0);
