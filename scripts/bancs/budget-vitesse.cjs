// ════════════════════════════════════════════════════════════════════════════
//  BUDGET DE VITESSE — l'app ne peut plus redevenir lente sans qu'on le voie
//  (11 nov. 2026). Lancer : npm run build && node scripts/bancs/budget-vitesse.cjs
//
//  Par écran principal, à 390 px (téléphone tactile, processeur non ralenti — voir plus
//  bas), on mesure ce qui ne
//  dépend PAS de la vitesse de la machine (les machines de CI sont partagées : un
//  temps en millisecondes y varie du simple au double, aucun seuil de temps ici) :
//    · lectures   : nombre de lectures (GET) de NOTRE base jusqu'au calme ;
//    · octets     : octets rapatriés par ces lectures ;
//    · doublons   : lectures IDENTIQUES refaites (même URL, même Range) — le total,
//                   ET adresse par adresse (`doublonsParAdresse`) : une adresse lue
//                   en double qui ne l'était pas, ou plus de fois que son budget, est
//                   rouge sans marge (le total varie de ±1 selon l'ordre d'arrivée
//                   des réponses ; une adresse NEUVE en double ne varie pas) ;
//    · entieres   : lectures de ligne ENTIÈRE (`select=data` sur fiches, commandes,
//                   dressings — §4.4) : toujours 0 ;
//    · js         : JavaScript + CSS de l'app téléchargés, compressés (gzip), Ko.
//  Deux ouvertures par écran : « appareil neuf » (rien de rangé, aucun compte lié
//  retenu) puis « 2ᵉ ouverture » (la page rechargée dans le même onglet). Ma
//  journée « appareil neuf », c'est le DÉMARRAGE.
//
//  La mesure elle-même est celle de `vitesse.cjs` (`ouvrir`, `bilan`, la même base
//  inventée au poids réel `_base-volume.cjs`, le même réseau simulé) : rien n'est
//  dupliqué. Les budgets sont dans `scripts/budget-vitesse.json`.
//
//  RELEVER UN BUDGET VOLONTAIREMENT (un écran lit plus parce qu'il montre plus) :
//    BUDGET_RELEVER=1 BUDGET_RAISON="Messages lit les avis (lot X)" \
//      node scripts/bancs/budget-vitesse.cjs [écran…]
//  ⇒ 4 passages (2 processeur ×1, 2 ×4), le plus haut de chaque mesure + la marge, réécrits dans le .json
//  (seulement les écrans nommés, ou tous), la raison et la date notées dans
//  `releves`. Puis UN commit qui ne touche que le .json, message « budget-vitesse :
//  relever <écran> — <raison> ». Un budget qui monte sans commit justifié est un
//  défaut, pas un réglage. Baisser un budget (après un gain) se fait pareil.
//
//  Autres : `ECRANS=journee,ventes` (un sous-ensemble) ; `BUDGET_DETAIL=1` (le
//  bilan complet de vitesse.cjs) ; `BUDGET_MUTATION=doublon` (l'app refait UNE
//  lecture identique à chaque ouverture : le banc DOIT être rouge — sa preuve) ;
//  `BUDGET_JSON=fichier` (les mesures brutes) ; `BUDGET_ESSAIS=n` (3 : un écran hors
//  budget est remesuré jusqu'à n fois, chaque mesure jugée sur son meilleur essai).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs');
// Processeur NON ralenti (vitesse.cjs émule ×4 au téléphone) : on juge des COMPTES, pas
// des temps, et ces comptes dépendent du temps processeur — le partage des lectures
// (src/lecturesPartagees.js) ne réunit deux lectures identiques que si la seconde part
// moins de 2 s après la première. Mesuré le 11 nov. : ×4 sur une machine chargée
// (charge 15), Ventes passe de 16 à 21 lectures en double sans une ligne de code changée.
// Sans ralentissement, le temps est celui du réseau simulé (150 ms, fixe). `VITESSE_CPU=4`
// le remet (pour comparer).
if (!process.env.VITESSE_CPU) process.env.VITESSE_CPU = '1';
const V = require('./vitesse.cjs');

