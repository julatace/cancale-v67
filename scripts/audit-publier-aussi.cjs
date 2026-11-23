#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « PUBLIER AUSSI SUR… » — LA RÈGLE ET SES CORRESPONDANCES (21 nov., ext. 5.424, `publieraussi`)
//        node scripts/audit-publier-aussi.cjs [--prouve]
//
//  Julien : « il faut que ce soit parfait et irréprochable ». Ce qui tourne ici : la VRAIE règle de l'app
//  (src/publier/aussi.js → l'agent src/publier/agent.js et ses tables), importée, jamais une phrase :
//   T  les correspondances, AUCUNE approximative : la pointure EU passe telle quelle, toute autre grille (US, UK, 42 ⅔,
//      9,5…) n'a AUCUNE conversion (« à choisir ») ; chaque pointure rendue est dans la liste du site ; l'état, la
//      couleur, la marque : le libellé EXACT du site ou « à choisir » (jamais « le plus proche ») ; chaque catégorie de
//      la table vérifiée existe telle quelle dans les listes de Leboncoin et de Vestiaire ;
//   P  le prix : le même ou +N % (choix fermés), à l'euro supérieur, JAMAIS sous le plancher (prix mini / achat + 10 %) ;
//   F  la feuille : catégorie inconnue ⇒ à choisir, rien de prêt ; 50 annonces au même titre ⇒ la source est CELLE
//      de l'identifiant (photos, N°, « Réf. VRM-{N°} ») ; un champ à choisir ⇒ aucun envoi ;
//   R  la relecture du formulaire : un champ différent ou pas relu ⇒ refus nommé ; tout égal ⇒ ok ;
//   D  « déjà publiée » par IDENTITÉ seulement (une annonce au même titre sans référence n'est PAS « déjà ») ;
//      une lecture ratée ⇒ « pas su » (null), jamais « pas encore publiée » ;
//   X  la copie de l'extension est celle de l'app (scripts/recopier-gardes-extension.cjs --verifie).
//  `--prouve` : chaque règle réaffaiblie dans src/publier/aussi.js rend l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const R = path.join(__dirname, '..');
const F_AUSSI = path.join(R, 'src/publier/aussi.js');

const MUTATIONS = {
  usConverti: ["  const m = /^(?:EU ?)?(\\d{2}(?:[.,]5)?)(?: ?EU)?$/i.exec(s);", "  const m = /^(?:EU ?|US ?|UK ?)?(\\d{1,2}(?:[.,]5)?)(?: ?EU)?$/i.exec(s);"],
  sousPlancher: ["  if (pl && ent < pl.valeur - 1e-9) return { ok: false, code: 'sous-plancher', prix: ent, plancher: pl };", ''],
  arrondiBas: ['  const ent = Math.ceil(brut - 1e-9);', '  const ent = Math.floor(brut);'],
  relectureAveugle: ["    if (!egal) ecarts.push({ champ: k, attendu: va, lu: vl, code: 'different' });", ''],
  pasReluOk: ["    if (vl == null || vl === '') { ecarts.push({ champ: k, attendu: va, lu: null, code: 'pas-relu' }); continue; }", "    if (vl == null || vl === '') continue;"],
  dejaParTitre: ["      const it = !p ? Object.entries(L.lbcItems).find(([, ad]) => ad && (refDans(ad.ref, n) || refDans(ad.customRef, n) || refDans(ad.body, n))) : null;", "      const it = !p ? Object.entries(L.lbcItems).find(([, ad]) => ad && /Nike Air Max 90/.test(ad.subject || '')) : null;"],
  dejaPasSu: ["    else if (L.lbcPubliees == null || L.lbcItems == null) out.leboncoin = null;", "    else if (L.lbcPubliees == null || L.lbcItems == null) out.leboncoin = false;"],
  // Deux gardes l'une sur l'autre (la question rendue bloquante, ET la ligne « à choisir » qui ferme la feuille) : retirées ensemble.
  marqueNonBloquante: [["bloque: q.bloque || ((q.champ === 'marque' && !!s.marque) || (q.champ === 'couleur' && !!s.couleur))", 'bloque: q.bloque'], ["  if (res.lignes.some((l) => l.etat !== 'ok') || bloquantes.length ||", "  if (bloquantes.length ||"]],
  pctLibre: ['  if (!PCT_AUSSI.includes(k)) return { ok: false, code: \'pct\' };', ''],
  sansReference: ["  ligne('description', s.description, description, { ref: refVrm(s.numero) });", "  ligne('description', s.description, s.description, { ref: refVrm(s.numero) });"],
};
const args = process.argv.slice(2);
if (args.includes('--prouve')) {
  let rates = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let rouge = false;
    try { execFileSync(process.execPath, [__filename, `--mutation=${m}`], { stdio: 'pipe', timeout: 300000 }); } catch (e) { rouge = e.status === 1; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} ⇒ ${rouge ? 'rouge' : 'RESTE VERT'}`);
    if (!rouge) rates++;
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) non détectée(s)` : `\n✅ ${Object.keys(MUTATIONS).length}/${Object.keys(MUTATIONS).length} mutations détectées`);
  process.exit(rates ? 1 : 0);
}
const mut = (args.find((a) => a.startsWith('--mutation=')) || '').slice(11);

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d !== undefined ? '  → ' + String(d).slice(0, 600) : '')); } };

