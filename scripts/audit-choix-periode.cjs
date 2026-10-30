// Audit : LE CALENDRIER DES PÉRIODES « COMME AIRBNB » et L'ÉTAT EN JAUGE (29 oct.).
//
// On EXÉCUTE les deux règles pures (src/periodeCalendrier.js, src/carteAnnonce.js)
// et on juge ce qu'elles RENDENT :
//   · l'état Vinted : les cinq libellés mesurés chez lui → 5…1, comparés EN
//     ENTIER (« Bon état » n'est pas « Très bon état »), accents et casse
//     ignorés ; un libellé inconnu est gardé tel quel, sans niveau deviné ;
//     aucun libellé ⇒ null ;
//   · les raccourcis (7 j · 30 j · ce mois · mois dernier · cette année), y
//     compris un 31 mars (mois dernier = février entier) et un 1er janvier ;
//   · le geste : premier toucher = début, second = fin, un jour avant le début
//     le remplace, une plage complète recommence, un jour à venir ne compte pas ;
//   · la plage dite en clair (même mois, deux mois, deux années, un jour, un
//     mois entier, une année entière, une borne seule) ;
//   · la grille commence le LUNDI ; une date impossible (31 février) est refusée ;
//   · et dans l'app : UN composant pour Ventes, Achats et Statistiques (§11), la
//     valeur garde sa forme `{from, to}` lue par `dansPeriodeDate` (bornes
//     incluses, jours entiers).
// `--prouve` rejoue l'audit sur des règles RÉAFFAIBLIES : chacune doit le faire
// passer au rouge.
const fs = require('fs'), path = require('path'), os = require('os');
const RACINE = path.join(__dirname, '..');
const SRC_CAL = path.join(RACINE, 'src', 'periodeCalendrier.js');
const SRC_ETAT = path.join(RACINE, 'src', 'carteAnnonce.js');
const SRC_APP = path.join(RACINE, 'src', 'App.jsx');
// Un audit ne meurt pas, il rapporte : un fichier absent est un contrôle rouge.
const lire = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch (_) { return null; } };

const MUTATIONS = {
  // l'état comparé par MORCEAU (« bon état » est dans « très bon état »)
  etat_morceau: { f: 'etat', m: (s) => s.replace('const connu = ETATS_VINTED.find((e) => sansAccent(e.libelle) === n);', 'const connu = ETATS_VINTED.find((e) => sansAccent(e.libelle).includes(n));') },
  // un état inconnu deviné au milieu de l'échelle
  etat_devine: { f: 'etat', m: (s) => s.replace('{ niveau: null, libelle: brut }', '{ niveau: 3, libelle: brut }') },
  // la grille commence le dimanche
  grille_dimanche: { f: 'cal', m: (s) => s.replace('const decalage = (premier.getDay() + 6) % 7;', 'const decalage = premier.getDay();') },
  // « 7 jours » = 8 jours
  sept_jours: { f: 'cal', m: (s) => s.replace('auj.getDate() - k + 1', 'auj.getDate() - k') },
  // un jour avant le début devient la FIN (plage inversée)
  avant_debut: { f: 'cal', m: (s) => s.replace('  if (j < from) return { from: j, to: null };\n', '') },
  // un jour à venir se choisit
  futur: { f: 'cal', m: (s) => s.replace('if (max && j > jourSeul(max)) return sel || { from: null, to: null };', '') },
  // la plage d'un mois entier dite « du 1er au 31 » au lieu du mois
  mois_entier: { f: 'cal', m: (s) => s.replace('if (f.getDate() === 1 && memeJour(t, finMois)) return nomMois(f.getFullYear(), f.getMonth());', '') },
  // le mois dernier calculé en retirant 30 jours
  mois_dernier: { f: 'cal', m: (s) => s.replace("{ cle: 'dernier', nom: 'Mois dernier', valeur: mois(-1) },", "{ cle: 'dernier', nom: 'Mois dernier', valeur: { from: new Date(auj.getFullYear(), auj.getMonth(), auj.getDate() - 30), to: auj } },") },
  // une date impossible acceptée
  date_impossible: { f: 'cal', m: (s) => s.replace('return cleJour(d) === k ? d : null;', 'return d;') },
};