// (11 nov., vert-11nov) hors de scripts/bancs/ : ce dossier ne porte AUCUN .json (audit-bancs, dépôt public).
const FICHIER = path.join(__dirname, '..', 'budget-vitesse.json');
const RELEVER = process.env.BUDGET_RELEVER === '1';
const DETAIL = !!process.env.BUDGET_DETAIL;
const MUTATION = process.env.BUDGET_MUTATION || '';
const MESURES = ['lectures', 'octets', 'doublons', 'entieres', 'js'];
// La fenêtre observée, par ouverture : au moins 25 s (le rafraîchissement d'environ
// 15 s après l'ouverture est toujours dedans), rien de ce qui part après 50 s (les
// relectures à la minute jamais dedans). Le calme seul (vitesse.cjs) était bimodal.
const FENETRE = { auMoins: Number(process.env.BUDGET_AU_MOINS) || 25000, auPlus: 50000 };
const OUVERTURES = { neuf: 'appareil neuf', deuxieme: '2ᵉ ouverture' };

// Les écrans principaux (navigation du 11 nov. : `NAV_GROUPES` de src/App.jsx). Le
// prédicat dit « l'écran est là » ; ensuite on attend le calme (3 s sans lecture).
const texte = (re) => new Function(`return ${re}.test(document.body.innerText) || /pas pu s'afficher/.test(document.body.innerText);`);
const ECRANS = [
  ['journee', 'Ma journée', V.ECRANS[0][1]],
  ['ventes', 'Ventes', texte('/vente/i')],
  ['annonces', 'Annonces', texte('/annonce|en ligne/i')],
  ['achats', 'Achats', texte('/achat/i')],
  ['garage', 'Stock', texte('/stock|étagère|meuble|rang/i')],
  ['messages', 'Messages', texte('/message|offre/i')],
  ['compta', 'Argent', texte('/argent|bénéfice|déclar|vendu/i')],
  ['emails', 'E-mails', texte('/e-mail|adresse/i')],
];

// L'app refait une lecture identique (la mutation) : la première lecture de
// `vinted_accounts` est relancée une fois, telle quelle, comme le ferait un
// effet dupliqué.
function mutationDoublon() {
  const f = window.fetch; let fait = false;
  window.fetch = function (u, o) {
    const p = f.apply(this, arguments);
    try { const s = String(u && u.url || u); if (!fait && /\/rest\/v1\/vinted_accounts/.test(s) && (!o || !o.method || o.method === 'GET')) { fait = true; setTimeout(() => f.call(window, u, o).catch(() => {}), 50); } } catch (_) {}
    return p;
  };
}

const silencieux = async (fn) => { if (DETAIL) return fn(); const l = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = l; } };
const mesurer = (nom, r) => {
  const m = V.bilan(nom, r);
  return { lectures: m.n, octets: m.octets, doublons: m.enDouble, entieres: m.entieres.length, js: Math.round(m.octJs / 1024), _entieres: m.entieres, _cles: Object.fromEntries(m.doublonsCles) };
};

// Le plafond tiré des mesures : le plus haut + la marge (au moins +1 lecture, +2 Ko
// de JS (marge `marge_js`, 10 % : le poids d'un build ne varie pas), +8 Ko lus — un écran à 3 lectures n'a pas une marge de 0,45 lecture).
// `doublons` : le plus haut + 1 au plus (ils sont rares et voulus — relecture
// après une écriture) ; `entieres` : 0, toujours (§4.4).
function plafond(quoi, vals, marge, margeJs) {
  const max = Math.max(...vals);
  if (quoi === 'entieres') return 0;
  if (quoi === 'doublons') return max + 1;
  if (quoi === 'octets') return Math.max(Math.ceil(max * (1 + marge)), max + 8192);
  if (quoi === 'js') return Math.max(Math.ceil(max * (1 + margeJs)), max + 2);
  return Math.max(Math.ceil(max * (1 + marge)), max + 1);
}

