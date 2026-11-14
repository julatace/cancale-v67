// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LISTES — RECHERCHE EN PHRASE, ÉPINGLES, GLISSER, COMPARER (14 nov., chantiers 92–95)
//   node scripts/audit-listes-recherche.cjs            les règles, EXÉCUTÉES
//   node scripts/audit-listes-recherche.cjs --prouve   chaque mutation doit rendre l'audit rouge
// ═══════════════════════════════════════════════════════════════════════════
// Il charge les VRAIS modules (copiés tels quels dans un dossier temporaire, une mutation
// appliquée si demandée) et juge :
//   A. l'analyseur (src/recherchePhrase.js) sur 81 phrases en 5 langues — les filtres
//      produits, EXACTEMENT (ni un de plus, ni un de moins), pièges compris : « 42 » taille
//      (ambiguë) contre « N°42 », « B230 », « 550 » (N°, sauf New Balance), « moins de
//      7 jours » (durée) contre « moins de 80 » (prix), « 42 € » (prix) ;
//   B. le filtrage : pas su ⇒ écartée ET comptée, un filtre sans accesseur « pas ici »,
//      la réécriture d'une capsule à la place exacte de ses mots ;
//   C. la vitesse : analyser + filtrer 2 000 paires < 50 ms (à froid et à chaud) ;
//   D. les épingles (src/epingles.js) : 20 au plus, par identité (50 paires au même titre :
//      une seule épinglée), la republiée suit son N° seulement s'il est seul, deux appareils
//      fusionnés (src/fusionNuage.js) gardent les deux épingles, un retrait se propage ;
//   E. glisser (src/glisserSelection.js) : plage dans l'ordre affiché, retour en arrière,
//      lignes exclues intactes, vitesse aux bords ;
//   F. comparer (src/comparerPaires.js) : deux choisies par identité, « pas su » = null,
//      marge seulement si prix ET achat sont connus.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const SRC = path.join(__dirname, '..', 'src');
const FICHIERS = ['recherchePhrase.js', 'epingles.js', 'glisserSelection.js', 'comparerPaires.js', 'fusionNuage.js'];

const MUTATIONS = {
  'taille-vs-numero': ['recherchePhrase.js', '    if (v >= 16 && v <= 52) poser(', '    if (false) poser('],
  'lettre-numero': ['recherchePhrase.js', "  chaque(RE.numeroLettre, (m, de, a) => poser({ k: 'numero', v: cleNumeroPhrase(m[1]) }, de, a));", ''],
  'nb-exige': ['recherchePhrase.js', "if (rest[0] === 'nb' && !ditNb) return;", ''],
  'duree-lt': ['recherchePhrase.js', "op: m[1] ? '<' : '>='", "op: '>='"],
  'demain': ['recherchePhrase.js', "['demain', 1, [", "['demain', 0, ["],
  'pas-su-vaut-oui': ['recherchePhrase.js', 'const r = tient(f, it); if (r === true) continue;', 'const r = tient(f, it); if (r === true || r === null) continue;'],
  'prix-avant-taille': ['recherchePhrase.js', "  chaque(RE.prixExact, (m, de, a) => { const v = Number(String(m[1] || m[2]).replace(',', '.')); poser({ k: 'prix', min: v, max: v }, de, a); });", ''],
  'epingle-max': ['epingles.js', 'if (Object.keys(out).length >= MAX_EPINGLES)', 'if (false)'],
  'epingle-num-ambigu': ['epingles.js', 'parNum.set(c, parNum.has(c) ? null : k)', 'parNum.set(c, k)'],
  'epingle-par-titre': ['epingles.js', '    const k = cleEpingle(uid(a), id(a)); parCle.set(k, a);', '    const k = cleEpingle(uid(a), id(a)); parCle.set(k, a); parCle.set(cleEpingle(uid(a), a.titre), a);'],
  'glisse-exclues': ['glisserSelection.js', 'if (exclues.has(k)) continue;', ''],
  'glisse-retour': ['glisserSelection.js', 'const out = new Set(avant || []);', 'const out = new Set([...(avant || []), ...(globalThis.__dejaGlisse || [])]); globalThis.__dejaGlisse = [...(plage || [])];'],
  'comparer-marge': ['comparerPaires.js', 'v.prix != null && v.achat != null ?', 'v.prix != null ?'],
  'comparer-titre': ['comparerPaires.js', "const idx = new Map((annonces || []).map((a) => [str(a.uid) + ':' + str(a.id), a]));", "const idx = new Map((annonces || []).map((a) => [str(a.uid) + ':' + str(a.id), (annonces || []).find((b) => b.titre === a.titre) || a]));"],
};