(async () => {
  // La règle de l'app, depuis une copie (mutable) de src/.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-aussi-'));
  const copier = (rel, txt) => { const d = path.join(dir, rel); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.writeFileSync(d, txt != null ? txt : fs.readFileSync(path.join(R, rel), 'utf8')); };
  for (const f of ['src/publier/agent.js', 'src/publier/tables.js', 'src/publier/listes.js', 'src/correspondances.js', 'src/annonceVinted.js']) copier(f);
  for (const m of fs.readFileSync(path.join(R, 'src/annonceVinted.js'), 'utf8').matchAll(/from\s+['"](\.\/[^'"]+\.js)['"]/g)) copier(path.posix.join('src', m[1]));
  let aussi = fs.readFileSync(F_AUSSI, 'utf8');
  if (mut) {
    const m0 = MUTATIONS[mut]; const paires = m0 && Array.isArray(m0[0]) ? m0 : m0 ? [m0] : [];
    if (!paires.length) { console.log('mutation introuvable : ' + mut); process.exit(2); }
    for (const [a, b] of paires) { if (!aussi.includes(a)) { console.log('mutation introuvable : ' + mut); process.exit(2); } aussi = aussi.replace(a, b); }
  }
  copier('src/publier/aussi.js', aussi);
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  const A = await import(pathToFileURL(path.join(dir, 'src/publier/aussi.js')).href);
  const C = await import(pathToFileURL(path.join(dir, 'src/correspondances.js')).href);
  const TB = await import(pathToFileURL(path.join(dir, 'src/publier/tables.js')).href);
  const LS = await import(pathToFileURL(path.join(dir, 'src/publier/listes.js')).href);

  // ── T : les correspondances, aucune approximative ──
  { const bons = { '42': '42', '42,5': '42,5', '42.5': '42,5', 'EU 42': '42', '42 EU': '42', 'eu 43.5': '43,5', '38': '38' };
    const mauvais = ['US 9', 'US 9.5', 'UK 8', 'UK 8,5', '42 2/3', '42⅔', '42 ⅓', '9.5', '9', 'M', 'L', '', '4 2', '42,3', '42.75', 'EU', '42-43', '420', 'US 42'];
    const b = Object.entries(bons).filter(([t, v]) => A.pointureExacte(t) !== v);
    const m = mauvais.filter((t) => A.pointureExacte(t) != null);
    dit(!b.length, 'T1 — une pointure EU passe telle quelle (« 42 », « 42,5 », « 42.5 », « EU 42 »)', JSON.stringify(b));
    dit(!m.length, 'T2 — toute autre grille (US, UK, 42 ⅔, 9,5, M…) n’a AUCUNE conversion : « à choisir »', JSON.stringify(m.map((t) => [t, A.pointureExacte(t)])));
    const usuk = []; for (let n = 3; n <= 15; n += 0.5) for (const g of ['US', 'UK', 'US ', 'UK ']) { const t = g + String(n).replace('.', ','); if (A.pointureExacte(t) != null) usuk.push(t); }
    dit(!usuk.length, 'T2 — US / UK 3 à 15 (demi-pointures comprises) : jamais converties', usuk.slice(0, 10).join(', '));
    const hors = A.POINTURES_CHOIX.filter((p) => !C.LBC_VALEURS.shoe_size.includes(p));
    dit(A.POINTURES_CHOIX.length >= 30 && !hors.length, `T3 — les pointures qu’il peut choisir sont celles de la liste du site (${A.POINTURES_CHOIX.length})`, JSON.stringify(hors)); }
  { const etats = ['Neuf avec étiquette', 'Neuf sans étiquette', 'Très bon état', 'Bon état', 'Satisfaisant'];
    const lbc = etats.map((e) => C.etatLbc(e));
    dit(JSON.stringify(lbc) === JSON.stringify(['Neuf avec étiquette', 'Neuf sans étiquette', 'Très bon état', 'Bon état', 'État satisfaisant']), 'T4 — l’état Vinted → Leboncoin : les cinq mots exacts', JSON.stringify(lbc));
    dit(C.etatLbc('Comme neuf') == null && C.etatLbc('Usé') == null, 'T4 — un état inconnu n’est rapproché de rien', String(C.etatLbc('Comme neuf')));
    dit(C.couleurLbc('Vert d’eau') == null && C.couleurLbc('Blanc cassé') == null && C.couleurLbc('Noir') === 'Noir', 'T5 — une couleur hors table n’est pas « la plus proche » (Vert d’eau ≠ Vert)', JSON.stringify([C.couleurLbc('Vert d’eau'), C.couleurLbc('Blanc cassé')]));
    const m1 = TB.marqueVersLbc('Nikee', 'chaussures'), m2 = TB.marqueVersLbc('nike', 'chaussures');
    dit(m1.etat === 'hors-liste' && m2.etat === 'sure' && m2.valeur === 'Nike', 'T6 — la marque : le libellé EXACT de la liste du site (casse ignorée), « Nikee » n’est pas Nike', JSON.stringify([m1, m2])); }
  { const fautes = [];
    for (const [id, t] of Object.entries(C.TABLE_VINTED)) {
      const l = t.lbc; if (l.sous) { const sous = C.lbcSousCategories().find((x) => x.sous === l.sous); if (!sous) fautes.push(id + ' lbc sous ' + l.sous); const cr = C.LBC_CRITERES_DE[l.sous];
        if (cr && l.univers && !(C.LBC_VALEURS[cr.univers] || []).includes(l.univers)) fautes.push(id + ' lbc univers'); if (cr && l.type && !(C.LBC_VALEURS[cr.type] || []).includes(l.type)) fautes.push(id + ' lbc type'); }
      const v = t.vc; if (v.univers && v.categorie && v.sous && !(LS.VC_DEPOT[v.univers] && LS.VC_DEPOT[v.univers][v.categorie] && LS.VC_DEPOT[v.univers][v.categorie].includes(v.sous))) fautes.push(id + ' vc ' + [v.univers, v.categorie, v.sous].join('>'));
    }
    dit(!fautes.length, `T7 — chaque catégorie de la table vérifiée (${Object.keys(C.TABLE_VINTED).length}) existe telle quelle dans les listes de Leboncoin et de Vestiaire`, fautes.join(' · ')); }

  // ── P : le prix ──
  { const pl = { valeur: 50, de: 'mini' };
    const cas = [[59.5, 0, '60'], [59.5, 10, '66'], [60, 0, '60'], [60, 5, '63'], [45, 20, '54']].map(([p, k, v]) => { const r = A.prixAussi(p, k, null); return r.ok && String(r.prix) === v ? null : [p, k, r]; }).filter(Boolean);
    dit(!cas.length, 'P1 — le même prix, ou +N %, à l’euro SUPÉRIEUR (jamais l’inférieur)', JSON.stringify(cas));
    const sous = A.prixAussi(45, 0, pl), egal = A.prixAussi(50, 0, pl), dessus = A.prixAussi(46, 10, pl);
    dit(!sous.ok && sous.code === 'sous-plancher' && egal.ok && dessus.ok && dessus.prix === 51, 'P2 — jamais sous le plancher : 45 € sous 50 € ⇒ refusé, « à choisir »', JSON.stringify([sous, egal, dessus]));
    dit(!A.prixAussi(60, 7, null).ok && !A.prixAussi(60, 50, null).ok && !A.prixAussi(0, 0, null).ok, 'P3 — seulement les taux proposés (0, 5, 10, 15, 20 %) ; un prix pas lu ⇒ rien', JSON.stringify(A.prixAussi(60, 7, null)));
    dit(JSON.stringify(A.plancherAussi(null, 30)) === JSON.stringify({ valeur: 33, de: 'achat' }) && A.plancherAussi(null, null) === null, 'P4 — le plancher : prix mini, sinon achat + 10 %, sinon aucun', JSON.stringify(A.plancherAussi(null, 30))); }

  // ── F : la feuille ──
  const IDS = Array.from({ length: 50 }, (_, i) => String(4100000100 + i * 13));
  const entree = (i, o = {}) => Object.assign({ id: IDS[i], titre: 'Nike Air Max 90 blanche', description: 'Portées deux fois.', marque: 'Nike', taille: '42', etat: 'Très bon état', couleur: 'Blanc', catalogId: '1242', prix: 59, photos: [1, 2, 3].map((k) => `https://images1.vinted.net/t/a/f800/${IDS[i]}-${k}.jpeg`), numero: String(300 + i), prixMini: 45 }, o);
  const ctx = { sites: ['leboncoin', 'vestiaire'], marqueVc: { etat: 'listee', valeur: 'Nike' } };
  { const f = A.feuilleAussi(entree(30), ctx);
    const env = f.sites.leboncoin.envoi && f.sites.leboncoin.envoi.fiche;
    const ld = f.sites.leboncoin.lignes.find((x) => x.champ === 'description');
    dit(ld && ld.etat === 'ok' && /Réf\. VRM-330$/.test(ld.site) && ld.vinted === 'Portées deux fois.', 'F1 — la feuille MONTRE la description qui partira, avec « Réf. VRM-330 » (avant : Vinted, après : le site)', JSON.stringify(ld));
    dit(f.pret && env && env.numero === '330' && env.vintedId === IDS[30] && env.photos.every((u) => u.includes(IDS[30])) && /Réf\. VRM-330$/.test(env.description), 'F1 — 50 annonces au même titre : la 31e ⇒ SON N°, SES photos, « Réf. VRM-330 », son identifiant', JSON.stringify(env));
    const autres = IDS.map((_, i) => A.feuilleAussi(entree(i), ctx).sites.leboncoin.envoi.fiche.numero);
    dit(new Set(autres).size === 50, 'F1 — chacune des 50 désigne SON N° (aucun doublon, aucune voisine)', autres.slice(0, 5).join(',')); }
  { const f = A.feuilleAussi(entree(2, { catalogId: '99999' }), ctx);
    const l = f.sites.leboncoin.lignes.find((x) => x.champ === 'categorie');
    dit(!f.pret && f.sites.leboncoin.etat === 'a-choisir' && l.etat === 'a-choisir' && !f.sites.leboncoin.envoi && !f.sites.vestiaire.envoi, 'F2 — catégorie Vinted inconnue : « à choisir », AUCUN envoi', JSON.stringify(l)); }
  { const f = A.feuilleAussi(entree(3, { taille: 'US 9' }), ctx);
    dit(!f.pret && f.sites.leboncoin.lignes.find((x) => x.champ === 'taille').etat === 'a-choisir' && !f.sites.leboncoin.envoi, 'F3 — « US 9 » : la taille à choisir, aucun envoi');
    const g = A.feuilleAussi(entree(3, { taille: 'US 9' }), Object.assign({}, ctx, { reponses: { pointure: '43' } }));
    dit(g.pret && g.sites.leboncoin.attendu.taille === '43' && g.sites.vestiaire.attendu.taille === '43', 'F3 — SA pointure (43) choisie : prête, posée sur les deux sites', JSON.stringify(g.sites.leboncoin.attendu)); }
  { const f = A.feuilleAussi(entree(4, { marque: 'Nikee' }), { sites: ['leboncoin'] });
    dit(!f.pret && f.sites.leboncoin.lignes.find((x) => x.champ === 'marque').etat === 'a-choisir', 'F4 — une marque lue absente de la liste du site : « à choisir » (bloquant), jamais « Autre » d’office');
    const g = A.feuilleAussi(entree(4, { couleur: 'Vert d’eau' }), { sites: ['leboncoin'] });
    dit(!g.pret && g.sites.leboncoin.lignes.find((x) => x.champ === 'couleur').etat === 'a-choisir', 'F4 — une couleur lue absente de la liste du site : « à choisir » (bloquant)'); }
  { const f = A.feuilleAussi(entree(5, { marque: 'Nike' }), { sites: ['vestiaire'], marqueVc: { etat: 'pas-su' } });
    const g = A.feuilleAussi(entree(5, { marque: 'Gucci' }), { sites: ['vestiaire'], marqueVc: { etat: 'absente' } });
    dit(!f.pret && f.sites.vestiaire.etat === 'a-choisir' && g.sites.vestiaire.etat === 'refus', 'F5 — Vestiaire : liste des marques pas lue ⇒ à choisir ; marque absente de SA liste ⇒ pas vendable ici', JSON.stringify([f.sites.vestiaire.etat, g.sites.vestiaire.etat])); }
  { const f = A.feuilleAussi(entree(6), Object.assign({}, ctx, { pct: { leboncoin: 10 } }));
    dit(f.sites.leboncoin.envoi.fiche.prix === 65 && f.sites.vestiaire.envoi.fiche.prix === 59 && f.sites.leboncoin.attendu.prix === 65, 'F6 — +10 % sur Leboncoin seulement : 59 € → 65 € ; Vestiaire garde 59 €', JSON.stringify([f.sites.leboncoin.envoi.fiche.prix, f.sites.vestiaire.envoi.fiche.prix])); }
  { const f = A.feuilleAussi(entree(7, { numero: '' }), ctx);
    dit(!f.ok && f.code === 'sans-numero', 'F7 — sans N° (pas de « Réf. VRM-{N°} » possible) : rien', JSON.stringify(f)); }

  // ── R : la relecture du formulaire ──
  { const a = A.feuilleAussi(entree(8), ctx).sites.leboncoin.attendu;
    const lu = Object.assign({}, a, { prix: '59', photos: '3' });
    dit(A.relireFormulaire(a, lu).ok, 'R1 — tout relu égal ⇒ ok (le prix « 59 », 3 photos)');
    const r1 = A.relireFormulaire(a, Object.assign({}, lu, { taille: '43' }));
    dit(!r1.ok && r1.ecarts.length === 1 && r1.ecarts[0].champ === 'taille' && r1.ecarts[0].code === 'different', 'R2 — une pointure relue différente ⇒ refus, nommée', JSON.stringify(r1));
    const l2 = Object.assign({}, lu); delete l2.marque;
    const r2 = A.relireFormulaire(a, l2);
    dit(!r2.ok && r2.ecarts.some((e) => e.champ === 'marque' && e.code === 'pas-relu'), 'R3 — un champ pas relu sur la page ⇒ refus (jamais « pas vu = bon »)', JSON.stringify(r2));
    const r3 = A.relireFormulaire(a, Object.assign({}, lu, { description: a.description.replace('VRM-308', 'VRM-309') }));
    dit(!r3.ok && r3.ecarts[0].champ === 'description', 'R4 — une description où la référence a changé ⇒ refus', JSON.stringify(r3)); }

  // ── D : déjà publiée, par identité seulement ──
  { const L = { lbcPubliees: {}, lbcItems: { 2999000111: { subject: 'Nike Air Max 90 blanche', body: 'Portées deux fois.' } }, vcLiens: {}, vcPubliees: [], faits: {} };
    const d0 = A.dejaAussi('330', L);
    dit(d0.leboncoin === false && d0.vestiaire === false, 'D1 — une annonce Leboncoin au MÊME titre sans « VRM-330 » n’est PAS « déjà publiée »', JSON.stringify(d0));
    const d1 = A.dejaAussi('330', Object.assign({}, L, { lbcItems: { 2999000111: { subject: 'x', body: 'Réf. VRM-330' } } }));
    const d2 = A.dejaAussi('330', Object.assign({}, L, { lbcPubliees: { 2999000222: { numero: '330' } } }));
    const d3 = A.dejaAussi('330', Object.assign({}, L, { vcLiens: { 48123456: '330' } }));
    dit(d1.leboncoin && d1.leboncoin.id === '2999000111' && d2.leboncoin && d2.leboncoin.id === '2999000222' && d3.vestiaire && d3.vestiaire.id === '48123456', 'D2 — par identité : « VRM-330 » lu, l’annonce créée par VRM (`lbc_publiees`), le lien Vestiaire', JSON.stringify([d1, d2, d3]));
    const d4 = A.dejaAussi('33', Object.assign({}, L, { lbcItems: { 1: { body: 'Réf. VRM-330' } } }));
    dit(d4.leboncoin === false, 'D3 — « VRM-330 » ne vaut pas pour le N°33', JSON.stringify(d4));
    const d5 = A.dejaAussi('330', { lbcPubliees: null, lbcItems: null, vcLiens: null, vcPubliees: null, faits: {} });
    dit(d5.leboncoin === null && d5.vestiaire === null, 'D4 — lecture ratée ⇒ « pas su » (null), jamais « pas encore publiée »', JSON.stringify(d5));
    const f = A.feuilleAussi(entree(9), Object.assign({}, ctx, { deja: { leboncoin: { id: '2999000222', lien: 'x' }, vestiaire: false } }));
    dit(f.sites.leboncoin.etat === 'deja' && !f.sites.leboncoin.envoi && f.sites.vestiaire.etat === 'pret', 'D5 — déjà sur Leboncoin : rien ne repart sur Leboncoin, Vestiaire reste prêt', JSON.stringify([f.sites.leboncoin.etat, f.sites.vestiaire.etat])); }

  // ── S : l'onglet de travail n'envoie RIEN lui-même et ne maquille rien (la page du site envoie) ──
  if (!mut) { const sans = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
    const D = sans(fs.readFileSync(path.join(R, 'vinted-sync-extension/vrm-depot-aussi.js'), 'utf8'));
    const interdits = [/\bfetch\s*\(/, /XMLHttpRequest/, /sendBeacon/, /\bWebSocket\b/, /isTrusted\s*[:=]/, /Object\.defineProperty\([^)]*isTrusted/, /chrome\.debugger/, /new\s+MouseEvent\s*\(/, /new\s+PointerEvent\s*\(/].filter((re) => re.test(D)).map(String);
    dit(!interdits.length, 'S1 — vrm-depot-aussi.js : aucune requête (fetch, XHR, beacon), aucun maquillage (isTrusted, debugger, souris inventée)', interdits.join(' · '));
    const M = JSON.parse(fs.readFileSync(path.join(R, 'vinted-sync-extension/manifest.json'), 'utf8'));
    const ou = M.content_scripts.filter((c) => c.js.includes('vrm-depot-aussi.js'));
    dit(ou.length === 2 && ou.every((c) => c.all_frames === false && !c.world) && ou.some((c) => c.matches.some((m) => /leboncoin/.test(m))) && ou.some((c) => c.matches.some((m) => /vestiairecollective/.test(m))), 'S2 — chargé sur leboncoin.fr et vestiairecollective.com, cadre principal, monde isolé', JSON.stringify(ou.map((c) => c.matches))); }

  // ── X : la copie de l'extension ──
  if (!mut) { let v = ''; try { v = execFileSync(process.execPath, [path.join(__dirname, 'recopier-gardes-extension.cjs'), '--verifie'], { encoding: 'utf8' }); } catch (e) { v = String(e.stdout || 'rouge'); }
    dit(/✅/.test(v), 'X1 — la règle de l’extension (GARDES_APP) est la copie exacte de l’app', v.trim()); }
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\n${ko ? '❌' : '✅'} audit-publier-aussi : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ l’audit a levé : ' + (e && e.stack || e)); process.exit(1); });