// Le verdict d'un écran sur ses essais : chaque mesure jugée sur son MEILLEUR essai
// (le plus bas), chaque adresse en double sur son plus petit nombre de lectures. Un
// défaut ajouté (une lecture en double, un morceau importé en statique) est là à
// CHAQUE essai : il reste rouge ; le bruit d'une machine chargée (la vague de
// relectures d'environ 15 s qui tombe ou non dans la fenêtre), lui, ne l'est pas deux
// fois de suite. Une erreur de page est rouge dès qu'elle arrive.
function juger(tab, nom, series, erreurs, affiche) {
  const out = [];
  const v_ = (ok, m, d) => out.push({ ok, m, d });
  for (const cle of Object.keys(OUVERTURES)) {
    const o = `${nom} (${OUVERTURES[cle]})`;
    const pageErr = erreurs[cle].filter((e) => !/^(écran tombé|jamais affiché|pas mesuré)/.test(e));
    v_(affiche[cle] && !pageErr.length, `${o} : l'écran s'affiche, sans erreur`, (pageErr.join(' | ') || (affiche[cle] ? '' : erreurs[cle].join(' | '))).slice(0, 200));
    const ms = series[cle]; if (!ms.length) continue;
    const plaf = (BUDGET.ecrans[tab] || {})[cle];
    if (!plaf) { v_(false, `${o} : un budget existe dans budget-vitesse.json`, 'aucun — le relever (BUDGET_RELEVER=1, voir l\'en-tête)'); continue; }
    const essais = ms.length > 1 ? ` (meilleur de ${ms.length} essais : ${ms.map((m) => m.lectures).join('/')} lectures)` : '';
    for (const q of MESURES) {
      const vals = ms.map((m) => m[q]), v = Math.min(...vals), max = plaf[q];
      if (max == null) { v_(false, `${o} · ${q} : budget défini`, 'absent du .json'); continue; }
      const unite = q === 'octets' ? ` (${Math.round(v / 1024)} Ko / ${Math.round(max / 1024)} Ko)` : '';
      const ecart = v > max ? ` — DÉPASSÉ de ${v - max}${q === 'octets' ? ' octets' : q === 'js' ? ' Ko' : ''} (${max ? '+' + Math.round((v - max) / max * 100) + ' %' : 'budget 0'})` : '';
      const quoi = q === 'entieres' && v ? ' : ' + ms[ms.length - 1]._entieres.join(' | ') : '';
      v_(v <= max, `${o} · ${q} ≤ ${max}`, `${v}${unite}${ecart}${quoi}${v > max ? essais : ''}`);
    }
    const permis = plaf.doublonsParAdresse || {};
    const cles = [...new Set(ms.flatMap((m) => Object.keys(m._cles)))];
    const trop = cles.map((k) => [k, Math.min(...ms.map((m) => m._cles[k] || 1))]).filter(([k, n]) => n > (permis[k] || 1));
    v_(!trop.length, `${o} · aucune adresse lue plus de fois que son budget (${Object.keys(permis).length} adresse(s) en double permises)`, trop.map(([k, n]) => `${permis[k] ? `lue ${n} fois (budget ${permis[k]})` : `NOUVELLE lecture en double (×${n})`} : ${k.slice(0, 150)}`).join(' ¦ ') + (trop.length ? essais : '') || 'aucune');
  }
  return out;
}