const arg = process.argv.slice(2);
const mut = (arg.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
if (arg.includes('--prouve')) {
  let ok = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    console.log(`${r.status !== 0 && rouges ? '✅' : '❌'} mutation « ${m} » : ${rouges} rouge(s)`);
    if (r.status !== 0 && rouges) ok++;
  }
  console.log(`\n${ok}/${Object.keys(MUTATIONS).length} mutations attrapées.`);
  process.exit(ok === Object.keys(MUTATIONS).length ? 0 : 1);
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'listes-recherche-'));
  for (const f of FICHIERS) {
    const p = path.join(SRC, f);
    if (!fs.existsSync(p)) { console.log(`❌ src/${f} absent : la règle n’existe pas`); process.exit(1); }
    let s = fs.readFileSync(p, 'utf8');
    if (mut && MUTATIONS[mut] && MUTATIONS[mut][0] === f) {
      const [, a, b] = MUTATIONS[mut];
      if (!s.includes(a)) { console.log('❌ ancre de mutation introuvable : ' + mut); process.exit(1); }
      s = s.replace(a, b);
    }
    fs.writeFileSync(path.join(dir, f.replace(/\.js$/, '.mjs')), s.replace(/from '\.\/([A-Za-z]+)\.js'/g, "from './$1.mjs'"));
  }
  if (mut && !MUTATIONS[mut]) { console.log('mutation inconnue : ' + mut); process.exit(2); }
  const imp = async (f) => import(pathToFileURL(path.join(dir, f.replace(/\.js$/, '.mjs'))).href);
  let P, E, G, C, F;
  try { [P, E, G, C, F] = await Promise.all(FICHIERS.map(imp)); } catch (e) { console.log('❌ un module ne se charge pas : ' + e.message); process.exit(1); }
  let ko = 0, n = 0;
  const dit = (c, msg, det) => { n++; if (c) { if (!process.env.SILENCE) console.log('✅ ' + msg); } else { ko++; console.log('❌ ' + msg + (det !== undefined ? ' — ' + JSON.stringify(det).slice(0, 400) : '')); } };
  const essaie = (nom, fn) => { try { fn(); } catch (e) { ko++; n++; console.log('❌ ' + nom + ' a levé : ' + e.message); } };

  // ── A. L'analyseur, 81 phrases (le samedi 14 nov. 2026 à midi, Paris) ──
  const M = Date.parse('2026-11-14T11:00:00Z');
  const sig = (f) => {
    switch (f.k) {
      case 'taille': return `taille=${f.v}${f.ambigu ? '?' : ''}`;
      case 'prix': return f.min != null && f.max != null ? (f.min === f.max ? `prix=${f.min}` : `prix=${f.min}-${f.max}`) : f.max != null ? `prix<${f.max}` : `prix>${f.min}`;
      case 'depuis': return `depuis${f.op === '<' ? '<' : '>='}${f.jours}`;
      case 'jour': return `jour${f.avant ? '<=' : '='}${f.jusqua}`;
      case 'mots': return `mots=${f.v.join('+')}`;
      default: return `${f.k}=${f.v}`;
    }
  };
  const PHRASES = [
    // français
    ['nike 42 pas vendue depuis 2 mois', ['marque=Nike', 'taille=42?', 'etat=en-ligne', 'depuis>=60']],
    ['colis mondial relay demain', ['quoi=colis', 'transporteur=mondialrelay', 'jour=2026-11-15']],
    ['N°42', ['numero=42']],
    ['B230', ['numero=B230']],
    ['taille 42 vans old skool', ['taille=42', 'marque=Vans', 'modele=Old Skool']],
    ['adidas samba < 80 €', ['marque=Adidas', 'modele=Samba', 'prix<80']],
    ['salomon xt-6 entre 50 et 90 €', ['marque=Salomon', 'modele=XT-6', 'prix=50-90']],
    ['new balance 550 taille 43', ['marque=New Balance', 'modele=550', 'taille=43']],
    ['550', ['numero=550']],
    ['nike 550', ['marque=Nike', 'numero=550']],
    ['colis à retirer chronopost avant vendredi', ['quoi=colis', 'etat=a-retirer', 'transporteur=chronopost', 'jour<=2026-11-20']],
    ['vendues hier', ['etat=vendue', 'jour=2026-11-13']],
    ['jordan 1 chicago', ['modele=Jordan 1', 'mots=chicago']],
    ['asics 42,5 plus de 60 €', ['marque=Asics', 'taille=42.5', 'prix>60']],
    ['en ligne depuis moins de 7 jours', ['etat=en-ligne', 'depuis<7']],
    ['#128 vendue hier', ['numero=128', 'etat=vendue', 'jour=2026-11-13']],
    ['brouillons nike', ['etat=brouillon', 'marque=Nike']],
    ["colis à expédier aujourd'hui", ['quoi=colis', 'etat=a-expedier', 'jour=2026-11-14']],
    ['42', ['taille=42?']],
    ['air max 90 t43 masquées', ['modele=Air Max 90', 'taille=43', 'etat=masquee']],
    ['nike 42 €', ['marque=Nike', 'prix=42']],
    ['moins de 80', ['prix<80']],
    // anglais
    ['unsold nike size 44 for 3 weeks', ['etat=en-ligne', 'marque=Nike', 'taille=44', 'depuis>=21']],
    ['mondial relay parcel tomorrow', ['transporteur=mondialrelay', 'quoi=colis', 'jour=2026-11-15']],
    ['sold yesterday', ['etat=vendue', 'jour=2026-11-13']],
    ['adidas gazelle under 70 €', ['marque=Adidas', 'modele=Gazelle', 'prix<70']],
    ['no. 87', ['numero=87']],
    ['pairs to pick up before friday', ['etat=a-retirer', 'jour<=2026-11-20']],
    ['puma speedcat over 40 euros', ['marque=Puma', 'modele=Speedcat', 'prix>40']],
    ['drafts', ['etat=brouillon']],
    ['online for more than 2 months', ['etat=en-ligne', 'depuis>=60']],
    ['converse chuck 70 size 41', ['marque=Converse', 'modele=Chuck 70', 'taille=41']],
    ['items sold today', ['etat=vendue', 'jour=2026-11-14']],
    ['b17', ['numero=B17']],
    ['hoka 45 less than 10 days', ['marque=Hoka', 'taille=45?', 'depuis<10']],
    ['vinted go parcels', ['transporteur=vinted', 'quoi=colis']],
    ['price 52', ['prix=52']],
    // espagnol
    ['zapatillas adidas talla 42 no vendidas desde hace 2 meses', ['marque=Adidas', 'taille=42', 'etat=en-ligne', 'depuis>=60']],
    ['paquete correos mañana', ['quoi=colis', 'transporteur=correos', 'jour=2026-11-15']],
    ['vendidas ayer', ['etat=vendue', 'jour=2026-11-13']],
    ['nike dunk low menos de 90 €', ['marque=Nike', 'modele=Dunk Low', 'prix<90']],
    ['por recoger antes del viernes', ['etat=a-retirer', 'jour<=2026-11-20']],
    ['número 230', ['numero=230']],
    ['borradores', ['etat=brouillon']],
    ['veja campo más de 50 €', ['marque=Veja', 'modele=Campo', 'prix>50']],
    ['asics talla 44 en línea', ['marque=Asics', 'taille=44', 'etat=en-ligne']],
    ['anuncios new balance 9060', ['quoi=annonce', 'marque=New Balance', 'modele=9060']],
    ['hoy', ['jour=2026-11-14']],
    ['sin vender desde hace 3 semanas', ['etat=en-ligne', 'depuis>=21']],
    ['paquetes mondial relay pasado mañana', ['quoi=colis', 'transporteur=mondialrelay', 'jour=2026-11-16']],
    ['salomon 43 por enviar', ['marque=Salomon', 'taille=43?', 'etat=a-expedier']],
    ['entre 30 y 60 €', ['prix=30-60']],
    // italien
    ['scarpe nike 41 non vendute da 3 mesi', ['marque=Nike', 'taille=41?', 'etat=en-ligne', 'depuis>=90']],
    ['pacco mondial relay domani', ['quoi=colis', 'transporteur=mondialrelay', 'jour=2026-11-15']],
    ['vendute ieri', ['etat=vendue', 'jour=2026-11-13']],
    ['adidas spezial meno di 75 €', ['marque=Adidas', 'modele=Spezial', 'prix<75']],
    ['da ritirare entro venerdì', ['etat=a-retirer', 'jour<=2026-11-20']],
    ['numero 15', ['numero=15']],
    ['bozze', ['etat=brouillon']],
    ['taglia 38 puma palermo', ['taille=38', 'marque=Puma', 'modele=Palermo']],
    ['online da più di 2 mesi', ['etat=en-ligne', 'depuis>=60']],
    ['nascoste', ['etat=masquee']],
    ['annunci nike oggi', ['quoi=annonce', 'marque=Nike', 'jour=2026-11-14']],
    ['converse all star tra 40 e 60 €', ['marque=Converse', 'modele=All Star', 'prix=40-60']],
    ['n°B12 venduta', ['numero=B12', 'etat=vendue']],
    ['da spedire dopodomani', ['etat=a-expedier', 'jour=2026-11-16']],
    ['asics gel-1130 44', ['marque=Asics', 'modele=Gel-1130', 'taille=44?']],
    // allemand
    ['Nike Größe 42 nicht verkauft seit 2 Monaten', ['marque=Nike', 'taille=42', 'etat=en-ligne', 'depuis>=60']],
    ['Paket Mondial Relay morgen', ['quoi=colis', 'transporteur=mondialrelay', 'jour=2026-11-15']],
    ['gestern verkauft', ['etat=vendue', 'jour=2026-11-13']],
    ['Adidas Samba unter 80 €', ['marque=Adidas', 'modele=Samba', 'prix<80']],
    ['abzuholen bis Freitag', ['etat=a-retirer', 'jour<=2026-11-20']],
    ['Nr. 42', ['numero=42']],
    ['Entwürfe', ['etat=brouillon']],
    ['New Balance 2002R Größe 44,5', ['marque=New Balance', 'modele=2002R', 'taille=44.5']],
    ['online seit mehr als 3 Wochen', ['etat=en-ligne', 'depuis>=21']],
    ['versteckt', ['etat=masquee']],
    ['Pakete DHL heute', ['quoi=colis', 'transporteur=dhl', 'jour=2026-11-14']],
    ['Salomon XT-6 über 100 €', ['marque=Salomon', 'modele=XT-6', 'prix>100']],
    ['zu versenden übermorgen', ['etat=a-expedier', 'jour=2026-11-16']],
    ['Puma 40 verkauft vor 2 Wochen', ['marque=Puma', 'taille=40?', 'etat=vendue', 'depuis>=14']],
    ['B230 Jordan 4', ['numero=B230', 'modele=Jordan 4']],
  ];
  let bonnes = 0;
  for (const [q, attendu] of PHRASES) essaie(q, () => {
    const a = P.analyserPhrase(q, { maintenant: M });
    const eu = a.filtres.map(sig).sort(); const voulu = [...attendu].sort();
    const ok = eu.length === voulu.length && eu.every((x, i) => x === voulu[i]);
    if (ok) bonnes++;
    dit(ok, `« ${q} » ⇒ ${voulu.join(' · ')}`, eu);
  });
  dit(PHRASES.length >= 80 && bonnes === PHRASES.length, `${bonnes}/${PHRASES.length} phrases comprises (5 langues)`);
  essaie('estPhrase', () => {
    dit(!P.estPhrase(P.analyserPhrase('128')), '« 128 » seul reste la recherche par N° (pas une phrase)');
    dit(!P.estPhrase(P.analyserPhrase('42')), '« 42 » seul reste la recherche d’avant (le N° ou le titre)');
    dit(!P.estPhrase(P.analyserPhrase('52 €')), '« 52 € » seul reste le montant de la loupe');
    dit(P.estPhrase(P.analyserPhrase('nike 42')), '« nike 42 » est une phrase (marque + taille)');
    dit(!P.estPhrase(P.analyserPhrase('chicago bulls')), 'des mots seuls ne sont pas une phrase (titre, comme avant)');
  });
  // Les positions : chaque filtre garde la place EXACTE de ses mots dans le texte tapé.
  essaie('positions', () => {
    const q = 'Nike Größe 42 nicht verkauft seit 2 Monaten';
    const a = P.analyserPhrase(q, { maintenant: M });
    dit(a.filtres.every((f) => f.k === 'mots' || q.slice(f.de, f.a) === f.src), 'chaque capsule pointe ses mots dans le texte tapé', a.filtres.map((f) => [f.src, q.slice(f.de, f.a)]));
    const t = a.filtres.find((f) => f.k === 'taille');
    dit(P.retirerFiltre(q, t) === 'Nike nicht verkauft seit 2 Monaten', 'retirer la capsule « Taille 42 » retire « Größe 42 » du texte', P.retirerFiltre(q, t));
    const b = P.analyserPhrase('nike 42 pas vendue', { maintenant: M });
    const amb = b.filtres.find((f) => f.k === 'taille');
    const q2 = P.remplacerFiltre('nike 42 pas vendue', amb, 'N°42');
    dit(q2 === 'nike N°42 pas vendue' && P.analyserPhrase(q2).filtres.some((f) => f.k === 'numero' && f.v === '42'), '« C’est un N° » réécrit « 42 » en « N°42 », relu comme un N°', q2);
  });

  // ── B. Le filtrage ──
  const ANN = [];
  const MQ = ['Nike', 'Adidas', 'Salomon', 'New Balance', 'Asics', 'Vans'], MOD = ['Air Max 90', 'Samba', 'XT-6', '550', 'Gel-1130', 'Old Skool'];
  for (let i = 0; i < 2000; i++) ANN.push({ id: 'a' + i, title: `${MQ[i % 6]} ${MOD[i % 6]} taille ${36 + (i % 10)}`, brand: i % 97 === 0 ? null : MQ[i % 6], size: i % 89 === 0 ? null : String(36 + (i % 10)), price: 30 + (i % 90), numero: String(i + 1), age: i % 120, etat: 'en-ligne' });
  const acces = { titre: (it) => it.title, marque: (it) => it.brand, taille: (it) => it.size, numero: (it) => it.numero, prix: (it) => it.price, age: (it) => it.age, etat: (it) => it.etat };
  essaie('filtrer', () => {
    const a = P.analyserPhrase('nike 42 pas vendue depuis 2 mois', { maintenant: M });
    const r = P.filtrerPhrase(ANN, a.filtres, { acces, quoi: 'annonce', etats: ['en-ligne'] });
    const attendus = ANN.filter((x) => (x.brand === 'Nike' || /nike/i.test(x.title)) && x.size === '42' && x.age >= 60);
    dit(r.liste.length === attendus.length && r.liste.length > 0, `« nike 42 pas vendue depuis 2 mois » : ${r.liste.length} paires, les bonnes`, [r.liste.length, attendus.length]);
    const tId = a.filtres.find((f) => f.k === 'taille').id;
    const sansTaille = ANN.filter((x) => (x.brand === 'Nike' || /nike/i.test(x.title)) && x.size == null).length;
    dit(r.pasSu[tId] === sansTaille && sansTaille > 0, `taille pas lue : ${sansTaille} paires ÉCARTÉES et comptées (« pas su » ≠ « oui »)`, r.pasSu);
    const c = P.analyserPhrase('colis mondial relay demain', { maintenant: M });
    const rc = P.filtrerPhrase(ANN, c.filtres, { acces, quoi: 'annonce', etats: ['en-ligne'] });
    dit(rc.ignores.length === 3 && P.ailleurs(c, { quoi: 'annonce', etats: ['en-ligne'] }) === 'colis', 'dans Annonces, « colis mondial relay demain » : 3 filtres « pas ici » et la loupe proposée', rc.ignores);
    const rien = P.filtrerPhrase(ANN, P.analyserPhrase('veja campo').filtres, { acces });
    dit(rien.n === 0 && rien.liste.length === 0, 'rien ne correspond ⇒ 0 (l’écran le dit), jamais une paire voisine');
    const num = P.filtrerPhrase(ANN, P.analyserPhrase('adidas N°2').filtres, { acces });
    dit(num.n === 1 && num.liste[0].id === 'a1', '« adidas N°2 » : la paire de CE N°, une seule');
    const v = P.analyserPhrase('vendue hier', { maintenant: M });
    const rv = P.filtrerPhrase([{ title: 'x', d: '2026-11-13' }, { title: 'y', d: '2026-11-12' }, { title: 'z', d: null }], v.filtres, { acces: { titre: (x) => x.title, etat: () => 'vendue', jour: (x) => x.d }, quoi: 'vente', etats: ['vendue'] });
    dit(rv.n === 1 && rv.liste[0].title === 'x' && rv.pasSu[v.filtres.find((f) => f.k === 'jour').id] === 1, '« vendue hier » : la vente du 13, la vente sans date comptée « pas lue »', rv);
    const col = P.analyserPhrase('colis mondial relay demain', { maintenant: M });
    const rcol = P.filtrerPhrase([{ nom: 'A', transporteur: 'mondialrelay', limite: '2026-11-15' }, { nom: 'B', transporteur: 'chronopost', limite: '2026-11-15' }, { nom: 'C', transporteur: 'Mondial Relay', limite: '2026-11-16' }],
      col.filtres, { quoi: 'colis', etats: ['a-retirer'], acces: { titre: (c) => c.nom, transporteur: (c) => c.transporteur, jour: (c) => c.limite, etat: () => 'a-retirer' } });
    dit(rcol.n === 1 && rcol.liste[0].nom === 'A', '« colis mondial relay demain » : le colis Mondial Relay dont la limite est demain, lui seul', rcol.liste);
  });

  // ── C. La vitesse : < 50 ms sur 2 000 paires (analyser + filtrer), à froid puis à chaud ──
  essaie('vitesse', () => {
    const marques = [...new Set(ANN.map((x) => x.brand).filter(Boolean))];
    const mesure = () => { const t0 = process.hrtime.bigint(); const a = P.analyserPhrase('nike 42 pas vendue depuis 2 mois < 100 €', { maintenant: M, marques }); P.filtrerPhrase(ANN, a.filtres, { acces, quoi: 'annonce', etats: ['en-ligne'] }); return Number(process.hrtime.bigint() - t0) / 1e6; };
    const froid = mesure(); const chauds = Array.from({ length: 20 }, mesure).sort((a, b) => a - b);
    const med = chauds[10];
    dit(froid < 50, `à froid : ${froid.toFixed(1)} ms sur 2 000 paires (< 50 ms)`);
    dit(med < 50, `à chaud : ${med.toFixed(1)} ms (médiane de 20, < 50 ms)`);
  });

  // ── D. Les épingles ──
  essaie('epingles', () => {
    const paires = Array.from({ length: 25 }, (_, i) => ({ uid: '111', id: String(9000 + i), numero: String(i + 1) }));
    const r = E.basculerEpingles({}, paires, { maintenant: 1000 });
    dit(r.faites === 20 && r.refusees === 5 && Object.keys(r.v).length === 20, '25 demandées ⇒ 20 posées, 5 refusées et dites (20 au plus)', [r.faites, r.refusees]);
    const t50 = Array.from({ length: 50 }, (_, i) => ({ uid: '111', id: String(7000 + i), numero: String(300 + i), titre: 'Jordan 1 Mid Chicago taille 42' }));
    const un = E.basculerEpingles({}, [t50[17]], { maintenant: 5 }).v;
    const rang = E.epinglesPresentes(un, t50, { uid: (a) => a.uid, id: (a) => a.id, numero: (a) => a.numero });
    dit(rang.size === 1 && rang.has(E.cleEpingle('111', '7017')), '50 paires au même titre : une seule épinglée, celle de SON id', [...rang.keys()]);
    const ordre = E.epinglesEnTete(t50, rang, (a) => E.cleEpingle(a.uid, a.id));
    dit(ordre[0].id === '7017' && ordre.length === 50 && ordre[1].id === '7000', 'l’épinglée passe en tête, les 49 autres gardent leur ordre, rien ne sort');
    // republiée : nouvel id, même N° ⇒ elle suit (N° seul) ; N° porté par deux annonces ⇒ on ne choisit pas
    const repub = t50.map((a) => (a.id === '7017' ? { ...a, id: '8017' } : a));
    const r2 = E.epinglesPresentes(un, repub, { uid: (a) => a.uid, id: (a) => a.id, numero: (a) => a.numero });
    dit(r2.size === 1 && r2.has(E.cleEpingle('111', '8017')), 'republiée (nouvel id, même N°) : l’épingle la suit par son N°');
    const doublon = [...repub, { uid: '111', id: '8999', numero: '317' }];
    const r3 = E.epinglesPresentes(un, doublon, { uid: (a) => a.uid, id: (a) => a.id, numero: (a) => a.numero });
    dit(r3.size === 0, 'deux annonces sous le N°317 : l’épingle ne choisit pas (aucune)', [...r3.keys()]);
    const autreCompte = repub.map((a) => (a.id === '8017' ? { ...a, uid: '222' } : a));
    dit(E.epinglesPresentes(un, autreCompte, { uid: (a) => a.uid, id: (a) => a.id, numero: (a) => a.numero }).size === 0, 'le même N° sur un AUTRE compte ne reçoit pas l’épingle');
    // deux appareils : chacun épingle une paire ; la fusion à trois voies garde les deux ; un retrait se propage
    const base = E.basculerEpingles({}, [t50[1]], { maintenant: 10 }).v;
    const iphone = E.basculerEpingles(base, [t50[2]], { maintenant: 20 }).v;
    const mac = E.basculerEpingles(base, [t50[3]], { maintenant: 30 }).v;
    const fus = F.fusion3(base, iphone, mac);
    const k = Object.keys((fus && fus.v) || fus || {}).sort();
    dit(k.length === 3, 'iPhone épingle une paire, le Mac une autre : la fusion garde les trois', k);
    const retire = E.basculerEpingles(base, [t50[1]], { poser: false }).v;
    const fus2 = F.fusion3(base, retire, mac);
    const k2 = Object.keys((fus2 && fus2.v) || fus2 || {});
    dit(!k2.includes(E.cleEpingle('111', '7001')) && k2.includes(E.cleEpingle('111', '7003')), 'une épingle retirée sur un appareil est retirée de la fusion, l’autre reste', k2);
    dit(Object.keys(E.epinglesPropres({ x: 1, 'a:1:2': { t: 'abc' }, 'a:1:3': { t: 5, uid: '1', id: '3' } })).length === 1, 'une valeur abîmée est ignorée, jamais une erreur');
  });

  // ── E. Glisser pour cocher ──
  essaie('glisser', () => {
    const ordre = Array.from({ length: 60 }, (_, i) => 'k' + i);
    dit(G.plageGlissee(ordre, 'k5', 'k34').length === 30, 'de la ligne 5 à la ligne 34 : 30 lignes');
    dit(G.plageGlissee(ordre, 'k34', 'k5').join() === G.plageGlissee(ordre, 'k5', 'k34').join(), 'vers le haut comme vers le bas');
    const avant = new Set(['k40']);
    const s1 = G.selectionGlissee(avant, G.plageGlissee(ordre, 'k5', 'k34'), true, new Set(['k10']));
    dit(s1.size === 30 && !s1.has('k10') && s1.has('k40'), '30 cochées en glissant, la ligne exclue (sa raison) reste décochée, une case d’avant reste cochée', [...s1].length);
    const s2 = G.selectionGlissee(avant, G.plageGlissee(ordre, 'k5', 'k8'), true, new Set());
    dit(s2.size === 5 && !s2.has('k20'), 'revenir en arrière rend aux lignes quittées leur état d’avant', [...s2]);
    const s3 = G.selectionGlissee(new Set(ordre), G.plageGlissee(ordre, 'k0', 'k9'), false, new Set());
    dit(s3.size === 50 && !s3.has('k3'), 'partir d’une case cochée décoche la plage');
    dit(G.vitesseBord(400, 100, 800) === 0 && G.vitesseBord(105, 100, 800) < 0 && G.vitesseBord(795, 100, 800) > 0 && G.vitesseBord(799, 100, 800) > G.vitesseBord(740, 100, 800), 'défilement auto : rien au milieu, vers le haut au bord haut, plus vite tout contre le bord');
  });

  // ── F. Comparer ──
  essaie('comparer', () => {
    const l = [{ uid: '1', id: '10', titre: 'Jordan 1 Chicago', prix: 120, verif: { achat: 70 }, createdTs: Date.parse('2026-10-15T00:00:00Z'), condition: 'Très bon état', taille: '42' },
      { uid: '1', id: '11', titre: 'Jordan 1 Chicago', prix: 110, verif: { achat: null }, createdTs: null, condition: '', taille: '42' },
      { uid: '2', id: '10', titre: 'Autre', prix: 50 }];
    const d = C.deuxChoisies([{ uid: '1', id: '11' }, { uid: '1', id: '10' }], l);
    dit(d && d[0].id === '11' && d[1].id === '10' && d[0].uid === '1', 'deux paires au même titre : chacune SA colonne, par compte + id');
    dit(C.deuxChoisies([{ uid: '1', id: '10' }], l) === null && C.deuxChoisies([{ uid: '1', id: '10' }, { uid: '9', id: '9' }], l) === null, 'une seule, ou une pas lue ⇒ pas de comparaison');
    const lg = Object.fromEntries(C.lignesComparaison(l[0], l[1], { maintenant: M }).map((x) => [x.k, x]));
    dit(lg.marge.a === 50 && lg.marge.b === null, 'marge : 50 € quand prix ET achat sont connus, « — » sinon (jamais le prix seul)', lg.marge);
    dit(lg.achat.b === null && lg.depuis.b === null && lg.etat.b === null, 'achat, délai, état pas lus ⇒ null (« — »), jamais 0', [lg.achat, lg.depuis, lg.etat]);
    dit(lg.depuis.a === 30 && lg.prix.a === 120 && lg.prix.b === 110, 'en ligne depuis 30 j ; prix 120 € contre 110 €', [lg.depuis, lg.prix]);
    const cles = C.lignesComparaison(l[0], l[1]).map((x) => x.k);
    dit(['achat', 'prix', 'depuis', 'etat'].every((x) => cles.includes(x)), 'les colonnes demandées : achat, prix, délai, état');
  });

  console.log(`\n${ko ? '❌' : '✅'} audit-listes-recherche : ${n - ko} verts, ${ko} rouge(s)`);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  process.exit(ko ? 1 : 0);
})();