async function charger(src, nom) {
  const f = path.join(os.tmpdir(), `${nom}-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, src);
  try { return await import(f); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}

async function auditer({ cal, etat }, { silencieux = false } = {}) {
  let ko = 0, ok = 0;
  const dit = (c, m, d) => { if (c) ok++; else ko++; if (!silencieux || !c) console.log((c ? '  ✅ ' : '  ❌ ') + m + (d != null && d !== '' && !c ? ' — ' + d : '')); };
  const essaie = (m, f) => { try { f(); } catch (e) { dit(false, m, 'a levé : ' + String(e && e.message).slice(0, 100)); } };
  let C, E;
  if (cal == null || etat == null) { dit(false, 'les deux règles existent (src/periodeCalendrier.js, src/carteAnnonce.js)', `${cal == null ? 'periodeCalendrier.js absent ' : ''}${etat == null ? 'carteAnnonce.js absent' : ''}`); return { ko, ok }; }
  try { C = await charger(cal, 'periodeCalendrier'); E = await charger(etat, 'carteAnnonce'); }
  catch (e) { dit(false, 'les deux modules se chargent', String(e.message).slice(0, 120)); return { ko, ok }; }
  const k = (d) => C.cleJour(d);

  // ── 1. L'état Vinted en jauge
  essaie('état', () => {
    const n = (s) => { const r = E.etatVinted(s); return r ? r.niveau : 'null'; };
    const vus = ['Neuf avec étiquette', 'Neuf sans étiquette', 'Très bon état', 'Bon état', 'Satisfaisant'].map(n);
    dit(JSON.stringify(vus) === '[5,4,3,2,1]', 'les cinq libellés de Vinted → 5 · 4 · 3 · 2 · 1', JSON.stringify(vus));
    dit(n('Bon état') === 2 && n('Très bon état') === 3 && E.etatVinted('bon').niveau === null, '« Bon état » n\'est pas « Très bon état », « bon » n\'est rien (libellé comparé EN ENTIER)', `${n('Bon état')} / ${n('Très bon état')} / ${n('bon')}`);
    dit(n('  TRES BON ETAT ') === 3 && n('neuf  avec etiquette') === 5, 'accents, casse et espaces ignorés', `${n('  TRES BON ETAT ')} / ${n('neuf  avec etiquette')}`);
    const inc = E.etatVinted('Comme neuf (vintage)');
    dit(inc && inc.niveau === null && inc.libelle === 'Comme neuf (vintage)', 'un état inconnu est gardé tel quel, SANS niveau deviné', JSON.stringify(inc));
    dit(E.etatVinted('') === null && E.etatVinted(null) === null && E.etatVinted(undefined) === null, 'aucun état ⇒ null (la fiche dit « — »)');
    dit(E.NIVEAU_ETAT_MAX === 5, 'la jauge a cinq barres', E.NIVEAU_ETAT_MAX);
  });

  // ── 2. Les raccourcis
  essaie('raccourcis', () => {
    const r = (iso) => Object.fromEntries(C.raccourcisPeriode(new Date(iso)).map((x) => [x.cle, `${k(x.valeur.from)}..${k(x.valeur.to)}`]));
    const a = r('2026-10-29T15:00:00');
    dit(JSON.stringify(Object.keys(a)) === '["j7","j30","mois","dernier","annee"]', 'les cinq raccourcis, dans l\'ordre demandé', Object.keys(a).join(','));
    dit(a.j7 === '2026-10-23..2026-10-29', '« 7 jours » = 7 jours, aujourd\'hui compris', a.j7);
    dit(a.j30 === '2026-09-30..2026-10-29', '« 30 jours » = 30 jours, aujourd\'hui compris', a.j30);
    dit(a.mois === '2026-10-01..2026-10-31' && a.dernier === '2026-09-01..2026-09-30' && a.annee === '2026-01-01..2026-12-31', '« ce mois », « mois dernier », « cette année » : des mois et une année ENTIERS', `${a.mois} · ${a.dernier} · ${a.annee}`);
    const b = r('2026-03-31T09:00:00');
    dit(b.dernier === '2026-02-01..2026-02-28', 'un 31 mars, « mois dernier » = février entier (pas un 3 mars)', b.dernier);
    const c = r('2027-01-01T00:30:00');
    dit(c.dernier === '2026-12-01..2026-12-31' && c.j7 === '2026-12-26..2027-01-01', 'un 1er janvier : l\'année d\'avant pour le mois dernier', `${c.dernier} · ${c.j7}`);
    const auj = new Date('2026-10-29T15:00:00');
    const v = C.valeurDeSelection({ from: new Date('2026-10-01T00:00:00'), to: new Date('2026-10-31T00:00:00') }, auj);
    dit(v && v.label === 'octobre 2026' && C.raccourciDe(v, auj) === 'mois', 'une sélection qui EST un raccourci prend son nom (et l\'allume)', JSON.stringify(v && v.label));
  });

  // ── 3. Le geste
  essaie('geste', () => {
    const d = (j) => new Date(2026, 9, j);
    const max = new Date(2026, 9, 29);
    let s = { from: null, to: null };
    s = C.toucherJour(s, d(12), { max });
    dit(k(s.from) === '2026-10-12' && s.to === null, 'premier toucher = début, la fin reste à choisir', JSON.stringify(s));
    const s2 = C.toucherJour(s, d(20), { max });
    dit(k(s2.from) === '2026-10-12' && k(s2.to) === '2026-10-20', 'second toucher = fin', `${k(s2.from)}..${k(s2.to)}`);
    const s3 = C.toucherJour(s, d(5), { max });
    dit(k(s3.from) === '2026-10-05' && s3.to === null, 'un jour AVANT le début devient le nouveau début (jamais une plage à l\'envers)', JSON.stringify(s3));
    const s4 = C.toucherJour(s2, d(25), { max });
    dit(k(s4.from) === '2026-10-25' && s4.to === null, 'une plage complète touchée de nouveau recommence', JSON.stringify(s4));
    const s5 = C.toucherJour(s, d(30), { max });
    dit(s5 === s, 'un jour à venir ne se choisit pas (aucune vente n\'y est encore)', JSON.stringify(s5));
    const s6 = C.toucherJour(s, d(12), { max });
    dit(k(s6.from) === '2026-10-12' && k(s6.to) === '2026-10-12', 'le même jour deux fois = une seule journée', JSON.stringify(s6));
    const etats = [10, 12, 15, 20, 21].map((j) => C.etatJour(d(j), s2));
    dit(JSON.stringify(etats) === '["","debut","dans","fin",""]', 'le dessin : début · dans · fin', JSON.stringify(etats));
    const ap = [13, 18, 19].map((j) => C.etatJour(d(j), s, d(18)));
    dit(JSON.stringify(ap) === '["apercu","fin-apercu",""]', 'le survol dessine la plage avant le second clic', JSON.stringify(ap));
    dit(C.nbJours(d(12), d(20)) === 9, 'nombre de jours, bornes comprises', C.nbJours(d(12), d(20)));
  });

  // ── 4. La plage en clair
  essaie('plage', () => {
    const L = (a, b) => C.libellePlage(a ? new Date(a + 'T00:00:00') : null, b ? new Date(b + 'T00:00:00') : null);
    const cas = [
      [['2026-10-12', '2026-10-28'], 'du 12 au 28 oct. 2026'],
      [['2026-09-28', '2026-10-12'], 'du 28 sept. au 12 oct. 2026'],
      [['2025-12-28', '2026-01-03'], 'du 28 déc. 2025 au 3 janv. 2026'],
      [['2026-10-12', '2026-10-12'], 'le 12 oct. 2026'],
      [['2026-10-01', '2026-10-31'], 'octobre 2026'],
      [['2026-01-01', '2026-12-31'], 'année 2026'],
      [['2026-10-01', '2026-10-15'], 'du 1er au 15 oct. 2026'],
      [['2026-10-12', null], 'depuis le 12 oct. 2026'],
      [[null, '2026-10-12'], "jusqu'au 12 oct. 2026"],
      [[null, null], 'Toute la période'],
    ];
    const faux = cas.filter(([[a, b], att]) => L(a, b) !== att).map(([[a, b], att]) => `${a}..${b} → « ${L(a, b)} » (attendu « ${att} »)`);
    dit(faux.length === 0, 'la plage se dit en clair (même mois, deux mois, deux années, un jour, un mois, une année, une borne)', faux.join(' · '));
  });

  // ── 5. La grille, les dates
  essaie('grille', () => {
    const g = C.grilleMois(2026, 9);            // octobre 2026 : le 1er est un jeudi
    dit(g[0].slice(0, 3).every((x) => x === null) && g[0][3] && g[0][3].getDate() === 1 && g.every((s) => s.length === 7), 'la grille commence le LUNDI (le 1er octobre 2026, un jeudi, en 4e colonne)', g[0].map((x) => (x ? x.getDate() : '·')).join(' '));
    const f = C.grilleMois(2026, 1);            // février 2026
    dit(f.flat().filter(Boolean).length === 28, 'février 2026 : 28 jours', f.flat().filter(Boolean).length);
    dit(C.dateDeCle('2026-02-31') === null && C.dateDeCle('2026-02-28') && C.dateDeCle('n’importe quoi') === null, 'une date impossible est refusée (« 31 février »)', String(C.dateDeCle('2026-02-31')));
    const m = C.moisDefilants(new Date('2026-10-29T12:00:00'), 18);
    dit(m.length === 18 && m[17].annee === 2026 && m[17].mois === 9 && m[0].annee === 2025 && m[0].mois === 4, 'au doigt : 18 mois, le plus ancien en haut, le mois en cours en bas', `${m[0].annee}-${m[0].mois + 1} … ${m[17].annee}-${m[17].mois + 1}`);
  });

  return { ko, ok };
}

function auditApp() {
  let ko = 0, ok = 0;
  const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d != null && d !== '' && !c ? ' — ' + d : '')); };
  const app = (lire(SRC_APP) || '').replace(/\/\*[\s\S]*?\*\//g, (x) => x.replace(/[^\n]/g, ' ')).replace(/^\s*\/\/.*$/gm, '');
  const comp = lire(path.join(RACINE, 'src', 'ChoixPeriode.jsx')) || '';
  const pp = /function PeriodePicker\([^)]*\)\s*\{([\s\S]*?)\n\}/.exec(app);
  dit(pp && /<ChoixPeriode\b/.test(pp[1]), 'PeriodePicker rend LE composant ChoixPeriode (une règle, un propriétaire)', pp ? pp[1].trim().slice(0, 100) : 'PeriodePicker introuvable');
  const titres = [...app.matchAll(/<PeriodePicker[^>]*titre="([^"]+)"/g)].map((m) => m[1]);
  dit(['Période des ventes', 'Période des achats', "Période du chiffre d'affaires"].every((t) => titres.includes(t)), 'Ventes, Achats et Statistiques l\'utilisent', titres.join(' · '));
  dit(!/Début de la période|Fin de la période/.test(app), 'plus aucun ancien champ « Début / Fin de la période » à côté');
  dit(/from:\s*\w+,\s*to:\s*\w+/.test(lire(SRC_CAL) || '') && /onChange\(v\)|appliquer\(/.test(comp), 'la valeur garde sa forme {from, to} (lue par dansPeriodeDate)');
  const dpd = /const dansPeriodeDate = \(t, p\) => \{([\s\S]*?)\n\};/.exec(app);
  dit(dpd && /debutJour\(p\.from\)/.test(dpd[1]) && /finJour\(p\.to\)/.test(dpd[1]), 'dansPeriodeDate compte des JOURS ENTIERS, bornes incluses', dpd ? '' : 'introuvable');
  return { ko, ok };
}

(async () => {
  const cal = lire(SRC_CAL), etat = lire(SRC_ETAT);
  if (process.argv.includes('--prouve')) {
    let attrapees = 0;
    const noms = Object.keys(MUTATIONS);
    for (const nom of noms) {
      const mu = MUTATIONS[nom];
      const src = { cal, etat };
      const avant = src[mu.f];
      src[mu.f] = mu.m(avant);
      if (src[mu.f] === avant) { console.log(`  ⚠️ mutation « ${nom} » : l'ancre n'existe plus — à mettre à jour`); continue; }
      const r = await auditer(src, { silencieux: true });
      if (r.ko > 0) attrapees++;
      console.log(`  ${r.ko > 0 ? '🔴' : '🟢'} mutation « ${nom} » : ${r.ko} rouge(s)`);
    }
    console.log(`\n${attrapees === noms.length ? '✅' : '❌'} audit-choix-periode --prouve : ${attrapees}/${noms.length} mutations attrapées`);
    process.exit(attrapees === noms.length ? 0 : 1);
  }
  console.log('— Règles (periodeCalendrier.js, carteAnnonce.js)');
  const r = await auditer({ cal, etat });
  console.log('— Dans l\'app');
  const a = auditApp();
  const ko = r.ko + a.ko, ok = r.ok + a.ok;
  console.log(ko ? `\n❌ audit-choix-periode : ${ko} contrôle(s) rouge(s), ${ok} vert(s)` : `\n✅ audit-choix-periode : ${ok} contrôles — le calendrier et la jauge d'état disent ce que dit la donnée`);
  process.exit(ko ? 1 : 0);
})();