let BUDGET = null;
const ESSAIS = Number(process.env.BUDGET_ESSAIS) || 3;
(async () => {
  const budget = BUDGET = JSON.parse(fs.readFileSync(FICHIER, 'utf8'));
  const marge = Number(budget.marge) || 0.15;
  // Le JS est le même d'une machine à l'autre (gzip d'un build) : marge plus serrée.
  const margeJs = Number(budget.marge_js) || 0.10;
  const seuls = process.env.ECRANS ? process.env.ECRANS.split(',') : null;
  if (RELEVER && !process.env.BUDGET_RAISON) { console.log('❌ BUDGET_RELEVER demande BUDGET_RAISON="pourquoi ce budget change" (notée dans le .json)'); process.exit(2); }
  if (RELEVER && MUTATION) { console.log('❌ on ne relève pas un budget sous mutation'); process.exit(2); }
  await V.demarrer();
  const b = await V.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server', '--explicitly-allowed-ports=' + V.PORT] });
  let ko = 0, ok = 0;
  const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
  const brut = {};
  try {
    // Le relevé couvre le processeur RAPIDE et LENT : 2 passages à ×1, 2 à ×4. Les adresses
    // lues en double selon le temps processeur (le partage de 2 s) sont ainsi toutes connues
    // et permises à leur plus haut ; le contrôle, lui, tourne à ×1.
    const CPUS = RELEVER ? [1, 1, 4, 4] : [Number(process.env.VITESSE_CPU) || 1];
    const passages = CPUS.length;
    for (const [tab, nom, attendre] of ECRANS) {
      if (seuls && !seuls.includes(tab)) continue;
      const series = { neuf: [], deuxieme: [] }, erreurs = { neuf: [], deuxieme: [] }, affiche = { neuf: false, deuxieme: false };
      let essai = 0, verdicts = [];
      for (;;) {
        for (let p = 0; p < passages; p++) {
          const r = await V.ouvrir(b, { width: 390, height: 844 }, tab, attendre, null, { cpu: CPUS[p], memoire: false, deuxieme: true, fenetre: FENETRE, ...(MUTATION === 'doublon' ? { initScript: mutationDoublon } : {}) });
          for (const [cle, rr] of [['neuf', r], ['deuxieme', r.deuxieme]]) {
            if (!rr) { erreurs[cle].push('pas mesuré'); continue; }
            if (rr.errs.length) erreurs[cle].push(...rr.errs);
            // Un écran tombé ou jamais affiché lit MOINS : ses mesures ne comptent pas.
            if (rr.lu.tombe || rr.utile == null || rr.errs.length) { if (!rr.errs.length) erreurs[cle].push(rr.lu.tombe ? 'écran tombé' : 'jamais affiché (30 s)'); continue; }
            affiche[cle] = true;
            series[cle].push(await silencieux(() => mesurer(`${tab} (${OUVERTURES[cle]})`, rr)));
          }
        }
        essai++;
        if (RELEVER) break;
        verdicts = juger(tab, nom, series, erreurs, affiche);
        const rouges = verdicts.filter((v) => !v.ok).length;
        if (!rouges || essai >= ESSAIS) break;
        console.log(`  … ${nom} : ${rouges} contrôle(s) hors budget à l'essai ${essai}, remesuré (chaque mesure est jugée sur son meilleur essai)`);
      }
      brut[tab] = series;
      for (const cle of Object.keys(OUVERTURES)) {
        const ms = series[cle]; if (!ms.length) continue;
        const dernier = ms[ms.length - 1];
        console.log(`  ${nom.padEnd(11)} ${OUVERTURES[cle].padEnd(14)} ${String(dernier.lectures).padStart(3)} lectures · ${String(Math.round(dernier.octets / 1024)).padStart(5)} Ko lus · ${dernier.doublons} en double · ${dernier.entieres} entière(s) · ${dernier.js} Ko de JS+CSS${ms.length > 1 ? ' · passages : ' + ms.map((m) => `${m.lectures}/${Math.round(m.octets / 1024)}Ko/${m.doublons}`).join(' ') : ''}`);
        if (RELEVER) {
          if (erreurs[cle].length || ms.length < passages) { dit(false, `${nom} (${OUVERTURES[cle]}) : chaque passage du relevé affiché sans erreur`, erreurs[cle].join(' | ').slice(0, 200)); continue; }
          budget.ecrans[tab] = budget.ecrans[tab] || { nom };
          budget.ecrans[tab][cle] = Object.fromEntries(MESURES.map((q) => [q, plafond(q, ms.map((m) => m[q]), marge, margeJs)]));
          budget.ecrans[tab][cle].doublonsParAdresse = Object.fromEntries([...new Set(ms.flatMap((m) => Object.keys(m._cles)))].sort().map((k) => [k, Math.max(...ms.map((m) => m._cles[k] || 1))]));
          budget.ecrans[tab][cle + '_mesure'] = Object.fromEntries(MESURES.map((q) => [q, Math.max(...ms.map((m) => m[q]))]));
        }
      }
      for (const v of verdicts) dit(v.ok, v.m, v.d);
    }
    if (RELEVER) {
      budget.releves = budget.releves || [];
      budget.releves.push({ date: new Date().toISOString().slice(0, 10), ecrans: seuls || ECRANS.map((e) => e[0]), raison: process.env.BUDGET_RAISON });
      fs.writeFileSync(FICHIER, JSON.stringify(budget, null, 1) + '\n');
      console.log(`\n✏️  ${path.relative(process.cwd(), FICHIER)} réécrit — commit à part, message « budget-vitesse : relever … — ${process.env.BUDGET_RAISON} »`);
    }
    if (process.env.BUDGET_JSON) fs.writeFileSync(process.env.BUDGET_JSON, JSON.stringify(brut, null, 1));
  } finally { await b.close(); await V.fermer(); }
  if (!RELEVER) console.log(`\n${ko ? '❌' : '✅'} budget de vitesse : ${ok} contrôle(s) dans le budget, ${ko} rouge(s)${MUTATION ? ` (mutation « ${MUTATION} »)` : ''}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ banc arrêté : ' + (e && e.stack || e)); process.exit(1); });
