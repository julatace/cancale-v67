#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// LES BANCS PRINCIPAUX, L'UN APRÈS L'AUTRE   —   node scripts/lancer-bancs.cjs [noms…]
// ═══════════════════════════════════════════════════════════════════════════
// (6 nov., filet 1) Le lot de bancs que la vérification d'une PR rejoue sur
// `dist/` (déjà construit) : l'app RENDUE, à 390 et 1512 px, sur des données
// INVENTÉES (aucun de ces bancs ne lit `fx/`, les vraies données, jamais dans
// le dépôt public). Chaque banc reçoit son port (BANCS_PORT_BASE + rang, 10001
// par défaut) et une durée maximale ; le lanceur rend 1 si un banc est rouge.
//   BANCS_PORT_BASE   premier port (défaut 10000 : les bancs prennent 10001…)
//   BANCS_TIMEOUT_S   durée maximale d'un banc (défaut 1200 : nouveau-vendeur rend
//                     ~20 écrans × 2 largeurs × 2 thèmes, plus de 10 min sur une machine chargée)
//   NAVIGATEUR        chromium (défaut) ou webkit : passé aux bancs qui le
//                     savent (ceux qui passent par _navigateur.cjs : nouveau-vendeur,
//                     iphone-reprise, colis-retirer-propre, connexion-claire, journee-coherence,
//                     ventes-e2, retraits-suivi, tout-imprimer…)
//   BANCS_PARALLELE   (24 nov., ci-rapide) nombre de bancs À LA FOIS (défaut 1 : l'un
//                     après l'autre, comme avant). Chaque banc garde SON port (base + son
//                     rang dans la liste), SON processus, SON navigateur et SA durée maximale ;
//                     rien n'est retiré ni sauté : le même lot, les mêmes contrôles, le même
//                     bilan (dans l'ordre de la liste). Les plus longs partent d'abord
//                     (DUREES_CI). Mesuré en CI le 24 nov. : un banc passe la moitié de son
//                     temps à ATTENDRE (attentes fixes, délais de 30 s des rouges connus), pas
//                     à calculer — c'est ce temps-là que le parallèle récupère.
//   BANCS_SEULS       bancs lancés SEULS, avant les autres (défaut : aucun). Essayé le 24 nov.
//                     sur budget-vitesse : seul ou avec deux autres bancs, il rend les MÊMES
//                     lignes rouges (il est fait pour une machine de CI partagée : aucune durée
//                     jugée, chaque mesure prise sur le meilleur de 3 essais) — et seul, il
//                     gardait deux ouvriers sur trois à ne rien faire pendant 20 min.
//   nom@VAR=v1,v2     (24 nov.) un MORCEAU d'un banc : le même banc lancé avec SA variable
//                     de choix (ex. `ventes-e2@SCENARIOS=jeu,annul` et
//                     `ventes-e2@SCENARIOS=exclu,ko,egal,gros,vide`) pour en faire tourner
//                     les morceaux à la fois. Les morceaux d'un banc doivent couvrir TOUT son
//                     défaut (scripts/ci-controles.py le vérifie) ; l'exception d'un banc
//                     (audits-exceptions.json) vaut pour chacun de ses morceaux.
// Sans argument : le lot de la CI (LOT ci-dessous).
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const GARDE_RESEAU = `--require=${path.join(__dirname, 'bancs', '_garde-reseau.cjs')}`;   // (11 nov.) aucun banc ne joint un vrai serveur
const avecGarde = (e) => Object.assign({}, e, { NODE_OPTIONS: [e.NODE_OPTIONS || '', GARDE_RESEAU].join(' ').trim() });

