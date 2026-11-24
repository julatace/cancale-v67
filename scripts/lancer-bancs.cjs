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
//   BANCS_SEULS       bancs lancés SEULS, avant les autres (défaut : budget-vitesse, qui
//                     compte des lectures « jusqu'au calme » : un processeur partagé pourrait
//                     changer l'ordre d'arrivée des réponses).
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
  'barre-achats',   // (16 nov.) la barre du bas : Achats dedans, aucun glisser entre onglets
  'design-v2-chargement',
  'barre-onglets'];   // (17 nov.) les cinq styles de la barre d'onglets : onglet allumé, cibles, coupes, place gardée, contraste, réglage   // (17 nov.) nouveau design : chargement immobile (CLS ≤ 0,02) et l'AIR (marges, rangées, sections)
const noms = process.argv.slice(2).length ? process.argv.slice(2) : LOT;
const BASE = Number(process.env.BANCS_PORT_BASE) || 10000;
const TIMEOUT_MS = (Number(process.env.BANCS_TIMEOUT_S) || 1200) * 1000;
const PARALLELE = Math.max(1, Math.floor(Number(process.env.BANCS_PARALLELE) || 1));
const SEULS = String(process.env.BANCS_SEULS == null ? 'budget-vitesse' : process.env.BANCS_SEULS).split(/[\s,]+/).filter(Boolean);
// Durées mesurées en CI (secondes, Chromium, un banc à la fois, 24 nov. — runs 45351147777,
// 45347995549, 45346082002). Ne servent qu'à l'ORDRE de départ (les plus longs d'abord) ;
// un banc absent compte pour 120 s. Aucune ne borne ni ne juge un banc.
const DUREES_CI = {
  'ventes-e2': 1160, 'navigation-tache': 721, 'argent-mois': 566, 'chiffres-coherents': 357, 'accessibilite-clavier': 346,
  'accessibilite': 340, 'budget-vitesse': 309, 'defilement-navigation': 249, 'imprimer-compte-exact': 246, 'nouveau-vendeur': 226,
  'statut-colis': 226, 'ventes-ligne-propre': 202, 'annonces-actions': 174, 'iphone-reprise': 153, 'morceau-perime': 124,
  'journee-coherence': 117, 'achats-annules': 104, 'garde-ecrans': 98, 'colis-retirer-propre': 51, 'retraits-suivi': 47,
  'tout-imprimer': 27, 'connexion-claire': 16, 'barre-depuis-journee': 15,
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

function lancer(nom, port) {
  return new Promise((resolve) => {
    const debut = Date.now();
    const fichier = path.join(RACINE, 'scripts', 'bancs', nom + '.cjs');
    if (!fs.existsSync(fichier)) { resolve({ nom, code: 2, ms: 0, sortie: 'banc introuvable : ' + fichier }); return; }
    const enfant = spawn(process.execPath, [fichier], {
      cwd: RACINE, env: avecGarde(Object.assign({}, process.env, { BANC_PORT: String(port), PORT: String(port) })), stdio: ['ignore', 'pipe', 'pipe'], detached: true,
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
  const res = new Array(taches.length);
  const debutLot = Date.now();
  const seuls = PARALLELE > 1 ? taches.filter((t) => SEULS.includes(t.nom)) : [];
  const file = taches.filter((t) => !seuls.includes(t))
    .sort((a, b) => PARALLELE > 1 ? ((DUREES_CI[b.nom] || 120) - (DUREES_CI[a.nom] || 120)) || (a.k - b.k) : a.k - b.k);
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
    const exc = EXC[r.nom];
    const rouges = vert ? [] : lignesRouges(r.sortie);
    r.connu = !vert && !r.tropLong && exc && rouges.length > 0 && rouges.every((l) => exc.re.test(l));
    console.log(`${vert ? 'OK ' : r.connu ? 'KO*' : 'KO '} ${r.nom.padEnd(24)} ${(r.ms / 1000).toFixed(0).padStart(4)} s${r.tropLong ? ' (arrêté : trop long)' : r.code ? ` (code ${r.code})` : ''}`);
    if (r.connu) console.log(`     rouge connu (${rouges.length} ligne(s)) — ${exc.raison} (depuis le ${exc.depuis})`);
    else if (!vert && exc) console.log(`     ⚠️ des lignes rouges NOUVELLES, hors de l'exception : ${rouges.filter((l) => !exc.re.test(l)).slice(0, 3).join(' ¦ ')}`);
    if (vert && exc) console.log(`     ⚠️ exception à retirer de scripts/audits-exceptions.json : ${r.nom} est VERT`);
  }
  clearInterval(sonde);
  const cpu1 = lireCpu();
  const occupe = cpu0 && cpu1 && cpu1.tout > cpu0.tout ? Math.round(100 * (1 - (cpu1.idle - cpu0.idle) / (cpu1.tout - cpu0.tout))) : null;
  console.log(`   (lot : ${((Date.now() - debutLot) / 1000).toFixed(0)} s du premier départ au dernier banc, ${PARALLELE} à la fois ; processeur occupé ${occupe == null ? '—' : occupe + ' %'} en moyenne sur ${require('os').cpus().length} cœurs, charge max ${chargeMax.toFixed(1)})`);
  const ko = res.filter((r) => (r.code !== 0 || r.tropLong) && !r.connu);
  console.log(ko.length ? `\n❌ ${ko.length} banc(s) rouge(s) : ${ko.map((r) => r.nom).join(', ')}` : '\n✅ tous les bancs du lot passent.');
  process.exit(ko.length ? 1 : 0);
})();
