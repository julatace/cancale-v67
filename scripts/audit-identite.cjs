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

console.log(ko ? `\n${ko} règle(s) peuvent se tromper.` : '\nAucune règle ne peut désigner la mauvaise paire.');
process.exit(ko ? 1 : 0);