const RACINE = path.join(__dirname, '..');
// Les parts et les durées : docs/passation/2026-11-06-filets-anti-bug.md (§1).
const LOT = ['nouveau-vendeur', 'navigation-tache', 'ventes-e2', 'colis-retirer-propre', 'statut-colis',
  'annonces-actions', 'journee-coherence', 'iphone-reprise', 'argent-mois', 'garde-ecrans', 'morceau-perime',
  'chiffres-coherents', 'retraits-suivi', 'budget-vitesse', 'accessibilite', 'accessibilite-clavier',
  'compta-export',   // (27 nov.) export comptable et URSSAF = l'écran, comptes exclus absents, « à dater » jamais comptée
  'ecran-pret-une-fois',   // (26 nov.) l'écran arrive UNE fois, jamais sous 95 % d'opacité (fondu d'entrée sous AA)
  'barre-achats',   // (16 nov.) la barre du bas : Achats dedans, aucun glisser entre onglets
  'design-v2-chargement',
  'calculs-ecran-montre',   // (24 nov.) chaque gros calcul n'est fait que par l'écran qui le lit ; publications posées
  'barre-onglets'];   // (17 nov.) les cinq styles de la barre d'onglets : onglet allumé, cibles, coupes, place gardée, contraste, réglage   // (17 nov.) nouveau design : chargement immobile (CLS ≤ 0,02) et l'AIR (marges, rangées, sections)
const noms = process.argv.slice(2).length ? process.argv.slice(2) : LOT;
const BASE = Number(process.env.BANCS_PORT_BASE) || 10000;
const TIMEOUT_MS = (Number(process.env.BANCS_TIMEOUT_S) || 1200) * 1000;
const PARALLELE = Math.max(1, Math.floor(Number(process.env.BANCS_PARALLELE) || 1));
const SEULS = String(process.env.BANCS_SEULS || '').split(/[\s,]+/).filter(Boolean);
// Durées mesurées en CI (secondes, Chromium) : un banc à la fois le 24 nov. au matin (runs
// 45351147777, 45347995549, 45346082002), puis 3 à la fois (run 45368327532 : accessibilite
// 1158 s, budget-vitesse arrêté à 1200 s — ni l'un ni l'autre n'avait fini depuis des jours,
// la part 2/3 était annulée avant). Ne servent qu'à l'ORDRE de départ (les plus longs
// d'abord) ; un banc absent compte pour 120 s. Aucune ne borne ni ne juge un banc.
const DUREES_CI = {
  'budget-vitesse': 1200, 'accessibilite': 1158, 'ventes-e2': 1710, 'navigation-tache': 754, 'argent-mois': 577,
  'accessibilite-clavier': 370, 'chiffres-coherents': 365, 'defilement-navigation': 311, 'nouveau-vendeur': 294,
  'ventes-ligne-propre': 276, 'imprimer-compte-exact': 233, 'iphone-reprise': 179, 'annonces-actions': 173,
  'morceau-perime': 170, 'barre-achats': 141, 'statut-colis': 119, 'journee-coherence': 107, 'garde-ecrans': 59,
  'colis-retirer-propre': 54, 'achats-annules': 48, 'retraits-suivi': 44, 'tout-imprimer': 27, 'connexion-claire': 16,
  'barre-depuis-journee': 15,
  'ecran-pret-une-fois': 80,   // (26 nov.) mesuré ici, seul : 77 s
  'compta-export': 240,   // (27 nov.) mesuré ici, seul : ~4 min (4 tailles × thèmes)
};
// Les bancs ROUGES CONNUS (scripts/audits-exceptions.json, clé `bancs`) : chacun dit
// SES lignes rouges connues (`rouges`, une expression régulière sur la ligne). Le banc
// est « rouge connu » seulement si TOUTES ses lignes rouges y répondent : une ligne
// rouge NOUVELLE le rend rouge pour de bon. Vert ⇒ « exception à retirer ».
const EXC = (() => {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'audits-exceptions.json'), 'utf8'));
    const out = {};
    for (const e of (Array.isArray(j.bancs) ? j.bancs : [])) {
      if (!e || !e.banc || !e.raison || !e.depuis || !e.rouges) throw new Error('exception de banc mal formée (banc, raison, depuis, rouges) : ' + JSON.stringify(e));
      out[e.banc] = Object.assign({}, e, { re: new RegExp(e.rouges) });
    }
    return out;
  } catch (e) { if (e && /mal formée/.test(e.message)) throw e; return {}; }
})();
const lignesRouges = (sortie) => sortie.split('\n').map((l) => l.replace(/^\s+/, ''))
  .filter((l) => /^(❌|KO)\s/.test(l) && !/défaut\(s\)|rouge\(s\)|échec\(s\)|contrôle\(s\)|banc\(s\)/.test(l))
  .map((l) => l.replace(/^(❌|KO)\s+/, ''));

