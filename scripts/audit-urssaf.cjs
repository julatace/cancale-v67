#!/usr/bin/env node
/**
 * LE CHIFFRE D'AFFAIRES DÉCLARÉ À L'URSSAF — UNE SEULE RÈGLE, ET RIEN D'ÉCARTÉ
 *
 * Julien : « je veux un rapport tous les mois de la somme de toutes les ventes
 * finalisées pour mon URSSAF ». Ce chiffre est recopié sur une déclaration :
 * il ne peut ni être calculé de trois façons, ni écarter des ventes en silence.
 *
 * ⚠️ Deux défauts mesurés en base le 2 septembre :
 *  1. le rapport écartait les ventes masquées dans l'app (`isHidden`) —
 *     101 ventes finalisées, 2 174,80 €. Sur juin 2026 il affichait 41 € au
 *     lieu de 1 512,70 €. Masquer une carte range un écran, ça n'annule pas
 *     une vente encaissée.
 *  2. le récap du tableau de bord lisait `vinted_sales`, VIDE depuis juillet
 *     2026 → 0 € partout.
 * Plus un troisième, trouvé en lisant le code : le rapport ANNUEL calculait
 * `marge = margeKnown - frais`, en mélangeant le sous-ensemble des ventes au
 * coût connu avec les boosts de TOUTES les ventes (§5.84 avait corrigé le
 * mensuel et pas lui).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RACINE = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
let ko = 0;
const ok = (m) => console.log('✅ ' + m);
const nok = (m, d) => { ko++; console.log('❌ ' + m + (d ? ' — ' + d : '')); };

// ── 1. La règle est UNE fonction de module, et elle s'exécute ───────────────
const bloc = (() => {
  const i = SRC.indexOf('const TAUX_URSSAF_DEFAUT');
  if (i < 0) return null;
  const j = SRC.indexOf('\n// Heure locale', i);
  const k = SRC.indexOf('\nconst heureCommande', i);
  const fin = [j, k].filter(x => x > 0).sort((a, b) => a - b)[0];
  return fin ? SRC.slice(i, fin) : null;
})();

if (!bloc || !/caUrssafParMois/.test(bloc)) {
  nok('la règle du CA déclaré existe au niveau module', 'caUrssafParMois introuvable');
} else {
  const ctx = {
    console, Date, Number, String, isFinite, parseFloat,
    load: (k, d) => d,
    classifyOrderStatus: (s) => /annul|cancel|refus|rembours/i.test(String(s || '')) ? 'cancelled'
      : (/finalis/i.test(String(s || '')) ? 'completed' : 'pending'),
    tsCommande: (o) => Date.parse((o && o.date) || '') || 0,
    montantCommande: (o) => {
      const p = o && o.price; if (p == null) return 0;
      const v = (typeof p === 'object') ? (p.amount ?? p.value) : p;
      const n = Number(String(v ?? '').replace(',', '.')); return isNaN(n) ? 0 : n;
    },
  };
  const EXPORTE = "\n;Object.assign(this, { tauxUrssaf, moisDeVente, venteFinalisee, caUrssafParMois });";
  vm.createContext(ctx); vm.runInContext(bloc + EXPORTE, ctx);

  // Les statuts RÉELLEMENT présents en base (relevé du 2 septembre).
  const cas = [
    ['Commande finalisée ! Ton article est arrivé', true],
    ['Remboursement effectué', false],
    ['Commande expédiée, en cours de livraison', false],
    ['Bordereau envoyé au vendeur', false],
    ['Le paiement a été validé', false],
    ['Retour initié', false],
    ['Transaction suspendue', false],
    ['Commande non réclamée – Retournée', false],
  ];
  let bad = cas.filter(([st, att]) => ctx.venteFinalisee({ status: st }) !== att);
  bad.length
    ? nok('seules les ventes FINALISÉES comptent', bad.map(b => b[0]).join(' · '))
    : ok('seules les ventes FINALISÉES comptent (8 statuts réels)');

  // ⚠️ LE CONTRÔLE QUI COMPTE : une vente masquée reste dans le total.
  const ventes = [
    { transaction_id: 1, date: '2026-06-10T10:00:00Z', status: 'Commande finalisée !', price: { amount: '41.00' } },
    { transaction_id: 2, date: '2026-06-11T10:00:00Z', status: 'Commande finalisée !', price: { amount: '100.00' } },
    { transaction_id: 3, date: '2026-06-12T10:00:00Z', status: 'Remboursement effectué', price: { amount: '999.00' } },
  ];
  const masquee = (o) => String(o.transaction_id) === '2';
  const m = ctx.caUrssafParMois(ventes, masquee)['2026-06'] || {};
  (m.ca === 141 && m.n === 2)
    ? ok('une vente masquée dans l\'app reste dans le CA déclaré (141 €, pas 41 €)')
    : nok('une vente masquée reste dans le CA déclaré', `ca=${m.ca} n=${m.n} au lieu de 141 / 2`);
  (m.caMasq === 100 && m.nMasq === 1)
    ? ok('le poids des ventes masquées est compté à part (auditable)')
    : nok('le poids des ventes masquées est compté à part', `caMasq=${m.caMasq}`);
  // Un remboursement n'est jamais du chiffre d'affaires.
  Object.values(ctx.caUrssafParMois(ventes, null)).every(x => x.ca <= 141)
    ? ok('les remboursements et annulations ne comptent jamais')
    : nok('les remboursements et annulations ne comptent jamais');

  // Le taux est un réglage, pas une constante.
  const ctx2 = Object.assign({}, ctx);
  ctx2.load = (k, d) => (k === 'vinted_urssaf_taux' ? '12,3' : d);
  vm.createContext(ctx2); vm.runInContext(bloc + EXPORTE, ctx2);
  ctx2.tauxUrssaf() === 12.3
    ? ok('le taux de cotisations vient du réglage (virgule acceptée)')
    : nok('le taux vient du réglage', 'obtenu ' + ctx2.tauxUrssaf());
  const ctx3 = Object.assign({}, ctx);
  ctx3.load = (k, d) => (k === 'vinted_urssaf_taux' ? 'nawak' : d);
  vm.createContext(ctx3); vm.runInContext(bloc + EXPORTE, ctx3);
  ctx3.tauxUrssaf() === 13.5
    ? ok('un taux illisible retombe sur le défaut, jamais sur zéro')
    : nok('un taux illisible retombe sur le défaut', 'obtenu ' + ctx3.tauxUrssaf());
}

// ── 2. Les deux rapports n'écartent plus les ventes masquées ───────────────
const mensuel = SRC.slice(SRC.indexOf('const report = useMemo'), SRC.indexOf('const openReport'));
const annuel = SRC.slice(SRC.indexOf('const annual = useMemo'), SRC.indexOf('const openAnnual'));
for (const [nom, txt] of [['mensuel', mensuel], ['annuel', annuel]]) {
  if (!txt) { nok(`le rapport ${nom} est lisible`); continue; }
  /if \(isHidden\(o\)\) continue;/.test(txt)
    ? nok(`le rapport ${nom} n'écarte plus les ventes masquées`, 'il fait encore `if (isHidden(o)) continue;`')
    : ok(`le rapport ${nom} n'écarte plus les ventes masquées`);
  /nMasq\s*\+=\s*1/.test(txt)
    ? ok(`le rapport ${nom} compte les ventes masquées à part`)
    : nok(`le rapport ${nom} compte les ventes masquées à part`);
  /const taux = tauxUrssaf\(\)/.test(txt)
    ? ok(`le rapport ${nom} applique le taux réglable`)
    : nok(`le rapport ${nom} applique le taux réglable`, 'taux en dur');
}
// Le mélange de deux ensembles dans la marge annuelle (§5.84, jamais corrigé ici).
/const marge = margeKnown - frais;/.test(annuel)
  ? nok('la marge annuelle ne mélange pas deux ensembles', '`margeKnown - frais` : sous-ensemble moins le tout')
  : ok('la marge annuelle ne mélange pas deux ensembles');

// ── 2 bis. Le VOCABULAIRE : « encaissé » est faux tant qu'on date à la vente ─
// ⚠️ §5.57 a retiré la date d'encaissement de toute l'app (elle n'existe que
// pour une partie des ventes). Un rapport destiné à l'URSSAF qui annonce un
// « CA encaissé » alors qu'il somme par DATE DE VENTE ment sur un document
// officiel — et l'écart peut faire basculer une fin de mois.
const carteCA = /<StatBox label="CA[^"]*" value=\{fmtE\((report|annual)\.ca\)\}/g;
const libelles = [...SRC.matchAll(carteCA)].map(m => m[0]);
libelles.length === 2
  ? (libelles.some(l => /encaiss/i.test(l))
      ? nok('les deux rapports ne disent plus « CA encaissé »', libelles.filter(l=>/encaiss/i.test(l)).join(' · '))
      : ok('les deux rapports annoncent « CA des ventes finalisées », pas « encaissé »'))
  : nok('les deux cartes de CA des rapports sont lisibles', libelles.length + ' trouvée(s)');
/pas au jour où Vinted t'a versé l'argent/.test(SRC)
  ? ok("le tableau de bord DIT que ses ventes sont datées au jour de la vente")
  : nok("le tableau de bord dit comment ses ventes sont datées", 'avertissement absent');

// ── 3. Le tableau de bord ne lit plus une archive vide ─────────────────────
/save\('vinted_urssaf_mois'/.test(SRC)
  ? ok("l'écran Ventes publie le récap mensuel (propriétaire unique de la règle)")
  : nok("l'écran Ventes publie le récap mensuel");
/load\('vinted_urssaf_mois'/.test(SRC)
  ? ok('le tableau de bord consomme ce récap au lieu de l\'archive vide')
  : nok('le tableau de bord consomme ce récap');

// ── 4. Plus aucun 13,5 % en dur sur un chemin URSSAF ───────────────────────
const enDur = SRC.split('\n')
  .map((l, i) => [i + 1, l])
  .filter(([, l]) => /(\*\s*0\.135|0\.135\s*\*|13,5\s*%|13,5%)/.test(l) && !/^\s*\/\//.test(l) && !/TAUX_URSSAF_DEFAUT/.test(l));
enDur.length
  ? nok('aucun taux de cotisations écrit en dur', enDur.map(([n]) => 'l.' + n).join(', '))
  : ok('aucun taux de cotisations écrit en dur');


// ────────────────────────────────────────────────────────────────────────────
// LE MOIS SE CHOISIT LIBREMENT, ET UN MOIS N'EST PAS COMPLET LE JOUR OÙ IL SE
// TERMINE (§5.85).
//
// La modale s'ouvrait sur le MOIS EN COURS : le 2 d'un mois, elle affichait
// 0 € et Julien croyait ses ventes disparues. Et le mois vivait dans un
// <select> : impossible d'atteindre un mois absent de la liste.
//
// Une vente Vinted se finalise ~2 semaines après. Mesuré le 3 septembre :
// août portait 110 ventes finalisées (3 345,20 €) ET 59 encore en cours
// (1 174,90 €). Le rapport les compte et le dit.
// ────────────────────────────────────────────────────────────────────────────
/derniersMoisDeclarables\s*=\s*useMemo\([\s\S]{0,400}venteFinalisee\(o\)/.test(SRC)
  ? ok("les mois déclarables sont ceux qui portent des ventes finalisées")
  : nok("les mois déclarables sont ceux qui portent des ventes finalisées");

/openReport\s*=\s*\(\)\s*=>\s*\{[\s\S]{0,400}setReportMonth\(derniersMoisDeclarables\[0\]\)/.test(SRC)
  ? ok("le rapport s'ouvre sur le dernier mois déclarable, pas sur un mois vide")
  : nok("le rapport s'ouvre sur le dernier mois déclarable");

(/moisChoisiMain\s*=\s*useRef\(false\)/.test(SRC) &&
 /if\s*\(!moisChoisiMain\.current\s*&&/.test(SRC) &&
 /moisChoisiMain\.current=true/.test(SRC))
  ? ok("un mois choisi à la main n'est plus déplacé sous ses doigts")
  : nok("un mois choisi à la main n'est plus déplacé");

!/<select value=\{reportMonth\}/.test(SRC)
  ? ok("plus de menu déroulant pour le mois du rapport")
  : nok("le menu déroulant du mois est encore là");

!/const reportMonths\b/.test(SRC)
  ? ok("le helper mort `reportMonths` n'a pas été laissé dans le fichier")
  : nok("`reportMonths` traîne encore (piège pour la session suivante, §5.39)");

(/setReportAnnee/.test(SRC) && /MOIS_FR\.map\(\(nom,m\)=>/.test(SRC) &&
 /moisChoisiMain\.current=true;\s*setReportMonth\(ym\)/.test(SRC))
  ? ok("n'importe quel mois s'ouvre depuis la grille (année navigable)")
  : nok("n'importe quel mois s'ouvre depuis la grille");

/const futur = reportAnnee>now\.getFullYear\(\)/.test(SRC)
  ? ok("les mois à venir ne se déclarent pas")
  : nok("les mois à venir ne se déclarent pas");

(/let nMasq=0, caMasq=0, nAttente=0, caAttente=0;/.test(SRC) &&
 /nAttente\+=1;\s*caAttente\+=montantCommande\(o\);/.test(SRC))
  ? ok("les ventes du mois pas encore finalisées sont comptées (montantCommande : le prix est un objet)")
  : nok("les ventes du mois pas encore finalisées sont comptées");

/if \(classifyOrderStatus\(o\.status\)!=='cancelled'\) \{ nAttente\+=1;/.test(SRC)
  ? ok("une annulée n'est jamais comptée comme « en attente »")
  : nok("une annulée n'est jamais comptée comme « en attente »");

(/report\.nAttente>0 && \(/.test(SRC) && /fmtE\(report\.caAttente\)/.test(SRC))
  ? ok("elles sont annoncées dans la modale, avec leur montant")
  : nok("elles sont annoncées dans la modale");

(/L\.push\(\[`Ventes de ce mois pas encore finalisees \(hors CA\)`/.test(SRC) &&
 /kv\('Ventes de ce mois pas encore finalisees \(hors CA\)'/.test(SRC))
  ? ok("le CSV et le PDF emportent la réserve avec eux")
  : nok("le CSV et le PDF emportent la réserve");

/if \(!venteFinalisee\(o\)\) \{/.test(SRC)
  ? ok("une vente non finalisée n'entre jamais dans le CA déclaré")
  : nok("une vente non finalisée n'entre jamais dans le CA déclaré");

console.log(ko ? `\n${ko} contrôle(s) en échec.` : '\nLe CA déclaré suit une seule règle, et rien n\'en est écarté en silence.');
process.exit(ko ? 1 : 0);
