#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LOTS BE et BG (10 nov.) — LA FRISE D'UNE VENTE et D'OÙ VIENNENT MES ACHATS
//         node scripts/audit-frise-source.cjs [--mutation=…] [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// EXÉCUTE src/friseProuvee.js et src/sourceAchats.js (avec les vraies règles
// qu'ils importent : api/_lib/depart-vente.js, depart-colis.js, litiges.js,
// retoursStock.js) sur des données INVENTÉES (le dépôt est public), et lit dans
// le code des écrans que :
//   F. une étape de la frise n'est cochée que par SA preuve (jamais déduite d'une
//      étape plus loin) ; le n° de suivi est celui de SON bordereau, jamais un
//      autre, jamais un n° ambigu ; un e-mail daté avant la vente ne prouve rien ;
//      un état de LISTE ne prouve rien d'une vente en litige ; « Versée » exige
//      la date lue ; l'ambre seulement sur l'étape en cours où SON geste est
//      attendu ; litige / annulation en bifurcation ; 50 ventes au même titre :
//      seule celle dont le n° est prouvé avance ;
//   S. la source d'un achat se LIT (achat Vinted relié, achat en gros) ou se
//      SAISIT (« Où » d'un achat hors plateforme, relié par SON N° — unique) ;
//      jamais par le titre ; rien de saisi ⇒ compté à part ; la moyenne d'une
//      source sur ses ventes au bénéfice CONNU, couverture dite, « au plus » si
//      des frais manquent, jamais « au moins » ;
//   E. le récapitulatif rend la frise prouvée ; Ventes publie les sources avec la
//      règle unique du bénéfice ; Statistiques LIT (aucun second calcul) ; jamais
//      de rouge ; « Magasin » dans la liste courte de « Où ».
// `--mutation=…` réaffaiblit une règle dans une copie de src/ et api/ : rouge exigé.
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUTS = {
  'deduction': ["const fait = !!(p && p.lu === true);", "const fait = !!(p && p.lu === true) || liste.slice(liste.findIndex(([c]) => c === cle) + 1).some(([c]) => preuves && preuves[c] && preuves[c].lu === true);"],
  'liste-en-litige': ['const listeParle = !horsParcours;', 'const listeParle = true;'],
  'ambigu-lu': ["const nSur = n && !amb ? n : '';", 'const nSur = n;'],
  'email-avant-vente': ['      if (venteMs != null && x.at != null && x.at < venteMs - TOLERANCE_AVANT_VENTE_MS) continue;\n', ''],
  'versee-sans-date': ["p.versee = ms(versement) != null ?", 'p.versee = ms(versement) != null || p.finalisee.lu ?'],
  'geste-partout': ['if (geste && geste.cle === etapes[i].cle)', 'if (geste)'],
  'annulee-tue': ["if (annulee) return { genre: 'annulee'", "if (false) return { genre: 'annulee'"],
  'source-ambigu': ["if (k) m.set(k, m.has(k) ? 'ambigu' : b);", 'if (k && !m.has(k)) m.set(k, b);', 'sourceAchats.js'],
  'source-titre': ["if (!b || b === 'ambigu') return null;", "if (!b || b === 'ambigu') return /vinted/i.test(str(e.title)) ? { cle: 'vinted', libelle: 'Vinted', par: 'titre' } : null;", 'sourceAchats.js'],
  'moyenne-sur-tout': ['moyenne: g.nConnu ? Math.round(g.somme / g.nConnu) : null', 'moyenne: g.n ? Math.round(g.somme / g.n) : null', 'sourceAchats.js'],
  'partiel-tu': ["${g.partiel ? 'au plus ' : ''}", '', 'sourceAchats.js'],
  'manque-tu': ['if (g.nConnu < g.n) sur =', 'if (false) sur =', 'sourceAchats.js'],
  'sans-source-en-barre': ["    if (l.cle === 'non-saisie') { sansSource++; continue; }\n", '', 'sourceAchats.js'],
  'ecran-frise-absente': ['{pre.frisePv ? <FriseVente', '{false ? <FriseVente', 'App.jsx'],
  'ecran-rouge': ['color: var(--frv-warn); font-weight: 600; }', 'color: #D70015; font-weight: 600; }', 'styles-frise-vente.css'],
  'stats-second-calcul': ["import './styles-sources-achats.css';", "import './styles-sources-achats.css';\nimport { beneficePaire } from './beneficePaire.js';", 'SourcesAchats.jsx'],
};
if (process.argv.includes('--prouve')) {
  let n = 0;
  for (const k of Object.keys(MUTS)) {
    let code = 0; try { execFileSync(process.execPath, [__filename, '--mutation=' + k], { stdio: 'pipe' }); } catch (e) { code = e.status; }
    console.log(`${code === 1 ? '✅' : '❌'} mutation « ${k} » ⇒ ${code === 1 ? 'ROUGE' : 'pas attrapée (' + code + ')'}`); if (code === 1) n++;
  }
  console.log(`${n}/${Object.keys(MUTS).length} mutations attrapées`); process.exit(n === Object.keys(MUTS).length ? 0 : 1);
}
let SRC = path.join(R, 'src');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1];
if (MUT) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'frise-source-'));
  fs.cpSync(path.join(R, 'src'), path.join(d, 'src'), { recursive: true });
  fs.cpSync(path.join(R, 'api'), path.join(d, 'api'), { recursive: true });
  const f = path.join(d, 'src', MUTS[MUT][2] || 'friseProuvee.js'); const s = fs.readFileSync(f, 'utf8');
  if (!s.includes(MUTS[MUT][0])) { console.log('motif introuvable : ' + MUT); process.exit(2); }
  fs.writeFileSync(f, s.replace(MUTS[MUT][0], MUTS[MUT][1]));
  SRC = path.join(d, 'src');
  console.log('⚠️  MUTATION « ' + MUT + ' » — doit rougir');
}
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + d)); };
const lire = (f) => { try { return fs.readFileSync(path.join(SRC, f), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
const url = (f) => require('url').pathToFileURL(path.join(SRC, f)).href;

(async () => {
  let F, S;
  try { F = await import(url('friseProuvee.js')); S = await import(url('sourceAchats.js')); }
  catch (e) { dit(false, 'src/friseProuvee.js et src/sourceAchats.js existent et se chargent', e.message); console.log(`\n${ok} verts, ${ko} rouges`); process.exit(1); }

  console.log('\n── F. La frise d’une vente : chaque étape par SA preuve');
  const J = 864e5, T0 = Date.parse('2026-11-01T10:00:00Z');
  const iso = (j, h = 0) => new Date(T0 + j * J + h * 3600e3).toISOString();
  const N1 = 'XA123456789FR', N2 = 'XB987654321FR';
  const vente = (tx, status, extra = {}) => ({ transaction_id: tx, status, date: iso(0), title: 'Nike Dunk Low Panda 42', ...extra });
  const faits = (f) => f.etapes.filter((e) => e.etat === 'fait').map((e) => e.cle).join(',');
  const etat = (f, c) => (f.etapes.find((e) => e.cle === c) || {}).etat;
  const frise = (args, opts = {}) => F.friseProuvee({ preuves: F.preuvesFriseVinted(args), ...opts });

  const f1 = frise({ vente: vente(1, 'Le colis a été livré') });
  dit(faits(f1) === 'vendue,livree' && etat(f1, 'deposee') === 'paslu' && etat(f1, 'bordereau') === 'paslu', 'F1 « livré » lu seul : Vendue + Livrée ; Bordereau, Déposée, En route « pas lu » (jamais déduits)', faits(f1));
  const f2 = frise({ vente: vente(2, 'Commande finalisée'), etat: { s: 450 }, versement: iso(6) });
  dit(faits(f2) === 'vendue,finalisee,versee' && F.sousEtape(f2.etapes.find((e) => e.cle === 'versee')) !== 'pas lu', 'F2 finalisée + versée : Vendue, Finalisée, Versée (datée) — rien d’autre', faits(f2));
  const f3 = frise({ vente: vente(3, 'Commande finalisée'), etat: { s: 450 }, versement: null });
  dit(etat(f3, 'finalisee') === 'fait' && etat(f3, 'versee') === 'paslu', 'F3 finalisée sans date de versement lue ⇒ « Versée » pas lu', faits(f3));
  const bord = { suivi: N1, receivedAt: iso(0, 3) };
  const f4 = frise({ vente: vente(4, 'Le paiement a été validé'), bord, depart: { type: 'colis-fait', at: T0 + J, phrase: 'Colis fait le 2 nov.' } });
  const d4 = f4.etapes.find((e) => e.cle === 'deposee');
  dit(faits(f4) === 'vendue,bordereau,deposee' && d4.t === T0 + J, 'F4 bordereau par la transaction + « Colis fait » (règle du départ) : datés', JSON.stringify(f4.etapes.slice(0, 3)));
  const departs = new Map([[N1, { suivi: N1, carrier: 'chronopost', etat: 'livre', etatAt: iso(3), priseAt: iso(1, 6) }], [N2, { suivi: N2, carrier: 'chronopost', etat: 'livre', etatAt: iso(2), priseAt: iso(1) }]]);
  const f5 = frise({ vente: vente(5, 'Le paiement a été validé'), bord, departs });
  dit(etat(f5, 'enroute') === 'fait' && etat(f5, 'livree') === 'fait' && f5.etapes.find((e) => e.cle === 'livree').t === Date.parse(iso(3)), 'F5 le transporteur du n° de SON bordereau : En route (prise en charge) et Livrée, datés', faits(f5));
  const f5b = frise({ vente: vente(55, 'Le paiement a été validé'), bord: { suivi: 'XC000000001FR', receivedAt: iso(0) }, departs });
  dit(etat(f5b, 'enroute') === 'paslu' && etat(f5b, 'livree') === 'paslu', 'F6 la ligne d’un AUTRE n° ne prouve rien pour cette vente', faits(f5b));
  const emails = [{ suivi: N1, status: 'delivered', subject: 'Ton colis a été livré', emailAt: iso(4) }, { suivi: N1, status: 'transit', subject: 'Ton colis est en route', emailAt: iso(2) }];
  const f6 = frise({ vente: vente(6, 'Le paiement a été validé'), bord, emails, ambigus: new Set([N1]) });
  dit(etat(f6, 'enroute') === 'paslu' && etat(f6, 'livree') === 'paslu', 'F7 un n° AMBIGU (deux ventes, ou un achat) : ni En route ni Livrée', faits(f6));
  const f7 = frise({ vente: vente(7, 'Le paiement a été validé'), bord, emails });
  dit(etat(f7, 'enroute') === 'fait' && etat(f7, 'livree') === 'fait' && f7.etapes.find((e) => e.cle === 'livree').t === Date.parse(iso(4)), 'F8 e-mails « en route » / « livré » du MÊME n° : datés', faits(f7));
  const f8 = frise({ vente: vente(8, 'Le paiement a été validé'), bord, emails: [{ suivi: N1, status: 'delivered', subject: 'Livré', emailAt: iso(-5) }] });
  dit(etat(f8, 'livree') === 'paslu', 'F9 un e-mail daté de plus d’un jour AVANT la vente contredit l’identité : rien', faits(f8));
  const f9 = frise({ vente: vente(9, 'Colis déposé en bureau de poste ou point relais'), horsParcours: true });
  dit(etat(f9, 'deposee') === 'paslu', 'F10 vente en litige : l’état de LISTE « déposé » (colis de retour) ne prouve rien', faits(f9));
  // Le geste : seulement sur l'étape EN COURS qu'il attend.
  const g1 = F.friseProuvee({ preuves: F.preuvesFriseVinted({ vente: vente(10, 'Le paiement a été validé') }), geste: { cle: 'bordereau', libelle: 'à générer' } });
  dit(etat(g1, 'bordereau') === 'geste' && g1.etapes.filter((e) => e.etat === 'geste').length === 1, 'F11 à expédier sans bordereau : « Bordereau » ambre, seule', g1.etapes.map((e) => e.etat).join(','));
  const g2 = F.friseProuvee({ preuves: F.preuvesFriseVinted({ vente: vente(11, 'Le paiement a été validé') }), geste: { cle: 'deposee', libelle: 'à déposer' } });
  dit(!g2.etapes.some((e) => e.etat === 'geste'), 'F12 un geste attendu ailleurs que l’étape en cours n’allume rien', g2.etapes.map((e) => e.etat).join(','));
  // La bifurcation (src/litiges.js, src/retoursStock.js — jamais redécidée).
  const b1 = F.bifurcationVente({ litige: { genre: 'probleme', ancien: false } });
  const fb = F.friseProuvee({ preuves: F.preuvesFriseVinted({ vente: vente(12, 'Le colis a été livré'), bord }), bifurcation: b1, geste: { cle: 'deposee', libelle: 'x' } });
  dit(b1 && b1.geste && fb.bifurcation && fb.bifurcation.apres === fb.etapes.findIndex((e) => e.cle === 'livree') && fb.etapes.filter((e) => e.apresBif).map((e) => e.cle).join(',') === 'finalisee,versee' && !fb.etapes.some((e) => e.etat === 'geste'),
    'F13 un litige ouvert : bifurcation après la dernière étape prouvée (ambre : SA réponse), les suivantes pâlissent', JSON.stringify(fb.bifurcation));
  const b2 = F.bifurcationVente({ etiquette: '', annulee: true });
  dit(b2 && b2.genre === 'annulee' && !b2.geste, 'F14 une vente annulée : bifurcation « Annulée », neutre', JSON.stringify(b2));
  dit(F.bifurcationVente({ litige: { genre: 'probleme', ancien: true } }) === null, 'F15 un litige ancien (échéance passée) ne bifurque pas');
  const b3 = F.bifurcationVente({ retour: { etape: 'en-route' } });
  dit(b3 && b3.genre === 'retour' && /route/i.test(b3.sous), 'F16 un retour : l’étape du retour de src/retoursStock.js', JSON.stringify(b3));
  // 50 ventes au même titre : seule celle dont le n° est prouvé avance.
  const cinquante = Array.from({ length: 50 }, (_, k) => frise({ vente: vente(100 + k, 'Le paiement a été validé'), bord: { suivi: 'XD' + String(100000000 + k) + 'FR', receivedAt: iso(0) }, emails: [{ suivi: 'XD100000017FR', status: 'delivered', subject: 'Livré', emailAt: iso(3) }] }));
  dit(cinquante.filter((f) => etat(f, 'livree') === 'fait').length === 1 && etat(cinquante[17], 'livree') === 'fait', 'F17 50 ventes au même titre : « Livrée » pour la seule dont le n° est lu', String(cinquante.filter((f) => etat(f, 'livree') === 'fait').length));
  const fv = F.friseProuvee({ preuves: F.preuvesFriseVinted({ vente: vente(13, 'Le colis a été livré') }), verification: true });
  dit(fv.etapes.map((e) => e.cle).join(',') === 'vendue,bordereau,deposee,enroute,centre,livree,finalisee,versee' && etat(fv, 'centre') === 'paslu', 'F18 « centre de vérification » entre En route et Livrée, jamais coché', fv.etapes.map((e) => e.cle + ':' + e.etat).join(','));
  dit(F.sousEtape({ etat: 'paslu' }) === 'pas lu' && F.sousEtape({ etat: 'fait', t: null }) === 'lu' && /nov/.test(F.sousEtape({ etat: 'fait', t: T0 })), 'F19 sous une étape : la date, « lu », ou « pas lu »');

  console.log('\n── S. D’où viennent mes achats : la source lue ou saisie, jamais devinée');
  const cn = (x) => String(x).trim().toUpperCase().replace(/^0+(?=\d)/, '');
  const hors = S.horsParNumero([
    { id: 'h1', numero: '12', source: 'Leboncoin (main propre)' }, { id: 'h2', numero: '13', source: 'vide grenier' },
    { id: 'h3', numero: '14', source: 'Magasin' }, { id: 'h4', numero: '15', source: 'chez Paul' }, { id: 'h5', numero: '16', source: '' },
    { id: 'h6', numero: '17', source: 'Brocante' }, { id: 'h7', numero: '17', source: 'Magasin' }, { id: 'h8', numero: '18', source: 'Particulier' },
  ], cn);
  const reg = { achats: { g1: { fournisseur: 'p1' } }, hors: { h8: { fournisseur: 'p1' } } };
  const src = (e) => S.sourceDeVente(e, { hors, registre: reg, cleNum: cn });
  dit((src({ buyFromId: '987654321', numero: '12' }) || {}).cle === 'vinted', 'S1 un achat Vinted relié par SA transaction ⇒ Vinted (avant tout N°)');
  dit((src({ numero: '12' }) || {}).cle === 'leboncoin' && (src({ numero: '13' }) || {}).cle === 'vide-grenier' && (src({ numero: '014' }) || {}).cle === 'magasin', 'S2 la source SAISIE sur l’achat hors plateforme, relié par SON N° (« 014 » = « 14 »)');
  const libre = src({ numero: '15' });
  dit(libre && /^libre:/.test(libre.cle) && libre.libelle === 'Chez Paul', 'S3 un texte libre est gardé tel qu’il l’a écrit', JSON.stringify(libre));
  dit((src({ numero: '16' }) || {}).cle === 'non-saisie', 'S4 achat relié sans source écrite ⇒ « source pas saisie » (jamais devinée)');
  dit(src({ numero: '17' }) === null, 'S5 un N° porté par deux achats hors plateforme : ambigu ⇒ aucune source');
  dit(src({ numero: '99', title: 'Nike vinted Dunk', buyFrom: 'vinted' }) === null && src({ title: 'Acheté sur Vinted' }) === null, 'S6 sans achat relié, le titre ne dit rien ⇒ « achat pas relié »');
  dit((src({ buyGros: { id: 'g1' } }) || {}).cle === 'fournisseur' && (src({ numero: '18' }) || {}).cle === 'fournisseur', 'S7 achat en gros, achat hors plateforme rattaché à un fournisseur ⇒ Fournisseur');
  const r = S.beneficeParSource([
    { id: 'a', ts: 1, cle: 'vinted', libelle: 'Vinted', benefice: 3000 }, { id: 'b', ts: 1, cle: 'vinted', libelle: 'Vinted', benefice: 4000 },
    { id: 'c', ts: 1, cle: 'vinted', libelle: 'Vinted', benefice: null },
    { id: 'd', ts: 1, cle: 'magasin', libelle: 'Magasin', benefice: 5000, partiel: true },
    { id: 'e', ts: 1, cle: 'non-saisie', libelle: '', benefice: 900 }, { id: 'f', ts: 1, cle: null, libelle: '', benefice: 100 },
  ]);
  const gv = r.groupes.find((g) => g.cle === 'vinted'), gm = r.groupes.find((g) => g.cle === 'magasin');
  dit(gv && gv.moyenne === 3500 && gv.n === 3 && gv.nConnu === 2, 'S8 moyenne sur les ventes au bénéfice CONNU (35 €), couverture 2 sur 3', JSON.stringify(gv));
  const tv = S.texteSource(gv), tm = S.texteSource(gm);
  dit(/35 € en moyenne/.test(tv.montant) && /sur 2 ventes · prix d’achat manquant pour 1/.test(tv.sur), 'S9 « 35 € en moyenne · sur 2 ventes · prix d’achat manquant pour 1 »', JSON.stringify(tv));
  dit(/^au plus /.test(tm.montant) && ![tv.montant, tm.montant, tv.sur, tm.sur].some((t) => /au moins/.test(t)), 'S10 frais pas confirmés ⇒ « au plus » ; jamais « au moins » sur un bénéfice', JSON.stringify(tm));
  dit(r.sansSource === 1 && r.sansAchat === 1 && !r.groupes.some((g) => g.cle === 'non-saisie'), 'S11 source pas saisie, achat pas relié : comptés à part, jamais une barre', JSON.stringify({ s: r.sansSource, a: r.sansAchat }));
  dit(r.groupes[0].cle === 'magasin', 'S12 la moyenne la plus haute d’abord');
  dit(S.texteSource({ n: 2, nConnu: 0, moyenne: null }).montant === '—', 'S13 aucun bénéfice connu ⇒ « — » (jamais 0 €)');
  // 50 paires au même titre : chacune par SON N° (une seule a sa source saisie).
  const h50 = S.horsParNumero(Array.from({ length: 50 }, (_, k) => ({ id: 'z' + k, numero: String(200 + k), source: k === 7 ? 'Magasin' : '' })), cn);
  const s50 = Array.from({ length: 50 }, (_, k) => S.sourceDeVente({ numero: String(200 + k), title: 'Adidas Samba OG 40' }, { hors: h50, registre: {}, cleNum: cn }));
  dit(s50.filter((x) => x && x.cle === 'magasin').length === 1 && s50[7].cle === 'magasin', 'S14 50 paires au même titre : la source suit le N°, une seule « Magasin »');

  console.log('\n── E. Les écrans');
  const app = sansCommentaires(lire('App.jsx'));
  dit(/\{pre\.frisePv \? <FriseVente frise=\{pre\.frisePv\.frise\}/.test(app) && !/<RecapFrise etapes=\{etapes\} cle=\{txL\}/.test(app), 'E1 le récapitulatif de la vente rend la frise prouvée (plus la frise déduite)');
  dit(/friseProuveeDe\(o, litige\)/.test(app) && /preuvesFriseVinted\(\{ vente: o, bord, label/.test(app), 'E2 la frise est calculée par vente, par SA transaction');
  dit(/publierSources\(lignes/.test(app) && /beneficeLigneVente\(o\.price && o\.price\.amount, e\);\s*const src = e \? sourceDeVente\(e, ctx\)/.test(app), 'E3 Ventes publie la source avec le bénéfice de la règle unique');
  const sa = sansCommentaires(lire('SourcesAchats.jsx'));
  dit(/lireSources\(owner\)/.test(sa) && !/beneficePaire|beneficeLigne|coutVente/.test(sa), 'E4 Statistiques LIT la publication, aucun second calcul du bénéfice');
  dit(/<SourcesAchats owner=/.test(sansCommentaires(lire('ecrans/Stats.jsx'))), 'E5 la carte est dans Statistiques');
  const css = lire('styles-frise-vente.css') + lire('styles-sources-achats.css');
  dit(!/#(D70015|FF3B30|FF453A|E30000|C00|F00)\b|\bred\b/i.test(css), 'E6 jamais de rouge (ambre = geste, accent rare)');
  dit(/'Magasin'/.test(lire('ecrans/Achats.jsx')), 'E7 « Magasin » dans la liste courte de « Où »');

  console.log(`\n${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
