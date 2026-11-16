// ════════════════════════════════════════════════════════════════════════════
//  GARDE-FOU PERMANENT : 20 000 VENTES, MA JOURNÉE ET VENTES EN MOINS DE 2 S APRÈS LES DONNÉES
//  (16 nov. 2026, lot vitesse-volume — demandé par Julien, contrôle de la CI)
//  Lancer : npm run build && node scripts/bancs/volume-budget.cjs [dist]
//
//  La mesure est `_mesure-demarrage.cjs` (rien de dupliqué) : téléphone 390 px tactile, processeur ×4,
//  4G simulée (9 Mb/s, 60 ms), la base inventée d'un GROS vendeur (`_base-volume`, 20 000 ventes,
//  aucune donnée réelle, aucune écriture nulle part). L'écran est ouvert jusqu'à ce que TOUTES ses
//  données essentielles soient là (`COMPLET=1`, l'attribut `data-attente` passe à « pret »).
//
//  LE CHIFFRE JUGÉ : `apresDonnees_ms` = écran complet − arrivée de la DERNIÈRE lecture servie avant lui.
//  C'est le temps que l'app passe à CALCULER et RENDRE une fois les données arrivées (le réseau, lui,
//  dépend de la connexion de la personne). Médiane de PASSES ouvertures (3 par défaut) : une ouverture
//  seule varie du simple au double sur une machine partagée.
//
//  BUDGET (scripts/budget-volume.json) : 2 000 ms, l'objectif. MARGE : 750 ms, pour la variance d'une
//  machine de CI partagée (mesuré le 16 nov. : la même ouverture, le même build, varie de ±30 % d'un
//  passage à l'autre ; la médiane de 3 de ±15 %). Rouge si la médiane dépasse budget + marge, ou si
//  l'écran n'a jamais été prêt. Le chiffre mesuré est écrit sur chaque ligne.
//  Sur origin/main d'avant le lot (b8f26f36d) : Ventes ≈ 3,3–4,7 s ⇒ rouge (récit 2026-11-16-vitesse-volume.md).
// ════════════════════════════════════════════════════════════════════════════
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const RACINE = path.join(__dirname, '..', '..');
const DIST = process.argv[2] || path.join(RACINE, 'dist');
const B = JSON.parse(fs.readFileSync(path.join(RACINE, 'scripts', 'budget-volume.json'), 'utf8'));
const PASSES = Number(process.env.PASSES || B.passes || 3);
const ECRANS = (process.env.TABS || Object.keys(B.ecrans).join(',')).split(',');
const med = (a) => { const s = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
let ko = 0;
const dit = (c, m) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m); };
if (!fs.existsSync(path.join(DIST, 'index.html'))) { dit(false, `dist introuvable (${DIST}) : npm run build d'abord`); process.exit(1); }
const res = Object.fromEntries(ECRANS.map((t) => [t, []]));
const basePort = Number(process.env.BANC_PORT) || (9200 + Math.floor(Math.random() * 300));
for (let p = 0; p < PASSES; p++) {
  for (const tab of ECRANS) {
    let out = '';
    try {
      out = execFileSync(process.execPath, [path.join(__dirname, '_mesure-demarrage.cjs'), DIST, String(basePort + p * 7 + ECRANS.indexOf(tab))], {
        env: { ...process.env, VENTES: String(B.ventes || 20000), CPU: String(B.cpu || 4), COMPLET: '1', TABS: tab },
        encoding: 'utf8', timeout: 600000, stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) { out = String(e.stdout || ''); }
    const l = out.split('\n').find((x) => x.startsWith('{'));
    const x = l ? JSON.parse(l) : null;
    res[tab].push(x);
    console.log(`  passe ${p + 1} · ${tab} : ${x ? `après les données ${x.apresDonnees_ms} ms · complet ${x.complet_ms} ms · prêt ${x.pret_ms} ms (${x.etat}) · tâches longues ${x.longues_ms} ms` : 'aucune mesure'}`);
  }
}
for (const tab of ECRANS) {
  const b = B.ecrans[tab] || {}; const budget = Number(b.budget_ms || B.budget_ms); const marge = Number(b.marge_ms ?? B.marge_ms);
  const mes = res[tab].filter(Boolean);
  const apres = med(mes.map((x) => x.apresDonnees_ms));
  const prets = mes.filter((x) => x.etat === 'pret' || x.etat === 'plafond').length;
  dit(prets === PASSES, `${tab} · l'écran s'ouvre (${prets}/${PASSES})`);
  dit(apres != null && apres <= budget + marge, `${tab} · ${apres == null ? '—' : apres} ms après les données (médiane de ${mes.length} : ${mes.map((x) => x.apresDonnees_ms).join(' · ')}) — budget ${budget} ms + marge ${marge} ms`);
}
console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ volume-budget : Ma journée et Ventes sous le budget à 20 000 ventes');
process.exit(ko ? 1 : 0);