// « ventes-e2@SCENARIOS=jeu,annul » ⇒ { banc: 'ventes-e2', env: { SCENARIOS: 'jeu,annul' } }.
const morceau = (nom) => {
  const m = /^([a-z0-9-]+)@([A-Z][A-Z0-9_]*)=([^@\s]+)$/.exec(nom);
  return m ? { banc: m[1], env: { [m[2]]: m[3] } } : { banc: nom, env: {} };
};
function lancer(nom, port) {
  return new Promise((resolve) => {
    const debut = Date.now();
    const { banc, env: envMorceau } = morceau(nom);
    const fichier = path.join(RACINE, 'scripts', 'bancs', banc + '.cjs');
    if (!fs.existsSync(fichier)) { resolve({ nom, code: 2, ms: 0, sortie: 'banc introuvable : ' + fichier }); return; }
    const enfant = spawn(process.execPath, [fichier], {
      cwd: RACINE, env: avecGarde(Object.assign({}, process.env, envMorceau, { BANC_PORT: String(port), PORT: String(port) })), stdio: ['ignore', 'pipe', 'pipe'], detached: true,
    });
    let sortie = '';
    // (24 nov.) Ligne par ligne : plusieurs bancs à la fois écrivent dans le même journal,
    // chaque ligne garde son préfixe entier (le bilan, lui, relit `sortie`, intacte).
    const restes = { out: '', err: '' };
    const garder = (qui) => (b) => {
      const t = b.toString(); sortie += t;
      const tout = restes[qui] + t; const lignes = tout.split('\n'); restes[qui] = lignes.pop();
      if (lignes.length) process.stdout.write(lignes.map((l) => `[${nom}] ${l}\n`).join(''));
    };
    enfant.stdout.on('data', garder('out')); enfant.stderr.on('data', garder('err'));
    let tropLong = false;
    const minuteur = setTimeout(() => { tropLong = true; try { process.kill(-enfant.pid, 'SIGKILL'); } catch (_) {} }, TIMEOUT_MS);
    enfant.on('close', (code) => {
      clearTimeout(minuteur);
      for (const q of ['out', 'err']) if (restes[q]) { process.stdout.write(`[${nom}] ${restes[q]}\n`); restes[q] = ''; }
      resolve({ nom, code, tropLong, ms: Date.now() - debut, sortie });
    });
  });
}

