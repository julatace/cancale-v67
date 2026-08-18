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

console.log(ko ? `\n${ko} règle(s) peuvent se tromper.` : '\nAucune règle ne peut désigner la mauvaise paire.');
process.exit(ko ? 1 : 0);