(async () => {
  // Chaque banc garde le port de SON rang dans la liste (comme avant), quel que soit l'ordre de départ.
  const taches = noms.map((nom, k) => ({ nom, port: BASE + k + 1, k }));
  // Durée attendue d'un morceau : celle du banc entier, partagée entre ses morceaux.
  const nMorceaux = {}; for (const t of taches) { const b = morceau(t.nom).banc; nMorceaux[b] = (nMorceaux[b] || 0) + 1; }
  const duree = (t) => { const b = morceau(t.nom).banc; return (DUREES_CI[b] || 120) / nMorceaux[b]; };
  const res = new Array(taches.length);
  const debutLot = Date.now();
  const seuls = PARALLELE > 1 ? taches.filter((t) => SEULS.includes(t.nom)) : [];
  const file = taches.filter((t) => !seuls.includes(t))
    .sort((a, b) => PARALLELE > 1 ? (duree(b) - duree(a)) || (a.k - b.k) : a.k - b.k);
  if (PARALLELE > 1) console.log(`${taches.length} banc(s), ${PARALLELE} à la fois${seuls.length ? ` (seul(s) d'abord : ${seuls.map((t) => t.nom).join(', ')})` : ''}.`);
  // (24 nov.) Combien le processeur a travaillé pendant le lot (Linux, /proc/stat) : la mesure
  // qui dit si l'on peut lancer plus de bancs à la fois sans les ralentir. Rien n'en dépend.
  const lireCpu = () => { try { const v = fs.readFileSync('/proc/stat', 'utf8').split('\n')[0].trim().split(/\s+/).slice(1).map(Number); const idle = v[3] + (v[4] || 0); return { tout: v.reduce((a, b) => a + b, 0), idle }; } catch (_) { return null; } };
  const cpu0 = lireCpu(); let chargeMax = 0;
  const sonde = setInterval(() => { try { chargeMax = Math.max(chargeMax, Number(fs.readFileSync('/proc/loadavg', 'utf8').split(' ')[0]) || 0); } catch (_) {} }, 15000);
  for (const t of seuls) res[t.k] = await lancer(t.nom, t.port);
  let j = 0;
  const ouvrier = async () => { while (j < file.length) { const t = file[j++]; res[t.k] = await lancer(t.nom, t.port); } };
  await Promise.all(Array.from({ length: Math.min(PARALLELE, file.length) || 0 }, ouvrier));
  console.log('\n── Bilan des bancs' + (process.env.NAVIGATEUR ? ` (${process.env.NAVIGATEUR})` : ''));
  for (const r of res) {
    const vert = r.code === 0 && !r.tropLong;
    const exc = EXC[r.nom] || EXC[morceau(r.nom).banc];
    const rouges = vert ? [] : lignesRouges(r.sortie);
    r.connu = !vert && !r.tropLong && exc && rouges.length > 0 && rouges.every((l) => exc.re.test(l));
    console.log(`${vert ? 'OK ' : r.connu ? 'KO*' : 'KO '} ${r.nom.padEnd(24)} ${(r.ms / 1000).toFixed(0).padStart(4)} s${r.tropLong ? ' (arrêté : trop long)' : r.code ? ` (code ${r.code})` : ''}`);
    if (r.connu) console.log(`     rouge connu (${rouges.length} ligne(s)) — ${exc.raison} (depuis le ${exc.depuis})`);
    else if (!vert && exc) console.log(`     ⚠️ des lignes rouges NOUVELLES, hors de l'exception : ${rouges.filter((l) => !exc.re.test(l)).slice(0, 3).join(' ¦ ')}`);
    const toutVert = res.filter((x) => morceau(x.nom).banc === morceau(r.nom).banc).every((x) => x.code === 0 && !x.tropLong);
    if (vert && exc && toutVert) console.log(`     ⚠️ exception à retirer de scripts/audits-exceptions.json : ${r.nom} est VERT`);
  }
  clearInterval(sonde);
  const cpu1 = lireCpu();
  const occupe = cpu0 && cpu1 && cpu1.tout > cpu0.tout ? Math.round(100 * (1 - (cpu1.idle - cpu0.idle) / (cpu1.tout - cpu0.tout))) : null;
  console.log(`   (lot : ${((Date.now() - debutLot) / 1000).toFixed(0)} s du premier départ au dernier banc, ${PARALLELE} à la fois ; processeur occupé ${occupe == null ? '—' : occupe + ' %'} en moyenne sur ${require('os').cpus().length} cœurs, charge max ${chargeMax.toFixed(1)})`);
  const ko = res.filter((r) => (r.code !== 0 || r.tropLong) && !r.connu);
  console.log(ko.length ? `\n❌ ${ko.length} banc(s) rouge(s) : ${ko.map((r) => r.nom).join(', ')}` : '\n✅ tous les bancs du lot passent.');
  process.exit(ko.length ? 1 : 0);
})();
